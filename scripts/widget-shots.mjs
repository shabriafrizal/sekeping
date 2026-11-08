import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE || 'http://127.0.0.1:4180/';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/chromium',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
});

const page = await browser.newPage();
await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(BASE, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.querySelector('[data-start="demo"]')?.click());
await wait(900);

await page.goto(`${BASE}?widget_config=7`, { waitUntil: 'networkidle0' });
await wait(700);
await page.setViewport({ width: 412, height: 1200, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await wait(500);

const dialog = await page.$('dialog.astryx-dialog[open]');
if (!dialog) throw new Error('widget config dialog did not open');
await dialog.screenshot({ path: 'docs/widget.png' });

const stages = ['4x1', '4x2', '2x2'];
for (let i = 0; i < stages.length; i++) {
  await page.evaluate((index) => document.querySelectorAll('.skw-tab')[index]?.click(), i);
  await wait(350);
  const stage = await page.$('.skw-stage');
  if (!stage) throw new Error('preview stage missing');
  await stage.screenshot({ path: `/data/tmp/sk-stage-${stages[i]}.png` });
}

await browser.close();
console.log('wrote docs/widget.png and /data/tmp/sk-stage-*.png');
