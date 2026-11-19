use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use serde_json::{json, Value};

fn repo() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap().to_path_buf()
}

fn manifest() -> Value {
    let text = std::fs::read_to_string(repo().join("agents").join("manifest.json")).expect("agents/manifest.json is committed");
    serde_json::from_str(&text).unwrap()
}

fn listed() -> Vec<Value> {
    let root = std::env::temp_dir().join(format!("formportal-cli-test-{}-manifest", std::process::id()));
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
        writeln!(stdin, "{}", json!({ "jsonrpc": "2.0", "id": 1, "method": "tools/list" })).unwrap();
    }
    let out = child.wait_with_output().unwrap();
    let _ = std::fs::remove_dir_all(&root);
    assert!(out.status.success(), "{}", String::from_utf8_lossy(&out.stderr));
    let reply: Value = serde_json::from_str(String::from_utf8_lossy(&out.stdout).lines().next().unwrap()).unwrap();
    reply["result"]["tools"].as_array().unwrap().clone()
}

fn names(value: &Value) -> Vec<String> {
    value.as_array().unwrap().iter().map(|n| n.as_str().unwrap().to_string()).collect()
}

fn folders(of: &Path, marker: &str) -> Vec<String> {
    let mut found: Vec<String> = match std::fs::read_dir(of) {
        Ok(entries) => entries.flatten().filter(|e| e.path().join(marker).is_file()).map(|e| e.file_name().to_string_lossy().to_string()).collect(),
        Err(_) => Vec::new(),
    };
    found.sort();
    found
}

#[test]
fn the_committed_manifest_names_the_tools_the_server_lists() {
    let manifest = manifest();
    let tools = listed();
    let all: Vec<String> = tools.iter().map(|t| t["name"].as_str().unwrap().to_string()).collect();
    let read_only: Vec<String> = tools.iter().filter(|t| t["annotations"]["readOnlyHint"] == json!(true)).map(|t| t["name"].as_str().unwrap().to_string()).collect();
    assert_eq!(names(&manifest["mcp"]["tools"]), all, "run ./formportal agents sync");
    assert_eq!(names(&manifest["mcp"]["read_only"]), read_only, "run ./formportal agents sync");
    for gated in names(&manifest["mcp"]["approval_gated"]) {
        assert!(all.contains(&gated), "{gated} is not a listed tool");
    }
    assert_eq!(manifest["mcp"]["transports"], json!(["stdio"]));
}

#[test]
fn the_committed_manifest_names_the_skills_on_disk() {
    let manifest = manifest();
    let skills = repo().join(".claude").join("skills");
    let on_disk = folders(&skills, "SKILL.md");
    let named: Vec<String> = manifest["skills"].as_array().unwrap().iter().map(|s| s["name"].as_str().unwrap().to_string()).collect();
    assert_eq!(named, on_disk, "run ./formportal agents sync");
    for skill in manifest["skills"].as_array().unwrap() {
        let subs = folders(&skills.join(skill["name"].as_str().unwrap()).join("sub-skills"), "SUB-SKILL.md");
        assert_eq!(names(&skill["sub_skills"]), subs, "run ./formportal agents sync");
    }
}

#[test]
fn the_committed_manifest_has_exactly_the_keys_the_schema_requires() {
    let manifest = manifest();
    let mut keys: Vec<&str> = manifest.as_object().unwrap().keys().map(String::as_str).collect();
    keys.sort();
    assert_eq!(keys, ["app", "dock", "extensions", "format", "mcp", "skills", "version"]);
    assert_eq!(manifest["format"], json!("form-agent-manifest"));
    assert_eq!(manifest["version"], json!(1));
    assert_eq!(manifest["app"], json!("formportal"));
}
