/* tslint:disable */
/* eslint-disable */

/**
 * Move an ISO date forward by one interval.
 */
export function advance_date(iso: string, interval: string): string | undefined;

/**
 * Net worth and per-account balances.
 */
export function balances(state_json: string): string;

/**
 * Progress for every active budget in `month` (`YYYY-MM`).
 */
export function budget_progress(state_json: string, month: string): string;

/**
 * Progress for one budget, used by the budget list.
 */
export function budget_progress_one(budget_json: string, txs_json: string, month: string, category_json: string): string;

/**
 * Category totals for one type, optionally bounded by ISO dates.
 */
export function category_totals(state_json: string, kind: string, from: string, to: string): string;

/**
 * Check that a category type string is understood by the core.
 */
export function category_type_of(value: string): string;

/**
 * Version of the core crate, useful for diagnostics in the browser.
 */
export function core_version(): string;

/**
 * Guess which header belongs to which import field.
 */
export function csv_guess_mapping(headers_json: string): string;

/**
 * Build an import preview without touching the ledger.
 */
export function csv_import(text: string, mapping_json: string, options_json: string, existing_json: string): string;

/**
 * Build an import preview from an already parsed table.
 */
export function csv_import_table(table_json: string, mapping_json: string, options_json: string, existing_json: string): string;

/**
 * Parse CSV text into `{headers, rows, delimiter}`.
 */
export function csv_parse(text: string, delimiter?: string | null): string;

/**
 * Parse one spreadsheet amount. Returns `NaN` when it cannot be read.
 */
export function csv_parse_amount(raw: string): number;

/**
 * Parse one spreadsheet date into `YYYY-MM-DD` (or nothing).
 */
export function csv_parse_date(raw: string, format: string): string | undefined;

/**
 * Decrypt an envelope produced by the browser or this crate.
 */
export function decrypt_backup(envelope: string, password: string): string;

/**
 * Encrypt a JSON backup with a password. Returns the envelope JSON.
 */
export function encrypt_backup(plaintext: string, password: string): string;

/**
 * Export transactions as CSV. Pass empty strings for default filters/labels.
 */
export function export_csv(state_json: string, filters_json: string, labels_json: string): string;

export function format_compact_money(value: number, currency: string, locale: string): string;

export function format_compact_number(value: number, locale: string): string;

/**
 * Format money for a locale (`id-ID`, `en-US`).
 */
export function format_money(value: number, currency: string, locale: string): string;

export function format_number(value: number, locale: string): string;

export function is_encrypted_backup(text: string): boolean;

/**
 * Parse a `YYYY-MM` key and return its first/last ISO days.
 */
export function month_days(month: string): string;

/**
 * Monthly income and expense totals between two ISO dates.
 */
export function month_totals(state_json: string, from: string, to: string): string;

/**
 * The last `count` months of totals for one type, oldest first.
 */
export function monthly_trend(state_json: string, kind: string, end_month: string, count: number): string;

/**
 * Normalize any backup object into the current state shape.
 */
export function normalize_state(state_json: string): string;

/**
 * Parse a typed amount exactly like the amount field does.
 */
export function parse_amount(raw: string, currency: string): number;

/**
 * Read a receipt into an editable draft. No network, no storage.
 */
export function receipt_parse(text: string, options_json: string): string;

export function recurring_days_until_next(item_json: string, today: string): bigint | undefined;

/**
 * Transactions that are due now, plus the next date per recurring item.
 */
export function recurring_due(state_json: string, today: string): string;

export function recurring_due_count(item_json: string, today: string): number;

/**
 * Dates on which a recurring item is due up to `today`.
 */
export function recurring_due_dates(item_json: string, today: string): string;

/**
 * First occurrence for a new recurring item.
 */
export function recurring_initial_next_date(start_date: string, interval: string, today: string): string | undefined;

export function recurring_is_due(item_json: string, today: string): boolean;

export function recurring_monthly_equivalent(item_json: string): number;

/**
 * Ledger totals, account count and date span.
 */
export function summary(state_json: string): string;

/**
 * Validate a raw backup without loading it into the app.
 */
export function validate_backup(text: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly advance_date: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly balances: (a: number, b: number, c: number) => void;
    readonly budget_progress: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly budget_progress_one: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
    readonly category_totals: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
    readonly category_type_of: (a: number, b: number, c: number) => void;
    readonly core_version: (a: number) => void;
    readonly csv_guess_mapping: (a: number, b: number, c: number) => void;
    readonly csv_import: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
    readonly csv_import_table: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
    readonly csv_parse: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly csv_parse_amount: (a: number, b: number) => number;
    readonly csv_parse_date: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly decrypt_backup: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly encrypt_backup: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly export_csv: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly format_compact_money: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly format_compact_number: (a: number, b: number, c: number, d: number) => void;
    readonly format_money: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly format_number: (a: number, b: number, c: number, d: number) => void;
    readonly is_encrypted_backup: (a: number, b: number) => number;
    readonly month_days: (a: number, b: number, c: number) => void;
    readonly month_totals: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly monthly_trend: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly normalize_state: (a: number, b: number, c: number) => void;
    readonly parse_amount: (a: number, b: number, c: number, d: number) => number;
    readonly receipt_parse: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly recurring_days_until_next: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly recurring_due: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly recurring_due_count: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly recurring_due_dates: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly recurring_initial_next_date: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly recurring_is_due: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly recurring_monthly_equivalent: (a: number, b: number, c: number) => void;
    readonly summary: (a: number, b: number, c: number) => void;
    readonly validate_backup: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export: (a: number) => void;
    readonly __wbindgen_export2: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export3: (a: number, b: number) => number;
    readonly __wbindgen_export4: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_export5: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export6: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
