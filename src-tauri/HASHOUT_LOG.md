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
