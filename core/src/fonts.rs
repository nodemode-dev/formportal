use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};

use crate::download::{download, fetch_bytes, sha256_file};
use crate::error::{CoreError, Result};
use crate::signature::verify;
use crate::{Arch, Artifact, ArtifactKind, Os, Portal};

pub const FONT_FORMAT: &str = "formai-fonts";
pub const FONTS_DIR_ENV: &str = "FORMPORTAL_FONTS_DIR";
const FONT_STATE: &str = "fonts.json";
const OPEN_LICENCES: [&str; 3] = ["OFL-1.1", "Apache-2.0", "MIT"];

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FontStyle {
    pub style: String,
    pub weight: u16,
    #[serde(default)]
    pub italic: bool,
    pub file: String,
    pub url: String,
    pub bytes: u64,
    pub sha256: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FontFamily {
    pub id: String,
    pub family: String,
    pub foundry: String,
    pub licence: String,
    #[serde(default)]
    pub category: String,
    #[serde(default)]
    pub source: Option<String>,
    pub styles: Vec<FontStyle>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FontIndex {
    pub format: String,
    pub format_version: u32,
    pub generated: String,
    pub families: Vec<FontFamily>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FontSource {
    Index,
    Own,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct InstalledFont {
    pub family: String,
    pub style: String,
    pub family_id: Option<String>,
    pub file: PathBuf,
    pub sha256: String,
    pub source: FontSource,
    pub licence: Option<String>,
    #[serde(default)]
    pub registry_name: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
struct FontState {
    #[serde(default)]
    fonts: Vec<InstalledFont>,
}

pub fn font_dir() -> PathBuf {
    if let Some(dir) = std::env::var_os(FONTS_DIR_ENV) {
        return PathBuf::from(dir);
    }
    let home = std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE")).map(PathBuf::from).unwrap_or_else(|| PathBuf::from("."));
    if cfg!(target_os = "macos") {
        home.join("Library").join("Fonts")
    } else if cfg!(target_os = "windows") {
        std::env::var_os("LOCALAPPDATA").map(PathBuf::from).unwrap_or_else(|| home.join("AppData").join("Local")).join("Microsoft").join("Windows").join("Fonts")
    } else {
        std::env::var_os("XDG_DATA_HOME").map(PathBuf::from).unwrap_or_else(|| home.join(".local").join("share")).join("fonts").join("FormPortal")
    }
}

fn testing() -> bool {
    std::env::var_os(FONTS_DIR_ENV).is_some()
}

fn safe(text: &str) -> String {
    text.chars().map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '-' }).collect::<String>().trim_matches('-').to_string()
}

pub fn font_kind(path: &Path) -> Result<&'static str> {
    let mut head = [0u8; 4];
    use std::io::Read;
    fs::File::open(path)?.read_exact(&mut head).map_err(|_| CoreError::Invalid(format!("{} is too short to be a font", path.display())))?;
    match &head {
        [0, 1, 0, 0] | b"true" => Ok("ttf"),
        b"OTTO" => Ok("otf"),
        b"ttcf" => Ok("ttc"),
        b"wOFF" | b"wOF2" => Err(CoreError::Invalid(format!("{} is a web font (WOFF); desktop apps need the TTF or OTF", path.display()))),
        _ => Err(CoreError::Invalid(format!("{} is not a TrueType or OpenType font", path.display()))),
    }
}

fn after_change(registered: &[(String, PathBuf)], removed: &[String]) {
    if testing() {
        return;
    }
    if cfg!(target_os = "windows") {
        let key = r"HKCU\Software\Microsoft\Windows NT\CurrentVersion\Fonts";
        for (name, file) in registered {
            let _ = Command::new("reg").args(["add", key, "/v", name, "/t", "REG_SZ", "/d"]).arg(file).arg("/f").output();
        }
        for name in removed {
            let _ = Command::new("reg").args(["delete", key, "/v", name, "/f"]).output();
        }
    } else if !cfg!(target_os = "macos") {
        let _ = Command::new("fc-cache").arg("-f").arg(font_dir()).output();
    }
}

impl Portal {
    fn font_state(&self) -> Result<FontState> {
        match fs::read_to_string(self.root().join(FONT_STATE)) {
            Ok(text) => serde_json::from_str(&text).map_err(|e| CoreError::State(e.to_string())),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(FontState::default()),
            Err(e) => Err(e.into()),
        }
    }

    fn font_save(&self, state: &FontState) -> Result<()> {
        fs::create_dir_all(self.root())?;
        let tmp = self.root().join(format!("{FONT_STATE}.tmp"));
        fs::write(&tmp, serde_json::to_string_pretty(state).map_err(|e| CoreError::State(e.to_string()))?)?;
        fs::rename(tmp, self.root().join(FONT_STATE))?;
        Ok(())
    }

    pub fn fonts_installed(&self) -> Result<Vec<InstalledFont>> {
        Ok(self.font_state()?.fonts)
    }

    pub fn font_updates(&self, index: &FontIndex) -> Result<Vec<InstalledFont>> {
        Ok(self
            .font_state()?
            .fonts
            .into_iter()
            .filter(|f| f.source == FontSource::Index)
            .filter(|f| {
                let family = index.families.iter().find(|x| Some(&x.id) == f.family_id.as_ref());
                family.and_then(|x| x.styles.iter().find(|s| s.style.eq_ignore_ascii_case(&f.style))).map(|s| s.sha256 != f.sha256).unwrap_or(false)
            })
            .collect())
    }

    pub fn font_index(&self, url: &str, allow_unsigned: bool) -> Result<FontIndex> {
        let managed = self.policy()?;
        let locked = managed.as_ref().and_then(|m| m.policy.catalog.as_deref()).map(|c| match c.rsplit_once('/') {
            Some((dir, _)) => format!("{dir}/fonts.json"),
            None => "fonts.json".to_string(),
        });
        let url = locked.as_deref().unwrap_or(url);
        let (_, allow_unsigned, keys) = self.source(url, allow_unsigned)?;
        let body = if url.starts_with("http://") || url.starts_with("https://") {
            let body = fetch_bytes(url)?;
            match fetch_bytes(&format!("{url}.sig")).ok().map(|s| String::from_utf8_lossy(&s).trim().to_string()) {
                Some(sig) => verify(&body, &sig, &keys).map_err(|e| match e {
                    CoreError::Signature(why) => CoreError::Invalid(format!("the font index was refused: {why}")),
                    other => other,
                })?,
                None if allow_unsigned => {}
                None => return Err(CoreError::Invalid("the font index was refused: it is not signed".to_string())),
            }
            body
        } else {
            fs::read(url)?
        };
        let index: FontIndex = serde_json::from_slice(&body).map_err(|e| CoreError::Invalid(format!("the font index is not valid: {e}")))?;
        if index.format != FONT_FORMAT {
            return Err(CoreError::Invalid(format!("not a font index (format {:?})", index.format)));
        }
        Ok(index)
    }

    pub fn install_font(&self, index: &FontIndex, family_id: &str, style: Option<&str>, progress: &mut dyn FnMut(u64, u64)) -> Result<Vec<InstalledFont>> {
        let family = index.families.iter().find(|f| f.id == family_id).ok_or_else(|| CoreError::Invalid(format!("{family_id} is not in the font index")))?;
        if !OPEN_LICENCES.contains(&family.licence.as_str()) {
            return Err(CoreError::Refused(format!("{} is licensed {}, not an open font licence FormPortal installs", family.family, family.licence)));
        }
        let styles: Vec<&FontStyle> = family.styles.iter().filter(|s| style.map(|w| s.style.eq_ignore_ascii_case(w)).unwrap_or(true)).collect();
        if styles.is_empty() {
            return Err(CoreError::Invalid(format!("{} has no style {:?}", family.family, style.unwrap_or_default())));
        }
        let dir = font_dir();
        fs::create_dir_all(&dir)?;
        let mut state = self.font_state()?;
        let mut done = Vec::new();
        let mut registered = Vec::new();
        for s in styles {
            let ext = Path::new(&s.file).extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_else(|| "ttf".to_string());
            let artifact = Artifact { platform: Os::Other, arch: Arch::X86_64, kind: ArtifactKind::Zip, file: s.file.clone(), url: s.url.clone(), bytes: s.bytes, sha256: s.sha256.clone(), minimum_os: String::new(), signature: None };
            let file = download(&artifact, &self.root().join("downloads"), progress)?;
            font_kind(&file)?;
            let target = dir.join(format!("FormPortal-{}-{}.{ext}", safe(&family.family), safe(&s.style)));
            fs::copy(&file, &target)?;
            let _ = fs::remove_file(&file);
            let registry_name = cfg!(target_os = "windows").then(|| format!("{} {} ({})", family.family, s.style, if ext == "otf" { "OpenType" } else { "TrueType" }));
            if let Some(name) = &registry_name {
                registered.push((name.clone(), target.clone()));
            }
            state.fonts.retain(|f| f.file != target);
            let record = InstalledFont { family: family.family.clone(), style: s.style.clone(), family_id: Some(family.id.clone()), file: target, sha256: s.sha256.clone(), source: FontSource::Index, licence: Some(family.licence.clone()), registry_name };
            state.fonts.push(record.clone());
            done.push(record);
        }
        self.font_save(&state)?;
        after_change(&registered, &[]);
        Ok(done)
    }

    pub fn add_own_font(&self, path: &Path, rights_confirmed: bool) -> Result<InstalledFont> {
        if !rights_confirmed {
            return Err(CoreError::Refused("adding your own font needs your confirmation that you have the right to use it on this computer".to_string()));
        }
        let ext = font_kind(path)?;
        let stem = path.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_else(|| "font".to_string());
        let dir = font_dir();
        fs::create_dir_all(&dir)?;
        let target = dir.join(format!("FormPortal-own-{}.{ext}", safe(&stem)));
        fs::copy(path, &target)?;
        let sha256 = sha256_file(&target)?;
        let registry_name = cfg!(target_os = "windows").then(|| format!("{stem} ({})", if ext == "otf" { "OpenType" } else { "TrueType" }));
        let mut state = self.font_state()?;
        state.fonts.retain(|f| f.file != target);
        let record = InstalledFont { family: stem.clone(), style: "as in the file".to_string(), family_id: None, file: target.clone(), sha256, source: FontSource::Own, licence: None, registry_name: registry_name.clone() };
        state.fonts.push(record.clone());
        self.font_save(&state)?;
        after_change(&registry_name.map(|n| vec![(n, target)]).unwrap_or_default(), &[]);
        Ok(record)
    }

    pub fn remove_font(&self, family: &str, style: Option<&str>) -> Result<Vec<InstalledFont>> {
        let mut state = self.font_state()?;
        let (gone, keep): (Vec<InstalledFont>, Vec<InstalledFont>) = state.fonts.into_iter().partition(|f| {
            let fam = f.family.eq_ignore_ascii_case(family) || f.family_id.as_deref() == Some(family);
            fam && style.map(|s| f.style.eq_ignore_ascii_case(s)).unwrap_or(true)
        });
        if gone.is_empty() {
            return Err(CoreError::NotInstalled(format!("the font {family}")));
        }
        for f in &gone {
            if f.file.starts_with(font_dir()) {
                let _ = fs::remove_file(&f.file);
            }
        }
        state.fonts = keep;
        self.font_save(&state)?;
        after_change(&[], &gone.iter().filter_map(|f| f.registry_name.clone()).collect::<Vec<_>>());
        Ok(gone)
    }
}
