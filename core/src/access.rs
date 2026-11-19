use std::fs;
use std::path::Path;

use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;

use crate::error::{CoreError, Result};

pub const ACCESS_FILE: &str = "agent-access.json";
const FORMAT: &str = "formportal-agent-access";
const SEAL_SERVICE: &str = "FormPortal";
const SEAL_ACCOUNT: &str = "settings-seal";
pub const BROKEN: &str = "The saved agent permission was changed outside FormPortal, so it is back to Ask.";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Choice {
    #[default]
    Ask,
    Allowed,
    Blocked,
}

impl Choice {
    pub fn name(self) -> &'static str {
        match self {
            Choice::Ask => "ask",
            Choice::Allowed => "allowed",
            Choice::Blocked => "blocked",
        }
    }

    pub fn parse(text: &str) -> Option<Choice> {
        match text {
            "ask" => Some(Choice::Ask),
            "allowed" => Some(Choice::Allowed),
            "blocked" => Some(Choice::Blocked),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Stored {
    format: String,
    format_version: u32,
    outside_agents: Choice,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    seal: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Access {
    pub outside_agents: Choice,
    pub stored: Choice,
    pub seal: &'static str,
    pub seal_broken: bool,
}

fn message(choice: Choice) -> Vec<u8> {
    serde_json::json!({ "format": FORMAT, "outside_agents": choice.name() }).to_string().into_bytes()
}

fn mac(key: &[u8], choice: Choice) -> Option<Hmac<Sha256>> {
    let mut mac = Hmac::<Sha256>::new_from_slice(key).ok()?;
    mac.update(&message(choice));
    Some(mac)
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn unhex(text: &str) -> Option<Vec<u8>> {
    if text.len() % 2 != 0 {
        return None;
    }
    (0..text.len()).step_by(2).map(|i| u8::from_str_radix(text.get(i..i + 2)?, 16).ok()).collect()
}

fn fresh_key() -> Option<String> {
    use base64::Engine;
    let mut key = [0u8; 32];
    getrandom::getrandom(&mut key).ok()?;
    Some(base64::engine::general_purpose::STANDARD.encode(key))
}

fn decode(text: &str) -> Option<Vec<u8>> {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.decode(text.trim()).ok().filter(|k| k.len() == 32)
}

#[cfg(not(feature = "seal-stand-in"))]
fn keychain_key(create: bool) -> std::result::Result<Option<Vec<u8>>, ()> {
    let entry = keyring::Entry::new(SEAL_SERVICE, SEAL_ACCOUNT).map_err(|_| ())?;
    match entry.get_password() {
        Ok(text) => Ok(decode(&text)),
        Err(keyring::Error::NoEntry) if create => {
            let text = fresh_key().ok_or(())?;
            entry.set_password(&text).map_err(|_| ())?;
            Ok(decode(&text))
        }
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err(()),
    }
}

#[cfg(feature = "seal-stand-in")]
fn keychain_key(create: bool) -> std::result::Result<Option<Vec<u8>>, ()> {
    let _ = (SEAL_SERVICE, SEAL_ACCOUNT);
    let file = std::env::var_os("FORMPORTAL_SEAL_STAND_IN").map(std::path::PathBuf::from).ok_or(())?;
    match fs::read_to_string(&file) {
        Ok(text) => Ok(decode(&text)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound && create => {
            let text = fresh_key().ok_or(())?;
            fs::write(&file, &text).map_err(|_| ())?;
            Ok(decode(&text))
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(_) => Err(()),
    }
}

fn stored(root: &Path) -> Option<Stored> {
    let text = fs::read_to_string(root.join(ACCESS_FILE)).ok()?;
    serde_json::from_str::<Stored>(&text).ok().filter(|s| s.format == FORMAT)
}

pub fn read(root: &Path) -> Access {
    let present = root.join(ACCESS_FILE).exists();
    let Some(record) = stored(root) else {
        let seal = if present { "broken" } else { "none" };
        return Access { outside_agents: Choice::Ask, stored: Choice::Ask, seal, seal_broken: present };
    };
    let choice = record.outside_agents;
    let key = match keychain_key(false) {
        Ok(key) => key,
        Err(()) => {
            let honoured = if choice == Choice::Blocked { Choice::Blocked } else { Choice::Ask };
            return Access { outside_agents: honoured, stored: choice, seal: "unavailable", seal_broken: false };
        }
    };
    let sealed = match (key, record.seal.as_deref().and_then(unhex)) {
        (Some(key), Some(tag)) => mac(&key, choice).is_some_and(|m| m.verify_slice(&tag).is_ok()),
        _ => false,
    };
    if sealed {
        return Access { outside_agents: choice, stored: choice, seal: "sealed", seal_broken: false };
    }
    let broken = choice != Choice::Ask;
    Access { outside_agents: Choice::Ask, stored: choice, seal: if broken { "broken" } else { "none" }, seal_broken: broken }
}

pub fn set(root: &Path, choice: Choice) -> Result<Access> {
    fs::create_dir_all(root)?;
    let seal = keychain_key(true).ok().flatten().and_then(|key| mac(&key, choice)).map(|m| hex(&m.finalize().into_bytes()));
    let record = Stored { format: FORMAT.to_string(), format_version: 1, outside_agents: choice, seal };
    let text = serde_json::to_string_pretty(&record).map_err(|e| CoreError::Invalid(e.to_string()))? + "\n";
    let staging = root.join(format!("{ACCESS_FILE}.tmp"));
    fs::write(&staging, text)?;
    fs::rename(&staging, root.join(ACCESS_FILE))?;
    Ok(read(root))
}

pub fn gate(root: &Path, action: &str) -> Result<()> {
    let access = read(root);
    let broken = if access.seal_broken { format!(" {BROKEN}") } else { String::new() };
    match access.outside_agents {
        Choice::Allowed => Ok(()),
        Choice::Blocked => Err(CoreError::Policy(format!("{action} was refused: outside agents are blocked from installing, updating, rolling back or removing apps. The person can change that in the FormPortal window, Preferences, Apps, Outside agents"))),
        Choice::Ask => {
            let unsealed = if access.seal == "unavailable" && access.stored == Choice::Allowed { " The system keychain is not available, so outside agents are asked as if the saved choice were Ask." } else { "" };
            Err(CoreError::Policy(format!("{action} was refused: FormPortal asks before an outside agent installs, updates, rolls back or removes an app, and only its window can answer. Ask the person to do it in the FormPortal window, or to allow outside agents there in Preferences, Apps, Outside agents.{broken}{unsealed}")))
        }
    }
}
