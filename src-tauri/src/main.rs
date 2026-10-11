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
    hub().set_preferences(&preferences).map_err(text)
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
            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| route(&handle, event.urls().iter().map(|url| url.to_string())));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            platform, catalog, installs, install, open, rollback, remove, launch_link, updates, auto_update, preferences, set_preferences,
            extensions, extension_install, extension_remove, extension_enable, launch_package, self_update_check, self_update_install
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
