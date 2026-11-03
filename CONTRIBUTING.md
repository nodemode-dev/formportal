# Contributing to FormPortal

Thank you for helping. FormPortal aims to be one place to install, open, update and
roll back every Form app, with no account and nothing left running, and it gets there
through real use and real contributions.

## Where to start

- **Use it and report what goes wrong.** A clear bug report, with steps, the version
  and your platform, is one of the most useful things you can give.
- **Look at the open issues.** Comment on one before starting larger work, so nobody
  builds the same thing twice.
- **Translations** are welcome: FormPortal ships in English with a Spanish draft in
  `frontend/src/i18n`, and the Languages and Launch page of the wiki says how a
  language is added.

## Setting up

Clone the repository and run `./formportal_oc_install`, then `./formportal` (or
`formportal_oc_install.bat` and `formportal.bat` on Windows). The first checks Node,
Rust and, on Linux, WebKitGTK, installs the interface and fetches the crates; the second
opens the window. The README's Quick Start has the details and the requirements.

The code lives in:

| Folder | What is there |
| --- | --- |
| `core` | `formportal-core`, the engine (Rust): catalogue, verify, install, rollback, remove, launch |
| `cli` | `formportal-cli`, the command line and the MCP server (Rust) |
| `src-tauri` | the desktop shell (Rust, Tauri) |
| `frontend` | the interface (TypeScript, Vite) |
| `catalog`, `design` | copies of the family's catalogue contract and design tokens |
| `setup` | build, packaging and agent scripts |
| `.docs/wiki` | the wiki's source, published on push |

## Before you open a pull request

Run the same checks CI runs:

```sh
(cd frontend && npm ci && npm audit && npm run typecheck && npm run build)
cargo check --locked -p formportal-core -p formportal-cli
cargo test --locked -p formportal-core -p formportal-cli
```

CI also checks the shell scripts with `bash -n` and refuses an em dash in tracked
Markdown or an emoji in any tracked text.

- Keep each pull request to one change, with tests for what it adds or fixes.
- Write commit subjects the way the history does, in Conventional Commits:
  `feat(core): ...`, `fix(cli): ...`, `docs(...)` (see
  [.docs/BRANCHING.md](.docs/BRANCHING.md)). Leave the version alone; the maintainer
  bumps it when releasing.
- After changing an MCP tool, run `./formportal agents sync`;
  `./formportal agents sync --check` fails while the skill's references drift.
- `catalog/` and `design/` are copies of the family's contract; propose changes to
  them in an issue first.
- Every new dependency, binary, font or data file gets a row in `LICENSES.md` before
  it is used.
- Other vendors' product names appear only to say which product a Form app stands in
  for, or for compatibility. Never copy vendor help text or vendor icons.

## How changes land

Only the maintainer pushes to `main`. Everyone else forks the repository and opens a pull request into `main`. A pull request merges when all four checks pass on an up-to-date branch and the maintainer has approved it after its last push.

## Releases

A release is a version, and only the maintainer makes one: after the version is bumped on
`main`, the maintainer cuts a `compile_vX.Y.Z` branch, and formcompiler
(`nodemode-dev/formcompiler`) builds every platform and publishes them together. No
push from a contributor starts a release. See [.docs/BRANCHING.md](.docs/BRANCHING.md)
and the Releasing page of the wiki.

## Licensing

FormPortal is licensed under the GNU General Public License v3.0 only
([LICENSE](LICENSE), SPDX `GPL-3.0-only`). By contributing, you agree that your
contribution is licensed under the same terms. Only add code you have the right to
contribute, and name any third-party code and its licence in the pull request.

## Patents and other people's IP

A feature may be held back or removed if it would infringe someone else's patent or
other intellectual property. The maintainers decide.

## Conduct

Everyone taking part follows the [code of conduct](CODE_OF_CONDUCT.md). Security
problems go through [SECURITY.md](SECURITY.md), never a public issue.
