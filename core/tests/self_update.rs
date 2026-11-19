use formportal_core::links::may_open;
use formportal_core::selfupdate::{action, newer, Action, DOWNLOAD_PAGE};
use formportal_core::{Catalog, Platform};

fn catalog(listed: &str) -> Catalog {
    let channels = if listed.is_empty() { "{}".to_string() } else { format!(r#"{{"stable":{{"version":"{listed}","published":"2026-11-19T00:00:00Z","notes":"","artifacts":[]}}}}"#) };
    let text = format!(
        r#"{{"format":"formai-catalog","format_version":1,"generated":"2026-11-19T00:00:00Z","origin":"test","products":[{{"id":"formai","name":"formai","kind":"portal","summary":"s","identifier":"studio.formai.portal","repository":"https://github.com/nodemode-dev/formportal","licence":"GPL-3.0-only","state":"live","channels":{channels}}}]}}"#
    );
    serde_json::from_str(&text).unwrap()
}

#[test]
fn a_newer_formportal_in_the_catalogue_is_reported_with_the_page_that_has_it() {
    let found = newer(&catalog("0.65.0"), Platform::current(), "0.64.1").unwrap();
    assert_eq!(found.version, "0.65.0");
    assert_eq!(found.page, DOWNLOAD_PAGE);
    assert!(may_open(&found.page));
}

#[test]
fn the_same_an_older_or_no_listed_version_is_not_an_update() {
    assert_eq!(newer(&catalog("0.65.0"), Platform::current(), "0.65.0"), None);
    assert_eq!(newer(&catalog("0.65.0"), Platform::current(), "0.66.0"), None);
    assert_eq!(newer(&catalog(""), Platform::current(), "0.64.1"), None);
}

#[test]
fn the_action_is_install_only_when_the_in_place_feed_has_that_version() {
    let found = newer(&catalog("0.65.0"), Platform::current(), "0.64.1");
    assert_eq!(action(found.as_ref(), None), Action::Download);
    assert_eq!(action(found.as_ref(), Some("0.64.1")), Action::Download);
    assert_eq!(action(found.as_ref(), Some("0.65.0")), Action::Install);
    assert_eq!(action(found.as_ref(), Some("0.66.0")), Action::Install);
    assert_eq!(action(None, Some("0.65.0")), Action::None);
    assert_eq!(serde_json::to_string(&Action::Download).unwrap(), "\"download\"");
}
