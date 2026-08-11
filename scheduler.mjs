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
  console.log(`\n[SCHED] ${new Date().toISOString()} a sincronizar precos...`);
  await run('sync_prices.mjs');
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