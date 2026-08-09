import fs from 'fs';
import path from 'path';
import { fetchAndStore, sleep, GSMARENA_BASE } from './lib/gsm.mjs';
import { httpGet } from './lib/http.mjs';

const args = {};
for (const arg of process.argv.slice(2)) {
  const [k, v] = arg.split('=');
  args[k.replace(/^--/, '')] = v === undefined ? true : v;
}

const DEVICE_DELAY = Number(args['device-delay'] || 2200);
const LISTING_DELAY = Number(args['listing-delay'] || 1500);
const BACKOFF_MS = Number(args.backoff || 60000);

const DEFAULT_BRANDS = [
  'samsung', 'apple', 'xiaomi', 'motorola', 'honor', 'oppo', 'realme', 'oneplus',
  'google', 'nothing', 'nokia', 'hmd', 'vivo', 'zte', 'tcl', 'tecno', 'infinix',
  'itel', 'asus', 'sony', 'lenovo', 'blackview', 'ulefone', 'doogee', 'oukitel',
  'umidigi', 'caterpillar'
];

const MEMORY_FILE = path.join(process.cwd(), 'data', 'gsm_crawled.json');

function loadMemory() {
  try {
    return new Set(JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8')));
  } catch {
    return new Set();
  }
}

const memory = loadMemory();

function saveMemory() {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify([...memory]));
}

async function httpGetWithBackoff(url, forever = false) {
  const maxAttempts = forever ? Infinity : 4;
  for (let attempt = 1; ; attempt++) {
    try {
      return await httpGet(url);
    } catch (err) {
      const limited = err.response?.status === 429 || err.message === 'RATE_LIMIT';
      if (!limited || attempt === maxAttempts) throw err;
      console.log(`  429 em ${url} — backoff ${BACKOFF_MS / 1000}s (${attempt})`);
      await sleep(BACKOFF_MS);
    }
  }
}

async function getBrands() {
  const html = await httpGetWithBackoff(`${GSMARENA_BASE}/makers.php3`, true);
  const out = [];
  const re = /href\s*=\s*"?([a-z0-9_]+-phones-(\d+))\.php"?[^>]*>\s*([^<]+)<br>\s*<span>(\d+) devices?<\/span>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const name = m[3].trim();
    const slug = m[1].replace('.php', '');
    out.push({ name, slug, id: Number(m[2]), devices: Number(m[4]) });
  }
  return out;
}

async function collectUrls(brand, { maxPerBrand }) {
  const urls = [];
  let pagePath = `${brand.slug}.php`;
  for (let p = 1; ; p++) {
    const html = await httpGetWithBackoff(`${GSMARENA_BASE}/${pagePath}`);
    const links = [...html.matchAll(/href\s*=\s*"?([a-z0-9_]+-\d+)\.php"?/g)]
      .map((x) => x[1])
      .filter((l) => !l.includes('-phones') && !l.includes('-f-'));
    const fresh = links.filter((l) => !memory.has(l) && !memory.has(`${l}__fail`));
    urls.push(...fresh);
    if (maxPerBrand && urls.length >= maxPerBrand) break;

    const pages = [...html.matchAll(new RegExp(`${brand.slug}-f-${brand.id}-0-p(\\d+)\\.php`, 'g'))].map((x) => Number(x[1]));
    const last = pages.length ? Math.max(...pages) : 1;
    if (p >= last) break;
    pagePath = `${brand.slug}-f-${brand.id}-0-p${p + 1}.php`;
    await sleep(LISTING_DELAY);
  }
  return urls.slice(0, maxPerBrand);
}

async function fetchDevice(u, { maxAttempts = 4 } = {}) {
  for (let attempt = 1; ; attempt++) {
    await sleep(DEVICE_DELAY);
    try {
      const ok = await fetchAndStore(`${GSMARENA_BASE}/${u}.php`, { log: false });
      if (ok) {
        memory.add(u);
        return true;
      }
      memory.add(`${u}__fail`);
      return false;
    } catch (err) {
      if (err.message === 'RATE_LIMIT' && attempt < maxAttempts) {
        console.log(`  429 em ${u} — backoff ${BACKOFF_MS / 1000}s (${attempt}/${maxAttempts})`);
        await sleep(BACKOFF_MS);
        continue;
      }
      memory.add(`${u}__fail`);
      console.log(`  - falha: ${u}: ${err.message}`);
      return false;
    }
  }
}

async function main() {
  const wanted = (args.brands ? args.brands.split(',') : DEFAULT_BRANDS)
    .map((b) => b.trim().toLowerCase())
    .filter(Boolean);
  const maxPerBrand = args['max-per-brand'] ? Number(args['max-per-brand']) : 100;

  console.log('Marcas desejadas:', wanted.join(', '));
  const brands = (await getBrands())
    .filter((b) => wanted.includes(b.slug.split('-')[0]) || wanted.includes(b.name.toLowerCase()))
    .sort((a, b) => a.devices - b.devices);
  console.log(`Encontradas ${brands.length} marcas na GSMArena.`);

  let totalStored = 0;
  for (const brand of brands) {
    try {
      console.log(`\n=== ${brand.name} (${brand.devices} devices) ===`);
      const urls = await collectUrls(brand, { maxPerBrand });
      console.log(`  ${urls.length} novos URLs`);
      for (const u of urls) {
        if (await fetchDevice(u, { maxPerBrand })) totalStored++;
      }
      saveMemory();
    } catch (err) {
      console.log(`  erro na marca ${brand.name}: ${err.message}`);
    }
  }
  console.log(`\nConcluido. ${totalStored} telemoveis adicionados/atualizados.`);
  saveMemory();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});