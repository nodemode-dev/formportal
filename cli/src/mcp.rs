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
          "description": "What FormPortal has installed: product, channel, current version with path and SHA-256, and the previous version kept for rollback.",
          "inputSchema": { "type": "object", "properties": {} },
          "annotations": { "readOnlyHint": true, "openWorldHint": false } },
        { "name": "install", "title": "Install or update an app",
          "description": "Downloads the release the catalogue offers this computer for the product and channel, verifies its SHA-256, unpacks it per user (no administrator) and keeps the version it replaces for rollback. Installing the newer version over an older one is how an update is done. Changes the person's computer: confirm first.",
          "inputSchema": { "type": "object", "properties": props(target()), "required": ["product"] },
          "annotations": { "readOnlyHint": false, "destructiveHint": false, "idempotentHint": true, "openWorldHint": true } },
        { "name": "open", "title": "Open an installed app",
          "description": "Starts the installed app for the product and channel and returns its process id.",
          "inputSchema": only_target(true),
          "annotations": { "readOnlyHint": false, "destructiveHint": false, "openWorldHint": false } },
        { "name": "rollback", "title": "Go back one version",
          "description": "Swaps the installed version for the previous one FormPortal kept. Fails when no previous version is kept. Confirm first.",
          "inputSchema": only_target(true),
          "annotations": { "readOnlyHint": false, "destructiveHint": true, "openWorldHint": false } },
        { "name": "remove", "title": "Remove an app",
          "description": "Uninstalls the product's channel and deletes its install folder, including the kept previous version. The app's own documents elsewhere are not touched. Confirm first.",
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
        "open" => ops::open(ctx, args),
        "rollback" => ops::rollback(ctx, args),
        "remove" => ops::remove(ctx, args),
        other => return Err(format!("no tool named {other:?}; tools/list has the eight tools")),
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
