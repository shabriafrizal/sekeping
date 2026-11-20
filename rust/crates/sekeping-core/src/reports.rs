//! Ledger aggregation: balances, category totals, trends and CSV export.

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::dates::{month_key, shift_month};
use crate::model::{Account, AppState, Filters, Tx, TxType};

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct MonthTotals {
    pub income: f64,
    pub expense: f64,
}

pub fn balance_of(accounts: &[Account], txs: &[Tx], account_id: &str) -> f64 {
    let initial = accounts
        .iter()
        .find(|account| account.id == account_id)
        .map(|account| account.initial)
        .unwrap_or(0.0);
    let mut total = initial;
    for tx in txs {
        match tx.kind {
            TxType::Income if tx.account_id == account_id => total += tx.amount,
            TxType::Expense if tx.account_id == account_id => total -= tx.amount,
            TxType::Transfer => {
                if tx.account_id == account_id {
                    total -= tx.amount + tx.fee.unwrap_or(0.0);
                }
                if tx.to_account_id.as_deref() == Some(account_id) {
                    total += tx.amount;
                }
            }
            _ => {}
        }
    }
    total
}

pub fn net_worth(accounts: &[Account], txs: &[Tx]) -> f64 {
    accounts
        .iter()
        .filter(|account| account.active)
        .map(|account| balance_of(accounts, txs, &account.id))
        .sum()
}

pub fn month_totals(txs: &[Tx], from: &str, to: &str) -> MonthTotals {
    let mut income = 0.0;
    let mut expense = 0.0;
    for tx in txs {
        if tx.date.as_str() < from || tx.date.as_str() > to {
            continue;
        }
        match tx.kind {
            TxType::Income => income += tx.amount,
            TxType::Expense => expense += tx.amount,
            TxType::Transfer => {}
        }
    }
    MonthTotals { income, expense }
}

pub fn debt_paid(payments: &[crate::model::DebtPayment], debt_id: &str) -> f64 {
    payments
        .iter()
        .filter(|payment| payment.debt_id == debt_id)
        .map(|payment| payment.amount)
        .sum()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryTotal {
    pub id: String,
    pub value: f64,
}

/// Category totals in first-seen order, then descending by value.
pub fn category_totals(
    txs: &[Tx],
    kind: TxType,
    from: Option<&str>,
    to: Option<&str>,
) -> Vec<CategoryTotal> {
    let mut totals: Vec<CategoryTotal> = Vec::new();
    for tx in txs {
        if tx.kind != kind {
            continue;
        }
        if from.is_some_and(|from| tx.date.as_str() < from) {
            continue;
        }
        if to.is_some_and(|to| tx.date.as_str() > to) {
            continue;
        }
        let id = tx.category_id.clone().unwrap_or_else(|| "none".into());
        match totals.iter_mut().find(|total| total.id == id) {
            Some(total) => total.value += tx.amount,
            None => totals.push(CategoryTotal {
                id,
                value: tx.amount,
            }),
        }
    }
    totals.sort_by(|a, b| {
        b.value
            .partial_cmp(&a.value)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    totals
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrendPoint {
    pub key: String,
    pub total: f64,
}

/// The last `count` months ending at `end_month`, oldest first.
pub fn trend(txs: &[Tx], kind: TxType, end_month: &str, count: usize) -> Vec<TrendPoint> {
    let mut points = Vec::with_capacity(count);
    for offset in (0..count).rev() {
        let Some(key) = shift_month(end_month, -(offset as i32)) else {
            continue;
        };
        let total = txs
            .iter()
            .filter(|tx| tx.kind == kind && month_key(&tx.date) == key)
            .map(|tx| tx.amount)
            .sum();
        points.push(TrendPoint { key, total });
    }
    points
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CsvLabels {
    pub date: String,
    pub time: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub category: String,
    pub account: String,
    pub target: String,
    pub amount: String,
    pub fee: String,
    pub note: String,
    pub expense: String,
    pub income: String,
    pub transfer: String,
}

impl Default for CsvLabels {
    fn default() -> Self {
        Self {
            date: "Tanggal".into(),
            time: "Waktu".into(),
            kind: "Jenis".into(),
            category: "Kategori".into(),
            account: "Rekening".into(),
            target: "Tujuan".into(),
            amount: "Jumlah".into(),
            fee: "Biaya".into(),
            note: "Catatan".into(),
            expense: "Pengeluaran".into(),
            income: "Pendapatan".into(),
            transfer: "Transfer".into(),
        }
    }
}

fn csv_cell(value: &str) -> String {
    // Spreadsheet formula injection: a cell that begins with one of these
    // characters is treated as a formula by Excel, Numbers and Sheets.
    let guarded = match value.chars().next() {
        Some('=') | Some('+') | Some('-') | Some('@') | Some('\t') | Some('\r') => {
            format!("'{value}")
        }
        _ => value.to_string(),
    };
    format!("\"{}\"", guarded.replace('"', "\"\""))
}

fn js_number(value: f64) -> String {
    if value == 0.0 {
        "0".into()
    } else {
        format!("{value}")
    }
}

pub fn export_csv(state: &AppState, filters: Option<&Filters>, labels: &CsvLabels) -> String {
    let mut rows: Vec<Vec<String>> = vec![vec![
        labels.date.clone(),
        labels.time.clone(),
        labels.kind.clone(),
        labels.category.clone(),
        labels.account.clone(),
        labels.target.clone(),
        labels.amount.clone(),
        labels.fee.clone(),
        labels.note.clone(),
    ]];

    let mut list: Vec<&Tx> = state.txs.iter().collect();
    list.sort_by(|a, b| b.date.cmp(&a.date));

    for tx in list {
        if let Some(filters) = filters {
            if filters.kind != "all" && tx.kind.as_str() != filters.kind {
                continue;
            }
            if filters.account_id != "all" && tx.account_id != filters.account_id {
                continue;
            }
            if filters.category_id != "all"
                && tx.category_id.as_deref() != Some(filters.category_id.as_str())
            {
                continue;
            }
            if filters
                .from
                .as_ref()
                .is_some_and(|from| tx.date.as_str() < from.as_str())
            {
                continue;
            }
            if filters
                .to
                .as_ref()
                .is_some_and(|to| tx.date.as_str() > to.as_str())
            {
                continue;
            }
            if !filters.search.is_empty()
                && !tx
                    .note
                    .to_lowercase()
                    .contains(&filters.search.to_lowercase())
            {
                continue;
            }
        }

        let kind = match tx.kind {
            TxType::Expense => &labels.expense,
            TxType::Income => &labels.income,
            TxType::Transfer => &labels.transfer,
        };
        let category = state
            .categories
            .iter()
            .find(|category| Some(&category.id) == tx.category_id.as_ref())
            .map(|category| category.name.clone())
            .unwrap_or_default();
        let account = state
            .accounts
            .iter()
            .find(|account| account.id == tx.account_id)
            .map(|account| account.name.clone())
            .unwrap_or_default();
        let target = tx
            .to_account_id
            .as_ref()
            .and_then(|id| state.accounts.iter().find(|account| &account.id == id))
            .map(|account| account.name.clone())
            .unwrap_or_default();

        rows.push(vec![
            tx.date.clone(),
            tx.time.clone().unwrap_or_default(),
            kind.clone(),
            category,
            account,
            target,
            js_number(tx.amount),
            js_number(tx.fee.unwrap_or(0.0)),
            tx.note.clone(),
        ]);
    }

    rows.iter()
        .map(|row| {
            row.iter()
                .map(|cell| csv_cell(cell))
                .collect::<Vec<_>>()
                .join(",")
        })
        .collect::<Vec<_>>()
        .join("\r\n")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StateSummary {
    pub version: u32,
    pub accounts: usize,
    pub categories: usize,
    pub txs: usize,
    pub debts: usize,
    pub payments: usize,
    pub recurring: usize,
    pub budgets: usize,
    pub net_worth: f64,
    pub currency: String,
    pub language: String,
    pub first_date: Option<String>,
    pub last_date: Option<String>,
    pub income: f64,
    pub expense: f64,
    pub transfers: f64,
}

pub fn summary(state: &AppState) -> StateSummary {
    let mut first: Option<String> = None;
    let mut last: Option<String> = None;
    let mut income = 0.0;
    let mut expense = 0.0;
    let mut transfers = 0.0;
    for tx in &state.txs {
        if first.as_ref().is_none_or(|value| tx.date < *value) {
            first = Some(tx.date.clone());
        }
        if last.as_ref().is_none_or(|value| tx.date > *value) {
            last = Some(tx.date.clone());
        }
        match tx.kind {
            TxType::Income => income += tx.amount,
            TxType::Expense => expense += tx.amount,
            TxType::Transfer => transfers += tx.amount,
        }
    }
    StateSummary {
        version: state.version,
        accounts: state.accounts.len(),
        categories: state.categories.len(),
        txs: state.txs.len(),
        debts: state.debts.len(),
        payments: state.payments.len(),
        recurring: state.recurring.len(),
        budgets: state.budgets.len(),
        net_worth: net_worth(&state.accounts, &state.txs),
        currency: state.settings.currency.clone(),
        language: state.settings.language.clone(),
        first_date: first,
        last_date: last,
        income,
        expense,
        transfers,
    }
}

/// Turn a raw JSON backup into an `AppState`, keeping only shapes the app
/// understands. Mirrors `loadState()` in `src/lib/store.tsx`.
pub fn normalize_state(value: &Value) -> AppState {
    serde_json::from_value(value.clone()).unwrap_or_else(|_| AppState {
        version: 2,
        accounts: Vec::new(),
        categories: Vec::new(),
        txs: Vec::new(),
        debts: Vec::new(),
        payments: Vec::new(),
        recurring: Vec::new(),
        budgets: Vec::new(),
        settings: Default::default(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Account, TxType};

    fn account(id: &str, initial: f64) -> Account {
        Account {
            id: id.into(),
            name: id.into(),
            icon: String::new(),
            initial,
            active: true,
        }
    }

    fn tx(kind: TxType, amount: f64, account: &str, target: Option<&str>, fee: f64) -> Tx {
        Tx {
            id: "t".into(),
            kind,
            amount,
            account_id: account.into(),
            category_id: None,
            to_account_id: target.map(str::to_string),
            fee: Some(fee),
            date: "2026-11-01".into(),
            time: None,
            note: String::new(),
            debt_id: None,
            recurring_id: None,
            created_at: 0.0,
        }
    }

    #[test]
    fn transfer_fee_leaves_the_source_only() {
        let accounts = vec![account("a", 1000.0), account("b", 0.0)];
        let txs = vec![tx(TxType::Transfer, 200.0, "a", Some("b"), 5.0)];
        assert_eq!(balance_of(&accounts, &txs, "a"), 795.0);
        assert_eq!(balance_of(&accounts, &txs, "b"), 200.0);
        assert_eq!(net_worth(&accounts, &txs), 995.0);
    }

    #[test]
    fn csv_export_neutralises_formulas() {
        let accounts = vec![account("a", 0.0)];
        let mut tx = tx(TxType::Expense, 10.0, "a", None, 0.0);
        tx.note = "=HYPERLINK(\"https://example.test\")".into();
        let state = AppState {
            version: 2,
            accounts,
            categories: Vec::new(),
            txs: vec![tx],
            debts: Vec::new(),
            payments: Vec::new(),
            recurring: Vec::new(),
            budgets: Vec::new(),
            settings: Default::default(),
        };
        let csv = export_csv(&state, None, &CsvLabels::default());
        assert!(csv.contains("\"'=HYPERLINK"), "{csv}");
    }

    #[test]
    fn category_totals_sort_descending() {
        let mut a = tx(TxType::Expense, 10.0, "a", None, 0.0);
        a.category_id = Some("food".into());
        let mut b = tx(TxType::Expense, 30.0, "a", None, 0.0);
        b.category_id = Some("bills".into());
        let totals = category_totals(&[a, b], TxType::Expense, None, None);
        assert_eq!(totals[0].id, "bills");
        assert_eq!(totals[0].value, 30.0);
    }
}
