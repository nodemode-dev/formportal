use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};

use crate::agents::{quote, which};
use crate::error::{CoreError, Result};

pub const ASK_LIMIT: Duration = Duration::from_secs(240);
const PROMPT_LIMIT: usize = 4000;
const GUIDE: &str = "You are answering inside FormPortal, the Form family's app portal. Use the formportal tools to answer about the person's Form apps, installs, updates, disk use, fonts, stock, extensions and tutorials. From here you can only read: if the person wants something installed, updated, rolled back or removed, tell them which button in FormPortal does it. Answer in a few plain sentences.";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AgentCli {
    pub client: String,
    pub label: String,
    pub path: Option<PathBuf>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Server {
    pub command: PathBuf,
    pub args: Vec<String>,
    pub env: Vec<(String, String)>,
    pub tools: Vec<String>,
}

pub fn assistant_agents() -> Vec<AgentCli> {
    [("claude", "Claude Code"), ("codex", "Codex")]
        .iter()
        .map(|(client, label)| AgentCli { client: client.to_string(), label: label.to_string(), path: which(client) })
        .collect()
}

fn claude_args(prompt: &str, server: &Server) -> Vec<String> {
    let entry = serde_json::json!({ "mcpServers": { "formportal": {
        "command": server.command.to_string_lossy(),
        "args": server.args,
        "env": server.env.iter().map(|(k, v)| (k.clone(), serde_json::Value::String(v.clone()))).collect::<serde_json::Map<String, serde_json::Value>>(),
    } } });
    let mut args = vec!["-p".to_string(), prompt.to_string(), "--mcp-config".to_string(), entry.to_string(), "--strict-mcp-config".to_string(), "--append-system-prompt".to_string(), GUIDE.to_string(), "--output-format".to_string(), "text".to_string(), "--allowedTools".to_string()];
    args.extend(server.tools.iter().map(|t| format!("mcp__formportal__{t}")));
    args
}

fn codex_args(prompt: &str, server: &Server) -> Vec<String> {
    let mut args = vec!["exec".to_string(), "--sandbox".to_string(), "read-only".to_string(), "--skip-git-repo-check".to_string()];
    args.push("-c".to_string());
    args.push(format!("mcp_servers.formportal.command={}", quote(&server.command.to_string_lossy())));
    args.push("-c".to_string());
    args.push(format!("mcp_servers.formportal.args=[{}]", server.args.iter().map(|a| quote(a)).collect::<Vec<_>>().join(",")));
    if !server.env.is_empty() {
        args.push("-c".to_string());
        args.push(format!("mcp_servers.formportal.env={{{}}}", server.env.iter().map(|(k, v)| format!("{k}={}", quote(v))).collect::<Vec<_>>().join(",")));
    }
    args.push(format!("{GUIDE}\n\n{prompt}"));
    args
}

pub fn ask_agent(client: &str, prompt: &str, server: &Server, workdir: &Path) -> Result<String> {
    let prompt = prompt.trim();
    if prompt.is_empty() {
        return Err(CoreError::Invalid("there is no question to ask".to_string()));
    }
    if prompt.len() > PROMPT_LIMIT {
        return Err(CoreError::Invalid(format!("the question is longer than {PROMPT_LIMIT} characters")));
    }
    let agent = assistant_agents().into_iter().find(|a| a.client == client).ok_or_else(|| CoreError::Invalid(format!("{client} is not an agent FormPortal can ask")))?;
    let exe = agent.path.ok_or_else(|| CoreError::Invalid(format!("{} is not installed on this computer (it is not on PATH)", agent.label)))?;
    let args = if client == "claude" { claude_args(prompt, server) } else { codex_args(prompt, server) };
    fs::create_dir_all(workdir)?;
    let mut child = Command::new(&exe).args(&args).current_dir(workdir).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped()).spawn()?;
    let mut out = child.stdout.take().ok_or_else(|| CoreError::State("no output from the agent".to_string()))?;
    let mut err = child.stderr.take().ok_or_else(|| CoreError::State("no output from the agent".to_string()))?;
    let reader = std::thread::spawn(move || {
        let mut text = String::new();
        let _ = out.read_to_string(&mut text);
        text
    });
    let errs = std::thread::spawn(move || {
        let mut text = String::new();
        let _ = err.read_to_string(&mut text);
        text
    });
    let started = Instant::now();
    let status = loop {
        if let Some(status) = child.try_wait()? {
            break status;
        }
        if started.elapsed() > ASK_LIMIT {
            let _ = child.kill();
            let _ = child.wait();
            return Err(CoreError::Invalid(format!("{} did not answer within {} seconds; it was stopped", agent.label, ASK_LIMIT.as_secs())));
        }
        std::thread::sleep(Duration::from_millis(150));
    };
    let text = reader.join().unwrap_or_default();
    let errors = errs.join().unwrap_or_default();
    if !status.success() {
        let why = errors.lines().rev().find(|l| !l.trim().is_empty()).unwrap_or("it stopped without saying why").trim().to_string();
        return Err(CoreError::Invalid(format!("{} could not answer: {why}", agent.label)));
    }
    Ok(text.trim().to_string())
}
