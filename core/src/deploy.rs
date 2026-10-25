use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::download::sha256_file;
use crate::error::{CoreError, Result};
use crate::policy;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Package {
    pub dir: PathBuf,
    pub platform: &'static str,
    pub installer: String,
    pub run: String,
    pub files: Vec<String>,
    pub managed_by: Option<String>,
}

#[derive(Clone, Copy)]
enum Kind {
    Deb,
    Rpm,
    AppImage,
    Dmg,
    Msi,
}

fn kind(name: &str) -> Result<Kind> {
    let lower = name.to_ascii_lowercase();
    if lower.ends_with(".deb") {
        Ok(Kind::Deb)
    } else if lower.ends_with(".rpm") {
        Ok(Kind::Rpm)
    } else if lower.ends_with(".appimage") {
        Ok(Kind::AppImage)
    } else if lower.ends_with(".dmg") {
        Ok(Kind::Dmg)
    } else if lower.ends_with(".msi") {
        Ok(Kind::Msi)
    } else if lower.ends_with(".exe") {
        Err(CoreError::Invalid("the NSIS setup installs FormPortal for one person; a managed package for Windows uses the msi".into()))
    } else {
        Err(CoreError::Invalid(format!("{name} is not one of FormPortal's installers (deb, rpm, AppImage, dmg or msi)")))
    }
}

fn plain(name: &str) -> bool {
    !name.is_empty() && !name.starts_with('-') && name.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-' | '+'))
}

const REFUSE: &str = "A file in this package has changed since it was made; nothing was installed.";

fn unix_script(kind: Kind, installer: &str, by: &str) -> String {
    let (check, dest, step) = match kind {
        Kind::Deb => ("sha256sum -c SHA256SUMS", "/etc/formportal", "dpkg -i \"$INSTALLER\" || apt-get install -f -y".to_string()),
        Kind::Rpm => ("sha256sum -c SHA256SUMS", "/etc/formportal", "rpm -U --replacepkgs \"$INSTALLER\"".to_string()),
        Kind::AppImage => (
            "sha256sum -c SHA256SUMS",
            "/etc/formportal",
            "mkdir -p /opt/formportal\ninstall -m 0755 \"$INSTALLER\" /opt/formportal/FormPortal.AppImage\nln -sf /opt/formportal/FormPortal.AppImage /usr/local/bin/formportal".to_string(),
        ),
        _ => (
            "shasum -a 256 -c SHA256SUMS",
            "/Library/Application Support/FormPortal",
            "MNT=$(mktemp -d)\nhdiutil attach -nobrowse -readonly -quiet -mountpoint \"$MNT\" \"$INSTALLER\"\ntrap 'hdiutil detach -quiet \"$MNT\" || true' EXIT\n[ -d \"$MNT/FormPortal.app\" ] || { echo \"FormPortal.app is not in $INSTALLER; nothing was installed.\" >&2; exit 1; }\nrm -rf /Applications/FormPortal.app\nditto \"$MNT/FormPortal.app\" /Applications/FormPortal.app".to_string(),
        ),
    };
    format!(
        "#!/bin/sh\n\
         # FormPortal, managed{by}: installs FormPortal and the organisation's policy.\n\
         # Run as root (sudo sh install.sh) or from your deployment tool. Made by formportal-cli org-package.\n\
         set -eu\n\
         cd \"$(dirname \"$0\")\"\n\
         INSTALLER='{installer}'\n\
         [ \"$(id -u)\" -eq 0 ] || {{ echo \"Run this as root: sudo sh install.sh\" >&2; exit 1; }}\n\
         {check} >/dev/null || {{ echo \"{REFUSE}\" >&2; exit 1; }}\n\
         mkdir -p \"{dest}\"\n\
         install -m 0644 policy.json \"{dest}/policy.json\"\n\
         {step}\n\
         echo \"FormPortal and the policy are installed.\"\n"
    )
}

fn windows_script(installer: &str, by: &str) -> String {
    format!(
        "# FormPortal, managed{by}: installs FormPortal and the organisation's policy.\r\n\
         # Run as administrator (install.cmd) or from your deployment tool. Made by formportal-cli org-package.\r\n\
         $ErrorActionPreference = 'Stop'\r\n\
         Set-Location -LiteralPath $PSScriptRoot\r\n\
         $installer = '{installer}'\r\n\
         foreach ($line in Get-Content -LiteralPath 'SHA256SUMS') {{\r\n\
         \x20 $sum, $name = $line -split '  ', 2\r\n\
         \x20 if ((Get-FileHash -LiteralPath $name -Algorithm SHA256).Hash.ToLower() -ne $sum) {{ throw '{REFUSE}' }}\r\n\
         }}\r\n\
         $dir = Join-Path $env:ProgramData 'FormPortal'\r\n\
         New-Item -ItemType Directory -Force -Path $dir | Out-Null\r\n\
         Copy-Item -LiteralPath 'policy.json' -Destination (Join-Path $dir 'policy.json') -Force\r\n\
         $msi = (Resolve-Path -LiteralPath $installer).Path\r\n\
         $p = Start-Process -FilePath 'msiexec.exe' -ArgumentList @('/i', ('\"' + $msi + '\"'), '/qn', '/norestart') -Wait -PassThru\r\n\
         if ($p.ExitCode -ne 0 -and $p.ExitCode -ne 3010) {{ throw \"msiexec ended with $($p.ExitCode); FormPortal was not installed\" }}\r\n\
         Write-Output 'FormPortal and the policy are installed.'\r\n"
    )
}

fn readme(platform: &str, run: &str, by: &str) -> String {
    format!(
        "FormPortal, managed{by}\n\n\
         This folder installs FormPortal on {platform} with the organisation's policy in place before its first start.\n\n\
         Run: {run}\n\n\
         The script stops without changing anything if a file here no longer matches SHA256SUMS. It copies policy.json to\n\
         the place FormPortal reads it, then installs FormPortal silently. Deploy the folder with your own tools; FormPortal\n\
         has no admin console and no server. To change the policy later, deploy a new policy.json the same way.\n"
    )
}

pub fn package(policy_file: &Path, installer: &Path, out: &Path) -> Result<Package> {
    let policy = policy::check(policy_file)?;
    let name = installer
        .file_name()
        .and_then(|n| n.to_str())
        .map(str::to_string)
        .ok_or_else(|| CoreError::Invalid(format!("{} is not a file", installer.display())))?;
    if !installer.is_file() {
        return Err(CoreError::Invalid(format!("{} is not a file", installer.display())));
    }
    if !plain(&name) {
        return Err(CoreError::Invalid(format!("rename {name} to letters, digits, dots, dashes and underscores only; the install script names it")));
    }
    let kind = kind(&name)?;
    if out.exists() && fs::read_dir(out)?.next().is_some() {
        return Err(CoreError::Invalid(format!("{} is not empty; choose a new folder for the package", out.display())));
    }
    fs::create_dir_all(out)?;
    fs::copy(installer, out.join(&name))?;
    fs::copy(policy_file, out.join("policy.json"))?;
    let sums = format!("{}  {name}\n{}  policy.json\n", sha256_file(&out.join(&name))?, sha256_file(&out.join("policy.json"))?);
    fs::write(out.join("SHA256SUMS"), sums)?;
    let by = policy.managed_by.as_deref().map(|m| format!(" by {}", m.replace(['\n', '\r'], " "))).unwrap_or_default();
    let mut files = vec![name.clone(), "policy.json".to_string(), "SHA256SUMS".to_string()];
    let (platform, run) = match kind {
        Kind::Msi => {
            fs::write(out.join("install.ps1"), windows_script(&name, &by))?;
            fs::write(out.join("install.cmd"), "@echo off\r\npowershell -NoProfile -ExecutionPolicy Bypass -File \"%~dp0install.ps1\"\r\nexit /b %errorlevel%\r\n")?;
            files.extend(["install.ps1".to_string(), "install.cmd".to_string()]);
            ("Windows", "install.cmd as administrator".to_string())
        }
        Kind::Dmg => {
            fs::write(out.join("install.sh"), unix_script(kind, &name, &by))?;
            files.push("install.sh".to_string());
            ("macOS", "sudo sh install.sh".to_string())
        }
        _ => {
            fs::write(out.join("install.sh"), unix_script(kind, &name, &by))?;
            files.push("install.sh".to_string());
            ("Linux", "sudo sh install.sh".to_string())
        }
    };
    #[cfg(unix)]
    if let Ok(meta) = fs::metadata(out.join("install.sh")) {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = meta.permissions();
        perms.set_mode(0o755);
        fs::set_permissions(out.join("install.sh"), perms)?;
    }
    fs::write(out.join("README.txt"), readme(platform, &run, &by))?;
    files.push("README.txt".to_string());
    Ok(Package { dir: out.to_path_buf(), platform, installer: name, run, files, managed_by: policy.managed_by })
}
