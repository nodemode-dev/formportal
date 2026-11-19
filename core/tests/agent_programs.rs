#![cfg(unix)]

mod support;

use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use formportal_core::programs::{child_path, find_in, known_dirs, order, shell_dirs};
use formportal_core::Os;
use support::*;

const SHORT: [&str; 4] = ["/usr/bin", "/bin", "/usr/sbin", "/sbin"];

fn program(path: &Path, body: &str) {
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(path, body).unwrap();
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o755)).unwrap();
}

fn short() -> Vec<PathBuf> {
    SHORT.iter().map(PathBuf::from).collect()
}

fn none(_: &str) -> Option<PathBuf> {
    None
}

#[test]
fn a_program_under_the_home_folder_is_found_with_the_short_path() {
    let scratch = Scratch::new("programs-home");
    let home = scratch.path().join("home");
    for (os, folder) in [(Os::Macos, ".claude/local"), (Os::Macos, ".local/bin"), (Os::Linux, ".npm-global/bin"), (Os::Macos, ".volta/bin"), (Os::Linux, ".asdf/shims")] {
        let name = format!("fp-stand-in-{}", folder.replace(['/', '.'], ""));
        program(&home.join(folder).join(&name), "#!/bin/sh\n");
        assert_eq!(find_in(&short(), &name), None, "{folder}");
        let dirs = order(short(), &[], known_dirs(os, &home, &none));
        assert_eq!(find_in(&dirs, &name), Some(home.join(folder).join(&name)), "{folder}");
    }
}

#[test]
fn the_known_folders_name_both_homebrew_prefixes_and_the_newest_nvm_node_first() {
    let scratch = Scratch::new("programs-known");
    let home = scratch.path().join("home");
    for version in ["v18.2.0", "v20.11.0", "v9.9.9"] {
        std::fs::create_dir_all(home.join(".nvm/versions/node").join(version).join("bin")).unwrap();
    }
    let mac = known_dirs(Os::Macos, &home, &none);
    let at = |dir: PathBuf| mac.iter().position(|d| *d == dir).unwrap_or_else(|| panic!("{dir:?} missing from {mac:?}"));
    at(PathBuf::from("/opt/homebrew/bin"));
    at(PathBuf::from("/usr/local/bin"));
    at(home.join(".local/bin"));
    at(home.join(".claude/local"));
    assert!(at(home.join(".nvm/versions/node/v20.11.0/bin")) < at(home.join(".nvm/versions/node/v18.2.0/bin")));
    assert!(at(home.join(".nvm/versions/node/v18.2.0/bin")) < at(home.join(".nvm/versions/node/v9.9.9/bin")));
    let windows = known_dirs(Os::Windows, Path::new("C:\\Users\\someone"), &|name| (name == "APPDATA").then(|| PathBuf::from("C:\\Users\\someone\\AppData\\Roaming")));
    assert!(windows.iter().any(|d| d.to_string_lossy().ends_with("Roaming/npm") || d.to_string_lossy().ends_with("Roaming\\npm")), "{windows:?}");
}

#[test]
fn the_process_path_comes_first_then_the_shell_then_the_known_folders_each_once() {
    let dirs = order(short(), &[PathBuf::from("/from/shell"), PathBuf::from("/usr/bin")], vec![PathBuf::from("/known"), PathBuf::from("/from/shell")]);
    let mut expected = short();
    expected.push(PathBuf::from("/from/shell"));
    expected.push(PathBuf::from("/known"));
    assert_eq!(dirs, expected);
}

#[test]
fn a_file_that_cannot_be_run_is_not_taken() {
    let scratch = Scratch::new("programs-mode");
    let dir = scratch.path().join("bin");
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(dir.join("fp-not-a-program"), "notes").unwrap();
    std::fs::set_permissions(dir.join("fp-not-a-program"), std::fs::Permissions::from_mode(0o644)).unwrap();
    assert_eq!(find_in(&[dir.clone()], "fp-not-a-program"), None);
}

#[test]
fn the_shell_is_asked_for_its_path_and_what_its_profile_prints_is_ignored() {
    let scratch = Scratch::new("programs-shell");
    let shell = scratch.path().join("zsh");
    program(&shell, "#!/bin/sh\necho noise from a profile\nPATH=\"/set/by/the/profile:/usr/bin\"\neval \"$4\"\necho more noise\n");
    assert_eq!(shell_dirs(&shell, Duration::from_secs(5)), Some(vec![PathBuf::from("/set/by/the/profile"), PathBuf::from("/usr/bin")]));
}

#[test]
fn a_shell_that_does_not_answer_is_stopped_at_the_limit_and_an_unknown_shell_is_not_started() {
    let scratch = Scratch::new("programs-slow");
    let slow = scratch.path().join("bash");
    program(&slow, "#!/bin/sh\nexec sleep 20\n");
    let started = Instant::now();
    assert_eq!(shell_dirs(&slow, Duration::from_millis(400)), None);
    assert!(started.elapsed() < Duration::from_secs(5), "{:?}", started.elapsed());
    let marker = scratch.path().join("ran");
    let other = scratch.path().join("tcsh");
    program(&other, &format!("#!/bin/sh\ntouch {}\n", marker.display()));
    assert_eq!(shell_dirs(&other, Duration::from_secs(2)), None);
    assert!(!marker.exists());
}

#[test]
fn a_started_program_gets_its_own_folder_first_on_its_path() {
    let scratch = Scratch::new("programs-child");
    let exe = scratch.path().join("node/bin/fp-agent");
    program(&exe, "#!/bin/sh\n");
    let path = child_path(&exe, &short());
    let dirs: Vec<PathBuf> = std::env::split_paths(&path).collect();
    assert_eq!(dirs[0], scratch.path().join("node/bin"));
    assert!(dirs.ends_with(&short()), "{dirs:?}");
}
