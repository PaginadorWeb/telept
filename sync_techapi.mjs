import db from './db.mjs';
import { refreshIndex, findPhone, findWatch, fetchDetail, toSpecs } from './lib/techapi.mjs';

const refresh = process.argv.includes('--refresh');

console.log('=== Sincronizando catalog via TechAPI ===');
if (refresh) {
  console.log('Baixando indices...');
  const n = await refreshIndex();
  console.log(`Indices: ${n.length} telefones.`);
}

const phones = db.prepare('SELECT id, brand, model FROM smartphones').all();
let updated = 0;
const missing = [];

const stmt = db.prepare('UPDATE smartphones SET specs = ?, image_url = ? WHERE id = ?');

for (const ph of phones) {
  const isWatch = /watch|band|buds|headphone|tws/i.test(ph.model);
  let hit = isWatch ? null : findPhone(ph.brand, ph.model);
  let resource = 'smartphones';
  if (!hit) {
    hit = findWatch(ph.brand, ph.model);
    resource = 'watches';
  }
  if (!hit) {
    missing.push(`${ph.brand} ${ph.model}`);
    console.log(`  - sem match: ${ph.brand} ${ph.model}`);
    continue;
  }
  try {
    const detail = await fetchDetail(hit.slug, resource);
    const specs = toSpecs(detail);
    stmt.run(JSON.stringify(specs), detail.image_url || '', ph.id);
    updated++;
    console.log(`  OK ${ph.brand} ${ph.model} -> ${hit.name} (${Object.keys(specs).length} categorias)`);
    await new Promise((r) => setTimeout(r, 150));
  } catch (err) {
    console.log(`  erro ${ph.brand} ${ph.model}: ${err.message}`);
  }
}

console.log(`\nSpecs gravadas: ${updated}/${phones.length}`);
if (missing.length) console.log('Sem match:', missing.join(' | '));