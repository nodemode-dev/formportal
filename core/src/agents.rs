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
    let paths = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&paths) {
        for name in [program.to_string(), format!("{program}.exe"), format!("{program}.cmd")] {
            let candidate = dir.join(&name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
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
                (true, Link::NotConnected) | (true, Link::Connected) => write(client, &name, &launcher.program, &args)?,
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
                let got = Command::new(claude).args(["mcp", "get", name]).current_dir(home()).output();
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

fn write(client: Client, name: &str, program: &Path, args: &[String]) -> Result<ClientState> {
    let exe = program.to_string_lossy().to_string();
    let root = root_env();
    match client {
        Client::Claude => {
            let claude = which("claude").ok_or_else(|| CoreError::Invalid("the claude command is not installed".to_string()))?;
            let _ = Command::new(&claude).args(["mcp", "remove", name, "--scope", "user"]).output();
            let mut command = Command::new(&claude);
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
            let list = args.iter().map(|a| quote(a)).collect::<Vec<_>>().join(", ");
            let env = root.as_ref().map(|r| format!("env = {{ FORMPORTAL_ROOT = {} }}\n", quote(r))).unwrap_or_default();
            let block = format!("[mcp_servers.{name}]\ncommand = {}\nargs = [{list}]\n{env}startup_timeout_sec = 60\n", quote(&exe));
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
            let path = cursor_config();
            let mut data: serde_json::Value = match fs::read_to_string(&path) {
                Ok(text) if !text.trim().is_empty() => serde_json::from_str(&text).map_err(|e| CoreError::Invalid(format!("{} is not valid JSON ({e}); not changed", path.display())))?,
                _ => serde_json::json!({}),
            };
            let servers = data.as_object_mut().ok_or_else(|| CoreError::Invalid(format!("{} is not a JSON object; not changed", path.display())))?.entry("mcpServers").or_insert_with(|| serde_json::json!({}));
            servers.as_object_mut().ok_or_else(|| CoreError::Invalid(format!("mcpServers in {} is not an object; not changed", path.display())))?.insert(
                name.to_string(),
                match &root {
                    Some(r) => serde_json::json!({ "command": exe, "args": args, "env": { "FORMPORTAL_ROOT": r } }),
                    None => serde_json::json!({ "command": exe, "args": args }),
                },
            );
            backup(&path)?;
            if let Some(dir) = path.parent() {
                fs::create_dir_all(dir)?;
            }
            fs::write(&path, serde_json::to_string_pretty(&data).map_err(|e| CoreError::State(e.to_string()))? + "\n")?;
        }
    }
    Ok(client_state(client, name))
}

fn remove(client: Client, name: &str) -> Result<ClientState> {
    match client {
        Client::Claude => {
            if let Some(claude) = which("claude") {
                let _ = Command::new(claude).args(["mcp", "remove", name, "--scope", "user"]).output();
            }
        }
        Client::Codex => {
            let path = codex_config();
            let text = fs::read_to_string(&path).unwrap_or_default();
            if let Some((a, b)) = toml_section(&text, name) {
                backup(&path)?;
                fs::write(&path, format!("{}{}", &text[..a], &text[b..]))?;
            }
        }
        Client::Cursor => {
            let path = cursor_config();
            if let Ok(text) = fs::read_to_string(&path) {
                if let Ok(mut data) = serde_json::from_str::<serde_json::Value>(&text) {
                    if let Some(servers) = data.get_mut("mcpServers").and_then(|m| m.as_object_mut()) {
                        servers.remove(name);
                        backup(&path)?;
                        fs::write(&path, serde_json::to_string_pretty(&data).map_err(|e| CoreError::State(e.to_string()))? + "\n")?;
                    }
                }
            }
        }
    }
    Ok(client_state(client, name))
}
