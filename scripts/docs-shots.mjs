import puppeteer from 'puppeteer-core';

const BASE = 'http://127.0.0.1:4180/';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/chromium',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
});

async function ready(page) {
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.evaluate(() =>
    [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Lihat dengan data contoh'))?.click(),
  );
  await wait(1000);
}

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 });
await ready(page);
await page.screenshot({ path: 'docs/dashboard.png' });

await page.click('.sk-sidebar [data-nav="transactions"]');
await wait(700);
await page.screenshot({ path: 'docs/transactions.png' });

await page.click('.sk-sidebar [data-nav="reports"]');
await wait(900);
await page.screenshot({ path: 'docs/reports.png' });

await page.click('.sk-sidebar [data-nav="debts"]');
await wait(600);
await page.screenshot({ path: 'docs/debts.png' });

await page.click('.sk-sidebar [data-nav="home"]');
await wait(600);
await page.click('.sk-sidebar [data-add]');
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

await browser.close();
console.log('shots done');
