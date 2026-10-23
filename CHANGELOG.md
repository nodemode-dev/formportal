# Changelog

FormPortal's own release notes. Each Form app publishes its own; FormPortal shows them under Details.

## v0.44.5 · 2026-10-23

- The installed app and every release zip carry FormPortal's licence and third-party licence ledger (LICENSE, LICENSES.md, NOTICE). The crate audit is recorded in LICENSES.md, with the crates under other licences in their own table.

## v0.44.4 · 2026-10-23

- A trademark notice in the README and NOTICE, and the README, wiki and agent notes no longer describe FormPortal as a Creative Cloud alternative or layout. No change to the app itself.

## v0.44.3 · 2026-10-22

- FormPortal reads the Form family's signed catalogue from formcompiler (`nodemode-ai/formcompiler`), where every Form app is now released. A custom catalogue address in Settings still wins.
- FormPortal's own updates come from formcompiler's `formportal-updates` feed, and each app's "Every release" link opens formcompiler's release page.
- The repository's GitHub Actions now run checks only (interface, engine and scripts); releases are built by formcompiler as `formportal-vX.Y.Z`.

## v0.44.2 · 2026-10-20

- A new app icon: an app rising out of a glowing portal, in the Form family colours. The same mark in the dock, the taskbar, the installers and the browser tab.

## v0.44.1 · 2026-10-13

- `./formportal desktop build` builds the desktop app from the repo root: the macOS build on a Mac, the Linux .deb and AppImage elsewhere.

## v0.44.0 · 2026-10-12

- Files keeps a version each time you save while FormPortal is open, not only when you look. An open Versions window tells you when a new one was kept.
- A project's preview shows in Files when its app writes one beside it (`[file].preview.webp`).
- `formportal cli watch` keeps versions the same way from a terminal.

## v0.43.0 · 2026-10-12

- Steadier start: the window no longer shows a half-built page for a moment on a busy computer, and notices no longer push each other around (one shows at a time; the bell keeps them all).
- Font updates: when the font library has a newer version of a font you installed, the bell says so and Fonts offers Update.
- A troubleshooting page for extensions that will not install, linked from Extensions.

## v0.42.0 · 2026-10-12

- Check and repair, in Preferences, About: finds apps whose files went missing or have nothing to open, earlier versions that are gone, unfinished installs, leftovers and old downloads, and repairs them with one button. `formportal cli repair` reports, and `--fix` repairs, with no window.
- Update when I close it, in an app's More menu: the update waits until the app is closed, then installs while FormPortal is open or the next time it starts.
- A web page can link to a Form project file (`formai://file/formcut?url=...`): FormPortal asks first, saves it in From the web in your projects folder and opens it in its app. Only Form project files are accepted.
- Command line and MCP: `repair`; `update` takes `later`; `formportal cli later`, `open-url`.

## v0.41.0 · 2026-10-12

- Language: Preferences, General now offers English and a first draft in Spanish. FormPortal opens directly in the language you choose. The Spanish has not been reviewed by a Spanish speaker yet, and some messages are still in English.
- When FormPortal opens: Home, or where you left off. It opens straight on that screen.

## v0.40.0 · 2026-10-12

- Learn: tutorials you follow step by step, six for FormPortal itself and the Form apps' own from a signed index, with your progress kept on this computer. Each step can take you to the screen it is about.
- Home ends with Suggested for you: your next tutorial step, a projects folder if you have none, and an app you could add. Worked out on this computer; nothing is sent.
- Notifications are filed by kind (updates, installs, files and library, agents, learning, FormPortal). Show one kind in the bell, and choose in Preferences which kinds pop up.
- Ask your agent: ask Claude Code or Codex, already on your computer, about your apps from the top bar. It can read FormPortal but cannot install or remove anything from there.
- Ask the community beside every app's help links.
- `FormPortal mcp` serves the tools from the desktop app too, and `--read-only` serves only the reading ones.
- Command line and MCP: `learn`, `learn_progress`; `formportal ask`.
- The small dialogs fit their content again.

## v0.39.0 · 2026-10-12

- Stock & templates: open-licensed images, video, audio and Form app templates (CC0, CC BY, CC BY-SA, Apache-2.0, MIT, OFL) with search and kinds. Save one to your Library and its credit line is kept beside it and in `credits.json`; anything under another licence is not saved.
- Use template copies a FormCut, FormVis or FormWav template into your projects folder and opens it in its app.
- Your Library lists what you saved, with its licence and credit, and Remove.
- Command line and MCP: `media`, `media_save`, `media_remove`.

## v0.38.0 · 2026-10-12

- Fonts: an open font library (OFL, Apache-2.0, MIT) with search and kinds. Install a whole family or one style, for you only and with no administrator, and remove it again. Every app on the computer can use them, usually after it restarts.
- Add your own TTF or OTF files once you confirm you have the right to use them.
- Command line and MCP: `fonts`, `font_install`, `font_remove`.

## v0.37.0 · 2026-10-12

- Files: choose folders on your own disk (the system's folder picker, or the suggested Documents/Form). FormPortal lists the Form projects in them, newest first, with search; opens each in the app that makes it; and keeps up to 20 earlier versions of each, with Go back to this. Nothing leaves your computer.
- Storage: what FormPortal uses on disk, and each projects folder.
- Command line and MCP: `files`, `folders`, `open_file`, `file_versions`, `storage`.

## v0.36.0 · 2026-10-12

- A Form app that ships its own MCP server can be connected to Claude Code, Codex and Cursor from its page, or with `connect_agents`. FormPortal starts whichever version is installed, so the connection survives updates and going back a version. It never replaces a server of the same name that it did not add, and backs up each config file first.
- Command line and MCP: `app_agents`, `connect_agents`; `installs` says which apps have a server; `formportal app-mcp` is what the clients start.
- With no network, installed apps still open, and Home says the catalogue could not be reached, with Try again.

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
