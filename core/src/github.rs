use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::download::check_url;
use crate::error::{CoreError, Result};

pub const CLIENT_FILE: &str = include_str!("../github_client.txt");
pub const CLIENT_ENV: &str = "FORMPORTAL_GITHUB_CLIENT_ID";
pub const WEB_ENV: &str = "FORMPORTAL_GITHUB_WEB";
pub const API_ENV: &str = "FORMPORTAL_GITHUB_API";
pub const SIGN_IN_SCOPE: &str = "read:user";
pub const SHARE_SCOPE: &str = "repo";
pub const FORK_SCOPE: &str = "public_repo";
pub const REGISTRY: &str = "nodemode-dev/form.ext-registry";
const KEYCHAIN_SERVICE: &str = "FormPortal GitHub";
const KEYCHAIN_USER: &str = "token";
const GRANT: &str = "urn:ietf:params:oauth:grant-type:device_code";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DeviceCode {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Account {
    pub login: String,
    pub name: Option<String>,
    pub scopes: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "state", rename_all = "kebab-case")]
pub enum Poll {
    Waiting { interval: u64 },
    SignedIn { account: Account },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Status {
    pub configured: bool,
    pub account: Option<Account>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Fork {
    pub repo: String,
    pub url: String,
    pub existed: bool,
}

fn agent() -> &'static ureq::Agent {
    static AGENT: std::sync::OnceLock<ureq::Agent> = std::sync::OnceLock::new();
    AGENT.get_or_init(|| {
        ureq::AgentBuilder::new()
            .timeout_connect(std::time::Duration::from_secs(10))
            .timeout_read(std::time::Duration::from_secs(30))
            .timeout_write(std::time::Duration::from_secs(30))
            .user_agent("FormPortal")
            .build()
    })
}

fn guard(url: &str) -> Result<()> {
    check_url(url)?;
    if url.starts_with("https://github.com/") || url.starts_with("https://api.github.com/") || url.starts_with("http://") {
        return Ok(());
    }
    Err(CoreError::Url(url.to_string()))
}

fn base(env: &str, default: &str) -> String {
    std::env::var(env).ok().map(|v| v.trim_end_matches('/').to_string()).filter(|v| !v.is_empty()).unwrap_or_else(|| default.to_string())
}

pub(crate) fn web() -> String {
    base(WEB_ENV, "https://github.com")
}

fn api() -> String {
    base(API_ENV, "https://api.github.com")
}

pub fn client_id() -> Option<String> {
    std::env::var(CLIENT_ENV)
        .ok()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
        .or_else(|| CLIENT_FILE.lines().map(str::trim).find(|l| !l.is_empty() && !l.starts_with('#')).map(str::to_string))
}

fn need_client() -> Result<String> {
    client_id().ok_or_else(|| CoreError::Account("this FormPortal has no GitHub app set up yet, so signing in is not available; everything else works".to_string()))
}

fn post_form(url: &str, form: &[(&str, &str)]) -> Result<Value> {
    guard(url)?;
    let response = match agent().post(url).set("Accept", "application/json").send_form(form) {
        Ok(r) => r,
        Err(ureq::Error::Status(_, r)) => r,
        Err(e) => return Err(CoreError::Account(format!("GitHub could not be reached ({e})"))),
    };
    read_json(response)
}

fn read_json(response: ureq::Response) -> Result<Value> {
    let body = response.into_string().map_err(|e| CoreError::Account(format!("GitHub's answer could not be read ({e})")))?;
    serde_json::from_str(&body).map_err(|e| CoreError::Account(format!("GitHub's answer could not be read ({e})")))
}

fn text(v: &Value, key: &str) -> String {
    v.get(key).and_then(Value::as_str).unwrap_or_default().to_string()
}

pub fn start(scope: &str) -> Result<DeviceCode> {
    let client = need_client()?;
    let v = post_form(&format!("{}/login/device/code", web()), &[("client_id", &client), ("scope", scope)])?;
    if let Some(error) = v.get("error").and_then(Value::as_str) {
        return Err(CoreError::Account(match error {
            "device_flow_disabled" => "the GitHub app does not have device flow turned on".to_string(),
            _ => format!("GitHub refused to start ({error})"),
        }));
    }
    let code = DeviceCode {
        device_code: text(&v, "device_code"),
        user_code: text(&v, "user_code"),
        verification_uri: text(&v, "verification_uri"),
        expires_in: v.get("expires_in").and_then(Value::as_u64).unwrap_or(900),
        interval: v.get("interval").and_then(Value::as_u64).unwrap_or(5),
    };
    if code.device_code.is_empty() || code.user_code.is_empty() || check_url(&code.verification_uri).is_err() {
        return Err(CoreError::Account("GitHub's answer was missing the code to enter".to_string()));
    }
    Ok(code)
}

pub fn poll(device_code: &str, interval: u64) -> Result<Poll> {
    let client = need_client()?;
    let v = post_form(&format!("{}/login/oauth/access_token", web()), &[("client_id", &client), ("device_code", device_code), ("grant_type", GRANT)])?;
    if let Some(token) = v.get("access_token").and_then(Value::as_str).filter(|t| !t.is_empty()) {
        let account = whoami(token)?;
        store(token, &account)?;
        return Ok(Poll::SignedIn { account });
    }
    match v.get("error").and_then(Value::as_str).unwrap_or("") {
        "authorization_pending" => Ok(Poll::Waiting { interval }),
        "slow_down" => Ok(Poll::Waiting { interval: v.get("interval").and_then(Value::as_u64).unwrap_or(interval + 5) }),
        "expired_token" | "token_expired" => Err(CoreError::Account("the code expired before it was entered; start again".to_string())),
        "access_denied" => Err(CoreError::Account("signing in was cancelled on GitHub".to_string())),
        "device_flow_disabled" => Err(CoreError::Account("the GitHub app does not have device flow turned on".to_string())),
        other => Err(CoreError::Account(format!("GitHub did not sign you in ({})", if other.is_empty() { "no reason given" } else { other }))),
    }
}

fn whoami(token: &str) -> Result<Account> {
    let url = format!("{}/user", api());
    guard(&url)?;
    let response = agent()
        .get(&url)
        .set("Accept", "application/vnd.github+json")
        .set("Authorization", &format!("Bearer {token}"))
        .call()
        .map_err(|e| match e {
            ureq::Error::Status(401, _) => CoreError::Account("GitHub no longer accepts this sign-in; sign in again".to_string()),
            e => CoreError::Account(format!("GitHub could not be reached ({e})")),
        })?;
    let scopes = response.header("X-OAuth-Scopes").unwrap_or("").split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
    let v = read_json(response)?;
    let login = text(&v, "login");
    if login.is_empty() {
        return Err(CoreError::Account("GitHub did not say who is signed in".to_string()));
    }
    Ok(Account { login, name: v.get("name").and_then(Value::as_str).map(str::to_string), scopes })
}

pub struct Signed {
    token: String,
    pub account: Account,
}

pub fn signed_in(scope: Option<&str>) -> Result<Signed> {
    let token = token()?.ok_or_else(|| CoreError::Account("you are not connected; connect from Preferences, Profile, Connect to GitHub first".to_string()))?;
    let account = whoami(&token)?;
    if let Ok(meta) = serde_json::to_value(&account) {
        let _ = crate::keys::set_meta(SLOT.name, &meta);
    }
    if let Some(scope) = scope {
        let covered = account.scopes.iter().any(|s| s == scope || (scope == FORK_SCOPE && s == SHARE_SCOPE));
        if !covered && scope == FORK_SCOPE {
            return Err(CoreError::Account("forking the extension registry needs the public_repo permission; choose Set up my extension registry fork in Preferences, Profile and approve it on GitHub".to_string()));
        }
        if !covered {
            return Err(CoreError::Account("sharing needs access to your repositories; choose Allow sharing in Preferences, Profile (or formportal-cli sign-in --share true)".to_string()));
        }
    }
    Ok(Signed { token, account })
}

pub fn fork_registry() -> Result<Fork> {
    let s = signed_in(Some(FORK_SCOPE))?;
    let name = REGISTRY.rsplit('/').next().unwrap_or(REGISTRY);
    let (status, v) = s.call("GET", &format!("/repos/{}/{name}", s.account.login), None)?;
    let parent = v.pointer("/parent/full_name").and_then(Value::as_str).unwrap_or_default();
    if status == 200 && parent.eq_ignore_ascii_case(REGISTRY) {
        return Ok(Fork { repo: text(&v, "full_name"), url: text(&v, "html_url"), existed: true });
    }
    let (status, v) = s.call("POST", &format!("/repos/{REGISTRY}/forks"), Some(&serde_json::json!({ "default_branch_only": true })))?;
    let repo = text(&v, "full_name");
    if !(200..300).contains(&status) || repo.is_empty() {
        let why = v.get("message").and_then(Value::as_str).unwrap_or("no reason given");
        return Err(CoreError::Account(format!("GitHub did not make the fork ({status}: {why})")));
    }
    let url = text(&v, "html_url");
    Ok(Fork { url: if url.is_empty() { format!("{}/{repo}", web()) } else { url }, repo, existed: false })
}

impl Signed {
    pub fn call(&self, method: &str, path: &str, body: Option<&Value>) -> Result<(u16, Value)> {
        let url = format!("{}{path}", api());
        guard(&url)?;
        let request = agent().request(method, &url).set("Accept", "application/vnd.github+json").set("Authorization", &format!("Bearer {}", self.token));
        let result = match body {
            Some(b) => request.set("Content-Type", "application/json").send_string(&b.to_string()),
            None => request.call(),
        };
        let response = match result {
            Ok(r) => r,
            Err(ureq::Error::Status(_, r)) => r,
            Err(e) => return Err(CoreError::Account(format!("GitHub could not be reached ({e})"))),
        };
        let status = response.status();
        let text = response.into_string().map_err(|e| CoreError::Account(format!("GitHub's answer could not be read ({e})")))?;
        let value = if text.trim().is_empty() { Value::Null } else { serde_json::from_str(&text).unwrap_or(Value::String(text)) };
        Ok((status, value))
    }

    pub fn raw(&self, path: &str, limit: u64) -> Result<Vec<u8>> {
        use std::io::Read;
        let url = format!("{}{path}", api());
        guard(&url)?;
        let response = agent()
            .get(&url)
            .set("Accept", "application/vnd.github.raw+json")
            .set("Authorization", &format!("Bearer {}", self.token))
            .call()
            .map_err(|e| CoreError::Account(format!("a shared file could not be downloaded ({e})")))?;
        let mut bytes = Vec::new();
        response.into_reader().take(limit + 1).read_to_end(&mut bytes)?;
        if bytes.len() as u64 > limit {
            return Err(CoreError::Account("a shared file is larger than FormPortal downloads".to_string()));
        }
        Ok(bytes)
    }
}

const SLOT: crate::keys::Slot<'static> = crate::keys::Slot { service: KEYCHAIN_SERVICE, account: KEYCHAIN_USER, name: "github" };

fn store(token: &str, account: &Account) -> Result<()> {
    let meta = serde_json::to_value(account).map_err(|e| CoreError::State(e.to_string()))?;
    crate::keys::put(SLOT, token, Some(&meta)).map(|_| ())
}

pub fn token() -> Result<Option<String>> {
    Ok(crate::keys::fetch(SLOT))
}

pub fn connected() -> bool {
    crate::keys::summary(SLOT.name).0
}

pub fn token_at_hand() -> Option<String> {
    crate::keys::held(SLOT.name)
}

pub fn status() -> Result<Status> {
    if client_id().is_none() {
        return Ok(Status { configured: false, account: None });
    }
    if !connected() {
        return Ok(Status { configured: true, account: None });
    }
    let account = crate::keys::meta(SLOT.name).and_then(|m| serde_json::from_value::<Account>(m).ok());
    Ok(Status { configured: true, account })
}

pub fn sign_out() -> Result<()> {
    crate::keys::forget(SLOT);
    Ok(())
}
