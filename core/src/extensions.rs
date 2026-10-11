use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::download::{download, fetch_bytes, sha256_file};
use crate::error::{CoreError, Result};
use crate::signature::{trusted_keys, verify};
use crate::{Arch, Artifact, ArtifactKind, Os, Portal};

pub const INDEX_FORMAT: &str = "formai-extensions";
pub const PACKAGE_FORMAT: &str = "formai-package";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Publisher {
    pub id: String,
    pub name: String,
    pub public_key: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PackageSignature {
    pub publisher: String,
    pub algorithm: String,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Entry {
    pub id: String,
    pub name: String,
    pub product: String,
    pub kind: String,
    pub author: String,
    pub description: String,
    pub version: String,
    pub url: String,
    pub sha256: String,
    #[serde(default)]
    pub bytes: u64,
    pub licence: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub minimum_app: Option<String>,
    pub native: bool,
    #[serde(default)]
    pub permissions: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub signature: Option<PackageSignature>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ExtensionIndex {
    pub format: String,
    pub format_version: u32,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default)]
    pub fixture: bool,
    #[serde(default)]
    pub publishers: Vec<Publisher>,
    #[serde(default)]
    pub packages: Vec<Entry>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Manifest {
    pub format: String,
    pub format_version: u32,
    pub id: String,
    pub name: String,
    pub product: String,
    pub kind: String,
    pub version: String,
    pub author: String,
    pub licence: String,
    pub native: bool,
    #[serde(default)]
    pub permissions: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub minimum_app: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Source {
    Catalogue,
    Sideload,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct InstalledExtension {
    pub id: String,
    pub name: String,
    pub product: String,
    pub kind: String,
    pub version: String,
    pub sha256: String,
    pub source: Source,
    pub signed_by: Option<String>,
    pub native: bool,
    pub permissions: Vec<String>,
    pub enabled: bool,
    pub path: PathBuf,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
struct Installed {
    #[serde(default)]
    extensions: Vec<InstalledExtension>,
}

fn parse_index(text: &str) -> Result<ExtensionIndex> {
    let index: ExtensionIndex = serde_json::from_str(text).map_err(|e| CoreError::Invalid(format!("the extension index is not valid: {e}")))?;
    if index.format != INDEX_FORMAT || index.format_version != 1 {
        return Err(CoreError::Invalid(format!("this is not a formai extension index (format {:?} {})", index.format, index.format_version)));
    }
    Ok(index)
}

fn read_manifest(package: &Path) -> Result<Manifest> {
    let mut archive = zip::ZipArchive::new(File::open(package)?).map_err(|e| CoreError::Archive(e.to_string()))?;
    let mut entry = archive.by_name("manifest.json").map_err(|_| CoreError::Archive("the package has no manifest.json at its root".to_string()))?;
    let mut text = String::new();
    entry.read_to_string(&mut text)?;
    let manifest: Manifest = serde_json::from_str(&text).map_err(|e| CoreError::Archive(format!("its manifest.json is not valid: {e}")))?;
    if manifest.format != PACKAGE_FORMAT || manifest.format_version != 1 {
        return Err(CoreError::Archive(format!("its manifest is not a formai package (format {:?})", manifest.format)));
    }
    if manifest.id.is_empty() || manifest.id.contains(['/', '\\', '.']) || manifest.product.is_empty() || manifest.product.contains(['/', '\\', '.']) {
        return Err(CoreError::Archive("its manifest names an id or product that is not a plain name".to_string()));
    }
    Ok(manifest)
}

fn check_signature(package: &Path, signature: &PackageSignature, publishers: &[Publisher]) -> Result<String> {
    let publisher = publishers.iter().find(|p| p.id == signature.publisher).ok_or_else(|| CoreError::Refused(format!("the package names a publisher, {:?}, that the index does not list", signature.publisher)))?;
    if signature.algorithm != "ed25519" {
        return Err(CoreError::Refused(format!("the package's signature uses {:?}, not ed25519", signature.algorithm)));
    }
    verify(&fs::read(package)?, &signature.value, &[publisher.public_key.clone()]).map_err(|_| CoreError::Refused(format!("the package's signature does not match {}'s key", publisher.name)))?;
    Ok(publisher.id.clone())
}

impl Portal {
    fn ext_root(&self) -> PathBuf {
        self.root().join("extensions")
    }

    fn ext_state(&self) -> Result<Installed> {
        match fs::read_to_string(self.ext_root().join("installed.json")) {
            Ok(text) => serde_json::from_str(&text).map_err(|e| CoreError::State(e.to_string())),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Installed::default()),
            Err(e) => Err(CoreError::Io(e)),
        }
    }

    fn ext_save(&self, state: &Installed) -> Result<()> {
        let root = self.ext_root();
        fs::create_dir_all(&root)?;
        let text = serde_json::to_string_pretty(state).map_err(|e| CoreError::State(e.to_string()))?;
        fs::write(root.join("installed.json.tmp"), text)?;
        fs::rename(root.join("installed.json.tmp"), root.join("installed.json"))?;
        let mut products: Vec<&str> = state.extensions.iter().map(|e| e.product.as_str()).collect();
        products.sort();
        products.dedup();
        for product in products {
            let enabled: Vec<serde_json::Value> = state
                .extensions
                .iter()
                .filter(|e| e.product == product && e.enabled)
                .map(|e| serde_json::json!({ "id": e.id, "kind": e.kind, "version": e.version, "path": e.path, "permissions": e.permissions, "native": e.native, "source": e.source }))
                .collect();
            let dir = root.join(product);
            fs::create_dir_all(&dir)?;
            let doc = serde_json::json!({ "format": "formportal-enabled-extensions", "format_version": 1, "product": product, "extensions": enabled });
            fs::write(dir.join("enabled.json"), serde_json::to_string_pretty(&doc).unwrap_or_default())?;
        }
        Ok(())
    }

    pub fn extension_index(&self, url: &str, allow_unsigned: bool) -> Result<ExtensionIndex> {
        if !(url.starts_with("http://") || url.starts_with("https://")) {
            return parse_index(&fs::read_to_string(url)?);
        }
        let dir = self.root().join("catalog");
        let kept = dir.join("extensions.json");
        let (body, signature, fresh) = match fetch_bytes(url) {
            Ok(body) => (body, fetch_bytes(&format!("{url}.sig")).ok().map(|s| String::from_utf8_lossy(&s).trim().to_string()), true),
            Err(e) => match fs::read(&kept) {
                Ok(body) => (body, fs::read_to_string(dir.join("extensions.json.sig")).ok(), false),
                Err(_) => return Err(e),
            },
        };
        match &signature {
            Some(s) => verify(&body, s, &trusted_keys())?,
            None if allow_unsigned => {}
            None => return Err(CoreError::Invalid("the extension index was refused: it is not signed".to_string())),
        }
        let index = parse_index(&String::from_utf8_lossy(&body))?;
        if fresh {
            fs::create_dir_all(&dir)?;
            fs::write(&kept, &body)?;
            if let Some(s) = &signature {
                fs::write(dir.join("extensions.json.sig"), s)?;
            }
        }
        Ok(index)
    }

    pub fn extensions_installed(&self) -> Result<Vec<InstalledExtension>> {
        Ok(self.ext_state()?.extensions)
    }

    fn place_package(&self, package: &Path, manifest: &Manifest, sha256: String, source: Source, signed_by: Option<String>) -> Result<InstalledExtension> {
        let base = self.ext_root().join(&manifest.product).join(&manifest.id);
        let target = base.join(&manifest.version);
        let staging = base.join(format!("{}.tmp", manifest.version));
        if staging.exists() {
            fs::remove_dir_all(&staging)?;
        }
        fs::create_dir_all(&staging)?;
        if let Err(e) = crate::portal::unzip_into(package, &staging) {
            let _ = fs::remove_dir_all(&staging);
            return Err(e);
        }
        if target.exists() {
            fs::remove_dir_all(&target)?;
        }
        fs::rename(&staging, &target)?;
        let mut state = self.ext_state()?;
        let enabled = state.extensions.iter().find(|e| e.product == manifest.product && e.id == manifest.id).map(|e| e.enabled).unwrap_or(true);
        state.extensions.retain(|e| !(e.product == manifest.product && e.id == manifest.id));
        let record = InstalledExtension {
            id: manifest.id.clone(),
            name: manifest.name.clone(),
            product: manifest.product.clone(),
            kind: manifest.kind.clone(),
            version: manifest.version.clone(),
            sha256,
            source,
            signed_by,
            native: manifest.native,
            permissions: manifest.permissions.clone(),
            enabled,
            path: target.clone(),
        };
        state.extensions.push(record.clone());
        self.ext_save(&state)?;
        if let Ok(entries) = fs::read_dir(&base) {
            for entry in entries.flatten() {
                if entry.path() != target {
                    let _ = fs::remove_dir_all(entry.path());
                }
            }
        }
        Ok(record)
    }

    pub fn install_extension(&self, index: &ExtensionIndex, id: &str, allow_unsigned: bool, progress: &mut dyn FnMut(u64, u64)) -> Result<InstalledExtension> {
        let entry = index.packages.iter().find(|p| p.id == id).ok_or_else(|| CoreError::Invalid(format!("{id} is not in the extension index")))?;
        let file = format!("{}-{}.formpkg", entry.id, entry.version);
        let artifact = Artifact { platform: Os::Other, arch: Arch::X86_64, kind: ArtifactKind::Zip, file, url: entry.url.clone(), bytes: entry.bytes, sha256: entry.sha256.clone(), minimum_os: String::new(), signature: None };
        let package = download(&artifact, &self.root().join("downloads"), progress)?;
        let signed_by = match &entry.signature {
            Some(sig) => Some(check_signature(&package, sig, &index.publishers)?),
            None if entry.native && !allow_unsigned => return Err(CoreError::Refused(format!("{} runs native code and is not signed; only the developer setting installs it", entry.name))),
            None => None,
        };
        let manifest = read_manifest(&package)?;
        if manifest.id != entry.id || manifest.product != entry.product || manifest.version != entry.version {
            return Err(CoreError::Refused(format!("the package's manifest says {} {} for {}, the index says {} {} for {}", manifest.id, manifest.version, manifest.product, entry.id, entry.version, entry.product)));
        }
        if manifest.native != entry.native {
            return Err(CoreError::Refused("the package's manifest and the index disagree on whether it runs native code".to_string()));
        }
        let record = self.place_package(&package, &manifest, entry.sha256.clone(), Source::Catalogue, signed_by)?;
        let _ = fs::remove_file(&package);
        Ok(record)
    }

    pub fn install_extension_file(&self, path: &Path, index: Option<&ExtensionIndex>, allow_unsigned: bool) -> Result<InstalledExtension> {
        let manifest = read_manifest(path)?;
        let sha256 = sha256_file(path)?;
        let listed = index.and_then(|i| i.packages.iter().find(|p| p.sha256 == sha256).map(|p| (p, i)));
        let signed_by = match listed {
            Some((entry, i)) => match &entry.signature {
                Some(sig) => Some(check_signature(path, sig, &i.publishers)?),
                None => None,
            },
            None => None,
        };
        if manifest.native && signed_by.is_none() && !allow_unsigned {
            return Err(CoreError::Refused(format!("{} runs native code and is not a signed package from the index; only the developer setting installs it", manifest.name)));
        }
        let source = if listed.is_some() { Source::Catalogue } else { Source::Sideload };
        self.place_package(path, &manifest, sha256, source, signed_by)
    }

    pub fn remove_extension(&self, product: &str, id: &str) -> Result<()> {
        let mut state = self.ext_state()?;
        let before = state.extensions.len();
        state.extensions.retain(|e| !(e.product == product && e.id == id));
        if state.extensions.len() == before {
            return Err(CoreError::NotInstalled(format!("the extension {id} for {product}")));
        }
        let dir = self.ext_root().join(product).join(id);
        if dir.exists() {
            fs::remove_dir_all(dir)?;
        }
        self.ext_save(&state)?;
        if !state.extensions.iter().any(|e| e.product == product) {
            let doc = serde_json::json!({ "format": "formportal-enabled-extensions", "format_version": 1, "product": product, "extensions": [] });
            fs::write(self.ext_root().join(product).join("enabled.json"), serde_json::to_string_pretty(&doc).unwrap_or_default())?;
        }
        Ok(())
    }

    pub fn enable_extension(&self, product: &str, id: &str, enabled: bool) -> Result<InstalledExtension> {
        let mut state = self.ext_state()?;
        let found = state.extensions.iter_mut().find(|e| e.product == product && e.id == id).ok_or_else(|| CoreError::NotInstalled(format!("the extension {id} for {product}")))?;
        found.enabled = enabled;
        let record = found.clone();
        self.ext_save(&state)?;
        Ok(record)
    }
}
