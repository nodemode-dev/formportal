use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Child, ExitStatus};
use std::time::{Duration, Instant};

use crate::agents::APP_FILE;
use crate::error::{CoreError, Result};
use crate::process::{self, Running};

pub const HELPER_ENDINGS: [&str; 5] = ["-engine", "-core", "-server", "-backend", "-host"];
pub const HELPER_PREFIX: &str = "fw";
pub const UNINSTALLER_PREFIX: &str = "unins";
pub const WINDOW_PROGRAM: u16 = 2;
pub const CONSOLE_PROGRAM: u16 = 3;
pub const NO_CONSOLE_WINDOW: u32 = 0x0800_0000;
pub const NEW_CONSOLE_WINDOW: u32 = 0x0000_0010;
pub const SETTLE: Duration = Duration::from_secs(8);
pub const GUIDE_DEPTH: usize = 3;
pub const TERMINALS: [(&str, &str); 5] = [("x-terminal-emulator", "-e"), ("gnome-terminal", "--"), ("konsole", "-e"), ("xfce4-terminal", "-x"), ("xterm", "-e")];

pub fn guide_name(product: &str) -> String {
    format!("install {}.{}", product.to_lowercase(), if cfg!(target_os = "windows") { "bat" } else { "command" })
}

pub fn guide(folder: &Path, product: &str) -> Option<PathBuf> {
    let wanted = guide_name(product);
    let mut at = folder.to_path_buf();
    for _ in 0..GUIDE_DEPTH {
        let entries: Vec<PathBuf> = fs::read_dir(&at).ok()?.flatten().map(|e| e.path()).collect();
        if let Some(found) = entries.iter().find(|p| p.is_file() && p.file_name().is_some_and(|n| n.to_string_lossy().to_lowercase() == wanted)) {
            return Some(found.clone());
        }
        let mut folders = entries.into_iter().filter(|p| p.is_dir() && !p.extension().is_some_and(|x| x.eq_ignore_ascii_case("app")));
        match (folders.next(), folders.next()) {
            (Some(only), None) => at = only,
            _ => return None,
        }
    }
    None
}

pub fn in_terminal(script: &Path) -> Result<std::process::Command> {
    let dirs: Vec<PathBuf> = std::env::var_os("PATH").map(|p| std::env::split_paths(&p).collect()).unwrap_or_default();
    let found = TERMINALS.iter().find_map(|(name, flag)| dirs.iter().map(|d| d.join(name)).find(|p| p.is_file()).map(|p| (p, *flag)));
    let Some((terminal, flag)) = found else {
        return Err(CoreError::Invalid(format!("FormPortal found no terminal program to run this in. Nothing was started. Open a terminal and run {}", script.display())));
    };
    let mut command = std::process::Command::new(terminal);
    command.arg(flag).arg(script);
    outside(&mut command);
    Ok(command)
}

pub const APPIMAGE_FOLDER: &str = "APPDIR";
pub const APPIMAGE_MARKERS: [&str; 4] = ["APPDIR", "APPIMAGE", "OWD", "ARGV0"];
pub const APPIMAGE_LISTS: [&str; 3] = ["XDG_DATA_DIRS", "PATH", "LD_LIBRARY_PATH"];
pub const SYSTEM_DATA: &str = "/usr/share";

pub fn outside_changes(vars: &[(String, String)], folder: &str) -> Vec<(String, Option<String>)> {
    let root = folder.trim_end_matches('/');
    let mut changes = Vec::new();
    if root.is_empty() {
        return changes;
    }
    for (name, value) in vars {
        if APPIMAGE_MARKERS.contains(&name.as_str()) || (name == "GTK_THEME" && value.is_empty()) {
            changes.push((name.clone(), None));
        } else if value.contains(root) {
            let kept: Vec<&str> = if APPIMAGE_LISTS.contains(&name.as_str()) { value.split(':').filter(|e| !e.is_empty() && !e.contains(root)).collect() } else { Vec::new() };
            let only_default = name == "XDG_DATA_DIRS" && kept == [SYSTEM_DATA];
            changes.push((name.clone(), (!kept.is_empty() && !only_default).then(|| kept.join(":"))));
        }
    }
    changes
}

pub fn outside(command: &mut std::process::Command) -> &mut std::process::Command {
    if !cfg!(target_os = "linux") {
        return command;
    }
    let Some(folder) = std::env::var(APPIMAGE_FOLDER).ok().filter(|f| !f.trim().is_empty()) else { return command };
    let vars: Vec<(String, String)> = std::env::vars_os().filter_map(|(k, v)| Some((k.into_string().ok()?, v.into_string().ok()?))).collect();
    for (name, value) in outside_changes(&vars, &folder) {
        match value {
            Some(value) => command.env(name, value),
            None => command.env_remove(name),
        };
    }
    command
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Choice {
    Program(String),
    Nothing,
    Unclear(String),
}

pub fn program_stem(name: &str) -> Option<String> {
    let lower = name.to_lowercase();
    lower.strip_suffix(".exe").filter(|s| !s.is_empty()).map(str::to_string)
}

pub fn uninstaller(stem: &str) -> bool {
    stem.starts_with(UNINSTALLER_PREFIX)
}

pub fn helper(stem: &str) -> bool {
    HELPER_ENDINGS.iter().any(|e| stem.ends_with(e)) || stem.starts_with(HELPER_PREFIX)
}

pub fn plain_program(name: &str) -> bool {
    program_stem(name).is_some() && name.len() <= 128 && !name.starts_with('.') && !name.contains(['/', '\\', ':']) && !name.chars().any(|c| c.is_control())
}

pub fn subsystem(bytes: &[u8]) -> Option<u16> {
    if bytes.get(..2)? != b"MZ" {
        return None;
    }
    let at = u32::from_le_bytes(bytes.get(0x3c..0x40)?.try_into().ok()?) as usize;
    if bytes.get(at..at.checked_add(4)?)? != b"PE\0\0" {
        return None;
    }
    let optional = at.checked_add(24)?;
    let magic = u16::from_le_bytes(bytes.get(optional..optional + 2)?.try_into().ok()?);
    if magic != 0x10b && magic != 0x20b {
        return None;
    }
    let field = optional + 68;
    Some(u16::from_le_bytes(bytes.get(field..field + 2)?.try_into().ok()?))
}

pub fn head(path: &Path) -> Option<Vec<u8>> {
    let mut file = File::open(path).ok()?;
    let mut bytes = vec![0u8; 64];
    file.read_exact(&mut bytes).ok()?;
    let at = u32::from_le_bytes(bytes.get(0x3c..0x40)?.try_into().ok()?) as usize;
    let need = at.checked_add(24 + 70)?;
    if !(64..=1 << 20).contains(&need) {
        return None;
    }
    bytes.resize(need, 0);
    file.read_exact(&mut bytes[64..]).ok()?;
    Some(bytes)
}

pub fn aliases(app: Option<&str>, name: Option<&str>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for text in [app, name].into_iter().flatten() {
        let lower = text.to_lowercase();
        let joined: String = lower.chars().filter(|c| c.is_ascii_alphanumeric()).collect();
        let dashed = lower.split(|c: char| !c.is_ascii_alphanumeric()).filter(|p| !p.is_empty()).collect::<Vec<_>>().join("-");
        for alias in [joined, dashed] {
            if !alias.is_empty() && !out.contains(&alias) {
                out.push(alias);
            }
        }
    }
    out
}

pub fn windows_program(product: &str, known: &[String], declared: Option<&str>, names: &[String], header: &dyn Fn(&str) -> Option<Vec<u8>>) -> Choice {
    let programs: Vec<(&String, String)> = names.iter().filter_map(|n| program_stem(n).map(|s| (n, s))).collect();
    if programs.is_empty() {
        return Choice::Nothing;
    }
    let kind = |name: &str| header(name).and_then(|b| subsystem(&b));
    if let Some(wanted) = declared.filter(|d| plain_program(d)) {
        if let Some((name, _)) = programs.iter().find(|(n, s)| n.eq_ignore_ascii_case(wanted) && !uninstaller(s)) {
            if kind(name) == Some(WINDOW_PROGRAM) {
                return Choice::Program((*name).clone());
            }
        }
    }
    let candidates: Vec<&(&String, String)> = programs.iter().filter(|(_, s)| !uninstaller(s) && !helper(s)).collect();
    let mut wanted: Vec<String> = vec![product.to_lowercase()];
    wanted.extend(known.iter().map(|a| a.to_lowercase()));
    let desktop: Vec<String> = wanted.iter().map(|w| format!("{w}-desktop")).collect();
    wanted.extend(desktop);
    let named = wanted.iter().find_map(|w| candidates.iter().find(|(_, s)| s == w));
    let picked = match named {
        Some(found) => found,
        None if candidates.len() == 1 => &candidates[0],
        None if candidates.is_empty() => return Choice::Unclear("It holds no program that is not a helper or an uninstaller".to_string()),
        None => {
            let list = candidates.iter().map(|(n, _)| n.as_str()).collect::<Vec<_>>().join(", ");
            return Choice::Unclear(format!("It holds {list}, and none of them is named for the app"));
        }
    };
    match kind(picked.0) {
        Some(WINDOW_PROGRAM) => Choice::Program(picked.0.clone()),
        Some(CONSOLE_PROGRAM) => Choice::Unclear(format!("{} is a console program, not the app's window", picked.0)),
        _ => Choice::Unclear(format!("{} could not be read as a Windows window program", picked.0)),
    }
}

pub fn unclear(app: &str, folder: &Path, why: &str) -> String {
    format!("FormPortal could not tell which program opens {app}. {why}. Nothing was started. The app's folder is {}. Repair {app} or install it again, and report this if it stays", folder.display())
}

fn manifest(folder: &Path) -> serde_json::Value {
    fs::read_to_string(folder.join(APP_FILE)).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or(serde_json::Value::Null)
}

pub fn display_name(folder: &Path, product: &str) -> String {
    manifest(folder).get("name").and_then(|v| v.as_str()).map(str::trim).filter(|n| !n.is_empty() && n.len() <= 64 && !n.chars().any(|c| c.is_control())).unwrap_or(product).to_string()
}

pub fn windows_target(folder: &Path, product: &str) -> Result<Option<PathBuf>> {
    let mut names: Vec<String> = fs::read_dir(folder)?.flatten().filter(|e| e.path().is_file()).filter_map(|e| e.file_name().into_string().ok()).collect();
    names.sort();
    let file = manifest(folder);
    let field = |key: &str| file.get(key).and_then(|v| v.as_str());
    let declared = file.get("launch").and_then(|l| l.get("windows")).and_then(|w| w.as_str());
    let known = aliases(field("app"), field("name"));
    match windows_program(product, &known, declared, &names, &|name| head(&folder.join(name))) {
        Choice::Program(name) => Ok(Some(folder.join(name))),
        Choice::Nothing => Ok(None),
        Choice::Unclear(why) => Err(CoreError::Invalid(unclear(&display_name(folder, product), folder, &why))),
    }
}

pub fn window_only(folder: &Path, product: &str, target: &Path) -> Result<()> {
    let name = target.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
    let stem = program_stem(&name).unwrap_or_default();
    let why = if uninstaller(&stem) || helper(&stem) {
        format!("{name} is a helper, not the app")
    } else {
        match head(target).and_then(|b| subsystem(&b)) {
            Some(WINDOW_PROGRAM) => return Ok(()),
            Some(CONSOLE_PROGRAM) => format!("{name} is a console program, not the app's window"),
            _ => format!("{name} could not be read as a Windows window program"),
        }
    };
    Err(CoreError::Invalid(unclear(&display_name(folder, product), folder, &why)))
}

fn inside<'a>(running: &'a [Running], folder: &Path) -> Vec<&'a Running> {
    running.iter().filter(|r| process::within(folder, &r.path)).collect()
}

fn helper_process(running: &Running) -> bool {
    running.path.file_name().and_then(|n| program_stem(&n.to_string_lossy())).map(|s| helper(&s)).unwrap_or(false)
}

pub fn app_open(running: &[Running], folder: &Path) -> bool {
    inside(running, folder).into_iter().any(|r| !helper_process(r))
}

pub fn strays(running: &[Running], folder: &Path) -> Vec<u32> {
    let found = inside(running, folder);
    if found.iter().any(|r| !helper_process(r)) {
        return Vec::new();
    }
    let mut pids: Vec<u32> = found.iter().map(|r| r.pid).collect();
    pids.sort();
    pids.dedup();
    pids
}

pub fn worth_telling(code: Option<i32>, quiet_zero: bool) -> bool {
    code != Some(0) || !quiet_zero
}

pub fn closed_early(app: &str, code: Option<i32>, target: &Path) -> String {
    let exit = match code {
        Some(n) => format!("exit code {n}"),
        None => "no exit code, it was stopped from outside".to_string(),
    };
    format!("{app} did not stay open: it closed right after starting ({exit}). FormPortal started {}. FormPortal keeps no record of where {app} writes its log. Repair {app} or install it again, and report this if it stays", target.display())
}

#[derive(Debug)]
pub struct Started {
    pub pid: u32,
    pub name: String,
    pub target: PathBuf,
    pub quiet_zero: bool,
    pub cleared: Vec<u32>,
    pub child: Child,
}

impl Started {
    pub fn exit_within(&mut self, within: Duration) -> Option<ExitStatus> {
        let until = Instant::now() + within;
        loop {
            if let Ok(Some(status)) = self.child.try_wait() {
                return Some(status);
            }
            if Instant::now() >= until {
                return None;
            }
            std::thread::sleep(Duration::from_millis(100));
        }
    }

    pub fn left_early(&mut self, within: Duration) -> Option<String> {
        let status = self.exit_within(within)?;
        worth_telling(status.code(), self.quiet_zero).then(|| closed_early(&self.name, status.code(), &self.target))
    }
}
