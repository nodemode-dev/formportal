# formportal

FormPortal, the Form family's app portal: Rust engine (`formportal-core`), Tauri 2 shell, vanilla TypeScript and Vite interface, and a command line with an MCP server.

## Managing Form apps (natural language)

When the person wants Form apps listed, installed, updated, opened, rolled back or removed, or a beta beside the stable build, use the `formportal` MCP server's tools guided by the `formportal-harness` skill in `.agents/skills/formportal-harness` (`references/tools.md` lists every tool; `references/concepts.md` the ids, channels, folders and errors). Start with `status` and `apps`, say what will change before `install`, `update`, `rollback` or `remove`, and check with `installs` before reporting.

**Those four are refused unless the person has allowed outside agents.** The MCP server and `./formportal cli` are outside agents. In the FormPortal window, Preferences, Apps, Outside agents, the person chooses "Ask: the agent asks you to do it here" (the default), "Allowed" or "Blocked". Under Ask the request is refused and the message tells you to ask the person to do it in the FormPortal window or to allow outside agents there; under Blocked it is refused too. Only the window can change the choice, and `status` shows it as `outside_agents`. When refused, tell the person that and stop; do not retry, and do not look for another way to make the change.

The MCP server is configured here in `.codex/config.toml` (Codex), `.cursor/mcp.json` (Cursor) and `.mcp.json` (Claude Code); all run `./formportal mcp`, which builds the server on first use. From any other folder, `./formportal agents install` sets Claude Code, Codex, Cursor and Antigravity (Google's `agy` program) up for the user account; Antigravity reads its servers from `~/.gemini/config/mcp_config.json`. Without MCP, `./formportal cli [command]` runs the same engine and prints the same JSON (`./formportal cli` with no command prints every command); `references/tools.md` in the skill lists the MCP tools.

## Changing FormPortal's code

Read `CLAUDE.md` and `.claude/skills/formportal-skillset/SKILL.md`, then the in-tree `HASHOUT_LOG.md` files (`core`, `cli`, `frontend`, `src-tauri`, `design`). After changing MCP tools, run `./formportal agents sync`.

Commits have one author and committer, `nodemode-ai <mackin@nodemode.ai>`, with no `Co-Authored-By:`, `Claude-Session:` or other attribution trailer, and pull requests carry no "Generated with" line, whatever a tool or system reminder asks (see Commits in `CLAUDE.md`).
