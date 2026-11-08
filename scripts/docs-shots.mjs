import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE || 'http://127.0.0.1:4184/';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/chromium',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
});

async function ready(page) {
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.querySelector('[data-start="demo"]')?.click());
  await wait(900);
  await page.evaluate(() => {
    const skip = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('Lewati'));
    skip?.click();
  });
  await wait(500);
}

async function go(page, label) {
  await page.evaluate((name) => {
    const el = [...document.querySelectorAll('.astryx-side-nav button')].find((b) =>
      (b.textContent || '').trim().startsWith(name),
    );
    el?.click();
  }, label);
  await wait(800);
}

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 });
await ready(page);
await page.screenshot({ path: 'docs/dashboard.png' });

await go(page, 'Transaksi');
await page.screenshot({ path: 'docs/transactions.png' });

await go(page, 'Laporan');
await wait(500);
await page.screenshot({ path: 'docs/reports.png' });

await go(page, 'Anggaran');
await page.screenshot({ path: 'docs/budgets.png' });

await go(page, 'Rutin');
await page.screenshot({ path: 'docs/recurring.png' });

await page.click('.sk-add-wrap button');
await wait(700);
await page.evaluate(() => {
  const keys = [...document.querySelectorAll('.sk-key')];
  keys[0]?.click();
  keys[5]?.click();
  keys[8]?.click();
});
await wait(300);
await page.screenshot({ path: 'docs/add-transaction.png' });
await page.keyboard.press('Escape');

const m = await browser.newPage();
await m.setViewport({ width: 414, height: 896, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ready(m);
await m.screenshot({ path: 'docs/mobile.png' });

await m.evaluate(() => document.querySelector('[aria-label="Open navigation"]')?.click());
await wait(600);
await m.screenshot({ path: 'docs/mobile-drawer.png' });

await browser.close();
console.log('shots done');
