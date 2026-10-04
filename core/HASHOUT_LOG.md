# HASHOUT_LOG · hub/core · formai_dev

Living log for `formai-core`, the hub's engine in Rust. Source files stay comment-free; what they would have said lives here.

Current build version: v0.1.0
Last updated: 2026-10-04 · scaffold

---

## Org-navi-map

```
hub/
├── Cargo.toml              the workspace: core and src-tauri; release profile
├── Cargo.lock              committed, the hub is an application
└── core/
    ├── Cargo.toml          formai-core; serde and serde_json only
    ├── src/lib.rs          the catalogue's types, parsing, and the channel view
    └── examples/catalog.rs prints what a catalogue file offers this computer
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

## examples/catalog.rs {#example}

### examples/catalog.rs · what it is for
- refers-to: examples/catalog.rs :: main
- kind: explainer
- logged: v0.1.0 · 2026-10-04

A developer's tool, not a test: `cargo run -p formai-core --example catalog -- ../catalog/fixtures/apps.json` from `hub/` prints, for each product and channel, what this computer would be offered. It is how the core is exercised with no window. Exit code 2 for no argument, 1 for an unreadable or refused file.
