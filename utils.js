const fs = require("fs");
const path = require("path");
const axios = require("axios");
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
function calcHP(base, iv, level) {
  return Math.floor(((2 * base + iv) * level) / 100) + level + 10;
}
function calcStat(base, iv, level) {
  return Math.floor(((2 * base + iv) * level) / 100) + 5;
}
function getRandomLevel() {
  const r = Math.random();

  if (r < 0.25) return Math.floor(Math.random() * 10) + 1; // 1–10
  if (r < 0.5) return Math.floor(Math.random() * 10) + 11; // 11–20
  if (r < 0.75) return Math.floor(Math.random() * 10) + 21; // 21–30
  if (r < 0.99) return Math.floor(Math.random() * 10) + 31; // 31–40
  if (r < 0.999) return Math.floor(Math.random() * 10) + 41; // 41–50
  if (r < 0.9999) return Math.floor(Math.random() * 10) + 51; // 51–60
  if (r < 0.99999) return Math.floor(Math.random() * 10) + 61; // 61–70
  if (r < 0.999999) return Math.floor(Math.random() * 10) + 71; // 71–80
  if (r < 0.9999999) return Math.floor(Math.random() * 10) + 81; // 81–90
  return Math.floor(Math.random() * 10) + 91; // 91–100
}
async function getPokemonType(nameOrId) {
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${nameOrId}`);
    if (!res.ok) throw new Error("Pokémon not found");

    const data = await res.json();
    const types = data.types.map((t) => t.type.name);

    return types; // ['Fire'], ['Water', 'Flying'], etc.
  } catch (err) {
    console.error("Error fetching Pokémon type:", err.message);
    return [];
  }
}
function saveGlobalPokemonId() {
const idFile = "pokemon_id.txt";
if (fs.existsSync(idFile)) {
  globalPokemonId = parseInt(fs.readFileSync(idFile, "utf8")) || 1;
}
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
function getExpByGrowthRate(growth, level) {
  switch (growth) {
    case "fast":
      return Math.floor((4 * Math.pow(level, 3)) / 5);
    case "medium":
      return Math.pow(level, 3);
    case "medium-slow":
      return Math.floor(
        (6 / 5) * Math.pow(level, 3) -
          15 * Math.pow(level, 2) +
          100 * level -
          140
      );
    case "slow":
      return Math.floor((5 * Math.pow(level, 3)) / 4);
    case "erratic":
      if (level <= 50)
        return Math.floor((Math.pow(level, 3) * (100 - level)) / 50);
      else if (level <= 68)
        return Math.floor((Math.pow(level, 3) * (150 - level)) / 100);
      else if (level <= 98)
        return Math.floor(
          (Math.pow(level, 3) * ((1911 - 10 * level) / 3)) / 500
        );
      else return Math.floor((Math.pow(level, 3) * (160 - level)) / 100);
    case "fluctuating":
      if (level <= 15)
        return Math.floor(Math.pow(level, 3) * (((level + 1) / 3 + 24) / 50));
      else if (level <= 36)
        return Math.floor(Math.pow(level, 3) * ((level + 14) / 50));
      else return Math.floor(Math.pow(level, 3) * ((level / 2 + 32) / 50));
    default:
      return Math.floor((5 * Math.pow(level, 3)) / 4); // fallback: slow
  }
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
        const baseStats = {};
        pokeData.stats.forEach((s) => {
          const key = s.stat.name;
          baseStats[key] = s.base_stat;
        });
        const palPark = speciesData.pal_park_encounters?.[0];
        const rate = palPark?.rate ?? 20;
        const captureRate = speciesData.capture_rate ?? 45;
        return {
          id: pokeData.id,
          name: pokeData.name,
          rate: rate,
          sprite:
            "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/" +
            pokeData.id +
            ".gif", //"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/35.gif"
          captureRate: captureRate,
          type: await getPokemonType(pokeData.id),
          baseStats: baseStats,
          growthRate: speciesData.growth_rate.name,
          baseExperience: pokeData.base_experience,
        };
      } catch (e) {
        console.warn(`⚠️ Failed to fetch data for ${pokemon.name}`);
        return null;
      }
    })
  );
  pokemonList = detailedList.filter(Boolean);
  console.log(`✅ Loaded ${pokemonList.length} Pokémon with rates.`);
  // Remove failed fetches
  return pokemonList;

  
}
async function savePokemonCaught(userId, pokemon) {
  const data = JSON.parse(
    fs.readFileSync("caught_pokemon.json", "utf8") || "{}"
  );
  if (!data[userId]) data[userId] = [];
  data[userId].push(pokemon);
  fs.writeFileSync("caught_pokemon.json", JSON.stringify(data, null, 2));
}
async function saveStarter(userId, pokemon) {
  const starterFile = path.join(__dirname, "user_starter.json");
  if (!fs.existsSync(starterFile)) {
    fs.writeFileSync(starterFile, JSON.stringify({}, null, 2));
    console.log("✅ created user_starter.json");
  }
  const data = JSON.parse(fs.readFileSync(starterFile, "utf8") || "{}");
  if (!data[0]) data[0] = [];
  userHasStarter = {
    userId: userId,
    hasStarter: true,
  }
  data[0].push(userHasStarter);
  fs.writeFileSync(starterFile, JSON.stringify(data, null, 2));
  console.log(`✅ saved starter for user ${userId}`);
}
async function saveBag(userId, item) {
  const bagFile = path.join(__dirname, "user_bag.json");
  if (!fs.existsSync(bagFile)) {
    fs.writeFileSync(bagFile, JSON.stringify({}, null, 2));
    console.log("✅ created user_bag.json");
  }
  const data = JSON.parse(fs.readFileSync(bagFile, "utf8") || "{}");
  if (!data[userId]) data[userId] = [];
  data[userId].push(item);
  fs.writeFileSync(bagFile, JSON.stringify(data, null, 2));
}
async function fetchStarter(userId) {
  const starterFile = path.join(__dirname, "user_starter.json");
  if (!fs.existsSync(starterFile)) {
    fs.writeFileSync(starterFile, JSON.stringify({}, null, 2));
    console.log("✅ created user_starter.json");
  }
    const data = JSON.parse(fs.readFileSync(starterFile, "utf8") || "{}");
    const group = data["0"]
    if (!Array.isArray(group)) return false;

  const user = group.find(entry => entry.userId === userId);
  return user ? user.hasStarter === true : false;
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
function generateIVs() {
  return {
    hp: Math.floor(Math.random() * 32),
    attack: Math.floor(Math.random() * 32),
    defense: Math.floor(Math.random() * 32),
    special_attack: Math.floor(Math.random() * 32),
    special_defense: Math.floor(Math.random() * 32),
    speed: Math.floor(Math.random() * 32),
  };
}

module.exports = {
    capitalizeFirstLetter, 
    calcHP,
    calcStat,
    getRandomLevel,
    getPokemonType,
    saveGlobalPokemonId,
    SafeDeleteMessage,
    saveData,
    getExpByGrowthRate,
    fetchPokemonList,
    savePokemonCaught,
    saveStarter,
    saveBag,
    fetchStarter,
    uploadPokeballEmoji,
    generateIVs,
}