import db from './db.mjs';
console.log('=== image_url por aparelho (watches + amostra) ===');
const rows = db.prepare("SELECT id, brand, model, image_url FROM smartphones WHERE brand='Apple' AND model LIKE 'Watch%'").all();
for (const r of rows) console.log(r.id, r.brand, r.model, '| img:', r.image_url ? r.image_url.slice(0, 60) : '(NULL)');
console.log('\n=== todos os que NÃO têm imagem ===');
const noimg = db.prepare("SELECT COUNT(*) c FROM smartphones WHERE image_url IS NULL OR image_url=''").get();
console.log('sem imagem:', noimg.c, 'de 61');