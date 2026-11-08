import type { Interval, Recurring, Tx } from './types';
import { parseISO, toISO, todayISO } from './format';
import { uid } from './types';

export const INTERVAL_LABEL: Record<Interval, string> = {
  weekly: 'Mingguan',
  monthly: 'Bulanan',
  yearly: 'Tahunan',
};

const MAX_CATCH_UP = 240;

/** Move an ISO date forward by one interval, clamping month-end and Feb 29. */
export function advanceDate(iso: string, interval: Interval): string {
  const d = parseISO(iso);
  if (interval === 'weekly') {
    d.setDate(d.getDate() + 7);
    return toISO(d);
  }
  const months = interval === 'yearly' ? 12 : 1;
  const day = d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return toISO(target);
}

/** Every unposted occurrence up to and including `today`. */
export function dueDates(item: Recurring, today = todayISO()): string[] {
  if (!item.active) return [];
  const dates: string[] = [];
  let cursor = item.nextDate < item.startDate ? item.startDate : item.nextDate;
  let guard = 0;
  while (cursor <= today && guard < MAX_CATCH_UP) {
    if (item.endDate && cursor > item.endDate) break;
    dates.push(cursor);
    cursor = advanceDate(cursor, item.interval);
    guard += 1;
  }
  return dates;
}

export function isDue(item: Recurring, today = todayISO()): boolean {
  return item.active && item.nextDate <= today && (!item.endDate || item.nextDate <= item.endDate);
}

/** Rough monthly cost, used for the subscription summary. */
export function monthlyEquivalent(item: Recurring): number {
  if (item.interval === 'weekly') return Math.round((item.amount * 52) / 12);
  if (item.interval === 'yearly') return Math.round(item.amount / 12);
  return item.amount;
}

/** Number of days until the next occurrence (negative when overdue). */
export function daysUntilNext(item: Recurring, today = todayISO()): number {
  return Math.round((parseISO(item.nextDate).getTime() - parseISO(today).getTime()) / 86_400_000);
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
  if (startDate >= today) return startDate;
  let cursor = startDate;
  let guard = 0;
  while (cursor <= today && guard < MAX_CATCH_UP) {
    cursor = advanceDate(cursor, interval);
    guard += 1;
  }
  return cursor;
}
