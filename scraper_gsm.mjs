import { fetchAndStore, normalizeUrl, sleep } from './lib/gsm.mjs';

const urls = process.argv.slice(2);

if (urls.length === 0) {
  console.log('USO: node scraper_gsm.mjs <url1|slug1> <url2|slug2> ...');
  process.exit(1);
}

(async () => {
  const normalized = urls.map(normalizeUrl);
  for (let i = 0; i < normalized.length; i++) {
    await sleep(2000);
    await fetchAndStore(normalized[i]);
  }
  console.log('Sincronizacao concluida.');
})();