use std::fs;

use formportal_core::{Availability, Catalog, Channel, CoreError, Platform, Portal, CORE_VERSION};
use serde_json::{json, Map, Value};

pub const DEFAULT_SOURCE: &str = "https://github.com/nodemode-ai/formcompiler/releases/download/catalog/apps.json";
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
    let (source, _, _) = ctx.portal.source(&source, allow)?;
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
    let managed = ctx.portal.policy()?;
    Ok(json!({
        "formportal": CORE_VERSION,
        "managed": managed.as_ref().map(|m| json!({ "by": m.policy.managed_by, "path": m.path, "system": m.system, "locked": m.policy.locked() })),
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
                o.insert("mcp_server".to_string(), json!(matches!(ctx.portal.agent_surface(&i.product, i.channel), Ok(Some(_)))));
            }
            v
        })
        .collect();
    Ok(json!({ "root": ctx.portal.root(), "installs": rows, "next": "an install with mcp_server true can be connected to Claude Code, Codex and Cursor with connect_agents" }))
}

pub fn project_extensions() -> std::collections::BTreeMap<String, String> {
    formportal_core::files::extensions_from_registry(REGISTRY)
}

fn path_arg(args: &Value) -> Result<std::path::PathBuf, CoreError> {
    text(args, "path").or_else(|| text(args, "product")).map(std::path::PathBuf::from).ok_or_else(|| fail("give the full path of the file or folder"))
}

pub fn files(ctx: &Ctx, args: &Value) -> Result<Value, CoreError> {
    let exts = project_extensions();
    let scan = ctx.portal.scan_files(&exts, text(args, "query").as_deref())?;
    let limit = args.get("limit").and_then(Value::as_u64).unwrap_or(200) as usize;
    let total = scan.files.len();
    let shown: Vec<_> = scan.files.iter().take(limit).collect();
    Ok(json!({
        "folders": scan.folders,
        "files": shown,
        "total": total,
        "truncated": scan.truncated,
        "new_versions": scan.new_versions,
        "opens": exts,
        "suggested_folder": formportal_core::files::suggested_folder(),
        "next": if scan.folders.is_empty() { "No folder yet: folders with action add and a path (the suggested folder is a good start)." } else { "open_file opens one in its app; file_versions lists, saves or goes back to versions." }
    }))
}

pub fn folders(ctx: &Ctx, args: &Value) -> Result<Value, CoreError> {
    match text(args, "action").as_deref() {
        Some("add") => {
            let path = text(args, "path").map(std::path::PathBuf::from).unwrap_or_else(formportal_core::files::suggested_folder);
            let folder = ctx.portal.add_folder(&path, flag(args, "keep_versions").unwrap_or(true), flag(args, "create").unwrap_or(false))?;
            Ok(json!({ "added": folder }))
        }
        Some("remove") => {
            let path = path_arg(args)?;
            ctx.portal.remove_folder(&path)?;
            Ok(json!({ "removed": path, "note": "The folder and its files are untouched; FormPortal only stops listing them. Their kept versions stay until removed from the history folder." }))
        }
        _ => Ok(json!({ "folders": ctx.portal.folders()?, "suggested_folder": formportal_core::files::suggested_folder() })),
    }
}

pub fn open_file(ctx: &Ctx, args: &Value) -> Result<Value, CoreError> {
    let path = path_arg(args)?;
    let (product, pid) = ctx.portal.open_file(&path, &project_extensions())?;
    Ok(json!({ "opened": path, "with": product, "pid": pid }))
}

pub fn file_versions(ctx: &Ctx, args: &Value) -> Result<Value, CoreError> {
    let path = path_arg(args)?;
    match text(args, "action").as_deref() {
        Some("save") => Ok(json!({ "saved": ctx.portal.save_version(&path)?, "versions": ctx.portal.file_versions(&path)? })),
        Some("revert") => {
            let id = text(args, "version").or_else(|| text(args, "to")).ok_or_else(|| fail("give the version id to go back to (from file_versions)"))?;
            let now = ctx.portal.revert_file(&path, &id)?;
            Ok(json!({ "reverted": path, "to": id, "now": now, "note": "The file as it was just before is kept as a version too." }))
        }
        _ => Ok(json!({ "path": path, "versions": ctx.portal.file_versions(&path)? })),
    }
}

pub fn storage(ctx: &Ctx) -> Result<Value, CoreError> {
    Ok(json!({ "storage": ctx.portal.storage()? }))
}

fn fonts_source(ctx: &Ctx, args: &Value) -> String {
    text(args, "fonts_source").or_else(|| std::env::var("FORMPORTAL_FONTS").ok().filter(|s| !s.trim().is_empty())).unwrap_or_else(|| {
        let base = text(args, "source").unwrap_or_else(|| ctx.source.clone());
        match base.rsplit_once('/') {
            Some((dir, _)) => format!("{dir}/fonts.json"),
            None => "fonts.json".to_string(),
        }
    })
}

pub fn fonts(ctx: &Ctx, args: &Value) -> Result<Value, CoreError> {
    let allow = flag(args, "allow_unsigned").unwrap_or(ctx.allow_unsigned);
    let installed = ctx.portal.fonts_installed()?;
    let (index, error) = match ctx.portal.font_index(&fonts_source(ctx, args), allow) {
        Ok(i) => (Some(i), None),
        Err(e) => (None, Some(e.to_string())),
    };
    let q = text(args, "query").map(|q| q.to_lowercase());
    let families: Vec<Value> = index
        .as_ref()
        .map(|i| {
            i.families
                .iter()
                .filter(|f| q.as_ref().map(|q| format!("{} {} {}", f.family, f.foundry, f.category).to_lowercase().contains(q.as_str())).unwrap_or(true))
                .map(|f| {
                    let have: Vec<&str> = installed.iter().filter(|x| x.family_id.as_deref() == Some(f.id.as_str())).map(|x| x.style.as_str()).collect();
                    json!({ "id": f.id, "family": f.family, "foundry": f.foundry, "licence": f.licence, "category": f.category, "styles": f.styles.iter().map(|s| json!({ "style": s.style, "weight": s.weight, "italic": s.italic, "bytes": s.bytes, "installed": have.contains(&s.style.as_str()) })).collect::<Vec<_>>() })
                })
                .collect()
        })
        .unwrap_or_default();
    let updates = index.as_ref().map(|i| ctx.portal.font_updates(i)).transpose()?.unwrap_or_default();
    Ok(json!({ "font_folder": formportal_core::fonts::font_dir(), "index_error": error, "families": families, "installed": installed, "updates": updates, "note": "Fonts install for this user only; every app sees them, usually after it restarts. A style in updates has a newer file in the index; font_install with its id and style installs it." }))
}

pub fn font_install(ctx: &Ctx, args: &Value, progress: &mut dyn FnMut(u64, u64)) -> Result<Value, CoreError> {
    if let Some(path) = text(args, "path") {
        let font = ctx.portal.add_own_font(std::path::Path::new(&path), flag(args, "rights_confirmed").unwrap_or(false))?;
        return Ok(json!({ "added": font, "note": "Added for this user. Apps see it after they restart." }));
    }
    let id = text(args, "id").or_else(|| text(args, "product")).ok_or_else(|| fail("give a family id from fonts, or the path of your own font file"))?;
    let allow = flag(args, "allow_unsigned").unwrap_or(ctx.allow_unsigned);
    let index = ctx.portal.font_index(&fonts_source(ctx, args), allow)?;
    let done = ctx.portal.install_font(&index, &id, text(args, "style").as_deref(), progress)?;
    Ok(json!({ "installed": done, "note": "Installed for this user. Apps see new fonts after they restart." }))
}

pub fn font_remove(ctx: &Ctx, args: &Value) -> Result<Value, CoreError> {
    let family = text(args, "family").or_else(|| text(args, "id")).or_else(|| text(args, "product")).ok_or_else(|| fail("give the family (or its id) to remove"))?;
    Ok(json!({ "removed": ctx.portal.remove_font(&family, text(args, "style").as_deref())? }))
}

fn media_source(ctx: &Ctx, args: &Value) -> String {
    text(args, "media_source").or_else(|| std::env::var("FORMPORTAL_MEDIA").ok().filter(|s| !s.trim().is_empty())).unwrap_or_else(|| {
        let base = text(args, "source").unwrap_or_else(|| ctx.source.clone());
        match base.rsplit_once('/') {
            Some((dir, _)) => format!("{dir}/media.json"),
            None => "media.json".to_string(),
        }
    })
}

pub fn media(ctx: &Ctx, args: &Value) -> Result<Value, CoreError> {
    let allow = flag(args, "allow_unsigned").unwrap_or(ctx.allow_unsigned);
    let saved = ctx.portal.saved_media()?;
    let (index, error) = match ctx.portal.media_index(&media_source(ctx, args), allow) {
        Ok(i) => (Some(i), None),
        Err(e) => (None, Some(e.to_string())),
    };
    let words: Vec<String> = text(args, "query").map(|q| q.to_lowercase().split_whitespace().map(str::to_string).collect()).unwrap_or_default();
    let kind = text(args, "kind");
    let items: Vec<Value> = index
        .as_ref()
        .map(|i| {
            i.items
                .iter()
                .filter(|m| kind.as_ref().map(|k| &m.kind == k).unwrap_or(true))
                .filter(|m| {
                    let hay = format!("{} {} {} {}", m.title, m.creator, m.kind, m.tags.join(" ")).to_lowercase();
                    words.iter().all(|w| hay.contains(w.as_str()))
                })
                .map(|m| {
                    let mut v = serde_json::to_value(m).unwrap_or(Value::Null);
                    if let Some(o) = v.as_object_mut() {
                        o.insert("saved".to_string(), json!(saved.iter().any(|s| s.id == m.id)));
                        o.insert("credit".to_string(), json!(formportal_core::media::credit_line(m)));
                    }
                    v
                })
                .collect()
        })
        .unwrap_or_default();
    Ok(json!({ "library": formportal_core::media::library_dir(), "index_error": error, "items": items, "saved": saved }))
}

pub fn media_save(ctx: &Ctx, args: &Value, progress: &mut dyn FnMut(u64, u64)) -> Result<Value, CoreError> {
    let id = text(args, "id").or_else(|| text(args, "product")).ok_or_else(|| fail("give an item id from media"))?;
    let allow = flag(args, "allow_unsigned").unwrap_or(ctx.allow_unsigned);
    let index = ctx.portal.media_index(&media_source(ctx, args), allow)?;
    if flag(args, "use").unwrap_or(false) {
        let folder = text(args, "folder").map(std::path::PathBuf::from);
        let path = ctx.portal.use_template(&index, &id, folder.as_deref(), progress)?;
        let opened = ctx.portal.open_file(&path, &project_extensions()).ok().map(|(p, _)| p);
        return Ok(json!({ "copied_to": path, "opened_with": opened, "note": if opened.is_none() { "Copied; its app is not installed, so it was not opened." } else { "Copied into the projects folder and opened." } }));
    }
    let saved = ctx.portal.save_media(&index, &id, progress)?;
    Ok(json!({ "saved": saved, "note": "Keep the credit line with the work where the licence asks for it (CC BY and CC BY-SA do; CC0 does not)." }))
}

pub fn media_remove(ctx: &Ctx, args: &Value) -> Result<Value, CoreError> {
    let id = text(args, "id").or_else(|| text(args, "product")).ok_or_else(|| fail("give the saved item's id"))?;
    Ok(json!({ "removed": ctx.portal.remove_media(&id)? }))
}

fn learn_source(ctx: &Ctx, args: &Value) -> String {
    text(args, "learn_source").or_else(|| std::env::var("FORMPORTAL_LEARN").ok().filter(|s| !s.trim().is_empty())).unwrap_or_else(|| {
        let base = text(args, "source").unwrap_or_else(|| ctx.source.clone());
        match base.rsplit_once('/') {
            Some((dir, _)) => format!("{dir}/learn.json"),
            None => "learn.json".to_string(),
        }
    })
}

fn tutorials(ctx: &Ctx, args: &Value) -> (Vec<formportal_core::learn::Tutorial>, Option<String>) {
    let allow = flag(args, "allow_unsigned").unwrap_or(ctx.allow_unsigned);
    let mut list = formportal_core::learn::bundled().tutorials;
    let error = match ctx.portal.learn_index(&learn_source(ctx, args), allow) {
        Ok(i) => {
            let own: Vec<String> = list.iter().map(|t| t.id.clone()).collect();
            list.extend(i.tutorials.into_iter().filter(|t| t.product != "formportal" && !own.contains(&t.id)));
            None
        }
        Err(e) => Some(e.to_string()),
    };
    (list, error)
}

pub fn learn(ctx: &Ctx, args: &Value) -> Result<Value, CoreError> {
    let (list, error) = tutorials(ctx, args);
    let progress = ctx.portal.learn_progress()?;
    let words: Vec<String> = text(args, "query").map(|q| q.to_lowercase().split_whitespace().map(str::to_string).collect()).unwrap_or_default();
    let only = text(args, "product");
    let items: Vec<Value> = list
        .iter()
        .filter(|t| only.as_ref().map(|p| &t.product == p).unwrap_or(true))
        .filter(|t| {
            let hay = format!("{} {} {} {}", t.title, t.summary, t.product, t.level).to_lowercase();
            words.iter().all(|w| hay.contains(w.as_str()))
        })
        .map(|t| {
            let done: Vec<usize> = progress.done.get(&t.id).map(|s| s.iter().map(|n| n + 1).collect()).unwrap_or_default();
            let mut v = serde_json::to_value(t).unwrap_or(Value::Null);
            if let Some(o) = v.as_object_mut() {
                o.insert("done_steps".to_string(), json!(done));
                o.insert("finished".to_string(), json!(done.len() == t.steps.len()));
            }
            v
        })
        .collect();
    Ok(json!({ "index_error": error, "tutorials": items }))
}

pub fn learn_progress(ctx: &Ctx, args: &Value) -> Result<Value, CoreError> {
    let id = text(args, "id").or_else(|| text(args, "product")).ok_or_else(|| fail("give the tutorial's id"))?;
    let (list, _) = tutorials(ctx, args);
    let tutorial = list.iter().find(|t| t.id == id).ok_or_else(|| fail(format!("there is no tutorial {id}")))?;
    let progress = if flag(args, "reset").unwrap_or(false) {
        ctx.portal.learn_reset(&id)?
    } else {
        let step = args.get("step").and_then(|v| v.as_u64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).ok_or_else(|| fail("give the step number (1 is the first), or reset true"))? as usize;
        if step == 0 {
            return Err(fail("steps are numbered from 1"));
        }
        ctx.portal.learn_mark(tutorial, step - 1, flag(args, "done").unwrap_or(true))?
    };
    let done: Vec<usize> = progress.done.get(&id).map(|s| s.iter().map(|n| n + 1).collect()).unwrap_or_default();
    Ok(json!({ "id": id, "title": tutorial.title, "done_steps": done, "steps": tutorial.steps.len(), "finished": done.len() == tutorial.steps.len() }))
}

pub fn ask(ctx: &Ctx, args: &Value, command: std::path::PathBuf, prefix: Vec<String>, tools: Vec<String>) -> Result<Value, CoreError> {
    let question = text(args, "question").or_else(|| text(args, "product")).ok_or_else(|| fail("give the question"))?;
    let agents = formportal_core::assistant::assistant_agents();
    let client = text(args, "client").or_else(|| agents.iter().find(|a| a.path.is_some()).map(|a| a.client.clone())).ok_or_else(|| fail("neither Claude Code nor Codex is installed on this computer (neither is on PATH)"))?;
    let mut env = vec![("FORMPORTAL_ROOT".to_string(), ctx.portal.root().to_string_lossy().to_string()), ("FORMPORTAL_CATALOG".to_string(), ctx.source.clone())];
    if ctx.allow_unsigned {
        env.push(("FORMPORTAL_ALLOW_UNSIGNED".to_string(), "1".to_string()));
    }
    let server = formportal_core::assistant::Server { command, args: prefix, env, tools };
    let answer = formportal_core::assistant::ask_agent(&client, &question, &server, &ctx.portal.root().join("assistant"))?;
    Ok(json!({ "client": client, "answer": answer }))
}

pub fn app_agents(ctx: &Ctx, args: &Value) -> Result<Value, CoreError> {
    let id = product(args)?;
    let ch = channel(args)?;
    let surface = ctx.portal.agent_surface(&id, ch)?;
    Ok(json!({
        "product": id,
        "channel": formportal_core::portal::channel_name(ch),
        "server_name": formportal_core::agents::server_name(&id, ch),
        "mcp_server": surface,
        "clients": ctx.portal.agent_clients(&id, ch),
        "note": if surface.is_some() { "connect_agents adds it to the clients; FormPortal starts the installed version each time, so updates need no change." } else { "No MCP server found in this install: the app ships none yet, or it is not installed. An app declares one in form-app.json." }
    }))
}

pub fn connect_agents(ctx: &Ctx, args: &Value) -> Result<Value, CoreError> {
    let id = product(args)?;
    let ch = channel(args)?;
    let clients: Vec<formportal_core::agents::Client> = match args.get("clients") {
        Some(Value::Array(list)) => list.iter().filter_map(Value::as_str).map(|c| formportal_core::agents::Client::parse(c).ok_or_else(|| fail(format!("there is no client {c:?}; use claude, codex or cursor")))).collect::<Result<_, _>>()?,
        Some(Value::String(list)) => list.split(',').map(|c| formportal_core::agents::Client::parse(c).ok_or_else(|| fail(format!("there is no client {c:?}; use claude, codex or cursor")))).collect::<Result<_, _>>()?,
        _ => formportal_core::agents::CLIENTS.to_vec(),
    };
    let connect = !flag(args, "disconnect").unwrap_or(false);
    let launcher = formportal_core::agents::Launcher::current()?;
    let result = ctx.portal.connect_agents(&id, ch, &clients, &launcher, connect)?;
    Ok(json!({ "product": id, "server_name": formportal_core::agents::server_name(&id, ch), "launcher": launcher.program, "clients": result, "next": "Restart the client, or reload its MCP servers, to see the app's tools." }))
}

pub fn versions(ctx: &Ctx, args: &Value) -> Result<Value, CoreError> {
    let id = product(args)?;
    let ch = channel(args)?;
    let (catalog, source) = load(ctx, args)?;
    let installed = ctx.portal.state()?.get(&id, ch).map(|i| (i.current.version.clone(), i.previous.as_ref().map(|p| p.version.clone())));
    let list: Vec<Value> = catalog
        .versions(&id, ch, Platform::current())
        .into_iter()
        .map(|v| json!({ "version": v.version, "published": v.published, "notes": v.notes, "latest": v.latest, "for_this_computer": v.artifact.is_some(), "bytes": v.artifact.map(|a| a.bytes) }))
        .collect();
    Ok(json!({ "source": source, "product": id, "channel": formportal_core::portal::channel_name(ch), "installed": installed.as_ref().map(|i| &i.0), "kept_for_rollback": installed.and_then(|i| i.1), "versions": list }))
}

pub fn install(ctx: &Ctx, args: &Value, progress: &mut dyn FnMut(u64, u64)) -> Result<Value, CoreError> {
    let id = product(args)?;
    let ch = channel(args)?;
    let (catalog, _) = load(ctx, args)?;
    let platform = Platform::current();
    let view = catalog.view(&id, ch, platform);
    let (version, artifact) = match text(args, "version") {
        Some(wanted) => {
            let release = catalog.release_of(&id, ch, &wanted).ok_or_else(|| fail(format!("{id} {wanted} is not in the catalogue for that channel; versions lists what is")))?;
            let artifact = release.artifact_for(platform).ok_or_else(|| CoreError::Unavailable(format!("{id} {wanted} on this computer")))?;
            (release.version.as_str(), artifact)
        }
        None => {
            let (Availability::Available, Some(version), Some(artifact)) = (view.availability, view.version, view.artifact) else {
                return Err(CoreError::Unavailable(format!("{id} on {} ({})", formportal_core::portal::channel_name(ch), word(view.availability))));
            };
            (version, artifact)
        }
    };
    let done = ctx.portal.install(&id, ch, version, artifact, progress)?;
    let held = text(args, "version").is_some() && ctx.portal.hold_if_older(&catalog, &id, ch, &done.current.version)?;
    let opens = ctx.portal.launch_target(&id, ch).ok();
    let still_open: Vec<u32> = ctx.portal.running(&id, ch).iter().filter(|r| !r.path.starts_with(&done.current.path)).map(|r| r.pid).collect();
    let note = if still_open.is_empty() { None } else { Some(format!("an earlier copy is still open (process {}); it keeps running untouched, and {version} opens next time", still_open.iter().map(|p| p.to_string()).collect::<Vec<_>>().join(", "))) };
    let held_note = held.then(|| format!("automatic updates for {id} were turned off so {version} stays; turn them back on with preferences per_app {{\"{id}\": null}}"));
    Ok(json!({ "installed": done, "opens": opens, "verified_sha256": artifact.sha256, "still_open": still_open, "note": note, "automatic_updates_held": held_note }))
}

pub fn updates(ctx: &Ctx, args: &Value) -> Result<Value, CoreError> {
    let (catalog, source) = load(ctx, args)?;
    let list = ctx.portal.updates(&catalog, Platform::current())?;
    let me = catalog.view("formai", Channel::Stable, Platform::current());
    let portal = me.version.filter(|v| formportal_core::version_newer(v, CORE_VERSION)).map(|v| json!({ "version": v, "get": "https://formai.dev/download/" }));
    Ok(json!({ "source": source, "updates": list, "formportal_update": portal }))
}

pub fn update(ctx: &Ctx, args: &Value, progress: &mut dyn FnMut(u64, u64)) -> Result<Value, CoreError> {
    if let (Some(id), Some(on)) = (text(args, "product"), flag(args, "later")) {
        let list = ctx.portal.set_later(&id, channel(args)?, on)?;
        return Ok(json!({ "later": list, "note": if on { "installed the next time FormPortal checks and the app is not open" } else { "no longer put off" } }));
    }
    let (catalog, _) = load(ctx, args)?;
    let platform = Platform::current();
    match text(args, "product") {
        Some(id) => {
            let ch = channel(args)?;
            let pending = ctx.portal.updates(&catalog, platform)?.into_iter().find(|u| u.product == id && u.channel == ch);
            let Some(u) = pending else {
                return Err(fail(format!("{id} on {} has no newer version in the catalogue; updates lists what has", formportal_core::portal::channel_name(ch))));
            };
            let view = catalog.view(&id, ch, platform);
            let artifact = view.artifact.ok_or_else(|| fail(format!("{id} has no file for this computer")))?;
            let done = ctx.portal.install(&id, ch, &u.to, artifact, progress)?;
            Ok(json!({ "updated": [{ "product": id, "channel": formportal_core::portal::channel_name(ch), "from": u.from, "to": done.current.version, "error": null }] }))
        }
        None => {
            let automatic_only = flag(args, "automatic_only").unwrap_or(false);
            let done = ctx.portal.apply_updates(&catalog, platform, automatic_only, &mut |_, _, have, total| progress(have, total))?;
            Ok(json!({ "updated": done }))
        }
    }
}

pub fn watch(ctx: &Ctx, args: &Value, out: &mut dyn FnMut(&Value)) -> Result<Value, CoreError> {
    let every = args.get("interval").and_then(|v| v.as_u64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(3).max(1);
    let rounds = args.get("rounds").and_then(|v| v.as_u64().or_else(|| v.as_str().and_then(|s| s.parse().ok())));
    let exts = project_extensions();
    let mut total = 0u64;
    let mut n = 0u64;
    loop {
        for path in ctx.portal.keep_saved(&exts, 2)? {
            total += 1;
            out(&json!({ "kept": path }));
        }
        n += 1;
        if rounds.map(|r| n >= r).unwrap_or(false) {
            return Ok(json!({ "rounds": n, "kept": total }));
        }
        std::thread::sleep(std::time::Duration::from_secs(every));
    }
}

pub fn repair(ctx: &Ctx, args: &Value, progress: &mut dyn FnMut(u64, u64)) -> Result<Value, CoreError> {
    let fix = flag(args, "fix").unwrap_or(false);
    let (catalog, error) = match load(ctx, args) {
        Ok((c, _)) => (Some(c), None),
        Err(e) => (None, Some(e.to_string())),
    };
    let report = ctx.portal.repair(catalog.as_ref(), Platform::current(), fix, &mut |_, _, have, total| progress(have, total))?;
    Ok(json!({ "fixed_mode": fix, "catalogue_error": error, "report": report }))
}

pub fn web_file(ctx: &Ctx, args: &Value, progress: &mut dyn FnMut(u64, u64)) -> Result<Value, CoreError> {
    let url = text(args, "url").or_else(|| text(args, "product")).ok_or_else(|| fail("give the file's address"))?;
    let exts = project_extensions();
    let plan = ctx.portal.web_plan(&url, &exts)?;
    if flag(args, "check").unwrap_or(false) {
        return Ok(json!({ "plan": plan }));
    }
    let path = ctx.portal.fetch_web_file(&plan, progress)?;
    let opened = if flag(args, "no_open").unwrap_or(false) { None } else { ctx.portal.open_file(&path, &exts).ok().map(|(p, _)| p) };
    Ok(json!({ "saved": path, "product": plan.product, "opened_with": opened }))
}

pub fn policy(ctx: &Ctx) -> Result<Value, CoreError> {
    Ok(match ctx.portal.policy()? {
        Some(m) => json!({
            "managed": true,
            "by": m.policy.managed_by,
            "path": m.path,
            "system": m.system,
            "locked": m.policy.locked(),
            "policy": m.policy,
            "note": if m.system { "Set by the organisation in a system file this account cannot change." } else { "Read from FORMPORTAL_POLICY for testing; only the system file binds a computer." }
        }),
        None => json!({ "managed": false, "system_path": formportal_core::policy::system_path(), "note": "No organisation policy; every setting is the person's own." }),
    })
}

pub fn mirror(ctx: &Ctx, args: &Value, progress: &mut dyn FnMut(u64, u64)) -> Result<Value, CoreError> {
    let out = text(args, "to").ok_or_else(|| fail("give --to, the folder the mirror is written into"))?;
    let base_url = text(args, "base_url").ok_or_else(|| fail("give --base-url, the address the folder will be served at, such as https://apps.example.internal/formportal"))?;
    let source = text(args, "source").unwrap_or_else(|| ctx.source.clone());
    let os = |name: &str| match name {
        "macos" => Ok(formportal_core::Os::Macos),
        "windows" => Ok(formportal_core::Os::Windows),
        "linux" => Ok(formportal_core::Os::Linux),
        other => Err(fail(format!("there is no platform {other:?}; use macos, windows or linux"))),
    };
    let platforms = text(args, "platforms").map(|l| l.split(',').map(|p| os(p.trim())).collect::<Result<Vec<_>, _>>()).transpose()?;
    let channels = text(args, "channels")
        .map(|l| l.split(',').map(|c| channel(&json!({ "channel": c.trim() }))).collect::<Result<Vec<_>, _>>())
        .transpose()?;
    let sign_key = std::env::var(formportal_core::mirror::MIRROR_KEY_ENV).ok().filter(|k| !k.trim().is_empty());
    let options = formportal_core::mirror::MirrorOptions { base_url, platforms, channels, history: flag(args, "history").unwrap_or(false), sign_key };
    let allow = flag(args, "allow_unsigned").unwrap_or(ctx.allow_unsigned);
    let report = ctx.portal.mirror(&source, allow, std::path::Path::new(&out), &options, &mut |_, have, total| progress(have, total))?;
    let next = match &report.public_key {
        Some(key) => format!("Serve {out} at the base address. On each computer, a policy file with \"catalog\": \"{}\" and \"catalog_keys\": [\"{key}\"] points FormPortal at it.", report.address),
        None => format!("The mirror is not signed: set {} to a base64 Ed25519 seed to sign it, or computers need the developer setting.", formportal_core::mirror::MIRROR_KEY_ENV),
    };
    Ok(json!({ "mirror": report, "next": next }))
}

pub fn preferences(ctx: &Ctx, args: &Value) -> Result<Value, CoreError> {
    if let Some(m) = ctx.portal.policy()? {
        let locked = m.policy.locked();
        let asked: Vec<&str> = ["auto_update", "auto_update_beta", "only_when_closed", "keep_previous", "per_app"].into_iter().filter(|k| args.get(*k).is_some() && locked.contains(k)).collect();
        if !asked.is_empty() {
            return Err(CoreError::Policy(format!("{} set by the organisation's policy and cannot be changed here", asked.join(", ") + if asked.len() == 1 { " is" } else { " are" })));
        }
    }
    let mut prefs = ctx.portal.preferences()?;
    let mut changed = false;
    let mut set = |key: &str, slot: &mut bool| {
        if let Some(on) = flag(args, key) {
            *slot = on;
            changed = true;
        }
    };
    set("auto_update", &mut prefs.auto_update);
    set("auto_update_beta", &mut prefs.auto_update_beta);
    set("only_when_closed", &mut prefs.only_when_closed);
    set("notices", &mut prefs.notices);
    set("keep_previous", &mut prefs.keep_previous);
    if let Some(map) = args.get("per_app").and_then(Value::as_object) {
        for (id, v) in map {
            match v.as_bool() {
                Some(on) => {
                    prefs.per_app.insert(id.clone(), on);
                }
                None => {
                    prefs.per_app.remove(id);
                }
            }
            changed = true;
        }
    }
    if changed {
        ctx.portal.set_preferences(&prefs)?;
    }
    Ok(json!({ "preferences": prefs, "saved": changed }))
}

fn ext_source(ctx: &Ctx, args: &Value) -> String {
    text(args, "extensions_source")
        .or_else(|| std::env::var("FORMPORTAL_EXTENSIONS").ok().filter(|s| !s.trim().is_empty()))
        .unwrap_or_else(|| {
            let base = text(args, "source").unwrap_or_else(|| ctx.source.clone());
            match base.rsplit_once('/') {
                Some((dir, _)) => format!("{dir}/extensions.json"),
                None => "extensions.json".to_string(),
            }
        })
}

fn ext_index(ctx: &Ctx, args: &Value) -> Result<(formportal_core::extensions::ExtensionIndex, String), CoreError> {
    let source = ext_source(ctx, args);
    let allow = flag(args, "allow_unsigned").unwrap_or(ctx.allow_unsigned);
    Ok((ctx.portal.extension_index(&source, allow)?, source))
}

pub fn extensions(ctx: &Ctx, args: &Value) -> Result<Value, CoreError> {
    let installed = ctx.portal.extensions_installed()?;
    let (index, note) = match ext_index(ctx, args) {
        Ok((index, source)) => (Some(index), json!({ "source": source })),
        Err(e) => (None, json!({ "index_error": e.to_string(), "source": ext_source(ctx, args) })),
    };
    let listed: Vec<Value> = index
        .as_ref()
        .map(|i| {
            i.packages
                .iter()
                .map(|p| {
                    let have = installed.iter().find(|e| e.product == p.product && e.id == p.id);
                    json!({ "id": p.id, "name": p.name, "product": p.product, "kind": p.kind, "author": p.author, "description": p.description, "version": p.version,
                            "licence": p.licence, "native": p.native, "permissions": p.permissions, "signed": p.signature.is_some(), "minimum_app": p.minimum_app,
                            "installed": have.map(|h| &h.version), "enabled": have.map(|h| h.enabled),
                            "update": have.map(|h| formportal_core::version_newer(&p.version, &h.version)).unwrap_or(false) })
                })
                .collect()
        })
        .unwrap_or_default();
    Ok(json!({ "index": note, "packages": listed, "installed": installed }))
}

pub fn extension_install(ctx: &Ctx, args: &Value, progress: &mut dyn FnMut(u64, u64)) -> Result<Value, CoreError> {
    let allow = flag(args, "allow_unsigned").unwrap_or(ctx.allow_unsigned);
    if let Some(path) = text(args, "path") {
        let index = ext_index(ctx, args).ok().map(|(i, _)| i);
        let done = ctx.portal.install_extension_file(std::path::Path::new(&path), index.as_ref(), allow)?;
        return Ok(json!({ "installed": done, "note": "the app picks it up the next time it starts" }));
    }
    let id = text(args, "id").ok_or_else(|| fail("give id (from extensions) or path (a .formpkg file)"))?;
    let (index, _) = ext_index(ctx, args)?;
    let done = ctx.portal.install_extension(&index, &id, allow, progress)?;
    Ok(json!({ "installed": done, "note": "the app picks it up the next time it starts" }))
}

pub fn extension_remove(ctx: &Ctx, args: &Value) -> Result<Value, CoreError> {
    let id = text(args, "id").ok_or_else(|| fail("give the extension's id"))?;
    let product = text(args, "product").ok_or_else(|| fail("give the product the extension is for"))?;
    ctx.portal.remove_extension(&product, &id)?;
    Ok(json!({ "removed": id, "product": product }))
}

pub fn extension_enable(ctx: &Ctx, args: &Value) -> Result<Value, CoreError> {
    let id = text(args, "id").ok_or_else(|| fail("give the extension's id"))?;
    let product = text(args, "product").ok_or_else(|| fail("give the product the extension is for"))?;
    let on = flag(args, "enabled").ok_or_else(|| fail("give enabled true or false"))?;
    Ok(json!({ "extension": ctx.portal.enable_extension(&product, &id, on)?, "note": "the app picks the change up the next time it starts" }))
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
