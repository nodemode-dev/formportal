mod support;

use formportal_core::signature::verify;
use formportal_core::{CoreError, Portal};
use support::*;

fn body() -> Vec<u8> {
    catalog_json("").into_bytes()
}

#[test]
fn a_valid_signature_is_accepted() {
    let key = signing_key(7);
    let body = body();
    verify(&body, &sign(&key, &body), &[public_key(&key)]).unwrap();
}

#[test]
fn one_changed_byte_in_the_catalogue_is_refused() {
    let key = signing_key(7);
    let body = body();
    let signature = sign(&key, &body);
    for index in [0, body.len() / 2, body.len() - 1] {
        let mut tampered = body.clone();
        tampered[index] ^= 0x01;
        assert!(matches!(verify(&tampered, &signature, &[public_key(&key)]), Err(CoreError::Signature(_))), "byte {index}");
    }
}

#[test]
fn one_changed_byte_in_the_signature_is_refused() {
    let key = signing_key(7);
    let body = body();
    let signature = sign(&key, &body);
    let mut raw = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &signature).unwrap();
    raw[10] ^= 0x01;
    let tampered = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, raw);
    assert!(matches!(verify(&body, &tampered, &[public_key(&key)]), Err(CoreError::Signature(_))));
}

#[test]
fn a_signature_by_an_untrusted_key_is_refused() {
    let body = body();
    assert!(matches!(verify(&body, &sign(&signing_key(9), &body), &[public_key(&signing_key(7))]), Err(CoreError::Signature(_))));
}

#[test]
fn no_trusted_key_means_nothing_verifies() {
    let key = signing_key(7);
    let body = body();
    assert!(matches!(verify(&body, &sign(&key, &body), &[]), Err(CoreError::Signature(_))));
}

#[test]
fn garbage_signatures_are_refused_not_panicked_on() {
    let key = signing_key(7);
    for junk in ["", "not base64 !", "AAAA"] {
        assert!(matches!(verify(&body(), junk, &[public_key(&key)]), Err(CoreError::Signature(_))), "{junk:?}");
    }
}

#[test]
fn the_compiled_in_keys_are_well_formed() {
    for key in formportal_core::signature::compiled_keys() {
        let raw = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &key).expect("base64");
        assert_eq!(raw.len(), 32, "{key}");
    }
}

#[test]
fn the_portal_loads_a_signed_catalogue_and_refuses_a_tampered_one() {
    let _env = env_lock();
    let key = signing_key(11);
    std::env::set_var(KEY_ENV, public_key(&key));
    std::env::remove_var(POLICY_ENV);
    let server = Server::start();
    let body = body();
    let url = server.put("/apps.json", body.clone());
    server.put("/apps.json.sig", sign(&key, &body));
    let root = Scratch::new("trust");
    let portal = Portal::new(root.path());
    portal.catalog(&url, false).unwrap();
    assert!(root.path().join("catalog/apps.json").is_file());

    let mut tampered = body.clone();
    tampered[5] ^= 0x01;
    server.put("/apps.json", tampered);
    let fresh = Scratch::new("trust-tampered");
    assert!(matches!(Portal::new(fresh.path()).catalog(&url, false), Err(CoreError::Signature(_))));
    assert!(!fresh.path().join("catalog/apps.json").exists(), "a refused catalogue must not be kept");
    std::env::remove_var(KEY_ENV);
}

#[test]
fn an_unsigned_catalogue_is_refused_unless_asked_for() {
    let _env = env_lock();
    std::env::remove_var(KEY_ENV);
    std::env::remove_var(POLICY_ENV);
    let server = Server::start();
    let url = server.put("/apps.json", body());
    let root = Scratch::new("unsigned");
    assert!(matches!(Portal::new(root.path()).catalog(&url, false), Err(CoreError::Signature(_))));
    Portal::new(root.path()).catalog(&url, true).unwrap();
}

#[test]
fn a_kept_catalogue_is_checked_again_when_the_source_is_gone() {
    let _env = env_lock();
    let key = signing_key(12);
    std::env::set_var(KEY_ENV, public_key(&key));
    std::env::remove_var(POLICY_ENV);
    let server = Server::start();
    let body = body();
    let url = server.put("/apps.json", body.clone());
    server.put("/apps.json.sig", sign(&key, &body));
    let root = Scratch::new("kept");
    let portal = Portal::new(root.path());
    portal.catalog(&url, false).unwrap();
    server.remove("/apps.json");
    portal.catalog(&url, false).unwrap();
    let mut tampered = body.clone();
    tampered[3] ^= 0x01;
    std::fs::write(root.path().join("catalog/apps.json"), tampered).unwrap();
    assert!(matches!(portal.catalog(&url, false), Err(CoreError::Signature(_))));
    std::env::remove_var(KEY_ENV);
}

#[test]
fn a_catalogue_over_plain_http_elsewhere_is_refused() {
    let _env = env_lock();
    std::env::remove_var(POLICY_ENV);
    let root = Scratch::new("plain-http");
    assert!(matches!(Portal::new(root.path()).catalog("http://example.com/apps.json", true), Err(CoreError::Url(_))));
}
