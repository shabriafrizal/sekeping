import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE || 'http://localhost:4180/';
const TMP = process.env.TMP_DIR || '/data/tmp/opencode/sekeping-scan';
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = [];
function check(name, ok, extra = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

const now = new Date().toISOString();
const STATE = {
  version: 2,
  accounts: [
    { id: 'acc_bank', name: 'BCA', icon: 'bank', initial: 5_000_000, active: true },
    { id: 'acc_ewallet', name: 'GoPay', icon: 'phone', initial: 250_000, active: true },
    { id: 'acc_cash', name: 'Dompet', icon: 'cash', initial: 100_000, active: true },
  ],
  categories: [
    { id: 'cat_food', name: 'Makan & Minum', icon: 'bag', type: 'expense', active: true },
    { id: 'cat_bills', name: 'Tagihan', icon: 'bolt', type: 'expense', active: true },
    { id: 'cat_salary', name: 'Gaji', icon: 'briefcase', type: 'income', active: true },
  ],
  txs: [],
  debts: [],
  payments: [],
  recurring: [],
  budgets: [],
  settings: {
    userName: 'Test',
    language: 'id',
    currency: 'IDR',
    pin: null,
    onboarded: true,
    tourSeen: true,
    createdAt: 1,
    ai: { enabled: false, baseUrl: '', model: 'jev-1.13-free' },
  },
};

fs.mkdirSync(TMP, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/chromium',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
});

const errors = [];
const cdnRequests = [];

async function newPage(state) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1180, height: 940 });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    const url = request.url();
    if (/cdn\.jsdelivr|unpkg\.com|tessdata\.projectnaptha/.test(url)) cdnRequests.push(url);
  });
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.evaluate((nextState) => {
    localStorage.setItem('sekeping.state.v1', JSON.stringify(nextState));
  }, state);
  await page.reload({ waitUntil: 'networkidle0' });
  return page;
}

async function receiptFile(page, name = 'receipt.png', title = 'BUKTI TRANSFER', lines = [
  'Tanggal : 08/11/2026 14:35',
  'Dari    : BCA',
  'Ke      : GoPay',
  'Nominal Transfer : Rp 250.000',
  'Biaya admin      : Rp 2.500',
  'Total            : Rp 252.500',
  'Status           : Berhasil',
]) {
  const dataUrl = await page.evaluate((heading, bodyLines) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111111';
    ctx.textAlign = 'center';
    ctx.font = 'bold 38px "DejaVu Sans", sans-serif';
    ctx.fillText(heading, 500, 90);
    ctx.textAlign = 'left';
    ctx.font = '30px "DejaVu Sans", sans-serif';
    bodyLines.forEach((line, index) => ctx.fillText(line, 90, 190 + index * 60));
    return canvas.toDataURL('image/png');
  }, title, lines);
  const file = path.join(TMP, name);
  fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
  return file;
}

async function openScanner(page) {
  await page.click('.sk-add-wrap button');
  await page.waitForSelector('[data-testid="scan-open"]', { timeout: 5000 });
  await page.click('[data-testid="scan-open"]');
  await page.waitForSelector('[data-testid="scan-file"]', { timeout: 5000 });
}

async function uploadAndWait(page, file) {
  const input = await page.$('[data-testid="scan-file"]');
  await input.uploadFile(file);
  await page.waitForSelector('[data-testid="scan-review"]', { timeout: 90000 });
}

function inputValue(page, selector) {
  return page.evaluate((sel) => document.querySelector(sel)?.value ?? '', selector);
}

async function setInput(page, selector, value) {
  await page.evaluate(
    (sel, next) => {
      const input = document.querySelector(sel);
      if (!input) return;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, next);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    },
    selector,
    value,
  );
}

// ---------------------------------------------------------------------------
// 1. Local OCR → confirmation → manual correction → apply → save
// ---------------------------------------------------------------------------
const page = await newPage(STATE);
const file = await receiptFile(page);
await openScanner(page);
await uploadAndWait(page, file);

const review = await page.$('[data-testid="scan-review"]');
check('confirmation screen appears after the photo', review !== null);
const activeType = await page.evaluate(
  () => document.querySelector('[data-testid="scan-review"] .sk-type-btn[data-active="true"]')?.textContent?.trim() ?? '',
);
check('local OCR guesses transfer', activeType === 'Transfer', activeType);
const amount = await inputValue(page, '[data-testid="scan-review"] input[inputmode="decimal"]');
check('local OCR reads the transfer amount, not the admin total', amount === '250000', amount);
const rawText = await page.evaluate(
  () => document.querySelector('[data-testid="scan-review"] .sk-scan-raw pre')?.textContent ?? '',
);
check('OCR text is available for review', /TRANSFER/i.test(rawText) && /250\.000/.test(rawText), rawText.slice(0, 80).replace(/\n/g, ' '));
const confidence = await page.evaluate(
  () => document.querySelector('[data-testid="scan-review"] .sk-scan-confidence b')?.textContent ?? '',
);
check('confidence is shown', /%$/.test(confidence), confidence);

// Correct the amount by hand before applying.
await setInput(page, '[data-testid="scan-review"] input[inputmode="decimal"]', '260000');
await wait(200);
await page.evaluate(() =>
  [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Gunakan data')?.click(),
);
await wait(600);
const sheetAmount = await page.evaluate(() => document.querySelector('.sk-amount-value')?.textContent ?? '');
check('manual correction carries into the transaction form', sheetAmount.replace(/\s/g, '').includes('260.000'), sheetAmount);
const sheetType = await page.evaluate(
  () => document.querySelector('.sk-type-btn[data-active="true"]')?.textContent?.trim() ?? '',
);
check('scan applies the type to the form', sheetType === 'Transfer', sheetType);

await page.evaluate(() =>
  [...document.querySelectorAll('.astryx-dialog button')].find((button) => button.textContent?.trim() === 'Simpan')?.click(),
);
await wait(700);
const saved = await page.evaluate(() => {
  const state = JSON.parse(localStorage.getItem('sekeping.state.v1'));
  return state.txs.find((tx) => tx.amount === 260000 && tx.type === 'transfer');
});
check('saved transfer keeps the corrected amount and destination', Boolean(saved) && saved.toAccountId === 'acc_ewallet', saved ? `${saved.amount} → ${saved.toAccountId}` : 'not found');
check('OCR used bundled assets, not a CDN', cdnRequests.length === 0, cdnRequests.join(', '));

// ---------------------------------------------------------------------------
// 2. Expense receipt keeps merchant and category
// ---------------------------------------------------------------------------
const expensePage = await newPage(STATE);
const expenseFile = await receiptFile(expensePage, 'coffee.png', 'KOPI KENANGAN', [
  'Tanggal : 08/11/2026 09:12',
  'Kopi Susu Gula Aren  1 x 25.000',
  'Total : Rp 25.000',
  'Bayar : Rp 50.000',
  'Kembali : Rp 25.000',
]);
await openScanner(expensePage);
await uploadAndWait(expensePage, expenseFile);
const expenseType = await expensePage.evaluate(
  () => document.querySelector('[data-testid="scan-review"] .sk-type-btn[data-active="true"]')?.textContent?.trim() ?? '',
);
check('expense receipt is not mistaken for a transfer', expenseType === 'Pengeluaran', expenseType);
const expenseAmount = await inputValue(expensePage, '[data-testid="scan-review"] input[inputmode="decimal"]');
check('expense receipt reads the total, not cash paid', expenseAmount === '25000', expenseAmount);
const expenseNote = await expensePage.evaluate(
  () => document.querySelector('[data-testid="scan-review"] input[placeholder="Opsional"]')?.value ?? '',
);
check('expense receipt keeps the merchant name', /KOPI KENANGAN/i.test(expenseNote), expenseNote);
const expenseCategory = await expensePage.evaluate(() => {
  const review = document.querySelector('[data-testid="scan-review"]');
  const text = review?.textContent ?? '';
  return /Makan & Minum/i.test(text) ? 'Makan & Minum' : text.slice(0, 120);
});
check('expense receipt picks the food category', expenseCategory === 'Makan & Minum', expenseCategory);
await expensePage.close();

// ---------------------------------------------------------------------------
// 2. JEV check through a proxy → AI badge and mapped answers
// ---------------------------------------------------------------------------
const hosted = BASE.startsWith('https://');
if (!hosted) {
  const mock = {
    model: 'jev-mock',
    answers: {
      jenis: { type: 'choice', choice: 'transfer', confidence: 0.96 },
      sumber: { type: 'choice', choice: 'acc_bank', confidence: 0.95 },
      tujuan: { type: 'choice', choice: 'acc_ewallet', confidence: 0.94 },
      kategori: { type: 'choice', choice: 'tidak_tahu', confidence: 0.95 },
      yakin: { type: 'noul', noul: 0.96 },
    },
    cost: '0',
  };
  const proxy = spawn(process.execPath, ['scripts/jev-proxy.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      JEV_PROXY_PORT: '4199',
      JEV_MOCK: JSON.stringify(mock),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await wait(700);

  try {
    const aiState = {
      ...STATE,
      settings: {
        ...STATE.settings,
        ai: { enabled: true, baseUrl: 'http://127.0.0.1:4199', model: 'jev-1.13-free' },
      },
    };
    const aiPage = await newPage(aiState);
    await openScanner(aiPage);
    await uploadAndWait(aiPage, file);
    await aiPage.waitForFunction(
      () => document.querySelector('[data-testid="scan-review"] .sk-scan-badge[data-tone="ai"]') !== null,
      { timeout: 60000 },
    );
    const badge = await aiPage.evaluate(
      () => document.querySelector('[data-testid="scan-review"] .sk-scan-badge[data-tone="ai"]')?.textContent ?? '',
    );
    check('JEV badge names the model', /JEV/.test(badge) && /jev-mock/.test(badge), badge);
    const reason = await aiPage.evaluate(
      () => document.querySelector('[data-testid="scan-review"] .sk-scan-ai[data-tone="ok"]')?.textContent?.trim() ?? '',
    );
    check('JEV reason explains the destination', /BCA/.test(reason) && /GoPay/.test(reason), reason);
    const aiAmount = await inputValue(aiPage, '[data-testid="scan-review"] input[inputmode="decimal"]');
    check('JEV check keeps the locally read amount', aiAmount === '250000', aiAmount);

    // A user can still change the AI result before applying.
    await setInput(aiPage, '[data-testid="scan-review"] input[inputmode="decimal"]', '251000');
    await wait(200);
    await aiPage.evaluate(() =>
      [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Gunakan data')?.click(),
    );
    await wait(500);
    const aiSheetAmount = await aiPage.evaluate(() => document.querySelector('.sk-amount-value')?.textContent ?? '');
    check('AI result is editable before applying', aiSheetAmount.replace(/\s/g, '').includes('251.000'), aiSheetAmount);
    await aiPage.close();
  } finally {
    proxy.kill();
  }
} else {
  // A static host has no same-origin JEV proxy. The app must keep the local
  // result and explain why the AI check did not run.
  const aiState = {
    ...STATE,
    settings: {
      ...STATE.settings,
      ai: { enabled: true, baseUrl: '', model: 'jev-1.13-free' },
    },
  };
  const aiPage = await newPage(aiState);
  await openScanner(aiPage);
  await uploadAndWait(aiPage, file);
  await aiPage.waitForFunction(
    () => document.querySelector('[data-testid="scan-review"] .sk-scan-ai[data-tone="warn"]') !== null,
    { timeout: 60000 },
  );
  const warning = await aiPage.evaluate(
    () => document.querySelector('[data-testid="scan-review"] .sk-scan-ai[data-tone="warn"]')?.textContent?.trim() ?? '',
  );
  check('hosted build explains a blocked JEV check', /JEV/i.test(warning), warning);
  const fallbackAmount = await inputValue(aiPage, '[data-testid="scan-review"] input[inputmode="decimal"]');
  check('blocked JEV keeps the local scan usable', fallbackAmount === '250000', fallbackAmount);
  await aiPage.close();
}

check('no uncaught page errors', errors.length === 0, errors.join(' | '));

await browser.close();
console.log(results.join('\n'));
const failed = results.filter((line) => line.startsWith('FAIL')).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exitCode = failed > 0 ? 1 : 0;
