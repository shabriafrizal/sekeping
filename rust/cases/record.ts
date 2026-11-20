/**
 * Records the TypeScript reference behaviour into `golden.json`.
 *
 * Run from the repository root:
 *   npx esbuild rust/cases/record.ts --bundle --platform=node --format=esm \
 *     --outfile=/tmp/sekeping-record.mjs && node /tmp/sekeping-record.mjs
 *
 * The Rust port reads this file in `crates/sekeping-core/tests/golden.rs`.
 * Receipt parsing is covered by Rust unit tests instead: the TypeScript version
 * has two confirmed bugs (day-first dates above the 12th and destination
 * detection) that the port deliberately fixes.
 */
process.env.TZ = 'UTC';

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import {
  setFormatPreferences,
  money,
  compactMoney,
  compactNumber,
  plainNumber,
  parseAmountInput,
  initials,
  addMonths,
  monthRange,
  daysBetween,
  monthKey,
  txSortValue,
} from '../../src/lib/format';
import { monthsBetween, budgetProgress, toneFor } from '../../src/lib/budgets';
import { advanceDate, dueDates, isDue, monthlyEquivalent, daysUntilNext, initialNextDate } from '../../src/lib/recurring';
import { parseCsv, guessMapping, parseDateValue, parseAmountValue, buildImport } from '../../src/lib/csv';
import { encryptJson } from '../../src/lib/crypto';

const output = resolve(process.cwd(), 'rust/cases/golden.json');

const moneyCases: unknown[] = [];
const datesCases: unknown[] = [];
const budgetCases: unknown[] = [];
const recurringCases: unknown[] = [];
const csvCases: unknown[] = [];
const cryptoCases: unknown[] = [];

const values = [0, 1, 12.5, 999, 1000, 1234.56, 25000, 1500000, 123456789.9, -2500];
const currencies = ['IDR', 'USD', 'EUR'];
const languages = ['id', 'en'];
for (const language of languages) {
  for (const currency of currencies) {
    setFormatPreferences(language, currency);
    for (const value of values) {
      moneyCases.push({
        language,
        currency,
        value,
        money: money(value),
        compactMoney: compactMoney(value),
        compactNumber: compactNumber(value),
        plainNumber: plainNumber(value),
      });
    }
  }
}

for (const [language, currency] of [
  ['id', 'IDR'],
  ['en', 'USD'],
] as const) {
  setFormatPreferences(language, currency);
  for (const raw of ['Rp 25.000', '25.000,50', '1,234.56', '25000', '-15.000', '1.234.567', '', 'abc', '12,5', '0,5']) {
    moneyCases.push({ language, currency, parse: raw, parsed: parseAmountInput(raw) });
  }
}
for (const name of ['Cash', 'Bank BCA', '  ', 'dompet utama', 'A']) {
  moneyCases.push({ initials: name, value: initials(name) });
}

for (const [iso, delta] of [
  ['2026-01-31', 1],
  ['2024-02-29', 12],
  ['2026-11-20', -1],
  ['2025-12-01', 2],
  ['2026-03-31', -2],
] as const) {
  datesCases.push({ addMonths: iso, delta, result: addMonths(iso, delta) });
}
for (const iso of ['2026-02-10', '2024-02-10', '2026-12-31', '2026-01-01']) {
  datesCases.push({ monthRange: iso, result: monthRange(iso) });
}
for (const [a, b] of [
  ['2026-01-01', '2026-01-31'],
  ['2025-12-31', '2026-01-01'],
  ['2026-03-01', '2026-02-01'],
]) {
  datesCases.push({ daysBetween: [a, b], result: daysBetween(a, b) });
}
for (const iso of ['2026-11-20', '2026-01-01T10:00:00', 'bad']) {
  datesCases.push({ monthKey: iso, result: monthKey(iso) });
}
for (const [date, time] of [
  ['2026-11-20', '09:30'],
  ['2026-11-20', undefined],
  ['2026-11-19', '23:59'],
] as const) {
  datesCases.push({ txSortValue: { date, time }, result: txSortValue({ date, time }) });
}

for (const [start, end] of [
  ['2025-11', '2026-03'],
  ['2026-01', '2026-01'],
  ['2026-03', '2026-01'],
] as const) {
  budgetCases.push({ monthsBetween: [start, end], result: monthsBetween(start, end) });
}

const budgetTxs = [
  { id: 't1', type: 'expense', amount: 100, accountId: 'a', categoryId: 'food', date: '2026-09-10', note: '' },
  { id: 't2', type: 'expense', amount: 300, accountId: 'a', categoryId: 'food', date: '2026-10-05', note: '' },
  { id: 't3', type: 'expense', amount: 50, accountId: 'a', categoryId: 'food', date: '2026-11-02', note: '' },
  { id: 't4', type: 'income', amount: 999, accountId: 'a', categoryId: 'food', date: '2026-11-03', note: '' },
  { id: 't5', type: 'expense', amount: 70, accountId: 'a', categoryId: 'travel', date: '2026-11-04', note: '' },
];
const category = { id: 'food', name: 'Food', icon: 'bag', type: 'expense', active: true };
for (const rollover of [true, false]) {
  for (const month of ['2026-08', '2026-09', '2026-10', '2026-11']) {
    const budget = { id: 'b1', categoryId: 'food', amount: 200, rollover, startMonth: '2026-09', active: true };
    const progress = budgetProgress(budget, budgetTxs as never, month, category as never);
    budgetCases.push({
      rollover,
      month,
      budget,
      category,
      progress,
      tone: toneFor(progress),
    });
  }
}

const recurringItems = [
  {
    id: 'r1',
    name: 'Rent',
    type: 'expense',
    amount: 1000,
    accountId: 'a',
    interval: 'monthly',
    startDate: '2026-01-31',
    nextDate: '2026-01-31',
    active: true,
    isSubscription: false,
    createdAt: 0,
  },
  {
    id: 'r2',
    name: 'Weekly',
    type: 'expense',
    amount: 50,
    accountId: 'a',
    interval: 'weekly',
    startDate: '2026-11-01',
    nextDate: '2026-11-01',
    active: true,
    isSubscription: true,
    createdAt: 0,
  },
  {
    id: 'r3',
    name: 'Old',
    type: 'expense',
    amount: 20,
    accountId: 'a',
    interval: 'monthly',
    startDate: '2026-01-01',
    nextDate: '2026-01-01',
    endDate: '2026-03-01',
    active: true,
    isSubscription: false,
    createdAt: 0,
  },
] as never[];
for (const item of recurringItems as never as Array<Record<string, unknown>>) {
  for (const today of ['2026-11-20', '2026-03-15', '2026-01-15']) {
    recurringCases.push({
      id: item.id,
      item,
      today,
      due: dueDates(item as never, today),
      isDue: isDue(item as never, today),
      monthly: monthlyEquivalent(item as never),
      days: daysUntilNext(item as never, today),
    });
  }
}
for (const [start, interval] of [
  ['2026-01-31', 'monthly'],
  ['2026-11-20', 'weekly'],
  ['2024-02-29', 'yearly'],
] as const) {
  recurringCases.push({
    initialNextDate: [start, interval, '2026-11-20'],
    result: initialNextDate(start, interval as never, '2026-11-20'),
  });
  for (const date of ['2026-01-31', '2024-02-29', '2026-12-31']) {
    recurringCases.push({ advanceDate: [date, interval], result: advanceDate(date, interval as never) });
  }
}

const csvTexts = [
  'date,amount,note\n2026-01-02,25000,Coffee\n2026-01-03,-15000,Refund\n',
  'Tanggal;Jumlah;Keterangan\n02/01/2026;"25.000";"Kopi, susu"\n03/01/2026;"1.500.000";Gaji\n',
  '\ufeff"date","amount","note"\r\n"2026-02-01","1000","multi\nline"\r\n',
  'a,b\n1,2\n\n3,4\n',
];
for (const text of csvTexts) {
  const table = parseCsv(text);
  csvCases.push({ parseCsv: text, table, mapping: guessMapping(table.headers) });
}
for (const [raw, format] of [
  ['2026-01-02', 'auto'],
  ['02/01/2026', 'auto'],
  ['02/01/2026', 'dmy'],
  ['01/02/2026', 'mdy'],
  ['2026/1/2', 'auto'],
  ['2 Jan 2026', 'auto'],
  ['nope', 'auto'],
] as const) {
  csvCases.push({ parseDateValue: [raw, format], result: parseDateValue(raw, format) });
}
for (const raw of ['25.000', '1,234.56', '1.234.567', '-15.000', '(12.500)', 'Rp 25.000', '0,5', '12.5']) {
  csvCases.push({ parseAmountValue: raw, result: parseAmountValue(raw) });
}

const importTable = parseCsv('date,amount,type,account,category,note\n2026-01-02,25000,expense,Cash,Food,Coffee\n2026-01-03,-15000,,Cash,Food,Refund\nbad,oops,,Cash,Food,Broken\n2026-01-02,25000,expense,Cash,Food,Coffee\n');
const importMapping = guessMapping(importTable.headers);
const importExisting = [
  { id: 'x', type: 'expense', amount: 25000, accountId: 'a', categoryId: 'food', date: '2026-01-02', note: 'Coffee' },
] as never[];
for (const options of [
  { type: 'expense', dateFormat: 'auto', inferSign: true, dedupe: true },
  { type: 'expense', dateFormat: 'auto', inferSign: false, dedupe: false },
] as const) {
  csvCases.push({
    buildImport: options,
    preview: buildImport(importTable, importMapping, options as never, importExisting),
  });
}

// Cross-language crypto fixtures. Both directions are asserted from Rust.
const cryptoPayload = '{"version":2,"txs":[{"id":"t","amount":25000}]}';
const envelope = JSON.parse(await encryptJson(JSON.parse(cryptoPayload), 'correct horse battery'));
cryptoCases.push({ payload: cryptoPayload, password: 'correct horse battery', envelope });
cryptoCases.push({ envelope, password: 'wrong password', error: true });

const golden = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  money: moneyCases,
  dates: datesCases,
  budgets: budgetCases,
  recurring: recurringCases,
  csv: csvCases,
  crypto: cryptoCases,
};

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(golden, null, 2));
console.log(`wrote ${output}: ${moneyCases.length} money, ${datesCases.length} dates, ${budgetCases.length} budgets, ${recurringCases.length} recurring, ${csvCases.length} csv, ${cryptoCases.length} crypto`);
