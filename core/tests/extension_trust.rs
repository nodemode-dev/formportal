mod support;

use formportal_core::{CoreError, Portal};
use support::*;

fn package(version: &str) -> Vec<u8> {
    package_of("demo-ext", "formdemo", version)
}

fn package_of(id: &str, product: &str, version: &str) -> Vec<u8> {
    let manifest = format!(r#"{{"format":"formai-package","format_version":1,"id":"{id}","name":"Demo","product":"{product}","kind":"preset","version":"{version}","author":"test","licence":"MIT","native":false}}"#);
    zip_of(&[("manifest.json", manifest.as_bytes()), ("preset.json", b"{}")])
}

#[test]
fn an_extension_whose_version_climbs_out_installs_nothing_and_deletes_nothing() {
    let _env = env_lock();
    std::env::remove_var(POLICY_ENV);
    let scratch = Scratch::new("ext-version");
    let root = scratch.path().join("root");
    let victim = scratch.path().join("victim");
    std::fs::create_dir_all(&victim).unwrap();
    std::fs::write(victim.join("keep.txt"), "keep").unwrap();
    for version in ["../../../../victim", "..", "1.0/../../x", ""] {
        let file = scratch.path().join("evil.formpkg");
        std::fs::write(&file, package(version)).unwrap();
        let refused = Portal::new(&root).install_extension_file(&file, None, false);
        assert!(matches!(refused, Err(CoreError::Archive(_))), "{version:?}: {refused:?}");
    }
    assert_eq!(std::fs::read_to_string(victim.join("keep.txt")).unwrap(), "keep", "the folder outside is untouched");
    assert!(Portal::new(&root).extensions_installed().unwrap().is_empty());
}

#[test]
fn an_extension_with_a_plain_version_installs() {
    let _env = env_lock();
    std::env::remove_var(POLICY_ENV);
    let scratch = Scratch::new("ext-plain");
    let file = scratch.path().join("good.formpkg");
    std::fs::write(&file, package("1.2.0-beta.1")).unwrap();
    let done = Portal::new(scratch.path().join("root")).install_extension_file(&file, None, false).unwrap();
    assert!(done.path.ends_with("formdemo/demo-ext/1.2.0-beta.1"));
    assert!(done.path.join("preset.json").is_file());
}

#[test]
fn a_local_extension_index_must_be_signed() {
    let _env = env_lock();
    let key = signing_key(21);
    std::env::remove_var(KEY_ENV);
    std::env::set_var("FORMEXT_REGISTRY_PUBKEY", public_key(&key));
    std::env::remove_var(POLICY_ENV);
    let scratch = Scratch::new("ext-index");
    let body = br#"{"format":"formai-extensions","format_version":1,"name":"local"}"#;
    let file = scratch.path().join("extensions.json");
    std::fs::write(&file, body).unwrap();
    let portal = Portal::new(scratch.path().join("root"));
    let path = file.to_string_lossy().into_owned();
    assert!(portal.extension_index(&path, false).is_err(), "an unsigned local index is refused");
    portal.extension_index(&path, true).unwrap();
    std::fs::write(scratch.path().join("extensions.json.sig"), sign(&key, body)).unwrap();
    portal.extension_index(&path, false).unwrap();
    std::env::remove_var("FORMEXT_REGISTRY_PUBKEY");
    std::env::set_var(KEY_ENV, public_key(&key));
    assert!(portal.extension_index(&path, false).is_err(), "a catalogue key does not verify the extension index");
    std::env::remove_var(KEY_ENV);
}

#[test]
fn an_extension_id_or_product_that_names_a_drive_is_refused() {
    let _env = env_lock();
    std::env::remove_var(POLICY_ENV);
    let scratch = Scratch::new("ext-drive");
    for (id, product) in [("C:", "formdemo"), ("demo-ext", "C:"), ("a b", "formdemo")] {
        let file = scratch.path().join("drive.formpkg");
        std::fs::write(&file, package_of(id, product, "1.0.0")).unwrap();
        let refused = Portal::new(scratch.path().join("root")).install_extension_file(&file, None, false);
        assert!(matches!(refused, Err(CoreError::Archive(_))), "{id:?} {product:?}: {refused:?}");
    }
}
