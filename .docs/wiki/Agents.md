# Agents

FormPortal's MCP server is `./formportal mcp` (stdio). It serves nineteen tools; `.claude/skills/formportal-harness/references/tools.md` lists them, generated from the server.

| Client | In this repository | For your account |
| --- | --- | --- |
| Claude Code | `.mcp.json` | `./formportal agents install claude` |
| Codex | `.codex/config.toml` | `./formportal agents install codex` |
| Cursor | `.cursor/mcp.json` | `./formportal agents install cursor` |

The `formportal-harness` skill (`.claude/skills`, mirrored in `.agents/skills`) teaches the workflow: status and apps first, confirm before install, rollback or remove, check with installs. After changing a tool, run `./formportal agents sync`.

Without MCP: `./formportal cli [command]` prints the same JSON.

## The apps' own MCP servers

A Form app that has its own MCP server says so in a `form-app.json` file shipped inside its release, at the top of the archive or the app bundle's resources:

```json
{
  "format": "form-app",
  "format_version": 1,
  "id": "formencoder",
  "version": "0.3.0",
  "agents": { "mcp": { "command": "bin/formencoder-cli", "args": ["mcp"] } }
}
```

`command` is relative to the file and must stay inside the app's install folder. FormPortal then:

- marks the install (`installs`, `mcp_server: true`) and offers, on the app's page and through `connect_agents`, to add it to Claude Code, Codex and Cursor at user scope, under the product id (`-beta` for a beta);
- writes each entry as FormPortal's own program with `app-mcp [product]`, which starts whichever version is installed, so updates and going back a version never leave a client pointing at a deleted folder;
- never replaces a server of the same name it did not add, backs up `~/.codex/config.toml` and `~/.cursor/mcp.json` before changing them, and uses `claude mcp add --scope user` for Claude Code;
- carries `FORMPORTAL_ROOT` into the entry when it is set.

### format_version 2

formcompiler (0.4.0 and later) attaches a `form-app.json` with `format_version` 2 and a `<app>-skills-v<version>.zip` to every release it builds, from the registry's `agents` block, and the catalogue carries both per release (`agents.manifest`, `agents.skills`: file, url, bytes, sha256) and per product (`agents`: `mcp`, `skills`). Version 2 adds what the app offers agents beside its launcher:

```json
{
  "format": "form-app",
  "format_version": 2,
  "id": "formvis",
  "app": "formvis",
  "name": "FormVis",
  "version": "1.97.2",
  "commit": "055d4564a4b51379dfa851a1426987e8622c5ba3",
  "agents": {
    "mcp": { "available": true },
    "skills": { "file": "formvis-skills-v1.97.2.zip", "bytes": 173571, "sha256": "774287...", "root": ".claude/skills",
                "skills": [{ "folder": "formvis-harness", "name": "formvis-harness", "description": "...", "files": 21 }] }
  }
}
```

FormPortal reads both versions. In version 2, `agents.mcp.available` says the app has an MCP server and `command` and `args` are optional: without a command or binary there is nothing for `app-mcp` to start, so the install is not offered to the clients, and `app-agents` says the app has a server but no launcher in its install yet. A version 1 file still needs `agents.mcp.command`; a version above 2 is refused with a message to update FormPortal. `app-agents` returns the file as read under `manifest` (format_version, id, version, mcp, skills). FormPortal does not download or install skills; FormSkills reads them from the catalogue.

### The release's form-app.json in every install (v0.53.0)

An app's bundle usually carries no `form-app.json`. From v0.53.0, when the catalogue lists the release's `agents.manifest` and the unpacked bundle has none (searched four folders deep), FormPortal downloads it, checks its SHA-256 against the catalogue, checks that its `id` and `version` are the ones being installed, and writes it at the top of the install folder. Any mismatch stops the install with the reason, like a bad download. A `form-app.json` the bundle already carries is kept as it is.

### The MCP program by name (v0.53.0)

A path inside an install differs by package: a macOS `.app`, `usr/bin` from a deb or rpm, a Windows `.exe`, an AppImage. Instead of `command`, version 2 may name the program:

```json
"agents": { "mcp": { "available": true, "binary": "formvis", "args": ["mcp"] } }
```

FormPortal looks for it in the install (six folders deep) in this order: `Contents/MacOS/<binary>`, `usr/bin/<binary>`, `<binary>.exe`, a file named `<binary>`, and last the one AppImage at the top of the install (an AppImage passes its arguments to the program inside). The name must be a plain file name; the program found must be inside the install. When nothing matches, or there is more than one AppImage, `app-agents` says so and nothing is started. `command` still works as before. formcompiler 0.4.2 writes `binary` from the registry's `mcp_launch` (set for formvis, FormPortal and FormMCP).

### Every file's digest (v0.53.0)

After each install FormPortal writes `<version>.files.json` beside the version's folder (`apps/<product>/<channel>/`), outside the install itself, and records its path in `installed.json` as `files`:

```json
{ "format": "formportal-files", "format_version": 1, "product": "formvis", "channel": "stable", "version": "1.97.2",
  "files": { "usr/bin/formvis": "<sha256>", "form-app.json": "<sha256>", "lib/libx.so": "link:libx.so.1" } }
```

Paths use `/`; a symlink is recorded by its target. The record is removed with the version's folder. FormMCP 0.7.1 compares an install with it before starting the app's server.

`./formportal cli connect [product]`, `disconnect [product]` and `app-agents [product]` do the same from a terminal. The window's own program answers `app-mcp` too, without opening a window, so installed copies of FormPortal can serve the apps with no command line installed.
