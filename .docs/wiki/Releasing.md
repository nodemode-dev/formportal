# Releasing

1. Bump every version site in one commit (see `.docs/BRANCHING.md`).
2. Run the `desktop` workflow on main. It builds macOS (Apple silicon), Linux (AppImage, deb) and Windows (NSIS), packs `formportal-[version]-[system]-[arch].zip` files with `manifest.json` and `SHA256SUMS`, and drafts release `v[version]`.
3. Review the draft and publish it. formai.dev reads the release's `manifest.json` for sizes and hashes.

macOS builds are ad hoc signed and not notarised, so the first start goes through Privacy and Security, Open Anyway. Windows builds are not code signed yet.

## Targets

macOS Apple silicon (`macos-latest`) and Intel (`macos-15-intel`), Linux x86-64 (`ubuntu-22.04`) and ARM64 (`ubuntu-22.04-arm`), Windows x86-64 (`windows-latest`) and ARM64 (`windows-11-arm`), the runner labels GitHub documents for hosted runners.

## FormPortal's own updates

1. Make an updater key pair once: `npx @tauri-apps/cli signer generate -w ~/.tauri/formportal.key`.
2. In the repository settings: secret `TAURI_SIGNING_PRIVATE_KEY` (the private key's text) and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, and variable `FORMPORTAL_UPDATER_PUBKEY` (the public key's text).
3. With both set, the workflow builds updater bundles and signatures, and `package_release.py --finish` writes `latest.json`, which installed copies read from the latest release. Without them, releases build as before and FormPortal's Settings says updates are not set up.
