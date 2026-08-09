import { chromium } from 'playwright';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const PAGE_URL = 'https://lojaonline.nos.pt/telemoveis';

export async function scrapeCatalog({ limit, headless = true } = {}) {
  const browser = await chromium.launch({ headless, args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const context = await browser.newContext({ userAgent: UA, locale: 'pt-PT', viewport: { width: 1400, height: 900 } });
    const page = await context.newPage();
    await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(6000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2500);

    const links = await page.evaluate(() => {
      const seen = new Set();
      const out = [];
      for (const a of document.querySelectorAll('a[href*="/produto/"]')) {
        const href = a.getAttribute('href').split('#')[0].split('?')[0];
        if (seen.has(href)) continue;
        seen.add(href);
        const name = (a.innerText || '').trim().split('\n')[0].trim();
        out.push({ href: new URL(href, location.origin).href, name });
      }
      return out;
    });

    const results = [];
    for (const l of links.slice(0, limit ?? links.length)) {
      await page.goto(l.href, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(3500);
      const data = await page.evaluate(() => {
        const prices = [...document.querySelectorAll('.full-price')]
          .map((e) => e.innerText.trim())
          .filter((t) => t && !/€|\/m[\u00ea]s/i.test(t))
          .map((t) => {
            const m = t.match(/([0-9][0-9.,]*)/);
            return m ? parseFloat(m[1].replace(/\./g, '').replace(',', '.')) : null;
          })
          .filter((n) => n != null);
        const price = prices.length
          ? Math.min(...prices)
          : (() => {
              const m = document.querySelector('.full-price')?.innerText.match(/([0-9][0-9.,]*)/);
              return m ? parseFloat(m[1].replace(/\./g, '').replace(',', '.')) : null;
            })();
        const bodyTxt = document.body.innerText;
        const title = (document.querySelector('h1')?.innerText || '').trim();
        const available = /esgotado|indispon[\u00e1a]vel|sem stock/i.test(bodyTxt) ? 0 : 1;
        return { price, title, available };
      });

      results.push({
        store: 'nos',
        name: data.title || l.name || null,
        brand: null,
        price: data.price,
        available: data.available,
        url: l.href
      });
    }
    return results;
  } finally {
    await browser.close();
  }
}