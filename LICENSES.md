# Licences · formportal

FormPortal is GPL-3.0-only (LICENSE, NOTICE), as formpromo, formMCP and formskills are. Everything in it is distributed to people's machines, so the distributed-build rules apply to all of it. Nothing is added to the tree before it is entered here.

## Desktop app

| Component | Version | Licence | Where |
| --- | --- | --- | --- |
| tauri, tauri-build | 2 (as in Cargo.lock) | MIT or Apache-2.0 | src-tauri, the shell |
| tauri-plugin-single-instance, tauri-plugin-deep-link | 2 (as in Cargo.lock) | Apache-2.0 or MIT | src-tauri: one running copy, and formai:// links |
| tauri-plugin-updater | 2.13.3 | Apache-2.0 or MIT | src-tauri: FormPortal's own signed updates |
| tauri-plugin-dialog | 2.8.2 | Apache-2.0 or MIT | src-tauri: the folder picker for Files |
| What the dialog plugin brings (rfd 0.16, tauri-plugin-fs 2.7, windows-sys and windows-targets builds, read from `cargo metadata` in 0.37.0) | as locked | MIT (rfd); Apache-2.0 or MIT (the rest) | src-tauri |
| What the updater brings (minisign-verify, tar, reqwest, infer, osakit, semver, tempfile and others, read from `cargo metadata`) | as locked | MIT, or MIT or Apache-2.0; no GPL, AGPL or new MPL crate (the MPL-2.0 crates are still Tauri's five, unedited) | src-tauri |
| serde, serde_json | 1 | MIT or Apache-2.0 | core, cli |
| ed25519-dalek 2, base64 0.22, and what ed25519-dalek brings | as locked | BSD-3-Clause (the dalek crates); MIT or Apache-2.0 (the rest) | core, checking the catalogue's signature |
| sha2 0.10, ureq 2, zip 2 | as locked | MIT or Apache-2.0 (sha2, ureq); MIT (zip) | core: hashing, fetching, unpacking |
| What those bring (read from `cargo metadata` in formai_dev 0.17.0) | as locked | MIT or Apache-2.0 for most; Unicode-3.0; ISC; Apache-2.0 and ISC (ring); CDLA-Permissive-2.0 (webpki-roots); BSD-3-Clause (subtle); Zlib. Nothing GPL, LGPL, AGPL or MPL in core | core |
| Tauri's own dependencies (wry, tao and the rest of Cargo.lock) | as locked | permissive or MPL-2.0, unedited (cssparser, cssparser-macros, dtoa-short, option-ext, selectors); to be audited crate by crate before the first release | src-tauri |
| Vite, TypeScript, @types/node | as in frontend/package-lock.json | MIT, Apache-2.0, MIT | frontend, build time only |
| Inter variable font | 4 | SIL OFL 1.1 | frontend/public/fonts, shipped with LICENSE-Inter.txt |
| The system web view (WKWebView, WebView2, WebKitGTK) | the operating system's | the operating system's | never shipped |

## Command line and MCP server

`cli/` (the `formportal` command and its `mcp` server) adds no crate beyond those core already uses.

## Rules

- Permissive licences (MIT, Apache-2.0, BSD, ISC, zlib) anywhere. MPL-2.0 only with its files unedited. LGPL only as a separable binary. Nothing GPL in anything distributed. Nothing AGPL anywhere.
- FormPortal ships no media tools and no models. The apps it installs carry their own ledgers.
