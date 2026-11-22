# Changelog

FormPortal's own release notes. Each Form app publishes its own; FormPortal shows them under Details.

## v0.71.2 · 2026-11-22

### Improved

- The three browser demos (Install and files, Updates and trust, Fonts and stock) show the 0.71 interface, with FormSubstrate and FormPublisher under their new names and icons. The Files inspector works on the demo's own files. Nothing in a demo asks the outside world: a stock search, the web font sources, the templates list, the extension registry and Connect to GitHub show their screens and say the demo does not connect, and On the way shows the built-in schedule.
- Stock & templates shows its page in one piece once its sources are read, so nothing below them moves when they arrive.

## v0.71.1 · 2026-11-22

### Changed

- FormPortal asks formai.studio nothing about what is on the way unless you turn on Preferences, General, Ask formai.studio what is on the way. It is off by default, also when you update from an earlier FormPortal. Off, On the way shows the schedule FormPortal was built with, or the last answer it kept. On, FormPortal asks once each time it starts and never again in that run; turning the switch on asks once then. Showing Home or coming back to the window no longer asks anything.
- FormPortal knows the launch is complete from the signed catalogue it already reads: every app of the built-in schedule is out, the sealed day has passed and a new app is in the catalogue. The section then becomes Request (or New app on the horizon) an hour later, as before, without asking formai.studio.
- A kept supporter code is checked again at start only when Ask formai.studio what is on the way is on. Off, the kept answer is shown for 7 days after the last check (or until the code's end date, if sooner); after that Profile says so, and Check again asks formai.studio once.
- `apps` on the command line and in the MCP server asks formai.studio only when given `--ask-site` (`ask_site`). `preferences` reads and sets `ask_site`.
- Connect to GitHub appears in Preferences, Profile: this build carries FormPortal's GitHub app id. Nothing is sent to GitHub until you press Connect to GitHub.
- SubForm is now FormSubstrate (installed as Substrate), the family's code and text editor in place of VS Code, listed under Code Editor Apps; its id is `formsubstrate`.
- FormPublisher stands in for Wix and Squarespace, is licensed GPL-3.0-only and has its own green. FormCAD stands in for AutoCAD, SolidWorks and Rhino, and FormMorpheus's line reads "Animation studio: draw frame by frame, keyframe or perform live on a timeline."

## v0.71.0 · 2026-11-21

### New

- Stock & templates searches Pexels, Pixabay, Openverse, Freesound and ccMixter for images, video and audio. Pexels, Pixabay and Freesound need your own free API key, pasted under Your sources; Openverse and ccMixter need none. Results fill a steady grid, and each opens in a viewer with its licence, its credit line and Save. Saved items go to your Library with a text file beside each holding the title, author, source, page and licence. Non-commercial (NC) and no-derivatives (ND) items are shown with that limit in plain words. From Freesound, Save keeps the high-quality preview MP3, because the original file needs a sign-in its API keys cannot give.
- Templates and demos for every public Form app, one section per app, from the public repository nodemode-dev/formai-templates on GitHub. Nothing is fetched until you choose Get the list; each file is downloaded only when you choose Download (or Download all for an app), kept only if its SHA-256 matches the list, and saved in a Templates folder that Files also shows. Show in folder, and Open in the app when it is installed.
- Fonts can come from Fontsource, with no account, and from Google Fonts, with your own API key. Nothing is asked of either until you press Browse Fontsource or Browse Google Fonts on the Fonts page. Preview a family in its own face with your own sample line, see its licence, and install it; a family is installed only when its source states OFL-1.1, Apache-2.0 or MIT, and the licence is saved beside the files.
- API keys you give FormPortal are kept in the system keychain, never in a file, never logged, and sent only to the service they belong to.
- An install or a going back shows a card under the app's row that ticks each check as the engine really does it: the catalogue's signature again, the file for this computer, the address, the download, the SHA-256, unpacking, and moving into place (or, going back, finding the kept version, swapping it and holding automatic updates). All the numbers shows the file, sizes, addresses, both SHA-256 values, where it was installed and how long it took. A finished card stays until you close it.
- Files: a project's name opens an inspector with its path, preview, size, kind, versions kept, the last kept SHA-256 and the SHA-256 of the file as it is now, saying whether they match. A text project shows its lines and words and its first lines. Download copies the project into your Downloads folder under a free name (a folder project as a zip), with Show in folder; Keep as a new version keeps one at once.
- On the way can show a sealed day: its date and a seal, nothing else. A supporter's tiles show each app's icon, name and what it stands in for ("Instead of ...", or "A FormAI original"). Date to come appears only for apps the schedule lists without a date. The last tile is always Request a new Form App, which opens a prefilled GitHub discussion in your browser; FormPortal sends nothing itself. After the launch the section is titled Request, or New app on the horizon while a new app is announced.
- The sidebar has the social links under Preferences: formai.studio, YouTube, r/FormAI, Reddit, Discord, Instagram, Threads, TikTok and X, with Help last. In the folded rail they turn one at a time like a wheel.
- Profile can set up your own fork of form.ext-registry on GitHub, after you connect GitHub and approve the public_repo permission, with the steps to submit an extension.

### Improved

- Every app row on Updates and Apps is one line high. The installed version sits in a pill in the app's own colour, reading "installed v0.30.0 | 142 MB" with the download size, right beside the buttons; the whole tagline is in the line's tooltip, and the description uses the row's whole width. While an app installs or updates, its row keeps its buttons (disabled) and nothing in it moves.
- On the way's tiles are as tall as their own content.
- What changed opens in place under the row, set as headings, lists and paragraphs, without moving the rows above.
- Notices show five lines at most and scroll beyond that, lay out one app per line with its versions, keep long values such as a SHA-256 on one line, and leave by themselves after 5 seconds unless the pointer or the keyboard is on them. Updates are never red: only a failure is, and each failed update is its own notice.
- The "..." menu is a small panel in FormPortal's own look, with the keyboard able to move through it.
- The Your apps list in the sidebar scrolls smoothly with a trackpad or a drag and no longer jumps back or shows a blank band. Sidebar tooltips wait until the pointer rests on an icon for a moment.
- Every app page reads its own text and has a How it works section; form.ext and FormFabric have their screenshots. The size of an app is named as the download size.
- The page fills the window at any width, with the same margin on both sides.

### Changed

- The Apps page is one section, A tool for every canvas, in ten categories.
- Preferences, Account is now Profile, and its GitHub part is Connect to GitHub, with a plain statement of what is asked, what is kept and where it goes before you connect. Disconnect says how to withdraw FormPortal's access on github.com too. Version and Check & repair moved to General.
- The tutorial Try a beta beside stable is greyed until a Form app has a beta.
- The sidebar's title block is tighter, and its icons take the accent colour.
- README and SECURITY list every host FormPortal itself may contact, and what goes to each.
- FormPortal asks formai.studio what is on the way once at start, and again only when you show Home and the last answer is 15 minutes old or more. It no longer asks every 15 minutes in the background.
- FormPublisher is in the app list with its own icon, and FormREC is written as the website writes it.
- Each app's "Instead of" line follows what its repository says today: FormTools (QuickLook, HandBrake and Permute), FormWeb (Figma, Framer and Webflow), FormDesign (InDesign and Affinity), FormDAM (Apple Photos and Adobe Bridge), FormDeck (PowerPoint, Keynote and Google Slides), FormSurface (Substance 3D Painter) and FormSculpt (Nomad Sculpt and ZBrush).

### Fixed

- A file the download server does not have yet is reported as that ("The download server does not have [file] yet"), not as a file that does not match the catalogue. Nothing is written or installed in either case.

### Known issues

- The stock sources, Fontsource, Google Fonts, the templates download and GitHub's connect and fork were built to each service's documentation and have not yet been tried against the live services. The keychain has not yet been tried on a real system either.
- A fork that GitHub had to name differently (for example form.ext-registry-1) is shown, but its address does not open from FormPortal.
- The website's `/api/upcoming` answered with an error when version 0.71.0 of the site was first deployed on 21 November, and a site fix (0.71.1) is on its way. Until it is live, FormPortal shows its built-in schedule under On the way, and the supporter view cannot be checked against the live site.
- In a small window, a notice can cover the bottom of the install card.
- The Spanish has not been read by a native speaker.
- The desktop window was not built for this release on the machine that prepared it, and nothing was run on macOS or Windows, or in WebKit.

## v0.70.2 · 2026-11-20

- `formportal cli extension-install --path` (and the MCP tool `extension_install` with a path) follows the choice for outside agents, as installing, updating, rolling back and removing an app do: under Ask and Blocked it is refused with the same sentences, under Allowed it goes on to the usual package checks. Installing by id from the signed index is unchanged.
- The catalogue's pages for FormWav and FormRef name Antigravity where those apps offer it (FormWav's Settings, Agents, and FormRef's terminal dock), and three sentences for FormFabric, FormSculpt and FormTools have their missing space back.

## v0.70.1 · 2026-11-20

- An extension package that reaches FormPortal from outside its window, by a `formai://extensions?install=` link, by opening a `.formpkg` with FormPortal or from another program, is shown in a dialog with its file and path, and installs only when you press Install. Cancel leaves nothing installed. A file you drop on the window installs at once, as before. The new sentences are in Spanish too.
- The catalogue's pages for other Form apps name Claude Code, Codex, Cursor and Antigravity wherever that app's own README names all four, and the three browser demos are rebuilt with that text.

## v0.70.0 · 2026-11-20

- The two other browser demos, Updates and trust and Fonts, stock and templates, are rebuilt from the current interface: every sentence of FormPortal's that names the agent programs names all four, Claude Code, Codex, Cursor and Antigravity, and they offer the AMOLED Black appearance and FormRec's icon.
- The README's status now says released: FormPortal is built and bundled for macOS, Windows and Linux.

## v0.69.0 · 2026-11-20

- Every sentence that names the agent programs names all four: Claude Code, Codex, Cursor and Antigravity. This covers the line Ask your agent shows when it finds none, FormMCP's line in the app list, and the last line the install scripts print, in English and in Spanish.
- The hub's text follows the rest of the Form family: on macOS it is the system's San Francisco, as in FormVis; on Windows and Linux it is still Inter. Code and version numbers use the family's monospaced fonts. Colours, spacing and layout did not change.
- The browser demo is rebuilt from the current interface, so it names the four agent programs and offers the AMOLED Black appearance.
- The desktop window was not built for this release on the machine that prepared it, and nothing was run on Windows or macOS.

## v0.68.0 · 2026-11-19

- Antigravity, Google's `agy` program, is the fourth agent program FormPortal knows, beside Claude Code, Codex and Cursor.
- "FormPortal in your agent" in Preferences, Apps has a fourth row. Connect adds FormPortal's own MCP server to Antigravity, in the file Antigravity reads its servers from (`.gemini/config/mcp_config.json` in your home folder); Disconnect takes it out. Only FormPortal's entry changes: every other server and setting in that file stays as you wrote it, a copy of the file is kept before any change, and a second Connect or Disconnect with nothing to change writes nothing. A server named formportal that something else set up is left alone, and FormPortal says so.
- An app's AI tools tab lists Antigravity too, and Connect adds the app's own MCP server to it along with the other three.
- Ask your agent offers Antigravity when it is on this computer. Antigravity asks you before it uses a tool it has no rule for, and it cannot ask when FormPortal runs it in the background, so until you have allowed FormPortal's tools inside Antigravity its answer may not have read your apps. FormPortal never turns that question off. If Antigravity finishes without an answer, FormPortal says so instead of showing an empty reply.
- If Antigravity's settings are only in the place earlier versions of it used, FormPortal writes the current place and tells you the older file was seen and left alone.
- FormPortal finds `agy` the way it finds the other programs: on your PATH, in the PATH your shell reports and in the usual install folders. On Windows it also looks in Antigravity's own folder under your local app data. Nobody has yet tried this against a real install of Antigravity, on any system: it was built and checked with a stand-in program.
- When an agent program stops with an error, FormPortal no longer shows a line from the system's `env` tool about passing options as the reason; it shows the program's own last line.
- Cursor's and Antigravity's settings files are now replaced in one step, so a crash in the middle of a write cannot leave half a file.
- On the command line, `--clients` and `ask --client` take `antigravity`, and `./formportal agents install antigravity` adds FormPortal to it from a source folder.
- The desktop window was not built for this release on the machine that prepared it, and nothing was run on Windows or macOS.

## v0.67.0 · 2026-11-19

- FormPortal can add itself to Claude Code, Codex and Cursor. Preferences, Apps has a new group, "FormPortal in your agent", with one row for each program: what state it is in, and one button, Connect or Disconnect. Once connected, the agent can see and manage your Form apps through FormPortal's own MCP server. Before, FormPortal could connect an app's server to an agent but not its own, and that took a script from the source folder.
- A program FormPortal does not find on this computer gets no button; the row says where FormPortal looked. Cursor is looked for as its command and as the installed app.
- The entry is named formportal. If an agent already has a server of that name that something else set up, FormPortal leaves it alone and says so, on Connect and on Disconnect.
- An entry made by an earlier copy of FormPortal, or by `./formportal agents install`, is shown as connected to another copy; Connect points it at the FormPortal that is running, and Disconnect removes it. From an AppImage, the entry points at the AppImage file.
- Connecting changes only FormPortal's entry in the agent's settings file. The rest of Codex's and Cursor's file stays as you wrote it, a copy of the file is kept before any change, and a second Connect or Disconnect with nothing to change writes nothing. Connecting an app's server to Cursor now keeps the rest of that file as you wrote it too; before, its keys were sorted and the file was laid out again.
- On the command line, `connect`, `disconnect` and `app-agents` with no app named are about FormPortal itself; `--clients` narrows them. With an app named they do what they did.
- FormPortal's MCP server cannot add or remove FormPortal in an agent. Only the person can, in the window or on the command line.
- The three browser demos' Preferences say FormPortal 0.67.0. They were not rebuilt and do not show the new group.

## v0.66.0 · 2026-11-19

- A newer FormPortal can be acted on. The notice, Preferences and the Updates page now agree, and each has one button: "Install FormPortal [version] and restart" when this copy can update itself, otherwise "Get FormPortal [version]", which opens the download page. Before, the notice said a version was available, Preferences said FormPortal was up to date, and nothing could be clicked.
- The menu bar's Settings item opens Preferences (macOS).
- Claude Code, Codex and Cursor are found when FormPortal is started from the Dock, the Finder or the Start menu. Before, it looked only where the system's own short program path points, so a program installed by Homebrew, npm or in your home folder was reported as missing. Ask your agent offers Cursor's agent too.
- The side panel keeps its top row, its whole menu and its bottom group with any number of apps installed; only the app list scrolls. With 22 apps the menu had lost Fonts, Stock and templates, Extensions and Learn, and the top row was cut in half.
- The app list in the side panel goes round when scrolled, and fades at an edge that has more.
- Every "..." menu opens whole, inside the window. The menus of the last rows of a list and the menu on an app's page were cut off.
- Preferences shows a gear, not a sun.
- Files rows show Open, Versions and Public link. They were hidden by mistake.
- Going back to the version before says what it did, names the version in the menu ("Go back to 2.1.1"), and the Update automatically switch shows what was set. Before, the switch could stay on and the next settings change could turn automatic updates back on for that app.
- An app's Versions and beta tab lists the versions with date, size and notes, with Install beside each, and shows the version kept to go back to.
- Updates rows show what changed and the download size.
- Remove from this computer asks first.
- An app's page shows where the app is installed and the SHA-256 of what is installed.
- Every app row has a line under its name. FormCel, FormTxt, FormRef, FormTray and FormSculpt had none.
- The README's "Latest release" opens this repository's newest release.

## v0.65.0 · 2026-11-19

- On Windows, Open now starts the app's own program. Before, for 14 of the 23 apps (FormVis, FormLit, FormRef and others) it started the app's helper in a console window and the app never appeared. Apps already installed are fixed without reinstalling.
- FormPortal never opens a console window when it starts an app or looks at running programs.
- A helper left running by the earlier Open, which kept the app from starting, is stopped when you press Open, as long as the app itself is not open.
- If an app closes right after starting, FormPortal says so, with the exit code, instead of showing nothing.
- If FormPortal cannot tell for certain which program opens an app, it says so and names the folder, and starts nothing.
- An app's package can name its program for Windows in form-app.json (`launch.windows`); FormPortal uses it when it is a program inside the app's own folder.
- Installing, updating, rolling back and removing apps through FormPortal's MCP server or command line follow the person's choice for outside agents (Ask, the default; Allowed; Blocked), set only in the window under Preferences, Apps, Outside agents. Under Ask the request is refused and the agent is told to ask the person to do it in the window. The saved choice is sealed, and a choice changed outside FormPortal goes back to Ask. `status` reports it as `outside_agents`.
- An install whose record of files cannot be written now fails with a message instead of being reported as done without the record.
- New theme: AMOLED Black, a true-black theme for OLED screens, in Preferences, Interface, Appearance. The window opens in it with no other theme shown first.
- FormPortal writes agents/manifest.json (its MCP tools and which only read, its skills), kept in step with the server by `./formportal agents sync`; the README's MCP tool count is generated, and documents no longer state how many Form apps load extensions.
- The documents describe the outside-agents choice (README, wiki Agents, the harness skill), AMOLED Black (wiki), and the supported-versions table in SECURITY.md.
- The three browser demos' Preferences say FormPortal 0.65.0.

## v0.64.1 · 2026-11-11

- Asking FormPortal's MCP server for a tool it does not have now says that tools/list names every tool, instead of claiming there are thirty-three (there are forty). A test now holds that message.
- The three browser demos' Preferences say FormPortal 0.64.1.

## v0.64.0 · 2026-11-09

- FormPortal's three demos open inside the app: Installs and files, Updates and trust, and Fonts, stock and templates. Home has a Demos section with a card for each, and Preferences has them under Help.
- A demo shows FormPortal in a prepared state, with sample apps and files, under a bar that says it is a demo. Nothing in it installs, changes or removes your apps, settings or files. Start over resets the demo; End demo returns to where you were.
- Agents can open a demo with the new `demo` tool, and `formai://demo/install`, `formai://demo/updates` and `formai://demo/library` open one from a link.

## v0.63.7 · 2026-11-10

- On a Mac that had apps installed before FormPortal's data folder moved (v0.58.0), Check and repair no longer calls the installed apps leftovers and deletes them, and updating an app no longer deletes the earlier version kept for Go back.
- Removing an extension and turning it on or off now work for FormDeck's and FormPortal's own extensions. Both used to fail with "not installed".
- Going back to the oldest of a file's 20 kept versions restores it. It used to delete that version and fail.
- Sharing a second folder with the same name as one already shared now makes its own private repository. Its files used to go into the first folder's repository, where the people invited to the first folder could read them.
- Publishing a changed file again now removes the earlier copy from your public repository, so Unpublish leaves nothing behind.
- Updates now treats beta.10 as newer than beta.9, as automatic updates already did, so the update is shown, counted and included in Update all.
- Pressing Install every released app or Update all a second time while they run no longer starts a second install of the app already downloading.
- On Windows, apps that come as an NSIS or MSI installer now install into FormPortal's folder when your user folder's name has a space. They used to land in their default folder and could not be opened from FormPortal.
- On Windows, Ask your agent and connecting Claude Code or Codex work when they were installed with npm.
- On Windows, `formportal.bat cli` and `agents` pass on lists with commas, values with `=` and more than eight arguments as typed.
- `./formportal mcp` and `./formportal cli` rebuild when the release schedule changes, so `apps` reports the current dates.
- Learn no longer lists tutorials for apps that are not out yet.
- When turning an extension on or off fails, its switch goes back to where it was.
- Storage lists each project folder, also when two of them have the same name.
- The updates demo's development server uses its own port, so it runs beside the first demo's preview.

## v0.63.6 · 2026-11-10

- On Windows, `formportal.bat mcp`, `cli` and `agents` now pass on the real exit code of what they ran. They used to exit 0 even when the command line, the MCP server or the agents setup failed, so a script or an agent host could not tell.
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
