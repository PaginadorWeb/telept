import fs from 'node:fs';
import db from './db.mjs';
const out = [];
const s11 = db.prepare("SELECT image_url FROM smartphones WHERE id = 19").get();
const s8 = db.prepare("SELECT image_url FROM smartphones WHERE id = 41").get();
out.push('base 19: ' + (s11.image_url || 'NULL'));
out.push('base 41: ' + (s8.image_url || 'NULL'));
if (s11.image_url) { db.prepare('UPDATE smartphones SET image_url = ? WHERE id = 20').run(s11.image_url); out.push('updated 20'); }
if (s8.image_url) { db.prepare('UPDATE smartphones SET image_url = ? WHERE id = 42').run(s8.image_url); out.push('updated 42'); }
const chk = db.prepare('SELECT id, image_url FROM smartphones WHERE id IN (19,20,41,42)').all();
for (const r of chk) out.push(`${r.id}: ${(r.image_url || 'NULL').slice(0, 70)}`);
const st = fs.statSync('C:/Users/roggero/Documents/New OpenCode Project/telept-camada1/data/telept.sqlite');
out.push('mtime: ' + st.mtime.toISOString());
fs.writeFileSync('C:/Users/roggero/AppData/Local/Temp/opencode/final_watches.txt', out.join('\n'));
console.log('done');