import type { Budget, Category, Tx } from './types';
import { monthRange, toISO } from './format';

/** All month keys (YYYY-MM) from `start` through `end`, inclusive. */
export function monthsBetween(startMonth: string, endMonth: string): string[] {
  const [sy, sm] = startMonth.split('-').map(Number);
  const [ey, em] = endMonth.split('-').map(Number);
  if (!sy || !sm || !ey || !em) return [];
  const out: string[] = [];
  let y = sy;
  let m = sm;
  let guard = 0;
  while ((y < ey || (y === ey && m <= em)) && guard < 240) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    guard += 1;
  }
  return out;
}

export function spentInCategory(txs: Tx[], categoryId: string, month: string): number {
  const { from, to } = monthRange(`${month}-01`);
  let total = 0;
  for (const tx of txs) {
    if (tx.type !== 'expense' || tx.categoryId !== categoryId) continue;
    if (tx.date < from || tx.date > to) continue;
    total += tx.amount;
  }
  return total;
}

export interface BudgetProgress {
  budget: Budget;
  category?: Category;
  /** Allowance carried in from previous months (rollover only, never negative). */
  carryIn: number;
  /** budget + carryIn */
  available: number;
  spent: number;
  /** available - spent (can be negative) */
  remaining: number;
  /** spent / available, clamped to 0..1 for the bar; use over for the rest. */
  ratio: number;
  over: number;
  monthsTracked: number;
}

/**
 * Walk the budget forward from its start month so unused money rolls over.
 * Only positive leftovers roll over; overspending does not shrink next month.
 */
export function budgetProgress(budget: Budget, txs: Tx[], month: string, category?: Category): BudgetProgress {
  const empty: BudgetProgress = {
    budget,
    category,
    carryIn: 0,
    available: 0,
    spent: 0,
    remaining: 0,
    ratio: 0,
    over: 0,
    monthsTracked: 0,
  };
  if (month < budget.startMonth) return empty;

  let carry = 0;
  let available = 0;
  let spent = 0;
  const months = monthsBetween(budget.startMonth, month);
  for (const key of months) {
    available = budget.amount + carry;
    spent = spentInCategory(txs, budget.categoryId, key);
    carry = budget.rollover ? Math.max(0, available - spent) : 0;
  }

  const remaining = available - spent;
  return {
    budget,
    category,
    carryIn: budget.rollover ? Math.max(0, available - budget.amount) : 0,
    available,
    spent,
    remaining,
    ratio: available > 0 ? Math.min(spent / available, 1) : spent > 0 ? 1 : 0,
    over: Math.max(0, spent - available),
    monthsTracked: months.length,
  };
}

export function toneFor(progress: BudgetProgress): 'ok' | 'warning' | 'over' {
  if (progress.available <= 0) return progress.spent > 0 ? 'over' : 'ok';
  if (progress.spent > progress.available) return 'over';
  if (progress.spent / progress.available >= 0.8) return 'warning';
  return 'ok';
}

/** Month key of today (YYYY-MM). */
export function currentMonthKey(): string {
  return toISO(new Date()).slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
