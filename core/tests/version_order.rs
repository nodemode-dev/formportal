use formportal_core::version_newer;

#[test]
fn prerelease_numbers_compare_as_numbers() {
    assert!(version_newer("1.0.0-beta.10", "1.0.0-beta.9"));
    assert!(!version_newer("1.0.0-beta.9", "1.0.0-beta.10"));
    assert!(version_newer("1.0.0-beta.2", "1.0.0-beta.1"));
}

#[test]
fn prerelease_order_follows_semver() {
    let ordered = ["1.0.0-alpha", "1.0.0-alpha.1", "1.0.0-alpha.beta", "1.0.0-beta", "1.0.0-beta.2", "1.0.0-beta.11", "1.0.0-rc.1", "1.0.0"];
    for (i, older) in ordered.iter().enumerate() {
        for newer in &ordered[i + 1..] {
            assert!(version_newer(newer, older), "{newer} > {older}");
            assert!(!version_newer(older, newer), "{older} < {newer}");
        }
        assert!(!version_newer(older, older), "{older} is not newer than itself");
    }
}

#[test]
fn release_numbers_still_compare_as_before() {
    assert!(version_newer("1.10.0", "1.9.0"));
    assert!(version_newer("v2.0.0", "1.99.99"));
    assert!(!version_newer("1.0.0", "1.0.0"));
    assert!(version_newer("1.0.1-beta.1", "1.0.0"));
}

#[test]
fn build_metadata_is_ignored_and_long_numbers_compare_by_value() {
    assert!(version_newer("1.0.1+b", "1.0.0"));
    assert!(!version_newer("1.0.0", "1.0.0+b-1"));
    assert!(!version_newer("1.0.0+b", "1.0.0"));
    assert!(version_newer("1.0.0-beta.100000000000000000000", "1.0.0-beta.99999999999999999999"));
}
