//! Calendar arithmetic with the same observable behaviour as the browser app.
//!
//! JavaScript's `Date` normalises overflow (31 February becomes 3 March) and
//! `setMonth` keeps the day of month. The port reproduces that instead of
//! rejecting the input, because existing ledgers may contain such values.

use chrono::{Datelike, Duration, NaiveDate};

/// Parse `YYYY-MM-DD` the way `new Date(y, m - 1, d)` does: overflow rolls
/// forward, and a missing component is invalid rather than today.
pub fn parse_iso(iso: &str) -> Option<NaiveDate> {
    let mut parts = iso.split('-');
    let y: i32 = parts.next()?.parse().ok()?;
    let m: i32 = parts.next()?.parse().ok()?;
    let d: i32 = parts.next()?.parse().ok()?;
    js_date(y, m, d)
}

/// `new Date(year, month - 1, day)` with JavaScript overflow semantics.
pub fn js_date(year: i32, month: i32, day: i32) -> Option<NaiveDate> {
    let month0 = month - 1;
    let year_shift = month0.div_euclid(12);
    let month = month0.rem_euclid(12) + 1;
    let first = NaiveDate::from_ymd_opt(year.checked_add(year_shift)?, month as u32, 1)?;
    first.checked_add_signed(Duration::days(i64::from(day) - 1))
}

pub fn to_iso(date: NaiveDate) -> String {
    format!("{:04}-{:02}-{:02}", date.year(), date.month(), date.day())
}

/// Local "today" in the runtime's timezone, matching `new Date()`.
pub fn today_iso() -> String {
    to_iso(chrono::Local::now().date_naive())
}

pub fn month_key(iso: &str) -> String {
    iso.chars().take(7).collect()
}

pub fn month_range(iso: &str) -> Option<(String, String)> {
    let date = parse_iso(iso)?;
    let first = NaiveDate::from_ymd_opt(date.year(), date.month(), 1)?;
    let last = last_day_of_month(date.year(), date.month())?;
    Some((to_iso(first), to_iso(last)))
}

pub fn last_day_of_month(year: i32, month: u32) -> Option<NaiveDate> {
    let (next_year, next_month) = if month == 12 {
        (year + 1, 1)
    } else {
        (year, month + 1)
    };
    NaiveDate::from_ymd_opt(next_year, next_month, 1)?.pred_opt()
}

/// `Date#setMonth(getMonth() + delta)` while keeping the day of month.
pub fn add_months(iso: &str, delta: i32) -> Option<String> {
    let date = parse_iso(iso)?;
    let month0 = date.month0() as i32 + delta;
    let year_shift = month0.div_euclid(12);
    let month = month0.rem_euclid(12) + 1;
    let first = NaiveDate::from_ymd_opt(date.year().checked_add(year_shift)?, month as u32, 1)?;
    let target = first.checked_add_signed(Duration::days(i64::from(date.day()) - 1))?;
    Some(to_iso(target))
}

/// `shiftMonth("YYYY-MM", delta)`, used by the budget month stepper.
pub fn shift_month(month: &str, delta: i32) -> Option<String> {
    let mut parts = month.split('-');
    let y: i32 = parts.next()?.parse().ok()?;
    let m: i32 = parts.next()?.parse().ok()?;
    let month0 = m - 1 + delta;
    let year_shift = month0.div_euclid(12);
    let month = month0.rem_euclid(12) + 1;
    Some(format!("{:04}-{:02}", y.checked_add(year_shift)?, month))
}

/// All month keys from `start` through `end`, inclusive, capped at 240.
pub fn months_between(start_month: &str, end_month: &str) -> Vec<String> {
    let mut start = start_month.split('-');
    let sy: i32 = match start.next().and_then(|v| v.parse().ok()) {
        Some(v) => v,
        None => return Vec::new(),
    };
    let sm: i32 = match start.next().and_then(|v| v.parse().ok()) {
        Some(v) => v,
        None => return Vec::new(),
    };
    let mut end = end_month.split('-');
    let ey: i32 = match end.next().and_then(|v| v.parse().ok()) {
        Some(v) => v,
        None => return Vec::new(),
    };
    let em: i32 = match end.next().and_then(|v| v.parse().ok()) {
        Some(v) => v,
        None => return Vec::new(),
    };
    if sy == 0 || sm == 0 || ey == 0 || em == 0 {
        return Vec::new();
    }

    let mut out = Vec::new();
    let (mut y, mut m) = (sy, sm);
    let mut guard = 0;
    while (y < ey || (y == ey && m <= em)) && guard < 240 {
        out.push(format!("{y}-{m:02}"));
        m += 1;
        if m > 12 {
            m = 1;
            y += 1;
        }
        guard += 1;
    }
    out
}

/// Whole days from `a` to `b` (positive when `b` is later).
pub fn days_between(a: &str, b: &str) -> Option<i64> {
    let from = parse_iso(a)?;
    let to = parse_iso(b)?;
    Some(to.signed_duration_since(from).num_days())
}

/// Sortable timestamp for a transaction date and optional `HH:mm`.
pub fn tx_sort_value(date: &str, time: Option<&str>) -> Option<i64> {
    let date = parse_iso(date)?;
    let (hour, minute) = match time {
        Some(value) => {
            let mut parts = value.split(':');
            let h: i64 = parts.next().and_then(|v| v.parse().ok()).unwrap_or(0);
            let m: i64 = parts.next().and_then(|v| v.parse().ok()).unwrap_or(0);
            (h, m)
        }
        None => (0, 0),
    };
    let midnight = date.and_hms_opt(0, 0, 0)?;
    Some(midnight.and_utc().timestamp_millis() + hour * 3_600_000 + minute * 60_000)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn overflow_rolls_like_javascript() {
        assert_eq!(
            parse_iso("2026-02-31").map(to_iso).as_deref(),
            Some("2026-03-03")
        );
        assert_eq!(
            parse_iso("2026-13-01").map(to_iso).as_deref(),
            Some("2027-01-01")
        );
    }

    #[test]
    fn month_range_is_inclusive() {
        assert_eq!(
            month_range("2026-02-14"),
            Some(("2026-02-01".into(), "2026-02-28".into()))
        );
        assert_eq!(
            month_range("2024-02-01"),
            Some(("2024-02-01".into(), "2024-02-29".into()))
        );
    }

    #[test]
    fn add_months_keeps_javascript_rollover() {
        assert_eq!(add_months("2026-01-31", 1).as_deref(), Some("2026-03-03"));
        assert_eq!(add_months("2026-01-15", 1).as_deref(), Some("2026-02-15"));
    }

    #[test]
    fn month_walk_includes_both_ends() {
        assert_eq!(
            months_between("2025-11", "2026-02"),
            vec!["2025-11", "2025-12", "2026-01", "2026-02"]
        );
        assert!(months_between("2026-03", "2026-02").is_empty());
    }

    #[test]
    fn shift_month_crosses_years() {
        assert_eq!(shift_month("2026-01", -1).as_deref(), Some("2025-12"));
        assert_eq!(shift_month("2026-12", 1).as_deref(), Some("2027-01"));
    }
}
