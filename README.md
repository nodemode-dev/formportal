<h1 align="center">FormPortal</h1>

<p align="center"><b>One place to install, open, update and roll back every Form app. The Form family's Creative Cloud alternative: no account, no background process, GPL-3.0.</b></p>

<p align="center">
  <img src="https://img.shields.io/badge/version-v0.39.0-eef0f4" alt="version v0.39.0" />
  <img src="https://img.shields.io/badge/Rust-stable-B7410E" alt="Rust stable" />
  <img src="https://img.shields.io/badge/Tauri-2-24C8DB" alt="Tauri 2" />
  <img src="https://img.shields.io/badge/Node.js-20.19%2B-339933?logo=nodedotjs&logoColor=white" alt="Node.js 20.19+" />
  <img src="https://img.shields.io/badge/MCP-Claude%20Code%20%C2%B7%20Codex%20%C2%B7%20Cursor-555555" alt="MCP for Claude Code, Codex and Cursor" />
  <img src="https://img.shields.io/badge/license-GPL--3.0-555555" alt="license GPL 3.0" />
</p>

<p align="center"><img src="assets/formportal_linux.png" alt="FormPortal on Linux" width="760" /></p>

FormPortal reads the signed catalogue formai.dev publishes and offers this computer the right build of every Form app: FormCut, FormVis, FormLit, FormDesign, FormPath, FormVFX, FormEncoder, FormWav, Form.md, FormDAM, FormSlide, FormHub and the apps on the way. It checks each download's SHA-256 before unpacking, installs per user with no administrator (zip, AppImage, deb, rpm, dmg, msi or NSIS), keeps the version it replaced so one step back is always there, and keeps a beta beside the stable build. The same engine runs the window, a command line and an MCP server, so Claude Code, Codex and Cursor can manage the family too.

**Stack:** Rust (`formportal-core`, `formportal-cli`) · Tauri 2 shell · vanilla TypeScript + Vite interface · **Scale:** 30 MCP tools, 20 apps from one registry, one shared tokens file, zero runtime dependencies in the interface

## Highlights

- **One engine, three surfaces.** `core/` does catalogue, verify, install, rollback, remove and launch with no window in it; `src-tauri/` (the window) and `cli/` (commands and MCP) are thin layers over it, so an agent and a person see the same installs
- **Trust you can check.** An Ed25519-signed catalogue, a SHA-256 per file refused before unpacking on mismatch, https or this computer only. No flag skips the hash
- **Rollback, betas side by side.** Every update keeps the version it replaced; each channel (stable, beta, nightly) is its own install
- **Nothing resident.** No account, no login item, no tray process. FormPortal checks when it is open and stops when you close it
- **Agent ready.** `./formportal mcp` serves `status`, `apps`, `app_info`, `installs`, `install`, `versions`, `updates`, `update`, `preferences`, `extensions`, `extension_install`, `extension_remove`, `extension_enable`, `policy`, `app_agents`, `connect_agents`, `files`, `folders`, `open_file`, `file_versions`, `storage`, `fonts`, `font_install`, `font_remove`, `media`, `media_save`, `media_remove`, `open`, `rollback`, `remove`; `.mcp.json`, `.codex/config.toml` and `.cursor/mcp.json` are wired, and the `formportal-harness` skill teaches the workflow. A Form app that ships its own MCP server is connected to Claude Code, Codex and Cursor in one step, and stays connected across its updates (see `.docs/wiki/Agents.md`)
- **Laid out like the Creative Cloud app, without the marketing.** A two-level sidebar (Home, Apps with Updates and Beta, Extensions, Learn), search, a notifications bell and Preferences in the top bar, Home built around the apps you have, Apps as a list with one action each and a More menu, and Preferences as a dialog with a switch per app
- **Files on your own disk.** Pick folders; FormPortal lists your Form projects, opens each in the right app, keeps earlier versions you can go back to, and shows what it uses on disk. No cloud
- **Fonts without an account.** Open-licensed families from a signed index, or your own TTF and OTF files, installed for you alone with no administrator
- **Stock and templates with their credits.** Open-licensed images, video, audio and Form app templates from a signed index, saved to your Library with the credit line beside each file; a template opens in its app in one step. No paid stock, no generative AI
- **Built from the registry.** Every app's row, card, page and switch is written at build time from `catalog/products.json`, so the first frame is the final layout (layout shift 0 under 4x CPU throttling)

## Quick Start

### Requirements

Node 20.19 or newer, Rust stable, git. On Linux the window needs WebKitGTK 4.1 (`libwebkit2gtk-4.1-dev librsvg2-dev libssl-dev pkg-config build-essential`).

### macOS & Linux

```shell
chmod +x formportal formportal_oc_install
./formportal_oc_install   # checks Node, Rust and WebKitGTK; installs the interface; fetches the crates
./formportal              # opens the FormPortal window; closing it stops everything it started
```

The first boot compiles the shell, which takes a few minutes. Until formai.dev publishes its signed catalogue and key, run formai_dev's site locally and set the catalogue address in Settings to `http://127.0.0.1:8240/catalog/v1/apps.json` with the Developer box ticked.

### Windows

```shell
formportal_oc_install.bat
formportal.bat
```

### Agents and the command line

```shell
./formportal mcp                     # the MCP server on stdio (built on first use)
./formportal agents install          # add it and the skill to your Claude Code, Codex and Cursor
./formportal cli apps                # the family and what this computer is offered
./formportal cli install formcut --channel beta
```

In this repository the three clients are already configured. See `AGENTS.md`.

### The interface alone, in a browser

```shell
cd frontend && npm run dev           # http://localhost:3250, on the sample catalogue
```

### Ports

| Service | URL | Notes |
|---|---|---|
| Interface | http://localhost:3250 | Vite dev server, `server.host` false; the shell's debug build loads it |
| Interface preview | http://localhost:3251 | `npm run preview` |

The MCP server uses stdio, no port.

## Configuration

| Variable | Purpose |
|---|---|
| `FORMPORTAL_ROOT` | Install folder (default: `~/Library/Application Support/dev.formai.portal`, `%LOCALAPPDATA%\FormPortal`, `~/.local/share/formportal`) |
| `FORMPORTAL_CATALOG` | Default catalogue for the command line and MCP server |
| `FORMPORTAL_ALLOW_UNSIGNED` | `1` accepts an unsigned catalogue (development only) |
| `FORMAI_CATALOG_PUBKEY` | Extra trusted catalogue keys, base64, comma separated |
| `FORMPORTAL_POLICY` | A policy file to try when no system policy exists (organisations put theirs in `/etc/formportal`, `/Library/Application Support/FormPortal` or `%ProgramData%\FormPortal`; see the Organisations wiki page) |
| `FORMPORTAL_MIRROR_KEY` | Base64 Ed25519 seed that `formportal cli mirror` signs a mirrored catalogue with |

### The catalogue key

FormPortal installs only from a catalogue signed with a key it trusts. Trusted public keys are the lines of `core/catalog_keys.txt`, compiled in. To make the pair, run `python -m app.signing` in formai_dev's `site/backend`: the private seed goes into the site's `FORMAI_CATALOG_KEY` and nowhere else, the public key goes on a line of `core/catalog_keys.txt`. The file ships empty until formai.dev's key is published.

## Repository

| Path | What it is |
|---|---|
| `core/` | `formportal-core`, the engine |
| `cli/` | `formportal-cli`, commands and the MCP server |
| `src-tauri/` | the Tauri 2 shell |
| `frontend/` | the interface |
| `catalog/`, `design/` | copies of formai_dev's catalogue contract and design tokens |
| `setup/` | build, packaging and agent scripts |
| `.claude/skills/` | `formportal-harness` (using FormPortal) and `formportal-skillset` (changing it) |
| `.docs/` | wiki pages and the branching model |

## Docs

Wiki pages live in `.docs/wiki` (Home, Getting Started, Architecture, Agents, Releasing). Contributors: `.docs/BRANCHING.md`. Agents: `CLAUDE.md`, `AGENTS.md`.

## License

FormPortal is licensed under the GNU General Public License v3.0 (`LICENSE`, SPDX `GPL-3.0-only`), as ComfyUI, formpromo, formMCP and formskills are. Copyright 2026 NodeAgentc, Inc. See `LICENSE`, `NOTICE` and `LICENSES.md`.
