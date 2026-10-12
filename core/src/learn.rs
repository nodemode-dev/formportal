use std::collections::{BTreeMap, BTreeSet};
use std::fs;

use serde::{Deserialize, Serialize};

use crate::download::fetch_bytes;
use crate::error::{CoreError, Result};
use crate::signature::verify;
use crate::Portal;

pub const LEARN_FORMAT: &str = "formai-learn";
const PROGRESS: &str = "learn-progress.json";
const BUNDLED: &str = include_str!("../data/learn-portal.json");

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Step {
    pub title: String,
    pub body: String,
    #[serde(default)]
    pub route: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Tutorial {
    pub id: String,
    pub product: String,
    pub title: String,
    pub summary: String,
    pub minutes: u32,
    pub level: String,
    pub steps: Vec<Step>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LearnIndex {
    pub format: String,
    pub format_version: u32,
    pub generated: String,
    pub tutorials: Vec<Tutorial>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Progress {
    #[serde(default)]
    pub done: BTreeMap<String, BTreeSet<usize>>,
}

pub fn bundled() -> LearnIndex {
    serde_json::from_str(BUNDLED).expect("the bundled tutorials are valid")
}

impl Portal {
    pub fn learn_index(&self, url: &str, allow_unsigned: bool) -> Result<LearnIndex> {
        let managed = self.policy()?;
        let locked = managed.as_ref().and_then(|m| m.policy.catalog.as_deref()).map(|c| match c.rsplit_once('/') {
            Some((dir, _)) => format!("{dir}/learn.json"),
            None => "learn.json".to_string(),
        });
        let url = locked.as_deref().unwrap_or(url);
        let (_, allow_unsigned, keys) = self.source(url, allow_unsigned)?;
        let body = if url.starts_with("http://") || url.starts_with("https://") {
            let body = fetch_bytes(url)?;
            match fetch_bytes(&format!("{url}.sig")).ok().map(|s| String::from_utf8_lossy(&s).trim().to_string()) {
                Some(sig) => verify(&body, &sig, &keys).map_err(|e| match e {
                    CoreError::Signature(why) => CoreError::Invalid(format!("the tutorial index was refused: {why}")),
                    other => other,
                })?,
                None if allow_unsigned => {}
                None => return Err(CoreError::Invalid("the tutorial index was refused: it is not signed".to_string())),
            }
            body
        } else {
            fs::read(url)?
        };
        let index: LearnIndex = serde_json::from_slice(&body).map_err(|e| CoreError::Invalid(format!("the tutorial index is not valid: {e}")))?;
        if index.format != LEARN_FORMAT {
            return Err(CoreError::Invalid(format!("not a tutorial index (format {:?})", index.format)));
        }
        Ok(index)
    }

    pub fn learn_progress(&self) -> Result<Progress> {
        match fs::read_to_string(self.root().join(PROGRESS)) {
            Ok(text) => serde_json::from_str(&text).map_err(|e| CoreError::State(e.to_string())),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Progress::default()),
            Err(e) => Err(e.into()),
        }
    }

    fn save_progress(&self, p: &Progress) -> Result<()> {
        fs::create_dir_all(self.root())?;
        let tmp = self.root().join(format!("{PROGRESS}.tmp"));
        fs::write(&tmp, serde_json::to_string_pretty(p).map_err(|e| CoreError::State(e.to_string()))?)?;
        fs::rename(tmp, self.root().join(PROGRESS))?;
        Ok(())
    }

    pub fn learn_mark(&self, tutorial: &Tutorial, step: usize, done: bool) -> Result<Progress> {
        if step >= tutorial.steps.len() {
            return Err(CoreError::Invalid(format!("{} has {} steps; there is no step {}", tutorial.title, tutorial.steps.len(), step + 1)));
        }
        let mut p = self.learn_progress()?;
        let set = p.done.entry(tutorial.id.clone()).or_default();
        if done {
            set.insert(step);
        } else {
            set.remove(&step);
        }
        if set.is_empty() {
            p.done.remove(&tutorial.id);
        }
        self.save_progress(&p)?;
        Ok(p)
    }

    pub fn learn_reset(&self, id: &str) -> Result<Progress> {
        let mut p = self.learn_progress()?;
        p.done.remove(id);
        self.save_progress(&p)?;
        Ok(p)
    }
}
