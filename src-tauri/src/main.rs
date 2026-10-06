#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use formai_core::{Availability, Catalog, Channel, Hub, Install, Platform};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
struct Progress {
    product: String,
    channel: Channel,
    have: u64,
    total: u64,
}

fn hub() -> Hub {
    Hub::new(Hub::default_root())
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
async fn install(app: AppHandle, product: String, channel: Channel, url: String, allow_unsigned: bool) -> Result<Install, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let hub = hub();
        let catalog = hub.catalog(&url, allow_unsigned).map_err(text)?;
        let view = catalog.view(&product, channel, Platform::current());
        let (Availability::Available, Some(version), Some(artifact)) = (view.availability, view.version, view.artifact) else {
            return Err(format!("the catalogue offers this computer nothing for {product}"));
        };
        let mut last = u64::MAX;
        hub.install(&product, channel, version, artifact, &mut |have, total| {
            let step = if total > 0 { have * 100 / total } else { 0 };
            if step != last {
                last = step;
                let _ = app.emit("install-progress", Progress { product: product.clone(), channel, have, total });
            }
        })
        .map_err(text)
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

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![platform, catalog, installs, install, open, rollback, remove])
        .run(tauri::generate_context!())
        .expect("formai could not start");
}
