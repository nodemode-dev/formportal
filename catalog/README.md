# catalog

The one contract the site, the hub and any fork agree on. The site publishes these documents; the hub reads them; neither shares code with the other.

| File | What it is |
| --- | --- |
| `schema/apps.schema.json` | The app catalogue: each product, its state, and per channel its version and artifacts with size and SHA-256 |
| `schema/extensions.schema.json` | The extension index: packages by product and kind, each with a SHA-256, declared permissions and an optional publisher signature |
| `schema/package.schema.json` | The manifest inside a `.formpkg`, a zip the apps install through their own loaders |
| `fixtures/apps.json` | A sample catalogue for development. formcut is live with a stable and a beta, formvis is public with no release, formwav and the hub are prelaunch |
| `fixtures/extensions.json` | A sample index |
| `products.json` | The family registry: each product's id, name, kind, summary, identifier, repository, licence and project file. The site reads it to know which repositories to ask about. A new product is declared here |
| `schema/products.schema.json` | The registry's shape |

Field names are snake_case, following formcut's release `manifest.json` (`minimum_os`, `sha256`, `bytes`), because formcut's release shape is the template for the family.

Fixture hashes are the SHA-256 of each file name, not of a real file, and fixture documents carry `"fixture": true` so nothing mistakes them for a release.

A native package must carry a signature (`native: true` requires `signature`). Unsigned packages are for testing and install only with the hub's developer setting on.
