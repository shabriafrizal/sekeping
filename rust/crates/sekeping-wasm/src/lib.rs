//! The WebAssembly boundary for Sekeping's Rust core.
//!
//! Every export takes and returns JSON strings so the React layer can swap a
//! TypeScript helper for a Rust one without changing component code. Errors are
//! thrown as JavaScript `Error`s with short, stable codes.

use serde::Serialize;
use serde_json::{json, Map, Value};
use wasm_bindgen::prelude::*;

use sekeping_core::model::{AppState, CategoryType, Filters, Recurring, TxType};
use sekeping_core::{backup, budgets, crypto, csv, dates, money, receipt, recurring, reports};

fn json_of<T: Serialize>(value: &T) -> Result<String, JsValue> {
    serde_json::to_string(value).map_err(|error| JsValue::from_str(&error.to_string()))
}

fn parse_json<'a, T: serde::de::Deserialize<'a>>(text: &'a str) -> Result<T, JsValue> {
    serde_json::from_str(text).map_err(|error| JsValue::from_str(&format!("bad-json: {error}")))
}

fn state_of(text: &str) -> Result<AppState, JsValue> {
    parse_json(text)
}

fn tx_type(value: &str) -> Result<TxType, JsValue> {
    match value {
        "expense" => Ok(TxType::Expense),
        "income" => Ok(TxType::Income),
        "transfer" => Ok(TxType::Transfer),
        _ => Err(JsValue::from_str("bad-type")),
    }
}

/// Version of the core crate, useful for diagnostics in the browser.
#[wasm_bindgen]
pub fn core_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Parse a typed amount exactly like the amount field does.
#[wasm_bindgen]
pub fn parse_amount(raw: &str, currency: &str) -> f64 {
    money::parse_amount_input(raw, currency)
}

/// Format money for a locale (`id-ID`, `en-US`).
#[wasm_bindgen]
pub fn format_money(value: f64, currency: &str, locale: &str) -> String {
    money::money(value, currency, locale)
}

#[wasm_bindgen]
pub fn format_compact_money(value: f64, currency: &str, locale: &str) -> String {
    money::compact_money(value, currency, locale)
}

#[wasm_bindgen]
pub fn format_compact_number(value: f64, locale: &str) -> String {
    money::compact_number(value, locale)
}

#[wasm_bindgen]
pub fn format_number(value: f64, locale: &str) -> String {
    money::plain_number(value, locale)
}

/// Ledger totals, account count and date span.
#[wasm_bindgen]
pub fn summary(state_json: &str) -> Result<String, JsValue> {
    let state = state_of(state_json)?;
    json_of(&reports::summary(&state))
}

/// Normalize any backup object into the current state shape.
#[wasm_bindgen]
pub fn normalize_state(state_json: &str) -> Result<String, JsValue> {
    let value: Value = parse_json(state_json)?;
    json_of(&reports::normalize_state(&value))
}

/// Progress for every active budget in `month` (`YYYY-MM`).
#[wasm_bindgen]
pub fn budget_progress(state_json: &str, month: &str) -> Result<String, JsValue> {
    let state = state_of(state_json)?;
    let month = if month.is_empty() {
        budgets::current_month_key()
    } else {
        month.to_string()
    };
    let list: Vec<Value> = state
        .budgets
        .iter()
        .filter(|budget| budget.active)
        .map(|budget| {
            let category = state
                .categories
                .iter()
                .find(|category| category.id == budget.category_id);
            let progress = budgets::budget_progress(budget, &state.txs, &month, category);
            let mut value = serde_json::to_value(&progress).unwrap_or(Value::Null);
            if let Value::Object(map) = &mut value {
                map.insert(
                    "tone".into(),
                    Value::String(budgets::tone_for(&progress).into()),
                );
                map.insert("month".into(), Value::String(month.clone()));
            }
            value
        })
        .collect();
    json_of(&list)
}

/// Progress for one budget, used by the budget list.
#[wasm_bindgen]
pub fn budget_progress_one(
    budget_json: &str,
    txs_json: &str,
    month: &str,
    category_json: &str,
) -> Result<String, JsValue> {
    let budget: sekeping_core::model::Budget = parse_json(budget_json)?;
    let txs: Vec<sekeping_core::model::Tx> = parse_json(txs_json)?;
    let category: Option<sekeping_core::model::Category> =
        if category_json.is_empty() || category_json == "null" {
            None
        } else {
            Some(parse_json(category_json)?)
        };
    let month = if month.is_empty() {
        budgets::current_month_key()
    } else {
        month.to_string()
    };
    let progress = budgets::budget_progress(&budget, &txs, &month, category.as_ref());
    let mut value = serde_json::to_value(&progress).unwrap_or(Value::Null);
    if let Value::Object(map) = &mut value {
        map.insert(
            "tone".into(),
            Value::String(budgets::tone_for(&progress).into()),
        );
    }
    json_of(&value)
}

/// Transactions that are due now, plus the next date per recurring item.
#[wasm_bindgen]
pub fn recurring_due(state_json: &str, today: &str) -> Result<String, JsValue> {
    let state = state_of(state_json)?;
    let today = if today.is_empty() {
        dates::today_iso()
    } else {
        today.to_string()
    };
    json_of(&recurring::collect_due(&state.recurring, &today))
}

fn interval_of(value: &str) -> Result<sekeping_core::model::Interval, JsValue> {
    match value {
        "weekly" => Ok(sekeping_core::model::Interval::Weekly),
        "monthly" => Ok(sekeping_core::model::Interval::Monthly),
        "yearly" => Ok(sekeping_core::model::Interval::Yearly),
        _ => Err(JsValue::from_str("bad-interval")),
    }
}

/// Move an ISO date forward by one interval.
#[wasm_bindgen]
pub fn advance_date(iso: &str, interval: &str) -> Option<String> {
    let interval = interval_of(interval).ok()?;
    recurring::advance_date(iso, interval)
}

/// First occurrence for a new recurring item.
#[wasm_bindgen]
pub fn recurring_initial_next_date(
    start_date: &str,
    interval: &str,
    today: &str,
) -> Option<String> {
    let interval = interval_of(interval).ok()?;
    Some(recurring::initial_next_date(start_date, interval, today))
}

#[wasm_bindgen]
pub fn recurring_days_until_next(item_json: &str, today: &str) -> Result<Option<i64>, JsValue> {
    let item: Recurring = parse_json(item_json)?;
    let today = if today.is_empty() {
        dates::today_iso()
    } else {
        today.to_string()
    };
    Ok(recurring::days_until_next(&item, &today))
}

/// Dates on which a recurring item is due up to `today`.
#[wasm_bindgen]
pub fn recurring_due_dates(item_json: &str, today: &str) -> Result<String, JsValue> {
    let item: Recurring = parse_json(item_json)?;
    let today = if today.is_empty() {
        dates::today_iso()
    } else {
        today.to_string()
    };
    json_of(&recurring::due_dates(&item, &today))
}

#[wasm_bindgen]
pub fn recurring_due_count(item_json: &str, today: &str) -> Result<usize, JsValue> {
    let item: Recurring = parse_json(item_json)?;
    let today = if today.is_empty() {
        dates::today_iso()
    } else {
        today.to_string()
    };
    Ok(recurring::due_dates(&item, &today).len())
}

#[wasm_bindgen]
pub fn recurring_is_due(item_json: &str, today: &str) -> Result<bool, JsValue> {
    let item: Recurring = parse_json(item_json)?;
    let today = if today.is_empty() {
        dates::today_iso()
    } else {
        today.to_string()
    };
    Ok(recurring::is_due(&item, &today))
}

#[wasm_bindgen]
pub fn recurring_monthly_equivalent(item_json: &str) -> Result<f64, JsValue> {
    let item: Recurring = parse_json(item_json)?;
    Ok(recurring::monthly_equivalent(&item))
}

/// Parse CSV text into `{headers, rows, delimiter}`.
#[wasm_bindgen]
pub fn csv_parse(text: &str, delimiter: Option<String>) -> Result<String, JsValue> {
    let delimiter = delimiter
        .and_then(|value| value.chars().next())
        .or_else(|| text.lines().next().map(csv::detect_delimiter));
    let table = csv::parse_csv(text, delimiter);
    json_of(&table)
}

/// Guess which header belongs to which import field.
#[wasm_bindgen]
pub fn csv_guess_mapping(headers_json: &str) -> Result<String, JsValue> {
    let headers: Vec<String> = parse_json(headers_json)?;
    json_of(&csv::guess_mapping(&headers))
}

/// Build an import preview without touching the ledger.
#[wasm_bindgen]
pub fn csv_import(
    text: &str,
    mapping_json: &str,
    options_json: &str,
    existing_json: &str,
) -> Result<String, JsValue> {
    let options: csv::ImportOptions = parse_json(options_json)?;
    let existing: Vec<sekeping_core::model::Tx> = if existing_json.is_empty() {
        Vec::new()
    } else {
        parse_json(existing_json)?
    };
    let delimiter = text.lines().next().map(csv::detect_delimiter);
    let table = csv::parse_csv(text, delimiter);
    let mapping: Map<String, Value> = parse_json(mapping_json)?;
    json_of(&csv::build_import(&table, &mapping, &options, &existing))
}

/// Parse one spreadsheet date into `YYYY-MM-DD` (or nothing).
#[wasm_bindgen]
pub fn csv_parse_date(raw: &str, format: &str) -> Option<String> {
    let format = match format {
        "ymd" => csv::DateFormat::Ymd,
        "dmy" => csv::DateFormat::Dmy,
        "mdy" => csv::DateFormat::Mdy,
        _ => csv::DateFormat::Auto,
    };
    csv::parse_date_value(raw, format)
}

/// Parse one spreadsheet amount. Returns `NaN` when it cannot be read.
#[wasm_bindgen]
pub fn csv_parse_amount(raw: &str) -> f64 {
    money::parse_amount_value(raw)
}

/// Build an import preview from an already parsed table.
#[wasm_bindgen]
pub fn csv_import_table(
    table_json: &str,
    mapping_json: &str,
    options_json: &str,
    existing_json: &str,
) -> Result<String, JsValue> {
    let table: csv::CsvTable = parse_json(table_json)?;
    let mapping: Map<String, Value> = parse_json(mapping_json)?;
    let options: csv::ImportOptions = parse_json(options_json)?;
    let existing: Vec<sekeping_core::model::Tx> = if existing_json.is_empty() {
        Vec::new()
    } else {
        parse_json(existing_json)?
    };
    json_of(&csv::build_import(&table, &mapping, &options, &existing))
}

/// Read a receipt into an editable draft. No network, no storage.
#[wasm_bindgen]
pub fn receipt_parse(text: &str, options_json: &str) -> Result<String, JsValue> {
    let options: receipt::ReceiptParseOptions = parse_json(options_json)?;
    json_of(&receipt::parse_receipt_text(text, &options))
}

/// Encrypt a JSON backup with a password. Returns the envelope JSON.
#[wasm_bindgen]
pub fn encrypt_backup(plaintext: &str, password: &str) -> Result<String, JsValue> {
    crypto::encrypt_text(plaintext, password).map_err(|error| JsValue::from_str(&error))
}

/// Decrypt an envelope produced by the browser or this crate.
#[wasm_bindgen]
pub fn decrypt_backup(envelope: &str, password: &str) -> Result<String, JsValue> {
    crypto::decrypt_text(envelope, password).map_err(|error| JsValue::from_str(&error))
}

#[wasm_bindgen]
pub fn is_encrypted_backup(text: &str) -> bool {
    crypto::is_encrypted_export(text)
}

/// Validate a raw backup without loading it into the app.
#[wasm_bindgen]
pub fn validate_backup(text: &str) -> String {
    serde_json::to_string(&backup::validate_json(text)).unwrap_or_else(|_| "{}".into())
}

/// Export transactions as CSV. Pass empty strings for default filters/labels.
#[wasm_bindgen]
pub fn export_csv(
    state_json: &str,
    filters_json: &str,
    labels_json: &str,
) -> Result<String, JsValue> {
    let state = state_of(state_json)?;
    let filters: Option<Filters> = if filters_json.is_empty() || filters_json == "null" {
        None
    } else {
        Some(parse_json(filters_json)?)
    };
    let labels: reports::CsvLabels = if labels_json.is_empty() || labels_json == "null" {
        reports::CsvLabels::default()
    } else {
        parse_json(labels_json)?
    };
    Ok(reports::export_csv(&state, filters.as_ref(), &labels))
}

/// Category totals for one type, optionally bounded by ISO dates.
#[wasm_bindgen]
pub fn category_totals(
    state_json: &str,
    kind: &str,
    from: &str,
    to: &str,
) -> Result<String, JsValue> {
    let state = state_of(state_json)?;
    let kind = tx_type(kind)?;
    let totals = reports::category_totals(
        &state.txs,
        kind,
        if from.is_empty() { None } else { Some(from) },
        if to.is_empty() { None } else { Some(to) },
    );
    json_of(&totals)
}

/// The last `count` months of totals for one type, oldest first.
#[wasm_bindgen]
pub fn monthly_trend(
    state_json: &str,
    kind: &str,
    end_month: &str,
    count: usize,
) -> Result<String, JsValue> {
    let state = state_of(state_json)?;
    let kind = tx_type(kind)?;
    let end = if end_month.is_empty() {
        dates::today_iso()
    } else {
        end_month.to_string()
    };
    json_of(&reports::trend(
        &state.txs,
        kind,
        &dates::month_key(&end),
        count,
    ))
}

/// Net worth and per-account balances.
#[wasm_bindgen]
pub fn balances(state_json: &str) -> Result<String, JsValue> {
    let state = state_of(state_json)?;
    let accounts: Vec<Value> = state
        .accounts
        .iter()
        .map(|account| {
            json!({
                "id": account.id,
                "name": account.name,
                "active": account.active,
                "balance": reports::balance_of(&state.accounts, &state.txs, &account.id),
            })
        })
        .collect();
    json_of(&json!({
        "netWorth": reports::net_worth(&state.accounts, &state.txs),
        "accounts": accounts,
    }))
}

/// Monthly income and expense totals between two ISO dates.
#[wasm_bindgen]
pub fn month_totals(state_json: &str, from: &str, to: &str) -> Result<String, JsValue> {
    let state = state_of(state_json)?;
    json_of(&reports::month_totals(&state.txs, from, to))
}

/// Parse a `YYYY-MM` key and return its first/last ISO days.
#[wasm_bindgen]
pub fn month_days(month: &str) -> Result<String, JsValue> {
    match dates::month_range(&format!("{month}-01")) {
        Some((from, to)) => Ok(json!({ "from": from, "to": to }).to_string()),
        None => Err(JsValue::from_str("bad-month")),
    }
}

/// Check that a category type string is understood by the core.
#[wasm_bindgen]
pub fn category_type_of(value: &str) -> Result<String, JsValue> {
    let kind = match value {
        "expense" => CategoryType::Expense,
        "income" => CategoryType::Income,
        _ => return Err(JsValue::from_str("bad-category-type")),
    };
    Ok(serde_json::to_string(&kind).unwrap_or_default())
}

#[cfg(test)]
mod tests {
    use super::*;

    const STATE: &str = r#"{
      "version": 2,
      "accounts": [{"id":"a","name":"Cash","icon":"cash","initial":1000,"active":true}],
      "categories": [{"id":"c","name":"Food","icon":"bag","type":"expense","active":true}],
      "txs": [{"id":"t","type":"expense","amount":250,"accountId":"a","categoryId":"c","date":"2026-11-01","note":"lunch"}],
      "settings": {"language":"id","currency":"IDR"}
    }"#;

    #[test]
    fn summary_round_trips() {
        let text = summary(STATE).expect("summary");
        let value: Value = serde_json::from_str(&text).expect("json");
        assert_eq!(value["netWorth"], 750.0);
        assert_eq!(value["txs"], 1);
    }

    #[test]
    fn budgets_and_trends_are_json() {
        let budgets = budget_progress(STATE, "2026-11").expect("budgets");
        assert_eq!(budgets, "[]");
        let trend = monthly_trend(STATE, "expense", "2026-11", 3).expect("trend");
        assert!(trend.contains("2026-11"));
    }

    #[test]
    fn receipt_parse_accepts_options() {
        let options = json!({
            "accounts": [{"id":"a","name":"BCA","icon":"","initial":0,"active":true}],
            "categories": [],
            "currency": "IDR",
            "today": "2026-11-20"
        });
        let draft = receipt_parse(
            "Kopi\nTanggal 19/11/2026\nTotal Rp 25.000",
            &options.to_string(),
        )
        .expect("draft");
        let value: Value = serde_json::from_str(&draft).expect("json");
        assert_eq!(value["amount"], 25_000.0);
        assert_eq!(value["date"], "2026-11-19");
    }

    #[test]
    fn encrypts_from_the_boundary() {
        let sealed = encrypt_backup("{\"version\":2}", "pw").expect("seal");
        assert!(is_encrypted_backup(&sealed));
        assert_eq!(
            decrypt_backup(&sealed, "pw").expect("open"),
            "{\"version\":2}"
        );
    }
}
