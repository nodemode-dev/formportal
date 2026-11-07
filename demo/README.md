# FormPortal demo

The real FormPortal interface, running in a browser with nothing behind it. Open `demo/index.html` by double-clicking it, or serve the `demo/` folder with any static server. No backend, no Tauri, no network and no CDN: every script, style, font, icon and sample is in this folder.

## What it shows

The interface is the repository's own (`frontend/`): its tokens, its inline icons, its panes and its Form family look. Only the bridge to the desktop shell is replaced, by a client-side one in `demo/src/`, so these things really run on the page:

- **Signed catalogue, checked installs.** On load the demo builds a catalogue from `catalog/fixtures/apps.json`, writes a real zip package for every release inside the page, records each package's SHA-256, and signs the catalogue with an Ed25519 key made on the spot (WebCrypto). Install and Update check the signature, then the package's SHA-256, then every entry's CRC-32, and only then record the install. Update keeps the version it replaced, Go back swaps them, Remove deletes, and Open re-checks the installed package against the catalogue and shows its entries. Installs survive a reload (local storage).
- **Refusing a bad download.** The Demo bench (the flask button, top right) can corrupt the next download by one byte or alter the catalogue after it was signed. The install or the catalogue read is refused with the reason, and nothing is recorded.
- **Your files, with history.** Drop any file on the window, or use Add files in the bench, or Add a folder under Files. Each file is listed under the Form app that opens it and keeps a version each time it changes; Versions lists them with their sizes, and Go back to this restores one as the newest.
- **A viewer for what you drop.** Open shows what is inside by content: an image with its pixel size, a WAV, Ogg or MP3 with its waveform and a player, a video with a player and its size, a PDF with its page count, title and first page, a font with its own name table and a type specimen, a zip or .formpkg with every entry's CRC-32 and SHA-256, a catalogue with its structure checked and its signature verified (beside a `.sig` file, against this demo's key or the formai.studio key FormPortal trusts), text you can edit and keep as a new version, and a hex view for anything else.
- **Fonts.** Six of the repository's open-licensed families ship compressed inside the page. Install decompresses one, checks its SHA-256 against the font index, and registers it. Add your own TTF or OTF reads its name table and registers it too.
- **Stock and templates.** The repository's nine public-domain and Apache-2.0 files save as a zip with their credit line, after a SHA-256 check.

With no file of your own, the Files page already holds real media. The Northern coast folder has four photographs, a 12 second golden-hour clip, a 75 second public-domain piano piece and a five-page PDF of field notes typeset from the photographs; Reference has four screenshots of Form apps, a markdown note, the signed catalogue with its signature, a package zip and a font. Open plays the video and the music, shows the PDF's pages and title with its first page, and shows each photograph with its pixel size. Every file's source, author and licence is in `CREDITS.md`.

## What is simulated

- The desktop installs: no app is run or written to disk. The package is a stand-in zip, not the app.
- The signing key is made fresh on every load, so the catalogue's signature proves the checking works, not who published it.
- Fonts and files you add live in memory and are gone on reload. Installed apps are remembered.
- Open on a file whose app is not installed shows the viewer instead of the "install the app first" error.
- Only six font families and nine stock files are bundled, and the sample media is one short clip, one short piece and four photographs, to keep the folder under 25 MB.
- The PDF viewer shows the first page as an image made at build time and does not render the PDF itself.

## Browser support

A current Chromium, Firefox or Safari. Ed25519 in WebCrypto needs Chrome 137, Firefox 129 or Safari 17.

## Rebuild

```sh
cd demo
npm ci
npm run build
```

The build reads `frontend/`, `design/`, `catalog/` and `core/data/`, and writes `index.html`, `assets/`, and the icons, hero images, thumbnails and fonts it uses into this folder. The output is committed so file:// works with no install. The dev server (`npx vite`) listens on 127.0.0.1:3270 only.

## Notes

Rationale and decisions are in `HASHOUT_LOG.md`.
