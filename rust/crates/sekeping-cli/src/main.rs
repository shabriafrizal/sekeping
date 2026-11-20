//! `sekeping` — small command line companion for the local-first ledger.
//!
//! Everything here runs the same Rust core as the browser build, so a backup
//! written in the app can be checked, summarised, exported and unlocked in a
//! terminal without installing a browser.

use std::fs;
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};

use clap::{Parser, Subcommand};
use serde_json::Value;

use sekeping_core::model::{AppState, Filters};
use sekeping_core::{backup, crypto, receipt, recurring, reports};

#[derive(Debug, Parser)]
#[command(
    name = "sekeping",
    version,
    about = "Validate, summarise, export and encrypt Sekeping ledgers"
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// Validate a backup and print a readable report.
    Validate {
        /// Backup file, or `-` for stdin.
        #[arg(default_value = "-")]
        input: String,
        /// Print the report as JSON.
        #[arg(long)]
        json: bool,
    },
    /// Print the ledger summary (counts, date span, totals).
    Summary {
        #[arg(default_value = "-")]
        input: String,
        /// Print plain text instead of JSON.
        #[arg(long)]
        text: bool,
    },
    /// Export transactions as CSV.
    ExportCsv {
        #[arg(default_value = "-")]
        input: String,
        /// Where to write the CSV. Omit for stdout.
        #[arg(long, short)]
        out: Option<PathBuf>,
        /// Filter by type: expense, income, transfer or all.
        #[arg(long, default_value = "all")]
        r#type: String,
        /// Filter by account id.
        #[arg(long, default_value = "all")]
        account: String,
        /// Filter by category id.
        #[arg(long, default_value = "all")]
        category: String,
        /// First date (inclusive), `YYYY-MM-DD`.
        #[arg(long)]
        from: Option<String>,
        /// Last date (inclusive), `YYYY-MM-DD`.
        #[arg(long)]
        to: Option<String>,
        /// Case-insensitive text search in notes.
        #[arg(long, default_value = "")]
        search: String,
    },
    /// Print transactions that are due now and their next dates.
    RecurringDue {
        #[arg(default_value = "-")]
        input: String,
        /// Treat this date as today.
        #[arg(long)]
        today: Option<String>,
        /// Only print the number of due transactions.
        #[arg(long)]
        count: bool,
    },
    /// Read receipt text into an editable draft.
    Receipt {
        /// Receipt text file, or `-` for stdin.
        #[arg(default_value = "-")]
        input: String,
        /// JSON file with `accounts`, `categories`, `currency`, `today`.
        #[arg(long)]
        options: Option<PathBuf>,
        /// Treat this date as today.
        #[arg(long)]
        today: Option<String>,
    },
    /// Encrypt a JSON file with a password.
    Encrypt {
        #[arg(default_value = "-")]
        input: String,
        /// Where to write the envelope. Omit for stdout.
        #[arg(long, short)]
        out: Option<PathBuf>,
        /// Password. Prefer SEKEPING_PASSWORD to keep it out of shell history.
        #[arg(long, env = "SEKEPING_PASSWORD", hide_env_values = true)]
        password: String,
        /// Overwrite the output file if it exists.
        #[arg(long)]
        force: bool,
    },
    /// Decrypt a password-protected backup.
    Decrypt {
        #[arg(default_value = "-")]
        input: String,
        /// Where to write the plaintext. Omit for stdout.
        #[arg(long, short)]
        out: Option<PathBuf>,
        #[arg(long, env = "SEKEPING_PASSWORD", hide_env_values = true)]
        password: String,
        /// Pretty-print the decrypted JSON.
        #[arg(long)]
        pretty: bool,
        #[arg(long)]
        force: bool,
    },
    /// Say whether a file is a Sekeping encrypted envelope.
    CheckEncrypted {
        #[arg(default_value = "-")]
        input: String,
    },
}

fn read_input(path: &str) -> Result<String, String> {
    if path == "-" {
        let mut buffer = String::new();
        io::stdin()
            .read_to_string(&mut buffer)
            .map_err(|error| format!("stdin: {error}"))?;
        Ok(buffer)
    } else {
        fs::read_to_string(path).map_err(|error| format!("{path}: {error}"))
    }
}

fn write_output(path: Option<&Path>, data: &str, force: bool) -> Result<(), String> {
    match path {
        Some(path) => {
            if path.exists() && !force {
                return Err(format!(
                    "{} exists; pass --force to overwrite",
                    path.display()
                ));
            }
            fs::write(path, data).map_err(|error| format!("{}: {error}", path.display()))
        }
        None => {
            let mut stdout = io::stdout().lock();
            stdout
                .write_all(data.as_bytes())
                .and_then(|_| {
                    if data.ends_with('\n') {
                        Ok(())
                    } else {
                        stdout.write_all(b"\n")
                    }
                })
                .map_err(|error| format!("stdout: {error}"))
        }
    }
}

fn state_from(text: &str) -> Result<AppState, String> {
    serde_json::from_str(text).map_err(|error| format!("backup: {error}"))
}

fn validate(input: &str, json: bool) -> Result<i32, String> {
    let text = read_input(input)?;
    let report = backup::validate_json(&text);
    if json {
        println!(
            "{}",
            serde_json::to_string_pretty(&report).map_err(|error| error.to_string())?
        );
    } else if report.ok {
        let summary = report.summary.as_ref();
        println!("ok: no errors");
        if let Some(summary) = summary {
            println!(
                "{} accounts, {} categories, {} transactions, {} recurring, {} budgets",
                summary.accounts,
                summary.categories,
                summary.txs,
                summary.recurring,
                summary.budgets
            );
            if let (Some(first), Some(last)) = (&summary.first_date, &summary.last_date) {
                println!("dates: {first} .. {last}");
            }
        }
    } else {
        println!("{} error(s), {} warning(s)", report.errors, report.warnings);
    }
    for issue in &report.issues {
        let level = match issue.severity {
            backup::Severity::Error => "error",
            backup::Severity::Warning => "warning",
        };
        println!("{level} [{}] {}: {}", issue.code, issue.path, issue.message);
    }
    Ok(if report.ok { 0 } else { 1 })
}

fn summary(input: &str, text: bool) -> Result<(), String> {
    let state = state_from(&read_input(input)?)?;
    let summary = reports::summary(&state);
    if text {
        println!("currency: {}", summary.currency);
        println!("language: {}", summary.language);
        println!(
            "accounts: {}  categories: {}  transactions: {}",
            summary.accounts, summary.categories, summary.txs
        );
        println!(
            "debts: {}  payments: {}  recurring: {}  budgets: {}",
            summary.debts, summary.payments, summary.recurring, summary.budgets
        );
        println!("income: {:.2}", summary.income);
        println!("expense: {:.2}", summary.expense);
        println!("transfers: {:.2}", summary.transfers);
        println!("net worth: {:.2}", summary.net_worth);
        if let (Some(first), Some(last)) = (&summary.first_date, &summary.last_date) {
            println!("dates: {first} .. {last}");
        }
    } else {
        println!(
            "{}",
            serde_json::to_string_pretty(&summary).map_err(|error| error.to_string())?
        );
    }
    Ok(())
}

fn export_csv(
    input: &str,
    out: Option<&Path>,
    filters: Filters,
    force: bool,
) -> Result<(), String> {
    let state = state_from(&read_input(input)?)?;
    let labels = reports::CsvLabels::default();
    let csv = reports::export_csv(&state, Some(&filters), &labels);
    write_output(out, &csv, force)
}

fn recurring_due(input: &str, today: Option<&str>, count_only: bool) -> Result<(), String> {
    let state = state_from(&read_input(input)?)?;
    let today = today.map(str::to_string).unwrap_or_else(recurring::today);
    let run = recurring::collect_due(&state.recurring, &today);
    if count_only {
        println!("{}", run.count);
        return Ok(());
    }
    let payload = serde_json::json!({
        "today": today,
        "count": run.count,
        "txs": run.txs,
        "nextDates": run.next_dates,
    });
    println!(
        "{}",
        serde_json::to_string_pretty(&payload).map_err(|error| error.to_string())?
    );
    Ok(())
}

fn receipt_draft(
    input: &str,
    options_path: Option<&Path>,
    today: Option<&str>,
) -> Result<(), String> {
    let text = read_input(input)?;
    let mut options: receipt::ReceiptParseOptions = match options_path {
        Some(path) => serde_json::from_str(
            &fs::read_to_string(path).map_err(|error| format!("{}: {error}", path.display()))?,
        )
        .map_err(|error| format!("{}: {error}", path.display()))?,
        None => receipt::ReceiptParseOptions {
            accounts: Vec::new(),
            categories: Vec::new(),
            currency: "IDR".into(),
            today: None,
            default_account_id: None,
            language: "id".into(),
        },
    };
    if let Some(today) = today {
        options.today = Some(today.to_string());
    }
    let draft = receipt::parse_receipt_text(&text, &options);
    println!(
        "{}",
        serde_json::to_string_pretty(&draft).map_err(|error| error.to_string())?
    );
    Ok(())
}

fn encrypt(input: &str, out: Option<&Path>, password: &str, force: bool) -> Result<(), String> {
    let plaintext = read_input(input)?;
    if crypto::is_encrypted_export(&plaintext) {
        return Err("input is already encrypted".into());
    }
    let envelope = crypto::encrypt_text(&plaintext, password)?;
    write_output(out, &envelope, force)
}

fn decrypt(
    input: &str,
    out: Option<&Path>,
    password: &str,
    pretty: bool,
    force: bool,
) -> Result<(), String> {
    let plaintext = crypto::decrypt_text(&read_input(input)?, password)?;
    let data = if pretty {
        match serde_json::from_str::<Value>(&plaintext) {
            Ok(value) => serde_json::to_string_pretty(&value).map_err(|error| error.to_string())?,
            Err(_) => plaintext,
        }
    } else {
        plaintext
    };
    write_output(out, &data, force)
}

fn check_encrypted(input: &str) -> Result<i32, String> {
    let text = read_input(input)?;
    if crypto::is_encrypted_export(&text) {
        println!("encrypted");
        Ok(0)
    } else {
        println!("not encrypted");
        Ok(1)
    }
}

fn main() {
    let cli = Cli::parse();
    let result = match cli.command {
        Command::Validate { input, json } => validate(&input, json),
        Command::Summary { input, text } => summary(&input, text).map(|_| 0),
        Command::ExportCsv {
            input,
            out,
            r#type,
            account,
            category,
            from,
            to,
            search,
        } => {
            let filters = Filters {
                search,
                kind: r#type,
                account_id: account,
                category_id: category,
                from,
                to,
            };
            export_csv(&input, out.as_deref(), filters, false).map(|_| 0)
        }
        Command::RecurringDue {
            input,
            today,
            count,
        } => recurring_due(&input, today.as_deref(), count).map(|_| 0),
        Command::Receipt {
            input,
            options,
            today,
        } => receipt_draft(&input, options.as_deref(), today.as_deref()).map(|_| 0),
        Command::Encrypt {
            input,
            out,
            password,
            force,
        } => encrypt(&input, out.as_deref(), &password, force).map(|_| 0),
        Command::Decrypt {
            input,
            out,
            password,
            pretty,
            force,
        } => decrypt(&input, out.as_deref(), &password, pretty, force).map(|_| 0),
        Command::CheckEncrypted { input } => check_encrypted(&input),
    };

    match result {
        Ok(code) => std::process::exit(code),
        Err(message) => {
            eprintln!("sekeping: {message}");
            std::process::exit(2);
        }
    }
}
