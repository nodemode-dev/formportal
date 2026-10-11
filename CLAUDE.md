# formportal

FormPortal, the Form family's app portal (a Creative Cloud desktop app alternative): it installs, opens, updates, rolls back and removes the Form apps from the signed catalogue formai.dev publishes. Rust engine (`formportal-core`), Tauri 2 shell, vanilla TypeScript and Vite interface, and a command line with an MCP server.

## Two kinds of work

**Installing or managing Form apps with FormPortal** (list the family, install or update an app, a beta beside stable, roll back, remove): use the `formportal` MCP server (`.mcp.json` runs `./formportal mcp`) with the `formportal-harness` skill in `.claude/skills/formportal-harness`. Start with `status` and `apps`; confirm with the person before `install`, `rollback` or `remove`; check with `installs`.

**Changing FormPortal's code**: route through `.claude/skills/formportal-skillset/SKILL.md` (subsystem map, rules, specialists) and read the living logs `core/HASHOUT_LOG.md`, `cli/HASHOUT_LOG.md`, `frontend/HASHOUT_LOG.md`, `src-tauri/HASHOUT_LOG.md` and `design/HASHOUT_LOG.md` before editing.

## Layout notes

- `catalog/` and `design/` are copies of formai_dev's contract and tokens; change them there first.
- `assets/` holds repository art (the README capture), not app runtime assets; the interface's own files are in `frontend/public/`.
- Planning documents (DEV_PLAN, BUILD_NOTES, the root HASHOUT_LOG, the parity research) ship in the planning sidecar zip, not in this tree.

## Skills

- `formportal-harness` · using FormPortal through MCP or the command line; route through its `harness-director` for broad jobs.
- `formportal-skillset` · changing FormPortal's code; the orchestrator, with specialists for the engine, the agent substrate, the interface, the shell and release, and the contract.

Always route work through the orchestrator skill for the kind of work first, because it maps the subsystems and loads the right references.

## After changing an MCP tool

Run `./formportal agents sync` so `.claude/skills/formportal-harness/references/tools.md` and the `.agents/skills` mirror follow; `./formportal agents sync --check` fails while they drift.
