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

/* The host supplies the size the person picked in the launcher. */
await page.evaluateOnNewDocument(() => {
  window.SekepingWidget = {
    setAccounts: () => {},
    setSummary: () => {},
    ready: () => {},
    getWidgetConfig: () => {
      const size = new URLSearchParams(location.search).get('size') || '4x2';
      return JSON.stringify({
        widgetId: 7,
        accountId: 'acc_cash',
        showExpense: true,
        showIncome: true,
        showTransfer: true,
        size,
      });
    },
    saveWidgetConfig: () => {},
    closeSheet: () => {},
    openApp: () => {},
    toast: () => {},
  };
});

await page.goto(BASE, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.querySelector('[data-start="demo"]')?.click());
await wait(900);

const stages = ['4x1', '4x2', '2x2'];
for (const size of stages) {
  await page.goto(`${BASE}?widget_config=7&size=${size}`, { waitUntil: 'networkidle0' });
  await wait(700);
  await page.setViewport({ width: 412, height: 1200, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await wait(500);

  const stage = await page.$('.skw-stage');
  if (!stage) throw new Error('preview stage missing');
  await stage.screenshot({ path: `/data/tmp/sk-stage-${size}.png` });

  if (size === '4x2') {
    const dialog = await page.$('dialog.astryx-dialog[open]');
    if (!dialog) throw new Error('widget config dialog did not open');
    await dialog.screenshot({ path: 'docs/widget.png' });
  }
}

await browser.close();
console.log('wrote docs/widget.png and /data/tmp/sk-stage-*.png');
