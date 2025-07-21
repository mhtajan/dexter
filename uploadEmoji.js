const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const pokemonFile = path.join(__dirname, 'pokemon.json');
  const data = JSON.parse(fs.readFileSync(pokemonFile, "utf8") || "{}");

  for (const element of data.results) {
    const id = element.url.split("/").filter(Boolean).pop();
    const imageUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${id}.gif`;

    try {
      const imageRes = await axios.get(imageUrl, {
        responseType: "arraybuffer"
      });

      const imageBase64 = Buffer.from(imageRes.data, "binary").toString("base64");
      const imageType = imageRes.headers["content-type"];

      const emojiData = {
        name: element.name,
        image: `data:${imageType};base64,${imageBase64}`
      };

      const res = await axios.post(
        `https://discord.com/api/v10/applications/${process.env.APP_ID}/emojis`,
        emojiData,
        {
          headers: {
            Authorization: `Bot ${process.env.TOKEN}`,
            "Content-Type": "application/json"
          }
        }
      );

      console.log(`✅ Uploaded emoji: ${element.name}`);
    } catch (err) {
      console.error(`❌ Error uploading ${element.name}:`, err.response?.data || err.message);
    }

    await delay(5000); // ⏱️ Delay 5 seconds per upload
  }

  console.log("✅ Finished uploading all emojis.");
  client.destroy();
});

client.login(process.env.TOKEN);
