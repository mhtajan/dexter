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
  AttachmentBuilder,
  MessageFlags,
} = require("discord.js");
const fs = require("fs");
const { type } = require("os");
const path = require("path");
const sharp = require('sharp');
const axios = require('axios');
const { parseGIF, decompressFrames } = require('gifuct-js');
const { createCanvas } = require('canvas');
const GIFEncoder = require('gif-encoder-2')																	   

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
  InitializeParticipantData,
  RecordParticipantData,
  RemoveParticipant,
  GetSelectedUserForPokemon,
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
  {
    name: "chikorita",
    url: "https://pokeapi.co/api/v2/pokemon/152/",
  },
  {
    name: "cyndaquil",
    url: "https://pokeapi.co/api/v2/pokemon/155/",
  },
  {
    name: "totodile",
    url: "https://pokeapi.co/api/v2/pokemon/158/",
  },
  {
    name: "treecko",
    url: "https://pokeapi.co/api/v2/pokemon/252/",
  },
  {
    name: "torchic",
    url: "https://pokeapi.co/api/v2/pokemon/255/",
  },
  {
    name: "mudkip",
    url: "https://pokeapi.co/api/v2/pokemon/258/",
  }
];

const caughtFile = path.join(__dirname, "caught_pokemon.json");

if (!fs.existsSync(caughtFile)) {
  fs.writeFileSync(caughtFile, JSON.stringify({}, null, 2));
  console.log("✅ created caught_pokemon.json");
}

InitializeParticipantData();

async function SpawnWildPokemonMessage(client,channel, selectedPokemon){

  level = getRandomLevel();

    //Initialize Wild Pokemon Embed
    const wildPokemonEmbed = new EmbedBuilder()
      .setTitle(
        `✨ A wild **${capitalizeFirstLetter(selectedPokemon.name)}** appeared!`
      )
      .setImage(selectedPokemon.sprite)
      .setDescription(`\n**LV:** ${level}\n`);

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
      } else {
        console.log(`❌ ${name} is missing.`);
      }
    });

    //Send Spawn Message
    return await channel
      .send({
        embeds: [wildPokemonEmbed],
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
}

async function HandleCaptureInteraction(interaction)
{

  if (interaction.customId.includes('pokeball-'))
  {

  }
  await interaction.deferUpdate();
}

async function StarterPokemonHandler(interaction,channel) {

  const user = interaction.user;        
  const hasStarter = await fetchStarter(user.id);
  const pokemonEmoji = client.application.emojis.cache;
  const messageFromDexter = `
  🧪 **DEXTER**: "Ah, greetings, *subject ${user.username}*!

  After years of meticulous calculations, quantum simulations, and a minor explosion or two...  
  I have finally selected **9 optimal Pokémon specimens** for you to begin your field research.

  🤓 Your mission is simple:
  **Choose ONE starter Pokémon** — but choose wisely! Each holds the potential for *great scientific discovery* (and possibly world domination... but mostly science).

  Now then... Make your selection!"

  *— Dexter, Boy Genius™*
  `;
  let participants = JSON.parse(
                  fs.readFileSync("participant_record.json", "utf8") || "{}"
                );
  if (!participants[0]) participants[0] = [];

  if (user.bot) return;
  if (hasStarter === false) {
    try {
      const rows = [];
      for (let i = 0; i < starters.length; i += 3) {
        const row = new ActionRowBuilder();
        const slice = starters.slice(i, i + 3);

        slice.forEach((starter) => {
          const emojiId = pokemonEmoji.find(
            (e) => e.name === starter.name
          )?.id;
          const button = new ButtonBuilder()
            .setCustomId(`starter-${starter.name}`)
            .setStyle(ButtonStyle.Secondary);

          if (emojiId) {
            button.setEmoji(emojiId); // If it's a custom emoji (raw ID)
          } else {
            button.setLabel(starter.name); // Fallback
          }
          row.addComponents(button);
        });
        rows.push(row);
      }
      await user.send({
        content: messageFromDexter,
        components: rows,
      });

      await interaction.reply({
        content:
          "📩 Please check your DMs to choose a starter first!",
        flags: MessageFlags.Ephemeral 
      });

    } catch (err) {
      console.error("Failed to DM user:", err);
      await interaction.reply({
        content:
          "❌ I couldn't DM you. Please enable DMs from server members.",
        flags: MessageFlags.Ephemeral 
      });
    }

    return;
  }
  else if (hasStarter === true) {
    
    if (participants[0].some((p) => p.id === user.id && p.onMessageId === interaction.message.id)) {
      await interaction.reply({
        content: "You have already joined this catch!",
        flags: MessageFlags.Ephemeral 
      });
      return;
    }

    if (participants[0].some((p) => p.id === user.id)) {
      await interaction.reply({
        content: "You are already catching another Pokemon!",
        flags: MessageFlags.Ephemeral 
      });
      return;
    }

    RecordParticipantData({
      id: user.id,
      username: user.username,
      ball: interaction.customId.split("-")[1],
      onMessageId: interaction.message.id,
    });

    //Update Wild Pokemon Spawn Message with # of Participants
    const message = await channel.messages.fetch(
      interaction.message.id
    );
    const oldEmbed = message.embeds[0];
    if (!oldEmbed) return;
    const updatedEmbed = new EmbedBuilder(oldEmbed).setDescription(
      `\n**Participants:** ${participants[0].length+1}`
    );
    await message.edit({
      embeds: [updatedEmbed],
      components: message.components,
    });

    await interaction.reply({
      content: `You joined the catch with **${interaction.customId
        .split("-")[1]
        .replace("_", " ")}**!`,
      flags: MessageFlags.Ephemeral 
    });
  }
}


client.once(Events.ClientReady, async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  const channel = await client.channels.fetch(process.env.SPAWN_CHANNEL_ID);

  if (!channel) return console.error("❌ Channel not found");

  const fetchedPokemon = await fetchPokemonList();
  const spawnLoop = async () => {
    const candidates = fetchedPokemon.filter(
      (pkm) => Math.random() * 100 < pkm.rate
    );

    const selectedPokemon =
      candidates.length > 0
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : pokemonList[Math.floor(Math.random() * pokemonList.length)];
    
    const caughtMap = {};

    SpawnWildPokemonMessage(client, channel, selectedPokemon)
    .then(async (wildPokemonMessage) => {
      //Binding a Collector on Wild Pokemon Message
        try {
          const collector = wildPokemonMessage.createMessageComponentCollector({
            ComponentType: ComponentType.Button,
            time: 10000, // collector active for 15 seconds
          });

          let participants = JSON.parse(
                          fs.readFileSync("participant_record.json", "utf8") || "{}"
                        );
          if (!participants[0]) participants[0] = [];
          
          collector.on("collect", async (interaction) => {   

            if (interaction.customId.startsWith("pokeball-")) {
              
              StarterPokemonHandler(interaction, channel);
              //if
            }
            
          });
          
          collector.on("end", async (collected) => {
            
            console.log(`Collected ${collected.size} items`);
            const user = await GetSelectedUserForPokemon(wildPokemonMessage.id);
            

            console.log(' matrh math math on message'+wildPokemonMessage.id);
            //StartPokemonBattle(channel,interaction,user)

            //no interactions this message
            if(collected.size === 0)
            {
              channel
                  .send({
                    content: `The **${selectedPokemon.name}** ran away! 💨`,
                  })
                  .then(SafeDeleteMessage(wildPokemonMessage));
                return;
            } else {
              //Some users clicked the button to catch on this message
              if (!user) {
                
                // No valid participants
                  channel
                    .send({
                      content: `The **${selectedPokemon.name}** ran away! 💨`,
                    })
                    .then(SafeDeleteMessage(wildPokemonMessage));
                  return;
              } else {
                
                console.log(user.username+' is attempting to catch the pokemon! '+user.id);

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
                    (selectedPokemon.captureRate / rate) * 100,
                    100
                  );
                }
                const roll = Math.random() * 100;
                if (roll <= successChance) {
                  
                  // Successful catch handling
                  if (!caughtMap[user.id]) caughtMap[user.id] = [];

                  caughtMap[user.id].push({
                    name: selectedPokemon.name,
                    sprite: selectedPokemon.sprite,
                  });

                  channel
                    .send({
                      content: `🎉 **${
                        user.username
                      }** caught **${capitalizeFirstLetter(
                        selectedPokemon.name
                      )}** using **${user.ball.replace(/_/g, " ")}**!`,
                      allowedMentions: { repliedUser: false },
                    })
                    .then(SafeDeleteMessage(wildPokemonMessage,user.id));

                  selectedPokemon.uniqueId = `PKMN-${String(globalPokemonId++).padStart(
                    9,
                    "0"
                  )}`;

                  selectedPokemon.level = level;
                  const iv = generateIVs();
                  selectedPokemon.iv = iv;
                  selectedPokemon.stats = {
                    hp: calcHP(selectedPokemon.baseStats.hp, iv.hp, level),
                    attack: calcStat(selectedPokemon.baseStats.attack, iv.attack, level),
                    defense: calcStat(
                      selectedPokemon.baseStats.defense,
                      iv.defense,
                      level
                    ),
                    speed: calcStat(selectedPokemon.baseStats.speed, iv.speed, level),
                  };
                  selectedPokemon.xp = getExpByGrowthRate(selectedPokemon.growthRate, level);
                  selectedPokemon.xpNeeded =
                    getExpByGrowthRate(selectedPokemon.growthRate, level + 1) -
                    selectedPokemon.xp;
                  saveGlobalPokemonId();
                  savePokemonCaught(user.id, selectedPokemon);
                  console.log(
                    `✅ ${user.username} caught ${capitalizeFirstLetter(
                      selectedPokemon.name
                    )}`
                  );
                } else {
                  // Failed catch handling start
                  channel
                    .send({
                      content: `💨 **${selectedPokemon.name}** managed to escaped from **${user.username}**!`,
                      allowedMentions: { repliedUser: false },
                    })
                    .then(SafeDeleteMessage(wildPokemonMessage,user.id));

                  console.log(
                    `❌ ${user.username} failed to catch ${selectedPokemon.name}`
                  );
                }
              } 
            }
          });
        } catch (err) {
          console.error("❌ Failed to react or collect:", err);
        }
      });
    setTimeout(spawnLoop, Math.floor(Math.random() * 10000) + 5000); // 1–3 mins
  };

  spawnLoop();
});



//Always Listening to client
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  const user = interaction.user;
  const [type, value] = interaction.customId.split("-");
  if (type === "starter") {
    const alreadyHasStarter = await fetchStarter(user.id);
    if (alreadyHasStarter=== true) {
      await interaction.reply({
        content: "You already have a starter Pokémon!",
        flags: MessageFlags.Ephemeral 
      });
      interaction.message.delete().catch(console.error);
      return; // User already has a starter
    }
    else if (alreadyHasStarter === false) {
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
        hp: calcHP(baseStats.hp, iv.hp, level),
        attack: calcStat(baseStats.attack, iv.attack, level),
        defense: calcStat(baseStats.defense, iv.defense, level),
        speed: calcStat(baseStats.speed, iv.speed, level),
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
      flags: MessageFlags.Ephemeral 
    });
    }
    
  }
});

client.on(Events.MessageCreate, async (message) => {															
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
      const totalPokemon = 386;
      async function pkmn(pokemon) {
        const formattedName = pokemon.replace(/-/g, "_");
        return pokemonEmojiArray.find((emoji) =>
          emoji.name.startsWith(formattedName)
        );
      }

      const embed = new EmbedBuilder()
        .setTitle(`${message.author.username}'s Pokédex`)
        .setColor("Random")
        .setDescription(
          currentPagePokemon
            .map(
              (poke) =>
                `\`${poke.id
                  .toString()
                  .padStart(3, "0")} - ${capitalizeFirstLetter(
                  poke.name
                ).padEnd(12)}\` ${client.application.emojis.cache.find(
                  (emoji) => emoji.name === poke.name.replace(/-/g, "_")
                )}`
            )
            .join("\n")
        )
        .setFooter({
          text: `📘 Caught: ${totalCaught}/${totalPokemon} • Page ${
            page + 1
          } of ${totalPages}`,
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
        components: [
          new ActionRowBuilder().addComponents(backButton, nextButton),
        ],
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
    const emoji1LargeUrl = `${emoji1.url}?size=256`
    const emoji2LargeUrl = `${emoji2.url}?size=256`

    // const imageRes = await axios.get(emoji1Large, {
    //     responseType: "arraybuffer"
    //   });
    const emoji1LargeFrames = await getGifFrames(emoji1LargeUrl)
    const emoji2LargeFrames = await getGifFrames(emoji2LargeUrl)

    const canvas = createCanvas(400, 350); // Custom width and height
    const ctx = canvas.getContext('2d');
    
    const encoder = new GIFEncoder(400,350)
    encoder.setRepeat(0); // 0 for infinite loop
    
    console.log('drawing image 1 frames starting '+emoji1LargeFrames.length);
    console.log('drawing image 2 frames starting '+emoji2LargeFrames.length);
    encoder.start()
    for (let i = 0; i < 20; i++) {
    
      const imageData1 = ctx.createImageData(emoji1LargeFrames[i].dims.width, emoji1LargeFrames[i].dims.height);
      imageData1.data.set(emoji1LargeFrames[i].patch);
      ctx.putImageData(imageData1,50,200);
      console.log('drawing img 1 frame  # '+i);

      const imageData2 = ctx.createImageData(emoji2LargeFrames[i].dims.width, emoji2LargeFrames[i].dims.height);
      imageData2.data.set(emoji2LargeFrames[i].patch);
      ctx.putImageData(imageData2,200,100);
      console.log('drawing img 2 frame  # '+i);
      // Add frame to encoder
      // For gif.js
      encoder.addFrame(ctx);
    }
    encoder.finish()
    console.log('drawing frames finished ');

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


    const attachment = new AttachmentBuilder(Buffer.from(encoder.out.getData()), { name: 'test.gif' });
    console.log(attachment);
    const embedimg1 = {
      title: 'Some title',
      image: {
        url: `attachment://test.gif`,
      },
    };
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
      embeds: [embedimg1],
      content:`<:dot:1397234058362093660>
              <:hp_leftcap:1397209958608666644><:hp_inner:1397209968117026906><:hp_rightcap:1397209977818714263><a:${emoji2.name}:${emoji2.id}>
              <:dot:1397234058362093660><:dot:1397234058362093660><:dot:1397234058362093660><:dot:1397234058362093660><:dot:1397234058362093660>
              <a:${emoji1.name}:${emoji1.id}><:hp_leftcap:1397209958608666644><:hp_inner:1397209968117026906><:hp_rightcap:1397209977818714263>
              <:dot:1397234058362093660>`,
      files: [attachment]
      
            });
      

  }
  
});

async function getGifFrames(gifURL) {
        const imageRes = await axios.get(gifURL, {
          responseType: "arraybuffer"
        });
        const gif = parseGIF(imageRes.data);
        const frames = decompressFrames(gif, true); // true for coalescing frames
        return frames;
    }
client.login(process.env.TOKEN);
