use std::path::PathBuf;

use formportal_core::links::may_open;

fn repo_file(path: &str) -> String {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
    std::fs::read_to_string(root.join(path)).unwrap_or_else(|e| panic!("{path}: {e}"))
}

fn literals(text: &str) -> Vec<String> {
    text.match_indices("https://")
        .map(|(at, _)| text[at..].chars().take_while(|c| !matches!(c, '"' | '\'' | '`' | '<' | '>' | ')' | '$' | '{') && !c.is_whitespace()).collect())
        .collect()
}

fn web_anchors(html: &str) -> Vec<String> {
    let mut found = Vec::new();
    for tag in html.split("<a ").skip(1) {
        let tag = tag.split('>').next().unwrap_or_default();
        if !tag.contains("data-web") {
            continue;
        }
        if let Some(href) = tag.split("href=\"").nth(1).and_then(|r| r.split('"').next()) {
            if href != "#" {
                found.push(href.to_string());
            }
        }
    }
    found
}

#[test]
fn every_link_the_interface_opens_is_allowed() {
    let html = repo_file("frontend/index.html");
    let anchors = web_anchors(&html);
    assert!(anchors.len() >= 9, "{anchors:?}");
    let pages = literals(&format!("{}\n{}", repo_file("frontend/vite.config.ts"), repo_file("frontend/markup.ts")));
    assert!(pages.iter().any(|u| u == "https://formai.studio/download/"), "{pages:?}");
    let products: serde_json::Value = serde_json::from_str(&repo_file("catalog/products.json")).unwrap();
    let mut app_pages = Vec::new();
    for product in products["products"].as_array().unwrap() {
        if let Some(repo) = product["repository"].as_str().filter(|r| r.starts_with("https://github.com/nodemode-dev/")) {
            for tail in ["#readme", "/issues/new", "/discussions"] {
                app_pages.push(format!("{repo}{tail}"));
            }
        }
    }
    assert!(!app_pages.is_empty());
    let sign_in = "https://github.com/login/device".to_string();
    let shared = [
        "https://github.com/octo-cat/formportal-library-holiday-photos".to_string(),
        "https://github.com/octo-cat/formportal-public".to_string(),
        "https://github.com/octo-cat/formportal-public/blob/main/0a1b2c3d4e5f/cut.mp4".to_string(),
        "https://github.com/sponsors/nodemode-dev".to_string(),
    ];
    for url in anchors.iter().chain(&pages).chain(&app_pages).chain(std::iter::once(&sign_in)).chain(&shared) {
        assert!(may_open(url), "{url} is refused");
    }
}

#[test]
fn anything_else_is_refused() {
    for url in [
        "http://formai.studio/download/",
        "http://github.com/nodemode-dev/formportal",
        "https://formai.studio/",
        "https://formai.studio.example.com/download/",
        "https://formai.studio.example.com/support/",
        "https://github.com/someone/anything",
        "https://github.com/login/device/../../someone/anything",
        "https://github.com/someone/formportal-library-",
        "https://github.com/some_one/formportal-public",
        "https://github.com/nodemode-dev/formportal\" --flag",
        "https://formai.studio/download/ x",
        "https://formai.studio/download/\\@example.com",
        "file:///etc/passwd",
        "javascript:alert(1)",
        "",
    ] {
        assert!(!may_open(url), "{url} is allowed");
    }
}
