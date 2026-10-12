use std::fs;
use std::path::{Path, PathBuf};

use base64::Engine;
use ed25519_dalek::{Signer, SigningKey};
use serde::Serialize;

use crate::download::download;
use crate::error::{CoreError, Result};
use crate::portal::channel_name;
use crate::{Channel, Os, Portal, Release};

pub const MIRROR_KEY_ENV: &str = "FORMPORTAL_MIRROR_KEY";

#[derive(Debug, Clone, Default)]
pub struct MirrorOptions {
    pub base_url: String,
    pub platforms: Option<Vec<Os>>,
    pub channels: Option<Vec<Channel>>,
    pub history: bool,
    pub sign_key: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct MirrorReport {
    pub catalog: PathBuf,
    pub signature: Option<PathBuf>,
    pub public_key: Option<String>,
    pub address: String,
    pub products: usize,
    pub files: usize,
    pub bytes: u64,
}

fn safe(part: &str) -> Result<&str> {
    if !part.is_empty() && part != "." && part != ".." && part.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_' | '+')) {
        Ok(part)
    } else {
        Err(CoreError::Invalid(format!("the catalogue names {part:?}, which cannot be used as a folder name in a mirror")))
    }
}

pub fn signing_key(seed: &str) -> Result<SigningKey> {
    let raw = base64::engine::general_purpose::STANDARD
        .decode(seed.trim())
        .map_err(|_| CoreError::Invalid("the mirror key is not valid base64".to_string()))?;
    let bytes = <[u8; 32]>::try_from(raw.as_slice()).map_err(|_| CoreError::Invalid("the mirror key is not a 32-byte Ed25519 seed".to_string()))?;
    Ok(SigningKey::from_bytes(&bytes))
}

struct Copy<'a> {
    out: &'a Path,
    base: &'a str,
    platforms: Option<&'a [Os]>,
    files: usize,
    bytes: u64,
}

impl Copy<'_> {
    fn release(&mut self, product: &str, channel: Channel, release: &mut Release, progress: &mut dyn FnMut(&str, u64, u64)) -> Result<()> {
        if let Some(platforms) = self.platforms {
            release.artifacts.retain(|a| platforms.contains(&a.platform));
        }
        let rel = format!("files/{}/{}/{}", safe(product)?, channel_name(channel), safe(&release.version)?);
        let dir = self.out.join(&rel);
        for artifact in &mut release.artifacts {
            let label = format!("{product} {} {}", release.version, artifact.file);
            let file = download(artifact, &dir, &mut |have, total| progress(&label, have, total))?;
            let name = file.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
            artifact.url = format!("{}/{rel}/{name}", self.base);
            self.files += 1;
            self.bytes += fs::metadata(&file)?.len();
        }
        for older in &mut release.history {
            self.release(product, channel, older, progress)?;
        }
        Ok(())
    }
}

impl Portal {
    pub fn mirror(&self, url: &str, allow_unsigned: bool, out: &Path, options: &MirrorOptions, progress: &mut dyn FnMut(&str, u64, u64)) -> Result<MirrorReport> {
        let base = options.base_url.trim_end_matches('/');
        if !(base.starts_with("https://") || base.starts_with("http://")) {
            return Err(CoreError::Invalid(format!("the mirror address {base:?} must start with https:// (or http:// on an internal network)")));
        }
        let key = options.sign_key.as_deref().map(signing_key).transpose()?;
        let mut catalog = self.catalog(url, allow_unsigned)?;
        fs::create_dir_all(out)?;
        let mut copy = Copy { out, base, platforms: options.platforms.as_deref(), files: 0, bytes: 0 };
        for product in &mut catalog.products {
            if let Some(channels) = &options.channels {
                product.channels.retain(|c, _| channels.contains(c));
            }
            for (channel, release) in product.channels.iter_mut() {
                if !options.history {
                    release.history.clear();
                }
                copy.release(&product.id, *channel, release, progress)?;
            }
        }
        catalog.origin = base.to_string();
        let body = serde_json::to_vec_pretty(&catalog).map_err(|e| CoreError::State(e.to_string()))?;
        let path = out.join("apps.json");
        fs::write(&path, &body)?;
        let (signature, public_key) = match key {
            Some(key) => {
                let sig = base64::engine::general_purpose::STANDARD.encode(key.sign(&body).to_bytes());
                let sig_path = out.join("apps.json.sig");
                fs::write(&sig_path, sig)?;
                (Some(sig_path), Some(base64::engine::general_purpose::STANDARD.encode(key.verifying_key().to_bytes())))
            }
            None => {
                let _ = fs::remove_file(out.join("apps.json.sig"));
                (None, None)
            }
        };
        Ok(MirrorReport {
            catalog: path,
            signature,
            public_key,
            address: format!("{base}/apps.json"),
            products: catalog.products.len(),
            files: copy.files,
            bytes: copy.bytes,
        })
    }
}
