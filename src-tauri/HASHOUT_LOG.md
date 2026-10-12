# HASHOUT_LOG · src-tauri · formportal

Living log for FormPortal's desktop shell (formai_dev's `hub/src-tauri` up to formai_dev 0.26.0; older entries keep the old names). Source files stay comment-free; what they would have said lives here.

Current build version: v0.39.0
Last updated: 2026-10-12 · media commands

## v0.39.0 · media commands {#media}

### media_view, media_save, media_remove, media_thumb
- refers-to: src/main.rs
- kind: explainer
- logged: v0.39.0 · 2026-10-12

Thin calls into the core; the index address is `media.json` beside the catalogue the interface uses. `media_save` with `use_template` opens the copy with the app that owns its extension. `media_thumb` returns the core's data URL. Compiled on Linux; thumbnails were exercised in the browser mode only, not through the shell.

## v0.38.0 · font commands {#fonts}

### fonts_view, font_install, font_pick, font_add, font_remove
- refers-to: src/main.rs
- kind: explainer
- logged: v0.38.0 · 2026-10-12

Thin calls into the core; the index address is `fonts.json` beside the catalogue the interface uses. `font_pick` uses the dialog plugin's file picker filtered to TTF, OTF and TTC. Compiled on Linux; the pickers were not opened here.

## v0.37.0 · Files, and a folder picker {#files}

### tauri-plugin-dialog for one native folder picker
- refers-to: src/main.rs :: folder_pick, files_scan, folder_add, folder_remove, file_open, file_versions, storage · Cargo.toml · LICENSES.md
- kind: decision
- logged: v0.37.0 · 2026-10-12

Typing a path is no way to choose a folder, so the window uses the operating system's picker through tauri-plugin-dialog (Apache-2.0 or MIT; it brings rfd, MIT, and tauri-plugin-fs, entered in LICENSES.md). It is called from Rust only, so no JavaScript package and no new capability were added. The registry is compiled in for the extension map. Verified: the window starts with the plugin under Xvfb; the picker itself was not opened (no desktop portal in the container).

## v0.36.0 · app-mcp before the window {#app-mcp}

### The window's program serves the apps' MCP servers
- refers-to: src/main.rs :: app_mcp_from_args, app_agents, connect_agents
- kind: decision
- logged: v0.36.0 · 2026-10-12

An installed FormPortal has no command line beside it, so the window's own program answers `app-mcp [product] [--channel C]` itself: `main` checks the arguments before the Tauri builder, runs the core's `run_app_mcp` and exits, so no window, single-instance hand-off or deep-link registration happens. Verified on Linux with no display: it answered `initialize` from a test app's server and refused an app without one. `connect_agents` from the window writes this program's path into the clients. On Windows the release build has no console; stdio redirected by a client still reaches it, which has not been tried on Windows yet.

## v0.34.0 · the policy for the window {#policy}

### policy
- refers-to: src/main.rs :: policy
- kind: decision
- logged: v0.34.0 · 2026-10-12

Returns the shape the interface draws from (who, where, locked fields, catalogue, apps, channels, and extensions and sideload as plain booleans), or null. Every other command already passes through the core, which enforces the policy, so the window's catalogue address and developer setting are replaced there whatever the interface sends.

## v0.33.0 · links out, and copies still open {#links}

### open_web, allowlisted, no plugin
- refers-to: src/main.rs :: WEB, open_web
- kind: decision
- logged: v0.33.0 · 2026-10-12

The help links open in the person's browser through `open` (macOS), `explorer` (Windows) or `xdg-open` (Linux), started directly with the address as one argument, no shell. Only addresses under `https://github.com/nodemode-ai/`, `https://formai.dev/` and `https://docs.formai.dev/` are accepted, and none with whitespace or quotes, so the interface cannot be used to start anything else. No opener plugin and no new permission were needed. Compiled on Linux; not clicked in the window yet.

### still_open
- refers-to: src/main.rs :: still_open
- kind: decision
- logged: v0.33.0 · 2026-10-12

The process ids running from the app's channel folder but not from its current version's folder: the same rule as the command line's `still_open`, for the window's note after an install.

## v0.32.0 · FormPortal's own updates {#self-update}

### The updater plugin, off until a key exists
- refers-to: src/main.rs :: self_update_check, self_update_install, updater_configured · tauri.conf.json :: plugins.updater · Cargo.toml :: tauri-plugin-updater
- kind: decision
- logged: v0.32.0 · 2026-10-11

`tauri-plugin-updater` 2 (2.13.3 locked; Apache-2.0 or MIT; its new crates minisign-verify, tar, reqwest, infer and the rest are MIT or Apache-2.0, and the lockfile's MPL crates are still only Tauri's five). The committed config has an empty `pubkey` and the endpoint `releases/latest/download/latest.json` of this repository. While the key is empty the check answers "not configured" and never fetches; the release workflow writes the real public key and `createUpdaterArtifacts` into a config file only when the signing secret exists. Install downloads, verifies the minisign signature (the plugin refuses an unsigned or mismatched update) and restarts. The checks are Rust commands, so no updater permission is granted to the page.

### Verified
- refers-to: the entry above
- kind: explainer
- logged: v0.32.0 · 2026-10-11

The debug window was built and run for 25 seconds under Xvfb with a session bus and the interface's dev server: it opened on Home (captured and looked at) with the updater registered and no key, and did not panic. A signed update was not tried (no key, no release).

## v0.31.0 · extensions and .formpkg files {#extensions}

### Commands and the file type
- refers-to: src/main.rs :: extensions, extension_install, extension_remove, extension_enable, launch_package, package_arg · tauri.conf.json :: bundle.fileAssociations
- kind: decision
- logged: v0.31.0 · 2026-10-11

The extension commands call the core; the index address is `extensions.json` beside the catalogue address. `.formpkg` is registered as a file type FormPortal opens. A package path reaches the interface three ways: as an argument at start (kept until the interface asks with `launch_package`), as an argument to a second launch (the single-instance callback emits `package-open`), and on macOS as `RunEvent::Opened`, which needs `build()` then `run(handler)` instead of `run(context)`. The macOS branch is compiled only on macOS and was not built here; the Linux build compiles. No double-click was tried.

## v0.27.0 · the move {#move}

### Identity
- refers-to: Cargo.toml :: package.name · tauri.conf.json :: identifier, bundle · capabilities/default.json :: description · src/main.rs :: expect
- kind: decision
- logged: v0.27.0 · 2026-10-11

Package `formportal`, identifier `dev.formai.portal` (was `formai` and `dev.formai.hub`). The identifier decides where macOS keeps the web view's data and how Windows registers the app; nothing shipped under the old one. The deep-link scheme stays `formai://` because formai.dev's pages already link with it (`formai://app/<id>`, `formai://apps`) and the site is not changed until FormPortal is complete. The function `hub()` in main.rs returns a `Portal`; its name is local and was left.

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

## v0.18.0 · the hub's own install and boot {#v018}

### hub/formai_hub_oc_install, hub/formai_hub · and their .bat twins, and the wrappers at the root
- refers-to: hub/formai_hub_oc_install(.bat), hub/formai_hub(.bat); formai_hub_oc_install(.bat), formai_hub(.bat) at the repo root; formai_dev :: the `desktop` case
- kind: rationale
- logged: v0.18.0 · 2026-10-06

The owner pointed out that the hub had no main install and boot. It was true: the hub started only as a mode of the repo's script (`./formai_dev desktop`), whose default is the site, and its interface had the only scripts of its own. Every other app in the family has one script to install and one to start, named after itself.

`formai_hub_oc_install` checks what the hub needs before doing anything: Node, Rust, and on Linux WebKitGTK 4.1 through `pkg-config`, printing the one line that installs what is missing. Then it installs the interface (`frontend/oc_install`) and fetches the crates with the lockfile, so the first boot compiles rather than downloads. `formai_hub` starts the interface on port 3250 in its own process group, waits until that port answers (so the window never opens on an empty page), and runs the shell in the foreground. Closing the window ends the script, and its exit stops the interface; so does Ctrl-C. The shell runs in the foreground rather than being waited on because the stock bash on a Mac is 3.2 and has no `wait -n`. The port is tried as `localhost`, not `127.0.0.1`: Vite with `host: false` may listen on IPv6 only.

Both live in `hub/`, the hub's own root. The two at the repo root, with the same names, only call them, so someone who has just unpacked the repo finds them where they look. `./formai_dev desktop` now hands over to `hub/formai_hub`: one way the hub starts, three ways to ask for it.

Run on Linux for this version: the install script from the root wrapper, to its last line; the boot script under a virtual display, which started the interface, compiled the shell and opened the window. The `.bat` twins are written and not run.

## v0.17.0 · one running copy, and formai:// links {#v017}

### src/main.rs, Cargo.toml · one copy at a time
- refers-to: src/main.rs :: the `tauri_plugin_single_instance::init` call in main; Cargo.toml :: tauri-plugin-single-instance
- kind: explainer
- logged: v0.17.0 · 2026-10-06

Starting formai while it is already running does not open a second window: the second process hands its arguments to the first and exits, and the first brings its window forward (unminimised and focused). On Linux this goes over the session's D-Bus, so a desktop session is needed; on Windows and macOS the plugin uses each system's own means. The plugin is registered first, as its documentation asks, so it can stop a second copy before anything else is set up.

### src/main.rs, tauri.conf.json, capabilities/default.json · formai:// links
- refers-to: src/main.rs :: SCHEME, Pending, target, route, launch_link, the setup closure; tauri.conf.json :: `plugins.deep-link`; capabilities/default.json :: `deep-link:default`
- kind: explainer
- logged: v0.17.0 · 2026-10-06

The app declares the `formai` scheme. A link is everything after `formai://`, trimmed of slashes: `app/formcut`, `updates`, `beta`, `extensions`, `settings`. The shell does not interpret it; it passes the text to the window as a `deep-link` event, and the interface decides (an unknown link does nothing).

Three ways a link arrives, all ending in that one event. While running, the plugin's `on_open_url` fires. From a second copy started with a link, the single-instance plugin's `deep-link` feature forwards it to the same handler. At start-up with a link, the window is not listening yet, so the link is kept in `Pending` and the interface asks for it once with the `launch_link` command, which hands it over and forgets it.

On Linux the scheme is also registered at run time (`register_all`), because an AppImage has no installer to do it; the `.deb` registers it through its desktop entry. The same call is made on Windows in debug builds only. The config carries a `plugins` section for the first time, and with one the generated context needs `serde_json` as a direct dependency: the first check failed on exactly that.

The window's capability gained `deep-link:default`, the plugin's own minimum, and nothing else.

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
