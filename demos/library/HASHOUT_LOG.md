# HASHOUT_LOG · demos/library · formportal

Living log for demo 3. Source files stay comment-free; what they would have said lives here.

Built against: v0.62.3 · 2026-11-07

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
