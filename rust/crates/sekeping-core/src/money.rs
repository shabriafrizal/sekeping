//! Money parsing and formatting.
//!
//! Display formatting deliberately mirrors `Intl.NumberFormat` for the two
//! locales the app supports (`id-ID` and `en-US`) instead of pulling an ICU
//! data bundle into the WASM binary. Parsing mirrors `Number.parseFloat` and
//! the app's separator heuristics, including their lenient edge cases.

const IDR: &str = "IDR";

pub fn currency_symbol(currency: &str) -> &'static str {
    match currency {
        "IDR" => "Rp",
        "USD" => "$",
        "EUR" => "€",
        "SGD" => "S$",
        "MYR" => "RM",
        _ => "",
    }
}

pub fn currency_has_cents(currency: &str) -> bool {
    currency != IDR
}

fn is_english(locale: &str) -> bool {
    locale.starts_with("en")
}

fn group_separator(locale: &str) -> char {
    if is_english(locale) {
        ','
    } else {
        '.'
    }
}

fn decimal_separator(locale: &str) -> char {
    if is_english(locale) {
        '.'
    } else {
        ','
    }
}

/// `Math.round`: halves go towards positive infinity, unlike `f64::round`.
pub fn js_math_round(value: f64) -> f64 {
    if !value.is_finite() {
        return value;
    }
    let floor = value.floor();
    if value - floor >= 0.5 {
        floor + 1.0
    } else {
        floor
    }
}

/// Parse the numeric prefix the way `Number.parseFloat` does. `"1.2.3"` is
/// `1.2`, not an error.
pub fn js_parse_float_prefix(raw: &str) -> Option<f64> {
    let text = raw.trim_start();
    let mut chars = text.char_indices().peekable();
    let mut end = 0;
    let mut seen_digit = false;

    if let Some((_, sign)) = chars.peek() {
        if *sign == '+' || *sign == '-' {
            chars.next();
            end = 1;
        }
    }

    while let Some((index, ch)) = chars.peek().copied() {
        if ch.is_ascii_digit() {
            seen_digit = true;
            end = index + 1;
            chars.next();
        } else {
            break;
        }
    }

    if let Some((index, '.')) = chars.peek().copied() {
        chars.next();
        end = index + 1;
        while let Some((index, ch)) = chars.peek().copied() {
            if ch.is_ascii_digit() {
                seen_digit = true;
                end = index + 1;
                chars.next();
            } else {
                break;
            }
        }
    }

    if !seen_digit {
        return None;
    }

    if let Some((index, ch)) = chars.peek().copied() {
        if ch == 'e' || ch == 'E' {
            let mut probe = chars.clone();
            probe.next();
            let mut exponent_end = index + 1;
            let mut has_sign = false;
            if let Some((_, sign)) = probe.peek() {
                if *sign == '+' || *sign == '-' {
                    has_sign = true;
                    exponent_end += 1;
                    probe.next();
                }
            }
            let mut has_digit = false;
            while let Some((i, c)) = probe.peek().copied() {
                if c.is_ascii_digit() {
                    has_digit = true;
                    exponent_end = i + 1;
                    probe.next();
                } else {
                    break;
                }
            }
            if has_digit {
                end = exponent_end;
                let _ = has_sign;
            }
        }
    }

    text[..end].parse::<f64>().ok()
}

/// Round the shortest decimal representation half-up, then group it. This is
/// what ICU does for `toLocaleString`: `1.005` prints `1.01`, not `1.00`.
fn format_number(value: f64, min_digits: usize, max_digits: usize, locale: &str) -> String {
    let abs = value.abs();
    if !abs.is_finite() {
        return "0".into();
    }
    let raw = format!("{abs}");
    let (integer, fraction) = match raw.split_once('.') {
        Some((i, f)) => (i.to_string(), f.to_string()),
        None => (raw.clone(), String::new()),
    };
    if integer.len() + fraction.len() > 38 {
        // Amounts never reach this; fall back to fixed formatting.
        let fixed = format!("{abs:.max_digits$}");
        return fixed;
    }

    let mut digits = format!("{integer}{fraction}");
    let keep = integer.len() + max_digits;
    if digits.len() > keep {
        let round_up = digits.as_bytes().get(keep).is_some_and(|d| *d >= b'5');
        digits.truncate(keep);
        if round_up {
            let mut bytes = digits.into_bytes();
            let mut i = bytes.len();
            loop {
                if i == 0 {
                    bytes.insert(0, b'1');
                    break;
                }
                i -= 1;
                if bytes[i] == b'9' {
                    bytes[i] = b'0';
                } else {
                    bytes[i] += 1;
                    break;
                }
            }
            digits = String::from_utf8(bytes).unwrap_or_default();
        }
    } else {
        digits.push_str(&"0".repeat(keep - digits.len()));
    }

    let split = digits.len().saturating_sub(max_digits);
    let mut int_part = digits[..split].to_string();
    let mut frac_part = digits[split..].to_string();
    while frac_part.len() > min_digits && frac_part.ends_with('0') {
        frac_part.pop();
    }
    while int_part.len() > 1 && int_part.starts_with('0') {
        int_part.remove(0);
    }
    if int_part.is_empty() {
        int_part.push('0');
    }

    let grouped = group_digits(&int_part, group_separator(locale));
    if frac_part.is_empty() {
        grouped
    } else {
        format!("{grouped}{}{frac_part}", decimal_separator(locale))
    }
}

fn group_digits(digits: &str, separator: char) -> String {
    let mut out = String::with_capacity(digits.len() + digits.len() / 3);
    let offset = digits.len() % 3;
    for (index, ch) in digits.chars().enumerate() {
        if index > 0 && (index + 3 - offset).is_multiple_of(3) {
            out.push(separator);
        }
        out.push(ch);
    }
    out
}

fn compact_body(value: f64, locale: &str) -> String {
    let n = value.abs();
    let english = is_english(locale);
    let (divisor, unit) = if n >= 1_000_000_000.0 {
        (1_000_000_000.0, if english { "B" } else { "Mil" })
    } else if n >= 1_000_000.0 {
        (1_000_000.0, if english { "M" } else { "Jt" })
    } else if n >= 1_000.0 {
        (1_000.0, if english { "K" } else { "Rb" })
    } else {
        (1.0, "")
    };
    if unit.is_empty() {
        return format_number(n, 0, 3, locale);
    }
    let body = format_number(n / divisor, 0, 1, locale);
    format!("{body} {unit}")
}

pub fn money(value: f64, currency: &str, locale: &str) -> String {
    let n = if value.is_finite() { value } else { 0.0 };
    let sign = if n < 0.0 { "−" } else { "" };
    let symbol = currency_symbol(currency);
    let digits = if currency == IDR { 0 } else { 2 };
    let body = format_number(n, digits, digits, locale);
    let space = if symbol.is_empty() { "" } else { " " };
    format!("{sign}{symbol}{space}{body}")
}

pub fn compact_money(value: f64, currency: &str, locale: &str) -> String {
    let symbol = currency_symbol(currency);
    let sign = if value < 0.0 { "−" } else { "" };
    let space = if symbol.is_empty() { "" } else { " " };
    format!("{sign}{symbol}{space}{}", compact_body(value, locale))
}

pub fn compact_number(value: f64, locale: &str) -> String {
    let sign = if value < 0.0 { "−" } else { "" };
    format!("{sign}{}", compact_body(value, locale))
}

pub fn plain_number(value: f64, locale: &str) -> String {
    format_number(value.abs(), 0, 3, locale)
}

/// Read an amount typed into a text field. Non-IDR keeps two decimals; IDR
/// stays whole. Both comma and dot decimals are accepted.
pub fn parse_amount_input(raw: &str, currency: &str) -> f64 {
    let mut value: String = raw
        .trim()
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '.' || *c == ',' || *c == '-')
        .collect();
    value.retain(|c| c != '-');
    if value.is_empty() {
        return 0.0;
    }

    if !currency_has_cents(currency) {
        let digits: String = value.chars().filter(|c| c.is_ascii_digit()).collect();
        return js_parse_float_prefix(&digits)
            .filter(|v| v.is_finite())
            .unwrap_or(0.0);
    }

    let last_comma = value.rfind(',');
    let last_dot = value.rfind('.');
    if let (Some(comma), Some(dot)) = (last_comma, last_dot) {
        if comma > dot {
            value = value.replace('.', "");
            value = replace_first(&value, ',', '.');
        } else {
            value = value.replace(',', "");
        }
    } else if last_comma.is_some() {
        value = replace_first(&value, ',', '.');
    }

    let parsed = js_parse_float_prefix(&value).unwrap_or(0.0);
    if parsed.is_finite() {
        js_math_round(parsed * 100.0) / 100.0
    } else {
        0.0
    }
}

/// Read an amount from a CSV cell, accepting `1.234,56`, `1,234.56`, `(12)`
/// and a leading minus. Returns `NaN` when there is no number.
pub fn parse_amount_value(raw: &str) -> f64 {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return f64::NAN;
    }
    let negative = trimmed.starts_with('-') || (trimmed.starts_with('(') && trimmed.ends_with(')'));
    let mut value: String = trimmed
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '.' || *c == ',' || *c == '-')
        .collect();
    value.retain(|c| c != '-');
    if value.is_empty() {
        return f64::NAN;
    }

    let last_comma = value.rfind(',');
    let last_dot = value.rfind('.');
    match (last_comma, last_dot) {
        (Some(comma), Some(dot)) => {
            if comma > dot {
                value = value.replace('.', "");
                value = replace_first(&value, ',', '.');
            } else {
                value = value.replace(',', "");
            }
        }
        (Some(_), None) => {
            let decimals = value.split(',').nth(1).unwrap_or("");
            if !decimals.is_empty() && decimals.len() != 3 {
                value = replace_first(&value, ',', '.');
            } else {
                value = value.replace(',', "");
            }
        }
        (None, Some(_)) => {
            let decimals = value.split('.').nth(1).unwrap_or("");
            if decimals.is_empty() || decimals.len() == 3 {
                value = value.replace('.', "");
            }
        }
        (None, None) => {}
    }

    match js_parse_float_prefix(&value) {
        Some(n) if n.is_finite() => {
            if negative {
                -n
            } else {
                n
            }
        }
        _ => f64::NAN,
    }
}

/// Amount token from OCR text, using the same currency rules as the app.
pub fn amount_from_token(raw: &str, currency: &str) -> f64 {
    let mut token: String = raw
        .trim()
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '.' || *c == ',')
        .collect();
    if token.is_empty() {
        return 0.0;
    }

    if !currency_has_cents(currency) {
        if token.ends_with(",00") || token.ends_with(".00") {
            token.truncate(token.len() - 3);
        }
        let digits: String = token.chars().filter(|c| c.is_ascii_digit()).collect();
        return js_parse_float_prefix(&digits)
            .filter(|v| v.is_finite())
            .unwrap_or(0.0);
    }

    let last_comma = token.rfind(',');
    let last_dot = token.rfind('.');
    if let (Some(comma), Some(dot)) = (last_comma, last_dot) {
        if comma > dot {
            token = token.replace('.', "");
            token = replace_first(&token, ',', '.');
        } else {
            token = token.replace(',', "");
        }
    } else if last_comma.is_some() {
        token = replace_first(&token, ',', '.');
    }
    let value = js_parse_float_prefix(&token).unwrap_or(0.0);
    if value.is_finite() {
        js_math_round(value * 100.0) / 100.0
    } else {
        0.0
    }
}

fn replace_first(value: &str, from: char, to: char) -> String {
    match value.find(from) {
        Some(index) => {
            let mut out = String::with_capacity(value.len());
            out.push_str(&value[..index]);
            out.push(to);
            out.push_str(&value[index + from.len_utf8()..]);
            out
        }
        None => value.to_string(),
    }
}

pub fn initials(name: &str) -> String {
    name.split_whitespace()
        .filter(|word| !word.is_empty())
        .take(2)
        .filter_map(|word| word.chars().next())
        .flat_map(|ch| ch.to_uppercase())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn indonesian_grouping() {
        assert_eq!(money(1_234_567.0, "IDR", "id-ID"), "Rp 1.234.567");
        assert_eq!(money(-1_234_567.0, "IDR", "id-ID"), "−Rp 1.234.567");
        assert_eq!(money(1234.5, "USD", "en-US"), "$ 1,234.50");
        assert_eq!(money(1234.5, "USD", "id-ID"), "$ 1.234,50");
    }

    #[test]
    fn compact_units_follow_language() {
        assert_eq!(compact_money(1_500_000.0, "IDR", "id-ID"), "Rp 1,5 Jt");
        assert_eq!(compact_money(1_500_000.0, "IDR", "en-US"), "Rp 1.5 M");
        assert_eq!(compact_number(-2500.0, "id-ID"), "−2,5 Rb");
    }

    #[test]
    fn parses_both_decimal_styles() {
        assert_eq!(parse_amount_input("1.234,56", "USD"), 1234.56);
        assert_eq!(parse_amount_input("1,234.56", "USD"), 1234.56);
        assert_eq!(parse_amount_input("Rp 25.000", "IDR"), 25000.0);
        assert_eq!(parse_amount_input("", "IDR"), 0.0);
        assert_eq!(parse_amount_input("-12", "IDR"), 12.0);
    }

    #[test]
    fn csv_amount_keeps_sign() {
        assert_eq!(parse_amount_value("(25.000)"), -25000.0);
        assert_eq!(parse_amount_value("1.234"), 1234.0);
        assert_eq!(parse_amount_value("1.23"), 1.23);
        assert!(parse_amount_value("").is_nan());
    }

    #[test]
    fn float_prefix_matches_parse_float() {
        assert_eq!(js_parse_float_prefix("1.2.3"), Some(1.2));
        assert_eq!(js_parse_float_prefix(".5"), Some(0.5));
        assert_eq!(js_parse_float_prefix("1e3x"), Some(1000.0));
        assert_eq!(js_parse_float_prefix("x"), None);
    }

    #[test]
    fn rounding_is_half_up_like_intl() {
        assert_eq!(format_number(1.005, 2, 2, "en-US"), "1.01");
        assert_eq!(format_number(2.675, 2, 2, "en-US"), "2.68");
        assert_eq!(format_number(1234.55, 0, 1, "en-US"), "1,234.6");
        assert_eq!(format_number(0.0001, 0, 3, "en-US"), "0");
    }
}
