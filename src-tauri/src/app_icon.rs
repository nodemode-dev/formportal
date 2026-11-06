use tauri::image::Image;
use tauri::{AppHandle, Manager, Runtime};

const SIZE: u32 = 256;
const DARK: &[u8] = include_bytes!("../icons/runtime/dark-256.rgba");
const LIGHT: &[u8] = include_bytes!("../icons/runtime/light-256.rgba");
#[cfg(target_os = "macos")]
const DARK_PNG: &[u8] = include_bytes!("../icons/runtime/dark-512.png");
#[cfg(target_os = "macos")]
const LIGHT_PNG: &[u8] = include_bytes!("../icons/runtime/light-512.png");

#[tauri::command]
pub fn set_app_icon<R: Runtime>(app: AppHandle<R>, light: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.set_icon(Image::new(if light { LIGHT } else { DARK }, SIZE, SIZE)).map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        let png = if light { LIGHT_PNG } else { DARK_PNG };
        app.run_on_main_thread(move || dock(png)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(target_os = "macos")]
fn dock(png: &'static [u8]) {
    use objc2::{AllocAnyThread, MainThreadMarker};
    use objc2_app_kit::{NSApplication, NSImage};
    use objc2_foundation::NSData;
    let Some(mtm) = MainThreadMarker::new() else { return };
    let data = NSData::with_bytes(png);
    let Some(image) = NSImage::initWithData(NSImage::alloc(), &data) else { return };
    unsafe { NSApplication::sharedApplication(mtm).setApplicationIconImage(Some(&image)) };
}
