import db from './db.mjs';
import fs from 'node:fs';
const out = [];
const REPORT = 'C:/Users/roggero/AppData/Local/Temp/opencode/store_img_report.txt';
const log = (s) => fs.appendFileSync(REPORT, s + '\n');
const UA = { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36' } };

const phones = db.prepare("SELECT id, brand, model FROM smartphones WHERE tracked=1 AND (image_url IS NULL OR image_url='')").all();
out.push('tracked sem imagem: ' + phones.length);
log('inicio ' + new Date().toISOString());

const upd = db.prepare('UPDATE smartphones SET image_url = ? WHERE id = ?');

let done = 0;
async function worker() {
  while (true) {
    const p = phones[done++];
    if (!p) break;
    try {
      const urls = db.prepare('SELECT product_url FROM prices WHERE phone_id = ? AND product_url IS NOT NULL').all(p.id).map((r) => r.product_url);
      let got = null;
      for (const u of urls.slice(0, 6)) {
        try {
          const res = await fetch(u, { ...UA, redirect: 'follow' });
          if (!res.ok) continue;
          const html = await res.text();
          const m = html.match(/<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image["']/i);
          if (m) {
            const url = m[1].replace(/&amp;/g, '&').replace(/^\/\//, 'https://');
            if (!/(logo|icon|banner)/i.test(url)) { got = url; break; }
          }
        } catch { /* loja indisponivel */ }
      }
      if (got) { upd.run(got, p.id); log(`OK ${p.brand} ${p.model} -> ${got.slice(0, 110)}`); }
      else log(`SEM imagem ${p.brand} ${p.model}`);
    } catch (e) { log(`ERRO ${p.brand} ${p.model}: ${e.message}`); }
  }
}
await Promise.all(Array.from({ length: 6 }, () => worker()));
log('fim ' + new Date().toISOString());
console.log('done');