# Stock and Templates

FormPortal offers open-licensed images, video, audio and Form app templates, saves them to the person's Library with their credit line, and starts projects from templates. No account, no paid stock, no generative AI.

## The index

`media.json` sits beside the catalogue (in the same folder as `apps.json`, so `https://dl.formai.studio/catalog/media.json` once published there, or `FORMPORTAL_MEDIA`) with a detached Ed25519 signature `media.json.sig`, made with the catalogue's key. When an organisation locks the catalogue, the media index follows it.
```json
{
  "format": "formai-media",
  "format_version": 1,
  "generated": "2026-10-12T00:00:00Z",
  "items": [
    {
      "id": "social-cut",
      "title": "Social cut 9:16",
      "kind": "template",
      "product": "formcut",
      "creator": "Form",
      "creator_url": "https://...",
      "licence": "CC0-1.0",
      "source_url": "https://...",
      "file": "social-cut.fc",
      "url": "https://...",
      "bytes": 48000,
      "sha256": "...",
      "thumbnail": "https://...",
      "tags": ["vertical", "social"]
    }
  ]
}
```

`kind` is `image`, `video`, `audio` or `template`; a template names the `product` that opens it. `licence` must be `CC0-1.0`, `CC-BY-4.0`, `CC-BY-SA-4.0`, `Apache-2.0`, `MIT` or `OFL-1.1`; anything else is listed but not saved. `thumbnail` is optional; the interface shows PNG, JPEG or WebP thumbnails up to 512 KB as data URLs, since its content security policy loads no remote images.

## The Library

Saved items go to `Documents/Form/Library` (or `FORMPORTAL_LIBRARY`). Beside each file is `<file>.credit.txt`, and `credits.json` lists every saved item with its licence, source and credit line:

- CC0: `Title by Creator, public domain (CC0 1.0), source`
- Others: `Title by Creator, licensed CC-BY-4.0, source`

Using a template copies it into the first projects folder from Files (a second copy gets a number) and opens it in its app when that app is installed. Removing a saved item deletes the Library copy and its credit file, never the copies in projects folders.

## Where to reach it

- Interface: Stock & templates in the sidebar.
- Command line: `formportal media`, `media-save ID`, `template-use ID [--folder DIR]`, `media-remove ID`.
- MCP: `media`, `media_save`, `media_remove`.
