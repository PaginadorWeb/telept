import { spawn } from 'node:child_process';

const children = new Set();

function run(script, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--no-warnings', script, ...args], { stdio: 'inherit' });
    children.add(child);
    child.on('exit', (code, signal) => {
      children.delete(child);
      if (signal === 'SIGINT' || code === 130) resolve('interrupted');
      else if (code === 0) resolve();
      else reject(new Error(`${script} saiu com codigo ${code}`));
    });
  });
}

const serving = run('server.mjs').catch((e) => console.log('servidor:', e.message));

const prices = run('sync_prices.mjs')
  .then(() => console.log('Precos atualizados.'))
  .catch((e) => console.log('precos:', e.message));

await Promise.race([serving]);
process.exit(0);