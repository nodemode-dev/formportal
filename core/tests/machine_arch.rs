use std::cell::RefCell;
use std::collections::BTreeMap;

use formportal_core::{Arch, Artifact, ArtifactKind, Availability, Catalog, Channel, Os, Platform, Product, ProductState, Release};

fn artifact(os: Os, arch: Arch, file: &str) -> Artifact {
    Artifact { platform: os, arch, kind: ArtifactKind::Dmg, file: file.into(), url: format!("https://dl.example/{file}"), bytes: 1, sha256: "0".repeat(64), minimum_os: String::new(), signature: None }
}

fn release(artifacts: Vec<Artifact>) -> Release {
    Release { version: "1.0.0".into(), published: "2026-11-09".into(), notes: String::new(), commit: None, artifacts, history: Vec::new(), agents: None, origin: None }
}

fn shipped(os: Os, which: &str) -> Release {
    let arm = || artifact(os, Arch::Arm64, "app-arm64.dmg");
    let intel = || artifact(os, Arch::X86_64, "app-x64.dmg");
    match which {
        "arm64" => release(vec![arm()]),
        "x86_64" => release(vec![intel()]),
        "both" => release(vec![intel(), arm()]),
        "universal" => release(vec![artifact(os, Arch::Arm64, "app-universal.dmg"), artifact(os, Arch::X86_64, "app-universal.dmg")]),
        other => panic!("no release shape {other}"),
    }
}

fn mac(arch: Arch) -> Platform {
    Platform { os: Os::Macos, arch }
}

fn chosen(platform: Platform, which: &str) -> Option<(Arch, String)> {
    shipped(platform.os, which).artifact_for(platform).map(|a| (a.arch, a.file.clone()))
}

#[test]
fn apple_silicon_takes_the_arm64_build_whenever_there_is_one() {
    let m = mac(Arch::Arm64);
    assert_eq!(chosen(m, "arm64"), Some((Arch::Arm64, "app-arm64.dmg".into())));
    assert_eq!(chosen(m, "both"), Some((Arch::Arm64, "app-arm64.dmg".into())));
    assert_eq!(chosen(m, "universal"), Some((Arch::Arm64, "app-universal.dmg".into())));
}

#[test]
fn apple_silicon_falls_back_to_intel_only_when_no_arm64_build_exists() {
    let m = mac(Arch::Arm64);
    assert_eq!(chosen(m, "x86_64"), Some((Arch::X86_64, "app-x64.dmg".into())));
    let only_intel = shipped(Os::Macos, "x86_64");
    assert!(m.translated(only_intel.artifact_for(m).unwrap()));
    let both = shipped(Os::Macos, "both");
    assert!(!m.translated(both.artifact_for(m).unwrap()));
}

#[test]
fn an_intel_mac_never_gets_an_arm64_build() {
    let m = mac(Arch::X86_64);
    assert_eq!(chosen(m, "arm64"), None);
    assert_eq!(chosen(m, "x86_64"), Some((Arch::X86_64, "app-x64.dmg".into())));
    assert_eq!(chosen(m, "both"), Some((Arch::X86_64, "app-x64.dmg".into())));
    assert_eq!(chosen(m, "universal"), Some((Arch::X86_64, "app-universal.dmg".into())));
}

#[test]
fn windows_follows_the_same_rule_and_linux_never_crosses() {
    let win_arm = Platform { os: Os::Windows, arch: Arch::Arm64 };
    let win_x64 = Platform { os: Os::Windows, arch: Arch::X86_64 };
    assert_eq!(chosen(win_arm, "x86_64").map(|c| c.0), Some(Arch::X86_64));
    assert_eq!(chosen(win_arm, "both").map(|c| c.0), Some(Arch::Arm64));
    assert_eq!(chosen(win_x64, "arm64"), None);
    let linux_arm = Platform { os: Os::Linux, arch: Arch::Arm64 };
    let linux_x64 = Platform { os: Os::Linux, arch: Arch::X86_64 };
    assert_eq!(chosen(linux_arm, "x86_64"), None);
    assert_eq!(chosen(linux_x64, "arm64"), None);
    assert_eq!(chosen(linux_arm, "both").map(|c| c.0), Some(Arch::Arm64));
}

#[test]
fn another_systems_build_is_never_offered() {
    let windows_only = release(vec![artifact(Os::Windows, Arch::X86_64, "app-x64.msi")]);
    assert!(windows_only.artifact_for(mac(Arch::Arm64)).is_none());
    assert!(windows_only.artifact_for(mac(Arch::X86_64)).is_none());
}

fn catalog_with(channel: Release) -> Catalog {
    let mut older = shipped(Os::Macos, "both");
    older.version = "0.9.0".into();
    let mut latest = channel;
    latest.history = vec![older];
    let product = Product {
        id: "formpdf".into(),
        name: "FormPDF".into(),
        kind: "app".into(),
        summary: String::new(),
        identifier: "studio.formai.pdf".into(),
        repository: String::new(),
        licence: String::new(),
        project_extensions: Vec::new(),
        state: ProductState::Live,
        agents: None,
        channels: BTreeMap::from([(Channel::Stable, latest)]),
    };
    Catalog { format: "formai-catalog".into(), format_version: 1, generated: String::new(), origin: String::new(), fixture: true, products: vec![product] }
}

#[test]
fn the_catalogue_view_says_an_arm64_only_app_is_not_for_an_intel_mac() {
    let catalog = catalog_with(shipped(Os::Macos, "arm64"));
    let intel = catalog.view("formpdf", Channel::Stable, mac(Arch::X86_64));
    assert_eq!(intel.availability, Availability::OtherPlatform);
    assert!(intel.artifact.is_none());
    let apple = catalog.view("formpdf", Channel::Stable, mac(Arch::Arm64));
    assert_eq!(apple.availability, Availability::Available);
    assert_eq!(apple.artifact.map(|a| a.arch), Some(Arch::Arm64));
    let versions = catalog.versions("formpdf", Channel::Stable, mac(Arch::X86_64));
    assert_eq!(versions.iter().map(|v| v.artifact.map(|a| a.arch)).collect::<Vec<_>>(), vec![None, Some(Arch::X86_64)]);
}

fn probe(answers: &[(&str, &str)]) -> (impl Fn(&str) -> Option<String>, std::rc::Rc<RefCell<Vec<String>>>) {
    let asked = std::rc::Rc::new(RefCell::new(Vec::new()));
    let seen = asked.clone();
    let answers: Vec<(String, String)> = answers.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect();
    let f = move |key: &str| {
        seen.borrow_mut().push(key.to_string());
        answers.iter().find(|(k, _)| k == key).map(|(_, v)| v.clone())
    };
    (f, asked)
}

#[test]
fn an_intel_build_under_rosetta_sees_apple_silicon() {
    let (f, _) = probe(&[("hw.optional.arm64", "1\n"), ("sysctl.proc_translated", "1\n")]);
    assert_eq!(Platform::detect(Os::Macos, Arch::X86_64, &f), mac(Arch::Arm64));
    let (f, _) = probe(&[("sysctl.proc_translated", "1")]);
    assert_eq!(Platform::detect(Os::Macos, Arch::X86_64, &f), mac(Arch::Arm64));
}

#[test]
fn an_intel_mac_stays_intel() {
    let (f, _) = probe(&[("hw.optional.arm64", "0"), ("sysctl.proc_translated", "0")]);
    assert_eq!(Platform::detect(Os::Macos, Arch::X86_64, &f), mac(Arch::X86_64));
    let (f, _) = probe(&[]);
    assert_eq!(Platform::detect(Os::Macos, Arch::X86_64, &f), mac(Arch::X86_64));
    let (f, _) = probe(&[("hw.optional.arm64", "garbage")]);
    assert_eq!(Platform::detect(Os::Macos, Arch::X86_64, &f), mac(Arch::X86_64));
}

#[test]
fn a_native_arm64_build_needs_no_probe_and_other_systems_ignore_it() {
    let (f, asked) = probe(&[]);
    assert_eq!(Platform::detect(Os::Macos, Arch::Arm64, &f), mac(Arch::Arm64));
    assert!(asked.borrow().is_empty());
    let (f, asked) = probe(&[("hw.optional.arm64", "1"), ("sysctl.proc_translated", "1")]);
    assert_eq!(Platform::detect(Os::Linux, Arch::X86_64, &f), Platform { os: Os::Linux, arch: Arch::X86_64 });
    assert_eq!(Platform::detect(Os::Windows, Arch::X86_64, &f), Platform { os: Os::Windows, arch: Arch::X86_64 });
    assert!(asked.borrow().is_empty());
}

#[cfg(all(target_os = "macos", target_arch = "x86_64"))]
#[test]
fn this_process_reports_the_machine_not_its_own_build() {
    let translated = std::process::Command::new("/usr/sbin/sysctl").args(["-n", "sysctl.proc_translated"]).output().map(|o| String::from_utf8_lossy(&o.stdout).trim() == "1").unwrap_or(false);
    let expected = if translated { Arch::Arm64 } else { Arch::X86_64 };
    assert_eq!(Platform::current().arch, expected);
}

#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
#[test]
fn a_native_arm64_process_reports_apple_silicon() {
    assert_eq!(Platform::current(), mac(Arch::Arm64));
}
