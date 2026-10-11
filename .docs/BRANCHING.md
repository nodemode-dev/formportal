# Branching and release model

- **main** is always releasable. No force-push to main.
- **Work branches** are short-lived and named by intent: `feat/[topic]`, `fix/[topic]`, `docs/[topic]`, `chore/[topic]`. Rebase on main before merging.
- **Commits** follow Conventional Commits with the version in the summary, for example `feat(core): stage an update until the app closes (0.28.0)`. The commit identity is `nodemode-ai <mackin@nodemode.ai>`. The version bump is its own last commit, `chore(release): x.y.z`.
- **Versions** are `v*.*.*` with dots, everywhere: `core/Cargo.toml`, `cli/Cargo.toml`, `src-tauri/Cargo.toml`, `Cargo.lock`, `src-tauri/tauri.conf.json`, `frontend/package.json` and both fields of its lockfile, the README badge and the deliverable zip names. Bump all of them in one commit.
- **MCP tools.** A change to a tool is followed in the same commit by `./formportal agents sync`; `./formportal agents sync --check` must pass.
- **The contract.** `catalog/` and `design/` change in formai_dev first, then are copied here in a commit naming the formai_dev version.
- **Releases.** Run `.github/workflows/desktop.yml` (workflow_dispatch) on main; it builds macOS (Apple silicon), Linux and Windows bundles, packs them with `manifest.json` and `SHA256SUMS`, and opens a draft release `vX.Y.Z`. Review the draft, then publish it; formai.dev's catalogue picks it up.
- **Wiki.** Edit pages in `.docs/wiki/`, never in the GitHub wiki interface.
