use std::fs::{self, File};
use std::io::{self, Read};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::download::{download, fetch_bytes};
use crate::error::{CoreError, Result};
use crate::{agents, installers, process};
use crate::signature::{read_local, trusted_keys, verify};
use crate::policy::{self, Managed};
use crate::prefs::Preferences;
use crate::state::{Install, InstalledVersion, State};
use crate::{plain_name, version_newer, Artifact, ArtifactKind, Availability, Catalog, Channel, Platform, ReleaseAgents};
use serde::Serialize;

pub struct Portal {
    root: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Update {
    pub product: String,
    pub channel: Channel,
    pub from: String,
    pub to: String,
    pub bytes: u64,
    pub notes: String,
    pub open: bool,
    pub automatic: bool,
    pub later: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct UpdateOutcome {
    pub product: String,
    pub channel: Channel,
    pub from: String,
    pub to: String,
    pub error: Option<String>,
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

fn link_stays_inside(relative: &Path, target: &str) -> bool {
    use std::path::Component;
    let target = Path::new(target);
    if target.is_absolute() {
        return false;
    }
    let mut depth: usize = 0;
    let parent = relative.parent().map(Path::components).into_iter().flatten();
    for part in parent.chain(target.components()) {
        match part {
            Component::Normal(_) => depth += 1,
            Component::CurDir => {}
            Component::ParentDir if depth > 0 => depth -= 1,
            _ => return false,
        }
    }
    true
}

fn through_a_link(into: &Path, relative: &Path) -> bool {
    let mut path = into.to_path_buf();
    relative.components().any(|part| {
        path.push(part);
        fs::symlink_metadata(&path).map(|m| m.file_type().is_symlink()).unwrap_or(false)
    })
}

fn resolves_inside(into: &Path, relative: &Path) -> bool {
    use std::path::Component;
    fn parts(path: &Path) -> Option<Vec<Option<std::ffi::OsString>>> {
        path.components()
            .filter(|c| *c != Component::CurDir)
            .map(|c| match c {
                Component::Normal(name) => Some(Some(name.to_os_string())),
                Component::ParentDir => Some(None),
                _ => None,
            })
            .rev()
            .collect()
    }
    let Some(mut pending) = parts(relative) else { return false };
    let mut here = into.to_path_buf();
    let mut depth = 0usize;
    let mut hops = 0;
    while let Some(part) = pending.pop() {
        let Some(name) = part else {
            if depth == 0 {
                return false;
            }
            here.pop();
            depth -= 1;
            continue;
        };
        here.push(&name);
        let Ok(target) = fs::read_link(&here) else {
            depth += 1;
            continue;
        };
        here.pop();
        hops += 1;
        match parts(&target) {
            Some(more) if hops <= 40 && !target.is_absolute() => pending.extend(more),
            _ => return false,
        }
    }
    true
}

fn links_stay_inside(into: &Path, links: &[PathBuf]) -> Result<()> {
    for link in links {
        let relative = link.strip_prefix(into).unwrap_or(link);
        if !resolves_inside(into, relative) {
            return Err(CoreError::Archive(format!("a link in it does not resolve inside the folder: {}", relative.display())));
        }
    }
    Ok(())
}

fn unzip(file: &Path, into: &Path) -> Result<()> {
    let mut archive = zip::ZipArchive::new(File::open(file)?).map_err(|e| CoreError::Archive(e.to_string()))?;
    let mut links = Vec::new();
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|e| CoreError::Archive(e.to_string()))?;
        let Some(relative) = entry.enclosed_name() else {
            return Err(CoreError::Archive(format!("a path in it leaves the folder: {}", entry.name())));
        };
        if through_a_link(into, &relative) {
            return Err(CoreError::Archive(format!("a path in it goes through a link: {}", entry.name())));
        }
        let out = into.join(&relative);
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
            if !link_stays_inside(&relative, &target) {
                return Err(CoreError::Archive(format!("a link in it points outside the folder: {target}")));
            }
            #[cfg(unix)]
            std::os::unix::fs::symlink(&target, &out)?;
            links.push(out);
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
    #[cfg(unix)]
    links_stay_inside(into, &links)?;
    Ok(())
}

pub(crate) fn unzip_into(file: &Path, into: &Path) -> Result<()> {
    unzip(file, into)
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

fn deep_find(dir: &Path, product: &str, depth: u32) -> Option<PathBuf> {
    let mut found: Vec<PathBuf> = Vec::new();
    let mut stack = vec![(dir.to_path_buf(), 0u32)];
    while let Some((at, level)) = stack.pop() {
        let Ok(entries) = fs::read_dir(&at) else { continue };
        for entry in entries.flatten() {
            let path = entry.path();
            if cfg!(target_os = "macos") && has_extension(&path, "app") {
                found.push(path);
                continue;
            }
            if path.is_dir() {
                if level < depth {
                    stack.push((path, level + 1));
                }
                continue;
            }
            let name = path.file_name().map(|n| n.to_string_lossy().to_lowercase()).unwrap_or_default();
            let runnable = if cfg!(target_os = "windows") { has_extension(&path, "exe") } else { executable(&path) };
            if runnable && !name.contains("uninstall") {
                found.push(path);
            }
        }
    }
    let stem = |p: &PathBuf| p.file_stem().map(|s| s.to_string_lossy().to_lowercase()).unwrap_or_default();
    found.sort();
    found.iter().find(|p| stem(p) == product).or_else(|| found.iter().find(|p| stem(p).contains(product))).or_else(|| found.iter().find(|p| p.parent().map(|d| d.ends_with("bin")).unwrap_or(false))).cloned()
}

impl Portal {
    pub fn default_root() -> PathBuf {
        if let Some(root) = std::env::var_os("FORMPORTAL_ROOT") {
            return PathBuf::from(root);
        }
        if cfg!(target_os = "macos") {
            home().join("Library").join("Application Support").join("dev.formai.portal")
        } else if cfg!(target_os = "windows") {
            std::env::var_os("LOCALAPPDATA").map(PathBuf::from).unwrap_or_else(|| home().join("AppData").join("Local")).join("FormPortal")
        } else {
            std::env::var_os("XDG_DATA_HOME").map(PathBuf::from).unwrap_or_else(|| home().join(".local").join("share")).join("formportal")
        }
    }

    pub fn new(root: impl Into<PathBuf>) -> Self {
        Portal { root: root.into() }
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn state(&self) -> Result<State> {
        State::load(&self.root)
    }

    pub fn policy(&self) -> Result<Option<Managed>> {
        policy::load()
    }

    pub fn source(&self, url: &str, allow_unsigned: bool) -> Result<(String, bool, Vec<String>)> {
        let mut keys = trusted_keys();
        match self.policy()? {
            Some(managed) => {
                keys.extend(managed.policy.catalog_keys.iter().cloned());
                Ok((managed.policy.catalog_url(url), managed.policy.unsigned(allow_unsigned), keys))
            }
            None => Ok((url.to_string(), allow_unsigned, keys)),
        }
    }

    pub fn catalog(&self, url: &str, allow_unsigned: bool) -> Result<Catalog> {
        let (url, allow_unsigned, keys) = self.source(url, allow_unsigned)?;
        if !(url.starts_with("http://") || url.starts_with("https://")) {
            let body = read_local(&url, &keys, allow_unsigned)?;
            let text = String::from_utf8(body).map_err(|_| CoreError::Signature("it is not text".to_string()))?;
            return Ok(Catalog::from_json(&text)?);
        }
        let dir = self.root.join("catalog");
        let kept = dir.join("apps.json");
        let kept_signature = dir.join("apps.json.sig");
        let (body, signature, fresh) = match fetch_bytes(&url) {
            Ok(body) => {
                let signature = fetch_bytes(&format!("{url}.sig")).ok().map(|s| String::from_utf8_lossy(&s).trim().to_string());
                (body, signature, true)
            }
            Err(e) => match fs::read(&kept) {
                Ok(body) => (body, fs::read_to_string(&kept_signature).ok(), false),
                Err(_) => return Err(e),
            },
        };
        match &signature {
            Some(signature) => verify(&body, signature, &keys)?,
            None if allow_unsigned => {}
            None => return Err(CoreError::Signature("it is not signed".to_string())),
        }
        let text = String::from_utf8(body.clone()).map_err(|_| CoreError::Signature("it is not text".to_string()))?;
        let catalog = Catalog::from_json(&text)?;
        if fresh {
            fs::create_dir_all(&dir)?;
            fs::write(&kept, &body)?;
            match &signature {
                Some(signature) => fs::write(&kept_signature, signature)?,
                None => {
                    let _ = fs::remove_file(&kept_signature);
                }
            }
        }
        Ok(catalog)
    }

    pub fn install(&self, product: &str, channel: Channel, version: &str, artifact: &Artifact, progress: &mut dyn FnMut(u64, u64)) -> Result<Install> {
        self.install_with(product, channel, version, artifact, None, progress)
    }

    pub fn install_from(&self, catalog: &Catalog, product: &str, channel: Channel, version: &str, artifact: &Artifact, progress: &mut dyn FnMut(u64, u64)) -> Result<Install> {
        let agents = catalog.release_of(product, channel, version).and_then(|r| r.agents.clone());
        self.install_with(product, channel, version, artifact, agents.as_ref(), progress)
    }

    pub fn install_with(&self, product: &str, channel: Channel, version: &str, artifact: &Artifact, agents: Option<&ReleaseAgents>, progress: &mut dyn FnMut(u64, u64)) -> Result<Install> {
        if let Some(managed) = self.policy()? {
            managed.policy.allows(product, channel)?;
        }
        if !plain_name(product) || !plain_name(version) {
            return Err(CoreError::Invalid(format!("{product:?} {version:?} is not a plain product and version name")));
        }
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
            ArtifactKind::Deb => installers::deb(&file, &staging),
            ArtifactKind::Rpm => installers::rpm(&file, &staging),
            ArtifactKind::Dmg => installers::dmg(&file, &staging),
            ArtifactKind::Msi => installers::msi(&file, &staging),
            ArtifactKind::Nsis => installers::nsis(&file, &staging),
            other => Err(CoreError::Unsupported(format!("{other:?}").to_lowercase())),
        };
        if let Err(e) = unpacked {
            let _ = fs::remove_dir_all(&staging);
            return Err(e);
        }
        if let Some(asset) = agents.and_then(|a| a.manifest.as_ref()) {
            if agents::search(&staging, 4).is_none() {
                match agents::fetch_app_file(asset, product, version) {
                    Ok(body) => fs::write(staging.join(agents::APP_FILE), body)?,
                    Err(e) => {
                        let _ = fs::remove_dir_all(&staging);
                        return Err(e);
                    }
                }
            }
        }
        if target.exists() {
            let open = process::under(&target);
            if !open.is_empty() {
                let _ = fs::remove_dir_all(&staging);
                return Err(CoreError::Running { what: format!("{product} {version}"), pids: open.iter().map(|r| r.pid).collect() });
            }
            fs::remove_dir_all(&target)?;
        }
        fs::rename(&staging, &target)?;
        let record = agents::files_record_path(&base, version);
        let files = agents::write_files_record(&target, &record, product, channel, version).ok().map(|()| record);
        let fresh = InstalledVersion { version: version.to_string(), path: target, sha256: artifact.sha256.clone(), installed_at: now(), files };
        let mut state = self.state()?;
        let install = match state.position(product, channel) {
            Some(index) => {
                let existing = state.installs[index].clone();
                let previous = if existing.current.version == fresh.version {
                    existing.previous
                } else {
                    if let Some(old) = &existing.previous {
                        if old.version != fresh.version && old.path.exists() && process::under(&old.path).is_empty() {
                            fs::remove_dir_all(&old.path)?;
                        }
                    }
                    if self.preferences()?.keep_previous { Some(existing.current) } else { None }
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
        self.sweep(&base, &install);
        Ok(install)
    }

    fn sweep(&self, base: &Path, install: &Install) {
        let keep: Vec<&Path> = std::iter::once(install.current.path.as_path()).chain(install.previous.as_ref().map(|p| p.path.as_path())).collect();
        let Ok(entries) = fs::read_dir(base) else { return };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() && !keep.contains(&path.as_path()) && process::under(&path).is_empty() {
                let _ = fs::remove_dir_all(&path);
            }
        }
        let Ok(entries) = fs::read_dir(base) else { return };
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            if let Some(version) = name.strip_suffix(".files.json") {
                if !base.join(version).is_dir() {
                    let _ = fs::remove_file(entry.path());
                }
            }
        }
    }

    pub fn running(&self, product: &str, channel: Channel) -> Vec<process::Running> {
        process::under(&self.root.join("apps").join(product).join(channel_name(channel)))
    }

    pub fn hold_if_older(&self, catalog: &Catalog, product: &str, channel: Channel, installed: &str) -> Result<bool> {
        let newest = catalog.product(product).and_then(|p| p.channels.get(&channel)).map(|r| r.version.as_str());
        if !newest.map(|n| version_newer(n, installed)).unwrap_or(false) {
            return Ok(false);
        }
        self.hold(product, channel)
    }

    fn hold(&self, product: &str, channel: Channel) -> Result<bool> {
        let forced = self.policy()?.map(|m| m.policy.auto_update.is_some()).unwrap_or(false);
        if forced || !self.preferences()?.automatic(product, channel) {
            return Ok(false);
        }
        let mut prefs = Preferences::load(&self.root)?;
        prefs.per_app.insert(product.to_string(), false);
        prefs.save(&self.root)?;
        Ok(true)
    }

    pub fn preferences(&self) -> Result<Preferences> {
        let own = Preferences::load(&self.root)?;
        Ok(match self.policy()? {
            Some(managed) => managed.policy.apply(own),
            None => own,
        })
    }

    pub fn set_preferences(&self, prefs: &Preferences) -> Result<()> {
        let Some(managed) = self.policy()? else { return prefs.save(&self.root) };
        let own = Preferences::load(&self.root)?;
        let locked = managed.policy.locked();
        let mut next = prefs.clone();
        if locked.contains(&"auto_update") {
            next.auto_update = own.auto_update;
            next.per_app = own.per_app;
        }
        if locked.contains(&"auto_update_beta") {
            next.auto_update_beta = own.auto_update_beta;
        }
        if locked.contains(&"only_when_closed") {
            next.only_when_closed = own.only_when_closed;
        }
        if locked.contains(&"keep_previous") {
            next.keep_previous = own.keep_previous;
        }
        next.save(&self.root)
    }

    pub fn updates(&self, catalog: &Catalog, platform: Platform) -> Result<Vec<Update>> {
        let prefs = self.preferences()?;
        let mut out = Vec::new();
        for install in self.state()?.installs {
            let view = catalog.view(&install.product, install.channel, platform);
            let (Availability::Available, Some(version), Some(artifact)) = (view.availability, view.version, view.artifact) else { continue };
            if !version_newer(version, &install.current.version) {
                continue;
            }
            let open = !self.running(&install.product, install.channel).is_empty();
            out.push(Update {
                automatic: prefs.automatic(&install.product, install.channel),
                product: install.product.clone(),
                channel: install.channel,
                from: install.current.version.clone(),
                to: version.to_string(),
                bytes: artifact.bytes,
                notes: catalog.product(&install.product).and_then(|p| p.channels.get(&install.channel)).map(|r| r.notes.clone()).unwrap_or_default(),
                open,
                later: self.is_later(&install.product, install.channel),
            });
        }
        Ok(out)
    }

    pub fn apply_updates(&self, catalog: &Catalog, platform: Platform, automatic_only: bool, progress: &mut dyn FnMut(&str, Channel, u64, u64)) -> Result<Vec<UpdateOutcome>> {
        let prefs = self.preferences()?;
        let mut done = Vec::new();
        for update in self.updates(catalog, platform)? {
            if automatic_only && (!(update.automatic || update.later) || ((prefs.only_when_closed || update.later) && update.open)) {
                continue;
            }
            let view = catalog.view(&update.product, update.channel, platform);
            let Some(artifact) = view.artifact else { continue };
            let product = update.product.clone();
            let channel = update.channel;
            let result = self.install_from(catalog, &product, channel, &update.to, artifact, &mut |have, total| progress(&product, channel, have, total));
            if result.is_ok() && update.later {
                let _ = self.set_later(&product, channel, false);
            }
            done.push(UpdateOutcome { product, channel, from: update.from, to: update.to, error: result.err().map(|e| e.to_string()) });
        }
        Ok(done)
    }

    pub fn rollback(&self, product: &str, channel: Channel) -> Result<Install> {
        let mut state = self.state()?;
        let index = state.position(product, channel).ok_or_else(|| CoreError::NotInstalled(product.to_string()))?;
        let existing = state.installs[index].clone();
        let previous = existing.previous.ok_or_else(|| CoreError::NotInstalled(format!("an earlier version of {product}")))?;
        if !previous.path.exists() {
            return Err(CoreError::NotInstalled(format!("{product} {}", previous.version)));
        }
        let older = version_newer(&existing.current.version, &previous.version);
        let swapped = Install { product: existing.product, channel, current: previous, previous: Some(existing.current) };
        state.installs[index] = swapped.clone();
        state.save(&self.root)?;
        if older {
            self.hold(product, channel)?;
            self.set_later(product, channel, false)?;
        }
        Ok(swapped)
    }

    pub fn uninstall(&self, product: &str, channel: Channel) -> Result<()> {
        let mut state = self.state()?;
        let index = state.position(product, channel).ok_or_else(|| CoreError::NotInstalled(product.to_string()))?;
        let base = self.root.join("apps").join(product).join(channel_name(channel));
        let open = process::under(&base);
        if !open.is_empty() {
            return Err(CoreError::Running { what: product.to_string(), pids: open.iter().map(|r| r.pid).collect() });
        }
        if base.exists() {
            fs::remove_dir_all(&base)?;
        }
        state.installs.remove(index);
        state.save(&self.root)?;
        let _ = self.set_later(product, channel, false);
        Ok(())
    }

    pub fn launch_target(&self, product: &str, channel: Channel) -> Result<PathBuf> {
        let state = self.state()?;
        let install = state.get(product, channel).ok_or_else(|| CoreError::NotInstalled(product.to_string()))?;
        find_target(&install.current.path, product).or_else(|| deep_find(&install.current.path, product, 5)).ok_or_else(|| CoreError::NotInstalled(format!("anything to open in {}", install.current.path.display())))
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
