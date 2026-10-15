// ==========================================
// BOT HYPESQUAD - NO EMBED (FULL IMAGE + DROPDOWN)
// Discord.js v14 | Author: Natan
// ==========================================

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  Client, GatewayIntentBits,
  ActionRowBuilder, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  AttachmentBuilder, ActivityType
} = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

// ==========================================
// KONFIGURASI
// ==========================================

const CHANNEL_ID = process.env.CHANNEL_ID || null;

// ==========================================
// EMOJI DARI FOLDER images/ (hasil npm run upload)
// success = yes.svg (claim/hapus berhasil)
// error   = no.svg  (gagal / error)
// ==========================================

const FALLBACK_EMOJIS = {
  bravery: '<:bravery:1536375365751013447>',
  brilliance: '<:brilliance:1536375368121065586>',
  balance: '<:balance:1536375370977247325>',
  success: '<a:check:1545059018710716456>',
  error: '<a:mark_x:1545059021025710122>'
};

function loadEmojis() {
  try {
    const file = path.join(__dirname, 'images', 'emojis.json');
    if (!fs.existsSync(file)) return { ...FALLBACK_EMOJIS };
    const ids = JSON.parse(fs.readFileSync(file, 'utf8'));
    const out = { ...FALLBACK_EMOJIS };
    if (ids.bravery) out.bravery = `<:hypesquad_bravery:${ids.bravery}>`;
    if (ids.brilliance) out.brilliance = `<:hypesquad_brilliance:${ids.brilliance}>`;
    if (ids.balance) out.balance = `<:hypesquad_balance:${ids.balance}>`;
    if (ids.success) out.success = `<:hypesquad_yes:${ids.success}>`;
    if (ids.error) out.error = `<:hypesquad_no:${ids.error}>`;
    return out;
  } catch (e) {
    console.error('[WARN] Gagal baca images/emojis.json, pakai emoji lama:', e.message);
    return { ...FALLBACK_EMOJIS };
  }
}

const EMOJIS = loadEmojis();

// Banner panel dari file lokal images/ (tidak pakai link CDN yg bisa kadaluarsa)
const BANNER_FILE = path.join(__dirname, 'images', 'hypesquad.png');

// ==========================================
// FUNGSI API
// ==========================================

function getHeaders(token) {
  return {
    Authorization: token,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Content-Type': 'application/json',
    Accept: '*/*',
  };
}

// Bit HypeSquad di public_flags: Bravery 64 | Brilliance 128 | Balance 256
const HYPESQUAD_MASK = 64 | 128 | 256;

async function getPublicFlags(token) {
  try {
    const res = await axios.get('https://discord.com/api/v9/users/@me', {
      headers: getHeaders(token)
    });
    return res.data.public_flags ?? null;
  } catch (e) {
    console.error('[GET flags] gagal:', e.response?.status, e.response?.data || e.message);
    return null;
  }
}

function hasHypeSquadBadge(flags) {
  if (flags === null || flags === undefined) return null; // unknown
  return (flags & HYPESQUAD_MASK) !== 0;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getHypeSquad(token) {
  try {
    const res = await axios.get('https://discord.com/api/v9/users/@me', {
      headers: getHeaders(token)
    });
    return res.data.hypesquad || null;
  } catch { return null; }
}

async function setHypeSquad(token, houseId) {
  try {
    await axios.post(
      'https://discord.com/api/v9/hypesquad/online',
      { house_id: houseId },
      { headers: getHeaders(token) }
    );
    return true;
  } catch (e) {
    console.error('[POST hypesquad] gagal:', e.response?.status, e.response?.data || e.message);
    return false;
  }
}

// REMOVE: DELETE dulu, fallback POST null, fallback POST 0 + verifikasi GET
// Return { ok, method, lastStatus, verified } — anti sukses palsu
async function removeHypeSquad(token) {
  const before = await getPublicFlags(token);
  console.log('[REMOVE] flags awal:', before, 'ada badge?', hasHypeSquadBadge(before));

  // Kalau jelas-jelas sudah tidak ada badge, anggap sukses tanpa request
  if (before !== null && !hasHypeSquadBadge(before)) {
    return { ok: true, method: 'already-none', lastStatus: null, verified: true };
  }

  const attempts = [
    { method: 'DELETE', fn: () => axios.delete('https://discord.com/api/v9/hypesquad/online', { headers: getHeaders(token) }) },
    { method: 'POST-null', fn: () => axios.post('https://discord.com/api/v9/hypesquad/online', { house_id: null }, { headers: getHeaders(token) }) },
    { method: 'POST-0', fn: () => axios.post('https://discord.com/api/v9/hypesquad/online', { house_id: 0 }, { headers: getHeaders(token) }) },
  ];

  let lastStatus = null;
  let lastData = null;

  for (const a of attempts) {
    try {
      const res = await a.fn();
      lastStatus = res.status;
      lastData = res.data;
      console.log(`[REMOVE ${a.method}] HTTP ${res.status}`, res.data || '(no body)');
    } catch (e) {
      lastStatus = e.response?.status ?? null;
      lastData = e.response?.data ?? e.message;
      console.error(`[REMOVE ${a.method}] gagal HTTP ${lastStatus}:`, lastData);
      continue; // lanjut ke fallback berikutnya
    }

    await sleep(1000); // beri waktu Discord update flags
    const after = await getPublicFlags(token);
    const stillHas = hasHypeSquadBadge(after);
    console.log(`[REMOVE ${a.method}] flags sesudah:`, after, 'masih ada?', stillHas);

    if (after !== null && !stillHas) {
      return { ok: true, method: a.method, lastStatus, verified: true };
    }
    // kalau GET unknown (null) tapi request 2xx, jangan klaim sukses — lanjut fallback
  }

  return { ok: false, method: 'all-failed', lastStatus, lastData, verified: false };
}

// ==========================================
// KIRIM PANEL (TANPA EMBED)
// ==========================================

async function sendPanel(channel) {
  // ===== KIRIM BANNER DARI FOLDER images/ =====
  const banner = new AttachmentBuilder(BANNER_FILE);
  await channel.send({ files: [banner] });

  // ===== DROPDOWN =====
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('hypesquad_select')
    .setPlaceholder('Select menu')
    .addOptions([
      { 
        label: 'BRAVERY', 
        value: 'bravery', 
        emoji: EMOJIS.bravery 
      },
      { 
        label: 'BRILLIANCE', 
        value: 'brilliance', 
        emoji: EMOJIS.brilliance 
      },
      { 
        label: 'BALANCE', 
        value: 'balance', 
        emoji: EMOJIS.balance 
      },
      { 
        label: 'REMOVE', 
        value: 'remove', 
        emoji: EMOJIS.error 
      }
    ]);

  const row = new ActionRowBuilder().addComponents(selectMenu);

  // ===== KIRIM DROPDOWN (TANPA TEKS) =====
  await channel.send({ components: [row] });

  console.log('[OK] Panel HypeSquad (tanpa embed) dikirim!');
}

// ==========================================
// SLASH COMMAND /PANEL (Admin Only)
// ==========================================

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'panel') return;

  if (!interaction.member.permissions.has('Administrator')) {
    return interaction.reply({
      content: `${EMOJIS.error} Hanya Admin!`,
      ephemeral: true
    });
  }

  await interaction.reply({
    content: `${EMOJIS.success} Mengirim panel...`,
    ephemeral: true
  });

  await sendPanel(interaction.channel);
});

// ==========================================
// HANDLE DROPDOWN SELECT
// ==========================================

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== 'hypesquad_select') return;

  const selected = interaction.values[0];
  const label = selected.charAt(0).toUpperCase() + selected.slice(1);

  const modal = new ModalBuilder()
    .setCustomId(`hypesquad_modal_${selected}`)
    .setTitle(selected === 'remove' ? 'Hapus Badge HypeSquad' : `Set Badge ${label}`);

  const tokenInput = new TextInputBuilder()
    .setCustomId('user_token')
    .setLabel('Token Akun Discord')
    .setPlaceholder('MTIx... Paste token di sini')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(50);

  const row = new ActionRowBuilder().addComponents(tokenInput);
  modal.addComponents(row);

  await interaction.showModal(modal);
});

// ==========================================
// HANDLE MODAL SUBMIT
// ==========================================

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isModalSubmit()) return;
  if (!interaction.customId.startsWith('hypesquad_modal_')) return;

  const token = interaction.fields.getTextInputValue('user_token');
  const action = interaction.customId.replace('hypesquad_modal_', '');

  const houseMap = {
    bravery: { id: 1, name: 'Bravery' },
    brilliance: { id: 2, name: 'Brilliance' },
    balance: { id: 3, name: 'Balance' }
  };

  await interaction.deferReply({ ephemeral: true });

  try {
    // ===== REMOVE / HAPUS BADGE (DELETE + fallback POST null/0, terverifikasi) =====
    if (action === 'remove') {
      const result = await removeHypeSquad(token);

      if (result.ok) {
        await interaction.editReply({
          content: `${EMOJIS.success} Badge **HypeSquad** berhasil dihapus!`
        });
      } else {
        const s = result.lastStatus;
        let hint = 'Cek token dan koneksi.';
        if (s === 401) hint = 'Token tidak valid / expired (401).';
        else if (s === 403) hint = 'Ditolak Discord (403). Coba token baru.';
        else if (s === 404) hint = 'Endpoint / akun tidak ketemu (404).';
        else if (s === 429) hint = 'Rate limit (429). Tunggu sebentar lalu coba lagi.';
        else if (s) hint = `Discord balas HTTP ${s}. Lihat console bot untuk detail.`;
        await interaction.editReply({
          content: `${EMOJIS.error} Gagal hapus badge, badge masih nempel. ${hint}`
        });
      }
      return;
    }

    const house = houseMap[action];
    const success = await setHypeSquad(token, house.id);
    
    let resultMessage = '';

    if (success) {
      resultMessage = `${EMOJIS.success} Badge **${house.name}** berhasil diaktifkan!`;
    } else {
      resultMessage = `${EMOJIS.error} Gagal set badge **${house.name}**. Token tidak valid.`;
    }

    await interaction.editReply({ content: resultMessage });

  } catch (error) {
    console.error('Error:', error);
    await interaction.editReply({ 
      content: `${EMOJIS.error} Terjadi kesalahan. Cek token dan koneksi.`
    });
  }
});

// ==========================================
// STATUS STREAMING TWITCH (ungu)
// Isi TWITCH_URL & STREAMING_TEXT di .env
// ==========================================

function setStreamingStatus() {
  const twitchUrl = process.env.TWITCH_URL;
  if (!twitchUrl || !twitchUrl.includes('twitch.tv')) {
    console.log('[INFO] TWITCH_URL belum diisi, status streaming dilewati.');
    return;
  }
  client.user.setPresence({
    status: 'online',
    activities: [{
      name: process.env.STREAMING_TEXT || 'Streaming on Twitch',
      type: ActivityType.Streaming,
      url: twitchUrl, // bikin status ungu
    }],
  });
  console.log(`Status streaming aktif: ${twitchUrl}`);
}

// ==========================================
// READY
// ==========================================

client.once('ready', async () => {
  console.log(`[OK] Bot Online: ${client.user.tag}`);
  console.log(`Author: Natan`);

  setStreamingStatus();

  if (CHANNEL_ID) {
    const channel = client.channels.cache.get(CHANNEL_ID);
    if (channel?.isTextBased()) {
      console.log(`Mengirim panel ke channel ${channel.name}...`);
      await sendPanel(channel);
    }
  }
});

client.login(process.env.TOKEN);