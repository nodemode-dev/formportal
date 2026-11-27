# HASHOUT_LOG · demos/updates · formportal

Living log for demo 2. Source files stay comment-free; what they would have said lives here.

Built against: v0.73.2 · 2026-11-26

## Rebuilt after v0.71.7 {#rebuild-0-71-8}
- refers-to: demos/updates/assets/portal.js
- kind: change
- logged: after v0.71.7 · 2026-11-25

Rebuilt with the command in README.md for the family count on Home (../../demo/HASHOUT_LOG.md#rebuild-0-71-8). Only the script changed; `index.html` is as before.

## Rebuilt after v0.71.6 {#rebuild-0-71-7}
- refers-to: demos/updates/assets/portal.js
- kind: change
- logged: after v0.71.6 · 2026-11-25

Rebuilt with the command in README.md for the two groups that changed places in the built-in schedule (../../demo/HASHOUT_LOG.md#rebuild-0-71-7, ../../core/HASHOUT_LOG.md#schedule-25-november). Only the script changed; `index.html` is as before.

## Rebuilt after v0.71.5 {#rebuild-0-71-6}
- refers-to: demos/updates/index.html · demos/updates/assets/portal.js
- kind: change
- logged: after v0.71.5 · 2026-11-23

Rebuilt with the command in README.md for the Preferences button in the top bar and its removal from the side panel and the rail (../../demo/HASHOUT_LOG.md#rebuild-0-71-6, ../../frontend/HASHOUT_LOG.md#prefs-top). Opened from file:// under 4x throttle on its own first page, then Preferences from the new button: layout shift 0, no console error.

## Rebuilt after v0.71.3 {#rebuild-0-71-4}
- refers-to: demos/updates/index.html · demos/updates/assets/
- kind: change
- logged: after v0.71.3 · 2026-11-23

Rebuilt with the command in README.md for the Apps sections, the row columns, the side window and local dates (../../frontend/HASHOUT_LOG.md#apps-sections, #row-columns, #app-window, #local-dates), and FormPublisher in the fixture; rebuilt again for the status column and the install-window layout (#row-status, #app-window-2). Opened from file:// under 4x throttle: the `···` on a row opens the side window for that app, layout shift 0, no console error.

## Rebuilt after v0.71.2 {#rebuild-0-71-3}
- refers-to: demos/updates/index.html · demos/updates/assets/ · demos/updates/README.md
- kind: change
- logged: after v0.71.2 · 2026-11-22

Rebuilt with the command in README.md for Preferences, Keys (../../demo/HASHOUT_LOG.md#rebuild-0-71-3); the key calls come from demo 1's `outside.ts` and are kept in the page's memory.

## Rebuilt after v0.71.1 {#rebuild-0-71-2}
- refers-to: demos/updates/vite.config.mjs :: `resolveId`, the release-notes patch removed · demos/updates/src/bridge.ts :: `demoBridge` · demos/updates/src/demo.css · demos/updates/raw.d.ts · demos/updates/index.html · demos/updates/assets/ · demos/updates/apps/formsubstrate*.webp, formpublisher*.webp (subform*.webp removed)
- kind: fix
- logged: after v0.71.1 · 2026-11-22

Rebuilt with the command in README.md at the 0.71 interface, with demo 1's bridge redirect, and the bridge now spreads demo 1's outside answers (`src/outside.ts`) after the fixture. 0.71's rows carry their own What changed, opening in place under the row, so the build's patch that added a `<details class="row-notes">` to every Updates row and the demo.css rules for it are gone: left in, they took the interface's class name and made every row two lines taller with an empty fold. `raw.d.ts` declares `import.meta.env.DEV` for the type check. Updates, What changed opened by a click, and Trust: layout shift 0, no console error, no outside request.

## Rebuilt after v0.70.0 {#rebuild-0-70-1}
- refers-to: demos/updates/index.html · demos/updates/assets/portal.js
- kind: explainer
- logged: after v0.70.0 · 2026-11-20

Rebuilt with the command in README.md, as demo 1 and demo 3 were in the same pass, for two changes: the catalogue's text for other Form apps names Claude Code, Codex, Cursor and Antigravity where that app's README does, and the page carries the dialog that asks before a package handed over from outside the window is installed (frontend/HASHOUT_LOG.md#package-ask). Opened from file:// in headless Chromium at 1180 by 760: the page draws, no console error, 52 four-name sentences in the DOM (42 before).

## Rebuilt after v0.69.0 {#rebuild-0-70}
- refers-to: demos/updates/index.html · demos/updates/assets/ · demos/updates/prepaint.js · demos/updates/apps/formrec*.webp
- kind: explainer
- logged: after v0.69.0 · 2026-11-20

Rebuilt with the command in README.md, for the first time since v0.64.0, so this demo carries every interface change since then, as demo 1 did at v0.69.0 (demo/HASHOUT_LOG.md#rebuild-0-69): every sentence of FormPortal's own that lists the agent programs names Claude Code, Codex, Cursor and Antigravity, the AMOLED choice reaches `prepaint.js`, FormRec's icons are copied, and the fonts follow the family's order. Opened from file:// in headless Chromium at 1180 by 760: the page draws, no console error. The descriptions of other apps that name three programs are those apps' own text from `catalog/apps/`, not FormPortal's, and were not changed. The release commit rebuilds it again so the Preferences line carries the new version.

## Same window, a different bridge {#bridge}
- refers-to: demos/updates/vite.config.mjs · demos/updates/src/pickbridge.ts · demos/updates/src/bridge.ts
- kind: decision

As in demo 1, Vite roots at `frontend/` and swaps `bridge/index.ts` for `pickbridge.ts` when `main.ts` imports it. The bridge here keeps the real engine, panes and CSS and replaces only the shell, so every Update, Go back and install runs through the interface's own code. Demo 1's helpers (`util.ts`) are imported by path, never copied.

## Every artifact is a real zip {#packs}
- refers-to: demos/updates/src/world.ts · demos/updates/src/pack.ts · demos/updates/src/unpack.ts
- kind: decision

Each release gets a stand-in zip written in the page with real CRC-32 values; the catalogue records its SHA-256 and is signed with an Ed25519 key made on load. The checks that refuse a file therefore compare real numbers, and the stand-in package saved from the Trust page unzips and verifies outside the browser. A flipped byte makes `unzip -t` report a bad CRC.

## The compiled key cannot sign {#keys}
- refers-to: demos/updates/src/world.ts :: COMPILED_KEYS
- kind: decision

The publisher's private key is not in any repository, so the page signs with its own key and says so on the Trust page. The signature check is the real one; what it proves is the checking, not who published.

## Cases are ordinary inputs {#cases}
- refers-to: demos/updates/src/cases.ts
- kind: decision

Each case alters what the engine receives (the catalogue body or signature, the download bytes, an address, an archive's entries or an installed folder), never the check. The altered catalogue is not stored; Check for updates now reads the clean one again. Package cases are rewritten and re-hashed, so only the unpack check can stop them.

## Checks card and Pause {#trail}
- refers-to: demos/updates/src/trail.ts · demos/updates/src/trust.ts
- kind: decision

The engine's steps are reported to a trail that both the Trust page and the bottom card paint in place: a list built once per run and patched afterwards, so steps tick without the list being rebuilt. Pause at each check holds before every step until Next check, and routes to Trust when a run starts.

## Quiet start {#quiet}
- refers-to: demos/updates/src/shim.ts · demos/updates/src/trust.ts :: paintCard
- kind: decision

The opening catalogue read does not open the card, automatic updates start off, and the five-minute update timer is shortened to four seconds, so the first screen is still and a visitor sees an update only when they press it.

## Layout fix {#layout}
- refers-to: demos/updates/src/demo.css :: .tr-page .agent-acts
- kind: bug

At 1440 px the buttons under "Check a file you have" overflowed into the next column and the policy note overlapped the switch label. The action rows wrap now and the switch keeps its size.

## Removed pages {#gone}
- refers-to: demos/updates/vite.config.mjs :: GONE
- kind: decision

Files, Fonts, Stock, Extensions and Learn are left out: demo 1 and demos/library cover them and a second copy would only repeat them.

## Release notes {#notes}
- refers-to: demos/updates/src/releases.ts
- kind: decision

Notes are the apps' own change log lines, shortened, so a visitor reads real release history for FormVis, FormLit and FormSkills. The fold is added to each Updates row at build time and filled by the app's own `[data-field=notes]` patching.

## Dev server port {#port}
- refers-to: demos/updates/vite.config.mjs :: PORT · demo/vite.config.ts :: DEMO_PORT, preview.port
- kind: fix
- logged: v0.63.7 · 2026-11-10

This dev server used port 3271, which demo 1's `vite preview` also claims (`DEMO_PORT + 1`); both set `strictPort`, so whichever started second failed. It now uses 3272, which no other config in the tree names (demo 1 3270 and 3271, demos/library 3280, the interface 3250 and 3251). Checked by searching the tree for the port numbers; the server was not started.
