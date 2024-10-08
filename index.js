require("dotenv").config();

if (
  !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
  !process.env.GOOGLE_PRIVATE_KEY ||
  !process.env.DISCORDBOTTOKEN ||
  !process.env.GOOGLE_SPREADSHEET
) {
  console.error("Environment variables in .env not defined!");
  process.exit(1);
}

const Discord = require("discord.js");
const client = new Discord.Client({
  intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMembers,
  ],
});
const fs = require("fs");

const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));
const constants = require("./constants");

const { GoogleSpreadsheet } = require("google-spreadsheet");
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SPREADSHEET);

client.on("ready", async () => {
  // client.user.setActivity("the BEST server!", { type: "WATCHING" });
  console.log(`Logged in as ${client.user?.tag}!`);
  client.guilds.fetch("991790422433210459"); // TODO: don't hardcode this

  await doc.useServiceAccountAuth({
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY,
  });
  await doc.loadInfo();

  setInterval(updateVerifiedStudents, 1000 * 15);
});

client.on("message", (msg) => {
  if (!msg.author.bot && msg.type === "DEFAULT") {
    if (msg.content.substring(0, config.prefix.length) === config.prefix) {
      const message = msg.content;
      let args = message.substring(1).split(" ");
      const cmd = args[0];
      args = args.splice(1);

      const isHyper = msg.author.id == "196685652249673728";

      switch (cmd) {
        case "update":
          if (isHyper) {
            constants[args[0]]?.forEach((obj) => {
              msg.channel.send({ content: obj.text, embeds: [obj.embed] });
            });
          }
          break;
      }
    }
  }
});

client.on("guildMemberAdd", (member) => {
  if (member.guild.id === "828708982506913792") {
    client.channels.cache.get("828765547663196191")?.send({
      content: `<@${member.id}>`,
      embeds: [constants.autowelcome.embed],
    });
    member.send({ content: constants.autowelcome.dm });
  }
});

// client.on("messageReactionAdd", (reaction, user) => {
//   reaction.message.react(reaction.emoji)
// })

async function updateVerifiedStudents() {
  /* Three columns in the Google Sheet:
   * 1. DiscordTag (automatically filled in by Google Form)
   * 2. DiscordTagCache (copy of DiscordTag made by this function)
   * 3. DiscordId (filled in by this function)
   * If DiscordTagCache is different from DiscordTag, then the DiscordId is updated.
   */
  const promises = [];

  const sheet = doc.sheetsByIndex[0];
  const rows = await sheet.getRows();
  console.log(`Loaded ${rows.length} rows from the sheet.`);
  const servers = require("./verification.json");

  // Get the DiscordIds from the DiscordTags (if necessary)
  const updatedRows = rows.filter(
    (row) => row.DiscordTagCache !== row.DiscordTag
  );
  for (const row of updatedRows) {
    console.log(`[~] ${row.DiscordTag} attempting to update...`);
    
    let user = client.users.cache.find((u) =>
      u.discriminator?.length === 4
        ? `${u.username}#${u.discriminator}` === row.DiscordTag
        : u.username === row.DiscordTag.toLowerCase()
    );
    if (!user) {
      console.log(
        `User with DiscordTag ${row.DiscordTag} not found in the server.`
      );
      continue;
    }
    console.log(`Found user: ${user.username}#${user.discriminator}`);

    row.DiscordId = user.id;
    row.DiscordTagCache = row.DiscordTag;
    promises.push(row.save());
  }

  /* servers.forEach(({ guildid: guildId, verifiedroleid: verifiedRoleId }) => {
    client.guilds.fetch(guildId).then((guild) => {
      guild.members.fetch().then((members) => {
        const verifiedRoleMembers = guild.roles.cache
          .get(verifiedRoleId)
          ?.members.map((m) => m.user.tag.toLowerCase());
        const gSheetTags = discordUsernames.map((v) => v.toLowerCase());
        const posDiff = gSheetTags
          .filter((x) => !verifiedRoleMembers?.includes(x.toLowerCase()))
          .map((v) => v.toLowerCase()); // filters to differences between the two arrays - verifiedRoleMembers is
        // current members on the server with the "Verified" role, res.data.values[0]
        // is Google Form list of DiscordTags that should have the role
        // const posdiff = diff // diff.filter((x) => gsheettags.includes(x));
        const negDiff = verifiedRoleMembers
          .filter((x) => !gSheetTags.includes(x.toLowerCase()))
          .map((v) => v.toLowerCase()); // diff.filter((x) => verifiedrolemembers.includes(x));
        const diff = posDiff.concat(negDiff);
        diff.forEach((DiscordTag) => {
          const user = client.users.cache.find(
            (u) => u.tag.toLowerCase() === DiscordTag.toLowerCase()
          )?.id;
          if (user) {
            const guildUser = guild.members
              .fetch(user)
              .then((guildUser) => {
                const username = guildUser.user.username.toLowerCase();
                const discrim = guildUser.user.discriminator;
                if (posDiff.includes(username + "#" + discrim)) {
                  guildUser.roles.add(verifiedRoleId).catch(console.error);
                  console.log("+" + username);
                } else if (negDiff.includes(username + "#" + discrim)) {
                  guildUser.roles.remove(verifiedRoleId).catch(console.error);
                  console.log("-" + username);
                }
              })
              .catch(console.error);
          } else {
            // console.log(`${DiscordTag} is invalid!`);
          }
        });
      });
    });
  }); */

  promises.push(
    servers.map(async (server) => {
      const guild = await client.guilds.fetch(server.guildid);
      const members = await guild.members.fetch();
      const verifiedRole = guild.roles.cache.get(server.verifiedroleid);
      if (!verifiedRole) {
        console.error(
          `Verified role ${server.verifiedroleid} not found in ${guild.name}!`
        );
        return;
      }

      const verifiedRoleMembers = verifiedRole.members.map((m) => m.user.id);
      const sheetVerifiedMembers = rows.map((row) => row.DiscordId);
      const posDiff = sheetVerifiedMembers.filter(
        (x) => !verifiedRoleMembers.includes(x)
      );
      const negDiff = verifiedRoleMembers.filter(
        (x) => !sheetVerifiedMembers.includes(x)
      );
      for (const userId of posDiff) {
        await guild.members.cache.get(userId)?.roles.add(verifiedRole);
      }
      for (const userId of negDiff) {
        await guild.members.cache.get(userId)?.roles.remove(verifiedRole);
      }

      // console.log(
      //   `Updated ${guild.name} with ${posDiff.length} new members and ${negDiff.length} removed members.`
      // );
    })
  );

  await Promise.all(promises).catch(console.error);
}

client.login(process.env.DISCORDBOTTOKEN);
