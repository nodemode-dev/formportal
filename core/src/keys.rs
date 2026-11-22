use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

use serde::Serialize;
use serde_json::{json, Map, Value};

use crate::error::{CoreError, Result};

pub const PROVIDERS: [&str; 4] = ["pexels", "pixabay", "freesound", "google-fonts"];
const KEYCHAIN_SERVICE: &str = "FormPortal keys";
const KEY_LIMIT: usize = 256;
const INDEX_FILE: &str = "keys.json";
const FILE_STORE: &str = "keys-private.json";

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct KeyState {
    pub provider: String,
    pub present: bool,
    pub last4: Option<String>,
    pub kept: Option<String>,
}

#[derive(Clone, Copy)]
pub(crate) struct Slot<'a> {
    pub service: &'a str,
    pub account: &'a str,
    pub name: &'a str,
}

fn provider_slot(provider: &str) -> Result<Slot<'_>> {
    if !PROVIDERS.contains(&provider) {
        return Err(CoreError::Invalid(format!("FormPortal keeps an API key only for {}", PROVIDERS.join(", "))));
    }
    Ok(Slot { service: KEYCHAIN_SERVICE, account: provider, name: provider })
}

struct Session {
    held: HashMap<String, String>,
    asked: HashSet<String>,
    reads: u64,
}

fn session() -> &'static Mutex<Session> {
    static SESSION: OnceLock<Mutex<Session>> = OnceLock::new();
    SESSION.get_or_init(|| Mutex::new(Session { held: HashMap::new(), asked: HashSet::new(), reads: 0 }))
}

fn lock() -> std::sync::MutexGuard<'static, Session> {
    session().lock().unwrap_or_else(|e| e.into_inner())
}

pub fn store_reads() -> u64 {
    lock().reads
}

fn root() -> PathBuf {
    crate::Portal::default_root()
}

fn read_map(path: &Path) -> Map<String, Value> {
    fs::read(path).ok().and_then(|b| serde_json::from_slice::<Value>(&b).ok()).and_then(|v| v.as_object().cloned()).unwrap_or_default()
}

fn write_private(path: &Path, map: &Map<String, Value>) -> Result<()> {
    let dir = path.parent().ok_or_else(|| CoreError::Invalid("no folder for FormPortal's data".to_string()))?;
    fs::create_dir_all(dir)?;
    let temp = path.with_extension("json.part");
    let _ = fs::remove_file(&temp);
    let mut open = fs::OpenOptions::new();
    open.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        open.mode(0o600);
    }
    let body = serde_json::to_vec_pretty(&Value::Object(map.clone())).map_err(|e| CoreError::State(e.to_string()))?;
    let written = open.open(&temp).and_then(|mut f| f.write_all(&body).and_then(|()| f.sync_all()));
    if let Err(e) = written {
        let _ = fs::remove_file(&temp);
        return Err(e.into());
    }
    fs::rename(&temp, path)?;
    Ok(())
}

fn index() -> Map<String, Value> {
    read_map(&root().join(INDEX_FILE))
}

fn index_set(name: &str, last4: &str, kept: &str, meta: Option<&Value>) -> Result<()> {
    let mut map = index();
    let mut entry = json!({ "last4": last4, "kept": kept });
    if let Some(meta) = meta.or_else(|| map.get(name).and_then(|e| e.get("meta"))) {
        entry["meta"] = meta.clone();
    }
    map.insert(name.to_string(), entry);
    write_private(&root().join(INDEX_FILE), &map)
}

fn index_drop(name: &str) {
    let mut map = index();
    if map.remove(name).is_some() {
        let _ = write_private(&root().join(INDEX_FILE), &map);
    }
}

pub(crate) fn meta(name: &str) -> Option<Value> {
    index().get(name).and_then(|e| e.get("meta")).cloned()
}

pub(crate) fn set_meta(name: &str, meta: &Value) -> Result<()> {
    let map = index();
    let Some(entry) = map.get(name) else { return Ok(()) };
    let last4 = entry.get("last4").and_then(Value::as_str).unwrap_or_default().to_string();
    let kept = entry.get("kept").and_then(Value::as_str).unwrap_or("system").to_string();
    index_set(name, &last4, &kept, Some(meta))
}

fn file_read(name: &str) -> Option<String> {
    read_map(&root().join(FILE_STORE)).get(name).and_then(Value::as_str).map(str::to_string).filter(|v| !v.is_empty())
}

fn file_write(name: &str, value: &str) -> Result<()> {
    let path = root().join(FILE_STORE);
    let mut map = read_map(&path);
    map.insert(name.to_string(), Value::String(value.to_string()));
    write_private(&path, &map)
}

fn file_clear(name: &str) {
    let path = root().join(FILE_STORE);
    let mut map = read_map(&path);
    if map.remove(name).is_some() {
        if map.is_empty() {
            let _ = fs::remove_file(&path);
        } else {
            let _ = write_private(&path, &map);
        }
    }
}

fn last4(value: &str) -> String {
    let chars: Vec<char> = value.chars().collect();
    if chars.len() >= 8 { chars[chars.len() - 4..].iter().collect() } else { String::new() }
}

fn ask(slot: Slot<'_>, s: &mut Session) -> (Option<String>, bool) {
    s.reads += 1;
    match keyring::Entry::new(slot.service, slot.account).and_then(|e| e.get_password()) {
        Ok(v) if !v.is_empty() => (Some(v), true),
        Ok(_) | Err(keyring::Error::NoEntry) => (None, true),
        Err(_) => (None, false),
    }
}

fn keep(slot: Slot<'_>, value: &str, s: &mut Session) -> bool {
    let Ok(entry) = keyring::Entry::new(slot.service, slot.account) else { return false };
    if entry.set_password(value).is_err() || entry.get_password().ok().as_deref() != Some(value) {
        return false;
    }
    if index_set(slot.name, &last4(value), "system", None).is_err() {
        return false;
    }
    s.held.insert(slot.name.to_string(), value.to_string());
    s.asked.remove(slot.name);
    file_clear(slot.name);
    true
}

pub(crate) fn held(name: &str) -> Option<String> {
    if let Some(v) = lock().held.get(name) {
        return Some(v.clone());
    }
    file_read(name)
}

pub(crate) fn fetch(slot: Slot<'_>) -> Option<String> {
    let mut s = lock();
    if let Some(v) = s.held.get(slot.name) {
        return Some(v.clone());
    }
    let listed = index().get(slot.name).cloned();
    if listed.as_ref().and_then(|e| e.get("kept")).and_then(Value::as_str) == Some("system") {
        let (value, answered) = ask(slot, &mut s);
        if let Some(value) = value {
            s.held.insert(slot.name.to_string(), value.clone());
            return Some(value);
        }
        if !answered {
            return file_read(slot.name);
        }
        index_drop(slot.name);
        s.asked.insert(slot.name.to_string());
    }
    if let Some(copy) = file_read(slot.name) {
        if !keep(slot, &copy, &mut s) {
            s.held.insert(slot.name.to_string(), copy.clone());
        }
        return Some(copy);
    }
    if s.asked.contains(slot.name) {
        return None;
    }
    let (value, answered) = ask(slot, &mut s);
    match value {
        Some(value) => {
            let _ = index_set(slot.name, &last4(&value), "system", None);
            s.held.insert(slot.name.to_string(), value.clone());
            Some(value)
        }
        None => {
            if answered {
                s.asked.insert(slot.name.to_string());
            }
            None
        }
    }
}

pub(crate) fn put(slot: Slot<'_>, value: &str, meta: Option<&Value>) -> Result<&'static str> {
    let mut s = lock();
    s.asked.remove(slot.name);
    if keep(slot, value, &mut s) {
        if let Some(meta) = meta {
            set_meta(slot.name, meta)?;
        }
        return Ok("system");
    }
    file_write(slot.name, value)?;
    index_set(slot.name, &last4(value), "file", meta)?;
    s.held.insert(slot.name.to_string(), value.to_string());
    Ok("file")
}

pub(crate) fn forget(slot: Slot<'_>) {
    let mut s = lock();
    if let Ok(entry) = keyring::Entry::new(slot.service, slot.account) {
        let _ = entry.delete_credential();
    }
    index_drop(slot.name);
    s.held.remove(slot.name);
    s.asked.remove(slot.name);
    file_clear(slot.name);
}

pub(crate) fn summary(name: &str) -> (bool, Option<String>, Option<String>) {
    if let Some(entry) = index().get(name) {
        let kept = entry.get("kept").and_then(Value::as_str).unwrap_or("system").to_string();
        let four = entry.get("last4").and_then(Value::as_str).unwrap_or_default().to_string();
        return (true, Some(four).filter(|f| !f.is_empty()), Some(kept));
    }
    match file_read(name) {
        Some(value) => (true, Some(last4(&value)).filter(|f| !f.is_empty()), Some("file".to_string())),
        None => (false, None, None),
    }
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
    let slot = provider_slot(provider)?;
    put(slot, clean(key)?, None).map(|_| ())
}

pub fn get(provider: &str) -> Option<String> {
    fetch(provider_slot(provider).ok()?)
}

pub fn clear(provider: &str) -> Result<()> {
    forget(provider_slot(provider)?);
    Ok(())
}

pub fn present(provider: &str) -> bool {
    provider_slot(provider).is_ok() && summary(provider).0
}

pub fn list() -> Vec<KeyState> {
    PROVIDERS
        .iter()
        .map(|provider| {
            let (present, last4, kept) = summary(provider);
            KeyState { provider: provider.to_string(), present, last4, kept }
        })
        .collect()
}
