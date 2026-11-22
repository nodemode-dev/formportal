use serde::Serialize;

use crate::error::{CoreError, Result};

pub const PROVIDERS: [&str; 4] = ["pexels", "pixabay", "freesound", "google-fonts"];
const KEYCHAIN_SERVICE: &str = "FormPortal keys";
const KEY_LIMIT: usize = 256;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct KeyState {
    pub provider: String,
    pub present: bool,
}

fn entry(provider: &str) -> Result<keyring::Entry> {
    if !PROVIDERS.contains(&provider) {
        return Err(CoreError::Invalid(format!("FormPortal keeps an API key only for {}", PROVIDERS.join(", "))));
    }
    keyring::Entry::new(KEYCHAIN_SERVICE, provider).map_err(keychain)
}

fn keychain(e: keyring::Error) -> CoreError {
    CoreError::Invalid(format!("the system keychain is not available ({e}); FormPortal does not keep an API key anywhere else"))
}

fn clean(key: &str) -> Result<&str> {
    let key = key.trim();
    if key.is_empty() {
        return Err(CoreError::Invalid("there is no key to keep".to_string()));
    }
    if key.chars().count() > KEY_LIMIT {
        return Err(CoreError::Invalid(format!("an API key is never longer than {KEY_LIMIT} characters")));
    }
    if !key.chars().all(|c| c.is_ascii_graphic()) {
        return Err(CoreError::Invalid("an API key is letters, digits and punctuation, with no spaces".to_string()));
    }
    Ok(key)
}

pub fn set(provider: &str, key: &str) -> Result<()> {
    let entry = entry(provider)?;
    entry.set_password(clean(key)?).map_err(keychain)
}

pub fn get(provider: &str) -> Option<String> {
    entry(provider).ok()?.get_password().ok().filter(|key| !key.is_empty())
}

pub fn clear(provider: &str) -> Result<()> {
    match entry(provider)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(keychain(e)),
    }
}

pub fn present(provider: &str) -> bool {
    get(provider).is_some()
}

pub fn list() -> Vec<KeyState> {
    PROVIDERS.iter().map(|provider| KeyState { provider: provider.to_string(), present: present(provider) }).collect()
}
