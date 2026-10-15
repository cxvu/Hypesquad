// ==========================================
// DEPLOY.JS - Daftarkan Slash Command
// ==========================================

require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Kirim ulang panel HypeSquad (Admin only)')
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('[INFO] Mendaftarkan slash command...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands.map(cmd => cmd.toJSON()) }
    );
    console.log('[OK] Slash command /panel berhasil didaftarkan!');
    console.log('Bot by Natan');
  } catch (error) {
    console.error('[ERROR] Gagal:', error);
  }
})();