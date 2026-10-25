---
name: interface
description: Changes to FormPortal's TypeScript interface. Use for the sidebar, the top bar (search, notifications bell, Preferences button), Home (your apps, updates line, the family, What's new), the Apps list and its filters, the per-app pages, Updates, Beta, Extensions, Learn, the Preferences dialog, toasts, the row and card actions, theme, routing, deep-link handling in the interface, or the build-time pane generator in vite.config.ts.
---

# interface

## Shape

- The layout follows the Creative Cloud desktop app's, as researched in the planning sidecar's `RESEARCH_CC_UI.md`: a two-level sidebar (Home; Apps with Updates and Beta; Extensions; Learn; Included, the free plan and every app's licence, built by the `included` part), a top bar (page title, search, bell, Preferences), Preferences as a dialog with tabs down the left.
- `vite.config.ts`'s `renderPortal` writes every app's list row, Your apps card, family card, update rows, beta row, What's new card, per-app automatic-update switch, Learn entry and app page into `index.html` at build time from `catalog/products.json`, so the first frame is the final layout. HTML comment markers of the form `@portal:[part]` name where; `row-actions.html` (one primary action and a More menu) and `card-actions.html` (one primary action) are included; `%icon:name%` and `%fact:key%` markers are resolved by `design/markers.ts`.
- `src/engine` holds state and commands (`catalog.load`, `route.go`, `link.open`, `prefs.open`, install actions) and touches no DOM.
- `src/bridge` is the only way out: `fixture.ts` in a browser, `tauri.ts` in the window.
- `src/extensions/*` each own one behaviour and register in `registry.ts`: route, theme, apps (every `[data-row]`), library (extensions), settings (the Preferences contents and the policy), notices (bell and toasts), prefs (the dialog), search (the top bar and the Apps filters).

## Rules

- One primary action per item (Install, Open or Update), shown by `data-install` in CSS; everything else goes in More. A `[data-row]` must never contain another `[data-row]`: the apps extension wires every `[data-act]` inside a row.
- Zero flash: keyed nodes, text and attribute writes only, reserved space for every async value, no container rebuilt. Actions stay hidden until `data-loaded` is set after the first catalogue, installs and preferences, so they appear once. Notices are toasts and a bell list, both floating. Verify under 4x CPU throttling with layout shift 0 and no node removed, and state the result.
- A new pane is a `section.pane[data-pane][data-title]` written at build time; routes are whatever panes exist; the top bar shows `data-title`.
- Stored keys are `formportal-*`; `public/prepaint.js` and the theme extension must agree, and so must prepaint.js, the stylesheet's `html[data-launch]` rules and the route extension for opening where the person left off.
- Languages: English text is the key. A string written into `index.html` or by `renderPortal` is translated at build time by `src/i18n/translate.ts` into `es/index.html`; a string set at run time goes through `t()` from `src/i18n`, with `{name}` placeholders, never string concatenation. Add each new string to `src/i18n/es.json` (exact strings, or a pattern for per-app sentences); a missing one shows in English. The language is chosen before the window exists (the shell opens that language's page), never switched in place.
- Ports: dev 3250, preview 3251, `server.host` false, `strictPort`.
- Log in `frontend/HASHOUT_LOG.md`.
