# Fonts

FormPortal installs open-licensed fonts for the person using it, and their own font files, with no administrator and no account.

## The index

`fonts.json` sits beside the catalogue (`https://formai.dev/catalog/v1/fonts.json`, or `FORMPORTAL_FONTS`) with a detached Ed25519 signature `fonts.json.sig`, made with the catalogue's key. formai.dev does not publish it yet; that is part of Phase 9 on formai_dev's side.

```json
{
  "format": "formai-fonts",
  "format_version": 1,
  "generated": "2026-10-12T00:00:00Z",
  "families": [
    {
      "id": "inter",
      "family": "Inter",
      "foundry": "Rasmus Andersson",
      "licence": "OFL-1.1",
      "category": "sans-serif",
      "styles": [
        { "style": "Regular", "weight": 400, "italic": false, "file": "Inter-Regular.ttf", "url": "https://...", "bytes": 300000, "sha256": "..." }
      ]
    }
  ]
}
```

`licence` must be `OFL-1.1`, `Apache-2.0` or `MIT`; anything else is listed but refused. `category` is one of `sans-serif`, `serif`, `monospace`, `display`.

## Where fonts go

| System | Folder | Then |
| --- | --- | --- |
| Linux | `~/.local/share/fonts/FormPortal` | `fc-cache -f` on that folder |
| macOS | `~/Library/Fonts` (files named `FormPortal-...`) | picked up by the system |
| Windows | `%LOCALAPPDATA%\Microsoft\Windows\Fonts` | a value under `HKCU\Software\Microsoft\Windows NT\CurrentVersion\Fonts` |

FormPortal records what it installed in `fonts.json` in its own folder and removes only those files. `FORMPORTAL_FONTS_DIR` sends fonts to another folder for testing and skips the system steps.

## Your own fonts

Fonts > Add a font file (or `font-add FILE --rights-confirmed true`). The person confirms they have the right to use the font on this computer; FormPortal checks that it is a TrueType or OpenType file (WOFF is refused), copies it into the same folder, and lists it under Your own fonts.
