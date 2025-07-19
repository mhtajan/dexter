require("dotenv").config();
const { Client, GatewayIntentBits, ComponentType,ActionRowBuilder,ButtonBuilder, ButtonStyle, Events, EmbedBuilder} = require("discord.js");
const fs = require("fs");
const path = require("path");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.MessageContent]
});

let pokemonList = [];
let globalPokemonId = 1;
const starters = [{
      "name": "bulbasaur",
      "url": "https://pokeapi.co/api/v2/pokemon/1/"
    },
    {
      "name": "charmander",
      "url": "https://pokeapi.co/api/v2/pokemon/4/"
    },
    {
      "name": "squirtle",
      "url": "https://pokeapi.co/api/v2/pokemon/7/"
    },];

const pokeBalls = [
  {
    name: "Pokeball",
    sprite: "<:Bag_Pok_Ball_SV_Sprite:1395551372392530071>",
    imageUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png",
  },
  {
    name: "Great Ball",
    sprite: "<:Bag_Great_Ball_SV_Sprite:1395601163927425126>",
    imageUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/great-ball.png",
  },
  {
    name: "Ultra Ball",
    sprite: "<:Bag_Ultra_Ball_SV_Sprite:1395601185070649344>",
    imageUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ultra-ball.png",
  },
  {
    name: "Master Ball",
    sprite: "<:Bag_Master_Ball_SV_Sprite:1395601199067037777>",
    imageUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/master-ball.png",
  },
];
    
function calcHP(base, level) {
  return Math.floor(((2 * base) * level) / 100) + level + 10;
}

function calcStat(base, level) {
  return Math.floor(((2 * base) * level) / 100) + 5;
}

const idFile = "pokemon_id.txt";
if (fs.existsSync(idFile)) {
  globalPokemonId = parseInt(fs.readFileSync(idFile, "utf8")) || 1;
}
function saveGlobalPokemonId() {
  fs.writeFileSync(idFile, String(globalPokemonId));
}

async function SafeDeleteMessage(message) {
     try {
       const fetchedMessage = await message.fetch();
       console.log("message exists ready to delete");
       fetchedMessage.delete();
     } catch (error) {
       if (error.code === 10008) {
        console.log("message already deleted");
         return true; // Message not found (deleted)
       }
     }
   }

async function saveData(dataX) {
   const PKMNFile = path.join(__dirname, "pokemon.json");
  if (!fs.existsSync(PKMNFile)) {
    fs.writeFileSync(PKMNFile, JSON.stringify({}, null, 2));
    console.log("✅ created pokemon.json");
  }
  fs.writeFileSync("pokemon.json", JSON.stringify(dataX, null, 2));
}
async function fetchPokemonList() {
  console.log("📥 Fetching Pokémon data from PokéAPI...");

  const res = await fetch("https://pokeapi.co/api/v2/pokemon?limit=386");
  const dataF = await res.json();
  saveData(dataF);
  const data = JSON.parse(fs.readFileSync("pokemon.json", "utf8") || "{}");
  const detailedList = await Promise.all(
    data.results.map(async (pokemon) => {
      try {
        // Get Pokémon details
        const pokeData = await fetch(pokemon.url).then((r) => r.json());
        // Get species data (for pal_park_encounters)
        const speciesData = await fetch(pokeData.species.url).then((r) =>
          r.json()
        );

        const palPark = speciesData.pal_park_encounters?.[0];
        const rate = palPark?.rate ?? 20; 
        const captureRate = speciesData.capture_rate ?? 45; 
        return {
          id: pokeData.id,
          name: pokeData.name,
          rate: rate,
          sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/'+pokeData.id+'.gif', //"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/35.gif"
          captureRate: captureRate,
        };
      } catch (e) {
        console.warn(`⚠️ Failed to fetch data for ${pokemon.name}`);
        return null;
      }
    })
  );

  // Remove failed fetches
  pokemonList = detailedList.filter(Boolean);

  console.log(`✅ Loaded ${pokemonList.length} Pokémon with rates.`);
}
const caughtFile = path.join(__dirname, "caught_pokemon.json");
if (!fs.existsSync(caughtFile)) {
  fs.writeFileSync(caughtFile, JSON.stringify({}, null, 2));
  console.log("✅ created caught_pokemon.json");
}
async function savePokemonCaught(userId, pokemon) {
  const data = JSON.parse(fs.readFileSync("caught_pokemon.json", "utf8") || "{}");
  if (!data[userId]) data[userId] = [];
  data[userId].push(pokemon);
  fs.writeFileSync("caught_pokemon.json", JSON.stringify(data, null, 2));
}
async function uploadPokeballEmoji() {
  for (const ball of pokeBalls) {
    // Try to extract emoji ID from the existing sprite
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const existingEmojis = await guild.emojis.fetch();
    const match = ball.sprite.match(/<a?:.+:(\d+)>/);
    const emojiId = match ? match[1] : null;

    // Check if emoji exists by ID or name
    const exists = existingEmojis.some(
      (emoji) =>
        emoji.id === emojiId || emoji.name === ball.name.replace(/\s/g, "_")
    );

    if (exists) {
      console.log(`✅ Emoji "${ball.name}" already exists.`);
      continue;
    }

    try {
      // Download image
      const response = await axios.get(ball.imageUrl, {
        responseType: "arraybuffer",
      });

      // Upload emoji
      const uploadedEmoji = await guild.emojis.create({
        name: ball.name.replace(/\s/g, "_"), // Discord doesn't allow spaces in emoji names
        attachment: response.data,
      });

      console.log(`🆕 Uploaded missing emoji: ${uploadedEmoji.name}`);
    } catch (err) {
      console.error(`❌ Failed to upload emoji "${ball.name}":`, err.message);
    }
  }
}
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const channel = await client.channels.fetch(process.env.SPAWN_CHANNEL_ID);
  if (!channel) return console.error("❌ Channel not found");

  await fetchPokemonList();

  const spawnLoop = async () => {
    const candidates = pokemonList.filter((pkm) => Math.random() * 100 < pkm.rate);

    const selected = candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : pokemonList[Math.floor(Math.random() * pokemonList.length)];
const caughtMap = {};

const exampleEmbed = new EmbedBuilder()
	.setTitle(`✨ A wild **${selected.name}** appeared!`)
	.setImage(selected.sprite)
    const guild = client.guilds.cache.get(process.env.GUILD_ID) // or use a specific guild ID
    const emojis = await guild.emojis.fetch();
    const emojiNames = [
            "Pokeball",
            "Great_Ball",
            "Ultra_Ball",
            "Master_Ball",
          ];
   const reactBalls = [];
   emojiNames.forEach((name) => {
            const emoji = emojis.find((e) => e.name === name);
            if (emoji) {
              reactBalls.push({
                name: name,
                id: emoji.id,
              });
            } else {
              console.log(`❌ ${name} is missing.`);
            }
          });
   await channel.send({
            embeds: [exampleEmbed],
            components: [
              new ActionRowBuilder().addComponents(
                reactBalls.map(pokeBall =>
                  new ButtonBuilder()
                    .setCustomId(`pokeball-${pokeBall.name}`)
                    .setEmoji(pokeBall.id)
                    .setStyle(ButtonStyle.Secondary)
                )
              )
            ]
          }).then(async (sentMessage) => {
  try {
    const collector = sentMessage.createMessageComponentCollector({ 
      ComponentType: ComponentType.Button,
      time: 15000 // collector active for 1 minute
    });

participants = [];
  collector.on("collect", async (interaction) => {
  const filePath = path.join(__dirname, 'caught_pokemon.json');
  const caughtData = JSON.parse(fs.readFileSync(filePath));
  const user = interaction.user;
  if (interaction.customId.startsWith("pokeball-")) {
    if(participants.some(p => p.id === user.id)) {
      await interaction.reply({ content: "You have already joined this catch!", ephemeral: true });
      return;
    }
    if (user.bot) return;
    participants.push({
      id: user.id,
      username: user.username,
      ball: interaction.customId.split("-")[1]
    })
    const message = await channel.messages.fetch(interaction.message.id);
    const oldEmbed = message.embeds[0];
    if(!oldEmbed) return;
    const updatedEmbed = new EmbedBuilder(oldEmbed).setDescription(`\n**Participants:** ${participants.length}`);
    await message.edit({
      embeds: [updatedEmbed],
      components: message.components
    });
    await interaction.reply({ content: `You joined the catch with a **${interaction.customId.split("-")[1].replace("_", " ")}**!`, ephemeral: true });
  }
  caughtData[user.id] = caughtData[user.id] || [];
  const hasStarter = caughtData[user.id].some(p => {
    return starters.some(starter => starter.name === p.name);
  });
    if (!hasStarter) {
        try {
          await user.send({
            content: `👋 Hi ${user.username}, you need to pick a starter Pokémon before you can catch wild ones.`,
            components: [
              new ActionRowBuilder().addComponents(
                starters.map(starter =>
                  new ButtonBuilder()
                    .setCustomId(`starter-${starter.name}`)
                    .setLabel(starter.name.charAt(0).toUpperCase() + starter.name.slice(1))
                    .setStyle(ButtonStyle.Secondary)
                )
              )
            ]
          });
  
          await interaction.reply({ content: "📩 Please check your DMs to choose a starter first!", ephemeral: true });
        } catch (err) {
          console.error("Failed to DM user:", err);
         await interaction.reply({ content: "❌ I couldn't DM you. Please enable DMs from server members.", ephemeral: true });
        }
        return;
      }
  
});
  collector.on("end", (collected) => {
    const user = participants[Math.floor(Math.random() * participants.length)];
      if (collected.size >= 0) {
        if(!user){
      channel.send({
          content: `The **${selected.name}** fled! 💨`
        }).then(SafeDeleteMessage(sentMessage))
        return;
    }
     if (user.ball === "Master_Ball") {
      successChance = 100; // Always catch
    } else {
      if (user.ball === "Ultra_Ball") {
        rate = 150
      } else if (user.ball === "Great_Ball") {
        rate = 200;
      } else {
        rate = 255; // Default is Poké Ball
      }

      successChance = Math.min((selected.captureRate / rate) * 100, 100);
      
    }
  const roll = Math.random() * 100;
  if (roll <= successChance) {
    // Successful catch
    if (!caughtMap[user.id]) caughtMap[user.id] = [];

    caughtMap[user.id].push({
      name: selected.name,
      sprite: selected.sprite
    });

    channel.send({
          content: `🎉 **${user.username}** caught **${selected.name}** using **${(user.ball).replace(/_/g, ' ')}**!`,
          allowedMentions: { repliedUser: false }
        }).then(SafeDeleteMessage(sentMessage))
        
    selected.uniqueId = `PKMN-${String(globalPokemonId++).padStart(9, "0")}`;
    saveGlobalPokemonId();
    savePokemonCaught(user.id, selected);
    console.log(`✅ ${user.username} caught ${selected.name}`);

  } else {
    // Failed catch
    if(!user){
      channel.send({
          content: `The **${selected.name}** fled! 💨`
        }).then(SafeDeleteMessage(sentMessage))
    }
    channel.send({
        content: `💨 **${selected.name}** escaped from **${user.username}**!`,
        allowedMentions: { repliedUser: false }
      }).then(SafeDeleteMessage(sentMessage))

    console.log(`❌ ${user.username} failed to catch ${selected.name}`);
  }
      }
      else if (collected.size === 0) {
        channel.send({
          content: `The **${selected.name}** fled! 💨`
        }).then(SafeDeleteMessage(sentMessage))
      }
      
    });

  } catch (err) {
    console.error("❌ Failed to react or collect:", err);
  }
});
    setTimeout(spawnLoop, Math.floor(Math.random() * 20000) + 10000); // 1–3 mins
  };

  spawnLoop();
});
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
const filePath = path.join(__dirname, 'caught_pokemon.json');
  const caughtData = JSON.parse(fs.readFileSync(filePath));
  const user = interaction.user;
  const [type, value] = interaction.customId.split("-");
  if (type === "starter") {
    if (!caughtData[user.id]) caughtData[user.id] = [];

    const alreadyHasStarter = caughtData[user.id].some(p => p.name === value);
    if (alreadyHasStarter) {
      await interaction.reply({ content: "You already have a starter Pokémon!", ephemeral: true });
      return;
    }
    const index = starters.findIndex(p => p.name === value);
    const speciesData = await fetch(starters[index].url).then((r) =>
          r.json()
        );

        const palPark = speciesData.pal_park_encounters?.[0];
        const rate = palPark?.rate ?? 20; 
        const captureRate = speciesData.capture_rate ?? 45; 
    uniqueId = `PKMN-${String(globalPokemonId++).padStart(9, "0")}`;
    saveGlobalPokemonId();
    savePokemonCaught(user.id, {
      id: speciesData.id,
      name: value,
      rate: rate,
      sprite: pokemonList.find(p => p.name === value)?.sprite || "",
      uniqueId: uniqueId,
      captureRate: captureRate
    });

    await interaction.reply({ content: `✅ You picked **${value}** as your starter! ID: \`${uniqueId}\``, ephemeral: true });
  }
});
client.on(Events.MessageCreate, async (message) => {
 if (message.author.bot) return;

  if (message.content.toLowerCase() === '!pokedex') {
    const userId = message.author.id;
    const filePath = path.join(__dirname, 'caught_pokemon.json');

    // Create file if doesn't exist
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify({}, null, 2));
    }

    const data = JSON.parse(fs.readFileSync(filePath));

    const userPokemon = data[userId];

    if (!userPokemon || userPokemon.length === 0) {
      return message.reply("You haven't caught any Pokémon yet!");
    }

    let reply = `📘 **${message.author.username}'s Pokédex**\n\n`;
    userPokemon.forEach((poke, index) => {
      reply += `#${poke.id} - ${poke.name} (Lv. ${poke.level})\n`;
    });

    message.reply(reply);
  }
  else if(message.content.toLowerCase() === '!dailyPK'){
    const userId = message.author.id;
    // add a random item to the user's inventory
    const items = ["Pokeball", "Great Ball", "Ultra Ball"];
    const currency = Math.floor(Math.random() * 100) + 50; 
    const randomItem = items[Math.floor(Math.random() * items.length)];
    // update users inventory
  }
});

client.login(process.env.TOKEN);

          
