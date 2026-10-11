---
name: interface
description: Changes to FormPortal's TypeScript interface. Use for the sidebar and its accordion groups, Home (the lineup), the per-app pages, Updates, Beta, Extensions, Settings, the row actions, theme, routing, deep-link handling in the interface, or the build-time pane generator in vite.config.ts.
---

# interface

## Shape

- `vite.config.ts`'s `renderPortal` writes every app's cell, shelf item, beta tile, update rows, sidebar entry, home tool and app page into `index.html` at build time from `catalog/products.json`, so the first frame is the final layout. HTML comment markers of the form `@portal:[part]` name where; `%icon:name%` and `%fact:key%` markers are resolved by `design/markers.ts`.
- `src/engine` holds state and commands (`catalog.load`, `route.go`, `app.show`, `link.open`, install actions) and touches no DOM.
- `src/bridge` is the only way out: `fixture.ts` in a browser, `tauri.ts` in the window.
- `src/extensions/*` each own one behaviour and register in `registry.ts`.

## Rules

- Zero flash: keyed nodes, text and attribute writes only, reserved space for every async value, no container rebuilt. Verify under 4x CPU throttling with layout shift 0 and no node removed, and state the result.
- A new pane is a `section.pane[data-pane]` written at build time; routes are whatever panes exist.
- Stored keys are `formportal-*`; `public/prepaint.js` and the theme extension must agree.
- Ports: dev 3250, preview 3251, `server.host` false, `strictPort`.
- Log in `frontend/HASHOUT_LOG.md`.
