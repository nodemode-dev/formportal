# formportal

FormPortal, the Form family's app portal (a Creative Cloud desktop app alternative): Rust engine (`formportal-core`), Tauri 2 shell, vanilla TypeScript and Vite interface, and a command line with an MCP server.

## Managing Form apps (natural language)

When the person wants Form apps listed, installed, updated, opened, rolled back or removed, or a beta beside the stable build, use the `formportal` MCP server's tools guided by the `formportal-harness` skill in `.agents/skills/formportal-harness` (`references/tools.md` lists every tool; `references/concepts.md` the ids, channels, folders and errors). Start with `status` and `apps`, confirm with the person before `install`, `rollback` or `remove`, and check with `installs` before reporting.

The MCP server is configured here in `.codex/config.toml` (Codex), `.cursor/mcp.json` (Cursor) and `.mcp.json` (Claude Code); all run `./formportal mcp`, which builds the server on first use. From any other folder, `./formportal agents install` sets Claude Code, Codex and Cursor up for the user account. Without MCP, `./formportal cli` has the same surface: `status`, `apps`, `info`, `installs`, `install`, `open`, `rollback`, `remove`.

## Changing FormPortal's code

Read `CLAUDE.md` and `.claude/skills/formportal-skillset/SKILL.md`, then the in-tree `HASHOUT_LOG.md` files (`core`, `cli`, `frontend`, `src-tauri`, `design`). After changing MCP tools, run `./formportal agents sync`.
