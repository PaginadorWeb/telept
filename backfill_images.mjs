import fs from 'fs';
import path from 'path';
import db from './db.mjs';

const args = {};
for (const arg of process.argv.slice(2)) {
  const [k, v] = arg.split('=');
  args[k.replace(/^--/, '')] = v === undefined ? true : v;
}

const SEARCH_DELAY = Number(args.delay || 2500);
const BACKOFF_MS = Number(args.backoff || 120000);
const STATE_FILE = path.join(process.cwd(), 'data', 'img_backfill.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const GSM = 'https://www.gsmarena.com';

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { done: {}, pending: {} };
  }
}

const state = loadState();
const save = () => fs.writeFileSync(STATE_FILE, JSON.stringify(state));

const targets = db.prepare(`
  SELECT id, brand, model FROM smartphones
  WHERE image_url IS NULL OR image_url = ''
     OR image_url LIKE '%phonedb%'
     OR image_url LIKE '%jsdelivr%'
     OR image_url LIKE '%darty%'
  ORDER BY id
`).all();

const update = db.prepare('UPDATE smartphones SET image_url = ? WHERE id = ?');
let backoffUntil = 0;

async function searchSlug(brand, model) {
  const q = encodeURIComponent(`${brand} ${model.split(' ').slice(0, 3).join(' ')}`);
  const res = await fetch(`${GSM}/results.php3?sQuickSearch=yes&sName=${q}`, {
    headers: { 'User-Agent': UA, Referer: GSM },
    signal: AbortSignal.timeout(30000)
  });
  if (res.status === 429) return '429';
  const html = await res.text();
  const links = [...new Set([...html.matchAll(/(?:href|data-src)\s*=\s*["']?([a-z0-9_-]+-(\d{3,6})\.php)["']?/gi)].map((m) => m[1]))];
  return links.length ? links[0].replace('.php', '') : null;
}

async function fetchImg(slug) {
  const res = await fetch(`${GSM}/${slug}.php`, {
    headers: { 'User-Agent': UA, Referer: GSM },
    signal: AbortSignal.timeout(30000)
  });
  if (res.status === 429) return '429';
  const html = await res.text();
  const m = html.match(/specs-photo-main[\s\S]{0,700}?<\s*img[^>]*src\s*=\s*["']?([^"'\s>]+)/i);
  if (!m) return null;
  const img = m[1];
  if (!/^(https?:)?\/\/(fdn2?\.)?gsmarena\.com/i.test(img)) return null;
  if (!/\.(jpe?g|png|webp|avif)$/i.test(img)) return null;
  if (/logo|fallback|no\d/i.test(img)) return null;
  return img;
}

let startedAt = Date.now();
for (const ph of targets) {
  if (state.done[ph.id]) continue;
  const now = Date.now();
  if (backoffUntil > now) {
    await new Promise((r) => setTimeout(r, Math.min(backoffUntil - now, 60000)));
    continue;
  }
  await new Promise((r) => setTimeout(r, SEARCH_DELAY));

  let slug = state.pending[ph.id];
  if (slug === undefined) {
    slug = await searchSlug(ph.brand, ph.model);
    if (slug === '429') {
      backoffUntil = Date.now() + BACKOFF_MS;
      console.log(`!! 429 search (id ${ph.id}) — backoff ${BACKOFF_MS / 1000}s`);
      continue;
    }
    state.pending[ph.id] = slug;
    save();
  }
  if (!slug) {
    state.done[ph.id] = 'nofound';
    console.log(`- sem match: ${ph.brand} ${ph.model}`);
    save();
    continue;
  }

  const img = await fetchImg(slug);
  if (img === '429') {
    backoffUntil = Date.now() + BACKOFF_MS;
    console.log(`!! 429 fetch (id ${ph.id}) — backoff ${BACKOFF_MS / 1000}s`);
    continue;
  }
  if (img) {
    update.run(img, ph.id);
    state.done[ph.id] = 'ok';
    console.log(`OK ${ph.id} ${ph.brand} ${ph.model} -> ${img.replace('https://', '').slice(0, 60)}`);
  } else {
    state.done[ph.id] = 'noimg';
    console.log(`- sem img: ${ph.brand} ${ph.model}`);
  }
  save();
  if ((Date.now() - startedAt) > 1000 * 60 * 45) {
    console.log('=== 45 min decorridos — pausa voluntária ===');
    process.exit(0);
  }
}

console.log('\nConcluído.');
const summary = {};
for (const v of Object.values(state.done)) summary[v] = (summary[v] || 0) + 1;
console.log('resumo:', JSON.stringify(summary));