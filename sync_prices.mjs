import db, { upsertPrice } from './db.mjs';
import { findBestMatch } from './lib/match.mjs';

const STORES = {
  meo: { module: () => import('./lib/stores/meo.mjs'), needsPhones: false },
  vodafone: { module: () => import('./lib/stores/vodafone.mjs'), needsPhones: false },
  nos: { module: () => import('./lib/stores/nos.mjs'), needsPhones: false },
  darty: { module: () => import('./lib/stores/darty.mjs'), needsPhones: true }
};

const args = {};
for (const arg of process.argv.slice(2)) {
  const [k, v] = arg.split('=');
  args[k.replace(/^--/, '')] = v === undefined ? true : v;
}

async function main() {
  const only = args.only ? args.only.split(',') : Object.keys(STORES);
  const limit = args.limit ? Number(args.limit) : undefined;

  const phones = db.prepare('SELECT id, brand, model FROM smartphones WHERE tracked = 1').all();
  console.log(`BD: ${phones.length} telemoveis. Lojas: ${only.join(', ')} (limit ${limit ?? 'todos'})`);

  const summary = {};
  for (const store of only) {
    if (!STORES[store]) {
      console.log(`Loja desconhecida: ${store}`);
      continue;
    }
    const { scrapeCatalog } = await STORES[store].module();
    console.log(`\n=== Procurando ${store} ... ===`);
    const items = await scrapeCatalog({ limit, phones: STORES[store].needsPhones ? phones : undefined });
    let matched = 0;
    let emptyPrice = 0;
    const unmatched = [];
    for (const item of items) {
      if (item.price == null) {
        emptyPrice++;
        continue;
      }
      const phone = findBestMatch(phones, item);
      if (!phone) {
        unmatched.push(item.name);
        continue;
      }
      upsertPrice.run({
        phone_id: phone.id,
        store: item.store,
        product_url: item.url,
        raw_name: item.name,
        price: item.price,
        available: item.available
      });
      matched++;
    }
    summary[store] = { total: items.length, matched, emptyPrice, unmatched: unmatched.length };
    console.log(`${store}: ${items.length} produtos, ${matched} com match, ${emptyPrice} sem preco, ${unmatched.length} sem match`);
    if (unmatched.length) {
      console.log('  sem match (amostra):', unmatched.slice(0, 6).join(' | '));
    }
  }

  const totalPrices = db.prepare('SELECT COUNT(*) c, COUNT(DISTINCT phone_id) p FROM prices').get();
  console.log(`\nFIM. Precos na BD: ${totalPrices.c} (em ${totalPrices.p} telemoveis)`);
  await import('fs').then((fs) => fs.promises.writeFile('data/sync_report.json', JSON.stringify(summary, null, 1)));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});