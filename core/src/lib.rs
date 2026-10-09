use std::collections::BTreeMap;
use std::fmt;

use serde::{Deserialize, Serialize};

pub mod download;
pub mod error;
pub mod hub;
pub mod signature;
pub mod state;

pub use error::CoreError;
pub use hub::Hub;
pub use state::{Install, InstalledVersion, State};

pub const CORE_VERSION: &str = env!("CARGO_PKG_VERSION");
pub const CATALOG_FORMAT: &str = "formai-catalog";
pub const CATALOG_FORMAT_VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProductState {
    Prelaunch,
    Public,
    Live,
}

pub type ProductKind = String;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Channel {
    Stable,
    Beta,
    Nightly,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Os {
    Macos,
    Windows,
    Linux,
    Android,
    Ios,
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Arch {
    #[serde(rename = "arm64")]
    Arm64,
    #[serde(rename = "x86_64")]
    X86_64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ArtifactKind {
    Zip,
    Dmg,
    Appimage,
    Msi,
    Nsis,
    Deb,
    Rpm,
    Apk,
    Ipa,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Artifact {
    pub platform: Os,
    pub arch: Arch,
    pub kind: ArtifactKind,
    pub file: String,
    pub url: String,
    pub bytes: u64,
    pub sha256: String,
    pub minimum_os: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub signature: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Release {
    pub version: String,
    pub published: String,
    pub notes: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub commit: Option<String>,
    pub artifacts: Vec<Artifact>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Product {
    pub id: String,
    pub name: String,
    pub kind: ProductKind,
    pub summary: String,
    pub identifier: String,
    pub repository: String,
    pub licence: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub project_extensions: Vec<String>,
    pub state: ProductState,
    pub channels: BTreeMap<Channel, Release>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Catalog {
    pub format: String,
    pub format_version: u32,
    pub generated: String,
    pub origin: String,
    #[serde(default)]
    pub fixture: bool,
    pub products: Vec<Product>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Platform {
    pub os: Os,
    pub arch: Arch,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Availability {
    Unreleased,
    NoRelease,
    Available,
    OtherPlatform,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ChannelView<'a> {
    pub product: &'a str,
    pub channel: Channel,
    pub availability: Availability,
    pub version: Option<&'a str>,
    pub artifact: Option<&'a Artifact>,
}

#[derive(Debug)]
pub enum CatalogError {
    Parse(serde_json::Error),
    Format(String),
    FormatVersion(u32),
}

impl fmt::Display for CatalogError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CatalogError::Parse(e) => write!(f, "the catalogue is not valid: {e}"),
            CatalogError::Format(found) => write!(f, "this is not a formai catalogue (format is {found:?})"),
            CatalogError::FormatVersion(found) => {
                write!(f, "catalogue format {found} is newer than this build reads ({CATALOG_FORMAT_VERSION})")
            }
        }
    }
}

impl std::error::Error for CatalogError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            CatalogError::Parse(e) => Some(e),
            _ => None,
        }
    }
}

impl Platform {
    pub fn current() -> Self {
        let os = if cfg!(target_os = "macos") {
            Os::Macos
        } else if cfg!(target_os = "windows") {
            Os::Windows
        } else if cfg!(target_os = "linux") {
            Os::Linux
        } else {
            Os::Other
        };
        let arch = if cfg!(target_arch = "aarch64") { Arch::Arm64 } else { Arch::X86_64 };
        Platform { os, arch }
    }
}

impl Release {
    pub fn artifact_for(&self, platform: Platform) -> Option<&Artifact> {
        self.artifacts
            .iter()
            .find(|a| a.platform == platform.os && a.arch == platform.arch)
            .or_else(|| self.artifacts.iter().find(|a| a.platform == platform.os))
    }
}

impl Catalog {
    pub fn from_json(text: &str) -> Result<Self, CatalogError> {
        let catalog: Catalog = serde_json::from_str(text).map_err(CatalogError::Parse)?;
        if catalog.format != CATALOG_FORMAT {
            return Err(CatalogError::Format(catalog.format));
        }
        if catalog.format_version != CATALOG_FORMAT_VERSION {
            return Err(CatalogError::FormatVersion(catalog.format_version));
        }
        Ok(catalog)
    }

    pub fn product(&self, id: &str) -> Option<&Product> {
        self.products.iter().find(|p| p.id == id)
    }

    pub fn view<'a>(&'a self, id: &'a str, channel: Channel, platform: Platform) -> ChannelView<'a> {
        let unreleased = ChannelView { product: id, channel, availability: Availability::Unreleased, version: None, artifact: None };
        let Some(product) = self.product(id) else {
            return unreleased;
        };
        if product.state == ProductState::Prelaunch {
            return unreleased;
        }
        let Some(release) = product.channels.get(&channel) else {
            return ChannelView { availability: Availability::NoRelease, ..unreleased };
        };
        let artifact = release.artifact_for(platform);
        ChannelView {
            product: id,
            channel,
            availability: if artifact.is_some() { Availability::Available } else { Availability::OtherPlatform },
            version: Some(&release.version),
            artifact,
        }
    }
}
