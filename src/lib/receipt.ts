/**
 * Receipt scanning, powered by the Rust core.
 *
 * The parser reads amounts, dates, times, the person's own account names and a
 * small keyword map. Everything is local: no message, image or text leaves the
 * device. The draft is always editable before it becomes a transaction.
 */
import type { Account, Category, TxType } from './types';
import { isEnglish } from './i18n';
import { core, parseCoreJson } from './rust';

/** What one receipt scan guessed, before the person confirms it. */
export interface ReceiptDraft {
  type: TxType;
  amount: number;
  accountId: string;
  toAccountId: string;
  categoryId: string;
  date: string;
  time: string;
  note: string;
  confidence: number;
  signals: string[];
  matches: {
    amount: boolean;
    date: boolean;
    time: boolean;
    note: boolean;
    account: boolean;
    category: boolean;
    type: boolean;
  };
}

export interface ReceiptParseOptions {
  accounts: Account[];
  categories: Category[];
  currency: string;
  today?: string;
  defaultAccountId?: string;
}

/** Read receipt text without any network call. */
export function parseReceiptText(text: string, options: ReceiptParseOptions): ReceiptDraft {
  const payload = {
    ...options,
    language: isEnglish() ? 'en' : 'id',
  };
  return parseCoreJson<ReceiptDraft>(
    core().receipt_parse(text, JSON.stringify(payload)),
    'receipt_parse',
  );
}
