export type TxType = 'expense' | 'income' | 'transfer';
export type CategoryType = 'expense' | 'income';
export type DebtKind = 'debt' | 'loan';
export type Interval = 'weekly' | 'monthly' | 'yearly';

export interface Account {
  id: string;
  name: string;
  icon: string;
  initial: number;
  active: boolean;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  type: CategoryType;
  active: boolean;
}

export interface Tx {
  id: string;
  type: TxType;
  amount: number;
  accountId: string;
  categoryId?: string;
  toAccountId?: string;
  fee?: number;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm, optional; absent means "no time"
  note: string;
  debtId?: string;
  recurringId?: string;
  createdAt: number;
}

/**
 * A template that posts a transaction on a schedule. `nextDate` is the first
 * occurrence that has not been posted yet; the app catches up on load.
 */
export interface Recurring {
  id: string;
  name: string;
  type: CategoryType;
  amount: number;
  accountId: string;
  categoryId?: string;
  note: string;
  interval: Interval;
  startDate: string; // YYYY-MM-DD
  nextDate: string; // YYYY-MM-DD
  endDate?: string;
  active: boolean;
  isSubscription: boolean;
  lastPostedAt?: number;
  createdAt: number;
}

/** A monthly spending limit for one expense category. */
export interface Budget {
  id: string;
  categoryId: string;
  amount: number;
  rollover: boolean;
  startMonth: string; // YYYY-MM
  active: boolean;
  createdAt: number;
}

export interface Debt {
  id: string;
  kind: DebtKind;
  name: string;
  note: string;
  total: number;
  accountId: string;
  startDate: string;
  dueDate?: string;
  createdAt: number;
}

export interface DebtPayment {
  id: string;
  debtId: string;
  amount: number;
  accountId: string;
  date: string;
  note: string;
}

/**
 * Optional receipt checker. The free JEV model runs on OpenCode Zen and needs
 * no key; a proxy URL can be supplied because the Zen endpoint does not answer
 * browser CORS preflights. Nothing is sent while `enabled` is false.
 */
export interface AiSettings {
  enabled: boolean;
  /** Empty means "auto": the Vite proxy in development, Zen directly in a build. */
  baseUrl: string;
  model: string;
}

export interface Settings {
  userName: string;
  language: 'id' | 'en';
  currency: 'IDR' | 'USD' | 'EUR' | 'SGD' | 'MYR';
  pin: string | null;
  onboarded: boolean;
  tourSeen: boolean;
  createdAt: number;
  ai: AiSettings;
}

export interface AppState {
  version: number;
  accounts: Account[];
  categories: Category[];
  txs: Tx[];
  debts: Debt[];
  payments: DebtPayment[];
  recurring: Recurring[];
  budgets: Budget[];
  settings: Settings;
}

export interface Filters {
  search: string;
  type: 'all' | TxType;
  accountId: string | 'all';
  categoryId: string | 'all';
  from?: string;
  to?: string;
}

export const EMPTY_FILTERS: Filters = {
  search: '',
  type: 'all',
  accountId: 'all',
  categoryId: 'all',
};

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
