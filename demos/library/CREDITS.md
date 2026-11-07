# Credits · FormPortal demo 3 (library)

Everything the demo decodes or reads ships in `assets/store.js` (fonts gzipped, photographs and templates as base64) or, for thumbnails, as plain files in `store/thumbs/`. Licences are as stated on the source page.

## Photographs (Wikimedia Commons, CC0)

Each file page was checked through the Commons API (`prop=imageinfo&iiprop=extmetadata`, fields Artist and LicenseShortName); the page tool could not fetch Commons pages. All eight read `CC0` (`cc0`). Files are the repository's own copies in `frontend/public/store/media/` (1024 px wide JPEG, as FormPortal ships them); thumbnails are the repository's own 640 px WebP files.

| File | Title | Author | Source page | Licence |
| --- | --- | --- | --- | --- |
| photo-woman-in-headwrap-profile.jpg | Woman in a headwrap in Quebec City | Wilfredor | https://commons.wikimedia.org/wiki/File:Woman_in_a_headwrap_in_Quebec_City.jpg | CC0 |
| photo-man-drinking-coffee-at-market.jpg | Coffee drinking vegetable seller | Wilfredor | https://commons.wikimedia.org/wiki/File:Coffee_drinking_vegetable_seller.jpg | CC0 |
| photo-snowy-alpine-valley.jpg | Lac du Lou from below Col de la Chambre, Les Menuires | DimiTalen | https://commons.wikimedia.org/wiki/File:Lac_du_Lou_from_below_Col_de_la_Chambre,_Les_Menuires.jpg | CC0 |
| photo-sunset-storm-cloud.jpg | Stormy sunset clouds over Rome, Italy | Jebulon | https://commons.wikimedia.org/wiki/File:Stormy_sunset_clouds_over_Rome,_Italy.jpg | CC0 |
| photo-bike-in-snow-at-night.jpg | Bike on a snowy street in Quebec City at night | Wilfredor | https://commons.wikimedia.org/wiki/File:Bike_on_a_snowy_street_in_Quebec_City_at_night.jpg | CC0 |
| photo-peppers-in-a-bowl.jpg | Sweet Pepper Market | Wilfredor | https://commons.wikimedia.org/wiki/File:Sweet_Pepper_Market.jpg | CC0 |
| photo-trajans-market-rome.jpg | Trajan's Market, Rome, Italy | Jebulon | https://commons.wikimedia.org/wiki/File:Trajan%27s_Market,_Rome,_Italy.jpg | CC0 |
| photo-tea-with-lemon.jpg | A cup of Assam Tea with lemon | Nayan j Nath | https://commons.wikimedia.org/wiki/File:A_cup_of_Assam_Tea_with_lemon.jpg | CC0 |

## Templates (the Form family's own work, Apache-2.0)

Copied byte for byte from the commit named in the URL; the SHA-256 of each is in `media-src/templates.json` and checked on every Save. The repository's own `formcut-gentle-warm.cube` (https://github.com/nodemode-dev/formcut/blob/1e9b4f3bb664b7b0fae0ab9d209d9e2d8a3852e9/examples/gentle-warm.cube, Apache-2.0, in `frontend/public/store/media/`) is also listed.

| File in the demo | Title | Author | Source | Licence | Changes |
| --- | --- | --- | --- | --- | --- |
| formencoder-warm.cube, -cool, -faded, -mono, -neutral, -bleach-bypass, -high-contrast, -teal-and-orange | FormEncoder looks | NodeAgentc, Inc. | https://github.com/nodemode-dev/formencoder/tree/7e605f98de363477d14f64239133e18731e4685d/backend/app/resources/luts | Apache-2.0 | File names lower-cased with dashes |
| formvfx-text-animators.json | FormVFX text animator presets | NodeAgentc, Inc. | https://github.com/nodemode-dev/formvfx/blob/da19774abb9668ad9f369416561185f705094975/presets/text-animators.json | Apache-2.0 | none |
| formcut-pulse.wgsl | FormCut pulse shader | NodeAgentc, Inc. | https://github.com/nodemode-dev/formcut/blob/5d9aa626d4a7120506660957a7d1e37b7f25a70b/examples/pulse.wgsl | Apache-2.0 | none |

## Thumbnails made for the demo

`media-src/thumbs/formencoder-*.webp` are the eight looks applied to the photographs above (cool: Lac du Lou; teal and orange: Stormy sunset; bleach bypass: Coffee drinking; high contrast: Bike on a snowy street; faded: Sweet Pepper Market; mono: Woman in a headwrap; neutral: Assam tea; warm: Trajan's Market), graded with the .cube by trilinear interpolation, cropped to 640 by at most 425 px. `formvfx-text-animators.webp` and `formcut-pulse.webp` are tiles drawn for the demo from the Form apps' own icons (Apache-2.0) and Space Grotesk (OFL-1.1).

## Fonts (SIL Open Font Licence 1.1)

The twelve families FormPortal ships in `frontend/public/store/fonts/`, unchanged, each with its OFL.txt there. Gzipped into `assets/store.js`; their SHA-256 is checked against `core/data/store-fonts.json` on every install.

| Family | Foundry | Source |
| --- | --- | --- |
| Inter | Rasmus Andersson | https://github.com/google/fonts/tree/main/ofl/inter |
| Manrope | Mikhail Sharanda | https://github.com/google/fonts/tree/main/ofl/manrope |
| DM Sans | Colophon Foundry | https://github.com/google/fonts/tree/main/ofl/dmsans |
| Space Grotesk | Florian Karsten | https://github.com/google/fonts/tree/main/ofl/spacegrotesk |
| Bricolage Grotesque | Mathieu Triay | https://github.com/google/fonts/tree/main/ofl/bricolagegrotesque |
| Syne | Bonjour Monde | https://github.com/google/fonts/tree/main/ofl/syne |
| Fraunces | Undercase Type | https://github.com/google/fonts/tree/main/ofl/fraunces |
| Lora | Cyreal | https://github.com/google/fonts/tree/main/ofl/lora |
| Instrument Serif | Instrument | https://github.com/google/fonts/tree/main/ofl/instrumentserif |
| JetBrains Mono | JetBrains | https://github.com/google/fonts/tree/main/ofl/jetbrainsmono |
| IBM Plex Mono | IBM | https://github.com/google/fonts/tree/main/ofl/ibmplexmono |
| Caveat | Impallari Type | https://github.com/google/fonts/tree/main/ofl/caveat |

## Interface assets

App icons (`apps/`), favicons and the Inter interface face (`fonts/`, OFL-1.1) are the repository's own files, copied by the build as in demo 1.
