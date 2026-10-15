// ==========================================
// UPLOAD-EMOJIS.JS - Upload SVG dari images/ jadi emoji server
// Dipakai sekali (atau tiap ada SVG baru). Idempoten.
// Usage: npm run upload
// Syarat: bot punya permission "Manage Emojis and Stickers"
// ==========================================

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const resvgWasm = require('@resvg/resvg-wasm');

let wasmReady = false;
async function ensureWasm() {
  if (wasmReady) return;
  // WASM murni (tanpa native binding) — jalan di filesystem mana pun
  await resvgWasm.initWasm(
    fs.readFileSync(require.resolve('@resvg/resvg-wasm/index_bg.wasm'))
  );
  wasmReady = true;
}

const GUILD_ID = process.env.GUILD_ID;
const TOKEN = process.env.TOKEN; // token BOT (bukan user token)

if (!GUILD_ID || !TOKEN) {
  console.error('[ERROR] GUILD_ID / TOKEN belum diisi di .env');
  process.exit(1);
}

// key EMOJIS di index.js -> { nama emoji di server, file svg }
const EMOJI_DEFS = {
  bravery: { name: 'hypesquad_bravery', file: 'hypesquadbravery.svg' },
  brilliance: { name: 'hypesquad_brilliance', file: 'hypesquadbrilliance.svg' },
  balance: { name: 'hypesquad_balance', file: 'hypesquadbalance.svg' },
  success: { name: 'hypesquad_yes', file: 'yes.svg' },
  error: { name: 'hypesquad_no', file: 'no.svg' },
};

const IMAGES_DIR = path.join(__dirname, 'images');
const OUT_FILE = path.join(IMAGES_DIR, 'emojis.json');

const api = axios.create({
  baseURL: `https://discord.com/api/v10/guilds/${GUILD_ID}/emojis`,
  headers: { Authorization: `Bot ${TOKEN}` },
});

async function svgToPngDataUri(svgPath) {
  await ensureWasm();
  const svg = fs.readFileSync(svgPath, 'utf8');
  const resvg = new resvgWasm.Resvg(svg, {
    fitTo: { mode: 'width', value: 128 },
    background: 'rgba(0,0,0,0)', // transparan
  });
  const png = resvg.render().asPng(); // Uint8Array — bungkus Buffer dulu utk base64
  const buf = Buffer.from(png.buffer, png.byteOffset, png.byteLength);
  if (buf.length > 256 * 1024) {
    throw new Error(`${path.basename(svgPath)} hasil PNG > 256KB (${buf.length} bytes)`);
  }
  return `data:image/png;base64,${buf.toString('base64')}`;
}

(async () => {
  try {
    console.log('[INFO] Mengambil daftar emoji server...');
    const { data: existing } = await api.get('');
    const byName = new Map(existing.map((e) => [e.name, e.id]));

    // Baca hasil upload sebelumnya (kalau ada) supaya ID lama tidak hilang
    let result = {};
    if (fs.existsSync(OUT_FILE)) {
      try { result = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8')); } catch { result = {}; }
    }

    for (const [key, def] of Object.entries(EMOJI_DEFS)) {
      if (byName.has(def.name)) {
        result[key] = byName.get(def.name);
        console.log(`[SKIP] ${def.name} sudah ada (id: ${result[key]}) - skip`);
        continue;
      }

      const svgPath = path.join(IMAGES_DIR, def.file);
      if (!fs.existsSync(svgPath)) {
        console.error(`[ERROR] File tidak ada: ${def.file} - skip`);
        continue;
      }

      console.log(`[UPLOAD] ${def.name} dari ${def.file}...`);
      const image = await svgToPngDataUri(svgPath);
      const { data } = await api.post('', { name: def.name, image });
      result[key] = data.id;
      console.log(`[OK] ${def.name} terupload (id: ${data.id})`);
    }

    fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2));
    console.log(`\nID tersimpan di images/emojis.json:`);
    console.log(JSON.stringify(result, null, 2));
    console.log('\nRestart bot (node index.js) agar EMOJIS baru dipakai.');
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;
    console.error('[ERROR] Gagal:', status, JSON.stringify(data) || error.message);
    if (status === 403) console.error('-> Bot butuh permission "Manage Emojis and Stickers" di server.');
    if (data?.code === 30008) {
      console.error('-> Slot emoji server PENUH (100/100). Hapus emoji yang tidak dipakai');
      console.error('   (Server Settings -> Emoji) sampai ada 5 slot kosong, lalu jalankan ulang.');
      console.error('   Alternatif: boost server untuk nambah slot emoji.');
    }
    process.exit(1);
  }
})();
