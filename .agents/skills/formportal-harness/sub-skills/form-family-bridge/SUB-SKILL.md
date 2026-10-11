---
name: form-family-bridge
description: FormPortal's place among the Form apps. Use when, after installing a Form app, the work continues inside that app through its own MCP server (FormEncoder, FormCut, FormVis and others), when the person follows an Open in FormPortal link from formai.dev, or asks how FormPortal relates to formai.dev, FormHub or FormMCP.
---

# form-family-bridge

## FormPortal installs, the apps do the work

FormPortal's tools stop at install, open, update, rollback and remove. The work inside an app goes through that app's own agent surface. FormEncoder, for example, ships its own MCP server (`formencoder mcp`) and its own harness skill (`formencoder-harness`). After installing an app:

1. `open` it if the person wants the window.
2. Say which MCP server and skill the app brings, if its repository has them, and that the person's client needs it added (each app's `agents install` does that).

Do not drive an app's files or folders by hand from FormPortal's install folder.

## Links from formai.dev

formai.dev links into FormPortal with `formai://app/[id]` (the apps screen with that app shown), `formai://apps`, `formai://updates`, `formai://beta`, `formai://extensions`, `formai://settings`. They open the window; agents use the tools instead.

## Names that are easy to confuse

- **FormPortal** is this app (Creative Cloud's place). Its catalogue id is `formai`.
- **FormHub** is the family's GitHub alternative, a different app.
- **FormMCP** is the planned connector for the whole family; until it exists, each app's own MCP server is the way in.
- **formai.dev** is the website that publishes the catalogue FormPortal reads.
