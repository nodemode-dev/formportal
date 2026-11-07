# FormPortal demo 3 · Fonts, stock and templates

The real FormPortal window, opening on Stock & templates with the Form family's own looks and presets, twelve open fonts and the Learn tutorials. Open `demos/library/index.html` by double-clicking it, or serve the folder with any static server. No backend, no network, no CDN. `#fonts`, `#stock` and `#learn` after the address open that page first.

The other demos: `../../demo/index.html` (installs and files) and `../updates/index.html` (updates and trust). A quiet link row at the foot of the side panel moves between them.

## What you can do

- **Fonts.** Twelve open families, each shown in its own face. Install family, one style from the dots menu, Remove, search and filter by kind. Every install checks the file's SHA-256 against the font index and registers the face on the page. Inter opens with Update available. Add a font file (or drop a TTF or OTF on the window) goes through the rights confirmation and reads the file's name table. Try your fonts opens a stand-in for a Form app's font menu: installed families only, weight, size, italic, and Save specimen writes a PNG.
- **Stock and templates.** Eight CC0 photographs and eleven Apache-2.0 templates, each card with creator and licence. Save puts an item in the Library with its full credit line; Download Library gives a zip with a CREDITS.txt. Use template saves, copies and "opens in" FormCut or FormVFX (both are installed through the real signed-install path when the page first loads).
- **Look viewer** (FormCut stand-in). The .cube is parsed and applied to the photograph with trilinear interpolation, with an intensity blend and a before and after split. Pick another look or photograph, open your own photo, load your own .cube, Save graded photo writes a JPEG.
- **Preset viewer** (FormVFX stand-in). The 169 text animator presets by group, searchable; the pulse shader's source.
- **Learn.** The six FormPortal tutorials plus four for this area; progress is kept and Go there routes to Fonts, Stock and Apps. One is half done on first load, so the page suggests where to continue.
- **Your files.** Drop anything: a font starts Add a font file, a photograph or .cube opens the look viewer, anything else the inspector from demo 1. Files lists the photographs as a Moodboard folder.

## What is simulated

- Nothing is written to a disk and no app is launched: the viewers stand in for the Form app that opens a template, and Use template says so through the real notice only when that app is installed.
- Inter's "earlier build" is a recorded hash that does not match the index, to show the update path; the bytes registered are the current file.
- Saved items, installed fonts from the index, tutorial progress and the two seeded apps are remembered in local storage; your own fonts, photographs and looks are not.
- The font and stock indexes are the bundled starter library, not the formai.studio store.

## Rebuild

```sh
cd demos/library
node ../../frontend/node_modules/vite/bin/vite.js build --config ./vite.config.mjs
```

It needs the dependencies already installed in `frontend/` and writes only into this folder. It reads `frontend/`, `design/`, `catalog/`, `core/data/`, `demo/src` (shared shims, read only) and `media-src/`. Type check: `node ../../frontend/node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`.

Rationale in `HASHOUT_LOG.md`; every asset in `CREDITS.md`.
