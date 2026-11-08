const LOCALE = 'id-ID';

const currencySymbols: Record<string, string> = {
  IDR: 'Rp',
  USD: '$',
  EUR: '€',
  SGD: 'S$',
  MYR: 'RM',
};

export function money(value: number, currency = 'IDR'): string {
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

export function compactMoney(value: number, currency = 'IDR'): string {
  const n = Math.abs(value);
  const sym = currencySymbols[currency] ?? '';
  const sign = value < 0 ? '−' : '';
  if (n >= 1_000_000_000) return `${sign}${sym} ${(n / 1_000_000_000).toFixed(1).replace('.', ',')} M`;
  if (n >= 1_000_000) return `${sign}${sym} ${(n / 1_000_000).toFixed(1).replace('.', ',')} jt`;
  if (n >= 1_000) return `${sign}${sym} ${(n / 1_000).toFixed(0)} rb`;
  return `${sign}${sym} ${n}`;
}

export function plainNumber(value: number): string {
  return Math.abs(value).toLocaleString(LOCALE);
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
