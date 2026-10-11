# FormPortal concepts

Read once per session.

## Ids and names

Product ids are lowercase and come from the registry (`apps`): `formcut`, `formvis`, `formlit`, `formdesign`, `formpath`, `formvfx`, `formencoder`, `formwav`, `formmd` (Form.md), `formdam`, `formslide`, `formhub`, `formsurface`, `formsim`, `formui`, `formweb`, `formmcp`, `formskill`, `formapp`, and `formai` (FormPortal itself, the id formai.dev's catalogue uses). Display names keep the owner's spelling: FormCut, Form.md.

## Channels

`stable` (default), `beta`, `nightly`. Each channel of a product is a separate install with its own folder, so a beta never replaces the stable build. Whether a product has a beta is the catalogue's answer, not a guess.

## Where installs live

| System | Folder |
| --- | --- |
| macOS | `~/Library/Application Support/dev.formai.portal` |
| Windows | `%LOCALAPPDATA%\FormPortal` |
| Linux | `$XDG_DATA_HOME/formportal` (usually `~/.local/share/formportal`) |

Inside: `apps/[product]/[channel]/[version]/`, `downloads/`, `catalog/apps.json` (the last good catalogue, with its signature) and `installed.json` (the record `installs` reads). `FORMPORTAL_ROOT` moves all of it; use a scratch folder for experiments.

## Trust

- The catalogue must carry a detached Ed25519 signature (`apps.json.sig`) made with a key FormPortal trusts. Without one it is refused with "it is not signed". `allow_unsigned` (or `FORMPORTAL_ALLOW_UNSIGNED=1`) accepts an unsigned catalogue; it exists for local development catalogues only.
- Every artifact is hashed after download and refused unless its SHA-256 equals the catalogue's. Nothing is unpacked before that.
- Only https addresses are fetched, plus http on this computer (127.0.0.1, localhost).
- When the network fails, the last good catalogue is used and says so.

## Errors, in FormPortal's words

| Message starts with | Meaning | Do |
| --- | --- | --- |
| the catalogue was refused: it is not signed | no signature next to the catalogue | wrong source, or a development catalogue; ask before using `allow_unsigned` |
| the catalogue was refused: this build trusts no catalogue key yet | `core/catalog_keys.txt` was empty when this build was made and `FORMAI_CATALOG_PUBKEY` is not set (`status` shows `trusted_keys`) | tell the person; the fix is formai.dev's public key added to that file and FormPortal rebuilt, or the key in `FORMAI_CATALOG_PUBKEY` |
| the catalogue was refused | the signature does not verify | stop; report it |
| [file] does not match the catalogue: expected SHA-256 | the download differs from the release | stop; report it; do not retry from elsewhere |
| the catalogue offers this computer nothing for | unreleased, no release on that channel, or no file for this system | read `apps` for which one, and the registry status |
| refused address | not https and not this computer | use the https address |
| this build cannot install a [kind] file yet | the release is a dmg, msi, deb or similar FormPortal does not unpack yet | tell the person; the app's own download page on formai.dev has it |
| [app] is open (process ...); close it first | remove, or reinstalling the version that is running | ask the person to close the app; never end the process yourself |
| ... It was not installed (an extension) | a package's signature, manifest or native-code rule failed | report the sentence; see `sub-skills/extensions/SUB-SKILL.md` |
| no product was given, or there is no channel | a parameter is missing or wrong | fix the call from `apps` |
| a file could not be read or written | disk or permission problem in the install folder | report the path |

## Environment variables

| Variable | Effect |
| --- | --- |
| `FORMPORTAL_ROOT` | install folder |
| `FORMPORTAL_CATALOG` | default catalogue source (https address or local file) |
| `FORMPORTAL_ALLOW_UNSIGNED` | `1` accepts unsigned catalogues |
| `FORMAI_CATALOG_PUBKEY` | an extra trusted catalogue key (base64), for a fork that signs its own catalogue |
