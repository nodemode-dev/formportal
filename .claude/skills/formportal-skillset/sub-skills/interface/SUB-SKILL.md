---
name: interface
description: Changes to FormPortal's TypeScript interface. Use for the sidebar and its icon rail, the top bar (search, notifications bell), Home (the family dock, your apps, get more, on the way, file drop), the Apps list and its filters, the per-app pages and their tabs, Updates, Files, Fonts, Stock, Extensions, Learn, the Preferences dialog, toasts, the actions, theme, routing, deep-link handling in the interface, or the build-time markup in frontend/markup.ts.
---

# interface

## Shape

- The layout follows the Creative Cloud desktop app's sections, in the Form family's own app kit (the shell, density, controls and Start-page pattern FormVis, FormDeck, FormLit and FormVFX share; the owner approved the mockups on 2026-11-06). A full-width top bar (search with Cmd/Ctrl K, ask, bell); a sidebar with `formportal by nodemode.ai`, the sections (Home, Apps, Updates, Files, Fonts, Stock & templates, Extensions, Learn), Your apps (installed apps, one click opens), Preferences and Help; FormDeck's edge handle, which collapses the sidebar to an icon rail and drags to resize (180 to 360 px, below 120 px it snaps to the rail; restored before first paint by `prepaint.js`). There is no plan, subscription or Included page, and Beta lives on each app's page.
- Colour comes from the apps: `design/app-hues.json` (the site's suffix colours) gives each app its `--hue`, used for the `Form` + suffix name, card art, install progress, row accents and the app page's hero wash. Every app page shows the app's hero shot from formai.studio (`public/heroes/[id].webp` and `[id]-light.webp`, following the theme like the icons).
- `markup.ts` (`buildPortal`, called by `vite.config.ts`) writes the sidebar apps, the dock (one slot per app, lit or sealed by `data-live` alone), Your apps cards, Get more tiles, On the way waves, Apps rows, Updates rows, app pages, the automatic-update switches and Learn entries into `index.html` at build time from `catalog/products.json`, `catalog/apps/*.json` (caps) and `catalog/schedule.json`, so the first frame is the final layout. HTML comment markers of the form `@portal:[part]` name where; `more-menu.html` is included; `%icon:name%` and `%fact:key%` markers are resolved by `design/markers.ts`.
- `src/engine` holds state and commands (`catalog.load`, `route.go`, `link.open`, `prefs.open`, install actions) and touches no DOM.
- `src/bridge` is the only way out: `fixture.ts` in a browser, `tauri.ts` in the window.
- `src/extensions/*` each own one behaviour and register in `registry.ts`: route, theme, side (the rail and resize), home (greeting, counts, install all, the Get more filter, app-page tabs, Cmd/Ctrl K, file drop), apps (every `[data-row]`), library (extensions), settings (the Preferences contents and the policy), notices (bell and toasts), prefs (the dialog), search (the top bar and the Apps filters).

## Rules

- One primary action per item (Install, Open or Update), shown by `data-install` in CSS; everything else goes in More. A `[data-row]` must never contain another `[data-row]`: the apps extension wires every `[data-act]` inside a row.
- Zero flash: keyed nodes, text and attribute writes only, reserved space for every async value, no container rebuilt. Actions stay hidden until `data-loaded` is set after the first catalogue, installs and preferences, so they appear once. Notices are toasts and a bell list, both floating. Verify under 4x CPU throttling with layout shift 0 and no node removed, and state the result.
- A new pane is a `section.pane[data-pane][data-title]` written at build time, starting with its own `.page-head` (an `h1.h1` and a `.sub` line); routes are whatever panes exist.
- Stored keys are `formportal-*`; `public/prepaint.js` and the theme extension must agree, and so must prepaint.js, the stylesheet's `html[data-launch]` rules and the route extension for opening where the person left off.
- Languages: English text is the key. A string written into `index.html` or by `renderPortal` is translated at build time by `src/i18n/translate.ts` into `es/index.html`; a string set at run time goes through `t()` from `src/i18n`, with `{name}` placeholders, never string concatenation. Add each new string to `src/i18n/es.json` (exact strings, or a pattern for per-app sentences); a missing one shows in English. The language is chosen before the window exists (the shell opens that language's page), never switched in place.
- Ports: dev 3250, preview 3251, `server.host` false, `strictPort`.
- Log in `frontend/HASHOUT_LOG.md`.
