# Hume Verification Discord Bot

This bot verifies Discord users by associating them with their Hume account email. The verification form is available at https://forms.gle/QfNGSgaB5bSFM43x9.

## .env file

Create a Google service account, and generate a new key. Download the `.json` file, and copy&paste both the service email and the private key into the `.env` file. Make sure there are double quotes around the private key, or it will not properly parse the new line characters.

Create a new Discord bot, copy its token, and paste it into the `.env` file.

Create a new Google Forms that collects Discord usernames, and copy the sheet ID (found in the sheet's URL) into the `.env` file.

## Format of the Google Form

From the Google Form you just created, rename the username column to `DiscordTag`, and add two empty columns `DiscordTagCache` and `DiscordId`. Make sure to share the sheet with your service email (in your `.env` file) and give it write access.

## verification.json

Modify this file to add new servers. The bot will add `verifiedroleid` to any user that is verified in `guildid`.
