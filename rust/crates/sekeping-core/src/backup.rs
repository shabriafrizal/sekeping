//! Backup validation and normalization.

use std::collections::HashSet;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::dates::parse_iso;
use crate::model::{AppState, Interval};
use crate::reports::{summary, StateSummary};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Error,
    Warning,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Issue {
    pub severity: Severity,
    pub code: String,
    pub message: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationReport {
    pub ok: bool,
    pub errors: usize,
    pub warnings: usize,
    pub issues: Vec<Issue>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<StateSummary>,
}

fn issue(
    issues: &mut Vec<Issue>,
    severity: Severity,
    code: &str,
    path: impl Into<String>,
    message: impl Into<String>,
) {
    issues.push(Issue {
        severity,
        code: code.into(),
        message: message.into(),
        path: path.into(),
    });
}

fn duplicate_ids<'a>(ids: impl Iterator<Item = &'a String>, path: &str, issues: &mut Vec<Issue>) {
    let mut seen = HashSet::new();
    for id in ids {
        if !seen.insert(id) {
            issue(
                issues,
                Severity::Error,
                "duplicate-id",
                path,
                format!("duplicate id {id}"),
            );
        }
    }
}

fn check_date(value: &str, path: &str, issues: &mut Vec<Issue>) {
    if parse_iso(value).is_none() {
        issue(
            issues,
            Severity::Error,
            "bad-date",
            path,
            format!("not a calendar date: {value}"),
        );
    }
}

pub fn validate_state(state: &AppState) -> Vec<Issue> {
    let mut issues = Vec::new();

    duplicate_ids(
        state.accounts.iter().map(|a| &a.id),
        "accounts",
        &mut issues,
    );
    duplicate_ids(
        state.categories.iter().map(|c| &c.id),
        "categories",
        &mut issues,
    );
    duplicate_ids(state.txs.iter().map(|t| &t.id), "txs", &mut issues);
    duplicate_ids(state.debts.iter().map(|d| &d.id), "debts", &mut issues);
    duplicate_ids(
        state.payments.iter().map(|p| &p.id),
        "payments",
        &mut issues,
    );
    duplicate_ids(
        state.recurring.iter().map(|r| &r.id),
        "recurring",
        &mut issues,
    );
    duplicate_ids(state.budgets.iter().map(|b| &b.id), "budgets", &mut issues);

    let accounts: HashSet<&str> = state.accounts.iter().map(|a| a.id.as_str()).collect();
    let categories: HashSet<&str> = state.categories.iter().map(|c| c.id.as_str()).collect();
    let debts: HashSet<&str> = state.debts.iter().map(|d| d.id.as_str()).collect();

    for (index, tx) in state.txs.iter().enumerate() {
        let path = format!("txs[{index}]");
        if !tx.amount.is_finite() || tx.amount <= 0.0 {
            issue(
                &mut issues,
                Severity::Error,
                "bad-amount",
                format!("{path}.amount"),
                format!("amount must be positive, got {}", tx.amount),
            );
        }
        check_date(&tx.date, &format!("{path}.date"), &mut issues);
        if !accounts.contains(tx.account_id.as_str()) {
            issue(
                &mut issues,
                Severity::Error,
                "unknown-account",
                format!("{path}.accountId"),
                format!("account {} does not exist", tx.account_id),
            );
        }
        if let Some(category) = &tx.category_id {
            if !categories.contains(category.as_str()) {
                issue(
                    &mut issues,
                    Severity::Warning,
                    "unknown-category",
                    format!("{path}.categoryId"),
                    format!("category {category} does not exist"),
                );
            }
        }
        if tx.kind == crate::model::TxType::Transfer {
            match &tx.to_account_id {
                None => issue(
                    &mut issues,
                    Severity::Error,
                    "transfer-target",
                    format!("{path}.toAccountId"),
                    "transfer has no destination account",
                ),
                Some(target) if target == &tx.account_id => issue(
                    &mut issues,
                    Severity::Error,
                    "transfer-same-account",
                    format!("{path}.toAccountId"),
                    "transfer source and destination are the same account",
                ),
                Some(target) if !accounts.contains(target.as_str()) => issue(
                    &mut issues,
                    Severity::Error,
                    "unknown-account",
                    format!("{path}.toAccountId"),
                    format!("account {target} does not exist"),
                ),
                Some(_) => {}
            }
        }
        if tx.fee.is_some_and(|fee| !fee.is_finite() || fee < 0.0) {
            issue(
                &mut issues,
                Severity::Warning,
                "bad-fee",
                format!("{path}.fee"),
                "fee should be a non-negative number",
            );
        }
    }

    for (index, recurring) in state.recurring.iter().enumerate() {
        let path = format!("recurring[{index}]");
        if !accounts.contains(recurring.account_id.as_str()) {
            issue(
                &mut issues,
                Severity::Error,
                "unknown-account",
                format!("{path}.accountId"),
                format!("account {} does not exist", recurring.account_id),
            );
        }
        if !recurring.amount.is_finite() || recurring.amount <= 0.0 {
            issue(
                &mut issues,
                Severity::Error,
                "bad-amount",
                format!("{path}.amount"),
                "recurring amount must be positive",
            );
        }
        check_date(
            &recurring.start_date,
            &format!("{path}.startDate"),
            &mut issues,
        );
        check_date(
            &recurring.next_date,
            &format!("{path}.nextDate"),
            &mut issues,
        );
        if let Some(end) = &recurring.end_date {
            check_date(end, &format!("{path}.endDate"), &mut issues);
        }
        if !matches!(
            recurring.interval,
            Interval::Weekly | Interval::Monthly | Interval::Yearly
        ) {
            issue(
                &mut issues,
                Severity::Error,
                "bad-interval",
                format!("{path}.interval"),
                "interval must be weekly, monthly or yearly",
            );
        }
    }

    for (index, budget) in state.budgets.iter().enumerate() {
        let path = format!("budgets[{index}]");
        if !categories.contains(budget.category_id.as_str()) {
            issue(
                &mut issues,
                Severity::Warning,
                "unknown-category",
                format!("{path}.categoryId"),
                format!("category {} does not exist", budget.category_id),
            );
        }
        if !budget.amount.is_finite() || budget.amount < 0.0 {
            issue(
                &mut issues,
                Severity::Error,
                "bad-amount",
                format!("{path}.amount"),
                "budget amount must be zero or positive",
            );
        }
        let month = &budget.start_month;
        if month.len() != 7
            || month.as_bytes().get(4) != Some(&b'-')
            || month[..4].parse::<i32>().is_err()
            || !(1..=12).contains(&month[5..].parse::<u32>().unwrap_or(0))
        {
            issue(
                &mut issues,
                Severity::Error,
                "bad-month",
                format!("{path}.startMonth"),
                format!("not a YYYY-MM month: {month}"),
            );
        }
    }

    for (index, payment) in state.payments.iter().enumerate() {
        let path = format!("payments[{index}]");
        if !debts.contains(payment.debt_id.as_str()) {
            issue(
                &mut issues,
                Severity::Error,
                "unknown-debt",
                format!("{path}.debtId"),
                format!("debt {} does not exist", payment.debt_id),
            );
        }
        if !accounts.contains(payment.account_id.as_str()) {
            issue(
                &mut issues,
                Severity::Error,
                "unknown-account",
                format!("{path}.accountId"),
                format!("account {} does not exist", payment.account_id),
            );
        }
        if !payment.amount.is_finite() || payment.amount <= 0.0 {
            issue(
                &mut issues,
                Severity::Error,
                "bad-amount",
                format!("{path}.amount"),
                "payment amount must be positive",
            );
        }
        check_date(&payment.date, &format!("{path}.date"), &mut issues);
    }

    if !matches!(state.settings.language.as_str(), "id" | "en") {
        issue(
            &mut issues,
            Severity::Warning,
            "bad-language",
            "settings.language",
            "language should be id or en",
        );
    }
    if !matches!(
        state.settings.currency.as_str(),
        "IDR" | "USD" | "EUR" | "SGD" | "MYR"
    ) {
        issue(
            &mut issues,
            Severity::Warning,
            "bad-currency",
            "settings.currency",
            "currency is not one of the supported codes",
        );
    }
    if let Some(pin) = &state.settings.pin {
        if pin.len() < 4 || pin.len() > 8 || !pin.chars().all(|c| c.is_ascii_digit()) {
            issue(
                &mut issues,
                Severity::Warning,
                "bad-pin",
                "settings.pin",
                "PIN should be 4 to 8 digits",
            );
        }
    }

    issues
}

pub fn validate_json(text: &str) -> ValidationReport {
    let value: Value = match serde_json::from_str(text) {
        Ok(value) => value,
        Err(error) => {
            return ValidationReport {
                ok: false,
                errors: 1,
                warnings: 0,
                issues: vec![Issue {
                    severity: Severity::Error,
                    code: "invalid-json".into(),
                    message: error.to_string(),
                    path: "$".into(),
                }],
                summary: None,
            }
        }
    };

    if !value.is_object() {
        return ValidationReport {
            ok: false,
            errors: 1,
            warnings: 0,
            issues: vec![Issue {
                severity: Severity::Error,
                code: "not-an-object".into(),
                message: "backup root must be a JSON object".into(),
                path: "$".into(),
            }],
            summary: None,
        };
    }

    let mut issues = Vec::new();
    for field in ["accounts", "categories", "txs"] {
        match value.get(field) {
            Some(Value::Array(_)) => {}
            Some(_) => issue(
                &mut issues,
                Severity::Error,
                "wrong-shape",
                field,
                format!("{field} must be an array"),
            ),
            None => issue(
                &mut issues,
                Severity::Warning,
                "missing-array",
                field,
                format!("{field} is missing; it will be treated as empty"),
            ),
        }
    }

    let state: AppState = match serde_json::from_value(value) {
        Ok(state) => state,
        Err(error) => {
            issue(
                &mut issues,
                Severity::Error,
                "wrong-shape",
                "$",
                format!("backup does not match the ledger shape: {error}"),
            );
            return ValidationReport {
                ok: false,
                errors: issues.len(),
                warnings: 0,
                issues,
                summary: None,
            };
        }
    };
    issues.extend(validate_state(&state));

    let errors = issues
        .iter()
        .filter(|issue| issue.severity == Severity::Error)
        .count();
    let warnings = issues.len() - errors;
    ValidationReport {
        ok: errors == 0,
        errors,
        warnings,
        issues,
        summary: Some(summary(&state)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catches_duplicate_and_orphan_rows() {
        let json = r#"{
          "version": 2,
          "accounts": [{"id":"a","name":"Cash","icon":"cash","initial":0,"active":true}],
          "categories": [],
          "txs": [
            {"id":"t","type":"expense","amount":10,"accountId":"a","date":"2026-01-01","note":""},
            {"id":"t","type":"expense","amount":-1,"accountId":"missing","date":"nope","note":""}
          ],
          "settings": {"language":"id","currency":"IDR"}
        }"#;
        let report = validate_json(json);
        assert!(!report.ok);
        assert!(report.issues.iter().any(|i| i.code == "duplicate-id"));
        assert!(report.issues.iter().any(|i| i.code == "unknown-account"));
        assert!(report.issues.iter().any(|i| i.code == "bad-date"));
        assert!(report.issues.iter().any(|i| i.code == "bad-amount"));
    }

    #[test]
    fn accepts_a_clean_ledger() {
        let json = r#"{
          "version": 2,
          "accounts": [{"id":"a","name":"Cash","icon":"cash","initial":0,"active":true}],
          "categories": [{"id":"c","name":"Food","icon":"bag","type":"expense","active":true}],
          "txs": [{"id":"t","type":"expense","amount":10,"accountId":"a","categoryId":"c","date":"2026-01-01","note":"x"}],
          "settings": {"language":"id","currency":"IDR"}
        }"#;
        let report = validate_json(json);
        assert!(report.ok, "{:?}", report.issues);
        assert_eq!(report.summary.map(|s| s.net_worth), Some(-10.0));
    }

    #[test]
    fn rejects_non_object_root() {
        assert!(!validate_json("[]").ok);
        assert!(!validate_json("{").ok);
    }
}
