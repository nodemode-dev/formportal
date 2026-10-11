# HASHOUT_LOG · frontend · formportal

Living log for FormPortal's interface (formai_dev's `hub/frontend` up to formai_dev 0.26.0; older entries keep the old paths). Source files stay comment-free; what they would have said lives here. Tokens, icons and the marker renderer are logged in `design/HASHOUT_LOG.md`.

Current build version: v0.31.0
Last updated: 2026-10-11 · standalone repository

## v0.32.0 · checking for a newer FormPortal {#self-update}

### Settings, Version
- refers-to: index.html :: data-self-check, data-self-install, data-self-status · src/extensions/settings/index.ts · src/main.ts :: self.check, self.install
- kind: decision
- logged: v0.32.0 · 2026-10-11

Check for a newer FormPortal, then Install and restart when one is offered; one status line says not configured, up to date, available, or the failure. The row reserves the control height (`.self-update` min-block-size), so the status text and the second button appear without moving anything. `.seg-item` sets `display`, which beat the `hidden` attribute and showed Install and restart on every check; `.self-update .seg-item[hidden]` fixes it. The browser mode takes `?self=0.40.0` to offer a version, `?self=` for up to date, nothing for not configured. Verified at 4x CPU: the three cases gave the right line and button, layout shift 0, no script error.

### Seen in the real window, older than this version
- refers-to: styles/lineup.css :: the ruler label
- kind: warning-context
- logged: v0.32.0 · 2026-10-11

At the window's default 1180 px width, the vertical LINEUP label of the ruler sits over the icon row between FormCut and FormWav. Logged for the interface phase.

## v0.31.0 · extensions {#extensions}

### Rows from the index and from what is installed
- refers-to: src/extensions/library/index.ts :: fill, wire, extensions handler · index.html :: ext-row template
- kind: decision
- logged: v0.31.0 · 2026-10-11

The Extensions screen keys its rows by product and id over the union of the index and the installed list, so a sideloaded package has a row too. `data-ext-state` (none, installed, update, busy), `data-listed` and `data-trust` drive which of Install or Update, Remove and On show, all in CSS; `fill` writes attributes, text and `checked` only when they differ. Rows are still cloned from the template at run time (as since 0.7.0), appended at the end of the list.

### The notes and the notice sit above the list
- refers-to: index.html :: data-pane extensions
- kind: decision
- logged: v0.31.0 · 2026-10-11

With the notes below the list, a row appended after load (a sideload finishing) pushed them down: a 0.0115 shift. They now sit above the list, the notice in the 3em space `.pane-notice` reserves, so a row appended at the end moves nothing. The notice is shared with Home (every `[data-notice]` gets the text). Notices are drawn in the fault colour even for good news; that predates this and goes to the interface phase.

### Opening a .formpkg
- refers-to: src/main.ts :: ext.install, bridge.onPackage · src/bridge/tauri.ts :: onPackage
- kind: decision
- logged: v0.31.0 · 2026-10-11

A package opened with FormPortal goes to the Extensions screen and installs at once, with the sideload label when the index does not list it. Opening the file is the person's intent; the label, the native-code rule and Remove are the safeguards. The browser mode takes `?package=/path/name.formpkg`.

### Verified
- refers-to: the entries above
- kind: explainer
- logged: v0.31.0 · 2026-10-11

Built, 4x CPU, headless Chromium: `?package=...teal-look.formpkg` routed to Extensions, installed it as sideloaded with the notice; Install on Warm dust went busy then installed, with Remove and On; unticking On kept it installed and off; Remove took the sideloaded row away; no script error. Shift: only the known 0.0147 accordion one when a route opens the Library group. The screen was looked at; a first look showed On on a package that was not installed (`.check` declared later in the file won), fixed by raising the rule's specificity.

## v0.30.0 · other versions {#versions}

### Other versions in More
- refers-to: row-actions.html :: data-versions, data-version-go · src/extensions/apps/index.ts :: patch · src/main.ts :: app.install
- kind: decision
- logged: v0.30.0 · 2026-10-11

A select and an Install button at the foot of every row's More menu, shown only when the channel has more than one version with a file for this system (`data-history`). The options are the only nodes the interface creates at run time: they live inside a closed menu, are replaced only when the list or the installed version changes (`data-list` keys it), and keep the person's selection. `app.install` passes the version through the bridge; after it, the interface rereads the preferences and, when the core held automatic updates, says so. The button is a `drop-item`: `.act` buttons are shown by row state, which hid it in the first try.

### keep_previous in Settings
- refers-to: index.html :: data-pref keep_previous · src/extensions/settings/index.ts
- kind: explainer
- logged: v0.30.0 · 2026-10-11

"Keep the version before, to go back to", on by default.

### Verified
- refers-to: the entries above
- kind: explainer
- logged: v0.30.0 · 2026-10-11

Built, 4x CPU, headless Chromium, `?installed=formcut:2.6.2&link=app/formcut`: More listed 2.6.2 (installed), 2.6.1, 2.6.0; choosing 2.6.0 installed it, kept 2.6.2 for rollback, offered 2.6.2 as an update, marked 2.6.0 installed, unticked Update automatically and showed the notice; no node removed other than the replaced options, no script error. The 0.0117 shift at load is the known link and accordion one.

## v0.29.0 · updates {#updates}

### Automatic updates when the catalogue loads
- refers-to: src/main.ts :: catalog.load, prefs.set · src/bridge/*.ts :: preferences, setPreferences, autoUpdate
- kind: decision
- logged: v0.29.0 · 2026-10-11

After the catalogue loads, the window reads the preferences from the core and asks it to apply the automatic updates (`auto_update` in the shell, which emits the same `install-progress` events as Install, so rows show their progress). Then one notice: what was updated, what failed, how many updates still wait, and whether a newer FormPortal is in the catalogue (product `formai`, compared with this build's package.json version). The notice is skipped when `notices` is off, except for failures. The fixture bridge does the same in memory; `?auto=off` starts it with automatic updates off, `?installed=formcut:2.6.1` seeds an install.

### Only newer versions
- refers-to: src/engine/index.ts :: versionNewer · src/extensions/apps/index.ts :: patch · src/main.ts :: app.updateAll
- kind: decision
- logged: v0.29.0 · 2026-10-11

A row says "Update to" only when the offered version is newer, by the same rule as the core's `version_newer`. Before, any different version counted, so an older catalogue would have offered a downgrade as an update.

### Preferences in the interface
- refers-to: index.html :: data-pref · row-actions.html :: data-auto, data-field notes · src/extensions/settings, src/extensions/apps
- kind: decision
- logged: v0.29.0 · 2026-10-11

Four checkboxes under Settings, Updates, and "Update automatically" in every row's More menu (a per-app override saved in `per_app`), all in the build-time markup; the extensions write `checked` only when it differs. Release notes are a "What's new" line in Details, hidden when empty by the existing `div:has(dd:empty)` rule. Engine.automatic mirrors the core's rule so the More checkbox shows what the core will do.

### Verified, and one shift
- refers-to: the entries above
- kind: warning-context
- logged: v0.29.0 · 2026-10-11

Headless Chromium, 4x CPU, the built interface: `?installed=formcut:2.6.1` updated FormCut to 2.6.2 on load with the notice, layout shift 0, no node removed; with `?auto=off` the row said "Update to 2.6.2", the notice "1 update is waiting", the count 1; ticking Update automatically in More set the per-app override for every FormCut stable row; Beta builds too in Settings ticked every beta row's box; Details showed What's new. No overflow, no script error. One shift of 0.0117 at load, sourced to the sidebar's groups: a `formai://app/` link to an app outside the open group makes the accordion open that group (0.24.0's rule) with no input event in the window, so the layout-shift record counts it. It is the same movement a click on the sidebar causes; it is logged for the interface phase (DEV_PLAN Phase 6), and the 0.28.0 link check's 0.00028 was a smaller case of it.

## v0.28.0 · links and theme {#links-theme}

### formai://app/[id] opens the app's page
- refers-to: src/main.ts :: link.open
- kind: decision
- logged: v0.28.0 · 2026-10-11

The link first asks for the route `app-[id]` (the per-app page written at build time since 0.23.0); the route extension ignores routes that have no pane, so for an id without a page the link falls back to the apps screen with that app shown, as before. Nothing is built at run time; the pane already exists.

### Theme: System, Dark, Light
- refers-to: public/prepaint.js · src/extensions/theme/index.ts · index.html :: data-theme-set
- kind: decision
- logged: v0.28.0 · 2026-10-11

The stored key holds `light` or `dark` only; no key means System, which is the default. prepaint.js decides before the first paint (stored choice, else `prefers-color-scheme`), so the first frame is final. The extension follows the system's changes only while in System, and writes `data-theme` and `aria-pressed` only when they differ. Storage that throws falls back to System. The Settings segment's markup starts with System pressed; Settings is never the first screen, so the extension's correction for a stored choice is not seen.

### Verified
- refers-to: the two entries above
- kind: explainer
- logged: v0.28.0 · 2026-10-11

Built and served by `vite preview`, headless Chromium at 4x CPU and a 150 ms, 200 KB/s network: with no stored choice a light system starts light and a dark one dark, a stored dark on a light system starts dark and the reverse, with no `data-theme` change after the document loaded and no node removed; `?link=app/formvis` opened FormVis's page with FormVis in the top bar; in Settings, Light, System, a system switch to light while in System, then Dark each set the attribute, the pressed button and the stored key as expected, no overflow. Known and older than this change: one layout shift of 0.00098 on the lineup's "FORM APPS" label on a slow network, measured identically on the 0.28.0 build before these edits; it is listed in DEV_PLAN for the interface phase.

## v0.27.0 · the move {#move}

### Paths to design and catalog
- refers-to: vite.config.ts :: DESIGN, CATALOG · tsconfig.json :: include · src/styles/main.css :: @import · src/bridge/fixture.ts :: imports
- kind: decision
- logged: v0.27.0 · 2026-10-11

`frontend/` sits at the repository root now, so `design/` and `catalog/` are one level up (`../design`, `../catalog`; `../../../` from `src/`). Both folders are copies of formai_dev 0.26.0. The catalogue contract is still formai_dev's to change; a change there is copied here, never edited here first.

### Names in the browser
- refers-to: src/bridge/tauri.ts :: CATALOG_KEY, UNSIGNED_KEY · src/extensions/theme/index.ts :: KEY · public/prepaint.js · src/extensions/settings/index.ts :: where
- kind: decision
- logged: v0.27.0 · 2026-10-11

Stored keys are `formportal-theme`, `formportal-catalog-url`, `formportal-allow-unsigned` (were `formai-*`); prepaint.js and the theme extension must name the same key or the theme flashes on first paint. Settings shows the install folders `core` now uses. The default catalogue address stays formai.dev's.

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

## v0.20.0 · FormPortal, built from the registry {#portal20}

### index.html, vite.config.ts · every app, not three
- refers-to: index.html :: `<!-- @portal:cards -->`, `@portal:shelf`, `@portal:beta`, `@portal:updates`; vite.config.ts :: APPS, renderPortal; src/extensions/stage/index.ts; src/styles/main.css :: `.card[data-on]`, `.shelf`, `.app-plate`
- kind: rationale
- logged: v0.20.0 · 2026-10-06

The window was written for three apps by hand: three stage panels, three shelf items, three Beta tiles, six update rows, and a CSS rule per app choosing the panel. The family is twenty. The four blocks are now markers that the build fills from `catalog/products.json` (every app but the portal itself): a stage panel and a shelf item per app, a Beta tile per available app, and a stable and a beta update row per app, each carrying `data-row` and `data-product` so the apps extension writes them unchanged. The chosen panel is the one with `data-on`, set by the `app.show` command, so the stage works for any number. The shelf is a strip that scrolls sideways and brings the chosen app into view. An app w/o a screenshot shows the same plate as the website; on the stage the plate carries no word, since the app's name is set over it (the first build showed the plate's word colliding w/ the name).

Limit, stated: the panels are written at build time, so an app added to the registry appears in the window w/ the next FormPortal release, not before. The catalogue still decides at run time what each one offers.

The window, rail and page are titled FormPortal; `tauri.conf.json` names the product FormPortal, so bundles and the macOS app take that name. The folder is still `hub/` and the scripts `formai_hub`; renaming them is separate.

Checked in a browser under 4x CPU: 19 panels, 19 shelf items, 11 Beta tiles, 38 update rows; choosing FormEncoder put it on the stage; every earlier flow (stage at three sizes, Beta, Details, More, Updates, Update all, Extensions, Settings) still gives layout shift 0, no node removed, no overflow, no console error. Looked at: the stage w/ FormEncoder and the Beta screen. Not run: the real window w/ twenty apps.

## v0.17.0 · links {#links}

### src/main.ts, src/bridge · a link opens a screen or an editor
- refers-to: src/main.ts :: the `link.open` command, `bridge.onLink`; src/bridge/index.ts :: onLink; src/bridge/tauri.ts :: onLink; src/bridge/fixture.ts :: onLink
- kind: explainer
- logged: v0.17.0 · 2026-10-06

The bridge gained `onLink`. In the shell it listens for the `deep-link` event and asks once for a link the app was started with. In a browser it reads `?link=` from the address, so the same path can be exercised without the shell. Either way the interface receives the text after `formai://` and dispatches `link.open`: `app/<id>` goes to Apps and puts that editor on the stage; anything else is offered to `route.go`. Both of those commands already ignore what they do not know, so a link can only ever choose among the hub's own screens and editors. Checked in a browser: `app/formwav` showed formwav on the stage, `updates` the Updates screen; `app/nothing`, `settings/extra` and a `javascript:` address changed nothing beyond a valid screen name.

## v0.16.0 · Tab order, and the new controls in the real window {#v016}

### row-actions.html · the source order is the order on screen
- refers-to: row-actions.html :: the whole partial
- kind: warning-context
- logged: v0.16.0 · 2026-10-06

In v0.15.0 the partial listed Details and More before Open, Update and Install, and CSS reordered them for the eye. The keyboard follows the source, so Tab reached the drop-downs before the main button. The partial now lists them as they are seen: Open, Update, Install, More, Details. Checked in a browser from an editor with an update waiting: Tab after the rail goes Open, Update, More, Details, then the shelf. The `order` rules and the spacer in the stylesheet still do the pinning; they no longer reorder anything.

### the real window · the new controls
- refers-to: the Linux app built from this version's interface; src/bridge/tauri.ts
- kind: explainer
- logged: v0.16.0 · 2026-10-06

The Linux app was rebuilt and driven by keyboard and mouse under a virtual display, as in v0.12.0, against a local test catalogue. Seen in captures of the real window: the stage before install with Install and Details; after Install, Installed with Open, More and Details; More opened from the keyboard showing Remove from this computer; Details opened from the keyboard showing the release date, file, needs, licence and SHA-256; the Updates screen listing formcut as installed at 2.6.2 with Open, More and Details and no Update all, nothing being newer; the Beta tiles; and Extensions with its filter and its empty state, the shell having no extension list yet. The installed file ran when Open was pressed.

Found there and fixed: Details showed a Project files row with nothing in it, because that test catalogue gives none. A fact row whose value is empty is now hidden (`.drop-facts > div:has(dd:empty)`). The real app was not rebuilt after that one-line fix.

Not seen in the real window: an update arriving, Update all, going back a version, removing, the rail's count, the extension tiles (the shell lists none), Settings' new rows.

## v0.15.0 · more on each tile, drop-downs, and the remaining panes {#rest}

### row-actions.html · Details and More
- refers-to: row-actions.html; src/extensions/apps/index.ts :: the `field` writes in patch, the `open` helpers; src/styles/main.css :: `.drop` to `.drop-item`
- kind: explainer
- logged: v0.15.0 · 2026-10-06

The owner asked for more relevant information on the tiles and for drop-downs. The actions partial, which every stage panel, Beta tile and update row includes, now carries two. **Details** holds what a careful person wants before installing: the release date, the file's name, what it needs, the editor's project file types, its licence and the SHA-256 the download is checked against, each a field the apps extension writes from the catalogue. **More** holds the actions that are not the main one: go back to the version before (shown only when one is kept) and remove. So the row of buttons is the main action, then the two drop-downs.

They are native `details` elements, so they open and close with no script and work from the keyboard. Script adds only what `details` lacks: a click anywhere else, choosing an item, or Escape closes whatever is open, which also keeps one open at a time. A panel is positioned over the content rather than pushing it, on the dropdown layer.

A row gets `data-release` when the catalogue has a file for this computer; Details shows only then. More shows when the editor is installed.

### src/styles/main.css · the actions keep their places
- refers-to: src/styles/main.css :: `.row-actions::before`, the `order` rules, the busy `[data-act="install"]` rule, `.up` grid
- kind: warning-context
- logged: v0.15.0 · 2026-10-06

With drop-downs beside the main button, changing state moved them: Install to Open changed the button's width, and More appearing pushed Details along. Measured: up to 0.0015 of layout shift on the stage. Three things fixed it. The main buttons sit at the start and a flexible spacer pushes the drop-downs to the far end, More before Details, so More arrives beside Details without moving it. While installing, the Install button stays in place, dimmed, instead of vanishing. An update row's actions have a column of fixed width. After: 0 on every flow.

### index.html · Updates is real
- refers-to: index.html :: the Updates pane, `ul.ups`; src/main.ts :: `app.updateAll`; the rail's `data-updates-count`
- kind: explainer
- logged: v0.15.0 · 2026-10-06

The pane was one sentence. It now holds a row for each of the six things that can be installed (three editors, stable and beta); a row shows only when that one is installed, with its small view, name, status and version, and the same actions. A row with a newer version glows. Update all runs the installs one after another and shows only when something is waiting; the rail's Updates item carries the count. When nothing is installed a sentence says so (`:has()` hides it once a row shows). The rows are written by the same patch as everything else, because they carry `data-row` and `data-product`. The date was dropped from the row after it ran under the buttons; it is in Details.

### index.html · Extensions as tiles, with a filter
- refers-to: index.html :: the Extensions pane, `template#ext-row`; src/extensions/library/index.ts :: fill, the filter handlers
- kind: explainer
- logged: v0.15.0 · 2026-10-06

Each extension is a tile on the shared shadow, glowing in its editor's colour under the pointer: its name, who made it and for which editor, what it does, whether it is signed, and a drop-down, What it can use, with its permissions, kind, licence, the editor version it needs and its SHA-256. A row of four buttons filters by editor by setting `data-filter` on the pane; CSS hides the rest, so nothing is rebuilt. Installing an extension is still not built, and the pane says so.

### index.html · Settings says what the hub does not do
- refers-to: index.html :: the Settings list; src/extensions/settings/index.ts :: the `folder` write
- kind: explainer
- logged: v0.15.0 · 2026-10-06

Four rows added: the folder editors are installed in (per system, the same paths as the core's default), and three plain statements: no account, nothing in the background, GPL-3.0.

## v0.14.0 · shadow and glow, and Beta as tiles {#glow}

### src/styles/main.css · how a tile is marked
- refers-to: src/styles/main.css :: `.shelf-item` and its hover and pressed rules, `.row` and `.row:hover`
- kind: explainer
- logged: v0.14.0 · 2026-10-06

The chosen shelf tile had a thin outline in the app's colour and a stripe of it across its top; every row had a stripe down its leading edge. The owner called the highlight a telltale sign and asked for a drop shadow and a glow in the app's colour instead. Every tile now sits on `--shadow-tile`; the chosen one adds `--glow`; one under the pointer adds `--glow-soft`. Rows lost their stripe and the extra padding that made room for it. Removed from the pressed shelf tile:

```css
  box-shadow: inset 0 0 0 1px var(--hue-line), inset 0 var(--sp-1) 0 var(--hue);
```

and from `.row`:

```css
  padding-inline-start: calc(var(--sp-5) + var(--sp-1));
  box-shadow: inset var(--sp-1) 0 0 var(--hue), inset 0 0 0 1px var(--edge);
```

The reasoning and the tokens are in `design/HASHOUT_LOG.md`.

### index.html, src/styles/main.css · Beta is three tiles
- refers-to: index.html :: `ul.tiles` in the Beta pane; src/styles/main.css :: `.tiles` to the tile state rules
- kind: explainer
- logged: v0.14.0 · 2026-10-06

The Beta pane was three plain rows, the same fault the Apps pane had. It is now three tiles, each with the editor's interface on top, its name in its hue, "beta", the status and version, and the actions. A tile whose beta exists or is installed glows in its colour; the others sit on the shadow alone, so the eye goes to what can be had. Each tile carries `data-row="beta"` and `data-product`, so the apps extension writes it with no change, and includes the actions partial by hand. With this, no row with `data-row` is left in the page: the build's insertion of the actions partial into rows (`vite.config.ts`) now matches nothing, and stays only until the next pane needs it or it is removed.

Checked in a browser under 4x CPU: the formcut tile read Beta available 2.7.0-beta.1 with Install, then Installed with Remove and Open; layout shift 0, no node removed.

## v0.13.0 · the Apps pane is a stage, not a list {#stage}

### index.html, src/styles/main.css · the stage and its shelf
- refers-to: index.html :: `section.pane-apps`, `ul.cards`, `div.shelf`; src/styles/main.css :: `.pane-apps` to `.shelf-status`; public/media/formcut.webp, formvis.webp, formwav.webp
- kind: rationale
- logged: v0.13.0 · 2026-10-06

The owner's verdict on the first real window, 2026-10-06: it would make a person think the apps are poor too. It was three plain rows; it showed nothing of what the editors are. A hub's job is to make each app look worth opening before anything is installed.

So the Apps pane now leads with the apps themselves. The upper two thirds of the window is a stage: one editor at a time, its real interface (the captures taken from the running apps in v0.4.0) filling the stage edge to edge, shaded toward the left where its name stands at display size in its own hue, with one line of what it is, two of what it does, its status, version and download size, and its actions as full-size buttons. Under the stage a shelf of three holds a small view of each editor with its name, kind and status; choosing one changes the stage. An editor that is not released still gets its stage, its interface and its words, and simply offers no button.

The pattern is the family's own: formcut.studio opens on a stage with a row of thumbnails. The three captures are the site's, resized to 1600 by 1000 (35 to 71 KB each) and shipped in the hub.

All three stage panels and the shelf are in the page. `data-app` on the pane says which shows; the others are hidden with `visibility`, so their buttons cannot be reached by keyboard. Each panel and each shelf item carries `data-row` and `data-product`, so the apps extension writes their status, version and size exactly as it writes the Beta rows. The stage panels include the actions partial by hand; the build-time insertion still serves the Beta rows.

### src/extensions/stage/index.ts · choosing an editor
- refers-to: src/extensions/stage/index.ts :: the `app.show` command
- kind: explainer
- logged: v0.13.0 · 2026-10-06

A shelf item dispatches `app.show` with its product id; the command sets `data-app` on the pane and `aria-pressed` on the three items. Which editor is on the stage is the window's own business, not the core's, so it is kept here and not in the engine's state.

### src/styles/main.css · .card-meta is a grid of fixed columns
- refers-to: src/styles/main.css :: `.card-meta`
- kind: warning-context
- logged: v0.13.0 · 2026-10-06

Status, version and size first sat in a flowing row. When the status changed length during an install the version and size moved sideways: a measured shift of 0.00007. They now sit in three fixed columns and the shift is 0, at 1180 by 760, 1440 by 900 and 900 by 620 in light, through install, update and switching editors, with no node removed.

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
