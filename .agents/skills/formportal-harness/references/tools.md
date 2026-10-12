# FormPortal MCP tools

Generated from the FormPortal MCP server by `./formportal agents sync`; do not edit by hand.

## Contents

- The tool table, below
- Parameters, one heading per tool
- Shell equivalents, including `policy` and the command-line-only `mirror`

## Tools

| Tool | Changes the computer | What it does |
| --- | --- | --- |
| `status` | no | FormPortal's version, this computer's platform, the install folder, the catalogue source and everything installed. Call first. |
| `apps` | no | Every app in the Form family registry (name, what it replaces, group, development status) with, per channel, what the catalogue offers this computer and what is installed. Works offline from the registry when the catalogue cannot be read, and says why. |
| `app_info` | no | The registry entry and the catalogue's releases for one product: versions per channel, artifacts with size, SHA-256 and minimum OS, and release notes. |
| `installs` | no | What FormPortal has installed: product, channel, current version with path and SHA-256, the previous version kept for rollback, and the process ids of any copy that is open. |
| `install` | yes | Downloads the release the catalogue offers this computer for the product and channel, verifies its SHA-256, unpacks it per user (no administrator) and keeps the version it replaces for rollback. Installing the newer version over an older one is how an update is done. If the app is open, the new version goes into its own folder, the open copy keeps running untouched, and the result's note says the new version opens next time; reinstalling the exact version that is open is refused. Changes the person's computer: confirm first. |
| `versions` | no | Every version of a product's channel the catalogue offers, newest first (the latest and its history), with date, release notes, size and whether there is a file for this computer, plus what is installed and kept for rollback. Install one with install and version. |
| `updates` | no | Every installed app and channel with a newer version in the catalogue: from and to versions, download size, release notes, whether a copy is open, and whether the person's preferences would update it automatically. Also says when a newer FormPortal is available. |
| `update` | yes | With product (and channel), installs that app's newer version. Without product, installs every waiting update; with automatic_only, only those the person's preferences allow (skipping open apps when only_when_closed is on). An open app keeps running and the new version opens next time. Changes the person's computer: confirm first. |
| `preferences` | yes | Reads FormPortal's update preferences, or changes the ones given: auto_update (all apps, default on, applied while FormPortal is open), auto_update_beta (default off), only_when_closed (default on), notices (default on), keep_previous (default on: keep the replaced version for rollback; off deletes it after each update), per_app (an object of product id to true, false, or null to follow the global setting). Changing them is the person's choice: confirm first. |
| `extensions` | no | The open extension index (effects, looks, templates, presets, plugins for the Form apps) with each package's author, kind, permissions, whether it runs native code and is signed, and its install state; plus every installed extension, including sideloaded ones (source sideload). The index is read from extensions_source, FORMPORTAL_EXTENSIONS, or extensions.json beside the catalogue. |
| `extension_install` | yes | Installs a package from the index by id (download, SHA-256 check, publisher signature check, manifest check against the index), or a local .formpkg file by path (sideloaded and labelled so unless the index lists the same file). A package that runs native code must be signed unless allow_unsigned is set for development. The app picks it up the next time it starts. Changes the person's computer: confirm first, and name the permissions it asks for. |
| `extension_remove` | yes, destructive | Removes an installed extension and its files. Confirm first. |
| `extension_enable` | yes | Turns an installed extension on or off without removing it; the app sees the change the next time it starts. |
| `policy` | no | Whether an organisation manages FormPortal on this computer, and what its policy fixes: the catalogue address and extra catalogue keys, whether unsigned catalogues are refused, update settings that cannot be changed (locked), which apps and channels may be installed, and whether extensions and sideloaded packages are allowed. Read it before suggesting a change a policy would refuse. The policy is a system file (/etc/formportal/policy.json, /Library/Application Support/FormPortal/policy.json or %ProgramData%\FormPortal\policy.json) set by the organisation; FORMPORTAL_POLICY is read only for testing when no system file exists. |
| `files` | yes | The person's Form project files (by each app's project extensions, e.g. .fc for FormCut) in the folders they gave FormPortal, newest first, with the app that opens each, size, date and how many earlier versions FormPortal keeps; plus each folder's file count and size. query filters by name or app. Reading also keeps a version of any file that changed since the last one, in folders where versions are on. Local only: nothing leaves the computer. |
| `folders` | yes | Lists the folders FormPortal looks in; with action add and a path (the suggested folder if none), adds one (create true makes it), keep_versions on by default; with action remove, stops listing one without touching its files. Changing them is the person's choice: confirm first. |
| `open_file` | yes | Opens a project file with the installed Form app that makes it (by extension), stable first, then beta. Says which app to install if none is. |
| `file_versions` | yes | The versions FormPortal kept of a project file in one of its folders, newest first (id, time, size, SHA-256, why it was kept). action save keeps one now; action revert with version puts that version back after keeping the current file as a version too, so nothing is lost. Reverting changes the person's file: confirm first. |
| `storage` | no | What FormPortal uses on disk (installed apps, downloads, extensions, kept file versions, the catalogue copy) and the size of each projects folder. |
| `fonts` | no | The open font index (families with foundry, licence, category and styles, each marked installed or not) read from fonts.json beside the catalogue (or fonts_source, FORMPORTAL_FONTS), signed like the catalogue; plus every font FormPortal installed, from the index or the person's own files, and the per-user font folder. query filters by family, foundry or category. |
| `font_install` | yes | With id (and optionally style), downloads that family or style from the index, checks each file's SHA-256 and that it is a TrueType or OpenType font, refuses anything not under OFL-1.1, Apache-2.0 or MIT, and installs it for this user only (no administrator). With path, adds the person's own TTF or OTF file instead; rights_confirmed must be true, meaning the person said they have the right to use it. Apps see new fonts after they restart. Confirm first. |
| `font_remove` | yes, destructive | Removes a font FormPortal installed (a whole family, or one style), from the per-user font folder. Never touches fonts it did not install. Confirm first. |
| `media` | no | The open media index (media.json beside the catalogue, or media_source or FORMPORTAL_MEDIA, signed like the catalogue): images, video, audio and Form app templates, each with creator, licence (CC0, CC BY, CC BY-SA, Apache, MIT, OFL), source page, credit line and whether it is saved; plus everything saved in the person's Library. query and kind filter. |
| `media_save` | yes | Saves an item from the media index into the person's Library (Documents/Form/Library by default, or FORMPORTAL_LIBRARY), checking its SHA-256 and writing its credit line beside it and into credits.json. With use true on a template, also copies it into the first projects folder (or folder) and opens it in its app. Confirm first. |
| `media_remove` | yes, destructive | Removes an item FormPortal saved into the Library, with its credit file. Copies of templates already in projects folders are not touched. Confirm first. |
| `learn` | no | Tutorials: FormPortal's own six (installing, betas, going back, files, fonts and stock, agents) plus the Form apps' tutorials from the signed tutorial index (learn.json beside the catalogue, or learn_source or FORMPORTAL_LEARN). Each has its steps (some name the FormPortal screen they happen on), minutes, level, and the steps this person has finished (numbered from 1), kept on this computer only. product and query filter. |
| `learn_progress` | yes | Marks a tutorial step finished (done true, the default) or not (done false), steps numbered from 1; or with reset true clears the tutorial's progress. Progress is kept on this computer only. |
| `app_agents` | no | Whether an installed Form app ships its own MCP server (declared in the app's form-app.json), the server name FormPortal uses for it (the product id, with -beta for a beta), and for Claude Code, Codex and Cursor whether it is connected, not connected, taken by another server of the same name, or the client is not installed. |
| `connect_agents` | yes | Adds the installed app's MCP server to the clients given (claude, codex, cursor; all three by default) at user scope, or with disconnect true takes it out. The entry starts FormPortal's app-mcp, which runs whichever version is installed, so updates and rollbacks need no change. Never overwrites a server of the same name that FormPortal did not add; backs up each config file it changes. Changes the person's agent configuration: confirm first. |
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
- `version` (optional): string. An earlier version from the versions tool. Omit for the newest.

### versions

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
- `keep_previous` (optional): boolean. 
- `notices` (optional): boolean. 
- `only_when_closed` (optional): boolean. 
- `per_app` (optional): object. 

### extensions

- `allow_unsigned` (optional): boolean. Accept a catalogue without a signature. Only for local development catalogues.
- `extensions_source` (optional): string. Extension index address or file.
- `source` (optional): string. Catalogue address (https) or a local catalogue file. Defaults to FORMPORTAL_CATALOG or https://formai.dev/catalog/v1/apps.json.

### extension_install

- `allow_unsigned` (optional): boolean. Accept a catalogue without a signature. Only for local development catalogues.
- `extensions_source` (optional): string. 
- `id` (optional): string. 
- `path` (optional): string. Absolute path of a .formpkg file.
- `source` (optional): string. Catalogue address (https) or a local catalogue file. Defaults to FORMPORTAL_CATALOG or https://formai.dev/catalog/v1/apps.json.

### extension_remove

- `id`: string. 
- `product`: string. 

### extension_enable

- `enabled`: boolean. 
- `id`: string. 
- `product`: string. 

### policy

No parameters.

### files

- `limit` (optional): integer. At most this many files (default 200).
- `query` (optional): string. 

### folders

- `action` (optional): list|add|remove. 
- `create` (optional): boolean. 
- `keep_versions` (optional): boolean. 
- `path` (optional): string. 

### open_file

- `path`: string. 

### file_versions

- `action` (optional): list|save|revert. 
- `path`: string. 
- `version` (optional): string. 

### storage

No parameters.

### fonts

- `allow_unsigned` (optional): boolean. Accept a catalogue without a signature. Only for local development catalogues.
- `fonts_source` (optional): string. 
- `query` (optional): string. 
- `source` (optional): string. Catalogue address (https) or a local catalogue file. Defaults to FORMPORTAL_CATALOG or https://formai.dev/catalog/v1/apps.json.

### font_install

- `allow_unsigned` (optional): boolean. Accept a catalogue without a signature. Only for local development catalogues.
- `fonts_source` (optional): string. 
- `id` (optional): string. 
- `path` (optional): string. 
- `rights_confirmed` (optional): boolean. 
- `source` (optional): string. Catalogue address (https) or a local catalogue file. Defaults to FORMPORTAL_CATALOG or https://formai.dev/catalog/v1/apps.json.
- `style` (optional): string. 

### font_remove

- `family`: string. 
- `style` (optional): string. 

### media

- `allow_unsigned` (optional): boolean. Accept a catalogue without a signature. Only for local development catalogues.
- `kind` (optional): image|video|audio|template. 
- `media_source` (optional): string. 
- `query` (optional): string. 
- `source` (optional): string. Catalogue address (https) or a local catalogue file. Defaults to FORMPORTAL_CATALOG or https://formai.dev/catalog/v1/apps.json.

### media_save

- `allow_unsigned` (optional): boolean. Accept a catalogue without a signature. Only for local development catalogues.
- `folder` (optional): string. 
- `id`: string. 
- `media_source` (optional): string. 
- `source` (optional): string. Catalogue address (https) or a local catalogue file. Defaults to FORMPORTAL_CATALOG or https://formai.dev/catalog/v1/apps.json.
- `use` (optional): boolean. 

### media_remove

- `id`: string. 

### learn

- `allow_unsigned` (optional): boolean. Accept a catalogue without a signature. Only for local development catalogues.
- `learn_source` (optional): string. 
- `product` (optional): string. 
- `query` (optional): string. 
- `source` (optional): string. Catalogue address (https) or a local catalogue file. Defaults to FORMPORTAL_CATALOG or https://formai.dev/catalog/v1/apps.json.

### learn_progress

- `allow_unsigned` (optional): boolean. Accept a catalogue without a signature. Only for local development catalogues.
- `done` (optional): boolean. 
- `id`: string. 
- `learn_source` (optional): string. 
- `reset` (optional): boolean. 
- `source` (optional): string. Catalogue address (https) or a local catalogue file. Defaults to FORMPORTAL_CATALOG or https://formai.dev/catalog/v1/apps.json.
- `step` (optional): integer. 

### app_agents

- `channel` (optional): stable|beta|nightly. Defaults to stable. A beta installs beside the stable build.
- `product`: string. Product id from apps, e.g. formcut, formvis, formencoder.

### connect_agents

- `channel` (optional): stable|beta|nightly. Defaults to stable. A beta installs beside the stable build.
- `clients` (optional): array. 
- `disconnect` (optional): boolean. Take the app out of the clients instead.
- `product`: string. Product id from apps, e.g. formcut, formvis, formencoder.

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

`./formportal cli status`, `apps [--source S]`, `info [product]`, `installs`, `install [product] [--channel C] [--source S] [--allow-unsigned]`, `open [product]`, `rollback [product]`, `remove [product]`, `policy`. Output is the same JSON the tools return. `mirror --to DIR --base-url URL` exists only on the command line (see sub-skills/organisations).
