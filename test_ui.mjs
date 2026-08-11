import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await page.waitForSelector('.status');

const hasCardsBefore = await page.locator('.card').count();
console.log('1. Home sem pesquisa -> cards:', hasCardsBefore, '(esperado: 0)');

const search = page.locator('#searchInput');
await search.fill('Flip');
await page.locator('#searchBtn').click();
await page.waitForSelector('.card');
console.log('2. Pesquisa "Flip":', await page.locator('.card').count(), 'cards');

const cards = page.locator('.card');
await cards.nth(0).locator('.add-cmp').click();
console.log('3. Botao apos adicionar:', (await cards.nth(0).locator('.add-cmp').textContent()).trim());

await search.fill('Fold');
await page.locator('#searchBtn').click();
await page.waitForTimeout(1200);
const cards2 = page.locator('.card');
await cards2.nth(1).locator('.add-cmp').click();
await page.locator('#compareBtn').click();
await page.waitForSelector('.compare-table', { timeout: 10000 });
console.log('4. Comparador: linhas =', await page.locator('.compare-table tbody tr').count());

await browser.close();
if (errors.length) {
  console.log('ERROS JS:');
  errors.slice(0, 5).forEach((e) => console.log('  ' + e));
} else {
  console.log('Sem erros de JS.');
}