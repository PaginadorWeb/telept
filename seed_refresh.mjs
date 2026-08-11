import fs from 'fs';
import path from 'path';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const sources = ['telept.sqlite', 'gsm_crawled.json', 'techapi_index.json', 'techapi_watches.json'];

for (const file of sources) {
  const from = path.join(here, 'data', file);
  const to = path.join(here, 'seed', file);
  if (!fs.existsSync(from)) continue;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  console.log(`Seed ${file} atualizado.`);
}