use std::ffi::OsString;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::OnceLock;
use std::time::Duration;

use crate::{version_newer, Os, Platform};

pub const SHELL_LIMIT: Duration = Duration::from_secs(3);
pub const NO_SHELL: &str = "FORMPORTAL_NO_SHELL_PATH";
pub const NO_SYSTEM: &str = "FORMPORTAL_NO_SYSTEM_DIRS";
const OPEN: &str = "__FORMPORTAL_PATH_OPEN__";
const CLOSE: &str = "__FORMPORTAL_PATH_CLOSE__";
const SHELLS: &[&str] = &["zsh", "bash", "fish", "ksh", "sh", "dash"];

const HOME_DIRS: &[&str] = &[
    ".local/bin",
    ".claude/local",
    ".npm-global/bin",
    ".npm-packages/bin",
    ".volta/bin",
    ".asdf/shims",
    ".local/share/mise/shims",
    ".nodenv/shims",
    ".bun/bin",
    ".yarn/bin",
    ".cargo/bin",
    ".nix-profile/bin",
    "bin",
];
const MACOS_HOME_DIRS: &[&str] = &["Library/pnpm", "Library/Application Support/fnm/aliases/default/bin"];
const LINUX_HOME_DIRS: &[&str] = &[".local/share/pnpm", ".local/share/fnm/aliases/default/bin", ".linuxbrew/bin"];
const MACOS_DIRS: &[&str] = &["/opt/homebrew/bin", "/usr/local/bin", "/opt/local/bin"];
const LINUX_DIRS: &[&str] = &["/usr/local/bin", "/home/linuxbrew/.linuxbrew/bin", "/snap/bin"];
const WINDOWS_HOME_DIRS: &[&str] = &[".local\\bin", ".claude\\local", ".bun\\bin", ".volta\\bin", ".cargo\\bin", "scoop\\shims"];
const WINDOWS_VAR_DIRS: &[(&str, &str)] = &[
    ("APPDATA", "npm"),
    ("LOCALAPPDATA", "pnpm"),
    ("LOCALAPPDATA", "Volta\\bin"),
    ("LOCALAPPDATA", "Microsoft\\WinGet\\Links"),
    ("ProgramFiles", "nodejs"),
    ("NVM_SYMLINK", ""),
];

fn nvm_dirs(home: &Path) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(home.join(".nvm").join("versions").join("node")) else { return Vec::new() };
    let mut versions: Vec<String> = entries.flatten().filter_map(|e| e.file_name().to_str().map(str::to_string)).collect();
    versions.sort_by(|a, b| if version_newer(a, b) { std::cmp::Ordering::Less } else if version_newer(b, a) { std::cmp::Ordering::Greater } else { a.cmp(b) });
    versions.into_iter().map(|v| home.join(".nvm").join("versions").join("node").join(v).join("bin")).collect()
}

pub fn known_dirs(os: Os, home: &Path, var: &dyn Fn(&str) -> Option<PathBuf>) -> Vec<PathBuf> {
    let mut out = Vec::new();
    if os == Os::Windows {
        out.extend(WINDOWS_HOME_DIRS.iter().map(|d| home.join(d)));
        for (name, rest) in WINDOWS_VAR_DIRS {
            if let Some(base) = var(name) {
                out.push(if rest.is_empty() { base } else { base.join(rest) });
            }
        }
        return out;
    }
    if let Some(prefix) = var("NPM_CONFIG_PREFIX") {
        out.push(prefix.join("bin"));
    }
    out.extend(HOME_DIRS.iter().map(|d| home.join(d)));
    out.extend(nvm_dirs(home));
    let (own, shared) = if os == Os::Macos { (MACOS_HOME_DIRS, MACOS_DIRS) } else { (LINUX_HOME_DIRS, LINUX_DIRS) };
    out.extend(own.iter().map(|d| home.join(d)));
    out.extend(shared.iter().map(PathBuf::from));
    out
}

pub fn shell_dirs(shell: &Path, limit: Duration) -> Option<Vec<PathBuf>> {
    let name = shell.file_name()?.to_str()?;
    if !SHELLS.contains(&name) {
        return None;
    }
    let script = format!("printf '%s%s%s' {OPEN} \"$PATH\" {CLOSE}");
    let mut child = Command::new(shell).args(["-l", "-i", "-c", &script]).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::null()).spawn().ok()?;
    let mut out = child.stdout.take()?;
    let (send, receive) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let mut seen = Vec::new();
        let mut chunk = [0u8; 4096];
        loop {
            match out.read(&mut chunk) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    seen.extend_from_slice(&chunk[..n]);
                    if String::from_utf8_lossy(&seen).contains(CLOSE) {
                        break;
                    }
                }
            }
        }
        let _ = send.send(seen);
    });
    let got = receive.recv_timeout(limit);
    let _ = child.kill();
    let _ = child.wait();
    let text = String::from_utf8_lossy(&got.ok()?).to_string();
    let inner = text.split(OPEN).nth(1)?.split(CLOSE).next()?.to_string();
    let dirs: Vec<PathBuf> = std::env::split_paths(&inner).filter(|d| d.is_absolute()).collect();
    (!dirs.is_empty()).then_some(dirs)
}

fn session_shell() -> &'static [PathBuf] {
    static ASKED: OnceLock<Vec<PathBuf>> = OnceLock::new();
    ASKED.get_or_init(|| {
        if cfg!(windows) || std::env::var_os(NO_SHELL).is_some() {
            return Vec::new();
        }
        let fallback = if cfg!(target_os = "macos") { "/bin/zsh" } else { "/bin/bash" };
        let shell = std::env::var_os("SHELL").map(PathBuf::from).filter(|s| s.is_file()).unwrap_or_else(|| PathBuf::from(fallback));
        shell_dirs(&shell, SHELL_LIMIT).unwrap_or_default()
    })
}

pub fn warm() {
    let _ = session_shell();
}

pub fn order(process: Vec<PathBuf>, shell: &[PathBuf], known: Vec<PathBuf>) -> Vec<PathBuf> {
    let mut out: Vec<PathBuf> = Vec::new();
    for dir in process.into_iter().chain(shell.iter().cloned()).chain(known) {
        if !dir.as_os_str().is_empty() && !out.contains(&dir) {
            out.push(dir);
        }
    }
    out
}

fn home() -> PathBuf {
    std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE")).map(PathBuf::from).unwrap_or_else(|| PathBuf::from("."))
}

pub fn search_dirs() -> Vec<PathBuf> {
    let process = std::env::var_os("PATH").map(|p| std::env::split_paths(&p).collect()).unwrap_or_default();
    let known = known_dirs(Platform::current().os, &home(), &|name| std::env::var_os(name).filter(|v| !v.is_empty()).map(PathBuf::from));
    let known = if std::env::var_os(NO_SYSTEM).is_some() { under(known, &home()) } else { known };
    order(process, session_shell(), known)
}

pub fn under(dirs: Vec<PathBuf>, home: &Path) -> Vec<PathBuf> {
    dirs.into_iter().filter(|dir| dir.starts_with(home)).collect()
}

fn runnable(path: &Path) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        path.metadata().map(|m| m.is_file() && m.permissions().mode() & 0o111 != 0).unwrap_or(false)
    }
    #[cfg(not(unix))]
    {
        path.is_file()
    }
}

pub fn find_in(dirs: &[PathBuf], program: &str) -> Option<PathBuf> {
    let names = if cfg!(windows) { vec![format!("{program}.exe"), format!("{program}.cmd")] } else { vec![program.to_string()] };
    dirs.iter().flat_map(|dir| names.iter().map(move |name| dir.join(name))).find(|candidate| runnable(candidate))
}

pub fn find(program: &str) -> Option<PathBuf> {
    find_in(&search_dirs(), program).or_else(|| searched(program))
}

const WINDOWS_SEARCH: &[(&str, &[&str])] = &[("agy", &["antigravity", "agy"])];
const ENV_NOTE: &str = "use -[v]S to pass options";

pub fn find_under(root: &Path, fragments: &[&str], file: &str) -> Option<PathBuf> {
    let named = |dir: &Path| dir.file_name().map(|n| n.to_string_lossy().to_lowercase()).is_some_and(|n| fragments.iter().any(|f| n.contains(f)));
    let folders = |dir: &Path| -> Vec<PathBuf> {
        let mut out: Vec<PathBuf> = std::fs::read_dir(dir).map(|entries| entries.flatten().map(|e| e.path()).filter(|p| p.is_dir()).collect()).unwrap_or_default();
        out.sort();
        out
    };
    let mut places = Vec::new();
    for one in folders(root) {
        if named(&one) {
            places.push(one.clone());
        }
        places.extend(folders(&one).into_iter().filter(|two| named(&one) || named(two)));
    }
    places.into_iter().map(|dir| dir.join(file)).find(|candidate| runnable(candidate))
}

fn searched(program: &str) -> Option<PathBuf> {
    if !cfg!(windows) {
        return None;
    }
    let fragments = WINDOWS_SEARCH.iter().find(|(name, _)| *name == program)?.1;
    let root = std::env::var_os("LOCALAPPDATA").filter(|v| !v.is_empty()).map(PathBuf::from).unwrap_or_else(|| home().join("AppData").join("Local"));
    find_under(&root, fragments, &format!("{program}.exe"))
}

pub fn last_line(text: &str) -> Option<&str> {
    text.lines().rev().map(str::trim).find(|line| !line.is_empty() && !line.contains(ENV_NOTE))
}

pub fn child_path(exe: &Path, dirs: &[PathBuf]) -> OsString {
    let mut first: Vec<PathBuf> = Vec::new();
    if let Some(dir) = exe.parent() {
        first.push(dir.to_path_buf());
    }
    if let Some(dir) = exe.canonicalize().ok().and_then(|real| real.parent().map(Path::to_path_buf)) {
        first.push(dir);
    }
    let all = order(first, dirs, Vec::new());
    std::env::join_paths(all.iter().filter(|d| !d.to_string_lossy().contains(if cfg!(windows) { ';' } else { ':' }))).unwrap_or_default()
}

pub fn command(exe: &Path) -> Command {
    let mut command = Command::new(exe);
    command.env("PATH", child_path(exe, &search_dirs()));
    command
}
