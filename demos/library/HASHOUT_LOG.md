# HASHOUT_LOG · demos/library · formportal

Living log for demo 3. Source files stay comment-free; what they would have said lives here.

Built against: v0.71.3 · 2026-11-22

## Rebuilt after v0.71.2 {#rebuild-0-71-3}
- refers-to: demos/library/index.html · demos/library/assets/ · demos/library/README.md
- kind: change
- logged: after v0.71.2 · 2026-11-22

Rebuilt with the command in README.md for Preferences, Keys (../../demo/HASHOUT_LOG.md#rebuild-0-71-3). This demo opens on Stock & templates, so it is where the templates part used to be pushed down by the blocks above it; the interface now hides it with them until the media index is read, and the load shift is 0.

## Rebuilt after v0.71.1 {#rebuild-0-71-2}
- refers-to: demos/library/vite.config.mjs :: `resolveId` · demos/library/src/env.d.ts · demos/library/index.html · demos/library/assets/ · demos/library/apps/formsubstrate*.webp, formpublisher*.webp (subform*.webp removed)
- kind: fix
- logged: after v0.71.1 · 2026-11-22

Rebuilt with the command in README.md at the 0.71 interface, with demo 1's bridge redirect and its outside answers (../../demo/HASHOUT_LOG.md#rebuild-0-71-2); this bridge already spreads demo 1's, so it gets them as they are. `env.d.ts` declares `import.meta.env.DEV`, which the 0.71 notices read and this folder's type check did not know. The demo opens on Stock & templates, where the 0.71 "Your sources" block above the search bar arrived after the bar was drawn and pushed it down (layout shift 0.33 under 4x throttle); the interface now keeps the page's body hidden until both the media index and the sources are read (frontend/HASHOUT_LOG.md#stock-whole), and the shift is 0.

## Rebuilt after v0.70.0 {#rebuild-0-70-1}
- refers-to: demos/library/index.html · demos/library/assets/library.js
- kind: explainer
- logged: after v0.70.0 · 2026-11-20

Rebuilt with the command in README.md, as demo 1 and demo 2 were in the same pass, for two changes: the catalogue's text for other Form apps names Claude Code, Codex, Cursor and Antigravity where that app's README does, and the page carries the dialog that asks before a package handed over from outside the window is installed (frontend/HASHOUT_LOG.md#package-ask). Opened from file:// in headless Chromium at 1180 by 760: the page draws, no console error, 52 four-name sentences in the DOM (42 before).

## Rebuilt after v0.69.0 {#rebuild-0-70}
- refers-to: demos/library/index.html · demos/library/assets/ · demos/library/prepaint.js · demos/library/apps/formrec*.webp
- kind: explainer
- logged: after v0.69.0 · 2026-11-20

Rebuilt with the command in README.md, for the first time since v0.64.0, so this demo carries every interface change since then, as demo 1 did at v0.69.0 (demo/HASHOUT_LOG.md#rebuild-0-69): every sentence of FormPortal's own that lists the agent programs names Claude Code, Codex, Cursor and Antigravity, the AMOLED choice reaches `prepaint.js`, FormRec's icons are copied, and the fonts follow the family's order. Opened from file:// in headless Chromium at 1180 by 760: the page draws, no console error. The descriptions of other apps that name three programs are those apps' own text from `catalog/apps/`, not FormPortal's, and were not changed. At v0.70.0 the Preferences line was moved by hand (the build lane was taken); the rebuild of demos/updates at v0.70.0 changed only that line.

## Same window, a second bridge {#bridge}
- refers-to: demos/library/vite.config.mjs · demos/library/src/pickbridge.ts · demos/library/src/bridge.ts
- kind: decision

As in demo 1, Vite roots at `frontend/` and swaps `bridge/index.ts` for `pickbridge.ts` when `main.ts` imports it. The library bridge spreads demo 1's bridge, so signed installs, Apps and Updates keep working, and overrides fonts, media, learn, files, drop and open. Demo 1's modules are imported by path and never copied. The config is a new file, not a copy: it drops demo 1's own entry, store payload and bench, and is plain `export default {}` so it resolves without a local `vite` install.

## Why demo 1's samples are overridden {#samples}
- refers-to: demos/library/src/bridge.ts :: filesScan, folderPick, onFileDrop
- kind: decision

Demo 1's bridge loads its Northern coast media packs from `assets/media/` whenever Files is scanned, dropped on or picked into. Those packs are not in this folder, so the three entry points are replaced; Files lists the eight stock photographs as a Moodboard folder through demo 1's in-memory library model instead.

## Opening on a page {#launch}
- refers-to: demos/library/src/launch.js
- kind: decision

The portal already styles `html[data-launch]` so the right pane is visible before script runs. A classic script in the head sets it from the address hash, defaulting to stock, so nothing swaps after first paint.

## Seeded state {#seed}
- refers-to: demos/library/src/state.ts · demos/library/src/bridge.ts :: seeded
- kind: decision

A finished-looking first screen needs history: FormCut and FormVFX installed (through the real install, awaited inside `installs()` and `media()` before the engine paints), three fonts from the index installed, Inter recorded under an older hash so Update available shows, three items saved, one tutorial half done. All of it lives under one local storage key, and Reset the demo removes it.

## Fonts really register {#fonts}
- refers-to: demos/library/src/fonts.ts
- kind: decision

Install reads the bundled bytes, checks the SHA-256 against `core/data/store-fonts.json`, and adds a `FontFace` under the family's real name with a `100 900` weight range for variable files, so the type tester can move the weight axis. Remove deletes the face. Own fonts take the name from the sfnt name table (demo 1's reader) and are not remembered.

## Looks {#looks}
- refers-to: demos/library/src/looks.ts · demos/library/src/viewer.ts
- kind: decision

The .cube is parsed (size, domain, rows with red fastest) and applied with trilinear interpolation and an intensity blend on a 960 px copy for display; Save regrades the full image up to 2048 px. The viewer canvases and a 3:2 stage are in the page from the start, so a change of look or photograph repaints in place. The split is one CSS variable moved by an invisible range input, so keyboard use works.

## Templates beyond the one in the index {#templates}
- refers-to: demos/library/media-src/templates.json
- kind: decision

The starter index ships one template. The demo adds ten real files from sibling repos (eight FormEncoder looks, FormVFX text animator presets, FormCut's pulse shader), each with its commit URL and SHA-256. The looks open in FormCut because its Creator tool takes a .cube under 3D LUT; the preset file opens in FormVFX. FormEncoder is public and authored the looks, so the cards name it as their author, while the viewer that applies them stays FormCut's stand-in: FormCut is the Form app whose Creator tool takes a .cube, and the demo seeds it as installed. The eight look thumbnails are the looks applied to eight different photographs.

## Learn {#learn}
- refers-to: demos/library/src/tutorials.json
- kind: decision

The six real tutorials plus four written for this area, each describing only behaviour found in `frontend/src/extensions` or in FormCut's Creator tool markup. The fixture's placeholder "Make your first cut" tutorial is not used.

## Extra markup {#markup}
- refers-to: demos/library/vite.config.mjs :: portalPlugin
- kind: decision

Three controls are added to the built page only: Try your fonts and Download Library beside existing block headers, and the demo link row under Help (hidden in the mini rail). Dialogs come from `src/bench.html`; demo 1's inspector dialog is lifted from its `bench.html` at build time so Open on an app or a file still works.

## Limits {#limits}
- refers-to: demos/library/README.md
- kind: observation

Needs Chrome 137, Firefox 129 or Safari 17 for demo 1's Ed25519 signing. The page tool could not fetch Commons file pages, so photograph licences were read through the Commons API. The new files need LICENSES.md rows in the repository (listed in the report).
