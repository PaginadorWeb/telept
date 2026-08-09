import fs from 'fs';
import path from 'path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));

for (const file of ['telept.sqlite', 'gsm_crawled.json']) {
  const target = path.join(dir, 'data', file);
  const source = path.join(dir, 'seed', file);
  if (!fs.existsSync(target) && fs.existsSync(source)) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    console.log(`[seed] restaurado ${file} do seed.`);
  }
}

const children = new Set();

function run(file) {
  const child = spawn(process.execPath, ['--no-warnings', file], { stdio: 'inherit' });
  children.add(child);
  child.on('exit', (code) => {
    children.delete(child);
    console.log(`[entrypoint] ${file} encerrou (exit ${code}).`);
  });
}

run('server.mjs');
run('scheduler.mjs');

process.on('SIGINT', () => {
  children.forEach((c) => c.kill('SIGINT'));
  process.exit(0);
});
process.on('SIGTERM', () => {
  children.forEach((c) => c.kill('SIGTERM'));
  process.exit(0);
});

process.stdin.resume();