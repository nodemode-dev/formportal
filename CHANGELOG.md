# Changelog

FormPortal's own release notes. Each Form app publishes its own; FormPortal shows them under Details.

## v0.35.0 · 2026-10-12

- A new window, laid out like the Creative Cloud desktop app: a sidebar with Home, Apps (Updates and Beta beneath it), Extensions and Learn; a top bar with search, a notifications bell and Preferences.
- Home is about your apps: the ones you have, each with Open or Update; how many updates wait, with Update all; the whole family as cards with one action each; and what is new in your apps.
- Apps is a list you can filter (all, installed, not installed) and search: one action per app and a More menu with automatic updates, other versions, going back a version and removing.
- Every app has its own page with its facts, its beta, and its guide, releases and problem report links.
- Preferences is a dialog: General (appearance, notices), Apps (automatic updates and a switch for each app), Catalogue, About (version, FormPortal's own updates, help, managed).
- Notices go to the bell, with a red dot until you read them, and show briefly in the lower right; installs say when they finish.

## v0.34.0 · 2026-10-12

- Organisations: a policy file in a system folder can lock the catalogue address and add its keys, refuse unsigned catalogues, fix the update settings, limit which apps and builds install, and turn extensions or sideloading off. Settings shows who manages the computer and what is fixed; locked settings cannot be changed, and apps that are not allowed say so. A policy that cannot be read stops installs until it is fixed.
- `formportal cli mirror` copies the catalogue and every file it names to a folder for an internal server, checks each file, rewrites the addresses and signs the copy with the organisation's key. Computers pointed at it install with no access to the internet.
- Command line and MCP: `policy`.
- See the Organisations page in the wiki for the file, the mirror and silent installs.

## v0.33.0 · 2026-10-12

- Help on every app page (its guide and docs, every release, report a problem), Send feedback on each installed beta, and a Help row in Settings with FormPortal's guide, what changed, issues and FormHub. Links open in your browser.
- What's new in your apps, on Home: each installed app's version, whether an update waits, and its release notes.
- After an install, FormPortal says when an earlier copy is still open; it keeps running and the new version opens next time.
- Notices use the apps' proper names, and good news is no longer drawn in the error colour.
- A `formai://` link no longer reshuffles the sidebar; the group holding the current page is marked instead.

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
