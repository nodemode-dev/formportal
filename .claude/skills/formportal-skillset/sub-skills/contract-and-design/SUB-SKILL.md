---
name: contract-and-design
description: The catalogue contract and design tokens FormPortal reads from formai_dev. Use when a catalogue field, schema, product registry entry, fixture, token, icon or marker needs to change, or when formai_dev's copies and FormPortal's drift.
---

# contract-and-design

- `catalog/` (schemas, `products.json`, fixtures) and `design/` (`tokens.css`, `icons.json`, `markers.ts`) are copies of formai_dev's at the version named in `NOTICE` and the copying commit.
- Change order: formai_dev first (it publishes the catalogue and runs the site), then copy the changed files here in one commit whose message names the formai_dev version. Never edit the copies here first.
- `products.json`'s FormPortal entry still carries id `formai`, identifier `dev.formai.hub` and the formai_dev repository; it is corrected in formai_dev's site update, then copied.
- The family look: dark ground, one neutral palette, a hue per app, Inter, inline `currentColor` icons. FormPortal has no hue of its own; its accent is the ink colour.
