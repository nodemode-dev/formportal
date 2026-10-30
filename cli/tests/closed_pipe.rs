use std::process::{Command, Stdio};

fn run_with_closed_stdout(args: &[&str]) -> (Option<i32>, String) {
    let root = std::env::temp_dir().join(format!("formportal-cli-test-{}-{}", std::process::id(), args.join("-")));
    std::fs::create_dir_all(&root).unwrap();
    let (reader, writer) = std::io::pipe().unwrap();
    drop(reader);
    let out = Command::new(env!("CARGO_BIN_EXE_formportal-cli"))
        .args(args)
        .env("FORMPORTAL_ROOT", &root)
        .env_remove("FORMPORTAL_POLICY")
        .stdin(Stdio::null())
        .stdout(writer)
        .stderr(Stdio::piped())
        .output()
        .unwrap();
    let _ = std::fs::remove_dir_all(&root);
    (out.status.code(), String::from_utf8_lossy(&out.stderr).into_owned())
}

#[test]
fn a_closed_output_pipe_ends_the_command_quietly() {
    for args in [&["help"][..], &["installs"][..], &["status"][..]] {
        let (code, stderr) = run_with_closed_stdout(args);
        assert_eq!(code, Some(0), "{args:?} exited {code:?}: {stderr}");
        assert!(!stderr.contains("panicked"), "{args:?}: {stderr}");
    }
}

#[test]
fn the_command_still_prints_when_someone_reads() {
    let root = std::env::temp_dir().join(format!("formportal-cli-test-{}-read", std::process::id()));
    std::fs::create_dir_all(&root).unwrap();
    let out = Command::new(env!("CARGO_BIN_EXE_formportal-cli")).arg("installs").env("FORMPORTAL_ROOT", &root).env_remove("FORMPORTAL_POLICY").output().unwrap();
    let _ = std::fs::remove_dir_all(&root);
    assert!(out.status.success());
    let body: serde_json::Value = serde_json::from_slice(&out.stdout).unwrap();
    assert_eq!(body["installs"], serde_json::json!([]));
}

#[test]
fn an_unknown_command_fails_with_usage() {
    let out = Command::new(env!("CARGO_BIN_EXE_formportal-cli")).arg("no-such-command").output().unwrap();
    assert_eq!(out.status.code(), Some(2));
    assert!(String::from_utf8_lossy(&out.stderr).contains("unknown command"));
}

#[test]
fn an_agent_cannot_turn_off_the_catalogue_signature_check() {
    let root = std::env::temp_dir().join(format!("formportal-cli-test-{}-unsigned", std::process::id()));
    std::fs::create_dir_all(&root).unwrap();
    let catalogue = root.join("apps.json");
    std::fs::write(&catalogue, r#"{"format":"formai-catalog","format_version":1,"generated":"2026-10-26T00:00:00Z","origin":"test","products":[]}"#).unwrap();
    let call = serde_json::json!({ "jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": { "name": "apps", "arguments": { "source": catalogue, "allow_unsigned": true } } });
    let mut child = Command::new(env!("CARGO_BIN_EXE_formportal-cli"))
        .arg("mcp")
        .env("FORMPORTAL_ROOT", &root)
        .env_remove("FORMPORTAL_POLICY")
        .env_remove("FORMPORTAL_ALLOW_UNSIGNED")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .unwrap();
    std::io::Write::write_all(child.stdin.as_mut().unwrap(), format!("{call}\n").as_bytes()).unwrap();
    drop(child.stdin.take());
    let out = child.wait_with_output().unwrap();
    let _ = std::fs::remove_dir_all(&root);
    let reply: serde_json::Value = serde_json::from_slice(&out.stdout).unwrap();
    let error = reply.pointer("/result/structuredContent/catalog/catalog_error").and_then(serde_json::Value::as_str).unwrap_or_default();
    assert!(error.contains("not signed"), "an unsigned local catalogue is refused even when the agent asks: {error:?}");
}
