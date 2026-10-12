use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use serde::{Deserialize, Serialize};

use crate::error::{CoreError, Result};
use crate::portal::channel_name;
use crate::{Channel, Portal};

pub const APP_FILE: &str = "form-app.json";
pub const APP_FORMAT: &str = "form-app";

#[derive(Debug, Clone, Deserialize)]
struct AppFile {
    format: String,
    #[serde(default)]
    agents: Option<AppAgents>,
}

#[derive(Debug, Clone, Deserialize)]
struct AppAgents {
    #[serde(default)]
    mcp: Option<AppMcp>,
}

#[derive(Debug, Clone, Deserialize)]
struct AppMcp {
    command: String,
    #[serde(default)]
    args: Vec<String>,
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

fn search(dir: &Path, depth: u32) -> Option<PathBuf> {
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
    pub fn agent_surface(&self, product: &str, channel: Channel) -> Result<Option<Surface>> {
        let state = self.state()?;
        let Some(install) = state.get(product, channel) else { return Ok(None) };
        let Some(file) = search(&install.current.path, 4) else { return Ok(None) };
        let text = fs::read_to_string(&file)?;
        let app: AppFile = serde_json::from_str(&text).map_err(|e| CoreError::Invalid(format!("{} is not valid ({e})", file.display())))?;
        if app.format != APP_FORMAT {
            return Err(CoreError::Invalid(format!("{} is not a Form app file (format {:?})", file.display(), app.format)));
        }
        let Some(mcp) = app.agents.and_then(|a| a.mcp) else { return Ok(None) };
        let base = file.parent().unwrap_or(&install.current.path).to_path_buf();
        let command = base.join(&mcp.command);
        let inside = command.canonicalize().ok().zip(install.current.path.canonicalize().ok()).map(|(c, root)| c.starts_with(root)).unwrap_or(false);
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
                let got = Command::new(claude).args(["mcp", "get", name]).output();
                match got {
                    Ok(out) if out.status.success() => {
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
