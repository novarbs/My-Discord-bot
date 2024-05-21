import { Client, GatewayIntentBits, Message, VoiceState } from 'discord.js';
import type { CommandInteraction, Interaction } from 'discord.js'; 
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ]
});

const omikujiResults = ["大吉", "中吉", "小吉", "吉", "凶", "大凶"];

const commands = [
  {
    name: 'omikuji',
    description: '今日の運勢を占います',
  },
  {
    name: 'youtube',
    description: 'YouTubeで動画を検索します',
    options: [
      {
        name: 'query',
        type: 3, 
        description: '検索クエリ',
        required: true,
      },
    ],
  },
];

// REST APIを使用してコマンドを登録
const rest = new REST({ version: '9' }).setToken(process.env.BOT_TOKEN!);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID!),
      { body: commands }
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();

// YouTube Data APIの設定
const youtubeApiKey = process.env.YOUTUBE_API_KEY!;
const youtube = google.youtube({
  version: 'v3',
  auth: youtubeApiKey
});

client.once('ready', () => {
  console.log('Ready!');
});

client.on('interactionCreate', async (interaction: Interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction as CommandInteraction;

  if (commandName === 'omikuji') {
    const result = omikujiResults[Math.floor(Math.random() * omikujiResults.length)];
    await interaction.reply(`あなたの今日の運勢は... ${result} です！`);
  } else if (commandName === 'youtube') {
    const queryOption = (interaction as CommandInteraction).options.get('query', true);
    const query = queryOption?.value as string;
    const response = await youtube.search.list({
      q: query,
      part: ['snippet'],
      type: ['video'],
      maxResults: 1
    });

    if (response.data.items && response.data.items.length > 0) {
      const video = response.data.items[0];
      const videoTitle = video.snippet?.title;
      const videoId = video.id?.videoId;
      await interaction.reply(`検索結果: ${videoTitle} https://www.youtube.com/watch?v=${videoId}`);
    } else {
      await interaction.reply("動画が見つかりませんでした。");
    }
  }
});

client.on('messageCreate', async (message: Message) => {
  // Bot自身のメッセージには反応しないようにする
  if (message.author.bot) return;

  if (message.content.startsWith('!youtube')) {
    const searchQuery = message.content.slice('!youtube'.length).trim(); 
    const response = await youtube.search.list({
      q: searchQuery,
      part: ['snippet'],
      type: ['video'],
      maxResults: 1
    });

    if (response.data.items && response.data.items.length > 0) {
      const video = response.data.items[0];
      const videoTitle = video.snippet?.title;
      const videoId = video.id?.videoId;
      await message.channel.send(`検索結果: ${videoTitle} https://www.youtube.com/watch?v=${videoId}`);
    } else {
      await message.channel.send("動画が見つかりませんでした。");
    }
  }
});

client.on('voiceStateUpdate', async (before: VoiceState, after: VoiceState) => {

  if (before.channel !== after.channel) {

    const botRoom = client.channels.cache.get('通知メッセージを書き込むテキストチャンネルID');
    if (!botRoom || !botRoom.isTextBased()) return;

    const announceChannelIds = ['入退室を監視する対象のボイスチャンネルID'];

    if (before.channel && announceChannelIds.includes(before.channel.id)) {
      await botRoom.send(`**${before.channel.name}** から、__${before.member?.user.username}__  が退室しました`);
    }

    if (after.channel && announceChannelIds.includes(after.channel.id)) {
      await botRoom.send(`**${after.channel.name}** に、__${after.member?.user.username}__  が入室しました！`);
    }
  }
});

client.login(process.env.BOT_TOKEN!);