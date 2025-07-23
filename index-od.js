require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  ComponentType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  EmbedBuilder,
} = require("discord.js");
const fs = require("fs");
const { type } = require("os");
const path = require("path");
const sharp = require('sharp');
const axios = require('axios');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
});
const {
    capitalizeFirstLetter, 
    calcHP,
    calcStat,
    getRandomLevel,
    getPokemonType,
    saveGlobalPokemonId,
    SafeDeleteMessage,
    getExpByGrowthRate,
    fetchPokemonList,
    savePokemonCaught,
    saveStarter,
    saveBag,
    fetchStarter,
    uploadPokeballEmoji,
    generateIVs,
} = require("./utils.js");
let pokemonList = [];
let globalPokemonId = 1;
const starters = [
  {
    name: "bulbasaur",
    url: "https://pokeapi.co/api/v2/pokemon/1/",
  },
  {
    name: "charmander",
    url: "https://pokeapi.co/api/v2/pokemon/4/",
  },
  {
    name: "squirtle",
    url: "https://pokeapi.co/api/v2/pokemon/7/",
  },
];

const caughtFile = path.join(__dirname, "caught_pokemon.json");
if (!fs.existsSync(caughtFile)) {
  fs.writeFileSync(caughtFile, JSON.stringify({}, null, 2));
  console.log("✅ created caught_pokemon.json");
}

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const channel = await client.channels.fetch(process.env.SPAWN_CHANNEL_ID);
  if (!channel) return console.error("❌ Channel not found");

  const fetchedPkmn = await fetchPokemonList();
  const spawnLoop = async () => {
    const candidates = fetchedPkmn.filter(
      (pkm) => Math.random() * 100 < pkm.rate
    );

    const selected =
      candidates.length > 0
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : pokemonList[Math.floor(Math.random() * pokemonList.length)];
    const caughtMap = {};
    level = getRandomLevel();
    const exampleEmbed = new EmbedBuilder()
      .setTitle(
        `✨ A wild **${capitalizeFirstLetter(selected.name)}** appeared!`
      )
      .setImage(selected.sprite)
      .setDescription(`\n**LV:** ${level}\n`);

    const message2Embed = new EmbedBuilder()
      .setTitle(
        `**OvrDrive** is in combat with **${capitalizeFirstLetter(selected.name)}**!`
      )
      .setDescription(selected.sprite)
      .setDescription(`\n**LV:** ${level}\n`);
    
    const guild = client.guilds.cache.get(process.env.GUILD_ID); // or use a specific guild ID
    

    const appEmojis = await client.application.emojis.fetch();

    const emojiNames = ["Poke_Ball", "Great_Ball", "Ultra_Ball", "Master_Ball"];
    const reactBalls = [];
    emojiNames.forEach((name) => {
      const emoji = appEmojis.find((e) => e.name === name);
      if (emoji) {
        reactBalls.push({
          name: name,
          id: emoji.id,
        });
        console.log(`✅ ${name} has been loaded with id. ${emoji.id} `);
      } else {
        console.log(`❌ ${name} is missing.`);
      }
    });
    await channel
      .send({
        embeds: [exampleEmbed],
        components: [
          new ActionRowBuilder().addComponents(
            reactBalls.map((pokeBall) =>
              new ButtonBuilder()
                .setCustomId(`pokeball-${pokeBall.name}`)
                .setEmoji(pokeBall.id)
                .setStyle(ButtonStyle.Secondary)
            )
          ),
        ],
      })
      .then(async (sentMessage) => {
        try {
          const collector = sentMessage.createMessageComponentCollector({
            ComponentType: ComponentType.Button,
            time: 15000, // collector active for 1 minute
          });

          participants = [];
          collector.on("collect", async (interaction) => {
            const filePath = path.join(__dirname, "caught_pokemon.json");
            const caughtData = JSON.parse(fs.readFileSync(filePath));
            const user = interaction.user;
            if (interaction.customId.startsWith("pokeball-")) {
              if (user.bot) return;
              if (!fetchStarter(user.id)){ 
              try {
                await user.send({
                  content: `👋 Hi ${user.username}, you need to pick a starter Pokémon before you can catch wild ones.`,
                  components: [
                    new ActionRowBuilder().addComponents(
                      starters.map((starter) =>
                        new ButtonBuilder()
                          .setCustomId(`starter-${starter.name}`)
                          .setLabel(
                            starter.name.charAt(0).toUpperCase() +
                              starter.name.slice(1)
                          )
                          .setStyle(ButtonStyle.Secondary)
                      )
                    ),
                  ],
                });

                await interaction.reply({
                  content:
                    "📩 Please check your DMs to choose a starter first!",
                  ephemeral: true,
                });
              } catch (err) {
                console.error("Failed to DM user:", err);
                await interaction.reply({
                  content:
                    "❌ I couldn't DM you. Please enable DMs from server members.",
                  ephemeral: true,
                });
              }
              return;
              }
              else{
                if (participants.some((p) => p.id === user.id)) {
                await interaction.reply({
                  content: "You have already joined this catch!",
                  ephemeral: true,
                });
                return;
              }
              participants.push({
                id: user.id,
                username: user.username,
                ball: interaction.customId.split("-")[1],
              });
              const message = await channel.messages.fetch(
                interaction.message.id
              );
              const oldEmbed = message.embeds[0];
              if (!oldEmbed) return;
              const updatedEmbed = new EmbedBuilder(oldEmbed).setDescription(
                `\n**Participants:** ${participants.length}`
              );
              await message.edit({
                embeds: [updatedEmbed],
                components: message.components,
              });
              caughtData[user.id] = caughtData[user.id] || [];
              const hasStarter = caughtData[user.id].some((p) => {
                return starters.some((starter) => starter.name === p.name);
              });
              await interaction.reply({ content: `You joined the catch with a **${interaction.customId.split("-")[1].replace("_", " ")}**!`, ephemeral: true });
            }
              }
          });
          collector.on("end", async (collected) => {
            const user =
              participants[Math.floor(Math.random() * participants.length)];
            if (collected.size >= 0) {
              if (!user) {
                channel
                  .send({
                    content: `The **${selected.name}** fled! 💨`,
                  })
                  .then(SafeDeleteMessage(sentMessage));
                return;
              }
              if (user.ball === "Master_Ball") {
                successChance = 100; // Always catch
              } else {
                if (user.ball === "Ultra_Ball") {
                  rate = 150;
                } else if (user.ball === "Great_Ball") {
                  rate = 200;
                } else {
                  rate = 255; // Default is Poké Ball
                }

                successChance = Math.min(
                  (selected.captureRate / rate) * 100,
                  100
                );
              }
              const roll = Math.random() * 100;
              if (roll <= successChance) {
                // Successful catch
                if (!caughtMap[user.id]) caughtMap[user.id] = [];

                caughtMap[user.id].push({
                  name: selected.name,
                  sprite: selected.sprite,
                });

                channel
                  .send({
                    content: `🎉 **${
                      user.username
                    }** caught **${capitalizeFirstLetter(
                      selected.name
                    )}** using **${user.ball.replace(/_/g, " ")}**!`,
                    allowedMentions: { repliedUser: false },
                  })
                  .then(SafeDeleteMessage(sentMessage));

                selected.uniqueId = `PKMN-${String(globalPokemonId++).padStart(
                  9,
                  "0"
                )}`;

                selected.level = level;
                const iv = generateIVs();
                selected.iv = iv;
                selected.stats = {
                  hp: calcHP(selected.baseStats.hp,iv.hp, level),
                  attack: calcStat(selected.baseStats.attack,iv.attack, level),
                  defense: calcStat(selected.baseStats.defense,iv.defense, level),
                  speed: calcStat(selected.baseStats.speed,iv.speed, level),
                };
                selected.xp = getExpByGrowthRate(selected.growthRate, level);
                selected.xpNeeded =
                  getExpByGrowthRate(selected.growthRate, level + 1) -
                  selected.xp;
                saveGlobalPokemonId();
                savePokemonCaught(user.id, selected);
                console.log(
                  `✅ ${user.username} caught ${capitalizeFirstLetter(
                    selected.name
                  )}`
                );
              } else {
                // Failed catch
                if (!user) {
                  channel
                    .send({
                      content: `The **${selected.name}** fled! 💨`,
                    })
                    .then(SafeDeleteMessage(sentMessage));
                }
                channel
                  .send({
                    content: `💨 **${selected.name}** escaped from **${user.username}**!`,
                    allowedMentions: { repliedUser: false },
                  })
                  .then(SafeDeleteMessage(sentMessage));

                console.log(
                  `❌ ${user.username} failed to catch ${selected.name}`
                );
              }
            } else if (collected.size === 0) {
              channel
                .send({
                  content: `The **${selected.name}** fled! 💨`,
                })
                .then(SafeDeleteMessage(sentMessage));
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
  const filePath = path.join(__dirname, "caught_pokemon.json");
  const caughtData = JSON.parse(fs.readFileSync(filePath));
  const user = interaction.user;
  const [type, value] = interaction.customId.split("-");
  if (type === "starter") {
    if (!caughtData[user.id]) caughtData[user.id] = [];

    const alreadyHasStarter = caughtData[user.id].some((p) => p.name === value);
    if (alreadyHasStarter) {
      await interaction.reply({
        content: "You already have a starter Pokémon!",
        ephemeral: true,
      });
      return;
    }
    const index = starters.findIndex((p) => p.name === value);
    const speciesData = await fetch(starters[index].url).then((r) => r.json());
    const Data = await fetch(speciesData.species.url).then((r) => r.json());
    const baseStats = {};
    speciesData.stats.forEach((s) => {
      const key = s.stat.name;
      baseStats[key] = s.base_stat;
    });
    const palPark = speciesData.pal_park_encounters?.[0];
    const rate = palPark?.rate ?? 20;
    const captureRate = speciesData.capture_rate ?? 45;
    uniqueId = `PKMN-${String(globalPokemonId++).padStart(9, "0")}`;
    saveGlobalPokemonId();
    level = 5; //starter pokemon always start at level 5
    const iv = generateIVs();
    savePokemonCaught(user.id, {
      id: speciesData.id,
      name: value,
      rate: rate,
      sprite: pokemonList.find((p) => p.name === value)?.sprite || "",
      uniqueId: uniqueId,
      captureRate: captureRate,
      level: level,
      baseStats: baseStats,
      stats: {
        hp: calcHP(baseStats.hp,iv.hp, level),
        attack: calcStat(baseStats.attack,iv.attack, level),
        defense: calcStat(baseStats.defense,iv.defense, level),
        speed: calcStat(baseStats.speed,iv.speed, level),
      },
      type: await getPokemonType(speciesData.id),
      xp: getExpByGrowthRate(Data.growth_rate.name, level),
      xpNeeded:
        getExpByGrowthRate(Data.growth_rate.name, level + 1) -
        getExpByGrowthRate(Data.growth_rate.name, level),
      growthRate: Data.growth_rate.name,
    });
    saveStarter(user.id);
    await interaction.reply({
      content: `✅ You picked **${value}** as your starter! ID: \`${uniqueId}\``,
      ephemeral: true,
    });
  }
});
client.on(Events.MessageCreate, async (message) => {
  const appEmojis = await client.application.emojis.fetch();
  if (message.author.bot) return;

  if (message.content.toLowerCase() === "!pokedex") {
    const userId = message.author.id;
    const filePath = path.join(__dirname, "caught_pokemon.json");

    // Create file if doesn't exist
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify({}, null, 2));
    }

    const data = JSON.parse(fs.readFileSync(filePath));

    const userPokemon = data[userId];

    if (!userPokemon || userPokemon.length === 0) {
      return message.reply("You haven't caught any Pokémon yet!");
    }

const itemsPerPage = 10;
let page = 0;
userPokemon.sort((a, b) => a.id - b.id);

const currentPagePokemon = userPokemon.slice(
  page * itemsPerPage,
  page * itemsPerPage + itemsPerPage
);
const totalPages = Math.ceil(userPokemon.length / itemsPerPage);

const generateEmbed = (page) => {
  const start = page * itemsPerPage;
  const end = start + itemsPerPage;
  const currentPagePokemon = userPokemon.slice(start, end);
  const totalCaught = userPokemon.length;
  const totalPokemon = 151;
  pokemonEmojis = []
// client.application.emojis.fetch()
//   .then(emojis => pokemonEmojis = emojis)
  const embed = new EmbedBuilder()
  .setTitle(`${message.author.username}'s Pokédex`)
  .setColor("Random")
  .setDescription(
  currentPagePokemon
    .map(poke =>
      `\`${poke.id.toString().padStart(3, '0')} - ${capitalizeFirstLetter(poke.name).padEnd(12)}\` <a:Master_Ball_Capturing:1397102103150985278>`
    )
    .join('\n')
)
  .setFooter({
    text: `📘 Caught: ${totalCaught}/${totalPokemon} • Page ${page + 1} of ${totalPages}`
  });

  return embed;
};

const backButton = new ButtonBuilder()
  .setCustomId("back")
  .setLabel("⬅ Back")
  .setStyle(ButtonStyle.Primary)
  .setDisabled(true);

const nextButton = new ButtonBuilder()
  .setCustomId("next")
  .setLabel("Next ➡")
  .setStyle(ButtonStyle.Primary)
  .setDisabled(totalPages <= 1);

const row = new ActionRowBuilder().addComponents(backButton, nextButton);

const embedMessage = await message.channel.send({
  embeds: [generateEmbed(page)],
  components: [row],
});

const collector = embedMessage.createMessageComponentCollector({
  filter: (i) => i.user.id === userId,
  time: 60000,
});

collector.on("collect", async (interaction) => {
  if (interaction.customId === "next") {
    page++;
  } else if (interaction.customId === "back") {
    page--;
  }

  // Update button states
  backButton.setDisabled(page === 0);
  nextButton.setDisabled(page >= totalPages - 1);

  await interaction.update({
    embeds: [generateEmbed(page)],
    components: [new ActionRowBuilder().addComponents(backButton, nextButton)],
  });
});

collector.on("end", async () => {
  await embedMessage.edit({
    components: [],
  });
});
  } else if (message.content.toLowerCase() === "!dailyPK") {
    const userId = message.author.id;
    // add a random item to the user's inventory
    const items = ["Pokeball", "Great Ball", "Ultra Ball"];
    const currency = Math.floor(Math.random() * 100) + 50;
    const randomItem = items[Math.floor(Math.random() * items.length)];
    // update users inventory
  } else if (message.content.toLowerCase() === "!message2") {
    const embed1 = new EmbedBuilder()
    .setDescription(`**Bulbasaur** used Vine Whip and did **21 Damage**!`
      );
    const embed2 = new EmbedBuilder()
    .setDescription(`**Mew** used Psychic and did **46 Damage**!`
      );

    const emoji1 = appEmojis.find((e) => e.name === 'bulbasaur');
    const emoji2 = appEmojis.find((e) => e.name === 'mew');
    // const emoji1Large = `${emoji1.url}?size=256`
    // const emoji2Large = `${emoji2.url}?size=256`

    // const imageRes = await axios.get(emoji1Large, {
    //     responseType: "arraybuffer"
    //   });
    //   const gifBuffer1 = await axios.get(emoji1Large, {
    //     responseType: "arraybuffer"
    //   });
    //   const gifBuffer2 = await axios.get(emoji2Large, {
    //     responseType: "arraybuffer"
    //   });

    //   const imageBase64 = await sharp(imageRes.data, { animated: true}).composite([
    //           {
    //             input: gifBuffer1,
    //             animated: true,
    //             tile: true
    //           },
    //           {
    //             input: gifBuffer2,
    //             animated: true,
    //             tile: true
    //           }
    //           ], {}).webp({ effort: 6 , quality: 24}).toBuffer().toString('base64');

    //  const attachment = new AttachmentBuilder(imageBase64, { name: 'testgif' });

      
    // const embedimg1 = new EmbedBuilder()
    // .setImage(imageBase64);
    // const embedimg2 = new EmbedBuilder()
    // .setImage(emoji2Large);

    // await message.channel.send({
    //   content:`<:dot:1397204688792850494>
    //           <:top_left_bar:1397204846779826256><:top_bar:1397204779578560713><:top_bar:1397204779578560713><:top_bar:1397204779578560713><:top_bar:1397204779578560713><:top_right_bar:1397204855059120270>
    //           <:left_bar:1397204758992781424><:hp_leftcap:1397209958608666644><:hp_inner:1397209968117026906><:hp_rightcap:1397209977818714263><a:${emoji2.name}:${emoji2.id}><:right_bar:1397204803792273489>
    //           <:left_bar:1397204758992781424><a:${emoji1.name}:${emoji1.id}><:hp_leftcap:1397209958608666644><:hp_inner:1397209968117026906><:hp_rightcap:1397209977818714263><:right_bar:1397204803792273489>
    //           <:bot_left_bar:1397204822582890660><:bot_bar:1397204741292822610><:bot_bar:1397204741292822610><:bot_bar:1397204741292822610><:bot_bar:1397204741292822610><:bot_right_bar:1397204839402045490>`
    // });

    await message.channel.send({
      content:`<:dot:1397234058362093660>
              <:hp_leftcap:1397209958608666644><:hp_inner:1397209968117026906><:hp_rightcap:1397209977818714263><a:${emoji2.name}:${emoji2.id}>
              <:dot:1397234058362093660><:dot:1397234058362093660><:dot:1397234058362093660><:dot:1397234058362093660><:dot:1397234058362093660>
              <a:${emoji1.name}:${emoji1.id}><:hp_leftcap:1397209958608666644><:hp_inner:1397209968117026906><:hp_rightcap:1397209977818714263>
              <:dot:1397234058362093660>`
            });

  }
  
});

client.login(process.env.TOKEN);
