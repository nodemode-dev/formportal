use serde::{Deserialize, Serialize};

use crate::{version_newer, Catalog, Channel, Platform};

pub const PRODUCT: &str = "formai";
pub const DOWNLOAD_PAGE: &str = "https://formai.studio/download/";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Newer {
    pub version: String,
    pub page: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Action {
    None,
    Install,
    Download,
}

pub fn newer(catalog: &Catalog, platform: Platform, current: &str) -> Option<Newer> {
    let listed = catalog.view(PRODUCT, Channel::Stable, platform).version?;
    version_newer(listed, current).then(|| Newer { version: listed.to_string(), page: DOWNLOAD_PAGE.to_string() })
}

pub fn action(newer: Option<&Newer>, in_place: Option<&str>) -> Action {
    match (newer, in_place) {
        (None, _) => Action::None,
        (Some(n), Some(feed)) if !version_newer(&n.version, feed) => Action::Install,
        (Some(_), _) => Action::Download,
    }
}
