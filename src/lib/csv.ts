/**
 * CSV import parsing, powered by the Rust core.
 *
 * The browser only reads and preflights files. Header guessing, date and
 * amount parsing, deduplication and row validation all happen in Rust, so the
 * terminal and the app accept exactly the same files.
 */
import type { Tx, TxType } from './types';
import { core, parseCoreJson } from './rust';

export interface CsvTable {
  headers: string[];
  rows: string[][];
  delimiter: string;
}

export type CsvField =
  | 'date'
  | 'type'
  | 'amount'
  | 'category'
  | 'account'
  | 'toAccount'
  | 'fee'
  | 'note';

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

export type DateFormat = 'auto' | 'ymd' | 'dmy' | 'mdy';

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

/** RFC-4180 style parser: quoted fields, escaped quotes and embedded newlines. */
export function parseCsv(text: string, delimiter?: string): CsvTable {
  return parseCoreJson<CsvTable>(core().csv_parse(text, delimiter ?? null), 'csv_parse');
}

/** Best-effort mapping from header names, used to prefill the import form. */
export function guessMapping(headers: string[]): CsvMapping {
  return parseCoreJson<CsvMapping>(
    core().csv_guess_mapping(JSON.stringify(headers)),
    'csv_guess_mapping',
  );
}

/** Parse the common spreadsheet date shapes into YYYY-MM-DD. */
export function parseDateValue(raw: string, format: DateFormat = 'auto'): string | null {
  return core().csv_parse_date(raw, format) ?? null;
}

/** Parse a spreadsheet amount (currency symbols, grouping, parentheses). */
export function parseAmountValue(raw: string): number {
  return core().csv_parse_amount(raw);
}

export function buildImport(
  table: CsvTable,
  mapping: CsvMapping,
  options: ImportOptions,
  existing: Tx[] = [],
): ImportPreview {
  return parseCoreJson<ImportPreview>(
    core().csv_import_table(
      JSON.stringify(table),
      JSON.stringify(mapping),
      JSON.stringify(options),
      JSON.stringify(existing),
    ),
    'csv_import_table',
  );
}

export const CSV_TEMPLATE = [
  'Tanggal,Jenis,Kategori,Rekening,Tujuan,Jumlah,Biaya,Catatan',
  '2026-11-01,Pengeluaran,Makan & Minum,Dompet,,25000,0,Kopi pagi',
  '2026-11-02,Pendapatan,Gaji,BCA,,14500000,0,Gaji bulanan',
  '2026-11-03,Transfer,,BCA,Dompet,500000,6500,Isi dompet',
].join('\r\n');
