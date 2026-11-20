//! Monthly budgets, including the rollover walk.

use serde::{Deserialize, Serialize};

use crate::dates::{month_range, months_between, today_iso};
use crate::model::{Budget, Category, Tx, TxType};

/// Every month key from `start` through `end`, inclusive.
pub use crate::dates::months_between as month_keys;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetProgress {
    pub budget: Budget,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<Category>,
    pub carry_in: f64,
    pub available: f64,
    pub spent: f64,
    pub remaining: f64,
    pub ratio: f64,
    pub over: f64,
    pub months_tracked: usize,
}

pub fn spent_in_category(txs: &[Tx], category_id: &str, month: &str) -> f64 {
    let Some((from, to)) = month_range(&format!("{month}-01")) else {
        return 0.0;
    };
    let mut total = 0.0;
    for tx in txs {
        if tx.kind != TxType::Expense {
            continue;
        }
        if tx.category_id.as_deref() != Some(category_id) {
            continue;
        }
        if tx.date < from || tx.date > to {
            continue;
        }
        total += tx.amount;
    }
    total
}

/// Walk the budget forward from its start month so unused money rolls over.
/// Only positive leftovers roll over; overspending does not shrink next month.
pub fn budget_progress(
    budget: &Budget,
    txs: &[Tx],
    month: &str,
    category: Option<&Category>,
) -> BudgetProgress {
    let empty = BudgetProgress {
        budget: budget.clone(),
        category: category.cloned(),
        carry_in: 0.0,
        available: 0.0,
        spent: 0.0,
        remaining: 0.0,
        ratio: 0.0,
        over: 0.0,
        months_tracked: 0,
    };
    if month < budget.start_month.as_str() {
        return empty;
    }

    let mut carry = 0.0;
    let mut available = 0.0;
    let mut spent = 0.0;
    let months = months_between(&budget.start_month, month);
    for key in &months {
        available = budget.amount + carry;
        spent = spent_in_category(txs, &budget.category_id, key);
        carry = if budget.rollover {
            (available - spent).max(0.0)
        } else {
            0.0
        };
    }

    let remaining = available - spent;
    BudgetProgress {
        budget: budget.clone(),
        category: category.cloned(),
        carry_in: if budget.rollover {
            (available - budget.amount).max(0.0)
        } else {
            0.0
        },
        available,
        spent,
        remaining,
        ratio: if available > 0.0 {
            (spent / available).min(1.0)
        } else if spent > 0.0 {
            1.0
        } else {
            0.0
        },
        over: (spent - available).max(0.0),
        months_tracked: months.len(),
    }
}

pub fn tone_for(progress: &BudgetProgress) -> &'static str {
    if progress.available <= 0.0 {
        return if progress.spent > 0.0 { "over" } else { "ok" };
    }
    if progress.spent > progress.available {
        return "over";
    }
    if progress.spent / progress.available >= 0.8 {
        return "warning";
    }
    "ok"
}

pub fn current_month_key() -> String {
    today_iso().chars().take(7).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn budget(amount: f64, rollover: bool) -> Budget {
        Budget {
            id: "b1".into(),
            category_id: "cat_food".into(),
            amount,
            rollover,
            start_month: "2026-01".into(),
            active: true,
            created_at: 0.0,
        }
    }

    fn tx(amount: f64, date: &str) -> Tx {
        Tx {
            id: "t1".into(),
            kind: TxType::Expense,
            amount,
            account_id: "acc_cash".into(),
            category_id: Some("cat_food".into()),
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

    #[test]
    fn unused_money_rolls_forward() {
        let txs = vec![tx(200.0, "2026-01-10"), tx(100.0, "2026-02-02")];
        let p = budget_progress(&budget(500.0, true), &txs, "2026-02", None);
        assert_eq!(p.available, 800.0);
        assert_eq!(p.spent, 100.0);
        assert_eq!(p.carry_in, 300.0);
        assert_eq!(p.remaining, 700.0);
        assert_eq!(p.months_tracked, 2);
    }

    #[test]
    fn overspending_does_not_roll_negative() {
        let txs = vec![tx(900.0, "2026-01-10")];
        let p = budget_progress(&budget(500.0, true), &txs, "2026-02", None);
        assert_eq!(p.available, 500.0);
        assert_eq!(p.carry_in, 0.0);
    }

    #[test]
    fn tones_match_the_bar() {
        let mut p = budget_progress(&budget(100.0, false), &[], "2026-01", None);
        assert_eq!(tone_for(&p), "ok");
        p.spent = 80.0;
        assert_eq!(tone_for(&p), "warning");
        p.spent = 120.0;
        assert_eq!(tone_for(&p), "over");
    }
}
