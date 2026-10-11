# Releasing

1. Bump every version site in one commit (see `.docs/BRANCHING.md`).
2. Run the `desktop` workflow on main. It builds macOS (Apple silicon), Linux (AppImage, deb) and Windows (NSIS), packs `formportal-[version]-[system]-[arch].zip` files with `manifest.json` and `SHA256SUMS`, and drafts release `v[version]`.
3. Review the draft and publish it. formai.dev reads the release's `manifest.json` for sizes and hashes.

macOS builds are ad hoc signed and not notarised, so the first start goes through Privacy and Security, Open Anyway. Windows builds are not code signed yet.
