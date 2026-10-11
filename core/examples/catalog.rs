use std::{env, fs, process::ExitCode};

use formportal_core::{Catalog, Channel, Platform, CORE_VERSION};

fn main() -> ExitCode {
    let Some(path) = env::args().nth(1) else {
        eprintln!("usage: catalog <path to apps.json>");
        return ExitCode::from(2);
    };
    let text = match fs::read_to_string(&path) {
        Ok(text) => text,
        Err(e) => {
            eprintln!("could not read {path}: {e}");
            return ExitCode::FAILURE;
        }
    };
    let catalog = match Catalog::from_json(&text) {
        Ok(catalog) => catalog,
        Err(e) => {
            eprintln!("{e}");
            return ExitCode::FAILURE;
        }
    };
    let platform = Platform::current();
    println!("formportal-core {CORE_VERSION} on {platform:?}, catalogue of {} (fixture: {})", catalog.generated, catalog.fixture);
    for product in &catalog.products {
        for channel in [Channel::Stable, Channel::Beta] {
            let view = catalog.view(&product.id, channel, platform);
            let file = view.artifact.map(|a| a.file.as_str()).unwrap_or("-");
            let channel = format!("{channel:?}");
            let availability = format!("{:?}", view.availability);
            println!("{:<8} {channel:<7} {availability:<14} {:<14} {file}", product.id, view.version.unwrap_or("-"));
        }
    }
    ExitCode::SUCCESS
}
