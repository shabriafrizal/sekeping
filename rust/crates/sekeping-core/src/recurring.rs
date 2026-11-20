//! Recurring bills and subscriptions.

use chrono::Datelike;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::dates::{days_between, parse_iso, to_iso, today_iso};
use crate::model::{CategoryType, Interval, Recurring, Tx, TxType};

const MAX_CATCH_UP: usize = 240;

fn now_ms() -> f64 {
    chrono::Utc::now().timestamp_millis() as f64
}

fn base36(mut value: u64) -> String {
    const DIGITS: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    if value == 0 {
        return "0".into();
    }
    let mut out = Vec::new();
    while value > 0 {
        out.push(DIGITS[(value % 36) as usize]);
        value /= 36;
    }
    out.reverse();
    String::from_utf8(out).unwrap_or_default()
}

/// Browser-compatible id: `tx_<milliseconds base36><six random base36 chars>`.
pub fn uid(prefix: &str) -> String {
    let mut random = [0u8; 6];
    if getrandom::getrandom(&mut random).is_err() {
        random = [0u8; 6];
    }
    let suffix: String = random
        .iter()
        .map(|byte| b"0123456789abcdefghijklmnopqrstuvwxyz"[(*byte as usize) % 36] as char)
        .collect();
    format!("{prefix}_{}{suffix}", base36(now_ms() as u64))
}

/// Move an ISO date forward by one interval, clamping month-end and Feb 29.
pub fn advance_date(iso: &str, interval: Interval) -> Option<String> {
    let date = parse_iso(iso)?;
    if interval == Interval::Weekly {
        return date
            .checked_add_signed(chrono::Duration::days(7))
            .map(to_iso);
    }
    let months = if interval == Interval::Yearly { 12 } else { 1 };
    let day = date.day();
    let month0 = date.month0() as i32 + months;
    let year_shift = month0.div_euclid(12);
    let month = month0.rem_euclid(12) + 1;
    let target = chrono::NaiveDate::from_ymd_opt(date.year() + year_shift, month as u32, 1)?;
    let last_day = crate::dates::last_day_of_month(target.year(), target.month())?.day();
    target.with_day(day.min(last_day)).map(to_iso)
}

/// Every unposted occurrence up to and including `today`.
pub fn due_dates(item: &Recurring, today: &str) -> Vec<String> {
    if !item.active {
        return Vec::new();
    }
    let mut dates = Vec::new();
    let mut cursor = if item.next_date < item.start_date {
        item.start_date.clone()
    } else {
        item.next_date.clone()
    };
    let mut guard = 0;
    while cursor.as_str() <= today && guard < MAX_CATCH_UP {
        if let Some(end) = &item.end_date {
            if cursor.as_str() > end.as_str() {
                break;
            }
        }
        dates.push(cursor.clone());
        match advance_date(&cursor, item.interval) {
            Some(next) => cursor = next,
            None => break,
        }
        guard += 1;
    }
    dates
}

pub fn is_due(item: &Recurring, today: &str) -> bool {
    item.active
        && item.next_date.as_str() <= today
        && item
            .end_date
            .as_ref()
            .is_none_or(|end| item.next_date.as_str() <= end.as_str())
}

/// Rough monthly cost, used for the subscription summary.
pub fn monthly_equivalent(item: &Recurring) -> f64 {
    match item.interval {
        Interval::Weekly => crate::money::js_math_round((item.amount * 52.0) / 12.0),
        Interval::Yearly => crate::money::js_math_round(item.amount / 12.0),
        Interval::Monthly => item.amount,
    }
}

/// Number of days until the next occurrence (negative when overdue).
pub fn days_until_next(item: &Recurring, today: &str) -> Option<i64> {
    days_between(today, &item.next_date)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringRun {
    pub txs: Vec<Tx>,
    pub next_dates: Map<String, Value>,
    pub count: usize,
}

fn tx_type(kind: CategoryType) -> TxType {
    match kind {
        CategoryType::Expense => TxType::Expense,
        CategoryType::Income => TxType::Income,
    }
}

/// Build the transactions that are due since each item was last posted.
pub fn collect_due(items: &[Recurring], today: &str) -> RecurringRun {
    let mut txs = Vec::new();
    let mut next_dates = Map::new();
    let stamp = now_ms();

    for item in items {
        let dates = due_dates(item, today);
        if dates.is_empty() {
            continue;
        }
        for date in &dates {
            txs.push(Tx {
                id: uid("tx"),
                kind: tx_type(item.kind),
                amount: item.amount,
                account_id: item.account_id.clone(),
                category_id: item.category_id.clone(),
                to_account_id: None,
                fee: None,
                date: date.clone(),
                time: None,
                note: if item.note.is_empty() {
                    item.name.clone()
                } else {
                    item.note.clone()
                },
                debt_id: None,
                recurring_id: Some(item.id.clone()),
                created_at: stamp,
            });
        }
        if let Some(last) = dates.last() {
            if let Some(next) = advance_date(last, item.interval) {
                next_dates.insert(item.id.clone(), Value::String(next));
            }
        }
    }

    let count = txs.len();
    RecurringRun {
        txs,
        next_dates,
        count,
    }
}

/// One occurrence of a recurring item, dated at `date` (or its next date).
pub fn occurrence_tx(item: &Recurring, date: Option<&str>) -> Tx {
    Tx {
        id: uid("tx"),
        kind: tx_type(item.kind),
        amount: item.amount,
        account_id: item.account_id.clone(),
        category_id: item.category_id.clone(),
        to_account_id: None,
        fee: None,
        date: date.unwrap_or(&item.next_date).to_string(),
        time: None,
        note: if item.note.is_empty() {
            item.name.clone()
        } else {
            item.note.clone()
        },
        debt_id: None,
        recurring_id: Some(item.id.clone()),
        created_at: now_ms(),
    }
}

/// A fresh schedule: the start date when still ahead, otherwise the next
/// occurrence after today.
pub fn initial_next_date(start_date: &str, interval: Interval, today: &str) -> String {
    if start_date >= today {
        return start_date.to_string();
    }
    let mut cursor = start_date.to_string();
    let mut guard = 0;
    while cursor.as_str() <= today && guard < MAX_CATCH_UP {
        match advance_date(&cursor, interval) {
            Some(next) => cursor = next,
            None => break,
        }
        guard += 1;
    }
    cursor
}

pub fn today() -> String {
    today_iso()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(interval: Interval, start: &str, next: &str) -> Recurring {
        Recurring {
            id: "r1".into(),
            name: "Internet".into(),
            kind: CategoryType::Expense,
            amount: 320_000.0,
            account_id: "acc_bank".into(),
            category_id: Some("cat_bills".into()),
            note: String::new(),
            interval,
            start_date: start.into(),
            next_date: next.into(),
            end_date: None,
            active: true,
            is_subscription: true,
            last_posted_at: None,
            created_at: 0.0,
        }
    }

    #[test]
    fn month_end_clamps() {
        assert_eq!(
            advance_date("2026-01-31", Interval::Monthly).as_deref(),
            Some("2026-02-28")
        );
        assert_eq!(
            advance_date("2024-01-31", Interval::Monthly).as_deref(),
            Some("2024-02-29")
        );
        assert_eq!(
            advance_date("2024-02-29", Interval::Yearly).as_deref(),
            Some("2025-02-28")
        );
    }

    #[test]
    fn weekly_is_seven_days() {
        assert_eq!(
            advance_date("2026-11-20", Interval::Weekly).as_deref(),
            Some("2026-11-27")
        );
    }

    #[test]
    fn catch_up_stops_at_end_date() {
        let mut it = item(Interval::Monthly, "2026-01-01", "2026-01-01");
        it.end_date = Some("2026-03-01".into());
        assert_eq!(
            due_dates(&it, "2026-05-01"),
            vec!["2026-01-01", "2026-02-01", "2026-03-01"]
        );
    }

    #[test]
    fn collect_builds_one_tx_per_occurrence() {
        let it = item(Interval::Monthly, "2026-09-01", "2026-09-01");
        let run = collect_due(&[it], "2026-11-20");
        assert_eq!(run.count, 3);
        assert_eq!(run.txs[2].date, "2026-11-01");
        assert_eq!(run.txs[2].note, "Internet");
        assert_eq!(
            run.next_dates.get("r1").and_then(Value::as_str),
            Some("2026-12-01")
        );
    }
}
