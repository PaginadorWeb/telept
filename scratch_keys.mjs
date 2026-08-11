import db from './db.mjs';
import { fetchDetail, findPhone } from './lib/techapi.mjs';
import fs from 'node:fs';
const out = [];

const withImg = db.prepare("SELECT slug, brand, model FROM smartphones WHERE image_url != '' AND slug IS NOT NULL LIMIT 1").get();
const withoutImg = db.prepare("SELECT slug, brand, model FROM smartphones WHERE (image_url IS NULL OR image_url='') AND slug IS NOT NULL LIMIT 1").get();
out.push('com imagem: ' + JSON.stringify(withImg));
out.push('sem imagem: ' + JSON.stringify(withoutImg));

for (const row of [withImg, withoutImg]) {
  try {
    const d = await fetchDetail(row.slug, 'smartphones');
    const keys = Object.keys(d);
    out.push(`${row.brand} ${row.model} (${row.slug}): keys: ${keys.join(', ')}`);
    for (const k of ['image_url', 'images', 'image', 'photo', 'pictures', 'gallery']) {
      if (d[k] !== undefined) out.push(`  ${k}: ${JSON.stringify(d[k]).slice(0, 130)}`);
    }
    if (d.display && d.display.images) out.push(`  display.images: ${JSON.stringify(d.display.images).slice(0, 130)}`);
  } catch (e) { out.push(`${row.slug}: ERRO ${e.message}`); }
}

const iphone = db.prepare("SELECT slug, brand, model FROM smartphones WHERE slug LIKE 'apple-iphone-17-pro-max%' LIMIT 1").get();
if (iphone) {
  try {
    const d = await fetchDetail(iphone.slug, 'smartphones');
    out.push(`IPHONE ${iphone.slug}: keys: ${Object.keys(d).join(', ')}`);
    for (const k of ['image_url', 'images', 'image', 'photo']) if (d[k] !== undefined) out.push(`  ${k}: ${JSON.stringify(d[k]).slice(0, 160)}`);
  } catch (e) { out.push(`iphone: ERRO ${e.message}`); }
}
fs.writeFileSync('C:/Users/roggero/AppData/Local/Temp/opencode/detail_keys2.txt', out.join('\n'));
console.log('done');