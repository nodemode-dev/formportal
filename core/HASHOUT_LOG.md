# HASHOUT_LOG · core · formportal

Living log for `formportal-core`, FormPortal's engine in Rust (named `formai-core` and kept in formai_dev's `hub/core` up to formai_dev 0.26.0; entries below that date use the old names and paths). Source files stay comment-free; what they would have said lives here.

Current build version: v0.38.0
Last updated: 2026-10-12 · fonts

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

A catalogue read from a file path (the example's `--catalog <file>`) is not checked: a file on the user's own disk is the user's own.

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
