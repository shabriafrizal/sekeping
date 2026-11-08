import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE || 'http://127.0.0.1:4180/';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(name, ok, extra = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/chromium',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.setViewport({ width: 1280, height: 900 });
await page.goto(BASE, { waitUntil: 'networkidle0' });

// onboarding
await page.evaluate(() =>
  [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Lihat dengan data contoh'))?.click(),
);
await wait(700);
check('onboarding dismissed', (await page.$('.sk-sidebar')) !== null);

// total count baseline
const baseline = await page.evaluate(() => {
  const txt = [...document.querySelectorAll('.sk-kv b')].map((e) => e.textContent).join('|');
  return txt;
});

// add expense
await page.click('.sk-sidebar [data-add]');
await wait(500);
await page.keyboard.type('25000');
await wait(200);
const amountText = await page.evaluate(() => document.querySelector('.sk-amount-value')?.textContent ?? '');
check('amount keypad types digits', amountText.replace(/\s/g, '').includes('25.000'), amountText);
await page.evaluate(() =>
  [...document.querySelectorAll('.astryx-dialog button')].find((b) => b.textContent?.trim() === 'Simpan')?.click(),
);
await wait(700);
check('dialog closes after save', (await page.$('.astryx-dialog[open]')) === null);
const firstRow = await page.evaluate(() => document.querySelector('.sk-row .sk-row-amount')?.textContent ?? '');
check('new expense appears at top', firstRow.replace(/\s/g, '').includes('25.000'), firstRow);

// navigate to transactions and filter
await page.click('.sk-sidebar [data-nav="transactions"]');
await wait(500);
const countText = await page.evaluate(() => document.querySelector('.sk-page-head .sk-sub')?.textContent ?? '');
check('transactions list renders', countText.includes('catatan'), countText);

// search filter
await page.evaluate(() => {
  const input = document.querySelector('input[type="search"]');
  if (input) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'nonton');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
});
await wait(500);
const filtered = await page.evaluate(() => document.querySelector('.sk-page-head .sk-sub')?.textContent ?? '');
check('search narrows results', filtered !== countText, filtered);

// open detail & delete
await page.evaluate(() => document.querySelector('.sk-row')?.click());
await wait(400);
check('detail dialog opens', (await page.$('.sk-detail-amount')) !== null);
await page.evaluate(() =>
  [...document.querySelectorAll('.astryx-dialog button')].find((b) => b.textContent?.trim() === 'Hapus')?.click(),
);
await wait(500);
check('delete closes dialog', (await page.$('.astryx-dialog[open]')) === null);

// PIN
await page.click('.sk-sidebar [data-nav="settings"]');
await wait(500);
await page.evaluate(() =>
  [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Pasang PIN')?.click(),
);
await wait(500);
const pw = await page.$$('input[type="password"]');
if (pw.length === 2) {
  await pw[0].type('1234');
  await pw[1].type('1234');
}
await page.evaluate(() =>
  [...document.querySelectorAll('.astryx-dialog button')].find((b) => b.textContent?.trim() === 'Aktifkan')?.click(),
);
await wait(500);
const pinActive = await page.evaluate(() => document.body.innerText.includes('Aktif'));
check('PIN saved', pinActive);

await page.reload({ waitUntil: 'networkidle0' });
await wait(600);
check('lock screen on reload', (await page.$('.sk-lock')) !== null);
for (const d of ['1', '2', '3', '4']) {
  await page.evaluate((digit) => {
    [...document.querySelectorAll('.sk-pin-pad .sk-key')].find((b) => b.textContent?.trim() === digit)?.click();
  }, d);
  await wait(120);
}
await wait(500);
check('unlock with correct PIN', (await page.$('.sk-lock')) === null);

// persistence
const persisted = await page.evaluate(() => localStorage.getItem('sekeping.state.v1'));
check('state persisted in localStorage', Boolean(persisted && persisted.length > 100));

// reports render chart
await page.click('.sk-sidebar [data-nav="reports"]');
await wait(900);
const svgCount = await page.evaluate(() => document.querySelectorAll('.recharts-surface').length);
check('reports charts render', svgCount >= 2, `${svgCount} charts`);

// debts page + payment dialog
await page.click('.sk-sidebar [data-nav="debts"]');
await wait(500);
await page.evaluate(() =>
  [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Bayar')?.click(),
);
await wait(400);
check('payment dialog opens', (await page.$('.astryx-dialog')) !== null);
await page.keyboard.press('Escape');

console.log(results.join('\n'));
console.log('\nPAGE ERRORS:', errors.length ? errors.join('\n') : 'none');
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
await browser.close();
process.exit(failed ? 1 : 0);
