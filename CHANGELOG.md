# Changelog

FormPortal's own release notes. Each Form app publishes its own; FormPortal shows them under Details.

## v0.32.0 · 2026-10-11

- Every desktop release kind installs, per user and without administrator: dmg, deb, rpm, msi and NSIS, besides zip and AppImage. Install scripts never run.
- Builds for six systems: macOS on Apple silicon and Intel, Linux and Windows on x86-64 and ARM64.
- FormPortal can update itself, signed, from Settings, Version, once the updater key is set for releases.

## v0.31.0 · 2026-10-11

- Extensions: install, update, turn off and remove packages from the open catalogue on the Extensions screen.
- Every package is checked against the catalogue's hash, its publisher's signature when it has one, and its own manifest; a package that runs native code must be signed unless you turn on the developer setting.
- Open a `.formpkg` file with FormPortal to install it; a package the catalogue does not list is labelled as sideloaded.
- Apps pick up their extensions from FormPortal the next time they start.
- Command line and MCP: `extensions`, `extension_install`, `extension_remove`, `extension_enable`.

## v0.30.0 · 2026-10-11

- Other versions: every app's More menu lists the versions the catalogue offers (the latest and up to five before it) and installs any of them, newer or older.
- Installing an older version on purpose turns that app's automatic updates off, so it stays, and says so.
- Settings: Keep the version before, to go back to (on by default).
- Command line and MCP: `versions`, and `install` with a version.

## v0.29.0 · 2026-10-11

- Automatic updates while FormPortal is open, on by default, for all apps or app by app, with beta builds as a separate choice and open apps left alone unless you say otherwise.
- Settings, Updates: automatically, beta builds too, only apps that are not open, tell me what was updated. Each app's More menu: Update automatically.
- What's new in each app's Details, from its release notes.
- One notice after each check: what was updated, what failed, what is still waiting, and when a newer FormPortal is available.
- Only a newer version is ever offered as an update.
- Command line and MCP: `updates`, `update` and `preferences`.

## v0.28.0 · 2026-10-11

- An app that is open is never replaced or removed underneath itself: updating installs the new version beside it for next time; removing waits until it is closed.
- Trusted catalogue keys live in `core/catalog_keys.txt`.
- `formai://app/<id>` links open the app's own page.
- Appearance: System (the default), Dark or Light.

## v0.27.0 · 2026-10-11

- FormPortal moves to its own repository, with its history, from formai_dev 0.26.0.
- Named FormPortal throughout: `formportal-core`, the `formportal` shell, `dev.formai.portal`, `./formportal`.
- A command line and an MCP server for Claude Code, Codex and Cursor, with the `formportal-harness` skill.
