use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use crate::error::{CoreError, Result};

fn run(command: &mut Command, what: &str, tool: &str) -> Result<()> {
    let output = command.stdin(Stdio::null()).output().map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            CoreError::Archive(format!("unpacking a {what} needs {tool}, which this computer does not have"))
        } else {
            CoreError::Io(e)
        }
    })?;
    if output.status.success() {
        return Ok(());
    }
    let said = String::from_utf8_lossy(&output.stderr).trim().lines().last().unwrap_or("").to_string();
    Err(CoreError::Archive(format!("{tool} could not unpack the {what}{}", if said.is_empty() { String::new() } else { format!(": {said}") })))
}

fn absolute(path: &Path) -> Result<PathBuf> {
    Ok(if path.is_absolute() { path.to_path_buf() } else { std::env::current_dir()?.join(path) })
}

pub fn deb(file: &Path, into: &Path) -> Result<()> {
    run(Command::new("dpkg-deb").arg("-x").arg(file).arg(into), "deb package", "dpkg-deb")
}

pub fn rpm(file: &Path, into: &Path) -> Result<()> {
    let file = absolute(file)?;
    if run(Command::new("bsdtar").arg("-xf").arg(&file).arg("-C").arg(into), "rpm package", "bsdtar").is_ok() {
        return Ok(());
    }
    let script = "rpm2cpio \"$1\" | cpio -idm --quiet";
    run(Command::new("sh").arg("-c").arg(script).arg("sh").arg(&file).current_dir(into), "rpm package", "rpm2cpio and cpio")
}

fn attach(file: &Path, mount: &Path) -> Result<()> {
    use std::io::Write;
    let mut child = Command::new("hdiutil")
        .args(["attach", "-nobrowse", "-readonly", "-noautoopen", "-noverify", "-mountpoint"])
        .arg(mount)
        .arg(file)
        .env("PAGER", "cat")
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                CoreError::Archive("unpacking a disk image needs hdiutil, which this computer does not have".to_string())
            } else {
                CoreError::Io(e)
            }
        })?;
    if let Some(mut answer) = child.stdin.take() {
        let _ = answer.write_all(&b"Y\n".repeat(8));
    }
    let output = child.wait_with_output()?;
    if output.status.success() {
        return Ok(());
    }
    let said = String::from_utf8_lossy(&output.stderr).trim().lines().last().unwrap_or("").to_string();
    Err(CoreError::Archive(format!("hdiutil could not open the disk image{}", if said.is_empty() { String::new() } else { format!(": {said}") })))
}

pub fn dmg(file: &Path, into: &Path) -> Result<()> {
    let mount = into.with_extension("mount");
    if mount.exists() {
        let _ = fs::remove_dir_all(&mount);
    }
    fs::create_dir_all(&mount)?;
    attach(file, &mount)?;
    let copied = (|| -> Result<()> {
        let apps: Vec<PathBuf> = fs::read_dir(&mount)?.flatten().map(|e| e.path()).filter(|p| p.extension().map(|x| x == "app").unwrap_or(false)).collect();
        if apps.is_empty() {
            return Err(CoreError::Archive("the disk image holds no .app".to_string()));
        }
        for app in apps {
            let name = app.file_name().map(|n| n.to_os_string()).unwrap_or_default();
            run(Command::new("ditto").arg(&app).arg(into.join(name)), "disk image", "ditto")?;
        }
        Ok(())
    })();
    let _ = Command::new("hdiutil").args(["detach", "-quiet"]).arg(&mount).status();
    let _ = fs::remove_dir(&mount);
    copied
}

pub fn msi(file: &Path, into: &Path) -> Result<()> {
    let target = absolute(into)?;
    let mut command = Command::new("msiexec");
    command.arg("/a").arg(absolute(file)?).arg("/qn");
    #[cfg(windows)]
    std::os::windows::process::CommandExt::raw_arg(&mut command, format!("TARGETDIR=\"{}\"", target.display()));
    #[cfg(not(windows))]
    command.arg(format!("TARGETDIR={}", target.display()));
    run(&mut command, "msi package", "msiexec")
}

pub fn nsis(file: &Path, into: &Path) -> Result<()> {
    let target = absolute(into)?;
    let mut command = Command::new(absolute(file)?);
    command.arg("/S");
    #[cfg(windows)]
    std::os::windows::process::CommandExt::raw_arg(&mut command, format!("/D={}", target.display()));
    #[cfg(not(windows))]
    command.arg(format!("/D={}", target.display()));
    run(&mut command, "installer", "the installer itself")
}
