# HASHOUT_LOG · demo · formportal

Living log for the browser demo. Source files stay comment-free; what they would have said lives here.

Current build version: v0.62.0
Last updated: 2026-11-07 · v0.62.0 the offline browser demo

## Why the real interface and a replaced bridge {#bridge}
- refers-to: demo/vite.config.ts · demo/src/pickbridge.ts · frontend/src/bridge/
- kind: decision
- logged: v0.62.0 · 2026-11-07

FormPortal's interface already runs in a browser through the `Bridge` interface and a fixture bridge. The demo builds the real `frontend/index.html` and swaps only `bridge/index.ts` for `pickbridge.ts`, at resolve time and only when `main.ts` imports it, so nothing in `frontend/` is edited. The demo bridge spreads the fixture bridge and replaces what can really run on the page.

## file:// rules {#file}
- refers-to: demo/vite.config.ts :: finishPlugin
- kind: decision
- logged: v0.62.0 · 2026-11-07

Chrome does not run module scripts or fetch files from file://. The build therefore emits one classic IIFE script with `defer`, removes every `crossorigin` attribute and the Inter preload, makes root-absolute `src` and `href` relative, and rewrites the three root-absolute asset strings in frontend modules (`/apps/`, `/store/`, the Inter `url()`) while bundling. Fixed file names keep rebuilds from leaving stale hashed files, since the output shares a folder with the sources and is not emptied.

## Bundled bytes as a classic script {#store}
- refers-to: demo/vite.config.ts :: finishPlugin · demo/src/store.ts
- kind: decision
- logged: v0.62.0 · 2026-11-07

A page on file:// cannot read the bytes of its own sibling files, so the fonts and photographs that are hashed and offered for download ship in `assets/store.js` as a classic script: fonts gzipped then base64, photographs base64. Fonts are inflated with `DecompressionStream` at start and handed to `FontFace` as blob URLs through a thin subclass that maps the app's `./store/fonts/` URLs; the fonts page waits for that before it builds rows. The SHA-256 of the exact original bytes is checked against `core/data/store-fonts.json` and `store-media.json`. Six small families only, to stay under 10 MB.

## The signed catalogue {#catalogue}
- refers-to: demo/src/catalogue.ts
- kind: decision
- logged: v0.62.0 · 2026-11-07

Each release of `catalog/fixtures/apps.json` gets a deterministic stand-in zip (seeded bytes, a manifest, a README), its real SHA-256 and size, and a `demo://` URL. The catalogue body is signed once per load with a fresh Ed25519 key. Every catalogue read verifies the signature first; the bench's tamper switch alters the body after signing so the refusal can be shown. Corrupting a download flips one byte after the package is made and before it is hashed, so the mismatch is the real check failing.

## Files and versions {#library}
- refers-to: demo/src/library.ts · demo/src/bridge.ts
- kind: decision
- logged: v0.62.0 · 2026-11-07

Files live in memory under virtual folders (`/Demo/Samples`, `/Demo/Your files`, `/Picked/...`). Every put is a version with the real SHA-256 and size of its bytes; reverting copies an old version to the top. Extensions FormPortal itself handles (json, zip, formpkg, ttf, otf) are mapped to the portal's id `formai`, and a `.sig` is stored but not listed so the viewer can find a catalogue's signature beside it.

## Open shows the viewer {#open}
- refers-to: demo/src/entry.ts · demo/src/inspect.ts
- kind: decision
- logged: v0.62.0 · 2026-11-07

The real Open refuses a file whose app is not installed. The demo has no apps, so a capture listener opens the viewer first and, when the owning app is not installed, stops the click so the refusal does not fight the viewer. When the app is installed the original handler runs too.

## Upstream CSS the demo works around {#css}
- refers-to: demo/src/demo.css · frontend/src/styles/portal.css
- kind: observation
- logged: v0.62.0 · 2026-11-07

In v0.61.0 `.acts > .btn { display: none }` in `portal.css` hides the Open, Versions and Public link buttons on Files rows, because only install-state rules show them. The app page's More menu is clipped by `.pane-app .hero { overflow: hidden }` and opens off the left edge because it is anchored to the right of a left-aligned button. The demo adds rules in `demo.css` for both and leaves `frontend/` alone; the desktop app should get the same fixes.

## Build {#build}
- refers-to: demo/package.json · demo/vite.config.ts
- kind: decision
- logged: v0.62.0 · 2026-11-07

`demo/` has its own package.json with the same pinned vite, typescript and @types/node as `frontend/`, so no new dependency enters the tree. The config roots at `frontend/`, writes into `demo/` without emptying it, sets `server.host: false` with port 3270 and preview port 3271. `npm run build` type-checks first.
