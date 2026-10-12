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
  policy                          the organisation's policy, if this computer has one
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
    if (cmd == "install" || cmd == "update" || cmd == "extension-install" || cmd == "mirror") && last != u64::MAX {
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
