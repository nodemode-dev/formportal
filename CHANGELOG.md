# Changelog

FormPortal's own release notes. Each Form app publishes its own; FormPortal shows them under Details.

## v0.63.6 · 2026-11-10

- FormRec, the recorder for walkthroughs, podcasts, corporate messages and live feeds, is in the catalogue as in development, with its own icon on the dark and the light tile and its own hue. It appears in FormPortal once its first release is in the catalogue, as formcompiler now builds it.

## v0.63.5 · 2026-11-09

- FormPortal installs the build made for your Mac's chip. It used to go by how FormPortal itself was built, so an Intel copy of FormPortal running under Rosetta on Apple silicon installed Intel builds of some apps and Apple silicon builds of others. It now asks the Mac. An Apple silicon Mac takes an Intel build only when an app has no Apple silicon build, and Details says it runs under Rosetta; an Intel Mac is never given an Apple silicon build and the app reads "Not built for this computer yet". Windows follows the same rule; Linux never mixes architectures.

## v0.63.4 · 2026-11-09

- Extensions from form.ext-registry load: this build trusts the registry's index key (`core/registry_keys.txt`), so the signed extension index and block list are read instead of refused with "this build trusts no registry key yet".

## v0.63.3 · 2026-11-09

- form.ext shows its real icon, the tilted puzzle piece, in the family row, Apps, the sidebar and Details, on a dark tile in dark themes and a light tile in light ones. FormPortal had kept an early placeholder, a flat upright piece, and the same dark picture for light themes.

## v0.63.2 · 2026-11-08

- form.ext, the extension studio, is listed as available like the other apps, now that FormCompiler builds and signs it.
- form.ext's licence is shown as GPL-3.0-only, as its repository says; it was listed as Apache-2.0.

## v0.63.1 · 2026-11-07

- Extensions come from form.ext-registry, the one place where Form extensions are reviewed, built and signed. FormPortal reads the registry's signed index and checks it with registry keys only; the app catalogue's keys never verify extensions. Until this build carries the registry's key, the Extensions page says "this build trusts no registry key yet"; while the registry is private it says "the registry is private or unreachable".
- Every extension from the index must carry its publisher's signature; one without it installs only with the developer setting.
- The registry's signed block list: a blocked extension or version cannot be installed, and one already installed is turned off at once, with a notice naming the reason, and stays off while it is blocked.
- Each extension shows Verified and links its source in the registry. Make an extension still opens form.ext.
- FormPortal no longer ships a starter list of extensions, and its browser preview no longer carries extension packages; developers point it at a test index with `?extindex=`.

## v0.63.0 · 2026-11-07

- FormPortal is the hub for extensions in every Form app that loads them: FormVis, FormCut, FormWav, FormPDF, FormDeck, FormLit, form.md, FormEncoder, FormVFX, FormMCP, FormTray, FormSkills and FormPortal. The Extensions page has a filter per app, and an extension's details say which app it goes to and the panels and commands it adds.
- An app picks an install, a switch on or off, or a removal up while it runs: the notice says "{name} {version} is ready in {app}", with Open {app} when the app is installed. An app older than its first extension-aware release still uses the change the next time it starts.
- Extensions made for a newer extension API, and native extensions, are refused with the reason.
- `formai://extensions?product=...` opens the Extensions page for that app (each app's Manage in FormPortal), and `formai://extensions?install=...` installs a package file through the usual checks.
- Make an extension opens form.ext, the new extension studio, or its page on formai.studio. form.ext is listed with the other apps.
- The command line and the MCP tools name the thirteen apps and report live pickup.

## v0.62.4 · 2026-11-07

- Two more browser demos open offline beside the first: `demos/updates` (updates, go back, a beta beside stable, release notes, and a Trust page that runs every check step by step and refuses a tampered catalogue, download or package) and `demos/library` (fonts, stock with credit lines, templates and Learn). The first demo links to both.

## v0.62.3 · 2026-11-07

- The loading bar on the start-up card moves again; the last release left it stopped at the start.

## v0.62.2 · 2026-11-07

- The start-up card matches the other Form apps: the same rounded card, icon and loading bar, held for 2.6 seconds before the window appears whole.

## v0.62.1 · 2026-11-07

- The browser demo opens on real media instead of generated placeholders: four photographs, a golden-hour clip, a piano piece and a PDF of field notes under Files, plus screenshots of Form apps. Open plays the video and the music, shows a PDF's pages and title, and every file's source and licence is listed in `demo/CREDITS.md`. App pages in the demo show each app's icon instead of a window capture, because those captures contain photographs without a verifiable licence.

## v0.62.0 · 2026-11-07

- A browser demo: open `demo/index.html` to run FormPortal offline. Installs check a signed catalogue and each download's SHA-256, updates keep the version they replace, your own files keep versions, and Open shows what is inside what you drop.

## v0.61.0 · 2026-11-06

- Every app shows its own new icon, in dark and light, following your theme.
- Apps go by their true names everywhere: form.md, FormDeck, FormBench, FormMCP, FormSkills and FormAT.
- FormBench's releases are found again: FormPortal now uses the same id for it as the catalogue.
- On the way follows the new release plan: Groups 1 to 7 open from November 10 to November 28.
- FormCompiler is no longer listed as an app. It builds and publishes the Form apps on GitHub and is never installed.

## v0.60.0 · 2026-11-06

- FormPortal opens straight onto your apps. It shows the catalogue it already has the moment the window appears, then checks formai.studio and GitHub for anything newer in the background, instead of waiting on the network every time it starts.
- The start-up check is much quicker when it does run: connections are reused, every request gives up after a few seconds instead of hanging, each app's release files are sized at the same time instead of one by one, and the catalogue is fetched once per start instead of twice.
- The splash screen no longer holds the window back for a fixed 2.6 seconds.
- Fonts is no longer empty: twelve open fonts ship inside FormPortal (Inter, Manrope, DM Sans, Space Grotesk, Bricolage Grotesque, Syne, Fraunces, Lora, Instrument Serif, JetBrains Mono, IBM Plex Mono and Caveat), each shown in its own typeface, and they install without a download.
- Stock & templates is no longer empty: eight public-domain photographs and FormCut's warm colour look ship inside FormPortal, each with its credit line.
- Fonts, Stock & templates and Extensions now connect to the formai.studio store. Whatever the store offers is added to the starter library, and each page says whether the store answered.
- Extensions explains that no Form app has published one yet, instead of showing a blank page, and checks again each time you open it.

## v0.59.0 · 2026-11-06

- Installing works on macOS again. Form apps come as disk images with a licence, and FormPortal now accepts it for you instead of the install being cancelled.
- A new look, the Form family's own: the same window, controls and themes as FormVis, FormDeck, FormLit and FormVFX, with every app in its own colour.
- Home: the whole family at a glance (34 apps, the ones that are out lit, the rest waiting with their dates), your installed apps with Open and Update, one button to install every released app, and the apps still to get.
- Drop a file on FormPortal to find the app that opens it, or open it straight away if that app is installed.
- Every app has its own page with its screenshot (light or dark, following your theme), what it does, what's new, versions and beta, and its AI tools.
- The sidebar collapses to icons with the handle on its edge, and drags wider or narrower; FormPortal remembers it.
- Messages appear at the bottom centre in a clear glass outline: red for anything that went wrong, and in the app's own colour for anything about that app.
- The family is the 34 apps and names from formai.studio: FormDeck, FormSkills, FormMCP, FormAT and the rest. Each app shows one state everywhere: Install, Installing, Open or Update.
- The Included and Beta pages are gone; there is no plan to show. Betas are on each app's page.
- Learn no longer shows an error while the apps' own tutorials are not published yet.

## v0.58.0 · 2026-11-06

- FormPortal's identifier is now `studio.formai.portal`, on formai.studio's domain. On macOS your installs, settings and sign-in move to `~/Library/Application Support/studio.formai.portal` the first time v0.58.0 starts, and a link is left at the old folder so FormTray and formMCP still find them. Nothing is deleted. The login item is renamed the same way.
- Apps, On the way, matches formai.studio: the apps coming on a date, then those with a date to come, as numbers only.
- Supporters can paste the desktop code from formai.studio's thank-you page into Preferences, Account, Supporter, to see the names of the apps on the way. The code stays on your computer; formai.studio is asked only to check it, and Forget removes it.
- Nothing shows before the window is ready, and a first launch with no connection names no app until FormPortal has heard which apps are released.

## v0.57.0 · 2026-11-06

- Every Form app's icon is the new v3 icon, in a dark and a light version, and FormPortal shows the one that matches the theme you choose: in Apps, Home, Files, the app pages and FormPortal's own icon in the sidebar.
- FormPortal's own icon follows your theme too: the starting card, the window and taskbar icon on Windows and Linux, and the Dock icon on macOS while FormPortal runs. The installed app shows the dark icon.
- Apps that are not released yet stay hidden, icons included, as on formai.studio.

## v0.56.0 · 2026-11-06

- FormPortal shows only the Form apps that are released, as formai.studio does: an app appears once it has a published release (or you have it installed), and the rest stay unnamed. Under Apps, On the way shows how many apps open next and when, with a link to support the project on formai.studio.
- Each app's page says what it does and what it runs on, from the same descriptions as its page on formai.studio.
- FormPortal opens like the other Form apps: a small card with the loading bar, then the window appears whole once it is ready.
- The Form family look: dark by default, the family's surfaces, type and orange accent (shared with the other Form apps on this computer, and changeable in Preferences), no scrollbars, and on macOS a slim title row with the window buttons inside it.
- Preferences is rebuilt like the other Form apps': sections in a rail on the left, every section as a card in one scrolling page, and a Done button.
- formai.dev is gone from FormPortal: it is not a Form site. formai.studio is the family's address.

## v0.55.0 · 2026-11-06

- FormPortal offers the newest release each Form app has published on GitHub when it is newer than the catalogue's, so apps released since the catalogue was last signed can be installed and updated: on 2026-11-06 that is FormPDF 0.57.3, formMCP 0.7.8, formskills 0.7.7, FormSlide 0.30.7, FormVFX 0.52.8, Form.md 0.48.0 and FormTray 0.10.2. The release must name the same repository as the signed catalogue, not be withdrawn in formcompiler's list, and list its files' SHA-256 sums, which every download is checked against before anything is unpacked. The catalogue's release stays in Other versions. An organisation's policy can turn this off with `github_releases: false`, and `FORMPORTAL_RELEASES=off` does too.
- Apps marked prelaunch in the catalogue can be installed once they have a release (FormTray, formMCP, FormPDF, formskills).
- When the download store cannot be reached, FormPortal reads formcompiler's signed copy of the catalogue on GitHub before the copy it kept.
- Reopening FormPortal on Included shows Included at once instead of an empty page until it finished loading.
- The update notices, the catalogue line in Preferences and the command line's update link name formai.studio instead of formai.dev.

## v0.54.3 · 2026-11-04

- README in the Form family template (Mackin's #8), merged with main. Nothing in the app changed.

## v0.54.2 · 2026-11-04

- The README is rewritten in the Form family layout, with screenshots of the app library, Home and Files. Nothing in the app changed.

## v0.54.1 · 2026-11-03

- The installers and the app metadata name NodeAgentc, Inc. as the publisher, with the licence (GPL-3.0-only): the bundle sets `publisher`, `copyright`, `license` and `licenseFile`, so the macOS About panel, the Windows file properties and installer, and the Linux packages say the same.
- The built-in app list names FormSlide's real identifier (`ai.nodemode.formdeck`) and its repository (`nodemode-dev/formdeck`); it named a `formslide` repository that does not exist.
- The app icon is the Form family's unified icon on the desktop and in the browser tab. The repo now has a CODEOWNERS file. Nothing else in the app changed.

## v0.54.0 · 2026-11-03

- Every page scrolls again. The main column grew to the height of its content instead of the window, so the window clipped it and nothing could scroll.
- The release ships the installers as they are, with no zip around them: `formportal-[version]-macos-[arch].dmg`, `formportal-[version]-windows-[arch]-setup.exe`, and `.AppImage`, `.deb` and the new `.rpm` for Linux. The licence texts sit beside them as `LICENSE.txt` and `LICENSES.md`.
- On Linux and Windows the installer is also the update file, so the separate `-update.AppImage` and `-update.exe` copies are gone. macOS keeps `-update.app.tar.gz`.

## v0.53.5 · 2026-11-02

- FormPortal's own updates are read from the public download store, `https://dl.formai.studio/formportal/updates/latest.json`, and point at the release files there, instead of formcompiler's private release page.
- Links to the Form repositories (Guide, What changed, Report a problem, the app pages and the catalogue) point at the `nodemode-dev` organisation, and FormPortal opens those addresses.
- FormPortal opens every link it shows: "Every release" on an app page (formai.studio's download page), GitHub's sign-in page, your shared libraries and published files, your portfolio, and a maker's GitHub Sponsors page. Before, the desktop app refused them. Only https addresses on that list open.
- This build trusts the family's production catalogue key (`P3Cgp37EmB2jOBtTWRNFtO8xMq8hsb+Ii3U5+UrYNtY=`), so the catalogue formcompiler signs and publishes is used instead of being refused as untrusted.

## v0.53.4 · 2026-10-30

- The Windows release builds only the NSIS setup, the installer it ships; `FORMPORTAL_BUNDLES=nsis,msi` still builds the msi for a managed rollout. Nothing in the app changed.
- The build scripts use Tauri CLI 2.12.3 on every run instead of the newest 2.x of the day.
- Line endings are fixed for Windows checkouts: CRLF for .bat, .cmd and .ps1 scripts, LF for everything else.

## v0.53.3 · 2026-10-26

- The command line no longer reports a crash when the program reading its output stops early (`formportal-cli apps | head -1`): it ends quietly with success, since the action had already finished.
- A test suite now checks the catalogue's signature, the downloaded file's SHA-256, installing, updating, rolling back and removing, the organisation's policy and the closed output pipe, and runs on every change.

## v0.53.2 · 2026-10-26

- Release builds keep their symbols (`strip = false`), because macOS builds fail when the release profile strips the binary. Nothing in the app changed.

## v0.53.1 · 2026-10-25

- The interface's development server moves to vite 8.3.5, which clears two command-injection advisories in its `launch-editor`. A development dependency only: nothing in the app changed.

## v0.53.0 · 2026-10-25

- Installed apps can be reached by agents: when a release's bundle carries no `form-app.json`, FormPortal writes the release's own (from the catalogue, checked) into the install, so `app-mcp`, `app-agents` and Connect work for every app that declares an MCP server.
- `form-app.json` can name the app's program (`agents.mcp.binary`) instead of a path; FormPortal finds it whether the install is a macOS app, a deb or rpm, a Windows program or an AppImage.
- Every install now has a record of each file's SHA-256 beside it (`<version>.files.json`, listed in `installed.json`), removed with the version; formMCP 0.7.1 checks an app against it before starting it.

## v0.52.1 · 2026-10-25

- The MCP tools `shares` and `extensions` describe the portfolio address and support links, and FormPortal's agent skills know `org-package`, FormRanker, the Included tab and the engine's policy, deploy and sharing files.

## v0.52.0 · 2026-10-25

- `org-package` makes one folder for a managed rollout: FormPortal's msi, dmg, deb, rpm or AppImage, the organisation's policy, their SHA-256 sums and an install script that puts the policy in place before FormPortal's first start.
- The Organisations page now says which installers need an administrator: the msi installs for every user, the NSIS setup for one person.

## v0.51.0 · 2026-10-25

- Included, in the sidebar after Learn: what the free plan covers, every app and tool with its licence, and the fonts, stock, extensions and tutorials that come with it. Nothing is sold, so there are no offers.
- An extension can carry a link to support its maker, shown in its details; the extension stays free either way.
- Your public links now make a portfolio: the front page of `formportal-public` lists every public file, with pictures shown, and the Public link dialog shows its address.

## v0.50.1 · 2026-10-25

- FormRanker, the family's parity, testing and feedback app, is listed in Family tools.

## v0.50.0 · 2026-10-25

- Each app's page says whether its releases carry agent skills, with a link to read them in formskills.
- Each app's Use with your AI tools section points to formMCP, one connection to every Form app at once.

## v0.49.0 · 2026-10-25

- Every app is shown with its own icon, in every list, card, app page and in Files; no more two letters on a coloured square.
- The app list is the family formcompiler builds: FormPDF, FormTxt, FormCel, FormRef, FormSculpt, Format and FormTray join; FormSim, FormUI, FormApp and FormHub leave. formMCP, formskills and FormTray sit under a new heading, Family tools.

## v0.48.0 · 2026-10-25

- Files, Share: share a folder as a private repository in your own GitHub account and invite people by their GitHub username; run it again to send what changed.
- Files, Shared with you: accept a library someone shared with you; it arrives in Shared inside your projects folder, and Get the latest brings what changed.
- Files, Public link: give a file a link anyone can open (kept in formportal-public in your account) and remove it again.
- Preferences, Account: Allow sharing, when you signed in with profile access only.
- Command line: `shares`, `share`, `share-send`, `share-accept`, `share-pull`, `publish`, `unpublish`; MCP tools for each.

## v0.47.0 · 2026-10-24

- Preferences, Account: sign in to your own GitHub account, optionally, with a code you enter on github.com. Nothing in FormPortal needs it; sharing from Files will use it. FormPortal asks only to read your profile, and keeps the sign-in in this computer's keychain.
- `formportal-cli account`, `sign-in` and `sign-out`; the MCP server's read-only `account` tool.
- On Linux, building FormPortal needs the D-Bus headers (`libdbus-1-dev`).
- A failed Windows login item now says so, instead of mentioning the record of installed apps.

## v0.46.1 · 2026-10-24

- Notices, the self-update status and the Versions dialog follow the chosen language; only error text from the engine itself stays English.
- A slow first start no longer swaps the font after the window is shown, so nothing on Home moves (it showed in Spanish).

## v0.46.0 · 2026-10-24

- Preferences, General: Open FormPortal when I log in, off by default. It opens the window and nothing else; turn it off and the login item is removed.
- Other versions shows each release's date. With formcompiler 0.4.2 the list keeps the newest release of every earlier major version, not only the last five.
- The `preferences` command and MCP tool take `open_at_login`; the window applies it when it next starts.

## v0.45.1 · 2026-10-24

- Claude Code counts as connected only when the app is in your user settings; opening FormPortal inside a project whose `.mcp.json` names the app no longer reads as connected.
- formMCP and formskills are listed under their own names (`formmcp`, `formskills`, identifiers `ai.nodemode.*`); formskills replaces the planned FormSkill.
- The agent skill explains formMCP (one connection to every Form app, installs through FormPortal) and formskills (the apps' released skills).

## v0.45.0 · 2026-10-24

- Reads an app's `form-app.json` in format 2, which formcompiler now writes into every release: whether the app has an MCP server, and its skills. Format 1 files still work. `app-agents` shows the file as read, and an app is only offered to Claude Code, Codex and Cursor when its install names a server FormPortal can start.
- The catalogue's new agents fields (whether an app has an MCP server and skills; each release's manifest and skills archive with its digest) are read and kept, and the catalogue schema accepts them.

## v0.44.6 · 2026-10-24

- LICENSE, NOTICE and the README name the copyright holder, NodeAgentc, Inc., and Preferences, About shows "by nodemode.ai" under the version.

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
