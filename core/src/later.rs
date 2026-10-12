use std::collections::BTreeSet;
use std::fs;

use crate::error::{CoreError, Result};
use crate::portal::channel_name;
use crate::{Channel, Portal};

const LATER: &str = "later.json";

fn key(product: &str, channel: Channel) -> String {
    format!("{product}:{}", channel_name(channel))
}

impl Portal {
    pub fn later(&self) -> Result<BTreeSet<String>> {
        match fs::read_to_string(self.root().join(LATER)) {
            Ok(text) => serde_json::from_str(&text).map_err(|e| CoreError::State(e.to_string())),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(BTreeSet::new()),
            Err(e) => Err(e.into()),
        }
    }

    pub fn is_later(&self, product: &str, channel: Channel) -> bool {
        self.later().map(|l| l.contains(&key(product, channel))).unwrap_or(false)
    }

    pub fn set_later(&self, product: &str, channel: Channel, on: bool) -> Result<BTreeSet<String>> {
        if on && self.state()?.get(product, channel).is_none() {
            return Err(CoreError::NotInstalled(product.to_string()));
        }
        let mut list = self.later()?;
        if on {
            list.insert(key(product, channel));
        } else {
            list.remove(&key(product, channel));
        }
        fs::create_dir_all(self.root())?;
        let tmp = self.root().join(format!("{LATER}.tmp"));
        fs::write(&tmp, serde_json::to_string_pretty(&list).map_err(|e| CoreError::State(e.to_string()))?)?;
        fs::rename(tmp, self.root().join(LATER))?;
        Ok(list)
    }
}
