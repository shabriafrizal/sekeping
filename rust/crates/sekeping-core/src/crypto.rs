//! Password-protected backups, byte-compatible with the browser envelope.
//!
//! `PBKDF2-HMAC-SHA256` (310 000 iterations) derives a 256-bit key; the
//! plaintext is sealed with AES-256-GCM. The envelope keeps only parameters in
//! the clear, exactly like `src/lib/crypto.ts`.

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use chrono::SecondsFormat;
use pbkdf2::pbkdf2_hmac;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::Sha256;

pub const ENCRYPTED_FORMAT: &str = "sekeping-encrypted";
pub const ITERATIONS: u32 = 310_000;
/// Reject absurd KDF costs from untrusted envelopes instead of freezing the tab.
pub const MAX_ITERATIONS: u32 = 5_000_000;
const SALT_LEN: usize = 16;
const IV_LEN: usize = 12;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Kdf {
    pub name: String,
    pub iterations: u32,
    pub salt: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Cipher {
    pub name: String,
    pub iv: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Envelope {
    pub format: String,
    pub version: u32,
    pub created_at: String,
    pub kdf: Kdf,
    pub cipher: Cipher,
    pub payload: String,
}

fn random_bytes<const N: usize>() -> Result<[u8; N], String> {
    let mut bytes = [0u8; N];
    getrandom::getrandom(&mut bytes).map_err(|error| format!("random: {error}"))?;
    Ok(bytes)
}

fn derive_key(password: &str, salt: &[u8], iterations: u32) -> [u8; 32] {
    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, iterations, &mut key);
    key
}

fn created_at() -> String {
    chrono::Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

/// Encrypt a plaintext string (normally `JSON.stringify(state)`).
pub fn encrypt_text(plaintext: &str, password: &str) -> Result<String, String> {
    let salt = random_bytes::<SALT_LEN>()?;
    let iv = random_bytes::<IV_LEN>()?;
    let key = derive_key(password, &salt, ITERATIONS);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|_| "key")?;
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&iv), plaintext.as_bytes())
        .map_err(|_| "encrypt")?;

    let envelope = Envelope {
        format: ENCRYPTED_FORMAT.into(),
        version: 1,
        created_at: created_at(),
        kdf: Kdf {
            name: "PBKDF2-SHA256".into(),
            iterations: ITERATIONS,
            salt: STANDARD.encode(salt),
        },
        cipher: Cipher {
            name: "AES-GCM".into(),
            iv: STANDARD.encode(iv),
        },
        payload: STANDARD.encode(ciphertext),
    };
    serde_json::to_string_pretty(&envelope).map_err(|error| error.to_string())
}

/// Decrypt an envelope produced by the web app or this crate.
pub fn decrypt_text(text: &str, password: &str) -> Result<String, String> {
    let envelope: Value = serde_json::from_str(text).map_err(|_| "format".to_string())?;
    if envelope.get("format").and_then(Value::as_str) != Some(ENCRYPTED_FORMAT) {
        return Err("format".into());
    }
    let payload = envelope
        .get("payload")
        .and_then(Value::as_str)
        .ok_or("format")?;
    let salt = envelope
        .pointer("/kdf/salt")
        .and_then(Value::as_str)
        .ok_or("format")?;
    let iv = envelope
        .pointer("/cipher/iv")
        .and_then(Value::as_str)
        .ok_or("format")?;
    let iterations = envelope
        .pointer("/kdf/iterations")
        .and_then(Value::as_u64)
        .filter(|value| *value > 0)
        .map(|value| value.min(u64::from(u32::MAX)) as u32)
        .unwrap_or(ITERATIONS);
    if iterations > MAX_ITERATIONS {
        return Err("format".into());
    }

    let salt = STANDARD.decode(salt).map_err(|_| "format".to_string())?;
    let iv = STANDARD.decode(iv).map_err(|_| "format".to_string())?;
    let ciphertext = STANDARD.decode(payload).map_err(|_| "format".to_string())?;
    if salt.len() < 8 || iv.len() != IV_LEN || ciphertext.len() < 16 {
        return Err("format".into());
    }

    let key = derive_key(password, &salt, iterations);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|_| "key".to_string())?;
    let plaintext = cipher
        .decrypt(Nonce::from_slice(&iv), ciphertext.as_ref())
        .map_err(|_| "decrypt".to_string())?;
    String::from_utf8(plaintext).map_err(|_| "decrypt".to_string())
}

pub fn is_encrypted_export(text: &str) -> bool {
    serde_json::from_str::<Value>(text)
        .ok()
        .is_some_and(|value| {
            value.get("format").and_then(Value::as_str) == Some(ENCRYPTED_FORMAT)
                && value.get("payload").and_then(Value::as_str).is_some()
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_keeps_the_plaintext() {
        let plain = r#"{"version":2,"txs":[{"amount":25000}]}"#;
        let sealed = encrypt_text(plain, "correct horse").expect("encrypt");
        assert!(is_encrypted_export(&sealed));
        assert_eq!(decrypt_text(&sealed, "correct horse").as_deref(), Ok(plain));
        assert_eq!(decrypt_text(&sealed, "wrong"), Err("decrypt".into()));
    }

    #[test]
    fn rejects_foreign_json() {
        assert_eq!(decrypt_text("{}", "x"), Err("format".into()));
        assert!(!is_encrypted_export("{\"format\":\"other\"}"));
    }

    #[test]
    fn refuses_an_absurd_kdf_cost() {
        let sealed = encrypt_text("{}", "x").expect("encrypt");
        let mut value: Value = serde_json::from_str(&sealed).expect("json");
        value["kdf"]["iterations"] = Value::from(u32::MAX);
        let hostile = value.to_string();
        assert_eq!(decrypt_text(&hostile, "x"), Err("format".into()));
    }

    #[test]
    fn refuses_a_short_salt() {
        let sealed = encrypt_text("{}", "x").expect("encrypt");
        let mut value: Value = serde_json::from_str(&sealed).expect("json");
        value["kdf"]["salt"] = Value::from("AAAA");
        let hostile = value.to_string();
        assert_eq!(decrypt_text(&hostile, "x"), Err("format".into()));
    }

    #[test]
    fn envelope_names_match_the_browser() {
        let sealed = encrypt_text("{}", "x").expect("encrypt");
        let value: Value = serde_json::from_str(&sealed).expect("json");
        assert_eq!(value["format"], "sekeping-encrypted");
        assert_eq!(value["version"], 1);
        assert_eq!(value["kdf"]["name"], "PBKDF2-SHA256");
        assert_eq!(value["kdf"]["iterations"], 310_000);
        assert_eq!(value["cipher"]["name"], "AES-GCM");
    }
}
