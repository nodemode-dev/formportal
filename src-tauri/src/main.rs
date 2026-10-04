#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use formai_core::Platform;

#[tauri::command]
fn platform() -> Platform {
    Platform::current()
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![platform])
        .run(tauri::generate_context!())
        .expect("formai could not start");
}
