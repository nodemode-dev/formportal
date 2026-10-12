mod mcp;
mod ops;

use std::io::Write;
use std::process::ExitCode;

use serde_json::{json, Map, Value};

const USAGE: &str = "formportal-cli: FormPortal without the window

  status                          version, platform, install folder, catalogue source, installs
  apps [--source S]               the Form family and what this computer is offered
  info <product> [--source S]     one product's registry entry and releases
  installs                        what is installed
  install <product> [--channel C] [--version V] [--source S] [--allow-unsigned]
  versions <product> [--channel C] [--source S]
  extensions [--extensions-source S]
  extension-install --id ID | --path FILE.formpkg [--allow-unsigned]
  extension-remove --product P --id ID
  extension-enable --product P --id ID --enabled true|false
  updates [--source S]            what has a newer version, and whether it would update itself
  update [<product>] [--channel C] [--automatic-only]
  preferences [--auto-update true|false] [--auto-update-beta ...] [--only-when-closed ...] [--notices ...]
  open <product> [--channel C]
  rollback <product> [--channel C]
  remove <product> [--channel C]
  files [--query Q]               the Form projects in your folders, newest first
  folders | folder-add [PATH] [--create] [--keep-versions false] | folder-remove PATH
  open-file PATH                  open a project in the app that makes it
  file-versions PATH [--action save | --action revert --version ID]
  storage                         what FormPortal and your folders use on disk
  fonts [--query Q] [--fonts-source S]     the open font index and the fonts FormPortal installed
  font-install ID [--style S]     install a family (or one style) for this user
  font-add FILE --rights-confirmed true    add your own TTF or OTF for this user
  font-remove FAMILY [--style S]
  policy                          the organisation's policy, if this computer has one
  app-agents <product> [--channel C]       whether the installed app ships an MCP server, and where it is connected
  connect <product> [--channel C] [--clients claude,codex,cursor]   add it to Claude Code, Codex and Cursor
  disconnect <product> [--channel C] [--clients ...]               take it out again
  app-mcp <product> [--channel C]          run the installed app's MCP server on stdio (what the clients start)
  mirror --to DIR --base-url URL [--platforms macos,windows,linux] [--channels stable,beta] [--history]
                                  copy the catalogue and its files for an internal server;
                                  FORMPORTAL_MIRROR_KEY (base64 Ed25519 seed) signs it
  mcp                            serve the MCP tools on stdin and stdout

  C is stable (default), beta or nightly. S is an https catalogue or a local file.
  FORMPORTAL_ROOT moves the install folder; FORMPORTAL_CATALOG sets the default source.";

fn args_to_json(rest: &[String]) -> Value {
    let mut map = Map::new();
    let mut i = 0;
    while i < rest.len() {
        let a = &rest[i];
        if let Some(key) = a.strip_prefix("--") {
            let key = key.replace('-', "_");
            match rest.get(i + 1).filter(|v| !v.starts_with("--")) {
                Some(v) if key != "allow_unsigned" && key != "automatic_only" => {
                    let value = match v.as_str() {
                        "true" => json!(true),
                        "false" => json!(false),
                        _ => json!(v),
                    };
                    map.insert(key, value);
                    i += 1;
                }
                _ => {
                    map.insert(key, json!(true));
                }
            }
        } else if !map.contains_key("product") {
            map.insert("product".to_string(), json!(a));
        }
        i += 1;
    }
    Value::Object(map)
}

fn main() -> ExitCode {
    let all: Vec<String> = std::env::args().skip(1).collect();
    let Some(cmd) = all.first().cloned() else {
        eprintln!("{USAGE}");
        return ExitCode::from(2);
    };
    if cmd == "mcp" {
        return match mcp::serve() {
            Ok(()) => ExitCode::SUCCESS,
            Err(e) => {
                eprintln!("formportal mcp: {e}");
                ExitCode::FAILURE
            }
        };
    }
    let ctx = ops::Ctx::from_env();
    let args = args_to_json(&all[1..]);
    if cmd == "app-mcp" {
        let run = ops::channel(&args).and_then(|ch| {
            let id = args.get("product").and_then(Value::as_str).unwrap_or_default().to_string();
            ctx.portal.run_app_mcp(&id, ch)
        });
        return match run {
            Ok(code) => ExitCode::from(u8::try_from(code).unwrap_or(1)),
            Err(e) => {
                eprintln!("formportal app-mcp: {e}");
                ExitCode::FAILURE
            }
        };
    }
    let mut last = u64::MAX;
    let mut progress = |have: u64, total: u64| {
        let step = if total > 0 { have * 100 / total } else { 0 };
        if step != last && step % 10 == 0 {
            last = step;
            eprint!("\r{step:>3}% of {total} bytes");
            let _ = std::io::stderr().flush();
        }
    };
    let out = match cmd.as_str() {
        "status" => ops::status(&ctx),
        "apps" => ops::apps(&ctx, &args),
        "info" => ops::info(&ctx, &args),
        "installs" => ops::installs(&ctx),
        "install" => ops::install(&ctx, &args, &mut progress),
        "updates" => ops::updates(&ctx, &args),
        "versions" => ops::versions(&ctx, &args),
        "extensions" => ops::extensions(&ctx, &args),
        "extension-install" => ops::extension_install(&ctx, &args, &mut progress),
        "extension-remove" => ops::extension_remove(&ctx, &args),
        "extension-enable" => ops::extension_enable(&ctx, &args),
        "update" => ops::update(&ctx, &args, &mut progress),
        "preferences" => ops::preferences(&ctx, &args),
        "open" => ops::open(&ctx, &args),
        "rollback" => ops::rollback(&ctx, &args),
        "remove" => ops::remove(&ctx, &args),
        "policy" => ops::policy(&ctx),
        "files" => ops::files(&ctx, &args),
        "folders" => ops::folders(&ctx, &args),
        "folder-add" => {
            let mut a = args.clone();
            if let Some(o) = a.as_object_mut() {
                o.insert("action".to_string(), json!("add"));
                if let Some(p) = o.remove("product") {
                    o.insert("path".to_string(), p);
                }
            }
            ops::folders(&ctx, &a)
        }
        "folder-remove" => {
            let mut a = args.clone();
            if let Some(o) = a.as_object_mut() {
                o.insert("action".to_string(), json!("remove"));
            }
            ops::folders(&ctx, &a)
        }
        "open-file" => ops::open_file(&ctx, &args),
        "file-versions" => ops::file_versions(&ctx, &args),
        "storage" => ops::storage(&ctx),
        "fonts" => ops::fonts(&ctx, &args),
        "font-install" => ops::font_install(&ctx, &args, &mut progress),
        "font-add" => {
            let mut a = args.clone();
            if let Some(o) = a.as_object_mut() {
                if let Some(p) = o.remove("product") {
                    o.insert("path".to_string(), p);
                }
            }
            ops::font_install(&ctx, &a, &mut progress)
        }
        "font-remove" => ops::font_remove(&ctx, &args),
        "app-agents" => ops::app_agents(&ctx, &args),
        "connect" => ops::connect_agents(&ctx, &args),
        "disconnect" => {
            let mut a = args.clone();
            if let Some(o) = a.as_object_mut() {
                o.insert("disconnect".to_string(), json!(true));
            }
            ops::connect_agents(&ctx, &a)
        }
        "mirror" => ops::mirror(&ctx, &args, &mut progress),
        "help" | "--help" | "-h" => {
            println!("{USAGE}");
            return ExitCode::SUCCESS;
        }
        other => {
            eprintln!("unknown command {other:?}\n\n{USAGE}");
            return ExitCode::from(2);
        }
    };
    if (cmd == "install" || cmd == "update" || cmd == "extension-install" || cmd == "mirror" || cmd == "font-install") && last != u64::MAX {
        eprintln!();
    }
    match out {
        Ok(v) => {
            println!("{}", serde_json::to_string_pretty(&v).unwrap_or_default());
            ExitCode::SUCCESS
        }
        Err(e) => {
            eprintln!("{e}");
            ExitCode::FAILURE
        }
    }
}
