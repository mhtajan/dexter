require("dotenv").config();
const { Client, GatewayIntentBits, ComponentType,ActionRowBuilder,ButtonBuilder, ButtonStyle, Events} = require("discord.js");
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
const idFile = "pokemon_id.txt";
if (fs.existsSync(idFile)) {
  globalPokemonId = parseInt(fs.readFileSync(idFile, "utf8")) || 1;
}
function saveGlobalPokemonId() {
  fs.writeFileSync(idFile, String(globalPokemonId));
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
          sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokeData.id}.png`,
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
    await channel.send({
      content: `✨ A wild **${selected.name}** appeared!`,
      files: selected.sprite ? [selected.sprite] : []
    }).then(async (sentMessage) => {
  try {
    // React with 🗺️
    await sentMessage.react("<:pokeball:1395134292706725930>");

    // Set up a collector that listens for 🗺️ reactions
    const collectionFilter = (reaction, user) =>
      reaction.emoji.name === "<:pokeball:1395134292706725930>" && !user.bot;

    const collector = sentMessage.createReactionCollector({ 
      collectionFilter,
      time: 5000 // collector active for 1 minute
    });


  collector.on("collect", async (interaction, user) => {
  if(user.bot) return;
  const filePath = path.join(__dirname, 'caught_pokemon.json');
  const caughtData = JSON.parse(fs.readFileSync(filePath));
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
  
          //await interaction.reply({ content: "📩 Please check your DMs to choose a starter first!", ephemeral: true });
        } catch (err) {
          console.error("Failed to DM user:", err);
         // await interaction.reply({ content: "❌ I couldn't DM you. Please enable DMs from server members.", ephemeral: true });
        }
        return;
      }
  const successChance = (selected.captureRate / 255) * 100;
  const roll = Math.random() * 100;
  
  if (roll <= successChance) {
    // Successful catch
    if (!caughtMap[user.id]) caughtMap[user.id] = [];

    caughtMap[user.id].push({
      name: selected.name,
      sprite: selected.sprite
    });

    sentMessage.reply({
      content: `🎉 **${user.username}** caught **${selected.name}**!`,
      allowedMentions: { repliedUser: false }
    });
    selected.uniqueId = `PKMN-${String(globalPokemonId++).padStart(9, "0")}`;
    saveGlobalPokemonId();
    savePokemonCaught(user.id, selected);
    console.log(`✅ ${user.tag} caught ${selected.name}`);

  } else {
    // Failed catch
    sentMessage.reply({
      content: `💨 **${selected.name}** escaped from **${user.username}**!`,
      allowedMentions: { repliedUser: false }
    });

    console.log(`❌ ${user.tag} failed to catch ${selected.name}`);
  }
});
    collector.on("end", (collected) => {
      if (collected.size === 0) {
        sentMessage.reply("😢 Nobody caught the Pokémon in time!");
      }
    });

  } catch (err) {
    console.error("❌ Failed to react or collect:", err);
  }
});
    setTimeout(spawnLoop, Math.floor(Math.random() * 10000) + 10000); // 1–3 mins
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
});

client.login(process.env.TOKEN);
