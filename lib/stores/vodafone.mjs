import { chromium } from 'playwright';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const PAGE_URL = 'https://www.vodafone.pt/loja/telemoveis/';
const CARD_SELECTOR = '.catalog-cards-item';

export async function scrapeCatalog({ limit, headless = true, scrollMax = 8 } = {}) {
  const browser = await chromium.launch({ headless, args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const context = await browser.newContext({ userAgent: UA, locale: 'pt-PT', viewport: { width: 1400, height: 900 } });
    const page = await context.newPage();
    await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForSelector(CARD_SELECTOR, { timeout: 60000 });
    await page.waitForTimeout(1500);

    let prev = 0;
    for (let i = 0; i < scrollMax && !limit; i++) {
      const n = await page.locator(CARD_SELECTOR).count();
      if (n === prev) break;
      prev = n;
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1400);
    }

    const cards = await page.locator(CARD_SELECTOR).all();
    const results = [];
    for (const card of cards.slice(0, limit ?? cards.length)) {
      const text = (await card.innerText()) || '';
      const href = await card.locator('a').first().getAttribute('href').catch(() => null);
      const priceMatch = text.match(/([0-9][0-9.,]*)\s*€(?!([0-9]))/) || text.match(/€\s*([0-9][0-9.,]*)/);
      const title = await card.locator('.catalog-cards-item-name a, a[class*="heading--bold"]').first().innerText().catch(() => null);
      results.push({
        store: 'vodafone',
        name: (title || text.split('\n').find((l) => l.trim().length > 3) || '').trim() || null,
        brand: null,
        price: priceMatch ? parseFloat(priceMatch[1].replace(/\./g, '').replace(',', '.')) : null,
        available: /sem stock|esgotado/i.test(text) ? 0 : 1,
        url: href ? new URL(href, PAGE_URL).href : PAGE_URL
      });
    }
    return results;
  } finally {
    await browser.close();
  }
}