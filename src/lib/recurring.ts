import type { Interval, Recurring, Tx } from './types';
import { todayISO } from './format';
import { core, parseCoreJson } from './rust';
import { uid } from './types';

export const INTERVAL_LABEL: Record<Interval, string> = {
  weekly: "Mingguan",
  monthly: "Bulanan",
  yearly: "Tahunan",
};


/** Move an ISO date forward by one interval, clamping month-end and Feb 29. */
export function advanceDate(iso: string, interval: Interval): string {
  return core().advance_date(iso, interval) ?? iso;
}

/** Every unposted occurrence up to and including `today`. */
export function dueDates(item: Recurring, today = todayISO()): string[] {
  return parseCoreJson<string[]>(
    core().recurring_due_dates(JSON.stringify(item), today),
    'recurring_due_dates',
  );
}

export function isDue(item: Recurring, today = todayISO()): boolean {
  return core().recurring_is_due(JSON.stringify(item), today);
}

/** Rough monthly cost, used for the subscription summary. */
export function monthlyEquivalent(item: Recurring): number {
  return core().recurring_monthly_equivalent(JSON.stringify(item));
}

/** Number of days until the next occurrence (negative when overdue). */
export function daysUntilNext(item: Recurring, today = todayISO()): number {
  return Number(core().recurring_days_until_next(JSON.stringify(item), today) ?? 0);
}

export interface RecurringRun {
  txs: Tx[];
  nextDates: Record<string, string>;
  count: number;
}

/**
 * Build the transactions that are due since each item was last posted. Pure:
 * callers apply `txs` and `nextDates` in one state update so React StrictMode
 * cannot post the same occurrence twice.
 */
export function collectDue(items: Recurring[], today = todayISO()): RecurringRun {
  const txs: Tx[] = [];
  const nextDates: Record<string, string> = {};
  const stamp = Date.now();

  for (const item of items) {
    const dates = dueDates(item, today);
    if (dates.length === 0) continue;
    for (const date of dates) {
      txs.push({
        id: uid('tx'),
        type: item.type,
        amount: item.amount,
        accountId: item.accountId,
        categoryId: item.categoryId,
        date,
        note: item.note || item.name,
        recurringId: item.id,
        createdAt: stamp,
      });
    }
    nextDates[item.id] = advanceDate(dates[dates.length - 1], item.interval);
  }

  return { txs, nextDates, count: txs.length };
}

/** One occurrence of a recurring item, dated at its next scheduled date by default. */
export function occurrenceTx(item: Recurring, date = item.nextDate): Tx {
  return {
    id: uid('tx'),
    type: item.type,
    amount: item.amount,
    accountId: item.accountId,
    categoryId: item.categoryId,
    date,
    note: item.note || item.name,
    recurringId: item.id,
    createdAt: Date.now(),
  };
}

/**
 * A fresh schedule for a new item. The first occurrence is the start date when
 * it is still ahead, otherwise the next one after today.
 */
export function initialNextDate(startDate: string, interval: Interval, today = todayISO()): string {
  return core().recurring_initial_next_date(startDate, interval, today) ?? startDate;
}
