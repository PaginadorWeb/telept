import fs from 'node:fs';
const out = [];
const UA = { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36' } };
const r = await fetch('https://www.gsmarena.com/samsung_galaxy_s24_ultra-12770.php', UA);
const html = await r.text();
out.push('status ' + r.status + ' len ' + html.length);
out.push('--- meta og lineas ---');
for (const line of html.split('\n')) {
  if (line.includes('og:image') || line.includes('cf-challenge') || line.includes('Just a moment') || line.includes('images/')) out.push(line.trim().slice(0, 180));
}
const pics = html.match(/https:\/\/fdn2\.gsmarena\.com[^"')\s]+/g) || [];
out.push('--- fdn2 urls: ' + pics.length + ' ---');
for (const p of pics.slice(0, 4)) out.push(p);
const title = html.match(/<title>([^<]*)<\/title>/);
out.push('title: ' + (title ? title[1] : 'n/a'));
fs.writeFileSync('C:/Users/roggero/AppData/Local/Temp/opencode/gsm_page.txt', out.join('\n'));
console.log('done');