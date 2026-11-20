//! RFC-4180 CSV import, header mapping and row validation.

use std::sync::LazyLock;

use chrono::Datelike;
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use unicode_normalization::UnicodeNormalization;

use crate::model::{Tx, TxType};
use crate::money::parse_amount_value;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CsvTable {
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
    pub delimiter: String,
}

const DELIMITERS: [char; 4] = [',', ';', '\t', '|'];

pub fn detect_delimiter(text: &str) -> char {
    let sample: String = text
        .split('\n')
        .take(8)
        .map(|line| line.strip_suffix('\r').unwrap_or(line))
        .collect::<Vec<_>>()
        .join("\n");
    let mut best = ',';
    let mut best_count: i64 = -1;
    for delimiter in DELIMITERS {
        let mut count = 0;
        let mut quoted = false;
        for ch in sample.chars() {
            if ch == '"' {
                quoted = !quoted;
            } else if !quoted && ch == delimiter {
                count += 1;
            }
        }
        if count > best_count {
            best = delimiter;
            best_count = count;
        }
    }
    best
}

/// RFC-4180 style parser: quoted fields, escaped quotes and embedded newlines.
pub fn parse_csv(text: &str, delimiter: Option<char>) -> CsvTable {
    let clean = text.strip_prefix('\u{feff}').unwrap_or(text);
    let separator = delimiter.unwrap_or_else(|| detect_delimiter(clean));
    let mut rows: Vec<Vec<String>> = Vec::new();
    let mut row: Vec<String> = Vec::new();
    let mut field = String::new();
    let mut quoted = false;
    let mut chars = clean.chars().peekable();

    while let Some(ch) = chars.next() {
        if quoted {
            if ch == '"' {
                if chars.peek() == Some(&'"') {
                    field.push('"');
                    chars.next();
                } else {
                    quoted = false;
                }
            } else {
                field.push(ch);
            }
            continue;
        }
        if ch == '"' {
            quoted = true;
        } else if ch == separator {
            row.push(std::mem::take(&mut field));
        } else if ch == '\n' {
            row.push(std::mem::take(&mut field));
            rows.push(std::mem::take(&mut row));
        } else if ch == '\r' {
            // CRLF is handled by the following LF.
        } else {
            field.push(ch);
        }
    }
    row.push(field);
    rows.push(row);

    let mut kept: Vec<Vec<String>> = rows
        .into_iter()
        .filter(|cells| cells.iter().any(|cell| !cell.trim().is_empty()))
        .collect();
    let raw_headers = if kept.is_empty() {
        Vec::new()
    } else {
        kept.remove(0)
    };
    let headers: Vec<String> = raw_headers
        .iter()
        .enumerate()
        .map(|(index, header)| {
            let trimmed = header.trim();
            if trimmed.is_empty() {
                format!("Kolom {}", index + 1)
            } else {
                trimmed.to_string()
            }
        })
        .collect();
    let body: Vec<Vec<String>> = kept
        .into_iter()
        .map(|mut cells| {
            cells.truncate(headers.len());
            while cells.len() < headers.len() {
                cells.push(String::new());
            }
            cells
        })
        .collect();

    CsvTable {
        headers,
        rows: body,
        delimiter: separator.to_string(),
    }
}

const FIELDS: [&str; 8] = [
    "date",
    "type",
    "amount",
    "category",
    "account",
    "toAccount",
    "fee",
    "note",
];

const ALIASES: [(&str, &[&str]); 8] = [
    (
        "date",
        &[
            "tanggal",
            "date",
            "tgl",
            "transactiondate",
            "waktu",
            "time",
            "posteddate",
            "valuedate",
        ],
    ),
    (
        "amount",
        &[
            "jumlah", "nominal", "amount", "nilai", "total", "value", "mutasi",
        ],
    ),
    (
        "type",
        &[
            "jenis",
            "tipe",
            "type",
            "arah",
            "direction",
            "transactiontype",
            "debitkredit",
        ],
    ),
    (
        "category",
        &[
            "kategori",
            "category",
            "kategoripengeluaran",
            "kategoritransaksi",
            "label",
        ],
    ),
    (
        "account",
        &[
            "rekening",
            "akun",
            "account",
            "sumber",
            "fromaccount",
            "dompet",
            "source",
        ],
    ),
    (
        "toAccount",
        &[
            "tujuan",
            "kerekening",
            "toaccount",
            "destination",
            "penerima",
        ],
    ),
    ("fee", &["biaya", "fee", "admin", "biayaadmin", "charges"]),
    (
        "note",
        &[
            "catatan",
            "keterangan",
            "note",
            "memo",
            "deskripsi",
            "description",
            "remarks",
            "detail",
        ],
    ),
];

fn normalize_header(value: &str) -> String {
    value
        .to_lowercase()
        .nfd()
        .filter(|ch| !('\u{0300}'..='\u{036f}').contains(ch))
        .filter(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit())
        .collect()
}

/// Best-effort mapping from header names, used to prefill the import form.
pub fn guess_mapping(headers: &[String]) -> Map<String, Value> {
    let normalized: Vec<String> = headers
        .iter()
        .map(|header| normalize_header(header))
        .collect();
    let mut used = vec![false; headers.len()];
    let mut mapping = Map::new();

    for pass in ["exact", "contains"] {
        for field in FIELDS {
            if mapping.contains_key(field) {
                continue;
            }
            let aliases = ALIASES
                .iter()
                .find(|(key, _)| *key == field)
                .map(|(_, aliases)| *aliases)
                .unwrap_or(&[]);
            let found = normalized.iter().enumerate().find(|(index, header)| {
                if used[*index] || header.is_empty() {
                    return false;
                }
                if pass == "exact" {
                    aliases.contains(&header.as_str())
                } else {
                    aliases
                        .iter()
                        .any(|alias| alias.len() > 3 && header.contains(alias))
                }
            });
            if let Some((index, _)) = found {
                mapping.insert(field.to_string(), Value::from(index));
                used[index] = true;
            }
        }
    }
    mapping
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DateFormat {
    #[default]
    Auto,
    Ymd,
    Dmy,
    Mdy,
}

fn pad2(n: u32) -> String {
    format!("{n:02}")
}

fn valid_date(y: i32, m: u32, d: u32) -> Option<String> {
    if !(1900..=2200).contains(&y) || !(1..=12).contains(&m) || !(1..=31).contains(&d) {
        return None;
    }
    let date = chrono::NaiveDate::from_ymd_opt(y, m, d)?;
    Some(format!("{:04}-{}-{}", date.year(), pad2(m), pad2(d)))
}

static ISO_DATE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})").expect("static ISO date regex")
});
static SHORT_DATE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})").expect("static short date regex")
});

/// Parse the common spreadsheet date shapes into `YYYY-MM-DD`.
pub fn parse_date_value(raw: &str, format: DateFormat) -> Option<String> {
    let value = raw.trim();
    if value.is_empty() {
        return None;
    }

    if let Some(caps) = ISO_DATE.captures(value) {
        let y = caps.get(1)?.as_str().parse().ok()?;
        let m = caps.get(2)?.as_str().parse().ok()?;
        let d = caps.get(3)?.as_str().parse().ok()?;
        return valid_date(y, m, d);
    }

    let caps = SHORT_DATE.captures(value)?;
    let a: i32 = caps.get(1)?.as_str().parse().ok()?;
    let b: i32 = caps.get(2)?.as_str().parse().ok()?;
    let mut year: i32 = caps.get(3)?.as_str().parse().ok()?;
    if year < 100 {
        year += if year >= 70 { 1900 } else { 2000 };
    }

    let mode = match format {
        DateFormat::Auto => {
            if a > 12 && b <= 12 {
                DateFormat::Dmy
            } else if b > 12 && a <= 12 {
                DateFormat::Mdy
            } else {
                DateFormat::Dmy
            }
        }
        other => other,
    };
    let (day, month) = if mode == DateFormat::Mdy {
        (b, a)
    } else {
        (a, b)
    };
    valid_date(year, month.max(0) as u32, day.max(0) as u32)
}

fn normalize_type(raw: &str) -> Option<TxType> {
    let value = normalize_header(raw);
    if value.is_empty() {
        return None;
    }
    const EXPENSE: &[&str] = &[
        "pengeluaran",
        "expense",
        "keluar",
        "keluaruang",
        "debit",
        "db",
        "out",
        "spending",
        "belanja",
    ];
    const INCOME: &[&str] = &[
        "pendapatan",
        "income",
        "masuk",
        "masukuang",
        "kredit",
        "credit",
        "cr",
        "in",
        "gaji",
    ];
    const TRANSFER: &[&str] = &[
        "transfer",
        "pindah",
        "pemindahan",
        "topup",
        "top",
        "internal",
    ];
    if EXPENSE.contains(&value.as_str()) {
        Some(TxType::Expense)
    } else if INCOME.contains(&value.as_str()) {
        Some(TxType::Income)
    } else if TRANSFER.contains(&value.as_str()) {
        Some(TxType::Transfer)
    } else {
        None
    }
}

fn cell(row: &[String], index: Option<usize>) -> String {
    index
        .and_then(|i| row.get(i))
        .map(|value| value.trim().to_string())
        .unwrap_or_default()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportOptions {
    #[serde(rename = "type")]
    pub kind: TxType,
    pub date_format: DateFormat,
    pub infer_sign: bool,
    pub dedupe: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedRow {
    pub line: usize,
    pub date: String,
    #[serde(rename = "type")]
    pub kind: TxType,
    pub amount: f64,
    pub fee: f64,
    pub account: String,
    pub to_account: String,
    pub category: String,
    pub note: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duplicate: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreview {
    pub rows: Vec<ParsedRow>,
    pub valid: usize,
    pub errors: usize,
    pub duplicates: usize,
}

fn js_number(value: f64) -> String {
    if value == 0.0 {
        "0".into()
    } else {
        format!("{value}")
    }
}

fn dedupe_key(date: &str, kind: TxType, amount: f64, note: &str) -> String {
    format!(
        "{date}|{}|{}|{}",
        kind.as_str(),
        js_number(amount),
        note.trim().to_lowercase()
    )
}

pub fn build_import(
    table: &CsvTable,
    mapping: &Map<String, Value>,
    options: &ImportOptions,
    existing: &[Tx],
) -> ImportPreview {
    let index = |key: &str| mapping.get(key).and_then(Value::as_u64).map(|v| v as usize);
    let mut seen: Vec<String> = existing
        .iter()
        .map(|tx| dedupe_key(&tx.date, tx.kind, tx.amount, tx.note.trim()))
        .collect();
    let mut rows = Vec::new();
    let mut valid = 0;
    let mut errors = 0;
    let mut duplicates = 0;

    for (i, row) in table.rows.iter().enumerate() {
        let raw_date = cell(row, index("date"));
        let raw_amount = cell(row, index("amount"));
        let raw_type = cell(row, index("type"));
        let signed = parse_amount_value(&raw_amount);
        let date = parse_date_value(&raw_date, options.date_format);

        let explicit_type = normalize_type(&raw_type);
        let mut kind = explicit_type.unwrap_or(options.kind);
        if explicit_type.is_none() && options.infer_sign && signed.is_finite() {
            if signed < 0.0 {
                kind = TxType::Expense;
            } else if signed > 0.0 {
                kind = TxType::Income;
            }
        }

        let amount = if signed.is_finite() {
            signed.abs()
        } else {
            0.0
        };
        let mut error: Option<String> = None;
        if raw_date.is_empty() {
            error = Some("Tanggal kosong".into());
        } else if date.is_none() {
            error = Some(format!("Tanggal tidak dikenali: {raw_date}"));
        } else if raw_amount.is_empty() {
            error = Some("Jumlah kosong".into());
        } else if !amount.is_finite() || amount <= 0.0 {
            error = Some(format!("Jumlah tidak valid: {raw_amount}"));
        }

        let account = cell(row, index("account"));
        let to_account = cell(row, index("toAccount"));
        let category = cell(row, index("category"));
        if error.is_none() && kind == TxType::Transfer && to_account.is_empty() {
            error = Some("Transfer tanpa rekening tujuan".into());
        }

        let note = cell(row, index("note"));
        let key = date
            .as_ref()
            .map(|date| dedupe_key(date, kind, amount, &note))
            .unwrap_or_default();
        let duplicate = if error.is_some() {
            false
        } else {
            options.dedupe && seen.contains(&key)
        };
        if duplicate {
            duplicates += 1;
        } else if error.is_none() && !key.is_empty() {
            seen.push(key);
        }

        if error.is_some() {
            errors += 1;
        } else if !duplicate {
            valid += 1;
        }

        let fee_value = parse_amount_value(&cell(row, index("fee"))).abs();
        rows.push(ParsedRow {
            line: i + 2,
            date: date.unwrap_or_default(),
            kind,
            amount,
            fee: if fee_value.is_finite() {
                fee_value
            } else {
                0.0
            },
            account,
            to_account,
            category,
            note,
            error,
            duplicate: duplicate.then_some(true),
        });
    }

    ImportPreview {
        rows,
        valid,
        errors,
        duplicates,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_quoted_fields_and_newlines() {
        let table = parse_csv("A,B\n\"x,1\",\"line\nbreak\"\n", None);
        assert_eq!(table.headers, vec!["A", "B"]);
        assert_eq!(table.rows, vec![vec!["x,1", "line\nbreak"]]);
        assert_eq!(table.delimiter, ",");
    }

    #[test]
    fn detects_semicolon_and_skips_blank_rows() {
        let table = parse_csv("Tanggal;Jumlah\n2026-01-02;25.000\n\n", None);
        assert_eq!(table.delimiter, ";");
        assert_eq!(table.rows.len(), 1);
    }

    #[test]
    fn names_blank_headers() {
        let table = parse_csv("Tanggal,,Jumlah\n1,2,3\n", None);
        assert_eq!(table.headers, vec!["Tanggal", "Kolom 2", "Jumlah"]);
    }

    #[test]
    fn guesses_indonesian_headers() {
        let mapping = guess_mapping(&[
            "Tanggal Transaksi".into(),
            "Keterangan".into(),
            "Nominal".into(),
            "Rekening Sumber".into(),
        ]);
        assert_eq!(mapping.get("date").and_then(Value::as_u64), Some(0));
        assert_eq!(mapping.get("note").and_then(Value::as_u64), Some(1));
        assert_eq!(mapping.get("amount").and_then(Value::as_u64), Some(2));
        assert_eq!(mapping.get("account").and_then(Value::as_u64), Some(3));
    }

    #[test]
    fn parses_dates_day_first_by_default() {
        assert_eq!(
            parse_date_value("03/04/2026", DateFormat::Auto).as_deref(),
            Some("2026-04-03")
        );
        assert_eq!(parse_date_value("2026-02-31", DateFormat::Auto), None);
        assert_eq!(
            parse_date_value("31/12/26", DateFormat::Auto).as_deref(),
            Some("2026-12-31")
        );
    }

    #[test]
    fn out_of_range_mapping_is_empty_not_a_panic() {
        let table = parse_csv("A,B\n1,2\n", None);
        let mut mapping = Map::new();
        mapping.insert("date".into(), Value::from(99));
        mapping.insert("amount".into(), Value::from(98));
        let options = ImportOptions {
            kind: TxType::Expense,
            date_format: DateFormat::Auto,
            infer_sign: true,
            dedupe: true,
        };
        let preview = build_import(&table, &mapping, &options, &[]);
        assert_eq!(preview.errors, 1);
        assert_eq!(preview.rows[0].amount, 0.0);
    }

    #[test]
    fn import_validates_and_dedupes() {
        let table = parse_csv(
            "Tanggal,Jumlah,Catatan\n2026-01-01,25000,Kopi\n2026-01-01,25000,Kopi\nbad,x,Nope\n",
            None,
        );
        let mapping = guess_mapping(&table.headers);
        let options = ImportOptions {
            kind: TxType::Expense,
            date_format: DateFormat::Auto,
            infer_sign: false,
            dedupe: true,
        };
        let preview = build_import(&table, &mapping, &options, &[]);
        assert_eq!(preview.valid, 1);
        assert_eq!(preview.duplicates, 1);
        assert_eq!(preview.errors, 1);
        assert_eq!(
            preview.rows[2].error.as_deref(),
            Some("Tanggal tidak dikenali: bad")
        );
    }
}
