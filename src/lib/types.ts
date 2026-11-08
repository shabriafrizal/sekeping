export type TxType = 'expense' | 'income' | 'transfer';
export type CategoryType = 'expense' | 'income';
export type DebtKind = 'debt' | 'loan';

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
  note: string;
  debtId?: string;
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

export interface Settings {
  userName: string;
  currency: 'IDR' | 'USD' | 'EUR' | 'SGD' | 'MYR';
  pin: string | null;
  onboarded: boolean;
  createdAt: number;
}

export interface AppState {
  version: number;
  accounts: Account[];
  categories: Category[];
  txs: Tx[];
  debts: Debt[];
  payments: DebtPayment[];
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
