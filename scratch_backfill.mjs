import db from './db.mjs';
import { findPhone, findWatch, fetchDetail, toSpecs } from './lib/techapi.mjs';
import fs from 'node:fs';

const REPORT = 'C:/Users/roggero/AppData/Local/Temp/opencode/backfill_report.txt';
const log = (s) => fs.appendFileSync(REPORT, s + '\n');

const updSpecs = db.prepare('UPDATE smartphones SET specs = ?, image_url = ? WHERE id = ?');
const updImg = db.prepare('UPDATE smartphones SET image_url = ? WHERE id = ?');

const jobs = [];

const tracked = db.prepare('SELECT id, brand, model, kind, slug FROM smartphones WHERE tracked = 1').all();
for (const t of tracked) jobs.push({ id: t.id, brand: t.brand, model: t.model, kind: t.kind, useFinder: true });

const missingImg = db.prepare("SELECT id, slug, kind, brand, model FROM smartphones WHERE (image_url IS NULL OR image_url = '') AND catalog = 1 ORDER BY id").all();
for (const m of missingImg) jobs.push({ id: m.id, slug: m.slug, kind: m.kind, brand: m.brand, model: m.model, useFinder: false });

log(`total jobs: ${jobs.length}`);

let i = 0;
let ok = 0;
let fail = 0;
const t0 = Date.now();

async function worker() {
  while (i < jobs.length) {
    const job = jobs[i++];
    try {
      let detail;
      if (job.useFinder) {
        const found = job.kind === 'watch' ? findWatch(job.brand, job.model) : findPhone(job.brand, job.model);
        if (!found) throw new Error('nao encontrado no indice');
        detail = await fetchDetail(found.slug, job.kind === 'watch' ? 'watches' : 'smartphones');
      } else {
        detail = await fetchDetail(job.slug, job.kind === 'watch' ? 'watches' : 'smartphones');
      }
      const img = detail.image_url || '';
      if (job.useFinder) {
        const specs = toSpecs(detail);
        updSpecs.run(JSON.stringify(specs), img, job.id);
      } else if (img) {
        updImg.run(img, job.id);
      }
      ok++;
      if (ok % 250 === 0) log(`  ...${ok} ok (${Math.round((Date.now() - t0) / 1000)}s)`);
    } catch (e) {
      fail++;
      if (fail <= 30) log(`FALHA ${job.id} ${job.brand} ${job.model}: ${e.message}`);
    }
  }
}

const workers = Array.from({ length: 10 }, () => worker());
await Promise.all(workers);

log(`done: ok=${ok} fail=${fail} tempo=${Math.round((Date.now() - t0) / 1000)}s`);
console.log(`done: ok=${ok} fail=${fail} tempo=${Math.round((Date.now() - t0) / 1000)}s`);