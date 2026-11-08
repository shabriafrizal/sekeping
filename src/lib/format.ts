let LOCALE = 'id-ID';
let CURRENCY = 'IDR';

const currencySymbols: Record<string, string> = {
  IDR: 'Rp',
  USD: '$',
  EUR: '€',
  SGD: 'S$',
  MYR: 'RM',
};

/** Follow the app language setting for grouping and month names. */
export function setFormatLocale(language: string): void {
  LOCALE = language === 'en' ? 'en-US' : 'id-ID';
}

/** Follow the app currency setting for every `money()` call without an override. */
export function setFormatCurrency(currency: string): void {
  CURRENCY = currencySymbols[currency] ? currency : 'IDR';
}

/**
 * Apply both display settings together. The store calls this while rendering,
 * before its children, so the same paint already uses the new locale/currency
 * instead of waiting for an effect and flashing the old format.
 */
export function setFormatPreferences(language: string, currency: string): void {
  setFormatLocale(language);
  setFormatCurrency(currency);
}

export function currencySymbol(currency = CURRENCY): string {
  return currencySymbols[currency] ?? '';
}

export function money(value: number, currency = CURRENCY): string {
  const n = Number.isFinite(value) ? value : 0;
  const sign = n < 0 ? '−' : '';
  const sym = currencySymbols[currency] ?? '';
  const digits = currency === 'IDR' ? 0 : 2;
  const body = Math.abs(n).toLocaleString(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${sign}${sym}${sym ? ' ' : ''}${body}`;
}

function compactBody(value: number): string {
  const n = Math.abs(value);
  const english = LOCALE.startsWith('en');
  let divisor = 1;
  let unit = '';
  if (n >= 1_000_000_000) {
    divisor = 1_000_000_000;
    unit = english ? 'B' : 'M';
  } else if (n >= 1_000_000) {
    divisor = 1_000_000;
    unit = english ? 'M' : 'jt';
  } else if (n >= 1_000) {
    divisor = 1_000;
    unit = english ? 'K' : 'rb';
  }
  const body = unit
    ? (n / divisor).toLocaleString(LOCALE, { maximumFractionDigits: 1 })
    : n.toLocaleString(LOCALE);
  return `${body}${unit ? ` ${unit}` : ''}`;
}

export function compactMoney(value: number, currency = CURRENCY): string {
  const sym = currencySymbols[currency] ?? '';
  return `${value < 0 ? '−' : ''}${sym}${sym ? ' ' : ''}${compactBody(value)}`;
}

/** Compact number without a currency symbol, for chart axes. */
export function compactNumber(value: number): string {
  return `${value < 0 ? '−' : ''}${compactBody(value)}`;
}

export function plainNumber(value: number): string {
  return Math.abs(value).toLocaleString(LOCALE);
}

export function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Chronological key: date plus the optional time (midnight when absent). */
export function txSortValue(tx: { date: string; time?: string }): number {
  const d = parseISO(tx.date);
  const [h, m] = (tx.time ?? '00:00').split(':').map(Number);
  d.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return d.getTime();
}

/** Newest first; same moment falls back to when it was captured. */
export function compareTxs(
  a: { date: string; time?: string; createdAt: number },
  b: { date: string; time?: string; createdAt: number },
): number {
  const delta = txSortValue(b) - txSortValue(a);
  return delta !== 0 ? delta : b.createdAt - a.createdAt;
}

export function txWhen(tx: { date: string; time?: string }): string {
  return tx.time ? `${shortDate(tx.date)} · ${tx.time}` : shortDate(tx.date);
}

export function todayISO(): string {
  return toISO(new Date());
}

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function monthLabel(iso: string): string {
  return parseISO(`${iso.slice(0, 7)}-01`).toLocaleDateString(LOCALE, {
    month: 'long',
    year: 'numeric',
  });
}

export function dayLabel(iso: string): string {
  const d = parseISO(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (toISO(d) === toISO(today)) return 'Hari ini';
  if (toISO(d) === toISO(yesterday)) return 'Kemarin';
  return d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
}

export function shortDate(iso: string): string {
  return parseISO(iso).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function addMonths(iso: string, delta: number): string {
  const d = parseISO(iso);
  d.setMonth(d.getMonth() + delta);
  return toISO(d);
}

export function monthRange(iso: string): { from: string; to: string } {
  const d = parseISO(iso);
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { from: toISO(from), to: toISO(to) };
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}
