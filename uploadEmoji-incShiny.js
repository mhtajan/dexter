const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function uploadEmoji(element,url) {
    const id = element.url.split("/").filter(Boolean).pop();
    const imageUrl = url+'/'+id+'.gif';
    let emojiName = '';

    try {
      const imageRes = await axios.get(imageUrl, {
        responseType: "arraybuffer"
      });

      let imageBase64 = Buffer.from(imageRes.data, "binary").toString("base64");
      const b64FileSize = imageBase64.replaceAll('=','').length * (3 / 4);

      let exceedsMaxSize = b64FileSize > 256000;

      let imageType = imageRes.headers["content-type"];

      emojiName = element.name.toString().replace('-','_');
      emojiName = url.includes('shiny') ? emojiName+'_shiny' : emojiName;

      if(exceedsMaxSize)
      {
        console.log('Exceeds Max Size Using webp '+b64FileSize);
        imageBase64 = (await sharp(imageRes.data, { animated: true}).webp({ effort: 6 , quality: 24}).toBuffer()).toString('base64');
        const newFileSize = imageBase64.replaceAll('=','').length * (3 / 4);
        console.log('New Size Using webp '+newFileSize);
        imageType = 'image/webp';
      }

      let emojiData = {
        name: emojiName,
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

      console.log(`✅ Uploaded emoji: ${emojiName}`);
    } catch (err) {
      console.error(`❌ Error uploading ${emojiName}:`, err.response?.data || err.message);
    }

    await delay(2000); // ⏱️ Delay 5 seconds per upload
}


client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const pokemonFile = path.join(__dirname, 'pokemon.json');
  const data = JSON.parse(fs.readFileSync(pokemonFile, "utf8") || "{}");

  for (const element of data.results) {
    
    await uploadEmoji(element,'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/');
    await uploadEmoji(element,'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/shiny');

  }

  console.log("✅ Finished uploading all emojis.");
  client.destroy();
});

client.login(process.env.TOKEN);
