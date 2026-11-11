use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::download::sha256_file;
use crate::error::{CoreError, Result};
use crate::{Channel, Portal};

pub const FILES_STATE: &str = "files.json";
const SCAN_DEPTH: u32 = 6;
const SCAN_LIMIT: usize = 5000;
const KEEP_VERSIONS: usize = 20;
const VERSION_LIMIT: u64 = 256 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Folder {
    pub path: PathBuf,
    #[serde(default = "yes")]
    pub keep_versions: bool,
}

fn yes() -> bool {
    true
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Version {
    pub id: String,
    pub at: u64,
    pub size: u64,
    pub sha256: String,
    pub reason: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
struct History {
    #[serde(default)]
    files: BTreeMap<String, Vec<Version>>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
struct FilesState {
    #[serde(default)]
    folders: Vec<Folder>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ProjectFile {
    pub path: PathBuf,
    pub name: String,
    pub folder: PathBuf,
    pub product: String,
    pub bytes: u64,
    pub modified: u64,
    pub versions: usize,
    pub preview: Option<PathBuf>,
}

pub const PREVIEW_LIMIT: u64 = 256 * 1024;

pub fn preview_of(path: &Path) -> Option<PathBuf> {
    let name = path.file_name()?.to_string_lossy().to_string();
    let p = path.with_file_name(format!("{name}.preview.webp"));
    fs::metadata(&p).ok().filter(|m| m.is_file() && m.len() <= PREVIEW_LIMIT).map(|_| p)
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct FolderView {
    pub path: PathBuf,
    pub keep_versions: bool,
    pub exists: bool,
    pub files: usize,
    pub bytes: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Scan {
    pub folders: Vec<FolderView>,
    pub files: Vec<ProjectFile>,
    pub truncated: bool,
    pub new_versions: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct StoragePart {
    pub what: String,
    pub path: PathBuf,
    pub bytes: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Storage {
    pub formportal: Vec<StoragePart>,
    pub formportal_bytes: u64,
    pub folders: Vec<FolderView>,
    pub free_note: Option<String>,
}

fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

fn modified(meta: &fs::Metadata) -> u64 {
    meta.modified().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_secs()).unwrap_or(0)
}

fn bytes_under(path: &Path) -> u64 {
    let Ok(meta) = fs::symlink_metadata(path) else { return 0 };
    if meta.is_file() {
        return meta.len();
    }
    if !meta.is_dir() {
        return 0;
    }
    fs::read_dir(path).map(|entries| entries.flatten().map(|e| bytes_under(&e.path())).sum()).unwrap_or(0)
}

fn key(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

fn folder_id(path: &Path) -> String {
    use sha2::{Digest, Sha256};
    let digest = Sha256::digest(key(path).as_bytes());
    digest.iter().take(8).map(|b| format!("{b:02x}")).collect()
}

pub fn extensions_from_registry(registry: &str) -> BTreeMap<String, String> {
    let mut map = BTreeMap::new();
    let parsed: serde_json::Value = serde_json::from_str(registry).unwrap_or_default();
    for entry in parsed.get("products").and_then(|p| p.as_array()).cloned().unwrap_or_default() {
        let id = entry.get("id").and_then(|i| i.as_str()).unwrap_or_default().to_string();
        for ext in entry.get("project_extensions").and_then(|e| e.as_array()).cloned().unwrap_or_default() {
            if let Some(ext) = ext.as_str() {
                map.insert(ext.to_lowercase(), id.clone());
            }
        }
    }
    map
}

pub fn suggested_folder() -> PathBuf {
    let home = std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE")).map(PathBuf::from).unwrap_or_else(|| PathBuf::from("."));
    home.join("Documents").join("Form")
}

impl Portal {
    fn files_state(&self) -> Result<FilesState> {
        match fs::read_to_string(self.root().join(FILES_STATE)) {
            Ok(text) => serde_json::from_str(&text).map_err(|e| CoreError::State(e.to_string())),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(FilesState::default()),
            Err(e) => Err(e.into()),
        }
    }

    fn files_save(&self, state: &FilesState) -> Result<()> {
        fs::create_dir_all(self.root())?;
        let tmp = self.root().join(format!("{FILES_STATE}.tmp"));
        fs::write(&tmp, serde_json::to_string_pretty(state).map_err(|e| CoreError::State(e.to_string()))?)?;
        fs::rename(tmp, self.root().join(FILES_STATE))?;
        Ok(())
    }

    fn history_dir(&self) -> PathBuf {
        self.root().join("history")
    }

    fn history(&self) -> Result<History> {
        match fs::read_to_string(self.history_dir().join("index.json")) {
            Ok(text) => serde_json::from_str(&text).map_err(|e| CoreError::State(e.to_string())),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(History::default()),
            Err(e) => Err(e.into()),
        }
    }

    fn history_save(&self, history: &History) -> Result<()> {
        fs::create_dir_all(self.history_dir())?;
        let tmp = self.history_dir().join("index.json.tmp");
        fs::write(&tmp, serde_json::to_string_pretty(history).map_err(|e| CoreError::State(e.to_string()))?)?;
        fs::rename(tmp, self.history_dir().join("index.json"))?;
        Ok(())
    }

    pub fn folders(&self) -> Result<Vec<Folder>> {
        Ok(self.files_state()?.folders)
    }

    pub fn add_folder(&self, path: &Path, keep_versions: bool, create: bool) -> Result<Folder> {
        if !path.is_absolute() {
            return Err(CoreError::Invalid(format!("{} is not a full path; give the whole path to the folder", path.display())));
        }
        if !path.exists() {
            if create {
                fs::create_dir_all(path)?;
            } else {
                return Err(CoreError::Invalid(format!("{} does not exist", path.display())));
            }
        }
        if !path.is_dir() {
            return Err(CoreError::Invalid(format!("{} is not a folder", path.display())));
        }
        if path.starts_with(self.root()) {
            return Err(CoreError::Invalid("FormPortal's own folder cannot be a projects folder".to_string()));
        }
        let mut state = self.files_state()?;
        let folder = Folder { path: path.to_path_buf(), keep_versions };
        match state.folders.iter_mut().find(|f| f.path == folder.path) {
            Some(existing) => existing.keep_versions = keep_versions,
            None => state.folders.push(folder.clone()),
        }
        self.files_save(&state)?;
        Ok(folder)
    }

    pub fn remove_folder(&self, path: &Path) -> Result<()> {
        let mut state = self.files_state()?;
        let before = state.folders.len();
        state.folders.retain(|f| f.path != path);
        if state.folders.len() == before {
            return Err(CoreError::Invalid(format!("{} is not one of FormPortal's folders", path.display())));
        }
        self.files_save(&state)
    }

    pub fn scan_files(&self, extensions: &BTreeMap<String, String>, query: Option<&str>) -> Result<Scan> {
        let state = self.files_state()?;
        let mut history = self.history()?;
        let mut files = Vec::new();
        let mut views = Vec::new();
        let mut truncated = false;
        let mut new_versions = 0;
        for folder in &state.folders {
            let mut found = Vec::new();
            if folder.path.is_dir() {
                walk(&folder.path, SCAN_DEPTH, extensions, &mut found, &mut truncated);
            }
            let mut bytes = 0;
            for (path, product, meta) in found {
                bytes += meta.len();
                let k = key(&path);
                if folder.keep_versions && meta.len() <= VERSION_LIMIT {
                    let last = history.files.get(&k).and_then(|v| v.last());
                    let changed = match last {
                        Some(v) => v.size != meta.len() || v.at < modified(&meta),
                        None => true,
                    };
                    if changed {
                        let reason = if last.is_none() { "first seen" } else { "changed since the last version" };
                        if self.keep_version(&mut history, &path, reason).is_ok() {
                            new_versions += 1;
                        }
                    }
                }
                files.push(ProjectFile {
                    name: path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(),
                    folder: folder.path.clone(),
                    product,
                    bytes: meta.len(),
                    modified: modified(&meta),
                    versions: history.files.get(&k).map(|v| v.len()).unwrap_or(0),
                    preview: preview_of(&path),
                    path,
                });
            }
            views.push(FolderView { path: folder.path.clone(), keep_versions: folder.keep_versions, exists: folder.path.is_dir(), files: files.iter().filter(|f| f.folder == folder.path).count(), bytes });
        }
        if new_versions > 0 {
            self.history_save(&history)?;
        }
        if let Some(q) = query.map(str::to_lowercase).filter(|q| !q.trim().is_empty()) {
            let words: Vec<&str> = q.split_whitespace().collect();
            files.retain(|f| {
                let hay = format!("{} {}", f.name, f.product).to_lowercase();
                words.iter().all(|w| hay.contains(w))
            });
        }
        files.sort_by(|a, b| b.modified.cmp(&a.modified).then_with(|| a.name.cmp(&b.name)));
        Ok(Scan { folders: views, files, truncated, new_versions })
    }

    pub fn preview_data_url(&self, path: &Path) -> Result<String> {
        use base64::Engine;
        let path = fs::canonicalize(path)?;
        let inside = self.files_state()?.folders.iter().filter_map(|f| fs::canonicalize(&f.path).ok()).any(|f| path.starts_with(&f));
        let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
        if !inside || !name.ends_with(".preview.webp") {
            return Err(CoreError::Invalid("only a project's .preview.webp inside a projects folder is shown".to_string()));
        }
        if fs::metadata(&path)?.len() > PREVIEW_LIMIT {
            return Err(CoreError::Invalid("the preview is larger than 256 KB".to_string()));
        }
        let bytes = fs::read(&path)?;
        if !matches!(bytes.get(..12), Some([b'R', b'I', b'F', b'F', _, _, _, _, b'W', b'E', b'B', b'P'])) {
            return Err(CoreError::Invalid("the preview is not a WebP image".to_string()));
        }
        Ok(format!("data:image/webp;base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes)))
    }

    pub fn keep_saved(&self, extensions: &BTreeMap<String, String>, settle_secs: u64) -> Result<Vec<PathBuf>> {
        let state = self.files_state()?;
        let mut history = self.history()?;
        let mut kept = Vec::new();
        let mut touched = false;
        let settled = now().saturating_sub(settle_secs);
        for folder in state.folders.iter().filter(|f| f.keep_versions && f.path.is_dir()) {
            let mut found = Vec::new();
            let mut truncated = false;
            walk(&folder.path, SCAN_DEPTH, extensions, &mut found, &mut truncated);
            for (path, _, meta) in found {
                if meta.len() > VERSION_LIMIT || modified(&meta) > settled {
                    continue;
                }
                let k = key(&path);
                let last = history.files.get(&k).and_then(|v| v.last()).cloned();
                let changed = match &last {
                    Some(v) => v.size != meta.len() || v.at < modified(&meta),
                    None => true,
                };
                if !changed {
                    continue;
                }
                let reason = if last.is_none() { "first seen" } else { "saved" };
                if let Ok(v) = self.keep_version(&mut history, &path, reason) {
                    touched = true;
                    if last.map(|l| l.id != v.id).unwrap_or(true) {
                        kept.push(path);
                    }
                }
            }
        }
        if touched {
            self.history_save(&history)?;
        }
        Ok(kept)
    }

    fn keep_version(&self, history: &mut History, path: &Path, reason: &str) -> Result<Version> {
        let meta = fs::metadata(path)?;
        let sha256 = sha256_file(path)?;
        let k = key(path);
        let list = history.files.entry(k.clone()).or_default();
        if list.last().map(|v| v.sha256 == sha256).unwrap_or(false) {
            let last = list.last_mut().map(|v| {
                v.at = v.at.max(modified(&meta));
                v.clone()
            });
            return last.ok_or_else(|| CoreError::State("version list".to_string()));
        }
        let at = now().max(modified(&meta));
        let id = format!("{at}-{}", &sha256[..12]);
        let dir = self.history_dir().join(folder_id(path));
        fs::create_dir_all(&dir)?;
        fs::copy(path, dir.join(&id))?;
        let version = Version { id, at, size: meta.len(), sha256, reason: reason.to_string() };
        list.push(version.clone());
        while list.len() > KEEP_VERSIONS {
            let old = list.remove(0);
            let _ = fs::remove_file(dir.join(&old.id));
        }
        Ok(version)
    }

    pub fn file_versions(&self, path: &Path) -> Result<Vec<Version>> {
        let mut list = self.history()?.files.get(&key(path)).cloned().unwrap_or_default();
        list.reverse();
        Ok(list)
    }

    pub fn save_version(&self, path: &Path) -> Result<Version> {
        self.check_tracked(path)?;
        let mut history = self.history()?;
        let version = self.keep_version(&mut history, path, "saved by hand")?;
        self.history_save(&history)?;
        Ok(version)
    }

    pub fn revert_file(&self, path: &Path, id: &str) -> Result<Version> {
        self.check_tracked(path)?;
        let mut history = self.history()?;
        let target = history.files.get(&key(path)).and_then(|l| l.iter().find(|v| v.id == id)).cloned().ok_or_else(|| CoreError::Invalid(format!("{id} is not a version of {}", path.display())))?;
        let stored = self.history_dir().join(folder_id(path)).join(&target.id);
        if sha256_file(&stored)? != target.sha256 {
            return Err(CoreError::Invalid(format!("the kept copy of {} does not match its record; nothing was changed", path.display())));
        }
        let staging = path.with_file_name(format!(".{}.formportal-revert", path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default()));
        fs::copy(&stored, &staging)?;
        if path.exists() {
            if let Err(e) = self.keep_version(&mut history, path, "before going back") {
                let _ = fs::remove_file(&staging);
                return Err(e);
            }
        }
        fs::rename(&staging, path)?;
        let after = self.keep_version(&mut history, path, "went back to an earlier version")?;
        self.history_save(&history)?;
        Ok(after)
    }

    fn check_tracked(&self, path: &Path) -> Result<()> {
        let folders = self.folders()?;
        if folders.iter().any(|f| path.starts_with(&f.path)) {
            Ok(())
        } else {
            Err(CoreError::Invalid(format!("{} is not inside one of FormPortal's folders", path.display())))
        }
    }

    pub fn open_file(&self, path: &Path, extensions: &BTreeMap<String, String>) -> Result<(String, u32)> {
        let ext = path.extension().map(|e| format!(".{}", e.to_string_lossy().to_lowercase())).unwrap_or_default();
        let product = extensions.get(&ext).cloned().ok_or_else(|| CoreError::Invalid(format!("no Form app opens {ext} files")))?;
        if !path.is_file() {
            return Err(CoreError::Invalid(format!("{} does not exist", path.display())));
        }
        let state = self.state()?;
        let channel = [Channel::Stable, Channel::Beta, Channel::Nightly].into_iter().find(|c| state.get(&product, *c).is_some()).ok_or_else(|| CoreError::NotInstalled(format!("{product}, which opens {ext} files,")))?;
        let target = self.launch_target(&product, channel)?;
        let child = if cfg!(target_os = "macos") {
            std::process::Command::new("open").arg("-a").arg(&target).arg(path).spawn()?
        } else {
            let mut command = std::process::Command::new(&target);
            command.arg(path);
            if let Some(dir) = target.parent() {
                command.current_dir(dir);
            }
            command.spawn()?
        };
        Ok((product, child.id()))
    }

    pub fn storage(&self) -> Result<Storage> {
        let root = self.root();
        let parts = [("Installed apps", root.join("apps")), ("Downloads in progress", root.join("downloads")), ("Extensions", root.join("extensions")), ("File versions", self.history_dir()), ("Catalogue copy", root.join("catalog"))];
        let formportal: Vec<StoragePart> = parts.into_iter().map(|(what, path)| StoragePart { what: what.to_string(), bytes: bytes_under(&path), path }).collect();
        let formportal_bytes = formportal.iter().map(|p| p.bytes).sum();
        let folders = self
            .folders()?
            .into_iter()
            .map(|f| FolderView { exists: f.path.is_dir(), files: 0, bytes: bytes_under(&f.path), keep_versions: f.keep_versions, path: f.path })
            .collect();
        Ok(Storage { formportal, formportal_bytes, folders, free_note: None })
    }
}

fn walk(dir: &Path, depth: u32, extensions: &BTreeMap<String, String>, out: &mut Vec<(PathBuf, String, fs::Metadata)>, truncated: &mut bool) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    let mut entries: Vec<_> = entries.flatten().collect();
    entries.sort_by_key(|e| e.file_name());
    for entry in entries {
        if out.len() >= SCAN_LIMIT {
            *truncated = true;
            return;
        }
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let Ok(meta) = fs::symlink_metadata(&path) else { continue };
        if meta.is_dir() {
            if depth > 0 {
                walk(&path, depth - 1, extensions, out, truncated);
            }
        } else if meta.is_file() {
            let ext = path.extension().map(|e| format!(".{}", e.to_string_lossy().to_lowercase())).unwrap_or_default();
            if let Some(product) = extensions.get(&ext) {
                out.push((path, product.clone(), meta));
            }
        }
    }
}
