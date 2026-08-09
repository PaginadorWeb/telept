import { spawn } from 'node:child_process';

const DAY = 24 * 3600 * 1000;

const children = new Set();

function run(script, args = []) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--no-warnings', script, ...args], { stdio: 'inherit' });
    children.add(child);
    child.on('exit', (code) => {
      children.delete(child);
      console.log(`${script} concluido (exit ${code}).`);
      resolve(code ?? 0);
    });
  });
}

async function dailyMaintenance() {
  const full = process.env.FULL_CRAWL === '1';
  console.log(`\n[SCHED] ${new Date().toISOString()} — a sincronizar precos...`);
  await run('sync_prices.mjs');
  console.log('[SCHED] precos atualizados. crawl do catalogo...');
  await run('sync_gsm_all.mjs', full
    ? ['--max-per-brand=80', '--device-delay=4000', '--listing-delay=2500', '--backoff=120000']
    : ['--max-per-brand=12', '--device-delay=2500', '--listing-delay=2000', '--backoff=120000']);
  console.log('[SCHED] manutencao concluida.');
}

process.on('SIGINT', () => {
  children.forEach((c) => c.kill('SIGINT'));
  process.exit(0);
});
process.on('SIGTERM', () => {
  children.forEach((c) => c.kill('SIGTERM'));
  process.exit(0);
});

(async () => {
  console.log('[SCHED] primeiro ciclo em 60s...');
  await new Promise((r) => setTimeout(r, 60_000));
  await dailyMaintenance();
  setInterval(dailyMaintenance, DAY);
})();