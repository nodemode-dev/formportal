# HASHOUT_LOG · design · formai_dev

Living log for the shared design files: the tokens, the icon set and the build-time marker renderer that both the site and the hub interface use. Source files stay comment-free; what they would have said lives here.

Current build version: v0.72.0
Last updated: 2026-11-25 · v0.72.0 no design source changed (the version only); 2026-11-25 · v0.71.8 no design source changed (the version only); 2026-11-25 · v0.71.7 no design source changed (the version only); 2026-11-23 · v0.71.6 no design source changed (the version only); 2026-11-23 · v0.71.5 no design source changed (the version only); 2026-11-23 · v0.71.4 no design source changed (the version only); 2026-11-22 · v0.71.3 releases the entry headed "after v0.71.2" (heading left as written): the key icon (#pf-key); 2026-11-22 · v0.71.2 no design source changed (the version only); 2026-11-22 · v0.71.1 releases the entry headed "after v0.71.0" (heading left as written): SubForm is FormSubstrate, FormPublisher, FormCAD and FormMorpheus follow the owner's lines (#substrate); 2026-11-21 · v0.71.0 FormPublisher in the registry, FormREC spelled as the website does (#publisher-registry); 2026-11-20 · v0.70.2 no design source changed (the version only); 2026-11-20 · v0.70.1 no design source changed (the version only); 2026-11-20 · v0.70.0 no design source changed (the version only); 2026-11-20 · v0.69.0 releases the entry headed "after v0.68.0" (heading left as written): the family alignment (#family-align); 2026-11-19 · v0.68.0 no token or icon file changed (the version only); 2026-11-19 · v0.67.0 no token or icon file changed (the version only); 2026-11-19 · v0.66.0 no token or icon file changed (the version only; the gear for Preferences is drawn in the interface's markup, see the frontend log); 2026-11-11 · v0.64.1 no change (the version only); 2026-11-09 · v0.64.0 no token or icon change (the version only); 2026-11-10 · v0.63.6 FormRec's icon in dark and light and its hue #ae75ec (#formrec); 2026-11-09 · v0.63.3 form.ext's real icon in dark and light (#formext-icon); 2026-11-07 · v0.63.0 form.ext's hue #4f6bff; 2026-11-06 · v0.61.0 formcompiler is no app, its hue removed; formranker keyed as formbench; 2026-11-06 · v0.59.0 app-hues.json; 2026-10-04 · scaffold

---

## after v0.71.2 · a key icon for Preferences, Keys {#pf-key}
- refers-to: design/icons.json :: `pf-key`
- kind: feature
- logged: after v0.71.2 · 2026-11-22

Hand-drawn in the set's own 24 px grid and stroke: a ring and a shaft with two teeth, `currentColor`, used for the Keys tab and section head.

## after v0.71.0 · SubForm is FormSubstrate; FormPublisher, FormCAD and FormMorpheus follow the owner's words {#substrate}
- refers-to: catalog/products.json :: `formsubstrate` (was `subform`), `formpublisher`, `formcad`, `formmorpheus` · catalog/apps/formsubstrate.json (git mv from subform.json), formslot.json · catalog/schedule.json :: Group 7 · design/app-hues.json :: `formsubstrate`, `formpublisher` · frontend/public/apps/formsubstrate.webp, formsubstrate-light.webp, frontend/public/heroes/formsubstrate.webp, formsubstrate-light.webp (git mv) · frontend/markup.ts :: `CATEGORY` · LICENSES.md :: the FormPublisher icon row
- kind: change
- logged: after v0.71.0 · 2026-11-21

The owner: "SubForm should be renames FormSubstrate and the app name should just be called Substrate.app and it is instead of vs code as the form family code/text editor that is agentically integrated".

- `subform` becomes `formsubstrate` everywhere it was a key: the registry entry (name FormSubstrate, identifier `ai.nodemode.formsubstrate`, repository nodemode-dev/formsubstrate, `alt_of` VS Code, the note and summary the owner gave; the summary keeps "several ... at once" from the old one, which the new sentence would have lost), the app page file and its id, name and repository, the 28 November schedule entry, the hue key (same `#a077e0`), the icon and hero files. FormSlot's page says its panel lives in FormSubstrate. The page's lede says the installed app is called Substrate; no other page shows an installed application's own name. On the Apps page it sits in Code Editor Apps beside form.ext. The install, run and agent commands on its page (`./subform`, `subform_oc_install`, `SUBFORM_PORT`) and the `/media/subform/` screenshot paths are the repository's and the website's own names and were left as they are; they change when those do.
- FormPublisher: licence GPL-3.0-only (its LICENSE file, so the icon row in LICENSES.md says so too), hue `#5fe07a` (the owner's choice, so its tile is no longer the default colour), `alt_of` Wix and Squarespace, the owner's note and summary; still `in-development`.
- FormCAD: `alt_of` AutoCAD, SolidWorks and Rhino. FormMorpheus: the owner's summary; `alt_of` stays Procreate Dreams.

`catalog/` is a copy of formai_dev's contract: the same changes belong there (and on the website) so the next copy does not undo them.

## v0.71.0 · FormPublisher's icon, and each app's "Instead of" line follows its repository {#abouts-and-publisher-icon}
- refers-to: frontend/public/apps/formpublisher.webp, formpublisher-light.webp; catalog/products.json :: `alt_of` of formtools, formweb, formdesign, formdam, formslide, formsurface, formsculpt; `summary` of formpublisher; LICENSES.md :: the FormPublisher icon row
- kind: fix
- logged: v0.71.0 · 2026-11-21

The owner, on seeing a supporter's On the way tiles: FormTools is not an original, FormWeb stands in for Figma, Framer and Webflow, "look at their repo abouts to see", and FormPublisher is an original tied to FormWeb for publishing sites, with its icons attached. The registry's `alt_of` was compared with the About line of every public app's repository on GitHub on 21 November and brought in line where it had fallen behind: FormTools (QuickLook, HandBrake and Permute; it had none, so a supporter's tile called it an original), FormWeb (Figma, Framer and Webflow), FormDesign (InDesign and Affinity), FormDAM (Apple Photos and Adobe Bridge), FormDeck (PowerPoint, Keynote and Google Slides), FormSurface (Substance 3D Painter), FormSculpt (Nomad Sculpt and ZBrush). The registry keeps its own "and" where the About lines write "&". FormWav keeps its note ("No standard app existed, so we built one") although its About says "instead of 13 different audio apps": that line was the owner's own and he named only the two. The private apps' lines could not be compared. FormPublisher's icons are the owner's 1024 px tiles scaled with Lanczos to 256 px WebP with alpha at quality 90, as FormRec's were; it has no entry in `app-hues.json` yet, so its name takes the default colour. The website's copy of the registry should take the same lines.

## v0.71.0 · FormPublisher is in the registry, FormREC is written as the website writes it {#publisher-registry}
- refers-to: catalog/products.json :: `formpublisher`, `formrec`
- kind: fix
- logged: v0.71.0 · 2026-11-21

The schedule lists `formpublisher` for 22 November but the registry did not, so the tile showed the bare id. The website's entry is copied as the website writes it (FormPublisher, status `in-development`, no icon file) at the position the website has it, after SubForm; with no icon file the page already writes the empty icon span other unreleased apps use, and the app hue falls back to the default. `formrec` was already in the registry as "FormRec"; only its `name` is now "FormREC", the website's spelling. The other schedule ids the registry lacks (`formportal`, `formdeck`, `formskill`) are not missing: FormPortal's code maps them to `formai`, `formslide` and `formskills`. The rest of the `formrec` entry (note, minimum systems) still differs from the website's and is left as it was. The existing tests that read the registry pass unchanged (no test counts the products). The registry now holds 37 products.

## The family alignment of 2026-11-20 {#family-align}
- refers-to: design/tokens.css :: `--text-on-accent`, `--font-ui`, `--font-mono`, the `--z-*` scale · frontend/src/styles/main.css :: `html[data-font="fallback"]`
- kind: decision
- logged: after v0.68.0 · 2026-11-20

The family's design pass (one visual language, FormVis's token names and Studio Dark's values; DESIGN_W7.md) found 53 names shared with FormVis's `tokens.css` and 8 of them with another value. Surfaces, text, borders and radii were already FormVis's in dark, light and AMOLED, so nothing there moved. Three of the 8 take FormVis's value: `--text-on-accent` `#fff` (the same colour), `--font-ui` and `--font-mono` (FormVis's lists, word for word). No owner decision in this log covers the fonts; the 2026-10-04 decision (a neutral hub, one hue per product) is about colour and is kept as it was, with the accent the ink colour. The five others are the z-index scale and stay ours, as the family's decision says: `--z-raised` 100 (FormVis 8), `--z-chrome` 300 (100), `--z-overlay` 600 (50000), `--z-toast` 800 (3000), `--z-debug` 1000 (100000); moving them would reorder what stacks over what. The alias layer (`--ground`, `--pane`, `--ink` and the rest) stays. The base font size stays 13px.

What a person sees: on macOS the hub's text is now the system's San Francisco, as FormVis's is; on Windows and Linux Inter still comes before Segoe UI and the system font. The bundled Inter file and the wait for it before the first frame (`frontend/public/prepaint.js`) are unchanged. When Inter is not ready in time, `html[data-font="fallback"]` keeps the same order with the metric-matched "Inter Fallback" in Inter's place, so the fallback no longer puts Arial's metrics before San Francisco on macOS.

Measured in headless Chromium on Linux at the hub's window size, 1180 by 760, with the browser fixture, every view (Home, Apps, Updates, Files, Fonts, Stock and templates, Extensions, Learn) in dark and light before and after: only text pixels changed (12,687 to 37,374 per view, in the text of the sidebar, the top bar and the page, x 47 to 1140), because on this machine `-apple-system` resolves to the system's Inter rather than the bundled variable file; no surface, border or colour moved. Every resolved token on `:root` is the same before and after except `--font-ui`, `--font-mono` and the body's font. A cold load at 4x CPU throttle, recorded frame by frame, gave the same sequence before and after: one white frame captured on the empty tab as the recording began (before the document arrived, the same in both), then `#111111` and then the finished Studio Dark window; no frame in another palette. Not seen on macOS or Windows.

## AMOLED Black tokens {#amoled}
- refers-to: design/tokens.css :: :root[data-oled]
- kind: decision
- logged: v0.65.0 · 2026-11-19

The family's AMOLED Black profile in FormPortal's own names, which are the formvis names: `--bg-primary` and `--bg-secondary` are `#000000` (a black pixel is off on an OLED screen, so panels are told apart by borders alone), `--bg-tertiary` `#141414` (inputs, menus and selected rows use it as their only fill and would vanish at black), `--border-color` `#262626`, `--border-light` `#3a3a3a`, text `#ededed`, `#a6a6a6`, `#858585` (17.9, 8.6 and 5.7 to 1 on black). `--bg-hover` and `--border-soft` go to 10% and 12% white because the usual 6% and 8% are too close to black to read. The accent is not touched. The rule hangs on `data-oled`, never on the theme id, so another OLED profile needs only the flag. The shell's own surface tokens are in frontend/src/styles/portal.css (frontend/HASHOUT_LOG.md#amoled).

---

## FormRec's icon and hue {#formrec}
- refers-to: frontend/public/apps/formrec.webp, formrec-light.webp; design/app-hues.json :: formrec; LICENSES.md :: the FormRec icon row
- kind: decision
- logged: v0.63.6 · 2026-11-10

FormRec joins the products as `formrec`, in development. Its icons are the owner's FormRec app tiles (`formrec_icon_dark.png` on the dark tile, `formrec_icon_light.png` on the light tile), scaled from 1024 px to 256 px RGBA WebP like every other `apps/` icon (5.4 and 6.5 KB). Its hue is `#ae75ec`, the violet of the waveform in its own tile, sampled from the dark icon. formai.studio's `design/tokens.css` should key the same value so the hub, the site and the app agree.

---

## form.ext's icon {#formext-icon}
- refers-to: frontend/public/apps/formext.webp, formext-light.webp; LICENSES.md :: the form.ext icon row
- kind: fix
- logged: v0.63.3 · 2026-11-09

v0.63.0 took form.ext's icon from its `src-tauri/icons/icon.png` when that file still held the placeholder (a flat, upright puzzle piece on a dark tile), and used the same dark picture for `formext-light.webp`, so the family row, Apps and the sidebar showed a form.ext no other place shows. Both files are now the owner's artwork that form.ext ships (its README and `assets/app-icon/`): the tilted puzzle piece, on the dark tile for `formext.webp` and on the light tile for `formext-light.webp`, from the 1024 px originals scaled to 256 px RGBA WebP like every other `apps/` icon (6.5 and 7.7 KB beside formvis's 6.6 KB). Nothing reads the files differently.

---

## form.ext's hue {#formext-hue}
- refers-to: design/app-hues.json :: formext
- kind: decision
- logged: v0.63.0 · 2026-11-07

form.ext joins the products as `formext`; its hue is `#4f6bff` (indigo), the accent form.ext itself uses (`nodemode-dev/form.ext` `frontend/src/styles/tokens.css`), chosen there as the candidate farthest from every other app's hue. formai.studio's `design/tokens.css` keys the same value, so the hub, the site and the app agree.

## formcompiler is not an app {#formcompiler-not-app}
- refers-to: app-hues.json
- kind: decision
- logged: v0.61.0 · 2026-11-06

formcompiler is the repository that builds and releases the family, never downloaded or installed, so its hue is removed from app-hues.json. tokens.css and icons.json never carried a formcompiler entry.

---

## FormBench product id {#formbench-id}
- refers-to: app-hues.json :: formbench · tokens.css :: [data-product="formbench"]
- kind: decision
- logged: v0.61.0 · 2026-11-06

The product id formranker becomes formbench to match the signed catalogue and the canonical name FormBench. Only the key and selector change; the colours (#5ee0e0 in app-hues.json, #f97316 in tokens.css) are untouched. formai and formslide stay as FormPortal's catalogue ids (FormPortal and FormDeck). icons.json and markers.ts hold no product ids or icon file names, so they are unchanged.

---

## v0.59.0 · each app's colour {#hues}
- refers-to: design/app-hues.json · frontend/markup.ts :: hue
- kind: decision
- logged: v0.59.0 · 2026-11-06

formai.studio colours each app's name suffix (FormLit blue, FormDAM green, FormDeck lime, FormWav teal...). The colours were read from the built site in a browser (computed colour of every `.app-suffix`; most are oklab), converted to sRGB hex so WebKit before oklab support renders them, and keyed by FormPortal's ids; FormPortal itself is the site's cream `#f3ebe3`. The v3 icons share one gradient family, so a colour sampled from the icons would not tell the apps apart.

---

## Org-navi-map

```
design/
├── tokens.css      every colour, size, type and z value for the site and the hub
├── icons.json      the icon set: 24-unit grid, stroke or fill, plus three wide motifs
├── markers.ts      build-time renderer for %icon:%, %fact:% and @include markers
└── package.json    marks the folder as ES modules for Vite's config loader
```

---

## Table of contents

- [tokens.css](#tokens)
- [icons.json](#icons)
- [markers.ts](#markers)

---

## tokens.css {#tokens}

### tokens.css · formvis's vocabulary, the family's names mapped onto it
- refers-to: tokens.css :: `--accent-color` to `--ctl-xl`, `--ground` to `--focus`, `--radius-s`, `--radius-m`, `--radius-l`, `--z-prefs-wire`, `--z-prefs-tab`, `--z-prefs-port`
- kind: decision
- logged: FormPortal v0.56.0 · 2026-11-06

FormPortal's copy of the tokens now carries formvis v1.99.7's vocabulary with formvis's values: `--bg-primary/secondary/tertiary/input/hover/scrim`, `--border-color/light/soft`, `--text-primary/secondary/muted/on-accent`, `--accent-color` (#f97316) with `-dim` and `-hover`, `--danger-fill/soft`, `--radius-xs` to `--radius-xl`, `--space-1` to `--space-7`, `--shadow-sm/md/lg/window`, `--fs-11` to `--fs-14`, `--ctl-sm` to `--ctl-xl`. Dark is formvis's Studio Dark, light is its "Light" profile (the light block overrides the surfaces, lines, text, hover, scrim and the two light shadows, as formvis's `body.theme-light` does). The older names stay, as aliases: `--ground`, `--inset`, `--pane`, `--float`, `--control` (and hover and press, mixed from `--bg-tertiary` and `--text-primary`), `--edge`, `--edge-strong`, `--ink` and its two softer steps, `--on-ink`, `--fault` (formvis's `--danger-soft` in dark, the old red in light), `--veil`, `--bar-veil`, `--focus` (the accent), and the radii `--radius-s/m/l` (6, 10, 12 now, from 6, 10, 16). Spacing `--sp-*`, type `--fs-xs` to `--fs-hero`, the product hues and the glow tokens are untouched. The light block still keys on `:root[data-theme="light"]`, not formvis's `body.theme-light`, because FormPortal's prepaint sets the attribute. The site (formai_dev's copy) has not taken these lines; this copy now differs from it, and the change belongs in formai_dev first, per `CLAUDE.md`, before the next sync.

### tokens.css · three layers for the Preferences rail, wire and port
- refers-to: tokens.css :: `--z-prefs-wire`, `--z-prefs-tab`, `--z-prefs-port`
- kind: explainer
- logged: FormPortal v0.56.0 · 2026-11-06

Formvis names its Preferences layers `--z-base` (wire), `--z-raised` (tabs) and `--z-selected` (port) on its own scale. FormPortal's scale has other numbers, so the three are named for what they do and mapped: wire on `--z-base`, tab on `--z-raised`, port on `--z-raised` plus 1. They only order the children inside the dialog; the dialog itself is in the top layer.

### tokens.css · FormBench's hue
- refers-to: tokens.css :: [data-product="formbench"]
- kind: decision
- logged: FormPortal v0.50.1 · 2026-10-25

FormBench (then named FormRanker) joins formcompiler's registry (formcompiler 0.4.4) as the desktop app from 0.7.0, so it joins FormPortal's catalogue in Family tools; its hue is the orange of FormBench's own badge, #f97316. Its icon was already in `frontend/public/apps/formbench.webp` from v0.49.0. formai_dev's copy should take the same line.

### tokens.css · hues for the seven apps added to the catalogue
- refers-to: tokens.css :: [data-product="formpdf"], formtxt, formcel, formref, formsculpt, format, formtray
- kind: decision
- logged: FormPortal v0.49.0 · 2026-10-25

FormPortal 0.49.0 follows formcompiler's registry, so these seven products appear in its lists; each gets a `--hue` like the others (it colours accents; the tiles themselves are now the apps' own icons). The hues for formhub, formsim, formui and formapp stay, unused, so formai_dev's copy and this one differ only by additions. formai_dev's copy should take the same lines.

### tokens.css · one file for both sides
- refers-to: tokens.css :: the whole file
- kind: rationale
- logged: v0.1.0 · 2026-10-04

The plan said one tokens file per side. One shared file is stricter: the site and the hub cannot drift. Each side's `main.css` imports it by relative path, and each Vite config allows the `design` folder.

### tokens.css · the family ground and the product hues
- refers-to: tokens.css :: `--ground` to `--focus`, `--hue-*`
- kind: rationale
- logged: v0.1.0 · 2026-10-04

The owner's decision of 2026-10-04: a neutral family ground with one hue per product. formcut keeps its amber `#ffae2b`; formvis is an off-purple `#a98bf0`; formwav is a neon teal-green `#1fe5c0`. The hub has no hue of its own: its accent is the ink colour, so the three product hues are the only colour on a screen and always mean a product. The light profile darkens each hue (`#a86400`, `#6a48c9`, `#00806a`) so text in a hue stays readable on a light ground.

### tokens.css · --hue, --hue-wash, --hue-line
- refers-to: tokens.css :: the `[data-product]` rules and the last rule
- kind: warning-context
- logged: v0.1.0 · 2026-10-04

`data-product="formcut"` on any element sets `--hue` for its subtree. `--hue-wash` and `--hue-line` are derived with `color-mix`, and a custom property that references another is resolved on the element that declares it, then inherited as a value. Declared only on `:root` they would stay the hub's colour everywhere. So they are declared on `:root, [data-product]`: every element that sets a hue re-derives them. Removed while writing:

```css
  --hue-wash: color-mix(in srgb, var(--hue) 14%, transparent);
  --hue-line: color-mix(in srgb, var(--hue) 42%, transparent);
```

These two lines sat inside `:root` and were moved to the shared rule at the end of the file for the reason above.

### tokens.css · the z-index layer scale
- refers-to: tokens.css :: `--z-base` to `--z-debug`
- kind: explainer
- logged: v0.1.0 · 2026-10-04

The only place a stacking number may appear. Components use `var(--z-name)`; within a layer `calc(var(--z-name) + n)` with n under ten.

| Token | Value | What belongs there |
| --- | --- | --- |
| `--z-base` | 0 | normal flow |
| `--z-raised` | 100 | controls that sit above a clickable row, hover and focus lifts |
| `--z-sticky` | 200 | the site's top bar, pinned rows |
| `--z-chrome` | 300 | the hub's rail and title bar |
| `--z-dropdown` | 400 | menus and selects |
| `--z-scrim` | 500 | the backdrop behind a dialog |
| `--z-overlay` | 600 | dialogs and full-window sheets |
| `--z-popover` | 700 | popovers opened from inside an overlay |
| `--z-toast` | 800 | notifications |
| `--z-tooltip` | 900 | tooltips and the skip link |
| `--z-debug` | 1000 | development only |

Anything that must escape its container renders into an overlay root that is a direct child of `body`. The site has none yet. The hub has `#overlay-root` and `#toast-root`.

### tokens.css · font weights
- refers-to: tokens.css :: `--weight-*`
- kind: explainer
- logged: v0.1.0 · 2026-10-04

Inter is a variable font, so the weights are chosen values (420, 560, 640), not the named steps. They only take effect when Inter is the font in use; the fallback rounds them.

---

## icons.json {#icons}

### icons.json · pf-interface, pf-user, pf-about, pf-fold, pf-close
- refers-to: icons.json :: `pf-interface`, `pf-user`, `pf-about`, `pf-fold`, `pf-close`
- kind: decision
- logged: FormPortal v0.56.0 · 2026-11-06

Five stroke icons for the Preferences rail, card heads, fold button and close button. Their shapes follow formvis v1.99.7's `pfInterface`, `pfFold` and `close` in `frontend/src/ui/icons.ts`; formvis's circles and rectangles were rewritten as path commands because this format has only `paths`. `pf-user` and `pf-about` are new (formvis has no Account or About card). They draw at the format's stroke width of 1.75, not formvis's 1.6, since `markers.ts` fixes it. The General card reuses `settings`, Apps reuses `apps`, Catalogue reuses `book`, and the card chevrons reuse `chevron-down`.

### icons.json · format
- refers-to: icons.json :: every entry
- kind: explainer
- logged: v0.1.0 · 2026-10-04

Each icon is `{ paths, fill?, viewBox? }`. Without `fill` it is drawn as a 1.75 stroke in `currentColor` with round caps and joins; with `fill: true` its paths are filled with `currentColor`. The default view box is `0 0 24 24`. All were drawn by hand for this build; none comes from an icon set, so there is nothing to attribute.

### icons.json · icons carried from formcut_studio
- refers-to: icons.json :: `arrow-right` to `chevron-down`, twenty-five entries on one line each
- kind: warning-context
- logged: v0.3.0 · 2026-10-04

Added for formcut's pages, copied from formcut_studio's `icons.json` under their own names (`code` there is the same drawing as `source` here). formcut_studio's NOTICE credits only the GitHub mark to a third party, and that mark was not copied: `%icon:github%` became `%icon:source%`, and the Windows logo became `%icon:laptop%`. Open point: formcut's own NOTICE says its timeline glyphs derive from Lucide (ISC). Whether any of these twenty-five do was not established; if so, Lucide's notice belongs in `NOTICE`. The paragraph above about all icons being drawn for this build applies to the first nineteen only.

### tokens.css · a tile is lifted and glows in its app's colour
- refers-to: tokens.css :: `--shadow-tile` (both themes), `--glow`, `--glow-soft` in the `:root, [data-product]` rule
- kind: rationale
- logged: v0.14.0 · 2026-10-06

The owner's instruction of 2026-10-06: remove the telltale signs of a generated interface, naming the tile highlight; a tile should have a drop shadow and a glow in its app's colour. Until now a chosen or product tile was marked the way such interfaces usually are: a coloured stripe along one edge of a rounded card, or a thin coloured outline. Both are gone, from the hub and the site.

The rule now: a tile sits on `--shadow-tile`, a real drop shadow (a tight contact shadow and a wide soft one, lighter in the light theme). A tile that is chosen, available, or the visitor's own platform adds `--glow`, two layers of the product's hue mixed toward transparent, one close and one wide and low. Under the pointer a tile takes `--glow-soft`. The glow is derived with `color-mix` from `--hue`, so it is declared in the same rule as `--hue-wash` and follows whatever `data-product` sets: amber for formcut, violet for formvis, teal for formwav, the ink colour for the hub itself. No tile carries a coloured stripe or a coloured outline any more; a new one should not either.

### tokens.css · tokens for formcut.studio's design
- refers-to: tokens.css :: `--black` to `--shadow-frame`, `--z-behind`, and `--paper`, `--paper-edge`, `--rail-dark`, `--rail-ink` in the light profile
- kind: explainer
- logged: v0.4.0 · 2026-10-05

Added so formcut.studio's ported stylesheet has no colour of its own. `--footage-*` and `--shade-*` are text and gradients laid over video, the same in both themes because footage does not change with the theme. `--paper*`, `--rail-*` and `--card-light*` are the band the in-depth story sits on: in dark they point at the family's own surfaces; in light the paper is the warm off-white formcut.studio uses. The two shadows are formcut.studio's without its amber glow, because a token on `:root` cannot follow a product's hue. `--z-behind` (-1) joins the layer scale for a background drawn behind its own section's content inside an isolated stacking context, which is the only place it is used.

### markers.ts · a partial may include a partial
- refers-to: markers.ts :: the `include` loop at the top of renderMarkers
- kind: warning-context
- logged: v0.4.0 · 2026-10-05

Includes are now resolved in up to four passes. `formcut-home.html` includes `formcut-get.html`, and with a single pass the inner marker was left in the page; the build refused it ("unresolved marker"), which is the guard working. Four levels is a ceiling against a partial that includes itself. The earlier sentence "Partials are not nested" no longer holds.

### markers.ts · data-nav and data-nav-exact
- refers-to: markers.ts :: the two `data-nav` replacements in renderMarkers
- kind: explainer
- logged: v0.3.0 · 2026-10-04

`data-nav="/formcut/"` marks a link current on that page and every page under it, so the top bar shows formcut as current across formcut's seven pages. `data-nav-exact` marks a link current only on its own page; the row of links across a product's pages uses it. The two patterns cannot match each other's attribute, so their order does not matter. Both attributes are removed from every link.

### icons.json · mark and formai
- refers-to: icons.json :: `mark`, `formai`
- kind: explainer
- logged: v0.1.0 · 2026-10-04

The family mark is three bars of falling length: a track, a layer, a wave, the three editors. In one colour it is the `mark` icon. In the site's top bar and the favicon each bar takes its product's hue, which is why the top bar carries its own inline SVG with a class per bar rather than the `%icon:mark%` marker.

### icons.json · motif-formcut, motif-formvis, motif-formwav
- refers-to: icons.json :: the three `motif-*` entries
- kind: explainer
- logged: v0.1.0 · 2026-10-04

Wide decorative strips (view box `0 0 160 40`) shown at the trailing edge of a product row: clips on two tracks, three stacked layers, a waveform. The waveform's 32 bars were generated once from a sine product and pasted in; they are data, not code.

---

## markers.ts {#markers}

### markers.ts · renderMarkers
- refers-to: markers.ts :: renderMarkers
- kind: explainer
- logged: v0.1.0 · 2026-10-04

Runs on each page at dev and build time, in this order: `<!-- @include file -->` is replaced by the file from the side's `chrome/` folder; `%icon:name%` or `%icon:name:classes%` by the inline SVG; `%fact:key%` by the value from the facts file (keys may contain dots, as in `formcut.summary`); `__CANONICAL__` by the page's address; `<html lang="en"` gains `data-page`; a link whose `data-nav` equals the page's path gains `aria-current="page"` and every `data-nav` is removed. Includes come first so markers inside a partial are resolved too. Partials are not nested.

### markers.ts · the unresolved-marker check
- refers-to: markers.ts :: the `left` match at the end of renderMarkers
- kind: warning-context
- logged: v0.1.0 · 2026-10-04

Any marker left after rendering fails the build with the page's name. This is what stops a template token reaching a visitor: an unknown icon or fact throws at its replacement, and a malformed marker is caught here.

### markers.ts · the .ts extension on imports of this file
- refers-to: site/frontend/vite.config.ts and hub/frontend/vite.config.ts :: the import of `markers.ts`
- kind: rationale
- logged: v0.1.0 · 2026-10-04

Vite 8 warns that its native config loader needs a file extension on relative imports and ES module syntax declared by the nearest `package.json`. Hence the `.ts` in the import, `allowImportingTsExtensions` in each `tsconfig.json`, and `design/package.json` with `"type": "module"`.
