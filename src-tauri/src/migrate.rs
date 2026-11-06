use std::fs;
use std::path::{Path, PathBuf};

const OLD: &str = "dev.formai.portal";
const NEW: &str = "studio.formai.portal";

fn home() -> Option<PathBuf> {
    std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE")).map(PathBuf::from).filter(|p| p.is_absolute())
}

#[cfg(not(target_os = "macos"))]
fn absolute_env(name: &str) -> Option<PathBuf> {
    std::env::var_os(name).map(PathBuf::from).filter(|p| p.is_absolute())
}

#[cfg(target_os = "macos")]
fn parents() -> Vec<PathBuf> {
    let Some(library) = home().map(|h| h.join("Library")) else { return Vec::new() };
    vec![library.join("WebKit"), library.join("Caches"), library.join("HTTPStorages")]
}

#[cfg(target_os = "windows")]
fn parents() -> Vec<PathBuf> {
    absolute_env("LOCALAPPDATA").or_else(|| home().map(|h| h.join("AppData").join("Local"))).into_iter().collect()
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn parents() -> Vec<PathBuf> {
    absolute_env("XDG_DATA_HOME").or_else(|| home().map(|h| h.join(".local").join("share"))).into_iter().collect()
}

fn rename_across(parent: &Path) {
    let old = parent.join(OLD);
    let new = parent.join(NEW);
    let is_folder = fs::symlink_metadata(&old).map(|m| m.file_type().is_dir()).unwrap_or(false);
    if is_folder && fs::symlink_metadata(&new).is_err() {
        let _ = fs::rename(&old, &new);
    }
}

pub fn webview_data() {
    for parent in parents() {
        rename_across(&parent);
    }
}
