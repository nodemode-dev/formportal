# Agents

FormPortal's MCP server is `./formportal mcp` (stdio). `.claude/skills/formportal-harness/references/tools.md` lists its tools, and `agents/manifest.json` names them (and which only read), both generated from the server by `./formportal agents sync`.

| Client | In this repository | For your account |
| --- | --- | --- |
| Claude Code | `.mcp.json` | `./formportal agents install claude` |
| Codex | `.codex/config.toml` | `./formportal agents install codex` |
| Cursor | `.cursor/mcp.json` | `./formportal agents install cursor` |
| Antigravity (Google's `agy` program) | not set up here | `./formportal agents install antigravity` (writes `~/.gemini/config/mcp_config.json`) |

The `formportal-harness` skill (`.claude/skills`, mirrored in `.agents/skills`) teaches the workflow: status and apps first, say what will change, check with installs, and when an install, update, rollback or remove is refused because of the choice for outside agents (below), tell the person to do it in the window or allow it there. After changing a tool, run `./formportal agents sync`.

Without MCP: `./formportal cli [command]` prints the same JSON.

## Outside agents

An agent that is not the FormPortal window is an outside agent: the MCP server is one, and so is `./formportal cli`. What an outside agent may do when it asks to install, update, roll back or remove an app is the person's choice, made only in the window, Preferences, Apps, Outside agents:

| Choice (as the window words it) | What happens to the request |
| --- | --- |
| Ask: the agent asks you to do it here (the default) | Refused. The message says FormPortal asks before an outside agent installs, updates, rolls back or removes an app, and only its window can answer, and tells the agent to ask the person to do it in the FormPortal window or to allow outside agents there. |
| Allowed | It goes ahead. |
| Blocked | Refused every time. The message says outside agents are blocked and that the person can change that in the window. |

- Only `install`, `update`, `rollback` and `remove` follow the choice, and `later` on the command line, which is an update. `status`, `apps`, `app_info`, `installs`, `open` and every other tool work under every choice.
- `status` reports the choice as `outside_agents` (`outside_agents` is what applies, `stored` what was saved, `seal` whether the saved choice is intact). No tool and no command changes it.
- The saved choice is `agent-access.json` in FormPortal's folder, sealed with a key held in the system keychain. A file that was edited by hand, has no valid seal or is not readable reads as Ask, and the window says the saved permission was changed outside FormPortal. With no system keychain, a saved Allowed is asked as Ask (Blocked stays Blocked), and the window says so.
- Someone scripting FormPortal with `./formportal cli install` or `update` needs Allowed set first; there is no flag or environment variable instead. Without it, make the change in the window.
- An organisation's policy is separate: a policy refusal names the policy and is reported as it is.

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

- marks the install (`installs`, `mcp_server: true`) and offers, on the app's page and through `connect_agents`, to add it to Claude Code, Codex, Cursor and Antigravity at user scope, under the product id (`-beta` for a beta);
- writes each entry as FormPortal's own program with `app-mcp [product]`, which starts whichever version is installed, so updates and going back a version never leave a client pointing at a deleted folder;
- never replaces a server of the same name it did not add, backs up `~/.codex/config.toml`, `~/.cursor/mcp.json` and `~/.gemini/config/mcp_config.json` (Antigravity) before changing them, and uses `claude mcp add --scope user` for Claude Code;
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

With no product, the same three commands are about FormPortal's own MCP server: `app-agents` says for each client whether its program was found on this computer and whether the entry `formportal` is connected, `connect` adds that entry (the running program with the argument `mcp`) and `disconnect` takes it out. An entry of that name that something else wrote is left alone and reported; the entry `./formportal agents install` wrote counts as FormPortal's own. The MCP tools cannot do this: `connect_agents` needs a product.
