# Releasing

1. Bump every version site in one commit (see `.docs/BRANCHING.md`).
2. Push a branch `compile_v[version]` cut from that commit (`git push origin HEAD:compile_v0.44.3`). CI runs the checks on it; FormPortal builds nothing in this repository.
3. formcompiler (`nodemode-ai/formcompiler`) picks the branch up on its next 8-hourly watch run, or at once when its watch is run by hand. Once CI has passed on that commit, it builds macOS (Apple silicon), Linux (AppImage, deb) and Windows (NSIS), packs `formportal-[version]-[system]-[arch].zip` files with `manifest.json` and `SHA256SUMS` through `setup/package_release.py`, and drafts release `formportal-v[version]` on its own release page.
4. Review the draft and publish it there. formcompiler's signed family catalogue, the one FormPortal reads by default, then lists it with the sizes and hashes from its `manifest.json`.

macOS builds are ad hoc signed and not notarised, so the first start goes through Privacy and Security, Open Anyway. Windows builds are not code signed yet.

## Targets

macOS Apple silicon (`macos-latest`) and Intel (`macos-15-intel`), Linux x86-64 (`ubuntu-22.04`) and ARM64 (`ubuntu-22.04-arm`), Windows x86-64 (`windows-latest`) and ARM64 (`windows-11-arm`), the runner labels GitHub documents for hosted runners.

## FormPortal's own updates

1. Make an updater key pair once: `npx @tauri-apps/cli signer generate -w ~/.tauri/formportal.key`.
2. In formcompiler's repository settings, never FormPortal's: secret `TAURI_SIGNING_PRIVATE_KEY` (the private key's text) and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, and variable `FORMPORTAL_UPDATER_PUBKEY` (the public key's text).
3. With both set, formcompiler builds updater bundles and signatures, and `package_release.py --finish` writes `latest.json` with download addresses on the `formportal-v[version]` release. Installed copies read it from formcompiler's rolling `formportal-updates` release. Without them, releases build as before and FormPortal's Settings says updates are not set up.
