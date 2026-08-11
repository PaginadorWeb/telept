import db from './db.mjs';
import fs from 'node:fs';
const out = [];
const brands = db.prepare('SELECT DISTINCT brand FROM smartphones ORDER BY brand COLLATE NOCASE').all();
out.push('marcas: ' + brands.map((b) => b.brand).join(' | '));
out.push('total sem imagem: ' + db.prepare("SELECT COUNT(*) c FROM smartphones WHERE image_url IS NULL OR image_url = ''").get().c);
out.push('catalog sem imagem: ' + db.prepare("SELECT COUNT(*) c FROM smartphones WHERE catalog=1 AND (image_url IS NULL OR image_url = '')").get().c);
fs.writeFileSync('C:/Users/roggero/AppData/Local/Temp/opencode/brands_check.txt', out.join('\n'));
console.log('done');