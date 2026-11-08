import type { Settings } from './types';

export const CURRENCY_OPTIONS: Array<{ value: Settings['currency']; label: string }> = [
  { value: 'IDR', label: 'IDR — Rupiah' },
  { value: 'USD', label: 'USD — Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'SGD', label: 'SGD — Singapore dollar' },
  { value: 'MYR', label: 'MYR — Ringgit' },
];

export const LANGUAGE_OPTIONS: Array<{ value: Settings['language']; label: string }> = [
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'en', label: 'English' },
];
