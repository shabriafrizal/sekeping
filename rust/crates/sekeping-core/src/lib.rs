//! Pure Rust domain core for Sekeping.
//!
//! The browser app reaches this crate through `sekeping-wasm`; the command
//! line reaches it through `sekeping-cli`. Nothing here touches the DOM.

pub mod backup;
pub mod budgets;
pub mod crypto;
pub mod csv;
pub mod dates;
pub mod model;
pub mod money;
pub mod receipt;
pub mod recurring;
pub mod reports;
