# HASHOUT_LOG · core · formportal

Living log for `formportal-core`, FormPortal's engine in Rust (named `formai-core` and kept in formai_dev's `hub/core` up to formai_dev 0.26.0; entries below that date use the old names and paths). Source files stay comment-free; what they would have said lives here.

Current build version: v0.60.0
Last updated: 2026-11-06 · v0.60.0 the kept catalogue first (catalog_kept, releases::apply_kept), one pooled agent with timeouts, release files sized at once, the starter library and the store (store.rs, bundled: downloads); 2026-11-06 · v0.59.0 disk images with a licence install (installers.rs, deploy.rs), the catalogue is formai.studio's again (35 products, every cap), open_links reads markup.ts; 2026-11-06 · v0.58.0 the identifier studio.formai.portal and the data-root move, the site client (upcoming, supporter check), the unannounced caps removed, releases.rs refactor; 2026-11-06 · v0.56.0 formai.dev removed from the links, the schemas and the fixtures, the support page allowed, formai_dev's schedule and app caps copied into catalog/; 2026-11-06 · releases read from each app's GitHub release (releases.rs), formcompiler's catalogue copy when the store cannot be reached, prelaunch apps with a release, the policy's github_releases; 2026-11-02 · the links FormPortal opens; 2026-10-26 · the test suite (core/tests); 2026-10-25 · the release's form-app.json in each install, the MCP program by name, every file's digest (merged from the v0.46.0-mcp branch); the managed package (deploy.rs, policy::check); the portfolio page and extension support links; sharing through the person's GitHub account (share.rs); the optional GitHub sign-in (github.rs, keyring, CoreError::Account); the login item (login.rs, open_at_login); Claude Code counted at user scope only, formMCP and formskills in the registry; form-app.json format_version 2, catalogue agents fields

## v0.60.0 · instant catalogue, the starter library and the store {#store}

### portal.rs · catalog_kept, releases.rs · apply_kept
- refers-to: core/src/portal.rs :: Portal::catalog_kept · core/src/releases.rs :: apply_kept, discover
- kind: fix
- logged: v0.60.0 · 2026-11-06

The owner: the app takes far too long to connect to the catalogue; it must be instant. Measured cause: `catalog()` was network-first (the kept `apps.json` was read only when the fetch failed) and ran `releases::discover` inside the same call, which on most launches (cache older than 15 min) crawled every product's GitHub release: the manifest through two redirects, SHA256SUMS, then a HEAD per artifact one after another, 15 to 20 requests per app across 26 threads, joined on the slowest. `catalog_kept` returns the kept, signature-checked `apps.json` with every kept release that is still sound merged in by `apply_kept`, with no network at all, so the window paints from it at once; `catalog()` is unchanged in what it returns and runs after. A missing kept file is an error, and the interface then waits for the network as before. `discover` no longer returns early when `yanked.json` cannot be fetched but a kept yank list exists; it uses the kept one, so a flaky raw.githubusercontent.com no longer drops every release.

### download.rs · agent, releases.rs · sizes at once
- refers-to: core/src/download.rs :: agent, fetch_text, fetch_bytes · core/src/releases.rs :: agent, assemble
- kind: fix
- logged: v0.60.0 · 2026-11-06

`fetch_bytes` and `fetch_text` called `ureq::get`, which builds a new agent per call (new DNS, TCP and TLS each time) with a 30 s connect timeout and no read or overall timeout, so one stalled read hung the whole start. They now share one agent: 4 s connect, 10 s read, 20 s overall, 8 idle connections per host. The release agent keeps 16 idle connections per host. `assemble` sizes every classified artifact in parallel (one scoped thread each) instead of one after another. Large downloads (`download()`) keep their own path with no overall timeout, on purpose.

### store.rs · the starter library and the store
- refers-to: core/src/store.rs :: Portal::font_library, media_library, extension_library, read, set_reader, Shelf · core/src/download.rs :: download (bundled:) · core/data/store-*.json · cli/src/ops.rs :: fonts, font_install, media, media_save, ext_index
- kind: decision
- logged: v0.60.0 · 2026-11-06

The owner: Fonts, Stock & templates and Extensions are blank, and need the right assets bundled in the build plus a connection to the site's store (a marketplace in the spirit of a stock and add-on store). Cause of blank: each page read only a signed index beside the catalogue (`dl.formai.studio/catalog/fonts.json`, `media.json`, `extensions.json`) and all three return 404; nothing was bundled, unlike Learn. Now each page is a `Shelf`: the starter index compiled in (`include_str!` of `core/data/store-*.json`) with the remote index merged over it by `id`, the remote tried at the store first (`https://formai.studio/catalog/v1/<name>`) and then beside the catalogue, each still signature-checked by the existing `font_index`, `media_index` and `extension_index` (so policy locks and allow_unsigned behave as before). `reached` names the source that answered; `missed` carries why none did. Starter files use `bundled:<path>`: `download()` reads them through `store::read` (the shell's asset resolver, then `FORMPORTAL_STORE`, then the repository's `frontend/public/store` found from the executable, for the command line) and checks the same sha256 before handing the file on, so installs, saves and template copies take one path. A `bundled:` path with anything but plain components is refused. Extensions ship an empty starter index: none of formcut, formvis or formwav publishes a package in the `formai-package` format (formcut's seven registry zips are its own format, with warm-dust's manifest not at the zip root), and nothing was invented. Measured: the command line lists 12 families and 9 items with the store unreachable, installs Space Grotesk and saves a photograph from the bundled files with matching checksums. The store contract for the site is `.docs/wiki/Store.md`.

## v0.61.0 · formcompiler is not an app {#compiler}

### catalog/ · products.json, schedule.json, apps/formcompiler.json
- refers-to: catalog/products.json · catalog/schedule.json · catalog/apps/formcompiler.json
- kind: fix
- logged: v0.61.0 · 2026-11-06

formcompiler is a repository that builds and signs the catalogue; it is never downloaded or installed, so it is no longer a product. Removed from `products.json` (the only entry with `"delivery": "repository"`, now 34 products), from the Launch wave in `schedule.json`, and its cap file is deleted. No engine code treated it as a product; `COMPILER_CATALOG` in releases.rs still names the pipeline that publishes the signed catalogue.

## v0.59.0 · installs that work, the site's catalogue {#installs}

### installers.rs · attach, deploy.rs · the managed macOS script
- refers-to: core/src/installers.rs :: attach, dmg · core/src/deploy.rs :: the macOS install step
- kind: fix
- logged: v0.59.0 · 2026-11-06

The owner's desktop app showed every install failing with "hdiutil could not unpack the disk image: hdiutil: attach canceled". Cause: the Form apps are Tauri apps with `bundle.licenseFile` set (formvis `src-tauri/tauri.conf.json`), so their DMGs carry a licence agreement; `hdiutil attach` shows it and waits for an answer, and with stdin closed (the old `run` gave it `Stdio::null()`) it cancels. `attach` now runs hdiutil with `PAGER=cat` (no pager) and writes `Y` lines to its stdin, then closes it, and adds `-noverify` (the download's SHA-256 is already checked before anything is unpacked). A refusal still reports hdiutil's last line. The managed-deployment macOS script uses `yes | PAGER=cat hdiutil attach ... -noverify`. Not run on macOS here (no macOS in this session): to confirm, install FormVis 1.99.7 from FormPortal on a Mac.

### catalog/ · formai.studio's catalogue again
- refers-to: catalog/products.json · catalog/apps/*.json · catalog/schedule.json · catalog/fixtures/apps.json · core/tests/open_links.rs
- kind: fix
- logged: v0.59.0 · 2026-11-06

The owner: there are 34 apps and the names were wrong (FormDeck, not FormSlide). `products.json` is now formai_dev's 35 products (FormPortal and 34 apps) with their names, alt_of, notes, summaries, groups and identifiers, and FormPortal's stable ids where they differ (`formai` for formportal, `formslide` for formdeck, `formskills` for formskill, `formranker` for formbench) because installs are recorded under those ids. All 35 caps are back in `catalog/apps/` (v0.58.0 had removed 11; that was wrong for a family of 34). FormRanker's identifier is now formai_dev's `ai.nodemode.formbench`. The browser fixture now holds the ten releases that are out, at their versions (FormVis 1.99.7, FormLit 0.48.0, FormVFX 0.52.8, FormPDF 0.57.3, FormWav 2.22.3, Form.md 0.48.0, FormDeck 0.30.7, FormMCP 0.7.8, FormSkills 0.7.7, FormTray 0.10.2). `open_links` reads its page links from `frontend/markup.ts` as well as `vite.config.ts`, since the markup moved; every link it checks is still on the allow list (the sidebar's Help opens FormPortal's guide on GitHub, not formai.studio/docs, which is not allowed).

## v0.58.0 · the identifier studio.formai.portal {#identifier}

### portal.rs · Portal::default_root, moved_root
- refers-to: core/src/portal.rs :: Portal::default_root, moved_root, leave_link · cli/src/ops.rs :: Ctx · src-tauri/src/main.rs :: hub
- kind: decision
- logged: v0.58.0 · 2026-11-06

The owner, 2026-11-06: the bundle identifier moves from `dev.formai.portal` to `studio.formai.portal`, because formai.dev is another company's domain and the family's is formai.studio. On macOS the data root is `~/Library/Application Support/<identifier>`, so the root moves with it, and v0.57.0 builds may already have written installs there. `default_root` runs the move itself, so the window, the command line and the MCP server (all of which call it) agree without a separate start-up step; `FORMPORTAL_ROOT` returns first and never migrates. `moved_root(old, new)`: if the old path is a real folder (`symlink_metadata`, so a link does not count) and nothing exists at the new path (a dangling link counts as existing), rename old to new and leave a symlink at the old path pointing at the new one, because FormTray and formMCP read `installed.json` from the old path. Both present: neither is touched and the new one is used. Rename fails: the old path is returned, so nothing is lost; if the failure was a second process winning the race and the new path exists by then, the new path is returned. The symlink is best effort; if it cannot be made the move still stands. Nothing is deleted. After the first run each call costs two `lstat`. Linux (`$XDG_DATA_HOME/formportal`) and Windows (`%LOCALAPPDATA%\FormPortal`) do not change, and `leave_link` is a stub off Unix so the file compiles everywhere.

Verified: `cargo check` on Linux and for `aarch64-apple-darwin`; a copy of `moved_root` in a scratch program under /tmp on Linux: nothing there returns the new path and creates nothing; old only moves its contents and leaves a link that resolves; a second call changes nothing; both present leaves the real old folder and returns the new. Not run: macOS itself, the real Application Support folder, FormTray or formMCP reading through the link, a rename failing on a permissions or cross-volume error (both folders sit in one parent, so a cross-volume rename should not occur).

### login.rs · LABEL, forget_old
- refers-to: core/src/login.rs :: LABEL, OLD_LABEL, forget_old, sync · .docs/wiki/Languages-and-Launch.md
- kind: decision
- logged: v0.58.0 · 2026-11-06

The macOS LaunchAgent label follows the identifier: `studio.formai.portal.login`, file `~/Library/LaunchAgents/studio.formai.portal.login.plist`. `sync` (on or off) first removes the old `dev.formai.portal.login.plist` if present, so the old login item cannot linger and start a second copy; a missing file is not an error and a failed removal is ignored. Only the file is removed: an agent launchd already loaded this session stays loaded until the next login, which no longer finds the plist. Linux has an empty `forget_old`; Windows is unchanged. Not run on macOS.

### catalog/products.json · identifier
- refers-to: catalog/products.json :: products[].identifier · src-tauri/tauri.conf.json :: identifier · frontend/src/extensions/settings/index.ts
- kind: fix
- logged: v0.58.0 · 2026-11-06

The `formai` entry (FormPortal) now names `studio.formai.portal`. The other stale `dev.formai.*` identifiers took formai_dev v0.56.1's values by id (`/home/claude/in/formai_studio/formai.studio/catalog/products.json`; FormPortal's `formai` is formai_dev's `formportal`): formlit, formdesign, formpath, formvfx, formmd, formsurface and formweb to `ai.nodemode.<id>`, formdam to `ai.nodemode.dam`. `formencoder` stays `dev.formai.formencoder` because formai_dev v0.56.1 still has that value; it is the one `dev.formai.*` left and is formai_dev's to correct. `catalog/fixtures/apps.json` (`dev.formai.hub`) followed later in this version (see the caps entry below). Only `identifier` fields changed. The Preferences page text and the docs that give the macOS folder now say `studio.formai.portal`.

### portal.rs · moved_root after review
- refers-to: core/src/portal.rs :: moved_root
- kind: fix
- logged: v0.58.0 · 2026-11-06

The independent review found two cases the first version got wrong, both now handled. An empty folder already at the new path (a v0.58.0 web view or a crash can make one before the move) used to win over the old folder full of installs; now, when the old path is a real folder and the new one is a folder, `fs::remove_dir(new)` is tried first, which only succeeds when it is empty, so a non-empty new folder still wins and nothing is deleted. An old path that is already a symlink to a folder (a person's own link, or a link left by an earlier move whose target is not the new path) is used as it is rather than followed into a second move. Scratch copy under /tmp: nothing, old only, both present, empty new, old as a link, a second call; all as described.

### releases.rs · read_release and assemble
- refers-to: core/src/releases.rs :: Outcome, read_release, assemble
- kind: refactor
- logged: v0.58.0 · 2026-11-06

`read_release` held a 60-line closure that set a `failed` flag through a capture. It is now a named `assemble(…, &mut failed)` returning `Option<(Release, Vec<String>)>`, and `read_release` maps the result to `Outcome::Found`, `Failed` or `Refused` as before. `Outcome::Found` boxes the release (clippy `large_enum_variant`: 352 bytes against two empty variants). `extensions.rs` passes `std::slice::from_ref` instead of a one-key cloned array and `examples/install.rs` uses `checked_div` (clippy). No behaviour change; the 50 tests pass and the loopback relay run lists the same releases.

### catalog/apps · the eleven unannounced caps removed
- refers-to: catalog/apps/ · catalog/fixtures/apps.json :: identifier · CLAUDE.md · .claude/skills/formportal-skillset
- kind: decision
- logged: v0.58.0 · 2026-11-06

The owner asked whether the bundle should drop hidden apps as the site does. Decision: the caps of the 11 apps that are in formai_dev's catalog but not in FormPortal's registry (formcad, formcompiler, formcraft, formfabric, formmorpheus, formnet, formpromo, formrig, formslot, formtools, subform) are removed, because nothing reads them and the repository is public; the 24 registry apps keep theirs, because the registry already names them and a release must show without a FormPortal update (the release, not the bundle, is what makes an app visible). The fixture's `dev.formai.hub` is now `studio.formai.portal`. The skillset's rule now says catalog/ is formai_dev's copy and design/ is FormPortal's own, following formvis since v0.56.0; formai_dev's site keeps its own tokens.

### site.rs · after the independent review
- refers-to: core/src/site.rs :: update, upcoming, check_supporter, forget, Portal::supporter
- kind: fix
- logged: v0.58.0 · 2026-11-06

Review findings, all applied. `site.json` was read, changed and written by the window and the MCP server at once, so one could undo the other: every change now goes through `update`, which holds a process-wide lock around load, change and save (two processes can still interleave; the cache is only a cache and the worst case is one extra request). A check that failed was retried on every call; it now waits `RETRY` (60 s) unless forced and answers `stale`. A check with no answer and no earlier one stores only the attempt time under the code's digest. `upcoming` records the attempt even with no data, so the 60 s back-off applies offline too. `Portal::supporter` reloads Preferences before writing the code, so a change made in the window meanwhile is kept, and calls `forget` if the code was cleared while the check ran. Not run against the real site (403 from its allowlist); run against /home/claude/wk/fakesite.py and in the frontend probe.

## v0.58.0 · what formai.studio tells a desktop app {#site}

### site.rs, prefs.rs :: supporter_code · upcoming and the supporter check
- refers-to: core/src/site.rs :: upcoming, check_supporter, Portal::{upcoming, supporter, forget_supporter} · core/src/prefs.rs :: supporter_code · src-tauri/src/main.rs :: site_upcoming, supporter_check
- kind: decision
- logged: v0.58.0 · 2026-11-06

formai.studio (behind an IP allowlist until it goes live) adds `GET /api/upcoming` (`dated [{at,count}]`, `undated`, `supporters`; no names; cacheable 300 s) and `POST /api/supporter/check` (body `{"code"}` as JSON, no Origin header; 200 `{supporter, until, upcoming [{name, at|null}]}`, 429 busy, 503 closed, 403 for a foreign Origin). `site.rs` reads both. `SITE` is https://formai.studio; `FORMPORTAL_SITE` replaces it for testing (loopback http passes `check_url`) and `off` disables the calls. One agent (connect 5 s, read 10 s, total 20 s, no automatic redirects, each hop through `download::check_url`, bodies capped at 256 KB). A POST redirect is followed only for 307 or 308 within the same origin, so the code can never be forwarded to another host. `releases.rs` was not touched; its helpers are private, so the small agent is duplicated here.

Cache `<root>/catalog/site.json`: upcoming for 15 minutes (a failure is not retried for 60 s and the last good answer is returned as `stale`); a supporter answer is keyed by the SHA-256 of the code (the cache never holds the code), positive until min(`until`, 7 days) and rechecked after 1 day, negative for 1 day; a failed check keeps the last answer and marks it `stale`. The code format `d1.<digits>.<32 hex>.<43 base64url>` is checked before anything is sent; a malformed code answers `no` without a request and is not stored. The code is stored only in Preferences (`supporter_code`, `#[serde(default)]`), and only when the site confirms it as a supporter. `Portal::supporter(None)` re-checks the stored code, `Some("")` forgets (clears the code and the cached names, `forget_supporter`), `Some(code)` checks it afresh and stores it. Neither the view nor any log carries the code. States: `none`, `supporter`, `no`, `unreachable`. Note: `Preferences` still derives `Debug`, which would print the code; nothing prints it.

## v0.56.0 · formai.studio only, the schedule and the app caps {#formai-studio}

### links.rs · PREFIXES
- refers-to: core/src/links.rs :: PREFIXES · core/tests/open_links.rs
- kind: fix
- logged: v0.56.0 · 2026-11-06

The owner, 2026-11-06: formai.dev is another company's product, never owned or built by them, and must be gone from FormPortal entirely; the family's one domain is formai.studio, and formai.tools and formai.design redirect to it. `https://formai.dev/` and `https://docs.formai.dev/` are no longer opened. `https://formai.studio/support/` is, for the Support the Form apps link under On the way (`frontend/HASHOUT_LOG.md#live`); `open_links.rs` reads every `data-web` link in `index.html`, so it covers it. The rest of formai.studio stays refused, as the test requires.

### catalog/ · the schemas, the fixtures, schedule.json, apps/
- refers-to: catalog/schema/*.schema.json :: $id · catalog/fixtures/apps.json :: origin · catalog/fixtures/extensions.json :: authorities[formai].url, packages[contact-sheet].url · catalog/schedule.json · catalog/apps/*.json
- kind: decision
- logged: v0.56.0 · 2026-11-06

formai_dev v0.56.1 (`e81656e`) already names formai.studio in each schema's `$id` and in the fixtures; FormPortal's copies still said formai.dev, so those lines are formai_dev's now. The copies were not replaced whole: they had drifted both ways (FormPortal's schema keeps the catalogue `agents` fields and the extension `support` link that formai_dev's lacks; formai_dev renamed `formai` to `formportal`, which FormPortal's installs and state still use), so only the domain lines changed. `schedule.json` (the release groups: Launch 2026-11-03, Group 1 2026-11-06, Group 2 2026-11-09, Group 3 2026-11-12) and `apps/*.json` (each app's content file: kind, runs on, what it does) are copied unchanged from formai_dev v0.56.1; formai_dev ids map onto FormPortal's as `formportal` to `formai`, `formdeck` to `formslide`, `formskill` to `formskills`, `formbench` to `formranker`. `products.json` is not replaced for the same reason as the schemas; its stale statuses no longer show, because only released apps are listed.

## v0.55.0 · releases read from each app's GitHub release {#releases}

### releases.rs · discover
- refers-to: core/src/releases.rs :: discover, check, read_release, classify, merge, yanked · core/src/portal.rs :: Portal::catalog
- kind: decision
- logged: v0.55.0 · 2026-11-06

Why: on 2026-11-06 the signed catalogue in the download store was still the one generated 2026-11-04T17:21Z. It listed 26 products and gave a build to three (FormPortal 0.53.5, Form.md 0.47.7, FormTray 0.9.8), while formMCP 0.7.8, FormPDF 0.57.3, formskills 0.7.7, formdeck 0.30.7, FormVFX 0.52.8, FormPortal 0.54.3, Form.md 0.48.0 and FormTray 0.10.2 were published on their own repositories on 2026-11-05 and none of their files were in the store (each `dl.formai.studio/<app>/<version>/` path 404). formpipe, which copies releases into the store and signs the catalogue, had not run since; FormPortal had nothing newer to offer, including its own 0.54.x with the scroll fix.

What: after the signed catalogue is verified and parsed, `discover` reads, for each product whose signed `repository` is a `https://github.com/<owner>/<repo>` address, that repository's newest published release: `releases/latest/download/form-app.json`, then `releases/download/<tag>/SHA256SUMS.txt` for that exact tag. The release is used only when every check holds: `format` is `form-app`, its `repository` is the signed catalogue's repository (case ignored), the version is plain `x.y.z` and the tag is `v<version>`, the version is not in formcompiler's `yanked.json` (read from `raw.githubusercontent.com/<catalogue origin>/main/yanked.json`; when that list cannot be read, nothing is discovered at all), the sums list `form-app.json` with the digest of the bytes just read, and at least one file classifies as an installer. Files are classified as formcompiler's `catalog.py classify` does (same skip list, same architecture tokens, `-setup.exe` as nsis), each artifact's SHA-256 comes from the sums, its size from a HEAD request (0 when unknown, which `download` already handles). `published` is the manifest's `Last-Modified`, `notes` the release page, `commit` the manifest's, `agents` the manifest and the `-skills-v<version>.zip` from the sums, and `origin` is `github`. `merge` replaces the stable channel only when the release is newer, and moves the catalogue's release into `history` so rollback still reaches it. Every install still checks the file's SHA-256 before unpacking; this is formcompiler's own `--asset-origin github` shape, read by the client instead of by formpipe, without formpipe's build attestation. Results are kept in `<root>/catalog/releases.json` and rechecked after 15 minutes; a network failure keeps the last result, a 404 (a private repository, or no release) clears it. The signed `apps.json` kept beside it is never rewritten.

Hardening after an independent review (same day): `releases.json` is not signed, so a kept release is used only while it is sound (`sound`): its version plain, its tag `v<version>`, origin `github`, no history of its own, every artifact and agent asset at `<web>/<repo>/releases/download/v<version>/<file>` with a plain file name, and none of the names it was published under (catalogue id, manifest `app` and `id`, kept as `names`) yanked at that version in the current yank list. That check runs on every call, so a yank reaches a cached release at once, and a tampered entry is dropped and read again. The yank list is kept for the same 15 minutes (`yanks`, `yanks_checked`); when it cannot be read, nothing is discovered. Requests go through one agent with a 5 s connect, 15 s read and 30 s total timeout, so a stalled host cannot hold `Portal::catalog`, and follow redirects by hand with `check_url` on every hop (https or loopback only). A failed fetch of the manifest or of the sums (`Outcome::Failed`) keeps the last sound result and is retried after a minute instead of being stored as "no release" for 15. Sizes come from HEAD, then a `Range: bytes=0-0` GET's `Content-Range`. Sums lines whose file name is not plain (`plain_name`) are ignored, and an owner or repository name starting with a dot is refused. Verified 2026-11-06 through the loopback relay: a cached run made 2 requests, a cache entry pointed at another host was replaced by the real address, yanking FormTray 0.10.2 in a served yank list brought FormTray back to the catalogue's 0.9.8 on the next call, an unreachable yank list gave the catalogue's three, and formskills 0.7.7 installed with its SHA-256 verified. Not done: the formcompiler copy is not compared with the kept catalogue's `generated`, so a blocked store can still mean an older signed catalogue, as the kept copy already could.

### portal.rs · Portal::catalog, the formcompiler copy
- refers-to: core/src/portal.rs :: Portal::catalog · core/src/releases.rs :: STORE_CATALOG, COMPILER_CATALOG
- kind: fix
- logged: v0.55.0 · 2026-11-06

When the catalogue address is the store's (`https://dl.formai.studio/catalog/apps.json`) and it cannot be fetched, the signed copy formcompiler publishes on its `catalog` release (`github.com/nodemode-dev/formcompiler/releases/download/catalog/apps.json` and `.sig`) is tried before the kept copy. The same signature check applies to whichever was read.

### releases.rs · Portal::reads_releases
- refers-to: core/src/releases.rs :: Portal::reads_releases, RELEASES_ENV, RAW_ENV · core/src/policy.rs :: Policy::github_releases
- kind: decision
- logged: v0.55.0 · 2026-11-06

Discovery runs only for a catalogue fetched over https or loopback (a local file, as the tests use, is read as it is). `FORMPORTAL_RELEASES=off` (or 0, false, no) turns it off. An organisation's policy decides with `github_releases`; when the policy leaves it out, discovery is on unless the policy names its own `catalog`, so a managed mirror is not mixed with public releases. `FORMPORTAL_GITHUB_WEB` (as for sign-in) and `FORMPORTAL_GITHUB_RAW` point the reads elsewhere; verification on 2026-11-06 used a loopback relay through both.

### lib.rs · Catalog::view and versions, prelaunch with a release
- refers-to: core/src/lib.rs :: Catalog::view, Catalog::versions · ../frontend/src/engine/index.ts :: Engine.view
- kind: fix
- logged: v0.55.0 · 2026-11-06

A prelaunch product is `Unreleased` only while it has no release on any channel. FormTray was prelaunch in the catalogue with a stable 0.9.8 and FormPortal offered nothing; formMCP, FormPDF and formskills are prelaunch with published releases. The interface's `Engine.view` has the same rule. `Release` reads the catalogue's own `origin` (`store` or `github`), which formcompiler emits and the vendored schema does not list yet (formai_dev's schema should add it).

## v0.54.1 · FormSlide's identifier and repository {#formslide}

### catalog/products.json · formslide
- refers-to: catalog/products.json :: formslide.identifier, formslide.repository
- kind: decision
- logged: v0.54.1 · 2026-11-04

The launch sweep (2026-11-04): the compiled-in entry for FormSlide named `dev.formai.formslide` and `https://github.com/nodemode-dev/formslide`, a repository that does not exist. The app is formdeck: its bundle identifier is `ai.nodemode.formdeck` (its `tauri.conf.json`, formcompiler's `apps/formdeck.json` and the live catalogue agree) and its source is `nodemode-dev/formdeck`, so the offline app list and the readme, issues and discussions links now name those. The id stays `formslide`, the catalogue's id. Other entries whose identifier differs from formcompiler's registry (formmd, formdam, formdesign, formlit, formpath, formsurface, formvfx, formweb) are left for their own releases; installs read the live catalogue, which takes identifiers from the registry.

## v0.53.5 · the production catalogue key {#catalog-key}

### catalog_keys.txt · trusted
- refers-to: core/catalog_keys.txt · core/src/signature.rs :: compiled_keys, trusted_keys, verify · core/tests/catalogue_trust.rs
- kind: decision
- logged: v0.53.5 · 2026-11-02

formcompiler's production catalogue key pair now exists (`scripts/catalog.py keygen`; the private seed is the formcompiler secret `FORMCOMPILER_CATALOG_KEY`, which signs `catalog/apps.json` in the download store). Its public half, `P3Cgp37EmB2jOBtTWRNFtO8xMq8hsb+Ii3U5+UrYNtY=`, is the one key line in `catalog_keys.txt`, the same line as formMCP's and formskills', so the published catalogue verifies; before, every catalogue was refused with "this build trusts no catalogue key yet" unless `FORMAI_CATALOG_PUBKEY` or an organisation's policy keys added one, and both still can. The file's comment still names formai_dev's signing script, from before formcompiler took the catalogue over; the key itself comes from formcompiler. `catalogue_trust.rs` checks that `compiled_keys()` holds it and that it is a valid Ed25519 point, that the compiled-in list plus a test key verifies the test key's signature, and that the compiled-in keys alone refuse it. The private half is never used.

## v0.53.5 · the links FormPortal opens {#links}

### links.rs · may_open
- refers-to: core/src/links.rs :: PREFIXES, EXACT, may_open, shared_repository · core/tests/open_links.rs · ../src-tauri/src/main.rs :: open_web
- kind: fix
- logged: v0.53.5 · 2026-11-02

https only, and never a URL with whitespace, a control character, a quote or a backslash (the browser is started with it as an argument). Allowed by prefix, each ending in a slash so a look-alike host (`formai.dev.example.com`) cannot pass: `https://github.com/nodemode-dev/` (the family's repositories, the catalogue's `repository`), `https://github.com/sponsors/` (a maker's support page; other support hosts in an extension index stay refused), `https://formai.dev/`, `https://docs.formai.dev/`, and only the download page of formai.studio, `https://formai.studio/download/`. Exactly `https://github.com/login/device`, the device-flow page. And GitHub repositories FormPortal makes for the person: `https://github.com/<owner>/formportal-library-<name>` and `https://github.com/<owner>/formportal-public` with anything under them, the owner a GitHub login (letters, digits, hyphens, at most 39). The share and portfolio links are built from `github::web()`, which `FORMPORTAL_GITHUB_WEB` can point elsewhere; links there are not allowed. `open_links.rs` reads every `data-web` link in `frontend/index.html`, the literal pages in `vite.config.ts`, each family repository's `#readme`, `/issues/new` and `/discussions` from `catalog/products.json`, the sign-in page and sample share links, and asserts each is allowed; a second test holds a list that must be refused. Against the old three-entry list it fails (`https://formai.studio/download/` refused). The support link's placeholder in `index.html` was `https://github.com/nodemode-ai`, never shown while hidden; it is `#`, like the share links' placeholders.

## unreleased · install trust hardening {#trust-hardening}

### extensions.rs, portal.rs, lib.rs · plain_name for every folder name from outside
- refers-to: core/src/lib.rs :: plain_name · core/src/extensions.rs :: read_manifest · core/src/portal.rs :: install_with
- kind: fix
- logged: unreleased · 2026-10-29

`place_package` joins the manifest's `version` to the extension's folder and removes whatever is there before the rename. `read_manifest` checked `id` and `product` but not `version`, so a `.formpkg` whose version was `../../../../Documents` removed that folder, and the window installs a double-clicked package without asking. `plain_name` (letters, digits, `.`, `-`, `+`, `_`, not starting with a dot) is now required of the manifest's version, id and product (id and product also without a dot, as before; the old check let `C:` through, which on Windows makes `Path::join` leave the folder), and of the product and version `install_with` joins for an app, where they come from the catalogue. Tests: extension_trust.rs (a climbing version removes nothing outside), install_lifecycle.rs (a version that is not a plain name installs nothing).

### portal.rs · links in a zip stay inside the folder
- refers-to: core/src/portal.rs :: unzip, link_stays_inside, through_a_link, links_stay_inside
- kind: fix
- logged: unreleased · 2026-10-29

`unzip` refused only absolute link targets, so a link `out -> ../../..` followed by an entry `out/file` wrote anywhere the person can write (a login item in ~/Library/LaunchAgents, say). Three rules now: a link's target, read from the link's own folder, never climbs above the top (`link_stays_inside`); no entry is written through an existing link, including one the archive made earlier (`through_a_link`), which also stops a chain such as `here -> .` then `up -> here/..`; and after unpacking every link is followed by hand, link by link inside the folder, and must never climb above its top (`resolves_inside`, at most 40 hops), so a chain such as `d1/d2/l1 -> ..` then `l2 -> d1/d2/l1/../../x` is refused. A link to something missing is followed as far as it goes and allowed, because shipped frameworks often keep `Headers -> Versions/Current/Headers` with the headers stripped; `canonicalize` was tried first and refused those. Links that stay inside, such as `Versions/Current -> A`, still install. Tests: install_lifecycle.rs, the zip link tests.

### portal.rs, signature.rs · a catalogue or index from a file is checked like one from an address
- refers-to: core/src/signature.rs :: read_local · core/src/portal.rs :: catalog · core/src/extensions.rs :: extension_index · core/src/fonts.rs :: font_index · core/src/media.rs :: media_index · core/src/learn.rs :: learn_index
- kind: fix
- logged: unreleased · 2026-10-29

A file path skipped the signature: `install --source ./apps.json`, and the MCP tools with `source` set to a file an agent was talked into writing, installed anything the file named. `read_local` reads the file and `<file>.sig` beside it and applies the same rule as an address: a signature is always verified, a missing one is refused unless `allow_unsigned`. `Portal::catalog` now takes a file path itself (before, a path failed the URL check and fell back to the kept copy) and does not keep a catalogue read from a file. Tests: catalogue_trust.rs and extension_trust.rs, the local file tests.

### portal.rs · a rollback holds the automatic update that would undo it
- refers-to: core/src/portal.rs :: rollback, hold, hold_if_older
- kind: fix
- logged: unreleased · 2026-10-29

A rollback swapped the record and nothing else, so the next automatic update (the window runs `apply_updates` when it opens) put the newer version straight back. Installing an older version by number already turned automatic updates off for the app (`hold_if_older`); `rollback` now does the same through the shared `hold` when the version it goes back to is older, unless the organisation's policy forces automatic updates, and clears "update later" for the app, because `apply_updates` installs a later update even when automatic updates are off. The hold is per product, as `hold_if_older`'s always was, so rolling back a beta also stops the stable channel's automatic updates. Rolling forward again leaves the hold alone: the person turns automatic updates back on. Test: install_lifecycle.rs, a_rollback_holds_the_automatic_update_that_would_undo_it.

### lib.rs · prerelease order follows semver
- refers-to: core/src/lib.rs :: version_newer, prerelease_newer
- kind: fix
- logged: unreleased · 2026-10-29

Prerelease tags were compared as text, so `beta.10` was older than `beta.9` and a beta install stopped updating at the tenth beta. `prerelease_newer` compares the dot-separated parts left to right, numbers by value and below words, and a longer list wins when the shorter is its prefix (semver 2.0 section 11). Numbers are compared as digit strings (length, then text), so one too long for u64 still orders. Build metadata after `+` is ignored, as semver says; before, `1.0.1+b` read as 1.0.0. Test: version_order.rs.

## v0.53.3 · the test suite {#tests}

- refers-to: core/tests/support/mod.rs, core/tests/catalogue_trust.rs, core/tests/install_lifecycle.rs, core/tests/family_contract.rs
- kind: decision
- logged: v0.53.3 · 2026-10-26

`FAMILY_TEST_PLAN.md` P1 for formportal, and the family layers F4 and F9 (`family_contract.rs` is the formai_dev sidecar's template, unchanged; its version sites are this repo's). Nothing reaches the network: `support::Server` is a one-thread HTTP server on 127.0.0.1 that serves bytes put into it and counts hits (loopback http is what `check_url` allows besides https), the catalogue keys are made from fixed seeds in the test (`signing_key`), and every archive is a zip built in memory, its `bin/` entries marked 0755 because the Linux launch target is the first executable file. The catalogue key (`FORMAI_CATALOG_PUBKEY`) and the policy path (`FORMPORTAL_POLICY`) are process environment, so the tests that set or rely on them take `env_lock()`; the system policy path (`/etc/formportal/policy.json`) must be absent where they run, as it is on CI. Every portal works in a `Scratch` folder under the system temp folder that removes itself, never the person's data folder. Each test checks what a person or a script would see: the files left on disk listed exactly, the record in `installed.json`, the error kind, and the hit count on the server (a refused app is refused before anything is downloaded). Proven on a copy of the tree: skipping the SHA-256 check, accepting any signature, ignoring the policy's app list, not keeping the previous version, not checking the catalogue's signature and dropping the policy check before the download each fail the suite. Not tested here (FAMILY_TEST_PLAN P2): deep links, the MCP tools against the command line.

## v0.53.0 · installs agents can reach {#q9}

Family plan Q9 (a). Built first as v0.46.0 on v0.45.1 (the `v0.46.0-mcp` branch, commits f535e67, 5a7ad02, c99c44a) while the main line went on to v0.52.1, and carried onto v0.52.1 by hand, region by region. The regions it touches (portal.rs install and sweep, apply_updates, agents.rs from AppFile to agent_surface, state.rs InstalledVersion, repair.rs fix, cli ops install, update and app_agents, the window's install) were unchanged on the main line since v0.45.1, so nothing had to be reconciled in code; only the version, the changelog and the logs. The main line's own v0.46.0 (the login item) keeps its number; this work is v0.53.0.

### portal.rs, agents.rs · the release's form-app.json in the install
- refers-to: core/src/portal.rs :: install, install_from, install_with · core/src/agents.rs :: fetch_app_file, search, parse_app, AppFile::id, AppFile::version · core/src/repair.rs :: fix (missing, broken) · cli/src/ops.rs :: install, update · src-tauri/src/main.rs :: install
- kind: decision
- logged: v0.53.0 · 2026-10-25

The apps' bundles carry no `form-app.json`, so `app-mcp` could start nothing an install held. formcompiler already attaches the release's `form-app.json` as an asset, and the catalogue lists it under `agents.manifest`; `install_with` fetches it after unpacking (only when `search` finds none in the bundle, four folders deep), checks its SHA-256 against the catalogue and its `id` and `version` against what is being installed, and writes it at the install's top before the rename. A mismatch removes the staging folder and stops the install, as a bad download does. `install` keeps its signature (core/examples/install.rs still uses it) and passes no release; `install_from` looks the release up in the catalogue, and every caller (install, update one, apply updates, repair, the window) uses it.

### agents.rs · agents.mcp.binary
- refers-to: core/src/agents.rs :: AppMcp.binary, resolve_binary, agent_surface, mcp_available, parse_app
- kind: decision
- logged: v0.53.0 · 2026-10-25

A path relative to `form-app.json` cannot be one value for every package: the program sits in `X.app/Contents/MacOS/x` from a dmg or zip, `usr/bin/x` from a deb or rpm, `x.exe` on Windows, and an AppImage is the program itself. So version 2 may name the program, and FormPortal finds it: macOS bundle, `usr/bin`, `.exe`, a file of that name, then the single AppImage at the top. The name is refused unless it is a plain file name, and the program found must resolve inside the install. Two AppImages, or no match, is "not found" rather than a guess.

### agents.rs, state.rs · every file's digest
- refers-to: core/src/agents.rs :: FilesRecord, FILES_FORMAT, install_files, files_record_path, write_files_record · core/src/state.rs :: InstalledVersion.files · core/src/portal.rs :: install_with, sweep
- kind: decision
- logged: v0.53.0 · 2026-10-25

FormPortal recorded only the downloaded archive's SHA-256. After the rename it now writes `<version>.files.json` beside the version folder (outside it) with each file's SHA-256 and each symlink's target, and records the path as `files` in `installed.json` (absent on older records, which still read). Writing the record never fails an install. `sweep` removes a record whose version folder is gone; `uninstall` removes the channel folder with its records. formMCP 0.7.1 reads it.

## v0.52.0 · the managed package {#deploy}

Parity rows 61 and 62: one package an organisation's own deployment tool runs, holding FormPortal and the policy together.

- deploy.rs `package(policy, installer, out)`: copies FormPortal's own installer and the policy file into `out` (which must be new or empty), writes `SHA256SUMS` (the `sha256sum -c` format, which `shasum -a 256 -c` and the PowerShell loop also read), the install script for the installer's kind and a `README.txt`. The script refuses to run unless root or administrator, stops if a sum no longer matches, copies the policy to `policy::system_path()`'s place for that platform first, so the first start is already managed, then installs silently: deb with `dpkg -i` (then `apt-get install -f` for missing dependencies), rpm with `rpm -U --replacepkgs`, the AppImage into `/opt/formportal` with a `/usr/local/bin/formportal` link, the dmg mounted read-only and `FormPortal.app` copied into Applications with `ditto` (only after checking the image holds it), the msi with `msiexec /i /qn /norestart` (3010, restart needed, counts as success), from `install.ps1` behind `install.cmd`.
- Refused: the NSIS setup, since Tauri's NSIS default (`installMode` currentUser, which FormPortal does not change) installs for the one account that runs it, while the msi is `InstallScope="perMachine"` (both read in Tauri's own sources, `tauri-utils` config.rs and the bundler's main.wxs); anything not deb, rpm, AppImage, dmg or msi; an installer name with anything but letters, digits, dots, dashes, underscores and plus (the script names it inside single quotes) or starting with a dash; a missing or invalid policy.
- policy.rs `check(path)`: the same reading FormPortal does at start (`read`), with a missing file an error rather than "no policy".

## v0.51.0 · the portfolio page, extension support links {#portfolio}

- share.rs `write_portfolio`, `portfolio_text`: after every `publish` and `unpublish`, `README.md` at the root of `formportal-public` is rewritten from the person's public links in that repository: a heading per file linking to its own page, and the image itself for png, jpg, webp, gif and svg. GitHub shows that README as the repository's front page, which is the portfolio (parity row 54); there is no feed of other people's work. It is written only when its blob sha changes. If the link is made but the page cannot be written, the error says so; publishing again retries. `SharesView.portfolio` is `<github web>/<login>/formportal-public` while anything is published (`github::web` is now `pub(crate)` for it). Checked against the stand-in GitHub: two files, then one removed, then none ("Nothing is published right now"); names with brackets and spaces are escaped.
- extensions.rs `Entry.support` (parity row 33): an optional address where people can pay or sponsor the maker. `parse_index` drops any that is not https, since the window opens it in the browser. The extension stays free; FormPortal handles no payment. `catalog/schema/extensions.schema.json` gains the field; the fixture's warm-dust carries one.

## v0.48.0 · sharing through the person's GitHub account {#share}

### share.rs · libraries, invitations, public links
- refers-to: core/src/share.rs :: ShareState (shares.json), blob_sha, slug, encode, safe_relative, ensure_repo, remote_tree, local_files, put_file, send, Portal::shares, share_folder, share_accept, share_pull, share_send, publish, unpublish · core/src/github.rs :: signed_in, Signed::call, Signed::raw · core/Cargo.toml :: sha1
- kind: decision
- logged: v0.48.0 · 2026-10-25

Parity rows #37 (share by invite), #38 (Shared with you) and #43 (public links), the owner's "connect the cloud rows to formcompiler": formcompiler has no server, so each person's GitHub account is the storage. A shared library is a private repository `formportal-library-[slug of the folder name]` in the sharer's account; only folders already listed in Files can be shared. Sending lists the repository's tree (`git/trees/[branch]?recursive=1`, an empty repository answers 409 and counts as no files) and compares each local file's git blob hash (SHA-1 of `blob [len]\0` and the bytes, hence the `sha1` crate) so only changed files are sent, through the contents API (`PUT .../contents/[path]` with base64 content, and the old blob `sha` when replacing). Hidden files (a leading dot) and files over 100 MB stay home; GitHub's contents API does not return files over 100 MB. Inviting is `PUT .../collaborators/[login]` (201 a new invitation, 204 already there); the invitee accepts in their own FormPortal: `shares` lists their pending invitations to repositories named with the prefix, `share_accept` accepts (`PATCH /user/repository_invitations/[id]`, 204), records the library in `shares.json` and downloads it into `[projects folder]/Shared/[name] from [owner]`, which is then added to Files. `share_pull` downloads only files whose blob hash differs, through the raw media type, writing to a hidden temporary name and renaming; tree paths that are absolute or contain `..` are refused. Public links go to one public repository, `formportal-public`, under `[first 12 of the blob hash]/[file name]`, so two files with the same name never collide; the link is the contents API's `html_url`, and unpublishing deletes it with the stored blob hash. GitHub has no list of the person's joined libraries in this design (its user repositories listing could not be read from GitHub's documentation in this session), so joined libraries are remembered in `shares.json`. Creating the repository uses the body GitHub documents for organisation repositories (`name`, `description`, `private`, `auto_init`), applied to `POST /user/repos`. Checked against a stateful stand-in GitHub (two accounts, repositories, contents, trees, collaborators, invitations) with a real Secret Service: share refused for a folder not in Files, share and invite, send again with nothing changed, send after a change (one file), publish, the invitee sees and accepts the invitation, a 2 MB binary arrives byte for byte, a hidden file stays home, pull again with nothing changed, the folder appears in Files, unpublish; the blob hash equals `git hash-object`. Not run against github.com.

## v0.47.0 · the optional GitHub sign-in {#github}

### github.rs · device flow, keychain, no secret
- refers-to: core/src/github.rs :: client_id, start, poll, whoami, store, token, status, sign_out · core/github_client.txt · core/Cargo.toml :: keyring per target · core/src/error.rs :: CoreError::Account
- kind: decision
- logged: v0.47.0 · 2026-10-24

The family plan's Phase 1b (owner: the sign-in and cloud rows connect to formcompiler). FormPortal signs in with GitHub's device flow: `start` posts `client_id` and `scope` to `/login/device/code`, the person enters the code on github.com, and `poll` posts `client_id`, `device_code` and the device-code grant to `/login/oauth/access_token` (GitHub's docs: no client secret is needed for the device flow, and device flow must be turned on in the app's settings). Both requests send `Accept: application/json`. `authorization_pending` keeps waiting, `slow_down` takes the new interval (or adds 5 seconds), `expired_token` (and `token_expired`, which GitHub's prose also uses), `access_denied` and `device_flow_disabled` end with a plain reason. The token goes to the system keychain (keyring 3.6.3: Keychain on macOS, Credential Manager on Windows, the Secret Service over D-Bus on Linux) under service `FormPortal GitHub`; with no keychain, signing in is refused before a code is shown, and nothing is ever written to a file. `whoami` reads `/user` and the granted scopes from `X-OAuth-Scopes`. There is no refresh-token handling: the app is registered with "Expire user access tokens" off (formcompiler's `docs/ACCOUNTS.md`), since GitHub turns it on by default and its expiring tokens last 8 hours; if a token is ever refused, `whoami` answers 401 with "sign in again". Supporting expiring tokens is a later change. `status` answers "not set up" before touching the keychain, so a computer without one does not show a keychain error for a feature it cannot use anyway. Scopes: `read:user` at sign-in, plus `repo` only when sharing asks (`SHARE_SCOPE`), because GitHub's docs give OAuth apps no narrower scope for private repositories and collaborators. The client ID is public and comes from the one-line `core/github_client.txt` (empty until the owner registers the app, then sign-in says it is not set up) or `FORMPORTAL_GITHUB_CLIENT_ID`; `FORMPORTAL_GITHUB_WEB` and `FORMPORTAL_GITHUB_API` point at a stand-in, and `check_url` still allows only https or this computer. `CoreError::Account` prefixes "GitHub sign-in:". Checked against a stand-in GitHub on loopback inside a D-Bus session with an unlocked gnome-keyring: not set up, signed out, sign-in through pending and slow_down (4 s), the token in the Secret Service (secret-tool finds it), status, sign-out, the share scope, a cancelled sign-in, device flow off, a plain http host refused, and no keychain (refused before the code). Not run against github.com (no client ID yet), macOS or Windows.

### login.rs · the Windows failure's wording
- refers-to: core/src/login.rs :: sync (Windows)
- kind: fix
- logged: v0.47.0 · 2026-10-24

A failed `reg add` was `CoreError::State`, which reads "the record of installed apps could not be read"; it is `Invalid` with "the login item could not be added" and reg's message.

## v0.46.0 · the login item {#login}

### login.rs · sync and location
- refers-to: core/src/login.rs :: sync, location, entry · core/src/prefs.rs :: Preferences.open_at_login
- kind: decision
- logged: v0.46.0 · 2026-10-24

Parity row #68. `open_at_login` (default false, absent in older files reads false) says whether the window opens at login. `sync(on, program)` makes the system agree, with no new dependency: Linux writes `$XDG_CONFIG_HOME/autostart/formportal.desktop` (the XDG autostart folder; `Exec` quoted, with backslash and double quote escaped), macOS a LaunchAgent `~/Library/LaunchAgents/dev.formai.portal.login.plist` with `RunAtLoad` (the label follows the app identifier `dev.formai.portal`), Windows the per-user `HKCU\...\CurrentVersion\Run` value `FormPortal` through `reg`, started with CREATE_NO_WINDOW (0x08000000) so no console flashes. Off removes it, and removing what is not there is not an error. Files are written to a `.tmp` beside them and renamed, and rewritten only when the text differs. The core does not decide the program path: the shell passes it, because only the window knows its own path (an AppImage runs from a temporary mount, so `APPIMAGE` wins). Checked on Linux through a scratch harness: on writes the file, on again leaves it, off removes it, off again succeeds. macOS and Windows not run.

## v0.45.1 · family registration {#family-v1}

### agents.rs · Claude Code: user scope only
- refers-to: core/src/agents.rs :: client_state (Client::Claude)
- kind: fix
- logged: v0.45.1 · 2026-10-24

`claude mcp get <name>` also finds a project's `.mcp.json`, so FormPortal started inside a project that names the app's server (as formMCP's and FormPortal's own checkouts do for their servers) reported Claude Code "connected" with nothing at user scope, and Disconnect then removed nothing. The check now runs in the home folder and counts an entry only when the output says `Scope: User`, which is the scope `connect` writes; a project entry is left out of the state and never touched. The same fix as formMCP 0.4.0's. Checked with the real `claude` command in a scratch home and a stand-in install of formvis with a launcher: inside a project whose `.mcp.json` names `formvis`, not connected; after `connect`, connected (Scope: User); after `disconnect`, not connected, the project file unchanged.

### catalog/products.json · formMCP and formskills by their registry names
- refers-to: catalog/products.json :: formmcp, formskills · design/tokens.css :: [data-product="formskills"]
- kind: decision
- logged: v0.45.1 · 2026-10-24

The owner's names (family plan, Q5): `formmcp`, display name formMCP, `ai.nodemode.formmcp`, `nodemode-ai/formMCP`; `formskills` (was `formskill`, FormSkill), `ai.nodemode.formskills`, `nodemode-ai/formskills`, with the summaries formcompiler's registry carries. Both stay `in-development` in the `next` group until their first release. The product hue moves with the id. FormTray already used these ids and identifiers; FormRanker changes in its 0.6.5.

## v0.45.0 · form-app.json format_version 2 {#app-v2}

### agents.rs · parse_app reads 1 and 2
- refers-to: src/agents.rs :: AppFile, parse_app, mcp_available, Portal::app_file, agent_manifest, agent_surface
- kind: decision
- logged: v0.45.0 · 2026-10-24

formcompiler 0.4.0 writes `form-app.json` with `format_version` 2 into every release (family plan, Phase 2). A missing `format_version` means 1, so every file written before still reads. In 2, `agents.mcp` carries `available` and the launcher (`command`, `args`) is optional, because no app's bundle has a stdio launcher yet; `agent_surface` returns none for an empty command, so nothing is offered to the clients that could not start. Version 1 keeps its rule that `agents.mcp` names a command (the serde default would otherwise let an empty one through), and a version above 2 is refused with "update FormPortal" rather than half-read. `agents.skills` is kept as written (file, bytes, sha256, root, each skill's folder, name, description and file count) and returned by `agent_manifest`; FormPortal never downloads or installs skills (family plan non-goal). Checked with the CLI against a stand-in formvis install served from loopback through formcompiler's own `catalog.py`: v2 read, v1 with a command gives a surface, v1 without one and a version 3 are refused.

### lib.rs · agents on Product and Release
- refers-to: src/lib.rs :: ProductAgents, ReleaseAgents, AgentAsset
- kind: decision
- logged: v0.45.0 · 2026-10-24

The catalogue stays `format_version` 1: the new fields are optional additions, and serde here does not refuse unknown fields, so a FormPortal older than 0.45.0 reads a catalogue that has them and ignores them. Both are `Option` with `skip_serializing_if`, so a catalogue without them serialises as before. `catalog/schema/apps.schema.json` gains `agents` on a product and a release, and `agentAsset` (https url, sha256), validated against a catalogue built by formcompiler's `catalog.py` and against `catalog/fixtures/apps.json`.

## v0.44.0 · a version on each save; previews {#saves}

### keep_saved
- refers-to: src/files.rs :: Portal::keep_saved
- kind: decision
- logged: v0.44.0 · 2026-10-12

Creative Cloud keeps a version of a cloud document on every save. Without a resident process FormPortal can do that only while it runs, so the shell polls: `keep_saved` walks the folders that keep versions and keeps a version of each project whose size or time moved, but only once the time is two seconds old, so a file still being written is never copied. It reports only versions that are really new (the same SHA-256 updates the last one's time instead). Polling over a file-system watcher: no new dependency, the same walk the scan already does, and the same result on every system. Verified with `watch --interval 1`: two saves a second apart kept one version, a save after a pause another, a touch with no change none, a new project in a subfolder was first seen, a text file ignored.

### Previews
- refers-to: src/files.rs :: ProjectFile.preview, preview_of, PREVIEW_LIMIT, Portal::preview_data_url
- kind: decision
- logged: v0.44.0 · 2026-10-12

A preview is the app's to write, as `[file].preview.webp`. FormPortal lists it when it is at most 256 KB and returns it only when the canonical path is inside a projects folder, the name ends in `.preview.webp` and the bytes are WebP, so the window cannot be made to read anything else. Verified: a real WebP listed, a 300 KB one ignored.

## v0.43.0 · font updates {#font-updates}

### font_updates
- refers-to: src/fonts.rs :: Portal::font_updates
- kind: explainer
- logged: v0.43.0 · 2026-10-12

An installed style from the index whose index entry now has a different SHA-256 is an update; the person's own fonts never are. `install_font` already replaces the file and the record. Verified with two signed local indexes (the same family, then a changed Regular): no update, then one, then none after installing it.

## v0.42.0 · repair, update later, files from the web {#repair}

### repair.rs · check, then fix only what was found
- refers-to: src/repair.rs :: Finding, Report, Portal::repair
- kind: decision
- logged: v0.42.0 · 2026-10-12

Creative Cloud's Cleaner Tool removes old installs and repairs the hosts file. FormPortal has no hosts entries; what can go wrong is a record whose folder vanished, a folder with nothing to open, a kept earlier version deleted by hand, and leftovers (versions no record names, `.tmp` staging, old downloads). The scan and the fix are one function with a flag, so the report the person approves is the list that is fixed. A broken app is reinstalled only when the catalogue's file for that version has the recorded SHA-256; anything else would silently change what is installed. Anything younger than ten minutes or holding a running process is skipped. A path already gone counts as fixed, because `install` sweeps its channel's leftovers when it reinstalls. Verified with a signed local catalogue: a broken app reinstalled, a missing earlier version forgotten, a leftover, a staging folder and an old download deleted, a fresh folder left alone, a missing folder reinstalled.

### later.rs · put an update off until the app is closed
- refers-to: src/later.rs :: later, is_later, set_later · src/portal.rs :: Update.later, apply_updates, uninstall
- kind: decision
- logged: v0.42.0 · 2026-10-12

Creative Cloud's Later applies when the app is not running. `apply_updates` with `automatic_only` now also takes put-off updates, always waiting for the app to close, and clears them once installed; removing an app clears it too. Verified: with automatic updates off, a put-off FormCut update was installed by the next automatic pass and the list emptied.

### web.rs · a Form project file from a web page
- refers-to: src/web.rs :: WebPlan, web_plan, fetch_web_file
- kind: decision
- logged: v0.42.0 · 2026-10-12

A link from any page can ask for a download, so only a file whose extension the registry gives to a Form app is accepted, only from https or this computer, up to 4 GB, written to a `.part` file and renamed, into From the web in the first projects folder with a numbered name if one exists. Verified: a percent-encoded name saved and numbered on a second fetch; an `.exe`, a plain-http remote address and an unreachable host refused.

## v0.41.0 · the language preference {#language}

### prefs.rs · language and page
- refers-to: src/prefs.rs :: Preferences.language, LANGUAGES, Preferences::page
- kind: decision
- logged: v0.41.0 · 2026-10-12

`language` is `None` for English; `page()` maps it to the built page the shell opens (`es/index.html`), falling back to `index.html` for anything unknown, so a hand-edited file can never leave the window blank.

## v0.40.0 · tutorials, the assistant, quiet notices {#learn}

### learn.rs · bundled tutorials, a signed index, local progress
- refers-to: src/learn.rs :: LearnIndex, Tutorial, Step, Progress, bundled, learn_index, learn_progress, learn_mark, learn_reset · data/learn-portal.json
- kind: decision
- logged: v0.40.0 · 2026-10-12

FormPortal's own six tutorials are compiled in with `include_str!`, so they work offline and need no index; each step's text uses the interface's real labels. The apps' tutorials come from `formai-learn` beside the catalogue (or the policy's locked one), verified like fonts and media; "the tutorial index was refused" on a bad signature. Progress is a map of tutorial id to finished step indexes (from 0 in the file, from 1 everywhere a person or agent sees it), written atomically to `learn-progress.json`; an empty set removes the entry.

### assistant.rs · ask the person's own agent, reading only
- refers-to: src/assistant.rs :: AgentCli, Server, assistant_agents, ask_agent · src/agents.rs :: which, quote (now pub(crate))
- kind: decision
- logged: v0.40.0 · 2026-10-12

Creative Cloud's assistant is Adobe's model in Adobe's window; the Form family's is whichever agent the person already runs. `ask_agent` finds Claude Code or Codex on PATH and runs it once, non-interactively, in FormPortal's `assistant` folder (so no project's instructions are picked up), with FormPortal's server attached and a short guide appended. Claude Code gets `--strict-mcp-config` and `--allowedTools` listing only the reading tools; Codex gets `--sandbox read-only` and the server through `-c` overrides. The server itself is the reading-only mode, so a refusal does not depend on the client honouring its allow list. Questions are capped at 4000 characters and the agent is stopped after 240 seconds. Verified with Claude Code 2.1.296 here; Codex was not on this machine, so its arguments are unverified.

### prefs.rs · quiet
- refers-to: src/prefs.rs :: Preferences.quiet
- kind: explainer
- logged: v0.40.0 · 2026-10-12

The notice categories that go to the bell without a pop-up; serde default empty, so older files load unchanged.

## v0.39.0 · stock media and templates {#media}

### media.rs · a signed open media index, a Library with credits, templates
- refers-to: src/media.rs :: MediaIndex, MediaItem, Saved, library_dir, credit_line, media_index, saved_media, save_media, use_template, remove_media, thumbnail_data_url
- kind: decision
- logged: v0.39.0 · 2026-10-12

The index (`formai-media`) is fetched beside the catalogue (or the policy's locked catalogue) and verified with the same keys, like fonts and extensions; a bad or missing signature reads "the media index was refused". Only CC0-1.0, CC-BY-4.0, CC-BY-SA-4.0, Apache-2.0, MIT and OFL-1.1 items are saved; others are listed and refused with "it was not saved". Each file goes through the checked `download` into the Library (`Documents/Form/Library`, or `FORMPORTAL_LIBRARY`), with `<file>.credit.txt` beside it and an entry in `credits.json`, so the credit travels with the file. `use_template` saves first, then copies into the chosen or first projects folder with a numbered name when one exists, and the caller opens it with the app that owns the extension. `thumbnail_data_url` returns a data URL capped at 512 KB, PNG, JPEG or WebP only, because the window's content security policy loads no remote images. Openverse was the intended live source, but its API could not be reached or verified from here, so the index is curated and signed instead; a live provider is a later decision. Verified with a signed local index: filters, a saved image with its credit file, a closed licence refused, a template copied twice and opened, removal, a tampered index refused.

## v0.38.0 · fonts {#fonts}

### fonts.rs · a signed open index, per-user installs, the person's own files
- refers-to: src/fonts.rs :: FontIndex, font_index, install_font, add_own_font, remove_font, font_dir, font_kind
- kind: decision
- logged: v0.38.0 · 2026-10-12

The index (`formai-fonts`) is fetched beside the catalogue (or the policy's locked catalogue) and verified with the same keys; a bad signature reads "the font index was refused". Only OFL-1.1, Apache-2.0 and MIT families install. Each style downloads through the ordinary checked `download`, is sniffed for a TrueType, OpenType or collection header (WOFF refused), and is copied into the per-user font folder as `FormPortal-[family]-[style].[ext]`, so FormPortal's files are recognisable and removal touches only them. Linux runs `fc-cache -f` on its folder; Windows adds a per-user registry value with `reg`; macOS needs nothing. The person's own font needs `rights_confirmed`, the same promise Creative Cloud asks for before an upload. `FORMPORTAL_FONTS_DIR` redirects for tests and skips the system steps. Verified with Liberation fonts (OFL-1.1) served from a signed local index: family and single style installed, a proprietary family refused, a text file and a WOFF refused, a tampered index refused, removal by style and family, and without the test variable `fc-list` saw the installed font.

## v0.37.0 · Files {#files}

### files.rs · folders, scan, versions, open, storage
- refers-to: src/files.rs :: add_folder, remove_folder, scan_files, keep_version, file_versions, save_version, revert_file, open_file, storage, extensions_from_registry, suggested_folder
- kind: decision
- logged: v0.37.0 · 2026-10-12

Creative Cloud's Files tab is cloud storage; FormPortal's answer is the person's own folders. `files.json` in the install root lists them (absolute paths only; FormPortal's own folder refused; `remove` never touches files). A scan walks each folder six levels deep, skips dot entries, follows no symlinks, stops at 5,000 projects, and keeps files whose extension a registry app claims (`extensions_from_registry`, so the command line and the window agree). In folders with versions on, a file whose size changed or whose modification time passed its last version's is copied into `history/[folder id of the path]/[time]-[sha prefix]` with an index in `history/index.json`; identical content is never stored twice, 20 versions are kept, files over 256 MB are not versioned. Reverting keeps the current file as a version first, checks the kept copy's SHA-256, writes through a hidden staging file and renames, then records the result. `open_file` picks the app by extension, the stable install first, and passes the path (macOS through `open -a`). `storage` sums the install root's parts and each folder. Versions are taken when FormPortal reads the folder, not on each save inside an app; the apps can hook their saves later.

## v0.36.0 · the family bridge {#bridge}

### agents.rs · form-app.json, app-mcp, three clients
- refers-to: src/agents.rs :: agent_surface, run_app_mcp, agent_clients, connect_agents, Launcher, server_name
- kind: decision
- logged: v0.36.0 · 2026-10-12

An app declares its MCP server in `form-app.json` (format `form-app`) anywhere up to four levels inside its install; `command` is relative to the file and must canonicalise inside the install folder, or the file is refused. Client entries never point into a version folder, which an update or a sweep deletes: they point at FormPortal's own program with `app-mcp [product] [--channel C]`, and `run_app_mcp` resolves the current install each time and runs the server with stdio inherited. The server name is the product id (`-beta` for a beta). Claude Code goes through `claude mcp add --scope user` (the name precedes `-e`, which is variadic and swallowed it in a first try); Codex is a `[mcp_servers.NAME]` table in `$CODEX_HOME/config.toml` replaced or appended by section; Cursor is `mcpServers.NAME` in `~/.cursor/mcp.json`. An entry is FormPortal's when it mentions `app-mcp`; any other server of the same name is reported `taken` and never touched. Both files are copied to `.bak-[time]` before a write. `FORMPORTAL_ROOT`, when set, is written into each entry, because clients do not start servers with the person's shell.
## v0.34.0 · organisations {#organisations}

### policy.rs · a system file, read every time
- refers-to: src/policy.rs :: Policy, load, system_path, allows, allows_extensions, unsigned, catalog_url, apply, locked
- kind: decision
- logged: v0.34.0 · 2026-10-12

The policy is a JSON file in a system folder (`/etc/formportal`, `/Library/Application Support/FormPortal`, `%ProgramData%\FormPortal`) that a standard account cannot write. It is read on every call rather than cached, so a pushed change applies without restarting anything, and there is no resident process to notify. `FORMPORTAL_POLICY` is consulted only when the system file is absent, so it can test a policy but never loosen a real one. `deny_unknown_fields` and the format check make a typo or a broken file an error, and every operation that loads the policy then refuses: failing closed is the point, a misspelt `aps` must not silently allow every app.

### Where it is enforced
- refers-to: src/portal.rs :: source, catalog, install, preferences, set_preferences, hold_if_older · src/extensions.rs :: extension_index, install_extension, install_extension_file
- kind: decision
- logged: v0.34.0 · 2026-10-12

In the core, so the window, the command line and MCP cannot disagree. `source` turns the asked address and developer setting into the effective ones and adds the policy's keys; `catalog` and `extension_index` use it (the index moves beside the locked catalogue). `install` checks apps and channels before downloading. `preferences` overlays the fixed fields on the person's own file; `set_preferences` keeps the file's own values for locked fields, so the overlay is never written back and lifting the policy restores the person's choices. `hold_if_older` does nothing while `auto_update` is fixed, since a per-app hold would be cleared anyway.

### mirror.rs · copy, check, rewrite, re-sign
- refers-to: src/mirror.rs :: Portal::mirror, MirrorOptions, MirrorReport, signing_key
- kind: decision
- logged: v0.34.0 · 2026-10-12

The mirror starts from a verified catalogue (`catalog`, so it obeys the same keys and policy), downloads each artifact with the ordinary `download` (resumable, SHA-256 checked, an existing good file reused) into `files/[product]/[channel]/[version]/`, and rewrites `url` and `origin` to the base address. Product ids and versions become folder names only if they are plain (letters, digits, `.-_+`). History is dropped unless asked for. The new body is signed with the seed from `FORMPORTAL_MIRROR_KEY`, since rewriting addresses invalidates formai.dev's signature; the result carries the public key for the policy's `catalog_keys`. Extension indexes are not mirrored yet.

## v0.32.0 · every installer kind {#installers}

### Unpack, never run an installer as administrator
- refers-to: src/installers.rs :: deb, rpm, dmg, msi, nsis · src/portal.rs :: install
- kind: decision
- logged: v0.32.0 · 2026-10-11

Each kind lands in the same per-user staging folder as a zip, so versions, rollback, the hash check and the open-app guard work unchanged. deb: `dpkg-deb -x` (no root, no maintainer scripts). rpm: `bsdtar -xf`, else `rpm2cpio | cpio -idm` (no scriptlets). dmg: `hdiutil attach -nobrowse -readonly` to a private mount point, `ditto` each .app into staging, always detach. msi: `msiexec /a` (an administrative image: files only, no registration, no administrator). nsis: the installer with `/S /D=[staging]`, which Tauri's NSIS installers honour in per-user mode. A missing tool is a sentence naming it, not a crash. Verified on Linux: a deb built with dpkg-deb and an rpm built with rpmbuild both installed, and the deb's `usr/bin/formcut` opened and showed in `open_processes`. dmg, msi and nsis are written to their tools' documented switches and were not run (no macOS or Windows here).

### Finding what to open in a package tree
- refers-to: src/portal.rs :: deep_find, launch_target
- kind: decision
- logged: v0.32.0 · 2026-10-11

deb and rpm trees put the program under `usr/bin` or `opt`, below where `find_target` looks. When it finds nothing, `deep_find` walks five levels for a .app (macOS), an .exe that is not an uninstaller (Windows) or an executable (Linux), preferring the product's own name, then any name containing it, then anything in a `bin` folder.

## v0.31.0 · extensions {#extensions}

### Packages land in FormPortal's folder; apps read enabled.json
- refers-to: src/extensions.rs :: place_package, ext_save
- kind: decision
- logged: v0.31.0 · 2026-10-11

formai_dev's plan said the hub hands a checked package to the app (its loader, command line or an inbox) and never writes into an app's internals. The hand-over is a file: each package is unpacked into `extensions/[product]/[id]/[version]/` under FormPortal's root, and `extensions/[product]/enabled.json` (format `formportal-enabled-extensions`) lists the enabled ones with path, kind, permissions and whether they run native code. An app reads that file at start and runs its own checks on each package; that is the app-side contract, written as an executor plan for formcut (sidecar `EXECUTOR_PLAN_formcut_extensions_v0.31.0.md`). Installing or toggling while an app is open takes effect at its next start.

### What is checked, in order
- refers-to: src/extensions.rs :: install_extension, install_extension_file, check_signature, read_manifest
- kind: decision
- logged: v0.31.0 · 2026-10-11

The index itself: signed by a trusted catalogue key, or refused unless `allow_unsigned`. A package from the index: SHA-256 against the index (in `download`), then its publisher signature (Ed25519 over the package bytes, with the key the index lists for that publisher) when present, refused when the package runs native code and has none unless `allow_unsigned`; then its manifest must agree with the index on id, product, version and native. A package by path: its manifest, then, when the index lists a file with the same SHA-256, that entry's signature; otherwise it is a sideload, and a native sideload needs `allow_unsigned`. ids and products must be plain names, so a manifest cannot point the unpack outside the folder; `unzip` already refuses paths that leave it. The schema does not say what a package signature covers; "the package's bytes" is this build's reading, to be written into the contract in formai_dev with Phase 9.

### Products beyond the schema's four
- refers-to: src/extensions.rs :: Entry::product, Manifest::product
- kind: warning-context
- logged: v0.31.0 · 2026-10-11

The extension and package schemas list four products (formcut, formvis, formwav, formai). The core reads `product` as text so packages for the other Form apps work; the schema enum is a Phase 9 contract change.

### download with no size
- refers-to: src/download.rs :: download
- kind: decision
- logged: v0.31.0 · 2026-10-11

`bytes` is optional in the extension index. With a size of 0 the download now always fetches (no resume) instead of skipping straight to a hash of an empty file.

## v0.30.0 · versions {#versions}

### History in the catalogue
- refers-to: src/lib.rs :: Release::history, Catalog::versions, Catalog::release_of, VersionView
- kind: decision
- logged: v0.30.0 · 2026-10-11

formai_dev 0.27.0 added `history` to a channel's release (earlier releases, newest first, each with artifacts and hashes); `serde(default)` reads catalogues without it. `versions` is the latest plus its history with this computer's artifact; `release_of` finds one version so any of them installs through the same `install`, hash check and all.

### keep_previous
- refers-to: src/prefs.rs :: keep_previous · src/portal.rs :: install
- kind: decision
- logged: v0.30.0 · 2026-10-11

On by default (rollback needs it). Off, an update records no previous and `sweep` deletes the replaced folder unless a copy of it is open; that is Creative Cloud's "remove older versions" choice.

### hold_if_older
- refers-to: src/portal.rs :: hold_if_older
- kind: decision
- logged: v0.30.0 · 2026-10-11

Installing an older version on purpose while automatic updates would replace it at the next open would undo the person's choice. After such an install, the surfaces call `hold_if_older`, which sets `per_app[product] = false` and says so. Only an explicit version triggers it; an ordinary install or update never does.

## v0.29.0 · updates {#updates}

### Preferences live in the install folder
- refers-to: src/prefs.rs :: Preferences, automatic
- kind: decision
- logged: v0.29.0 · 2026-10-11

`preferences.json` beside `installed.json`, so the window, the command line and the MCP server read one set. Defaults: automatic updates on (Creative Cloud's default, and FormPortal applies them only while it is open), betas off, only when the app is closed on, notices on. `per_app` overrides the global switch for one product; a beta still needs `auto_update_beta`. A missing file is the defaults; a broken one is a State error rather than silently reset.

### Only newer versions
- refers-to: src/lib.rs :: version_newer · src/portal.rs :: updates
- kind: decision
- logged: v0.29.0 · 2026-10-11

Numeric comparison of the dotted parts, a release ranking above its own pre-release, and pre-release labels compared as text (so `beta.10` sorts before `beta.9`; good enough until a catalogue carries such labels). The interface's old rule (offered differs from installed) would have offered an older catalogue's version as an update.

### apply_updates
- refers-to: src/portal.rs :: apply_updates
- kind: decision
- logged: v0.29.0 · 2026-10-11

One pass over `updates`, each through `install`, each failure recorded beside its row rather than stopping the pass. With `automatic_only` it skips what the preferences exclude and, under `only_when_closed`, apps with an open copy; the next time FormPortal opens, they are tried again.

## v0.28.0 · open apps {#open-apps}

### Finding open copies
- refers-to: src/process.rs :: under, all
- kind: decision
- logged: v0.28.0 · 2026-10-11

A process counts as an open copy of an install when its executable, its first two command-line arguments (Linux) or its working folder (Linux) lies inside that install's folder. The working folder catches apps started through a script that hands over to another program (`launch` starts every app with its own folder as the working folder). macOS reads `ps -axo pid=,args=` and Windows asks PowerShell for `Win32_Process` paths; both are written but run only on Linux so far. No dependency added.

### What the guard refuses and allows
- refers-to: src/portal.rs :: install, uninstall, sweep, running
- kind: decision
- logged: v0.28.0 · 2026-10-11

Each version installs into its own folder, so an update while the app is open never touches the open copy: the new folder becomes current, the open one stays as previous, and the new version opens next time. That is Creative Cloud's "updates apply when the app is not in use" without a background process to wait for the close. Refused with `CoreError::Running`: replacing the folder of the version that is open (reinstalling the same version) and removing a channel with any copy open. A previous version that is open is never pruned; `sweep` removes any version folder that is neither current nor previous once nothing runs from it, so a skipped prune is cleaned up on the next install.

### Catalogue keys in a file
- refers-to: catalog_keys.txt · src/signature.rs :: TRUSTED_KEYS, compiled_keys
- kind: decision
- logged: v0.28.0 · 2026-10-11

The trusted public keys are lines of `core/catalog_keys.txt`, compiled in with `include_str!` (comments start with `#`). Adding formai.dev's key is a one-line edit to a text file, reviewable in a diff, with no Rust touched. The pair is formai_dev's: `python -m app.signing` in `site/backend` prints the private seed for the site's `FORMAI_CATALOG_KEY` and the public key for this file. The file ships empty because the owner has not published a key; a key made in a build session would be a key nobody controls. Verified with a throwaway pair: a catalogue signed with it installed through `FORMAI_CATALOG_PUBKEY`, and through the file when the key was put in it for that run and taken out again; a catalogue signed with another key was refused.

### Invalid
- refers-to: src/error.rs :: CoreError::Invalid
- kind: explainer
- logged: v0.28.0 · 2026-10-11

A plain sentence for a wrong call (no product, an unknown channel). The command line used `Unavailable` for these in 0.27.0, which wrapped them in "the catalogue offers this computer nothing for", a wrong sentence.

## v0.27.0 · the move {#move}

### Names
- refers-to: Cargo.toml :: package.name · src/portal.rs :: Portal · src/lib.rs :: pub mod portal
- kind: decision
- logged: v0.27.0 · 2026-10-11

The crate is `formportal-core`, the module `portal`, the type `Portal` (was `formai-core`, `hub`, `Hub`), because FormHub is the family's GitHub alternative and "hub" for FormPortal reads as that app. What stays named formai on purpose: `CATALOG_FORMAT` "formai-catalog" and the extension index's "formai-extensions" (formai.dev publishes them, they are the contract), `FORMAI_CATALOG_PUBKEY` (the key the site signs with), and the error sentence "this is not a formai catalogue", which names that contract.

### Where installs live
- refers-to: src/portal.rs :: Portal::default_root
- kind: decision
- logged: v0.27.0 · 2026-10-11

macOS `~/Library/Application Support/dev.formai.portal`, Windows `%LOCALAPPDATA%\FormPortal`, Linux `$XDG_DATA_HOME/formportal` (was `dev.formai.hub` and `formai`). Nothing was released under the old names, so no migration is written. `FORMPORTAL_ROOT` overrides all three; the command line and the MCP server use it so an agent or a developer can work in a scratch folder without touching real installs.

---

## Org-navi-map

```
hub/
├── Cargo.toml              the workspace: core and src-tauri; release profile
├── Cargo.lock              committed, the hub is an application
└── core/
    ├── Cargo.toml          formai-core; serde, serde_json, sha2, ureq, zip
    ├── src/
    │   ├── lib.rs          the catalogue's types, parsing, the channel view; declares the modules
    │   ├── error.rs        CoreError: one sentence a person can read per failure
    │   ├── download.rs     which addresses are fetched; download with resume; SHA-256
    │   ├── state.rs        installed.json: what is installed, and the version kept behind it
    │   └── hub.rs          Hub: install, roll back, uninstall, find what to open, open it
    └── examples/
        ├── catalog.rs      prints what a catalogue file offers this computer
        └── install.rs      installs, opens, rolls back and removes from the command line
```

---

## Table of contents

- [../Cargo.toml](#workspace)
- [src/lib.rs](#lib)
- [examples/catalog.rs](#example)

---

## ../Cargo.toml {#workspace}

### hub/Cargo.toml · workspace
- refers-to: hub/Cargo.toml :: `[workspace]`, `[profile.release]`
- kind: explainer
- logged: v0.1.0 · 2026-10-04

One workspace so the core and the shell share a lockfile and a `target` folder. The release profile (`strip`, `lto`) is here because Cargo reads profiles only from the workspace root. `hub/cli` joins as a third member in Phase 6.

---

## src/lib.rs {#lib}

### src/lib.rs · no window, no interface, no network
- refers-to: src/lib.rs :: the whole crate
- kind: rationale
- logged: v0.1.0 · 2026-10-04

The crate depends on serde and serde_json and nothing else. It does not know Tauri exists. The shell and, later, the command-line tool are thin surfaces over it, which is what lets the hub's real work be run and checked with no window. Fetching, hashing, unpacking and launching arrive in Phase 4 as modules of this crate.

### src/lib.rs · the types
- refers-to: src/lib.rs :: Catalog, Product, Release, Artifact and the enums
- kind: warning-context
- logged: v0.1.0 · 2026-10-04

These mirror `catalog/schema/apps.schema.json` and `hub/frontend/src/engine/types.ts`; a field added to the schema is added in all three. Unknown fields are accepted on purpose (no `deny_unknown_fields`), so a catalogue that gains a field does not break hubs already installed. An unknown enum value (a new platform, a new artifact kind) does fail the parse; that is the price of typed values and the reason `format_version` exists.

### src/lib.rs · Catalog::from_json
- refers-to: src/lib.rs :: Catalog::from_json, CatalogError
- kind: explainer
- logged: v0.1.0 · 2026-10-04

Parses, then refuses a document whose `format` is not `formai-catalog` or whose `format_version` is not 1, each with a sentence a person can read. The signature check is not here yet: Phase 4 verifies the detached signature over the bytes before this function ever sees them.

### src/lib.rs · Catalog::view and Release::artifact_for
- refers-to: src/lib.rs :: Catalog::view, Release::artifact_for
- kind: explainer
- logged: v0.1.0 · 2026-10-04

The same rule as the interface's `Engine.view`, so the two cannot disagree once the bridge is real: prelaunch or unknown product is `Unreleased`; no release on the channel is `NoRelease`; an artifact for this operating system is `Available`, preferring the exact architecture and otherwise any for the system (an x86-64 build runs on an ARM Mac or ARM Windows under translation); otherwise `OtherPlatform`.

### src/lib.rs · Platform::current
- refers-to: src/lib.rs :: Platform::current
- kind: explainer
- logged: v0.1.0 · 2026-10-04

Decided at compile time from the target, which is the right answer for a native binary: an x86-64 build of the hub running under translation reports x86-64 and is offered x86-64 apps.

---

## src/download.rs {#download}

### src/download.rs · check_url
- refers-to: src/download.rs :: check_url, LOOPBACK
- kind: warning-context
- logged: v0.9.0 · 2026-10-05

Every address the core fetches passes through this. It allows `https://` and, for development, plain `http://` to `127.0.0.1` or `localhost` only. Anything else is refused before a connection is made, with the address in the message. The loopback exception exists so the core can be exercised against a local server; a catalogue in the wild is https by its schema.

### src/download.rs · download
- refers-to: src/download.rs :: download, sha256_file
- kind: explainer
- logged: v0.9.0 · 2026-10-05

Writes to `<name>.part` beside the final name. If a part file exists, it asks for the rest with a `Range` header; a server that answers 206 is appended to, one that answers anything else restarts the file. A finished file already present with the right hash is used as it is. When the bytes are all there the whole file is hashed and compared with the catalogue's SHA-256: a mismatch deletes the part file and returns `CoreError::Hash`, and nothing is ever unpacked from a file that failed. Only then is the part renamed to the final name. `progress` is called with bytes so far and the catalogue's size. TLS is rustls with the bundled web roots (`ureq`'s `tls` feature), so the core needs no system library to fetch.

Not here yet: a check of the catalogue's own signature. The hash protects a file against the catalogue; the signature will protect the catalogue against whoever serves it. That waits on the signing key's owner and lands with the site's half.

## src/lib.rs · ProductKind is text {#kind}

### src/lib.rs · ProductKind
- refers-to: src/lib.rs :: `pub type ProductKind = String`; Product.kind
- kind: warning-context
- logged: v0.19.0 · 2026-10-06

It was an enum of four (`Hub, Video, Image, Audio`). When the family grew to twenty apps with kinds such as `photo`, `vector` and `encoder`, one unknown kind made serde reject the whole catalogue, so the portal would have read nothing. Nothing in the core branches on the kind, so it is now plain text: a catalogue whose kinds this build has never seen still reads. The portal's own kind is `portal`, no longer `hub`, because FormHub is the GitHub alternative. Run: the catalog example read the twenty-product catalogue the site served from the registry.

## src/signature.rs {#signature}

### src/signature.rs · verify, trusted_keys
- refers-to: src/signature.rs :: verify, trusted_keys, TRUSTED_KEYS, KEY_ENV; src/hub.rs :: Hub::catalog; src/download.rs :: fetch_bytes
- kind: warning-context
- logged: v0.10.0 · 2026-10-05

The catalogue's signature is a detached ed25519 signature over the exact bytes the site serves, base64, at the catalogue's address with `.sig` added. `verify` accepts it if any trusted key verifies it. Trusted keys are the public keys compiled into `TRUSTED_KEYS` plus any in the `FORMAI_CATALOG_PUBKEY` environment variable (comma-separated), which exists for development. **`TRUSTED_KEYS` is empty**: the production key pair has not been made, so a build as it stands trusts nothing and refuses every signed catalogue unless the variable is set. When the owner makes the pair (`venv/bin/python -m app.signing` in `site/backend`), the public half goes in this array and the private half in the site's secrets.

`Hub::catalog(url, allow_unsigned)` is the one way a catalogue enters from an address: fetch the bytes, fetch the signature, verify, parse, and only then keep both in `<root>/catalog/`. If the site cannot be reached, the kept copy is read instead and verified the same way, so a copy changed on disk is refused like any other. The rules, each run for this version: signed and a trusted key verifies it, accepted; signed and no trusted key verifies it, refused; signed and no key is trusted at all, refused, even with `allow_unsigned` (that flag forgives a missing signature, never a failed one); not signed, refused unless `allow_unsigned`; unreachable with nothing kept, the connection error. `fetch_bytes` reads at most 16 MB.

A catalogue read from a file path (the example's `--catalog <file>`) is not checked: a file on the user's own disk is the user's own. Superseded for `Portal::catalog` and the indexes, see [install trust hardening](#trust-hardening); the example still reads its file unchecked.

## src/state.rs {#state}

### src/state.rs · State
- refers-to: src/state.rs :: State, Install, InstalledVersion
- kind: explainer
- logged: v0.9.0 · 2026-10-05

`installed.json` in the hub's folder. One `Install` per product and channel: the `current` version and, when there is one, the `previous` it replaced, each with its folder, the hash it was verified against and when. Saved by writing a sibling file and renaming it over the old one, so a crash mid-write leaves the last good record. A missing file is an empty record, not an error.

## src/hub.rs {#hub}

### src/hub.rs · where things go
- refers-to: src/hub.rs :: Hub::default_root, Hub::install
- kind: rationale
- logged: v0.9.0 · 2026-10-05

One per-user folder, no administrator: `~/Library/Application Support/dev.formai.hub` on macOS, `%LOCALAPPDATA%\formai` on Windows, `$XDG_DATA_HOME/formai` or `~/.local/share/formai` on Linux. Inside it: `apps/<product>/<channel>/<version>/`, `downloads/`, `installed.json`. The plan put the apps under `~/Applications/formai` on a Mac; here they sit under the hub's folder on all three so one rule covers every system, and a visible place in Applications is a packaging question for the shell.

### src/hub.rs · install
- refers-to: src/hub.rs :: Hub::install, unzip, place
- kind: explainer
- logged: v0.9.0 · 2026-10-05

Download and verify; unpack into `<version>.tmp`; rename to `<version>`; then record. The rename is what makes a version appear, so a failed unpack leaves nothing half-installed (the staging folder is removed). The version that was current becomes `previous` and its folder is kept; the version that was previous before that is deleted, so at most two versions of a product and channel are on disk. Installing the version already current replaces its folder and leaves `previous` alone. The downloaded archive is deleted after a successful install.

A `.zip` is unpacked; an `.AppImage` is copied and made executable. Every other kind returns `Unsupported` for now: a `.dmg` needs mounting, which is macOS only and unwritten; installers (`msi`, `nsis`, `deb`, `rpm`) need the system's own installer and are not a per-user unpack. formcut's release shape, the family template, is a zip on all three desktops, which is why the zip came first.

### src/hub.rs · unzip
- refers-to: src/hub.rs :: unzip
- kind: warning-context
- logged: v0.9.0 · 2026-10-05

Each entry's path comes from `enclosed_name`, which is `None` for a path that would leave the folder (`../x`, an absolute path); such an archive is refused whole. A symbolic link in the archive is recreated as a link (macOS app bundles contain them) unless its target is absolute, which is refused. Unix permissions stored in the archive are applied, which is what keeps an AppImage or a binary executable.

### src/hub.rs · find_target and launch
- refers-to: src/hub.rs :: find_target, Hub::launch_target, Hub::launch
- kind: explainer
- logged: v0.9.0 · 2026-10-05

What to open inside an installed version: on macOS the first `.app`; on Windows an `.exe` whose name contains the product's id, else the first `.exe`; on Linux the first `.AppImage`, else the first executable file. If the archive unpacked to a single folder that is not an `.app`, the search goes into it. `launch` starts it and returns its process id without waiting (on macOS through `open`). Nothing tracks the process afterwards; "is it running" is the shell's work in a later phase.

### src/hub.rs · rollback and uninstall
- refers-to: src/hub.rs :: Hub::rollback, Hub::uninstall
- kind: explainer
- logged: v0.9.0 · 2026-10-05

`rollback` swaps `current` and `previous`; nothing is downloaded and nothing deleted, so rolling back twice returns to where you were. `uninstall` removes the product's channel folder and its record. It does not touch the app's own data, which lives wherever the app keeps it.

## examples/install.rs {#install-example}

### examples/install.rs · what it is for
- refers-to: examples/install.rs :: run
- kind: explainer
- logged: v0.9.0 · 2026-10-05

The core driven from a terminal, with no window: `cargo run -p formai-core --example install -- formcut --catalog <file or address> [--channel beta] [--root <folder>]` installs what the catalogue offers this computer and prints the verified hash, where it went, what was kept and what it opens. `--launch`, `--rollback`, `--uninstall` and `--status` do the rest. It is how every function in `hub.rs` was run for this version. It is the seed of the command-line tool, which becomes its own crate later.

## examples/catalog.rs {#example}

### examples/catalog.rs · what it is for
- refers-to: examples/catalog.rs :: main
- kind: explainer
- logged: v0.1.0 · 2026-10-04

A developer's tool, not a test: `cargo run -p formai-core --example catalog -- ../catalog/fixtures/apps.json` from `hub/` prints, for each product and channel, what this computer would be offered. It is how the core is exercised with no window. Exit code 2 for no argument, 1 for an unreadable or refused file.
