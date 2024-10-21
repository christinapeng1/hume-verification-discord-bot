require("dotenv").config();

// Check if required environment variables are defined, else log an error and exit the process
if (
  !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
  !process.env.GOOGLE_PRIVATE_KEY ||
  !process.env.DISCORDBOTTOKEN ||
  !process.env.GOOGLE_SPREADSHEET
) {
  console.error("Environment variables in .env not defined!");
  process.exit(1);
}

// Import Discord.js and initialize a new Discord client with specific intents (permissions)
const Discord = require("discord.js");
const client = new Discord.Client({
  intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMembers,
  ],
});
const fs = require("fs");

// Load configuration from an external config file (config.json)
const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));

// Import Google Sheets API and initialize a new GoogleSpreadsheet object
const { GoogleSpreadsheet } = require("google-spreadsheet");
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SPREADSHEET);

// Event listener when the bot is ready and logged in
client.on("ready", async () => {
  console.log(`Logged in as ${client.user?.tag}!`);
  client.guilds.fetch("991790422433210459"); // Put Hume's Server ID here

  // Authenticate with Google Sheets API using service account credentials from env variables
  await doc.useServiceAccountAuth({
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY,
  });
  await doc.loadInfo();

  // Call updateVerifiedUsers function every 15 seconds to update user data
  setInterval(updateVerifiedUsers, 1000 * 15);
});

async function updateVerifiedUsers() {
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
  // Find the user based on DiscordTag
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
      continue; // Skip if the user is not found
    }
    console.log(`Found user: ${user.username}#${user.discriminator}`);

    row.DiscordId = user.id; // Update the row with the user's Discord ID
    row.DiscordTagCache = row.DiscordTag; // Update the cache to match current tag
    promises.push(row.save()); // Save the updated row back to the sheet
  }

  // Iterate over each server in verification.json
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

      // List of users with the verified role
      const verifiedRoleMembers = verifiedRole.members.map((m) => m.user.id);
      // List of verified users from the sheet
      const sheetVerifiedMembers = rows.map((row) => row.DiscordId);
      // Users to add the verified role to (those in the sheet but not in the role)
      const posDiff = sheetVerifiedMembers.filter(
        (x) => !verifiedRoleMembers.includes(x)
      );
      // Add the verified role to necessary users
      for (const userId of posDiff) {
        await guild.members.cache.get(userId)?.roles.add(verifiedRole);
      }
    })
  );

  await Promise.all(promises).catch(console.error);
}

client.login(process.env.DISCORDBOTTOKEN);
