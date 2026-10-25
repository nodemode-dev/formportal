---
name: form-family-bridge
description: FormPortal's place among the Form apps. Use when, after installing a Form app, the work continues inside that app through its own MCP server (FormEncoder, FormCut, FormVis and others), when the person follows an Open in FormPortal link from formai.dev, or asks how FormPortal relates to formai.dev, FormHub, formMCP or formskills.
---

# form-family-bridge

## FormPortal installs, the apps do the work

FormPortal's tools stop at install, open, update, rollback and remove. The work inside an app goes through that app's own agent surface. An app that ships an MCP server declares it in a `form-app.json` inside its release (`{"format": "form-app", "agents": {"mcp": {"command": "bin/...", "args": [...]}}}`); `installs` marks such an install with `mcp_server: true`. After installing one:

1. `app_agents {product}`: the server name (the product id, `-beta` for a beta) and, for Claude Code, Codex and Cursor, `connected`, `not-connected`, `taken` (another server already uses that name; FormPortal leaves it alone) or `no-client`.
2. With the person's go-ahead, `connect_agents {product}` (or with `clients` to pick). Each entry starts `formportal app-mcp [product]`, which runs whichever version is installed, so later updates and rollbacks need nothing more. Config files are backed up before they change.
3. Tell the person to restart the client, or reload its MCP servers, to see the app's tools. `connect_agents {product, disconnect: true}` takes it out again.

An app without a `form-app.json` has no server FormPortal can find; say so rather than guessing a command. Do not drive an app's files or folders by hand from FormPortal's install folder.

## Links from formai.dev

formai.dev links into FormPortal with `formai://app/[id]` (that app's own page), `formai://apps`, `formai://updates`, `formai://beta`, `formai://extensions`, `formai://settings`. They open the window; agents use the tools instead.

## Names that are easy to confuse

- **FormPortal** is this app (Creative Cloud's place). Its catalogue id is `formai`.
- **FormHub** is the family's GitHub alternative, a different app.
- **formMCP** (`formmcp`) is the one MCP connection to the whole family. Added once to Claude Code, Codex or Cursor, its `suggest_app` tool names the app that fits a task and `family_apps` lists every app with whether it is installed; for an installed app, `app_tools` loads that app's own tools on demand and `call_app` runs one, starting installs through `formportal app-mcp [product]`. formMCP never installs: when it says an app is missing, the person installs it here. Connecting one app directly with `connect_agents` still works and suits someone who uses only that app.
- **formskills** (`formskills`) shows every Form app's released skills to read, download and keep personal edited copies of. Skills are not formMCP's or FormPortal's job; point the person there.
- **FormRanker** (`formranker`) is the family's parity, testing and feedback app: it keeps the Parity Tracker's rows, grades and test runs and has its own MCP server. Questions about how a Form app compares with what it stands in for go there, not to FormPortal.
- **formai.dev** is the website that publishes the catalogue FormPortal reads.
