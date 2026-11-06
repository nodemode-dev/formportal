use std::path::{Component, Path, PathBuf};
use std::sync::OnceLock;

use crate::extensions::ExtensionIndex;
use crate::fonts::FontIndex;
use crate::media::MediaIndex;
use crate::portal::Portal;

pub const SCHEME: &str = "bundled:";
pub const STORE: &str = "https://formai.studio/catalog/v1";

type Reader = Box<dyn Fn(&str) -> Option<Vec<u8>> + Send + Sync>;
static READER: OnceLock<Reader> = OnceLock::new();

pub fn set_reader(reader: impl Fn(&str) -> Option<Vec<u8>> + Send + Sync + 'static) {
    let _ = READER.set(Box::new(reader));
}

pub fn is_bundled(url: &str) -> bool {
    url.starts_with(SCHEME)
}

fn relative(url: &str) -> Option<&str> {
    let rest = url.strip_prefix(SCHEME)?;
    let plain = !rest.is_empty() && Path::new(rest).components().all(|c| matches!(c, Component::Normal(_)));
    plain.then_some(rest)
}

pub fn read(url: &str) -> Option<Vec<u8>> {
    let rest = relative(url)?;
    if let Some(reader) = READER.get() {
        if let Some(bytes) = reader(&format!("/store/{rest}")) {
            return Some(bytes);
        }
    }
    if let Some(dir) = std::env::var_os("FORMPORTAL_STORE").map(PathBuf::from) {
        return std::fs::read(dir.join(rest)).ok();
    }
    let exe = std::env::current_exe().ok()?;
    exe.ancestors().skip(1).take(6).map(|dir| dir.join("frontend").join("public").join("store").join(rest)).find_map(|path| std::fs::read(path).ok())
}

pub fn store_url(name: &str) -> String {
    format!("{STORE}/{name}")
}

pub struct Shelf<T> {
    pub index: T,
    pub reached: Option<String>,
    pub missed: Option<String>,
}

fn reach<T>(name: &str, sibling: &str, fetch: impl Fn(&str) -> crate::error::Result<T>) -> (Option<T>, Option<String>, Option<String>) {
    let mut tried = vec![store_url(name)];
    if !tried.iter().any(|u| u == sibling) {
        tried.push(sibling.to_string());
    }
    let mut why = Vec::new();
    for url in tried {
        match fetch(&url) {
            Ok(index) => return (Some(index), Some(url), None),
            Err(e) => why.push(format!("{url}: {e}")),
        }
    }
    (None, None, Some(why.join("; ")))
}

pub fn bundled_fonts() -> FontIndex {
    serde_json::from_str(include_str!("../data/store-fonts.json")).unwrap_or(FontIndex { format: "formai-fonts".to_string(), format_version: 1, generated: String::new(), families: Vec::new() })
}

pub fn bundled_media() -> MediaIndex {
    serde_json::from_str(include_str!("../data/store-media.json")).unwrap_or(MediaIndex { format: "formai-media".to_string(), format_version: 1, generated: String::new(), items: Vec::new() })
}

pub fn bundled_extensions() -> Option<ExtensionIndex> {
    serde_json::from_str(include_str!("../data/store-extensions.json")).ok()
}

impl Portal {
    pub fn font_library(&self, sibling: &str, allow_unsigned: bool) -> Shelf<FontIndex> {
        let mut index = bundled_fonts();
        let (remote, reached, missed) = reach("fonts.json", sibling, |u| self.font_index(u, allow_unsigned));
        if let Some(remote) = remote {
            index.generated = remote.generated;
            for family in remote.families {
                match index.families.iter_mut().find(|f| f.id == family.id) {
                    Some(slot) => *slot = family,
                    None => index.families.push(family),
                }
            }
        }
        Shelf { index, reached, missed }
    }

    pub fn media_library(&self, sibling: &str, allow_unsigned: bool) -> Shelf<MediaIndex> {
        let mut index = bundled_media();
        let (remote, reached, missed) = reach("media.json", sibling, |u| self.media_index(u, allow_unsigned));
        if let Some(remote) = remote {
            index.generated = remote.generated;
            for item in remote.items {
                match index.items.iter_mut().find(|i| i.id == item.id) {
                    Some(slot) => *slot = item,
                    None => index.items.push(item),
                }
            }
        }
        Shelf { index, reached, missed }
    }

    pub fn extension_library(&self, sibling: &str, allow_unsigned: bool) -> Shelf<Option<ExtensionIndex>> {
        let bundled = bundled_extensions();
        let (remote, reached, missed) = reach("extensions.json", sibling, |u| self.extension_index(u, allow_unsigned));
        let index = match (bundled, remote) {
            (Some(mut base), Some(remote)) => {
                for publisher in remote.publishers {
                    if !base.publishers.iter().any(|p| p.id == publisher.id) {
                        base.publishers.push(publisher);
                    }
                }
                for package in remote.packages {
                    match base.packages.iter_mut().find(|p| p.id == package.id) {
                        Some(slot) => *slot = package,
                        None => base.packages.push(package),
                    }
                }
                base.name = remote.name;
                base.description = remote.description;
                Some(base)
            }
            (base, remote) => remote.or(base),
        };
        Shelf { index, reached, missed }
    }
}
