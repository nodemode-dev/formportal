use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

use crate::download::check_url;
use crate::error::Result;
use crate::Portal;

pub const SITE: &str = "https://formai.studio";
pub const SITE_ENV: &str = "FORMPORTAL_SITE";
pub const SITE_FILE: &str = "site.json";
pub const SITE_FORMAT: &str = "formportal-site";
const UPCOMING_FRESH: u64 = 15 * 60;
const SUPPORTER_FRESH: u64 = 24 * 60 * 60;
const SUPPORTER_KEEP: u64 = 7 * 24 * 60 * 60;
const RETRY: u64 = 60;
const LIMIT: u64 = 256 * 1024;
const MOST_TILES: usize = 200;

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Day {
    pub at: String,
    pub count: u32,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Upcoming {
    #[serde(default)]
    pub dated: Vec<Day>,
    #[serde(default)]
    pub undated: u32,
    #[serde(default)]
    pub supporters: u32,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Tile {
    pub name: String,
    pub at: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct KeptUpcoming {
    checked: u64,
    #[serde(default)]
    tried: u64,
    data: Upcoming,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct KeptSupporter {
    code: String,
    checked: u64,
    #[serde(default)]
    tried: u64,
    supporter: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    until: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    upcoming: Vec<Tile>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct Kept {
    format: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    upcoming: Option<KeptUpcoming>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    supporter: Option<KeptSupporter>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct UpcomingView {
    pub known: bool,
    pub dated: Vec<Day>,
    pub undated: u32,
    pub supporters: u32,
    pub checked: u64,
    pub stale: bool,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct SupporterView {
    pub state: String,
    pub supporter: bool,
    pub until: Option<String>,
    pub upcoming: Vec<Tile>,
    pub checked: u64,
    pub stale: bool,
}

enum Asked {
    Answer(Value),
    Failed,
}

fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

pub fn base() -> Option<String> {
    let given = std::env::var(SITE_ENV).ok().map(|v| v.trim().trim_end_matches('/').to_string()).filter(|v| !v.is_empty());
    match given.as_deref() {
        Some("off") => None,
        Some(other) => Some(other.to_string()),
        None => Some(SITE.to_string()),
    }
}

fn agent() -> &'static ureq::Agent {
    static AGENT: OnceLock<ureq::Agent> = OnceLock::new();
    AGENT.get_or_init(|| {
        ureq::AgentBuilder::new()
            .timeout_connect(Duration::from_secs(5))
            .timeout_read(Duration::from_secs(10))
            .timeout(Duration::from_secs(20))
            .redirects(0)
            .user_agent("FormPortal")
            .build()
    })
}

fn origin(url: &str) -> &str {
    let start = url.find("://").map_or(0, |i| i + 3);
    url[start..].find('/').map_or(url, |i| &url[..start + i])
}

fn exchange(url: &str, body: Option<&str>) -> Asked {
    let first = origin(url).to_string();
    let mut url = url.to_string();
    for _ in 0..4 {
        if check_url(&url).is_err() {
            return Asked::Failed;
        }
        let request = agent().request(if body.is_some() { "POST" } else { "GET" }, &url).set("Accept", "application/json");
        let sent = match body {
            Some(text) => request.set("Content-Type", "application/json").send_string(text),
            None => request.call(),
        };
        match sent {
            Ok(r) if (300..400).contains(&r.status()) => {
                let Some(next) = r.header("Location") else { return Asked::Failed };
                url = if next.starts_with('/') { format!("{}{next}", origin(&url)) } else { next.to_string() };
                if body.is_some() && (!matches!(r.status(), 307 | 308) || origin(&url) != first) {
                    return Asked::Failed;
                }
            }
            Ok(r) if r.status() == 200 => {
                let mut bytes = Vec::new();
                if r.into_reader().take(LIMIT).read_to_end(&mut bytes).is_err() {
                    return Asked::Failed;
                }
                return serde_json::from_slice::<Value>(&bytes).map_or(Asked::Failed, Asked::Answer);
            }
            _ => return Asked::Failed,
        }
    }
    Asked::Failed
}

fn kept_path(root: &Path) -> PathBuf {
    root.join("catalog").join(SITE_FILE)
}

fn load(root: &Path) -> Kept {
    fs::read(kept_path(root)).ok().and_then(|b| serde_json::from_slice::<Kept>(&b).ok()).filter(|k| k.format == SITE_FORMAT).unwrap_or_default()
}

fn save(root: &Path, kept: &Kept) {
    let path = kept_path(root);
    let mut kept = kept.clone();
    kept.format = SITE_FORMAT.to_string();
    if let (Some(dir), Ok(body)) = (path.parent(), serde_json::to_vec_pretty(&kept)) {
        let _ = fs::create_dir_all(dir);
        let part = path.with_extension("json.part");
        if fs::write(&part, body).is_ok() {
            let _ = fs::rename(&part, &path);
        }
    }
}

fn update(root: &Path, change: impl FnOnce(&mut Kept)) {
    static LOCK: Mutex<()> = Mutex::new(());
    let _held = LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let mut kept = load(root);
    change(&mut kept);
    save(root, &kept);
}

fn digest(code: &str) -> String {
    Sha256::digest(code.as_bytes()).iter().map(|b| format!("{b:02x}")).collect()
}

pub fn code_ok(code: &str) -> bool {
    let parts: Vec<&str> = code.split('.').collect();
    parts.len() == 4
        && parts[0] == "d1"
        && !parts[1].is_empty()
        && parts[1].len() <= 20
        && parts[1].bytes().all(|b| b.is_ascii_digit())
        && parts[2].len() == 32
        && parts[2].bytes().all(|b| b.is_ascii_hexdigit())
        && parts[3].len() == 43
        && parts[3].bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

pub fn parse_time(text: &str) -> Option<u64> {
    let b = text.as_bytes();
    if b.len() < 19 || b[4] != b'-' || b[7] != b'-' || !matches!(b[10], b'T' | b' ') || b[13] != b':' || b[16] != b':' {
        return None;
    }
    let num = |from: usize, to: usize| text.get(from..to)?.parse::<i64>().ok();
    let (year, month, day, hour, minute, second) = (num(0, 4)?, num(5, 7)?, num(8, 10)?, num(11, 13)?, num(14, 16)?, num(17, 19)?);
    if !(1..=12).contains(&month) || !(1..=31).contains(&day) || hour > 23 || minute > 59 || second > 60 {
        return None;
    }
    let rest = &text[19..];
    let rest = rest.strip_prefix('.').map_or(rest, |r| r.trim_start_matches(|c: char| c.is_ascii_digit()));
    if rest != "Z" && rest != "+00:00" {
        return None;
    }
    let y = if month <= 2 { year - 1 } else { year };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let doy = (153 * (if month > 2 { month - 3 } else { month + 9 }) + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    let days = era * 146097 + doe - 719468;
    u64::try_from(days * 86400 + hour * 3600 + minute * 60 + second).ok()
}

fn number(value: Option<&Value>) -> u32 {
    value.and_then(Value::as_u64).map_or(0, |n| n.min(10_000) as u32)
}

fn stamp(value: Option<&Value>) -> Option<String> {
    value.and_then(Value::as_str).filter(|s| parse_time(s).is_some()).map(str::to_string)
}

fn read_upcoming(answer: &Value) -> Upcoming {
    let dated = answer
        .get("dated")
        .and_then(Value::as_array)
        .map(|list| list.iter().filter_map(|d| Some(Day { at: stamp(d.get("at"))?, count: number(d.get("count")) })).filter(|d| d.count > 0).take(64).collect())
        .unwrap_or_default();
    Upcoming { dated, undated: number(answer.get("undated")), supporters: number(answer.get("supporters")) }
}

fn clean(name: &str) -> String {
    name.chars().filter(|c| !c.is_control()).take(48).collect::<String>().trim().to_string()
}

fn read_tiles(answer: &Value) -> Vec<Tile> {
    answer
        .get("upcoming")
        .and_then(Value::as_array)
        .map(|list| {
            list.iter()
                .filter_map(|t| {
                    let name = clean(t.get("name").and_then(Value::as_str)?);
                    (!name.is_empty()).then(|| Tile { name, at: stamp(t.get("at")) })
                })
                .take(MOST_TILES)
                .collect()
        })
        .unwrap_or_default()
}

fn upcoming_view(kept: &KeptUpcoming, stale: bool) -> UpcomingView {
    UpcomingView { known: kept.checked > 0, dated: kept.data.dated.clone(), undated: kept.data.undated, supporters: kept.data.supporters, checked: kept.checked, stale }
}

pub fn upcoming(root: &Path) -> UpcomingView {
    let at = now();
    let kept = load(root);
    if let Some(have) = &kept.upcoming {
        if at < have.checked + UPCOMING_FRESH || at < have.tried + RETRY {
            return upcoming_view(have, at >= have.checked + UPCOMING_FRESH);
        }
    }
    let answer = base().and_then(|site| match exchange(&format!("{site}/api/upcoming"), None) {
        Asked::Answer(v) if v.get("dated").is_some() || v.get("undated").is_some() => Some(read_upcoming(&v)),
        _ => None,
    });
    match answer {
        Some(data) => {
            let fresh = KeptUpcoming { checked: at, tried: at, data };
            let view = upcoming_view(&fresh, false);
            update(root, |k| k.upcoming = Some(fresh));
            view
        }
        None => {
            let mut have = kept.upcoming.unwrap_or_default();
            have.tried = at;
            let view = upcoming_view(&have, true);
            update(root, |k| k.upcoming.get_or_insert_with(KeptUpcoming::default).tried = at);
            view
        }
    }
}

fn usable(have: &KeptSupporter, at: u64) -> bool {
    if !have.supporter {
        return at < have.checked + SUPPORTER_FRESH;
    }
    let ends = have.until.as_deref().and_then(parse_time).unwrap_or(u64::MAX);
    at < ends.min(have.checked + SUPPORTER_KEEP)
}

fn supporter_view(have: &KeptSupporter, stale: bool) -> SupporterView {
    SupporterView {
        state: if have.supporter { "supporter" } else { "no" }.to_string(),
        supporter: have.supporter,
        until: have.until.clone(),
        upcoming: if have.supporter { have.upcoming.clone() } else { Vec::new() },
        checked: have.checked,
        stale,
    }
}

fn plain(state: &str) -> SupporterView {
    SupporterView { state: state.to_string(), ..SupporterView::default() }
}

pub fn check_supporter(root: &Path, code: &str, force: bool) -> SupporterView {
    if !code_ok(code) {
        return plain("no");
    }
    let at = now();
    let id = digest(code);
    let have = load(root).supporter.filter(|s| s.code == id);
    if let Some(have) = &have {
        let recent = at < have.checked + SUPPORTER_FRESH;
        if usable(have, at) && ((recent && !force) || (!force && at < have.tried + RETRY)) {
            return supporter_view(have, !recent);
        }
        if !force && at < have.tried + RETRY {
            return SupporterView { stale: true, ..plain("unreachable") };
        }
    }
    let asked = base().map(|site| exchange(&format!("{site}/api/supporter/check"), Some(&json!({ "code": code }).to_string())));
    let answer = match asked {
        Some(Asked::Answer(v)) => v.get("supporter").and_then(Value::as_bool).map(|s| (s, v)),
        _ => None,
    };
    match (answer, have) {
        (Some((supporter, v)), _) => {
            let fresh = KeptSupporter {
                code: id,
                checked: at,
                tried: at,
                supporter,
                until: if supporter { stamp(v.get("until")) } else { None },
                upcoming: if supporter { read_tiles(&v) } else { Vec::new() },
            };
            let view = supporter_view(&fresh, false);
            update(root, |k| k.supporter = Some(fresh));
            view
        }
        (None, Some(mut have)) => {
            have.tried = at;
            let view = if usable(&have, at) || !have.supporter { supporter_view(&have, true) } else { SupporterView { stale: true, ..plain("unreachable") } };
            update(root, |k| {
                if let Some(kept) = k.supporter.as_mut().filter(|s| s.code == id) {
                    kept.tried = at;
                }
            });
            view
        }
        (None, None) => {
            update(root, |k| {
                if k.supporter.as_ref().is_none_or(|s| s.code != id) {
                    k.supporter = Some(KeptSupporter { code: id, tried: at, ..KeptSupporter::default() });
                }
            });
            plain("unreachable")
        }
    }
}

pub fn forget(root: &Path) {
    update(root, |k| k.supporter = None);
}

impl Portal {
    pub fn upcoming(&self) -> UpcomingView {
        upcoming(self.root())
    }

    pub fn supporter(&self, code: Option<String>) -> Result<SupporterView> {
        match code.map(|c| c.trim().to_string()) {
            Some(given) if given.is_empty() => {
                self.forget_supporter()?;
                Ok(plain("none"))
            }
            Some(given) => {
                let view = check_supporter(self.root(), &given, true);
                let mut prefs = self.preferences()?;
                if view.supporter && prefs.supporter_code.as_deref() != Some(given.as_str()) {
                    prefs.supporter_code = Some(given);
                    self.set_preferences(&prefs)?;
                }
                Ok(view)
            }
            None => match self.preferences()?.supporter_code {
                Some(stored) => {
                    let view = check_supporter(self.root(), &stored, false);
                    if self.preferences()?.supporter_code.as_deref() != Some(stored.as_str()) {
                        forget(self.root());
                        return Ok(plain("none"));
                    }
                    Ok(view)
                }
                None => Ok(plain("none")),
            },
        }
    }

    pub fn forget_supporter(&self) -> Result<()> {
        let mut prefs = self.preferences()?;
        if prefs.supporter_code.take().is_some() {
            self.set_preferences(&prefs)?;
        }
        forget(self.root());
        Ok(())
    }
}
