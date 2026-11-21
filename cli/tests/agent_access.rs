use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};

const UNSEALED_BLOCKED: &str = "{\n  \"format\": \"formportal-agent-access\",\n  \"format_version\": 1,\n  \"outside_agents\": \"blocked\"\n}\n";

fn scratch(tag: &str) -> PathBuf {
    let root = std::env::temp_dir().join(format!("formportal-cli-test-{}-{tag}", std::process::id()));
    let _ = std::fs::remove_dir_all(&root);
    std::fs::create_dir_all(&root).unwrap();
    root
}

fn cli(root: &Path) -> Command {
    let mut cmd = Command::new(env!("CARGO_BIN_EXE_formportal-cli"));
    cmd.env("FORMPORTAL_ROOT", root).env("HOME", root).env_remove("FORMPORTAL_POLICY").env_remove("FORMPORTAL_SEAL_STAND_IN");
    cmd
}

fn mcp(root: &Path, lines: &[serde_json::Value]) -> Vec<serde_json::Value> {
    let mut child = cli(root).arg("mcp").stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped()).spawn().unwrap();
    {
        let mut stdin = child.stdin.take().unwrap();
        for line in lines {
            writeln!(stdin, "{line}").unwrap();
        }
    }
    let out = child.wait_with_output().unwrap();
    assert!(out.status.success(), "{}", String::from_utf8_lossy(&out.stderr));
    String::from_utf8_lossy(&out.stdout).lines().map(|l| serde_json::from_str(l).unwrap()).collect()
}

fn call(id: u64, name: &str) -> serde_json::Value {
    serde_json::json!({ "jsonrpc": "2.0", "id": id, "method": "tools/call", "params": { "name": name, "arguments": { "product": "formvis" } } })
}

fn refused(out: &Output) -> String {
    assert!(!out.status.success(), "{}", String::from_utf8_lossy(&out.stdout));
    String::from_utf8_lossy(&out.stderr).into_owned()
}

#[test]
fn the_four_changing_tools_are_refused_until_the_window_allows_them() {
    let root = scratch("access-ask");
    let replies = mcp(&root, &[call(1, "install"), call(2, "update"), call(3, "rollback"), call(4, "remove"), call(5, "status")]);
    assert_eq!(replies.len(), 5);
    for (reply, action) in replies.iter().zip(["install", "update", "rollback", "remove"]) {
        let result = &reply["result"];
        assert_eq!(result["isError"], serde_json::json!(true), "{reply}");
        let text = result["content"][0]["text"].as_str().unwrap();
        assert!(text.starts_with(&format!("{action} was refused")), "{text}");
        assert!(text.contains("only its window can answer"), "{text}");
    }
    assert_eq!(replies[4]["result"]["structuredContent"]["outside_agents"]["outside_agents"], serde_json::json!("ask"));
    for args in [&["remove", "formvis"][..], &["install", "formvis"], &["update", "formvis"], &["rollback", "formvis"]] {
        let text = refused(&cli(&root).args(args).output().unwrap());
        assert!(text.contains("only its window can answer"), "{args:?}: {text}");
    }
    assert!(!root.join("agent-access.json").exists(), "the command line wrote a choice");
    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn the_command_line_never_changes_the_saved_choice() {
    let root = scratch("access-blocked");
    let file = root.join("agent-access.json");
    std::fs::write(&file, UNSEALED_BLOCKED).unwrap();
    let replies = mcp(&root, &[call(1, "install"), call(2, "remove"), call(3, "status")]);
    for reply in &replies[..2] {
        assert_eq!(reply["result"]["isError"], serde_json::json!(true), "{reply}");
    }
    assert_eq!(replies[2]["result"]["structuredContent"]["outside_agents"]["stored"], serde_json::json!("blocked"));
    refused(&cli(&root).args(["remove", "formvis"]).output().unwrap());
    refused(&cli(&root).args(["later", "formvis"]).output().unwrap());
    assert_eq!(std::fs::read_to_string(&file).unwrap(), UNSEALED_BLOCKED);
    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn a_package_file_from_the_command_line_follows_the_choice() {
    let root = scratch("ext-path");
    let package = root.join("demo-look-1.0.0.formpkg");
    let ask = refused(&cli(&root).args(["extension-install", "--path"]).arg(&package).output().unwrap());
    assert!(ask.starts_with("extension-install was refused"), "{ask}");
    assert!(ask.contains("only its window can answer"), "{ask}");
    std::fs::write(root.join("agent-access.json"), UNSEALED_BLOCKED).unwrap();
    let blocked = refused(&cli(&root).args(["extension-install", "--path"]).arg(&package).output().unwrap());
    assert!(blocked.contains("outside agents are blocked"), "{blocked}");
    assert!(!root.join("extensions").exists(), "a refused package was placed");
    let _ = std::fs::remove_dir_all(&root);
}

#[cfg(feature = "seal-stand-in")]
#[test]
fn an_allowed_choice_lets_a_package_file_through() {
    let root = scratch("ext-path-allowed");
    let key = root.join("stand-in.key");
    std::env::set_var("FORMPORTAL_SEAL_STAND_IN", &key);
    formportal_core::access::set(&root, formportal_core::access::Choice::Allowed).unwrap();
    let out = cli(&root).env("FORMPORTAL_SEAL_STAND_IN", &key).args(["extension-install", "--path"]).arg(root.join("missing-1.0.0.formpkg")).output().unwrap();
    let text = String::from_utf8_lossy(&out.stderr).into_owned();
    assert!(!out.status.success(), "{text}");
    assert!(!text.contains("was refused"), "{text}");
    let _ = std::fs::remove_dir_all(&root);
}

#[cfg(feature = "seal-stand-in")]
#[test]
fn a_choice_the_window_allowed_lets_the_agent_through() {
    let root = scratch("access-allowed");
    let key = root.join("stand-in.key");
    std::env::set_var("FORMPORTAL_SEAL_STAND_IN", &key);
    let view = formportal_core::access::set(&root, formportal_core::access::Choice::Allowed).unwrap();
    assert_eq!(view.seal, "sealed");
    let saved = std::fs::read_to_string(root.join("agent-access.json")).unwrap();
    let out = cli(&root).env("FORMPORTAL_SEAL_STAND_IN", &key).args(["remove", "formvis"]).output().unwrap();
    let text = String::from_utf8_lossy(&out.stderr).into_owned();
    assert!(!text.contains("was refused"), "{text}");
    assert!(text.contains("not installed"), "{text}");
    let blocked = cli(&root).args(["remove", "formvis"]).output().unwrap();
    assert!(String::from_utf8_lossy(&blocked.stderr).contains("only its window can answer"));
    assert_eq!(std::fs::read_to_string(root.join("agent-access.json")).unwrap(), saved);
    let _ = std::fs::remove_dir_all(&root);
}
