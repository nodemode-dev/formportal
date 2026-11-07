use formportal_cli::{mcp, ops};

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
  extensions [--extensions-source S]   form.ext-registry's signed index (or S, or FORMPORTAL_EXTENSIONS), checked
                                  with registry keys (registry_keys.txt, FORMEXT_REGISTRY_PUBKEY) and its block list
  extension-install --id ID | --path FILE.formpkg [--allow-unsigned]
  extension-remove --product P --id ID
  extension-enable --product P --id ID --enabled true|false
                                  P: formvis formcut formwav formpdf formdeck formlit formmd formencoder
                                  formvfx formmcp formtray formskills formportal; the app picks changes up live
  updates [--source S]            what has a newer version, and whether it would update itself
  update [<product>] [--channel C] [--automatic-only]
  preferences [--auto-update true|false] [--auto-update-beta ...] [--only-when-closed ...] [--notices ...] [--open-at-login ...]
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
  media [--query Q] [--kind image|video|audio|template] [--media-source S]   open-licensed media and templates
  media-save ID                   save an item into your Library with its credit line
  template-use ID [--folder DIR]  copy a template into your projects folder and open it
  media-remove ID
  watch [--interval 3] [--rounds N]       keep a version of each project as it is saved (in folders that keep versions); one JSON line per version
  repair [--fix]                  check installs and FormPortal's folders; --fix repairs (JSON, for scripts)
  later <product> [--channel C] [--off]   put an update off until the app is closed, or cancel that
  open-url URL [--check] [--no-open]      download a Form project file from the web into your projects folder and open it
  learn [PRODUCT] [--query Q] [--learn-source S]   tutorials and the steps you have finished
  learn-step ID --step N [--done false]   mark a step finished (or not); steps count from 1
  learn-reset ID                  clear a tutorial's progress
  ask \"QUESTION\" [--client claude|codex]   ask your own agent about your Form apps; it can only read
  policy                         the organisation's policy, if this computer has one
  account                        whether you are signed in to GitHub, and as whom (optional; nothing needs it to install)
  sign-in [--share true]         sign in to GitHub with a code you enter on github.com; --share also asks for repository access
  sign-out                       forget the GitHub sign-in (removes it from the system keychain)
  shares                         your shared libraries, libraries shared with you, invitations and public links
  share FOLDER [--invite a,b]    share a Files folder as a private repository in your GitHub account, sending its files and inviting people
  share-send FOLDER              send a shared folder's changed files again
  share-accept ID                accept an invitation to a library and download it into Shared in your projects folder
  share-pull OWNER/REPO          download the latest of a library shared with you
  publish FILE | unpublish FILE  give a file a public link (in formportal-public in your account), or remove it
  app-agents <product> [--channel C]       whether the installed app ships an MCP server, and where it is connected
  connect <product> [--channel C] [--clients claude,codex,cursor]   add it to Claude Code, Codex and Cursor
  disconnect <product> [--channel C] [--clients ...]               take it out again
  app-mcp <product> [--channel C]          run the installed app's MCP server on stdio (what the clients start)
  org-package --policy FILE --installer FILE --to DIR
                                  one folder for a managed rollout: FormPortal's msi, dmg, deb, rpm or AppImage,
                                  the policy, their SHA-256 sums and an install script that puts the policy first
  mirror --to DIR --base-url URL [--platforms macos,windows,linux] [--channels stable,beta] [--history]
                                  copy the catalogue and its files for an internal server;
                                  FORMPORTAL_MIRROR_KEY (base64 Ed25519 seed) signs it
  mcp [--read-only]              serve the MCP tools on stdin and stdout (only the reading tools with --read-only)

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

fn positional(args: &Value, key: &str) -> Value {
    let mut a = args.clone();
    if let Some(o) = a.as_object_mut() {
        if let Some(p) = o.remove("product") {
            o.entry(key.to_string()).or_insert(p);
        }
    }
    a
}

fn emit(text: &str) {
    let mut out = std::io::stdout().lock();
    if writeln!(out, "{text}").and_then(|()| out.flush()).is_err() {
        std::process::exit(0);
    }
}

fn main() -> ExitCode {
    let all: Vec<String> = std::env::args().skip(1).collect();
    let Some(cmd) = all.first().cloned() else {
        eprintln!("{USAGE}");
        return ExitCode::from(2);
    };
    if cmd == "mcp" {
        return match mcp::serve_with(all.iter().any(|a| a == "--read-only")) {
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
        let step = (have * 100).checked_div(total).unwrap_or(0);
        if step != last && step.is_multiple_of(10) {
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
        "account" => ops::account(),
        "sign-in" => ops::sign_in(&args, &mut |code| {
            eprintln!("Open {} and enter the code {} (it expires in {} minutes).", code.verification_uri, code.user_code, code.expires_in / 60);
        }),
        "sign-out" => ops::sign_out(),
        "shares" => ops::shares(&ctx),
        "share" => ops::share(&ctx, &positional(&args, "folder")),
        "share-send" => ops::share_send(&ctx, &positional(&args, "folder")),
        "share-accept" => ops::share_accept(&ctx, &positional(&args, "id")),
        "share-pull" => ops::share_pull(&ctx, &positional(&args, "repo")),
        "publish" => ops::publish(&ctx, &positional(&args, "file")),
        "unpublish" => ops::unpublish(&ctx, &positional(&args, "file")),
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
        "media" => ops::media(&ctx, &args),
        "media-save" => ops::media_save(&ctx, &args, &mut progress),
        "template-use" => {
            let mut a = args.clone();
            if let Some(o) = a.as_object_mut() {
                o.insert("use".to_string(), json!(true));
            }
            ops::media_save(&ctx, &a, &mut progress)
        }
        "media-remove" => ops::media_remove(&ctx, &args),
        "repair" => ops::repair(&ctx, &args, &mut progress),
        "watch" => ops::watch(&ctx, &args, &mut |line| emit(&line.to_string())),
        "later" => {
            let mut a = args.clone();
            if let Some(o) = a.as_object_mut() {
                let on = !o.contains_key("off");
                o.insert("later".to_string(), json!(on));
            }
            ops::update(&ctx, &a, &mut progress)
        }
        "open-url" => ops::web_file(&ctx, &args, &mut progress),
        "learn" => ops::learn(&ctx, &args),
        "learn-step" => ops::learn_progress(&ctx, &args),
        "learn-reset" => {
            let mut a = args.clone();
            if let Some(o) = a.as_object_mut() {
                o.insert("reset".to_string(), json!(true));
            }
            ops::learn_progress(&ctx, &a)
        }
        "ask" => match std::env::current_exe() {
            Ok(exe) => ops::ask(&ctx, &args, exe, vec!["mcp".to_string(), "--read-only".to_string()], mcp::read_only_tools()),
            Err(e) => Err(formportal_core::CoreError::Io(e)),
        },
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
        "org-package" => ops::org_package(&args),
        "help" | "--help" | "-h" => {
            emit(USAGE);
            return ExitCode::SUCCESS;
        }
        other => {
            eprintln!("unknown command {other:?}\n\n{USAGE}");
            return ExitCode::from(2);
        }
    };
    if (cmd == "install" || cmd == "update" || cmd == "extension-install" || cmd == "mirror" || cmd == "font-install" || cmd == "media-save" || cmd == "template-use") && last != u64::MAX {
        eprintln!();
    }
    match out {
        Ok(v) => {
            emit(&serde_json::to_string_pretty(&v).unwrap_or_default());
            ExitCode::SUCCESS
        }
        Err(e) => {
            eprintln!("{e}");
            ExitCode::FAILURE
        }
    }
}
