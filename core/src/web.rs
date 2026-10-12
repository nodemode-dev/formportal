use std::collections::BTreeMap;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::download::check_url;
use crate::error::{CoreError, Result};
use crate::Portal;

pub const WEB_LIMIT: u64 = 4 * 1024 * 1024 * 1024;
pub const WEB_FOLDER: &str = "From the web";

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct WebPlan {
    pub url: String,
    pub host: String,
    pub name: String,
    pub product: String,
    pub folder: PathBuf,
}

fn decode(text: &str) -> String {
    let bytes = text.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Some(v) = std::str::from_utf8(&bytes[i + 1..i + 3]).ok().and_then(|h| u8::from_str_radix(h, 16).ok()) {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).to_string()
}

fn safe(name: &str) -> String {
    let cleaned: String = name.chars().filter(|c| !c.is_control() && !matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|')).collect();
    cleaned.trim().trim_start_matches('.').to_string()
}

impl Portal {
    pub fn web_plan(&self, url: &str, extensions: &BTreeMap<String, String>) -> Result<WebPlan> {
        check_url(url)?;
        let rest = url.split_once("://").map(|(_, r)| r).unwrap_or(url);
        let host = rest.split(['/', '?', '#']).next().unwrap_or_default().to_string();
        let path = rest.split(['?', '#']).next().unwrap_or_default();
        let name = safe(&decode(path.rsplit('/').next().unwrap_or_default()));
        if name.is_empty() {
            return Err(CoreError::Invalid(format!("{url} does not name a file")));
        }
        let ext = Path::new(&name).extension().map(|e| format!(".{}", e.to_string_lossy().to_lowercase())).unwrap_or_default();
        let product = extensions.get(&ext).cloned().ok_or_else(|| {
            let known: Vec<&str> = extensions.keys().map(String::as_str).collect();
            CoreError::Invalid(format!("{name} is not a Form project file ({}), so FormPortal will not download it", known.join(", ")))
        })?;
        let base = self.folders()?.first().map(|f| f.path.clone()).unwrap_or_else(crate::files::suggested_folder);
        Ok(WebPlan { url: url.to_string(), host, name, product, folder: base.join(WEB_FOLDER) })
    }

    pub fn fetch_web_file(&self, plan: &WebPlan, progress: &mut dyn FnMut(u64, u64)) -> Result<PathBuf> {
        check_url(&plan.url)?;
        fs::create_dir_all(&plan.folder)?;
        let stem = Path::new(&plan.name).file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
        let ext = Path::new(&plan.name).extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
        let mut target = plan.folder.join(&plan.name);
        let mut n = 2;
        while target.exists() {
            target = plan.folder.join(format!("{stem} {n}{ext}"));
            n += 1;
        }
        let response = ureq::get(&plan.url).call().map_err(|e| CoreError::Http(e.to_string()))?;
        let total: u64 = response.header("Content-Length").and_then(|v| v.parse().ok()).unwrap_or(0);
        if total > WEB_LIMIT {
            return Err(CoreError::Invalid(format!("{} is larger than 4 GB", plan.name)));
        }
        let part = target.with_extension(format!("{}.part", ext.trim_start_matches('.')));
        let mut out = fs::File::create(&part)?;
        let mut reader = response.into_reader().take(WEB_LIMIT + 1);
        let mut buf = vec![0u8; 64 * 1024];
        let mut have = 0u64;
        loop {
            let n = reader.read(&mut buf)?;
            if n == 0 {
                break;
            }
            have += n as u64;
            if have > WEB_LIMIT {
                drop(out);
                let _ = fs::remove_file(&part);
                return Err(CoreError::Invalid(format!("{} is larger than 4 GB", plan.name)));
            }
            out.write_all(&buf[..n])?;
            progress(have, total);
        }
        out.flush()?;
        drop(out);
        fs::rename(&part, &target)?;
        Ok(target)
    }
}
