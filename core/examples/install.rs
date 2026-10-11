use std::io::Write;
use std::path::PathBuf;
use std::process::ExitCode;
use std::{env, fs};

use formportal_core::{Availability, Catalog, Channel, CoreError, Platform, Portal};

fn usage() -> ExitCode {
    eprintln!("usage: install <product> --catalog <file or address> [--channel stable|beta] [--root <folder>] [--allow-unsigned] [--launch | --rollback | --uninstall | --status]");
    ExitCode::from(2)
}

fn run() -> Result<(), CoreError> {
    let args: Vec<String> = env::args().skip(1).collect();
    let product = args.first().filter(|a| !a.starts_with("--")).cloned().unwrap_or_default();
    let value = |flag: &str| args.iter().position(|a| a == flag).and_then(|i| args.get(i + 1)).cloned();
    let has = |flag: &str| args.iter().any(|a| a == flag);
    let channel = match value("--channel").as_deref() {
        Some("beta") => Channel::Beta,
        Some("nightly") => Channel::Nightly,
        _ => Channel::Stable,
    };
    let hub = Portal::new(value("--root").map(PathBuf::from).unwrap_or_else(Portal::default_root));
    if has("--status") {
        for install in hub.state()?.installs {
            let previous = install.previous.map(|p| p.version).unwrap_or_else(|| "-".to_string());
            println!("{} {:?} current {} previous {}", install.product, install.channel, install.current.version, previous);
        }
        return Ok(());
    }
    if has("--rollback") {
        let install = hub.rollback(&product, channel)?;
        println!("rolled back {product} to {}", install.current.version);
        return Ok(());
    }
    if has("--uninstall") {
        hub.uninstall(&product, channel)?;
        println!("removed {product}");
        return Ok(());
    }
    if has("--launch") {
        println!("opened {} as process {}", hub.launch_target(&product, channel)?.display(), hub.launch(&product, channel)?);
        return Ok(());
    }
    let source = value("--catalog").unwrap_or_default();
    let catalog = if source.starts_with("http") {
        hub.catalog(&source, has("--allow-unsigned"))?
    } else {
        Catalog::from_json(&fs::read_to_string(&source)?)?
    };
    let view = catalog.view(&product, channel, Platform::current());
    let (Availability::Available, Some(version), Some(artifact)) = (view.availability, view.version, view.artifact) else {
        return Err(CoreError::Unavailable(format!("{product} on that channel ({:?})", view.availability)));
    };
    let mut last = 0u64;
    let outcome = hub.install(&product, channel, version, artifact, &mut |have, total| {
        let percent = if total > 0 { have * 100 / total } else { 0 };
        if percent >= last + 25 || have == total {
            last = percent;
            print!("\r{percent:>3}% of {total} bytes");
            let _ = std::io::stdout().flush();
        }
    });
    println!();
    let install = outcome?;
    println!("verified SHA-256 {}", install.current.sha256);
    println!("installed {product} {} at {}", install.current.version, install.current.path.display());
    println!("kept {}", install.previous.map(|p| p.version).unwrap_or_else(|| "no earlier version".to_string()));
    println!("opens {}", hub.launch_target(&product, channel)?.display());
    Ok(())
}

fn main() -> ExitCode {
    if env::args().len() < 2 {
        return usage();
    }
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("{e}");
            ExitCode::FAILURE
        }
    }
}
