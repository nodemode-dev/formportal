use std::io::Write;
use std::process::{Command, Stdio};

fn ask(lines: &[serde_json::Value]) -> Vec<serde_json::Value> {
    let root = std::env::temp_dir().join(format!("formportal-cli-test-{}-mcp-unknown", std::process::id()));
    std::fs::create_dir_all(&root).unwrap();
    let mut child = Command::new(env!("CARGO_BIN_EXE_formportal-cli"))
        .arg("mcp")
        .env("FORMPORTAL_ROOT", &root)
        .env_remove("FORMPORTAL_POLICY")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    {
        let mut stdin = child.stdin.take().unwrap();
        for line in lines {
            writeln!(stdin, "{line}").unwrap();
        }
    }
    let out = child.wait_with_output().unwrap();
    let _ = std::fs::remove_dir_all(&root);
    assert!(out.status.success(), "{}", String::from_utf8_lossy(&out.stderr));
    String::from_utf8_lossy(&out.stdout).lines().map(|l| serde_json::from_str(l).unwrap()).collect()
}

#[test]
fn an_unknown_tool_is_refused_without_a_tool_count() {
    let replies = ask(&[
        serde_json::json!({ "jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": { "name": "no_such_tool", "arguments": {} } }),
        serde_json::json!({ "jsonrpc": "2.0", "id": 2, "method": "tools/list" }),
    ]);
    assert_eq!(replies.len(), 2);
    let result = &replies[0]["result"];
    assert_eq!(result["isError"], serde_json::json!(true));
    let text = result["content"][0]["text"].as_str().unwrap();
    assert!(text.contains("no tool named \"no_such_tool\""), "{text}");
    assert!(text.contains("tools/list names every tool"), "{text}");
    assert!(!text.chars().any(|c| c.is_ascii_digit()), "{text}");
    let lower = text.to_lowercase();
    for word in ["three", "thirty", "forty", "tools/list has"] {
        assert!(!lower.contains(word), "{text}");
    }
    assert!(replies[1]["result"]["tools"].as_array().map(|t| !t.is_empty()).unwrap_or(false));
}
