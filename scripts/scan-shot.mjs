import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE || 'http://localhost:4180/';
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const state = {
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
    userName: 'Kamu',
    language: 'id',
    currency: 'IDR',
    pin: null,
    onboarded: true,
    tourSeen: true,
    createdAt: 1,
    ai: { enabled: false, baseUrl: '', model: 'jev-1.13-free' },
  },
};

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/chromium',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 2 });
await page.goto(BASE, { waitUntil: 'networkidle0' });
await page.evaluate((nextState) => {
  localStorage.setItem('sekeping.state.v1', JSON.stringify(nextState));
}, state);
await page.reload({ waitUntil: 'networkidle0' });

const dataUrl = await page.evaluate(() => {
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fdfbf6';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#111111';
  ctx.textAlign = 'center';
  ctx.font = 'bold 38px "DejaVu Sans", sans-serif';
  ctx.fillText('BUKTI TRANSFER', 500, 90);
  ctx.textAlign = 'left';
  ctx.font = '30px "DejaVu Sans", sans-serif';
  [
    'Tanggal : 08/11/2026 14:35',
    'Dari    : BCA',
    'Ke      : GoPay',
    'Nominal Transfer : Rp 250.000',
    'Biaya admin      : Rp 2.500',
    'Total            : Rp 252.500',
    'Status           : Berhasil',
  ].forEach((line, index) => ctx.fillText(line, 90, 190 + index * 60));
  return canvas.toDataURL('image/png');
});
const tmp = process.env.TMP_DIR || '/data/tmp/opencode/sekeping-scan';
fs.mkdirSync(tmp, { recursive: true });
const file = path.join(tmp, 'receipt-docs.png');
fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));

await page.click('.sk-add-wrap button');
await page.waitForSelector('[data-testid="scan-open"]');
await page.click('[data-testid="scan-open"]');
await page.waitForSelector('[data-testid="scan-file"]');
const input = await page.$('[data-testid="scan-file"]');
await input.uploadFile(file);
await page.waitForSelector('[data-testid="scan-review"]', { timeout: 90000 });
await wait(600);
await page.screenshot({ path: 'docs/scan.png' });

await browser.close();
console.log('scan screenshot written to docs/scan.png');
