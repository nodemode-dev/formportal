# HASHOUT_LOG · hub/src-tauri · formai_dev

Living log for the hub's desktop shell. Source files stay comment-free; what they would have said lives here.

Current build version: v0.1.0
Last updated: 2026-10-04 · scaffold

---

## Org-navi-map

```
hub/src-tauri/
├── Cargo.toml                 the shell crate, named formai; tauri and formai-core
├── build.rs                   tauri_build::build()
├── tauri.conf.json            identity, the one window, the CSP, the bundle
├── capabilities/default.json  core:default for the main window, nothing else
├── icons/                     the app icon set, drawn from the family mark
└── src/main.rs                the command surface and the run loop
```

---

## Table of contents

- [Cargo.toml](#cargo)
- [tauri.conf.json](#conf)
- [capabilities/default.json](#capabilities)
- [icons/](#icons)
- [src/main.rs](#main)

---

## Cargo.toml {#cargo}

### Cargo.toml · no plugins yet
- refers-to: Cargo.toml :: `[dependencies]`
- kind: explainer
- logged: v0.1.0 · 2026-10-04

Only `tauri` and `formai-core`. The three family apps carry `tauri-plugin-shell` to run an engine sidecar; the hub has no sidecar, so it has no shell plugin. The updater, deep-link, single-instance and process plugins arrive in Phase 6, each entered in `LICENSES.md` and in the capability file when it is added.

---

## tauri.conf.json {#conf}

### tauri.conf.json · identifier
- refers-to: tauri.conf.json :: `identifier`
- kind: warning-context
- logged: v0.1.0 · 2026-10-04

`dev.formai.hub`, agreed with the owner on 2026-10-04. It names the app-data folder and the bundle id and must not change once a build has shipped.

### tauri.conf.json · the window
- refers-to: tauri.conf.json :: `app.windows[0]`
- kind: rationale
- logged: v0.1.0 · 2026-10-04

Declared here rather than built in Rust because nothing has to happen before it opens (the family apps wait for an engine's port; the hub has none). 1180 by 760, centred, never smaller than 880 by 600. The family's editors open at a fraction of the monitor; a launcher has a fixed amount to show, so it opens at a fixed size and can be resized. Native decorations are kept on all three systems.

### tauri.conf.json · devUrl and frontendDist
- refers-to: tauri.conf.json :: `build`
- kind: explainer
- logged: v0.1.0 · 2026-10-04

A debug build loads `http://localhost:3250`, the hub interface's dev server, which must be running (`./formai_dev desktop` starts both). A release build embeds `../frontend/dist`, which must have been built first. There is no `beforeDevCommand` or `beforeBuildCommand`: the scripts do that step, as the family's build scripts do.

### tauri.conf.json · the CSP
- refers-to: tauri.conf.json :: `app.security.csp`
- kind: rationale
- logged: v0.1.0 · 2026-10-04

The family's apps set `csp: null` because their page is a loopback client with no Tauri API. The hub's page calls commands, so it gets a real policy: everything from the app's own origin, images also from `data:`, connections only to Tauri's IPC. No inline script is needed, which is why the interface applies its theme from `prepaint.js`. Not yet exercised in a running window; if Tauri's own injected scripts need more, widen it here and record why.

### tauri.conf.json · bundle
- refers-to: tauri.conf.json :: `bundle`
- kind: explainer
- logged: v0.1.0 · 2026-10-04

`targets: "all"`. On macOS `signingIdentity: "-"` signs ad hoc, as formcut does, so a downloaded copy is sealed and opens through Privacy and Security, Open Anyway; the owner adds a Developer ID when the builds are stable. Windows is unsigned for now by the owner's decision. Minimum macOS 12.0, as formvis and formwav.

---

## capabilities/default.json {#capabilities}

### capabilities/default.json · ledger
- refers-to: capabilities/default.json :: `permissions`
- kind: explainer
- logged: v0.1.0 · 2026-10-04

| Permission | Feature that needs it |
| --- | --- |
| `core:default` | the window itself and the IPC the hub's own commands use |

Commands defined in `main.rs` are part of the app and need no plugin permission. Anything added here must name its feature in this table.

---

## icons/ {#icons}

### icons/ · how they were made
- refers-to: icons/icon.png and the set beside it
- kind: explainer
- logged: v0.1.0 · 2026-10-04

Drawn once at 1024 pixels from the family mark (three bars in amber, off-purple and teal on the family ground, in a rounded square) and resized to the set `tauri.conf.json` lists. A placeholder until the owner supplies a mark; Phase 6's build scripts regenerate the set from `icon.png` with `cargo tauri icon`.

---

## v0.12.0 · the Linux app built, opened and used; the release packer {#v012}

### hub/setup/build_linux_app · run for real
- refers-to: hub/setup/build_linux_app
- kind: explainer
- logged: v0.12.0 · 2026-10-06

Run as written in the build container (Ubuntu 24.04, Rust 1.99.0, WebKitGTK 4.1, with `patchelf` installed, and `APPIMAGE_EXTRACT_AND_RUN=1` and `NO_STRIP=true` in the environment because a container has no FUSE and the AppImage tool's own strip is old). It built `formai_<version>_amd64.deb` (3.25 MiB) and `formai_<version>_amd64.AppImage` (78 MiB) under `hub/target/release/bundle/`. A release build takes about ten minutes cold here; the release profile has `lto`. The script needed no change. The two environment variables are a container's need, not the script's, so they are not in it; the workflow's runner has FUSE.

### the real window, opened and driven
- refers-to: the built `hub/target/release/formai`; src/main.rs :: every command; tauri.conf.json :: the CSP, withGlobalTauri
- kind: explainer
- logged: v0.12.0 · 2026-10-06

The built binary was started under a virtual display (Xvfb, 1280 by 860, with WebKit's compositing off) with its data folder pointed at a scratch folder, beside a local site serving a test catalogue and a local server holding a test archive. What was seen and done, by screen capture and by keyboard and mouse through `xdotool`:

1. The window opened at 1180 by 760 showing the interface as designed: the rail, the three rows in their hues, Inter, the version in the rail. So the page loads under the shell's Content-Security-Policy, and the theme script, the stylesheet and the font are all allowed by it.
2. With nothing configured, the Apps pane showed the core's own sentence in red: the download of `https://formai.dev/catalog/v1/apps.json` did not complete. So the interface found `window.__TAURI__`, chose the shell's bridge, and the `catalog` command ran the core and returned its error to the page. (Here the failure was the container's proxy presenting an unknown certificate; on any machine today it would be that formai.dev is not deployed.)
3. In Settings, the catalogue address was typed and the Developer box ticked from the keyboard. The Apps pane then showed formcut as available: local storage, the change handlers and the reload work in the real web view.
4. Install was pressed. The shell downloaded the archive from the local server, the core verified and unpacked it, and the row read Installed 2.6.2 with Remove and Open. `installed.json` in the scratch folder records the version, its folder and its SHA-256.
5. Open was pressed, and the installed file ran (it wrote its marker).

Found by this run and fixed in the interface: the two rows whose products the test catalogue did not list were blank, because a row was only written when its own product arrived. Not seen: progress events moving the bar (the archive is small and the capture was taken after), Update, Roll back and Remove in the real window (they were exercised in a browser and in the core separately), and anything on a real desktop with a compositor.

### hub/setup/package_release.py · the release in formcut's shape
- refers-to: hub/setup/package_release.py :: pack, finish, members, floor; .github/workflows/desktop.yml :: Pack, the `release` job
- kind: explainer
- logged: v0.12.0 · 2026-10-06

`--platform` and `--arch` pack one system's bundle as `formai-<version>-<platform>-<arch>.zip` in `release-dist/` and write that asset's entry beside it; `--finish` gathers the entries into `manifest.json` (name, version, commit, published, repository, assets with platform, arch, file, bytes, sha256, minimum_os) and `SHA256SUMS`, which is the shape the site's resolver reads from formcut. Linux packs the AppImage as `formai.AppImage` (or the `.deb` if there is no AppImage), Windows the NSIS installer, macOS the `.app` through `ditto` so its links and permissions survive. The Linux floor is read from the machine that built it (glibc 2.39 here, 2.35 on the workflow's runner). Run here for Linux: an 81 MB zip, its hash verified against `SHA256SUMS`. **The macOS and Windows branches have not been run.** The workflow now packs in each build job and has a last job that finishes and drafts the release; it too has not been run.

## v0.11.0 · the command surface, and building the app {#v011}

### src/main.rs · commands over the core
- refers-to: src/main.rs :: platform, catalog, installs, install, open, rollback, remove, Progress
- kind: explainer
- logged: v0.11.0 · 2026-10-06

Seven commands, each a thin call into `formai-core`'s `Hub` at its default per-user folder; no logic lives here. `catalog` and `install` do network and disk work, so they run on a blocking thread and the window stays responsive. `install` reads the catalogue again through the hub (verified, and from the kept copy if the site is unreachable) so the file it installs is the one the catalogue lists now, not one the page remembered; it emits `install-progress` with product, channel, bytes so far and total each time the percentage changes. Errors cross to the page as the core's own sentences. The commands need no capability beyond `core:default`: they are the app's own, and listening to an event is part of the core set.

### tauri.conf.json · withGlobalTauri
- refers-to: tauri.conf.json :: `app.withGlobalTauri`
- kind: rationale
- logged: v0.11.0 · 2026-10-06

Puts Tauri's `invoke` and `listen` on `window.__TAURI__`, so the interface calls the shell with no package and no bundler step. Its presence is also how the interface knows it is inside the shell.

### hub/setup/, .github/workflows/desktop.yml · building the app
- refers-to: hub/setup/build_macos_app, build_linux_app, build_windows_app.bat; .github/workflows/desktop.yml
- kind: warning-context
- logged: v0.11.0 · 2026-10-06

One script per system: build the interface, then `npx @tauri-apps/cli@2 build` for that system's bundles (`.app` and `.dmg`; `.deb` and AppImage; NSIS and MSI). The workflow runs the three on GitHub's macOS, Ubuntu 22.04 and Windows runners by hand and keeps each bundle folder as an artifact. **All four files are written and not run.** The next version runs the Linux script in the build container, opens the result under a virtual display, and adds the step that turns the bundles into a release in formcut's shape.

## src/main.rs {#main}

### src/main.rs · the command surface
- refers-to: src/main.rs :: platform, the invoke handler
- kind: explainer
- logged: v0.1.0 · 2026-10-04

One command, `platform`, returning the core's answer. It proves the shell links the core and gives the interface's real bridge its first call in Phase 6. Every later command is a thin call into `formai-core`; no logic lives in this file.

### src/main.rs · windows_subsystem
- refers-to: src/main.rs :: the first line
- kind: explainer
- logged: v0.1.0 · 2026-10-04

Stops a console window opening beside the app in a Windows release build.
