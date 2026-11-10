# HASHOUT_LOG · demo · formportal

Living log for the browser demo. Source files stay comment-free; what they would have said lives here.

Current build version: v0.63.6
Last updated: 2026-11-07 · v0.62.1 real media in Files, viewers for video, compressed audio and PDF, no hero captures; 2026-11-07 · v0.62.0 the offline browser demo

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

## Real media in Files {#media}
- refers-to: demo/src/media.ts · demo/src/samples.ts · demo/assets/media/
- kind: decision
- logged: v0.62.1 · 2026-11-07

Files opens on a curated "Northern coast" folder, not generated placeholders: four Pexels photographs, a 12 second golden-hour clip, a 75 second public-domain piano piece and a five-page PDF of field notes, with a Reference folder holding four screenshots of Form apps taken from the sibling demos' verified opening screens, not from their docs/images hero captures, which contain photographs whose licence cannot be verified (the verifier failed v0.62.1 on exactly this). Each visible photograph, clip and recording is listed in CREDITS.md. The PDF is typeset for the demo with ReportLab and Instrument Serif (SIL OFL, already in the repository, the only font and embedded in full use, no base-14 reference left) from the four photographs; NASA's Earth as Art on Commons was the first choice but Wikimedia rate-limited the shared build host for over half an hour, so it was dropped rather than waited for. Each file ships as its own classic script in `assets/media/` that sets one entry of `window.__FORMPORTAL_MEDIA__` to base64 data and a small preview, because file:// cannot read sibling files. `media.ts` injects the script tags on demand, `samples.ts` loads them in parallel before the first Files scan, and the rows appear in the page's own list, so nothing is rebuilt after it shows. The generated poster and tone stay only as the fallback when no pack loads. Provenance is in `CREDITS.md`.

## Viewer kinds for real files {#viewer}
- refers-to: demo/src/inspect.ts
- kind: decision
- logged: v0.62.1 · 2026-11-07

Real files need real viewers. Video plays in a `video` element at a reserved 280 px height with its build-time poster. Compressed audio (Ogg or MP3) is decoded with an `OfflineAudioContext` for its length, channel count and waveform, and plays in an `audio` element. A PDF shows its page count and title read from the file and the first page as an image rendered when the demo was built: the demo does not embed a PDF engine, and the dialog says so. Files rows use the same preview image for thumbnails, so video, PDF and photographs have a tile on first paint.

## No hero captures {#heroes}
- refers-to: demo/vite.config.ts :: plateHeroes
- kind: decision
- logged: v0.62.1 · 2026-11-07

`frontend/public/heroes/` holds window captures of the apps (Venice and other panoramas in FormCut, a rainy neon city in FormVis, coast photographs in FormLit, and others) whose photographs carry no verifiable licence. The demo therefore neither copies them nor shows them: after the markup is built, `plateHeroes` swaps each app page's hero image pair for the same icon plate `frontend/markup.ts` uses for an app with no capture, so the page keeps its layout. `frontend/` is untouched; the desktop app's captures need the same review upstream.

## Media sources and their limits {#sources}
- refers-to: demo/CREDITS.md
- kind: observation
- logged: v0.62.1 · 2026-11-07

freepd.com is closed, so the music is a Musopen recording on Wikimedia Commons whose page states the public domain. Pexels search pages disallow robots, so candidates came from web search results for individual photo and video pages, and each page was opened before its file was downloaded. Wikimedia's servers rate-limited the shared build host for several minutes; the downloads were retried with a pause rather than worked around. The page tool also could not fetch the music's Commons file page, so its description, author and licence text were read through the Commons API, which serves the same page data.
