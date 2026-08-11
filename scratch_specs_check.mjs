import db from './db.mjs';
import fs from 'node:fs';
const out = [];
const rows = db.prepare("SELECT id, brand, model, slug, tracked, catalog, image_url, specs FROM smartphones WHERE model LIKE '%iPhone 17 Pro Max%' OR model LIKE '%iPhone 17%' LIMIT 8").all();
for (const r of rows) {
  out.push(`ID ${r.id} | br=[${r.brand}] model=[${r.model}] tracked=${r.tracked} catalog=${r.catalog} slug=${r.slug} img=${r.image_url || 'none'}`);
  const specs = JSON.parse(r.specs || '{}');
  for (const [cat, items] of Object.entries(specs)) {
    for (const [k, v] of Object.entries(items)) out.push(`   CAT [${cat}] | KEY [${k}] = ${v}`);
  }
  out.push('---');
}
fs.writeFileSync('C:/Users/roggero/AppData/Local/Temp/opencode/live_specs_check.txt', out.join('\n'));
console.log('done');