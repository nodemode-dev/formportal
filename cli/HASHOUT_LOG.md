# HASHOUT_LOG · cli · formportal

Living log for `formportal-cli`, FormPortal's command line and MCP server. Source files stay comment-free; what they would have said lives here.

Current build version: v0.37.0
Last updated: 2026-10-12 · Files; twenty-four tools

## v0.37.0 · Files {#files}

### Five tools, seven commands
- refers-to: src/ops.rs :: files, folders, open_file, file_versions, storage, project_extensions · src/mcp.rs · src/main.rs
- kind: decision
- logged: v0.37.0 · 2026-10-12

`files` is marked as not read-only because reading keeps versions of changed files. `folders` lists, adds (the suggested folder when no path) and removes; `file_versions` lists, saves and reverts. Paths on the command line come positionally (`open-file PATH`) or with `--path`. The extension map is the core's `extensions_from_registry` over the compiled-in registry.

## v0.36.0 · app-agents, connect, app-mcp {#bridge}

### Two tools, four commands
- refers-to: src/ops.rs :: app_agents, connect_agents, installs · src/mcp.rs · src/main.rs :: app-mcp
- kind: decision
- logged: v0.36.0 · 2026-10-12

`app_agents` (read) and `connect_agents` (write, `disconnect` to undo) are the eighteenth and nineteenth tools; `installs` gains `mcp_server`. On the command line: `app-agents`, `connect`, `disconnect`, and `app-mcp`, which is what the clients start: it prints nothing of its own on stdout, hands stdio to the app's server and exits with its code, before any JSON handling. The launcher written into the clients is this program's own path (`current_exe`).

---

## Org-navi-map

```
cli/
├── Cargo.toml       formportal-cli; formportal-core, serde, serde_json, nothing else
└── src/
    ├── main.rs      the commands; argument parsing; progress on stderr
    ├── ops.rs       every operation once, returning JSON; Ctx (portal, source, allow_unsigned)
    └── mcp.rs       stdio JSON-RPC 2.0 MCP server; the tool schemas
```

## v0.34.0 · policy and mirror {#organisations}

### policy, status.managed, and refused preferences
- refers-to: src/ops.rs :: policy, status, preferences, load · src/mcp.rs :: the policy tool
- kind: decision
- logged: v0.34.0 · 2026-10-12

`policy` (command and read-only tool, the seventeenth) prints what is in force, or the system path where a policy would be. `status` carries a short `managed` summary. `preferences` refuses outright when asked to change a locked field, naming it, rather than saving and silently ignoring it. `load` asks the core for the effective source first, so a locked catalogue also wins over a local file passed as `--source`.

### mirror is a command, not a tool
- refers-to: src/main.rs :: mirror · src/ops.rs :: mirror
- kind: decision
- logged: v0.34.0 · 2026-10-12

Mirroring writes a whole folder and downloads every release; it is an administrator's job run on a server, so it stays on the command line and out of the agent tool list. Its result ends with the exact policy lines to deploy (`catalog`, `catalog_keys`), or says the mirror is unsigned and what to set.

## v0.27.0 · why a second surface {#why}

### One engine, three surfaces
- refers-to: src/ops.rs
- kind: decision
- logged: v0.27.0 · 2026-10-11

formai_dev's plan named `hub/cli/` as a second thin surface over the core (Phase 6). It exists now because agents need it: Claude Code, Codex and Cursor reach FormPortal through `./formportal mcp`. `ops.rs` calls `formportal-core` only; it never re-implements install, verify or rollback, so the window and the agents cannot behave differently.

### No service, no consent dialog
- refers-to: src/mcp.rs :: tools, INSTRUCTIONS
- kind: decision
- logged: v0.27.0 · 2026-10-11

FormEncoder's MCP goes through its running engine and asks the person in its window. FormPortal has no resident process (a stated promise), so the MCP server runs the core in its own process. Confirmation is the client's tool approval plus the instructions and annotations: `install` is marked as changing the computer, `rollback` and `remove` as destructive, and the server's instructions and the harness skill tell the agent to ask first. A window-side consent prompt would need the window running; it is a plan item, not a gap hidden here.

### stdout is the protocol
- refers-to: src/mcp.rs :: serve · ../formportal :: mcp
- kind: warning-context
- logged: v0.27.0 · 2026-10-11

Only JSON-RPC lines go to stdout. The dispatcher builds with `cargo build -q` to stderr, and install progress in the CLI goes to stderr. The `install` tool passes a no-op progress callback.

### The registry inside the binary
- refers-to: src/ops.rs :: REGISTRY, apps
- kind: decision
- logged: v0.27.0 · 2026-10-11

`catalog/products.json` is compiled in with `include_str!`, so `apps` names every Form app with its status even when the catalogue is unreachable or refused; the catalogue's error is returned beside it as `catalog_error` rather than failing the call.

### Local catalogues
- refers-to: src/ops.rs :: load
- kind: explainer
- logged: v0.27.0 · 2026-10-11

A `source` that is not an http(s) address is read as a file and parsed without a signature, like the core's install example; it is for fixtures and development. Remote sources go through `Portal::catalog`, signature and all, with `allow_unsigned` only when asked.

### v0.31.0 · extension tools
- refers-to: src/ops.rs :: extensions, extension_install, extension_remove, extension_enable, ext_source
- kind: decision
- logged: v0.31.0 · 2026-10-11

Sixteen tools. The index address is `extensions_source`, else `FORMPORTAL_EXTENSIONS`, else `extensions.json` beside the catalogue address (formai.dev serves both under `/catalog/v1/`). `extensions` merges the index with what is installed (installed version, enabled, update waiting) and lists sideloads. Verified with a local index of four packages and two loose files: an unsigned index refused; a plain package installed; a signed native package installed with its publisher recorded; with a signed index and the developer setting off, an unsigned native package refused; a manifest that disagrees with the index refused; a tampered package signature refused; a sideloaded look installed as sideload; a sideloaded native package refused; turning one off removed it from enabled.json; remove deleted its folder.

### v0.30.0 · versions, install with version
- refers-to: src/ops.rs :: versions, install · src/mcp.rs :: tools
- kind: decision
- logged: v0.30.0 · 2026-10-11

Twelve tools. `versions` lists the catalogue's versions with what is installed and kept; `install` takes `version` for any of them, and its result carries `automatic_updates_held` when installing an older version turned that app's automatic updates off. Verified against a three-release local catalogue: install 1.0.0, update to 1.2.0 (1.0.0 kept), install 1.1.0 (1.2.0 kept), a missing version refused, keep_previous off left no previous and removed the folder, rollback then refused; installing 1.0.0 held automatic updates and `update --automatic-only` did nothing.

### v0.29.0 · updates, update, preferences
- refers-to: src/ops.rs :: updates, update, preferences · src/mcp.rs :: tools
- kind: decision
- logged: v0.29.0 · 2026-10-11

Eleven tools. `update` without a product applies everything waiting (an explicit request, so the preferences do not filter it) unless `automatic_only` asks for exactly what the window does on open. `updates` adds `formportal_update` when the catalogue's `formai` product is newer than this build, pointing at formai.dev's download page: FormPortal does not replace its own running binary from the catalogue; its own signed updater is still to come. `preferences` changes only the keys given; `per_app` null removes an override. The command line turns `true` and `false` arguments into booleans.

### When ./formportal mcp rebuilds
- refers-to: ../formportal :: case mcp|cli
- kind: warning-context
- logged: v0.27.0 · 2026-10-11

The dispatcher rebuilds the release binary when anything under `cli/` or `core/` (sources, Cargo.toml), `catalog/products.json` (compiled in) or `Cargo.lock` is newer than it. The first version looked only at `.rs` files, so after the 0.27.0 bump the server still reported 0.26.0; caught by asking it for `serverInfo` after the bump.

### Verified
- refers-to: src/mcp.rs
- kind: explainer
- logged: v0.27.0 · 2026-10-11

Driven through `./formportal mcp` against a two-release local catalogue served on 127.0.0.1:8899 with a scratch `FORMPORTAL_ROOT`: initialize, tools/list (eight), install 1.0.0, open (the installed script ran), install 1.1.0, rollback (current 1.0.0), installs, remove, an unknown tool (isError). From the CLI: a catalogue with a wrong SHA-256 was refused before unpacking, and an unsigned remote catalogue without `--allow-unsigned` was refused.
