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
