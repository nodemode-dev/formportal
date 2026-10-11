---
name: formportal-skillset
description: Use for any change to FormPortal's own code, the Form family's app portal and Creative Cloud desktop app alternative. Covers the Rust engine in core (catalogue types, signature check, download and SHA-256 verify, per-user install, rollback, uninstall, launch), the command line and MCP server in cli, the Tauri 2 shell in src-tauri (commands, deep links, single instance, bundling), the vanilla TypeScript interface in frontend (registry-built panes, sidebar, lineup, app pages, zero-flash rules), the vendored catalogue contract and design tokens, release packaging and CI, and the agent wiring (.mcp.json, Codex, Cursor, the formportal-harness skill and its sync). Trigger on FormPortal source files, a new tool, pane, command or catalogue field, an install or update bug, a desktop build, or ./formportal scripts. Not for using FormPortal to install apps (use formportal-harness).
---

# formportal-skillset

Route every change to FormPortal's code through this file. It maps the subsystems, states the rules that hold everywhere, and names the specialist.

## Subsystem map

| Subsystem | Root | Specialist |
| --- | --- | --- |
| Engine | `core/src/` (`lib.rs` types and catalogue, `portal.rs` install, rollback, uninstall, launch, `download.rs`, `signature.rs`, `state.rs`, `error.rs`) | `sub-skills/engine-core/SUB-SKILL.md` |
| Command line and MCP | `cli/src/` (`ops.rs` shared operations, `mcp.rs` the server, `main.rs` the commands), `setup/agents.py`, `.mcp.json`, `.codex/`, `.cursor/`, `.claude/skills/formportal-harness`, `.agents/skills` | `sub-skills/agent-substrate/SUB-SKILL.md` |
| Interface | `frontend/` (`vite.config.ts` builds every pane from `catalog/products.json`; `src/engine` state and commands, no DOM; `src/bridge` fixture or Tauri; `src/extensions` one module per behaviour) | `sub-skills/interface/SUB-SKILL.md` |
| Shell and release | `src-tauri/`, `setup/build_*`, `setup/package_release.py`, `.github/workflows/desktop.yml` | `sub-skills/shell-and-release/SUB-SKILL.md` |
| Contract and design | `catalog/` and `design/`, copies of formai_dev's | `sub-skills/contract-and-design/SUB-SKILL.md` |

## How the pieces depend

```text
formai.dev (formai_dev repo) publishes catalog/v1/apps.json + .sig  -- contract: catalog/schema
formportal-core (core/)            no window, no Tauri
  -> src-tauri (Tauri commands: platform, catalog, installs, install, open, rollback, remove, launch_link)
       -> frontend (bridge/tauri.ts) -> engine -> extensions -> DOM
  -> cli (formportal-cli): commands, and mcp (stdio JSON-RPC) -> Claude Code, Codex, Cursor
frontend in a browser: bridge/fixture.ts reads catalog/fixtures (./formportal is the window; npm run dev is the browser mode)
```

## Rules that hold everywhere

- **The core does the work.** Install, verify, rollback, launch and catalogue logic live in `core`; the shell, the CLI and the MCP server are thin surfaces over it and add no behaviour of their own. A capability the window has and the MCP server lacks (or the reverse) is a bug.
- **Never weaken trust.** Signature check on the catalogue and SHA-256 on every artifact before unpacking; only https or loopback fetched. No flag skips the hash.
- **Zero flash.** The interface's markup is complete at build time; script writes attributes and text on keyed nodes and never rebuilds a container. Every colour a token, every z-index a layer token, every icon an inline `currentColor` SVG from `design/icons.json`.
- **The contract is formai_dev's.** `catalog/` and `design/` are copies. Change them in formai_dev first, then copy here in a commit that names the formai_dev version.
- **Keep the agents in step.** After changing an MCP tool, run `./formportal agents sync` and commit `references/tools.md` and the `.agents/skills` mirror; `./formportal agents sync --check` fails while they drift.
- **Text hygiene.** No pictographs anywhere, no em dashes in Markdown, comment-free source with the reasoning in the in-tree `HASHOUT_LOG.md` files (`core`, `cli`, `frontend`, `src-tauri`, `design`).
- **Versions together.** `core/Cargo.toml`, `cli/Cargo.toml`, `src-tauri/Cargo.toml`, `Cargo.lock`, `src-tauri/tauri.conf.json`, `frontend/package.json` and both fields of its lockfile, and the README badge carry the same `v*.*.*`.
- **Commits** as `nodemode-ai <mackin@nodemode.ai>`, `type(scope): summary (x.y.z)`, the bump commit last.

## Run it

```bash
./formportal_oc_install     # checks Node, Rust and WebKitGTK; installs the interface; fetches crates
./formportal                # the window (interface on 3250, Tauri shell)
./formportal mcp            # the MCP server on stdio
./formportal cli apps       # the command line
cd frontend && npm run dev  # the interface alone in a browser, on the fixture catalogue
cargo run -p formportal-core --example catalog -- catalog/fixtures/apps.json
```
