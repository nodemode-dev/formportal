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
  [.docs/BRANCHING.md](.docs/BRANCHING.md)). Leave the version alone; a maintainer
  bumps it when releasing.
- After changing an MCP tool, run `./formportal agents sync`;
  `./formportal agents sync --check` fails while the skill's references drift.
- `catalog/` and `design/` are copies of the family's contract; propose changes to
  them in an issue first.
- Every new dependency, binary, font or data file gets a row in `LICENSES.md` before
  it is used.
- Other vendors' product names appear only to say which product a Form app stands in
  for, or for compatibility. Never copy vendor help text or vendor icons.

## Maintainers

FormPortal is maintained by:

- the [nodemode-dev](https://github.com/nodemode-dev) organisation on GitHub
- [@nodemode-ai](https://github.com/nodemode-ai)
- [@gbarnai](https://github.com/gbarnai)

Reach them through issues and pull requests.

## How changes land

Only a maintainer pushes to `main`. Everyone else forks the repository and opens a pull request into `main`. A pull request merges when all four checks pass on an up-to-date branch and a maintainer has approved it after its last push.

## Releases

A release is a version, and only a maintainer makes one: after the version is bumped on
`main`, a maintainer cuts a `compile_vX.Y.Z` branch, and formcompiler
(`nodemode-dev/formcompiler`) builds every platform and publishes them together. No
push from a contributor starts a release. See [.docs/BRANCHING.md](.docs/BRANCHING.md)
and the Releasing page of the wiki.

## Licensing

FormPortal is licensed under the GNU General Public License v3.0 only
([LICENSE](LICENSE), SPDX `GPL-3.0-only`). By contributing, you agree that your
contribution is licensed under the same terms. Only add code you have the right to
contribute, and name any third-party code and its licence in the pull request.

## Patents and other people's IP

Some features are deliberately not built, or were taken out, because they come too close to someone else's patent, trademark, copyright or design. The maintainers hold that line with counsel; contributors do not decide it, and nobody here redesigns a feature on their own reading of a patent. This is engineering diligence, not legal advice.

### Features this project will not implement

No feature of formportal has been held back so far. The rules below apply to every change, and a feature can still be held back or removed later; when that happens it is listed here first.

### Rules for every contribution

- Patents: do not add a feature, or a dependency that provides one, that reproduces a method you know to be patented. If you are unsure, open an issue that describes what the feature does, not which patent it resembles. Patent numbers stay out of code, commits, comments, logs and changelogs.
- Trademarks: other vendors' product and feature names appear only to name a file format or compatibility ("opens <format> files", "for use with"). No command, menu, panel, tool, preset, template, theme or agent tool takes another product's feature name, and no text says "like X" or "the way X does it". Describe what the feature does.
- Copyright: never copy another product's help, tooltip, dialog or documentation text (link to it instead); never trace or import vendor icons; never bundle vendor templates, themes, presets, brushes, swatches, LUTs, materials, sample files, sound libraries, stock media or fonts; colour-book names only when reading a person's file. Compatibility layers carry names and signatures only. Test fixtures come from this repository's own scripts.
- Licences: every new dependency, binary, model, font, profile or data file gets a row in `NOTICE` before it is used. GPL stays outside the distributed bundle, AGPL nowhere, LGPL dynamically linked and replaceable, MPL files unedited. CC BY credited, CC BY-SA only unmodified, CC NC and ND never. Models with gated or non-commercial terms are optional downloads, never bundled.

## Conduct

Everyone taking part follows the [code of conduct](CODE_OF_CONDUCT.md). Security
problems go through [SECURITY.md](SECURITY.md), never a public issue.
