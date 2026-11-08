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

function installBridge() {
  window.__saved = null;
  window.__closed = 0;
  window.__toasts = [];
  window.__summary = null;
  window.SekepingWidget = {
    setAccounts: () => {},
    setSummary: (json) => {
      window.__summary = json;
    },
    ready: () => {},
    getWidgetConfig: () =>
      JSON.stringify({
        widgetId: 7,
        accountId: 'acc_cash',
        showExpense: true,
        showIncome: true,
        showTransfer: true,
        size: new URLSearchParams(location.search).get('size') || '4x1',
      }),
    saveWidgetConfig: (json) => {
      window.__saved = json;
    },
    closeSheet: () => {
      window.__closed += 1;
    },
    openApp: () => {},
    toast: (message) => {
      window.__toasts.push(message);
    },
  };
}

async function seededPage(context) {
  const page = await context.newPage();
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(installBridge);
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.querySelector('[data-start="demo"]')?.click());
  await wait(800);
  return page;
}

/* ------------------------------ config dialog ------------------------------ */
{
  const context = await browser.createBrowserContext();
  const page = await seededPage(context);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(`${BASE}?widget_config=7`, { waitUntil: 'networkidle0' });
  await wait(800);

  check('config opens as a native modal', (await page.evaluate(() => document.documentElement.dataset.native)) === 'config');
  check('Atur widget dialog is visible', (await page.$('dialog.astryx-dialog[open]')) !== null);
  check(
    'size comes from the launcher picker, not the config sheet',
    (await page.$$('.skw-tab')).length === 0 &&
      (await page.$('.skw-widget[data-size="4x1"]')) !== null &&
      (await page.evaluate(() => document.querySelector('.skw-size')?.textContent?.includes('4×1'))),
  );
  check(
    '4x1 preview shows balance, total and three icon-only actions',
    await page.evaluate(() => {
      const widget = document.querySelector('.skw-widget[data-size="4x1"]');
      const amounts = widget?.querySelectorAll('.skw-amounts b').length ?? 0;
      const labels = widget?.querySelectorAll('.skw-action-label').length ?? 0;
      const actions = widget?.querySelectorAll('.skw-action').length ?? 0;
      return Boolean(widget && amounts === 2 && labels === 0 && actions === 3);
    }),
  );

  for (const size of ['4x2', '2x2']) {
    await page.goto(`${BASE}?widget_config=7&size=${size}`, { waitUntil: 'networkidle0' });
    await wait(500);
    const label = size.replace('x', '×');
    check(
      `${size} widget previews its launcher size`,
      (await page.$(`.skw-widget[data-size="${size}"]`)) !== null &&
        (await page.evaluate((expected) => document.querySelector('.skw-size')?.textContent?.includes(expected) ?? false, label)),
    );
  }

  check('every account is selectable', (await page.$$('input[type="radio"]')).length === 3);
  check('three action switches are shown', (await page.$$('input[type="checkbox"]')).length === 3);
  check(
    'save row stays inside the sheet',
    await page.evaluate(() => {
      const save = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Simpan');
      if (!save) return false;
      const rect = save.getBoundingClientRect();
      return rect.bottom <= window.innerHeight && rect.top >= 0;
    }),
  );

  await page.evaluate(() => {
    const radios = [...document.querySelectorAll('input[type="radio"]')];
    radios[1]?.click();
    const switches = [...document.querySelectorAll('input[type="checkbox"]')];
    switches[2]?.click();
  });
  await wait(250);
  check(
    'turning a button off updates the preview',
    (await page.$$('.skw-widget .skw-action')).length === 2,
  );

  await page.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Simpan')?.click();
  });
  await wait(400);
  const saved = await page.evaluate(() => JSON.parse(window.__saved || 'null'));
  check('save writes the chosen account', saved?.accountId === 'acc_bank', saved?.accountId);
  check('save writes the hidden button', saved?.showTransfer === false, JSON.stringify(saved));
  check('config leaves no page errors', errors.length === 0, errors.join('; '));

  await context.close();
}

/* ------------------------------- quick-add sheet ---------------------------- */
{
  const context = await browser.createBrowserContext();
  const page = await seededPage(context);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(`${BASE}?sheet=expense&account=acc_bank`, { waitUntil: 'networkidle0' });
  await wait(800);

  check('sheet opens as a native modal', (await page.evaluate(() => document.documentElement.dataset.native)) === 'sheet');
  check('dashboard stays closed', (await page.evaluate(() => Boolean(document.querySelector('.astryx-app-shell')))) === false);
  check('transaction sheet is visible', (await page.$('dialog.astryx-dialog[open]')) !== null);
  check(
    'sheet starts on the requested type and account',
    await page.evaluate(() => {
      const subtitle = document.querySelector('.astryx-dialog-header')?.textContent ?? '';
      const selector = document.querySelector('.astryx-dialog')?.textContent ?? '';
      return subtitle.includes('Pengeluaran') && selector.includes('BCA');
    }),
  );
  check(
    'sheet is anchored to the bottom of the window',
    await page.evaluate(() => {
      const dialog = document.querySelector('dialog.astryx-dialog[open]');
      if (!dialog) return false;
      const rect = dialog.getBoundingClientRect();
      return Math.abs(rect.bottom - window.innerHeight) < 2;
    }),
  );

  await page.keyboard.type('25000');
  await wait(200);
  await page.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Simpan')?.click();
  });
  await wait(600);

  check('saving shows the native confirmation', (await page.evaluate(() => window.__toasts)).includes('Pengeluaran dicatat'));
  check('saving closes the sheet once', (await page.evaluate(() => window.__closed)) === 1);
  check(
    'the entry is persisted before closing',
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('sekeping.state.v1')).txs.some((t) => t.amount === 25000 && t.accountId === 'acc_bank'),
    ),
  );
  check(
    'the widget summary is refreshed',
    await page.evaluate(() => (() => { const s = JSON.parse(window.__summary || '{}'); return s.total?.startsWith('Rp ') && Array.isArray(s.accounts) && s.accounts.length > 0; })()),
  );
  check('sheet leaves no page errors', errors.length === 0, errors.join('; '));

  await context.close();
}

/* --------------------------- PIN gate inside the sheet --------------------- */
{
  const context = await browser.createBrowserContext();
  const page = await seededPage(context);
  await page.evaluate(() => {
    const key = 'sekeping.state.v1';
    const state = JSON.parse(localStorage.getItem(key));
    state.settings.pin = '1234';
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.goto(`${BASE}?sheet=income`, { waitUntil: 'networkidle0' });
  await wait(700);
  check('a locked sheet asks for the PIN first', (await page.$('.sk-lock')) !== null);
  check('the dashboard stays closed behind the PIN', (await page.evaluate(() => Boolean(document.querySelector('.astryx-app-shell')))) === false);
  await page.evaluate(() => {
    const keys = [...document.querySelectorAll('.sk-key')];
    for (const digit of ['1', '2', '3', '4']) keys.find((k) => k.textContent?.trim() === digit)?.click();
  });
  await wait(700);
  check('the sheet opens after unlocking', (await page.$('dialog.astryx-dialog[open]')) !== null);
  check(
    'it keeps the requested type',
    await page.evaluate(() => (document.querySelector('.astryx-dialog-header')?.textContent ?? '').includes('Pendapatan')),
  );
  await context.close();
}

await browser.close();
console.log(results.join('\n'));
const failed = results.filter((line) => line.startsWith('FAIL')).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
