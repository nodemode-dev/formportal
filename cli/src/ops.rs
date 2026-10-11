use std::fs;

use formportal_core::{Availability, Catalog, Channel, CoreError, Platform, Portal, CORE_VERSION};
use serde_json::{json, Map, Value};

pub const DEFAULT_SOURCE: &str = "https://formai.dev/catalog/v1/apps.json";
const REGISTRY: &str = include_str!("../../catalog/products.json");

pub struct Ctx {
    pub portal: Portal,
    pub source: String,
    pub allow_unsigned: bool,
}

impl Ctx {
    pub fn from_env() -> Self {
        let source = std::env::var("FORMPORTAL_CATALOG").ok().filter(|s| !s.trim().is_empty()).unwrap_or_else(|| DEFAULT_SOURCE.to_string());
        let allow_unsigned = matches!(std::env::var("FORMPORTAL_ALLOW_UNSIGNED").as_deref(), Ok("1") | Ok("true"));
        Ctx { portal: Portal::new(Portal::default_root()), source, allow_unsigned }
    }
}

pub fn fail(message: impl Into<String>) -> CoreError {
    CoreError::Invalid(message.into())
}

fn text(args: &Value, key: &str) -> Option<String> {
    args.get(key).and_then(Value::as_str).map(str::to_string).filter(|s| !s.is_empty())
}

fn flag(args: &Value, key: &str) -> Option<bool> {
    args.get(key).and_then(Value::as_bool)
}

pub fn channel(args: &Value) -> Result<Channel, CoreError> {
    match text(args, "channel").as_deref() {
        None | Some("stable") => Ok(Channel::Stable),
        Some("beta") => Ok(Channel::Beta),
        Some("nightly") => Ok(Channel::Nightly),
        Some(other) => Err(fail(format!("there is no channel {other:?}; the channels are stable, beta and nightly"))),
    }
}

fn product(args: &Value) -> Result<String, CoreError> {
    text(args, "product").ok_or_else(|| fail("no product was given; pass a product id such as formcut, formvis or formencoder (apps lists them)"))
}

fn load(ctx: &Ctx, args: &Value) -> Result<(Catalog, String), CoreError> {
    let source = text(args, "source").unwrap_or_else(|| ctx.source.clone());
    let allow = flag(args, "allow_unsigned").unwrap_or(ctx.allow_unsigned);
    let catalog = if source.starts_with("http://") || source.starts_with("https://") {
        ctx.portal.catalog(&source, allow)?
    } else {
        Catalog::from_json(&fs::read_to_string(&source)?)?
    };
    Ok((catalog, source))
}

fn registry() -> Vec<Value> {
    serde_json::from_str::<Value>(REGISTRY)
        .ok()
        .and_then(|v| v.get("products").and_then(Value::as_array).cloned())
        .unwrap_or_default()
}

fn word(a: Availability) -> &'static str {
    match a {
        Availability::Unreleased => "unreleased",
        Availability::NoRelease => "no-release",
        Availability::Available => "available",
        Availability::OtherPlatform => "other-platform",
    }
}

pub fn status(ctx: &Ctx) -> Result<Value, CoreError> {
    let installs = ctx.portal.state()?.installs;
    Ok(json!({
        "formportal": CORE_VERSION,
        "platform": Platform::current(),
        "root": ctx.portal.root(),
        "catalog_source": ctx.source,
        "allow_unsigned": ctx.allow_unsigned,
        "trusted_keys": { "compiled": formportal_core::signature::compiled_keys().len(), "total": formportal_core::signature::trusted_keys().len() },
        "installed": installs.len(),
        "installs": installs,
        "next": "apps lists the family and what this computer is offered; install, open, rollback and remove act on one product and channel."
    }))
}

pub fn apps(ctx: &Ctx, args: &Value) -> Result<Value, CoreError> {
    let platform = Platform::current();
    let installs = ctx.portal.state()?.installs;
    let loaded = load(ctx, args);
    let (catalog, note) = match loaded {
        Ok((catalog, source)) => (Some(catalog), json!({ "source": source })),
        Err(e) => (None, json!({ "catalog_error": e.to_string() })),
    };
    let mut rows = Vec::new();
    for entry in registry() {
        let id = entry.get("id").and_then(Value::as_str).unwrap_or_default().to_string();
        if id.is_empty() {
            continue;
        }
        let mut row = Map::new();
        for key in ["id", "name", "kind", "summary", "alt_of", "group", "status", "repository"] {
            if let Some(v) = entry.get(key) {
                row.insert(key.to_string(), v.clone());
            }
        }
        let mut channels = Map::new();
        for ch in [Channel::Stable, Channel::Beta] {
            let installed = installs.iter().find(|i| i.product == id && i.channel == ch).map(|i| i.current.version.clone());
            let offered = catalog.as_ref().map(|c| {
                let v = c.view(&id, ch, platform);
                json!({ "availability": word(v.availability), "version": v.version, "bytes": v.artifact.map(|a| a.bytes) })
            });
            channels.insert(formportal_core::portal::channel_name(ch).to_string(), json!({ "offered": offered, "installed": installed }));
        }
        row.insert("channels".to_string(), Value::Object(channels));
        rows.push(Value::Object(row));
    }
    Ok(json!({ "catalog": note, "fixture": catalog.as_ref().map(|c| c.fixture), "apps": rows }))
}

pub fn info(ctx: &Ctx, args: &Value) -> Result<Value, CoreError> {
    let id = product(args)?;
    let (catalog, source) = load(ctx, args)?;
    let entry = registry().into_iter().find(|p| p.get("id").and_then(Value::as_str) == Some(id.as_str()));
    let release = catalog.product(&id).cloned();
    if entry.is_none() && release.is_none() {
        return Err(fail(format!("{id}: not in the family registry or the catalogue; apps lists the ids")));
    }
    Ok(json!({ "source": source, "registry": entry, "catalog": release }))
}

pub fn installs(ctx: &Ctx) -> Result<Value, CoreError> {
    let rows: Vec<Value> = ctx
        .portal
        .state()?
        .installs
        .into_iter()
        .map(|i| {
            let open: Vec<u32> = ctx.portal.running(&i.product, i.channel).iter().map(|r| r.pid).collect();
            let mut v = serde_json::to_value(&i).unwrap_or(Value::Null);
            if let Some(o) = v.as_object_mut() {
                o.insert("open_processes".to_string(), json!(open));
            }
            v
        })
        .collect();
    Ok(json!({ "root": ctx.portal.root(), "installs": rows }))
}

pub fn install(ctx: &Ctx, args: &Value, progress: &mut dyn FnMut(u64, u64)) -> Result<Value, CoreError> {
    let id = product(args)?;
    let ch = channel(args)?;
    let (catalog, _) = load(ctx, args)?;
    let view = catalog.view(&id, ch, Platform::current());
    let (Availability::Available, Some(version), Some(artifact)) = (view.availability, view.version, view.artifact) else {
        return Err(CoreError::Unavailable(format!("{id} on {} ({})", formportal_core::portal::channel_name(ch), word(view.availability))));
    };
    let done = ctx.portal.install(&id, ch, version, artifact, progress)?;
    let opens = ctx.portal.launch_target(&id, ch).ok();
    let still_open: Vec<u32> = ctx.portal.running(&id, ch).iter().filter(|r| !r.path.starts_with(&done.current.path)).map(|r| r.pid).collect();
    let note = if still_open.is_empty() { None } else { Some(format!("an earlier copy is still open (process {}); it keeps running untouched, and {version} opens next time", still_open.iter().map(|p| p.to_string()).collect::<Vec<_>>().join(", "))) };
    Ok(json!({ "installed": done, "opens": opens, "verified_sha256": artifact.sha256, "still_open": still_open, "note": note }))
}

pub fn open(ctx: &Ctx, args: &Value) -> Result<Value, CoreError> {
    let id = product(args)?;
    let ch = channel(args)?;
    let target = ctx.portal.launch_target(&id, ch)?;
    let pid = ctx.portal.launch(&id, ch)?;
    Ok(json!({ "opened": target, "pid": pid }))
}

pub fn rollback(ctx: &Ctx, args: &Value) -> Result<Value, CoreError> {
    let id = product(args)?;
    let ch = channel(args)?;
    Ok(json!({ "rolled_back": ctx.portal.rollback(&id, ch)? }))
}

pub fn remove(ctx: &Ctx, args: &Value) -> Result<Value, CoreError> {
    let id = product(args)?;
    let ch = channel(args)?;
    ctx.portal.uninstall(&id, ch)?;
    Ok(json!({ "removed": id, "channel": formportal_core::portal::channel_name(ch) }))
}
