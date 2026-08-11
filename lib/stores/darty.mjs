import { chromium } from 'playwright';
import { findBestMatch } from '../match.mjs';
import { normalizeName } from '../http.mjs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';

const BAD_SLUG = /donativo|recondicion|retech|recicl|capa|pelicula|protetor|suporte|carregador|estoj|cabo|dongle|auscultador|earbuds|smartwatch|caixa|vidro|bateria|funda|stand/i;

const VARIANT_WORDS = ['plus', 'pro', 'max', 'ultra', 'mini', 'lite', 'se', 'fe', 'xr', 'xs', 'note', 'edge', 'active', 'flip', 'fold', '5g'];

function tokenCount(name) {
  return normalizeName(name).split(' ').filter(Boolean).length;
}

function pickBest(phone, items) {
  const brandNorm = normalizeName(phone.brand);
  const modelTokens = normalizeName(phone.model)
    .split(' ')
    .filter((t) => t.length >= 2);
  let best = null;
  let bestScore = 0;
  for (const item of items) {
    if (BAD_SLUG.test(item.name)) continue;
    const tokens = normalizeName(item.name).split(' ');
    if (tokens[0] !== brandNorm) continue;
    if (!modelTokens.length) continue;
    const hasVariant = tokens.some((t) => VARIANT_WORDS.includes(t) && !modelTokens.includes(t));
    if (hasVariant) continue;
    if (!findBestMatch([phone], item)) continue;
    const covered = modelTokens.filter((t) => tokens.includes(t)).length;
    const score = modelTokens.length ? covered / modelTokens.length : 0;
    if (score > bestScore) {
      bestScore = score;
      best = item;
    } else if (score === bestScore && best && tokenCount(item.name) < tokenCount(best.name)) {
      best = item;
    }
  }
  return best;
}

async function searchItems(page, query) {
  await page.goto(`https://darty.pt/search?q=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  return page.evaluate(() => {
    const seen = new Set();
    const out = [];
    for (const a of document.querySelectorAll('a[href*="/products/"]')) {
      const href = a.getAttribute('href').split('?')[0].split('#')[0];
      if (seen.has(href)) continue;
      seen.add(href);
      let container = a;
      for (let i = 0; i < 5 && container; i++) container = container.parentElement;
      const text = (container ? container.innerText : a.innerText) || '';
      const m = text.match(/(\d+[.,]\d{2})\s*\u20ac/);
      const slug = href.split('/products/')[1];
      if (!slug || /donativo|recondicion|retech|recicl/i.test(slug)) continue;
      out.push({
        url: href.startsWith('http') ? href : 'https://darty.pt' + href,
        name: slug.replace(/[-_]/g, ' ').trim(),
        price: m ? Number(m[1].replace('.', '').replace(',', '.')) : null
      });
    }
    return out;
  });
}

export async function scrapeCatalog({ limit, phones = [] } = {}) {
  const targets = limit ? phones.slice(0, limit) : phones;
  if (!targets.length) return [];

  const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const context = await browser.newContext({ userAgent: UA, locale: 'pt-PT', viewport: { width: 1400, height: 900 } });
    const page = await context.newPage();
    const results = [];

    for (const phone of targets) {
      try {
        const query = normalizeName(`${phone.brand} ${phone.model}`);
        const items = await searchItems(page, query);
        const hit = pickBest(phone, items);
        if (!hit) continue;
        results.push({
          store: 'darty',
          brand: phone.brand,
          name: hit.name,
          price: hit.price,
          available: hit.price != null ? 1 : 0,
          url: hit.url
        });
      } catch (err) {
        console.log(`  darty: erro em ${phone.brand} ${phone.model}: ${String(err.message).slice(0, 80)}`);
      }
    }

    return results;
  } finally {
    await browser.close();
  }
}