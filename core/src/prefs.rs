use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::error::{CoreError, Result};
use crate::Channel;

pub const PREFS_FILE: &str = "preferences.json";

fn yes() -> bool {
    true
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Preferences {
    #[serde(default = "yes")]
    pub auto_update: bool,
    #[serde(default)]
    pub auto_update_beta: bool,
    #[serde(default = "yes")]
    pub only_when_closed: bool,
    #[serde(default = "yes")]
    pub notices: bool,
    #[serde(default)]
    pub per_app: BTreeMap<String, bool>,
    #[serde(default = "yes")]
    pub keep_previous: bool,
    #[serde(default)]
    pub quiet: Vec<String>,
}

impl Default for Preferences {
    fn default() -> Self {
        Preferences { auto_update: true, auto_update_beta: false, only_when_closed: true, notices: true, per_app: BTreeMap::new(), keep_previous: true, quiet: Vec::new() }
    }
}

impl Preferences {
    pub fn load(root: &Path) -> Result<Self> {
        match fs::read_to_string(root.join(PREFS_FILE)) {
            Ok(text) => serde_json::from_str(&text).map_err(|e| CoreError::State(e.to_string())),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Preferences::default()),
            Err(e) => Err(CoreError::Io(e)),
        }
    }

    pub fn save(&self, root: &Path) -> Result<()> {
        fs::create_dir_all(root)?;
        let text = serde_json::to_string_pretty(self).map_err(|e| CoreError::State(e.to_string()))?;
        let staging = root.join(format!("{PREFS_FILE}.tmp"));
        fs::write(&staging, text)?;
        fs::rename(staging, root.join(PREFS_FILE))?;
        Ok(())
    }

    pub fn automatic(&self, product: &str, channel: Channel) -> bool {
        let base = match channel {
            Channel::Stable => self.auto_update,
            Channel::Beta | Channel::Nightly => self.auto_update && self.auto_update_beta,
        };
        self.per_app.get(product).copied().map(|on| on && (channel == Channel::Stable || self.auto_update_beta)).unwrap_or(base)
    }
}
