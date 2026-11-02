use crate::share::{PREFIX, PUBLIC_REPO};

pub const PREFIXES: &[&str] = &[
    "https://github.com/nodemode-dev/",
    "https://github.com/sponsors/",
    "https://formai.dev/",
    "https://docs.formai.dev/",
    "https://formai.studio/download/",
];
pub const EXACT: &[&str] = &["https://github.com/login/device"];
const GITHUB: &str = "https://github.com/";

pub fn may_open(url: &str) -> bool {
    if url.chars().any(|c| c.is_whitespace() || c.is_control() || c == '"' || c == '\\') {
        return false;
    }
    EXACT.contains(&url) || PREFIXES.iter().any(|p| url.starts_with(p)) || shared_repository(url)
}

fn shared_repository(url: &str) -> bool {
    let Some(rest) = url.strip_prefix(GITHUB) else { return false };
    let mut parts = rest.splitn(3, '/');
    let (Some(owner), Some(repo)) = (parts.next(), parts.next()) else { return false };
    let repo = repo.split(['#', '?']).next().unwrap_or_default();
    let owner_ok = !owner.is_empty() && owner.len() <= 39 && owner.chars().all(|c| c.is_ascii_alphanumeric() || c == '-');
    let library = repo.strip_prefix(PREFIX).is_some_and(|s| !s.is_empty() && s.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.')));
    owner_ok && (repo == PUBLIC_REPO || library)
}
