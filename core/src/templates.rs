use std::collections::BTreeMap;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::download::fetch_bytes;
use crate::error::{CoreError, Result};
use crate::Portal;

pub const TEMPLATES_FORMAT: &str = "formai-templates";
pub const TEMPLATES_REPO: &str = "nodemode-dev/formai-templates";
pub const TEMPLATES_HOST: &str = "https://raw.githubusercontent.com";
pub const TEMPLATES_PREFIX: &str = "/nodemode-dev/formai-templates/";
pub const TEMPLATES_BASE: &str = "https://raw.githubusercontent.com/nodemode-dev/formai-templates/main/";
pub const TEMPLATES_FOLDER: &str = "Templates";
const KEPT: &str = "templates.json";
const HELD_BACK: [&str; 1] = ["formsculpt"];
const CHUNK: usize = 64 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TemplateItem {
    pub id: String,
    pub kind: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub path: String,
    pub bytes: u64,
    pub sha256: String,
    #[serde(default)]
    pub licence: String,
    #[serde(default)]
    pub credit: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TemplateApp {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub licence: String,
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub items: Vec<TemplateItem>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TemplateIndex {
    pub format: String,
    pub format_version: u32,
    #[serde(default)]
    pub generated: String,
    #[serde(default)]
    pub apps: Vec<TemplateApp>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct Kept {
    #[serde(default)]
    fetched: u64,
    #[serde(default)]
    index: Option<TemplateIndex>,
    #[serde(default)]
    downloaded: BTreeMap<String, PathBuf>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct TemplatesView {
    pub index: TemplateIndex,
    pub fetched: u64,
    pub folder: PathBuf,
    pub downloaded: BTreeMap<String, PathBuf>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct TemplateDownload {
    pub id: String,
    pub app: String,
    pub path: PathBuf,
    pub unpacked: bool,
}

pub fn allowed(url: &str) -> bool {
    url.strip_prefix(TEMPLATES_HOST).is_some_and(|rest| rest.starts_with(TEMPLATES_PREFIX) && !rest.contains("/../") && !rest.contains('\\') && !rest.contains('?') && !rest.contains('#'))
}

pub fn safe_path(path: &str) -> bool {
    if !path.starts_with("apps/") || path.contains('\\') || path.contains(':') || path.contains('%') || path.ends_with('/') {
        return false;
    }
    Path::new(path).components().all(|c| matches!(c, Component::Normal(_))) && path.split('/').all(|part| !part.is_empty() && part != "." && part != "..")
}

fn safe_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 64 && id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

fn hex(text: &str) -> bool {
    text.len() == 64 && text.chars().all(|c| c.is_ascii_hexdigit())
}

pub fn file_url(path: &str) -> Result<String> {
    if !safe_path(path) {
        return Err(CoreError::Invalid(format!("{path} is not a path under apps/ in {TEMPLATES_REPO}, so it was not fetched")));
    }
    let url = format!("{TEMPLATES_BASE}{path}");
    if !allowed(&url) {
        return Err(CoreError::Url(url));
    }
    Ok(url)
}

pub fn parse_index(body: &[u8]) -> Result<TemplateIndex> {
    let mut index: TemplateIndex = serde_json::from_slice(body).map_err(|e| CoreError::Invalid(format!("the templates list is not valid: {e}")))?;
    if index.format != TEMPLATES_FORMAT {
        return Err(CoreError::Invalid(format!("not a templates list (format {:?})", index.format)));
    }
    if index.format_version != 1 {
        return Err(CoreError::Invalid(format!("the templates list is format version {}, which this FormPortal does not read yet", index.format_version)));
    }
    index.apps.retain(|a| safe_id(&a.id) && !HELD_BACK.contains(&a.id.as_str()));
    for app in &mut index.apps {
        let own = format!("apps/{}/", app.id);
        app.items.retain(|i| (i.kind == "template" || i.kind == "demo") && safe_path(&i.path) && i.path.starts_with(&own) && hex(&i.sha256) && i.preview.as_deref().is_none_or(safe_path));
    }
    Ok(index)
}

fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

fn free_name(dir: &Path, name: &str) -> PathBuf {
    let stem = Path::new(name).file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
    let ext = Path::new(name).extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
    let mut target = dir.join(name);
    let mut n = 2;
    while target.exists() {
        target = dir.join(format!("{stem} {n}{ext}"));
        n += 1;
    }
    target
}

fn unpack(zip: &Path, into: &Path) -> Result<()> {
    let mut archive = zip::ZipArchive::new(File::open(zip)?).map_err(|e| CoreError::Archive(e.to_string()))?;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|e| CoreError::Archive(e.to_string()))?;
        let Some(relative) = entry.enclosed_name() else {
            return Err(CoreError::Archive(format!("a path in it leaves its folder: {}", entry.name())));
        };
        let target = into.join(relative);
        if !target.starts_with(into) {
            return Err(CoreError::Archive(format!("a path in it leaves its folder: {}", entry.name())));
        }
        if entry.is_dir() {
            fs::create_dir_all(&target)?;
            continue;
        }
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)?;
        }
        let mut out = OpenOptions::new().write(true).create_new(true).open(&target)?;
        std::io::copy(&mut entry, &mut out)?;
    }
    Ok(())
}

impl Portal {
    fn templates_kept_state(&self) -> Result<Kept> {
        match fs::read_to_string(self.root().join(KEPT)) {
            Ok(text) => serde_json::from_str(&text).map_err(|e| CoreError::State(e.to_string())),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Kept::default()),
            Err(e) => Err(e.into()),
        }
    }

    fn save_templates_state(&self, kept: &Kept) -> Result<()> {
        fs::create_dir_all(self.root())?;
        let tmp = self.root().join(format!("{KEPT}.tmp"));
        fs::write(&tmp, serde_json::to_string(kept).map_err(|e| CoreError::State(e.to_string()))?)?;
        fs::rename(tmp, self.root().join(KEPT))?;
        Ok(())
    }

    pub fn templates_folder(&self) -> Result<PathBuf> {
        let base = self.folders()?.first().map(|f| f.path.clone()).unwrap_or_else(crate::files::suggested_folder);
        Ok(base.join(TEMPLATES_FOLDER))
    }

    fn templates_view(&self, kept: Kept) -> Result<Option<TemplatesView>> {
        let folder = self.templates_folder()?;
        let Some(index) = kept.index else { return Ok(None) };
        let downloaded = kept.downloaded.into_iter().filter(|(_, p)| p.exists()).collect();
        Ok(Some(TemplatesView { index, fetched: kept.fetched, folder, downloaded }))
    }

    pub fn templates_kept(&self) -> Result<Option<TemplatesView>> {
        let kept = self.templates_kept_state()?;
        self.templates_view(kept)
    }

    pub fn templates_fetch(&self) -> Result<TemplatesView> {
        let url = format!("{TEMPLATES_BASE}index.json");
        if !allowed(&url) {
            return Err(CoreError::Url(url));
        }
        let index = parse_index(&fetch_bytes(&url)?)?;
        let mut kept = self.templates_kept_state()?;
        kept.fetched = now();
        kept.index = Some(index);
        self.save_templates_state(&kept)?;
        self.templates_view(kept)?.ok_or_else(|| CoreError::State("the templates list was not kept".to_string()))
    }

    pub fn templates_download(&self, id: &str, progress: &mut dyn FnMut(u64, u64)) -> Result<TemplateDownload> {
        let mut kept = self.templates_kept_state()?;
        let index = kept.index.as_ref().ok_or_else(|| CoreError::Invalid("the templates list has not been fetched yet".to_string()))?;
        let (app, item) = index.apps.iter().find_map(|a| a.items.iter().find(|i| i.id == id).map(|i| (a.id.clone(), i.clone()))).ok_or_else(|| CoreError::Invalid(format!("{id} is not in the templates list")))?;
        let url = file_url(&item.path)?;
        let name = Path::new(&item.path).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
        if name.is_empty() || name.starts_with('.') {
            return Err(CoreError::Invalid(format!("{} has no usable file name", item.name)));
        }
        let work = self.root().join("downloads").join("templates");
        fs::create_dir_all(&work)?;
        let part = work.join(format!("{}.part", item.sha256));
        let response = ureq::get(&url).call().map_err(|e| CoreError::Http(e.to_string()))?;
        let mut reader = response.into_reader().take(item.bytes + 1);
        let mut out = File::create(&part)?;
        let mut hasher = Sha256::new();
        let mut have: u64 = 0;
        let mut buffer = vec![0u8; CHUNK];
        loop {
            let n = reader.read(&mut buffer)?;
            if n == 0 {
                break;
            }
            have += n as u64;
            if have > item.bytes {
                drop(out);
                let _ = fs::remove_file(&part);
                return Err(CoreError::Invalid(format!("{} is larger than the {} bytes the templates list states, so nothing was kept", item.name, item.bytes)));
            }
            hasher.update(&buffer[..n]);
            out.write_all(&buffer[..n])?;
            progress(have, item.bytes);
        }
        out.flush()?;
        drop(out);
        let found: String = hasher.finalize().iter().map(|b| format!("{b:02x}")).collect();
        if found != item.sha256.to_lowercase() {
            let _ = fs::remove_file(&part);
            return Err(CoreError::Invalid(format!("{} does not match the templates list (expected SHA-256 {}, found {found}), so nothing was kept", item.name, item.sha256)));
        }
        let dir = self.templates_folder()?.join(&app);
        fs::create_dir_all(&dir)?;
        let zipped = name.to_lowercase().ends_with(".zip");
        let target = if zipped {
            let stem = Path::new(&name).file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
            let folder = free_name(&dir, &stem);
            fs::create_dir(&folder)?;
            if let Err(e) = unpack(&part, &folder) {
                let _ = fs::remove_dir_all(&folder);
                let _ = fs::remove_file(&part);
                return Err(e);
            }
            let _ = fs::remove_file(&part);
            folder
        } else {
            let target = free_name(&dir, &name);
            if fs::rename(&part, &target).is_err() {
                fs::copy(&part, &target)?;
                let _ = fs::remove_file(&part);
            }
            target
        };
        kept.downloaded.insert(item.id.clone(), target.clone());
        self.save_templates_state(&kept)?;
        Ok(TemplateDownload { id: item.id, app, path: target, unpacked: zipped })
    }

    pub fn templates_preview(&self, path: &str) -> Result<String> {
        let url = file_url(path)?;
        self.thumbnail_data_url(&url)
    }

    pub fn templates_reveal(&self, path: &Path) -> Result<()> {
        let folder = self.templates_folder()?;
        if !path.starts_with(&folder) || path.components().any(|c| matches!(c, Component::ParentDir)) || !path.exists() {
            return Err(CoreError::Invalid(format!("{} is not a downloaded template", path.display())));
        }
        #[cfg(target_os = "macos")]
        let spawned = std::process::Command::new("open").arg("-R").arg(path).spawn();
        #[cfg(target_os = "windows")]
        let spawned = std::process::Command::new("explorer").arg(format!("/select,{}", path.display())).spawn();
        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        let spawned = std::process::Command::new("xdg-open").arg(path.parent().unwrap_or(&folder)).spawn();
        spawned.map(|_| ()).map_err(CoreError::Io)
    }
}
