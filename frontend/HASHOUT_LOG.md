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
