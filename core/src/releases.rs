use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::download::check_url;
use crate::error::Result;
use crate::github;
use crate::{plain_name, version_newer, AgentAsset, Arch, Artifact, ArtifactKind, Catalog, Channel, Os, Portal, Product, Release, ReleaseAgents};

pub const RELEASES_ENV: &str = "FORMPORTAL_RELEASES";
pub const RELEASES_FILE: &str = "releases.json";
pub const RELEASES_FORMAT: &str = "formportal-releases";
pub const STORE_CATALOG: &str = "https://dl.formai.studio/catalog/apps.json";
pub const COMPILER_CATALOG: &str = "https://github.com/nodemode-dev/formcompiler/releases/download/catalog/apps.json";
pub const ORIGIN_GITHUB: &str = "github";
pub const RAW_ENV: &str = "FORMPORTAL_GITHUB_RAW";
const RAW: &str = "https://raw.githubusercontent.com";
const GITHUB: &str = "https://github.com/";
const RECHECK: u64 = 15 * 60;
const RETRY: u64 = 60;
const MANIFEST: &str = "form-app.json";
const LIMIT: u64 = 4 * 1024 * 1024;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct Seen {
    checked: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    tag: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    release: Option<Release>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    names: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct Kept {
    format: String,
    #[serde(default)]
    repos: BTreeMap<String, Seen>,
    #[serde(default)]
    yanks_checked: u64,
    #[serde(default)]
    yanks: Vec<(String, String)>,
}

enum Outcome {
    Found(Release, Vec<String>),
    Refused,
    Failed,
}

enum Fetched {
    Body { body: Vec<u8>, modified: Option<String> },
    Missing,
    Failed,
}

fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

fn agent() -> &'static ureq::Agent {
    static AGENT: OnceLock<ureq::Agent> = OnceLock::new();
    AGENT.get_or_init(|| {
        ureq::AgentBuilder::new()
            .timeout_connect(Duration::from_secs(5))
            .timeout_read(Duration::from_secs(15))
            .timeout(Duration::from_secs(30))
            .redirects(0)
            .user_agent("FormPortal")
            .build()
    })
}

fn follow(method: &str, url: &str, range: Option<&str>) -> std::result::Result<ureq::Response, Option<u16>> {
    let mut url = url.to_string();
    for _ in 0..6 {
        if check_url(&url).is_err() {
            return Err(None);
        }
        let mut request = agent().request(method, &url);
        if let Some(range) = range {
            request = request.set("Range", range);
        }
        match request.call() {
            Ok(r) if (300..400).contains(&r.status()) => match r.header("Location") {
                Some(next) => url = next.to_string(),
                None => return Err(None),
            },
            Ok(r) => return Ok(r),
            Err(ureq::Error::Status(code, _)) => return Err(Some(code)),
            Err(_) => return Err(None),
        }
    }
    Err(None)
}

fn get(url: &str) -> Fetched {
    match follow("GET", url, None) {
        Ok(response) => {
            let modified = response.header("Last-Modified").and_then(http_date);
            let mut body = Vec::new();
            match response.into_reader().take(LIMIT).read_to_end(&mut body) {
                Ok(_) => Fetched::Body { body, modified },
                Err(_) => Fetched::Failed,
            }
        }
        Err(Some(404 | 410 | 451)) => Fetched::Missing,
        Err(_) => Fetched::Failed,
    }
}

fn size_of(url: &str) -> u64 {
    let head = follow("HEAD", url, None).ok().and_then(|r| r.header("Content-Length").and_then(|v| v.parse::<u64>().ok())).filter(|n| *n > 0);
    head.or_else(|| {
        follow("GET", url, Some("bytes=0-0")).ok().and_then(|r| r.header("Content-Range").and_then(|v| v.rsplit('/').next()).and_then(|v| v.trim().parse().ok()))
    })
    .unwrap_or(0)
}

fn http_date(text: &str) -> Option<String> {
    let parts: Vec<&str> = text.split_whitespace().collect();
    if parts.len() < 5 {
        return None;
    }
    let day: i64 = parts[1].parse().ok()?;
    let month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].iter().position(|m| *m == parts[2])? as i64 + 1;
    let year: i64 = parts[3].parse().ok()?;
    let clock: Vec<&str> = parts[4].split(':').collect();
    if clock.len() != 3 || !(1..=31).contains(&day) {
        return None;
    }
    Some(format!("{year:04}-{month:02}-{day:02}T{}:{}:{}Z", clock[0], clock[1], clock[2]))
}

fn sha256(body: &[u8]) -> String {
    Sha256::digest(body).iter().map(|b| format!("{b:02x}")).collect()
}

fn repo_path(repository: &str) -> Option<String> {
    let rest = repository.strip_prefix(GITHUB)?.trim_end_matches('/');
    let mut parts = rest.split('/');
    let (owner, name) = (parts.next()?, parts.next()?);
    let plain = |s: &str| !s.is_empty() && !s.starts_with('.') && s.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'));
    (parts.next().is_none() && plain(owner) && plain(name)).then(|| format!("{owner}/{name}"))
}

fn plain_version(version: &str) -> bool {
    let parts: Vec<&str> = version.split('.').collect();
    parts.len() == 3 && parts.iter().all(|p| !p.is_empty() && p.bytes().all(|b| b.is_ascii_digit()))
}

fn parse_sums(text: &str) -> BTreeMap<String, String> {
    let mut sums = BTreeMap::new();
    for line in text.lines() {
        let line = line.trim();
        let Some((digest, name)) = line.split_once(char::is_whitespace) else { continue };
        let name = name.trim().trim_start_matches('*').trim();
        if digest.len() == 64 && digest.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)) && plain_name(name) {
            sums.insert(name.to_string(), digest.to_string());
        }
    }
    sums
}

fn token_at(name: &str, token: &str) -> bool {
    let bytes = name.as_bytes();
    let alnum = |i: usize| bytes.get(i).is_some_and(|b| b.is_ascii_alphanumeric());
    name.match_indices(token).any(|(i, _)| (i == 0 || !alnum(i - 1)) && !alnum(i + token.len()))
}

fn arches(lower: &str) -> Vec<Arch> {
    if lower.contains("universal") {
        return vec![Arch::Arm64, Arch::X86_64];
    }
    if ["aarch64", "arm64"].iter().any(|t| token_at(lower, t)) {
        return vec![Arch::Arm64];
    }
    if ["x86_64", "x64", "amd64", "intel"].iter().any(|t| token_at(lower, t)) {
        return vec![Arch::X86_64];
    }
    Vec::new()
}

fn skipped(lower: &str) -> bool {
    lower.contains("sha256sums")
        || [".sig", ".tar.gz", ".zsync", ".json", ".txt", ".md", ".sh", ".service", ".mcpb", ".msix", "-with-formportal.zip"].iter().any(|end| lower.ends_with(end))
}

fn classify(name: &str) -> Vec<(Os, Arch, ArtifactKind)> {
    let lower = name.to_ascii_lowercase();
    if skipped(&lower) {
        return Vec::new();
    }
    let each = |os: Os, kind: ArtifactKind| arches(&lower).into_iter().map(|a| (os, a, kind)).collect::<Vec<_>>();
    let ends = |e: &str| lower.ends_with(e);
    if ends(".dmg") {
        each(Os::Macos, ArtifactKind::Dmg)
    } else if ends(".appimage") {
        each(Os::Linux, ArtifactKind::Appimage)
    } else if ends(".deb") {
        each(Os::Linux, ArtifactKind::Deb)
    } else if ends(".rpm") {
        each(Os::Linux, ArtifactKind::Rpm)
    } else if ends(".msi") {
        each(Os::Windows, ArtifactKind::Msi)
    } else if ends(".exe") && lower.contains("setup") {
        each(Os::Windows, ArtifactKind::Nsis)
    } else if ends(".apk") {
        vec![(Os::Android, arches(&lower).first().copied().unwrap_or(Arch::Arm64), ArtifactKind::Apk)]
    } else if ends(".ipa") {
        vec![(Os::Ios, arches(&lower).first().copied().unwrap_or(Arch::Arm64), ArtifactKind::Ipa)]
    } else if ends(".zip") {
        [("macos", Os::Macos), ("darwin", Os::Macos), ("windows", Os::Windows), ("linux", Os::Linux)]
            .iter()
            .find(|(t, _)| lower.contains(t))
            .map(|(_, os)| each(*os, ArtifactKind::Zip))
            .unwrap_or_default()
    } else {
        Vec::new()
    }
}

fn yanked(origin: &str) -> Option<BTreeSet<(String, String)>> {
    let path = repo_path(origin)?;
    let raw = std::env::var(RAW_ENV).ok().map(|v| v.trim_end_matches('/').to_string()).filter(|v| !v.is_empty()).unwrap_or_else(|| RAW.to_string());
    let Fetched::Body { body, .. } = get(&format!("{raw}/{path}/main/yanked.json")) else { return None };
    let doc: Value = serde_json::from_slice(&body).ok()?;
    let rows = doc.get("yanked")?.as_array()?;
    let mut out = BTreeSet::new();
    for row in rows {
        let app = row.get("app")?.as_str()?.to_ascii_lowercase();
        let version = row.get("version")?.as_str()?.trim_start_matches('v').to_string();
        out.insert((app, version));
    }
    Some(out)
}

fn read_release(product: &Product, path: &str, manifest: &[u8], modified: Option<String>, yanks: &BTreeSet<(String, String)>) -> Outcome {
    let mut failed = false;
    let mut inner = || -> Option<(Release, Vec<String>)> {
    let app: Value = serde_json::from_slice(manifest).ok()?;
    let text = |k: &str| app.get(k).and_then(Value::as_str).map(str::to_string);
    if text("format").as_deref() != Some("form-app") || !text("repository")?.eq_ignore_ascii_case(path) {
        return None;
    }
    let version = text("version")?;
    let tag = text("tag").unwrap_or_else(|| format!("v{version}"));
    if !plain_version(&version) || tag != format!("v{version}") {
        return None;
    }
    let names: BTreeSet<String> = [Some(product.id.clone()), text("app"), text("id")].into_iter().flatten().map(|n| n.to_ascii_lowercase()).collect();
    if names.iter().any(|n| yanks.contains(&(n.clone(), version.clone()))) {
        return None;
    }
    let web = github::web();
    let download = |file: &str| format!("{web}/{path}/releases/download/{tag}/{file}");
    let sums = match get(&download("SHA256SUMS.txt")) {
        Fetched::Body { body, .. } => body,
        Fetched::Missing => return None,
        Fetched::Failed => {
            failed = true;
            return None;
        }
    };
    let sums = parse_sums(&String::from_utf8_lossy(&sums));
    if sums.get(MANIFEST).map(String::as_str) != Some(sha256(manifest).as_str()) {
        return None;
    }
    let previous = product.channels.get(&Channel::Stable);
    let minimum = |os: Os| previous.and_then(|r| r.artifacts.iter().find(|a| a.platform == os)).map(|a| a.minimum_os.clone()).unwrap_or_default();
    let mut artifacts = Vec::new();
    for (file, digest) in &sums {
        let found = classify(file);
        if found.is_empty() {
            continue;
        }
        let url = download(file);
        let bytes = size_of(&url);
        for (os, arch, kind) in found {
            artifacts.push(Artifact { platform: os, arch, kind, file: file.clone(), url: url.clone(), bytes, sha256: digest.clone(), minimum_os: minimum(os), signature: None });
        }
    }
    if artifacts.is_empty() {
        return None;
    }
    let skills = sums.iter().find(|(f, _)| f.ends_with(&format!("-skills-v{version}.zip"))).map(|(file, digest)| {
        let url = download(file);
        let declared = app.pointer("/agents/skills/bytes").and_then(Value::as_u64).filter(|b| *b > 0);
        AgentAsset { file: file.clone(), bytes: declared.unwrap_or_else(|| size_of(&url)), url, sha256: digest.clone() }
    });
    let agents = ReleaseAgents {
        manifest: Some(AgentAsset { file: MANIFEST.to_string(), url: download(MANIFEST), bytes: manifest.len() as u64, sha256: sha256(manifest) }),
        skills: skills.filter(|s| s.bytes > 0),
    };
    let release = Release {
        version,
        published: modified.clone().unwrap_or_default(),
        notes: format!("{}/releases/tag/{tag}", product.repository.trim_end_matches('/')),
        commit: text("commit").filter(|c| c.len() == 40 && c.bytes().all(|b| b.is_ascii_hexdigit())),
        artifacts,
        history: Vec::new(),
        agents: Some(agents),
        origin: Some(ORIGIN_GITHUB.to_string()),
    };
    Some((release, names.into_iter().collect()))
    };
    let found = inner();
    match found {
        Some((release, names)) => Outcome::Found(release, names),
        None if failed => Outcome::Failed,
        None => Outcome::Refused,
    }
}

fn sound(path: &str, seen: &Seen, yanks: &BTreeSet<(String, String)>) -> bool {
    let Some(release) = &seen.release else { return true };
    let prefix = format!("{}/{path}/releases/download/v{}/", github::web(), release.version);
    let under = |url: &str, file: &str| url.strip_prefix(&prefix) == Some(file) && plain_name(file);
    let assets = release.agents.iter().flat_map(|a| [a.manifest.as_ref(), a.skills.as_ref()]).flatten();
    plain_version(&release.version)
        && seen.tag.as_deref() == Some(format!("v{}", release.version).as_str())
        && release.origin.as_deref() == Some(ORIGIN_GITHUB)
        && release.history.is_empty()
        && !release.artifacts.is_empty()
        && release.artifacts.iter().all(|a| under(&a.url, &a.file) && a.sha256.len() == 64)
        && assets.into_iter().all(|a| under(&a.url, &a.file))
        && !seen.names.iter().any(|n| yanks.contains(&(n.clone(), release.version.clone())))
}

fn retry(seen: Option<&Seen>, path: &str, yanks: &BTreeSet<(String, String)>, at: u64) -> Seen {
    match seen.filter(|s| sound(path, s, yanks)) {
        Some(seen) => Seen { checked: at.saturating_sub(RECHECK - RETRY), ..seen.clone() },
        None => Seen { checked: at.saturating_sub(RECHECK - RETRY), ..Seen::default() },
    }
}

fn check(product: &Product, path: &str, seen: Option<&Seen>, yanks: &BTreeSet<(String, String)>, at: u64) -> Seen {
    let seen = seen.filter(|s| sound(path, s, yanks));
    if let Some(seen) = seen.filter(|s| at.saturating_sub(s.checked) < RECHECK) {
        return seen.clone();
    }
    let latest = format!("{}/{path}/releases/latest/download/{MANIFEST}", github::web());
    match get(&latest) {
        Fetched::Body { body, modified } => {
            let tag = serde_json::from_slice::<Value>(&body).ok().and_then(|v| v.get("version").and_then(Value::as_str).map(|v| format!("v{v}")));
            if let Some(seen) = seen.filter(|s| s.tag.is_some() && s.tag == tag && s.release.is_some()) {
                return Seen { checked: at, ..seen.clone() };
            }
            match read_release(product, path, &body, modified, yanks) {
                Outcome::Found(release, names) => Seen { checked: at, tag, release: Some(release), names },
                Outcome::Refused => Seen { checked: at, tag, ..Seen::default() },
                Outcome::Failed => retry(seen, path, yanks, at),
            }
        }
        Fetched::Missing => Seen { checked: at, ..Seen::default() },
        Fetched::Failed => retry(seen, path, yanks, at),
    }
}

fn kept_path(root: &Path) -> PathBuf {
    root.join("catalog").join(RELEASES_FILE)
}

fn load(root: &Path) -> Kept {
    fs::read(kept_path(root)).ok().and_then(|b| serde_json::from_slice::<Kept>(&b).ok()).filter(|k| k.format == RELEASES_FORMAT).unwrap_or_default()
}

fn save(root: &Path, kept: &Kept) {
    let path = kept_path(root);
    if let (Some(dir), Ok(body)) = (path.parent(), serde_json::to_vec_pretty(kept)) {
        let _ = fs::create_dir_all(dir);
        let part = path.with_extension("json.part");
        if fs::write(&part, body).is_ok() {
            let _ = fs::rename(&part, &path);
        }
    }
}

pub fn merge(product: &mut Product, mut found: Release) -> bool {
    let current = product.channels.get(&Channel::Stable);
    if current.is_some_and(|r| !version_newer(&found.version, &r.version)) {
        return false;
    }
    if let Some(mut older) = product.channels.remove(&Channel::Stable) {
        let rest = std::mem::take(&mut older.history);
        found.history.push(older);
        found.history.extend(rest.into_iter().take(9));
    }
    product.channels.insert(Channel::Stable, found);
    true
}

pub fn discover(root: &Path, catalog: &mut Catalog) -> Vec<String> {
    let mut kept = load(root);
    let at = now();
    let yanks: BTreeSet<(String, String)> = if kept.yanks_checked > 0 && at.saturating_sub(kept.yanks_checked) < RECHECK {
        kept.yanks.iter().cloned().collect()
    } else {
        let Some(fresh) = yanked(&catalog.origin) else { return Vec::new() };
        kept.yanks = fresh.iter().cloned().collect();
        kept.yanks_checked = at;
        fresh
    };
    let wanted: Vec<(usize, String)> = catalog.products.iter().enumerate().filter_map(|(i, p)| repo_path(&p.repository).map(|path| (i, path))).collect();
    let results: Vec<(usize, String, Seen)> = std::thread::scope(|scope| {
        let handles: Vec<_> = wanted
            .iter()
            .map(|(i, path)| {
                let product = &catalog.products[*i];
                let seen = kept.repos.get(&path.to_ascii_lowercase());
                let yanks = &yanks;
                scope.spawn(move || (*i, path.clone(), check(product, path, seen, yanks, at)))
            })
            .collect();
        handles.into_iter().filter_map(|h| h.join().ok()).collect()
    });
    let mut newer = Vec::new();
    for (i, path, seen) in results {
        if let Some(release) = seen.release.clone() {
            let product = &mut catalog.products[i];
            if merge(product, release) {
                newer.push(product.id.clone());
            }
        }
        kept.repos.insert(path.to_ascii_lowercase(), seen);
    }
    kept.format = RELEASES_FORMAT.to_string();
    save(root, &kept);
    newer
}

fn off(value: &str) -> bool {
    matches!(value.trim().to_ascii_lowercase().as_str(), "0" | "off" | "false" | "no")
}

impl Portal {
    pub fn reads_releases(&self) -> Result<bool> {
        if std::env::var(RELEASES_ENV).ok().is_some_and(|v| off(&v)) {
            return Ok(false);
        }
        Ok(match self.policy()? {
            Some(managed) => managed.policy.github_releases.unwrap_or(managed.policy.catalog.is_none()),
            None => true,
        })
    }
}
