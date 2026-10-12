use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::download::{check_url, download, fetch_bytes};
use crate::error::{CoreError, Result};
use crate::signature::verify;
use crate::{Arch, Artifact, ArtifactKind, Os, Portal};

pub const MEDIA_FORMAT: &str = "formai-media";
pub const LIBRARY_ENV: &str = "FORMPORTAL_LIBRARY";
const CREDITS: &str = "credits.json";
const OPEN_LICENCES: [&str; 6] = ["CC0-1.0", "CC-BY-4.0", "CC-BY-SA-4.0", "Apache-2.0", "MIT", "OFL-1.1"];
const THUMB_LIMIT: usize = 512 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MediaItem {
    pub id: String,
    pub title: String,
    pub kind: String,
    #[serde(default)]
    pub product: Option<String>,
    pub creator: String,
    #[serde(default)]
    pub creator_url: Option<String>,
    pub licence: String,
    pub source_url: String,
    pub file: String,
    pub url: String,
    pub bytes: u64,
    pub sha256: String,
    #[serde(default)]
    pub thumbnail: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MediaIndex {
    pub format: String,
    pub format_version: u32,
    pub generated: String,
    pub items: Vec<MediaItem>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Saved {
    pub id: String,
    pub title: String,
    pub kind: String,
    pub creator: String,
    pub licence: String,
    pub source_url: String,
    pub file: PathBuf,
    pub sha256: String,
    pub credit: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
struct Credits {
    #[serde(default)]
    saved: Vec<Saved>,
}

pub fn library_dir() -> PathBuf {
    if let Some(dir) = std::env::var_os(LIBRARY_ENV) {
        return PathBuf::from(dir);
    }
    crate::files::suggested_folder().join("Library")
}

pub fn credit_line(item: &MediaItem) -> String {
    if item.licence == "CC0-1.0" {
        format!("{} by {}, public domain (CC0 1.0), {}", item.title, item.creator, item.source_url)
    } else {
        format!("{} by {}, licensed {}, {}", item.title, item.creator, item.licence, item.source_url)
    }
}

fn safe(text: &str) -> String {
    let cleaned: String = text.chars().map(|c| if c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.') { c } else { '-' }).collect();
    cleaned.trim_matches(|c| c == '-' || c == '.').to_string()
}

fn credits(dir: &Path) -> Result<Credits> {
    match fs::read_to_string(dir.join(CREDITS)) {
        Ok(text) => serde_json::from_str(&text).map_err(|e| CoreError::State(e.to_string())),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Credits::default()),
        Err(e) => Err(e.into()),
    }
}

fn save_credits(dir: &Path, c: &Credits) -> Result<()> {
    fs::create_dir_all(dir)?;
    let tmp = dir.join(format!("{CREDITS}.tmp"));
    fs::write(&tmp, serde_json::to_string_pretty(c).map_err(|e| CoreError::State(e.to_string()))?)?;
    fs::rename(tmp, dir.join(CREDITS))?;
    Ok(())
}

impl Portal {
    pub fn media_index(&self, url: &str, allow_unsigned: bool) -> Result<MediaIndex> {
        let managed = self.policy()?;
        let locked = managed.as_ref().and_then(|m| m.policy.catalog.as_deref()).map(|c| match c.rsplit_once('/') {
            Some((dir, _)) => format!("{dir}/media.json"),
            None => "media.json".to_string(),
        });
        let url = locked.as_deref().unwrap_or(url);
        let (_, allow_unsigned, keys) = self.source(url, allow_unsigned)?;
        let body = if url.starts_with("http://") || url.starts_with("https://") {
            let body = fetch_bytes(url)?;
            match fetch_bytes(&format!("{url}.sig")).ok().map(|s| String::from_utf8_lossy(&s).trim().to_string()) {
                Some(sig) => verify(&body, &sig, &keys).map_err(|e| match e {
                    CoreError::Signature(why) => CoreError::Invalid(format!("the media index was refused: {why}")),
                    other => other,
                })?,
                None if allow_unsigned => {}
                None => return Err(CoreError::Invalid("the media index was refused: it is not signed".to_string())),
            }
            body
        } else {
            fs::read(url)?
        };
        let index: MediaIndex = serde_json::from_slice(&body).map_err(|e| CoreError::Invalid(format!("the media index is not valid: {e}")))?;
        if index.format != MEDIA_FORMAT {
            return Err(CoreError::Invalid(format!("not a media index (format {:?})", index.format)));
        }
        Ok(index)
    }

    pub fn saved_media(&self) -> Result<Vec<Saved>> {
        Ok(credits(&library_dir())?.saved)
    }

    pub fn save_media(&self, index: &MediaIndex, id: &str, progress: &mut dyn FnMut(u64, u64)) -> Result<Saved> {
        let item = index.items.iter().find(|i| i.id == id).ok_or_else(|| CoreError::Invalid(format!("{id} is not in the media index")))?;
        if !OPEN_LICENCES.contains(&item.licence.as_str()) {
            return Err(CoreError::Invalid(format!("{} is licensed {}, not an open licence FormPortal saves; it was not saved", item.title, item.licence)));
        }
        let name = safe(Path::new(&item.file).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default().as_str());
        if name.is_empty() {
            return Err(CoreError::Invalid(format!("{} has no usable file name", item.title)));
        }
        let artifact = Artifact { platform: Os::Other, arch: Arch::X86_64, kind: ArtifactKind::Zip, file: name.clone(), url: item.url.clone(), bytes: item.bytes, sha256: item.sha256.clone(), minimum_os: String::new(), signature: None };
        let file = download(&artifact, &self.root().join("downloads"), progress)?;
        let lib = library_dir();
        let dir = lib.join(safe(&item.kind));
        fs::create_dir_all(&dir)?;
        let target = dir.join(&name);
        fs::copy(&file, &target)?;
        let _ = fs::remove_file(&file);
        let credit = credit_line(item);
        fs::write(dir.join(format!("{name}.credit.txt")), format!("{credit}\n"))?;
        let saved = Saved { id: item.id.clone(), title: item.title.clone(), kind: item.kind.clone(), creator: item.creator.clone(), licence: item.licence.clone(), source_url: item.source_url.clone(), file: target, sha256: item.sha256.clone(), credit };
        let mut c = credits(&lib)?;
        c.saved.retain(|s| s.id != saved.id);
        c.saved.push(saved.clone());
        save_credits(&lib, &c)?;
        Ok(saved)
    }

    pub fn use_template(&self, index: &MediaIndex, id: &str, folder: Option<&Path>, progress: &mut dyn FnMut(u64, u64)) -> Result<PathBuf> {
        let item = index.items.iter().find(|i| i.id == id).ok_or_else(|| CoreError::Invalid(format!("{id} is not in the media index")))?;
        if item.kind != "template" {
            return Err(CoreError::Invalid(format!("{} is not a template", item.title)));
        }
        let saved = self.save_media(index, id, progress)?;
        let into = match folder {
            Some(f) => f.to_path_buf(),
            None => self.folders()?.first().map(|f| f.path.clone()).unwrap_or_else(crate::files::suggested_folder),
        };
        fs::create_dir_all(&into)?;
        let stem = Path::new(&saved.file).file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_else(|| "Template".to_string());
        let ext = Path::new(&saved.file).extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
        let mut target = into.join(format!("{stem}{ext}"));
        let mut n = 2;
        while target.exists() {
            target = into.join(format!("{stem} {n}{ext}"));
            n += 1;
        }
        fs::copy(&saved.file, &target)?;
        Ok(target)
    }

    pub fn remove_media(&self, id: &str) -> Result<Saved> {
        let lib = library_dir();
        let mut c = credits(&lib)?;
        let at = c.saved.iter().position(|s| s.id == id).ok_or_else(|| CoreError::NotInstalled(format!("the saved item {id}")))?;
        let gone = c.saved.remove(at);
        if gone.file.starts_with(&lib) {
            let _ = fs::remove_file(&gone.file);
            let _ = fs::remove_file(PathBuf::from(format!("{}.credit.txt", gone.file.display())));
        }
        save_credits(&lib, &c)?;
        Ok(gone)
    }

    pub fn thumbnail_data_url(&self, url: &str) -> Result<String> {
        use base64::Engine;
        let (mime, bytes) = self.thumbnail(url)?;
        Ok(format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes)))
    }

    pub fn thumbnail(&self, url: &str) -> Result<(String, Vec<u8>)> {
        check_url(url)?;
        let response = ureq::get(url).call().map_err(|e| CoreError::Http(e.to_string()))?;
        let mut bytes = Vec::new();
        response.into_reader().take(THUMB_LIMIT as u64 + 1).read_to_end(&mut bytes)?;
        if bytes.len() > THUMB_LIMIT {
            return Err(CoreError::Invalid("the preview is larger than 512 KB".to_string()));
        }
        let mime = match bytes.get(..12) {
            Some([0x89, b'P', b'N', b'G', ..]) => "image/png",
            Some([0xFF, 0xD8, 0xFF, ..]) => "image/jpeg",
            Some([b'R', b'I', b'F', b'F', _, _, _, _, b'W', b'E', b'B', b'P']) => "image/webp",
            _ => return Err(CoreError::Invalid("the preview is not a PNG, JPEG or WebP image".to_string())),
        };
        Ok((mime.to_string(), bytes))
    }
}
