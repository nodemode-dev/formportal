# Organisations

FormPortal has no server of its own to manage it from. An organisation manages it with two things it already controls: a policy file on each computer and, if it wants, a mirror of the catalogue on its own server.

## The policy file

| System | Path |
| --- | --- |
| Linux | `/etc/formportal/policy.json` |
| macOS | `/Library/Application Support/FormPortal/policy.json` |
| Windows | `%ProgramData%\FormPortal\policy.json` |

Put it there with the tools already used for the computers (a configuration profile, Group Policy or Intune file deployment, a package or Ansible). It should be writable only by administrators; FormPortal reads it at every start and before every install.

```json
{
  "format": "formportal-policy",
  "managed_by": "Example IT",
  "catalog": "https://apps.example.internal/formportal/apps.json",
  "catalog_keys": ["base64 Ed25519 public key of the mirror"],
  "allow_unsigned": false,
  "auto_update": true,
  "auto_update_beta": false,
  "only_when_closed": true,
  "keep_previous": true,
  "apps": ["formcut", "formvis"],
  "channels": ["stable"],
  "extensions": true,
  "sideload": false
}
```

| Field | Effect when present |
| --- | --- |
| `managed_by` | the name shown in Settings and in refusals |
| `catalog` | the only catalogue address used; Settings shows it and cannot change it |
| `catalog_keys` | extra trusted catalogue keys, for a mirror the organisation signs |
| `allow_unsigned` | `false` refuses unsigned catalogues and unsigned native extensions even with the developer setting |
| `auto_update`, `auto_update_beta`, `only_when_closed`, `keep_previous` | fixes that preference; `auto_update` also clears the per-app choices |
| `apps` | only these product ids install |
| `channels` | only these channels (`stable`, `beta`, `nightly`) install |
| `extensions` | `false` turns extensions off |
| `sideload` | `false` refuses extensions installed from a file |

Every field but `format` is optional. An unknown field or a file that does not parse refuses every install until it is fixed, so a typo cannot silently drop a restriction. Locked settings are disabled in Settings, apps that are not allowed say "Not allowed by your organisation", and the command line and MCP server refuse with the same reason. `./formportal cli policy` and the `policy` tool print what is in force.

For trying a policy without administrator rights, `FORMPORTAL_POLICY` names a policy file; it is read only when there is no system file, and it is reported as a test policy.

## A mirror on an internal server

```shell
FORMPORTAL_MIRROR_KEY=<base64 Ed25519 seed> ./formportal cli mirror \
  --to /srv/formportal --base-url https://apps.example.internal/formportal \
  --platforms windows,macos --channels stable --history
```

The mirror reads and verifies the public catalogue, downloads every file it names into `files/[product]/[channel]/[version]/` and checks each SHA-256, rewrites every address to the base address, writes `apps.json` and signs it with the mirror key. Serve the folder at the base address, then set `catalog` to the result's `address` and `catalog_keys` to its `public_key`. Computers then install with no access to formai.studio or GitHub. Without a key the mirror is unsigned and only computers with the developer setting accept it.

Make the key pair with formai_dev's `python -m app.signing`, or any Ed25519 tool that prints the 32-byte seed and public key in base64.

## Installing FormPortal silently

A person can install FormPortal for themselves with no administrator: the NSIS setup on Windows, the dmg on macOS, the AppImage on Linux. For a managed rollout: Windows `msiexec /i FormPortal_[version]_x64_en-US.msi /qn` (the msi installs for every user, in Program Files, so it needs an administrator; the NSIS setup with `/S` installs only for the account that runs it); macOS, copy `FormPortal.app` from the dmg into Applications; Linux, the deb or the rpm. These are the installers' standard switches. The release ships the NSIS setup only; build the msi from this repository on Windows with `set FORMPORTAL_BUNDLES=nsis,msi` before `setup\build_windows_app.bat`.

## One package for a managed rollout

`formportal-cli org-package` makes one folder your deployment tool can push and run:

```
./formportal cli org-package --policy policy.json --installer FormPortal_0.51.0_x64_en-US.msi --to formportal-managed
```

It checks the policy the way FormPortal will read it, then writes the installer, `policy.json`, `SHA256SUMS`, a `README.txt` and the install script for that platform: `install.cmd` and `install.ps1` for the msi, `install.sh` for the dmg, deb, rpm or AppImage. Run as administrator or root, the script stops if any file no longer matches its sum, puts the policy at the system path (above) before FormPortal is installed, so its first start is already managed, then installs FormPortal silently: `msiexec /qn` on Windows, `FormPortal.app` into Applications on macOS, `dpkg` or `rpm` on Linux, or the AppImage in `/opt/formportal`.

The NSIS setup is refused, since it installs for one person. Installer names may hold only letters, digits, dots, dashes and underscores, because the script names the file. The Linux deb package was run end to end; the Windows and macOS scripts have not yet been run on a managed computer.
