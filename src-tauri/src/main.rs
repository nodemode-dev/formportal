#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use formportal_core::{Availability, Catalog, Channel, Install, Platform, Portal, Preferences, Update, UpdateOutcome};
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_deep_link::DeepLinkExt;

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
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .manage(Pending(Mutex::new(None)))
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
        .invoke_handler(tauri::generate_handler![platform, catalog, installs, install, open, rollback, remove, launch_link, updates, auto_update, preferences, set_preferences])
        .run(tauri::generate_context!())
        .expect("FormPortal could not start");
}
