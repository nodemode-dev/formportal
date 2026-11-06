# The store

Fonts, Stock and templates, and Extensions each show two things merged into one list: the starter library that ships inside FormPortal, and whatever the formai.studio store offers right now. The starter library is always there, so none of the three pages is ever empty because the network is slow or the store is down. The store adds to it and can replace a starter item by publishing the same `id`.

## Where FormPortal looks

For each page, in this order, the first answer wins:

1. An organisation's policy, when it locks the catalogue: `<catalogue folder>/fonts.json`, `media.json` or `extensions.json`.
2. The formai.studio store: `https://formai.studio/catalog/v1/fonts.json`, `/media.json`, `/extensions.json`.
3. The folder beside the app catalogue: `https://dl.formai.studio/catalog/fonts.json` and so on.

Each index needs its detached signature beside it (`fonts.json.sig`, and so on): base64 Ed25519 over the exact bytes served, made with the catalogue key whose public half is in `core/catalog_keys.txt`. The site already signs `/catalog/v1/apps.json` with that key (`site/backend/app/main.py`, `signed_catalog`), so the store indexes can be signed the same way. An unsigned or tampered index is refused and the page keeps the starter library. Requests have a 4 s connect and 10 s read limit and run after the window has painted, so a slow store never delays the app.

## What the site serves

| Route | Body | Shape |
|---|---|---|
| `GET /catalog/v1/fonts.json` and `.sig` | the font index | `formai-fonts`, see [Fonts](Fonts) |
| `GET /catalog/v1/media.json` and `.sig` | photos, footage, audio and templates | `formai-media`, see [Stock and Templates](Stock-and-Templates) |
| `GET /catalog/v1/extensions.json` and `.sig` | extension packages | `formai-extensions`, `catalog/schema/extensions.schema.json` |

Rules every entry must meet, or FormPortal refuses it:

- `url` is `https://`. FormPortal downloads it and checks `sha256` and `bytes` before anything lands on disk.
- `licence` is on the allow list: fonts OFL-1.1, Apache-2.0 or MIT; media CC0-1.0, CC-BY-4.0, CC-BY-SA-4.0, Apache-2.0, MIT or OFL-1.1. Media needs `creator` and `source_url` for the credit line.
- Media `thumbnail` is an `https://` PNG, JPEG or WebP of at most 512 KB. Font files are TTF or OTF (no WOFF).
- Extensions follow `package.schema.json`: the zip has `manifest.json` at its root with `format: formai-package`, and its `id`, `product` and `version` equal the index entry's. A native extension also needs a publisher signature.
- `id`s stay stable between releases: installed fonts are matched to updates by family `id` and style name.

## The starter library

`core/data/store-fonts.json`, `store-media.json` and `store-extensions.json` list it; the files are in `frontend/public/store/` and are compiled into the app. Their `url`s use `bundled:<path>`, which FormPortal reads from its own files (or, for the command line, from `FORMPORTAL_STORE` or the repository's `frontend/public/store`), then checks against the same `sha256` as a download. Starter thumbnails are app paths (`/store/thumbs/<id>.webp`) and show without any network. Licences for every starter file are in `LICENSES.md`.

To change the starter library: put the file under `frontend/public/store/`, add its entry with real `bytes` and `sha256`, add its row to `LICENSES.md`, and keep the whole library small (it ships in every installer; about 7 MB in v0.60.0).

## What each page says

A line under each page's intro says where the list came from: the store (a green dot) or the starter library alone (a grey dot, with "The formai.studio store adds more here when it is reachable"). The command line reports the same as `index_error` when the store was not reached.
