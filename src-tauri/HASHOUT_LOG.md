# HASHOUT_LOG · src-tauri · formportal

Living log for FormPortal's desktop shell (formai_dev's `hub/src-tauri` up to formai_dev 0.26.0; older entries keep the old names). Source files stay comment-free; what they would have said lives here.

Current build version: v0.60.0
Last updated: 2026-11-06 · v0.60.0 catalog_kept, the fetched catalogue held 90 s, the splash minimum 700 ms, the store's asset reader; 2026-11-06 · v0.58.0 the identifier, the web view's data, the second launch, clippy; 2026-11-06 · v0.57.0 the bundle icons from the v3 set, the app icon follows the theme (app_icon.rs); 2026-11-06 · v0.56.0 the family splash and reveal; 2026-11-03 · v0.54.1 the bundle names the publisher and the licence; 2026-11-03 · the release ships the installers; 2026-11-02 · updates from the public download store; 2026-10-30 · the build scripts for formcompiler; 2026-10-25 · install passes the release; the sharing commands; the GitHub sign-in commands; the login item; the save watcher; file_preview

## v0.62.2 · splash parity with formvis {#splash-parity}

### reveal.rs · SPLASH_MIN
- refers-to: src-tauri/src/reveal.rs :: SPLASH_MIN · frontend/public/splash.css
- kind: decision
- logged: v0.62.2 · 2026-11-07

The owner asked for every Form desktop app to carry formvis's splash exactly, so the minimum is back to 2.6 s and the bar animation to 2.6 s (it had been 700 ms since v0.60.0). The rest of reveal.rs (BACKGROUND, BAR_FINISH, FALLBACK, BUILD_VISIBLE, conceal, app_ready, show_main, set_seen, round_splash with the 16 px masked content layer) already matched formvis and is unchanged. The page still calls app_ready two frames after its first content (frontend/src/bridge/reveal.ts).

### capabilities/default.json · windows
- refers-to: src-tauri/capabilities/default.json
- kind: alignment
- logged: v0.62.2 · 2026-11-07

The capability lists the splash window beside main, as formvis does. The splash page runs no command; FormPortal keeps its light card variant (splash-theme.js), which formvis lacks.

## v0.60.0 · instant start and the store {#store}

### main.rs · catalog_kept, fetch_catalog, recent_catalog
- refers-to: src-tauri/src/main.rs :: catalog, catalog_kept, fetch_catalog, recent_catalog, FETCHED, install, updates, auto_update, repair · core/HASHOUT_LOG.md#store
- kind: fix
- logged: v0.60.0 · 2026-11-06

`hub()` builds a new Portal per command, so `catalog`, `auto_update`, `updates`, `install` and `repair` each fetched the catalogue and ran the release check again. `catalog` now stores what it fetched (with its URL and the unsigned setting) for 90 s, and the other four use that copy when it matches and is fresh, or fetch once. `catalog_kept` is new: the kept catalogue with no network, for the first paint.

### reveal.rs · SPLASH_MIN
- refers-to: src-tauri/src/reveal.rs :: SPLASH_MIN · frontend/public/splash.css
- kind: decision
- logged: v0.60.0 · 2026-11-06

The owner asked for an instant start; the 2.6 s minimum (copied from formvis) held the window back even when the page was ready. It is 700 ms, enough for the splash card to read as intended, and the splash bar animation follows. The 20 s fallback and the 220 ms bar finish are unchanged.

### main.rs · the store's asset reader
- refers-to: src-tauri/src/main.rs :: setup (store::set_reader) · core/src/store.rs :: read
- kind: decision
- logged: v0.60.0 · 2026-11-06

The starter library lives in `frontend/public/store/`, so it is in the app's embedded frontend, served to the page (font previews, thumbnails) and read by the engine through `app.asset_resolver()` for `bundled:` installs. No `bundle.resources` entry and no resource folder are needed, and `tauri dev` reads the same files from the built `frontend/dist` (build the frontend first).

## v0.58.0 · the identifier, the web view's data, the second launch {#identifier}

### tauri.conf.json · identifier
- refers-to: src-tauri/tauri.conf.json :: identifier · core/HASHOUT_LOG.md#identifier
- kind: decision
- logged: v0.58.0 · 2026-11-06

`studio.formai.portal` (was `dev.formai.portal`, owner's decision 2026-11-06; formai.dev is another company's domain). The earlier entry that says the identifier must not change once a build has shipped still holds as the reason for the care below: v0.57.0 builds exist, so what hangs on the identifier is moved, not abandoned.

### migrate.rs · webview_data
- refers-to: src-tauri/src/migrate.rs :: webview_data, parents, rename_across · src-tauri/src/main.rs :: main
- kind: decision
- logged: v0.58.0 · 2026-11-06

The system web view keeps localStorage (theme, accent, the Preferences rail, the shown-apps cache) under the identifier, so a new identifier would look like a first run. `webview_data()` runs first in `main`, right after `reveal::mark_launch` and before any Tauri code, and for each pair renames the old folder to the new name only if the old one is a real folder and nothing exists at the new name; a failed rename does nothing; no links; it returns nothing and cannot panic. It runs for the `mcp` and command-line paths too, which costs a few `lstat` calls.

Paths, read from the sources in `~/.cargo/registry/src` (tauri 2.12.1, tauri-runtime-wry 2.12.1, wry 0.57.0): Linux and Windows: `tauri/src/manager/webview.rs` (about line 559) sets the web view's `data_directory` to `path().app_local_data_dir()` when none is given, and `tauri/src/path/desktop.rs` (about line 265) makes that `dirs::data_local_dir()/<identifier>`: `$XDG_DATA_HOME` (if absolute) or `~/.local/share` on Linux, `%LOCALAPPDATA%` on Windows (WebView2's `EBWebView` is inside; `wry/src/webview2/mod.rs` passes it as the user data folder). FormPortal sets no `data_directory` itself (searched `src-tauri/src`). On Linux `wry/src/webkitgtk/web_context.rs` sets both `base_cache_directory` and `base_data_directory` to that one folder, so there is no `~/.cache/<identifier>` from the web view and none is moved. macOS: wry uses `WKWebsiteDataStore::defaultDataStore` (`wry/src/wkwebview/mod.rs` about line 244) with no data-store identifier and no directory, so WebKit itself files the data under the bundle identifier: `~/Library/WebKit/<id>`, `~/Library/Caches/<id>` and `~/Library/HTTPStorages/<id>`. That last part is WebKit's behaviour, not something the crates show, and was not run. Only the web view's folders move; the Application Support data root is `portal.rs`'s job.

Not moved, on purpose: Linux `~/.cache/<id>` (unused), macOS `Preferences/<id>.plist` and `Saved Application State` (not web storage). A running old-identifier copy of the app has its folder renamed under it on macOS and Linux; open files stay valid, and on Windows the rename fails and nothing moves.

### main.rs · the single-instance handler
- refers-to: src-tauri/src/main.rs :: main, tauri_plugin_single_instance handler · src-tauri/src/reveal.rs :: app_ready, show_main
- kind: fix
- logged: v0.58.0 · 2026-11-06

A second launch while the first was still concealed (macOS builds start with the window at zero alpha until `app_ready`, or the 20 s fallback) focused a window nobody could see. The handler now also calls `reveal::app_ready(handle)` on a new thread. `show_main` is private and `reveal.rs` was not to change, so the public `app_ready` (a plain function under `#[tauri::command(async)]`) is the way in; it returns at once if the window was already revealed (the `REVEALED` swap), and otherwise sleeps out the rest of the 2.6 s splash, which is why it is not called on the handler's own thread. The first caller wins, so the frontend's own `app_ready` and this one do not both run. Not run: any launch, on any system.

Verified for the whole change: `cargo check --locked -p formportal-core -p formportal-cli -p formportal` passes; the same for `--target aarch64-apple-darwin -p formportal` with the stand-in compiler; the core and cli tests pass except `store_addresses::updates_are_read_from_and_point_at_the_download_store`, which fails on a second updater endpoint added to `tauri.conf.json` by another edit in the same tree, not by this change. No Mac, no Windows.

### main.rs · after the independent review
- refers-to: src-tauri/src/main.rs :: main, the single-instance handler, run_install, run_updates
- kind: fix
- logged: v0.58.0 · 2026-11-06

`migrate::webview_data()` ran before the CLI and MCP exits, so `formportal mcp` moved the window's web-view folders while a window might be open; it now runs just before `tauri::Builder::default()`, after both exits, so only the window moves them. The single-instance handler had gained a call to `reveal::app_ready`, which on a second launch revealed a window that was still on its splash and blank; it is back to unminimize and focus only. The progress percentages use `checked_div` (clippy `manual_checked_division`), same result. Verified: `cargo check` and `cargo clippy` with no warnings on Linux and for `aarch64-apple-darwin`; under Xvfb with `XDG_DATA_HOME` in /tmp the old `dev.formai.portal` folder moved to `studio.formai.portal`, the splash (360x200) and the window (1180x760) mapped, the splash closed by 8 s. Not run: macOS, Windows.

## v0.57.0 · the app icon in both tones {#app-icon}

### icons/ · the bundle icons
- refers-to: src-tauri/icons/icon.png, 32x32.png, 128x128.png, 128x128@2x.png, icon.ico, icon.icns
- kind: decision
- logged: v0.57.0 · 2026-11-06

Made from the owner's v3 `formportal_icon_macos.png` (dark, 1024 px): `icon.png` at 1024, the PNGs at 32, 128 and 256, `icon.ico` with 16 to 256 and `icon.icns` with 16 to 512 at 1x and 2x. The installed app's icon (Finder, Start, the Linux menu) is this one: a bundle carries one icon, and Tauri does not yet bundle a light and dark pair.

### app_icon.rs · set_app_icon
- refers-to: src-tauri/src/app_icon.rs :: set_app_icon, dock · src-tauri/icons/runtime/* · src-tauri/src/main.rs :: generate_handler! · src-tauri/Cargo.toml :: objc2-app-kit NSApplication, NSImage, objc2-foundation NSData · ../frontend/src/extensions/appicon/index.ts
- kind: decision
- logged: v0.57.0 · 2026-11-06

While FormPortal runs, its icon follows the theme the person set. `set_app_icon(light)` sets the main window's icon from raw 256 px RGBA (`icons/runtime/<tone>-256.rgba`, so no image decoder feature is needed in tauri), which is the title bar and taskbar icon on Windows and Linux; on macOS, where a window has no icon, it sets the Dock icon on the main thread with `NSApplication.setApplicationIconImage` from a 512 px PNG (`icons/runtime/<tone>-512.png`). When FormPortal quits, macOS shows the bundle icon again. `cargo check --locked` passes on Linux, and for `aarch64-apple-darwin` with a stand-in C compiler for objc2's exception helper (type checking needs no linking): that check also covered `reveal.rs` and `traffic_lights.rs` from v0.56.0, which until then had only been read against formvis. Not run: the desktop window on any system.

## v0.56.0 · the family splash and reveal {#reveal}

### reveal.rs, traffic_lights.rs · the splash, the reveal, the lights
- refers-to: src-tauri/src/reveal.rs :: SPLASH_MIN, BACKGROUND, BAR_FINISH, FALLBACK, mark_launch, round_splash, conceal, app_ready, show_main · src-tauri/src/traffic_lights.rs :: place, set_window_title, inset
- kind: decision
- logged: v0.56.0 · 2026-11-06

FormPortal now opens like formvis, the reference app of the Form family: a 360 by 200 rounded dark card with the icon, "Starting FormPortal" and a gradient bar, then the main window appears whole when the page has painted and 2.6 s have passed since launch. Both files are copied from formvis v1.99.7 with the same logic, constants (2600 ms, 220 ms, 20 s, 16 px radius, 38 px row, background 10,10,10) and native calls; only the doc comments were dropped, since source files here stay comment-free, and the splash-done hook is `formportalSplashDone` instead of `formvisSplashDone`. `set_window_title` is registered as in formvis although the page does not call it yet.

### main.rs · setup, main
- refers-to: src-tauri/src/main.rs :: main, setup, generate_handler
- kind: decision
- logged: v0.56.0 · 2026-11-06

`reveal::mark_launch()` is first in `main()`, `reveal::round_splash` first in setup. The main window is still built from its config (`create: false`, page chosen by preferences), now chained with `visible(reveal::BUILD_VISIBLE)`, `background_color(reveal::BACKGROUND)`, on macOS the overlay title bar with a hidden title, and an `on_page_load` that places the lights again. After `build()`: `conceal` and `place`. If the build fails, the splash is closed before the error returns. `app_ready` and `set_window_title` are in `generate_handler!`; the other commands, the single-instance handler and the deep links are untouched. Adapted from formvis: there is no engine or port handshake (the page is bundled, `WebviewUrl::App`), so the reveal waits only on the page; the splash window is created from the config, so nothing else spawns it. build.rs is plain `tauri_build::build()`, so no per-command permission was added; the capability gains `core:window:allow-start-dragging` so the page can drag the window by its title row.

### tauri.conf.json, Cargo.toml, splash.html, splash.css, splash.js, reveal.ts
- refers-to: src-tauri/tauri.conf.json :: app.macOSPrivateApi, app.windows[splash] · src-tauri/Cargo.toml :: tauri features, macOS objc2 and objc2-app-kit · frontend/public/splash.html, splash.css, splash.js · frontend/src/bridge/reveal.ts :: revealApp
- kind: decision
- logged: v0.56.0 · 2026-11-06

The `splash` window block and `macOSPrivateApi` are formvis's, and the tauri feature `macos-private-api` and the macOS-only `objc2` 0.6 and `objc2-app-kit` 0.3 (features std, NSWindow, NSButton, NSControl, NSView, NSResponder, NSColor, objc2-core-foundation) are in Cargo.toml; the lock already held both crates and gained only the two direct entries. FormPortal's CSP allows no inline style or script, so formvis's single splash.html is split into splash.html, splash.css and splash.js, with the icon as `favicon.png` in an img tag instead of the inline SVG. `revealApp` in the new bridge/reveal.ts runs once: two frames, `app-ready` on the body, one more frame, then `app_ready` through `window.__TAURI__.core.invoke` when `__TAURI_INTERNALS__` exists; the page still has to call it and carry the critical CSS.

Checked here: `cargo check --locked -p formportal` and `-p formportal-core -p formportal-cli` pass on Linux, and `tsc --noEmit` passes. Not verified: the window was never opened, so the splash, the bar, the reveal and the 20 s fallback have not been seen; the macOS code (round_splash, set_seen, inset, the title bar style) cannot be compiled on Linux and was read against formvis only.

### main.rs · open_web
- refers-to: src-tauri/src/main.rs :: open_web
- kind: fix
- logged: v0.56.0 · 2026-11-06

formai.dev was removed from the refusal message. It is another company's site and was never a Form domain; the family's only domain is formai.studio (formai.tools and formai.design redirect to it). Older entries below keep the name as history.

## v0.54.1 · the publisher and the licence in the bundle {#publisher}

### tauri.conf.json, Cargo.toml · publisher, copyright, license, licenseFile, authors
- refers-to: src-tauri/tauri.conf.json :: bundle.publisher, bundle.copyright, bundle.license, bundle.licenseFile; Cargo.toml :: workspace.package.authors
- kind: decision
- logged: v0.54.1 · 2026-11-03

The launch punch list (2026-11-03): the About of a downloaded app says NodeAgentc, Inc., not nodemode-ai, and lists the licence. FormPortal has no About of its own: on macOS the application menu's About panel reads the bundle's copyright, and Tauri's default About metadata takes its authors from `bundle.publisher`; tauri-build writes `CompanyName` from `bundle.publisher` into the Windows version resource, and the .deb's Maintainer is the crate's `authors`. The bundle now names the publisher, `licenseFile` points at the LICENSE at the root (`../LICENSE` from `src-tauri`) beside the `license` (GPL-3.0-only) it already named, and `authors` is the company. Checked here: the JSON parses; no build was run.

## v0.54.0 · the release ships the installers {#installers}

### setup/package_release.py · installers, not zips
- refers-to: setup/package_release.py :: INSTALLERS, installers, pack, updater, finish · setup/build_linux_app
- kind: decision
- logged: v0.54.0 · 2026-11-03

The owner asked for the native installers as they are: a macOS download was a zip of the `.app` (made with `ditto`), and Windows and Linux were zips around the NSIS setup or the AppImage. `pack` now copies each installer the build made into the release folder under one naming scheme, `formportal-<version>-<os>-<arch><suffix>`: `.dmg` on macOS, `-setup.exe` (NSIS) on Windows, `.AppImage`, `.deb` and `.rpm` on Linux (`build_linux_app` adds `rpm`; Tauri writes it without rpmbuild, as formtray's releases on the same runners show). Each installer gets its own manifest part, `manifest-<os>-<arch>-<kind>.json`, with a new `kind` field; the old `FormPortal.AppImage` inner name and the LICENSE and LICENSES.md copies inside every zip are gone, and `--finish` writes `LICENSE.txt` and `LICENSES.md` once beside the files. formcompiler's `catalog.py classify` already reads every one of these names (dmg, nsis, appimage, deb, rpm, with the arch token), so the catalogue lists the installers with no change there.

On Linux and Windows the updater bundle is the installer itself (the AppImage and the NSIS setup, each with its `.sig`), so `updater` now points latest.json at the shipped installer instead of copying the same bytes again as `-update.AppImage` and `-update.exe` (about 80 MB less per Linux platform, and no second AppImage for the catalogue to mistake for an installer). macOS keeps its separate `-update.app.tar.gz`. `STORE` and the URL f-string are unchanged, as `cli/tests/store_addresses.rs` requires.

`finish` recomputes each asset's size and SHA-256 from the file in `--out` when it is there. formcompiler notarizes and staples the macOS disk image after the post-build step that copies it, and stapling changes its bytes, so the hash taken at copy time would not match the published file. It runs in formcompiler's assemble job over the staged files, which are the published ones.

Not done: a Flatpak (needs its own manifest and builder). If formcompiler ever signs a Windows setup after the build (only when Tauri did not sign it during the build), the updater `.sig` no longer matches; the same was true of the old `-update.exe` copy.

## v0.53.5 · updates from the public download store {#store}

### main.rs · open_web asks the engine which links it may open
- refers-to: src/main.rs :: open_web · ../core/src/links.rs :: may_open
- kind: fix
- logged: v0.53.5 · 2026-11-02

`open_web` checked a three-entry `WEB` list (the family's GitHub organisation, formai.dev, docs.formai.dev), which refused links the interface itself shows: every app page's "Every release" (`https://formai.studio/download/`), the sign-in page GitHub's device flow names (`https://github.com/login/device`), the share dialog's library and published-file links and the portfolio link (the person's own `formportal-library-*` and `formportal-public` repositories), and a maker's GitHub Sponsors page. The list moved to `formportal_core::links` so a test can reach it (the shell is not tested in CI), and `open_web` calls `may_open`. See core's log for the rules.

### tauri.conf.json, setup/package_release.py · dl.formai.studio
- refers-to: tauri.conf.json :: plugins.updater.endpoints · setup/package_release.py :: STORE, finish · cli/tests/store_addresses.rs
- kind: decision
- logged: v0.53.5 · 2026-11-02

The updater read `latest.json` from the rolling `formportal-updates` release on formcompiler's GitHub page, and `package_release.py --finish` wrote download addresses on the `formportal-v<version>` release there. formcompiler is private, so neither ever served an installed copy. formcompiler's feed copies every release's files to its download store at `<base>/<app>/<version>/<file>` and the stable feed to `<base>/<app>/updates/latest.json` (formcompiler `docs/REGISTRY.md`, `updater.tauri`; `docs/GO_PUBLIC.md` section 4). The endpoint is now `https://dl.formai.studio/formportal/updates/latest.json`, and `RELEASES` became `STORE = https://dl.formai.studio/formportal`, so each platform URL is `<STORE>/<version>/formportal-<version>-<os>-<arch>-update.<ext>`, the file the feed copies beside the zips. formcompiler's `feed.py public` rewrite only touches GitHub release URLs, so it leaves these as they are; with `FORMCOMPILER_PUBLIC_BASE` set its `tauri_config.py` writes the same endpoint at build time. `REPOSITORY` (the notes link and `manifest.json`) follows the repository to `github.com/nodemode-dev/`. `store_addresses.rs` pins the endpoint, `STORE` and the URL shape.

## v0.53.4 · the build scripts for formcompiler {#fc-build}

### setup/build_windows_app.bat · NSIS only
- refers-to: setup/build_windows_app.bat; setup/package_release.py :: windows bundle glob, UPDATER
- kind: decision
- logged: v0.53.4 · 2026-10-30

The Windows build made `nsis,msi`, but `package_release.py` packs only `bundle/nsis/*.exe` (the zip and the updater bundle), so the msi cost a WiX pass on every release run and was never shipped. The script now builds `%FORMPORTAL_BUNDLES%`, which is `nsis` when unset. An organisation that wants the per-machine msi for `org-package` sets `FORMPORTAL_BUNDLES=nsis,msi` and builds it from this repository (the Organisations wiki page says so).

### setup/build_* · the Tauri CLI pinned
- refers-to: setup/build_macos_app, setup/build_linux_app, setup/build_windows_app.bat
- kind: decision
- logged: v0.53.4 · 2026-10-30

The three scripts ran `npx --yes @tauri-apps/cli@2`, so each release run took whatever 2.x was newest that day. They now run `@tauri-apps/cli@2.12.3`, the same CLI on every runner and every rerun. The frontend's package.json and lock carry no `@tauri-apps/cli` to match, so the version is the family's pin (the `tauri` crate in Cargo.lock is 2.12.1, the same minor). Move it by hand with the crate.

## v0.53.0 · install passes the release {#q9}

### main.rs · install
- refers-to: src/main.rs :: install
- kind: decision
- logged: v0.53.0 · 2026-10-25

The window's install calls `install_from` with the catalogue it read, like the command line, so an app installed from the window gets the release's `form-app.json` and its files record too. Nothing on screen changed.

## v0.48.0 · the sharing commands {#share}

### shares_view, share_folder, share_send, share_accept, share_pull, publish_file
- refers-to: src/main.rs :: the six commands and the invoke_handler list
- kind: decision
- logged: v0.48.0 · 2026-10-25

Thin surfaces over `formportal_core::share` on `spawn_blocking`, since each waits on GitHub. `publish_file` takes `remove` so one command publishes and unpublishes, as the dialog has one place for both. Checked: `cargo check -p formportal`, no warnings. Not run in the window under Tauri.

## v0.47.0 · the GitHub sign-in commands {#github}

### github_status, github_start, github_poll, github_sign_out
- refers-to: src/main.rs :: the four commands and the invoke_handler list
- kind: decision
- logged: v0.47.0 · 2026-10-24

Thin surfaces over `formportal_core::github`, each on `spawn_blocking` like `catalog` and `install`, because every one of them can wait on the network or the keychain. The window runs the polling loop, one `github_poll` per interval, so Cancel only has to stop asking. Checked: `cargo check -p formportal`, no warnings. Not run in the window under Tauri.

## v0.46.0 · the login item {#login}

### sync_login
- refers-to: src/main.rs :: sync_login, set_preferences, setup (after watch_saves)
- kind: decision
- logged: v0.46.0 · 2026-10-24

The window owns its login item because it is what opens at login. `set_preferences` saves, then `sync_login` reads the saved preferences (so an organisation policy has had its say) and calls `formportal_core::login::sync` with the program path: `APPIMAGE` when set (the AppImage's own file, not its temporary mount), else `current_exe`. Setup calls it once at every start, so a preference changed from the command line or MCP takes effect at the next start, and a FormPortal that was updated or moved points the item at its new path. A failure at start is ignored; one from Preferences reaches the window as the command's error. Checked: `cargo check -p formportal --locked` with no warnings.

## v0.44.0 · the save watcher {#saves}

### watch_saves and FILES_LOCK
- refers-to: src/main.rs :: watch_saves, FILES_LOCK, files_scan, file_versions, file_preview
- kind: decision
- logged: v0.44.0 · 2026-10-12

A thread started in setup runs `keep_saved` every three seconds and emits `versions-kept` with the paths. The version index is read, changed and written whole, so the thread, `files_scan` and `file_versions` take one mutex; without it a scan and a tick could each write and lose the other's version. Verified: the debug build under Xvfb kept one version for each of two saves made eight seconds apart.

## v0.43.0 · forwarding and double-click verified {#forwarding}

### A link and a .formpkg reach the open window
- refers-to: src/main.rs :: single-instance callback, package_arg, route · tauri.conf.json :: fileAssociations
- kind: explainer
- logged: v0.43.0 · 2026-10-12

Under `dbus-run-session` with Xvfb (so the single-instance plugin has a session bus), with the debug build running: `gio open formai://app/formcut` showed FormCut's page in the same window, and `gio open side-look.formpkg`, with a test desktop entry for `application/x-formpkg` standing in for the one the deb bundle writes from `fileAssociations`, installed the package into that window as sideloaded. The second process exited after handing over each time (the process count stayed the same). `fonts_view` also returns `updates`.

## v0.42.0 · repair, later and web file commands; the browser leg {#repair}

### Commands, and formai:// links handed over by the system
- refers-to: src/main.rs :: repair, later_list, update_later, web_plan, web_fetch, target, route
- kind: explainer
- logged: v0.42.0 · 2026-10-12

Thin calls into the core. The browser leg of `formai://` links was tried for the first time: under Xvfb, with `formportal-handler.desktop` set as the default for `x-scheme-handler/formai`, `gio open formai://app/formcut` brought up FormCut's page and `gio open formai://file/formcut?url=...` the confirmation, in the debug build. Firefox and Chromium hand external schemes to the same GIO handler on Linux. With no session bus on that display, each link started FormPortal afresh (the `launch_link` path) rather than reaching an open window through the single-instance plugin, so that forwarding remains untested, as do macOS and Windows.

## v0.41.0 · the window opens in the chosen language {#language}

### create false, built in setup
- refers-to: tauri.conf.json :: app.windows[0].create · src/main.rs :: setup
- kind: decision
- logged: v0.41.0 · 2026-10-12

Creative Cloud restarts to change language; FormPortal decides before the window exists. The main window keeps its configuration (size, minimum, centred) but `create: false`; setup reads the preferences, sets the configuration's `url` to the page for the language, and builds it with `WebviewWindowBuilder::from_config`. Verified: the debug build under Xvfb, with `{"language":"es"}` in a test root, opened directly on the Spanish Home (screenshot in the sidecar's build notes); the single-instance focus still finds the window by its label.

## v0.40.0 · the reading server and the assistant {#learn}

### FormPortal mcp, learn_view, learn_mark, assistant_agents, assistant_ask
- refers-to: src/main.rs :: main, ctx, learn_view, learn_mark, assistant_agents, assistant_ask · Cargo.toml (formportal-cli)
- kind: decision
- logged: v0.40.0 · 2026-10-12

`main` answers `mcp [--read-only]` before the builder, like `app-mcp`, so the single-instance plugin never sees an agent's server process. `assistant_ask` passes `current_exe()` with `mcp --read-only` as the agent's server, so the desktop app needs nothing else installed. Verified: the debug build served the reading server (thirteen tools, `remove` refused) and Claude Code answered through it; the window itself was not run here.

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
- refers-to: icons/icon.png and the set beside it; ../assets/formportal_icon.png, formportal_icon_macos.png; ../frontend/public/favicon.svg; ../assets/icon_src/
- kind: explainer
- logged: v0.1.0 · 2026-10-04 · redrawn v0.44.2 · 2026-10-20

The placeholder (three bars in amber, off-purple and teal) is replaced by a mark in the redrawn Form family construction that says what FormPortal does: an app rising out of a portal. A glossy ring in the family paint (blue, violet, pink, amber), seen in perspective, glows pink and violet from inside with light rising out of it, and a dark glass app tile carrying the old three bars, now in the family gradients, emerges from it; the tile is clipped along the ring's front inner edge so its base is inside the portal, and the ring's front half is drawn over it. Family tile with bloom, rim and drop shadow. The macOS .icns uses the 824 px tile inside a 1024 canvas with a 100 px margin; .ico and the PNGs stay full bleed; one design at every size and in the favicon. assets/icon_src/ regenerates every file (python3 gen.py, node render.mjs).

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
