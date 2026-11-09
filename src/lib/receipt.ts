import type { Account, Category, TxType } from './types';
import { currencyHasCents, todayISO, toISO } from './format';
import { t } from './i18n';

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

interface Mention {
  account: Account;
  index: number;
  source: boolean;
  target: boolean;
}

interface AmountCandidate {
  value: number;
  score: number;
  line: string;
  index: number;
}

const MONTHS: Record<string, number> = {
  jan: 1,
  januari: 1,
  january: 1,
  feb: 2,
  februari: 2,
  february: 2,
  mar: 3,
  maret: 3,
  march: 3,
  apr: 4,
  april: 4,
  mei: 5,
  may: 5,
  jun: 6,
  juni: 6,
  june: 6,
  jul: 7,
  juli: 7,
  july: 7,
  agu: 8,
  agt: 8,
  agustus: 8,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  okt: 10,
  oktober: 10,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  des: 12,
  desember: 12,
  dec: 12,
  december: 12,
};

/** Extra words people put around the account name on a receipt. */
const ACCOUNT_ALIASES: Record<string, string[]> = {
  bca: ['bca', 'bank central asia'],
  bri: ['bri', 'bank rakyat indonesia'],
  bni: ['bni', 'bank negara indonesia'],
  mandiri: ['mandiri', 'bank mandiri'],
  gopay: ['gopay', 'go pay'],
  ovo: ['ovo'],
  dana: ['dana'],
  shopeepay: ['shopeepay', 'shopee pay'],
  linkaja: ['linkaja', 'link aja'],
  jenius: ['jenius'],
  jago: ['jago', 'bank jago'],
  blu: ['blu', 'blu bca'],
  seabank: ['seabank', 'sea bank'],
  dompet: ['dompet', 'cash', 'tunai'],
};

const EXPENSE_HINTS: Array<[RegExp, string[]]> = [
  [/makan|minum|kopi|resto|restoran|warung|kafe|cafe|bakso|nasi|ayam|burger|pizza|gofood|grabfood|shopeefood/i, ['makan', 'minum', 'food', 'kopi']],
  [/transport|gojek|grab|bensin|pertalite|pertamax|parkir|tol|krl|mrt|lrt|transjakarta|ojek|taksi|taxi/i, ['transport', 'bensin']],
  [/listrik|pln|pdam|air|internet|indihome|pulsa|telkom|bpjs|tagihan|token|wifi/i, ['tagihan', 'listrik', 'internet', 'pulsa']],
  [/belanja|indomaret|alfamart|supermarket|tokopedia|shopee|lazada|mall|baju|sepatu|pakaian/i, ['belanja', 'shopping']],
  [/rumah|sewa|kos|kontrakan|perbaikan|furniture|perabot/i, ['rumah', 'home']],
  [/apotek|obat|dokter|klinik|rumah sakit|vitamin|kesehatan|lab/i, ['kesehatan', 'health', 'obat']],
  [/bioskop|cinema|game|netflix|spotify|hiburan|konser|film/i, ['hiburan', 'fun']],
  [/kursus|kelas|sekolah|kampus|buku|udemy|coursera|pendidikan/i, ['pendidikan', 'edu']],
  [/hadiah|kado|gift/i, ['hadiah', 'gift']],
];

const INCOME_HINTS: Array<[RegExp, string[]]> = [
  [/gaji|payroll|salary|upah|thr/i, ['gaji', 'salary']],
  [/bonus|tunjangan|insentif/i, ['bonus']],
  [/dividen|bunga|investasi|reksadana|saham|profit/i, ['investasi', 'invest']],
];

const TRANSFER_WORDS = /(transfer|kirim uang|kirim dana|pindah buku|antar rekening|ke rekening|dari rekening|sumber dana|tujuan|penerima|top ?up|isi saldo)/gi;
const INCOME_WORDS = /(dana masuk|uang masuk|transfer masuk|diterima|penerimaan|pendapatan|pemasukan|kredit|gaji|salary|bonus|refund|cashback|top ?up|isi saldo|terima dari)/gi;
const EXPENSE_WORDS = /(pengeluaran|pembayaran|pembelian|bayar|belanja|debit|qris|tarik tunai|transfer keluar|kirim uang|merchant|struk|total bayar|nominal transfer)/gi;

const BOILERPLATE =
  /^(bukti|struk|resi|invoice|nota|detail|transaksi|transfer|pembayaran|pembelian|berhasil|sukses|selesai|status|tanggal|waktu|jam|no\.?|nomor|ref|referensi|kode|metode|sumber|dari|ke|tujuan|penerima|pengirim|nama|merchant|toko|keterangan|berita|deskripsi|catatan|total|jumlah|nominal|subtotal|saldo|admin|biaya|fee|ppn|pajak|diskon|kembalian|tunai|cash|debit|kredit|terima kasih|selamat datang|halo|bank|atm|qris|nobu|virtual account|va)\b/i;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function cleanLines(text: string): string[] {
  return text
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((line) => line.replace(/^[|:;_\-•*·]+\s*/, '').trim())
    .filter((line) => line.length > 0);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function amountFromToken(raw: string, currency: string): number {
  let token = raw.trim().replace(/[^\d.,]/g, '');
  if (!token) return 0;
  const cents = currencyHasCents(currency);

  if (!cents) {
    // Rupiah has no cents: "1.234.567,00" is 1,234,567, not 1,234,567,000.
    token = token.replace(/[.,]00$/, '');
    const whole = Number(token.replace(/\D/g, ''));
    return Number.isFinite(whole) ? whole : 0;
  }

  const lastComma = token.lastIndexOf(',');
  const lastDot = token.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) token = token.replace(/\./g, '').replace(',', '.');
    else token = token.replace(/,/g, '');
  } else if (lastComma >= 0) {
    token = token.replace(',', '.');
  }
  const value = Number.parseFloat(token);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

function scoreAmount(line: string, raw: string, value: number, currency: string, index: number): number {
  if (!Number.isFinite(value) || value <= 0 || value > 1_000_000_000_000) return -1;
  let score = 0;
  const lower = line.toLowerCase();
  const digits = raw.replace(/\D/g, '');

  if (/(total|jumlah|nominal|amount|grand total|jumlah bayar|total bayar|jumlah transfer|nominal transfer)/i.test(lower)) score += 0.55;
  if (/nominal|jumlah transfer|nominal transfer/i.test(lower)) score += 0.2;
  if (/(bayar|dibayar|pembayaran|transfer|tagihan|diterima|masuk|kredit)/i.test(lower)) score += 0.15;
  if (/(saldo|balance)/i.test(lower) && !/total/i.test(lower)) score -= 0.35;
  if (/(admin|biaya|fee|ppn|pajak|diskon|kembalian|tunai|cash)/i.test(lower)) score -= 0.4;
  if (/(rp|idr|usd|sgd|myr|eur|\$|€)/i.test(raw)) score += 0.25;
  if (digits.length > 12) score -= 0.6;
  if (digits.length >= 10 && !/[.,]/.test(raw)) score -= 0.4;
  if (value >= 1_000) score += 0.08;
  if (value >= 10_000) score += 0.08;
  if (value >= 1900 && value <= 2100 && !/[.,]/.test(raw)) score -= 0.45;
  if (!currencyHasCents(currency) && value < 100 && !/(rp|idr)/i.test(raw)) score -= 0.15;
  score += index * 0.002;
  return score;
}

function findAmount(lines: string[], currency: string): { value: number; line: string } | null {
  const candidates: AmountCandidate[] = [];
  const tokenPattern = /(?:rp\.?|idr|usd|sgd|myr|eur|\$|€)?\s*\d[\d.,]*\d|\d/g;

  lines.forEach((line, index) => {
    // A date is not money.
    if (/\b\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4}\b/.test(line) && !/(rp|idr|total|jumlah|nominal|bayar)/i.test(line)) return;
    const matches = line.match(tokenPattern) ?? [];
    for (const raw of matches) {
      const value = amountFromToken(raw, currency);
      const score = scoreAmount(line, raw, value, currency, index);
      if (score >= 0) candidates.push({ value, score, line, index });
    }
  });

  // If several lines repeat the same number (subtotal + total), keep the best.
  const byValue = new Map<number, AmountCandidate>();
  for (const candidate of candidates) {
    const previous = byValue.get(candidate.value);
    if (!previous || previous.score < candidate.score) byValue.set(candidate.value, candidate);
  }
  const best = [...byValue.values()].sort((a, b) => b.score - a.score)[0];
  return best ? { value: best.value, line: best.line } : null;
}

function makeDate(year: number, month: number, day: number): string | null {
  if (year < 100) year += 2000;
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return toISO(date);
}

function findDate(text: string): string | null {
  const yearFirst = text.match(/\b(20\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/);
  if (yearFirst) {
    const value = makeDate(Number(yearFirst[1]), Number(yearFirst[2]), Number(yearFirst[3]));
    if (value) return value;
  }

  const numeric = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if (numeric) {
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    const year = Number(numeric[3]);
    // Indonesian receipts are day-first. Flip only when the first part cannot be a day.
    const day = first > 12 && second <= 12 ? second : first;
    const month = first > 12 && second <= 12 ? first : second;
    const value = makeDate(year, month, day);
    if (value) return value;
  }

  const named = text.match(
    /\b(\d{1,2})\s+(jan(?:uari)?|feb(?:ruari)?|mar(?:et)?|apr(?:il)?|mei|may|jun(?:i|e)?|jul(?:i|y)?|agu(?:stus)?|agt|aug(?:ust)?|sep(?:t(?:ember)?)?|okt(?:ober)?|oct(?:ober)?|nov(?:ember)?|des(?:ember)?|dec(?:ember)?)\s+(\d{2,4})\b/i,
  );
  if (named) {
    const month = MONTHS[named[2].toLowerCase()];
    const value = month ? makeDate(Number(named[3]), month, Number(named[1])) : null;
    if (value) return value;
  }

  return null;
}

function findTime(text: string): string | null {
  const match = text.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)(?::[0-5]\d)?\b/);
  if (!match) return null;
  return `${String(Number(match[1])).padStart(2, '0')}:${match[2]}`;
}

function aliasesFor(account: Account): string[] {
  const name = normalize(account.name);
  const result = new Set<string>([name]);
  const compact = name.replace(/\s+/g, '');
  result.add(compact);
  for (const [key, aliases] of Object.entries(ACCOUNT_ALIASES)) {
    if (name.includes(key) || compact.includes(key) || aliases.some((alias) => name.includes(alias))) {
      for (const alias of aliases) result.add(alias);
    }
  }
  return [...result].filter((alias) => alias.length >= 2);
}

function findAccounts(text: string, accounts: Account[]): Mention[] {
  const lower = text.toLowerCase();
  const mentions: Mention[] = [];
  for (const account of accounts) {
    let index = -1;
    for (const alias of aliasesFor(account)) {
      const at = lower.indexOf(alias);
      if (at >= 0 && (index < 0 || at < index)) index = at;
    }
    if (index < 0) continue;
    const before = lower.slice(Math.max(0, index - 42), index);
    const after = lower.slice(index, index + 64);
    const source = /(dari|sumber|asal|pengirim|rekening sumber|rekening asal|didebit|debit dari)\s*[:\-]?\s*$/.test(before);
    const target = /^\s*[:\-]?\s*(ke|tujuan|penerima|rekening tujuan|masuk ke|dikirim ke|transfer ke)\b/.test(after);
    mentions.push({ account, index, source, target });
  }
  return mentions.sort((a, b) => a.index - b.index);
}

function categoryTypeFor(type: TxType): 'expense' | 'income' | null {
  if (type === 'transfer') return null;
  return type;
}

function hintScore(text: string, hints: string[]): number {
  let score = 0;
  for (const hint of hints) {
    if (text.includes(hint)) score += 1;
  }
  return score;
}

function findCategory(
  text: string,
  categories: Category[],
  type: TxType,
): { category: Category | null; score: number } {
  const wanted = categoryTypeFor(type);
  if (!wanted) return { category: null, score: 0 };
  const lower = text.toLowerCase();
  const list = categories.filter((category) => category.active && category.type === wanted);
  let best: Category | null = null;
  let bestScore = 0;
  const hints = type === 'expense' ? EXPENSE_HINTS : INCOME_HINTS;

  for (const category of list) {
    let score = 0;
    const name = normalize(category.name);
    if (name && lower.includes(name)) score += 3;
    for (const part of name.split(' ')) {
      if (part.length >= 3 && lower.includes(part)) score += 1;
    }
    for (const [pattern, words] of hints) {
      if (pattern.test(lower)) {
        const overlapping = words.filter((word) => name.includes(word) || lower.includes(`${word} ${name}`));
        if (overlapping.length > 0) score += 2;
      }
    }
    if (score > bestScore) {
      best = category;
      bestScore = score;
    }
  }
  return { category: bestScore > 0 ? best : null, score: bestScore };
}

function guessType(text: string, mentions: Mention[], amountLine: string): { type: TxType; score: number; signal: string } {
  const lower = text.toLowerCase();
  const source = mentions.find((mention) => mention.source);
  const target = mentions.find((mention) => mention.target && mention.account.id !== source?.account.id);
  const bothOwn = Boolean(source && target);
  const targetOwn = mentions.some((mention) => mention.target);
  const transferHits = (lower.match(TRANSFER_WORDS) ?? []).length;
  const incomeHits = (lower.match(INCOME_WORDS) ?? []).length;
  const expenseHits = (lower.match(EXPENSE_WORDS) ?? []).length;

  let transfer = transferHits * 1.1;
  if (bothOwn) transfer += 4;
  else if (targetOwn && /transfer|top ?up|isi saldo|pindah/i.test(lower)) transfer += 2;
  if (/(transfer|pindah buku|top ?up)/i.test(amountLine)) transfer += 0.8;

  let income = incomeHits * 1.2;
  if (source && /(masuk|diterima|terima|dari)/i.test(lower)) income += 1.2;
  if (/(gaji|salary|payroll|bonus|dividen|bunga|cashback|refund)/i.test(lower)) income += 1.6;

  let expense = expenseHits * 1.2;
  if (/(merchant|struk|toko|resto|kafe|kopi|belanja|pembayaran|qris)/i.test(lower)) expense += 1.4;
  if (mentions.length === 1 && mentions[0].source) expense += 0.5;

  // A named destination that is not one of the person's accounts means money
  // left the ledger: treat it as spending, not an internal transfer.
  if (/transfer/i.test(lower) && !bothOwn) {
    expense += 0.4;
    transfer -= 0.8;
  }

  if (transfer >= income && transfer >= expense && transfer > 0) {
    return { type: 'transfer', score: transfer, signal: t('Kata kunci transfer dan rekening tujuan cocok') };
  }
  if (income > expense) {
    return { type: 'income', score: income, signal: t('Kata kunci uang masuk cocok') };
  }
  return { type: 'expense', score: Math.max(expense, 0.2), signal: t('Kata kunci pembayaran cocok') };
}

function findNote(
  lines: string[],
  type: TxType,
  account: Account | undefined,
  toAccount: Account | undefined,
): string {
  const candidates = lines
    .map((line) => line.replace(/^([a-z ]+)\s*[:\-]\s*/i, (whole, label: string) =>
      /^(merchant|toko|nama|penerima|berita|keterangan|deskripsi|catatan|untuk)$/i.test(label.trim()) ? '' : whole,
    ))
    .map((line) => line.replace(/\s{2,}/g, ' ').trim())
    .filter((line) => {
      if (line.length < 3 || line.length > 80) return false;
      if (!/[a-z]/i.test(line)) return false;
      if (BOILERPLATE.test(line)) return false;
      if (/\b(rp|idr)\s*\d/i.test(line)) return false;
      if (/^\d/.test(line) && !/[a-z]{3}/i.test(line)) return false;
      return true;
    });

  const prioritized = candidates.find((line) =>
    /(kopi|resto|restoran|kafe|cafe|warung|toko|merchant|mart|market|apotek|klinik|bioskop|hotel|travel|shop|store|bakso|nasi|ayam|pizza|burger)/i.test(line),
  );
  let note = prioritized ?? candidates[0] ?? '';

  if (type === 'transfer') {
    if (toAccount) note = t('Transfer ke {name}', { name: toAccount.name });
    else if (note) note = t('Transfer · {note}', { note });
    else note = t('Transfer');
  } else if (type === 'income' && account && !note) {
    note = t('Dana masuk ke {name}', { name: account.name });
  }

  return note.replace(/[|;]+$/g, '').trim().slice(0, 80);
}

/**
 * Read receipit text without any network call. The amount, date and time come
 * from conservative regexes; type, account and category use the person's own
 * ledger names and a small keyword map. Everything is returned as a draft so
 * the confirmation screen can show and edit it before saving.
 */
export function parseReceiptText(text: string, options: ReceiptParseOptions): ReceiptDraft {
  const { accounts, categories, currency } = options;
  const clean = text.replace(/\u00a0/g, ' ').trim();
  const lines = cleanLines(clean);
  const flat = lines.join('\n');
  const today = options.today ?? todayISO();

  const amount = findAmount(lines, currency);
  const date = findDate(flat);
  const time = findTime(flat);
  const mentions = findAccounts(flat, accounts);

  const typeGuess = guessType(flat, mentions, amount?.line ?? '');
  let type = typeGuess.type;

  let account: Account | undefined;
  let toAccount: Account | undefined;

  const source = mentions.find((mention) => mention.source);
  const target = mentions.find((mention) => mention.target && mention.account.id !== source?.account.id);

  if (type === 'transfer') {
    account = source?.account ?? (target ? undefined : mentions[0]?.account);
    toAccount = target?.account ?? mentions.find((mention) => mention.account.id !== account?.id)?.account;
    if (!account && toAccount) {
      account = accounts.find((candidate) => candidate.id !== toAccount?.id && candidate.active);
    }
    if (!toAccount) {
      // A transfer needs two sides. Without a second own account the receipt
      // is more likely a payment to someone else.
      type = 'expense';
    }
  } else if (type === 'income') {
    account = target?.account ?? mentions[0]?.account;
  } else {
    account = source?.account ?? mentions[0]?.account;
  }

  if (!account) {
    account =
      accounts.find((candidate) => candidate.active && candidate.id === options.defaultAccountId) ??
      accounts.find((candidate) => candidate.active) ??
      accounts[0];
  }
  if (type === 'transfer' && (!toAccount || toAccount.id === account?.id)) {
    toAccount = accounts.find((candidate) => candidate.active && candidate.id !== account?.id);
    if (!toAccount) type = 'expense';
  }

  const categoryResult = findCategory(flat, categories, type);
  const category =
    type === 'transfer'
      ? undefined
      : categoryResult.category ??
        categories.find((candidate) => candidate.active && candidate.type === type && candidate.id === 'cat_other_in') ??
        categories.find((candidate) => candidate.active && candidate.type === type);

  const note = findNote(lines, type, account, toAccount);

  const matches = {
    amount: Boolean(amount),
    date: Boolean(date),
    time: Boolean(time),
    note: Boolean(note),
    account: Boolean(account && (source || target || mentions.length > 0)),
    category: Boolean(categoryResult.category),
    type: typeGuess.score >= 1.2,
  };

  const signals: string[] = [];
  if (amount) signals.push(t('Nominal {amount} terbaca', { amount: amount.value.toLocaleString('id-ID') }));
  if (date) signals.push(t('Tanggal {date} terbaca', { date }));
  if (time) signals.push(t('Waktu {time} terbaca', { time }));
  if (mentions.length > 0) {
    signals.push(t('Rekening disebut: {name}', { name: mentions.map((mention) => mention.account.name).join(', ') }));
  }
  if (type === 'transfer' && toAccount) signals.push(t('Arah: transfer ke {name}', { name: toAccount.name }));
  if (categoryResult.category) signals.push(t('Kategori cocok: {name}', { name: categoryResult.category.name }));
  if (typeGuess.score >= 1.2) signals.push(typeGuess.signal);

  let confidence = 0.28;
  if (amount) confidence += 0.27;
  if (date) confidence += 0.09;
  if (time) confidence += 0.04;
  if (matches.account) confidence += 0.13;
  if (matches.category) confidence += 0.13;
  if (matches.type) confidence += 0.08;
  confidence = Math.min(0.95, Math.round(confidence * 100) / 100);

  return {
    type,
    amount: amount?.value ?? 0,
    accountId: account?.id ?? '',
    toAccountId: type === 'transfer' ? toAccount?.id ?? '' : '',
    categoryId: type === 'transfer' ? '' : category?.id ?? '',
    date: date ?? today,
    time: time ?? '',
    note,
    confidence,
    signals,
    matches,
  };
}
