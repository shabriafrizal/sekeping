//! On-device receipt parsing: amount, date, time, accounts, category, note.
//!
//! This is a faithful port of `src/lib/receipt.ts`. It uses only the person's
//! own ledger names plus a small keyword map, and returns a draft the
//! confirmation screen can edit before saving.

use std::sync::LazyLock;

use regex::Regex;
use serde::{Deserialize, Serialize};

use crate::dates::today_iso;
use crate::model::{Account, Category, CategoryType, TxType};
use crate::money::{amount_from_token, currency_has_cents, js_math_round, plain_number};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReceiptDraft {
    #[serde(rename = "type")]
    pub kind: TxType,
    pub amount: f64,
    pub account_id: String,
    pub to_account_id: String,
    pub category_id: String,
    pub date: String,
    pub time: String,
    pub note: String,
    pub confidence: f64,
    pub signals: Vec<String>,
    pub matches: ReceiptMatches,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReceiptMatches {
    pub amount: bool,
    pub date: bool,
    pub time: bool,
    pub note: bool,
    pub account: bool,
    pub category: bool,
    #[serde(rename = "type")]
    pub kind: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReceiptParseOptions {
    #[serde(default)]
    pub accounts: Vec<Account>,
    #[serde(default)]
    pub categories: Vec<Category>,
    #[serde(default = "default_currency")]
    pub currency: String,
    #[serde(default)]
    pub today: Option<String>,
    #[serde(default)]
    pub default_account_id: Option<String>,
    #[serde(default = "default_language")]
    pub language: String,
}

fn default_currency() -> String {
    "IDR".into()
}

fn default_language() -> String {
    "id".into()
}

struct Mention {
    account: Account,
    index: usize,
    source: bool,
    target: bool,
}

struct AmountCandidate {
    value: f64,
    score: f64,
    line: String,
}

fn month_number(name: &str) -> Option<u32> {
    Some(match name {
        "jan" | "januari" | "january" => 1,
        "feb" | "februari" | "february" => 2,
        "mar" | "maret" | "march" => 3,
        "apr" | "april" => 4,
        "mei" | "may" => 5,
        "jun" | "juni" | "june" => 6,
        "jul" | "juli" | "july" => 7,
        "agu" | "agt" | "agustus" | "aug" | "august" => 8,
        "sep" | "sept" | "september" => 9,
        "okt" | "oktober" | "oct" | "october" => 10,
        "nov" | "november" => 11,
        "des" | "desember" | "dec" | "december" => 12,
        _ => return None,
    })
}

fn account_aliases() -> &'static [(&'static str, &'static [&'static str])] {
    &[
        ("bca", &["bca", "bank central asia"]),
        ("bri", &["bri", "bank rakyat indonesia"]),
        ("bni", &["bni", "bank negara indonesia"]),
        ("mandiri", &["mandiri", "bank mandiri"]),
        ("gopay", &["gopay", "go pay"]),
        ("ovo", &["ovo"]),
        ("dana", &["dana"]),
        ("shopeepay", &["shopeepay", "shopee pay"]),
        ("linkaja", &["linkaja", "link aja"]),
        ("jenius", &["jenius"]),
        ("jago", &["jago", "bank jago"]),
        ("blu", &["blu", "blu bca"]),
        ("seabank", &["seabank", "sea bank"]),
        ("dompet", &["dompet", "cash", "tunai"]),
    ]
}

fn expense_hints() -> &'static [(LazyLock<Regex>, &'static [&'static str])] {
    static HINTS: LazyLock<Vec<(LazyLock<Regex>, &'static [&'static str])>> = LazyLock::new(|| {
        vec![
            (
                LazyLock::new(|| {
                    Regex::new(r"(?i-u)makan|minum|kopi|resto|restoran|warung|kafe|cafe|bakso|nasi|ayam|burger|pizza|gofood|grabfood|shopeefood")
                        .expect("static receipt hint")
                }),
                &["makan", "minum", "food", "kopi"],
            ),
            (
                LazyLock::new(|| {
                    Regex::new(r"(?i-u)transport|gojek|grab|bensin|pertalite|pertamax|parkir|tol|krl|mrt|lrt|transjakarta|ojek|taksi|taxi")
                        .expect("static receipt hint")
                }),
                &["transport", "bensin"],
            ),
            (
                LazyLock::new(|| {
                    Regex::new(r"(?i-u)listrik|pln|pdam|air|internet|indihome|pulsa|telkom|bpjs|tagihan|token|wifi")
                        .expect("static receipt hint")
                }),
                &["tagihan", "listrik", "internet", "pulsa"],
            ),
            (
                LazyLock::new(|| {
                    Regex::new(r"(?i-u)belanja|indomaret|alfamart|supermarket|tokopedia|shopee|lazada|mall|baju|sepatu|pakaian")
                        .expect("static receipt hint")
                }),
                &["belanja", "shopping"],
            ),
            (
                LazyLock::new(|| {
                    Regex::new(r"(?i-u)rumah|sewa|kos|kontrakan|perbaikan|furniture|perabot")
                        .expect("static receipt hint")
                }),
                &["rumah", "home"],
            ),
            (
                LazyLock::new(|| {
                    Regex::new(r"(?i-u)apotek|obat|dokter|klinik|rumah sakit|vitamin|kesehatan|lab")
                        .expect("static receipt hint")
                }),
                &["kesehatan", "health", "obat"],
            ),
            (
                LazyLock::new(|| {
                    Regex::new(r"(?i-u)bioskop|cinema|game|netflix|spotify|hiburan|konser|film")
                        .expect("static receipt hint")
                }),
                &["hiburan", "fun"],
            ),
            (
                LazyLock::new(|| {
                    Regex::new(r"(?i-u)kursus|kelas|sekolah|kampus|buku|udemy|coursera|pendidikan")
                        .expect("static receipt hint")
                }),
                &["pendidikan", "edu"],
            ),
            (
                LazyLock::new(|| {
                    Regex::new(r"(?i-u)hadiah|kado|gift").expect("static receipt hint")
                }),
                &["hadiah", "gift"],
            ),
        ]
    });
    &HINTS
}

fn income_hints() -> &'static [(LazyLock<Regex>, &'static [&'static str])] {
    static HINTS: LazyLock<Vec<(LazyLock<Regex>, &'static [&'static str])>> = LazyLock::new(|| {
        vec![
            (
                LazyLock::new(|| {
                    Regex::new(r"(?i-u)gaji|payroll|salary|upah|thr").expect("static receipt hint")
                }),
                &["gaji", "salary"],
            ),
            (
                LazyLock::new(|| {
                    Regex::new(r"(?i-u)bonus|tunjangan|insentif").expect("static receipt hint")
                }),
                &["bonus"],
            ),
            (
                LazyLock::new(|| {
                    Regex::new(r"(?i-u)dividen|bunga|investasi|reksadana|saham|profit")
                        .expect("static receipt hint")
                }),
                &["investasi", "invest"],
            ),
        ]
    });
    &HINTS
}

static TRANSFER_WORDS: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i-u)transfer|kirim uang|kirim dana|pindah buku|antar rekening|ke rekening|dari rekening|sumber dana|tujuan|penerima|top ?up|isi saldo")
        .expect("static transfer words")
});
static INCOME_WORDS: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i-u)dana masuk|uang masuk|transfer masuk|diterima|penerimaan|pendapatan|pemasukan|kredit|gaji|salary|bonus|refund|cashback|top ?up|isi saldo|terima dari")
        .expect("static income words")
});
static EXPENSE_WORDS: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i-u)pengeluaran|pembayaran|pembelian|bayar|belanja|debit|qris|tarik tunai|transfer keluar|kirim uang|merchant|struk|total bayar|nominal transfer")
        .expect("static expense words")
});
static BOILERPLATE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i-u)^(bukti|struk|resi|invoice|nota|detail|transaksi|transfer|pembayaran|pembelian|berhasil|sukses|selesai|status|tanggal|waktu|jam|no\.?|nomor|ref|referensi|kode|metode|sumber|dari|ke|tujuan|penerima|pengirim|nama|merchant|toko|keterangan|berita|deskripsi|catatan|total|jumlah|nominal|subtotal|saldo|admin|biaya|fee|ppn|pajak|diskon|kembalian|tunai|cash|debit|kredit|terima kasih|selamat datang|halo|bank|atm|qris|nobu|virtual account|va)\b")
        .expect("static boilerplate")
});
static DATE_LINE_MONEY: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i-u)(rp|idr|total|jumlah|nominal|bayar)").expect("static date money hint")
});
static MONEY_LINE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i-u)\b(rp|idr)\s*\d").expect("static money line"));
static LETTER_RUN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i-u)[a-z]{3}").expect("static letter run"));
static DATE_LINE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\b\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4}\b").expect("static date line")
});
static AMOUNT_TOKEN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i-u)(?:rp\.?|idr|usd|sgd|myr|eur|\$|€)?\s*\d[\d.,]*\d|\d")
        .expect("static amount token")
});
static SOURCE_CONTEXT: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i-u)(dari|sumber|asal|pengirim|rekening sumber|rekening asal|didebit|debit dari)\s*[:\-]?\s*$")
        .expect("static source context")
});
static TARGET_CONTEXT: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"(?i-u)(ke|tujuan|penerima|rekening tujuan|masuk ke|dikirim ke|transfer ke)\s*[:\-]?\s*$",
    )
    .expect("static target context")
});
static MERCHANT_HINT: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i-u)merchant|struk|toko|resto|kafe|kopi|belanja|pembayaran|qris")
        .expect("static merchant hint")
});
static NOTE_PRIORITY: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i-u)kopi|resto|restoran|kafe|cafe|warung|toko|merchant|mart|market|apotek|klinik|bioskop|hotel|travel|shop|store|bakso|nasi|ayam|pizza|burger")
        .expect("static note priority")
});
static NOTE_LABEL: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i-u)^([a-z ]+)\s*[:\-]\s*").expect("static note label"));
static YEAR_FIRST: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\b(20\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b").expect("static year-first date")
});
static NUMERIC_DATE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b").expect("static numeric date")
});
static NAMED_DATE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i-u)\b(\d{1,2})\s+(jan(?:uari)?|feb(?:ruari)?|mar(?:et)?|apr(?:il)?|mei|may|jun(?:i|e)?|jul(?:i|y)?|agu(?:stus)?|agt|aug(?:ust)?|sep(?:t(?:ember)?)?|okt(?:ober)?|oct(?:ober)?|nov(?:ember)?|des(?:ember)?|dec(?:ember)?)\s+(\d{2,4})\b")
        .expect("static named date")
});
static TIME: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\b([01]?\d|2[0-3])[:.]([0-5]\d)(?::[0-5]\d)?\b").expect("static time")
});
static SCORE_TOTAL: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i-u)(total|jumlah|nominal|amount|grand total|jumlah bayar|total bayar|jumlah transfer|nominal transfer)")
        .expect("static score total")
});
static SCORE_NOMINAL: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i-u)nominal|jumlah transfer|nominal transfer").expect("static score nominal")
});
static SCORE_PAY: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i-u)(bayar|dibayar|pembayaran|transfer|tagihan|diterima|masuk|kredit)")
        .expect("static score pay")
});
static SCORE_BALANCE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i-u)(saldo|balance)").expect("static score balance"));
static SCORE_TOTAL_WORD: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i-u)total").expect("static score total word"));
static SCORE_FEE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i-u)(admin|biaya|fee|ppn|pajak|diskon|kembalian|tunai|cash)")
        .expect("static score fee")
});
static SCORE_CURRENCY: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i-u)(rp|idr|usd|sgd|myr|eur|\$|€)").expect("static score currency")
});
static SCORE_RP: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i-u)(rp|idr)").expect("static score rp"));

fn normalize(value: &str) -> String {
    let lowered: String = value
        .to_lowercase()
        .chars()
        .map(|ch| match ch {
            '’' | '\'' | '`' => ' ',
            ch if ch.is_ascii_alphanumeric() => ch,
            _ => ' ',
        })
        .collect();
    lowered.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn clean_lines(text: &str) -> Vec<String> {
    text.replace('\r', "\n")
        .split('\n')
        .map(|line| {
            let mut value = String::new();
            let mut chars = line.chars().peekable();
            while let Some(ch) = chars.peek().copied() {
                if matches!(ch, '|' | ':' | ';' | '_' | '-' | '•' | '*' | '·') {
                    chars.next();
                } else {
                    break;
                }
            }
            let rest: String = chars.collect();
            let collapsed = rest.split_whitespace().collect::<Vec<_>>().join(" ");
            value.push_str(collapsed.trim());
            value
        })
        .filter(|line| !line.is_empty())
        .collect()
}

fn score_amount(line: &str, raw: &str, value: f64, currency: &str, index: usize) -> f64 {
    if !value.is_finite() || value <= 0.0 || value > 1_000_000_000_000.0 {
        return -1.0;
    }
    let mut score = 0.0;
    let lower = line.to_lowercase();
    let digits: String = raw.chars().filter(|c| c.is_ascii_digit()).collect();

    if SCORE_TOTAL.is_match(&lower) {
        score += 0.55;
    }
    if SCORE_NOMINAL.is_match(&lower) {
        score += 0.2;
    }
    if SCORE_PAY.is_match(&lower) {
        score += 0.15;
    }
    if SCORE_BALANCE.is_match(&lower) && !SCORE_TOTAL_WORD.is_match(&lower) {
        score -= 0.35;
    }
    if SCORE_FEE.is_match(&lower) {
        score -= 0.4;
    }
    if SCORE_CURRENCY.is_match(raw) {
        score += 0.25;
    }
    if digits.len() > 12 {
        score -= 0.6;
    }
    if digits.len() >= 10 && !raw.contains(['.', ',']) {
        score -= 0.4;
    }
    if value >= 1_000.0 {
        score += 0.08;
    }
    if value >= 10_000.0 {
        score += 0.08;
    }
    if (1900.0..=2100.0).contains(&value) && !raw.contains(['.', ',']) {
        score -= 0.45;
    }
    if !currency_has_cents(currency) && value < 100.0 && !SCORE_RP.is_match(raw) {
        score -= 0.15;
    }
    score + index as f64 * 0.002
}

fn find_amount(lines: &[String], currency: &str) -> Option<(f64, String)> {
    let mut candidates: Vec<AmountCandidate> = Vec::new();

    for (index, line) in lines.iter().enumerate() {
        if DATE_LINE.is_match(line) && !DATE_LINE_MONEY.is_match(line) {
            continue;
        }
        for matched in AMOUNT_TOKEN.find_iter(line) {
            let raw = matched.as_str();
            let value = amount_from_token(raw, currency);
            let score = score_amount(line, raw, value, currency, index);
            if score >= 0.0 {
                candidates.push(AmountCandidate {
                    value,
                    score,
                    line: line.clone(),
                });
            }
        }
    }

    let mut best_by_value: Vec<AmountCandidate> = Vec::new();
    for candidate in candidates {
        match best_by_value
            .iter_mut()
            .find(|existing| existing.value == candidate.value)
        {
            Some(existing) if existing.score < candidate.score => *existing = candidate,
            Some(_) => {}
            None => best_by_value.push(candidate),
        }
    }
    best_by_value.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    best_by_value
        .into_iter()
        .next()
        .map(|best| (best.value, best.line))
}

fn make_date(year: i32, month: u32, day: u32) -> Option<String> {
    let year = if year < 100 { year + 2000 } else { year };
    if !(2000..=2100).contains(&year) || !(1..=12).contains(&month) || !(1..=31).contains(&day) {
        return None;
    }
    let date = chrono::NaiveDate::from_ymd_opt(year, month, day)?;
    Some(crate::dates::to_iso(date))
}

fn find_date(text: &str) -> Option<String> {
    if let Some(caps) = YEAR_FIRST.captures(text) {
        let year = caps.get(1)?.as_str().parse().ok()?;
        let month = caps.get(2)?.as_str().parse().ok()?;
        let day = caps.get(3)?.as_str().parse().ok()?;
        if let Some(value) = make_date(year, month, day) {
            return Some(value);
        }
    }

    if let Some(caps) = NUMERIC_DATE.captures(text) {
        let first: i32 = caps.get(1)?.as_str().parse().ok()?;
        let second: i32 = caps.get(2)?.as_str().parse().ok()?;
        let year: i32 = caps.get(3)?.as_str().parse().ok()?;
        // Receipts are day-first. Flip only when the second part cannot be a day.
        let month_first = second > 12 && first <= 12;
        let day = if month_first { second } else { first };
        let month = if month_first { first } else { second };
        if let Some(value) = make_date(year, month.max(0) as u32, day.max(0) as u32) {
            return Some(value);
        }
    }

    if let Some(caps) = NAMED_DATE.captures(text) {
        let day: i32 = caps.get(1)?.as_str().parse().ok()?;
        let month = month_number(&caps.get(2)?.as_str().to_lowercase())?;
        let year: i32 = caps.get(3)?.as_str().parse().ok()?;
        return make_date(year, month, day.max(0) as u32);
    }

    None
}

fn find_time(text: &str) -> Option<String> {
    let caps = TIME.captures(text)?;
    let hour: u32 = caps.get(1)?.as_str().parse().ok()?;
    let minute = caps.get(2)?.as_str();
    Some(format!("{hour:02}:{minute}"))
}

fn aliases_for(account: &Account) -> Vec<String> {
    let name = normalize(&account.name);
    let mut result = vec![name.clone()];
    let compact = name.replace(' ', "");
    if !result.contains(&compact) {
        result.push(compact.clone());
    }
    for (key, aliases) in account_aliases() {
        if name.contains(key)
            || compact.contains(key)
            || aliases.iter().any(|alias| name.contains(alias))
        {
            for alias in *aliases {
                let alias = (*alias).to_string();
                if !result.contains(&alias) {
                    result.push(alias);
                }
            }
        }
    }
    result.retain(|alias| alias.chars().count() >= 2);
    result
}

fn char_index(text: &str, byte_index: usize) -> usize {
    text[..byte_index].chars().count()
}

fn slice_chars(text: &str, start: usize, end: usize) -> String {
    text.chars()
        .skip(start)
        .take(end.saturating_sub(start))
        .collect()
}

fn find_accounts(text: &str, accounts: &[Account]) -> Vec<Mention> {
    let lower = text.to_lowercase();
    let mut mentions = Vec::new();
    for account in accounts {
        let mut index: Option<usize> = None;
        for alias in aliases_for(account) {
            if let Some(byte) = lower.find(&alias) {
                let at = char_index(&lower, byte);
                if index.is_none_or(|current| at < current) {
                    index = Some(at);
                }
            }
        }
        let Some(index) = index else {
            continue;
        };
        let before = slice_chars(&lower, index.saturating_sub(42), index);
        let source = SOURCE_CONTEXT.is_match(&before);
        let target = TARGET_CONTEXT.is_match(&before);
        mentions.push(Mention {
            account: account.clone(),
            index,
            source,
            target,
        });
    }
    mentions.sort_by_key(|mention| mention.index);
    mentions
}

fn category_type_for(kind: TxType) -> Option<CategoryType> {
    match kind {
        TxType::Expense => Some(CategoryType::Expense),
        TxType::Income => Some(CategoryType::Income),
        TxType::Transfer => None,
    }
}

fn find_category(text: &str, categories: &[Category], kind: TxType) -> (Option<Category>, usize) {
    let Some(wanted) = category_type_for(kind) else {
        return (None, 0);
    };
    let lower = text.to_lowercase();
    let hints = if kind == TxType::Expense {
        expense_hints()
    } else {
        income_hints()
    };
    let mut best: Option<Category> = None;
    let mut best_score = 0usize;

    for category in categories
        .iter()
        .filter(|category| category.active && category.kind == wanted)
    {
        let mut score = 0usize;
        let name = normalize(&category.name);
        if !name.is_empty() && lower.contains(&name) {
            score += 3;
        }
        for part in name.split(' ') {
            if part.chars().count() >= 3 && lower.contains(part) {
                score += 1;
            }
        }
        for (pattern, words) in hints {
            if pattern.is_match(&lower) {
                let overlapping = words
                    .iter()
                    .filter(|word| {
                        name.contains(**word) || lower.contains(&format!("{word} {name}"))
                    })
                    .count();
                if overlapping > 0 {
                    score += 2;
                }
            }
        }
        if score > best_score {
            best = Some(category.clone());
            best_score = score;
        }
    }
    (if best_score > 0 { best } else { None }, best_score)
}

fn guess_type(
    text: &str,
    mentions: &[Mention],
    amount_line: &str,
    lang: &str,
) -> (TxType, f64, String) {
    let lower = text.to_lowercase();
    let source = mentions.iter().find(|mention| mention.source);
    let target = mentions.iter().find(|mention| {
        mention.target && source.is_none_or(|source| mention.account.id != source.account.id)
    });
    let both_own = source.is_some() && target.is_some();
    let target_own = mentions.iter().any(|mention| mention.target);
    let transfer_hits = TRANSFER_WORDS.find_iter(&lower).count();
    let income_hits = INCOME_WORDS.find_iter(&lower).count();
    let expense_hits = EXPENSE_WORDS.find_iter(&lower).count();

    let mut transfer = transfer_hits as f64 * 1.1;
    if both_own {
        transfer += 4.0;
    } else if target_own
        && Regex::new(r"(?i-u)transfer|top ?up|isi saldo|pindah")
            .expect("static transfer hint")
            .is_match(&lower)
    {
        transfer += 2.0;
    }
    if Regex::new(r"(?i-u)(transfer|pindah buku|top ?up)")
        .expect("static amount transfer")
        .is_match(amount_line)
    {
        transfer += 0.8;
    }

    let mut income = income_hits as f64 * 1.2;
    if source.is_some()
        && Regex::new(r"(?i-u)(masuk|diterima|terima|dari)")
            .expect("static income context")
            .is_match(&lower)
    {
        income += 1.2;
    }
    if Regex::new(r"(?i-u)(gaji|salary|payroll|bonus|dividen|bunga|cashback|refund)")
        .expect("static income hint")
        .is_match(&lower)
    {
        income += 1.6;
    }

    let mut expense = expense_hits as f64 * 1.2;
    if MERCHANT_HINT.is_match(&lower) {
        expense += 1.4;
    }
    if mentions.len() == 1 && mentions[0].source {
        expense += 0.5;
    }

    if Regex::new(r"(?i-u)transfer")
        .expect("static transfer word")
        .is_match(&lower)
        && !both_own
    {
        expense += 0.4;
        transfer -= 0.8;
    }

    if transfer >= income && transfer >= expense && transfer > 0.0 {
        return (
            TxType::Transfer,
            transfer,
            tr("Kata kunci transfer dan rekening tujuan cocok", lang),
        );
    }
    if income > expense {
        return (
            TxType::Income,
            income,
            tr("Kata kunci uang masuk cocok", lang),
        );
    }
    (
        TxType::Expense,
        expense.max(0.2),
        tr("Kata kunci pembayaran cocok", lang),
    )
}

fn find_note(
    lines: &[String],
    kind: TxType,
    account: Option<&Account>,
    to_account: Option<&Account>,
    lang: &str,
) -> String {
    let mut candidates: Vec<String> = Vec::new();
    for line in lines {
        let mut value = line.clone();
        if let Some(caps) = NOTE_LABEL.captures(line) {
            if let Some(label) = caps.get(1) {
                let label = label.as_str().trim();
                if matches!(
                    label,
                    "merchant"
                        | "toko"
                        | "nama"
                        | "penerima"
                        | "berita"
                        | "keterangan"
                        | "deskripsi"
                        | "catatan"
                        | "untuk"
                ) {
                    value = line[caps.get(0).map(|m| m.end()).unwrap_or(0)..].to_string();
                }
            }
        }
        let value = value.split_whitespace().collect::<Vec<_>>().join(" ");
        let value = value.trim().to_string();
        if value.chars().count() < 3 || value.chars().count() > 80 {
            continue;
        }
        if !value.chars().any(|c| c.is_ascii_alphabetic()) {
            continue;
        }
        if BOILERPLATE.is_match(&value) {
            continue;
        }
        if MONEY_LINE.is_match(&value) {
            continue;
        }
        if value.starts_with(|c: char| c.is_ascii_digit()) && !LETTER_RUN.is_match(&value) {
            continue;
        }
        candidates.push(value);
    }

    let prioritized = candidates
        .iter()
        .find(|line| NOTE_PRIORITY.is_match(line))
        .cloned();
    let mut note = prioritized
        .or_else(|| candidates.first().cloned())
        .unwrap_or_default();

    if kind == TxType::Transfer {
        if let Some(target) = to_account {
            note = if lang == "en" {
                format!("Transfer to {}", target.name)
            } else {
                format!("Transfer ke {}", target.name)
            };
        } else if !note.is_empty() {
            note = format!("Transfer · {note}");
        } else {
            note = tr("Transfer", lang).to_string();
        }
    } else if kind == TxType::Income && account.is_some() && note.is_empty() {
        let name = account
            .map(|account| account.name.clone())
            .unwrap_or_default();
        note = if lang == "en" {
            format!("Money in to {name}")
        } else {
            format!("Dana masuk ke {name}")
        };
    }

    let note = note.trim_end_matches(['|', ';']).trim();
    note.chars().take(80).collect()
}

fn tr(key: &str, lang: &str) -> String {
    if lang != "en" {
        return key.to_string();
    }
    let value = match key {
        "Kata kunci transfer dan rekening tujuan cocok" => {
            "Transfer keyword and destination account matched"
        }
        "Kata kunci uang masuk cocok" => "Money-in keyword matched",
        "Kata kunci pembayaran cocok" => "Payment keyword matched",
        "Transfer ke" => "Transfer to",
        "Transfer" => "Transfer",
        "Transfer · {note}" => "Transfer · {note}",
        "Dana masuk ke {name}" => "Money in to {name}",
        "Nominal {amount} terbaca" => "Amount {amount} read",
        "Tanggal {date} terbaca" => "Date {date} read",
        "Waktu {time} terbaca" => "Time {time} read",
        "Rekening disebut: {name}" => "Account mentioned: {name}",
        "Arah: transfer ke {name}" => "Direction: transfer to {name}",
        "Kategori cocok: {name}" => "Category matched: {name}",
        _ => key,
    };
    value.to_string()
}

fn fill(template: &str, name: &str, value: &str) -> String {
    template.replace(&format!("{{{name}}}"), value)
}

/// Read receipt text without any network call.
pub fn parse_receipt_text(text: &str, options: &ReceiptParseOptions) -> ReceiptDraft {
    let lang = if options.language == "en" { "en" } else { "id" };
    let accounts = &options.accounts;
    let categories = &options.categories;
    let currency = if options.currency.is_empty() {
        "IDR"
    } else {
        options.currency.as_str()
    };
    let clean = text.replace('\u{a0}', " ");
    let clean = clean.trim();
    let lines = clean_lines(clean);
    let flat = lines.join("\n");
    let today = options.today.clone().unwrap_or_else(today_iso);

    let amount = find_amount(&lines, currency);
    let date = find_date(&flat);
    let time = find_time(&flat);
    let mentions = find_accounts(&flat, accounts);

    let amount_line = amount.as_ref().map(|(_, line)| line.as_str()).unwrap_or("");
    let (mut kind, type_score, type_signal) = guess_type(&flat, &mentions, amount_line, lang);

    let source_index = mentions.iter().position(|mention| mention.source);
    let target_index = mentions.iter().position(|mention| {
        mention.target
            && source_index.is_none_or(|source| mention.account.id != mentions[source].account.id)
    });

    let mut to_account: Option<&Account> = None;
    let mut account: Option<&Account> = if kind == TxType::Transfer {
        source_index
            .map(|index| &mentions[index].account)
            .or_else(|| {
                if target_index.is_some() {
                    None
                } else {
                    mentions.first().map(|mention| &mention.account)
                }
            })
    } else if kind == TxType::Income {
        target_index
            .map(|index| &mentions[index].account)
            .or_else(|| mentions.first().map(|mention| &mention.account))
    } else {
        source_index
            .map(|index| &mentions[index].account)
            .or_else(|| mentions.first().map(|mention| &mention.account))
    };

    if kind == TxType::Transfer {
        to_account = target_index
            .map(|index| &mentions[index].account)
            .or_else(|| {
                mentions
                    .iter()
                    .find(|mention| Some(&mention.account.id) != account.map(|a| &a.id))
                    .map(|mention| &mention.account)
            });
        if account.is_none() {
            if let Some(target) = to_account {
                account = accounts
                    .iter()
                    .find(|candidate| candidate.active && candidate.id != target.id);
            }
        }
        if to_account.is_none() {
            kind = TxType::Expense;
        }
    }

    if account.is_none() {
        account = accounts
            .iter()
            .find(|candidate| {
                candidate.active
                    && options
                        .default_account_id
                        .as_ref()
                        .is_some_and(|id| &candidate.id == id)
            })
            .or_else(|| accounts.iter().find(|candidate| candidate.active))
            .or_else(|| accounts.first());
    }

    if kind == TxType::Transfer {
        let missing = to_account.is_none()
            || account
                .is_some_and(|account| to_account.is_some_and(|target| target.id == account.id));
        if missing {
            to_account = accounts.iter().find(|candidate| {
                candidate.active && account.is_none_or(|account| candidate.id != account.id)
            });
            if to_account.is_none() {
                kind = TxType::Expense;
            }
        }
    }

    let (category_match, category_score) = find_category(&flat, categories, kind);
    let category = if kind == TxType::Transfer {
        None
    } else {
        category_match.clone().or_else(|| {
            categories
                .iter()
                .find(|candidate| {
                    candidate.active
                        && category_type_for(kind) == Some(candidate.kind)
                        && candidate.id == "cat_other_in"
                })
                .or_else(|| {
                    categories.iter().find(|candidate| {
                        candidate.active && category_type_for(kind) == Some(candidate.kind)
                    })
                })
                .cloned()
        })
    };

    let note = find_note(&lines, kind, account, to_account, lang);

    let matches = ReceiptMatches {
        amount: amount.is_some(),
        date: date.is_some(),
        time: time.is_some(),
        note: !note.is_empty(),
        account: account.is_some()
            && (source_index.is_some() || target_index.is_some() || !mentions.is_empty()),
        category: category_match.is_some(),
        kind: type_score >= 1.2,
    };

    let mut signals = Vec::new();
    if let Some((value, _)) = &amount {
        let template = tr("Nominal {amount} terbaca", lang);
        let locale = if lang == "en" { "en-US" } else { "id-ID" };
        signals.push(fill(&template, "amount", &plain_number(*value, locale)));
    }
    if let Some(value) = &date {
        let template = tr("Tanggal {date} terbaca", lang);
        signals.push(fill(&template, "date", value));
    }
    if let Some(value) = &time {
        let template = tr("Waktu {time} terbaca", lang);
        signals.push(fill(&template, "time", value));
    }
    if !mentions.is_empty() {
        let names = mentions
            .iter()
            .map(|mention| mention.account.name.as_str())
            .collect::<Vec<_>>()
            .join(", ");
        let template = tr("Rekening disebut: {name}", lang);
        signals.push(fill(&template, "name", &names));
    }
    if kind == TxType::Transfer {
        if let Some(target) = to_account {
            let template = tr("Arah: transfer ke {name}", lang);
            signals.push(fill(&template, "name", &target.name));
        }
    }
    if let Some(category) = &category_match {
        let template = tr("Kategori cocok: {name}", lang);
        signals.push(fill(&template, "name", &category.name));
    }
    if type_score >= 1.2 {
        signals.push(type_signal);
    }

    let mut confidence = 0.28;
    if matches.amount {
        confidence += 0.27;
    }
    if matches.date {
        confidence += 0.09;
    }
    if matches.time {
        confidence += 0.04;
    }
    if matches.account {
        confidence += 0.13;
    }
    if matches.category {
        confidence += 0.13;
    }
    if matches.kind {
        confidence += 0.08;
    }
    let confidence = (js_math_round(confidence * 100.0) / 100.0).min(0.95);

    let _ = category_score;
    ReceiptDraft {
        kind,
        amount: amount.map(|(value, _)| value).unwrap_or(0.0),
        account_id: account
            .map(|account| account.id.clone())
            .unwrap_or_default(),
        to_account_id: if kind == TxType::Transfer {
            to_account
                .map(|account| account.id.clone())
                .unwrap_or_default()
        } else {
            String::new()
        },
        category_id: if kind == TxType::Transfer {
            String::new()
        } else {
            category
                .map(|category| category.id.clone())
                .unwrap_or_default()
        },
        date: date.unwrap_or(today),
        time: time.unwrap_or_default(),
        note,
        confidence,
        signals,
        matches,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn account(id: &str, name: &str) -> Account {
        Account {
            id: id.into(),
            name: name.into(),
            icon: String::new(),
            initial: 0.0,
            active: true,
        }
    }

    fn category(id: &str, name: &str, kind: CategoryType) -> Category {
        Category {
            id: id.into(),
            name: name.into(),
            icon: String::new(),
            kind,
            active: true,
        }
    }

    fn options() -> ReceiptParseOptions {
        ReceiptParseOptions {
            accounts: vec![account("acc_bank", "BCA"), account("acc_cash", "Dompet")],
            categories: vec![
                category("cat_food", "Makan & Minum", CategoryType::Expense),
                category("cat_bills", "Tagihan", CategoryType::Expense),
                category("cat_salary", "Gaji", CategoryType::Income),
            ],
            currency: "IDR".into(),
            today: Some("2026-11-20".into()),
            default_account_id: Some("acc_bank".into()),
            language: "id".into(),
        }
    }

    #[test]
    fn reads_a_coffee_receipt() {
        let text = "KOPI SUSU\nTanggal: 19/11/2026 14:05\nTotal: Rp 25.000\nBayar: Rp 25.000\nBCA";
        let draft = parse_receipt_text(text, &options());
        assert_eq!(draft.kind, TxType::Expense);
        assert_eq!(draft.amount, 25_000.0);
        assert_eq!(draft.date, "2026-11-19");
        assert_eq!(draft.time, "14:05");
        assert_eq!(draft.account_id, "acc_bank");
        assert_eq!(draft.category_id, "cat_food");
        assert!(draft.note.to_lowercase().contains("kopi"));
        assert!(draft.confidence > 0.5);
    }

    #[test]
    fn recognises_an_internal_transfer() {
        let text =
            "Transfer ke Dompet\nDari rekening BCA\nNominal transfer Rp 500.000\n20 Nov 2026";
        let draft = parse_receipt_text(text, &options());
        assert_eq!(draft.kind, TxType::Transfer);
        assert_eq!(draft.amount, 500_000.0);
        assert_eq!(draft.account_id, "acc_bank");
        assert_eq!(draft.to_account_id, "acc_cash");
        assert!(draft.note.contains("Dompet"));
    }

    #[test]
    fn salary_is_income() {
        let text = "GAJI NOVEMBER\nPT Contoh\nTanggal 25/11/2026\nDana masuk Rp 14.500.000\nBCA";
        let draft = parse_receipt_text(text, &options());
        assert_eq!(draft.kind, TxType::Income);
        assert_eq!(draft.amount, 14_500_000.0);
        assert_eq!(draft.category_id, "cat_salary");
    }

    #[test]
    fn empty_and_odd_text_stays_a_safe_draft() {
        let draft = parse_receipt_text("", &options());
        assert_eq!(draft.amount, 0.0);
        assert_eq!(draft.date, "2026-11-20");
        assert!(draft.note.is_empty());

        let odd = "🛒\u{0}\n\r\n====\nRp\n0\n";
        let draft = parse_receipt_text(odd, &options());
        assert!(draft.confidence <= 0.95);
        assert!(draft.signals.len() <= 8);
    }

    #[test]
    fn english_signals_and_note() {
        let mut english = options();
        english.language = "en".into();
        let text = "KOPI SUSU\nTanggal: 19/11/2026 14:05\nTotal: Rp 25.000\nBayar: Rp 25.000\nBCA";
        let draft = parse_receipt_text(text, &english);
        assert!(draft
            .signals
            .iter()
            .any(|signal| signal.starts_with("Amount ")));
        assert!(draft
            .signals
            .iter()
            .any(|signal| signal.starts_with("Date ")));
    }

    #[test]
    fn amount_prefers_total_over_balance() {
        let text = "Saldo Rp 1.000.000\nTotal bayar Rp 25.000\nAdmin Rp 2.500";
        let draft = parse_receipt_text(text, &options());
        assert_eq!(draft.amount, 25_000.0);
    }
}
