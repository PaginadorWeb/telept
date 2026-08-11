import db from './db.mjs';
import fs from 'node:fs';
const out = [];
const base = db.prepare("SELECT image_url FROM smartphones WHERE model = 'Apple Watch Series 11'").get();
const al11 = db.prepare("SELECT image_url FROM smartphones WHERE model = 'Apple Watch Series 11 Aluminum'").get();
const base8 = db.prepare("SELECT image_url FROM smartphones WHERE model = 'Apple Watch Series 8'").get();
out.push('S11: ' + (base ? base.image_url.slice(0, 60) : 'null') + ' | S11Al: ' + (al11 ? al11.image_url.slice(0, 60) : 'null'));
if (base && base.image_url) db.prepare("UPDATE smartphones SET image_url = ? WHERE model = 'Apple Watch Series 11 Aluminum'").run(base.image_url);
if (base8 && base8.image_url) db.prepare("UPDATE smartphones SET image_url = ? WHERE model = 'Apple Watch Series 8 Aluminum'").run(base8.image_url);
out.push('copiado para variantes Aluminum');

const urls = db.prepare("SELECT DISTINCT image_url FROM smartphones WHERE tracked=1 AND image_url LIKE 'http%darty%' LIMIT 6").all();
for (const u of urls) {
  const url = u.image_url;
  try {
    const res = await fetch(url, { method: 'HEAD', headers: { 'user-agent': 'Mozilla/5.0' }, redirect: 'follow', timeout: 15000 });
    out.push(`darty ${res.status} ${res.headers.get('content-type')} ${url.slice(0, 70)}`);
  } catch (e) { out.push(`darty ERRO ${e.message} ${url.slice(0, 70)}`); }
}
fs.writeFileSync('C:/Users/roggero/AppData/Local/Temp/opencode/store_verify.txt', out.join('\n'));
console.log('done');