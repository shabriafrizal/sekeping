import type { Tx, TxType } from './types';

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

export interface CsvTable {
  headers: string[];
  rows: string[][];
  delimiter: string;
}

const DELIMITERS = [',', ';', '\t', '|'];

function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 8).join('\n');
  let best = ',';
  let bestCount = -1;
  for (const d of DELIMITERS) {
    let count = 0;
    let quoted = false;
    for (let i = 0; i < sample.length; i++) {
      const c = sample[i];
      if (c === '"') quoted = !quoted;
      else if (!quoted && c === d) count += 1;
    }
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

/** RFC-4180 style parser: quoted fields, escaped quotes and embedded newlines. */
export function parseCsv(text: string, delimiter?: string): CsvTable {
  const clean = text.replace(/^\uFEFF/, '');
  const sep = delimiter || detectDelimiter(clean);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      quoted = true;
    } else if (c === sep) {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c === '\r') {
      /* ignore CR; CRLF is handled by the following LF */
    } else {
      field += c;
    }
  }
  row.push(field);
  rows.push(row);

  const kept = rows.filter((r) => r.some((cell) => cell.trim() !== ''));
  const rawHeaders = kept.shift() ?? [];
  const headers = rawHeaders.map((h, i) => h.trim() || `Kolom ${i + 1}`);
  const body = kept.map((r) => {
    const copy = r.slice(0, headers.length);
    while (copy.length < headers.length) copy.push('');
    return copy;
  });

  return { headers, rows: body, delimiter: sep };
}

/* ------------------------------------------------------------------ */
/* Header mapping                                                      */
/* ------------------------------------------------------------------ */

export type CsvField = 'date' | 'type' | 'amount' | 'category' | 'account' | 'toAccount' | 'fee' | 'note';

export interface CsvFieldInfo {
  key: CsvField;
  label: string;
  hint: string;
  required?: boolean;
}

export const CSV_FIELDS: CsvFieldInfo[] = [
  { key: 'date', label: 'Tanggal', hint: 'YYYY-MM-DD, DD/MM/YYYY atau MM/DD/YYYY', required: true },
  { key: 'amount', label: 'Jumlah', hint: 'Angka; simbol mata uang dan pemisah ribuan diabaikan', required: true },
  { key: 'type', label: 'Jenis', hint: 'Pengeluaran, Pendapatan atau Transfer' },
  { key: 'category', label: 'Kategori', hint: 'Nama kategori; dibuat otomatis bila diizinkan' },
  { key: 'account', label: 'Rekening', hint: 'Nama rekening sumber' },
  { key: 'toAccount', label: 'Rekening tujuan', hint: 'Hanya untuk transfer' },
  { key: 'fee', label: 'Biaya', hint: 'Biaya admin transfer (opsional)' },
  { key: 'note', label: 'Catatan', hint: 'Keterangan transaksi' },
];

export type CsvMapping = Partial<Record<CsvField, number>>;

const ALIASES: Record<CsvField, string[]> = {
  date: ['tanggal', 'date', 'tgl', 'transactiondate', 'waktu', 'time', 'posteddate', 'valuedate'],
  amount: ['jumlah', 'nominal', 'amount', 'nilai', 'total', 'value', 'mutasi'],
  type: ['jenis', 'tipe', 'type', 'arah', 'direction', 'transactiontype', 'debitkredit'],
  category: ['kategori', 'category', 'kategoripengeluaran', 'kategoritransaksi', 'label'],
  account: ['rekening', 'akun', 'account', 'sumber', 'fromaccount', 'dompet', 'source'],
  toAccount: ['tujuan', 'kerekening', 'toaccount', 'destination', 'penerima'],
  fee: ['biaya', 'fee', 'admin', 'biayaadmin', 'charges'],
  note: ['catatan', 'keterangan', 'note', 'memo', 'deskripsi', 'description', 'remarks', 'detail'],
};

function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Best-effort mapping from header names, used to prefill the import form. */
export function guessMapping(headers: string[]): CsvMapping {
  const normalized = headers.map(normalizeHeader);
  const used = new Set<number>();
  const mapping: CsvMapping = {};

  for (const pass of ['exact', 'contains'] as const) {
    for (const field of CSV_FIELDS) {
      if (mapping[field.key] !== undefined) continue;
      const aliases = ALIASES[field.key];
      const index = normalized.findIndex((header, i) => {
        if (used.has(i) || !header) return false;
        return pass === 'exact' ? aliases.includes(header) : aliases.some((a) => a.length > 3 && header.includes(a));
      });
      if (index >= 0) {
        mapping[field.key] = index;
        used.add(index);
      }
    }
  }
  return mapping;
}

/* ------------------------------------------------------------------ */
/* Value parsing                                                       */
/* ------------------------------------------------------------------ */

export type DateFormat = 'auto' | 'ymd' | 'dmy' | 'mdy';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function validDate(y: number, m: number, d: number): string | null {
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** Parse the common spreadsheet date shapes into YYYY-MM-DD. */
export function parseDateValue(raw: string, format: DateFormat = 'auto'): string | null {
  const value = raw.trim();
  if (!value) return null;

  const iso = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const short = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})/);
  if (!short) return null;
  let a = Number(short[1]);
  let b = Number(short[2]);
  let year = Number(short[3]);
  if (year < 100) year += year >= 70 ? 1900 : 2000;

  let mode = format;
  if (mode === 'auto') {
    if (a > 12 && b <= 12) mode = 'dmy';
    else if (b > 12 && a <= 12) mode = 'mdy';
    else mode = 'dmy'; // Indonesian default
  }
  const day = mode === 'mdy' ? b : a;
  const month = mode === 'mdy' ? a : b;
  return validDate(year, month, day);
}

/** Read an amount with either Indonesian or English separators. */
export function parseAmountValue(raw: string): number {
  let value = raw.trim();
  if (!value) return Number.NaN;
  const negative = value.startsWith('-') || /^\(.*\)$/.test(value);
  value = value.replace(/[^\d.,-]/g, '').replace(/-/g, '');
  if (!value) return Number.NaN;

  const lastComma = value.lastIndexOf(',');
  const lastDot = value.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) value = value.replace(/\./g, '').replace(',', '.');
    else value = value.replace(/,/g, '');
  } else if (lastComma >= 0) {
    const decimals = value.split(',')[1];
    value = decimals && decimals.length !== 3 ? value.replace(',', '.') : value.replace(/,/g, '');
  } else if (lastDot >= 0) {
    const decimals = value.split('.')[1];
    if (!decimals || decimals.length === 3) value = value.replace(/\./g, '');
  }

  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return Number.NaN;
  return negative ? -n : n;
}

function normalizeType(raw: string): TxType | null {
  const value = normalizeHeader(raw);
  if (!value) return null;
  if (['pengeluaran', 'expense', 'keluar', 'keluaruang', 'debit', 'db', 'out', 'spending', 'belanja'].includes(value)) {
    return 'expense';
  }
  if (['pendapatan', 'income', 'masuk', 'masukuang', 'kredit', 'credit', 'cr', 'in', 'gaji'].includes(value)) {
    return 'income';
  }
  if (['transfer', 'pindah', 'pemindahan', 'topup', 'top', 'internal'].includes(value)) return 'transfer';
  return null;
}

function cell(row: string[], index: number | undefined): string {
  if (index === undefined || index < 0) return '';
  return (row[index] ?? '').trim();
}

/* ------------------------------------------------------------------ */
/* Row building                                                        */
/* ------------------------------------------------------------------ */

export interface ImportOptions {
  type: TxType;
  dateFormat: DateFormat;
  inferSign: boolean;
  dedupe: boolean;
}

export interface ParsedRow {
  line: number;
  date: string;
  type: TxType;
  amount: number;
  fee: number;
  account: string;
  toAccount: string;
  category: string;
  note: string;
  error?: string;
  duplicate?: boolean;
}

export interface ImportPreview {
  rows: ParsedRow[];
  valid: number;
  errors: number;
  duplicates: number;
}

export function buildImport(
  table: CsvTable,
  mapping: CsvMapping,
  options: ImportOptions,
  existing: Tx[] = [],
): ImportPreview {
  const seen = new Set(
    existing.map((tx) => `${tx.date}|${tx.type}|${tx.amount}|${tx.note.trim().toLowerCase()}`),
  );
  const rows: ParsedRow[] = [];
  let valid = 0;
  let errors = 0;
  let duplicates = 0;

  table.rows.forEach((row, i) => {
    const rawDate = cell(row, mapping.date);
    const rawAmount = cell(row, mapping.amount);
    const rawType = cell(row, mapping.type);
    const signed = parseAmountValue(rawAmount);
    const date = parseDateValue(rawDate, options.dateFormat);

    let type = normalizeType(rawType) ?? options.type;
    if (!normalizeType(rawType) && options.inferSign && !Number.isNaN(signed)) {
      if (signed < 0) type = 'expense';
      else if (signed > 0) type = 'income';
    }

    const amount = Math.abs(signed);
    let error: string | undefined;
    if (!rawDate) error = 'Tanggal kosong';
    else if (!date) error = `Tanggal tidak dikenali: ${rawDate}`;
    else if (!rawAmount) error = 'Jumlah kosong';
    else if (!Number.isFinite(amount) || amount <= 0) error = `Jumlah tidak valid: ${rawAmount}`;

    const account = cell(row, mapping.account);
    const toAccount = cell(row, mapping.toAccount);
    const category = cell(row, mapping.category);
    if (!error && type === 'transfer' && !toAccount) error = 'Transfer tanpa rekening tujuan';

    const key = date ? `${date}|${type}|${amount}|${cell(row, mapping.note).trim().toLowerCase()}` : '';
    const duplicate = Boolean(error) ? false : options.dedupe && seen.has(key);
    if (duplicate) duplicates += 1;
    else if (!error && key) seen.add(key);

    if (error) errors += 1;
    else if (!duplicate) valid += 1;

    rows.push({
      line: i + 2,
      date: date ?? '',
      type,
      amount,
      fee: Math.abs(parseAmountValue(cell(row, mapping.fee))) || 0,
      account,
      toAccount,
      category,
      note: cell(row, mapping.note),
      error,
      duplicate,
    });
  });

  return { rows, valid, errors, duplicates };
}

export const CSV_TEMPLATE = [
  'Tanggal,Jenis,Kategori,Rekening,Tujuan,Jumlah,Biaya,Catatan',
  '2026-11-01,Pengeluaran,Makan & Minum,Dompet,,25000,0,Kopi pagi',
  '2026-11-02,Pendapatan,Gaji,BCA,,14500000,0,Gaji bulanan',
  '2026-11-03,Transfer,,BCA,Dompet,500000,6500,Isi dompet',
].join('\r\n');
