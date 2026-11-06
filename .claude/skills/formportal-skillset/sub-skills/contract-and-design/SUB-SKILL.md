---
name: contract-and-design
description: The catalogue contract and design tokens FormPortal reads from formai_dev. Use when a catalogue field, schema, product registry entry, fixture, token, icon or marker needs to change, or when formai_dev's copies and FormPortal's drift.
---

# contract-and-design

- `catalog/` (schemas, `products.json`, `schedule.json`, `apps/` caps, fixtures) is a copy of formai_dev's at the version named in the copying commit. Change order: formai_dev first (it runs the site and owns the registry), then copy the changed files here in one commit whose message names the formai_dev version. Only the 24 apps in FormPortal's registry have caps here; never copy content for apps formai_dev has not announced.
- FormPortal's registry ids differ from formai_dev's for three apps and stay so (installs and state use them): `formai` (formai_dev `formportal`), `formslide` (`formdeck`), `formskills` (`formskill`). The product id `formranker` is now `formbench`, the same as formai_dev's.
- `design/` (`tokens.css`, `icons.json`, `markers.ts`) is FormPortal's own since v0.56.0. The tokens carry formvis's vocabulary (the Form apps' look: dark by default, the shared accent from `nodemode_ui_settings`, no scrollbars) with FormPortal's older names mapped onto it; the website's `design/tokens.css` in formai_dev is the site's look and is not copied either way.
- App icons are the owner's v3 set, dark and light, in `frontend/public/apps/<id>.webp` and `<id>-light.webp`; both are in every tile and the theme picks one.
