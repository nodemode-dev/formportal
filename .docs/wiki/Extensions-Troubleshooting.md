# Extensions Troubleshooting

An extension is a `.formpkg` file: a zip with `manifest.json` at its root, checked against the signed extension index. FormPortal says why whenever it refuses one. This page explains each message and what to do.

## Where extensions come from

Extensions come from form.ext-registry (`nodemode-dev/form.ext-registry`), the one source of officially registered Form extensions. Each extension is reviewed in the registry by pull request, built there, and signed by its publisher; the registry publishes a signed index and a signed block list as release files:

- `https://github.com/nodemode-dev/form.ext-registry/releases/download/index/extensions.json` and `.sig`
- `https://github.com/nodemode-dev/form.ext-registry/releases/download/index/blocklist.json` and `.sig`
- each package at `.../releases/download/ext-<id>-v<version>/<id>-<version>.formpkg`

FormPortal checks the index and the block list with registry keys only: the keys compiled from `core/registry_keys.txt`, plus `FORMEXT_REGISTRY_PUBKEY` (comma-separated, for testing). The app catalogue's keys (`core/catalog_keys.txt`) never verify extensions, and registry keys never verify the app catalogue. Every package from the index must carry its publisher's Ed25519 signature, checked with the publisher key the signed index lists. Each listed extension shows Verified (reviewed and published by the registry) and, in its details, Source in form.ext-registry, the folder it was built from.

The block list names extensions, or single versions, that must not run. A blocked one cannot be installed; one that is already installed is turned off the next time FormPortal reads the index (its `enabled.json` entry goes away, so the app drops it while it runs), with a notice naming the reason, and it cannot be turned back on while it is blocked. When the block is lifted it stays off until you turn it on; installing a newer version that is not blocked turns it on again.

`FORMPORTAL_EXTENSIONS` (or `--extensions-source` on the command line) points FormPortal at another index, such as a test index or an organisation's mirror. When that address ends in `index/extensions.json`, package addresses on the registry's release downloads are read from the same mirror, still checked by SHA-256 and publisher signature.

## Opening a .formpkg does nothing

- **The file is not associated with FormPortal.** The installed FormPortal registers `.formpkg` (the `application/x-formpkg` type) through its installer. If another program took it over, choose Open with, FormPortal, and make it the default. On Linux, `xdg-mime query default application/x-formpkg` shows which program has it, and `xdg-mime default` with FormPortal's desktop entry gives it back.
- **FormPortal was moved or reinstalled.** Reinstall FormPortal so the association points at the current copy.
- **Install it without the association.** Run `formportal cli extension-install --path FILE.formpkg`, which gives the same checks and the same messages.

## Messages and what they mean

| Message | Meaning | What to do |
| --- | --- | --- |
| the package has no manifest.json at its root | not a Form package, or zipped inside a folder | ask the developer for a proper package |
| its manifest.json is not valid / is not a formai package | the manifest is broken or for something else | the same |
| its manifest names an id or product that is not a plain name | a name with paths or odd characters, refused for safety | the same |
| the package names a publisher that the index does not list | the publisher is unknown to the signed index | install only if you trust the source, with the developer setting (Preferences, Catalogue, Developer) |
| the package's signature does not match the publisher's key | the file was changed after it was signed, or signed by someone else | do not install it; download it again from the publisher |
| the package's signature uses something other than ed25519 | an unsupported signature | ask the developer to sign with Ed25519 |
| it needs extension API 2; this FormCut offers API 1 (or the API and app it names) | its manifest asks for an extension API other than 1 | update FormPortal and the app, or ask the developer for an API 1 build |
| native extensions are not supported by FormCut (or the app it is for) | the package runs native code, which API 1 apps do not load | ask the developer for a build that runs in the app's sandbox |
| the package's manifest says ... the index says ... | the file and the index disagree on version or product | download the package the index lists, or ask the developer |
| the manifest and the index disagree on whether it runs native code | the same | the same |
| the extension index was refused: this build trusts no registry key yet | this FormPortal has no registry key compiled in yet (the registry is in testing) | wait for a FormPortal release with the registry key; developers can turn on the developer setting (Preferences, Catalogue, Developer) or set `FORMEXT_REGISTRY_PUBKEY` |
| the extension index was refused: its signature does not match a key this build trusts | the index or block list was changed after it was signed, or signed with another key | do not work around it; report it to the registry's owners |
| the extension index was refused: it is not signed | the index has no signature | check `FORMPORTAL_EXTENSIONS` if you set one |
| the block list was refused: ... | the block list's signature failed, so the whole index is refused | the same as for the index |
| the registry is private or unreachable: ... answered 404 | form.ext-registry is private while it is tested (GitHub answers 404 without a token), or the network is down | nothing to fix on this computer; the list returns once the registry is public or reachable. FormPortal keeps the last good copy and uses it while offline |
| ... is on form.ext-registry's block list: (reason) | the registry blocked this extension or version | do not install it; wait for a fixed version |
| ... stays off: it is on form.ext-registry's block list | you tried to turn on a blocked extension | the same |
| ... carries no publisher signature; only the developer setting installs it | an index entry without a publisher signature | install only for development, with the developer setting |
| (your organisation) does not allow extensions / extensions installed from a file | a policy on a managed computer | ask whoever manages the computer (Preferences, About shows who) |

## After installing

FormPortal writes `extensions/<app>/enabled.json` in its folder, and each app that hosts extensions (FormVis 2.1.0, FormCut 2.14.0, FormWav 2.24.0, FormPDF 0.59.0, FormDeck 0.32.0, FormLit 0.50.0, form.md 0.50.0, FormEncoder 0.7.0, FormVFX 0.54.0, FormMCP 0.9.0, FormTray 0.15.0, FormSkills 0.9.0 and newer) watches that file and picks up an install, a removal or a switch while it runs; the notice says "ready in" the app and offers to open it. An older copy of an app uses the change from its next start. Turning an extension off in Extensions keeps it installed but unused; Remove deletes it. The first time an extension opens, the app asks you to allow what it uses.

Each app's own Extensions menu has Manage in FormPortal, which opens this page filtered to that app (`formai://extensions?product=formcut`). A `formai://extensions?install=/full/path/to/file.formpkg` link, and opening a `.formpkg` from form.ext, go through the same checks as opening the file. Make an extension opens form.ext when it is installed, or its page on formai.studio.

Some extensions show Support the maker in their details: it opens the maker's own page (sponsoring, a tip jar) in your browser. FormPortal takes no payment, and the extension works the same whether you use it or not. Makers add it with the `support` field (an https address) in their registry entry.

## Still stuck

Preferences, About, Check and repair finds leftovers from interrupted installs. Then use Report a problem or Ask the community from Learn.
