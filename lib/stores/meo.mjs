import { httpGet, sleep, parseJsonLd } from '../http.mjs';

const BASE = 'https://loja.meo.pt';
const SITEMAP = `${BASE}/sitemap.xml`;

export const storeInfo = { id: 'meo', name: 'MEO' };

async function collectProductUrls(limit) {
  const xml = await httpGet(SITEMAP);
  const urls = [...xml.matchAll(/<loc>(https:\/\/loja\.meo\.pt\/comprar\/telemoveis\/[^<]+)<\/loc>/g)].map((m) => m[1]);
  return urls.slice(0, limit ?? urls.length);
}

export async function scrapeCatalog({ limit, delay = 800 } = {}) {
  const urls = await collectProductUrls(limit);
  const products = [];
  let fetched = 0;

  for (const url of urls) {
    await sleep(delay);
    try {
      const html = await httpGet(url);
      fetched++;
      const jsonLd = parseJsonLd(html);
      const product = jsonLd.find((b) => b['@type'] === 'Product' || b['@type']?.[0] === 'Product');
      if (!product) continue;

      const offers = (Array.isArray(product.offers) ? product.offers : [product.offers]).filter(Boolean);
      const inStock = offers.filter((o) => /InStock/i.test(o.availability || ''));
      const chosen = (inStock.length ? inStock : offers).sort((a, b) => (a.price ?? 0) - (b.price ?? 0))[0];
      if (!chosen || chosen.price == null) continue;

      const rawName = (product.name || '').split(' – ')[0].trim() || null;
      const urlSeg = url.split('/');
      products.push({
        store: 'meo',
        name: rawName,
        brand: product.brand?.name || urlSeg[5] || null,
        price: Number(chosen.price),
        available: inStock.length > 0 ? 1 : 0,
        url
      });
    } catch (err) {
      if (err.response?.status !== 404) {
        console.log(`  meo: erro em ${url}: ${err.message}`);
      }
    }
    fetched++;
    if (fetched % 25 === 0) {
      console.log(`  meo: ${fetched}/${urls.length} paginas, ${products.length} precos`);
    }
  }
  return products;
}