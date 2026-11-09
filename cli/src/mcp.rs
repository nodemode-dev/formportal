use std::io::{self, BufRead, Write};

use serde_json::{json, Value};

use crate::ops::{self, Ctx};

const PROTOCOL: &str = "2025-06-18";
const SUPPORTED: [&str; 4] = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const INSTRUCTIONS: &str = "FormPortal installs, opens, updates, rolls back and removes the Form family's desktop apps on this computer, from the signed catalogue on dl.formai.studio and the newer releases each app publishes on GitHub. Start with status, then apps. Every install verifies the file's SHA-256 against the catalogue before anything is unpacked. install, rollback and remove change the person's computer: say what will change and get their go-ahead first. The formportal-harness skill has the workflow.";

fn props(extra: Value) -> Value {
    let mut base = json!({
        "source": { "type": "string", "description": "Catalogue address (https) or a local catalogue file with its .sig beside it. Defaults to FORMPORTAL_CATALOG or https://dl.formai.studio/catalog/apps.json." }
    });
    if let (Some(b), Some(e)) = (base.as_object_mut(), extra.as_object()) {
        for (k, v) in e {
            b.insert(k.clone(), v.clone());
        }
    }
    base
}

fn target() -> Value {
    json!({
        "product": { "type": "string", "description": "Product id from apps, e.g. formcut, formvis, formencoder." },
        "channel": { "type": "string", "enum": ["stable", "beta", "nightly"], "description": "Defaults to stable. A beta installs beside the stable build." }
    })
}

fn ext_product() -> Value {
    let ids: Vec<&str> = formportal_core::extensions::HOSTS.iter().map(|(id, _, _)| *id).collect();
    json!({ "type": "string", "enum": ids, "description": "The app the extension is for, by its extension product id (formdeck and formportal, not the catalogue's formslide and formai)." })
}

fn tools() -> Value {
    let only_target = |required: bool| json!({ "type": "object", "properties": target(), "required": if required { json!(["product"]) } else { json!([]) } });
    json!([
        { "name": "status", "title": "FormPortal status",
          "description": "FormPortal's version, this computer's platform, the install folder, the catalogue source and everything installed. Call first.",
          "inputSchema": { "type": "object", "properties": {} },
          "annotations": { "readOnlyHint": true, "openWorldHint": false } },
        { "name": "apps", "title": "List the Form apps",
          "description": "The Form apps that are released (a published release in the catalogue or on the app's GitHub repository) or installed here, as on formai.studio: name, what it replaces, group, and per channel what the catalogue offers this computer and what is installed. Apps not released yet are not named; on_the_way gives each scheduled group's opening date and how many apps it holds, plus one group with opens null for apps whose date is still to come (counted from formai.studio, present only when it answered); a names array per group appears only when the person has a supporter code that formai.studio confirmed. Works offline from the registry when the catalogue cannot be read, and says why.",
          "inputSchema": { "type": "object", "properties": props(json!({})) },
          "annotations": { "readOnlyHint": true, "openWorldHint": true } },
        { "name": "app_info", "title": "One app in detail",
          "description": "The registry entry and the catalogue's releases for one product: versions per channel, artifacts with size, SHA-256 and minimum OS, and release notes.",
          "inputSchema": { "type": "object", "properties": props(json!({ "product": target()["product"] })), "required": ["product"] },
          "annotations": { "readOnlyHint": true, "openWorldHint": true } },
        { "name": "installs", "title": "Installed apps",
          "description": "What FormPortal has installed: product, channel, current version with path and SHA-256, the previous version kept for rollback, and the process ids of any copy that is open.",
          "inputSchema": { "type": "object", "properties": {} },
          "annotations": { "readOnlyHint": true, "openWorldHint": false } },
        { "name": "install", "title": "Install or update an app",
          "description": "Downloads the release the catalogue offers this computer for the product and channel, verifies its SHA-256, unpacks it per user (no administrator) and keeps the version it replaces for rollback. Installing the newer version over an older one is how an update is done. If the app is open, the new version goes into its own folder, the open copy keeps running untouched, and the result's note says the new version opens next time; reinstalling the exact version that is open is refused. Changes the person's computer: confirm first.",
          "inputSchema": { "type": "object", "properties": props(json!({ "product": target()["product"], "channel": target()["channel"], "version": { "type": "string", "description": "An earlier version from the versions tool. Omit for the newest." } })), "required": ["product"] },
          "annotations": { "readOnlyHint": false, "destructiveHint": false, "idempotentHint": true, "openWorldHint": true } },
        { "name": "versions", "title": "Versions of an app",
          "description": "Every version of a product's channel the catalogue offers, newest first (the latest and its history), with date, release notes, size and whether there is a file for this computer, plus what is installed and kept for rollback. Install one with install and version.",
          "inputSchema": { "type": "object", "properties": props(target()), "required": ["product"] },
          "annotations": { "readOnlyHint": true, "openWorldHint": true } },
        { "name": "updates", "title": "Updates waiting",
          "description": "Every installed app and channel with a newer version in the catalogue: from and to versions, download size, release notes, whether a copy is open, and whether the person's preferences would update it automatically. Also says when a newer FormPortal is available.",
          "inputSchema": { "type": "object", "properties": props(json!({})) },
          "annotations": { "readOnlyHint": true, "openWorldHint": true } },
        { "name": "update", "title": "Update one app or all",
          "description": "With product (and channel), installs that app's newer version; with later true instead, puts it off until the app is closed (installed the next time FormPortal checks, whatever the automatic setting), and later false cancels that. Without product, installs every waiting update; with automatic_only, only those the person's preferences allow or put off (skipping open apps when only_when_closed is on, and always for put-off ones). An open app keeps running and the new version opens next time. Changes the person's computer: confirm first.",
          "inputSchema": { "type": "object", "properties": props(json!({ "product": target()["product"], "channel": target()["channel"], "automatic_only": { "type": "boolean", "description": "Only the updates the preferences allow or that were put off." }, "later": { "type": "boolean", "description": "Put this app's update off until it is closed (true), or cancel that (false)." } })) },
          "annotations": { "readOnlyHint": false, "destructiveHint": false, "idempotentHint": true, "openWorldHint": true } },
        { "name": "preferences", "title": "Update preferences",
          "description": "Reads FormPortal's update preferences, or changes the ones given: auto_update (all apps, default on, applied while FormPortal is open), auto_update_beta (default off), only_when_closed (default on), notices (default on), keep_previous (default on: keep the replaced version for rollback; off deletes it after each update), per_app (an object of product id to true, false, or null to follow the global setting), open_at_login (default off: open the FormPortal window when the person logs in; the window writes or removes its login item when it next starts, and runs nothing in the background). supporter_code is only ever reported as true or false. Changing them is the person's choice: confirm first.",
          "inputSchema": { "type": "object", "properties": {
              "auto_update": { "type": "boolean" }, "auto_update_beta": { "type": "boolean" }, "only_when_closed": { "type": "boolean" }, "notices": { "type": "boolean" }, "keep_previous": { "type": "boolean" }, "open_at_login": { "type": "boolean" },
              "per_app": { "type": "object", "additionalProperties": { "type": ["boolean", "null"] } } } },
          "annotations": { "readOnlyHint": false, "destructiveHint": false, "idempotentHint": true, "openWorldHint": false } },
        { "name": "extensions", "title": "Extensions",
          "description": "The open extension index (effects, looks, templates, presets, plugins for the thirteen Form apps that load extensions: formvis, formcut, formwav, formpdf, formdeck, formlit, formmd, formencoder, formvfx, formmcp, formtray, formskills, formportal) with each package's app, author, kind, permissions, extension API, homepage, whether it is signed, verified (reviewed and published by form.ext-registry), source (its folder in the registry), blocked (the block list's reason, if any), its install state, and support, an https page where people can pay or sponsor its maker if it has one (the extension is free either way); plus every installed extension, including sideloaded ones (source sideload), the block list (blocked) and any installed extension the block list just turned off (turned_off, with the reason). The index is form.ext-registry's signed index (https://github.com/nodemode-dev/form.ext-registry/releases/download/index/extensions.json, verified with registry keys only), or extensions_source, or FORMPORTAL_EXTENSIONS. index_error says when it was refused (this build trusts no registry key yet, a signature that does not match) or when the registry is private or unreachable.",
          "inputSchema": { "type": "object", "properties": props(json!({ "extensions_source": { "type": "string", "description": "Extension index address or file." } })) },
          "annotations": { "readOnlyHint": true, "openWorldHint": true } },
        { "name": "extension_install", "title": "Install an extension",
          "description": "Installs a package from the index by id (download, SHA-256 check, publisher signature check, manifest check against the index), or a local .formpkg file by path (sideloaded and labelled so unless the index lists the same file). A package whose manifest asks for an extension API other than \"1\", that runs native code, that is on the registry's block list, or (from the index) that carries no publisher signature without allow_unsigned, is refused. The app picks it up while it runs (it watches FormPortal's enabled.json); note says so, or that an older installed app uses it the next time it starts. Changes the person's computer: confirm first, and name the permissions it asks for.",
          "inputSchema": { "type": "object", "properties": props(json!({ "id": { "type": "string" }, "path": { "type": "string", "description": "Absolute path of a .formpkg file." }, "extensions_source": { "type": "string" } })) },
          "annotations": { "readOnlyHint": false, "destructiveHint": false, "idempotentHint": true, "openWorldHint": true } },
        { "name": "extension_remove", "title": "Remove an extension",
          "description": "Removes an installed extension and its files; the app drops it while it runs. Confirm first.",
          "inputSchema": { "type": "object", "properties": { "product": ext_product(), "id": { "type": "string" } }, "required": ["product", "id"] },
          "annotations": { "readOnlyHint": false, "destructiveHint": true, "openWorldHint": false } },
        { "name": "extension_enable", "title": "Turn an extension on or off",
          "description": "Turns an installed extension on or off without removing it; the app sees the change while it runs (an app older than its extension host release sees it the next time it starts). An extension on the registry's block list stays off.",
          "inputSchema": { "type": "object", "properties": { "product": ext_product(), "id": { "type": "string" }, "enabled": { "type": "boolean" } }, "required": ["product", "id", "enabled"] },
          "annotations": { "readOnlyHint": false, "destructiveHint": false, "idempotentHint": true, "openWorldHint": false } },
        { "name": "account", "title": "GitHub sign-in",
          "description": "Whether the person has signed in to GitHub in FormPortal (optional: installing and updating never need it), as whom, and which access they granted (scopes). configured false means this FormPortal has no GitHub app set up. Signing in and out is the person's own step in FormPortal's Preferences or with formportal-cli sign-in; this tool never starts it.",
          "inputSchema": { "type": "object", "properties": {} },
          "annotations": { "readOnlyHint": true, "openWorldHint": true } },
        { "name": "shares", "title": "Shared libraries and public links",
          "description": "The person's Files folders shared through their own GitHub account (each a private repository named formportal-library-...), libraries others shared with them (and invitations waiting), and files given a public link, with portfolio, the address of the front page in formportal-public that lists them all. Needs a GitHub sign-in for invitations; the rest is read from this computer.",
          "inputSchema": { "type": "object", "properties": {} },
          "annotations": { "readOnlyHint": true, "openWorldHint": true } },
        { "name": "share", "title": "Share a folder",
          "description": "Shares one of the person's Files folders as a private repository in their own GitHub account, sends its files (unchanged files are skipped, files over 100 MB are listed as skipped) and invites the GitHub users named. Again on a shared folder, it sends what changed. Puts their files on GitHub and invites people: confirm first.",
          "inputSchema": { "type": "object", "properties": { "folder": { "type": "string", "description": "A folder from the files tool, full path." }, "invite": { "type": "array", "items": { "type": "string" }, "description": "GitHub logins to invite." } }, "required": ["folder"] },
          "annotations": { "readOnlyHint": false, "destructiveHint": false, "idempotentHint": true, "openWorldHint": true } },
        { "name": "share_accept", "title": "Accept a shared library",
          "description": "Accepts an invitation from the shares tool and downloads that library into Shared in the person's projects folder, which Files then lists. Confirm first.",
          "inputSchema": { "type": "object", "properties": { "id": { "type": "integer" } }, "required": ["id"] },
          "annotations": { "readOnlyHint": false, "destructiveHint": false, "idempotentHint": true, "openWorldHint": true } },
        { "name": "share_pull", "title": "Get the latest of a shared library",
          "description": "Downloads what changed in a library shared with the person (owner/repo from the shares tool) into its folder; files the person changed locally are replaced by the shared version.",
          "inputSchema": { "type": "object", "properties": { "repo": { "type": "string" } }, "required": ["repo"] },
          "annotations": { "readOnlyHint": false, "destructiveHint": true, "idempotentHint": true, "openWorldHint": true } },
        { "name": "publish", "title": "Public link",
          "description": "Gives a file a public link that anyone can open, by storing it in the public repository formportal-public in the person's GitHub account; with unpublish true, removes it. Makes the file public: confirm first.",
          "inputSchema": { "type": "object", "properties": { "file": { "type": "string" }, "unpublish": { "type": "boolean" } }, "required": ["file"] },
          "annotations": { "readOnlyHint": false, "destructiveHint": false, "idempotentHint": true, "openWorldHint": true } },
        { "name": "policy", "title": "Organisation policy",
          "description": "Whether an organisation manages FormPortal on this computer, and what its policy fixes: the catalogue address and extra catalogue keys, whether unsigned catalogues are refused, update settings that cannot be changed (locked), which apps and channels may be installed, and whether extensions and sideloaded packages are allowed. Read it before suggesting a change a policy would refuse. The policy is a system file (/etc/formportal/policy.json, /Library/Application Support/FormPortal/policy.json or %ProgramData%\\FormPortal\\policy.json) set by the organisation; FORMPORTAL_POLICY is read only for testing when no system file exists.",
          "inputSchema": { "type": "object", "properties": {} },
          "annotations": { "readOnlyHint": true, "openWorldHint": false } },
        { "name": "files", "title": "Form projects on this computer",
          "description": "The person's Form project files (by each app's project extensions, e.g. .fc for FormCut) in the folders they gave FormPortal, newest first, with the app that opens each, size, date and how many earlier versions FormPortal keeps; plus each folder's file count and size. query filters by name or app. Reading also keeps a version of any file that changed since the last one, in folders where versions are on. Local only: nothing leaves the computer.",
          "inputSchema": { "type": "object", "properties": { "query": { "type": "string" }, "limit": { "type": "integer", "description": "At most this many files (default 200)." } } },
          "annotations": { "readOnlyHint": false, "destructiveHint": false, "idempotentHint": true, "openWorldHint": false } },
        { "name": "folders", "title": "Projects folders",
          "description": "Lists the folders FormPortal looks in; with action add and a path (the suggested folder if none), adds one (create true makes it), keep_versions on by default; with action remove, stops listing one without touching its files. Changing them is the person's choice: confirm first.",
          "inputSchema": { "type": "object", "properties": { "action": { "type": "string", "enum": ["list", "add", "remove"] }, "path": { "type": "string" }, "keep_versions": { "type": "boolean" }, "create": { "type": "boolean" } } },
          "annotations": { "readOnlyHint": false, "destructiveHint": false, "idempotentHint": true, "openWorldHint": false } },
        { "name": "open_file", "title": "Open a project in its app",
          "description": "Opens a project file with the installed Form app that makes it (by extension), stable first, then beta. Says which app to install if none is.",
          "inputSchema": { "type": "object", "properties": { "path": { "type": "string" } }, "required": ["path"] },
          "annotations": { "readOnlyHint": false, "destructiveHint": false, "openWorldHint": false } },
        { "name": "file_versions", "title": "A project's versions",
          "description": "The versions FormPortal kept of a project file in one of its folders, newest first (id, time, size, SHA-256, why it was kept). action save keeps one now; action revert with version puts that version back after keeping the current file as a version too, so nothing is lost. Reverting changes the person's file: confirm first.",
          "inputSchema": { "type": "object", "properties": { "path": { "type": "string" }, "action": { "type": "string", "enum": ["list", "save", "revert"] }, "version": { "type": "string" } }, "required": ["path"] },
          "annotations": { "readOnlyHint": false, "destructiveHint": false, "openWorldHint": false } },
        { "name": "storage", "title": "Disk use",
          "description": "What FormPortal uses on disk (installed apps, downloads, extensions, kept file versions, the catalogue copy) and the size of each projects folder.",
          "inputSchema": { "type": "object", "properties": {} },
          "annotations": { "readOnlyHint": true, "openWorldHint": false } },
        { "name": "fonts", "title": "Fonts",
          "description": "The open font index (families with foundry, licence, category and styles, each marked installed or not) read from fonts.json beside the catalogue (or fonts_source, FORMPORTAL_FONTS), signed like the catalogue; plus every font FormPortal installed, from the index or the person's own files, the per-user font folder, and updates: installed styles whose file in the index has changed (font_install with the id and style installs the new one). query filters by family, foundry or category.",
          "inputSchema": { "type": "object", "properties": props(json!({ "query": { "type": "string" }, "fonts_source": { "type": "string" } })) },
          "annotations": { "readOnlyHint": true, "openWorldHint": true } },
        { "name": "font_install", "title": "Install a font",
          "description": "With id (and optionally style), downloads that family or style from the index, checks each file's SHA-256 and that it is a TrueType or OpenType font, refuses anything not under OFL-1.1, Apache-2.0 or MIT, and installs it for this user only (no administrator). With path, adds the person's own TTF or OTF file instead; rights_confirmed must be true, meaning the person said they have the right to use it. Apps see new fonts after they restart. Confirm first.",
          "inputSchema": { "type": "object", "properties": props(json!({ "id": { "type": "string" }, "style": { "type": "string" }, "path": { "type": "string" }, "rights_confirmed": { "type": "boolean" }, "fonts_source": { "type": "string" } })) },
          "annotations": { "readOnlyHint": false, "destructiveHint": false, "idempotentHint": true, "openWorldHint": true } },
        { "name": "font_remove", "title": "Remove a font",
          "description": "Removes a font FormPortal installed (a whole family, or one style), from the per-user font folder. Never touches fonts it did not install. Confirm first.",
          "inputSchema": { "type": "object", "properties": { "family": { "type": "string" }, "style": { "type": "string" } }, "required": ["family"] },
          "annotations": { "readOnlyHint": false, "destructiveHint": true, "openWorldHint": false } },
        { "name": "media", "title": "Stock media and templates",
          "description": "The open media index (media.json beside the catalogue, or media_source or FORMPORTAL_MEDIA, signed like the catalogue): images, video, audio and Form app templates, each with creator, licence (CC0, CC BY, CC BY-SA, Apache, MIT, OFL), source page, credit line and whether it is saved; plus everything saved in the person's Library. query and kind filter.",
          "inputSchema": { "type": "object", "properties": props(json!({ "query": { "type": "string" }, "kind": { "type": "string", "enum": ["image", "video", "audio", "template"] }, "media_source": { "type": "string" } })) },
          "annotations": { "readOnlyHint": true, "openWorldHint": true } },
        { "name": "media_save", "title": "Save media or use a template",
          "description": "Saves an item from the media index into the person's Library (Documents/Form/Library by default, or FORMPORTAL_LIBRARY), checking its SHA-256 and writing its credit line beside it and into credits.json. With use true on a template, also copies it into the first projects folder (or folder) and opens it in its app. Confirm first.",
          "inputSchema": { "type": "object", "properties": props(json!({ "id": { "type": "string" }, "use": { "type": "boolean" }, "folder": { "type": "string" }, "media_source": { "type": "string" } })), "required": ["id"] },
          "annotations": { "readOnlyHint": false, "destructiveHint": false, "idempotentHint": true, "openWorldHint": true } },
        { "name": "media_remove", "title": "Remove saved media",
          "description": "Removes an item FormPortal saved into the Library, with its credit file. Copies of templates already in projects folders are not touched. Confirm first.",
          "inputSchema": { "type": "object", "properties": { "id": { "type": "string" } }, "required": ["id"] },
          "annotations": { "readOnlyHint": false, "destructiveHint": true, "openWorldHint": false } },
        { "name": "repair", "title": "Check and repair FormPortal's installs",
          "description": "Checks every install record (its folder is there, it has something to open, the kept earlier version is there) and FormPortal's own folders (versions no record points to, unfinished installs, old downloads). Without fix it only reports, which is safe to run any time. With fix true it reinstalls a broken app's same version when the catalogue still offers that exact file (same SHA-256), otherwise forgets the record, forgets missing earlier versions, and deletes leftovers. It never touches anything outside FormPortal's folder, folders younger than ten minutes, or a running app. Confirm before fix.",
          "inputSchema": { "type": "object", "properties": props(json!({ "fix": { "type": "boolean" } })) },
          "annotations": { "readOnlyHint": false, "destructiveHint": true, "idempotentHint": true, "openWorldHint": true } },
        { "name": "demo", "title": "Open a demo in FormPortal",
          "description": "Lists FormPortal's three demos (install: installs and files; updates: updates and trust; library: fonts, stock and templates). With id, opens formai://demo/<id>, so the FormPortal window shows that demo over itself, clearly labelled, with sample apps and files that never touch the person's real installs, settings or files; End demo returns.",
          "inputSchema": { "type": "object", "properties": { "id": { "type": "string", "enum": ["install", "updates", "library"], "description": "The demo to open. Leave out to list them." } } },
          "annotations": { "readOnlyHint": false, "destructiveHint": false, "idempotentHint": true, "openWorldHint": false } },
        { "name": "learn", "title": "Tutorials and progress",
          "description": "Tutorials: FormPortal's own six (installing, betas, going back, files, fonts and stock, agents) plus the Form apps' tutorials from the signed tutorial index (learn.json beside the catalogue, or learn_source or FORMPORTAL_LEARN). Each has its steps (some name the FormPortal screen they happen on), minutes, level, and the steps this person has finished (numbered from 1), kept on this computer only. product and query filter.",
          "inputSchema": { "type": "object", "properties": props(json!({ "product": { "type": "string" }, "query": { "type": "string" }, "learn_source": { "type": "string" } })) },
          "annotations": { "readOnlyHint": true, "openWorldHint": true } },
        { "name": "learn_progress", "title": "Mark a tutorial step",
          "description": "Marks a tutorial step finished (done true, the default) or not (done false), steps numbered from 1; or with reset true clears the tutorial's progress. Progress is kept on this computer only.",
          "inputSchema": { "type": "object", "properties": props(json!({ "id": { "type": "string" }, "step": { "type": "integer", "minimum": 1 }, "done": { "type": "boolean" }, "reset": { "type": "boolean" }, "learn_source": { "type": "string" } })), "required": ["id"] },
          "annotations": { "readOnlyHint": false, "destructiveHint": false, "idempotentHint": true, "openWorldHint": false } },
        { "name": "app_agents", "title": "An app's MCP server",
          "description": "Whether an installed Form app ships its own MCP server (declared in the app's form-app.json), the server name FormPortal uses for it (the product id, with -beta for a beta), and for Claude Code, Codex and Cursor whether it is connected, not connected, taken by another server of the same name, or the client is not installed. manifest is the install's form-app.json as read (format_version 1 or 2): whether the app has an MCP server and, for format_version 2, its skills archive and each skill's name and description.",
          "inputSchema": only_target(true),
          "annotations": { "readOnlyHint": true, "openWorldHint": false } },
        { "name": "connect_agents", "title": "Connect an app to Claude Code, Codex and Cursor",
          "description": "Adds the installed app's MCP server to the clients given (claude, codex, cursor; all three by default) at user scope, or with disconnect true takes it out. The entry starts FormPortal's app-mcp, which runs whichever version is installed, so updates and rollbacks need no change. Never overwrites a server of the same name that FormPortal did not add; backs up each config file it changes. Changes the person's agent configuration: confirm first.",
          "inputSchema": { "type": "object", "properties": {
              "product": target()["product"], "channel": target()["channel"],
              "clients": { "type": "array", "items": { "type": "string", "enum": ["claude", "codex", "cursor"] } },
              "disconnect": { "type": "boolean", "description": "Take the app out of the clients instead." } },
            "required": ["product"] },
          "annotations": { "readOnlyHint": false, "destructiveHint": false, "idempotentHint": true, "openWorldHint": false } },
        { "name": "open", "title": "Open an installed app",
          "description": "Starts the installed app for the product and channel and returns its process id.",
          "inputSchema": only_target(true),
          "annotations": { "readOnlyHint": false, "destructiveHint": false, "openWorldHint": false } },
        { "name": "rollback", "title": "Go back one version",
          "description": "Swaps the installed version for the previous one FormPortal kept. Fails when no previous version is kept. Confirm first.",
          "inputSchema": only_target(true),
          "annotations": { "readOnlyHint": false, "destructiveHint": true, "openWorldHint": false } },
        { "name": "remove", "title": "Remove an app",
          "description": "Uninstalls the product's channel and deletes its install folder, including the kept previous version. The app's own documents elsewhere are not touched. Refused while the app is open. Confirm first.",
          "inputSchema": only_target(true),
          "annotations": { "readOnlyHint": false, "destructiveHint": true, "openWorldHint": false } }
    ])
}

fn without_unsigned(args: &Value) -> Value {
    let mut args = args.clone();
    if let Some(map) = args.as_object_mut() {
        map.remove("allow_unsigned");
    }
    args
}

fn call(ctx: &Ctx, name: &str, args: &Value) -> Result<Value, String> {
    let args = &without_unsigned(args);
    let out = match name {
        "status" => ops::status(ctx),
        "apps" => ops::apps(ctx, args),
        "app_info" => ops::info(ctx, args),
        "installs" => ops::installs(ctx),
        "install" => ops::install(ctx, args, &mut |_, _| {}),
        "updates" => ops::updates(ctx, args),
        "versions" => ops::versions(ctx, args),
        "extensions" => ops::extensions(ctx, args),
        "extension_install" => ops::extension_install(ctx, args, &mut |_, _| {}),
        "extension_remove" => ops::extension_remove(ctx, args),
        "extension_enable" => ops::extension_enable(ctx, args),
        "update" => ops::update(ctx, args, &mut |_, _| {}),
        "preferences" => ops::preferences(ctx, args),
        "open" => ops::open(ctx, args),
        "rollback" => ops::rollback(ctx, args),
        "remove" => ops::remove(ctx, args),
        "policy" => ops::policy(ctx),
        "account" => ops::account(),
        "shares" => ops::shares(ctx),
        "share" => ops::share(ctx, args),
        "share_accept" => ops::share_accept(ctx, args),
        "share_pull" => ops::share_pull(ctx, args),
        "publish" => if args.get("unpublish").and_then(Value::as_bool) == Some(true) { ops::unpublish(ctx, args) } else { ops::publish(ctx, args) },
        "app_agents" => ops::app_agents(ctx, args),
        "connect_agents" => ops::connect_agents(ctx, args),
        "files" => ops::files(ctx, args),
        "folders" => ops::folders(ctx, args),
        "open_file" => ops::open_file(ctx, args),
        "file_versions" => ops::file_versions(ctx, args),
        "storage" => ops::storage(ctx),
        "fonts" => ops::fonts(ctx, args),
        "font_install" => ops::font_install(ctx, args, &mut |_, _| {}),
        "font_remove" => ops::font_remove(ctx, args),
        "media" => ops::media(ctx, args),
        "media_save" => ops::media_save(ctx, args, &mut |_, _| {}),
        "media_remove" => ops::media_remove(ctx, args),
        "learn" => ops::learn(ctx, args),
        "demo" => ops::demo(args),
        "learn_progress" => ops::learn_progress(ctx, args),
        "repair" => ops::repair(ctx, args, &mut |_, _| {}),
        other => return Err(format!("no tool named {other:?}; tools/list has the thirty-three tools")),
    };
    out.map_err(|e| e.to_string())
}

pub fn read_only_tools() -> Vec<String> {
    tools()
        .as_array()
        .map(|list| {
            list.iter()
                .filter(|t| t.pointer("/annotations/readOnlyHint").and_then(Value::as_bool) == Some(true))
                .filter_map(|t| t.get("name").and_then(Value::as_str).map(str::to_string))
                .collect()
        })
        .unwrap_or_default()
}

fn answer(ctx: &Ctx, msg: &Value, read_only: bool) -> Option<Value> {
    let id = msg.get("id").cloned();
    let method = msg.get("method").and_then(Value::as_str).unwrap_or_default();
    let params = msg.get("params").cloned().unwrap_or(Value::Null);
    let id = id?;
    let result = match method {
        "initialize" => {
            let asked = params.get("protocolVersion").and_then(Value::as_str).unwrap_or(PROTOCOL);
            let version = if SUPPORTED.contains(&asked) { asked } else { PROTOCOL };
            json!({
                "protocolVersion": version,
                "capabilities": { "tools": { "listChanged": false } },
                "serverInfo": { "name": "formportal", "title": "FormPortal", "version": formportal_core::CORE_VERSION },
                "instructions": INSTRUCTIONS
            })
        }
        "ping" => json!({}),
        "tools/list" if read_only => {
            let allowed = read_only_tools();
            let list: Vec<Value> = tools().as_array().cloned().unwrap_or_default().into_iter().filter(|t| t.get("name").and_then(Value::as_str).map(|n| allowed.iter().any(|a| a == n)).unwrap_or(false)).collect();
            json!({ "tools": list })
        }
        "tools/list" => json!({ "tools": tools() }),
        "tools/call" => {
            let name = params.get("name").and_then(Value::as_str).unwrap_or_default();
            let args = params.get("arguments").cloned().unwrap_or_else(|| json!({}));
            let refused = read_only && !read_only_tools().iter().any(|t| t == name);
            let outcome = if refused { Err(format!("{name} changes this computer, and this FormPortal server only reads; use FormPortal itself to do it")) } else { call(ctx, name, &args) };
            match outcome {
                Ok(v) => json!({ "content": [{ "type": "text", "text": serde_json::to_string_pretty(&v).unwrap_or_default() }], "structuredContent": v, "isError": false }),
                Err(e) => json!({ "content": [{ "type": "text", "text": e }], "isError": true }),
            }
        }
        "resources/list" => json!({ "resources": [] }),
        "prompts/list" => json!({ "prompts": [] }),
        _ => return Some(json!({ "jsonrpc": "2.0", "id": id, "error": { "code": -32601, "message": format!("method {method:?} is not served by formportal") } })),
    };
    Some(json!({ "jsonrpc": "2.0", "id": id, "result": result }))
}

pub fn serve() -> io::Result<()> {
    serve_with(false)
}

pub fn serve_with(read_only: bool) -> io::Result<()> {
    let ctx = Ctx::from_env();
    let stdin = io::stdin();
    let mut out = io::stdout().lock();
    for line in stdin.lock().lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }
        let reply = match serde_json::from_str::<Value>(&line) {
            Ok(Value::Array(batch)) => {
                let replies: Vec<Value> = batch.iter().filter_map(|m| answer(&ctx, m, read_only)).collect();
                if replies.is_empty() { None } else { Some(Value::Array(replies)) }
            }
            Ok(msg) => answer(&ctx, &msg, read_only),
            Err(_) => Some(json!({ "jsonrpc": "2.0", "id": null, "error": { "code": -32700, "message": "Parse error" } })),
        };
        if let Some(reply) = reply {
            writeln!(out, "{reply}")?;
            out.flush()?;
        }
    }
    Ok(())
}
