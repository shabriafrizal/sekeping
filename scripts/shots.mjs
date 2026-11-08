import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE || 'http://127.0.0.1:4180/';
const OUT = '/data/tmp';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/chromium',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--font-render-hinting=none'],
});

const errors = [];
function watch(p, tag) {
  p.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${tag} CONSOLE: ${m.text()}`);
  });
  p.on('pageerror', (e) => errors.push(`${tag} PAGEERROR: ${e.message}`));
}

const page = await browser.newPage();
watch(page, 'desktop');
await page.setViewport({ width: 1440, height: 1250 });
await page.goto(BASE, { waitUntil: 'networkidle0' });
await page.evaluate(() => {
  document.querySelector('[data-start="demo"]')?.click();
});
await wait(900);

async function go(nav) {
  await page.click(`.sk-sidebar [data-nav="${nav}"]`);
  await wait(650);
}

await page.screenshot({ path: `${OUT}/01-home.png`, fullPage: true });
await go('transactions');
await page.screenshot({ path: `${OUT}/02-transactions.png`, fullPage: true });
await go('reports');
await page.screenshot({ path: `${OUT}/03-reports.png`, fullPage: true });
await go('debts');
await page.screenshot({ path: `${OUT}/04-debts.png`, fullPage: true });
await go('settings');
await page.screenshot({ path: `${OUT}/05-settings.png`, fullPage: true });

// add transaction sheet
await page.click('.sk-sidebar [data-add]');
await wait(600);
await page.evaluate(() => {
  const keys = [...document.querySelectorAll('.sk-key')];
  keys[0]?.click();
  keys[1]?.click();
  keys[2]?.click();
});
await wait(300);
await page.screenshot({ path: `${OUT}/06-add.png` });
await page.keyboard.press('Escape');
await wait(400);

// transaction detail
await go('transactions');
await page.evaluate(() => document.querySelector('.sk-row')?.click());
await wait(500);
await page.screenshot({ path: `${OUT}/10-detail.png` });
await page.keyboard.press('Escape');
await wait(300);

// mobile
const m = await browser.newPage();
watch(m, 'mobile');
await m.setViewport({ width: 414, height: 896, isMobile: true, hasTouch: true });
await m.goto(BASE, { waitUntil: 'networkidle0' });
await m.evaluate(() => {
  document.querySelector('[data-start="demo"]')?.click();
});
await wait(900);
await m.screenshot({ path: `${OUT}/07-mobile-home.png`, fullPage: true });

await m.click('.sk-tabbar [data-nav="transactions"]');
await wait(600);
await m.screenshot({ path: `${OUT}/08-mobile-transactions.png`, fullPage: true });

await m.click('.sk-tabbar [data-nav="reports"]');
await wait(700);
await m.screenshot({ path: `${OUT}/11-mobile-reports.png`, fullPage: true });

await m.click('.sk-tabbar [data-add]');
await wait(600);
await m.evaluate(() => {
  const keys = [...document.querySelectorAll('.sk-key')];
  keys[0]?.click();
  keys[1]?.click();
  keys[2]?.click();
});
await wait(300);
await m.screenshot({ path: `${OUT}/09-mobile-add.png` });

console.log('ERRORS:', errors.length ? JSON.stringify(errors, null, 2) : 'none');
await browser.close();
