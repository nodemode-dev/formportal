use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};

use crate::download::{download, fetch_bytes, sha256_file};
use crate::error::{CoreError, Result};
use crate::signature::{read_local, verify};
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
    Fontsource,
    Google,
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
    #[serde(default)]
    pub licence_file: Option<PathBuf>,
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
            read_local(url, &keys, allow_unsigned).map_err(|e| match e {
                CoreError::Signature(why) => CoreError::Invalid(format!("the font index was refused: {why}")),
                other => other,
            })?
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
            let record = InstalledFont { family: family.family.clone(), style: s.style.clone(), family_id: Some(family.id.clone()), file: target, sha256: s.sha256.clone(), source: FontSource::Index, licence: Some(family.licence.clone()), registry_name, licence_file: None };
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
        let record = InstalledFont { family: stem.clone(), style: "as in the file".to_string(), family_id: None, file: target.clone(), sha256, source: FontSource::Own, licence: None, registry_name: registry_name.clone(), licence_file: None };
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
            if let Some(licence) = f.licence_file.as_ref().filter(|l| l.starts_with(font_dir()) && !keep.iter().any(|k| k.licence_file.as_ref() == Some(l))) {
                let _ = fs::remove_file(licence);
            }
        }
        state.fonts = keep;
        self.font_save(&state)?;
        after_change(&[], &gone.iter().filter_map(|f| f.registry_name.clone()).collect::<Vec<_>>());
        Ok(gone)
    }

    pub fn install_web_font(&self, source: &str, id: &str) -> Result<Vec<InstalledFont>> {
        let detail = web_family(source, id)?;
        if !detail.installable {
            return Err(CoreError::Refused(match &detail.licence {
                Some(l) => format!("{} is licensed {l}; FormPortal installs fonts licensed OFL-1.1, Apache-2.0 or MIT", detail.family),
                None => format!("{} cannot be installed: its licence is not stated", detail.family),
            }));
        }
        let kind = if source == "google" { FontSource::Google } else { FontSource::Fontsource };
        let service = service_name(source);
        let dir = font_dir();
        fs::create_dir_all(&dir)?;
        let scratch = self.root().join("downloads");
        fs::create_dir_all(&scratch)?;
        let mut files = Vec::new();
        for face in &detail.faces {
            let body = web_get(&face.url, FACE_CAP, service)?;
            let tmp = scratch.join(format!("web-font-{}-{}.part", safe(id), safe(&face.style)));
            fs::write(&tmp, &body)?;
            let checked = font_kind(&tmp);
            let ext = match checked {
                Ok(ext) => ext,
                Err(e) => {
                    let _ = fs::remove_file(&tmp);
                    return Err(e);
                }
            };
            files.push((face, tmp, ext, body));
        }
        let licence_file = dir.join(format!("FormPortal-{}-LICENCE.txt", safe(&detail.family)));
        let text = match (source, detail.licence_text_id.as_deref()) {
            (_, Some(fs_id)) => web_get(&format!("{FONTSOURCE_NPM}{fs_id}@latest/LICENSE"), META_CAP, "Fontsource").ok().and_then(|b| String::from_utf8(b).ok()),
            _ => None,
        };
        let notice = format!(
            "{}\nLicence: {}\n{}{}\nFrom {service}, installed by FormPortal.\n\n{}",
            detail.family,
            detail.licence.clone().unwrap_or_default(),
            detail.licence_url.as_deref().map(|u| format!("{u}\n")).unwrap_or_default(),
            detail.credit.clone().unwrap_or_default(),
            text.unwrap_or_default()
        );
        fs::write(&licence_file, notice)?;
        let mut state = self.font_state()?;
        let mut done = Vec::new();
        let mut registered = Vec::new();
        for (face, tmp, ext, body) in files {
            let target = dir.join(format!("FormPortal-{}-{}.{ext}", safe(&detail.family), safe(&face.style)));
            fs::copy(&tmp, &target)?;
            let _ = fs::remove_file(&tmp);
            let sha256 = {
                use sha2::{Digest, Sha256};
                Sha256::digest(&body).iter().map(|b| format!("{b:02x}")).collect::<String>()
            };
            let registry_name = cfg!(target_os = "windows").then(|| format!("{} {} ({})", detail.family, face.style, if ext == "otf" { "OpenType" } else { "TrueType" }));
            if let Some(name) = &registry_name {
                registered.push((name.clone(), target.clone()));
            }
            state.fonts.retain(|f| f.file != target);
            let record = InstalledFont { family: detail.family.clone(), style: face.style.clone(), family_id: Some(format!("{source}:{}", detail.id)), file: target, sha256, source: kind.clone(), licence: detail.licence.clone(), registry_name, licence_file: Some(licence_file.clone()) };
            state.fonts.push(record.clone());
            done.push(record);
        }
        self.font_save(&state)?;
        after_change(&registered, &[]);
        Ok(done)
    }
}

pub const GOOGLE_FONTS_KEY: &str = "google-fonts";
const FONTSOURCE_API: &str = "https://api.fontsource.org/v1/fonts";
const FONTSOURCE_NPM: &str = "https://cdn.jsdelivr.net/npm/@fontsource/";
const GOOGLE_API: &str = "https://www.googleapis.com/webfonts/v1/webfonts?";
const WEB_ALLOWED: [&str; 5] = [FONTSOURCE_API, "https://cdn.jsdelivr.net/fontsource/fonts/", FONTSOURCE_NPM, GOOGLE_API, "https://fonts.gstatic.com/s/"];
const LIST_CAP: u64 = 24 * 1024 * 1024;
const META_CAP: u64 = 256 * 1024;
const FACE_CAP: u64 = 16 * 1024 * 1024;
const PREVIEW_CAP: u64 = 4 * 1024 * 1024;
const WEB_FRESH: std::time::Duration = std::time::Duration::from_secs(30 * 60);

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct WebFamily {
    pub id: String,
    pub family: String,
    pub category: String,
    pub subsets: Vec<String>,
    pub weights: Vec<u16>,
    pub italic: bool,
    pub variable: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct WebFace {
    pub weight: u16,
    pub italic: bool,
    pub style: String,
    #[serde(skip)]
    url: String,
    #[serde(skip)]
    preview: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct WebCatalogue {
    pub source: String,
    pub on: bool,
    pub families: Vec<WebFamily>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct WebFamilyDetail {
    pub source: String,
    pub id: String,
    pub family: String,
    pub category: String,
    pub licence: Option<String>,
    pub licence_url: Option<String>,
    pub credit: Option<String>,
    pub subset: Option<String>,
    pub faces: Vec<WebFace>,
    pub installable: bool,
    #[serde(skip)]
    licence_text_id: Option<String>,
}

#[derive(Clone)]
struct WebCache {
    at: std::time::Instant,
    key: String,
    families: Vec<WebFamily>,
    faces: std::collections::HashMap<String, Vec<WebFace>>,
}

fn web_cache() -> &'static std::sync::Mutex<std::collections::HashMap<String, WebCache>> {
    static CACHE: std::sync::OnceLock<std::sync::Mutex<std::collections::HashMap<String, WebCache>>> = std::sync::OnceLock::new();
    CACHE.get_or_init(Default::default)
}

fn service_name(source: &str) -> &'static str {
    if source == "google" {
        "Google Fonts"
    } else {
        "Fontsource"
    }
}

fn web_get(url: &str, cap: u64, service: &str) -> Result<Vec<u8>> {
    use std::io::Read;
    if !WEB_ALLOWED.iter().any(|p| url.starts_with(p)) || url.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return Err(CoreError::Refused(format!("FormPortal asks {service} only at its documented addresses")));
    }
    let response = crate::download::agent().get(url).call().map_err(|e| match e {
        ureq::Error::Status(code, _) => CoreError::Http(format!("{service} answered {code}")),
        ureq::Error::Transport(t) => CoreError::Http(format!("{service} could not be reached ({})", t.kind())),
    })?;
    let mut body = Vec::new();
    response.into_reader().take(cap + 1).read_to_end(&mut body)?;
    if body.len() as u64 > cap {
        return Err(CoreError::Invalid(format!("{service} sent more than FormPortal accepts for one file ({} KB)", cap / 1024)));
    }
    Ok(body)
}

fn web_json(url: &str, cap: u64, service: &str) -> Result<serde_json::Value> {
    serde_json::from_slice(&web_get(url, cap, service)?).map_err(|_| CoreError::Invalid(format!("{service} sent an answer FormPortal could not read")))
}

fn slug(family: &str) -> String {
    family.to_lowercase().chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '-' }).collect::<String>().split('-').filter(|s| !s.is_empty()).collect::<Vec<_>>().join("-")
}

fn web_id(id: &str) -> Result<&str> {
    if id.is_empty() || id.len() > 96 || !id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') {
        return Err(CoreError::Invalid(format!("{id:?} is not a font family id")));
    }
    Ok(id)
}

fn encode(value: &str) -> String {
    value.bytes().map(|b| if b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~') { (b as char).to_string() } else { format!("%{b:02X}") }).collect()
}

fn strs(value: &serde_json::Value) -> Vec<String> {
    value.as_array().map(|a| a.iter().filter_map(|v| v.as_str().map(str::to_string)).collect()).unwrap_or_default()
}

fn text_of(value: &serde_json::Value, field: &str) -> String {
    value.get(field).and_then(|v| v.as_str()).unwrap_or_default().to_string()
}

fn face_style(weight: u16, italic: bool) -> String {
    format!("{weight}{}", if italic { " Italic" } else { "" })
}

fn fontsource_list() -> Result<Vec<WebFamily>> {
    let body = web_json(FONTSOURCE_API, LIST_CAP, "Fontsource")?;
    let items = body.as_array().ok_or_else(|| CoreError::Invalid("Fontsource sent an answer FormPortal could not read".to_string()))?;
    Ok(items
        .iter()
        .filter(|f| text_of(f, "type") != "icons")
        .filter_map(|f| {
            let id = text_of(f, "id");
            web_id(&id).ok()?;
            let weights = f.get("weights").and_then(|w| w.as_array()).map(|a| a.iter().filter_map(|v| v.as_u64()).map(|v| v as u16).collect()).unwrap_or_default();
            Some(WebFamily { family: text_of(f, "family"), category: text_of(f, "category"), subsets: strs(&f["subsets"]), weights, italic: strs(&f["styles"]).iter().any(|s| s == "italic"), variable: f.get("variable").and_then(|v| v.as_bool()).unwrap_or(false), id })
        })
        .collect())
}

fn google_list(key: &str) -> Result<(Vec<WebFamily>, std::collections::HashMap<String, Vec<WebFace>>)> {
    let body = web_json(&format!("{GOOGLE_API}key={}&sort=popularity", encode(key)), LIST_CAP, "Google Fonts")?;
    let items = body.get("items").and_then(|i| i.as_array()).ok_or_else(|| CoreError::Invalid("Google Fonts sent an answer FormPortal could not read".to_string()))?;
    let mut families = Vec::new();
    let mut faces = std::collections::HashMap::new();
    for item in items {
        let family = text_of(item, "family");
        let id = slug(&family);
        if web_id(&id).is_err() {
            continue;
        }
        let mut list = Vec::new();
        for variant in strs(&item["variants"]) {
            let italic = variant.ends_with("italic");
            let weight = match variant.trim_end_matches("italic") {
                "" | "regular" => 400,
                w => match w.parse::<u16>() {
                    Ok(w) => w,
                    Err(_) => continue,
                },
            };
            let Some(url) = item.get("files").and_then(|f| f.get(&variant)).and_then(|u| u.as_str()) else { continue };
            let url = url.strip_prefix("http://").map(|rest| format!("https://{rest}")).unwrap_or_else(|| url.to_string());
            list.push(WebFace { weight, italic, style: face_style(weight, italic), preview: url.clone(), url });
        }
        let mut weights: Vec<u16> = list.iter().map(|f| f.weight).collect();
        weights.sort_unstable();
        weights.dedup();
        families.push(WebFamily { id: id.clone(), family, category: text_of(item, "category"), subsets: strs(&item["subsets"]), italic: list.iter().any(|f| f.italic), variable: item.get("axes").is_some(), weights });
        faces.insert(id, list);
    }
    Ok((families, faces))
}

fn fingerprint(key: &str) -> String {
    use sha2::{Digest, Sha256};
    Sha256::digest(key.as_bytes()).iter().map(|b| format!("{b:02x}")).collect()
}

fn cached(source: &str) -> Result<Option<WebCache>> {
    let key = match source {
        "fontsource" => String::new(),
        "google" => match crate::keys::get(GOOGLE_FONTS_KEY) {
            Some(key) => key,
            None => return Ok(None),
        },
        other => return Err(CoreError::Invalid(format!("{other:?} is not a font source FormPortal knows"))),
    };
    let print = fingerprint(&key);
    if let Some(hit) = web_cache().lock().ok().and_then(|c| c.get(source).cloned()) {
        if hit.key == print && hit.at.elapsed() < WEB_FRESH {
            return Ok(Some(hit));
        }
    }
    let (families, faces) = if source == "google" { google_list(&key)? } else { (fontsource_list()?, Default::default()) };
    let entry = WebCache { at: std::time::Instant::now(), key: print, families, faces };
    if let Ok(mut c) = web_cache().lock() {
        c.insert(source.to_string(), entry.clone());
    }
    Ok(Some(entry))
}

pub fn web_catalogue(source: &str) -> Result<WebCatalogue> {
    Ok(match cached(source)? {
        Some(c) => WebCatalogue { source: source.to_string(), on: true, families: c.families },
        None => WebCatalogue { source: source.to_string(), on: false, families: Vec::new() },
    })
}

fn fontsource_licence(id: &str) -> (Option<String>, Option<String>, Option<String>) {
    let Ok(meta) = web_json(&format!("{FONTSOURCE_NPM}{id}@latest/metadata.json"), META_CAP, "Fontsource") else { return (None, None, None) };
    match meta.get("license") {
        Some(serde_json::Value::String(kind)) => (Some(kind.clone()).filter(|k| !k.is_empty()), None, None),
        Some(l) => (Some(text_of(l, "type")).filter(|k| !k.is_empty()), Some(text_of(l, "url")).filter(|u| !u.is_empty()), Some(text_of(l, "attribution")).filter(|a| !a.is_empty())),
        None => (None, None, None),
    }
}

pub fn web_family(source: &str, id: &str) -> Result<WebFamilyDetail> {
    static DETAILS: std::sync::OnceLock<std::sync::Mutex<std::collections::HashMap<String, (std::time::Instant, WebFamilyDetail)>>> = std::sync::OnceLock::new();
    let details = DETAILS.get_or_init(Default::default);
    let slot = format!("{source}:{id}");
    if let Some((at, hit)) = details.lock().ok().and_then(|d| d.get(&slot).cloned()) {
        if at.elapsed() < WEB_FRESH && (source != "google" || crate::keys::present(GOOGLE_FONTS_KEY)) {
            return Ok(hit);
        }
    }
    let fresh = web_family_fresh(source, id)?;
    if let Ok(mut d) = details.lock() {
        d.insert(slot, (std::time::Instant::now(), fresh.clone()));
    }
    Ok(fresh)
}

fn web_family_fresh(source: &str, id: &str) -> Result<WebFamilyDetail> {
    let id = web_id(id)?;
    let cache = cached(source)?.ok_or_else(|| CoreError::Refused("Google Fonts is off until you give FormPortal your Google Fonts API key".to_string()))?;
    let family = cache.families.iter().find(|f| f.id == id).cloned().ok_or_else(|| CoreError::Invalid(format!("{id} is not in {}'s catalogue", service_name(source))))?;
    let (faces, subset) = if source == "google" {
        (cache.faces.get(id).cloned().unwrap_or_default(), None)
    } else {
        let body = web_json(&format!("{FONTSOURCE_API}/{id}"), META_CAP * 8, "Fontsource")?;
        let subset = Some(text_of(&body, "defSubset")).filter(|s| !s.is_empty()).or_else(|| family.subsets.first().cloned()).unwrap_or_else(|| "latin".to_string());
        let mut faces = Vec::new();
        if let Some(weights) = body.get("variants").and_then(|v| v.as_object()) {
            for (weight, styles) in weights {
                let Ok(weight) = weight.parse::<u16>() else { continue };
                for (style, subsets) in styles.as_object().into_iter().flatten() {
                    let Some(url) = subsets.get(&subset).and_then(|s| s.get("url")) else { continue };
                    let (ttf, woff2) = (text_of(url, "ttf"), text_of(url, "woff2"));
                    if ttf.is_empty() {
                        continue;
                    }
                    let italic = style == "italic";
                    faces.push(WebFace { weight, italic, style: face_style(weight, italic), preview: if woff2.is_empty() { ttf.clone() } else { woff2 }, url: ttf });
                }
            }
        }
        faces.sort_by_key(|f| (f.weight, f.italic));
        (faces, Some(subset))
    };
    let (licence, licence_url, credit) = fontsource_licence(id);
    let installable = licence.as_deref().is_some_and(|l| OPEN_LICENCES.contains(&l)) && !faces.is_empty();
    Ok(WebFamilyDetail { source: source.to_string(), id: id.to_string(), family: family.family, category: family.category, licence_text_id: licence.as_ref().map(|_| id.to_string()), licence, licence_url, credit, subset, faces, installable })
}

pub fn web_preview(source: &str, id: &str, weight: u16, italic: bool) -> Result<String> {
    use base64::Engine;
    let detail = web_family(source, id)?;
    let face = detail.faces.iter().find(|f| f.weight == weight && f.italic == italic).or_else(|| detail.faces.iter().find(|f| !f.italic)).or_else(|| detail.faces.first()).ok_or_else(|| CoreError::Invalid(format!("{} has no face to preview", detail.family)))?;
    let body = web_get(&face.preview, PREVIEW_CAP, service_name(source))?;
    match body.get(..4) {
        Some([0, 1, 0, 0]) | Some(b"true") | Some(b"OTTO") | Some(b"wOFF") | Some(b"wOF2") => Ok(base64::engine::general_purpose::STANDARD.encode(body)),
        _ => Err(CoreError::Invalid(format!("{} did not send a font file", service_name(source)))),
    }
}
