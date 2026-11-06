# HASHOUT_LOG · frontend · formportal

Living log for FormPortal's interface (formai_dev's `hub/frontend` up to formai_dev 0.26.0; older entries keep the old paths). Source files stay comment-free; what they would have said lives here. Tokens, icons and the marker renderer are logged in `design/HASHOUT_LOG.md`.

Current build version: v0.57.0
Last updated: 2026-11-06 · v0.57.0 every icon in the dark and light v3 sets, following the theme (tiles, Files, the brand, the splash, the app icon); 2026-11-06 · only released apps shown (live), On the way, What it does from formai_dev's app caps, the reveal waits for the catalogue; 2026-11-06 · the family look (formvis v1.99.7 tokens, dark by default, shared accent, no scrollbars, the macOS title row) and Preferences rebuilt in formvis's structure; 2026-11-06 · the scroll fix measured in WebKit, Included on a reopen, prelaunch apps with a release, formai.studio in the wording; 2026-11-03 · the stage scrolls again; 2026-11-02 · repository links in nodemode-dev; 2026-10-25 · Included, Support the maker, the portfolio line; Agent skills on app pages, formMCP in the Agents sections; every app tile is the app's own icon; the catalogue follows formcompiler's registry; Share, Public link and Shared with you in Files; Preferences, Account (the GitHub sign-in); the font is decided before the first frame; open at login; release dates in Other versions

## v0.57.0 · dark and light icons that follow the theme {#icons}

### public/apps, vite.config.ts tile, extensions/files appIcon, src/styles/live.css · the tiles
- refers-to: public/apps/<id>.webp, public/apps/<id>-light.webp · vite.config.ts :: tile · src/extensions/files/index.ts :: appIcon · src/styles/live.css :: `.ic-dark`, `.ic-light`, `.brand-icon` · index.html :: `.brand`
- kind: decision
- logged: v0.57.0 · 2026-11-06

The owner sent the v3 icon sets (`updated-icons-v3`, dark, and `form-icons-v3-FINALS-lightmode`, light, 1024 px each, 35 apps) and asked that both be used, following the theme the person sets, for FormPortal and every app tile, with unreleased apps hidden as on the site. Every registry id has `<id>.webp` (dark) and `<id>-light.webp` (light) at 256 px, made from those files (the source names differ for formai, formpath, formmd, formdam, formslide, format, formmcp, formranker: formportal, formpth, form-md, formDAM, formdeck, formAT, formMCP, formbench). Each tile holds both images and CSS shows the one for `html[data-theme]`, so a change of theme swaps them with no request and no new element; both are loaded up front for that reason. Tiles of apps that are not shown are hidden with their app by the `data-live` rules, as before. The sidebar brand is FormPortal's own icon in both tones in place of the drawn three-bar mark. Checked in WebKit and Chromium on the built interface: one image per visible tile, both tones loaded, and switching to Light shows the light images with the element count unchanged (7617 before and after).

### public/splash-theme.js, splash.html, splash.css · the splash follows the theme
- refers-to: public/splash-theme.js · public/splash.html · public/splash.css · public/favicon.png, public/favicon-light.png
- kind: decision
- logged: v0.57.0 · 2026-11-06

The splash reads the same `formportal-theme` value before it paints (the splash window shares the page's origin, so its storage). Light gives a light card (#f4f4f6, a dark hairline, #5c5c66 text, a light bar track) and the light icon; otherwise formvis's dark card and the dark icon. The bar and the timing are unchanged.

### extensions/appicon · the app's own icon
- refers-to: src/extensions/appicon/index.ts · ../src-tauri/src/app_icon.rs :: set_app_icon
- kind: decision
- logged: v0.57.0 · 2026-11-06

In the desktop app, the theme is sent to the shell's `set_app_icon` at start and on every change (only when it changed), so the window and taskbar icon and, on macOS, the Dock icon follow it. See `src-tauri/HASHOUT_LOG.md#app-icon`.

## v0.56.0 · only released apps, as on formai.studio {#live}

### vite.config.ts, src/styles/live.css, public/prelive.js, extensions/live · which apps are shown
- refers-to: vite.config.ts :: ALIAS, SCHEDULE, LIVE, LEFT, liveRules, portalPlugin.transform, renderPortal (soon, rootState, data-fam-group) · src/styles/live.css · public/prelive.js · src/extensions/live/index.ts :: isLive, liveNow, live · src/extensions/route/index.ts :: route.go · index.html :: `[data-soon]`, head links
- kind: decision
- logged: v0.56.0 · 2026-11-06

The owner: of the 34 Form apps only 13 are public, on a release schedule, and the others are hidden on formai.studio unless one supports the project; FormPortal must match. Read in formai_dev v0.56.1: the site hides every product that is not live (`gate.py`; live means a published release exists), the schedule only dates countdown tiles, and a supporter's cookie shows the hidden names, never a build; no endpoint tells a desktop client who is a supporter. So FormPortal shows an app when it has a release on stable or beta (the signed catalogue plus each app's GitHub releases) or is installed here, and names no other.

How it stays flash-free: the whole state sits on `<html>`. `data-live` lists the live ids; for each app the build appends `html:not([data-live~="id"]) [data-product="id"] { display: none !important }` to `live.css` (the plugin's `transform` hook, so the rules are a same-origin stylesheet the CSP allows), plus one rule per group heading in the Apps list and on Home whose apps are all hidden. The build writes a default `data-live` (the apps of schedule groups already opened at build time) and `prelive.js`, before first paint, replaces it with the last set seen (`formportal.live` in localStorage, `{live, soon}`). The live extension recomputes on `source`, `install` and `policy`, writes only attributes that changed and the Apps count, and keeps the cache. On the very first launch the default can differ from the truth, so the reveal waits for the catalogue (next entry). `route.go` refuses `app-<id>` for an app that is not live, so a `formai://app/<id>` link to it lands on Apps, as for an unknown id.

On the way: one group per schedule release (`catalog/schedule.json`, copied from formai_dev) with "Opens <date>" or "Due now" (`data-due` once the date has passed and apps are still unreleased) and one unnamed "Form?" tile per unreleased app; `html[data-soon-gN]` holds the count and generated `nth-child` rules show that many tiles, so no element is created or removed; `data-soon-left="0"` hides the section. A Support the Form apps link opens formai.studio's support page.

Checked 2026-11-06 on the built interface in WebKit and Chromium (CPU 4x, script held 1.5 s), with the bundled sample catalogue (FormCut its one release): first launch, the window not yet revealed at 500 ms, then FormCut alone with 18 On the way tiles at reveal; returning launch, the cached set already in place at 500 ms; a click on a hidden app's link stays on Apps; Home and Apps hide the empty Instead of Adobe, On the way and Family tools headings.

After an independent review the same day: the Extensions filter buttons and the formskills and formMCP mentions on every app page carry `data-product`, so they hide with their app; Files rows keep showing a person's own projects whatever app owns them (the rule skips `[data-path]`); Learn hides tutorials of apps not shown; search counts only shown rows for its "no app matches" line; the open-file and web-link notices say "a Form app" instead of an app that is not shown; the Files start text no longer names three apps; with no catalogue the shown set keeps the last one and adds every installed app; the 2.4 s reveal timer starts before any extension is set up, so a failing setup still reveals the window. A walk of every sidebar place and Preferences on the built interface found no visible name of an app that is not shown (22 names checked, sample catalogue).

### main.ts · the reveal waits for the catalogue
- refers-to: src/main.ts :: revealLate, revealApp · src/bridge/reveal.ts · ../src-tauri/src/reveal.rs
- kind: decision
- logged: v0.56.0 · 2026-11-06

formvis reveals after its fonts load or 2.5 s, inside a splash that lasts at least 2.6 s. FormPortal reveals when the catalogue arrives (`source`) or after 2.4 s, whichever is first, so on a first launch the window normally appears with the right apps already; on a slow or offline start it appears at 2.4 s with the default or cached set and corrects in place.

### vite.config.ts · What it does on each app page
- refers-to: vite.config.ts :: caps, capsBlock · catalog/apps/*.json :: checks, runs_on
- kind: decision
- logged: v0.56.0 · 2026-11-06

The owner asked for app caps from formai.studio. The site serves no per-app JSON (`/catalog/*` other than `v1/apps.json` answers 404); its pages are built from formai_dev's `catalog/apps/<id>.json`. Those files are copied into `catalog/apps/`, and each app page carries their `checks` (what the app does, as the site states it) and `runs_on`, written at build time.

## v0.56.0 · the family look and Preferences {#family-look}

### design/tokens.css, src/styles/main.css · formvis's vocabulary, FormPortal's names mapped onto it
- refers-to: ../design/tokens.css :: `--bg-primary` to `--ctl-xl`, `--ground` to `--focus`, `--radius-s`, `--radius-m`, `--radius-l` · src/styles/main.css :: `.btn`, `.btn-primary`, `.seg`, `.seg-item`, `.field`, `.switch`, `.prefs`
- kind: decision
- logged: v0.56.0 · 2026-11-06

The owner's goal is that FormPortal looks like formvis. The values are formvis v1.99.7's (`frontend/src/styles/tokens.css` and its Studio Dark and Light profiles in `themes.ts`): surfaces `--bg-primary/secondary/tertiary`, lines `--border-color/light/soft`, text `--text-primary/secondary/muted`, `--accent-color` (#f97316) with `-dim` and `-hover`, `--danger-fill/soft`, radii, `--space-1` to `--space-7`, shadows, `--fs-11` to `--fs-14` and `--ctl-*`. FormPortal's 2500 lines keep their own names, which now point at those: `--ground` is `--bg-primary`; `--inset` and `--pane` are `--bg-secondary`; `--float` and `--control` are `--bg-tertiary` (hover and press mix in `--text-primary`, so they work in both profiles); `--edge` is `--border-color` and `--edge-strong` is `--border-light`; `--ink`, `--ink-soft`, `--ink-faint` are the three text tokens; `--focus` is the accent; the radii are 6, 10 and 12. The light profile is formvis's "Light" (the warm #ecebe6 family), not FormPortal's old cool one. Chosen on purpose, and visible: buttons are no longer pills, the primary button, the checked switch and the pressed segment are the accent, and dialogs take formvis's border, radius and window shadow. Not taken: formvis's font stack (FormPortal ships Inter and the prepaint font guard depends on it), formvis's pill-less search field (the search stays a pill), and its theme profiles (FormPortal keeps System, Light and Dark). Per-app `--hue` values are unchanged and still colour the app tiles and app pages; `--accent-color` is for interface chrome only. Three layer tokens were added to the z scale for the Preferences rail, wire and port (`--z-prefs-wire`, `--z-prefs-tab`, `--z-prefs-port`), each on the existing scale (`--z-base`, `--z-raised`, `--z-raised` plus 1); no raw number was written.

### public/prepaint.js, src/extensions/theme · dark is the default, System stays
- refers-to: public/prepaint.js :: theme part · src/extensions/theme/index.ts :: `read`, `theme.set`
- kind: decision
- logged: v0.56.0 · 2026-11-06

Formvis opens dark, so FormPortal does too: with no stored choice the interface is dark whatever the system says. The key stays `formportal-theme`, and no value is orphaned: `light` and `dark` mean what they did, and `system` is now stored (before, System was "no key"). A person who had chosen Match the system has no key, so they now see dark once, until they pick Match the system again; there is no way to tell that person from a new one. The Appearance buttons in the markup start with Dark pressed so the first frame needs no attribute change.

### public/prepaint.js, src/extensions/theme · the shared accent
- refers-to: public/prepaint.js :: accent part · src/extensions/theme/index.ts :: the `[data-accent]` picker · index.html :: Interface card
- kind: decision
- logged: v0.56.0 · 2026-11-06

`prepaint.js` reads `nodemode_ui_settings` (the key formvis's `themes.ts` calls `STORAGE_KEY`) and, when `accentColor` is a #rrggbb colour, sets `--accent-color`, `-dim` (accent and 33) and `-hover` on `documentElement` before the first paint, so an accent chosen in formvis shows in FormPortal at once. FormPortal also gets the control: Interface has an Accent colour picker and a Reset. It writes the same shape as formvis's `saveChoice`: the stored object is merged, `accentColor` is set, and `appearance: 3` (formvis's `APPEARANCE`) is written, because formvis ignores a blob without it and would fall back to its defaults, which would also drop its saved theme. The picker applies on `input` and writes on `change`. Not done: a `storage` listener, so an open window does not follow another app's change until it is reopened (formvis does not either).

### src/styles/main.css · no scrollbars
- refers-to: src/styles/main.css :: the last rules (`*::-webkit-scrollbar`, `scrollbar-width`)
- kind: decision
- logged: v0.56.0 · 2026-11-06

The same rules as formvis's `scrollbars.css`: no bar is drawn anywhere, in WebKit and Chromium or in Firefox, with `!important` so no later rule brings one back. Wheel, trackpad, touch and keys still scroll, and `.stage` still scrolls (its `scrollbar-gutter: stable` now reserves nothing). The Preferences pane relies on this too.

### public/prepaint.js, src/styles/main.css, index.html · the macOS title row
- refers-to: public/prepaint.js :: `has-overlay-titlebar` · src/styles/main.css :: `.has-overlay-titlebar` rules · index.html :: `data-tauri-drag-region` on `.brand`, `.top`, `.top-title`, `.top-tools`
- kind: decision
- logged: v0.56.0 · 2026-11-06

`src-tauri/src/traffic_lights.rs` now centres the traffic lights in a 38 px row at the top-left (LEFT 14, ROW 38). `prepaint.js` sets `html.has-overlay-titlebar` only when `"__TAURI_INTERNALS__" in window` and `navigator.userAgent` contains "Mac" (formvis's `wantsOverlayTitleBar` uses `navigator.platform`; the user agent is what the task named). Under the class `--top-h` is 38 px, the sidebar's top row keeps 78 px free at its left (`--traffic-w`, formvis's `--cv-traffic-w`), and the top bar's controls take the compact size (`--ctl-md`, 28 px: icon buttons and the search field). The header elements carry `data-tauri-drag-region`: the sidebar's brand row (its children ignore the pointer under the class so the row itself is the target), the top bar, the page title and the empty tools container; the buttons and the search field do not. Below 860 px the sidebar is 64 px wide, narrower than the lights, so the logo is hidden there on macOS. Measured with `__TAURI_INTERNALS__` and a Macintosh user agent injected in Playwright (Chromium and WebKit): `.top` is 38 px tall with 37 px of content, the search and buttons are 28 px at y 5, the logo starts at x 78. Off macOS nothing changes: no class, 56 px rows.

### index.html, src/extensions/prefs, src/styles/main.css · Preferences in formvis's structure
- refers-to: index.html :: `<dialog class="prefs cv-prefs-dlg" data-prefs>` · src/extensions/prefs/index.ts · src/styles/main.css :: `.cv-prefs-*` · ../design/icons.json :: `pf-interface`, `pf-user`, `pf-about`, `pf-fold`, `pf-close`
- kind: decision
- logged: v0.56.0 · 2026-11-06

Taken from formvis v1.99.7's `SettingsDialog` and `dialogs.css` (the map in `FORMVIS_SETTINGS_MAP.md`): a floating left rail (232 px, 76 px collapsed, tabs 40 px, fold button, state in `formportal.prefsRailCollapsed`), one scrolling pane of foldable cards (head with icon, label and chevron; groups with uppercase accent labels), the SVG wire from the active tab to a port on the dialog's header divider, a scroll spy, click-to-scroll, a footer with a primary Done, Escape and backdrop close. Sizes are the map's: the dialog is min(840px, 100vw - 280px) by min(86vh, 780px), the head 44 px, controls 30 px. Where formvis centres a flex item with `margin-left: 240px`, a `<dialog>` is placed with `inset-inline: 240px 0` and `margin: auto`, which lands on the same pixels (290 px from the left at 1180 px wide).

What stayed FormPortal's: it is still a `<dialog>` opened with `showModal()`, still `prefs.open` with the section as its argument (the section names are `general`, `interface`, `apps`, `catalogue`, `account`, `about`; `main.ts` passes the link's id), and every control and key is where it was (`data-pref`, `data-quiet`, `data-setting`, `data-setting-input`, `data-theme-set`, `data-lang-set`, `data-open-set`, `data-self-*`, `data-repair-*`, `data-account-*`, `data-managed`, `[data-prefs-tab='account']` for the account check), so `extensions/settings`, `theme`, `account`, `notices`, `repair` needed no change. The old General panel is split: General (opening, notifications, background), and a new Interface card (Appearance, the Accent colour, Language), as formvis keeps theme and language under Interface. The About card's heading "FormPortal 0.x" became a Version group with the same text as a line, because the group label is uppercased. `.prefs`, `.prefs-title` and `.versions` and `.ask` are kept for the other dialogs; only the dialog's own classes (`prefs-frame`, `-tabs`, `-tab`, `-body`, `-panel`, `-h`, `-field`, `-close`) were removed and replaced by `.cv-prefs-*`, so nothing else loses a rule. The rail's `overflow: visible` on the dialog is needed because a `<dialog>` is `overflow: auto` by default and would clip it.

No flash: the whole dialog, the rail, the wire (empty `d`) and the port are in `index.html` at build time (inside the same `renderPortal` markers as before, `@portal:autolist` untouched). Opening only calls `showModal()`, marks a section if one was named and queues one animation frame; the wire writes `d` only when it changed and moves the port with `transform` only when its Y changed; folding writes classes, `hidden` and `aria-expanded`. Nothing is created or removed.

Verified (Playwright, Chromium and WebKit, 1180 x 760, the built `dist` served over http): with the CPU throttled 4x (Chromium, `Emulation.setCPUThrottlingRate`), `document.querySelectorAll('*').length` is 7407 before and 7407 after opening, and a MutationObserver counted 0 added or removed nodes on opening and on a second opening. Each of the six rail tabs scrolls the pane (0, 702, 1083, 1498, 1907, 2231 px in Chromium; within 1 px in WebKit), marks its tab and card, and changes the wire path; a fold collapses a card from 403 px to its 44 px head and back; the rail collapses to 76 px, is remembered after a reload and expands again; Done, Escape, the backdrop and the close button all close it; the accent picker applies at once, is stored as `{"accentColor":"#3366ff","appearance":3}` and survives a reload. Screenshots, dark and light, in `/home/claude/wk/shots/`. Not verified: the desktop window was not opened (no Tauri build here), so the real traffic lights, the drag regions and WebKitGTK's own rendering are unchecked; the Spanish page was built but not looked at; keyboard use of the rail (arrow keys) was written but not driven; screen readers were not tried.

## v0.55.0 · the scroll fix in WebKit, Included on a reopen {#webkit}

### src/styles/main.css · the v0.54.0 scroll fix, measured in WebKit
- refers-to: src/styles/main.css :: `.shell`, `.main`, `.stage`
- kind: explainer
- logged: v0.55.0 · 2026-11-06

The owner reported on 2026-11-06 that FormPortal still would not scroll. Measured on the built interface in Playwright's WebKit (the engine family of the macOS and Linux windows) and in Chromium at 1180 x 600, a wheel over the stage on every sidebar place, every `app-*` page, Learn after opening and closing Preferences, and both "where I left off" launches: every page taller than the stage scrolls, none is held. The same probe on the v0.53.5 interface (commit a7b7cbe) holds every page in WebKit: `.stage` is as tall as its content (1866 px on Home in a 544 px stage). So the CSS in the tree is right; the window that does not scroll is a FormPortal older than 0.54.0. The store's update feed (`dl.formai.studio/formportal/updates/latest.json`) and the signed catalogue both still name 0.53.5 as the newest FormPortal, so no installed copy has been offered 0.54.x. That is fixed where it is published (formpipe), not here; `core/HASHOUT_LOG.md#releases` covers what FormPortal now reads instead.

### src/styles/main.css · Included on a "where I left off" launch
- refers-to: src/styles/main.css :: `html[data-launch] .pane`, `html[data-launch] .nav-item` · public/prepaint.js :: places
- kind: fix
- logged: v0.55.0 · 2026-11-06

`prepaint.js` reopens Included (it is in `places` since v0.51.0), but the pre-paint rules that show the reopened pane before the script runs listed every place except Included, so the first frames hid Home and showed no pane at all until the router ran. With the script held 2 s, the old interface showed an empty stage for about 3 s in WebKit and Chromium (CPU throttled 6x); with `included` in both lists the pane is there at the first sample.

### src/engine/index.ts · Engine.view, prelaunch with a release
- refers-to: src/engine/index.ts :: Engine.view · ../core/src/lib.rs :: Catalog::view
- kind: fix
- logged: v0.55.0 · 2026-11-06

The same rule as the engine: a prelaunch product is unreleased only while it has no release on any channel, so FormTray, formMCP, FormPDF and formskills can be installed from the Apps list and their pages. Their status chip still says In development, because that text comes from `catalog/products.json`, formai_dev's copy; it changes there.

### main.ts, extensions/settings · formai.studio
- refers-to: src/main.ts :: self-update notices · src/extensions/settings/index.ts :: SOURCE · src/i18n/es.json
- kind: fix
- logged: v0.55.0 · 2026-11-06

The update notices and the catalogue line in Preferences named formai.dev, which now serves a different product; they name formai.studio, in English and Spanish.

## v0.54.0 · the stage scrolls again {#stage-scroll}

### src/styles/main.css · `.main` may shrink, `.shell` has one bounded row
- refers-to: src/styles/main.css :: `.shell`, `.main`, `.stage`
- kind: fix
- logged: v0.54.0 · 2026-11-03

Nothing in the window scrolled. `.main` became a grid in v0.35.0 (`grid-template-rows: var(--top-h) minmax(0, 1fr)`), and as a grid item of `.shell` it kept the default `min-block-size: auto`, which for a grid container is its content's height: the top bar plus every pane in `.stage`. `.main` grew past the window (2134 px in a 700 px window, measured in Chromium on the built interface), `.stage` grew with it, so `overflow-y: auto` never had anything to scroll, and `body { overflow: hidden }` clipped the rest. `.main` now sets `min-block-size: 0`, and `.shell` names its single row `minmax(0, 1fr)` instead of leaving it an implicit auto track, so both columns are bounded by the window whatever the engine does with intrinsic grid sizes. Measured after the change at 700 px and 420 px, with the CPU throttled 4x and a slow network, across a hard reload: `.main` equals the window from the first sample, `.stage` is the window less the top bar, a wheel scrolls `.stage`, and the document itself still does not scroll. WebKit was not available here; the rule is the same in every engine, but the desktop window was not opened.

## v0.53.5 · repository links in nodemode-dev {#nodemode-dev}

- refers-to: index.html :: help links · vite.config.ts :: repo · src/bridge/fixture.ts · ../catalog/products.json · ../catalog/fixtures/apps.json, extensions.json
- kind: decision
- logged: v0.53.5 · 2026-11-02

The Form repositories moved from `nodemode-ai` to `nodemode-dev`. The Guide, What changed, Report a problem and Ask the community links, the app pages' repository links (`repo` in `vite.config.ts` now matches `https://github.com/nodemode-dev/`, the organisation formcompiler's registry writes into the catalogue) and the browser preview's fixtures say so; the shell's `WEB` list allows the new prefix. `catalog/products.json` and the fixtures are copies of formai_dev's contract, so formai_dev's copy should take the same change; the fixture's formai_dev entry keeps its old address, since that repository did not move.

## v0.53.1 · vite 8.3.5, zero npm audit findings {#vite-audit}

### Vite 8.3.5 clears the dev server's launch-editor advisories
- refers-to: package.json :: devDependencies `vite`, package-lock.json
- kind: decision
- logged: v0.53.1 · 2026-10-25

Family rule from `FAMILY_DEV_PLAN.md` v0.4.x Phase 2b (formai_dev sidecar): every frontend installs with zero `npm audit` findings. Vite 8.3.2 carries a `launch-editor` with two command-injection advisories in the dev server (ledger FB-004); 8.3.5 clears them. The pin stays exact. Dev dependency only, nothing in the shipped bundle changed.

Verified: `npm install` then `npm audit` reports 0 vulnerabilities; `npm run typecheck` passes; `vite build` to an outDir outside the repo succeeds; the dev server starts on 3250 printing only the Local address (no Network address) and answers 200. The window was not opened.

## v0.51.0 · Included, Support the maker, the portfolio {#included}

Parity rows 58, 33 and 54, closed the family's way: free, no account, no server.

- Included (index.html pane `included`, nav after Learn with the tag icon; `vite.config.ts` part `included`): the plan (free, every app, every update, no account, open source, no offers because nothing is sold), links to Fonts, Stock & templates, Extensions and Tutorials, and every app and tool from `products.json` with Free, its licence and its state. Built into the page, so it is complete in the first frame; `prepaint.js` lists `included` among the places "Where I left off" can reopen. Throttled check (4x CPU, slow network) opening on it in English and Spanish: CLS 0 in all six runs.
- Support the maker (index.html `#ext-row` details panel `[data-ext-support]`, `extensions/library` fill): shown when the catalogue entry carries `support`, an https address the engine already filtered; it opens in the browser like every `data-web` link, and says the extension stays free. It lives in the closed details panel, so showing it moves nothing.
- The portfolio line (index.html share dialog `[data-share-folio]`, `extensions/share` showFolio): the address of the person's portfolio page from `SharesView.portfolio`, in a line that keeps its height when empty (`visibility: hidden`), so the dialog does not grow when the first public link is made.
- Spanish entries for every new string in `i18n/es.json`.

## v0.50.0 · formMCP and formskills on every app page {#family-tools}

### Agent skills, a fact on each app page
- refers-to: vite.config.ts :: the facts list (dd.facts-skills data-skills, .skills-yes, .skills-no) · src/extensions/apps :: patch (data-has) · src/engine/types.ts :: Product.agents · src/styles/main.css :: .facts-skills · ../catalog/fixtures/apps.json :: formcut agents
- kind: decision
- logged: v0.50.0 · 2026-10-25

The family plan's Phase 2: each app page says whether the app's releases carry agent skills, from the catalogue's `agents.skills` (formcompiler writes it), and Read them in formskills goes to formskills' page. The row is in the facts list from the first paint and only `data-has` (yes, no, or unset before the catalogue arrives) picks which of the two prepared texts shows, so nothing moves. The fixture's formcut now carries `agents: { mcp: true, skills: true }` (valid against `apps.schema.json`) so both states can be seen in the browser mode. Checked at 4x CPU and a slow network in English and Spanish: formcut reads Read them in formskills, formvis None published, layout shift 0, no page error.

### formMCP in every Agents section
- refers-to: vite.config.ts :: the agents section (p.ap-via), except on formMCP's own page
- kind: decision
- logged: v0.50.0 · 2026-10-25

Each app's Use with your AI tools section keeps its own Connect, and adds that formMCP is one connection to the whole family and loads an app's tools only when needed, with a link to formMCP's page, where formMCP's own Agents section connects it like any app with an MCP server. It is static text inside a section that shows and hides as a whole.

## v0.49.0 · the apps' own icons, the registry's app list {#icons}

### Every app tile is the app's icon
- refers-to: public/apps/[id].webp · vite.config.ts :: icon, tile · src/styles/main.css :: .tile-icon, .tile-icon > img, .tile[data-has-shot] > img · src/extensions/files :: appIcon
- kind: decision
- logged: v0.49.0 · 2026-10-25

The owner's rule (CLAUDE.md: Form apps are shown with their own icons, never two-letter tiles) and the owner's icon set of 2026-10-25 (`form-icons.zip`, 1024 px macOS masters with a transparent margin and shadow). Each master was cropped to its visible box (alpha above 8), centred on a square and saved as a 176 px WebP with alpha (twice the largest tile, 88 px), named by catalogue id: `form-md` is formmd, `formDAM` formdam, `formMCP` formmcp, `formdeck` formslide, `formportal` formai, `formpth` formpath, `formsculptor` formsculpt; about 5 KB each, 24 files including formranker for later. `formcompiler` and `formpromo` are not catalogue apps and were not added. The generator ran from the session's scratch folder, not the repo (the masters are 11 MB). The build's `tile()` writes an `img` with its size given inside the tile, whose box is fixed by `--tile`, so the image arriving moves nothing; an app with no file keeps its letters. Files sets the same image on its rows at run time (`appIcon`, once per product), falls back to letters if the file fails to load, and hides the icon under a project's own preview. Checked: every tile in the built English and Spanish pages is an image (174 in English; only the fonts list's "Aa" is text, and it is a font, not an app), no image request fails, Files rows show their apps' icons, layout shift 0 on four English and three Spanish cold loads at 4x CPU and a slow network, no page error.

### The app list follows formcompiler's registry
- refers-to: vite.config.ts :: GROUPS (tools, Family tools) · ../catalog/products.json · ../catalog/schema/products.schema.json :: group enum
- kind: decision
- logged: v0.49.0 · 2026-10-25

The owner's Q5 (family plan v0.3.x): `products.json` holds the 23 apps formcompiler builds, so every tile has an icon. A fourth group, Family tools, lists formMCP, formskills and FormTray.

## v0.48.0 · sharing in Files {#share}

### The share dialog, the two row buttons, Shared with you
- refers-to: index.html :: data-share-dialog (data-mode folder or file), data-folder-share in #folder-row, data-file-act="link" in #file-row, data-shared-block and #shared-row · src/extensions/share · src/styles/main.css :: .share, .field-row, .share-status, .share-link, .row[data-kind], .row.file and .row.folder --acts-w · src/main.ts :: shares.load, share.folder, share.send, share.accept, share.pull, share.publish, report, shareWork · src/bridge (fixture: `?github` and `?shared`, an in-memory share, publish and invitation) · src/engine :: shares and shareResult events, the share types · src/i18n/es.json
- kind: decision
- logged: v0.48.0 · 2026-10-25

One modal dialog serves a folder's Share and a file's Public link; `data-mode` picks which lines and buttons show, so opening it moves nothing on the page, and its status line (3 lines tall) and link line (one line, ellipsis) keep their height while text changes. The two new row buttons are found by delegation on the document, so the Files extension's keyed rows are untouched. Shared with you sits below Storage, so when it appears nothing above it moves; its rows are keyed by invitation id or repository and an accepted invitation's row is swapped for the library's in the same frame. Adding a third button to file rows pushed the buttons over the date: file rows now have a 21rem action column (19rem under 1100 px) and folder rows 16rem under 1100 px, measured in English and Spanish at 1280, 1100 and 1000 px with the state text clear of the buttons. The shared row template has an empty state cell so its buttons sit in the action column like every other row. Checked in the preview at 4x CPU and a slow network, English and Spanish: sign in, Files, Share with two invitees (status and link fill in, dialog height unchanged), Public link, make and remove it (dialog height unchanged, Remove disabled when there is no link), Accept an invitation (no layout shift, the row becomes Get the latest, a notice); no layout shift without input, no page error. The folder row's own counts ("4 projects", "Keeps versions") are still English in Spanish; that predates this version.

### Allow sharing in Preferences, Account
- refers-to: index.html :: data-account-share · src/extensions/account :: data-scope · src/styles/main.css :: .account[data-account="on"][data-scope="profile"] .account-share
- kind: decision
- logged: v0.48.0 · 2026-10-25

Signed in with profile access only, the Account panel offers Allow sharing beside Sign out; it runs the same device flow with `repo` added, and the new token replaces the old one in the keychain. `data-scope` (profile or repo) is set from the granted scopes. Sharing's refusal without repository access names this button. Checked in Spanish at 4x CPU: signed out, signed in (profile, Allow sharing shown), the code, signed in (repo, only Sign out); the panel stays 130 px; no layout shift.

## v0.47.0 · Preferences, Account {#account}

### The Account panel
- refers-to: index.html :: data-prefs-tab="account", data-prefs-panel="account", data-account and its children · src/extensions/account · src/styles/main.css :: .account and its states · src/main.ts :: account.check, account.start, account.cancel, account.signOut · src/bridge :: githubStatus, githubStart, githubPoll, githubSignOut (fixture: `?github` in the address makes it set up, and the third poll signs in) · src/engine :: the account event, GithubStatus, DeviceCode, GithubPoll · src/i18n/es.json
- kind: decision
- logged: v0.47.0 · 2026-10-24

The panel's markup holds every state at once (checking, not set up, signed out, the code, signed in, an error) and `data-account` on its box picks which line and which buttons show; the extension writes that attribute and the text of the login, the code, the access line and the error, nothing else. The code and access lines keep their height when hidden (`visibility` and a fixed 1.5em with a fixed line-height), and the buttons share one 32 px row, so the note below never moves. A first build let the access line grow from its 1.4em minimum to its text's line height, 2 px, when signed in; pinned. `account.start` owns the polling loop; `accountRun` numbers each attempt so Cancel, sign-out or a new attempt silently ends the old one. Open github.com goes through `web.open`, the system browser. Checked in the preview at 4x CPU and a slow network, in English and Spanish: signed out, code, signed in after the third poll, signed out, cancelled; the panel stays 130 px and the note stays put through every state; no layout shift recorded; no page error; unconfigured shows its own line.

## v0.46.1 · parity close-out, the language rows {#languages-2}

### Run-time text through the string table
- refers-to: src/main.ts :: every setNotice, setSelf and thrown catalogue error · src/extensions/files :: the Versions dialog title, (latest), Go back to this · src/extensions/notices :: Dismiss · src/extensions/settings and launch :: the could-not-save notice · src/i18n/es.json :: 51 new entries · index.html :: data-lang-note
- kind: decision
- logged: v0.46.1 · 2026-10-24

Parity rows #6 and #66 were Partial for two reasons: the Spanish is an unreviewed draft, and notices and run-time text were still English. Every notice, the self-update status and the catalogue error now go through `t()` with a `{name}` template, and `es.json` has a Spanish template for every key the interface asks for (66 keys, 51 added, placeholders checked to match). Plurals that differed in English are two keys (`1 update is waiting`, `{n} updates are waiting`; one font or several). A value that comes from data (an app's name, a file name, a version, a font style) is a placeholder, never translated. What remains English is error text produced by the engine (`e.message` from the core), which the note in Preferences now says in so many words. Rows #6 and #66 stay Partial until a speaker reviews the draft. Checked in the preview at 4x CPU: installing FormCut shows "FormCut 2.6.2 está instalada." with "Cerrar" in Spanish and the English text in English, the self-update check reads its Spanish line, CLS 0, no page error.

### The font is decided before the app is shown
- refers-to: public/prepaint.js :: the readystatechange handler (started, inter, show) · src/styles/main.css :: html[data-font="fallback"]
- kind: fix
- logged: v0.46.1 · 2026-10-24

The Spanish page had one first-load shift of 0.000048 on a slow network, inherited from v0.45.1. Traced over a throttled load: Inter arrived about 6.2 s in and was applied although its face says `font-display: optional`, widening every button; the update strip's buttons are right-anchored, so their left edges moved (7.3 px and 3.5 px in Spanish, 1.1 px in English, which is under the shift threshold and why English read 0). The swap happens because nothing uses Inter while `#app` is held out of layout, so its display period has not started when the file arrives. Now, when parsing ends, prepaint finds the Inter face and asks it to load, waiting at most 100 ms, the same short window `optional` gives; if it is loaded by then the app shows in Inter, otherwise `data-font="fallback"` makes `--font-ui` start at the metric-matched Inter Fallback for the whole of this page's life, so the late file changes nothing. The file is cached for the next start. A face that is missing (the stylesheet not parsed yet) or failed also means fallback. `started` keeps the second readystatechange (complete) from starting a second wait. A first try that called `document.fonts.check` answered true before the stylesheet was parsed, and a second that read `status` without `load()` saw `unloaded` even when cached and always fell back; both were replaced. Checked: 4x CPU and 400 ms, 50 kB/s: CLS 0 on five Spanish and five English loads, the first load in a profile falls back, the next one uses Inter; unthrottled and cached, both pages use Inter; no page error.

## v0.46.0 · parity close-out {#parity-close}

### Open FormPortal when I log in
- refers-to: index.html :: data-pref="open_at_login", the In the background note · src/extensions/settings :: prefBoxes · src/engine/types.ts :: Preferences.open_at_login · src/engine/index.ts :: DEFAULT_PREFS
- kind: decision
- logged: v0.46.0 · 2026-10-24

Parity row #68 (launch settings). The owner chose an off-by-default switch that opens the window only. It is one more `data-pref` checkbox, so the existing settings wiring saves it and patches its checked state; the shell writes or removes the login item (`src-tauri/HASHOUT_LOG.md` v0.46.0). The In the background note now says a login item exists only when this is on. Both strings are in `es.json`. Checked in the preview build at 4x CPU and a slow network: General shows the switch, clicking it saves (checked after the round trip), layout shift 0 in English; the Spanish page's one first-load shift of 0.000048 is inherited from v0.45.1 (same value on the untouched build, five loads), see BUILD_NOTES.

### Other versions shows each release's date
- refers-to: src/extensions/apps :: patch, label (the data-versions picker)
- kind: decision
- logged: v0.46.0 · 2026-10-24

Parity row #19. formcompiler 0.4.2 keeps the newest release of every earlier major line in the catalogue's history, so the picker can hold releases years apart; each option reads `version · date` from the release's `published` field, and the installed one keeps "(installed)", now translated. The options are still replaced only when that joined label list changes, inside a closed menu, so nothing on the page moves. Checked on the fixture: formcut lists 2.6.2 · 2026-10-04, 2.6.1 · 2026-09-28, 2.6.0 · 2026-09-20.

## v0.44.6 · by nodemode.ai in About {#credit}

### The credit under the version heading
- refers-to: index.html :: data-prefs-panel="about"
- kind: decision
- logged: v0.44.6 · 2026-10-24

Owner decision of 2026-10-23 for the form family: where an app has an About, it carries "by nodemode.ai" there. A `p.fine` with `translate="no"` sits right under "FormPortal %fact:version%"; it is static markup in a panel that is hidden until its tab is chosen, so it adds nothing to the first frame. The Spanish table has no entry, so the line stays English in every language. Checked in Chromium at 4x CPU and a slow network: Preferences, About shows it, CLS 0, no page error.

## v0.44.0 · Files follows saves; previews {#saves}

### The open Versions dialog does not move under the person
- refers-to: index.html :: data-versions-new · src/extensions/files :: saved · src/main.ts :: onVersionsKept, file.preview
- kind: decision
- logged: v0.44.0 · 2026-10-12

The first version refreshed an open Versions list when a save arrived and measured a 0.02 shift: the new version goes on top and every row below moves with no input. Now a line reserved in the dialog (kept with `visibility`, so it takes its space from the start) says a new version was kept, and Show it, a click, refreshes the list. Files itself rescans 400 ms after a save so the counts are current; the rows do not move because only text changes. A project's preview goes into its tile as a background image, so nothing changes size. Measured in the browser mode: layout shift 0.

## v0.43.0 · the first-frame shift found and fixed {#stability}

### The cause: a paint of a half-parsed page
- refers-to: public/prepaint.js :: data-parsing · src/styles/main.css :: html[data-parsing] #app
- kind: warning-context
- logged: v0.43.0 · 2026-10-12

The intermittent shifts logged since v0.38.0 were traced by recording each shift's rectangles and timing over 48 loads: the first paint came before the parser had finished the page (the page is large and the CPU throttled), so a family card was painted with only its name and, since `.fam:not(:has(.acts))` matched, without its action column; when the rest arrived it reflowed (a 231 px text box became 131 px). The fix holds the whole app out of layout while the document is parsing: `prepaint.js`, a classic script in the head, sets `data-parsing` and removes it at `readystatechange` past loading; `html[data-parsing] #app { display: none }`. The attribute is set only by the script, so a failed script never hides the page. `visibility: hidden` was not used because four rules set `visibility: visible` on descendants. Measured after: 100 diagnostic loads and a 160-load gate (sixteen screens, ten loads each, 4x CPU) with no shift and no error.

### One toast at a time
- refers-to: src/extensions/notices :: toast
- kind: decision
- logged: v0.43.0 · 2026-10-12

A second toast in the bottom-anchored stack pushed the first one up, a 0.0045 shift whenever two notices came more than half a second after the last input. The stack now holds one toast, replaced by the next; an information notice never covers a failure still showing. Every notice stays in the bell.

### Font updates
- refers-to: index.html :: #font-row data-font-act="update" · src/extensions/fonts · src/main.ts :: font.update, the fonts notice, fonts.load at start-up
- kind: decision
- logged: v0.43.0 · 2026-10-12

Creative Cloud's notices cover app and font updates. The font index is read at start-up; a family with a changed file says Update available with an Update button (which installs only the changed styles), and the bell says so once per session under Updates. Extensions links to the troubleshooting page.

## v0.42.0 · repair, update later, files from a web page {#repair}

### Check and repair in Preferences, About
- refers-to: index.html :: data-repair-* · src/extensions/repair · src/main.ts :: repair.run
- kind: decision
- logged: v0.42.0 · 2026-10-12

Check now lists each finding in plain words with its fix and size; Repair appears only when there is something to repair, then the list shows what was done and the bell says how much was freed. It lives in About, beside FormPortal's own update, because it is about FormPortal rather than one app.

### Update when I close it
- refers-to: row-actions.html :: data-later · src/extensions/apps (data-later, status) · src/engine :: later, setLater · src/main.ts :: app.later, later.check, the five-minute interval
- kind: decision
- logged: v0.42.0 · 2026-10-12

Two More-menu items shown by CSS from `data-install="update"` and `data-later`, so no menu is rebuilt; the status reads "Updates to X when closed". `later.check` runs the automatic pass only when something is put off. Verified in the browser mode with a fast-forwarded clock: the update applied five minutes later and the row became Installed.

### Opening a file from a web page
- refers-to: index.html :: dialog data-webfile · src/main.ts :: link.open (file/), web.ask, web.fetch
- kind: decision
- logged: v0.42.0 · 2026-10-12

A `formai://file/<app>?url=` link never downloads on its own: the dialog names the site, the app, the file and the folder first. Installs are re-read before deciding the app is missing, because a link can arrive before the first load finishes. Spanish strings added for everything new. Layout shift 0 on the screens touched; no script error.

## v0.41.0 · languages and opening where you left off {#language}

### English text as the key, a page per language
- refers-to: src/i18n/translate.ts :: lookup, fill, translateHtml · src/i18n/index.ts :: t, LANGUAGES, pageFor · src/i18n/es.json · vite.config.ts :: languagePlugin
- kind: decision
- logged: v0.41.0 · 2026-10-12

A key per string would have meant rewriting every line of `index.html` and `renderPortal`; keying by the English text (as gettext does) left them as they are. `translateHtml` runs on the finished page in `generateBundle`, skipping scripts, styles and inline SVG, and swaps text nodes and four attributes when the trimmed text has an entry; patterns with `{name}` cover the per-app sentences. The same table serves `t()` at run time, chosen by `<html lang>`. Switching language saves the preference and loads the other page: a page in one language never rewrites itself into another, which is what keeps zero flash. Run-time strings converted this version: app statuses (stable, beta, nightly), the extension Install or Update button, and every Learn label and suggestion. Still English: notices, the engine's error messages, tutorial content (data), Files, Fonts, Stock, agents and assistant run-time text. The Spanish is a draft and says so in Preferences. Measured at 4x CPU: layout shift 0 on the Spanish Home, and on switching both ways.

### Opening where you left off
- refers-to: public/prepaint.js · src/styles/main.css :: html[data-launch] · src/extensions/route :: route.launch, formportal-last · src/extensions/launch · src/main.ts :: route.launch before catalog.load
- kind: decision
- logged: v0.41.0 · 2026-10-12

The router runs in a module script, which can come after the first frame, so the decision is made in `prepaint.js` (a classic script in the head): with `formportal-open` set to `last` and `formportal-last` one of the eight top-level screens, it sets `data-launch`, and eight stylesheet rules show that pane, light its sidebar entry and hide the title until the router writes it. `route.launch` is dispatched after every command is registered (a route event earlier would reach commands that do not exist yet) and then removes the attribute. A `?link=` (a `formai://` link) wins. Measured: when parsing ends, before any module runs, only the remembered pane is shown and only its entry is lit; layout shift 0.

## v0.40.0 · Learn, suggestions, notice categories, Ask your agent {#learn}

### Tutorials on Learn
- refers-to: index.html :: data-pane learn, data-tutorials · src/extensions/learn · src/main.ts :: learn.load, learn.mark
- kind: decision
- logged: v0.40.0 · 2026-10-12

Creative Cloud's Learn has tutorials with progress; here each tutorial is a row (app, title, summary, steps, minutes, level, a fixed-width progress bar and "2 of 4") that opens to its steps, each with a box, Go there when the step names a screen, and Read more for a link. In progress and Finished filter. The pane's blocks stay hidden until the first view (`data-ready`); learn.load runs at start-up so Home's suggestions have it. Finishing a tutorial and starting again are notices under Learning.

### Suggested for you on Home
- refers-to: index.html :: data-suggest · src/extensions/learn :: suggestions
- kind: decision
- logged: v0.40.0 · 2026-10-12

Creative Cloud suggests by plan; FormPortal has no plan, so it suggests from this computer: the next step of a started tutorial, else a tutorial for an installed app, else FormPortal's own (Install your first Form app only when nothing is installed); choosing a projects folder when there are none; an installable app in the same registry group as one installed. At most three. The block is the last on Home and starts hidden, so it never moves anything above it; it is rebuilt only when its text changes. The app suggestion did not show in the browser mode, whose catalogue releases only FormCut.

### Notice categories
- refers-to: src/engine :: setNotice(text, tone, category), NoticeCategory · src/extensions/notices · src/main.ts :: guard(work, category) · index.html :: bell-cats, data-quiet
- kind: decision
- logged: v0.40.0 · 2026-10-12

Creative Cloud's notifications have categories (app updates, services, files, community, announcements). Every setNotice now names one of six; `guard` takes the category for its failures. The bell has chips to show one kind; Preferences, General has a switch per kind for pop-ups, saved as `quiet`; failures always pop up.

### Ask your agent
- refers-to: index.html :: data-ask-open, dialog data-ask · src/extensions/assistant · src/main.ts :: assistant.agents, assistant.ask
- kind: decision
- logged: v0.40.0 · 2026-10-12

A top-bar button opens a dialog: the agents found on this computer, a question box (Ctrl or Cmd and Enter sends), the answer below. When neither agent is installed the box is disabled and says so. The browser mode answers with a sentence that says no agent ran (`?assistant=none`, `?assistant=fail` exercise the other states).

### Dialog heights
- refers-to: src/styles/main.css :: .prefs.versions, .versions-frame .prefs-title
- kind: warning-context
- logged: v0.40.0 · 2026-10-12

The small dialogs (versions, font rights, ask) carry `.prefs` for its frame, and `.prefs` sets a 580 px height later in the file, so they filled that height since v0.37.0. `.prefs.versions` now wins on specificity with `block-size: fit-content`; `auto` is not enough for a modal dialog, which then stretches to its inset.

## v0.39.0 · the Stock & templates screen {#media}

### Browse, save with credit, use a template, the Library
- refers-to: index.html :: data-pane stock, #media-card · src/extensions/stock · src/main.ts :: media.load, media.thumb, media.save, media.remove
- kind: decision
- logged: v0.39.0 · 2026-10-12

A sidebar entry under Fonts, where Creative Cloud puts Stock. Cards in a grid with a thumbnail when the index has one (fetched by the shell as a data URL, since the CSP blocks remote images), title, creator and licence, and the credit line as the card's tooltip. Kinds (all, images, video, audio, templates) and search filter without rebuilding. Images, video and audio have Save; templates have Use template, which saves, copies into the projects folder and opens the app, or says the app is not installed. Saved items list below with their licence, credit line and Remove. Every outcome goes to the bell. Blocks stay hidden until the first view (`data-ready`). Measured at 4x CPU: 0 shift on Stock. The browser mode has seven sample items, with the real project extensions (.fc, .fmw) on its templates.

## v0.38.0 · the Fonts screen {#fonts}

### Library, styles, your own fonts
- refers-to: index.html :: data-pane fonts, #font-row, the rights dialog · src/extensions/fonts · src/main.ts :: fonts.load, font.install, font.remove, font.pick, font.add
- kind: decision
- logged: v0.38.0 · 2026-10-12

A sidebar entry under Files, where Creative Cloud keeps fonts as a panel. Families as rows (Install family while any style is missing, Remove while any is installed, the More menu lists each style with Install or Remove), search and kinds (sans serif, serif, mono, display), and Your own fonts with Add a font file. Adding one opens a small dialog whose Add stays disabled until the person ticks "I have the right to use this font on this computer". No previews of the typefaces yet: the window would have to fetch each font file or read it from disk through an asset protocol, which is a separate decision. Blocks stay hidden until the first load (`data-ready`). Measured at 4x CPU: 0 shift on Fonts. The browser mode has six real OFL families as sample data.

### Known, again
- refers-to: the first frame
- kind: warning-context
- logged: v0.38.0 · 2026-10-12

The intermittent first-frame shifts logged in 0.35.0 showed again in two of eight loads (the bell icon 40 px, a family card), under 0.0001 each, before any script. Still not reproduced on demand.

## v0.37.0 · the Files screen {#files}

### Files, where Creative Cloud has its Files tab
- refers-to: index.html :: data-pane files, #file-row, #folder-row, the versions dialog · src/extensions/files · src/main.ts :: files.scan, folder.add, folder.remove, file.open, file.versions
- kind: decision
- logged: v0.37.0 · 2026-10-12

A sidebar entry between Apps and Extensions. With no folder: a start card (suggested folder, or the picker). Then recent projects as rows (the owning app's tile and colour, where it lives, date, size, versions, Open and Versions), folders (Stop listing), and Storage. Rows are keyed by path and reordered in place. The versions dialog lists newest first with Go back to this on every earlier one, and Keep a version now. Every block stays `display: none` until the first scan arrives (`data-ready`), so the screen appears whole instead of growing; a scan also runs once after start-up so the data is ready before the person opens Files. Opening a project whose app is not installed says which app to install, by name. The browser mode takes `?files` for a sample folder. Measured at 4x CPU: 0 shift on Files empty and filled, and on Home.

## v0.36.0 · AI tools on the app page, and the window offline {#bridge}

### Use it with your AI tools
- refers-to: vite.config.ts :: agents · src/extensions/agents · src/main.ts :: agents.check, agents.connect, app.install
- kind: decision
- logged: v0.36.0 · 2026-10-12

Each released app's page ends with a section, hidden until the shell says the installed app ships an MCP server: Claude Code, Codex and Cursor with their state (connected, not connected, another server of that name left alone, not installed here), Connect and Disconnect. It is the last thing on the page, so appearing moves nothing. It is checked when the page opens and when that app's install changes. An install of such an app adds a line to its notice pointing there. The browser mode takes `?agents=formcut`.

### Opened in the real window
- refers-to: the debug shell under Xvfb, interface on 3250
- kind: warning-context
- logged: v0.36.0 · 2026-10-12

The rebuilt interface rendered in WebKitGTK as in Chromium. With no network it showed the raw DNS error and still said every app was up to date, and installed apps had no Open because actions wait for `data-loaded`. Now installs and preferences load before the catalogue, `data-loaded` is set either way, Home says the catalogue could not be reached with Try again (in the same slot as Update all, so nothing moves), and the notice explains before the raw cause. `catalog.load` and the link hook now run last in `main.ts`, after every command exists: a link handled at start had dispatched `agents.check` before it was registered. The browser mode takes `?offline`.

## v0.35.0 · the interface rebuilt {#rebuild}

### Why, and from what
- refers-to: index.html · vite.config.ts · src/styles/main.css · the sidecar's RESEARCH_CC_UI.md
- kind: decision
- logged: v0.35.0 · 2026-10-12

The owner called the interface awful. Research on Creative Cloud's desktop app (Adobe's help and release notes, cross-checked with university IT guides and named trade reviews) and on Apple, Microsoft and Adobe design-system guidance gave the shape: a left sidebar of at most two levels; bell and Preferences in the upper right; Preferences as a dialog with tabs down its left, a master auto-update switch and one per app; apps as a list with Install, Open or Update and a More menu; a consistent determinate progress place; no marketing on Home. The old window failed most of these: a poster Home (hero, "FORM APPS", ruler, lineup), 19 apps in sidebar accordions with Updates hidden in a collapsed group, Settings as a page, no top bar, notices as inline text, each app in four shapes with five buttons. `index.html`, `vite.config.ts`, `row-actions.html` and `main.css` were rewritten whole; `lineup.css`, `workspace.css` and the stage and accordion extensions were deleted, and the 0.28.0 to 0.33.0 entries about them below are history.

### Structure
- refers-to: vite.config.ts :: renderPortal · row-actions.html · card-actions.html
- kind: explainer
- logged: v0.35.0 · 2026-10-12

Build time writes: Apps list rows grouped by registry group; Updates rows (stable and beta per app, shown when installed, waiting ones first); Beta rows with the feedback link; Your apps cards (stable and beta, shown when installed, in a strip of fixed height with an empty state); family cards with one action; What's new cards; app pages with facts, screenshot or plate, a beta row and help links; a switch per released app for Preferences; Learn entries. Rows keep the data contract (`data-row`, `data-product`, `data-field`, `data-act`), so the apps extension drives them all. Rows never nest: an earlier draft put the beta row inside the stable `.ap` block, and its Install would have fired both channels.

### Notices, search, Preferences
- refers-to: src/extensions/notices · src/extensions/search · src/extensions/prefs · src/main.ts :: link.open, app.install
- kind: decision
- logged: v0.35.0 · 2026-10-12

Notices: each becomes a bell entry with its time (30 kept) and a toast in the lower right (info leaves after 6 s, a failure stays until dismissed); the bell's dot shows until the list is opened. Successful manual installs now say so. Search filters the Apps rows by name, summary, what it replaces and kind, switching to Apps when typing elsewhere; `/` or Ctrl or Cmd F focuses it; Escape clears. Preferences is a `<dialog>` opened from the top bar, and `formai://settings` opens it on a tab.

### Zero shift
- refers-to: src/styles/main.css :: data-loaded, .fam, .mine, .strip · src/main.ts :: catalog.load
- kind: decision
- logged: v0.35.0 · 2026-10-12

First measurements of the rebuild showed 0.02 on Home: family cards whose action column changed width, a status line of no height that filled in, and Update all appearing beside Updates. Fixed with a fixed action column, reserved status lines, `visibility` for Update all, versions hidden on cards, and actions kept hidden until `data-loaded` (set after catalogue, installs and preferences), so buttons appear once instead of passing through Open on the way to Update. Measured at 4x CPU: 0 on Home (with apps, empty, light, 1180 px), Apps, an app page, Updates and Extensions. Over eleven further loads, two showed a single shift under 0.0002 in the first 300 ms (the bell icon once, a family card once), before any script ran; not reproduced on demand, cause not found, logged here to watch.

## v0.34.0 · a managed computer {#managed}

### Settings, Managed, and locked controls
- refers-to: index.html :: .setting[data-managed] · src/extensions/settings/index.ts :: the policy handler · src/styles/main.css :: .check:has(input:disabled), .field:disabled
- kind: decision
- logged: v0.34.0 · 2026-10-12

The Managed row is the last row of Settings and stays `hidden` until a policy is read, so appearing after load moves nothing above it. It names who manages the computer and the file, then what is fixed, which apps and builds are allowed, and the extension rules. Locked checkboxes and the catalogue field are `disabled` (dimmed, a title says why) rather than relabelled, so no text reflows; the catalogue field shows the policy's address. The root gets `data-policy` and, when extensions are off, `data-no-extensions`. An earlier draft put `data-managed` on the root as well, and a test selector matched the root instead of the row: the root attribute was renamed.

### Apps the policy does not allow
- refers-to: src/engine/index.ts :: setPolicy, blocked · src/extensions/apps/index.ts :: patch · src/styles/main.css :: [data-blocked]
- kind: decision
- logged: v0.34.0 · 2026-10-12

`engine.blocked` mirrors the core's rule (apps list, channels list). A blocked row gets `data-blocked`, its status reads "Not allowed by your organisation", and Install, Update and the versions Install are hidden with `visibility`, keeping their space. Open, rollback and remove stay: a policy limits what is installed, not what the person may do with what they have. The core refuses regardless; this only stops offering what would be refused. The browser mode takes `?policy=locked`. Measured at 4x CPU: Home and Settings at 0 shift managed and unmanaged, no script error.

## v0.33.0 · help, What's new, names, notices {#help}

### Help and feedback links, written at build time
- refers-to: vite.config.ts :: repo, web, help, feedback · index.html :: Settings, Help · src/extensions/apps/index.ts :: the a[data-web] click
- kind: decision
- logged: v0.33.0 · 2026-10-12

Every app page carries Guide and docs, Every release and Report a problem, and every beta tile Send feedback on the beta, all from the registry's `repository` (only `https://github.com/nodemode-ai/...` is linked). Settings has a Help row: the guide, the changelog, issues and FormHub. Links carry `data-web`; one document-level click handler sends them through `web.open`, which the shell opens in the person's browser (`open_web`, allowlisted) and the browser mode in a new tab. The beta feedback link is kept in layout and hidden with `visibility` until that beta is installed, so installing it moves nothing.

### What's new on Home
- refers-to: index.html :: .wn-wrap · vite.config.ts :: whatsnew · src/styles/workspace.css :: .wn
- kind: decision
- logged: v0.33.0 · 2026-10-12

One card per released app, written at build time with `data-row="stable"`, so the existing row patch fills version, status and release notes. Cards show only for installed apps (`data-install` ready or update) and the section only when one shows (`:has`). It sits after the notice at the end of Home, so appearing after load moves nothing above it. No account: it is this computer's installs against the catalogue.

### Names from the registry, and the notice's tone
- refers-to: src/main.ts :: setNames · src/engine/index.ts :: name, setNotice · src/styles/main.css :: .pane-notice[data-tone]
- kind: decision
- logged: v0.33.0 · 2026-10-12

Notices and extension rows used the catalogue's names or ids (the sample catalogue spells apps in lowercase). The engine now takes the registry's names at start and `engine.name(id)` prefers them. `setNotice` takes a tone: failures stay in the fault colour; updates done, installs done and the open-copy note are info, in `--ink-soft`.

### The open-copy note in the window
- refers-to: src/main.ts :: app.install · src/bridge :: stillOpen
- kind: decision
- logged: v0.33.0 · 2026-10-12

After an install the window asks the shell which processes still run from an older version's folder and says so, as the command line and MCP already did. The browser mode takes `?open=formcut` to pretend one is open.

### The sidebar marks the current group instead of opening it
- refers-to: src/extensions/accordion/index.ts :: route handler · src/styles/workspace.css :: .rail-group[data-current]
- kind: decision
- logged: v0.33.0 · 2026-10-12

Opening the target's group on every route change moved the groups below it with no input when a `formai://` link arrived (0.0117). The accordion now only marks the group holding the current page (`data-current`, drawn with colour and an inset box-shadow, no size change) and leaves open and closed to the person. Measured: 0 for `?link=app/formdam`.

### Two older items, measured and left
- refers-to: src/styles/main.css :: @font-face Inter · styles/lineup.css :: .lu-big, the ruler label
- kind: warning-context
- logged: v0.33.0 · 2026-10-12

The 0.00098 shift on "FORM APPS" on a slow network: the platform-font trace shows Liberation Sans first, then the system's own Inter SemiBold (`isCustomFont: false`) once the web face settles. This container has Inter installed system-wide, and the family name "Inter" collides with it. On a computer without Inter it does not occur under `font-display: optional`. The fix is a family name of the web face that no system font has, which means changing `--font-ui` in formai_dev's tokens first. The LINEUP ruler overlap at 1180 px did not reproduce in Chromium (no icon intersects the label); it was seen in WebKitGTK and needs the window to fix.

## v0.32.0 · checking for a newer FormPortal {#self-update}

### Settings, Version
- refers-to: index.html :: data-self-check, data-self-install, data-self-status · src/extensions/settings/index.ts · src/main.ts :: self.check, self.install
- kind: decision
- logged: v0.32.0 · 2026-10-11

Check for a newer FormPortal, then Install and restart when one is offered; one status line says not configured, up to date, available, or the failure. The row reserves the control height (`.self-update` min-block-size), so the status text and the second button appear without moving anything. `.seg-item` sets `display`, which beat the `hidden` attribute and showed Install and restart on every check; `.self-update .seg-item[hidden]` fixes it. The browser mode takes `?self=0.40.0` to offer a version, `?self=` for up to date, nothing for not configured. Verified at 4x CPU: the three cases gave the right line and button, layout shift 0, no script error.

### Seen in the real window, older than this version
- refers-to: styles/lineup.css :: the ruler label
- kind: warning-context
- logged: v0.32.0 · 2026-10-11

At the window's default 1180 px width, the vertical LINEUP label of the ruler sits over the icon row between FormCut and FormWav. Logged for the interface phase.

## v0.31.0 · extensions {#extensions}

### Rows from the index and from what is installed
- refers-to: src/extensions/library/index.ts :: fill, wire, extensions handler · index.html :: ext-row template
- kind: decision
- logged: v0.31.0 · 2026-10-11

The Extensions screen keys its rows by product and id over the union of the index and the installed list, so a sideloaded package has a row too. `data-ext-state` (none, installed, update, busy), `data-listed` and `data-trust` drive which of Install or Update, Remove and On show, all in CSS; `fill` writes attributes, text and `checked` only when they differ. Rows are still cloned from the template at run time (as since 0.7.0), appended at the end of the list.

### The notes and the notice sit above the list
- refers-to: index.html :: data-pane extensions
- kind: decision
- logged: v0.31.0 · 2026-10-11

With the notes below the list, a row appended after load (a sideload finishing) pushed them down: a 0.0115 shift. They now sit above the list, the notice in the 3em space `.pane-notice` reserves, so a row appended at the end moves nothing. The notice is shared with Home (every `[data-notice]` gets the text). Notices are drawn in the fault colour even for good news; that predates this and goes to the interface phase.

### Opening a .formpkg
- refers-to: src/main.ts :: ext.install, bridge.onPackage · src/bridge/tauri.ts :: onPackage
- kind: decision
- logged: v0.31.0 · 2026-10-11

A package opened with FormPortal goes to the Extensions screen and installs at once, with the sideload label when the index does not list it. Opening the file is the person's intent; the label, the native-code rule and Remove are the safeguards. The browser mode takes `?package=/path/name.formpkg`.

### Verified
- refers-to: the entries above
- kind: explainer
- logged: v0.31.0 · 2026-10-11

Built, 4x CPU, headless Chromium: `?package=...teal-look.formpkg` routed to Extensions, installed it as sideloaded with the notice; Install on Warm dust went busy then installed, with Remove and On; unticking On kept it installed and off; Remove took the sideloaded row away; no script error. Shift: only the known 0.0147 accordion one when a route opens the Library group. The screen was looked at; a first look showed On on a package that was not installed (`.check` declared later in the file won), fixed by raising the rule's specificity.

## v0.30.0 · other versions {#versions}

### Other versions in More
- refers-to: row-actions.html :: data-versions, data-version-go · src/extensions/apps/index.ts :: patch · src/main.ts :: app.install
- kind: decision
- logged: v0.30.0 · 2026-10-11

A select and an Install button at the foot of every row's More menu, shown only when the channel has more than one version with a file for this system (`data-history`). The options are the only nodes the interface creates at run time: they live inside a closed menu, are replaced only when the list or the installed version changes (`data-list` keys it), and keep the person's selection. `app.install` passes the version through the bridge; after it, the interface rereads the preferences and, when the core held automatic updates, says so. The button is a `drop-item`: `.act` buttons are shown by row state, which hid it in the first try.

### keep_previous in Settings
- refers-to: index.html :: data-pref keep_previous · src/extensions/settings/index.ts
- kind: explainer
- logged: v0.30.0 · 2026-10-11

"Keep the version before, to go back to", on by default.

### Verified
- refers-to: the entries above
- kind: explainer
- logged: v0.30.0 · 2026-10-11

Built, 4x CPU, headless Chromium, `?installed=formcut:2.6.2&link=app/formcut`: More listed 2.6.2 (installed), 2.6.1, 2.6.0; choosing 2.6.0 installed it, kept 2.6.2 for rollback, offered 2.6.2 as an update, marked 2.6.0 installed, unticked Update automatically and showed the notice; no node removed other than the replaced options, no script error. The 0.0117 shift at load is the known link and accordion one.

## v0.29.0 · updates {#updates}

### Automatic updates when the catalogue loads
- refers-to: src/main.ts :: catalog.load, prefs.set · src/bridge/*.ts :: preferences, setPreferences, autoUpdate
- kind: decision
- logged: v0.29.0 · 2026-10-11

After the catalogue loads, the window reads the preferences from the core and asks it to apply the automatic updates (`auto_update` in the shell, which emits the same `install-progress` events as Install, so rows show their progress). Then one notice: what was updated, what failed, how many updates still wait, and whether a newer FormPortal is in the catalogue (product `formai`, compared with this build's package.json version). The notice is skipped when `notices` is off, except for failures. The fixture bridge does the same in memory; `?auto=off` starts it with automatic updates off, `?installed=formcut:2.6.1` seeds an install.

### Only newer versions
- refers-to: src/engine/index.ts :: versionNewer · src/extensions/apps/index.ts :: patch · src/main.ts :: app.updateAll
- kind: decision
- logged: v0.29.0 · 2026-10-11

A row says "Update to" only when the offered version is newer, by the same rule as the core's `version_newer`. Before, any different version counted, so an older catalogue would have offered a downgrade as an update.

### Preferences in the interface
- refers-to: index.html :: data-pref · row-actions.html :: data-auto, data-field notes · src/extensions/settings, src/extensions/apps
- kind: decision
- logged: v0.29.0 · 2026-10-11

Four checkboxes under Settings, Updates, and "Update automatically" in every row's More menu (a per-app override saved in `per_app`), all in the build-time markup; the extensions write `checked` only when it differs. Release notes are a "What's new" line in Details, hidden when empty by the existing `div:has(dd:empty)` rule. Engine.automatic mirrors the core's rule so the More checkbox shows what the core will do.

### Verified, and one shift
- refers-to: the entries above
- kind: warning-context
- logged: v0.29.0 · 2026-10-11

Headless Chromium, 4x CPU, the built interface: `?installed=formcut:2.6.1` updated FormCut to 2.6.2 on load with the notice, layout shift 0, no node removed; with `?auto=off` the row said "Update to 2.6.2", the notice "1 update is waiting", the count 1; ticking Update automatically in More set the per-app override for every FormCut stable row; Beta builds too in Settings ticked every beta row's box; Details showed What's new. No overflow, no script error. One shift of 0.0117 at load, sourced to the sidebar's groups: a `formai://app/` link to an app outside the open group makes the accordion open that group (0.24.0's rule) with no input event in the window, so the layout-shift record counts it. It is the same movement a click on the sidebar causes; it is logged for the interface phase (DEV_PLAN Phase 6), and the 0.28.0 link check's 0.00028 was a smaller case of it.

## v0.28.0 · links and theme {#links-theme}

### formai://app/[id] opens the app's page
- refers-to: src/main.ts :: link.open
- kind: decision
- logged: v0.28.0 · 2026-10-11

The link first asks for the route `app-[id]` (the per-app page written at build time since 0.23.0); the route extension ignores routes that have no pane, so for an id without a page the link falls back to the apps screen with that app shown, as before. Nothing is built at run time; the pane already exists.

### Theme: System, Dark, Light
- refers-to: public/prepaint.js · src/extensions/theme/index.ts · index.html :: data-theme-set
- kind: decision
- logged: v0.28.0 · 2026-10-11

The stored key holds `light` or `dark` only; no key means System, which is the default. prepaint.js decides before the first paint (stored choice, else `prefers-color-scheme`), so the first frame is final. The extension follows the system's changes only while in System, and writes `data-theme` and `aria-pressed` only when they differ. Storage that throws falls back to System. The Settings segment's markup starts with System pressed; Settings is never the first screen, so the extension's correction for a stored choice is not seen.

### Verified
- refers-to: the two entries above
- kind: explainer
- logged: v0.28.0 · 2026-10-11

Built and served by `vite preview`, headless Chromium at 4x CPU and a 150 ms, 200 KB/s network: with no stored choice a light system starts light and a dark one dark, a stored dark on a light system starts dark and the reverse, with no `data-theme` change after the document loaded and no node removed; `?link=app/formvis` opened FormVis's page with FormVis in the top bar; in Settings, Light, System, a system switch to light while in System, then Dark each set the attribute, the pressed button and the stored key as expected, no overflow. Known and older than this change: one layout shift of 0.00098 on the lineup's "FORM APPS" label on a slow network, measured identically on the 0.28.0 build before these edits; it is listed in DEV_PLAN for the interface phase.

## v0.27.0 · the move {#move}

### Paths to design and catalog
- refers-to: vite.config.ts :: DESIGN, CATALOG · tsconfig.json :: include · src/styles/main.css :: @import · src/bridge/fixture.ts :: imports
- kind: decision
- logged: v0.27.0 · 2026-10-11

`frontend/` sits at the repository root now, so `design/` and `catalog/` are one level up (`../design`, `../catalog`; `../../../` from `src/`). Both folders are copies of formai_dev 0.26.0. The catalogue contract is still formai_dev's to change; a change there is copied here, never edited here first.

### Names in the browser
- refers-to: src/bridge/tauri.ts :: CATALOG_KEY, UNSIGNED_KEY · src/extensions/theme/index.ts :: KEY · public/prepaint.js · src/extensions/settings/index.ts :: where
- kind: decision
- logged: v0.27.0 · 2026-10-11

Stored keys are `formportal-theme`, `formportal-catalog-url`, `formportal-allow-unsigned` (were `formai-*`); prepaint.js and the theme extension must name the same key or the theme flashes on first paint. Settings shows the install folders `core` now uses. The default catalogue address stays formai.dev's.

---

## Org-navi-map

```
hub/frontend/
├── index.html                    the whole shell as markup: rail, five panes, overlay roots
├── public/
│   ├── prepaint.js               applies the stored theme before the stylesheet
│   ├── favicon.svg               for the browser tab in development
│   └── fonts/                    Inter variable and its licence
├── src/
│   ├── main.ts                   entry: engine, bridge, extensions, first load
│   ├── engine/
│   │   ├── index.ts              state, event bus, commands, the channel view
│   │   └── types.ts              the catalogue's shapes, mirroring catalog/schema
│   ├── bridge/
│   │   ├── index.ts              the Bridge interface and which one is in use
│   │   └── fixture.ts            answers from catalog/fixtures, platform from the browser
│   ├── extensions/
│   │   ├── registry.ts           register and activate
│   │   ├── route/index.ts        which pane shows
│   │   ├── theme/index.ts        dark and light
│   │   ├── apps/index.ts         status and version on the Apps and Beta rows
│   │   ├── library/index.ts      the extension list, keyed
│   │   └── settings/index.ts     catalogue source and this computer
│   └── styles/main.css           every rule, tokens only
├── vite.config.ts                port 3250, markers, the version fact
├── tsconfig.json
├── package.json
├── oc_install(.bat)              npm install
└── boot_frontend(.bat)           npm run dev
```

---

## Table of contents

- [index.html](#index)
- [public/prepaint.js](#prepaint)
- [src/main.ts](#main)
- [src/engine/index.ts](#engine)
- [src/engine/types.ts](#types)
- [src/bridge/index.ts](#bridge)
- [src/bridge/fixture.ts](#fixture)
- [src/extensions/route/index.ts](#route)
- [src/extensions/apps/index.ts](#apps)
- [src/extensions/library/index.ts](#library)
- [src/extensions/settings/index.ts](#settings)
- [src/styles/main.css](#css)
- [vite.config.ts](#vite)

---

## index.html {#index}

### index.html · the shell is markup, not script
- refers-to: index.html :: `#app`
- kind: rationale
- logged: v0.1.0 · 2026-10-04

The rail, all five panes and the three product rows in Apps and in Beta are written in the page. Script never builds them: it writes an attribute or a text node. That is how the first frame is already the final layout. The family has three products, so their rows are known at build time; a fourth product means adding its row here by hand.

### index.html · rows and fields
- refers-to: index.html :: `li.row[data-row]`, `[data-field]`
- kind: explainer
- logged: v0.1.0 · 2026-10-04

A row carries `data-product` (which also gives it its hue) and `data-row` (the channel: `stable` or `beta`). Inside, `data-field="status"` and `data-field="version"` are the two text nodes the apps extension writes. Both cells have a reserved height and the version cell a reserved width, so text arriving moves nothing.

### index.html · no buttons on the rows yet
- refers-to: index.html :: `[data-pane='apps']`, the `.pane-note`
- kind: todo
- logged: v0.1.0 · 2026-10-04

Install, Open and Update are Phase 5. A button that does nothing is worse than none, so the rows show what the catalogue says and a note under them says what is coming. Remove the note when the actions land.

### index.html · the extension row template
- refers-to: index.html :: `template#ext-row`
- kind: explainer
- logged: v0.1.0 · 2026-10-04

Extensions are not known at build time, so their rows are cloned from this template, once each, keyed by id. The mark holds all four product icons and CSS shows the one matching the row's `data-product`, so the clone needs no icon logic.

### index.html · overlay roots
- refers-to: index.html :: `#overlay-root`, `#toast-root`
- kind: explainer
- logged: v0.1.0 · 2026-10-04

Direct children of `body`, after the app. Dialogs, menus and toasts render into these and take `--z-overlay`, `--z-dropdown` or `--z-toast`. Empty for now.

---

## v0.20.0 · FormPortal, built from the registry {#portal20}

### index.html, vite.config.ts · every app, not three
- refers-to: index.html :: `<!-- @portal:cards -->`, `@portal:shelf`, `@portal:beta`, `@portal:updates`; vite.config.ts :: APPS, renderPortal; src/extensions/stage/index.ts; src/styles/main.css :: `.card[data-on]`, `.shelf`, `.app-plate`
- kind: rationale
- logged: v0.20.0 · 2026-10-06

The window was written for three apps by hand: three stage panels, three shelf items, three Beta tiles, six update rows, and a CSS rule per app choosing the panel. The family is twenty. The four blocks are now markers that the build fills from `catalog/products.json` (every app but the portal itself): a stage panel and a shelf item per app, a Beta tile per available app, and a stable and a beta update row per app, each carrying `data-row` and `data-product` so the apps extension writes them unchanged. The chosen panel is the one with `data-on`, set by the `app.show` command, so the stage works for any number. The shelf is a strip that scrolls sideways and brings the chosen app into view. An app w/o a screenshot shows the same plate as the website; on the stage the plate carries no word, since the app's name is set over it (the first build showed the plate's word colliding w/ the name).

Limit, stated: the panels are written at build time, so an app added to the registry appears in the window w/ the next FormPortal release, not before. The catalogue still decides at run time what each one offers.

The window, rail and page are titled FormPortal; `tauri.conf.json` names the product FormPortal, so bundles and the macOS app take that name. The folder is still `hub/` and the scripts `formai_hub`; renaming them is separate.

Checked in a browser under 4x CPU: 19 panels, 19 shelf items, 11 Beta tiles, 38 update rows; choosing FormEncoder put it on the stage; every earlier flow (stage at three sizes, Beta, Details, More, Updates, Update all, Extensions, Settings) still gives layout shift 0, no node removed, no overflow, no console error. Looked at: the stage w/ FormEncoder and the Beta screen. Not run: the real window w/ twenty apps.

## v0.17.0 · links {#links}

### src/main.ts, src/bridge · a link opens a screen or an editor
- refers-to: src/main.ts :: the `link.open` command, `bridge.onLink`; src/bridge/index.ts :: onLink; src/bridge/tauri.ts :: onLink; src/bridge/fixture.ts :: onLink
- kind: explainer
- logged: v0.17.0 · 2026-10-06

The bridge gained `onLink`. In the shell it listens for the `deep-link` event and asks once for a link the app was started with. In a browser it reads `?link=` from the address, so the same path can be exercised without the shell. Either way the interface receives the text after `formai://` and dispatches `link.open`: `app/<id>` goes to Apps and puts that editor on the stage; anything else is offered to `route.go`. Both of those commands already ignore what they do not know, so a link can only ever choose among the hub's own screens and editors. Checked in a browser: `app/formwav` showed formwav on the stage, `updates` the Updates screen; `app/nothing`, `settings/extra` and a `javascript:` address changed nothing beyond a valid screen name.

## v0.16.0 · Tab order, and the new controls in the real window {#v016}

### row-actions.html · the source order is the order on screen
- refers-to: row-actions.html :: the whole partial
- kind: warning-context
- logged: v0.16.0 · 2026-10-06

In v0.15.0 the partial listed Details and More before Open, Update and Install, and CSS reordered them for the eye. The keyboard follows the source, so Tab reached the drop-downs before the main button. The partial now lists them as they are seen: Open, Update, Install, More, Details. Checked in a browser from an editor with an update waiting: Tab after the rail goes Open, Update, More, Details, then the shelf. The `order` rules and the spacer in the stylesheet still do the pinning; they no longer reorder anything.

### the real window · the new controls
- refers-to: the Linux app built from this version's interface; src/bridge/tauri.ts
- kind: explainer
- logged: v0.16.0 · 2026-10-06

The Linux app was rebuilt and driven by keyboard and mouse under a virtual display, as in v0.12.0, against a local test catalogue. Seen in captures of the real window: the stage before install with Install and Details; after Install, Installed with Open, More and Details; More opened from the keyboard showing Remove from this computer; Details opened from the keyboard showing the release date, file, needs, licence and SHA-256; the Updates screen listing formcut as installed at 2.6.2 with Open, More and Details and no Update all, nothing being newer; the Beta tiles; and Extensions with its filter and its empty state, the shell having no extension list yet. The installed file ran when Open was pressed.

Found there and fixed: Details showed a Project files row with nothing in it, because that test catalogue gives none. A fact row whose value is empty is now hidden (`.drop-facts > div:has(dd:empty)`). The real app was not rebuilt after that one-line fix.

Not seen in the real window: an update arriving, Update all, going back a version, removing, the rail's count, the extension tiles (the shell lists none), Settings' new rows.

## v0.15.0 · more on each tile, drop-downs, and the remaining panes {#rest}

### row-actions.html · Details and More
- refers-to: row-actions.html; src/extensions/apps/index.ts :: the `field` writes in patch, the `open` helpers; src/styles/main.css :: `.drop` to `.drop-item`
- kind: explainer
- logged: v0.15.0 · 2026-10-06

The owner asked for more relevant information on the tiles and for drop-downs. The actions partial, which every stage panel, Beta tile and update row includes, now carries two. **Details** holds what a careful person wants before installing: the release date, the file's name, what it needs, the editor's project file types, its licence and the SHA-256 the download is checked against, each a field the apps extension writes from the catalogue. **More** holds the actions that are not the main one: go back to the version before (shown only when one is kept) and remove. So the row of buttons is the main action, then the two drop-downs.

They are native `details` elements, so they open and close with no script and work from the keyboard. Script adds only what `details` lacks: a click anywhere else, choosing an item, or Escape closes whatever is open, which also keeps one open at a time. A panel is positioned over the content rather than pushing it, on the dropdown layer.

A row gets `data-release` when the catalogue has a file for this computer; Details shows only then. More shows when the editor is installed.

### src/styles/main.css · the actions keep their places
- refers-to: src/styles/main.css :: `.row-actions::before`, the `order` rules, the busy `[data-act="install"]` rule, `.up` grid
- kind: warning-context
- logged: v0.15.0 · 2026-10-06

With drop-downs beside the main button, changing state moved them: Install to Open changed the button's width, and More appearing pushed Details along. Measured: up to 0.0015 of layout shift on the stage. Three things fixed it. The main buttons sit at the start and a flexible spacer pushes the drop-downs to the far end, More before Details, so More arrives beside Details without moving it. While installing, the Install button stays in place, dimmed, instead of vanishing. An update row's actions have a column of fixed width. After: 0 on every flow.

### index.html · Updates is real
- refers-to: index.html :: the Updates pane, `ul.ups`; src/main.ts :: `app.updateAll`; the rail's `data-updates-count`
- kind: explainer
- logged: v0.15.0 · 2026-10-06

The pane was one sentence. It now holds a row for each of the six things that can be installed (three editors, stable and beta); a row shows only when that one is installed, with its small view, name, status and version, and the same actions. A row with a newer version glows. Update all runs the installs one after another and shows only when something is waiting; the rail's Updates item carries the count. When nothing is installed a sentence says so (`:has()` hides it once a row shows). The rows are written by the same patch as everything else, because they carry `data-row` and `data-product`. The date was dropped from the row after it ran under the buttons; it is in Details.

### index.html · Extensions as tiles, with a filter
- refers-to: index.html :: the Extensions pane, `template#ext-row`; src/extensions/library/index.ts :: fill, the filter handlers
- kind: explainer
- logged: v0.15.0 · 2026-10-06

Each extension is a tile on the shared shadow, glowing in its editor's colour under the pointer: its name, who made it and for which editor, what it does, whether it is signed, and a drop-down, What it can use, with its permissions, kind, licence, the editor version it needs and its SHA-256. A row of four buttons filters by editor by setting `data-filter` on the pane; CSS hides the rest, so nothing is rebuilt. Installing an extension is still not built, and the pane says so.

### index.html · Settings says what the hub does not do
- refers-to: index.html :: the Settings list; src/extensions/settings/index.ts :: the `folder` write
- kind: explainer
- logged: v0.15.0 · 2026-10-06

Four rows added: the folder editors are installed in (per system, the same paths as the core's default), and three plain statements: no account, nothing in the background, GPL-3.0.

## v0.14.0 · shadow and glow, and Beta as tiles {#glow}

### src/styles/main.css · how a tile is marked
- refers-to: src/styles/main.css :: `.shelf-item` and its hover and pressed rules, `.row` and `.row:hover`
- kind: explainer
- logged: v0.14.0 · 2026-10-06

The chosen shelf tile had a thin outline in the app's colour and a stripe of it across its top; every row had a stripe down its leading edge. The owner called the highlight a telltale sign and asked for a drop shadow and a glow in the app's colour instead. Every tile now sits on `--shadow-tile`; the chosen one adds `--glow`; one under the pointer adds `--glow-soft`. Rows lost their stripe and the extra padding that made room for it. Removed from the pressed shelf tile:

```css
  box-shadow: inset 0 0 0 1px var(--hue-line), inset 0 var(--sp-1) 0 var(--hue);
```

and from `.row`:

```css
  padding-inline-start: calc(var(--sp-5) + var(--sp-1));
  box-shadow: inset var(--sp-1) 0 0 var(--hue), inset 0 0 0 1px var(--edge);
```

The reasoning and the tokens are in `design/HASHOUT_LOG.md`.

### index.html, src/styles/main.css · Beta is three tiles
- refers-to: index.html :: `ul.tiles` in the Beta pane; src/styles/main.css :: `.tiles` to the tile state rules
- kind: explainer
- logged: v0.14.0 · 2026-10-06

The Beta pane was three plain rows, the same fault the Apps pane had. It is now three tiles, each with the editor's interface on top, its name in its hue, "beta", the status and version, and the actions. A tile whose beta exists or is installed glows in its colour; the others sit on the shadow alone, so the eye goes to what can be had. Each tile carries `data-row="beta"` and `data-product`, so the apps extension writes it with no change, and includes the actions partial by hand. With this, no row with `data-row` is left in the page: the build's insertion of the actions partial into rows (`vite.config.ts`) now matches nothing, and stays only until the next pane needs it or it is removed.

Checked in a browser under 4x CPU: the formcut tile read Beta available 2.7.0-beta.1 with Install, then Installed with Remove and Open; layout shift 0, no node removed.

## v0.13.0 · the Apps pane is a stage, not a list {#stage}

### index.html, src/styles/main.css · the stage and its shelf
- refers-to: index.html :: `section.pane-apps`, `ul.cards`, `div.shelf`; src/styles/main.css :: `.pane-apps` to `.shelf-status`; public/media/formcut.webp, formvis.webp, formwav.webp
- kind: rationale
- logged: v0.13.0 · 2026-10-06

The owner's verdict on the first real window, 2026-10-06: it would make a person think the apps are poor too. It was three plain rows; it showed nothing of what the editors are. A hub's job is to make each app look worth opening before anything is installed.

So the Apps pane now leads with the apps themselves. The upper two thirds of the window is a stage: one editor at a time, its real interface (the captures taken from the running apps in v0.4.0) filling the stage edge to edge, shaded toward the left where its name stands at display size in its own hue, with one line of what it is, two of what it does, its status, version and download size, and its actions as full-size buttons. Under the stage a shelf of three holds a small view of each editor with its name, kind and status; choosing one changes the stage. An editor that is not released still gets its stage, its interface and its words, and simply offers no button.

The pattern is the family's own: formcut.studio opens on a stage with a row of thumbnails. The three captures are the site's, resized to 1600 by 1000 (35 to 71 KB each) and shipped in the hub.

All three stage panels and the shelf are in the page. `data-app` on the pane says which shows; the others are hidden with `visibility`, so their buttons cannot be reached by keyboard. Each panel and each shelf item carries `data-row` and `data-product`, so the apps extension writes their status, version and size exactly as it writes the Beta rows. The stage panels include the actions partial by hand; the build-time insertion still serves the Beta rows.

### src/extensions/stage/index.ts · choosing an editor
- refers-to: src/extensions/stage/index.ts :: the `app.show` command
- kind: explainer
- logged: v0.13.0 · 2026-10-06

A shelf item dispatches `app.show` with its product id; the command sets `data-app` on the pane and `aria-pressed` on the three items. Which editor is on the stage is the window's own business, not the core's, so it is kept here and not in the engine's state.

### src/styles/main.css · .card-meta is a grid of fixed columns
- refers-to: src/styles/main.css :: `.card-meta`
- kind: warning-context
- logged: v0.13.0 · 2026-10-06

Status, version and size first sat in a flowing row. When the status changed length during an install the version and size moved sideways: a measured shift of 0.00007. They now sit in three fixed columns and the shift is 0, at 1180 by 760, 1440 by 900 and 900 by 620 in light, through install, update and switching editors, with no node removed.

## v0.12.0 · run in the real window {#real}

### src/extensions/apps/index.ts · every row is written when a catalogue arrives
- refers-to: src/extensions/apps/index.ts :: the `source` handler
- kind: warning-context
- logged: v0.12.0 · 2026-10-06

A row was patched only when a `product` event named its product. The sample catalogue lists all four products, so in a browser every row was always written. The real window was pointed at a catalogue that listed only formcut, and the formvis and formwav rows stayed blank: no status at all. A `source` event now patches all six rows, so a product the catalogue does not mention reads "Not released yet", which is true.

### src/bridge/tauri.ts · has now run
- refers-to: src/bridge/tauri.ts
- kind: explainer
- logged: v0.12.0 · 2026-10-06

The v0.11.0 entry below says this file had only been compiled. In v0.12.0 the built Linux app used it for `platform`, `catalog`, `installs`, `install` and `open` in a real web view; `rollback` and `remove` and the progress listener's effect on the bar have still not been seen there. The account of the run is in `hub/src-tauri/HASHOUT_LOG.md` § v0.12.0.

## v0.11.0 · the window is wired to the core {#wired}

### row-actions.html, vite.config.ts · actions are markup, placed at build time
- refers-to: row-actions.html; vite.config.ts :: the `rows` replacement in `handler`
- kind: rationale
- logged: v0.11.0 · 2026-10-06

Every app row (three in Apps, three in Beta) carries the same actions: Roll back, Remove, Open, Update, Install and a progress bar. Rather than write that block six times in `index.html` or build it with script, the build inserts an include of `row-actions.html` after each row's version field, and the marker renderer resolves it. The served page has the buttons in it from the first byte; script only sets attributes. This replaces the v0.1.0 entry "no buttons on the rows yet" and its note in the Apps pane, whose paragraph is now the place a failed action is reported (`data-notice`).

### src/extensions/apps/index.ts · row state
- refers-to: src/extensions/apps/index.ts :: patch, write, the click handlers
- kind: explainer
- logged: v0.11.0 · 2026-10-06

A row's `data-install` is `none` (not installed), `busy` (installing, with `--p` from 0 to 1 driving the bar), `ready` (installed and the catalogue offers the same version) or `update` (installed and the catalogue offers another). `data-previous` is present when an earlier version is kept. CSS shows the buttons that fit: Install when none and the catalogue has a file for this computer; Open and Remove when ready; Open and Update when update; Roll back whenever an earlier version is kept; nothing but the bar when busy. The actions column has a fixed width, so no state moves anything. A click dispatches `app.install`, `app.open`, `app.rollback` or `app.remove` with the row's product and channel; Update is `app.install`.

### src/extensions/apps/index.ts · write, and why status text starts at the left
- refers-to: src/extensions/apps/index.ts :: write; src/styles/main.css :: `.row-status`
- kind: warning-context
- logged: v0.11.0 · 2026-10-06

Two things measured. Setting `textContent` replaces the text node: fourteen nodes removed over one install, which the stability rule counts as churn. `write` now changes the existing text node's value. With the node kept, the browser then reported a layout shift of 0.0001 each time the status changed length, because the text was right-aligned and its start moved. The status is now aligned to its start, where a longer word grows away from a fixed edge. After both: no node removed and a shift of exactly 0 through install, open, update, roll back and remove.

### src/bridge/tauri.ts · the shell's bridge
- refers-to: src/bridge/tauri.ts :: tauriBridge, catalogUrl, allowUnsigned; src/bridge/index.ts :: pickBridge
- kind: explainer
- logged: v0.11.0 · 2026-10-06

When the page runs inside the shell (`window.__TAURI__` exists, because the shell's config sets `withGlobalTauri`), `pickBridge` returns this bridge, which calls the shell's commands of the same names and listens for `install-progress` events during an install. No package is needed for it. The catalogue address is `https://formai.dev/catalog/v1/apps.json` unless Settings holds another (`formai-catalog-url` in local storage), and an unsigned catalogue is accepted only if the Developer box in Settings is ticked (`formai-allow-unsigned`). Changing either reloads the catalogue. The extension list is empty in the shell until the catalogue's index is fetched by the core. **Never run**: this file has only been compiled.

### src/bridge/fixture.ts · acted-out installs
- refers-to: src/bridge/fixture.ts :: installed, the action methods, the `installed` query
- kind: explainer
- logged: v0.11.0 · 2026-10-06

In a browser the fixture bridge now plays the actions in memory: an install takes ten steps of 90 ms and reports progress, then records the catalogue's version, keeping the one before as `previous`. `?installed=formcut:2.6.1` in the address starts with that version installed, which is how the update and roll back states are reached. Nothing is downloaded. This is what the interface was exercised against.

### src/main.ts · commands and the notice
- refers-to: src/main.ts :: guard, refresh, the `app.*` commands
- kind: explainer
- logged: v0.11.0 · 2026-10-06

Every command runs inside `guard`, which clears the notice, awaits the work and, if it throws, shows the message in the Apps pane (the core's errors are sentences written for a person). After an install, roll back or remove the installed list is read again from the bridge rather than patched from the answer, so the interface shows what the core recorded. `catalog.load` now sets the platform and the installed list before the catalogue, so a row never shows Install for something already installed.

## public/prepaint.js {#prepaint}

### public/prepaint.js · a file, not an inline script
- refers-to: public/prepaint.js; index.html :: the `script` before the stylesheet
- kind: rationale
- logged: v0.1.0 · 2026-10-04

The site applies the theme with an inline script and allows it by hash. Inside the desktop shell the page runs under a CSP of `script-src 'self'`, and a plain file from the app's own origin needs no hash and no exception. It is a classic script placed before the stylesheet, so it runs before first paint.

---

## src/main.ts {#main}

### src/main.ts · order
- refers-to: src/main.ts :: the whole file
- kind: explainer
- logged: v0.1.0 · 2026-10-04

The engine's theme is seeded from the attribute the pre-paint script set. Extensions are registered and activated, which is when they subscribe. Only then is `catalog.load` dispatched, so no event is missed. `catalog.load` sets the platform first, then the catalogue, then the extension index.

---

## src/engine/index.ts {#engine}

### src/engine/index.ts · Engine
- refers-to: src/engine/index.ts :: Engine
- kind: explainer
- logged: v0.1.0 · 2026-10-04

Holds the state, a typed event bus and a command table. It never touches the DOM and never calls the bridge; it can run with no page at all. Events are granular: `product` names one product, so a subscriber patches the rows of that product and nothing else. There is no event that means "everything changed".

### src/engine/index.ts · commands
- refers-to: src/engine/index.ts :: command, dispatch
- kind: explainer
- logged: v0.1.0 · 2026-10-04

Registered so far: `route.go` (route extension), `theme.set` (theme extension), `catalog.load` (main). A duplicate name or an unknown name throws. Phase 5 adds `app.install`, `app.open`, `app.update`, `app.remove`, and the same names become the shell's command surface in Phase 6.

### src/engine/index.ts · view
- refers-to: src/engine/index.ts :: view
- kind: explainer
- logged: v0.1.0 · 2026-10-04

Answers "what can this computer get for this product on this channel". `unreleased`: the product is prelaunch or unknown. `no-release`: nothing published on that channel. `available`: an artifact for this operating system, preferring the exact architecture and falling back to any for the system. `other-platform`: a release exists with nothing for this system. The words shown for each are in the apps extension, not here.

---

## src/engine/types.ts {#types}

### src/engine/types.ts · kept in step by hand
- refers-to: src/engine/types.ts :: Catalog, Product, Release, Artifact, ExtensionIndex, ExtensionEntry
- kind: warning-context
- logged: v0.1.0 · 2026-10-04

These mirror `catalog/schema/*.json` and `hub/core/src/lib.rs`. A field added to the schema is added in all three.

---

## src/bridge/index.ts {#bridge}

### src/bridge/index.ts · Bridge and pickBridge
- refers-to: src/bridge/index.ts :: Bridge, pickBridge
- kind: todo
- logged: v0.1.0 · 2026-10-04

The one seam between the interface and whatever answers it. Today `pickBridge` always returns the fixture. Phase 6 adds a bridge that calls the shell's commands and returns it when the page is running inside the shell; Phase 4 work on the core does not touch this side.

---

## src/bridge/fixture.ts {#fixture}

### src/bridge/fixture.ts · the fixture is bundled
- refers-to: src/bridge/fixture.ts :: the two JSON imports
- kind: warning-context
- logged: v0.1.0 · 2026-10-04

`catalog/fixtures/*.json` are imported and so end up inside the built script. Fine for a scaffold; before the first release the fixture bridge is left out of production builds. Its `source` is `fixture`, which Settings shows in words, so a sample catalogue is never mistaken for the real one.

### src/bridge/fixture.ts · browserPlatform
- refers-to: src/bridge/fixture.ts :: browserPlatform
- kind: explainer
- logged: v0.1.0 · 2026-10-04

A browser cannot report the processor reliably, so the fixture assumes ARM64 on a Mac and x86-64 elsewhere. The real answer comes from the core.

---

## src/extensions/route/index.ts {#route}

### src/extensions/route/index.ts · switching panes
- refers-to: src/extensions/route/index.ts :: the `route` handler
- kind: explainer
- logged: v0.1.0 · 2026-10-04

Writes `data-route` on `html`, moves `aria-current` between rail buttons, and scrolls the stage to the top. CSS shows the pane whose `data-pane` matches. Panes are never created or removed, so a pane keeps its rows when it is left and returned to.

---

## src/extensions/apps/index.ts {#apps}

### src/extensions/apps/index.ts · patch
- refers-to: src/extensions/apps/index.ts :: patch, WORDS
- kind: explainer
- logged: v0.1.0 · 2026-10-04

For each row of the product named by a `product` event: sets `data-availability`, and the text of the status and version fields. It serves both the Apps rows and the Beta rows, told apart by `data-row`. `WORDS` is the only place the status wording lives.

---

## src/extensions/library/index.ts {#library}

### src/extensions/library/index.ts · keyed list
- refers-to: src/extensions/library/index.ts :: the `extensions` handler
- kind: explainer
- logged: v0.1.0 · 2026-10-04

Keeps a map of mounted rows by extension id. A new id clones the template and appends once; a known id has its text fields updated only where the text differs; an id no longer in the index has its row removed. The list is never cleared and refilled.

### src/extensions/library/index.ts · trust wording
- refers-to: src/extensions/library/index.ts :: fill, the `trust` field
- kind: explainer
- logged: v0.1.0 · 2026-10-04

A package with a `signature` reads "Signed"; one without reads "Unsigned, for testing". Nothing verifies the signature yet: that is the core's job in Phase 7. Until then "Signed" means only that the index carries one.

---

## src/extensions/settings/index.ts {#settings}

### src/extensions/settings/index.ts · data-source
- refers-to: src/extensions/settings/index.ts :: the `source` handler
- kind: explainer
- logged: v0.1.0 · 2026-10-04

Also writes `data-source` on `html` (`none`, `fixture`, `live`) so a later build can mark the whole window when it is showing sample data.

---

## src/styles/main.css {#css}

### src/styles/main.css · the window does not scroll, the stage does
- refers-to: src/styles/main.css :: `body`, `.stage`
- kind: explainer
- logged: v0.1.0 · 2026-10-04

`body` is fixed to the window and hidden on overflow; `.stage` scrolls with `scrollbar-gutter: stable`, so a pane that needs a scrollbar does not shift the ones that do not. Text is not selectable and the cursor is the arrow, as in a desktop app; fields that should be copied (hashes, paths) will opt back in.

### src/styles/main.css · the narrow rail
- refers-to: src/styles/main.css :: the 760px media query
- kind: explainer
- logged: v0.1.0 · 2026-10-04

Under 760px the rail shows icons only and a row stacks its status and version under its name. The shell's minimum window is wider than this; the rule is for the browser during development.

### src/styles/main.css · font-display: optional
- refers-to: src/styles/main.css :: the first `@font-face`
- kind: rationale
- logged: v0.1.0 · 2026-10-04

Same reason as the site: a font that arrives after first paint must not reflow the window. In the shell the font is a local file and is ready at first paint.

---

## vite.config.ts {#vite}

### vite.config.ts · the version fact
- refers-to: vite.config.ts :: `facts`
- kind: explainer
- logged: v0.1.0 · 2026-10-04

`%fact:version%` in `index.html` is this package's version, read at build time, so the version shown in the rail and in Settings cannot disagree with `package.json`.

### vite.config.ts · server
- refers-to: vite.config.ts :: `server`, `preview`
- kind: warning-context
- logged: v0.1.0 · 2026-10-04

`host: false`, `strictPort: true`, 3250 for dev and 3251 for preview. `fs.allow` names this folder, `design/` and `catalog/`. `clearScreen: false` keeps the shell's own output readable when the two run together.
