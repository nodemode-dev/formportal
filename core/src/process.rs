use std::path::{Path, PathBuf};
#[cfg(any(target_os = "macos", target_os = "windows"))]
use std::process::Command;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Running {
    pub pid: u32,
    pub path: PathBuf,
}

#[cfg(target_os = "linux")]
fn all() -> Vec<Running> {
    let mut out = Vec::new();
    let Ok(entries) = std::fs::read_dir("/proc") else { return out };
    for entry in entries.flatten() {
        let Some(pid) = entry.file_name().to_str().and_then(|s| s.parse::<u32>().ok()) else { continue };
        let dir = entry.path();
        for link in ["exe", "cwd"] {
            if let Ok(target) = std::fs::read_link(dir.join(link)) {
                out.push(Running { pid, path: target });
            }
        }
        if let Ok(raw) = std::fs::read(dir.join("cmdline")) {
            for arg in raw.split(|b| *b == 0).take(2).filter(|a| !a.is_empty()) {
                let text = String::from_utf8_lossy(arg).to_string();
                if text.starts_with('/') {
                    out.push(Running { pid, path: PathBuf::from(text) });
                }
            }
        }
    }
    out
}

#[cfg(target_os = "macos")]
fn all() -> Vec<Running> {
    let Ok(output) = Command::new("ps").args(["-axo", "pid=,args="]).output() else { return Vec::new() };
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(|line| {
            let line = line.trim_start();
            let (pid, args) = line.split_once(' ')?;
            Some(Running { pid: pid.parse().ok()?, path: PathBuf::from(args.trim()) })
        })
        .collect()
}

#[cfg(target_os = "windows")]
fn all() -> Vec<Running> {
    let script = "Get-CimInstance Win32_Process | ForEach-Object { \"$($_.ProcessId)`t$($_.ExecutablePath)\" }";
    let Ok(output) = Command::new("powershell").args(["-NoProfile", "-NonInteractive", "-Command", script]).output() else { return Vec::new() };
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(|line| {
            let (pid, path) = line.trim().split_once('\t')?;
            if path.is_empty() {
                return None;
            }
            Some(Running { pid: pid.parse().ok()?, path: PathBuf::from(path) })
        })
        .collect()
}

#[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
fn all() -> Vec<Running> {
    Vec::new()
}

fn normal(path: &Path) -> String {
    let text = path.canonicalize().unwrap_or_else(|_| path.to_path_buf()).to_string_lossy().to_string();
    if cfg!(target_os = "windows") { text.to_lowercase().trim_start_matches(r"\\?\").to_string() } else { text }
}

pub fn under(folder: &Path) -> Vec<Running> {
    if !folder.exists() {
        return Vec::new();
    }
    let base = normal(folder);
    let sep = std::path::MAIN_SEPARATOR;
    let mut found: Vec<Running> = all()
        .into_iter()
        .filter(|r| {
            let p = normal(&r.path);
            p == base || p.starts_with(&format!("{base}{sep}"))
        })
        .collect();
    found.sort_by_key(|r| r.pid);
    found.dedup_by_key(|r| r.pid);
    found
}
