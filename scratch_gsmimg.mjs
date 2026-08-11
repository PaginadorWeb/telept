import db from './db.mjs';
import { fetchDetail, findPhone } from './lib/techapi.mjs';
import fs from 'node:fs';
const out = [];

const iphone = db.prepare("SELECT slug FROM smartphones WHERE slug LIKE 'apple-iphone-17-pro-max%' LIMIT 1").get();
try {
  const d = await fetchDetail(iphone.slug, 'smartphones');
  out.push('base_model_slug: ' + d.base_model_slug + ' | source_urls: ' + JSON.stringify(d.source_urls).slice(0, 300));
  if (d.base_model_slug) {
    try {
      const b = await fetchDetail(d.base_model_slug, 'smartphones');
      out.push('BASE image_url: ' + (b.image_url || 'null') + ' | images: ' + JSON.stringify(b.images).slice(0, 100));
    } catch (e) { out.push('BASE fetch ERRO: ' + e.message); }
  }
} catch (e) { out.push('ERRO: ' + e.message); }

const src = (await findPhone('Apple', 'iPhone 17 Pro Max'));
if (src && src.source_urls) out.push('index source_urls: ' + JSON.stringify(src.source_urls).slice(0, 300));

const page = src && src.source_urls && src.source_urls[0];
if (page) {
  try {
    const res = await fetch(page, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36' } });
    out.push(`gsmarena HTTP ${res.status}`);
    if (res.ok) {
      const html = await res.text();
      const m = html.match(/<meta property="og:image" content="([^"]+)"/);
      out.push('og:image: ' + (m ? m[1] : 'NAO ENCONTRADO'));
      if (!m && html.includes('gsmarena.com')) out.push('page contem gsmarena (html len ' + html.length + ')');
    }
  } catch (e) { out.push('gsmarena ERRO: ' + e.message); }
}
fs.writeFileSync('C:/Users/roggero/AppData/Local/Temp/opencode/gsm_img_test.txt', out.join('\n'));
console.log('done');