# Licences · formportal

FormPortal is GPL-3.0-only (LICENSE, NOTICE), as FormPromo, FormMCP and FormSkills are. Everything in it is distributed to people's machines, so the distributed-build rules apply to all of it. Nothing is added to the tree before it is entered here.

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
| sha1 0.10 | as locked (already present through keyring) | MIT or Apache-2.0 | core: git blob hashes, so sharing sends only changed files (0.48.0) |
| keyring 3.6.3 (macOS: apple-native; Windows: windows-native; Linux: sync-secret-service with crypto-rust) | 3.6.3 | MIT or Apache-2.0 | core: the optional GitHub sign-in's token, kept in the system keychain (0.47.0) |
| What keyring brings (read from `cargo metadata` in 0.47.0): dbus-secret-service 4.1.0, dbus 0.9, libdbus-sys 0.2, aes, cbc, cipher, hkdf, hmac, inout, block-padding, the num crates, rand 0.8 and rand_chacha, sha1, zeroize_derive, security-framework 2.11 on macOS; the lockfile also lists secret-service 4.0.0 and the zbus 4 crates, which the Linux build does not use | as locked | MIT or Apache-2.0; MIT (nix, cfg_aliases, xdg-home, the zbus and zvariant crates); BSD-2-Clause or Apache-2.0 or MIT (zerocopy, under MIT). Nothing GPL, LGPL, AGPL or MPL | core |
| libdbus-1 (the system's D-Bus library, which libdbus-sys links on Linux) | the operating system's | AFL-2.1 or GPL-2.0-or-later, used under AFL-2.1 | Linux only, dynamically linked from the system, never shipped |
| What those bring (read from `cargo metadata` in formai_dev 0.17.0) | as locked | MIT or Apache-2.0 for most; Unicode-3.0; ISC; Apache-2.0 and ISC (ring); CDLA-Permissive-2.0 (webpki-roots); BSD-3-Clause (subtle); Zlib. Nothing GPL, LGPL, AGPL or MPL in core | core |
| Tauri's own dependencies (wry, tao and the rest of Cargo.lock) | as locked | permissive, plus the crates under other licences listed in "Crate audit" below | src-tauri |
| objc2 0.6, objc2-app-kit 0.3, objc2-foundation 0.3 (already in Cargo.lock through tao; direct since 0.56.0 and 0.57.0) | as locked | MIT | src-tauri, macOS only: the rounded splash, the traffic lights, the Dock icon |
| reveal.rs, traffic_lights.rs and the splash card, from formvis v1.99.7 (nodemode-dev/formvis, the same owner) | 0.56.0 | Apache-2.0 in formvis, compatible with GPL-3.0-only here | src-tauri/src, frontend/public/splash.* |
| The Form app icons, v3 dark and light (the owner's own artwork) | 0.57.0 | the owner's, shipped as part of FormPortal | frontend/public/apps, frontend/public/favicon*.png, src-tauri/icons |
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

## Starter library (Fonts, Stock and templates)

Since v0.60.0 FormPortal ships a starter library in `frontend/public/store/`, built into the app and listed by `core/data/store-fonts.json`, `store-media.json` and `store-extensions.json`. Every file is unmodified from its source except the photographs, which are resized to their published size and stripped of metadata, and the font files, which are renamed only (the fonts themselves are untouched, so no Reserved Font Name is affected).

| Item | Licence | Copyright or author | Source |
|---|---|---|---|
| Inter | OFL-1.1 | Copyright 2020 The Inter Project Authors | https://github.com/google/fonts/tree/main/ofl/inter |
| Manrope | OFL-1.1 | Copyright 2018 The Manrope Project Authors | https://github.com/google/fonts/tree/main/ofl/manrope |
| DM Sans | OFL-1.1 | Copyright 2014 The DM Sans Project Authors | https://github.com/google/fonts/tree/main/ofl/dmsans |
| Space Grotesk | OFL-1.1 | Copyright 2020 The Space Grotesk Project Authors | https://github.com/google/fonts/tree/main/ofl/spacegrotesk |
| Bricolage Grotesque | OFL-1.1 | Copyright 2022 The Bricolage Grotesque Project Authors | https://github.com/google/fonts/tree/main/ofl/bricolagegrotesque |
| Syne | OFL-1.1 | Copyright 2017 The Syne Project Authors | https://github.com/google/fonts/tree/main/ofl/syne |
| Fraunces | OFL-1.1 | Copyright 2018 The Fraunces Project Authors | https://github.com/google/fonts/tree/main/ofl/fraunces |
| Lora | OFL-1.1 | Copyright 2011 The Lora Project Authors, Reserved Font Name "Lora" | https://github.com/google/fonts/tree/main/ofl/lora |
| Instrument Serif | OFL-1.1 | Copyright 2022 The Instrument Serif Project Authors | https://github.com/google/fonts/tree/main/ofl/instrumentserif |
| JetBrains Mono | OFL-1.1 | Copyright 2020 The JetBrains Mono Project Authors | https://github.com/google/fonts/tree/main/ofl/jetbrainsmono |
| IBM Plex Mono | OFL-1.1 | Copyright 2017 IBM Corp., Reserved Font Name "Plex" | https://github.com/google/fonts/tree/main/ofl/ibmplexmono |
| Caveat | OFL-1.1 | Copyright 2014 The Caveat Project Authors | https://github.com/google/fonts/tree/main/ofl/caveat |
| Eight photographs (portrait in a headwrap, coffee at a market, alpine valley, sunset storm cloud, bicycle in snow, peppers, Trajan's Market, tea with lemon) | CC0-1.0 | Wilfredor, DimiTalen, Jebulon, Nayan j Nath on Wikimedia Commons | each item's `source_url` in `core/data/store-media.json` |
| FormCut gentle warm colour LUT | Apache-2.0 | Copyright 2026 NodeAgentc, Inc. | https://github.com/nodemode-dev/formcut/blob/1e9b4f3bb664b7b0fae0ab9d209d9e2d8a3852e9/examples/gentle-warm.cube |

Fonts came from google/fonts at commit 86aced91de05cd4f96a06838124cca45be337b2b; each family's full OFL text is beside its files. CC0 covers copyright only: two photographs show identifiable people and no model release is known, so they are offered for editorial and creative use and the credit line travels with them. Items the formai.studio store adds at run time carry their own licences in the signed store index; FormPortal refuses any licence outside the allow lists in `core/src/fonts.rs` and `core/src/media.rs`.

## Rules

- Permissive licences (MIT, Apache-2.0, BSD, ISC, zlib) anywhere. MPL-2.0 only with its files unedited. LGPL only as a separable binary. Nothing GPL in anything distributed. Nothing AGPL anywhere.
- FormPortal ships no media tools and no models. The apps it installs carry their own ledgers. The only content it ships is the starter library above.
