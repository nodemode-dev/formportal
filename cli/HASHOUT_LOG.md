# HASHOUT_LOG · cli · formportal

Living log for `formportal-cli`, FormPortal's command line and MCP server. Source files stay comment-free; what they would have said lives here.

Current build version: v0.64.1
Last updated: 2026-11-11 · v0.64.1 the unknown-tool error names no tool count (#unknown-tool); 2026-11-10 · v0.64.0 the README counts 40 MCP tools with demo (#tool-count); 2026-11-09 · v0.64.0 the demo tool opens formai://demo/<id> (#demo); 2026-11-10 · v0.63.7 ./formportal rebuilds when catalog/schedule.json changes (#schedule-rebuild); 2026-11-10 · v0.63.7 formportal.bat cli and agents pass the rest of the line as typed (#bat-args); 2026-11-10 · v0.63.6 formportal.bat exits with the real errorlevel (mcp, cli, agents labels); 2026-11-09 · v0.63.5 install reports a translated build; status shows the machine's architecture; 2026-11-07 · v0.63.1 the extension index is form.ext-registry's, verified, source, blocked and turned_off in extensions; 2026-11-07 · v0.63.0 extension notes say live pickup, product enums of the thirteen hosts, app, api and homepage in extensions; 2026-11-06 · v0.58.0 on_the_way matches formai.studio, the supporter code masked, progress clippy; 2026-11-06 · v0.56.0 apps lists only released apps, on_the_way; 2026-11-06 · the FormPortal update link and the MCP instructions name formai.studio and GitHub releases; 2026-11-02 · the default catalogue pinned to the download store; 2026-10-26 · a closed output pipe ends the command quietly (main.rs emit, FB-021); 2026-10-25 · install and update pass the release (install_from); the `shares` and `extensions` tool descriptions name `portfolio` and `support` (mcp.rs; `agents sync` regenerated tools.md); `org-package` (ops.rs org_package, main.rs dispatch and usage); `extensions` reports each package's support link and `shares` the portfolio (from the engine's views); shares, share, share-send, share-accept, share-pull, publish, unpublish and their tools; account, sign-in, sign-out, the account tool; preferences open_at_login; app-agents returns the manifest

## v0.64.1 · the unknown-tool error {#unknown-tool}
- refers-to: src/mcp.rs :: call
- kind: fix
- logged: v0.64.1 · 2026-11-11

`call` refused an unknown tool with "tools/list has the thirty-three tools", a count left from an older release while `tools()` lists 40. The message now says "tools/list names every tool", so it cannot go stale again; tools/list is the one place the count is true. No test counts the tools, so none had to derive it. Found by QA on 2026-11-11. Review follow-up: `tests/mcp_unknown_tool.rs` runs `formportal-cli mcp`, calls `no_such_tool` and checks the error names the tool, says "tools/list names every tool" and holds no digit or number word; it fails on the 0.64.0 message.

## v0.64.0 · the README's tool count {#tool-count}
- refers-to: ../README.md :: the "MCP tools" cell · src/mcp.rs :: tools
- kind: fix
- logged: v0.64.0 · 2026-11-10

The `demo` tool made `tools()` list 40 tools, but the README's feature table still said "39 MCP tools", so anyone reading it was told one tool fewer than `./formportal mcp` serves. Found while merging main into this release. The cell now says 40; the names after it stay a sample. `catalog/apps/formportal.json` says 39 too, but `catalog/` is a copy of formai_dev's contract and changes there first. Checked by counting the `name` entries in `tools()` (40) against the tool table in `references/tools.md` (40 rows).

## v0.64.0 · the demo tool {#demo}
- refers-to: src/ops.rs :: DEMOS, demo · src/mcp.rs :: tools (demo), call
- kind: decision
- logged: v0.64.0 · 2026-11-09

The window opens FormPortal's three demos in place (frontend/HASHOUT_LOG.md#in-app-demos), so agents get the same: `demo` with no id lists them (id, title, what it shows, its `formai://demo/<id>` link); with an id it asks the operating system to open that link (`open`, `cmd /C start`, `xdg-open`), which starts or focuses FormPortal through its deep link and single instance and shows the demo over the window. The tool changes nothing of the person's: it is not read-only only because it opens a window, so a `--read-only` server does not list it. Unknown ids are refused with the three names.

## v0.63.7 · the launcher rebuilds for schedule.json {#schedule-rebuild}

### formportal · mcp, cli freshness check
- refers-to: formportal :: the `find` list of the mcp|cli branch · cli/src/ops.rs :: SCHEDULE
- kind: fix
- logged: v0.63.7 · 2026-11-10

`ops.rs` embeds `catalog/schedule.json` with `include_str!`, but the launcher's rebuild check listed only `cli`, `core`, `catalog/products.json` and `Cargo.lock`, so after the release groups changed `./formportal mcp` and `./formportal cli` kept running the old binary and `apps` reported the old `on_the_way` groups and dates. The file is now in the `find` list. Checked with `bash -n` and by running the `find` line against a reference file older than a freshly touched `catalog/schedule.json`: the new list names it, the old one printed nothing.

## v0.63.7 · formportal.bat passes the arguments as typed {#bat-args}

### formportal.bat · :cli, :agents
- refers-to: formportal.bat :: :cli, :agents
- kind: fix
- logged: v0.63.7 · 2026-11-10

`:cli` ran the command line with `%2 %3 ... %9` and `:agents` with `%2 %3 %4`. cmd splits positional parameters at commas, semicolons and equals signs as well as spaces and stops at `%9`, so `--platforms macos,windows` arrived as two words (only macOS was mirrored), a URL with `=` in its query was cut, and the documented mirror example lost `--channels stable --history` past the eighth argument, all while the command reported success. Both labels now copy `%*` into `FP_ARGS`, drop everything up to and including the first word with `call set "FP_ARGS=%%FP_ARGS:*%1=%%"` (the `call` gives the second expansion the substring replacement needs, and `%1` is the first word as typed; the match ignores case), and pass `%FP_ARGS%`, so the program receives the rest of the line unchanged and splits it on spaces only. CRLF line endings kept. Not run on Windows; traced from cmd's documented parameter and substring rules (`help set`, `help call`).

## v0.63.6 · formportal.bat reports the real exit code {#bat-exit}

### formportal.bat · mcp, cli, agents labels
- refers-to: formportal.bat :: :mcp, :cli, :agents, the main flow
- kind: fix
- logged: v0.63.6 · 2026-11-10

The `mcp`, `cli` and `agents` branches were parenthesised blocks ending in `exit /b %errorlevel%`. cmd expands `%errorlevel%` when it parses the whole block, before any command in it runs, so each branch exited with the value from before the block (0, from `where cargo`) and a failing command line or MCP run reported success. The `if` lines now `goto` labels placed after the main flow, where each line is parsed when it runs and `%errorlevel%` is current; the arguments are unchanged. The main flow ends with `exit /b %status%` so it cannot fall into the labels; the code of `cargo run` is kept in `status` first because the `taskkill` after it would overwrite it. Found by tracing the parse-time expansion (Raymond Chen, The Old New Thing, 2006-08-23; gitlab-runner MR 1260), not run on Windows.

## v0.63.5 · install says when a build runs translated {#mac-arch}

### ops.rs · install
- refers-to: cli/src/ops.rs :: install · ../core/HASHOUT_LOG.md#mac-arch
- kind: fix
- logged: v0.63.5 · 2026-11-09

`install` returns `translated`: null, or a sentence when the build installed is not the machine's architecture ("... has no Apple silicon build, so its Intel build was installed; it runs under Rosetta", or the x64 and emulation wording elsewhere). The platform in `status` is now the machine's, not FormPortal's compile target.


## v0.63.1 · the registry's index {#registry}

### ops.rs · mcp.rs · main.rs · ext_source, ext_index, extensions
- refers-to: cli/src/ops.rs :: ext_source, ext_index, extensions · cli/src/mcp.rs :: extensions, extension_install, extension_enable descriptions · cli/src/main.rs :: USAGE · ../core/src/extensions.rs :: default_index
- kind: decision
- logged: v0.63.1 · 2026-11-07

The index address is `extensions_source`, else `FORMPORTAL_EXTENSIONS`, else form.ext-registry's index (`default_index`); it is no longer derived from the catalogue address. `ext_index` passes the core's refusal through as it is (it was wrapped in `Unavailable`, whose text begins "the catalogue offers this computer nothing for"). `extensions` adds `verified`, `source` and `blocked` per package and `blocked` and `turned_off` at the top, and reads the installed list again after the index, since reading the index may turn a blocked extension off. The tool descriptions name the registry, its keys and the three refusals; `./formportal agents sync` regenerated `tools.md` (the CLI built in debug with the libdbus pkg-config shim and copied to `target/release/formportal-cli`).

## v0.63.0 · extensions for thirteen apps, picked up live {#ext-api1}

### ops.rs · mcp.rs · main.rs · extensions, extension_install, extension_remove, extension_enable
- refers-to: cli/src/ops.rs :: EXT_PRODUCT, extensions, extension_install, extension_remove, extension_enable · cli/src/mcp.rs :: ext_product, the four extension tools · cli/src/main.rs :: USAGE · core/src/extensions.rs :: HOSTS, extension_note
- kind: decision
- logged: v0.63.0 · 2026-11-07

`extensions` adds each package's `app` (its name), `api` and `homepage`; installed records carry `description`, `api` and `contributes`. The `note` after install, remove and enable is `Portal::extension_note` (live, or from the next start for an app older than its extension host release) instead of "the next time it starts". `extension_remove` and `extension_enable` take `product` as an enum of the thirteen contract ids (from `HOSTS`), described as the contract's (formdeck and formportal, not formslide and formai); the missing-product message lists them, and so does the usage text. After this change `./formportal agents sync` must regenerate the harness `references/tools.md`.

## v0.61.0 · no formcompiler app {#compiler}

### ops.rs · mcp.rs · apps
- refers-to: cli/src/ops.rs :: apps · catalog/products.json
- kind: fix
- logged: v0.61.0 · 2026-11-06

The `apps` tool counts what the catalogue lists; with formcompiler removed from products.json it reports 34 products. No change to cli code was needed: nothing there named formcompiler or its repository delivery.

## v0.58.0 · on_the_way matches formai.studio {#live}

### ops.rs · on_the_way, preferences · mcp.rs · apps, preferences
- refers-to: cli/src/ops.rs :: on_the_way, apps, preferences · cli/src/mcp.rs :: apps and preferences descriptions · ../core/src/site.rs :: Portal::upcoming, Portal::supporter
- kind: decision
- logged: v0.58.0 · 2026-11-06

`on_the_way` keeps FormPortal's own groups and, when formai.studio answered `/api/upcoming`, adds `{"opens": null, "apps": undated + supporters}` for apps whose date is still to come. When the stored supporter code is confirmed (the core's cache, rechecked daily; a network failure keeps the last answer), every group also carries `names`: dated groups take the site's tiles with the same `at`, in order, as many as the group's count; the date-to-come group takes the tiles without a date. Without a supporter there is no `names` key. `preferences` reports `supporter_code` only as true or false, never the code, so an agent cannot read it. `FORMPORTAL_SITE=off` disables the site calls. Run 2026-11-06 against a fake site on loopback (no code: groups 10, 3, 2, 2 and `{"opens": null, "apps": 6}`; with the code: the same plus `names` ["FormAlpha","FormBeta"], ["FormGamma","FormDelta"] and the six undated and codename tiles; a second `apps` made no request; with the site down the last answer was kept). The apps description changed, so `./formportal agents sync` regenerated `references/tools.md` and the mirror; `--check` is in step.

### main.rs · progress
- refers-to: cli/src/main.rs :: the install progress closure
- kind: refactor
- logged: v0.58.0 · 2026-11-06

`checked_div` and `is_multiple_of(10)` in the progress line (clippy); the same steps print. `cargo clippy --workspace --all-targets` now reports nothing.

## v0.56.0 · only released apps, as on formai.studio {#live}

### ops.rs · apps, on_the_way · mcp.rs · apps
- refers-to: cli/src/ops.rs :: apps, on_the_way, SCHEDULE, ALIAS · cli/src/mcp.rs :: apps description · ../frontend/src/extensions/live/index.ts
- kind: decision
- logged: v0.56.0 · 2026-11-06

The owner: 34 Form apps exist, 13 are public with a release schedule, and the rest stay hidden as they are on formai.studio. formai.studio's gate (formai_dev `site/backend/app/gate.py`, `release.py` `states`) hides every product that is not live, and live means a published release exists (in formcompiler's catalogue, or a public repository's non-draft release with files); the schedule only dates the countdown tiles, and a supporter sees the hidden apps' names, never their builds. `apps` now follows the same rule when a catalogue was read: a product is listed when the catalogue (with each app's GitHub releases, `core/HASHOUT_LOG.md#releases`) offers it a release on stable or beta, or it is installed here; FormPortal itself stays listed. `on_the_way` gives each schedule group still holding unreleased apps as its opening time and a count, never the names. Without a catalogue the registry is listed as before, with the reason. Run 2026-11-06 through the loopback relay: 8 rows (FormPortal, FormVFX, Form.md, FormSlide, FormPDF, formMCP, formskills, FormTray) and on_the_way 5, 3, 2 and 2; with `FORMPORTAL_RELEASES=off`, 3 rows and 10, 3, 2, 2. The tool description changed, so `./formportal agents sync` regenerated `references/tools.md` and the mirror. After review: `info` answers "not a released Form app" for an id that is neither released nor installed (it returned the registry entry before), and `apps` without a catalogue lists installed apps only. `info formcut` is refused, `info formpdf` answers 0.57.3.

## v0.55.0 · formai.studio and GitHub releases {#releases}

### ops.rs · updates, mcp.rs · INSTRUCTIONS
- refers-to: cli/src/ops.rs :: updates (formportal_update.get) · cli/src/mcp.rs :: INSTRUCTIONS · ../core/src/releases.rs :: discover
- kind: fix
- logged: v0.55.0 · 2026-11-06

`formportal_update.get` was `https://formai.dev/download/`; formai.dev now serves a different product, so it is `https://formai.studio/download/`. The server's instructions said the catalogue is published at formai.dev; they say the signed catalogue on dl.formai.studio and the newer releases each app publishes on GitHub, which every command now reads through the engine (`core/HASHOUT_LOG.md#releases`). No tool changed, so `references/tools.md` is unchanged. Verified on 2026-11-06 through a loopback relay to github.com and dl.formai.studio: `apps` offered 9 products where it offered 2 (FormPortal 0.54.3, FormVFX 0.52.8, Form.md 0.48.0, FormSlide 0.30.7, FormPDF 0.57.3, formMCP 0.7.8, formskills 0.7.7, FormTray 0.10.2, and the catalogue's own), a second `apps` within 15 minutes made 3 requests and took 0.7 s, `install formtray` fetched the 83 MB AppImage from the GitHub release and verified its SHA-256, and `FORMPORTAL_RELEASES=off` gave back the catalogue's three.

## v0.53.5 · the default catalogue pinned to the download store {#store}

- refers-to: cli/src/ops.rs :: DEFAULT_SOURCE · frontend/src/bridge/tauri.ts :: DEFAULT_CATALOG · cli/tests/store_addresses.rs
- kind: decision
- logged: v0.53.5 · 2026-11-02

`DEFAULT_SOURCE` was already `https://dl.formai.studio/catalog/apps.json`, the address formcompiler's feed copies the signed catalogue to, with `apps.json.sig` beside it (`<source>.sig`). formMCP and formskills read formcompiler's private release page until their own fixes; nothing here pinned FormPortal's address. `store_addresses.rs` now checks the default, its signature address, and that the window's `DEFAULT_CATALOG` is the same string. `FORMPORTAL_CATALOG` and the window's catalogue setting still override it.

## unreleased · an agent cannot turn the signature check off {#unsigned}

- refers-to: cli/src/mcp.rs :: without_unsigned, call, props · cli/src/ops.rs :: load
- kind: fix
- logged: unreleased · 2026-10-29

Every catalogue tool took an `allow_unsigned` argument, so an agent (or text an agent read) could accept an unsigned catalogue on its own. `call` now removes the argument before any operation runs, and the schema no longer offers it; the person's `FORMPORTAL_ALLOW_UNSIGNED` and the command line's `--allow-unsigned` still work. `load` hands a file path to `Portal::catalog`, which checks its `.sig`, instead of parsing it unchecked. `agents sync` regenerated tools.md. Test: cli/tests/closed_pipe.rs, an_agent_cannot_turn_off_the_catalogue_signature_check.

## v0.53.3 · a closed output pipe ends the command quietly {#fb021}

- refers-to: cli/src/main.rs :: emit, main (watch, help, the result)
- kind: fix
- logged: v0.53.3 · 2026-10-26

Ledger FB-021: `println!` panics with "failed printing to stdout: Broken pipe" when the reader has gone (`formportal-cli apps | head -1`), so the process exited 101 although the action had finished, and a script or agent piping the JSON saw a crash. Rust ignores SIGPIPE, so the write returns an error instead of killing the process; `emit` writes and flushes the locked stdout and, on any error, exits 0, the way a Unix tool ends when nobody is reading. 0 and not 141 because the work was done and the person or script closed the reader on purpose. The action has already run before anything is printed, so exiting at that point loses nothing. stderr is left as it is: progress and errors go there and a closed stderr is not this bug. `mcp` is not touched, since its stdout is the protocol and a closed peer ends the server through its own read loop. Tested in `cli/tests/closed_pipe.rs` with the read end closed before the program starts, which reproduces it every time (before: exit 101 and the panic on stderr; after: exit 0, stderr empty).

## v0.53.0 · install and update pass the release {#q9}

- `install` and `update` call `install_from` with the catalogue they already loaded, so the release's `form-app.json` reaches the install. `app_agents`' note for a server with no launcher names `agents.mcp.binary` as well as `command`; a binary that cannot be found comes back as the command's error. Carried from the v0.46.0-mcp branch; these regions were unchanged on the main line.

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

### src/ops.rs · ALIAS drops formbench
- refers-to: src/ops.rs :: ALIAS
- kind: explainer
- logged: v0.61.0 · 2026-11-06

The signed catalogue now calls the product formbench, the same as the schedule, so the formbench to formranker alias is gone. Three aliases remain: formportal to formai, formdeck to formslide, formskill to formskills.
