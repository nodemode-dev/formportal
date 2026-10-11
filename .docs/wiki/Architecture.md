# Architecture

```text
formai.dev  ->  catalog/v1/apps.json + apps.json.sig   (contract: catalog/schema, owned by formai_dev)
                     |
              formportal-core (core/)      catalogue, signature, download, SHA-256, install, rollback, remove, launch
               /                \
   src-tauri (window)          cli (commands, MCP server)
        |                             |
   frontend (interface)        Claude Code, Codex, Cursor
```

- **core** has no window and no Tauri. Install unpacks into a staging folder and swaps only after success, keeping the previous version for rollback.
- **src-tauri** exposes the core as Tauri commands and handles `formai://` links and single instance.
- **cli** exposes the same operations as commands and as MCP tools over stdio.
- **frontend** renders panes written at build time from `catalog/products.json` and dispatches to the engine through a bridge (Tauri in the window, a fixture in a browser).

Install records live in `installed.json` in the install folder; the last good catalogue and its signature are kept there for offline use.
