import type { AppState, Category, Account, Tx, Debt, Recurring, Budget } from './types';
import { uid } from './types';
import { monthKey, toISO, todayISO } from './format';
import { initialNextDate } from './recurring';
import { shiftMonth } from './budgets';

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISO(d);
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'acc_cash', name: 'Dompet', icon: 'cash', initial: 6_800_000, active: true },
  { id: 'acc_bank', name: 'BCA', icon: 'bank', initial: 12_400_000, active: true },
  { id: 'acc_ewallet', name: 'GoPay', icon: 'phone', initial: 3_600_000, active: true },
];

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat_food', name: 'Makan & Minum', icon: 'bag', type: 'expense', active: true },
  { id: 'cat_transport', name: 'Transport', icon: 'truck', type: 'expense', active: true },
  { id: 'cat_bills', name: 'Tagihan', icon: 'bolt', type: 'expense', active: true },
  { id: 'cat_shopping', name: 'Belanja', icon: 'cart', type: 'expense', active: true },
  { id: 'cat_home', name: 'Rumah', icon: 'home', type: 'expense', active: true },
  { id: 'cat_health', name: 'Kesehatan', icon: 'heart', type: 'expense', active: true },
  { id: 'cat_fun', name: 'Hiburan', icon: 'film', type: 'expense', active: true },
  { id: 'cat_edu', name: 'Pendidikan', icon: 'cap', type: 'expense', active: true },
  { id: 'cat_gift', name: 'Hadiah', icon: 'gift', type: 'expense', active: true },
  { id: 'cat_salary', name: 'Gaji', icon: 'briefcase', type: 'income', active: true },
  { id: 'cat_bonus', name: 'Bonus', icon: 'sparkles', type: 'income', active: true },
  { id: 'cat_invest', name: 'Hasil Investasi', icon: 'pie', type: 'income', active: true },
  { id: 'cat_other_in', name: 'Pemasukan Lain', icon: 'wallet', type: 'income', active: true },
];

const expensePlan: Array<{ cat: string; note: string; min: number; max: number; weight: number }> = [
  { cat: 'cat_food', note: 'Nasi padang', min: 18_000, max: 45_000, weight: 16 },
  { cat: 'cat_food', note: 'Kopi susu', min: 18_000, max: 32_000, weight: 12 },
  { cat: 'cat_food', note: 'Belanja bulanan', min: 180_000, max: 420_000, weight: 4 },
  { cat: 'cat_food', note: 'Makan malam keluarga', min: 120_000, max: 260_000, weight: 3 },
  { cat: 'cat_transport', note: 'Gojek ke kantor', min: 18_000, max: 42_000, weight: 10 },
  { cat: 'cat_transport', note: 'Isi bensin', min: 90_000, max: 160_000, weight: 4 },
  { cat: 'cat_transport', note: 'Parkir', min: 3_000, max: 10_000, weight: 5 },
  { cat: 'cat_bills', note: 'Listrik & air', min: 240_000, max: 390_000, weight: 2 },
  { cat: 'cat_bills', note: 'Internet fiber', min: 320_000, max: 320_000, weight: 1 },
  { cat: 'cat_bills', note: 'Pulsa & paket data', min: 60_000, max: 120_000, weight: 2 },
  { cat: 'cat_shopping', note: 'Baju kerja', min: 150_000, max: 450_000, weight: 2 },
  { cat: 'cat_shopping', note: 'Perlengkapan rumah', min: 60_000, max: 240_000, weight: 2 },
  { cat: 'cat_home', note: 'Perbaikan keran', min: 120_000, max: 280_000, weight: 1 },
  { cat: 'cat_health', note: 'Vitamin & obat', min: 45_000, max: 180_000, weight: 2 },
  { cat: 'cat_health', note: 'Olahraga', min: 50_000, max: 120_000, weight: 2 },
  { cat: 'cat_fun', note: 'Nonton bioskop', min: 45_000, max: 90_000, weight: 2 },
  { cat: 'cat_fun', note: 'Langganan musik', min: 54_000, max: 54_000, weight: 1 },
  { cat: 'cat_edu', note: 'Kelas online', min: 150_000, max: 350_000, weight: 1 },
  { cat: 'cat_gift', note: 'Kado ulang tahun', min: 100_000, max: 300_000, weight: 1 },
];

const expandedExpenses = expensePlan.flatMap((item) => Array.from({ length: item.weight }, () => item));

export function createDemoState(): AppState {
  const rand = mulberry32(20261108);
  const txs: Tx[] = [];

  // Two months of daily life.
  for (let i = 0; i < 75; i++) {
    const day = daysAgo(i);
    const count = 1 + Math.floor(rand() * 3);
    for (let j = 0; j < count; j++) {
      const pick = expandedExpenses[Math.floor(rand() * expandedExpenses.length)];
      const amount = Math.round((pick.min + rand() * (pick.max - pick.min)) / 1000) * 1000;
      const accountRoll = rand();
      const accountId = accountRoll < 0.5 ? 'acc_ewallet' : accountRoll < 0.85 ? 'acc_cash' : 'acc_bank';
      txs.push({
        id: uid('tx'),
        type: 'expense',
        amount,
        accountId,
        categoryId: pick.cat,
        date: day,
        note: pick.note,
        createdAt: Date.now() - i * 86_400_000 - j * 1000,
      });
    }
  }

  // Salary on the 25th of each month, plus a few incomes.
  const now = new Date();
  for (let m = 0; m < 3; m++) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 25);
    if (d > now) continue;
    txs.push({
      id: uid('tx'),
      type: 'income',
      amount: 14_500_000,
      accountId: 'acc_bank',
      categoryId: 'cat_salary',
      date: toISO(d),
      note: 'Gaji bulanan',
      createdAt: Date.now() - 1000,
    });
  }
  txs.push({
    id: uid('tx'),
    type: 'income',
    amount: 3_200_000,
    accountId: 'acc_bank',
    categoryId: 'cat_bonus',
    date: daysAgo(5),
    note: 'Proyek desain lepas',
    createdAt: Date.now() - 1500,
  });
  txs.push({
    id: uid('tx'),
    type: 'income',
    amount: 2_250_000,
    accountId: 'acc_bank',
    categoryId: 'cat_bonus',
    date: daysAgo(12),
    note: 'Bonus proyek sampingan',
    createdAt: Date.now() - 2000,
  });
  txs.push({
    id: uid('tx'),
    type: 'income',
    amount: 312_000,
    accountId: 'acc_bank',
    categoryId: 'cat_invest',
    date: daysAgo(34),
    note: 'Dividen reksa dana',
    createdAt: Date.now() - 3000,
  });

  // Transfers between own accounts.
  [
    { amount: 1_500_000, date: daysAgo(4), from: 'acc_bank', to: 'acc_ewallet' },
    { amount: 500_000, date: daysAgo(11), from: 'acc_bank', to: 'acc_cash' },
    { amount: 1_200_000, date: daysAgo(22), from: 'acc_bank', to: 'acc_ewallet' },
    { amount: 400_000, date: daysAgo(38), from: 'acc_bank', to: 'acc_cash' },
    { amount: 900_000, date: daysAgo(52), from: 'acc_bank', to: 'acc_ewallet' },
  ].forEach((t, idx) => {
    txs.push({
      id: uid('tx'),
      type: 'transfer',
      amount: t.amount,
      accountId: t.from,
      toAccountId: t.to,
      fee: idx % 2 === 0 ? 6_500 : 0,
      date: t.date,
      note: 'Top up saldo',
      createdAt: Date.now() - idx * 500,
    });
  });

  const today = todayISO();
  const thisMonth = monthKey(today);

  const recurring: Recurring[] = [
    {
      id: 'rec_netflix',
      name: 'Netflix',
      type: 'expense',
      amount: 54_000,
      accountId: 'acc_bank',
      categoryId: 'cat_fun',
      note: 'Langganan Netflix',
      interval: 'monthly',
      startDate: daysAgo(92),
      nextDate: daysAgo(2),
      active: true,
      isSubscription: true,
      createdAt: Date.now(),
    },
    {
      id: 'rec_spotify',
      name: 'Spotify',
      type: 'expense',
      amount: 49_000,
      accountId: 'acc_bank',
      categoryId: 'cat_fun',
      note: 'Langganan Spotify',
      interval: 'monthly',
      startDate: daysAgo(70),
      nextDate: initialNextDate(daysAgo(70), 'monthly', today),
      active: true,
      isSubscription: true,
      createdAt: Date.now(),
    },
    {
      id: 'rec_internet',
      name: 'Internet rumah',
      type: 'expense',
      amount: 320_000,
      accountId: 'acc_bank',
      categoryId: 'cat_bills',
      note: 'Tagihan internet',
      interval: 'monthly',
      startDate: daysAgo(60),
      nextDate: initialNextDate(daysAgo(60), 'monthly', today),
      active: true,
      isSubscription: false,
      createdAt: Date.now(),
    },
    {
      id: 'rec_salary',
      name: 'Gaji bulanan',
      type: 'income',
      amount: 14_500_000,
      accountId: 'acc_bank',
      categoryId: 'cat_salary',
      note: 'Gaji bulanan',
      interval: 'monthly',
      startDate: daysAgo(120),
      nextDate: initialNextDate(daysAgo(120), 'monthly', today),
      active: true,
      isSubscription: false,
      createdAt: Date.now(),
    },
  ];

  const budgets: Budget[] = [
    {
      id: 'bud_food',
      categoryId: 'cat_food',
      amount: 2_800_000,
      rollover: true,
      startMonth: shiftMonth(thisMonth, -2),
      active: true,
      createdAt: Date.now(),
    },
    {
      id: 'bud_transport',
      categoryId: 'cat_transport',
      amount: 900_000,
      rollover: false,
      startMonth: thisMonth,
      active: true,
      createdAt: Date.now(),
    },
    {
      id: 'bud_fun',
      categoryId: 'cat_fun',
      amount: 400_000,
      rollover: true,
      startMonth: shiftMonth(thisMonth, -1),
      active: true,
      createdAt: Date.now(),
    },
    {
      id: 'bud_bills',
      categoryId: 'cat_bills',
      amount: 1_200_000,
      rollover: false,
      startMonth: thisMonth,
      active: true,
      createdAt: Date.now(),
    },
  ];

  const debts: Debt[] = [
    {
      id: 'debt_1',
      kind: 'debt',
      name: 'Pinjaman motor',
      note: 'Cicilan 12 bulan, tenor ke-4',
      total: 9_600_000,
      accountId: 'acc_bank',
      startDate: daysAgo(120),
      dueDate: daysAgo(-8),
      createdAt: Date.now(),
    },
    {
      id: 'debt_2',
      kind: 'loan',
      name: 'Dipinjam Rani',
      note: 'Buat biaya kos',
      total: 1_800_000,
      accountId: 'acc_bank',
      startDate: daysAgo(40),
      dueDate: daysAgo(-20),
      createdAt: Date.now(),
    },
  ];

  const payments = [
    { id: uid('pay'), debtId: 'debt_1', amount: 800_000, accountId: 'acc_bank', date: daysAgo(30), note: 'Cicilan ke-3' },
    { id: uid('pay'), debtId: 'debt_1', amount: 800_000, accountId: 'acc_bank', date: daysAgo(60), note: 'Cicilan ke-2' },
    { id: uid('pay'), debtId: 'debt_2', amount: 600_000, accountId: 'acc_bank', date: daysAgo(15), note: 'Cicilan pertama' },
  ];

  return {
    version: 2,
    accounts: DEFAULT_ACCOUNTS,
    categories: DEFAULT_CATEGORIES,
    txs,
    debts,
    payments,
    recurring,
    budgets,
    settings: {
      userName: 'Kamu',
      currency: 'IDR',
      pin: null,
      onboarded: false,
      tourSeen: false,
      createdAt: Date.now(),
    },
  };
}

export function createEmptyState(): AppState {
  return {
    version: 2,
    accounts: DEFAULT_ACCOUNTS.map((a) => ({ ...a, initial: 0 })),
    categories: DEFAULT_CATEGORIES,
    txs: [],
    debts: [],
    payments: [],
    recurring: [],
    budgets: [],
    settings: {
      userName: 'Kamu',
      currency: 'IDR',
      pin: null,
      onboarded: false,
      tourSeen: false,
      createdAt: Date.now(),
    },
  };
}

export { todayISO };
