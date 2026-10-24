#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use formportal_core::extensions::{ExtensionIndex, InstalledExtension};
use formportal_core::{Availability, Catalog, Channel, Install, Platform, Portal, Preferences, Update, UpdateOutcome};
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_updater::UpdaterExt;

#[derive(Clone, Serialize)]
struct Progress {
    product: String,
    channel: Channel,
    have: u64,
    total: u64,
}

fn hub() -> Portal {
    Portal::new(Portal::default_root())
}

fn text<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

#[tauri::command]
fn platform() -> Platform {
    Platform::current()
}

#[tauri::command]
async fn catalog(url: String, allow_unsigned: bool) -> Result<Catalog, String> {
    tauri::async_runtime::spawn_blocking(move || hub().catalog(&url, allow_unsigned).map_err(text)).await.map_err(text)?
}

#[tauri::command]
fn installs() -> Result<Vec<Install>, String> {
    hub().state().map(|state| state.installs).map_err(text)
}

#[tauri::command]
async fn install(app: AppHandle, product: String, channel: Channel, url: String, allow_unsigned: bool, version: Option<String>) -> Result<Install, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let hub = hub();
        let catalog = hub.catalog(&url, allow_unsigned).map_err(text)?;
        let view = catalog.view(&product, channel, Platform::current());
        let asked = version.is_some();
        let (version, artifact) = match version.as_deref() {
            Some(wanted) => {
                let release = catalog.release_of(&product, channel, wanted).ok_or_else(|| format!("{product} {wanted} is not in the catalogue"))?;
                let artifact = release.artifact_for(Platform::current()).ok_or_else(|| format!("the catalogue offers this computer nothing for {product} {wanted}"))?;
                (release.version.as_str(), artifact)
            }
            None => {
                let (Availability::Available, Some(version), Some(artifact)) = (view.availability, view.version, view.artifact) else {
                    return Err(format!("the catalogue offers this computer nothing for {product}"));
                };
                (version, artifact)
            }
        };
        let mut last = u64::MAX;
        let done = hub.install(&product, channel, version, artifact, &mut |have, total| {
            let step = if total > 0 { have * 100 / total } else { 0 };
            if step != last {
                last = step;
                let _ = app.emit("install-progress", Progress { product: product.clone(), channel, have, total });
            }
        })
        .map_err(text)?;
        if asked {
            hub.hold_if_older(&catalog, &product, channel, &done.current.version).map_err(text)?;
        }
        Ok(done)
    })
    .await
    .map_err(text)?
}

#[tauri::command]
fn policy() -> Result<Option<serde_json::Value>, String> {
    Ok(hub().policy().map_err(text)?.map(|m| {
        serde_json::json!({
            "managed_by": m.policy.managed_by,
            "system": m.system,
            "path": m.path,
            "locked": m.policy.locked(),
            "catalog": m.policy.catalog,
            "apps": m.policy.apps,
            "channels": m.policy.channels,
            "extensions": m.policy.extensions != Some(false),
            "sideload": m.policy.extensions != Some(false) && m.policy.sideload != Some(false),
        })
    }))
}

const REGISTRY: &str = include_str!("../../catalog/products.json");

fn exts() -> std::collections::BTreeMap<String, String> {
    formportal_core::files::extensions_from_registry(REGISTRY)
}

static FILES_LOCK: Mutex<()> = Mutex::new(());

fn watch_saves(app: AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(3));
        let kept = {
            let _held = FILES_LOCK.lock();
            hub().keep_saved(&exts(), 2)
        };
        if let Ok(kept) = kept {
            if !kept.is_empty() {
                let _ = app.emit("versions-kept", kept);
            }
        }
    });
}

#[tauri::command]
async fn files_scan(query: Option<String>) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let _held = FILES_LOCK.lock();
        let scan = hub().scan_files(&exts(), query.as_deref()).map_err(text)?;
        Ok(serde_json::json!({ "scan": scan, "suggested": formportal_core::files::suggested_folder(), "opens": exts() }))
    })
    .await
    .map_err(text)?
}

#[tauri::command]
async fn folder_pick(app: AppHandle) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;
    let start = formportal_core::files::suggested_folder();
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog().file().set_title("Choose a folder of Form projects").set_directory(if start.is_dir() { start } else { std::path::PathBuf::from(std::env::var_os("HOME").unwrap_or_default()) }).pick_folder(move |picked| {
        let _ = tx.send(picked.and_then(|p| p.into_path().ok()).map(|p| p.to_string_lossy().to_string()));
    });
    tauri::async_runtime::spawn_blocking(move || rx.recv().ok().flatten()).await.ok().flatten()
}

#[tauri::command]
fn folder_add(path: String, keep_versions: bool, create: bool) -> Result<formportal_core::files::Folder, String> {
    hub().add_folder(std::path::Path::new(&path), keep_versions, create).map_err(text)
}

#[tauri::command]
fn folder_remove(path: String) -> Result<(), String> {
    hub().remove_folder(std::path::Path::new(&path)).map_err(text)
}

#[tauri::command]
fn file_open(path: String) -> Result<String, String> {
    hub().open_file(std::path::Path::new(&path), &exts()).map(|(product, _)| product).map_err(text)
}

#[tauri::command]
async fn file_versions(path: String, action: Option<String>, version: Option<String>) -> Result<Vec<formportal_core::files::Version>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let _held = FILES_LOCK.lock();
        let hub = hub();
        let p = std::path::Path::new(&path);
        match action.as_deref() {
            Some("save") => {
                hub.save_version(p).map_err(text)?;
            }
            Some("revert") => {
                hub.revert_file(p, version.as_deref().unwrap_or_default()).map_err(text)?;
            }
            _ => {}
        }
        hub.file_versions(p).map_err(text)
    })
    .await
    .map_err(text)?
}

fn sibling(url: &str, name: &str) -> String {
    match url.rsplit_once('/') {
        Some((dir, _)) => format!("{dir}/{name}"),
        None => name.to_string(),
    }
}

#[tauri::command]
async fn fonts_view(url: String, allow_unsigned: bool) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let hub = hub();
        let (index, error) = match hub.font_index(&sibling(&url, "fonts.json"), allow_unsigned) {
            Ok(i) => (Some(i), None),
            Err(e) => (None, Some(e.to_string())),
        };
        let updates = match &index {
            Some(i) => hub.font_updates(i).map_err(text)?,
            None => Vec::new(),
        };
        Ok(serde_json::json!({ "index": index, "index_error": error, "installed": hub.fonts_installed().map_err(text)?, "updates": updates, "folder": formportal_core::fonts::font_dir() }))
    })
    .await
    .map_err(text)?
}

#[tauri::command]
async fn font_install(id: String, style: Option<String>, url: String, allow_unsigned: bool) -> Result<Vec<formportal_core::fonts::InstalledFont>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let hub = hub();
        let index = hub.font_index(&sibling(&url, "fonts.json"), allow_unsigned).map_err(text)?;
        hub.install_font(&index, &id, style.as_deref(), &mut |_, _| {}).map_err(text)
    })
    .await
    .map_err(text)?
}

#[tauri::command]
async fn font_pick(app: AppHandle) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog().file().set_title("Choose a font file (TTF or OTF)").add_filter("Fonts", &["ttf", "otf", "ttc"]).pick_file(move |picked| {
        let _ = tx.send(picked.and_then(|p| p.into_path().ok()).map(|p| p.to_string_lossy().to_string()));
    });
    tauri::async_runtime::spawn_blocking(move || rx.recv().ok().flatten()).await.ok().flatten()
}

#[tauri::command]
fn font_add(path: String, rights_confirmed: bool) -> Result<formportal_core::fonts::InstalledFont, String> {
    hub().add_own_font(std::path::Path::new(&path), rights_confirmed).map_err(text)
}

#[tauri::command]
fn font_remove(family: String, style: Option<String>) -> Result<usize, String> {
    hub().remove_font(&family, style.as_deref()).map(|gone| gone.len()).map_err(text)
}

#[tauri::command]
async fn media_view(url: String, allow_unsigned: bool) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let hub = hub();
        let (index, error) = match hub.media_index(&sibling(&url, "media.json"), allow_unsigned) {
            Ok(i) => (Some(i), None),
            Err(e) => (None, Some(e.to_string())),
        };
        let credits: Vec<String> = index.as_ref().map(|i| i.items.iter().map(formportal_core::media::credit_line).collect()).unwrap_or_default();
        Ok(serde_json::json!({ "index": index, "credits": credits, "index_error": error, "saved": hub.saved_media().map_err(text)?, "library": formportal_core::media::library_dir() }))
    })
    .await
    .map_err(text)?
}

#[tauri::command]
async fn media_save(id: String, use_template: bool, url: String, allow_unsigned: bool) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let hub = hub();
        let index = hub.media_index(&sibling(&url, "media.json"), allow_unsigned).map_err(text)?;
        if use_template {
            let path = hub.use_template(&index, &id, None, &mut |_, _| {}).map_err(text)?;
            let opened = hub.open_file(&path, &exts()).ok().map(|(p, _)| p);
            return Ok(serde_json::json!({ "copied_to": path, "opened_with": opened }));
        }
        Ok(serde_json::json!({ "saved": hub.save_media(&index, &id, &mut |_, _| {}).map_err(text)? }))
    })
    .await
    .map_err(text)?
}

#[tauri::command]
fn media_remove(id: String) -> Result<(), String> {
    hub().remove_media(&id).map(|_| ()).map_err(text)
}

#[tauri::command]
async fn media_thumb(url: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || hub().thumbnail_data_url(&url).map_err(text))
    .await
    .map_err(text)?
}

fn ctx(url: String, allow_unsigned: bool) -> formportal_cli::ops::Ctx {
    formportal_cli::ops::Ctx { portal: hub(), source: url, allow_unsigned }
}

#[tauri::command]
async fn learn_view(url: String, allow_unsigned: bool) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || formportal_cli::ops::learn(&ctx(url, allow_unsigned), &serde_json::json!({})).map_err(text)).await.map_err(text)?
}

#[tauri::command]
async fn learn_mark(id: String, step: Option<u64>, done: bool, reset: bool, url: String, allow_unsigned: bool) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let args = serde_json::json!({ "id": id, "step": step, "done": done, "reset": reset });
        formportal_cli::ops::learn_progress(&ctx(url, allow_unsigned), &args).map_err(text)
    })
    .await
    .map_err(text)?
}

#[tauri::command]
fn assistant_agents() -> Vec<formportal_core::assistant::AgentCli> {
    formportal_core::assistant::assistant_agents()
}

#[tauri::command]
async fn assistant_ask(client: String, question: String, url: String, allow_unsigned: bool) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let exe = std::env::current_exe().map_err(text)?;
        let args = serde_json::json!({ "client": client, "question": question });
        formportal_cli::ops::ask(&ctx(url, allow_unsigned), &args, exe, vec!["mcp".to_string(), "--read-only".to_string()], formportal_cli::mcp::read_only_tools()).map_err(text)
    })
    .await
    .map_err(text)?
}

#[tauri::command]
async fn storage() -> Result<formportal_core::files::Storage, String> {
    tauri::async_runtime::spawn_blocking(|| hub().storage().map_err(text)).await.map_err(text)?
}

#[tauri::command]
fn app_agents(product: String, channel: Channel) -> Result<serde_json::Value, String> {
    let hub = hub();
    let surface = hub.agent_surface(&product, channel).map_err(text)?;
    Ok(serde_json::json!({
        "surface": surface.is_some(),
        "server_name": formportal_core::agents::server_name(&product, channel),
        "clients": if surface.is_some() { serde_json::to_value(hub.agent_clients(&product, channel)).unwrap_or_default() } else { serde_json::json!([]) },
    }))
}

#[tauri::command]
async fn connect_agents(product: String, channel: Channel, disconnect: bool) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let launcher = formportal_core::agents::Launcher::current().map_err(text)?;
        let clients = hub().connect_agents(&product, channel, &formportal_core::agents::CLIENTS, &launcher, !disconnect).map_err(text)?;
        Ok(serde_json::json!({ "clients": clients }))
    })
    .await
    .map_err(text)?
}

fn app_mcp_from_args() -> Option<i32> {
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).map(String::as_str) != Some("app-mcp") {
        return None;
    }
    let product = args.get(2).cloned().unwrap_or_default();
    let channel = match (args.get(3).map(String::as_str), args.get(4)) {
        (Some("--channel"), Some(name)) => match serde_json::from_value::<Channel>(serde_json::json!(name)) {
            Ok(channel) => channel,
            Err(_) => {
                eprintln!("FormPortal app-mcp: there is no channel {name:?}");
                return Some(2);
            }
        },
        _ => Channel::Stable,
    };
    Some(match hub().run_app_mcp(&product, channel) {
        Ok(code) => code,
        Err(e) => {
            eprintln!("FormPortal app-mcp: {e}");
            1
        }
    })
}

#[tauri::command]
fn still_open(product: String, channel: Channel) -> Vec<u32> {
    let hub = hub();
    let current = hub.state().ok().and_then(|s| s.installs.into_iter().find(|i| i.product == product && i.channel == channel)).map(|i| i.current.path);
    hub.running(&product, channel).into_iter().filter(|r| current.as_ref().map(|c| !r.path.starts_with(c)).unwrap_or(true)).map(|r| r.pid).collect()
}

const WEB: [&str; 3] = ["https://github.com/nodemode-ai/", "https://formai.dev/", "https://docs.formai.dev/"];

#[tauri::command]
fn open_web(url: String) -> Result<(), String> {
    if !WEB.iter().any(|allowed| url.starts_with(allowed)) || url.chars().any(|c| c.is_whitespace() || c == '"') {
        return Err("FormPortal opens only formai.dev and the Form family's repositories".to_string());
    }
    #[cfg(target_os = "macos")]
    let mut command = std::process::Command::new("open");
    #[cfg(target_os = "windows")]
    let mut command = std::process::Command::new("explorer");
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let mut command = std::process::Command::new("xdg-open");
    command.arg(&url).spawn().map(|_| ()).map_err(|e| format!("the browser could not be opened: {e}"))
}

#[tauri::command]
fn open(product: String, channel: Channel) -> Result<u32, String> {
    hub().launch(&product, channel).map_err(text)
}

#[tauri::command]
fn rollback(product: String, channel: Channel) -> Result<Install, String> {
    hub().rollback(&product, channel).map_err(text)
}

#[tauri::command]
fn remove(product: String, channel: Channel) -> Result<(), String> {
    hub().uninstall(&product, channel).map_err(text)
}

#[tauri::command]
async fn updates(url: String, allow_unsigned: bool) -> Result<Vec<Update>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let hub = hub();
        let catalog = hub.catalog(&url, allow_unsigned).map_err(text)?;
        hub.updates(&catalog, Platform::current()).map_err(text)
    })
    .await
    .map_err(text)?
}

#[tauri::command]
async fn auto_update(app: AppHandle, url: String, allow_unsigned: bool) -> Result<Vec<UpdateOutcome>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let hub = hub();
        let catalog = hub.catalog(&url, allow_unsigned).map_err(text)?;
        let mut last = u64::MAX;
        hub.apply_updates(&catalog, Platform::current(), true, &mut |product, channel, have, total| {
            let step = if total > 0 { have * 100 / total } else { 0 };
            if step != last {
                last = step;
                let _ = app.emit("install-progress", Progress { product: product.to_string(), channel, have, total });
            }
        })
        .map_err(text)
    })
    .await
    .map_err(text)?
}

#[tauri::command]
async fn repair(url: String, allow_unsigned: bool, fix: bool) -> Result<formportal_core::repair::Report, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let hub = hub();
        let catalog = hub.catalog(&url, allow_unsigned).ok();
        hub.repair(catalog.as_ref(), Platform::current(), fix, &mut |_, _, _, _| {}).map_err(text)
    })
    .await
    .map_err(text)?
}

#[tauri::command]
fn file_preview(path: String) -> Result<String, String> {
    hub().preview_data_url(std::path::Path::new(&path)).map_err(text)
}

#[tauri::command]
fn later_list() -> Result<Vec<String>, String> {
    hub().later().map(|l| l.into_iter().collect()).map_err(text)
}

#[tauri::command]
fn update_later(product: String, channel: Channel, on: bool) -> Result<Vec<String>, String> {
    hub().set_later(&product, channel, on).map(|l| l.into_iter().collect()).map_err(text)
}

#[tauri::command]
fn web_plan(url: String) -> Result<formportal_core::web::WebPlan, String> {
    hub().web_plan(&url, &exts()).map_err(text)
}

#[tauri::command]
async fn web_fetch(url: String) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let hub = hub();
        let plan = hub.web_plan(&url, &exts()).map_err(text)?;
        let path = hub.fetch_web_file(&plan, &mut |_, _| {}).map_err(text)?;
        let opened = hub.open_file(&path, &exts()).ok().map(|(p, _)| p);
        Ok(serde_json::json!({ "saved": path, "product": plan.product, "opened_with": opened }))
    })
    .await
    .map_err(text)?
}

#[derive(Serialize)]
struct ExtensionsView {
    index: Option<ExtensionIndex>,
    index_error: Option<String>,
    installed: Vec<InstalledExtension>,
}

fn index_url(catalog: &str) -> String {
    match catalog.rsplit_once('/') {
        Some((dir, _)) => format!("{dir}/extensions.json"),
        None => "extensions.json".to_string(),
    }
}

#[tauri::command]
async fn extensions(url: String, allow_unsigned: bool) -> Result<ExtensionsView, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let hub = hub();
        let (index, index_error) = match hub.extension_index(&index_url(&url), allow_unsigned) {
            Ok(i) => (Some(i), None),
            Err(e) => (None, Some(e.to_string())),
        };
        Ok(ExtensionsView { index, index_error, installed: hub.extensions_installed().map_err(text)? })
    })
    .await
    .map_err(text)?
}

#[tauri::command]
async fn extension_install(id: Option<String>, path: Option<String>, url: String, allow_unsigned: bool) -> Result<InstalledExtension, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let hub = hub();
        let index = hub.extension_index(&index_url(&url), allow_unsigned);
        match (id, path) {
            (_, Some(path)) => hub.install_extension_file(std::path::Path::new(&path), index.as_ref().ok(), allow_unsigned).map_err(text),
            (Some(id), None) => hub.install_extension(&index.map_err(text)?, &id, allow_unsigned, &mut |_, _| {}).map_err(text),
            (None, None) => Err("give an extension id or a package file".to_string()),
        }
    })
    .await
    .map_err(text)?
}

#[tauri::command]
fn extension_remove(product: String, id: String) -> Result<(), String> {
    hub().remove_extension(&product, &id).map_err(text)
}

#[tauri::command]
fn extension_enable(product: String, id: String, enabled: bool) -> Result<InstalledExtension, String> {
    hub().enable_extension(&product, &id, enabled).map_err(text)
}

#[derive(Serialize)]
struct SelfUpdate {
    configured: bool,
    current: String,
    available: Option<String>,
    notes: Option<String>,
}

fn updater_configured(app: &AppHandle) -> bool {
    app.config().plugins.0.get("updater").and_then(|u| u.get("pubkey")).and_then(|k| k.as_str()).map(|k| !k.trim().is_empty()).unwrap_or(false)
}

#[tauri::command]
async fn self_update_check(app: AppHandle) -> Result<SelfUpdate, String> {
    let current = app.package_info().version.to_string();
    if !updater_configured(&app) {
        return Ok(SelfUpdate { configured: false, current, available: None, notes: None });
    }
    let update = app.updater().map_err(text)?.check().await.map_err(text)?;
    Ok(SelfUpdate { configured: true, current, available: update.as_ref().map(|u| u.version.clone()), notes: update.and_then(|u| u.body.clone()) })
}

#[tauri::command]
async fn self_update_install(app: AppHandle) -> Result<(), String> {
    if !updater_configured(&app) {
        return Err("FormPortal's own updates are not set up in this build yet".to_string());
    }
    let Some(update) = app.updater().map_err(text)?.check().await.map_err(text)? else {
        return Err("FormPortal is up to date".to_string());
    };
    update.download_and_install(|_, _| {}, || {}).await.map_err(text)?;
    app.restart()
}

struct PendingPackage(Mutex<Option<String>>);

fn package_arg<I: IntoIterator<Item = String>>(args: I) -> Option<String> {
    args.into_iter().skip(1).find(|a| a.to_lowercase().ends_with(".formpkg"))
}

#[tauri::command]
fn launch_package(pending: State<'_, PendingPackage>) -> Option<String> {
    pending.0.lock().ok().and_then(|mut slot| slot.take())
}

#[tauri::command]
fn preferences() -> Result<Preferences, String> {
    hub().preferences().map_err(text)
}

#[tauri::command]
fn set_preferences(preferences: Preferences) -> Result<(), String> {
    hub().set_preferences(&preferences).map_err(text)?;
    sync_login()
}

fn sync_login() -> Result<(), String> {
    let on = hub().preferences().map_err(text)?.open_at_login;
    let program = std::env::var_os("APPIMAGE").map(std::path::PathBuf::from).or_else(|| std::env::current_exe().ok()).ok_or("no program path")?;
    formportal_core::login::sync(on, &program).map_err(text)
}

const SCHEME: &str = "formai://";

struct Pending(Mutex<Option<String>>);

fn target(url: &str) -> Option<String> {
    url.strip_prefix(SCHEME).map(|rest| rest.trim_matches('/').to_string()).filter(|rest| !rest.is_empty())
}

fn route(app: &AppHandle, urls: impl IntoIterator<Item = String>) {
    for url in urls {
        if let Some(link) = target(&url) {
            let _ = app.emit("deep-link", link);
        }
    }
}

#[tauri::command]
fn launch_link(pending: State<'_, Pending>) -> Option<String> {
    pending.0.lock().ok().and_then(|mut slot| slot.take())
}

fn main() {
    if let Some(code) = app_mcp_from_args() {
        std::process::exit(code);
    }
    let argv: Vec<String> = std::env::args().collect();
    if argv.get(1).map(String::as_str) == Some("mcp") {
        let read_only = argv.iter().any(|a| a == "--read-only");
        std::process::exit(match formportal_cli::mcp::serve_with(read_only) {
            Ok(()) => 0,
            Err(e) => {
                eprintln!("FormPortal mcp: {e}");
                1
            }
        });
    }
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
            if let Some(path) = package_arg(argv) {
                let _ = app.emit("package-open", path);
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .manage(Pending(Mutex::new(None)))
        .manage(PendingPackage(Mutex::new(package_arg(std::env::args()))))
        .setup(|app| {
            #[cfg(any(target_os = "linux", all(debug_assertions, windows)))]
            {
                let _ = app.deep_link().register_all();
            }
            let started_with = app.deep_link().get_current().ok().flatten().unwrap_or_default();
            if let Some(link) = started_with.iter().find_map(|url| target(url.as_str())) {
                if let Ok(mut slot) = app.state::<Pending>().0.lock() {
                    *slot = Some(link);
                }
            }
            let page = hub().preferences().map(|p| p.page()).unwrap_or("index.html");
            if let Some(config) = app.config().app.windows.iter().find(|w| w.label == "main") {
                let mut config = config.clone();
                config.url = tauri::WebviewUrl::App(page.into());
                tauri::WebviewWindowBuilder::from_config(app.handle(), &config)?.build()?;
            }
            watch_saves(app.handle().clone());
            let _ = sync_login();
            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| route(&handle, event.urls().iter().map(|url| url.to_string())));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            platform, catalog, installs, install, open, rollback, remove, launch_link, updates, auto_update, preferences, set_preferences,
            extensions, extension_install, extension_remove, extension_enable, launch_package, self_update_check, self_update_install, still_open, open_web, policy, app_agents, connect_agents, files_scan, folder_pick, folder_add, folder_remove, file_open, file_versions, storage, fonts_view, font_install, font_pick, font_add, font_remove, media_view, media_save, media_remove, media_thumb, learn_view, learn_mark, assistant_agents, assistant_ask, repair, later_list, update_later, web_plan, web_fetch, file_preview
        ])
        .build(tauri::generate_context!())
        .expect("FormPortal could not start")
        .run(|_app, _event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = &_event {
                for url in urls {
                    if let Ok(path) = url.to_file_path() {
                        let path = path.to_string_lossy().to_string();
                        if path.to_lowercase().ends_with(".formpkg") {
                            if let Ok(mut slot) = _app.state::<PendingPackage>().0.lock() {
                                *slot = Some(path.clone());
                            }
                            let _ = _app.emit("package-open", path);
                        }
                    }
                }
            }
        });
}
