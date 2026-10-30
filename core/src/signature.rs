use base64::Engine;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};

use crate::error::{CoreError, Result};

pub const TRUSTED_KEYS: &str = include_str!("../catalog_keys.txt");
pub const KEY_ENV: &str = "FORMAI_CATALOG_PUBKEY";

pub fn compiled_keys() -> Vec<String> {
    TRUSTED_KEYS.lines().map(str::trim).filter(|l| !l.is_empty() && !l.starts_with('#')).map(str::to_string).collect()
}

pub fn trusted_keys() -> Vec<String> {
    let mut keys = compiled_keys();
    if let Ok(extra) = std::env::var(KEY_ENV) {
        keys.extend(extra.split(',').map(|k| k.trim().to_string()).filter(|k| !k.is_empty()));
    }
    keys
}

fn decode(text: &str) -> Option<Vec<u8>> {
    base64::engine::general_purpose::STANDARD.decode(text.trim()).ok()
}

pub fn verify(body: &[u8], signature: &str, keys: &[String]) -> Result<()> {
    if keys.is_empty() {
        return Err(CoreError::Signature("this build trusts no catalogue key yet".to_string()));
    }
    let raw = decode(signature).ok_or_else(|| CoreError::Signature("its signature is not valid base64".to_string()))?;
    let signature = Signature::from_slice(&raw).map_err(|_| CoreError::Signature("its signature is not 64 bytes".to_string()))?;
    for key in keys {
        let Some(bytes) = decode(key) else { continue };
        let Ok(array) = <[u8; 32]>::try_from(bytes.as_slice()) else { continue };
        let Ok(verifying) = VerifyingKey::from_bytes(&array) else { continue };
        if verifying.verify(body, &signature).is_ok() {
            return Ok(());
        }
    }
    Err(CoreError::Signature("its signature does not match a key this build trusts".to_string()))
}

pub fn read_local(path: &str, keys: &[String], allow_unsigned: bool) -> Result<Vec<u8>> {
    let body = std::fs::read(path)?;
    match std::fs::read_to_string(format!("{path}.sig")) {
        Ok(signature) => verify(&body, signature.trim(), keys)?,
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => return Err(CoreError::Io(e)),
        Err(_) if allow_unsigned => {}
        Err(_) => return Err(CoreError::Signature("it is not signed".to_string())),
    }
    Ok(body)
}
