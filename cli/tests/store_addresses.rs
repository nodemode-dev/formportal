use std::path::PathBuf;

use formportal_cli::ops::DEFAULT_SOURCE;

const STORE: &str = "https://dl.formai.studio";

fn repo_file(path: &str) -> String {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
    std::fs::read_to_string(root.join(path)).unwrap_or_else(|e| panic!("{path}: {e}"))
}

#[test]
fn the_default_catalogue_is_the_public_download_store() {
    assert_eq!(DEFAULT_SOURCE, format!("{STORE}/catalog/apps.json"));
    assert_eq!(format!("{DEFAULT_SOURCE}.sig"), format!("{STORE}/catalog/apps.json.sig"));
    let window = repo_file("frontend/src/bridge/tauri.ts");
    assert!(window.contains(&format!("export const DEFAULT_CATALOG = \"{DEFAULT_SOURCE}\";")), "the window and the command line share one default");
}

#[test]
fn updates_are_read_from_and_point_at_the_download_store() {
    let config: serde_json::Value = serde_json::from_str(&repo_file("src-tauri/tauri.conf.json")).unwrap();
    assert_eq!(config["plugins"]["updater"]["endpoints"], serde_json::json!([format!("{STORE}/formportal/updates/latest.json")]));
    let packer = repo_file("setup/package_release.py");
    assert!(packer.contains(&format!("STORE = \"{STORE}/formportal\"")), "latest.json names files at <store>/formportal/<version>/<file>");
    assert!(packer.contains("f\"{STORE}/{version()}/{p['file']}\""));
    for text in [packer.as_str(), &repo_file("src-tauri/tauri.conf.json")] {
        assert!(!text.contains("formcompiler/releases"), "formcompiler's private release page never serves the public");
    }
}
