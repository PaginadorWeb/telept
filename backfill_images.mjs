import fs from 'fs';
import path from 'path';
import db from './db.mjs';

const args = {};
for (const arg of process.argv.slice(2)) {
  const [k, v] = arg.split('=');
  args[k.replace(/^--/, '')] = v === undefined ? true : v;
}

const PAGE_DELAY = Number(args.delay || 700);
const STATE_FILE = path.join(process.cwd(), 'data', 'img_backfill.json');
const GSM_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const MD = 'https://www.mobiledokan.com';
const GSM = 'https://www.gsmarena.com';

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { done: {}, imgs: {} };
  }
}

const state = loadState();
const save = () => fs.writeFileSync(STATE_FILE, JSON.stringify(state));

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-.()"',/\\+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tok = (s) => norm(s).split(' ').filter((t) => t.length >= 2);

async function downloadSitemap(url) {
  const r = await fetch(url, { headers: { 'User-Agent': GSM_UA }, signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error(`sitemap ${r.status}`);
  const xml = await r.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)]
    .map((m) => m[1])
    .map((u) => u.replace('https://www.mobiledokan.com', ''))
    .filter((p) => !/\/specification|\/gallery/.test(p));
}

function buildMdIndex(paths) {
  const map = new Map();
  for (const p of paths) {
    const slug = p.replace(/^\/(mobile|watch)\//, '').replace(/\/$/, '');
    const name = slug.replace(/-/g, ' ');
    const n = norm(name);
    if (!n) continue;
    const cur = map.get(n);
    if (!cur || p.length < cur.length) map.set(n, { path: p, name });
  }
  return map;
}

function matchMd(phones, mdIndex) {
  const byTokens = new Map();
  for (const [n, v] of mdIndex) {
    for (const t of tok(v.name)) {
      if (t.length < 3) continue;
      if (!byTokens.has(t)) byTokens.set(t, []);
      byTokens.get(t).push(v);
    }
  }
  return phones.map((ph) => {
    const wantTokens = tok(`${ph.brand} ${ph.model}`);
    if (!wantTokens.length) return { ph, v: null };
    const wantFull = norm(`${ph.brand} ${ph.model}`);
    const exact = mdIndex.get(wantFull);
    if (exact) return { ph, v: exact, score: 1 };
    const brandFirst = norm(ph.brand).split(' ')[0];
    const cands = new Map();
    for (const t of wantTokens) {
      if (t.length < 3) continue;
      for (const v of byTokens.get(t) || []) {
        const brandOk = norm(v.name).split(' ')[0] === brandFirst;
        if (!brandOk) continue;
        cands.set(v.path, v);
      }
    }
    let best = null;
    let bestScore = 0;
    for (const v of cands.values()) {
      const vt = tok(v.name);
      const covered = wantTokens.filter((t) => vt.includes(t)).length;
      const score = covered / wantTokens.length;
      if (score > bestScore) { bestScore = score; best = v; }
    }
    return { ph, v: best, score: bestScore >= 0.6 ? bestScore : 0 };
  });
}

async function fetchOg(slugPath) {
  const r = await fetch(`${MD}${slugPath}`, { headers: { 'User-Agent': GSM_UA }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) return null;
  const html = await r.text();
  const m = html.match(/property="og:image"\s+content="([^"]+)"/) || html.match(/<meta\s+itemprop="image"\s+content="([^"]+)"/);
  return m ? m[1] : null;
}

const update = db.prepare('UPDATE smartphones SET image_url = ? WHERE id = ?');

async function gsmFallback(ph) {
  const q = encodeURIComponent(`${ph.brand} ${ph.model.split(' ').slice(0, 3).join(' ')}`);
  const res = await fetch(`${GSM}/results.php3?sQuickSearch=yes&sName=${q}`, {
    headers: { 'User-Agent': GSM_UA, Referer: GSM },
    signal: AbortSignal.timeout(30000)
  });
  if (res.status === 429) return '429';
  const html = await res.text();
  const slug = [...new Set([...html.matchAll(/(?:href|data-src)\s*=\s*["']?([a-z0-9_-]+-\d{3,6}\.php)["']?/gi)].map((m) => m[1]))][0];
  if (!slug) return null;
  const pres = await fetch(`${GSM}/${slug}`, { headers: { 'User-Agent': GSM_UA, Referer: GSM }, signal: AbortSignal.timeout(30000) });
  if (pres.status === 429) return '429';
  const phtml = await pres.text();
  const m = phtml.match(/specs-photo-main[\s\S]{0,700}?<\s*img[^>]*src\s*=\s*["']?([^"'\s>]+)/i);
  if (!m) return null;
  const img = m[1];
  if (!/^(https?:)?\/\/(fdn2?\.)?gsmarena\.com/i.test(img)) return null;
  if (!/\.(jpe?g|png|webp|avif)$/i.test(img) || /logo|fallback|no\d/i.test(img)) return null;
  return img;
}

const targets = db.prepare(`
  SELECT id, brand, model, kind FROM smartphones
  WHERE image_url IS NULL OR image_url = ''
     OR image_url LIKE '%phonedb%'
     OR image_url LIKE '%jsdelivr%'
     OR image_url LIKE '%darty%'
  ORDER BY id
`).all();
console.log(`alvos: ${targets.length}`);

console.log('Baixando sitemaps mobiledokan...');
const [mobileS, watchS] = await Promise.all([
  downloadSitemap('https://www.mobiledokan.com/sitemap/mobile.xml'),
  downloadSitemap('https://www.mobiledokan.com/sitemap/watch.xml')
]);
const mdIndex = buildMdIndex([...mobileS, ...watchS]);
console.log(`indice mobiledokan: ${mdIndex.size} paginas unicas`);

const todo = targets.filter((ph) => !state.done[ph.id]);
console.log(`a processar: ${todo.length}`);

const matched = matchMd(todo, mdIndex);
const withMatch = matched.filter((x) => x.v);
console.log(`com match mobiledokan: ${withMatch.length} de ${todo.length}`);

const uniquePaths = [...new Set(withMatch.map((x) => x.v.path))];
console.log(`paginas unicas para fetch: ${uniquePaths.length}`);

let okMd = 0;
for (let i = 0; i < uniquePaths.length; i++) {
  const p = uniquePaths[i];
  if (state.imgs[p] === undefined) {
    await new Promise((r) => setTimeout(r, PAGE_DELAY));
    const og = await fetchOg(p);
    state.imgs[p] = og || '';
    save();
  }
}
console.log(`og:image obtidas: ${Object.values(state.imgs).filter(Boolean).length}`);

let gsm429 = false;
for (const { ph, v } of matched) {
  if (state.done[ph.id]) continue;
  if (v && state.imgs[v.path]) {
    update.run(state.imgs[v.path], ph.id);
    state.done[ph.id] = 'ok';
    okMd++;
    continue;
  }
  if (args.gsm !== 'false' && !v) {
    const img = await gsmFallback(ph);
    if (img === '429') { gsm429 = true; continue; }
    if (img) { update.run(img, ph.id); state.done[ph.id] = 'ok-gsm'; continue; }
  }
  state.done[ph.id] = 'nofound';
}
save();

console.log(`\nOK mobiledokan: ${okMd}`);
const summary = {};
for (const v of Object.values(state.done)) summary[v] = (summary[v] || 0) + 1;
console.log('resumo:', JSON.stringify(summary));
if (gsm429) console.log('nota: GSMarena ainda com 429 — os sem match ficaram para nova corrida');