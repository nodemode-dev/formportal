use std::collections::BTreeMap;
use std::fs;
use std::path::{Component, Path, PathBuf};

use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha1::{Digest, Sha1};

use crate::error::{CoreError, Result};
use crate::github::{signed_in, token, Signed, SHARE_SCOPE};
use crate::Portal;

pub const PREFIX: &str = "formportal-library-";
pub const PUBLIC_REPO: &str = "formportal-public";
pub const FILE_LIMIT: u64 = 100 * 1024 * 1024;
const STATE: &str = "shares.json";

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ShareState {
    #[serde(default)]
    pub shared: Vec<Shared>,
    #[serde(default)]
    pub joined: Vec<Joined>,
    #[serde(default)]
    pub published: Vec<Published>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Shared {
    pub folder: PathBuf,
    pub repo: String,
    pub url: String,
    #[serde(default)]
    pub invited: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Joined {
    pub repo: String,
    pub folder: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Published {
    pub file: PathBuf,
    pub repo: String,
    pub path: String,
    pub sha: String,
    pub url: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Invitation {
    pub id: u64,
    pub repo: String,
    pub from: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SharesView {
    pub shared: Vec<Shared>,
    pub joined: Vec<Joined>,
    pub published: Vec<Published>,
    pub invitations: Vec<Invitation>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct SyncReport {
    pub repo: String,
    pub url: String,
    pub folder: PathBuf,
    pub sent: usize,
    pub received: usize,
    pub unchanged: usize,
    pub skipped: Vec<String>,
    pub invited: Vec<String>,
}

pub fn blob_sha(bytes: &[u8]) -> String {
    let mut h = Sha1::new();
    h.update(format!("blob {}\0", bytes.len()).as_bytes());
    h.update(bytes);
    h.finalize().iter().map(|b| format!("{b:02x}")).collect()
}

pub fn slug(name: &str) -> String {
    let mut out = String::new();
    for c in name.chars().flat_map(char::to_lowercase) {
        if c.is_ascii_alphanumeric() {
            out.push(c);
        } else if !out.ends_with('-') && !out.is_empty() {
            out.push('-');
        }
    }
    let out = out.trim_end_matches('-').to_string();
    if out.is_empty() { "library".to_string() } else { out }
}

fn encode(path: &str) -> String {
    path.split('/')
        .map(|seg| seg.bytes().map(|b| if b.is_ascii_alphanumeric() || b"-._~".contains(&b) { (b as char).to_string() } else { format!("%{b:02X}") }).collect::<String>())
        .collect::<Vec<_>>()
        .join("/")
}

fn safe_relative(path: &str) -> Option<PathBuf> {
    let p = Path::new(path);
    if path.is_empty() || p.is_absolute() || p.components().any(|c| !matches!(c, Component::Normal(_))) {
        return None;
    }
    Some(p.to_path_buf())
}

fn refused(what: &str, status: u16, v: &Value) -> CoreError {
    let why = v.get("message").and_then(Value::as_str).unwrap_or("no reason given");
    CoreError::Account(format!("GitHub refused to {what} ({status}: {why})"))
}

fn ensure_repo(s: &Signed, name: &str, private: bool, description: &str) -> Result<(String, String, String)> {
    let full = format!("{}/{name}", s.account.login);
    let (status, v) = s.call("GET", &format!("/repos/{full}"), None)?;
    let v = match status {
        200 => v,
        404 => {
            let (status, v) = s.call("POST", "/user/repos", Some(&json!({ "name": name, "private": private, "description": description, "auto_init": true })))?;
            if status != 201 {
                return Err(refused("make the repository", status, &v));
            }
            v
        }
        _ => return Err(refused("read the repository", status, &v)),
    };
    let branch = v.get("default_branch").and_then(Value::as_str).unwrap_or("main").to_string();
    let url = v.get("html_url").and_then(Value::as_str).unwrap_or_default().to_string();
    Ok((full, branch, url))
}

fn remote_tree(s: &Signed, repo: &str, branch: &str) -> Result<BTreeMap<String, String>> {
    let (status, v) = s.call("GET", &format!("/repos/{repo}/git/trees/{}?recursive=1", encode(branch)), None)?;
    if status == 409 || status == 404 {
        return Ok(BTreeMap::new());
    }
    if status != 200 {
        return Err(refused("list the shared files", status, &v));
    }
    if v.get("truncated").and_then(Value::as_bool) == Some(true) {
        return Err(CoreError::Account("the shared library has more files than GitHub lists at once".to_string()));
    }
    Ok(v.get("tree")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter(|i| i.get("type").and_then(Value::as_str) == Some("blob"))
                .filter_map(|i| Some((i.get("path")?.as_str()?.to_string(), i.get("sha")?.as_str()?.to_string())))
                .collect()
        })
        .unwrap_or_default())
}

fn local_files(folder: &Path) -> Result<Vec<(String, PathBuf)>> {
    let mut out = Vec::new();
    let mut stack = vec![folder.to_path_buf()];
    while let Some(dir) = stack.pop() {
        for entry in fs::read_dir(&dir)?.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') {
                continue;
            }
            let path = entry.path();
            let kind = entry.file_type()?;
            if kind.is_dir() {
                stack.push(path);
            } else if kind.is_file() {
                if let Ok(rel) = path.strip_prefix(folder) {
                    out.push((rel.components().map(|c| c.as_os_str().to_string_lossy().to_string()).collect::<Vec<_>>().join("/"), path.clone()));
                }
            }
        }
    }
    out.sort();
    Ok(out)
}

fn put_file(s: &Signed, repo: &str, branch: &str, rel: &str, bytes: &[u8], previous: Option<&str>) -> Result<Value> {
    let mut body = json!({ "message": format!("FormPortal: {rel}"), "content": base64::engine::general_purpose::STANDARD.encode(bytes), "branch": branch });
    if let Some(sha) = previous {
        body["sha"] = json!(sha);
    }
    let (status, v) = s.call("PUT", &format!("/repos/{repo}/contents/{}", encode(rel)), Some(&body))?;
    if status != 200 && status != 201 {
        return Err(refused(&format!("store {rel}"), status, &v));
    }
    Ok(v)
}

fn send(s: &Signed, repo: &str, branch: &str, folder: &Path, report: &mut SyncReport) -> Result<()> {
    let remote = remote_tree(s, repo, branch)?;
    for (rel, path) in local_files(folder)? {
        if fs::metadata(&path)?.len() > FILE_LIMIT {
            report.skipped.push(rel);
            continue;
        }
        let bytes = fs::read(&path)?;
        let sha = blob_sha(&bytes);
        let previous = remote.get(&rel);
        if previous == Some(&sha) {
            report.unchanged += 1;
            continue;
        }
        put_file(s, repo, branch, &rel, &bytes, previous.map(String::as_str))?;
        report.sent += 1;
    }
    Ok(())
}

impl Portal {
    fn share_state(&self) -> Result<ShareState> {
        match fs::read_to_string(self.root().join(STATE)) {
            Ok(text) => serde_json::from_str(&text).map_err(|e| CoreError::State(e.to_string())),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(ShareState::default()),
            Err(e) => Err(e.into()),
        }
    }

    fn share_save(&self, state: &ShareState) -> Result<()> {
        fs::create_dir_all(self.root())?;
        let staging = self.root().join(format!("{STATE}.tmp"));
        fs::write(&staging, serde_json::to_string_pretty(state).map_err(|e| CoreError::State(e.to_string()))?)?;
        fs::rename(staging, self.root().join(STATE))?;
        Ok(())
    }

    pub fn shares(&self) -> Result<SharesView> {
        let state = self.share_state()?;
        let mut invitations = Vec::new();
        if crate::github::client_id().is_some() && matches!(token(), Ok(Some(_))) {
            let s = signed_in(None)?;
            let (status, v) = s.call("GET", "/user/repository_invitations?per_page=100", None)?;
            if status == 200 {
                for i in v.as_array().into_iter().flatten() {
                    let name = i.pointer("/repository/name").and_then(Value::as_str).unwrap_or_default();
                    if !name.starts_with(PREFIX) {
                        continue;
                    }
                    invitations.push(Invitation {
                        id: i.get("id").and_then(Value::as_u64).unwrap_or_default(),
                        repo: i.pointer("/repository/full_name").and_then(Value::as_str).unwrap_or_default().to_string(),
                        from: i.pointer("/inviter/login").and_then(Value::as_str).unwrap_or_default().to_string(),
                    });
                }
            }
        }
        Ok(SharesView { shared: state.shared, joined: state.joined, published: state.published, invitations })
    }

    pub fn share_folder(&self, folder: &Path, invite: &[String]) -> Result<SyncReport> {
        if !self.folders()?.iter().any(|f| f.path == folder) {
            return Err(CoreError::Invalid(format!("{} is not one of your folders in Files; add it there first", folder.display())));
        }
        let s = signed_in(Some(SHARE_SCOPE))?;
        let label = folder.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| "Library".to_string());
        let (repo, branch, url) = ensure_repo(&s, &format!("{PREFIX}{}", slug(&label)), true, &format!("Shared from FormPortal: {label}"))?;
        let mut report = SyncReport { repo: repo.clone(), url: url.clone(), folder: folder.to_path_buf(), ..SyncReport::default() };
        send(&s, &repo, &branch, folder, &mut report)?;
        for who in invite.iter().map(|w| w.trim().trim_start_matches('@')).filter(|w| !w.is_empty()) {
            let (status, v) = s.call("PUT", &format!("/repos/{repo}/collaborators/{}", encode(who)), Some(&json!({})))?;
            match status {
                201 | 204 => report.invited.push(who.to_string()),
                _ => return Err(refused(&format!("invite {who}"), status, &v)),
            }
        }
        let mut state = self.share_state()?;
        match state.shared.iter_mut().find(|x| x.folder == folder) {
            Some(x) => {
                x.repo = repo.clone();
                x.url = url;
                for w in &report.invited {
                    if !x.invited.contains(w) {
                        x.invited.push(w.clone());
                    }
                }
            }
            None => state.shared.push(Shared { folder: folder.to_path_buf(), repo, url, invited: report.invited.clone() }),
        }
        self.share_save(&state)?;
        Ok(report)
    }

    pub fn share_accept(&self, id: u64) -> Result<SyncReport> {
        let s = signed_in(Some(SHARE_SCOPE))?;
        let invitation = self.shares()?.invitations.into_iter().find(|i| i.id == id).ok_or_else(|| CoreError::Invalid(format!("there is no invitation {id} to a shared library")))?;
        let (status, v) = s.call("PATCH", &format!("/user/repository_invitations/{id}"), None)?;
        if status != 204 {
            return Err(refused("accept the invitation", status, &v));
        }
        let (owner, name) = invitation.repo.split_once('/').unwrap_or(("someone", invitation.repo.as_str()));
        let folder = crate::files::suggested_folder().join("Shared").join(format!("{} from {owner}", name.trim_start_matches(PREFIX)));
        let mut state = self.share_state()?;
        if !state.joined.iter().any(|j| j.repo == invitation.repo) {
            state.joined.push(Joined { repo: invitation.repo.clone(), folder });
            self.share_save(&state)?;
        }
        self.share_pull(&invitation.repo)
    }

    pub fn share_pull(&self, repo: &str) -> Result<SyncReport> {
        let state = self.share_state()?;
        let joined = state.joined.iter().find(|j| j.repo == repo).ok_or_else(|| CoreError::Invalid(format!("{repo} is not a library shared with you")))?;
        let s = signed_in(None)?;
        let (status, v) = s.call("GET", &format!("/repos/{repo}"), None)?;
        if status != 200 {
            return Err(refused("read the shared library", status, &v));
        }
        let branch = v.get("default_branch").and_then(Value::as_str).unwrap_or("main").to_string();
        let url = v.get("html_url").and_then(Value::as_str).unwrap_or_default().to_string();
        let mut report = SyncReport { repo: repo.to_string(), url, folder: joined.folder.clone(), ..SyncReport::default() };
        fs::create_dir_all(&joined.folder)?;
        for (rel, sha) in remote_tree(&s, repo, &branch)? {
            let Some(relative) = safe_relative(&rel) else {
                report.skipped.push(rel);
                continue;
            };
            let target = joined.folder.join(relative);
            if fs::read(&target).map(|b| blob_sha(&b) == sha).unwrap_or(false) {
                report.unchanged += 1;
                continue;
            }
            let bytes = s.raw(&format!("/repos/{repo}/contents/{}?ref={}", encode(&rel), encode(&branch)), FILE_LIMIT)?;
            if let Some(dir) = target.parent() {
                fs::create_dir_all(dir)?;
            }
            let staging = target.with_file_name(format!(".{}.formportal-tmp", target.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default()));
            fs::write(&staging, &bytes)?;
            fs::rename(&staging, &target)?;
            report.received += 1;
        }
        if !self.folders()?.iter().any(|f| f.path == joined.folder) {
            self.add_folder(&joined.folder, true, true)?;
        }
        Ok(report)
    }

    pub fn share_send(&self, folder: &Path) -> Result<SyncReport> {
        let state = self.share_state()?;
        let shared = state.shared.iter().find(|x| x.folder == folder).ok_or_else(|| CoreError::Invalid(format!("{} is not shared yet", folder.display())))?;
        let s = signed_in(Some(SHARE_SCOPE))?;
        let (status, v) = s.call("GET", &format!("/repos/{}", shared.repo), None)?;
        if status != 200 {
            return Err(refused("read the shared library", status, &v));
        }
        let branch = v.get("default_branch").and_then(Value::as_str).unwrap_or("main").to_string();
        let mut report = SyncReport { repo: shared.repo.clone(), url: shared.url.clone(), folder: folder.to_path_buf(), ..SyncReport::default() };
        send(&s, &shared.repo, &branch, folder, &mut report)?;
        Ok(report)
    }

    pub fn publish(&self, file: &Path) -> Result<Published> {
        if !file.is_file() {
            return Err(CoreError::Invalid(format!("{} is not a file", file.display())));
        }
        if fs::metadata(file)?.len() > FILE_LIMIT {
            return Err(CoreError::Invalid("files over 100 MB cannot be published as a link".to_string()));
        }
        let s = signed_in(Some(SHARE_SCOPE))?;
        let (repo, branch, _) = ensure_repo(&s, PUBLIC_REPO, false, "Files published from FormPortal")?;
        let bytes = fs::read(file)?;
        let sha = blob_sha(&bytes);
        let name = file.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| "file".to_string());
        let path = format!("{}/{name}", &sha[..12]);
        let remote = remote_tree(&s, &repo, &branch)?;
        let v = if remote.get(&path) == Some(&sha) { Value::Null } else { put_file(&s, &repo, &branch, &path, &bytes, remote.get(&path).map(String::as_str))? };
        let url = v.pointer("/content/html_url").and_then(Value::as_str).map(str::to_string).unwrap_or_else(|| format!("https://github.com/{repo}/blob/{branch}/{}", encode(&path)));
        let published = Published { file: file.to_path_buf(), repo, path, sha, url };
        let mut state = self.share_state()?;
        state.published.retain(|p| p.file != published.file);
        state.published.push(published.clone());
        self.share_save(&state)?;
        Ok(published)
    }

    pub fn unpublish(&self, file: &Path) -> Result<Published> {
        let mut state = self.share_state()?;
        let at = state.published.iter().position(|p| p.file == file).ok_or_else(|| CoreError::Invalid(format!("{} has no public link", file.display())))?;
        let gone = state.published[at].clone();
        let s = signed_in(Some(SHARE_SCOPE))?;
        let (status, v) = s.call("DELETE", &format!("/repos/{}/contents/{}", gone.repo, encode(&gone.path)), Some(&json!({ "message": format!("FormPortal: unpublish {}", gone.path), "sha": gone.sha })))?;
        if status != 200 && status != 404 {
            return Err(refused("remove the public link", status, &v));
        }
        state.published.remove(at);
        self.share_save(&state)?;
        Ok(gone)
    }
}
