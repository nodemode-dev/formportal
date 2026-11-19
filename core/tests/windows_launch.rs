mod support;

use std::path::{Path, PathBuf};

use formportal_core::launch::{self, Choice};
use formportal_core::process::Running;
use formportal_core::CoreError;
use support::*;

const APPS: [(&str, &str, &[&str], &str); 23] = [
    ("formai", "formportal", &["formportal.exe"], "formportal.exe"),
    ("format", "format", &["format-engine.exe", "format.exe"], "format.exe"),
    ("formcel", "formcel", &["formcel-desktop.exe", "formcel-engine.exe"], "formcel-desktop.exe"),
    ("formcut", "formcut", &["formcut-engine.exe", "formcut.exe"], "formcut.exe"),
    ("formdam", "formdam", &["formdam-desktop.exe"], "formdam-desktop.exe"),
    ("formdesign", "formdesign", &["formdesign-core.exe", "formdesign-engine.exe", "formdesign.exe"], "formdesign.exe"),
    ("formencoder", "formencoder", &["formencoder-engine.exe", "formencoder.exe"], "formencoder.exe"),
    ("formext", "form.ext", &["formext-engine.exe", "formext.exe"], "formext.exe"),
    ("formlit", "formlit", &["formlit-engine.exe", "formlit.exe"], "formlit.exe"),
    ("formmcp", "formmcp", &["formmcp.exe"], "formmcp.exe"),
    ("formmd", "form.md", &["form-md-desktop.exe", "form-md-server.exe"], "form-md-desktop.exe"),
    ("formpath", "formpath", &["formpath-engine.exe", "formpath.exe"], "formpath.exe"),
    ("formpdf", "formpdf", &["formpdf-engine.exe", "formpdf.exe"], "formpdf.exe"),
    ("formref", "formref", &["formref-core.exe", "formref-desktop.exe", "formref-engine.exe"], "formref-desktop.exe"),
    ("formskills", "formskills", &["formskills.exe"], "formskills.exe"),
    ("formslide", "formdeck", &["formdeck-engine.exe", "formdeck.exe"], "formdeck.exe"),
    ("formtools", "formtools", &["formtools.exe"], "formtools.exe"),
    ("formtray", "formtray", &["formtray.exe"], "formtray.exe"),
    ("formtxt", "formtxt", &["formtxt-engine.exe", "formtxt.exe"], "formtxt.exe"),
    ("formvfx", "formvfx", &["formvfx-engine.exe", "formvfx.exe"], "formvfx.exe"),
    ("formvis", "formvis", &["formvis-engine.exe", "formvis.exe"], "formvis.exe"),
    ("formwav", "formwav", &["formwav-desktop.exe", "formwav-engine.exe", "fwhost.exe", "fwlv2.exe", "fwnyq.exe", "fwvamp.exe"], "formwav-desktop.exe"),
    ("formweb", "formweb", &["formweb-engine.exe", "formweb.exe"], "formweb.exe"),
];

fn pe(subsystem: u16) -> Vec<u8> {
    let mut bytes = vec![0u8; 0x80 + 24 + 70];
    bytes[..2].copy_from_slice(b"MZ");
    bytes[0x3c] = 0x80;
    bytes[0x80..0x84].copy_from_slice(b"PE\0\0");
    bytes[0x98..0x9a].copy_from_slice(&0x20bu16.to_le_bytes());
    bytes[0x98 + 68..0x98 + 70].copy_from_slice(&subsystem.to_le_bytes());
    bytes
}

fn names(list: &[&str]) -> Vec<String> {
    let mut all: Vec<String> = list.iter().map(|s| s.to_string()).collect();
    all.extend(["LICENSE", "form-app.json", "uninstall.exe"].map(String::from));
    all.sort();
    all
}

fn helpers_console(name: &str) -> Option<Vec<u8>> {
    let stem = launch::program_stem(name)?;
    Some(pe(if launch::helper(&stem) { launch::CONSOLE_PROGRAM } else { launch::WINDOW_PROGRAM }))
}

fn all_window(_: &str) -> Option<Vec<u8>> {
    Some(pe(launch::WINDOW_PROGRAM))
}

fn all_console(_: &str) -> Option<Vec<u8>> {
    Some(pe(launch::CONSOLE_PROGRAM))
}

fn folder(scratch: &Scratch, files: &[(&str, Vec<u8>)]) -> PathBuf {
    let dir = scratch.path().join("apps").join("demo").join("stable").join("1.0.0");
    std::fs::create_dir_all(&dir).unwrap();
    for (name, body) in files {
        std::fs::write(dir.join(name), body).unwrap();
    }
    dir
}

#[test]
fn each_of_the_23_released_apps_opens_its_own_window_program() {
    for (product, app, programs, shell) in APPS {
        let listing = names(programs);
        let known = launch::aliases(Some(app), None);
        let wanted = Choice::Program(shell.to_string());
        assert_eq!(launch::windows_program(product, &known, None, &listing, &helpers_console), wanted, "{product} with its catalogue name");
        assert_eq!(launch::windows_program(product, &[], None, &listing, &helpers_console), wanted, "{product} with no other name known");
        assert_eq!(launch::windows_program(product, &known, None, &listing, &all_window), wanted, "{product} when its helpers are window programs too");
        assert!(matches!(launch::windows_program(product, &known, None, &listing, &all_console), Choice::Unclear(_)), "{product}: a console program is never started as the app");
    }
}

#[test]
fn the_program_named_in_form_app_json_is_used_only_when_it_is_a_plain_exe_in_the_folder() {
    let listing = names(&["studio.exe", "demo-engine.exe", "demo.exe", "notes.txt"]);
    let pick = |declared: &str| launch::windows_program("demo", &[], Some(declared), &listing, &helpers_console);
    assert_eq!(pick("studio.exe"), Choice::Program("studio.exe".to_string()), "a good name wins over the name rule");
    assert_eq!(pick("STUDIO.EXE"), Choice::Program("studio.exe".to_string()));
    for ignored in ["missing.exe", "..\\studio.exe", "../studio.exe", "C:\\Windows\\System32\\cmd.exe", "/bin/sh", ".\\studio.exe", "notes.txt", "studio", "uninstall.exe", "demo-engine.exe", "", ".exe"] {
        assert_eq!(pick(ignored), Choice::Program("demo.exe".to_string()), "launch.windows {ignored:?} is ignored, and the name rule decides");
    }
}

#[test]
fn nothing_is_chosen_when_the_folder_does_not_say_which_program_is_the_app() {
    let two = names(&["alpha.exe", "beta.exe"]);
    assert!(matches!(launch::windows_program("demo", &[], None, &two, &all_window), Choice::Unclear(_)));
    let helpers = names(&["demo-engine.exe", "demo-core.exe"]);
    assert!(matches!(launch::windows_program("demo", &[], None, &helpers, &all_window), Choice::Unclear(_)), "helpers and the uninstaller alone");
    let named = names(&["demo.exe", "demo-engine.exe"]);
    assert!(matches!(launch::windows_program("demo", &[], None, &named, &all_console), Choice::Unclear(_)), "the name says app, the header says console");
    assert!(matches!(launch::windows_program("demo", &[], None, &named, &|_| None), Choice::Unclear(_)), "a header that cannot be read");
    assert_eq!(launch::windows_program("demo", &[], None, &["README.txt".to_string()], &all_window), Choice::Nothing);
}

#[test]
fn the_header_of_a_windows_program_says_window_or_console() {
    assert_eq!(launch::subsystem(&pe(2)), Some(launch::WINDOW_PROGRAM));
    assert_eq!(launch::subsystem(&pe(3)), Some(launch::CONSOLE_PROGRAM));
    assert_eq!(launch::subsystem(&pe(2)[..120]), None, "a cut-off file");
    assert_eq!(launch::subsystem(b"#!/bin/sh\n"), None);
    assert_eq!(launch::subsystem(&[]), None);
}

#[test]
fn the_testers_formvis_folder_gives_formvis_exe_and_a_folder_that_cannot_be_read_gives_a_sentence() {
    let scratch = Scratch::new("windows-launch-folder");
    let dir = folder(&scratch, &[("form-app.json", br#"{"format":"form-app","format_version":2,"id":"formvis","app":"formvis","name":"FormVis"}"#.to_vec()), ("formvis-engine.exe", pe(3)), ("formvis.exe", pe(2)), ("uninstall.exe", pe(2))]);
    std::fs::create_dir_all(dir.join("licenses")).unwrap();
    assert_eq!(launch::windows_target(&dir, "formvis").unwrap(), Some(dir.join("formvis.exe")));

    std::fs::write(dir.join("form-app.json"), br#"{"format":"form-app","name":"FormVis","launch":{"windows":"..\\..\\x.exe"}}"#).unwrap();
    assert_eq!(launch::windows_target(&dir, "formvis").unwrap(), Some(dir.join("formvis.exe")));
    std::fs::write(dir.join("form-app.json"), br#"{"format":"form-app","name":"FormVis","launch":"formvis-engine.exe"}"#).unwrap();
    assert_eq!(launch::windows_target(&dir, "formvis").unwrap(), Some(dir.join("formvis.exe")));

    std::fs::write(dir.join("formvis.exe"), pe(3)).unwrap();
    let refused = launch::windows_target(&dir, "formvis");
    let Err(CoreError::Invalid(message)) = refused else { panic!("{refused:?}") };
    assert!(message.starts_with("FormPortal could not tell which program opens FormVis. "), "{message}");
    assert!(message.contains(&dir.display().to_string()), "{message}");
    assert!(message.contains("Nothing was started"), "{message}");
}

#[cfg(unix)]
fn started(script: &str, quiet_zero: bool) -> launch::Started {
    let child = std::process::Command::new("sh").arg("-c").arg(script).spawn().unwrap();
    launch::Started { pid: child.id(), name: "Demo".to_string(), target: PathBuf::from("/apps/demo/stable/1.0.0/demo.exe"), quiet_zero, cleared: Vec::new(), child }
}

#[cfg(unix)]
#[test]
fn an_app_that_closes_right_after_starting_is_reported_with_its_exit_code() {
    use formportal_core::process;
    use std::time::Duration;
    let message = started("exit 3", true).left_early(Duration::from_secs(5)).expect("an exit with code 3 is told");
    assert!(message.starts_with("Demo did not stay open: it closed right after starting (exit code 3)."), "{message}");
    assert!(message.contains("demo.exe"), "{message}");
    assert_eq!(started("exit 0", true).left_early(Duration::from_secs(5)), None, "a clean exit is quiet where another copy may have taken over");
    assert!(started("exit 0", false).left_early(Duration::from_secs(5)).is_some(), "a clean exit is told when the app was not open before");

    let mut stays = started("exec sleep 30", true);
    assert_eq!(stays.left_early(Duration::from_millis(400)), None, "an app that stays open is not reported");
    assert!(process::stop(stays.pid), "the test stops the one process it started");
    assert!(stays.exit_within(Duration::from_secs(5)).is_some());
}

#[test]
fn only_helpers_inside_the_apps_own_folder_with_no_app_running_are_strays() {
    let scratch = Scratch::new("windows-launch-strays");
    let dir = folder(&scratch, &[]);
    let other = scratch.path().join("apps").join("other").join("stable").join("2.0.0");
    std::fs::create_dir_all(&other).unwrap();
    let at = |pid: u32, path: &Path| Running { pid, path: path.to_path_buf() };
    let engine = at(7816, &dir.join("demo-engine.exe"));
    let shell = at(100, &dir.join("demo.exe"));
    let foreign = at(200, &other.join("demo-engine.exe"));
    assert_eq!(launch::strays(&[engine.clone(), foreign.clone()], &dir), [7816]);
    assert!(!launch::app_open(&[engine.clone(), foreign.clone()], &dir));
    assert!(launch::strays(&[engine.clone(), shell.clone()], &dir).is_empty(), "a helper of an app that is open is left alone");
    assert!(launch::app_open(&[engine, shell], &dir));
    assert!(launch::strays(&[foreign], &dir).is_empty(), "the same name in another folder is never touched");
}
