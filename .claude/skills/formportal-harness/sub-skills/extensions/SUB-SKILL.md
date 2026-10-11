---
name: extensions
description: Extensions for the Form apps through FormPortal. Use when the person wants an effect, look, LUT, template, preset, theme, script or plugin found, installed, updated, turned off or removed; double-clicked or was sent a .formpkg file; asks what an extension can use or whether it is signed; or when extensions, extension_install, extension_remove or extension_enable fail.
---

# extensions

## What an extension is

A `.formpkg` package (a zip with `manifest.json`) for one app: its id, kind (effect-stack, lut, preset, script-plugin, native-plugin and the rest), version, author, licence, whether it runs native code, and the permissions it asks for (document, files-read, files-write, network, models, native-code). FormPortal checks and unpacks it into its own folder and lists it for the app in `extensions/[product]/enabled.json`; the app loads it the next time it starts.

## The loop

1. `extensions`: the open index with each package's install state, plus everything installed. If it reports `index_error`, read it (an unsigned index is refused unless the person allows unsigned catalogues for development).
2. Before installing, tell the person what the package is for, who made it, and the permissions it asks for, in words ("the open document, the network"). Native code deserves a sentence of its own.
3. `extension_install {id}`, or `{path}` for a file the person has. Every package is checked against the index's SHA-256, its publisher signature when it has one, and its manifest against the index. A package that runs native code must be signed by a publisher the index lists; only the developer setting (`allow_unsigned`) installs one that is not.
4. `extension_enable {product, id, enabled}` turns one off without removing it; `extension_remove {product, id}` removes it.
5. Say that the app picks the change up the next time it starts.

## Sideloaded packages

A file installed by path that the index does not list is recorded with `source: sideload` and shown as such. Treat it as unreviewed: say so, and never install a sideloaded native package without the person turning the developer setting on themselves.

## When it fails

The refusals name the reason ("the package's signature does not match ...'s key", "its manifest says ... the index says ...", "runs native code and is not signed"). Report the sentence; do not retry from another source.
