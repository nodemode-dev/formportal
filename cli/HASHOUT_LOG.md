# HASHOUT_LOG · cli · formportal

Living log for `formportal-cli`, FormPortal's command line and MCP server. Source files stay comment-free; what they would have said lives here.

Current build version: v0.52.0
Last updated: 2026-10-25 · `org-package` (ops.rs org_package, main.rs dispatch and usage); `extensions` reports each package's support link and `shares` the portfolio (from the engine's views); shares, share, share-send, share-accept, share-pull, publish, unpublish and their tools; account, sign-in, sign-out, the account tool; preferences open_at_login; app-agents returns the manifest

## v0.52.0 · org-package {#org-package}

- `org-package --policy FILE --installer FILE --to DIR` calls `deploy::package` and returns the package (folder, platform, installer, how to run it, files, who manages it) and a `next` line. Like `mirror`, it is for an organisation's administrator, so it is a command and not an MCP tool; it needs no catalogue and no network.

## v0.48.0 · sharing {#share}

### ops.rs · shares, share, share_send, share_accept, share_pull, publish, unpublish · main.rs · positional · mcp.rs · five tools
- refers-to: src/ops.rs :: need_path and the seven functions · src/main.rs :: positional, the seven commands and their usage lines · src/mcp.rs :: shares (read-only), share, share_accept, share_pull, publish (with unpublish true)
- kind: decision
- logged: v0.48.0 · 2026-10-25

The command line takes the folder, invitation id, owner/repo or file as its first word (`positional` moves it from the generic `product` slot to the key the operation reads), and `--invite a,b`. The MCP server mirrors them, because a capability the window has and the server lacks is a bug in this repo: `shares` is read-only; `share`, `share_accept` and `publish` say to confirm first, since they put files on GitHub, invite people or make a file public; `share_pull` is marked destructive because it replaces local copies with the shared version. `share-send` has no tool of its own: `share` on a shared folder sends what changed.

## v0.47.0 · the GitHub sign-in {#github}

### ops.rs · account, sign_in, sign_out · mcp.rs · account
- refers-to: src/ops.rs :: account, sign_in, sign_out · src/main.rs :: account, sign-in, sign-out and their usage lines · src/mcp.rs :: the account tool · src/lib.rs :: recursion_limit
- kind: decision
- logged: v0.47.0 · 2026-10-24

`sign-in` prints the code and address on stderr through the `announce` callback, polls at GitHub's interval until signed in or the code's 15 minutes run out, and prints the account as JSON; `--share true` also asks for repository access. The MCP server only reads (`account`, read-only, so `mcp --read-only` keeps it): an agent can see whether the person is signed in, never start or end it, because entering a code on github.com is the person's step. The tools list grew past the `json!` macro's default recursion limit, so the crate sets `#![recursion_limit = "256"]`; nothing else changed in how the list is built.

## v0.46.0 · preferences open_at_login {#login}

### ops.rs · preferences
- refers-to: src/ops.rs :: preferences · src/mcp.rs :: preferences description and schema · src/main.rs :: usage
- kind: decision
- logged: v0.46.0 · 2026-10-24

`open_at_login` is set like the other switches (`--open-at-login true|false`, or the MCP field). The command line cannot write the login item itself, because it does not know where the window program is; the tool description says the window applies it when it next starts and that nothing runs in the background. Run `./formportal agents sync` after this change so `references/tools.md` follows.

## v0.45.0 · app-agents returns the manifest {#app-v2}

### ops.rs · app_agents
- refers-to: src/ops.rs :: app_agents · src/mcp.rs :: app_agents description
- kind: decision
- logged: v0.45.0 · 2026-10-24

`app_agents` adds `manifest` (the install's `form-app.json` as read: path, format_version, id, version, mcp, skills) and a note for each case: a launcher FormPortal can start, a server the install cannot start yet (v2 with `available` and no command), no server declared, no file. The tool description says so; `./formportal agents sync` regenerated `references/tools.md` and the `.agents` mirror (only the `app_agents` row changed).

## v0.44.0 · watch {#saves}

### A command, not a tool
- refers-to: src/ops.rs :: watch · src/main.rs :: watch
- kind: decision
- logged: v0.44.0 · 2026-10-12

`watch` loops `keep_saved` (interval from `--interval`, default 3 seconds; `--rounds` to stop) and prints each kept version as a JSON line. It is not an MCP tool because it never returns; an agent asks for a version with `file_versions` and `action: save` instead.

## v0.43.0 · fonts reports updates {#font-updates}

### updates in the fonts result
- refers-to: src/ops.rs :: fonts · src/mcp.rs :: fonts description
- kind: explainer
- logged: v0.43.0 · 2026-10-12

`fonts` adds `updates` when the index was read; the tool's description says how to apply them. No new tool: `font_install` already does it.

## v0.42.0 · repair, later, open-url {#repair}

### One tool, three commands, update gains later
- refers-to: src/ops.rs :: repair, web_file, update (later) · src/mcp.rs :: repair · src/main.rs :: repair, later, open-url
- kind: decision
- logged: v0.42.0 · 2026-10-12

`repair` reads the catalogue when it can (a cached copy counts) and reports its error otherwise, so a repair without the network still deletes leftovers. It is destructive in its annotations, so the reading server does not offer it. `update` with product and `later` sets or clears the put-off flag before any catalogue is read, so it works offline. `open-url` is a command only: an agent fetching files from the web into the person's folders should go through the person, who clicks the link.

## v0.40.0 · tutorials, a reading-only server, ask {#learn}

### A library as well as a binary
- refers-to: src/lib.rs · src/main.rs
- kind: decision
- logged: v0.40.0 · 2026-10-12

`mcp` and `ops` moved behind `src/lib.rs` so the desktop shell can serve the same tools (`FormPortal mcp`) without shipping the command line beside it; `main.rs` imports them from `formportal_cli`.

### learn, learn_progress, mcp --read-only, ask
- refers-to: src/ops.rs :: learn_source, tutorials, learn, learn_progress, ask · src/mcp.rs :: read_only_tools, serve_with, answer
- kind: decision
- logged: v0.40.0 · 2026-10-12

`learn` merges the bundled tutorials with the index (index entries with product `formportal` or a bundled id are dropped) and adds `done_steps` from 1 and `finished`. `learn_progress` takes the id (or the first positional), a step from 1 (a number or, from the command line, a string), `done`, or `reset`. `read_only_tools` reads the `readOnlyHint` annotations, so the reading server follows the tool list rather than a second list: thirteen tools today (files is not among them, because reading folders keeps versions). In reading mode `tools/list` lists only those and `tools/call` refuses the rest with a sentence that names FormPortal as the place to do it. `ask` is a command, not a tool: an agent asking an agent through FormPortal would only loop. Verified: the refused install, the thirteen tools, and two real Claude Code answers (a tutorial's next step; a request to install answered with where the button is).

## v0.39.0 · stock media and templates {#media}

### Three tools, four commands
- refers-to: src/ops.rs :: media, media_save, media_remove, media_source · src/mcp.rs · src/main.rs
- kind: decision
- logged: v0.39.0 · 2026-10-12

`media` reads the index (from `media_source`, `FORMPORTAL_MEDIA`, or `media.json` beside the catalogue) and the Library, marking each item saved or not and giving its credit line. `media_save` saves, and with `use` also copies a template into a projects folder and opens it; on the command line `media-save` and `template-use` are the two forms. `media_remove` is destructive in its annotations and leaves copies in projects folders alone. Thirty tools in all.

## v0.38.0 · fonts {#fonts}

### Three tools, four commands
- refers-to: src/ops.rs :: fonts, font_install, font_remove, fonts_source · src/mcp.rs · src/main.rs
- kind: decision
- logged: v0.38.0 · 2026-10-12

`fonts` reads the index (from `--fonts-source`, `FORMPORTAL_FONTS`, or `fonts.json` beside the catalogue) and what is installed, marking each style. `font_install` takes an index id (and style) or a path with `rights_confirmed`; on the command line `font-install` and `font-add` are the two forms. `font_remove` is destructive in its annotations.

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
