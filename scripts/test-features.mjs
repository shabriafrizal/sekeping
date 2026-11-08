import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE || 'http://127.0.0.1:4180/';
const TMP = process.env.TMP_DIR || '/data/tmp/opencode/sekeping-features';
const DOWNLOADS = path.join(TMP, 'downloads');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(name, ok, extra = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}
const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monthKey = (d) => iso(d).slice(0, 7);

const now = new Date();
const yesterday = new Date(now.getTime() - 86_400_000);
const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 15);
const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);

const STATE = {
  version: 2,
  accounts: [
    { id: 'acc_cash', name: 'Dompet', icon: 'cash', initial: 1_000_000, active: true },
    { id: 'acc_bank', name: 'Bank', icon: 'bank', initial: 5_000_000, active: true },
  ],
  categories: [
    { id: 'cat_food', name: 'Makan & Minum', icon: 'bag', type: 'expense', active: true },
    { id: 'cat_bills', name: 'Tagihan', icon: 'bolt', type: 'expense', active: true },
    { id: 'cat_salary', name: 'Gaji', icon: 'briefcase', type: 'income', active: true },
  ],
  txs: [
    {
      id: 'tx_prev',
      type: 'expense',
      amount: 50_000,
      accountId: 'acc_cash',
      categoryId: 'cat_food',
      date: iso(prevMonth),
      note: 'Makan bulan lalu',
      createdAt: 1,
    },
    {
      id: 'tx_now',
      type: 'expense',
      amount: 100_000,
      accountId: 'acc_cash',
      categoryId: 'cat_food',
      date: iso(now),
      note: 'Makan siang',
      createdAt: 2,
    },
  ],
  debts: [],
  payments: [],
  recurring: [
    {
      id: 'rec_1',
      name: 'Netflix',
      type: 'expense',
      amount: 54_000,
      accountId: 'acc_bank',
      categoryId: 'cat_bills',
      note: 'Langganan Netflix',
      interval: 'monthly',
      startDate: iso(start),
      nextDate: iso(yesterday),
      active: true,
      isSubscription: true,
      createdAt: 3,
    },
    {
      id: 'rec_3',
      name: 'Spotify',
      type: 'expense',
      amount: 49_000,
      accountId: 'acc_bank',
      categoryId: 'cat_bills',
      note: 'Langganan Spotify',
      interval: 'monthly',
      startDate: iso(start),
      nextDate: iso(new Date(now.getTime() + 3 * 86_400_000)),
      active: true,
      isSubscription: true,
      createdAt: 6,
    },
    {
      id: 'rec_2',
      name: 'Gaji',
      type: 'income',
      amount: 9_000_000,
      accountId: 'acc_bank',
      categoryId: 'cat_salary',
      note: 'Gaji bulanan',
      interval: 'monthly',
      startDate: iso(now),
      nextDate: iso(nextMonth),
      active: true,
      isSubscription: false,
      createdAt: 4,
    },
  ],
  budgets: [
    {
      id: 'bud_food',
      categoryId: 'cat_food',
      amount: 200_000,
      rollover: true,
      startMonth: monthKey(prevMonth),
      active: true,
      createdAt: 5,
    },
  ],
  settings: {
    userName: 'Tes',
    currency: 'IDR',
    pin: null,
    onboarded: true,
    tourSeen: true,
    createdAt: 0,
  },
};

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(DOWNLOADS, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/chromium',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.setViewport({ width: 1280, height: 900 });

const client = await page.createCDPSession();
await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DOWNLOADS });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
const seedScript = await page.evaluateOnNewDocument(
  (state) => localStorage.setItem('sekeping.state.v1', JSON.stringify(state)),
  STATE,
);
await page.goto(BASE, { waitUntil: 'networkidle0' });
await wait(900);
check('app hydrates from seeded state', (await page.$('.astryx-side-nav')) !== null);

/* ---------- keyboard: skip link is the first stop ---------- */
await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : null));
await page.keyboard.press('Tab');
const firstStop = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
check('first Tab reaches the skip link', firstStop.includes('Lewati') || firstStop.includes('Skip to content'), firstStop);

/* ---------- recurring auto-post ---------- */
const posted = await page.evaluate(() => JSON.parse(localStorage.getItem('sekeping.state.v1')));
check(
  'due recurring transaction posts on load',
  posted.txs.filter((t) => t.recurringId === 'rec_1').length === 1,
  `${posted.txs.length} tx`,
);
check(
  'next occurrence is advanced',
  posted.recurring.find((r) => r.id === 'rec_1')?.nextDate > iso(yesterday),
  posted.recurring.find((r) => r.id === 'rec_1')?.nextDate,
);

/* ---------- Ringkasan reminder, seven days before ---------- */
const reminderText = await page.evaluate(() => document.querySelector('.sk-reminders')?.innerText ?? '');
check('Ringkasan shows a due-soon reminder', reminderText.includes('Spotify'), reminderText.slice(0, 60));
check('reminder says how many days are left', reminderText.includes('3 hari'), reminderText);
check('reminder is labelled as a subscription', reminderText.includes('Langganan'), reminderText);
const homeBadge = await page.evaluate(
  () => {
    const el = [...document.querySelectorAll('.astryx-side-nav button')].find((b) =>
      (b.textContent || '').includes('Ringkasan'),
    );
    return el?.querySelector('.astryx-badge')?.textContent ?? '';
  },
);
check('menu shows the reminder count', homeBadge.trim() === '1', homeBadge);
const beforeDone = await page.evaluate(() => JSON.parse(localStorage.getItem('sekeping.state.v1')).txs.length);
await page.evaluate(() => document.querySelector('.sk-reminder-done')?.click());
await wait(700);
const afterDone = await page.evaluate(() => JSON.parse(localStorage.getItem('sekeping.state.v1')));
check(
  'marking done posts the expense today',
  afterDone.txs.some((t) => t.recurringId === 'rec_3' && t.date === iso(now)),
  `${beforeDone} → ${afterDone.txs.length}`,
);
check(
  'schedule advances after marking done',
  afterDone.recurring.find((r) => r.id === 'rec_3')?.nextDate > iso(now),
  afterDone.recurring.find((r) => r.id === 'rec_3')?.nextDate,
);
check('reminder disappears after marking done', (await page.$$('.sk-reminder-row')).length === 0);

await page.evaluate(() => {
  const el = [...document.querySelectorAll('.astryx-side-nav button')].find((b) => (b.textContent || '').includes('Rutin'));
  el?.click();
});
await wait(650);
await wait(500);
check('recurring page lists schedules', (await page.$$('.sk-rec-row')).length >= 2);
check('subscription is labelled', (await page.evaluate(() => document.body.innerText)).includes('Langganan'));
const beforePost = await page.evaluate(() => JSON.parse(localStorage.getItem('sekeping.state.v1')).txs.length);
await page.evaluate(() => document.querySelector('.sk-rec-post')?.click());
await wait(500);
const afterPost = await page.evaluate(() => JSON.parse(localStorage.getItem('sekeping.state.v1')).txs.length);
check('manual "Catat" posts one occurrence', afterPost === beforePost + 1, `${beforePost} → ${afterPost}`);

/* ---------- budgets with rollover ---------- */
await page.keyboard.press('g');
await page.keyboard.press('b');
await wait(500);
const budgetText = await page.evaluate(() => document.querySelector('.sk-budget-row')?.innerText ?? '');
check('budget page opens with g then b', budgetText.includes('Makan & Minum'), budgetText.slice(0, 40));
check('rollover carry is explained', budgetText.includes('termasuk sisa'), budgetText);
check('carry of 150k is shown', budgetText.includes('150.000'), budgetText);
check('remaining of 250k is shown', budgetText.includes('250.000'), budgetText);

/* ---------- reports: pick an exact from/to day ---------- */
await page.keyboard.press('g');
await page.keyboard.press('l');
await wait(600);
await page.evaluate(() =>
  [...document.querySelectorAll('.sk-chips button')].find((b) => b.textContent?.trim() === 'Rentang')?.click(),
);
await wait(400);
check('reports exposes a from/to range', (await page.$$('.sk-range input[type="date"]')).length === 2);
await page.evaluate((day) => {
  const inputs = [...document.querySelectorAll('.sk-range input[type="date"]')];
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  for (const input of inputs) {
    setter.call(input, day);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
}, iso(now));
await wait(600);
const kpis = await page.evaluate(() =>
  [...document.querySelectorAll('.sk-kpis .sk-kpi')].map((el) => el.innerText.trim()),
);
check('custom range filters to the chosen day', kpis[0]?.includes('149.000'), kpis[0]);
check('custom range counts only that day', /\b2\b/.test(kpis[1] ?? ''), kpis[1]);
const reportSub = await page.evaluate(() => document.querySelector('.sk-page-head .sk-sub')?.textContent ?? '');
check('report header shows the exact range', reportSub.includes('1 hari'), reportSub);

/* ---------- report presets: hari ini → semua ---------- */
async function pickPeriod(label) {
  await page.evaluate(
    (l) => [...document.querySelectorAll('.sk-chips button')].find((b) => b.textContent?.trim() === l)?.click(),
    label,
  );
  await wait(500);
  return page.evaluate(() =>
    [...document.querySelectorAll('.sk-kpis .sk-kpi')].map((el) => el.innerText.trim()),
  );
}
const todayKpi = await pickPeriod('Hari ini');
check('Hari ini preset keeps today only', todayKpi[0]?.includes('149.000') && /\b2\b/.test(todayKpi[1] ?? ''), todayKpi.join(' | '));
const yesterdayKpi = await pickPeriod('Kemarin');
check('Kemarin preset picks yesterday', yesterdayKpi[0]?.includes('54.000') && /\b1\b/.test(yesterdayKpi[1] ?? ''), yesterdayKpi.join(' | '));
const weekKpi = await pickPeriod('7 hari');
check('7 hari preset spans a week', weekKpi[0]?.includes('203.000') && /\b3\b/.test(weekKpi[1] ?? ''), weekKpi.join(' | '));
const weekSub = await page.evaluate(() => document.querySelector('.sk-page-head .sk-sub')?.textContent ?? '');
check('7 hari header states the span', weekSub.includes('7 hari'), weekSub);
await page.evaluate(
  () => [...document.querySelectorAll('.sk-chips button')].find((b) => b.textContent?.trim() === 'Rentang')?.click(),
);
await wait(400);
const continued = await page.evaluate(() =>
  [...document.querySelectorAll('.sk-range input[type="date"]')].map((el) => el.value),
);
check(
  'Rentang continues from the chosen preset',
  continued[0] === iso(new Date(now.getTime() - 6 * 86_400_000)) && continued[1] === iso(now),
  continued.join(' → '),
);
const lastMonthKpi = await pickPeriod('Bulan lalu');
check('Bulan lalu preset uses the previous month', lastMonthKpi[0]?.includes('50.000') && /\b1\b/.test(lastMonthKpi[1] ?? ''), lastMonthKpi.join(' | '));
const quarterKpi = await pickPeriod('3 bulan');
check('3 bulan preset includes the quarter', quarterKpi[0]?.includes('253.000') && /\b4\b/.test(quarterKpi[1] ?? ''), quarterKpi.join(' | '));
const yearKpi = await pickPeriod('1 tahun');
check('1 tahun preset includes the last year', yearKpi[0]?.includes('253.000') && /\b4\b/.test(yearKpi[1] ?? ''), yearKpi.join(' | '));
const allKpi = await pickPeriod('Semua');
check('Semua preset includes future-posted items', allKpi[0]?.includes('307.000') && /\b5\b/.test(allKpi[1] ?? ''), allKpi.join(' | '));

/* ---------- shortcut sheet ---------- */
await page.keyboard.press('?');
await wait(400);
check('? opens the shortcut sheet', (await page.$('.sk-shortcuts')) !== null);
await page.keyboard.press('Escape');
await wait(400);
check(
  'Escape closes the shortcut sheet',
  (await page.$('.astryx-dialog[open] .sk-shortcuts')) === null,
);

/* ---------- n opens the transaction sheet ---------- */
await page.keyboard.press('n');
await wait(400);
check('n opens a new expense', (await page.$('.astryx-dialog[open] .sk-amount-value')) !== null);
await page.keyboard.press('Escape');
await wait(300);

/* ---------- alt+number navigation ---------- */
await page.keyboard.down('Alt');
await page.keyboard.press('2');
await page.keyboard.up('Alt');
await wait(400);
const txActive = await page.evaluate(
  () => {
    const el = [...document.querySelectorAll('.astryx-side-nav button')].find((b) =>
      (b.textContent || '').includes('Transaksi'),
    );
    return el?.getAttribute('aria-current') ?? el?.getAttribute('data-selected') ?? '';
  },
);
check('Alt+2 jumps to transactions', txActive === 'page', txActive);

/* ---------- CSV import ---------- */
const csvPath = path.join(TMP, 'import.csv');
const csv = [
  'Tanggal,Jenis,Kategori,Rekening,Jumlah,Catatan',
  `${iso(now)},Pengeluaran,Makan & Minum,Dompet,30000,Bakso`,
  `${iso(now)},Pendapatan,Gaji,Bank,1000000,Bonus proyek`,
].join('\r\n');
fs.writeFileSync(csvPath, csv, 'utf8');

await page.keyboard.press('g');
await page.keyboard.press('i');
await wait(500);
const importTitle = await page.evaluate(() => document.querySelector('.sk-page-head .sk-title')?.textContent ?? '');
check('import page opens with g then i', importTitle === 'Impor CSV', importTitle);
const input = await page.$('.sk-page input[type="file"]');
await input.uploadFile(csvPath);
await wait(700);
check('CSV preview renders', (await page.$('.sk-table')) !== null);
const previewSub = await page.evaluate(() => document.querySelector('.sk-page-head .sk-sub')?.textContent ?? '');
const ready = await page.evaluate(() => document.querySelector('.sk-card .sk-badge[data-tone="success"]')?.textContent ?? '');
check('two rows are ready to import', ready.includes('2'), `${ready} · ${previewSub}`);
const beforeImport = await page.evaluate(() => JSON.parse(localStorage.getItem('sekeping.state.v1')).txs.length);
await page.evaluate(() =>
  [...document.querySelectorAll('button')]
    .find((b) => b.textContent?.trim().startsWith('Impor 2 transaksi'))
    ?.click(),
);
await wait(800);
const afterImport = await page.evaluate(() => JSON.parse(localStorage.getItem('sekeping.state.v1')));
check('import adds the mapped transactions', afterImport.txs.length === beforeImport + 2, `${beforeImport} → ${afterImport.txs.length}`);
check(
  'imported rows keep category and account names',
  afterImport.txs.some((t) => t.note === 'Bakso' && t.categoryId === 'cat_food' && t.accountId === 'acc_cash'),
);

/* ---------- encrypted export & restore ---------- */
await page.keyboard.press('g');
await page.keyboard.press('s');
await wait(500);
await page.evaluate(() =>
  [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Ekspor terenkripsi')?.click(),
);
await wait(500);
const pwInputs = await page.$$('.astryx-dialog[open] input[type="password"]');
check('encrypted export dialog opens', pwInputs.length === 2, `${pwInputs.length} fields`);
if (pwInputs.length === 2) {
  await pwInputs[0].type('rahasia123');
  await pwInputs[1].type('rahasia123');
}
await page.evaluate(() =>
  [...document.querySelectorAll('.astryx-dialog[open] button')]
    .find((b) => b.textContent?.includes('Unduh terenkripsi'))
    ?.click(),
);
let encryptedFile = '';
for (let i = 0; i < 40 && !encryptedFile; i++) {
  await wait(150);
  const files = fs.readdirSync(DOWNLOADS).filter((f) => f.endsWith('.sekeping'));
  if (files.length) encryptedFile = path.join(DOWNLOADS, files[0]);
}
check('encrypted backup downloads', Boolean(encryptedFile), encryptedFile);
if (encryptedFile) {
  const raw = fs.readFileSync(encryptedFile, 'utf8');
  const envelope = JSON.parse(raw);
  check('backup uses the encrypted envelope', envelope.format === 'sekeping-encrypted' && envelope.cipher?.name === 'AES-GCM');
  check('backup does not leak plaintext', !raw.includes('Dompet') && !raw.includes('Makan & Minum'));

  const restoreInput = await page.$('input[accept*="sekeping"]');
  await restoreInput.uploadFile(encryptedFile);
  await wait(500);
  const unlockInputs = await page.$$('.astryx-dialog[open] input[type="password"]');
  check('encrypted file asks for its password', unlockInputs.length === 1);
  if (unlockInputs.length === 1) {
    await unlockInputs[0].type('salah-sekali');
    await page.evaluate(() =>
      [...document.querySelectorAll('.astryx-dialog[open] button')]
        .find((b) => b.textContent?.trim() === 'Pulihkan')
        ?.click(),
    );
    await wait(900);
    check(
      'wrong password is rejected',
      (await page.evaluate(() => document.body.innerText)).includes('Kata sandi salah'),
    );
    const stillOpen = await page.$$('.astryx-dialog[open] input[type="password"]');
    if (stillOpen.length === 1) {
      await stillOpen[0].click({ clickCount: 3 });
      await stillOpen[0].type('rahasia123');
      await page.evaluate(() =>
        [...document.querySelectorAll('.astryx-dialog[open] button')]
          .find((b) => b.textContent?.trim() === 'Pulihkan')
          ?.click(),
      );
      await wait(900);
      check(
        'correct password restores the backup',
        (await page.evaluate(() => document.body.innerText)).includes('Cadangan dipulihkan'),
      );
    } else {
      check('correct password restores the backup', false, 'unlock dialog closed early');
    }
  }
}

console.log(results.join('\n'));
console.log('\nPAGE ERRORS:', errors.length ? errors.join('\n') : 'none');
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
await browser.close();
process.exit(failed ? 1 : 0);
