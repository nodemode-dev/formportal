#![cfg(unix)]

use std::io::Write;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

const CLAUDE: &str = r#"#!/bin/sh
store="$HOME/.claude-stand-in"
mkdir -p "$store"
echo "$*" >> "$store/calls.log"
if [ "$1" = mcp ] && [ "$2" = get ]; then
  f="$store/$3.entry"
  if [ ! -f "$f" ]; then echo "No MCP server found with name: $3" >&2; exit 1; fi
  echo "$3:"
  echo "  Scope: User config (available in all your projects)"
  echo "  Type: stdio"
  echo "  Command: $(sed -n 1p "$f")"
  echo "  Args: $(sed -n 2p "$f")"
  exit 0
fi
if [ "$1" = mcp ] && [ "$2" = add ]; then
  shift 2; name=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --scope) shift 2;;
      -e) shift 2;;
      --) shift; break;;
      *) name="$1"; shift;;
    esac
  done
  cmd="$1"; shift
  printf '%s\n%s\n' "$cmd" "$*" > "$store/$name.entry"
  exit 0
fi
if [ "$1" = mcp ] && [ "$2" = remove ]; then
  if [ -f "$store/$3.entry" ]; then rm -f "$store/$3.entry"; exit 0; fi
  exit 1
fi
exit 0
"#;

const CODEX: &str = "model = \"gpt-5\"\n\n[mcp_servers.notes]\ncommand = \"npx\"\nargs = [\"-y\", \"notes-server\"]\n\n[profiles.fast]\nmodel = \"gpt-5-mini\"\n";
const CURSOR: &str = "{\n  \"mcpServers\": {\n    \"notes\": { \"command\": \"npx\", \"args\": [\"-y\", \"notes-server\"] },\n    \"alpha\": { \"url\": \"https://example.com/mcp\" }\n  },\n  \"zeta\": true,\n  \"beta\": [1, 2]\n}\n";

fn home(tag: &str, programs: &[&str]) -> PathBuf {
    let home = std::env::temp_dir().join(format!("formportal-cli-test-{}-{tag}", std::process::id()));
    let _ = std::fs::remove_dir_all(&home);
    for folder in [".local/bin", ".codex", ".cursor"] {
        std::fs::create_dir_all(home.join(folder)).unwrap();
    }
    for program in programs {
        let path = home.join(".local/bin").join(program);
        std::fs::write(&path, if *program == "claude" { CLAUDE } else { "#!/bin/sh\n" }).unwrap();
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).unwrap();
    }
    std::fs::write(home.join(".codex/config.toml"), CODEX).unwrap();
    std::fs::write(home.join(".cursor/mcp.json"), CURSOR).unwrap();
    home
}

fn cli(home: &Path) -> Command {
    let mut cmd = Command::new(env!("CARGO_BIN_EXE_formportal-cli"));
    cmd.env_clear().env("HOME", home).env("PATH", "/usr/bin:/bin").env("FORMPORTAL_NO_SHELL_PATH", "1");
    if let Some(libs) = std::env::var_os("LD_LIBRARY_PATH") {
        cmd.env("LD_LIBRARY_PATH", libs);
    }
    cmd
}

fn run(home: &Path, args: &[&str]) -> serde_json::Value {
    let out = cli(home).args(args).output().unwrap();
    assert!(out.status.success(), "{args:?}: {}", String::from_utf8_lossy(&out.stderr));
    serde_json::from_slice(&out.stdout).unwrap()
}

fn states(reply: &serde_json::Value) -> Vec<String> {
    reply["clients"].as_array().unwrap().iter().map(|c| format!("{}:{}", c["client"].as_str().unwrap(), c["state"].as_str().unwrap())).collect()
}

fn files(home: &Path) -> Vec<(PathBuf, Vec<u8>, std::time::SystemTime)> {
    let mut out = Vec::new();
    for folder in [".codex", ".cursor", ".claude-stand-in"] {
        let Ok(entries) = std::fs::read_dir(home.join(folder)) else { continue };
        for entry in entries.flatten().filter(|e| e.file_name() != "calls.log") {
            out.push((entry.path(), std::fs::read(entry.path()).unwrap(), entry.metadata().unwrap().modified().unwrap()));
        }
    }
    out.sort();
    out
}

fn calls(home: &Path) -> Vec<String> {
    std::fs::read_to_string(home.join(".claude-stand-in/calls.log")).unwrap_or_default().lines().map(str::to_string).collect()
}

fn text(home: &Path, file: &str) -> String {
    std::fs::read_to_string(home.join(file)).unwrap()
}

#[test]
fn connect_adds_only_formportals_entry_and_a_second_connect_writes_nothing() {
    let home = home("own-connect", &["claude", "codex", "cursor"]);
    let exe = env!("CARGO_BIN_EXE_formportal-cli");
    assert_eq!(states(&run(&home, &["app-agents"])), ["claude:not-connected", "codex:not-connected", "cursor:not-connected"]);
    assert_eq!(files(&home).len(), 2);

    let reply = run(&home, &["connect"]);
    assert_eq!(states(&reply), ["claude:connected", "codex:connected", "cursor:connected"]);
    assert_eq!(reply["server_name"], serde_json::json!("formportal"));
    for client in reply["clients"].as_array().unwrap() {
        assert_eq!(client["command"], serde_json::json!(exe), "{client}");
        assert_eq!(client["current"], serde_json::json!(true), "{client}");
    }
    assert_eq!(text(&home, ".codex/config.toml"), format!("{}\n\n[mcp_servers.formportal]\ncommand = \"{exe}\"\nargs = [\"mcp\"]\nstartup_timeout_sec = 600\ntool_timeout_sec = 3600\n", CODEX.trim_end()));
    let cursor = text(&home, ".cursor/mcp.json");
    assert!(cursor.starts_with("{\n  \"mcpServers\": {\n    \"notes\": { \"command\": \"npx\", \"args\": [\"-y\", \"notes-server\"] },\n    \"alpha\": { \"url\": \"https://example.com/mcp\" },\n    \"formportal\": {"), "{cursor}");
    assert!(cursor.ends_with("\n  },\n  \"zeta\": true,\n  \"beta\": [1, 2]\n}\n"), "{cursor}");
    let mut expected: serde_json::Value = serde_json::from_str(CURSOR).unwrap();
    expected["mcpServers"]["formportal"] = serde_json::json!({ "command": exe, "args": ["mcp"] });
    assert_eq!(serde_json::from_str::<serde_json::Value>(&cursor).unwrap(), expected);
    assert_eq!(text(&home, ".claude-stand-in/formportal.entry"), format!("{exe}\nmcp\n"));

    let before = files(&home);
    let asked = calls(&home).len();
    assert_eq!(states(&run(&home, &["connect"])), ["claude:connected", "codex:connected", "cursor:connected"]);
    assert_eq!(files(&home), before, "a second connect wrote a file");
    assert_eq!(calls(&home)[asked..], ["mcp get formportal".to_string()]);
    let _ = std::fs::remove_dir_all(&home);
}

#[test]
fn disconnect_takes_only_formportals_entry_out_and_a_second_disconnect_writes_nothing() {
    let home = home("own-disconnect", &["claude", "codex", "cursor"]);
    run(&home, &["connect"]);
    assert_eq!(states(&run(&home, &["disconnect"])), ["claude:not-connected", "codex:not-connected", "cursor:not-connected"]);
    assert_eq!(text(&home, ".codex/config.toml"), CODEX);
    assert_eq!(text(&home, ".cursor/mcp.json"), CURSOR);
    assert!(!home.join(".claude-stand-in/formportal.entry").exists());
    let before = files(&home);
    assert_eq!(states(&run(&home, &["disconnect"])), ["claude:not-connected", "codex:not-connected", "cursor:not-connected"]);
    assert_eq!(files(&home), before, "a second disconnect wrote a file");
    let _ = std::fs::remove_dir_all(&home);
}

#[test]
fn one_client_can_be_named() {
    let home = home("own-one", &["claude", "codex", "cursor"]);
    let reply = run(&home, &["connect", "--clients", "codex"]);
    assert_eq!(states(&reply), ["codex:connected"]);
    assert_eq!(text(&home, ".cursor/mcp.json"), CURSOR);
    assert!(calls(&home).is_empty());
    let _ = std::fs::remove_dir_all(&home);
}

#[test]
fn an_entry_of_the_same_name_that_something_else_wrote_is_left_alone_and_reported() {
    let home = home("own-taken", &["claude", "codex", "cursor"]);
    std::fs::write(home.join(".codex/config.toml"), format!("{CODEX}\n[mcp_servers.formportal]\ncommand = \"npx\"\nargs = [\"-y\", \"someone-elses-server\"]\n")).unwrap();
    std::fs::write(home.join(".cursor/mcp.json"), "{ \"mcpServers\": { \"formportal\": { \"command\": \"node\", \"args\": [\"/opt/other/server.js\"] } } }\n").unwrap();
    std::fs::create_dir_all(home.join(".claude-stand-in")).unwrap();
    std::fs::write(home.join(".claude-stand-in/formportal.entry"), "uvx\nother-formportal-server\n").unwrap();
    let before = files(&home);
    for action in ["connect", "disconnect"] {
        let reply = run(&home, &[action]);
        assert_eq!(states(&reply), ["claude:taken", "codex:taken", "cursor:taken"], "{action}");
        for client in reply["clients"].as_array().unwrap() {
            assert_eq!(client["note"], serde_json::json!("another server named formportal is set up; left alone"), "{client}");
        }
    }
    assert_eq!(files(&home), before);
    assert!(calls(&home).iter().all(|call| call == "mcp get formportal"), "{:?}", calls(&home));
    let _ = std::fs::remove_dir_all(&home);
}

#[test]
fn a_client_whose_program_is_missing_says_where_formportal_looked() {
    let home = home("own-missing", &["codex"]);
    let before = files(&home);
    let reply = run(&home, &["connect"]);
    assert_eq!(states(&reply), ["claude:no-client", "codex:connected", "cursor:no-client"]);
    assert_eq!(reply["clients"][0]["note"], serde_json::json!("FormPortal did not find Claude Code on this computer. It looked for claude on your PATH, in the PATH your shell reports and in the usual install folders."));
    assert_eq!(reply["clients"][2]["note"], serde_json::json!("FormPortal did not find Cursor on this computer. It looked for cursor and cursor-agent on your PATH, in the PATH your shell reports and in the usual install folders."));
    assert_eq!(text(&home, ".cursor/mcp.json"), CURSOR);
    assert_eq!(files(&home).len(), before.len() + 1);
    let _ = std::fs::remove_dir_all(&home);
}

#[test]
fn the_entry_the_repository_launcher_wrote_is_formportals_own() {
    let home = home("own-launcher", &["claude", "codex", "cursor"]);
    let exe = env!("CARGO_BIN_EXE_formportal-cli");
    std::fs::write(home.join(".codex/config.toml"), format!("{CODEX}\n[mcp_servers.formportal]\ncommand = \"/home/someone/formportal/formportal\"\nargs = [\"mcp\"]\nstartup_timeout_sec = 600\ntool_timeout_sec = 3600\n")).unwrap();
    std::fs::write(home.join(".cursor/mcp.json"), "{\n  \"mcpServers\": {\n    \"formportal\": {\n      \"command\": \"/home/someone/formportal/formportal\",\n      \"args\": [\n        \"mcp\"\n      ]\n    }\n  }\n}\n").unwrap();
    std::fs::create_dir_all(home.join(".claude-stand-in")).unwrap();
    std::fs::write(home.join(".claude-stand-in/formportal.entry"), "/home/someone/formportal/formportal\nmcp\n").unwrap();
    let seen = run(&home, &["app-agents"]);
    assert_eq!(states(&seen), ["claude:connected", "codex:connected", "cursor:connected"]);
    for client in seen["clients"].as_array().unwrap() {
        assert_eq!(client["current"], serde_json::json!(false), "{client}");
        assert_eq!(client["command"], serde_json::json!("/home/someone/formportal/formportal"), "{client}");
    }
    for client in run(&home, &["connect"])["clients"].as_array().unwrap() {
        assert_eq!(client["current"], serde_json::json!(true), "{client}");
        assert_eq!(client["command"], serde_json::json!(exe), "{client}");
    }
    assert_eq!(states(&run(&home, &["disconnect"])), ["claude:not-connected", "codex:not-connected", "cursor:not-connected"]);
    assert_eq!(text(&home, ".codex/config.toml"), CODEX);
    assert_eq!(text(&home, ".cursor/mcp.json"), "{\n  \"mcpServers\": {}\n}\n");
    let _ = std::fs::remove_dir_all(&home);
}

#[test]
fn the_mcp_tools_cannot_connect_formportal_itself() {
    let home = home("own-mcp", &["claude", "codex", "cursor"]);
    let before = files(&home);
    let mut child = cli(&home).arg("mcp").stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped()).spawn().unwrap();
    {
        let mut stdin = child.stdin.take().unwrap();
        for (id, name) in [(1, "connect_agents"), (2, "app_agents"), (3, "connect_own"), (4, "own_agents")] {
            writeln!(stdin, "{}", serde_json::json!({ "jsonrpc": "2.0", "id": id, "method": "tools/call", "params": { "name": name, "arguments": {} } })).unwrap();
        }
        writeln!(stdin, "{}", serde_json::json!({ "jsonrpc": "2.0", "id": 5, "method": "tools/list" })).unwrap();
    }
    let out = child.wait_with_output().unwrap();
    let replies: Vec<serde_json::Value> = String::from_utf8_lossy(&out.stdout).lines().map(|l| serde_json::from_str(l).unwrap()).collect();
    assert_eq!(replies.len(), 5);
    for reply in &replies[..4] {
        assert_eq!(reply["result"]["isError"], serde_json::json!(true), "{reply}");
    }
    for reply in &replies[..2] {
        assert!(reply["result"]["content"][0]["text"].as_str().unwrap().starts_with("no product was given"), "{reply}");
    }
    let names: Vec<&str> = replies[4]["result"]["tools"].as_array().unwrap().iter().filter_map(|t| t["name"].as_str()).collect();
    assert!(!names.iter().any(|n| n.contains("own")), "{names:?}");
    assert_eq!(files(&home), before);
    assert!(calls(&home).is_empty());
    let _ = std::fs::remove_dir_all(&home);
}
