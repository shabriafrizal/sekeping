import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE || 'http://127.0.0.1:4180/';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/chromium',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
});

const bridge = (amountsHidden) => {
  window.SekepingWidget = {
    setAccounts: () => {},
    setSummary: () => {},
    ready: () => {},
    getWidgetConfig: () =>
      JSON.stringify({
        widgetId: 7,
        accountId: 'acc_cash',
        showExpense: true,
        showIncome: true,
        showTransfer: true,
        amountsHidden,
        size: new URLSearchParams(location.search).get('size') || '4x2',
      }),
    saveWidgetConfig: () => {},
    closeSheet: () => {},
    openApp: () => {},
    toast: () => {},
  };
};

async function openPage(amountsHidden) {
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(bridge, amountsHidden);
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.querySelector('[data-start="demo"]')?.click());
  await wait(900);
  return page;
}

const shown = await openPage(false);
for (const size of ['4x1', '4x2', '2x2']) {
  await shown.goto(`${BASE}?widget_config=7&size=${size}`, { waitUntil: 'networkidle0' });
  await wait(700);
  const stage = await shown.$('.skw-stage');
  if (!stage) throw new Error(`preview stage missing for ${size}`);
  await stage.screenshot({ path: `/data/tmp/sk-${size}.png` });
}
await shown.goto(`${BASE}?widget_config=7&size=4x2`, { waitUntil: 'networkidle0' });
await wait(700);
const dialog = await shown.$('dialog.astryx-dialog[open]');
if (dialog) await dialog.screenshot({ path: 'docs/widget.png' });

const hidden = await openPage(true);
for (const size of ['4x1', '4x2', '2x2']) {
  await hidden.goto(`${BASE}?widget_config=7&size=${size}`, { waitUntil: 'networkidle0' });
  await wait(700);
  const stage = await hidden.$('.skw-stage');
  await stage.screenshot({ path: `/data/tmp/sk-${size}-hidden.png` });
}

await browser.close();
console.log('wrote /data/tmp/sk-*.png and docs/widget.png');
