//! The on-disk and in-memory shapes of a Sekeping ledger.
//!
//! Field names mirror the TypeScript app (`camelCase` in JSON) so a backup
//! written by the browser can be read here without a translation layer.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TxType {
    Expense,
    Income,
    Transfer,
}

impl TxType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Expense => "expense",
            Self::Income => "income",
            Self::Transfer => "transfer",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CategoryType {
    Expense,
    Income,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Interval {
    Weekly,
    Monthly,
    Yearly,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DebtKind {
    Debt,
    Loan,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub icon: String,
    #[serde(default)]
    pub initial: f64,
    #[serde(default = "yes")]
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub icon: String,
    #[serde(rename = "type")]
    pub kind: CategoryType,
    #[serde(default = "yes")]
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tx {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: TxType,
    pub amount: f64,
    pub account_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub to_account_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fee: Option<f64>,
    pub date: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub time: Option<String>,
    #[serde(default)]
    pub note: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub debt_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recurring_id: Option<String>,
    #[serde(default)]
    pub created_at: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Recurring {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub kind: CategoryType,
    pub amount: f64,
    pub account_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category_id: Option<String>,
    #[serde(default)]
    pub note: String,
    pub interval: Interval,
    pub start_date: String,
    pub next_date: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end_date: Option<String>,
    #[serde(default = "yes")]
    pub active: bool,
    #[serde(default)]
    pub is_subscription: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_posted_at: Option<f64>,
    #[serde(default)]
    pub created_at: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Budget {
    pub id: String,
    pub category_id: String,
    pub amount: f64,
    #[serde(default)]
    pub rollover: bool,
    pub start_month: String,
    #[serde(default = "yes")]
    pub active: bool,
    #[serde(default)]
    pub created_at: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Debt {
    pub id: String,
    pub kind: DebtKind,
    pub name: String,
    #[serde(default)]
    pub note: String,
    pub total: f64,
    pub account_id: String,
    pub start_date: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub due_date: Option<String>,
    #[serde(default)]
    pub created_at: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DebtPayment {
    pub id: String,
    pub debt_id: String,
    pub amount: f64,
    pub account_id: String,
    pub date: String,
    #[serde(default)]
    pub note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub base_url: String,
    #[serde(default = "default_ai_model")]
    pub model: String,
}

impl Default for AiSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            base_url: String::new(),
            model: default_ai_model(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    #[serde(default)]
    pub user_name: String,
    #[serde(default = "default_language")]
    pub language: String,
    #[serde(default = "default_currency")]
    pub currency: String,
    #[serde(default)]
    pub pin: Option<String>,
    #[serde(default)]
    pub onboarded: bool,
    #[serde(default)]
    pub tour_seen: bool,
    #[serde(default)]
    pub created_at: f64,
    #[serde(default)]
    pub ai: AiSettings,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            user_name: String::new(),
            language: default_language(),
            currency: default_currency(),
            pin: None,
            onboarded: false,
            tour_seen: false,
            created_at: 0.0,
            ai: AiSettings::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppState {
    #[serde(default = "default_version")]
    pub version: u32,
    #[serde(default)]
    pub accounts: Vec<Account>,
    #[serde(default)]
    pub categories: Vec<Category>,
    #[serde(default)]
    pub txs: Vec<Tx>,
    #[serde(default)]
    pub debts: Vec<Debt>,
    #[serde(default)]
    pub payments: Vec<DebtPayment>,
    #[serde(default)]
    pub recurring: Vec<Recurring>,
    #[serde(default)]
    pub budgets: Vec<Budget>,
    #[serde(default)]
    pub settings: Settings,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Filters {
    #[serde(default)]
    pub search: String,
    #[serde(rename = "type", default = "default_filter_type")]
    pub kind: String,
    #[serde(default = "default_all")]
    pub account_id: String,
    #[serde(default = "default_all")]
    pub category_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub from: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub to: Option<String>,
}

fn yes() -> bool {
    true
}

fn default_version() -> u32 {
    2
}

fn default_language() -> String {
    "id".into()
}

fn default_currency() -> String {
    "IDR".into()
}

fn default_ai_model() -> String {
    "jev-1.13-free".into()
}

fn default_filter_type() -> String {
    "all".into()
}

fn default_all() -> String {
    "all".into()
}
