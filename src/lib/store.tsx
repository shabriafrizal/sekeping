import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Account,
  AppState,
  Budget,
  Category,
  Debt,
  DebtPayment,
  Filters,
  Recurring,
  Settings,
  Tx,
} from './types';
import { uid } from './types';
import { createDemoState, createEmptyState } from './seed';
import { monthRange, todayISO } from './format';
import { advanceDate, collectDue, occurrenceTx } from './recurring';
import { nativeMode } from './native';

const STORAGE_KEY = 'sekeping.state.v1';

/* Native sheet and config surfaces reuse this same origin and storage. */
const NATIVE = nativeMode();
const HAD_STORAGE = (() => {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
})();

function loadState(): AppState {
  try {
    /* Never seed demo data from a widget surface: it would overwrite the
       ledger the full app has not created yet. */
    if (!HAD_STORAGE && NATIVE) return createEmptyState();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDemoState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (!parsed || !Array.isArray(parsed.accounts)) return createDemoState();
    return {
      ...parsed,
      version: 2,
      txs: Array.isArray(parsed.txs) ? parsed.txs : [],
      debts: Array.isArray(parsed.debts) ? parsed.debts : [],
      payments: Array.isArray(parsed.payments) ? parsed.payments : [],
      // Added in v2; older backups simply have no schedules or budgets yet.
      recurring: Array.isArray(parsed.recurring) ? parsed.recurring : [],
      budgets: Array.isArray(parsed.budgets) ? parsed.budgets : [],
      settings: { ...createEmptyState().settings, ...parsed.settings },
    } as AppState;
  } catch {
    return createDemoState();
  }
}

export interface Toast {
  id: string;
  message: string;
  tone: 'success' | 'error' | 'info';
}

interface StoreValue {
  state: AppState;
  hydrated: boolean;
  toasts: Toast[];
  notify: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: string) => void;
  accountById: (id?: string) => Account | undefined;
  categoryById: (id?: string) => Category | undefined;
  balanceOf: (accountId: string) => number;
  netWorth: number;
  monthTotals: (from: string, to: string) => { income: number; expense: number };
  debtPaid: (debtId: string) => number;
  txToPayments: (tx: Tx) => boolean;
  addTx: (tx: Omit<Tx, 'id' | 'createdAt'>) => void;
  updateTx: (id: string, patch: Partial<Tx>) => void;
  removeTx: (id: string) => void;
  addAccount: (a: Omit<Account, 'id'>) => void;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  removeAccount: (id: string) => void;
  addCategory: (c: Omit<Category, 'id'>) => void;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  removeCategory: (id: string) => void;
  addDebt: (d: Omit<Debt, 'id' | 'createdAt'>) => void;
  updateDebt: (id: string, patch: Partial<Debt>) => void;
  removeDebt: (id: string) => void;
  addPayment: (p: Omit<DebtPayment, 'id'>) => void;
  removePayment: (id: string) => void;
  addRecurring: (r: Omit<Recurring, 'id' | 'createdAt'>) => void;
  updateRecurring: (id: string, patch: Partial<Recurring>) => void;
  removeRecurring: (id: string) => void;
  postRecurring: (id: string) => void;
  /** Mark a due reminder done: post it dated today, then advance the schedule. */
  completeRecurring: (id: string) => void;
  skipRecurring: (id: string) => void;
  /** Post every occurrence that came due. Returns how many transactions were added. */
  runRecurring: () => number;
  addBudget: (b: Omit<Budget, 'id' | 'createdAt'>) => void;
  updateBudget: (id: string, patch: Partial<Budget>) => void;
  removeBudget: (id: string) => void;
  importData: (payload: { accounts?: Account[]; categories?: Category[]; txs?: Tx[] }) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  replaceState: (next: AppState) => void;
  resetDemo: () => void;
  clearAll: () => void;
  exportJSON: () => string;
  exportCSV: (filters?: Filters) => string;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState());
  const [hydrated, setHydrated] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastPersisted = useRef('');

  /* The config dialog is read-only. A sheet may write, but never creates the
     first ledger from an empty install. */
  const canPersist = NATIVE === null || (NATIVE === 'sheet' && HAD_STORAGE);

  /** Write immediately so a native sheet can close without losing the entry. */
  const persist = useCallback(
    (next: AppState) => {
      if (!canPersist) return;
      try {
        const raw = JSON.stringify(next);
        lastPersisted.current = raw;
        localStorage.setItem(STORAGE_KEY, raw);
      } catch {
        /* storage full or blocked */
      }
    },
    [canPersist],
  );

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !canPersist) return;
    try {
      const raw = JSON.stringify(state);
      if (raw === lastPersisted.current) return;
      lastPersisted.current = raw;
      localStorage.setItem(STORAGE_KEY, raw);
    } catch {
      /* storage full or blocked */
    }
  }, [state, hydrated, canPersist]);

  /* The full app and the quick-add sheet are separate WebViews on one origin.
     Reload when the other one writes, so neither side keeps a stale ledger. */
  useEffect(() => {
    if (!canPersist) return;
    function sync() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw || raw === lastPersisted.current) return;
        lastPersisted.current = raw;
        setState(loadState());
      } catch {
        /* ignore malformed storage */
      }
    }
    function onStorage(event: StorageEvent) {
      if (event.key && event.key !== STORAGE_KEY) return;
      sync();
    }
    function onVisible() {
      if (!document.hidden) sync();
    }
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [canPersist]);

  const notify = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = uid('toast');
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const accountById = useCallback(
    (id?: string) => state.accounts.find((a) => a.id === id),
    [state.accounts],
  );
  const categoryById = useCallback(
    (id?: string) => state.categories.find((c) => c.id === id),
    [state.categories],
  );

  const balanceOf = useCallback(
    (accountId: string) => {
      const acc = state.accounts.find((a) => a.id === accountId);
      let total = acc?.initial ?? 0;
      for (const tx of state.txs) {
        if (tx.type === 'income' && tx.accountId === accountId) total += tx.amount;
        if (tx.type === 'expense' && tx.accountId === accountId) total -= tx.amount;
        if (tx.type === 'transfer') {
          if (tx.accountId === accountId) total -= tx.amount + (tx.fee ?? 0);
          if (tx.toAccountId === accountId) total += tx.amount;
        }
      }
      return total;
    },
    [state.accounts, state.txs],
  );

  const netWorth = useMemo(
    () =>
      state.accounts
        .filter((a) => a.active)
        .reduce((sum, a) => sum + balanceOf(a.id), 0),
    [state.accounts, balanceOf],
  );

  const monthTotals = useCallback(
    (from: string, to: string) => {
      let income = 0;
      let expense = 0;
      for (const tx of state.txs) {
        if (tx.date < from || tx.date > to) continue;
        if (tx.type === 'income') income += tx.amount;
        if (tx.type === 'expense') expense += tx.amount;
      }
      return { income, expense };
    },
    [state.txs],
  );

  const debtPaid = useCallback(
    (debtId: string) => state.payments.filter((p) => p.debtId === debtId).reduce((s, p) => s + p.amount, 0),
    [state.payments],
  );

  const txToPayments = useCallback(
    (tx: Tx) => Boolean(tx.debtId) && state.payments.some((p) => p.id === tx.id),
    [state.payments],
  );

  const addTx = useCallback(
    (tx: Omit<Tx, 'id' | 'createdAt'>) => {
      const next: AppState = {
        ...state,
        txs: [{ ...tx, id: uid('tx'), createdAt: Date.now() }, ...state.txs],
      };
      setState(next);
      persist(next);
    },
    [state, persist],
  );

  const updateTx = useCallback(
    (id: string, patch: Partial<Tx>) => {
      const next: AppState = {
        ...state,
        txs: state.txs.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      };
      setState(next);
      persist(next);
    },
    [state, persist],
  );

  const removeTx = useCallback(
    (id: string) => {
      const next: AppState = {
        ...state,
        txs: state.txs.filter((t) => t.id !== id),
        payments: state.payments.filter((p) => p.id !== id),
      };
      setState(next);
      persist(next);
    },
    [state, persist],
  );

  const addAccount = useCallback((a: Omit<Account, 'id'>) => {
    setState((prev) => ({ ...prev, accounts: [...prev.accounts, { ...a, id: uid('acc') }] }));
  }, []);

  const updateAccount = useCallback((id: string, patch: Partial<Account>) => {
    setState((prev) => ({
      ...prev,
      accounts: prev.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  }, []);

  const removeAccount = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      accounts: prev.accounts.filter((a) => a.id !== id),
      txs: prev.txs.filter((t) => t.accountId !== id && t.toAccountId !== id),
      debts: prev.debts.filter((d) => d.accountId !== id),
      recurring: prev.recurring.filter((r) => r.accountId !== id),
    }));
  }, []);

  const addCategory = useCallback((c: Omit<Category, 'id'>) => {
    setState((prev) => ({ ...prev, categories: [...prev.categories, { ...c, id: uid('cat') }] }));
  }, []);

  const updateCategory = useCallback((id: string, patch: Partial<Category>) => {
    setState((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }, []);

  const removeCategory = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      categories: prev.categories.filter((c) => c.id !== id),
      txs: prev.txs.map((t) => (t.categoryId === id ? { ...t, categoryId: undefined } : t)),
      recurring: prev.recurring.map((r) => (r.categoryId === id ? { ...r, categoryId: undefined } : r)),
      budgets: prev.budgets.filter((b) => b.categoryId !== id),
    }));
  }, []);

  const addDebt = useCallback((d: Omit<Debt, 'id' | 'createdAt'>) => {
    setState((prev) => ({ ...prev, debts: [{ ...d, id: uid('debt'), createdAt: Date.now() }, ...prev.debts] }));
  }, []);

  const updateDebt = useCallback((id: string, patch: Partial<Debt>) => {
    setState((prev) => ({
      ...prev,
      debts: prev.debts.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    }));
  }, []);

  const removeDebt = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      debts: prev.debts.filter((d) => d.id !== id),
      payments: prev.payments.filter((p) => p.debtId !== id),
      txs: prev.txs.filter((t) => t.debtId !== id),
    }));
  }, []);

  const addPayment = useCallback((p: Omit<DebtPayment, 'id'>) => {
    const id = uid('pay');
    setState((prev) => {
      const debt = prev.debts.find((d) => d.id === p.debtId);
      const tx: Tx = {
        id,
        type: debt?.kind === 'loan' ? 'income' : 'expense',
        amount: p.amount,
        accountId: p.accountId,
        date: p.date,
        note: p.note || `Pembayaran ${debt?.name ?? ''}`.trim(),
        debtId: p.debtId,
        createdAt: Date.now(),
      };
      return {
        ...prev,
        payments: [{ ...p, id }, ...prev.payments],
        txs: [tx, ...prev.txs],
      };
    });
  }, []);

  const removePayment = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      payments: prev.payments.filter((p) => p.id !== id),
      txs: prev.txs.filter((t) => t.id !== id),
    }));
  }, []);

  /* ---------------- recurring & subscriptions ---------------- */

  const addRecurring = useCallback((r: Omit<Recurring, 'id' | 'createdAt'>) => {
    setState((prev) => ({
      ...prev,
      recurring: [{ ...r, id: uid('rec'), createdAt: Date.now() }, ...prev.recurring],
    }));
  }, []);

  const updateRecurring = useCallback((id: string, patch: Partial<Recurring>) => {
    setState((prev) => ({
      ...prev,
      recurring: prev.recurring.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  }, []);

  const removeRecurring = useCallback((id: string) => {
    // Posted transactions stay in the ledger; only the schedule goes away.
    setState((prev) => ({ ...prev, recurring: prev.recurring.filter((r) => r.id !== id) }));
  }, []);

  const postRecurring = useCallback((id: string) => {
    setState((prev) => {
      const item = prev.recurring.find((r) => r.id === id);
      if (!item) return prev;
      return {
        ...prev,
        txs: [occurrenceTx(item), ...prev.txs],
        recurring: prev.recurring.map((r) =>
          r.id === id
            ? { ...r, nextDate: advanceDate(r.nextDate, r.interval), lastPostedAt: Date.now() }
            : r,
        ),
      };
    });
  }, []);

  const completeRecurring = useCallback((id: string) => {
    setState((prev) => {
      const item = prev.recurring.find((r) => r.id === id);
      if (!item) return prev;
      return {
        ...prev,
        txs: [occurrenceTx(item, todayISO()), ...prev.txs],
        recurring: prev.recurring.map((r) =>
          r.id === id
            ? { ...r, nextDate: advanceDate(r.nextDate, r.interval), lastPostedAt: Date.now() }
            : r,
        ),
      };
    });
  }, []);

  const skipRecurring = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      recurring: prev.recurring.map((r) =>
        r.id === id ? { ...r, nextDate: advanceDate(r.nextDate, r.interval) } : r,
      ),
    }));
  }, []);

  const runRecurring = useCallback(() => {
    const run = collectDue(state.recurring);
    if (run.count === 0) return 0;
    setState((prev) => ({
      ...prev,
      txs: [...run.txs, ...prev.txs],
      recurring: prev.recurring.map((r) =>
        run.nextDates[r.id] ? { ...r, nextDate: run.nextDates[r.id], lastPostedAt: Date.now() } : r,
      ),
    }));
    return run.count;
  }, [state.recurring]);

  /* ---------------- budgets ---------------- */

  const addBudget = useCallback((b: Omit<Budget, 'id' | 'createdAt'>) => {
    setState((prev) => ({ ...prev, budgets: [...prev.budgets, { ...b, id: uid('bud'), createdAt: Date.now() }] }));
  }, []);

  const updateBudget = useCallback((id: string, patch: Partial<Budget>) => {
    setState((prev) => ({
      ...prev,
      budgets: prev.budgets.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
  }, []);

  const removeBudget = useCallback((id: string) => {
    setState((prev) => ({ ...prev, budgets: prev.budgets.filter((b) => b.id !== id) }));
  }, []);

  /* ---------------- bulk import ---------------- */

  const importData = useCallback(
    (payload: { accounts?: Account[]; categories?: Category[]; txs?: Tx[] }) => {
      setState((prev) => {
        const accountIds = new Set(prev.accounts.map((a) => a.id));
        const categoryIds = new Set(prev.categories.map((c) => c.id));
        return {
          ...prev,
          accounts: [...prev.accounts, ...(payload.accounts ?? []).filter((a) => !accountIds.has(a.id))],
          categories: [...prev.categories, ...(payload.categories ?? []).filter((c) => !categoryIds.has(c.id))],
          txs: [...(payload.txs ?? []), ...prev.txs],
        };
      });
    },
    [],
  );

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
  }, []);

  const replaceState = useCallback((next: AppState) => setState(next), []);
  const resetDemo = useCallback(() => setState(createDemoState()), []);
  const clearAll = useCallback(() => setState(createEmptyState()), []);

  const exportJSON = useCallback(() => JSON.stringify(state, null, 2), [state]);

  const exportCSV = useCallback(
    (filters?: Filters) => {
      const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
      const rows = [['Tanggal', 'Jenis', 'Kategori', 'Rekening', 'Tujuan', 'Jumlah', 'Biaya', 'Catatan']];
      const list = [...state.txs].sort((a, b) => (a.date < b.date ? 1 : -1));
      for (const tx of list) {
        if (filters) {
          if (filters.type !== 'all' && tx.type !== filters.type) continue;
          if (filters.accountId !== 'all' && tx.accountId !== filters.accountId) continue;
          if (filters.categoryId !== 'all' && tx.categoryId !== filters.categoryId) continue;
          if (filters.from && tx.date < filters.from) continue;
          if (filters.to && tx.date > filters.to) continue;
          if (filters.search && !tx.note.toLowerCase().includes(filters.search.toLowerCase())) continue;
        }
        rows.push([
          tx.date,
          tx.type === 'expense' ? 'Pengeluaran' : tx.type === 'income' ? 'Pendapatan' : 'Transfer',
          state.categories.find((c) => c.id === tx.categoryId)?.name ?? '',
          state.accounts.find((a) => a.id === tx.accountId)?.name ?? '',
          state.accounts.find((a) => a.id === tx.toAccountId)?.name ?? '',
          String(tx.amount),
          String(tx.fee ?? 0),
          tx.note,
        ]);
      }
      return rows.map((r) => r.map(esc).join(',')).join('\r\n');
    },
    [state],
  );

  const value: StoreValue = {
    state,
    hydrated,
    toasts,
    notify,
    dismissToast,
    accountById,
    categoryById,
    balanceOf,
    netWorth,
    monthTotals,
    debtPaid,
    txToPayments,
    addTx,
    updateTx,
    removeTx,
    addAccount,
    updateAccount,
    removeAccount,
    addCategory,
    updateCategory,
    removeCategory,
    addDebt,
    updateDebt,
    removeDebt,
    addPayment,
    removePayment,
    addRecurring,
    updateRecurring,
    removeRecurring,
    postRecurring,
    completeRecurring,
    skipRecurring,
    runRecurring,
    addBudget,
    updateBudget,
    removeBudget,
    importData,
    updateSettings,
    replaceState,
    resetDemo,
    clearAll,
    exportJSON,
    exportCSV,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

export function currentMonth() {
  const iso = todayISO();
  const { from, to } = monthRange(iso);
  return { from, to, iso };
}
