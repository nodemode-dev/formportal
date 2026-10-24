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
| What the updater brings (minisign-verify, tar, reqwest, infer, osakit, semver, tempfile and others, read from `cargo metadata`) | as locked | MIT, or MIT or Apache-2.0; no GPL, AGPL or new MPL crate (the MPL-2.0 crates are still Tauri's four, unedited; see the crate audit below) | src-tauri |
| serde, serde_json | 1 | MIT or Apache-2.0 | core, cli |
| ed25519-dalek 2, base64 0.22, and what ed25519-dalek brings | as locked | BSD-3-Clause (the dalek crates); MIT or Apache-2.0 (the rest) | core, checking the catalogue's signature |
| sha2 0.10, ureq 2, zip 2 | as locked | MIT or Apache-2.0 (sha2, ureq); MIT (zip) | core: hashing, fetching, unpacking |
| keyring 3.6.3 (macOS: apple-native; Windows: windows-native; Linux: sync-secret-service with crypto-rust) | 3.6.3 | MIT or Apache-2.0 | core: the optional GitHub sign-in's token, kept in the system keychain (0.47.0) |
| What keyring brings (read from `cargo metadata` in 0.47.0): dbus-secret-service 4.1.0, dbus 0.9, libdbus-sys 0.2, aes, cbc, cipher, hkdf, hmac, inout, block-padding, the num crates, rand 0.8 and rand_chacha, sha1, zeroize_derive, security-framework 2.11 on macOS; the lockfile also lists secret-service 4.0.0 and the zbus 4 crates, which the Linux build does not use | as locked | MIT or Apache-2.0; MIT (nix, cfg_aliases, xdg-home, the zbus and zvariant crates); BSD-2-Clause or Apache-2.0 or MIT (zerocopy, under MIT). Nothing GPL, LGPL, AGPL or MPL | core |
| libdbus-1 (the system's D-Bus library, which libdbus-sys links on Linux) | the operating system's | AFL-2.1 or GPL-2.0-or-later, used under AFL-2.1 | Linux only, dynamically linked from the system, never shipped |
| What those bring (read from `cargo metadata` in formai_dev 0.17.0) | as locked | MIT or Apache-2.0 for most; Unicode-3.0; ISC; Apache-2.0 and ISC (ring); CDLA-Permissive-2.0 (webpki-roots); BSD-3-Clause (subtle); Zlib. Nothing GPL, LGPL, AGPL or MPL in core | core |
| Tauri's own dependencies (wry, tao and the rest of Cargo.lock) | as locked | permissive, plus the crates under other licences listed in "Crate audit" below | src-tauri |
| Vite, TypeScript, @types/node | as in frontend/package-lock.json | MIT, Apache-2.0, MIT | frontend, build time only |
| Inter variable font | 4 | SIL OFL 1.1 | frontend/public/fonts, shipped with LICENSE-Inter.txt |
| The system web view (WKWebView, WebView2, WebKitGTK) | the operating system's | the operating system's | never shipped |

## Crate audit

Audited 2026-10-23 with `cargo metadata --format-version 1 --locked` on the one Rust workspace (`core`, `cli`, `src-tauri`; Cargo.lock at the repository root, FormPortal 0.44.4). The audit covered the 439 crates linked into a shipped binary through normal dependencies, excluding build-dependencies and proc-macros, on all target platforms. Every crate is MIT, Apache-2.0, MIT OR Apache-2.0, BSD, ISC, Zlib, Unicode, CC0 or a combination of these, except the crates below. No GPL, AGPL or LGPL-only crate is linked. Crates offered as Unlicense OR MIT (aho-corasick, memchr, jiff and others), 0BSD OR MIT OR Apache-2.0 (adler2) and MIT OR Apache-2.0 OR BSD-1-Clause (fiat-crypto) are used under MIT.

## Desktop shell: crates under other licences

Tauri links these crates unedited (no `[patch]` and no vendored copy):

| Crate | Licence | Why it is there |
| --- | --- | --- |
| cssparser 0.37.0, selectors 0.38.0, dtoa-short 0.3.5, option-ext 0.2.0 | MPL-2.0 | Tauri's HTML handling (tauri-utils); used unmodified, source at crates.io |
| ring 0.17.14 | Apache-2.0 AND ISC | TLS for the updater and for ureq (rustls) |
| webpki-roots 0.26.11 and 1.0.9, webpki-root-certs 1.0.9 | CDLA-Permissive-2.0 | root certificates for TLS |
| r-efi 5.3.0 and 6.0.0 | MIT OR Apache-2.0 OR LGPL-2.1-or-later | used under MIT |

The Linux AppImage also carries the build machine's WebKitGTK, GTK and GLib (LGPL-2.1-or-later) as separate shared libraries.

## Command line and MCP server

`cli/` (the `formportal` command and its `mcp` server) adds no crate beyond those core already uses.

## Rules

- Permissive licences (MIT, Apache-2.0, BSD, ISC, zlib) anywhere. MPL-2.0 only with its files unedited. LGPL only as a separable binary. Nothing GPL in anything distributed. Nothing AGPL anywhere.
- FormPortal ships no media tools and no models. The apps it installs carry their own ledgers.
