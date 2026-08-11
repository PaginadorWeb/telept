import fs from 'node:fs';
const out = [];
const UA = { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36' } };

const r = await fetch('https://www.gsmarena.com/results.php3?sSearch=iphone+17+pro+max', UA);
const html = await r.text();
out.push('search status ' + r.status + ' len ' + html.length);
const links = [...html.matchAll(/<a href="([a-z0-9_\-]+-\d+\.php)"><img src="([^"]+)"/g)].slice(0, 6);
out.push('resultados: ' + links.length);
for (const l of links) out.push('  ' + l[1] + ' || ' + l[2]);
const t = html.match(/<title>([^<]*)<\/title>/);
out.push('title: ' + (t ? t[1] : 'n/a'));
fs.writeFileSync('C:/Users/roggero/AppData/Local/Temp/opencode/gsm_search.txt', out.join('\n'));
console.log('done');