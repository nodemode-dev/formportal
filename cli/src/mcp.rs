use std::io::{self, BufRead, Write};

use serde_json::{json, Value};

use crate::ops::{self, Ctx};

const PROTOCOL: &str = "2025-06-18";
const SUPPORTED: [&str; 4] = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const INSTRUCTIONS: &str = "FormPortal installs, opens, updates, rolls back and removes the Form family's desktop apps on this computer, from a signed catalogue published at formai.dev. Start with status, then apps. Every install verifies the file's SHA-256 against the catalogue before anything is unpacked. install, rollback and remove change the person's computer: say what will change and get their go-ahead first. The formportal-harness skill has the workflow.";

fn props(extra: Value) -> Value {
    let mut base = json!({
        "source": { "type": "string", "description": "Catalogue address (https) or a local catalogue file. Defaults to FORMPORTAL_CATALOG or https://formai.dev/catalog/v1/apps.json." },
        "allow_unsigned": { "type": "boolean", "description": "Accept a catalogue without a signature. Only for local development catalogues." }
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

fn tools() -> Value {
    let only_target = |required: bool| json!({ "type": "object", "properties": target(), "required": if required { json!(["product"]) } else { json!([]) } });
    json!([
        { "name": "status", "title": "FormPortal status",
          "description": "FormPortal's version, this computer's platform, the install folder, the catalogue source and everything installed. Call first.",
          "inputSchema": { "type": "object", "properties": {} },
          "annotations": { "readOnlyHint": true, "openWorldHint": false } },
        { "name": "apps", "title": "List the Form apps",
          "description": "Every app in the Form family registry (name, what it replaces, group, development status) with, per channel, what the catalogue offers this computer and what is installed. Works offline from the registry when the catalogue cannot be read, and says why.",
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
          "description": "With product (and channel), installs that app's newer version. Without product, installs every waiting update; with automatic_only, only those the person's preferences allow (skipping open apps when only_when_closed is on). An open app keeps running and the new version opens next time. Changes the person's computer: confirm first.",
          "inputSchema": { "type": "object", "properties": props(json!({ "product": target()["product"], "channel": target()["channel"], "automatic_only": { "type": "boolean", "description": "Only the updates the preferences allow." } })) },
          "annotations": { "readOnlyHint": false, "destructiveHint": false, "idempotentHint": true, "openWorldHint": true } },
        { "name": "preferences", "title": "Update preferences",
          "description": "Reads FormPortal's update preferences, or changes the ones given: auto_update (all apps, default on, applied while FormPortal is open), auto_update_beta (default off), only_when_closed (default on), notices (default on), keep_previous (default on: keep the replaced version for rollback; off deletes it after each update), per_app (an object of product id to true, false, or null to follow the global setting). Changing them is the person's choice: confirm first.",
          "inputSchema": { "type": "object", "properties": {
              "auto_update": { "type": "boolean" }, "auto_update_beta": { "type": "boolean" }, "only_when_closed": { "type": "boolean" }, "notices": { "type": "boolean" }, "keep_previous": { "type": "boolean" },
              "per_app": { "type": "object", "additionalProperties": { "type": ["boolean", "null"] } } } },
          "annotations": { "readOnlyHint": false, "destructiveHint": false, "idempotentHint": true, "openWorldHint": false } },
        { "name": "extensions", "title": "Extensions",
          "description": "The open extension index (effects, looks, templates, presets, plugins for the Form apps) with each package's author, kind, permissions, whether it runs native code and is signed, and its install state; plus every installed extension, including sideloaded ones (source sideload). The index is read from extensions_source, FORMPORTAL_EXTENSIONS, or extensions.json beside the catalogue.",
          "inputSchema": { "type": "object", "properties": props(json!({ "extensions_source": { "type": "string", "description": "Extension index address or file." } })) },
          "annotations": { "readOnlyHint": true, "openWorldHint": true } },
        { "name": "extension_install", "title": "Install an extension",
          "description": "Installs a package from the index by id (download, SHA-256 check, publisher signature check, manifest check against the index), or a local .formpkg file by path (sideloaded and labelled so unless the index lists the same file). A package that runs native code must be signed unless allow_unsigned is set for development. The app picks it up the next time it starts. Changes the person's computer: confirm first, and name the permissions it asks for.",
          "inputSchema": { "type": "object", "properties": props(json!({ "id": { "type": "string" }, "path": { "type": "string", "description": "Absolute path of a .formpkg file." }, "extensions_source": { "type": "string" } })) },
          "annotations": { "readOnlyHint": false, "destructiveHint": false, "idempotentHint": true, "openWorldHint": true } },
        { "name": "extension_remove", "title": "Remove an extension",
          "description": "Removes an installed extension and its files. Confirm first.",
          "inputSchema": { "type": "object", "properties": { "product": { "type": "string" }, "id": { "type": "string" } }, "required": ["product", "id"] },
          "annotations": { "readOnlyHint": false, "destructiveHint": true, "openWorldHint": false } },
        { "name": "extension_enable", "title": "Turn an extension on or off",
          "description": "Turns an installed extension on or off without removing it; the app sees the change the next time it starts.",
          "inputSchema": { "type": "object", "properties": { "product": { "type": "string" }, "id": { "type": "string" }, "enabled": { "type": "boolean" } }, "required": ["product", "id", "enabled"] },
          "annotations": { "readOnlyHint": false, "destructiveHint": false, "idempotentHint": true, "openWorldHint": false } },
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
        { "name": "app_agents", "title": "An app's MCP server",
          "description": "Whether an installed Form app ships its own MCP server (declared in the app's form-app.json), the server name FormPortal uses for it (the product id, with -beta for a beta), and for Claude Code, Codex and Cursor whether it is connected, not connected, taken by another server of the same name, or the client is not installed.",
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

fn call(ctx: &Ctx, name: &str, args: &Value) -> Result<Value, String> {
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
        "app_agents" => ops::app_agents(ctx, args),
        "connect_agents" => ops::connect_agents(ctx, args),
        "files" => ops::files(ctx, args),
        "folders" => ops::folders(ctx, args),
        "open_file" => ops::open_file(ctx, args),
        "file_versions" => ops::file_versions(ctx, args),
        "storage" => ops::storage(ctx),
        other => return Err(format!("no tool named {other:?}; tools/list has the twenty-four tools")),
    };
    out.map_err(|e| e.to_string())
}

fn answer(ctx: &Ctx, msg: &Value) -> Option<Value> {
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
        "tools/list" => json!({ "tools": tools() }),
        "tools/call" => {
            let name = params.get("name").and_then(Value::as_str).unwrap_or_default();
            let args = params.get("arguments").cloned().unwrap_or_else(|| json!({}));
            match call(ctx, name, &args) {
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
                let replies: Vec<Value> = batch.iter().filter_map(|m| answer(&ctx, m)).collect();
                if replies.is_empty() { None } else { Some(Value::Array(replies)) }
            }
            Ok(msg) => answer(&ctx, &msg),
            Err(_) => Some(json!({ "jsonrpc": "2.0", "id": null, "error": { "code": -32700, "message": "Parse error" } })),
        };
        if let Some(reply) = reply {
            writeln!(out, "{reply}")?;
            out.flush()?;
        }
    }
    Ok(())
}
