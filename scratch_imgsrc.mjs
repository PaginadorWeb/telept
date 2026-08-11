import fs from 'node:fs';
const out = [];
const UA = { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36', 'accept-language': 'pt-PT,pt;q=0.9,en;q=0.8' } };

try {
  const r = await fetch('https://www.gsmarena.com/samsung_galaxy_s24_ultra-12770.php', UA);
  out.push('gsmarena HTTP: ' + r.status);
  if (r.ok) {
    const html = await r.text();
    const m = html.match(/<meta property="og:image" content="([^"]+)"/);
    out.push('gsmarena og:image: ' + (m ? m[1] : 'n/a') + ' (len ' + html.length + ')');
  }
} catch (e) { out.push('gsmarena ERRO: ' + e.message); }

try {
  const r = await fetch('https://phonedb.net/index.php?m=device&id=25123', UA);
  out.push('phonedb HTTP: ' + r.status);
  if (r.ok) {
    const html = await r.text();
    const m = html.match(/<meta property="og:image" content="([^"]+)"/);
    const et = html.match(/<meta property="og:title" content="([^"]+)"/);
    out.push('phonedb og:image: ' + (m ? m[1] : 'n/a') + ' | og:title: ' + (et ? et[1] : 'n/a') + ' (len ' + html.length + ')');
  }
} catch (e) { out.push('phonedb ERRO: ' + e.message); }

fs.writeFileSync('C:/Users/roggero/AppData/Local/Temp/opencode/img_src_test.txt', out.join('\n'));
console.log('done');