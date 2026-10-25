use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::{CoreError, Result};
use crate::Channel;

pub const STATE_FILE: &str = "installed.json";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct InstalledVersion {
    pub version: String,
    pub path: PathBuf,
    pub sha256: String,
    pub installed_at: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub files: Option<PathBuf>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Install {
    pub product: String,
    pub channel: Channel,
    pub current: InstalledVersion,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub previous: Option<InstalledVersion>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct State {
    #[serde(default)]
    pub installs: Vec<Install>,
}

impl State {
    pub fn load(root: &Path) -> Result<Self> {
        let path = root.join(STATE_FILE);
        if !path.is_file() {
            return Ok(State::default());
        }
        serde_json::from_str(&fs::read_to_string(&path)?).map_err(|e| CoreError::State(e.to_string()))
    }

    pub fn save(&self, root: &Path) -> Result<()> {
        fs::create_dir_all(root)?;
        let text = serde_json::to_string_pretty(self).map_err(|e| CoreError::State(e.to_string()))?;
        let staging = root.join(format!("{STATE_FILE}.tmp"));
        fs::write(&staging, text)?;
        fs::rename(&staging, root.join(STATE_FILE))?;
        Ok(())
    }

    pub fn position(&self, product: &str, channel: Channel) -> Option<usize> {
        self.installs.iter().position(|i| i.product == product && i.channel == channel)
    }

    pub fn get(&self, product: &str, channel: Channel) -> Option<&Install> {
        self.position(product, channel).map(|index| &self.installs[index])
    }
}
