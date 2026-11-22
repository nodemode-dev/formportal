use crate::share::{PREFIX, PUBLIC_REPO};

pub const PREFIXES: &[&str] = &[
    "https://github.com/nodemode-dev/",
    "https://github.com/sponsors/",
    "https://formai.studio/download/",
    "https://formai.studio/support/",
    "https://github.com/orgs/nodemode-dev/discussions/new?category=replicate-app-request&",
    "https://www.pexels.com/",
    "https://pixabay.com/",
    "https://openverse.org/",
    "https://freesound.org/",
    "https://ccmixter.org/",
    "https://creativecommons.org/licenses/",
    "https://creativecommons.org/publicdomain/",
];
pub const EXACT: &[&str] = &[
    "https://github.com/login/device",
    "https://github.com/settings/applications",
    "https://formai.studio/",
    "https://www.youtube.com/@GetFormAI",
    "https://www.reddit.com/r/FormAI/",
    "https://www.reddit.com/user/nodemode_ai/",
    "https://www.instagram.com/nodemode.ai/",
    "https://www.threads.com/@nodemode.ai",
    "https://www.tiktok.com/@nodemode_ai",
    "https://x.com/nodemode_ai",
    "https://discord.gg/uXqSJevSd",
    "https://console.cloud.google.com/apis/credentials",
];
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
    let fork = crate::github::REGISTRY.rsplit('/').next().is_some_and(|name| repo == name);
    owner_ok && (repo == PUBLIC_REPO || library || fork)
}
