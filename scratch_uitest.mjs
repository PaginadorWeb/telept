import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await page.waitForSelector('#brandBar .brand-chip');

const bar = await page.locator('.brand-bar').boundingBox();
const chips = await page.locator('.brand-chip').count();
console.log('1. chips de marca:', chips, '| altura barra:', Math.round(bar.height), 'px (acima de ~60 = fez wrap)');

await page.locator('#searchInput').fill('iPhone 17 Pro Max');
await page.locator('#searchBtn').click();
await page.waitForSelector('.card');
const firstImg = await page.locator('.card').nth(0).locator('img').count();
console.log('2. card iPhone 17 Pro Max tem img:', firstImg === 1);

await page.locator('.card').nth(0).locator('.add-cmp').click();
await page.locator('#searchInput').fill('iPhone 17 Pro');
await page.locator('#searchBtn').click();
await page.waitForTimeout(1000);
await page.locator('.card').nth(0).locator('.add-cmp').click();
await page.locator('#compareBtn').click();
await page.waitForSelector('.compare-table', { timeout: 20000 });
console.log('3. comparador aberto, barra comparar escondida:', await page.locator('#compareBar.in-view').count() === 1);

await page.locator('#compareView .back').click();
await page.waitForTimeout(800);
const btn1 = await page.locator('#compareCount').textContent();
console.log('4. apos voltar, contador:', btn1, '| cards visiveis:', await page.locator('.card').count());

await browser.close();
console.log('ERROS JS:', errors.length ? errors.slice(0, 5) : 'nenhum');