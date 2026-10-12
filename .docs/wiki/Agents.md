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

`./formportal cli connect [product]`, `disconnect [product]` and `app-agents [product]` do the same from a terminal. The window's own program answers `app-mcp` too, without opening a window, so installed copies of FormPortal can serve the apps with no command line installed.
