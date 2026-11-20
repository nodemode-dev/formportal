use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use serde::{Deserialize, Serialize};

use crate::error::{CoreError, Result};
use crate::portal::channel_name;
use crate::{Channel, Portal};

pub const APP_FILE: &str = "form-app.json";
pub const APP_FORMAT: &str = "form-app";
pub const APP_FORMAT_VERSION: u32 = 2;

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct AppFile {
    format: String,
    #[serde(default = "first_format_version")]
    format_version: u32,
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    version: Option<String>,
    #[serde(default)]
    agents: Option<AppAgents>,
}

fn first_format_version() -> u32 {
    1
}

#[derive(Debug, Clone, Deserialize)]
struct AppAgents {
    #[serde(default)]
    mcp: Option<AppMcp>,
    #[serde(default)]
    skills: Option<AppSkills>,
}

#[derive(Debug, Clone, Deserialize)]
struct AppMcp {
    #[serde(default)]
    available: Option<bool>,
    #[serde(default)]
    command: String,
    #[serde(default)]
    binary: String,
    #[serde(default)]
    args: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AppSkills {
    pub file: String,
    pub bytes: u64,
    pub sha256: String,
    #[serde(default)]
    pub root: String,
    #[serde(default)]
    pub skills: Vec<AppSkill>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AppSkill {
    pub folder: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub files: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AppManifest {
    pub file: PathBuf,
    pub format_version: u32,
    pub id: Option<String>,
    pub version: Option<String>,
    pub mcp: bool,
    pub skills: Option<AppSkills>,
}

pub(crate) fn parse_app(file: &Path, text: &str) -> Result<AppFile> {
    let app: AppFile = serde_json::from_str(text).map_err(|e| CoreError::Invalid(format!("{} is not valid ({e})", file.display())))?;
    if app.format != APP_FORMAT {
        return Err(CoreError::Invalid(format!("{} is not a Form app file (format {:?})", file.display(), app.format)));
    }
    if app.format_version == 0 || app.format_version > APP_FORMAT_VERSION {
        return Err(CoreError::Invalid(format!("{} is format_version {}, which this FormPortal does not read (it reads 1 and {APP_FORMAT_VERSION}); update FormPortal", file.display(), app.format_version)));
    }
    if let Some(mcp) = app.agents.as_ref().and_then(|a| a.mcp.as_ref()) {
        if app.format_version == 1 && mcp.command.trim().is_empty() {
            return Err(CoreError::Invalid(format!("{} is not valid (format_version 1 needs agents.mcp.command)", file.display())));
        }
        let b = mcp.binary.as_str();
        if !b.is_empty() && (b.len() > 128 || b.contains(['/', '\\']) || b.starts_with('.') || b.chars().any(|c| c.is_control())) {
            return Err(CoreError::Invalid(format!("{} names the binary {b:?}, which is not a plain file name", file.display())));
        }
    }
    Ok(app)
}

impl AppFile {
    pub(crate) fn id(&self) -> Option<&str> {
        self.id.as_deref()
    }

    pub(crate) fn version(&self) -> Option<&str> {
        self.version.as_deref()
    }
}

fn mcp_available(app: &AppFile) -> bool {
    app.agents.as_ref().and_then(|a| a.mcp.as_ref()).map(|m| m.available.unwrap_or(!m.command.trim().is_empty() || !m.binary.trim().is_empty())).unwrap_or(false)
}

pub const FILES_FORMAT: &str = "formportal-files";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FilesRecord {
    pub format: String,
    pub format_version: u32,
    pub product: String,
    pub channel: String,
    pub version: String,
    pub files: std::collections::BTreeMap<String, String>,
}

fn digest(path: &Path) -> Result<String> {
    use sha2::{Digest, Sha256};
    let mut file = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 1 << 16];
    loop {
        let n = std::io::Read::read(&mut file, &mut buffer)?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    Ok(hasher.finalize().iter().map(|b| format!("{b:02x}")).collect())
}

pub fn install_files(root: &Path) -> Result<std::collections::BTreeMap<String, String>> {
    let mut out = std::collections::BTreeMap::new();
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        for entry in fs::read_dir(&dir)?.flatten() {
            let path = entry.path();
            let rel = path.strip_prefix(root).map(|p| p.to_string_lossy().replace('\\', "/")).unwrap_or_default();
            let kind = entry.file_type()?;
            if kind.is_symlink() {
                out.insert(rel, format!("link:{}", fs::read_link(&path).map(|t| t.to_string_lossy().into_owned()).unwrap_or_default()));
            } else if kind.is_dir() {
                stack.push(path);
            } else {
                out.insert(rel, digest(&path)?);
            }
        }
    }
    Ok(out)
}

pub(crate) fn files_record_path(base: &Path, version: &str) -> PathBuf {
    base.join(format!("{version}.files.json"))
}

pub(crate) fn write_files_record(install: &Path, record: &Path, product: &str, channel: Channel, version: &str) -> Result<()> {
    let body = FilesRecord { format: FILES_FORMAT.into(), format_version: 1, product: product.into(), channel: channel_name(channel).into(), version: version.into(), files: install_files(install)? };
    let text = serde_json::to_string_pretty(&body).map_err(|e| CoreError::State(e.to_string()))? + "\n";
    let part = record.with_extension("json.part");
    fs::write(&part, text)?;
    fs::rename(&part, record)?;
    Ok(())
}

pub(crate) fn fetch_app_file(asset: &crate::AgentAsset, product: &str, version: &str) -> Result<Vec<u8>> {
    use sha2::{Digest, Sha256};
    let body = crate::download::fetch_bytes(&asset.url)?;
    let found: String = Sha256::digest(&body).iter().map(|b| format!("{b:02x}")).collect();
    if !found.eq_ignore_ascii_case(&asset.sha256) {
        return Err(CoreError::Hash { file: asset.file.clone(), expected: asset.sha256.clone(), found });
    }
    let text = String::from_utf8(body.clone()).map_err(|_| CoreError::Invalid(format!("{} is not text", asset.file)))?;
    let app = parse_app(Path::new(&asset.file), &text)?;
    if app.id().is_some_and(|id| id != product) || app.version().is_some_and(|v| v != version) {
        return Err(CoreError::Invalid(format!("{} describes {} {}, not {product} {version}", asset.file, app.id().unwrap_or("?"), app.version().unwrap_or("?"))));
    }
    Ok(body)
}

fn resolve_binary(root: &Path, name: &str) -> Option<PathBuf> {
    let exe = format!("{name}.exe");
    let mut found: Vec<(u8, PathBuf)> = Vec::new();
    let mut stack = vec![(root.to_path_buf(), 0u32)];
    while let Some((dir, depth)) = stack.pop() {
        let Ok(entries) = fs::read_dir(&dir) else { continue };
        for entry in entries.flatten() {
            let path = entry.path();
            let Ok(kind) = entry.file_type() else { continue };
            if kind.is_dir() {
                if depth < 6 {
                    stack.push((path, depth + 1));
                }
                continue;
            }
            let file = entry.file_name().to_string_lossy().into_owned();
            let parent = path.parent().map(|p| p.to_string_lossy().replace('\\', "/")).unwrap_or_default();
            let rank = if file == name && parent.ends_with("Contents/MacOS") {
                0
            } else if file == name && parent.ends_with("usr/bin") {
                1
            } else if file.eq_ignore_ascii_case(&exe) {
                2
            } else if file == name {
                3
            } else if depth == 0 && file.to_ascii_lowercase().ends_with(".appimage") {
                4
            } else {
                continue;
            };
            found.push((rank, path));
        }
    }
    found.sort();
    let best = found.first()?.clone();
    if best.0 == 4 && found.iter().filter(|(r, _)| *r == 4).count() > 1 {
        return None;
    }
    let inside = best.1.canonicalize().ok().zip(root.canonicalize().ok()).is_some_and(|(c, r)| c.starts_with(r));
    inside.then_some(best.1)
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Surface {
    pub file: PathBuf,
    pub command: PathBuf,
    pub args: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Client {
    Claude,
    Codex,
    Cursor,
}

pub const CLIENTS: [Client; 3] = [Client::Claude, Client::Codex, Client::Cursor];

impl Client {
    pub fn label(self) -> &'static str {
        match self {
            Client::Claude => "Claude Code",
            Client::Codex => "Codex",
            Client::Cursor => "Cursor",
        }
    }

    pub fn parse(text: &str) -> Option<Client> {
        match text.trim().to_lowercase().as_str() {
            "claude" | "claude-code" | "claude code" => Some(Client::Claude),
            "codex" => Some(Client::Codex),
            "cursor" => Some(Client::Cursor),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Link {
    Connected,
    NotConnected,
    Taken,
    NoClient,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ClientState {
    pub client: Client,
    pub label: &'static str,
    pub state: Link,
    pub config: Option<PathBuf>,
    pub note: Option<String>,
}

pub struct Launcher {
    pub program: PathBuf,
}

impl Launcher {
    pub fn current() -> Result<Launcher> {
        Ok(Launcher { program: std::env::current_exe()? })
    }

    pub fn installed() -> Result<Launcher> {
        let exe = std::env::current_exe()?;
        let image = std::env::var_os("APPIMAGE").map(PathBuf::from).zip(std::env::var_os("APPDIR").map(PathBuf::from)).filter(|(image, dir)| image.is_file() && exe.starts_with(dir)).map(|(image, _)| image);
        Ok(Launcher { program: image.unwrap_or(exe) })
    }

    fn args(&self, product: &str, channel: Channel) -> Vec<String> {
        let mut args = vec!["app-mcp".to_string(), product.to_string()];
        if channel != Channel::Stable {
            args.push("--channel".to_string());
            args.push(channel_name(channel).to_string());
        }
        args
    }
}

pub fn server_name(product: &str, channel: Channel) -> String {
    match channel {
        Channel::Stable => product.to_string(),
        other => format!("{product}-{}", channel_name(other)),
    }
}

fn home() -> PathBuf {
    std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE")).map(PathBuf::from).unwrap_or_else(|| PathBuf::from("."))
}

fn codex_config() -> PathBuf {
    std::env::var_os("CODEX_HOME").map(PathBuf::from).unwrap_or_else(|| home().join(".codex")).join("config.toml")
}

fn cursor_config() -> PathBuf {
    home().join(".cursor").join("mcp.json")
}

pub(crate) fn which(program: &str) -> Option<PathBuf> {
    crate::programs::find(program)
}

fn backup(path: &Path) -> Result<()> {
    if path.exists() {
        let stamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
        fs::copy(path, path.with_file_name(format!("{}.bak-{stamp}", path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default())))?;
    }
    Ok(())
}

pub(crate) fn quote(text: &str) -> String {
    format!("\"{}\"", text.replace('\\', "\\\\").replace('"', "\\\""))
}

fn ours(text: &str) -> bool {
    text.contains("app-mcp")
}

pub const OWN_SERVER: &str = "formportal";
pub const OWN_ARG: &str = "mcp";
const APP_LIMITS: &str = "startup_timeout_sec = 60\n";
const OWN_LIMITS: &str = "startup_timeout_sec = 600\ntool_timeout_sec = 3600\n";

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct OwnState {
    pub client: Client,
    pub label: &'static str,
    pub state: Link,
    pub program: Option<PathBuf>,
    pub config: Option<PathBuf>,
    pub command: Option<String>,
    pub current: bool,
    pub note: Option<String>,
}

struct Held {
    command: Option<String>,
    args: Vec<String>,
    exact: bool,
}

pub fn own_command(command: &str, args: &[String], program: &Path) -> bool {
    let name = command.rsplit(['/', '\\']).next().unwrap_or_default().to_lowercase();
    args.len() == 1 && args[0] == OWN_ARG && (Path::new(command) == program || name.starts_with("formportal"))
}

fn toml_text(value: &str) -> Option<String> {
    let value = value.trim();
    if let Some(inner) = value.strip_prefix('\'').and_then(|v| v.strip_suffix('\'')) {
        return Some(inner.to_string());
    }
    let inner = value.strip_prefix('"')?.strip_suffix('"')?;
    let mut out = String::new();
    let mut chars = inner.chars();
    while let Some(c) = chars.next() {
        match c {
            '\\' => out.push(chars.next()?),
            '"' => return None,
            other => out.push(other),
        }
    }
    Some(out)
}

fn toml_value<'a>(section: &'a str, key: &str) -> Option<&'a str> {
    section.lines().find_map(|line| line.trim().strip_prefix(key).map(str::trim_start).and_then(|rest| rest.strip_prefix('=')).map(str::trim))
}

fn toml_list(value: &str) -> Option<Vec<String>> {
    let inner = value.trim().strip_prefix('[')?.strip_suffix(']')?.trim();
    inner.split(',').map(str::trim).filter(|part| !part.is_empty()).map(toml_text).collect()
}

fn labelled<'a>(text: &'a str, label: &str) -> Option<&'a str> {
    text.lines().find_map(|line| line.trim().strip_prefix(label)).map(str::trim)
}

fn codex_block(name: &str, exe: &str, args: &[String], root: Option<&str>, limits: &str) -> String {
    let list = args.iter().map(|a| quote(a)).collect::<Vec<_>>().join(", ");
    let env = root.map(|r| format!("env = {{ FORMPORTAL_ROOT = {} }}\n", quote(r))).unwrap_or_default();
    format!("[mcp_servers.{name}]\ncommand = {}\nargs = [{list}]\n{env}{limits}", quote(exe))
}

fn cursor_entry(exe: &str, args: &[String], root: Option<&str>) -> serde_json::Value {
    match root {
        Some(r) => serde_json::json!({ "command": exe, "args": args, "env": { "FORMPORTAL_ROOT": r } }),
        None => serde_json::json!({ "command": exe, "args": args }),
    }
}

struct Member {
    key: String,
    start: usize,
    value: usize,
    end: usize,
}

fn json_blank(bytes: &[u8], mut at: usize) -> usize {
    while bytes.get(at).is_some_and(|b| b.is_ascii_whitespace()) {
        at += 1;
    }
    at
}

fn json_end(bytes: &[u8], at: usize) -> Option<usize> {
    let mut i = at;
    match *bytes.get(at)? {
        b'"' => loop {
            i += 1;
            match *bytes.get(i)? {
                b'\\' => i += 1,
                b'"' => return Some(i + 1),
                _ => {}
            }
        },
        b'{' | b'[' => {
            let mut depth = 0usize;
            loop {
                match *bytes.get(i)? {
                    b'"' => i = json_end(bytes, i)? - 1,
                    b'{' | b'[' => depth += 1,
                    b'}' | b']' if depth == 1 => return Some(i + 1),
                    b'}' | b']' => depth -= 1,
                    _ => {}
                }
                i += 1;
            }
        }
        _ => {
            while bytes.get(i).is_some_and(|b| !b.is_ascii_whitespace() && !matches!(b, b',' | b'}' | b']')) {
                i += 1;
            }
            (i > at).then_some(i)
        }
    }
}

fn json_members(text: &str, open: usize) -> Option<(Vec<Member>, usize)> {
    let bytes = text.as_bytes();
    if bytes.get(open) != Some(&b'{') {
        return None;
    }
    let mut out = Vec::new();
    let mut at = json_blank(bytes, open + 1);
    loop {
        if bytes.get(at) == Some(&b'}') {
            return Some((out, at));
        }
        let start = at;
        if bytes.get(start) != Some(&b'"') {
            return None;
        }
        let named = json_end(bytes, start)?;
        let key: String = serde_json::from_str(&text[start..named]).ok()?;
        let colon = json_blank(bytes, named);
        if bytes.get(colon) != Some(&b':') {
            return None;
        }
        let value = json_blank(bytes, colon + 1);
        let end = json_end(bytes, value)?;
        out.push(Member { key, start, value, end });
        at = json_blank(bytes, end);
        if bytes.get(at) == Some(&b',') {
            at = json_blank(bytes, at + 1);
        }
    }
}

fn line_lead(text: &str, at: usize) -> &str {
    let line = text[..at].rfind('\n').map(|n| n + 1).unwrap_or(0);
    let lead = &text[line..at];
    &lead[..lead.len() - lead.trim_start_matches([' ', '\t']).len()]
}

fn own_line(text: &str, at: usize) -> Option<&str> {
    let lead = line_lead(text, at);
    (text[..at].ends_with(lead) && text[..at - lead.len()].ends_with('\n')).then_some(lead)
}

fn json_member(key: &str, value: &serde_json::Value, indent: Option<&str>) -> String {
    let key = serde_json::Value::String(key.to_string());
    match indent {
        Some(indent) => format!("{key}: {}", serde_json::to_string_pretty(value).unwrap_or_default().replace('\n', &format!("\n{indent}"))),
        None => format!("{key}: {value}"),
    }
}

fn json_put(text: &str, open: usize, key: &str, value: &serde_json::Value) -> Option<String> {
    let (members, close) = json_members(text, open)?;
    if let Some(member) = members.iter().find(|m| m.key == key) {
        return Some(format!("{}{}{}", &text[..member.start], json_member(key, value, own_line(text, member.start)), &text[member.end..]));
    }
    Some(match members.last() {
        Some(last) => {
            let indent = own_line(text, last.start);
            let gap = indent.map(|i| format!(",\n{i}")).unwrap_or_else(|| ", ".to_string());
            format!("{}{gap}{}{}", &text[..last.end], json_member(key, value, indent), &text[last.end..])
        }
        None => {
            let outer = line_lead(text, open);
            let inner = format!("{outer}  ");
            format!("{}\n{inner}{}\n{outer}{}", &text[..open + 1], json_member(key, value, Some(&inner)), &text[close..])
        }
    })
}

fn json_take(text: &str, open: usize, key: &str) -> Option<String> {
    let (members, close) = json_members(text, open)?;
    let at = members.iter().position(|m| m.key == key)?;
    let (from, to) = if at > 0 {
        (members[at - 1].end, members[at].end)
    } else if members.len() > 1 {
        (members[0].start, members[1].start)
    } else {
        (open + 1, close)
    };
    Some(format!("{}{}", &text[..from], &text[to..]))
}

fn servers_at(text: &str) -> Option<(usize, Option<usize>)> {
    let top = json_blank(text.as_bytes(), 0);
    let (members, _) = json_members(text, top)?;
    Some((top, members.iter().find(|m| m.key == "mcpServers").map(|m| m.value)))
}

pub const CLIENT_TABLE: &str = include_str!("../data/agent-clients.json");

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct ClientRow {
    pub id: String,
    pub label: String,
    pub programs: Vec<String>,
    #[serde(default)]
    pub apps: std::collections::BTreeMap<String, Vec<String>>,
}

#[derive(Deserialize)]
struct ClientTable {
    clients: Vec<ClientRow>,
}

pub fn client_rows() -> Vec<(Client, ClientRow)> {
    let rows = serde_json::from_str::<ClientTable>(CLIENT_TABLE).map(|table| table.clients).unwrap_or_default();
    rows.into_iter().filter_map(|row| Client::parse(&row.id).map(|client| (client, row))).collect()
}

fn client_row(client: Client) -> Option<ClientRow> {
    client_rows().into_iter().find(|(c, _)| *c == client).map(|(_, row)| row)
}

fn place(text: &str) -> Option<PathBuf> {
    if let Some(rest) = text.strip_prefix("~/") {
        return Some(home().join(rest));
    }
    match text.strip_prefix('%').and_then(|t| t.split_once("%/")) {
        Some((name, rest)) => std::env::var_os(name).map(|base| PathBuf::from(base).join(rest)),
        None => Some(PathBuf::from(text)),
    }
}

fn client_apps(row: &ClientRow) -> Vec<PathBuf> {
    let os = if cfg!(target_os = "macos") { "macos" } else if cfg!(windows) { "windows" } else { "linux" };
    row.apps.get(os).map(|list| list.iter().filter_map(|text| place(text)).collect()).unwrap_or_default()
}

pub fn client_program(client: Client) -> Option<PathBuf> {
    let row = client_row(client)?;
    row.programs.iter().find_map(|program| which(program)).or_else(|| client_apps(&row).into_iter().find(|app| app.exists()))
}

pub fn looked_for(client: Client) -> String {
    let row = client_row(client);
    let programs = row.as_ref().map(|r| r.programs.join(" and ")).unwrap_or_default();
    let apps = row.as_ref().map(client_apps).unwrap_or_default();
    let also = if apps.is_empty() { String::new() } else { format!(", and for the app at {}", apps.iter().map(|app| app.display().to_string()).collect::<Vec<_>>().join(" and ")) };
    format!("FormPortal did not find {} on this computer. It looked for {programs} on your PATH, in the PATH your shell reports and in the usual install folders{also}.", client.label())
}

fn held(client: Client, found: Option<&Path>, launcher: &Launcher) -> Option<Held> {
    let exe = launcher.program.to_string_lossy().to_string();
    let args = vec![OWN_ARG.to_string()];
    let root = root_env();
    match client {
        Client::Claude => {
            let out = crate::programs::command(found?).args(["mcp", "get", OWN_SERVER]).current_dir(home()).output().ok()?;
            let text = String::from_utf8_lossy(&out.stdout).to_string();
            if !out.status.success() || !text.contains("Scope: User") {
                return None;
            }
            let command = labelled(&text, "Command:").map(str::to_string);
            let seen: Vec<String> = labelled(&text, "Args:").map(|a| a.split_whitespace().map(str::to_string).collect()).unwrap_or_default();
            let exact = command.as_deref() == Some(exe.as_str()) && seen == args;
            Some(Held { command, args: seen, exact })
        }
        Client::Codex => {
            let text = fs::read_to_string(codex_config()).unwrap_or_default();
            let (a, b) = toml_section(&text, OWN_SERVER)?;
            let section = &text[a..b];
            Some(Held {
                command: toml_value(section, "command").and_then(toml_text),
                args: toml_value(section, "args").and_then(toml_list).unwrap_or_default(),
                exact: section.trim() == codex_block(OWN_SERVER, &exe, &args, root.as_deref(), OWN_LIMITS).trim(),
            })
        }
        Client::Cursor => {
            let data: serde_json::Value = fs::read_to_string(cursor_config()).ok().and_then(|t| serde_json::from_str(&t).ok())?;
            let entry = data.get("mcpServers")?.get(OWN_SERVER)?;
            Some(Held {
                command: entry.get("command").and_then(|c| c.as_str()).map(str::to_string),
                args: entry.get("args").and_then(|a| a.as_array()).map(|a| a.iter().filter_map(|v| v.as_str().map(str::to_string)).collect()).unwrap_or_default(),
                exact: *entry == cursor_entry(&exe, &args, root.as_deref()),
            })
        }
    }
}

pub fn own_state(client: Client, launcher: &Launcher) -> OwnState {
    let label = client.label();
    let program = client_program(client);
    let config = match client {
        Client::Claude => None,
        Client::Codex => Some(codex_config()),
        Client::Cursor => Some(cursor_config()),
    };
    let held = held(client, program.as_deref(), launcher);
    let own = held.as_ref().is_some_and(|h| h.command.as_deref().is_some_and(|c| own_command(c, &h.args, &launcher.program)));
    let current = own && held.as_ref().is_some_and(|h| h.exact);
    let (state, note) = match (&held, &program) {
        (Some(_), Some(_)) if current => (Link::Connected, None),
        (Some(h), Some(_)) if own && h.command.as_deref().is_some_and(|c| Path::new(c) == launcher.program) => (Link::Connected, Some("its entry is not written the way this FormPortal writes it; connecting again changes it".to_string())),
        (Some(h), Some(_)) if own => (Link::Connected, Some(format!("its entry starts {}, not this FormPortal ({}); connecting again changes it", h.command.clone().unwrap_or_default(), launcher.program.display()))),
        (Some(_), None) if own => (Link::Connected, Some(format!("{label} was not found on this computer, but its settings file has FormPortal's entry"))),
        (Some(_), _) => (Link::Taken, Some(format!("another server named {OWN_SERVER} is set up; left alone"))),
        (None, None) => (Link::NoClient, Some(looked_for(client))),
        (None, Some(_)) => (Link::NotConnected, None),
    };
    OwnState { client, label, state, program, config, command: held.and_then(|h| h.command), current, note }
}

pub fn own_clients(launcher: &Launcher) -> Vec<OwnState> {
    client_rows().into_iter().map(|(client, _)| own_state(client, launcher)).collect()
}

pub fn connect_own(clients: &[Client], launcher: &Launcher, connect: bool) -> Result<Vec<OwnState>> {
    let args = vec![OWN_ARG.to_string()];
    let mut out = Vec::new();
    for &client in clients {
        let before = own_state(client, launcher);
        let change = match (connect, before.state) {
            (true, Link::NotConnected) => true,
            (true, Link::Connected) => !before.current,
            (false, Link::Connected) => true,
            _ => false,
        };
        if !change {
            out.push(before);
            continue;
        }
        if connect {
            put(client, OWN_SERVER, &launcher.program, &args, OWN_LIMITS)?;
        } else {
            take(client, OWN_SERVER)?;
        }
        out.push(own_state(client, launcher));
    }
    Ok(out)
}

fn toml_section(text: &str, name: &str) -> Option<(usize, usize)> {
    let header = format!("[mcp_servers.{name}]");
    let mut offset = 0;
    let mut start = None;
    for line in text.split_inclusive('\n') {
        let trimmed = line.trim();
        if let Some(s) = start {
            if trimmed.starts_with('[') {
                return Some((s, offset));
            }
        } else if trimmed == header {
            start = Some(offset);
        }
        offset += line.len();
    }
    start.map(|s| (s, text.len()))
}

pub(crate) fn search(dir: &Path, depth: u32) -> Option<PathBuf> {
    let direct = dir.join(APP_FILE);
    if direct.is_file() {
        return Some(direct);
    }
    if depth == 0 {
        return None;
    }
    let mut dirs: Vec<PathBuf> = fs::read_dir(dir).ok()?.flatten().map(|e| e.path()).filter(|p| p.is_dir()).collect();
    dirs.sort();
    dirs.into_iter().find_map(|d| search(&d, depth - 1))
}

impl Portal {
    fn app_file(&self, product: &str, channel: Channel) -> Result<Option<(PathBuf, AppFile, PathBuf)>> {
        let state = self.state()?;
        let Some(install) = state.get(product, channel) else { return Ok(None) };
        let Some(file) = search(&install.current.path, 4) else { return Ok(None) };
        let text = fs::read_to_string(&file)?;
        let app = parse_app(&file, &text)?;
        Ok(Some((file, app, install.current.path.clone())))
    }

    pub fn agent_manifest(&self, product: &str, channel: Channel) -> Result<Option<AppManifest>> {
        let Some((file, app, _)) = self.app_file(product, channel)? else { return Ok(None) };
        let mcp = mcp_available(&app);
        Ok(Some(AppManifest {
            file,
            format_version: app.format_version,
            id: app.id,
            version: app.version,
            mcp,
            skills: app.agents.and_then(|a| a.skills),
        }))
    }

    pub fn agent_surface(&self, product: &str, channel: Channel) -> Result<Option<Surface>> {
        let Some((file, app, root)) = self.app_file(product, channel)? else { return Ok(None) };
        let Some(mcp) = app.agents.and_then(|a| a.mcp) else { return Ok(None) };
        if !mcp.binary.trim().is_empty() {
            let command = resolve_binary(&root, mcp.binary.trim()).ok_or_else(|| CoreError::Invalid(format!("{} names the program {:?}, which FormPortal could not find in {} (or found more than one AppImage)", file.display(), mcp.binary, root.display())))?;
            return Ok(Some(Surface { file, command, args: mcp.args }));
        }
        if mcp.command.trim().is_empty() {
            return Ok(None);
        }
        let base = file.parent().unwrap_or(&root).to_path_buf();
        let command = base.join(&mcp.command);
        let inside = command.canonicalize().ok().zip(root.canonicalize().ok()).map(|(c, r)| c.starts_with(r)).unwrap_or(false);
        if !inside || mcp.command.contains("..") {
            return Err(CoreError::Invalid(format!("{} names an MCP command outside the app's own folder", file.display())));
        }
        Ok(Some(Surface { file, command, args: mcp.args }))
    }

    pub fn run_app_mcp(&self, product: &str, channel: Channel) -> Result<i32> {
        let surface = self.agent_surface(product, channel)?.ok_or_else(|| CoreError::Invalid(format!("{product} ({}) has no MCP server, or is not installed", channel_name(channel))))?;
        let mut command = Command::new(&surface.command);
        command.args(&surface.args).stdin(Stdio::inherit()).stdout(Stdio::inherit()).stderr(Stdio::inherit());
        if let Some(dir) = surface.command.parent() {
            command.current_dir(dir);
        }
        let status = command.status()?;
        Ok(status.code().unwrap_or(1))
    }

    pub fn agent_clients(&self, product: &str, channel: Channel) -> Vec<ClientState> {
        let name = server_name(product, channel);
        CLIENTS.iter().map(|&client| client_state(client, &name)).collect()
    }

    pub fn connect_agents(&self, product: &str, channel: Channel, clients: &[Client], launcher: &Launcher, connect: bool) -> Result<Vec<ClientState>> {
        if connect && self.agent_surface(product, channel)?.is_none() {
            return Err(CoreError::Invalid(format!("{product} ({}) ships no MCP server FormPortal can find, or is not installed", channel_name(channel))));
        }
        let name = server_name(product, channel);
        let args = launcher.args(product, channel);
        let mut out = Vec::new();
        for &client in clients {
            let before = client_state(client, &name);
            let after = match (connect, before.state) {
                (true, Link::NotConnected) | (true, Link::Connected) => write(client, &name, &launcher.program, &args, APP_LIMITS)?,
                (false, Link::Connected) => remove(client, &name)?,
                _ => before,
            };
            out.push(after);
        }
        Ok(out)
    }
}

fn client_state(client: Client, name: &str) -> ClientState {
    let label = client.label();
    match client {
        Client::Claude => match which("claude") {
            None => ClientState { client, label, state: Link::NoClient, config: None, note: Some("the claude command is not installed on this computer".to_string()) },
            Some(claude) => {
                let got = crate::programs::command(&claude).args(["mcp", "get", name]).current_dir(home()).output();
                match got {
                    Ok(out) if out.status.success() && String::from_utf8_lossy(&out.stdout).contains("Scope: User") => {
                        let text = String::from_utf8_lossy(&out.stdout).to_string();
                        let state = if ours(&text) { Link::Connected } else { Link::Taken };
                        ClientState { client, label, state, config: None, note: (state == Link::Taken).then(|| format!("another server named {name} is set up; left alone")) }
                    }
                    _ => ClientState { client, label, state: Link::NotConnected, config: None, note: None },
                }
            }
        },
        Client::Codex => {
            let path = codex_config();
            let text = fs::read_to_string(&path).unwrap_or_default();
            let state = match toml_section(&text, name) {
                Some((a, b)) if ours(&text[a..b]) => Link::Connected,
                Some(_) => Link::Taken,
                None => Link::NotConnected,
            };
            ClientState { client, label, state, config: Some(path), note: (state == Link::Taken).then(|| format!("another server named {name} is set up; left alone")) }
        }
        Client::Cursor => {
            let path = cursor_config();
            let data: serde_json::Value = fs::read_to_string(&path).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default();
            let state = match data.get("mcpServers").and_then(|m| m.get(name)) {
                Some(entry) if ours(&entry.to_string()) => Link::Connected,
                Some(_) => Link::Taken,
                None => Link::NotConnected,
            };
            ClientState { client, label, state, config: Some(path), note: (state == Link::Taken).then(|| format!("another server named {name} is set up; left alone")) }
        }
    }
}

fn root_env() -> Option<String> {
    std::env::var("FORMPORTAL_ROOT").ok().filter(|r| !r.trim().is_empty())
}

fn write(client: Client, name: &str, program: &Path, args: &[String], limits: &str) -> Result<ClientState> {
    put(client, name, program, args, limits)?;
    Ok(client_state(client, name))
}

fn put(client: Client, name: &str, program: &Path, args: &[String], limits: &str) -> Result<()> {
    let exe = program.to_string_lossy().to_string();
    let root = root_env();
    match client {
        Client::Claude => {
            let claude = which("claude").ok_or_else(|| CoreError::Invalid("the claude command is not installed".to_string()))?;
            let _ = crate::programs::command(&claude).args(["mcp", "remove", name, "--scope", "user"]).output();
            let mut command = crate::programs::command(&claude);
            command.args(["mcp", "add", "--scope", "user", name]);
            if let Some(root) = &root {
                command.arg("-e").arg(format!("FORMPORTAL_ROOT={root}"));
            }
            command.args(["--", &exe]).args(args);
            let out = command.output()?;
            if !out.status.success() {
                return Err(CoreError::Invalid(format!("claude mcp add failed: {}", String::from_utf8_lossy(&out.stderr).trim())));
            }
        }
        Client::Codex => {
            let path = codex_config();
            let text = fs::read_to_string(&path).unwrap_or_default();
            let block = codex_block(name, &exe, args, root.as_deref(), limits);
            let next = match toml_section(&text, name) {
                Some((a, b)) => format!("{}{block}\n{}", &text[..a], &text[b..]),
                None if text.trim().is_empty() => block,
                None => format!("{}\n\n{block}", text.trim_end()),
            };
            backup(&path)?;
            if let Some(dir) = path.parent() {
                fs::create_dir_all(dir)?;
            }
            fs::write(&path, next)?;
        }
        Client::Cursor => {
            json_file_put(&cursor_config(), name, &cursor_entry(&exe, args, root.as_deref()))?;
        }
    }
    Ok(())
}

fn json_file_put(path: &Path, name: &str, entry: &serde_json::Value) -> Result<()> {
    let text = fs::read_to_string(path).unwrap_or_default();
    let mut data: serde_json::Value = if text.trim().is_empty() { serde_json::json!({}) } else { serde_json::from_str(&text).map_err(|e| CoreError::Invalid(format!("{} is not valid JSON ({e}); not changed", path.display())))? };
    let servers = data.as_object_mut().ok_or_else(|| CoreError::Invalid(format!("{} is not a JSON object; not changed", path.display())))?.entry("mcpServers").or_insert_with(|| serde_json::json!({}));
    servers.as_object_mut().ok_or_else(|| CoreError::Invalid(format!("mcpServers in {} is not an object; not changed", path.display())))?.insert(name.to_string(), entry.clone());
    let spliced = servers_at(&text).and_then(|(top, servers)| match servers {
        Some(open) => json_put(&text, open, name, entry),
        None => json_put(&text, top, "mcpServers", &serde_json::json!({ name: entry })),
    });
    let next = match spliced.filter(|t| serde_json::from_str::<serde_json::Value>(t).ok().as_ref() == Some(&data)) {
        Some(kept) => kept,
        None => serde_json::to_string_pretty(&data).map_err(|e| CoreError::State(e.to_string()))? + "\n",
    };
    if next == text {
        return Ok(());
    }
    backup(path)?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    fs::write(path, next)?;
    Ok(())
}

fn json_file_take(path: &Path, name: &str) -> Result<()> {
    let Ok(text) = fs::read_to_string(path) else { return Ok(()) };
    let Ok(mut data) = serde_json::from_str::<serde_json::Value>(&text) else { return Ok(()) };
    let Some(servers) = data.get_mut("mcpServers").and_then(|m| m.as_object_mut()) else { return Ok(()) };
    if servers.remove(name).is_none() {
        return Ok(());
    }
    let spliced = servers_at(&text).and_then(|(_, servers)| json_take(&text, servers?, name));
    let next = match spliced.filter(|t| serde_json::from_str::<serde_json::Value>(t).ok().as_ref() == Some(&data)) {
        Some(kept) => kept,
        None => serde_json::to_string_pretty(&data).map_err(|e| CoreError::State(e.to_string()))? + "\n",
    };
    backup(path)?;
    fs::write(path, next)?;
    Ok(())
}

fn remove(client: Client, name: &str) -> Result<ClientState> {
    take(client, name)?;
    Ok(client_state(client, name))
}

fn take(client: Client, name: &str) -> Result<()> {
    match client {
        Client::Claude => {
            if let Some(claude) = which("claude") {
                let _ = crate::programs::command(&claude).args(["mcp", "remove", name, "--scope", "user"]).output();
            }
        }
        Client::Codex => {
            let path = codex_config();
            let text = fs::read_to_string(&path).unwrap_or_default();
            if let Some((a, b)) = toml_section(&text, name) {
                backup(&path)?;
                let head = if text[b..].is_empty() && !text[..a].trim().is_empty() { format!("{}\n", text[..a].trim_end()) } else { text[..a].to_string() };
                fs::write(&path, format!("{head}{}", &text[b..]))?;
            }
        }
        Client::Cursor => json_file_take(&cursor_config(), name)?,
    }
    Ok(())
}
