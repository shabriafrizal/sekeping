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

// start screen + guided tour
check('start screen offers one way in', (await page.$('[data-start="demo"]')) !== null);
await page.click('[data-start="demo"]');
await wait(900);
check('start screen dismissed', (await page.$('.astryx-side-nav')) !== null);

async function nav(label) {
  const aliases = {
    Ringkasan: ['Ringkasan', 'Overview'],
    Transaksi: ['Transaksi', 'Transactions'],
    Laporan: ['Laporan', 'Reports'],
    Utang: ['Utang', 'Debt'],
    Rutin: ['Rutin', 'Recurring'],
    Anggaran: ['Anggaran', 'Budgets'],
    Pengaturan: ['Pengaturan', 'Settings'],
  };
  const names = aliases[label] ?? [label];
  const ok = await page.evaluate((wanted) => {
    const el = [...document.querySelectorAll('.astryx-side-nav button')].find((b) =>
      wanted.some((name) => (b.textContent || '').trim().startsWith(name)),
    );
    if (!el) return false;
    el.click();
    return true;
  }, names);
  await wait(650);
  return ok;
}
check('tour opens after start', (await page.$('.sk-tour-card')) !== null);
const firstStep = await page.evaluate(() => document.querySelector('.sk-tour-title')?.textContent ?? '');
await page.click('.sk-tour-primary');
await wait(250);
const secondStep = await page.evaluate(() => document.querySelector('.sk-tour-title')?.textContent ?? '');
check('tour moves to the next step', firstStep !== '' && secondStep !== '' && firstStep !== secondStep, `${firstStep} → ${secondStep}`);
await page.click('.sk-tour-skip');
await wait(250);
check('tour can be skipped', (await page.$('.sk-tour-card')) === null);
check(
  'tour is remembered',
  await page.evaluate(() => JSON.parse(localStorage.getItem('sekeping.state.v1')).settings.tourSeen === true),
);

// total count baseline
const baseline = await page.evaluate(() => {
  const txt = [...document.querySelectorAll('.sk-kv b')].map((e) => e.textContent).join('|');
  return txt;
});

// add expense
await page.click('.sk-add-wrap button');
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
await nav('Transaksi');
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
await nav('Pengaturan');
await wait(500);
await page.evaluate(() =>
  [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Pasang PIN')?.click(),
);
await wait(500);
// Only the open dialog's fields are laid out; closed ones stay in the DOM.
const pw = [];
for (const field of await page.$$('input[type="password"]')) {
  if (await field.boundingBox()) pw.push(field);
}
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
await nav('Laporan');
await wait(900);
const svgCount = await page.evaluate(() => document.querySelectorAll('.recharts-surface').length);
check('reports charts render', svgCount >= 2, `${svgCount} charts`);

// debts page + payment dialog
await nav('Utang');
await wait(500);
await page.evaluate(() =>
  [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Bayar')?.click(),
);
await wait(400);
check('payment dialog opens', (await page.$('.astryx-dialog')) !== null);
await page.keyboard.press('Escape');

/* ---------- optional time orders same-day transactions ---------- */
await page.evaluate(() => {
  const state = JSON.parse(localStorage.getItem('sekeping.state.v1'));
  const date = new Date().toISOString().slice(0, 10);
  const base = {
    type: 'expense',
    accountId: 'acc_cash',
    categoryId: 'cat_food',
    date,
    note: '',
    createdAt: Date.now(),
  };
  state.txs.push({ ...base, id: 't_early', amount: 1000, time: '08:00', note: 'Pagi' });
  state.txs.push({ ...base, id: 't_late', amount: 2000, time: '20:00', note: 'Malam' });
  state.settings.pin = null;
  localStorage.setItem('sekeping.state.v1', JSON.stringify(state));
});
await page.reload({ waitUntil: 'networkidle0' });
await wait(700);
await nav('Transaksi');
const sameDay = await page.evaluate(() =>
  [...document.querySelectorAll('.sk-row-meta')].map((el) => el.textContent || ''),
);
const lateIndex = sameDay.findIndex((text) => text.includes('Malam'));
const earlyIndex = sameDay.findIndex((text) => text.includes('Pagi'));
check(
  'same-day rows sort by time',
  lateIndex >= 0 && earlyIndex >= 0 && lateIndex < earlyIndex,
  `Malam #${lateIndex}, Pagi #${earlyIndex}`,
);

await page.evaluate(() => document.querySelector('[data-tour="add"] button')?.click());
await wait(500);
check(
  'entry form has an optional time field',
  await page.evaluate(() => Boolean(document.querySelector('input[type="time"]'))),
);
await page.keyboard.press('Escape');
await wait(300);

/* ---------- clearing all data uses an in-app dialog, not window.confirm ---------- */
await nav('Pengaturan');
await page.evaluate(() =>
  [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Hapus semua')?.click(),
);
await wait(400);
check(
  'clear-data asks with an in-app dialog',
  await page.evaluate(() => document.body.innerText.includes('Hapus semua data?')),
);
await page.evaluate(() => {
  const dialog = document.querySelector('.astryx-dialog[open]');
  [...(dialog?.querySelectorAll('button') ?? [])]
    .find((b) => b.textContent?.trim() === 'Hapus semua')
    ?.click();
});
await wait(700);
check(
  'clear-data empties the ledger',
  await page.evaluate(() => JSON.parse(localStorage.getItem('sekeping.state.v1')).txs.length === 0),
);

/* ---------- language and currency from the start screen ---------- */
async function choose(labelText, optionText) {
  const names = Array.isArray(labelText) ? labelText : [labelText];
  const listId = await page.evaluate((wanted) => {
    const label = [...document.querySelectorAll('label')].find((el) => wanted.includes(el.textContent));
    const combobox = label ? document.getElementById(label.getAttribute('for')) : null;
    combobox?.click();
    return combobox?.getAttribute('aria-controls') ?? '';
  }, names);
  await wait(120);
  await page.evaluate(
    ({ id, option }) => {
      const list = document.getElementById(id);
      [...(list?.querySelectorAll('[role="option"]') ?? [])]
        .find((item) => item.textContent?.includes(option))
        ?.click();
    },
    { id: listId, option: optionText },
  );
  await wait(120);
}

await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle0' });
await wait(400);
check(
  'start screen offers language and currency',
  await page.evaluate(() => document.querySelectorAll('.sk-start [role="combobox"]').length === 2),
);
await choose(['Bahasa', 'Language'], 'English');
await choose(['Mata uang', 'Currency'], 'USD');
const startSample = await page.evaluate(() => document.querySelector('.sk-start-sample')?.textContent?.trim() ?? '');
check(
  'start preview follows the chosen language and currency',
  startSample.includes('Sample') && startSample.includes('$ 1,234,567.00'),
  startSample,
);

await page.click('[data-start="demo"]');
await wait(900);
await page.evaluate(() => document.querySelector('.sk-tour-skip')?.click());
const startSettings = await page.evaluate(() => JSON.parse(localStorage.getItem('sekeping.state.v1')).settings);
check(
  'start choices survive onboarding',
  startSettings.onboarded && startSettings.language === 'en' && startSettings.currency === 'USD',
  JSON.stringify(startSettings),
);
const englishNav = await page.evaluate(() => document.querySelector('.astryx-top-nav')?.innerText ?? '');
check('currency applies across the app', /\$\s[\d,]+\.\d{2}/.test(englishNav), englishNav.split('\n')[1]);

await nav('Pengaturan');
await wait(400);
await choose(['Mata uang', 'Currency'], 'IDR');
const idrNav = await page.evaluate(() => document.querySelector('.astryx-top-nav')?.innerText ?? '');
check('currency changes without leaving Settings', /Rp\s/.test(idrNav), idrNav.split('\n')[1]);
await choose(['Bahasa', 'Language'], 'Bahasa Indonesia');
const localizedNav = await page.evaluate(() => document.querySelector('.astryx-top-nav')?.innerText ?? '');
check(
  'language changes without leaving Settings',
  /Rp\s[\d.]+/.test(localizedNav) && !localizedNav.includes(','),
  localizedNav.split('\n')[1],
);

/* Loading the demo ledger must not throw the person back to onboarding or
   reset the language/currency they just chose. */
await page.evaluate(() =>
  [...document.querySelectorAll('button')].find((b) => ['Muat data contoh', 'Load sample data'].includes(b.textContent?.trim() ?? ''))?.click(),
);
await wait(700);
const reloaded = await page.evaluate(() => ({
  settings: JSON.parse(localStorage.getItem('sekeping.state.v1')).settings,
  hasSettingsPage: Boolean(document.querySelector('.sk-page-head')),
}));
check(
  'loading demo keeps preferences and onboarding',
  reloaded.hasSettingsPage &&
    reloaded.settings.onboarded &&
    reloaded.settings.language === 'id' &&
    reloaded.settings.currency === 'IDR',
  JSON.stringify(reloaded.settings),
);

console.log(results.join('\n'));
console.log('\nPAGE ERRORS:', errors.length ? errors.join('\n') : 'none');
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
await browser.close();
process.exit(failed ? 1 : 0);
