---
name: engine-core
description: Changes to formportal-core, FormPortal's Rust engine. Use for catalogue types or parsing, the channel view, signature verification and trusted keys, downloading and hashing, unpacking (zip, AppImage, new kinds such as dmg, msi, deb), the installed-state file, rollback, uninstall, launching, or install folders.
---

# engine-core

## Files

- `lib.rs`: `Catalog`, `Product`, `Release`, `Artifact`, `Channel`, `Platform`, `Availability`, `Catalog::view`. Field names follow formai_dev's `catalog/schema/apps.schema.json` (snake_case); a new field is optional with `serde(default)` until every catalogue carries it.
- `portal.rs`: `Portal` with `default_root` (honours `FORMPORTAL_ROOT`), `catalog` (fetch, verify, keep the last good copy), `install` (download, hash, unpack to a staging folder, swap, keep previous), `rollback`, `uninstall`, `launch_target`, `launch`.
- `download.rs`: https or loopback only; streams with progress; `sha256_file`.
- `signature.rs`: Ed25519 over the catalogue bytes; `TRUSTED_KEYS` is empty until formai.dev's public key is published, `FORMAI_CATALOG_PUBKEY` adds keys.
- `state.rs`: `installed.json`; `error.rs`: one readable sentence per failure.
- `policy.rs`: the organisation's policy at the system path (or `FORMPORTAL_POLICY` for testing), what it allows and locks; `check` reads a file as FormPortal will. `mirror.rs`: the catalogue and its files copied for an internal server. `deploy.rs`: `package`, FormPortal's installer with the policy, sums and an install script in one folder (`org-package`).
- `share.rs`: sharing through the person's GitHub account (private libraries, invitations, public links in `formportal-public`) and `write_portfolio`, that repository's README listing every public file. `github.rs`: sign-in and the API calls.
- `extensions.rs`: the extension index and installed packages; an entry's `support` link is kept only when it is https.

## Rules

- No Tauri, no window, no async runtime in `core`. Everything is a blocking call the surfaces wrap.
- A failed install leaves the previous state untouched: unpack into `[version].tmp`, swap only after success.
- Every new error is a `CoreError` variant whose sentence a person can act on; the harness skill's `references/concepts.md` table lists them, so update it in the same commit.
- Exercise changes with the examples (`catalog`, `install`) and the CLI against a scratch `FORMPORTAL_ROOT`; never against a real install folder.
- Log decisions in `core/HASHOUT_LOG.md`.
