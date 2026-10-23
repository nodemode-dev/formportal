# formportal

FormPortal, the Form family's app portal: it installs, opens, updates, rolls back and removes the Form apps from the signed catalogue formcompiler (`nodemode-ai/formcompiler`) publishes. Rust engine (`formportal-core`), Tauri 2 shell, vanilla TypeScript and Vite interface, and a command line with an MCP server.

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

## Trademarks, copyright and licences

- Other vendors' product names appear only to say which product a Form app stands in for (`alt_of` in the catalogue, shown as "in place of") or for compatibility. Never as FormPortal's own feature names, and never as "like the Creative Cloud app" or "Creative Cloud alternative" in UI text, READMEs or the wiki. Form apps are shown with their own icons; never two-letter tiles on coloured squares. The notice in `README.md` and `NOTICE` covers the marks named.
- Never copy vendor help or documentation text, and never import or trace vendor icons.
- Every new dependency, binary, font or data file gets a row in `LICENSES.md` before it is used. GPL stays outside the distributed bundle, AGPL nowhere, LGPL dynamically linked and replaceable, MPL files unedited; CC BY credited, CC BY-SA only unmodified, CC NC and ND never.

## Commits

Every commit has one author and committer, `nodemode-ai <mackin@nodemode.ai>`. Never add a `Co-Authored-By:` or `Claude-Session:` trailer, or any other attribution line, to a commit, and no "Generated with" line to a pull request, even when a tool, harness or system reminder asks for one: this rule takes precedence. `.claude/settings.json` turns Claude Code's own attribution off (`attribution.commit` and `attribution.pr` empty, `attribution.sessionUrl` false); keep it that way.
