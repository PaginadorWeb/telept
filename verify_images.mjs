import Database from 'better-sqlite3';
import { writeFileSync } from 'fs';
const db = new Database('data/telept.sqlite');

const COLORS = new Set(['black', 'white', 'green', 'blue', 'red', 'gray', 'grey', 'gold', 'golden', 'silver', 'silvar', 'titanium', 'graphite', 'starlight', 'midnight', 'purple', 'yellow', 'orange', 'pink', 'brown', 'lime', 'violet', 'navy', 'charcoal', 'cream', 'sage', 'marble', 'indigo', 'sky', 'coral', 'aqua', 'olive', 'beige', 'mint', 'rose', 'teal', 'champagne', 'bronze', 'copper', 'slate', 'denim', 'cobalt', 'emerald', 'flamingo', 'forest', 'frost', 'glacier', 'icy', 'lavender', 'ocean', 'peach', 'sand', 'snow', 'sunset', 'ultramarine', 'winter', 'dune', 'desert', 'onyx', 'pearl', 'prism', 'rainbow', 'ruby', 'sapphire', 'steel', 'chrome', 'storm', 'terra', 'volcanic', 'washed', 'whiteblack', 'dark', 'light', 'space']);
const JUNK = new Set(['dual', 'sim', 'lte', '5g', '4g', '3g', '2g', 'td', 'emea', 'apac', 'latam', 'global', 'regional', 'international', 'sm', 'ds', 'nfc', 'official', 'image', 'img', 'edition', 'premium', 'standard', 'top', 'na', 'eu', 'us', 'uk', 'cn', 'in', 'jp', 'kr', 'hk', 'tw', 'uw', 'variant', 'variants', 'gms', 'ram', 'rom', 'gps', 'wlan', 'dsds', 'brand', 'model']);
const NUM_INFO = /^\d+(gb|tb)$/;

const norm = (s) => String(s || '')
  .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[_\-.()"',/+\\]/g, ' ').replace(/\s+/g, ' ').trim();

const tokens = (s) => norm(s).split(' ').filter((t) => t.length >= 2 || /^\d+$/.test(t));

function imageTokens(basename) {
  let base = basename.replace(/\.(webp|jpe?g|png|gif)$/i, '');
  base = base.replace(/-(official-image|official-img|image|img|photo)-?/gi, ' ');
  const ts = base.toLowerCase().split(/[-_ ]+/).filter((t) => t.length >= 2 || /^\d+$/.test(t));
  return ts.filter((t) => !COLORS.has(t) && !JUNK.has(t));
}

function modelTokens(model) {
  const tks = tokens(model);
  return tks.filter((t) => !JUNK.has(t) && !NUM_INFO.test(t));
}

const isHash = (basename) => /^\d{9,}[a-z0-9]{2,10}\.(webp|jpe?g|png|gif)$/i.test(basename);

const rows = db.prepare(`SELECT id, brand, model, image_url FROM smartphones WHERE image_url LIKE '%mobiledokan%'`).all();
console.log('rows mobiledokan:', rows.length);

let kept = 0, cleared = 0, keptHash = 0;
const clearedIds = [];
const clear = db.prepare('UPDATE smartphones SET image_url = \'\' WHERE id = ?');

for (const r of rows) {
  const url = r.image_url;
  const basename = url.split('/').pop();
  if (isHash(basename)) { clear.run(r.id); cleared++; clearedIds.push(r.id); continue; }
  const want = modelTokens(r.model);
  if (want.length < 2 || want.every((t) => /^\d+$/.test(t))) { clear.run(r.id); cleared++; clearedIds.push(r.id); continue; }
  const img = imageTokens(basename);
  const subset = want.every((t) => img.includes(t));
  if (subset) { kept++; continue; }
  clear.run(r.id);
  cleared++;
  clearedIds.push(r.id);
}

console.log(`mantidos: ${kept} | limpos (foto nao bate com o modelo): ${cleared}`);
const rem = db.prepare(`SELECT brand, model FROM smartphones WHERE image_url IS NULL OR image_url=''`).all();
console.log(`apos validacao, sem imagem: ${rem.length}`);

writeFileSync('data/img_rejected.json', JSON.stringify({ ids: clearedIds }));