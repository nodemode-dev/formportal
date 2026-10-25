# HASHOUT_LOG · design · formai_dev

Living log for the shared design files: the tokens, the icon set and the build-time marker renderer that both the site and the hub interface use. Source files stay comment-free; what they would have said lives here.

Current build version: v0.1.0
Last updated: 2026-10-04 · scaffold

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
