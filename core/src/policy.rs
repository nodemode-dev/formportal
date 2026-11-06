use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::{CoreError, Result};
use crate::prefs::Preferences;
use crate::Channel;

pub const POLICY_FORMAT: &str = "formportal-policy";
pub const POLICY_ENV: &str = "FORMPORTAL_POLICY";

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Policy {
    pub format: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub managed_by: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub catalog: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub catalog_keys: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub allow_unsigned: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auto_update: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auto_update_beta: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub only_when_closed: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub keep_previous: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub apps: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub channels: Option<Vec<Channel>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub extensions: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sideload: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub github_releases: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Managed {
    pub path: PathBuf,
    pub system: bool,
    pub policy: Policy,
}

pub fn system_path() -> PathBuf {
    if cfg!(target_os = "macos") {
        PathBuf::from("/Library/Application Support/FormPortal/policy.json")
    } else if cfg!(target_os = "windows") {
        std::env::var_os("ProgramData").map(PathBuf::from).unwrap_or_else(|| PathBuf::from(r"C:\ProgramData")).join("FormPortal").join("policy.json")
    } else {
        PathBuf::from("/etc/formportal/policy.json")
    }
}

fn read(path: &Path) -> Result<Option<Policy>> {
    let text = match fs::read_to_string(path) {
        Ok(text) => text,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(CoreError::Policy(format!("the organisation's policy at {} could not be read ({e}), so nothing is installed until it is fixed", path.display()))),
    };
    let policy: Policy = serde_json::from_str(&text)
        .map_err(|e| CoreError::Policy(format!("the organisation's policy at {} is not valid ({e}), so nothing is installed until it is fixed", path.display())))?;
    if policy.format != POLICY_FORMAT {
        return Err(CoreError::Policy(format!("{} is not a FormPortal policy (format {:?})", path.display(), policy.format)));
    }
    Ok(Some(policy))
}

pub fn check(path: &Path) -> Result<Policy> {
    read(path)?.ok_or_else(|| CoreError::Policy(format!("there is no policy file at {}", path.display())))
}

pub fn load() -> Result<Option<Managed>> {
    let system = system_path();
    if let Some(policy) = read(&system)? {
        return Ok(Some(Managed { path: system, system: true, policy }));
    }
    match std::env::var_os(POLICY_ENV).map(PathBuf::from) {
        Some(path) => Ok(read(&path)?.map(|policy| Managed { path, system: false, policy })),
        None => Ok(None),
    }
}

impl Policy {
    fn who(&self) -> String {
        match &self.managed_by {
            Some(name) => format!("{name}'s policy"),
            None => "the organisation's policy".to_string(),
        }
    }

    pub fn allows(&self, product: &str, channel: Channel) -> Result<()> {
        if let Some(apps) = &self.apps {
            if !apps.iter().any(|a| a == product) {
                return Err(CoreError::Policy(format!("{} does not allow {product} on this computer", self.who())));
            }
        }
        if let Some(channels) = &self.channels {
            if !channels.contains(&channel) {
                return Err(CoreError::Policy(format!("{} does not allow {} builds", self.who(), crate::portal::channel_name(channel))));
            }
        }
        Ok(())
    }

    pub fn allows_extensions(&self, sideload: bool) -> Result<()> {
        if self.extensions == Some(false) {
            return Err(CoreError::Policy(format!("{} does not allow extensions", self.who())));
        }
        if sideload && self.sideload == Some(false) {
            return Err(CoreError::Policy(format!("{} does not allow extensions installed from a file", self.who())));
        }
        Ok(())
    }

    pub fn unsigned(&self, asked: bool) -> bool {
        asked && self.allow_unsigned != Some(false)
    }

    pub fn catalog_url(&self, asked: &str) -> String {
        self.catalog.clone().unwrap_or_else(|| asked.to_string())
    }

    pub fn apply(&self, mut prefs: Preferences) -> Preferences {
        if let Some(on) = self.auto_update {
            prefs.auto_update = on;
            prefs.per_app.clear();
        }
        if let Some(on) = self.auto_update_beta {
            prefs.auto_update_beta = on;
        }
        if let Some(on) = self.only_when_closed {
            prefs.only_when_closed = on;
        }
        if let Some(on) = self.keep_previous {
            prefs.keep_previous = on;
        }
        prefs
    }

    pub fn locked(&self) -> Vec<&'static str> {
        let mut out = Vec::new();
        if self.catalog.is_some() {
            out.push("catalog");
        }
        if self.allow_unsigned == Some(false) {
            out.push("allow_unsigned");
        }
        if self.auto_update.is_some() {
            out.push("auto_update");
            out.push("per_app");
        }
        if self.auto_update_beta.is_some() {
            out.push("auto_update_beta");
        }
        if self.only_when_closed.is_some() {
            out.push("only_when_closed");
        }
        if self.keep_previous.is_some() {
            out.push("keep_previous");
        }
        out
    }
}
