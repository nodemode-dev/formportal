mod support;

use formportal_core::download::download;
use formportal_core::{Arch, Artifact, ArtifactKind, Channel, CoreError, Os, Portal};
use support::*;

const APP: &str = "demo";

fn release(server: &Server, version: &str) -> Artifact {
    let body = zip_of(&[("bin/demo", format!("demo {version}").as_bytes()), ("README.txt", b"demo app")]);
    let file = format!("demo-{version}.zip");
    let url = server.put(&format!("/{file}"), body.clone());
    Artifact { platform: Os::Linux, arch: Arch::X86_64, kind: ArtifactKind::Zip, file, url, bytes: body.len() as u64, sha256: sha256(&body), minimum_os: String::new(), signature: None }
}

fn quiet() -> impl FnMut(u64, u64) {
    |_, _| {}
}

fn no_policy() -> std::sync::MutexGuard<'static, ()> {
    let guard = env_lock();
    std::env::remove_var(POLICY_ENV);
    guard
}

#[test]
fn a_download_is_kept_only_when_its_sha256_matches() {
    let _env = no_policy();
    let server = Server::start();
    let good = release(&server, "1.0.0");
    let dir = Scratch::new("download");
    let path = download(&good, dir.path(), &mut quiet()).unwrap();
    assert_eq!(sha256(&std::fs::read(&path).unwrap()), good.sha256);

    let mut bad = release(&server, "1.0.1");
    bad.sha256 = "0".repeat(64);
    let other = Scratch::new("download-bad");
    let refused = download(&bad, other.path(), &mut quiet());
    assert!(matches!(refused, Err(CoreError::Hash { .. })), "{refused:?}");
    assert!(tree(other.path()).is_empty(), "a refused download leaves nothing behind: {:?}", tree(other.path()));
}

#[test]
fn a_tampered_download_installs_nothing() {
    let _env = no_policy();
    let server = Server::start();
    let artifact = release(&server, "1.0.0");
    server.put(&format!("/{}", artifact.file), zip_of(&[("bin/demo", b"something else")]));
    let root = Scratch::new("tampered");
    let portal = Portal::new(root.path());
    assert!(matches!(portal.install(APP, Channel::Stable, "1.0.0", &artifact, &mut quiet()), Err(CoreError::Hash { .. })));
    assert!(!root.path().join("apps").exists());
    assert!(portal.state().unwrap().installs.is_empty());
}

#[test]
fn install_update_rollback_and_remove_leave_exactly_the_expected_files() {
    let _env = no_policy();
    let server = Server::start();
    let root = Scratch::new("lifecycle");
    let portal = Portal::new(root.path());
    let base = "apps/demo/stable";

    let first = portal.install(APP, Channel::Stable, "1.0.0", &release(&server, "1.0.0"), &mut quiet()).unwrap();
    assert_eq!(first.current.version, "1.0.0");
    assert!(first.previous.is_none());
    let installed: Vec<String> = tree(root.path()).into_iter().filter(|p| p.starts_with("apps/")).collect();
    assert_eq!(installed, ["apps/", "apps/demo/", "apps/demo/stable/", "apps/demo/stable/1.0.0.files.json", "apps/demo/stable/1.0.0/", "apps/demo/stable/1.0.0/README.txt", "apps/demo/stable/1.0.0/bin/", "apps/demo/stable/1.0.0/bin/demo"]);
    assert_eq!(std::fs::read_to_string(root.path().join(base).join("1.0.0/bin/demo")).unwrap(), "demo 1.0.0");
    assert!(tree(&root.path().join("downloads")).is_empty(), "the archive is removed after unpacking");

    let second = portal.install(APP, Channel::Stable, "1.1.0", &release(&server, "1.1.0"), &mut quiet()).unwrap();
    assert_eq!(second.current.version, "1.1.0");
    assert_eq!(second.previous.as_ref().map(|p| p.version.as_str()), Some("1.0.0"), "an update keeps the previous version for rollback");
    assert!(root.path().join(base).join("1.0.0/bin/demo").is_file());

    let third = portal.install(APP, Channel::Stable, "1.2.0", &release(&server, "1.2.0"), &mut quiet()).unwrap();
    assert_eq!(third.previous.as_ref().map(|p| p.version.as_str()), Some("1.1.0"));
    let versions: Vec<String> = tree(&root.path().join(base)).into_iter().filter(|p| !p.contains('/') || p.matches('/').count() == 1 && p.ends_with('/')).collect();
    assert_eq!(versions, ["1.1.0.files.json", "1.1.0/", "1.2.0.files.json", "1.2.0/"], "only the current and the previous version stay");

    let back = portal.rollback(APP, Channel::Stable).unwrap();
    assert_eq!(back.current.version, "1.1.0");
    assert_eq!(back.previous.as_ref().map(|p| p.version.as_str()), Some("1.2.0"));
    assert_eq!(portal.state().unwrap().get(APP, Channel::Stable).unwrap().current.version, "1.1.0");
    assert!(portal.launch_target(APP, Channel::Stable).unwrap().starts_with(root.path().join(base).join("1.1.0")));

    portal.uninstall(APP, Channel::Stable).unwrap();
    assert!(!root.path().join(base).exists());
    assert!(portal.state().unwrap().installs.is_empty());
}

#[test]
fn rollback_with_nothing_earlier_is_refused_and_changes_nothing() {
    let _env = no_policy();
    let server = Server::start();
    let root = Scratch::new("no-previous");
    let portal = Portal::new(root.path());
    portal.install(APP, Channel::Stable, "1.0.0", &release(&server, "1.0.0"), &mut quiet()).unwrap();
    assert!(matches!(portal.rollback(APP, Channel::Stable), Err(CoreError::NotInstalled(_))));
    assert_eq!(portal.state().unwrap().get(APP, Channel::Stable).unwrap().current.version, "1.0.0");
    assert!(matches!(portal.uninstall("never-installed", Channel::Stable), Err(CoreError::NotInstalled(_))));
}

#[test]
fn beta_installs_beside_stable() {
    let _env = no_policy();
    let server = Server::start();
    let root = Scratch::new("beta");
    let portal = Portal::new(root.path());
    portal.install(APP, Channel::Stable, "1.0.0", &release(&server, "1.0.0"), &mut quiet()).unwrap();
    portal.install(APP, Channel::Beta, "1.1.0", &release(&server, "1.1.0"), &mut quiet()).unwrap();
    assert_eq!(portal.state().unwrap().installs.len(), 2);
    portal.uninstall(APP, Channel::Beta).unwrap();
    assert!(root.path().join("apps/demo/stable/1.0.0/bin/demo").is_file());
}

#[test]
fn a_zip_that_writes_outside_its_folder_is_refused() {
    let _env = no_policy();
    let server = Server::start();
    let body = zip_of(&[("../escape.txt", b"out")]);
    let url = server.put("/evil.zip", body.clone());
    let artifact = Artifact { platform: Os::Linux, arch: Arch::X86_64, kind: ArtifactKind::Zip, file: "evil.zip".into(), url, bytes: body.len() as u64, sha256: sha256(&body), minimum_os: String::new(), signature: None };
    let root = Scratch::new("escape");
    assert!(matches!(Portal::new(root.path()).install(APP, Channel::Stable, "1.0.0", &artifact, &mut quiet()), Err(CoreError::Archive(_))));
    assert!(!root.path().join("apps/demo/escape.txt").exists() && !root.path().join("apps/demo/stable/escape.txt").exists());
    assert!(Portal::new(root.path()).state().unwrap().installs.is_empty());
}

fn with_policy(text: &str, run: impl FnOnce(&Portal, &Scratch)) {
    let _env = env_lock();
    let dir = Scratch::new("policy");
    let file = dir.path().join("policy.json");
    std::fs::write(&file, text).unwrap();
    std::env::set_var(POLICY_ENV, &file);
    let root = Scratch::new("policy-root");
    run(&Portal::new(root.path()), &root);
    std::env::remove_var(POLICY_ENV);
}

#[test]
fn the_organisations_policy_refuses_an_app_it_does_not_list_before_downloading() {
    let server = Server::start();
    let artifact = release(&server, "1.0.0");
    with_policy(r#"{"format":"formportal-policy","managed_by":"Acme","apps":["other"]}"#, |portal, root| {
        let refused = portal.install(APP, Channel::Stable, "1.0.0", &artifact, &mut quiet());
        assert!(matches!(&refused, Err(CoreError::Policy(m)) if m.contains("Acme")), "{refused:?}");
        assert_eq!(server.hits_of(&format!("/{}", artifact.file)), 0, "nothing is downloaded for a refused app");
        assert!(!root.path().join("apps").exists());
    });
}

#[test]
fn the_organisations_policy_refuses_a_channel_it_does_not_allow() {
    let server = Server::start();
    let artifact = release(&server, "1.1.0");
    with_policy(r#"{"format":"formportal-policy","channels":["stable"]}"#, |portal, _| {
        assert!(matches!(portal.install(APP, Channel::Beta, "1.1.0", &artifact, &mut quiet()), Err(CoreError::Policy(_))));
        portal.install(APP, Channel::Stable, "1.1.0", &artifact, &mut quiet()).unwrap();
    });
}

#[test]
fn a_broken_policy_file_stops_every_install() {
    let server = Server::start();
    let artifact = release(&server, "1.0.0");
    for broken in ["{not json", r#"{"format":"something-else"}"#, r#"{"format":"formportal-policy","unknown_key":true}"#] {
        with_policy(broken, |portal, _| {
            assert!(matches!(portal.install(APP, Channel::Stable, "1.0.0", &artifact, &mut quiet()), Err(CoreError::Policy(_))), "{broken}");
        });
    }
}
