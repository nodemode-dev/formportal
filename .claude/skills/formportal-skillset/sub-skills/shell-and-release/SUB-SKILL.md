---
name: shell-and-release
description: Changes to FormPortal's Tauri 2 shell and its releases. Use for Tauri commands, capabilities, the CSP, deep links (formai://) and single instance, the window, bundling on macOS, Windows and Linux, signing, FormPortal's own updater, setup/build scripts, package_release.py, or the desktop workflow.
---

# shell-and-release

## Shape

- `src-tauri/src/main.rs`: commands `platform`, `catalog`, `installs`, `install` (emits `install-progress`), `open`, `rollback`, `remove`, `launch_link`; plugins single-instance (with deep-link) and deep-link; a link held at start-up is handed over once.
- `tauri.conf.json`: product FormPortal, identifier `studio.formai.portal`, scheme `formai`, CSP `script-src 'self'`, macOS ad hoc signing (`signingIdentity` "-").
- `setup/build_macos_app`, `build_linux_app`, `build_windows_app.bat` build bundles; `setup/package_release.py` packs them into `release-dist/` with `manifest.json` and `SHA256SUMS`; formcompiler (`nodemode-dev/formcompiler`) runs all three from a `compile_vX.Y.Z` branch and drafts the release `formportal-vX.Y.Z` on its own release page. This repository's CI only runs the checks.

## Rules

- Commands are thin calls into `core`; no logic in the shell.
- A Linux window needs WebKitGTK 4.1; a single-instance run needs a session bus (`dbus-run-session`).
- macOS and Windows bundles cannot be made on Linux; say so rather than claim them.
- Log in `src-tauri/HASHOUT_LOG.md`.
