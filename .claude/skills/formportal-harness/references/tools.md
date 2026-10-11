# FormPortal MCP tools

Generated from the FormPortal MCP server by `./formportal agents sync`; do not edit by hand.

| Tool | Changes the computer | What it does |
| --- | --- | --- |
| `status` | no | FormPortal's version, this computer's platform, the install folder, the catalogue source and everything installed. Call first. |
| `apps` | no | Every app in the Form family registry (name, what it replaces, group, development status) with, per channel, what the catalogue offers this computer and what is installed. Works offline from the registry when the catalogue cannot be read, and says why. |
| `app_info` | no | The registry entry and the catalogue's releases for one product: versions per channel, artifacts with size, SHA-256 and minimum OS, and release notes. |
| `installs` | no | What FormPortal has installed: product, channel, current version with path and SHA-256, the previous version kept for rollback, and the process ids of any copy that is open. |
| `install` | yes | Downloads the release the catalogue offers this computer for the product and channel, verifies its SHA-256, unpacks it per user (no administrator) and keeps the version it replaces for rollback. Installing the newer version over an older one is how an update is done. If the app is open, the new version goes into its own folder, the open copy keeps running untouched, and the result's note says the new version opens next time; reinstalling the exact version that is open is refused. Changes the person's computer: confirm first. |
| `updates` | no | Every installed app and channel with a newer version in the catalogue: from and to versions, download size, release notes, whether a copy is open, and whether the person's preferences would update it automatically. Also says when a newer FormPortal is available. |
| `update` | yes | With product (and channel), installs that app's newer version. Without product, installs every waiting update; with automatic_only, only those the person's preferences allow (skipping open apps when only_when_closed is on). An open app keeps running and the new version opens next time. Changes the person's computer: confirm first. |
| `preferences` | yes | Reads FormPortal's update preferences, or changes the ones given: auto_update (all apps, default on, applied while FormPortal is open), auto_update_beta (default off), only_when_closed (default on), notices (default on), per_app (an object of product id to true, false, or null to follow the global setting). Changing them is the person's choice: confirm first. |
| `open` | yes | Starts the installed app for the product and channel and returns its process id. |
| `rollback` | yes, destructive | Swaps the installed version for the previous one FormPortal kept. Fails when no previous version is kept. Confirm first. |
| `remove` | yes, destructive | Uninstalls the product's channel and deletes its install folder, including the kept previous version. The app's own documents elsewhere are not touched. Refused while the app is open. Confirm first. |

## Parameters

### status

No parameters.

### apps

- `allow_unsigned` (optional): boolean. Accept a catalogue without a signature. Only for local development catalogues.
- `source` (optional): string. Catalogue address (https) or a local catalogue file. Defaults to FORMPORTAL_CATALOG or https://formai.dev/catalog/v1/apps.json.

### app_info

- `allow_unsigned` (optional): boolean. Accept a catalogue without a signature. Only for local development catalogues.
- `product`: string. Product id from apps, e.g. formcut, formvis, formencoder.
- `source` (optional): string. Catalogue address (https) or a local catalogue file. Defaults to FORMPORTAL_CATALOG or https://formai.dev/catalog/v1/apps.json.

### installs

No parameters.

### install

- `allow_unsigned` (optional): boolean. Accept a catalogue without a signature. Only for local development catalogues.
- `channel` (optional): stable|beta|nightly. Defaults to stable. A beta installs beside the stable build.
- `product`: string. Product id from apps, e.g. formcut, formvis, formencoder.
- `source` (optional): string. Catalogue address (https) or a local catalogue file. Defaults to FORMPORTAL_CATALOG or https://formai.dev/catalog/v1/apps.json.

### updates

- `allow_unsigned` (optional): boolean. Accept a catalogue without a signature. Only for local development catalogues.
- `source` (optional): string. Catalogue address (https) or a local catalogue file. Defaults to FORMPORTAL_CATALOG or https://formai.dev/catalog/v1/apps.json.

### update

- `allow_unsigned` (optional): boolean. Accept a catalogue without a signature. Only for local development catalogues.
- `automatic_only` (optional): boolean. Only the updates the preferences allow.
- `channel` (optional): stable|beta|nightly. Defaults to stable. A beta installs beside the stable build.
- `product` (optional): string. Product id from apps, e.g. formcut, formvis, formencoder.
- `source` (optional): string. Catalogue address (https) or a local catalogue file. Defaults to FORMPORTAL_CATALOG or https://formai.dev/catalog/v1/apps.json.

### preferences

- `auto_update` (optional): boolean. 
- `auto_update_beta` (optional): boolean. 
- `notices` (optional): boolean. 
- `only_when_closed` (optional): boolean. 
- `per_app` (optional): object. 

### open

- `channel` (optional): stable|beta|nightly. Defaults to stable. A beta installs beside the stable build.
- `product`: string. Product id from apps, e.g. formcut, formvis, formencoder.

### rollback

- `channel` (optional): stable|beta|nightly. Defaults to stable. A beta installs beside the stable build.
- `product`: string. Product id from apps, e.g. formcut, formvis, formencoder.

### remove

- `channel` (optional): stable|beta|nightly. Defaults to stable. A beta installs beside the stable build.
- `product`: string. Product id from apps, e.g. formcut, formvis, formencoder.

## Shell equivalents

`./formportal cli status`, `apps [--source S]`, `info [product]`, `installs`, `install [product] [--channel C] [--source S] [--allow-unsigned]`, `open [product]`, `rollback [product]`, `remove [product]`. Output is the same JSON the tools return.
