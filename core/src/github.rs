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
    check_url(url)?;
    let response = match ureq::post(url).set("Accept", "application/json").send_form(form) {
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
    token()?;
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
        store(token)?;
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
    check_url(&url)?;
    let response = ureq::get(&url)
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
    let token = token()?.ok_or_else(|| CoreError::Account("you are not signed in; sign in from Preferences, Account first".to_string()))?;
    let account = whoami(&token)?;
    if let Some(scope) = scope {
        if !account.scopes.iter().any(|s| s == scope) {
            return Err(CoreError::Account("sharing needs access to your repositories; choose Allow sharing in Preferences, Account (or formportal-cli sign-in --share true)".to_string()));
        }
    }
    Ok(Signed { token, account })
}

impl Signed {
    pub fn call(&self, method: &str, path: &str, body: Option<&Value>) -> Result<(u16, Value)> {
        let url = format!("{}{path}", api());
        check_url(&url)?;
        let request = ureq::request(method, &url).set("Accept", "application/vnd.github+json").set("Authorization", &format!("Bearer {}", self.token));
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
        check_url(&url)?;
        let response = ureq::get(&url)
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

fn entry() -> Result<keyring::Entry> {
    keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_USER).map_err(keychain)
}

fn keychain(e: keyring::Error) -> CoreError {
    CoreError::Account(format!("the system keychain is not available ({e}); FormPortal does not keep a GitHub sign-in anywhere else"))
}

fn store(token: &str) -> Result<()> {
    entry()?.set_password(token).map_err(keychain)
}

pub fn token() -> Result<Option<String>> {
    match entry()?.get_password() {
        Ok(t) => Ok(Some(t)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(keychain(e)),
    }
}

pub fn status() -> Result<Status> {
    if client_id().is_none() {
        return Ok(Status { configured: false, account: None });
    }
    let Some(token) = token()? else { return Ok(Status { configured: true, account: None }) };
    Ok(Status { configured: true, account: Some(whoami(&token)?) })
}

pub fn sign_out() -> Result<()> {
    match entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(keychain(e)),
    }
}
