# FormPortal demo 2 · Updates and trust

The real FormPortal window, opening on Updates with four updates waiting, FormCut's beta installed beside its stable build, and a Trust page that shows every check FormPortal makes before it installs anything. Open `demos/updates/index.html` by double-clicking it, or serve the folder with any static server. No backend, no network, no CDN.

The other demos: `../../demo/index.html` (installs and files) and `../library/index.html` (fonts, stock and templates). A quiet link row at the foot of the side panel moves between them.

## What you can do

- **Update, Update all, Go back.** Press Update on FormVis, FormLit, FormSkills or FormCut. Each install runs the real order: read the catalogue, check its Ed25519 signature, check the address, download, compare the SHA-256, unpack into a staging folder, move it into place, keep the version it replaced. Go back to the version before swaps them again and holds automatic updates.
- **What changed.** Every row with an update has a fold that shows the release notes, shortened from the apps' own change logs.
- **Beta beside stable.** FormCut 2.6.0 and 2.7.0-beta.1 are installed side by side; each has its own row, version and menu.
- **Update when I close it.** An app that is open (FormCut) is not replaced; the menu offers Update when I close it.
- **Trust page.** Nine cases to try, each stopped by a named check: a catalogue changed after signing, a removed signature, a signature from an unknown key, a lost network (the kept copy is read again), a flipped byte, an http address, a package that writes outside its folder, a package with a link that points outside, and a deleted app folder repaired by SHA-256. Pause at each check holds the run at every step; Next check moves on. The Checks card at the bottom right follows any install from any page.
- **Check a file you have.** Drop or choose a file: its SHA-256 is compared with the catalogue and a zip is looked inside.
- **Verify it yourself.** Save apps.json, apps.json.sig and demo-key.pem, then run the command shown on the page with openssl: it prints `Signature Verified Successfully`.
- **Organisation policy.** The switch pretends a managed computer: beta builds are refused and two Preferences are locked.

## What is simulated

- No app is installed to a disk or run. Packages are stand-in zips built in the page, with real SHA-256 and CRC-32 values.
- The page signs its catalogue with an Ed25519 key it makes on load (WebCrypto) and trusts it for the session. The key compiled into FormPortal belongs to the publisher and cannot sign this catalogue, so the signature proves the checking, not who published.
- Release notes for FormVis, FormLit and FormSkills are shortened from their own CHANGELOG.md files; FormCut's 2.6.2 note summarises its release page.
- Automatic updates start off so the page opens still. Installed apps are remembered in local storage; Reset the demo clears them.

## Browser support

Ed25519 in WebCrypto needs Chrome 137, Firefox 129 or Safari 17.

## Rebuild

```sh
cd demos/updates
node ../../frontend/node_modules/vite/bin/vite.js build --config ./vite.config.mjs
```

It needs the dependencies already installed in `frontend/` and writes only into this folder. It reads `frontend/`, `design/`, `catalog/`, `core/` and `demo/src` (shared helpers, read only). Type check: `node ../../frontend/node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`.

Rationale in `HASHOUT_LOG.md`; every asset in `CREDITS.md`.
