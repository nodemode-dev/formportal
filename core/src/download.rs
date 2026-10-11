use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};

use crate::error::{CoreError, Result};
use crate::Artifact;

const CHUNK: usize = 64 * 1024;
const LOOPBACK: [&str; 4] = ["http://127.0.0.1:", "http://127.0.0.1/", "http://localhost:", "http://localhost/"];

pub fn check_url(url: &str) -> Result<()> {
    if url.starts_with("https://") || LOOPBACK.iter().any(|prefix| url.starts_with(prefix)) {
        return Ok(());
    }
    Err(CoreError::Url(url.to_string()))
}

pub fn fetch_text(url: &str) -> Result<String> {
    check_url(url)?;
    let response = ureq::get(url).call().map_err(|e| CoreError::Http(e.to_string()))?;
    response.into_string().map_err(CoreError::Io)
}

pub fn fetch_bytes(url: &str) -> Result<Vec<u8>> {
    check_url(url)?;
    let response = ureq::get(url).call().map_err(|e| CoreError::Http(e.to_string()))?;
    let mut body = Vec::new();
    response.into_reader().take(16 * 1024 * 1024).read_to_end(&mut body)?;
    Ok(body)
}

pub fn sha256_file(path: &Path) -> Result<String> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; CHUNK];
    loop {
        let n = file.read(&mut buffer)?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    Ok(hasher.finalize().iter().map(|b| format!("{b:02x}")).collect())
}

pub fn download(artifact: &Artifact, dir: &Path, progress: &mut dyn FnMut(u64, u64)) -> Result<PathBuf> {
    check_url(&artifact.url)?;
    fs::create_dir_all(dir)?;
    let name = Path::new(&artifact.file).file_name().ok_or_else(|| CoreError::Url(artifact.file.clone()))?.to_string_lossy().to_string();
    let done = dir.join(&name);
    let part = dir.join(format!("{name}.part"));
    if done.is_file() && sha256_file(&done)? == artifact.sha256 {
        progress(artifact.bytes, artifact.bytes);
        return Ok(done);
    }
    let mut have = fs::metadata(&part).map(|m| m.len()).unwrap_or(0);
    if have > artifact.bytes {
        fs::remove_file(&part)?;
        have = 0;
    }
    if artifact.bytes == 0 || have < artifact.bytes {
        let mut request = ureq::get(&artifact.url);
        if have > 0 {
            request = request.set("Range", &format!("bytes={have}-"));
        }
        let response = request.call().map_err(|e| CoreError::Http(e.to_string()))?;
        if response.status() != 206 {
            have = 0;
        }
        let mut options = OpenOptions::new();
        options.create(true);
        if have > 0 {
            options.append(true);
        } else {
            options.write(true).truncate(true);
        }
        let mut out = options.open(&part)?;
        let mut reader = response.into_reader();
        let mut buffer = vec![0u8; CHUNK];
        loop {
            let n = reader.read(&mut buffer)?;
            if n == 0 {
                break;
            }
            out.write_all(&buffer[..n])?;
            have += n as u64;
            progress(have, artifact.bytes);
        }
        out.flush()?;
    }
    let found = sha256_file(&part)?;
    if found != artifact.sha256 {
        fs::remove_file(&part)?;
        return Err(CoreError::Hash { file: artifact.file.clone(), expected: artifact.sha256.clone(), found });
    }
    fs::rename(&part, &done)?;
    Ok(done)
}
