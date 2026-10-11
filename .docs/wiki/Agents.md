# Agents

FormPortal's MCP server is `./formportal mcp` (stdio). It serves eight tools: `status`, `apps`, `app_info`, `installs`, `install`, `open`, `rollback`, `remove`.

| Client | In this repository | For your account |
| --- | --- | --- |
| Claude Code | `.mcp.json` | `./formportal agents install claude` |
| Codex | `.codex/config.toml` | `./formportal agents install codex` |
| Cursor | `.cursor/mcp.json` | `./formportal agents install cursor` |

The `formportal-harness` skill (`.claude/skills`, mirrored in `.agents/skills`) teaches the workflow: status and apps first, confirm before install, rollback or remove, check with installs. After changing a tool, run `./formportal agents sync`.

Without MCP: `./formportal cli [command]` prints the same JSON.
