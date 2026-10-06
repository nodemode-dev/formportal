# HASHOUT_LOG · hub/frontend · formai_dev

Living log for the hub's interface. Source files stay comment-free; what they would have said lives here. Tokens, icons and the marker renderer are logged in `design/HASHOUT_LOG.md`.

Current build version: v0.1.0
Last updated: 2026-10-04 · scaffold

---

## Org-navi-map

```
hub/frontend/
├── index.html                    the whole shell as markup: rail, five panes, overlay roots
├── public/
│   ├── prepaint.js               applies the stored theme before the stylesheet
│   ├── favicon.svg               for the browser tab in development
│   └── fonts/                    Inter variable and its licence
├── src/
│   ├── main.ts                   entry: engine, bridge, extensions, first load
│   ├── engine/
│   │   ├── index.ts              state, event bus, commands, the channel view
│   │   └── types.ts              the catalogue's shapes, mirroring catalog/schema
│   ├── bridge/
│   │   ├── index.ts              the Bridge interface and which one is in use
│   │   └── fixture.ts            answers from catalog/fixtures, platform from the browser
│   ├── extensions/
│   │   ├── registry.ts           register and activate
│   │   ├── route/index.ts        which pane shows
│   │   ├── theme/index.ts        dark and light
│   │   ├── apps/index.ts         status and version on the Apps and Beta rows
│   │   ├── library/index.ts      the extension list, keyed
│   │   └── settings/index.ts     catalogue source and this computer
│   └── styles/main.css           every rule, tokens only
├── vite.config.ts                port 3250, markers, the version fact
├── tsconfig.json
├── package.json
├── oc_install(.bat)              npm install
└── boot_frontend(.bat)           npm run dev
```

---

## Table of contents

- [index.html](#index)
- [public/prepaint.js](#prepaint)
- [src/main.ts](#main)
- [src/engine/index.ts](#engine)
- [src/engine/types.ts](#types)
- [src/bridge/index.ts](#bridge)
- [src/bridge/fixture.ts](#fixture)
- [src/extensions/route/index.ts](#route)
- [src/extensions/apps/index.ts](#apps)
- [src/extensions/library/index.ts](#library)
- [src/extensions/settings/index.ts](#settings)
- [src/styles/main.css](#css)
- [vite.config.ts](#vite)

---

## index.html {#index}

### index.html · the shell is markup, not script
- refers-to: index.html :: `#app`
- kind: rationale
- logged: v0.1.0 · 2026-10-04

The rail, all five panes and the three product rows in Apps and in Beta are written in the page. Script never builds them: it writes an attribute or a text node. That is how the first frame is already the final layout. The family has three products, so their rows are known at build time; a fourth product means adding its row here by hand.

### index.html · rows and fields
- refers-to: index.html :: `li.row[data-row]`, `[data-field]`
- kind: explainer
- logged: v0.1.0 · 2026-10-04

A row carries `data-product` (which also gives it its hue) and `data-row` (the channel: `stable` or `beta`). Inside, `data-field="status"` and `data-field="version"` are the two text nodes the apps extension writes. Both cells have a reserved height and the version cell a reserved width, so text arriving moves nothing.

### index.html · no buttons on the rows yet
- refers-to: index.html :: `[data-pane='apps']`, the `.pane-note`
- kind: todo
- logged: v0.1.0 · 2026-10-04

Install, Open and Update are Phase 5. A button that does nothing is worse than none, so the rows show what the catalogue says and a note under them says what is coming. Remove the note when the actions land.

### index.html · the extension row template
- refers-to: index.html :: `template#ext-row`
- kind: explainer
- logged: v0.1.0 · 2026-10-04

Extensions are not known at build time, so their rows are cloned from this template, once each, keyed by id. The mark holds all four product icons and CSS shows the one matching the row's `data-product`, so the clone needs no icon logic.

### index.html · overlay roots
- refers-to: index.html :: `#overlay-root`, `#toast-root`
- kind: explainer
- logged: v0.1.0 · 2026-10-04

Direct children of `body`, after the app. Dialogs, menus and toasts render into these and take `--z-overlay`, `--z-dropdown` or `--z-toast`. Empty for now.

---

## v0.12.0 · run in the real window {#real}

### src/extensions/apps/index.ts · every row is written when a catalogue arrives
- refers-to: src/extensions/apps/index.ts :: the `source` handler
- kind: warning-context
- logged: v0.12.0 · 2026-10-06

A row was patched only when a `product` event named its product. The sample catalogue lists all four products, so in a browser every row was always written. The real window was pointed at a catalogue that listed only formcut, and the formvis and formwav rows stayed blank: no status at all. A `source` event now patches all six rows, so a product the catalogue does not mention reads "Not released yet", which is true.

### src/bridge/tauri.ts · has now run
- refers-to: src/bridge/tauri.ts
- kind: explainer
- logged: v0.12.0 · 2026-10-06

The v0.11.0 entry below says this file had only been compiled. In v0.12.0 the built Linux app used it for `platform`, `catalog`, `installs`, `install` and `open` in a real web view; `rollback` and `remove` and the progress listener's effect on the bar have still not been seen there. The account of the run is in `hub/src-tauri/HASHOUT_LOG.md` § v0.12.0.

## v0.11.0 · the window is wired to the core {#wired}

### row-actions.html, vite.config.ts · actions are markup, placed at build time
- refers-to: row-actions.html; vite.config.ts :: the `rows` replacement in `handler`
- kind: rationale
- logged: v0.11.0 · 2026-10-06

Every app row (three in Apps, three in Beta) carries the same actions: Roll back, Remove, Open, Update, Install and a progress bar. Rather than write that block six times in `index.html` or build it with script, the build inserts an include of `row-actions.html` after each row's version field, and the marker renderer resolves it. The served page has the buttons in it from the first byte; script only sets attributes. This replaces the v0.1.0 entry "no buttons on the rows yet" and its note in the Apps pane, whose paragraph is now the place a failed action is reported (`data-notice`).

### src/extensions/apps/index.ts · row state
- refers-to: src/extensions/apps/index.ts :: patch, write, the click handlers
- kind: explainer
- logged: v0.11.0 · 2026-10-06

A row's `data-install` is `none` (not installed), `busy` (installing, with `--p` from 0 to 1 driving the bar), `ready` (installed and the catalogue offers the same version) or `update` (installed and the catalogue offers another). `data-previous` is present when an earlier version is kept. CSS shows the buttons that fit: Install when none and the catalogue has a file for this computer; Open and Remove when ready; Open and Update when update; Roll back whenever an earlier version is kept; nothing but the bar when busy. The actions column has a fixed width, so no state moves anything. A click dispatches `app.install`, `app.open`, `app.rollback` or `app.remove` with the row's product and channel; Update is `app.install`.

### src/extensions/apps/index.ts · write, and why status text starts at the left
- refers-to: src/extensions/apps/index.ts :: write; src/styles/main.css :: `.row-status`
- kind: warning-context
- logged: v0.11.0 · 2026-10-06

Two things measured. Setting `textContent` replaces the text node: fourteen nodes removed over one install, which the stability rule counts as churn. `write` now changes the existing text node's value. With the node kept, the browser then reported a layout shift of 0.0001 each time the status changed length, because the text was right-aligned and its start moved. The status is now aligned to its start, where a longer word grows away from a fixed edge. After both: no node removed and a shift of exactly 0 through install, open, update, roll back and remove.

### src/bridge/tauri.ts · the shell's bridge
- refers-to: src/bridge/tauri.ts :: tauriBridge, catalogUrl, allowUnsigned; src/bridge/index.ts :: pickBridge
- kind: explainer
- logged: v0.11.0 · 2026-10-06

When the page runs inside the shell (`window.__TAURI__` exists, because the shell's config sets `withGlobalTauri`), `pickBridge` returns this bridge, which calls the shell's commands of the same names and listens for `install-progress` events during an install. No package is needed for it. The catalogue address is `https://formai.dev/catalog/v1/apps.json` unless Settings holds another (`formai-catalog-url` in local storage), and an unsigned catalogue is accepted only if the Developer box in Settings is ticked (`formai-allow-unsigned`). Changing either reloads the catalogue. The extension list is empty in the shell until the catalogue's index is fetched by the core. **Never run**: this file has only been compiled.

### src/bridge/fixture.ts · acted-out installs
- refers-to: src/bridge/fixture.ts :: installed, the action methods, the `installed` query
- kind: explainer
- logged: v0.11.0 · 2026-10-06

In a browser the fixture bridge now plays the actions in memory: an install takes ten steps of 90 ms and reports progress, then records the catalogue's version, keeping the one before as `previous`. `?installed=formcut:2.6.1` in the address starts with that version installed, which is how the update and roll back states are reached. Nothing is downloaded. This is what the interface was exercised against.

### src/main.ts · commands and the notice
- refers-to: src/main.ts :: guard, refresh, the `app.*` commands
- kind: explainer
- logged: v0.11.0 · 2026-10-06

Every command runs inside `guard`, which clears the notice, awaits the work and, if it throws, shows the message in the Apps pane (the core's errors are sentences written for a person). After an install, roll back or remove the installed list is read again from the bridge rather than patched from the answer, so the interface shows what the core recorded. `catalog.load` now sets the platform and the installed list before the catalogue, so a row never shows Install for something already installed.

## public/prepaint.js {#prepaint}

### public/prepaint.js · a file, not an inline script
- refers-to: public/prepaint.js; index.html :: the `script` before the stylesheet
- kind: rationale
- logged: v0.1.0 · 2026-10-04

The site applies the theme with an inline script and allows it by hash. Inside the desktop shell the page runs under a CSP of `script-src 'self'`, and a plain file from the app's own origin needs no hash and no exception. It is a classic script placed before the stylesheet, so it runs before first paint.

---

## src/main.ts {#main}

### src/main.ts · order
- refers-to: src/main.ts :: the whole file
- kind: explainer
- logged: v0.1.0 · 2026-10-04

The engine's theme is seeded from the attribute the pre-paint script set. Extensions are registered and activated, which is when they subscribe. Only then is `catalog.load` dispatched, so no event is missed. `catalog.load` sets the platform first, then the catalogue, then the extension index.

---

## src/engine/index.ts {#engine}

### src/engine/index.ts · Engine
- refers-to: src/engine/index.ts :: Engine
- kind: explainer
- logged: v0.1.0 · 2026-10-04

Holds the state, a typed event bus and a command table. It never touches the DOM and never calls the bridge; it can run with no page at all. Events are granular: `product` names one product, so a subscriber patches the rows of that product and nothing else. There is no event that means "everything changed".

### src/engine/index.ts · commands
- refers-to: src/engine/index.ts :: command, dispatch
- kind: explainer
- logged: v0.1.0 · 2026-10-04

Registered so far: `route.go` (route extension), `theme.set` (theme extension), `catalog.load` (main). A duplicate name or an unknown name throws. Phase 5 adds `app.install`, `app.open`, `app.update`, `app.remove`, and the same names become the shell's command surface in Phase 6.

### src/engine/index.ts · view
- refers-to: src/engine/index.ts :: view
- kind: explainer
- logged: v0.1.0 · 2026-10-04

Answers "what can this computer get for this product on this channel". `unreleased`: the product is prelaunch or unknown. `no-release`: nothing published on that channel. `available`: an artifact for this operating system, preferring the exact architecture and falling back to any for the system. `other-platform`: a release exists with nothing for this system. The words shown for each are in the apps extension, not here.

---

## src/engine/types.ts {#types}

### src/engine/types.ts · kept in step by hand
- refers-to: src/engine/types.ts :: Catalog, Product, Release, Artifact, ExtensionIndex, ExtensionEntry
- kind: warning-context
- logged: v0.1.0 · 2026-10-04

These mirror `catalog/schema/*.json` and `hub/core/src/lib.rs`. A field added to the schema is added in all three.

---

## src/bridge/index.ts {#bridge}

### src/bridge/index.ts · Bridge and pickBridge
- refers-to: src/bridge/index.ts :: Bridge, pickBridge
- kind: todo
- logged: v0.1.0 · 2026-10-04

The one seam between the interface and whatever answers it. Today `pickBridge` always returns the fixture. Phase 6 adds a bridge that calls the shell's commands and returns it when the page is running inside the shell; Phase 4 work on the core does not touch this side.

---

## src/bridge/fixture.ts {#fixture}

### src/bridge/fixture.ts · the fixture is bundled
- refers-to: src/bridge/fixture.ts :: the two JSON imports
- kind: warning-context
- logged: v0.1.0 · 2026-10-04

`catalog/fixtures/*.json` are imported and so end up inside the built script. Fine for a scaffold; before the first release the fixture bridge is left out of production builds. Its `source` is `fixture`, which Settings shows in words, so a sample catalogue is never mistaken for the real one.

### src/bridge/fixture.ts · browserPlatform
- refers-to: src/bridge/fixture.ts :: browserPlatform
- kind: explainer
- logged: v0.1.0 · 2026-10-04

A browser cannot report the processor reliably, so the fixture assumes ARM64 on a Mac and x86-64 elsewhere. The real answer comes from the core.

---

## src/extensions/route/index.ts {#route}

### src/extensions/route/index.ts · switching panes
- refers-to: src/extensions/route/index.ts :: the `route` handler
- kind: explainer
- logged: v0.1.0 · 2026-10-04

Writes `data-route` on `html`, moves `aria-current` between rail buttons, and scrolls the stage to the top. CSS shows the pane whose `data-pane` matches. Panes are never created or removed, so a pane keeps its rows when it is left and returned to.

---

## src/extensions/apps/index.ts {#apps}

### src/extensions/apps/index.ts · patch
- refers-to: src/extensions/apps/index.ts :: patch, WORDS
- kind: explainer
- logged: v0.1.0 · 2026-10-04

For each row of the product named by a `product` event: sets `data-availability`, and the text of the status and version fields. It serves both the Apps rows and the Beta rows, told apart by `data-row`. `WORDS` is the only place the status wording lives.

---

## src/extensions/library/index.ts {#library}

### src/extensions/library/index.ts · keyed list
- refers-to: src/extensions/library/index.ts :: the `extensions` handler
- kind: explainer
- logged: v0.1.0 · 2026-10-04

Keeps a map of mounted rows by extension id. A new id clones the template and appends once; a known id has its text fields updated only where the text differs; an id no longer in the index has its row removed. The list is never cleared and refilled.

### src/extensions/library/index.ts · trust wording
- refers-to: src/extensions/library/index.ts :: fill, the `trust` field
- kind: explainer
- logged: v0.1.0 · 2026-10-04

A package with a `signature` reads "Signed"; one without reads "Unsigned, for testing". Nothing verifies the signature yet: that is the core's job in Phase 7. Until then "Signed" means only that the index carries one.

---

## src/extensions/settings/index.ts {#settings}

### src/extensions/settings/index.ts · data-source
- refers-to: src/extensions/settings/index.ts :: the `source` handler
- kind: explainer
- logged: v0.1.0 · 2026-10-04

Also writes `data-source` on `html` (`none`, `fixture`, `live`) so a later build can mark the whole window when it is showing sample data.

---

## src/styles/main.css {#css}

### src/styles/main.css · the window does not scroll, the stage does
- refers-to: src/styles/main.css :: `body`, `.stage`
- kind: explainer
- logged: v0.1.0 · 2026-10-04

`body` is fixed to the window and hidden on overflow; `.stage` scrolls with `scrollbar-gutter: stable`, so a pane that needs a scrollbar does not shift the ones that do not. Text is not selectable and the cursor is the arrow, as in a desktop app; fields that should be copied (hashes, paths) will opt back in.

### src/styles/main.css · the narrow rail
- refers-to: src/styles/main.css :: the 760px media query
- kind: explainer
- logged: v0.1.0 · 2026-10-04

Under 760px the rail shows icons only and a row stacks its status and version under its name. The shell's minimum window is wider than this; the rule is for the browser during development.

### src/styles/main.css · font-display: optional
- refers-to: src/styles/main.css :: the first `@font-face`
- kind: rationale
- logged: v0.1.0 · 2026-10-04

Same reason as the site: a font that arrives after first paint must not reflow the window. In the shell the font is a local file and is ready at first paint.

---

## vite.config.ts {#vite}

### vite.config.ts · the version fact
- refers-to: vite.config.ts :: `facts`
- kind: explainer
- logged: v0.1.0 · 2026-10-04

`%fact:version%` in `index.html` is this package's version, read at build time, so the version shown in the rail and in Settings cannot disagree with `package.json`.

### vite.config.ts · server
- refers-to: vite.config.ts :: `server`, `preview`
- kind: warning-context
- logged: v0.1.0 · 2026-10-04

`host: false`, `strictPort: true`, 3250 for dev and 3251 for preview. `fs.allow` names this folder, `design/` and `catalog/`. `clearScreen: false` keeps the shell's own output readable when the two run together.
