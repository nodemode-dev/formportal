use std::collections::{HashMap, VecDeque};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use serde::Serialize;
use serde_json::Value;

use crate::download::{check_url, sha256_file};
use crate::error::{CoreError, Result};
use crate::keys;
use crate::links;
use crate::media::{self, library_dir, Saved};

const ANSWER_LIMIT: u64 = 4 * 1024 * 1024;
const THUMB_LIMIT: u64 = 3 * 1024 * 1024;
const VIEW_LIMIT: u64 = 64 * 1024 * 1024;
const FILE_LIMIT: u64 = 2 * 1024 * 1024 * 1024;
const CACHE_FOR: Duration = Duration::from_secs(24 * 3600);
const CACHE_ENTRIES: usize = 240;
const HELD_LIMIT: usize = 5000;
const QUERY_LIMIT: usize = 100;
const PAGE_LIMIT: u32 = 40;
const CHUNK: usize = 64 * 1024;

struct Source {
    id: &'static str,
    name: &'static str,
    kinds: &'static [&'static str],
    provider: Option<&'static str>,
    key_page: Option<&'static str>,
    home: &'static str,
    per_page: u32,
    window: (usize, u64),
}

const SOURCES: [Source; 5] = [
    Source { id: "pexels", name: "Pexels", kinds: &["image", "video"], provider: Some("pexels"), key_page: Some("https://www.pexels.com/api/"), home: "https://www.pexels.com/", per_page: 24, window: (200, 3600) },
    Source { id: "pixabay", name: "Pixabay", kinds: &["image", "video"], provider: Some("pixabay"), key_page: Some("https://pixabay.com/api/docs/"), home: "https://pixabay.com/", per_page: 24, window: (100, 60) },
    Source { id: "openverse", name: "Openverse", kinds: &["image", "audio"], provider: None, key_page: None, home: "https://openverse.org/", per_page: 20, window: (60, 3600) },
    Source { id: "freesound", name: "Freesound", kinds: &["audio"], provider: Some("freesound"), key_page: Some("https://freesound.org/apiv2/apply/"), home: "https://freesound.org/", per_page: 24, window: (60, 60) },
    Source { id: "ccmixter", name: "ccMixter", kinds: &["audio"], provider: None, key_page: None, home: "https://ccmixter.org/", per_page: 24, window: (60, 60) },
];

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SourceInfo {
    pub id: String,
    pub name: String,
    pub kinds: Vec<String>,
    pub needs_key: bool,
    pub key_page: Option<String>,
    pub home: String,
    pub on: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct StockItem {
    pub id: String,
    pub source: String,
    pub source_name: String,
    pub kind: String,
    pub title: String,
    pub author: String,
    pub author_url: Option<String>,
    pub page_url: String,
    pub licence: String,
    pub licence_url: Option<String>,
    pub nc: bool,
    pub nd: bool,
    pub width: Option<u64>,
    pub height: Option<u64>,
    pub seconds: Option<f64>,
    pub thumb: bool,
    pub credit: String,
    pub file_note: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct StockPage {
    pub source: String,
    pub kind: String,
    pub query: String,
    pub page: u32,
    pub more: bool,
    pub items: Vec<StockItem>,
}

#[derive(Clone)]
struct Held {
    item: StockItem,
    origin: Option<String>,
    thumb: Option<String>,
    view: Option<String>,
    file: Option<String>,
    ext: String,
}

fn source(id: &str) -> Result<&'static Source> {
    SOURCES.iter().find(|s| s.id == id).ok_or_else(|| CoreError::Invalid(format!("{id} is not a stock source FormPortal searches")))
}

pub fn sources() -> Vec<SourceInfo> {
    SOURCES
        .iter()
        .map(|s| SourceInfo {
            id: s.id.to_string(),
            name: s.name.to_string(),
            kinds: s.kinds.iter().map(|k| k.to_string()).collect(),
            needs_key: s.provider.is_some(),
            key_page: s.key_page.map(str::to_string),
            home: s.home.to_string(),
            on: s.provider.is_none_or(keys::present),
        })
        .collect()
}

fn held() -> &'static Mutex<HashMap<String, Held>> {
    static HELD: OnceLock<Mutex<HashMap<String, Held>>> = OnceLock::new();
    HELD.get_or_init(|| Mutex::new(HashMap::new()))
}

fn cache() -> &'static Mutex<HashMap<String, (Instant, Vec<Held>, bool)>> {
    static CACHE: OnceLock<Mutex<HashMap<String, (Instant, Vec<Held>, bool)>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn turns() -> &'static Mutex<HashMap<&'static str, VecDeque<Instant>>> {
    static TURNS: OnceLock<Mutex<HashMap<&'static str, VecDeque<Instant>>>> = OnceLock::new();
    TURNS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn take_turn(s: &Source) -> Result<()> {
    let (most, secs) = s.window;
    let span = Duration::from_secs(secs);
    let mut all = turns().lock().unwrap_or_else(|e| e.into_inner());
    let list = all.entry(s.id).or_default();
    let now = Instant::now();
    while list.front().is_some_and(|t| now.duration_since(*t) >= span) {
        list.pop_front();
    }
    if list.len() >= most {
        let wait = list.front().map(|t| span.saturating_sub(now.duration_since(*t)).as_secs() + 1).unwrap_or(secs);
        return Err(CoreError::Unavailable(format!("{} allows {most} searches every {}; FormPortal waits {wait} seconds before asking it again", s.name, if secs >= 3600 { "hour".to_string() } else { format!("{secs} seconds") })));
    }
    list.push_back(now);
    Ok(())
}

fn api_agent() -> &'static ureq::Agent {
    static AGENT: OnceLock<ureq::Agent> = OnceLock::new();
    AGENT.get_or_init(|| ureq::AgentBuilder::new().timeout_connect(Duration::from_secs(6)).timeout_read(Duration::from_secs(15)).timeout(Duration::from_secs(25)).redirects(2).user_agent("FormPortal").build())
}

fn file_agent() -> &'static ureq::Agent {
    static AGENT: OnceLock<ureq::Agent> = OnceLock::new();
    AGENT.get_or_init(|| ureq::AgentBuilder::new().timeout_connect(Duration::from_secs(8)).timeout_read(Duration::from_secs(30)).redirects(5).user_agent("FormPortal").build())
}

fn refused(name: &str, e: ureq::Error) -> CoreError {
    match e {
        ureq::Error::Status(401 | 403, _) => CoreError::Refused(format!("{name} did not accept the key kept for it; check the key on {name}'s site and save it again")),
        ureq::Error::Status(429, _) => CoreError::Unavailable(format!("{name} asks FormPortal to wait before the next search; try again in a minute")),
        ureq::Error::Status(code, _) => CoreError::Http(format!("{name} answered {code}")),
        ureq::Error::Transport(t) => CoreError::Http(format!("{name} could not be reached ({t})")),
    }
}

fn capped(response: ureq::Response, cap: u64, what: &str) -> Result<Vec<u8>> {
    let mut body = Vec::new();
    response.into_reader().take(cap + 1).read_to_end(&mut body)?;
    if body.len() as u64 > cap {
        return Err(CoreError::Invalid(format!("{what} is larger than {} MB, so FormPortal did not take it", cap / (1024 * 1024))));
    }
    Ok(body)
}

fn text(v: &Value, key: &str) -> Option<String> {
    v.get(key).and_then(Value::as_str).map(str::trim).filter(|s| !s.is_empty()).map(str::to_string)
}

fn number(v: &Value, key: &str) -> Option<u64> {
    v.get(key).and_then(|n| n.as_u64().or_else(|| n.as_f64().map(|f| f.max(0.0) as u64)))
}

fn https(url: Option<String>) -> Option<String> {
    url.map(|u| match u.strip_prefix("http://") {
        Some(rest) => format!("https://{rest}"),
        None => u,
    })
    .filter(|u| u.starts_with("https://"))
}

fn openable(url: Option<String>) -> Option<String> {
    https(url).filter(|u| links::may_open(u))
}

fn ext_of(url: &str, fallback: &str) -> String {
    let path = url.split(['?', '#']).next().unwrap_or_default();
    let name = path.rsplit('/').next().unwrap_or_default();
    match name.rsplit_once('.') {
        Some((_, e)) if (1..=5).contains(&e.len()) && e.chars().all(|c| c.is_ascii_alphanumeric()) => e.to_ascii_lowercase(),
        _ => fallback.to_string(),
    }
}

fn title_from_slug(url: &str, fallback: &str) -> String {
    let slug = url.trim_end_matches('/').rsplit('/').next().unwrap_or_default();
    let words: Vec<&str> = slug.split('-').filter(|w| !w.is_empty() && !w.chars().all(|c| c.is_ascii_digit())).collect();
    if words.is_empty() {
        return fallback.to_string();
    }
    let joined = words.join(" ");
    let mut chars = joined.chars();
    chars.next().map(|c| c.to_uppercase().collect::<String>() + chars.as_str()).unwrap_or_else(|| fallback.to_string())
}

fn cc_code(code: &str, version: Option<&str>) -> (String, bool, bool) {
    let code = code.trim().to_ascii_lowercase();
    let v = version.map(str::trim).filter(|v| !v.is_empty());
    let name = match code.as_str() {
        "cc0" | "zero" => "CC0 1.0".to_string(),
        "pdm" | "mark" => "Public Domain Mark 1.0".to_string(),
        "sampling+" => format!("Sampling+ {}", v.unwrap_or("1.0")),
        "nc-sampling+" => format!("NC Sampling+ {}", v.unwrap_or("1.0")),
        other => match v {
            Some(v) => format!("CC {} {v}", other.to_ascii_uppercase()),
            None => format!("CC {}", other.to_ascii_uppercase()),
        },
    };
    (name, code.contains("nc"), code.contains("nd"))
}

fn cc_from_url(url: &str) -> Option<(String, bool, bool)> {
    let at = url.find("creativecommons.org/")?;
    let parts: Vec<&str> = url[at..].split('/').filter(|p| !p.is_empty()).collect();
    match parts.as_slice() {
        [_, "publicdomain", kind, ..] => Some(cc_code(kind, None)),
        [_, "licenses", code, version, ..] => Some(cc_code(code, Some(version))),
        [_, "licenses", code] => Some(cc_code(code, None)),
        _ => None,
    }
}

fn credit_of(item: &StockItem) -> String {
    let what = match item.kind.as_str() {
        "video" => "Video",
        "audio" => "Sound",
        _ => "Photo",
    };
    match item.source.as_str() {
        "pexels" => format!("{what} by {} on Pexels, {}", item.author, item.page_url),
        "pixabay" => format!("{what} by {} from Pixabay, {}", item.author, item.page_url),
        _ => match &item.licence_url {
            Some(url) => format!("\"{}\" by {}, {} ({url}), via {}, {}", item.title, item.author, item.licence, item.source_name, item.page_url),
            None => format!("\"{}\" by {}, {}, via {}, {}", item.title, item.author, item.licence, item.source_name, item.page_url),
        },
    }
}

#[allow(clippy::too_many_arguments)]
fn held_item(s: &Source, kind: &str, id: String, title: String, author: Option<String>, author_url: Option<String>, page_url: String, licence: (String, bool, bool), licence_url: Option<String>, size: (Option<u64>, Option<u64>), seconds: Option<f64>, urls: (Option<String>, Option<String>, Option<String>), ext: String, file_note: &str) -> Held {
    let (thumb, view, file) = urls;
    let mut item = StockItem {
        id: format!("{}:{kind}:{id}", s.id),
        source: s.id.to_string(),
        source_name: s.name.to_string(),
        kind: kind.to_string(),
        title,
        author: author.unwrap_or_else(|| "an unnamed author".to_string()),
        author_url: openable(author_url),
        page_url,
        licence: licence.0,
        licence_url: https(licence_url),
        nc: licence.1,
        nd: licence.2,
        width: size.0,
        height: size.1,
        seconds,
        thumb: thumb.is_some(),
        credit: String::new(),
        file_note: file_note.to_string(),
    };
    item.credit = credit_of(&item);
    Held { item, origin: None, thumb: https(thumb), view: https(view), file: https(file), ext }
}

fn pexels(s: &Source, kind: &str, query: &str, page: u32, key: &str) -> Result<(Vec<Held>, bool)> {
    let url = if kind == "video" { "https://api.pexels.com/v1/videos/search" } else { "https://api.pexels.com/v1/search" };
    let response = api_agent().get(url).set("Authorization", key).query("query", query).query("page", &page.to_string()).query("per_page", &s.per_page.to_string()).call().map_err(|e| refused(s.name, e))?;
    let answer: Value = serde_json::from_slice(&capped(response, ANSWER_LIMIT, "Pexels' answer")?).map_err(|e| CoreError::Invalid(format!("Pexels' answer could not be read: {e}")))?;
    let more = text(&answer, "next_page").is_some();
    let licence = ("Pexels License".to_string(), false, false);
    let licence_url = Some("https://www.pexels.com/license/".to_string());
    let list = answer.get(if kind == "video" { "videos" } else { "photos" }).and_then(Value::as_array).cloned().unwrap_or_default();
    let items = list
        .iter()
        .filter_map(|v| {
            let id = number(v, "id")?;
            let page_url = https(text(v, "url"))?;
            let size = (number(v, "width"), number(v, "height"));
            if kind == "video" {
                let user = v.get("user").cloned().unwrap_or(Value::Null);
                let mut files: Vec<&Value> = v.get("video_files").and_then(Value::as_array).map(|f| f.iter().filter(|f| text(f, "file_type").as_deref() == Some("video/mp4") && text(f, "link").is_some()).collect()).unwrap_or_default();
                files.sort_by_key(|f| number(f, "width").unwrap_or(0));
                let view = files.iter().find(|f| number(f, "width").unwrap_or(0) >= 640).or(files.first()).and_then(|f| text(f, "link"));
                let best = files.last().and_then(|f| text(f, "link"));
                let note = files.last().and_then(|f| Some(format!("MP4, {} x {}", number(f, "width")?, number(f, "height")?))).unwrap_or_else(|| "MP4".to_string());
                Some(held_item(s, kind, id.to_string(), title_from_slug(&page_url, "Pexels video"), text(&user, "name"), text(&user, "url"), page_url, licence.clone(), licence_url.clone(), size, number(v, "duration").map(|d| d as f64), (text(v, "image"), view, best), "mp4".to_string(), &note))
            } else {
                let src = v.get("src").cloned().unwrap_or(Value::Null);
                let original = text(&src, "original");
                let ext = original.as_deref().map(|u| ext_of(u, "jpg")).unwrap_or_else(|| "jpg".to_string());
                let title = text(v, "alt").unwrap_or_else(|| title_from_slug(&page_url, "Pexels photo"));
                let note = match size {
                    (Some(w), Some(h)) => format!("Original, {w} x {h}"),
                    _ => "Original".to_string(),
                };
                Some(held_item(s, kind, id.to_string(), title, text(v, "photographer"), text(v, "photographer_url"), page_url, licence.clone(), licence_url.clone(), size, None, (text(&src, "medium"), text(&src, "large2x"), original), ext, &note))
            }
        })
        .collect();
    Ok((items, more))
}

fn pixabay(s: &Source, kind: &str, query: &str, page: u32, key: &str) -> Result<(Vec<Held>, bool)> {
    let url = if kind == "video" { "https://pixabay.com/api/videos/" } else { "https://pixabay.com/api/" };
    let response = api_agent().get(url).query("key", key).query("q", query).query("page", &page.to_string()).query("per_page", &s.per_page.to_string()).query("safesearch", "true").call().map_err(|e| refused(s.name, e))?;
    let answer: Value = serde_json::from_slice(&capped(response, ANSWER_LIMIT, "Pixabay's answer")?).map_err(|e| CoreError::Invalid(format!("Pixabay's answer could not be read: {e}")))?;
    let total = number(&answer, "totalHits").unwrap_or(0);
    let more = u64::from(page) * u64::from(s.per_page) < total;
    let licence = ("Pixabay Content License".to_string(), false, false);
    let licence_url = Some("https://pixabay.com/service/license-summary/".to_string());
    let list = answer.get("hits").and_then(Value::as_array).cloned().unwrap_or_default();
    let items = list
        .iter()
        .filter_map(|v| {
            let id = number(v, "id")?;
            let page_url = https(text(v, "pageURL"))?;
            let user = text(v, "user");
            let user_page = match (&user, number(v, "user_id")) {
                (Some(u), Some(n)) => Some(format!("https://pixabay.com/users/{u}-{n}/")),
                _ => None,
            };
            let tags = text(v, "tags").unwrap_or_default();
            let title = tags.split(',').map(str::trim).filter(|t| !t.is_empty()).take(3).collect::<Vec<_>>().join(", ");
            let title = if title.is_empty() { format!("Pixabay {id}") } else { title };
            if kind == "video" {
                let videos = v.get("videos").cloned().unwrap_or(Value::Null);
                let size = |name: &str| videos.get(name).filter(|f| text(f, "url").is_some()).cloned();
                let best = ["large", "medium", "small", "tiny"].iter().find_map(|n| size(n));
                let view = ["small", "tiny", "medium"].iter().find_map(|n| size(n));
                let thumb = ["medium", "small", "tiny", "large"].iter().find_map(|n| videos.get(*n).and_then(|f| text(f, "thumbnail")));
                let note = best.as_ref().and_then(|f| Some(format!("MP4, {} x {}", number(f, "width")?, number(f, "height")?))).unwrap_or_else(|| "MP4".to_string());
                let dims = best.as_ref().map(|f| (number(f, "width"), number(f, "height"))).unwrap_or((None, None));
                Some(held_item(s, kind, id.to_string(), title, user, user_page, page_url, licence.clone(), licence_url.clone(), dims, number(v, "duration").map(|d| d as f64), (thumb, view.as_ref().and_then(|f| text(f, "url")), best.as_ref().and_then(|f| text(f, "url"))), "mp4".to_string(), &note))
            } else {
                let large = text(v, "largeImageURL");
                let ext = large.as_deref().map(|u| ext_of(u, "jpg")).unwrap_or_else(|| "jpg".to_string());
                Some(held_item(s, kind, id.to_string(), title, user, user_page, page_url, licence.clone(), licence_url.clone(), (number(v, "imageWidth"), number(v, "imageHeight")), None, (text(v, "webformatURL"), large.clone(), large), ext, "Large, up to 1280 wide"))
            }
        })
        .collect();
    Ok((items, more))
}

fn openverse(s: &Source, kind: &str, query: &str, page: u32) -> Result<(Vec<Held>, bool)> {
    let url = if kind == "audio" { "https://api.openverse.org/v1/audio/" } else { "https://api.openverse.org/v1/images/" };
    let response = api_agent().get(url).query("q", query).query("page", &page.to_string()).query("page_size", &s.per_page.to_string()).call().map_err(|e| refused(s.name, e))?;
    let answer: Value = serde_json::from_slice(&capped(response, ANSWER_LIMIT, "Openverse's answer")?).map_err(|e| CoreError::Invalid(format!("Openverse's answer could not be read: {e}")))?;
    let more = u64::from(page) < number(&answer, "page_count").unwrap_or(0);
    let list = answer.get("results").and_then(Value::as_array).cloned().unwrap_or_default();
    let items = list
        .iter()
        .filter_map(|v| {
            let id = text(v, "id").filter(|id| id.chars().all(|c| c.is_ascii_hexdigit() || c == '-'))?;
            let file = https(text(v, "url"))?;
            let code = text(v, "license")?;
            let licence = cc_code(&code, text(v, "license_version").as_deref());
            let page_url = format!("https://openverse.org/{}/{id}", if kind == "audio" { "audio" } else { "image" });
            let fallback = text(v, "filetype").unwrap_or_else(|| if kind == "audio" { "mp3".to_string() } else { "jpg".to_string() });
            let ext = ext_of(&file, &fallback);
            let via = text(v, "source").or_else(|| text(v, "provider")).unwrap_or_default();
            let note = if via.is_empty() { "Original file".to_string() } else { format!("Original file, from {via}") };
            let mut h = held_item(s, kind, id, text(v, "title").unwrap_or_else(|| "Untitled".to_string()), text(v, "creator"), text(v, "creator_url"), page_url, licence, text(v, "license_url"), (number(v, "width"), number(v, "height")), number(v, "duration").map(|ms| ms as f64 / 1000.0), (text(v, "thumbnail"), Some(file.clone()), Some(file)), ext, &note);
            if let Some(attribution) = text(v, "attribution") {
                h.item.credit = format!("{attribution} Found through Openverse, {}", h.item.page_url);
            }
            h.origin = https(text(v, "foreign_landing_url"));
            Some(h)
        })
        .collect();
    Ok((items, more))
}

fn freesound(s: &Source, query: &str, page: u32, key: &str) -> Result<(Vec<Held>, bool)> {
    let response = api_agent()
        .get("https://freesound.org/apiv2/search/")
        .set("Authorization", &format!("Token {key}"))
        .query("query", query)
        .query("page", &page.to_string())
        .query("page_size", &s.per_page.to_string())
        .query("fields", "id,name,username,url,license,previews,images,duration")
        .call()
        .map_err(|e| refused(s.name, e))?;
    let answer: Value = serde_json::from_slice(&capped(response, ANSWER_LIMIT, "Freesound's answer")?).map_err(|e| CoreError::Invalid(format!("Freesound's answer could not be read: {e}")))?;
    let more = text(&answer, "next").is_some();
    let list = answer.get("results").and_then(Value::as_array).cloned().unwrap_or_default();
    let items = list
        .iter()
        .filter_map(|v| {
            let id = number(v, "id")?;
            let page_url = https(text(v, "url"))?;
            let licence_raw = text(v, "license").unwrap_or_default();
            let licence = cc_from_url(&licence_raw).unwrap_or_else(|| (licence_raw.clone(), licence_raw.to_ascii_lowercase().contains("noncommercial"), false));
            let licence_url = licence_raw.contains("creativecommons.org").then(|| licence_raw.clone());
            let user = text(v, "username");
            let user_page = user.as_ref().map(|u| format!("https://freesound.org/people/{u}/"));
            let previews = v.get("previews").cloned().unwrap_or(Value::Null);
            let mp3 = text(&previews, "preview-hq-mp3");
            let waveform = v.get("images").and_then(|i| text(i, "waveform_m"));
            Some(held_item(s, "audio", id.to_string(), text(v, "name").unwrap_or_else(|| format!("Sound {id}")), user, user_page, page_url, licence, licence_url, (None, None), v.get("duration").and_then(Value::as_f64), (waveform, mp3.clone(), mp3), "mp3".to_string(), "MP3 preview, about 128 kbps (the original file needs a Freesound sign-in)"))
        })
        .collect();
    Ok((items, more))
}

fn seconds_of(ps: &str) -> Option<f64> {
    let mut total = 0.0;
    for part in ps.trim().split(':') {
        total = total * 60.0 + part.trim().parse::<f64>().ok()?;
    }
    Some(total)
}

fn ccmixter(s: &Source, query: &str, page: u32) -> Result<(Vec<Held>, bool)> {
    let offset = (page - 1) * s.per_page;
    let response = api_agent().get("https://ccmixter.org/api/query").query("f", "json").query("search", query).query("limit", &s.per_page.to_string()).query("offset", &offset.to_string()).call().map_err(|e| refused(s.name, e))?;
    let answer: Value = serde_json::from_slice(&capped(response, ANSWER_LIMIT, "ccMixter's answer")?).map_err(|e| CoreError::Invalid(format!("ccMixter's answer could not be read: {e}")))?;
    let list = answer.as_array().cloned().unwrap_or_default();
    let more = list.len() as u32 >= s.per_page;
    let items = list
        .iter()
        .filter_map(|v| {
            let id = number(v, "upload_id")?;
            let page_url = https(text(v, "file_page_url")).unwrap_or_else(|| format!("https://ccmixter.org/files/{}/{id}", text(v, "user_name").unwrap_or_default()));
            let files = v.get("files").and_then(Value::as_array).cloned().unwrap_or_default();
            let audio = |f: &&Value| f.get("file_format_info").and_then(|i| text(i, "mime_type")).is_some_and(|m| m.starts_with("audio/"));
            let file = files.iter().filter(audio).find(|f| f.get("file_format_info").and_then(|i| text(i, "mime_type")).as_deref() == Some("audio/mpeg")).or_else(|| files.iter().find(audio))?;
            let url = https(text(file, "download_url"))?;
            let info = file.get("file_format_info").cloned().unwrap_or(Value::Null);
            let ext = text(&info, "default-ext").unwrap_or_else(|| ext_of(&url, "mp3"));
            let licence_url = text(v, "license_url");
            let licence = licence_url.as_deref().and_then(cc_from_url).unwrap_or_else(|| (text(v, "license_name").unwrap_or_else(|| "see the item's page".to_string()), false, false));
            let author = text(v, "user_real_name").or_else(|| text(v, "user_name"));
            let note = format!("{}, as the artist uploaded it", ext.to_ascii_uppercase());
            Some(held_item(s, "audio", id.to_string(), text(v, "upload_name").unwrap_or_else(|| format!("Track {id}")), author, text(v, "artist_page_url"), page_url, licence, licence_url, (None, None), text(&info, "ps").as_deref().and_then(seconds_of), (None, Some(url.clone()), Some(url)), ext, &note))
        })
        .collect();
    Ok((items, more))
}

pub fn search(source_id: &str, kind: &str, query: &str, page: u32) -> Result<StockPage> {
    let s = source(source_id)?;
    if !s.kinds.contains(&kind) {
        return Err(CoreError::Invalid(format!("{} offers no {kind} through its API", s.name)));
    }
    let query = query.trim();
    if query.is_empty() {
        return Err(CoreError::Invalid("type what to look for first".to_string()));
    }
    if query.chars().count() > QUERY_LIMIT {
        return Err(CoreError::Invalid(format!("a search is at most {QUERY_LIMIT} characters")));
    }
    let page = page.clamp(1, PAGE_LIMIT);
    let key = match s.provider {
        Some(p) => Some(keys::get(p).ok_or_else(|| CoreError::Refused(format!("{} needs your own API key; add it under Your sources", s.name)))?),
        None => None,
    };
    let slot = format!("{}|{kind}|{}|{page}", s.id, query.to_lowercase());
    let kept = {
        let mut c = cache().lock().unwrap_or_else(|e| e.into_inner());
        c.retain(|_, (at, _, _)| at.elapsed() < CACHE_FOR);
        c.get(&slot).map(|(_, list, more)| (list.clone(), *more))
    };
    let (list, more) = match kept {
        Some(hit) => hit,
        None => {
            take_turn(s)?;
            let key = key.as_deref().unwrap_or_default();
            let got = match s.id {
                "pexels" => pexels(s, kind, query, page, key)?,
                "pixabay" => pixabay(s, kind, query, page, key)?,
                "openverse" => openverse(s, kind, query, page)?,
                "freesound" => freesound(s, query, page, key)?,
                _ => ccmixter(s, query, page)?,
            };
            let mut c = cache().lock().unwrap_or_else(|e| e.into_inner());
            if c.len() >= CACHE_ENTRIES {
                if let Some(oldest) = c.iter().min_by_key(|(_, (at, _, _))| *at).map(|(k, _)| k.clone()) {
                    c.remove(&oldest);
                }
            }
            c.insert(slot, (Instant::now(), got.0.clone(), got.1));
            got
        }
    };
    let mut h = held().lock().unwrap_or_else(|e| e.into_inner());
    if h.len() > HELD_LIMIT {
        h.clear();
    }
    for item in &list {
        h.insert(item.item.id.clone(), item.clone());
    }
    Ok(StockPage { source: s.id.to_string(), kind: kind.to_string(), query: query.to_string(), page, more, items: list.into_iter().map(|h| h.item).collect() })
}

fn held_of(id: &str) -> Result<Held> {
    held().lock().unwrap_or_else(|e| e.into_inner()).get(id).cloned().ok_or_else(|| CoreError::Invalid("that result is no longer at hand; search again".to_string()))
}

fn sniff(bytes: &[u8], declared: Option<&str>, kind: &str, ext: &str) -> String {
    match bytes.get(..12) {
        Some([0x89, b'P', b'N', b'G', ..]) => return "image/png".to_string(),
        Some([0xFF, 0xD8, 0xFF, ..]) => return "image/jpeg".to_string(),
        Some([b'R', b'I', b'F', b'F', _, _, _, _, b'W', b'E', b'B', b'P']) => return "image/webp".to_string(),
        Some([b'G', b'I', b'F', b'8', ..]) => return "image/gif".to_string(),
        _ => {}
    }
    if let Some(d) = declared.map(|d| d.split(';').next().unwrap_or_default().trim().to_ascii_lowercase()) {
        if d.starts_with("audio/") || d.starts_with("video/") {
            return d;
        }
    }
    match (kind, ext) {
        ("video", "webm") => "video/webm",
        ("video", _) => "video/mp4",
        (_, "ogg" | "oga") => "audio/ogg",
        (_, "wav") => "audio/wav",
        (_, "flac") => "audio/flac",
        _ => "audio/mpeg",
    }
    .to_string()
}

pub fn preview(id: &str, which: &str) -> Result<(String, Vec<u8>)> {
    let h = held_of(id)?;
    let (url, cap) = match which {
        "thumb" => (h.thumb.clone(), THUMB_LIMIT),
        _ => (h.view.clone(), VIEW_LIMIT),
    };
    let url = url.ok_or_else(|| CoreError::Unavailable(format!("{} gives no preview for this item", h.item.source_name)))?;
    check_url(&url)?;
    let response = file_agent().get(&url).timeout(Duration::from_secs(90)).call().map_err(|e| refused(&h.item.source_name, e))?;
    let declared = response.header("content-type").map(str::to_string);
    let bytes = capped(response, cap, "the preview")?;
    let mime = sniff(&bytes, declared.as_deref(), if which == "thumb" { "image" } else { &h.item.kind }, &h.ext);
    if which == "thumb" && !mime.starts_with("image/") {
        return Err(CoreError::Invalid("the preview is not an image".to_string()));
    }
    Ok((mime, bytes))
}

pub fn preview_data_url(id: &str, which: &str) -> Result<String> {
    use base64::Engine;
    let (mime, bytes) = preview(id, which)?;
    Ok(format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes)))
}

fn safe_name(text: &str) -> String {
    let cleaned: String = text.chars().take(60).map(|c| if c.is_ascii_alphanumeric() || matches!(c, '-' | '_') { c } else { '-' }).collect();
    let mut out = String::new();
    for c in cleaned.chars() {
        if !(c == '-' && out.ends_with('-')) {
            out.push(c);
        }
    }
    out.trim_matches('-').to_string()
}

fn credit_text(h: &Held) -> String {
    let i = &h.item;
    let mut lines = vec![format!("Title: {}", i.title), format!("Author: {}", i.author)];
    if let Some(u) = &i.author_url {
        lines.push(format!("Author page: {u}"));
    }
    lines.push(format!("Source: {}", i.source_name));
    lines.push(format!("Page: {}", i.page_url));
    if let Some(o) = &h.origin {
        lines.push(format!("Original page: {o}"));
    }
    lines.push(format!("Licence: {}", i.licence));
    if let Some(u) = &i.licence_url {
        lines.push(format!("Licence text: {u}"));
    }
    if i.nc {
        lines.push("Limit: non-commercial use only (NC)".to_string());
    }
    if i.nd {
        lines.push("Limit: no changed versions may be shared (ND)".to_string());
    }
    lines.push(format!("File: {}", i.file_note));
    lines.push(format!("Credit: {}", i.credit));
    lines.join("\n") + "\n"
}

pub fn save(id: &str, progress: &mut dyn FnMut(u64, u64)) -> Result<Saved> {
    let h = held_of(id)?;
    let url = h.file.clone().ok_or_else(|| CoreError::Unavailable(format!("{} offers no file to download for this item", h.item.source_name)))?;
    check_url(&url)?;
    let lib = library_dir();
    let dir = lib.join(&h.item.kind);
    fs::create_dir_all(&dir)?;
    let short = id.rsplit(':').next().unwrap_or_default().chars().filter(|c| c.is_ascii_alphanumeric()).take(12).collect::<String>();
    let stem = format!("{}-{}-{short}", safe_name(&h.item.title), h.item.source);
    let stem = stem.trim_start_matches('-').to_string();
    let ext = safe_name(&h.ext);
    let ext = if ext.is_empty() { "bin".to_string() } else { ext };
    let target = dir.join(format!("{stem}.{ext}"));
    let part = dir.join(format!(".{stem}.{ext}.part"));
    let response = file_agent().get(&url).call().map_err(|e| refused(&h.item.source_name, e))?;
    let total = response.header("content-length").and_then(|n| n.parse::<u64>().ok()).unwrap_or(0);
    if total > FILE_LIMIT {
        return Err(CoreError::Invalid("the file is larger than 2 GB, so FormPortal did not save it".to_string()));
    }
    let mut reader = response.into_reader().take(FILE_LIMIT + 1);
    let mut out = File::create(&part)?;
    let mut have = 0u64;
    let mut buf = vec![0u8; CHUNK];
    progress(0, total);
    loop {
        let n = match reader.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => n,
            Err(e) => {
                drop(out);
                let _ = fs::remove_file(&part);
                return Err(CoreError::Http(format!("{} stopped sending the file ({e})", h.item.source_name)));
            }
        };
        out.write_all(&buf[..n])?;
        have += n as u64;
        if have > FILE_LIMIT {
            drop(out);
            let _ = fs::remove_file(&part);
            return Err(CoreError::Invalid("the file is larger than 2 GB, so FormPortal did not save it".to_string()));
        }
        progress(have, total.max(have));
    }
    out.flush()?;
    drop(out);
    fs::rename(&part, &target)?;
    fs::write(PathBuf::from(format!("{}.credit.txt", target.display())), credit_text(&h))?;
    let saved = Saved { id: h.item.id.clone(), title: h.item.title.clone(), kind: h.item.kind.clone(), creator: h.item.author.clone(), licence: h.item.licence.clone(), source_url: h.item.page_url.clone(), sha256: sha256_file(&target)?, file: target, credit: h.item.credit.clone() };
    media::remember_saved(&saved)?;
    Ok(saved)
}

pub fn show_in_folder(path: &Path) -> Result<()> {
    let lib = library_dir();
    if !path.starts_with(&lib) || !path.exists() {
        return Err(CoreError::Invalid("FormPortal shows only files it saved in your Library".to_string()));
    }
    #[cfg(target_os = "macos")]
    let spawned = std::process::Command::new("open").arg("-R").arg(path).spawn();
    #[cfg(target_os = "windows")]
    let spawned = std::process::Command::new("explorer").arg(format!("/select,{}", path.display())).spawn();
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let spawned = std::process::Command::new("xdg-open").arg(path.parent().unwrap_or(&lib)).spawn();
    spawned.map(|_| ()).map_err(|e| CoreError::Unavailable(format!("the folder could not be shown ({e})")))
}
