use std::path::{Path, PathBuf};

use crate::error::Result;

pub const NAME: &str = "FormPortal";
#[cfg(target_os = "macos")]
const LABEL: &str = "studio.formai.portal.login";
#[cfg(target_os = "macos")]
const OLD_LABEL: &str = "dev.formai.portal.login";

#[cfg(any(target_os = "linux", target_os = "macos"))]
fn home() -> PathBuf {
    std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE")).map(PathBuf::from).unwrap_or_else(|| PathBuf::from("."))
}

#[cfg(target_os = "linux")]
pub fn location() -> PathBuf {
    std::env::var_os("XDG_CONFIG_HOME").map(PathBuf::from).unwrap_or_else(|| home().join(".config")).join("autostart").join("formportal.desktop")
}

#[cfg(target_os = "macos")]
pub fn location() -> PathBuf {
    home().join("Library").join("LaunchAgents").join(format!("{LABEL}.plist"))
}

#[cfg(target_os = "windows")]
pub fn location() -> PathBuf {
    PathBuf::from(r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run").join(NAME)
}

#[cfg(target_os = "linux")]
fn entry(program: &Path) -> String {
    let exec = program.to_string_lossy().replace('\\', "\\\\").replace('"', "\\\"");
    format!("[Desktop Entry]\nType=Application\nName={NAME}\nExec=\"{exec}\"\nTerminal=false\nX-GNOME-Autostart-enabled=true\n")
}

#[cfg(target_os = "macos")]
fn entry(program: &Path) -> String {
    let path = program.to_string_lossy().replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;");
    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n<plist version=\"1.0\">\n<dict>\n  <key>Label</key><string>{LABEL}</string>\n  <key>ProgramArguments</key><array><string>{path}</string></array>\n  <key>RunAtLoad</key><true/>\n</dict>\n</plist>\n"
    )
}

#[cfg(target_os = "macos")]
fn forget_old() {
    let _ = std::fs::remove_file(home().join("Library").join("LaunchAgents").join(format!("{OLD_LABEL}.plist")));
}

#[cfg(target_os = "linux")]
fn forget_old() {}

#[cfg(any(target_os = "linux", target_os = "macos"))]
pub fn sync(on: bool, program: &Path) -> Result<()> {
    forget_old();
    let file = location();
    if !on {
        return match std::fs::remove_file(&file) {
            Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e.into()),
            _ => Ok(()),
        };
    }
    let text = entry(program);
    if std::fs::read_to_string(&file).ok().as_deref() == Some(text.as_str()) {
        return Ok(());
    }
    if let Some(dir) = file.parent() {
        std::fs::create_dir_all(dir)?;
    }
    let staging = file.with_extension("tmp");
    std::fs::write(&staging, text)?;
    std::fs::rename(staging, file)?;
    Ok(())
}

#[cfg(target_os = "windows")]
pub fn sync(on: bool, program: &Path) -> Result<()> {
    use std::os::windows::process::CommandExt;
    let key = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
    let mut command = std::process::Command::new("reg");
    if on {
        let value = format!("\"{}\"", program.to_string_lossy());
        command.args(["add", key, "/v", NAME, "/t", "REG_SZ", "/d", &value, "/f"]);
    } else {
        command.args(["delete", key, "/v", NAME, "/f"]);
    }
    let status = command.creation_flags(0x0800_0000).output()?;
    if on && !status.status.success() {
        return Err(crate::error::CoreError::Invalid(format!("the login item could not be added: {}", String::from_utf8_lossy(&status.stderr).trim())));
    }
    Ok(())
}

#[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
pub fn sync(_on: bool, _program: &Path) -> Result<()> {
    Ok(())
}
