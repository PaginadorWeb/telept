import fs from 'fs';
import db from './db.mjs';

const DATA = 'data';

const MULTI_JUNK = ['dual sim', 'premium edition', 'standard edition', 'top edition', 'lte a', 'td lte', 'non nfc', 'middle east'];
const SINGLE_JUNK = new Set([
  'sim', 'lte', 'emea', 'apac', 'latam', 'global', 'regional', 'international', 'cn', 'in', 'us', 'na', 'eu', 'jp', 'ww',
  'kr', 'uk', 'ca', 'au', 'turkey', 'india', 'japan', 'sea', 'premium', 'standard', 'top', 'edition', 'official', 'gms',
  'nosim', 'nfc', 'ram', 'rom', 'gps', 'wlan', '5g', '4g', '3g', '2g', 'gsm', 'cdma', 'wcdma', 'umts', 'hspa', 'dual', 'td',
  'ds', 'ee', 'sku', 'variant', 'variants', 'europe', 'asia', 'america', '42mm', '46mm', '38mm', '40mm', '41mm', '44mm', '45mm', '49mm'
]);

const BRAND_MAP = {
  samsung: 'Samsung', apple: 'Apple', iphone: 'Apple',
  xiaomi: 'Xiaomi', mi: 'Xiaomi', redmi: 'Redmi', poco: 'POCO',
  google: 'Google', oppo: 'OPPO', oneplus: 'OnePlus', realme: 'Realme',
  motorola: 'Motorola', moto: 'Motorola', tcl: 'TCL', alcatel: 'Alcatel',
  honor: 'Honor', huawei: 'Huawei', nothing: 'Nothing', asus: 'Asus',
  vivo: 'Vivo', zte: 'ZTE', nokia: 'Nokia', hmd: 'HMD', infinix: 'Infinix',
  tecno: 'Tecno', nubia: 'Nubia', meizu: 'Meizu', lenovo: 'Lenovo', sony: 'Sony', xperia: 'Sony'
};

const WATCH_BRANDS = new Set([
  'apple', 'samsung', 'huawei', 'honor', 'xiaomi', 'redmi', 'amazfit', 'fitbit', 'garmin',
  'oneplus', 'oppo', 'realme', 'ticwatch', 'nokia', 'hmd', 'motorola', 'polar', 'suunto',
  'coros', 'poco', 'google', 'nothing', 'infinix', 'tecno', 'kospet', 'lemfo', 'zeblaze', 'noise'
]);

function normKeepCase(name) {
  return String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[/\\,+:;."'()-]/g, ' ')
    .replace(/\b(bbk|blu)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanName(name, isWatch) {
  const orig = normKeepCase(name);
  if (!orig) return null;
  const parts = orig.split(' ');
  const low = parts.map((p) => p.toLowerCase());
  const keep = new Array(parts.length).fill(true);

  for (const mw of MULTI_JUNK) {
    const w = mw.split(' ');
    for (let i = 0; i + w.length <= low.length; i++) {
      let eq = true;
      for (let j = 0; j < w.length; j++) eq = eq && low[i + j] === w[j];
      if (eq) for (let j = 0; j < w.length; j++) keep[i + j] = false;
    }
  }
  for (let i = 0; i < low.length; i++) {
    const t = low[i];
    if (SINGLE_JUNK.has(t)) keep[i] = false;
    else if (/^\d+(gb|tb|mb)$/.test(t)) keep[i] = false;
    else if (/^[a-z]\d[a-z0-9]{3,}$/i.test(t)) keep[i] = false;
    else if (/^(?:cph|rmx|xt|sm|sc|l)[a-z0-9]{3,}$/i.test(t)) keep[i] = false;
    else if (/^[a-z]{1,2}\d[a-z0-9]{2,4}$/i.test(t)) keep[i] = false;
    else if (/^[a-z]{2,6}\d{1,3}$/i.test(t)) keep[i] = false;
    else if (/^t\d{3,}$/i.test(t)) keep[i] = false;
  }

  const kept = parts.filter((_, i) => keep[i]);
  if (!kept.length) return null;
  const first = kept[0].toLowerCase();
  let brand = BRAND_MAP[first];
  if (!brand && isWatch && WATCH_BRANDS.has(first)) brand = first.charAt(0).toUpperCase() + first.slice(1);
  if (!brand) return null;
  const model = kept.slice(1).join(' ').trim();
  if (!model) return null;
  return { brand, model };
}

function isBadSlug(slug) {
  return /aitoolbuzz|scrapegsma|allphones|hybrid|ebay|snapdeal|dbpedia/i.test(slug);
}

function buildList(raw, isWatch, allowedBrands) {
  const seen = new Map();
  for (const entry of raw) {
    const c = cleanName(entry.name || '', isWatch);
    if (!c) continue;
    if (!allowedBrands.has(c.brand.toLowerCase())) continue;
    const key = c.brand.toLowerCase() + '||' + c.model.toLowerCase();
    const prev = seen.get(key);
    if (!prev || (isBadSlug(prev.slug) && !isBadSlug(entry.slug))) {
      seen.set(key, { brand: c.brand, model: c.model, slug: entry.slug, kind: isWatch ? 'watch' : 'phone' });
    }
  }
  return [...seen.values()];
}

const phoneBrands = new Set(Object.values(BRAND_MAP).map((b) => b.toLowerCase()));
const watchBrands = new Set([...WATCH_BRANDS].map((b) => b.toLowerCase()));

const phonesIndex = JSON.parse(fs.readFileSync(`${DATA}/techapi_index.json`, 'utf8'));
const watchesIndex = JSON.parse(fs.readFileSync(`${DATA}/techapi_watches.json`, 'utf8'));

const phones = buildList(phonesIndex.results, false, phoneBrands);
const watches = buildList(watchesIndex.results, true, watchBrands);
console.log(`index telefones: ${phonesIndex.count} -> catálogo limpo: ${phones.length}`);
console.log(`index relógios: ${watchesIndex.count} -> catálogo limpo: ${watches.length}`);

db.prepare('UPDATE smartphones SET tracked = 1 WHERE tracked = 0 AND catalog = 0 AND specs IS NOT NULL').run();
const removed = db.prepare('DELETE FROM smartphones WHERE catalog = 1').run().changes;
console.log(`linhas catálogo antigas removidas: ${removed}`);

const insert = db.prepare(`
  INSERT INTO smartphones (brand, model, slug, kind, catalog, tracked)
  VALUES (@brand, @model, @slug, @kind, 1, 0)
  ON CONFLICT(brand, model) DO NOTHING
`);

db.exec('BEGIN');
let inserted = 0;
for (const p of [...phones, ...watches]) inserted += insert.run(p).changes;
db.exec('COMMIT');

console.log(`\ninseridos novos: ${inserted}`);
console.log('=== total na BD ===');
for (const b of db.prepare('SELECT brand, COUNT(*) c, SUM(catalog) cats FROM smartphones GROUP BY brand ORDER BY c DESC').all()) {
  console.log(`  ${b.brand}: ${b.c} (catálogo ${b.cats})`);
}
console.log('\n=== amostra Xiaomi (15) ===');
console.log(db.prepare("SELECT model FROM smartphones WHERE brand='Xiaomi' ORDER BY model LIMIT 15").all().map((r) => r.model).join(' | '));
console.log('\n=== amostra OPPO (10) ===');
console.log(db.prepare("SELECT model FROM smartphones WHERE brand='OPPO' ORDER BY model LIMIT 10").all().map((r) => r.model).join(' | '));
console.log('\n=== amostra Samsung (10) ===');
console.log(db.prepare("SELECT model FROM smartphones WHERE brand='Samsung' ORDER BY model LIMIT 10").all().map((r) => r.model).join(' | '));
console.log('\n=== amostra relógios catálogo (15) ===');
console.log(db.prepare("SELECT brand, model FROM smartphones WHERE kind='watch' AND catalog=1 ORDER BY brand, model LIMIT 15").all().map((r) => `${r.brand} ${r.model}`).join(' | '));
console.log('total relógios catálogo:', db.prepare("SELECT COUNT(*) c FROM smartphones WHERE kind='watch' AND catalog=1").get().c);
console.log('tracked:', db.prepare('SELECT COUNT(*) c FROM smartphones WHERE tracked=1').get().c);