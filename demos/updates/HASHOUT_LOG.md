# HASHOUT_LOG · demos/updates · formportal

Living log for demo 2. Source files stay comment-free; what they would have said lives here.

Built against: v0.62.3 · 2026-11-07

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
