//! Parity tests against behaviour recorded from the TypeScript modules.
//!
//! `rust/cases/golden.json` is produced by `rust/cases/record.ts`. Receipt
//! parsing is intentionally absent: the TypeScript version has two bugs that
//! this port fixes, and those cases live in `src/receipt.rs` unit tests.

use sekeping_core::model::{Budget, Category, Recurring, TxType};
use sekeping_core::{budgets, crypto, csv, dates, money, recurring};
use serde_json::Value;

fn golden() -> Value {
    serde_json::from_str(include_str!("../../../cases/golden.json")).expect("golden.json")
}

fn close(a: f64, b: f64) {
    assert!((a - b).abs() < 1e-9, "{a} != {b}");
}

fn locale(language: &str) -> &'static str {
    if language == "en" {
        "en-US"
    } else {
        "id-ID"
    }
}

#[test]
fn money_matches_typescript() {
    let golden = golden();
    for case in golden["money"].as_array().expect("money cases") {
        if let Some(raw) = case.get("parse").and_then(Value::as_str) {
            let currency = case["currency"].as_str().expect("currency");
            close(
                money::parse_amount_input(raw, currency),
                case["parsed"].as_f64().expect("parsed"),
            );
            continue;
        }
        if let Some(name) = case.get("initials").and_then(Value::as_str) {
            assert_eq!(
                money::initials(name),
                case["value"].as_str().expect("initials value")
            );
            continue;
        }

        let language = case["language"].as_str().expect("language");
        let currency = case["currency"].as_str().expect("currency");
        let value = case["value"].as_f64().expect("value");
        let locale = locale(language);
        assert_eq!(
            money::money(value, currency, locale),
            case["money"].as_str().expect("money")
        );
        assert_eq!(
            money::compact_money(value, currency, locale),
            case["compactMoney"].as_str().expect("compactMoney")
        );
        assert_eq!(
            money::compact_number(value, locale),
            case["compactNumber"].as_str().expect("compactNumber")
        );
        assert_eq!(
            money::plain_number(value, locale),
            case["plainNumber"].as_str().expect("plainNumber")
        );
    }
}

#[test]
fn dates_match_typescript() {
    let golden = golden();
    for case in golden["dates"].as_array().expect("date cases") {
        if let Some(iso) = case.get("addMonths").and_then(Value::as_str) {
            let delta = case["delta"].as_i64().expect("delta") as i32;
            assert_eq!(
                dates::add_months(iso, delta).as_deref(),
                case["result"].as_str(),
                "addMonths({iso}, {delta})"
            );
        } else if let Some(iso) = case.get("monthRange").and_then(Value::as_str) {
            let expected = case["result"].as_object().expect("monthRange result");
            let (from, to) = dates::month_range(iso).expect("month range");
            assert_eq!(from, expected["from"].as_str().expect("from"));
            assert_eq!(to, expected["to"].as_str().expect("to"));
        } else if let Some(pair) = case.get("daysBetween").and_then(Value::as_array) {
            let a = pair[0].as_str().expect("a");
            let b = pair[1].as_str().expect("b");
            assert_eq!(
                dates::days_between(a, b),
                case["result"].as_i64(),
                "daysBetween({a}, {b})"
            );
        } else if let Some(iso) = case.get("monthKey").and_then(Value::as_str) {
            assert_eq!(
                dates::month_key(iso),
                case["result"].as_str().expect("monthKey")
            );
        } else if let Some(tx) = case.get("txSortValue") {
            let date = tx["date"].as_str().expect("date");
            let time = tx["time"].as_str();
            assert_eq!(
                dates::tx_sort_value(date, time),
                case["result"].as_i64(),
                "txSortValue({date}, {time:?})"
            );
        }
    }
}

#[test]
fn budgets_match_typescript() {
    let golden = golden();
    for case in golden["budgets"].as_array().expect("budget cases") {
        if let Some(pair) = case.get("monthsBetween").and_then(Value::as_array) {
            let start = pair[0].as_str().expect("start");
            let end = pair[1].as_str().expect("end");
            let expected: Vec<String> = case["result"]
                .as_array()
                .expect("months")
                .iter()
                .map(|value| value.as_str().expect("month").to_string())
                .collect();
            assert_eq!(dates::months_between(start, end), expected);
            continue;
        }

        let budget: Budget = serde_json::from_value(case["budget"].clone()).expect("budget");
        let category: Category =
            serde_json::from_value(case["category"].clone()).expect("category");
        let month = case["month"].as_str().expect("month");
        let progress = budgets::budget_progress(&budget, &BUDGET_TXS, month, Some(&category));
        let expected = &case["progress"];

        close(
            progress.carry_in,
            expected["carryIn"].as_f64().expect("carryIn"),
        );
        close(
            progress.available,
            expected["available"].as_f64().expect("available"),
        );
        close(progress.spent, expected["spent"].as_f64().expect("spent"));
        close(
            progress.remaining,
            expected["remaining"].as_f64().expect("remaining"),
        );
        close(progress.ratio, expected["ratio"].as_f64().expect("ratio"));
        close(progress.over, expected["over"].as_f64().expect("over"));
        assert_eq!(
            progress.months_tracked as u64,
            expected["monthsTracked"].as_u64().expect("monthsTracked")
        );
        assert_eq!(
            budgets::tone_for(&progress),
            case["tone"].as_str().expect("tone")
        );
    }
}

fn budget_tx(
    id: &str,
    kind: &str,
    amount: f64,
    category: &str,
    date: &str,
) -> sekeping_core::model::Tx {
    sekeping_core::model::Tx {
        id: id.into(),
        kind: match kind {
            "income" => TxType::Income,
            "transfer" => TxType::Transfer,
            _ => TxType::Expense,
        },
        amount,
        account_id: "a".into(),
        category_id: Some(category.into()),
        to_account_id: None,
        fee: None,
        date: date.into(),
        time: None,
        note: String::new(),
        debt_id: None,
        recurring_id: None,
        created_at: 0.0,
    }
}

static BUDGET_TXS: std::sync::LazyLock<Vec<sekeping_core::model::Tx>> =
    std::sync::LazyLock::new(|| {
        vec![
            budget_tx("t1", "expense", 100.0, "food", "2026-09-10"),
            budget_tx("t2", "expense", 300.0, "food", "2026-10-05"),
            budget_tx("t3", "expense", 50.0, "food", "2026-11-02"),
            budget_tx("t4", "income", 999.0, "food", "2026-11-03"),
            budget_tx("t5", "expense", 70.0, "travel", "2026-11-04"),
        ]
    });

#[test]
fn recurring_matches_typescript() {
    let golden = golden();
    for case in golden["recurring"].as_array().expect("recurring cases") {
        if let Some(pair) = case.get("initialNextDate").and_then(Value::as_array) {
            let start = pair[0].as_str().expect("start");
            let interval = match pair[1].as_str().expect("interval") {
                "weekly" => sekeping_core::model::Interval::Weekly,
                "yearly" => sekeping_core::model::Interval::Yearly,
                _ => sekeping_core::model::Interval::Monthly,
            };
            let today = pair[2].as_str().expect("today");
            assert_eq!(
                recurring::initial_next_date(start, interval, today),
                case["result"].as_str().expect("result")
            );
            continue;
        }
        if let Some(pair) = case.get("advanceDate").and_then(Value::as_array) {
            let date = pair[0].as_str().expect("date");
            let interval = match pair[1].as_str().expect("interval") {
                "weekly" => sekeping_core::model::Interval::Weekly,
                "yearly" => sekeping_core::model::Interval::Yearly,
                _ => sekeping_core::model::Interval::Monthly,
            };
            assert_eq!(
                recurring::advance_date(date, interval).as_deref(),
                case["result"].as_str()
            );
            continue;
        }

        let item: Recurring = serde_json::from_value(case["item"].clone()).expect("recurring item");
        let today = case["today"].as_str().expect("today");
        let expected_due: Vec<String> = case["due"]
            .as_array()
            .expect("due")
            .iter()
            .map(|value| value.as_str().expect("date").to_string())
            .collect();
        assert_eq!(
            recurring::due_dates(&item, today),
            expected_due,
            "{}",
            item.id
        );
        assert_eq!(
            recurring::is_due(&item, today),
            case["isDue"].as_bool().expect("isDue")
        );
        close(
            recurring::monthly_equivalent(&item),
            case["monthly"].as_f64().expect("monthly"),
        );
        assert_eq!(
            recurring::days_until_next(&item, today),
            case["days"].as_i64()
        );
    }
}

#[test]
fn csv_matches_typescript() {
    let golden = golden();
    for case in golden["csv"].as_array().expect("csv cases") {
        if let Some(text) = case.get("parseCsv").and_then(Value::as_str) {
            let table = csv::parse_csv(text, None);
            assert_eq!(
                serde_json::to_value(&table).expect("table"),
                case["table"],
                "parseCsv"
            );
            let mapping = csv::guess_mapping(&table.headers);
            assert_eq!(Value::Object(mapping), case["mapping"], "guessMapping");
            continue;
        }
        if let Some(pair) = case.get("parseDateValue").and_then(Value::as_array) {
            let raw = pair[0].as_str().expect("raw");
            let format = match pair[1].as_str().expect("format") {
                "ymd" => csv::DateFormat::Ymd,
                "dmy" => csv::DateFormat::Dmy,
                "mdy" => csv::DateFormat::Mdy,
                _ => csv::DateFormat::Auto,
            };
            assert_eq!(
                csv::parse_date_value(raw, format).as_deref(),
                case["result"].as_str(),
                "parseDateValue({raw})"
            );
            continue;
        }
        if let Some(raw) = case.get("parseAmountValue").and_then(Value::as_str) {
            close(
                money::parse_amount_value(raw),
                case["result"].as_f64().expect("amount"),
            );
            continue;
        }
        if let Some(options) = case.get("buildImport") {
            let table = csv::parse_csv(
                "date,amount,type,account,category,note\n2026-01-02,25000,expense,Cash,Food,Coffee\n2026-01-03,-15000,,Cash,Food,Refund\nbad,oops,,Cash,Food,Broken\n2026-01-02,25000,expense,Cash,Food,Coffee\n",
                None,
            );
            let mapping = csv::guess_mapping(&table.headers);
            let options: csv::ImportOptions =
                serde_json::from_value(options.clone()).expect("import options");
            let mut existing = budget_tx("x", "expense", 25_000.0, "food", "2026-01-02");
            existing.note = "Coffee".into();
            let existing = vec![existing];
            let preview = csv::build_import(&table, &mapping, &options, &existing);
            let expected = &case["preview"];

            assert_eq!(
                preview.valid as u64,
                expected["valid"].as_u64().expect("valid")
            );
            assert_eq!(
                preview.errors as u64,
                expected["errors"].as_u64().expect("errors")
            );
            assert_eq!(
                preview.duplicates as u64,
                expected["duplicates"].as_u64().expect("duplicates")
            );

            let rows = expected["rows"].as_array().expect("rows");
            assert_eq!(preview.rows.len(), rows.len());
            for (row, want) in preview.rows.iter().zip(rows) {
                assert_eq!(row.line as u64, want["line"].as_u64().expect("line"));
                assert_eq!(row.date, want["date"].as_str().expect("date"));
                assert_eq!(row.kind.as_str(), want["type"].as_str().expect("type"));
                close(row.amount, want["amount"].as_f64().unwrap_or(0.0));
                assert_eq!(row.account, want["account"].as_str().expect("account"));
                assert_eq!(row.note, want["note"].as_str().expect("note"));
                assert_eq!(
                    row.duplicate.unwrap_or(false),
                    want["duplicate"].as_bool().unwrap_or(false)
                );
                assert_eq!(
                    row.error.as_deref(),
                    want["error"].as_str(),
                    "line {}",
                    row.line
                );
            }
            continue;
        }
        panic!("unknown csv case: {case}");
    }
}

#[test]
fn crypto_interoperates_with_the_browser_envelope() {
    let golden = golden();
    for case in golden["crypto"].as_array().expect("crypto cases") {
        let password = case["password"].as_str().expect("password");
        if let Some(envelope) = case.get("envelope") {
            let envelope = envelope.to_string();
            if case.get("error").is_some() {
                assert!(
                    crypto::decrypt_text(&envelope, password).is_err(),
                    "wrong password must fail"
                );
                continue;
            }
            let payload = case["payload"].as_str().expect("payload");
            assert_eq!(
                crypto::decrypt_text(&envelope, password).as_deref(),
                Ok(payload)
            );
        }
    }

    // Rust -> browser: an envelope sealed here must open with the same
    // parameters the web app understands.
    let sealed = crypto::encrypt_text("{\"version\":2}", "pw").expect("seal");
    let value: Value = serde_json::from_str(&sealed).expect("envelope");
    assert_eq!(value["format"], "sekeping-encrypted");
    assert_eq!(value["kdf"]["iterations"], 310_000);
    assert_eq!(
        crypto::decrypt_text(&sealed, "pw").as_deref(),
        Ok("{\"version\":2}")
    );
}
