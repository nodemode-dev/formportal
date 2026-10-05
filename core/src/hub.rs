use std::fs::{self, File};
use std::io::{self, Read};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::download::download;
use crate::error::{CoreError, Result};
use crate::state::{Install, InstalledVersion, State};
use crate::{Artifact, ArtifactKind, Channel};

pub struct Hub {
    root: PathBuf,
}

fn home() -> PathBuf {
    std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE")).map(PathBuf::from).unwrap_or_else(|| PathBuf::from("."))
}

fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

pub fn channel_name(channel: Channel) -> &'static str {
    match channel {
        Channel::Stable => "stable",
        Channel::Beta => "beta",
        Channel::Nightly => "nightly",
    }
}

fn unzip(file: &Path, into: &Path) -> Result<()> {
    let mut archive = zip::ZipArchive::new(File::open(file)?).map_err(|e| CoreError::Archive(e.to_string()))?;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|e| CoreError::Archive(e.to_string()))?;
        let Some(relative) = entry.enclosed_name() else {
            return Err(CoreError::Archive(format!("a path in it leaves the folder: {}", entry.name())));
        };
        let out = into.join(relative);
        if entry.is_dir() {
            fs::create_dir_all(&out)?;
            continue;
        }
        if let Some(parent) = out.parent() {
            fs::create_dir_all(parent)?;
        }
        if entry.is_symlink() {
            let mut target = String::new();
            entry.read_to_string(&mut target)?;
            if Path::new(&target).is_absolute() {
                return Err(CoreError::Archive(format!("a link in it points outside the folder: {target}")));
            }
            #[cfg(unix)]
            std::os::unix::fs::symlink(&target, &out)?;
            continue;
        }
        let mut writer = File::create(&out)?;
        io::copy(&mut entry, &mut writer)?;
        #[cfg(unix)]
        if let Some(mode) = entry.unix_mode() {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&out, fs::Permissions::from_mode(mode))?;
        }
    }
    Ok(())
}

fn place(file: &Path, into: &Path) -> Result<()> {
    let name = file.file_name().ok_or_else(|| CoreError::Archive("the file has no name".to_string()))?;
    let out = into.join(name);
    fs::copy(file, &out)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&out, fs::Permissions::from_mode(0o755))?;
    }
    Ok(())
}

fn has_extension(path: &Path, wanted: &str) -> bool {
    path.extension().map(|e| e.eq_ignore_ascii_case(wanted)).unwrap_or(false)
}

fn executable(path: &Path) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::metadata(path).map(|m| m.is_file() && m.permissions().mode() & 0o111 != 0).unwrap_or(false)
    }
    #[cfg(not(unix))]
    {
        path.is_file()
    }
}

fn find_target(dir: &Path, product: &str) -> Option<PathBuf> {
    let mut entries: Vec<PathBuf> = fs::read_dir(dir).ok()?.filter_map(|e| e.ok().map(|e| e.path())).collect();
    entries.sort();
    if entries.len() == 1 && entries[0].is_dir() && !has_extension(&entries[0], "app") {
        return find_target(&entries[0], product);
    }
    if cfg!(target_os = "macos") {
        return entries.iter().find(|p| has_extension(p, "app")).cloned();
    }
    if cfg!(target_os = "windows") {
        let named = entries.iter().find(|p| has_extension(p, "exe") && p.file_stem().map(|s| s.to_string_lossy().to_lowercase().contains(product)).unwrap_or(false));
        return named.or_else(|| entries.iter().find(|p| has_extension(p, "exe"))).cloned();
    }
    entries.iter().find(|p| has_extension(p, "AppImage")).or_else(|| entries.iter().find(|p| executable(p))).cloned()
}

impl Hub {
    pub fn default_root() -> PathBuf {
        if cfg!(target_os = "macos") {
            home().join("Library").join("Application Support").join("dev.formai.hub")
        } else if cfg!(target_os = "windows") {
            std::env::var_os("LOCALAPPDATA").map(PathBuf::from).unwrap_or_else(|| home().join("AppData").join("Local")).join("formai")
        } else {
            std::env::var_os("XDG_DATA_HOME").map(PathBuf::from).unwrap_or_else(|| home().join(".local").join("share")).join("formai")
        }
    }

    pub fn new(root: impl Into<PathBuf>) -> Self {
        Hub { root: root.into() }
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn state(&self) -> Result<State> {
        State::load(&self.root)
    }

    pub fn install(&self, product: &str, channel: Channel, version: &str, artifact: &Artifact, progress: &mut dyn FnMut(u64, u64)) -> Result<Install> {
        let file = download(artifact, &self.root.join("downloads"), progress)?;
        let base = self.root.join("apps").join(product).join(channel_name(channel));
        let target = base.join(version);
        let staging = base.join(format!("{version}.tmp"));
        if staging.exists() {
            fs::remove_dir_all(&staging)?;
        }
        fs::create_dir_all(&staging)?;
        let unpacked = match artifact.kind {
            ArtifactKind::Zip => unzip(&file, &staging),
            ArtifactKind::Appimage => place(&file, &staging),
            other => Err(CoreError::Unsupported(format!("{other:?}").to_lowercase())),
        };
        if let Err(e) = unpacked {
            let _ = fs::remove_dir_all(&staging);
            return Err(e);
        }
        if target.exists() {
            fs::remove_dir_all(&target)?;
        }
        fs::rename(&staging, &target)?;
        let fresh = InstalledVersion { version: version.to_string(), path: target, sha256: artifact.sha256.clone(), installed_at: now() };
        let mut state = self.state()?;
        let install = match state.position(product, channel) {
            Some(index) => {
                let existing = state.installs[index].clone();
                let previous = if existing.current.version == fresh.version {
                    existing.previous
                } else {
                    if let Some(old) = &existing.previous {
                        if old.version != fresh.version && old.path.exists() {
                            fs::remove_dir_all(&old.path)?;
                        }
                    }
                    Some(existing.current)
                };
                let updated = Install { product: product.to_string(), channel, current: fresh, previous };
                state.installs[index] = updated.clone();
                updated
            }
            None => {
                let created = Install { product: product.to_string(), channel, current: fresh, previous: None };
                state.installs.push(created.clone());
                created
            }
        };
        state.save(&self.root)?;
        let _ = fs::remove_file(&file);
        Ok(install)
    }

    pub fn rollback(&self, product: &str, channel: Channel) -> Result<Install> {
        let mut state = self.state()?;
        let index = state.position(product, channel).ok_or_else(|| CoreError::NotInstalled(product.to_string()))?;
        let existing = state.installs[index].clone();
        let previous = existing.previous.ok_or_else(|| CoreError::NotInstalled(format!("an earlier version of {product}")))?;
        if !previous.path.exists() {
            return Err(CoreError::NotInstalled(format!("{product} {}", previous.version)));
        }
        let swapped = Install { product: existing.product, channel, current: previous, previous: Some(existing.current) };
        state.installs[index] = swapped.clone();
        state.save(&self.root)?;
        Ok(swapped)
    }

    pub fn uninstall(&self, product: &str, channel: Channel) -> Result<()> {
        let mut state = self.state()?;
        let index = state.position(product, channel).ok_or_else(|| CoreError::NotInstalled(product.to_string()))?;
        let base = self.root.join("apps").join(product).join(channel_name(channel));
        if base.exists() {
            fs::remove_dir_all(&base)?;
        }
        state.installs.remove(index);
        state.save(&self.root)
    }

    pub fn launch_target(&self, product: &str, channel: Channel) -> Result<PathBuf> {
        let state = self.state()?;
        let install = state.get(product, channel).ok_or_else(|| CoreError::NotInstalled(product.to_string()))?;
        find_target(&install.current.path, product).ok_or_else(|| CoreError::NotInstalled(format!("anything to open in {}", install.current.path.display())))
    }

    pub fn launch(&self, product: &str, channel: Channel) -> Result<u32> {
        let target = self.launch_target(product, channel)?;
        let child = if cfg!(target_os = "macos") {
            Command::new("open").arg(&target).spawn()?
        } else {
            let mut command = Command::new(&target);
            if let Some(parent) = target.parent() {
                command.current_dir(parent);
            }
            command.spawn()?
        };
        Ok(child.id())
    }
}
