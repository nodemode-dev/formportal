# Extensions Troubleshooting

An extension is a `.formpkg` file: a zip with `manifest.json` at its root, checked against the signed extension index (`extensions.json` beside the catalogue). FormPortal says why whenever it refuses one. This page explains each message and what to do.

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
| runs native code and is not signed; only the developer setting installs it | native code needs a signature unless you are developing it | sign it, or turn on the developer setting while you develop |
| the package's manifest says ... the index says ... | the file and the index disagree on version or product | download the package the index lists, or ask the developer |
| the manifest and the index disagree on whether it runs native code | the same | the same |
| the extension index was refused: it is not signed | the index has no signature | check the catalogue address in Preferences, Catalogue |
| (your organisation) does not allow extensions / extensions installed from a file | a policy on a managed computer | ask whoever manages the computer (Preferences, About shows who) |

## After installing

An app uses its extensions from its next start: close and reopen the app. Turning an extension off in Extensions keeps it installed but unused; Remove deletes it.

Some extensions show Support the maker in their details: it opens the maker's own page (sponsoring, a tip jar) in your browser. FormPortal takes no payment, and the extension works the same whether you use it or not. Makers add it with the `support` field (an https address) in the extensions index.

## Still stuck

Preferences, About, Check and repair finds leftovers from interrupted installs. Then use Report a problem or Ask the community from Learn.
