# Getting Started

1. Install Node 20.19 or newer and Rust stable. On Linux, also WebKitGTK 4.1 and its build packages.
2. `./formportal_oc_install` (Windows: `formportal_oc_install.bat`).
3. `./formportal` (Windows: `formportal.bat`). The first start compiles the shell.

To try FormPortal without the published catalogue (`https://dl.formai.studio/catalog/apps.json`), point it at a local catalogue: run formai_dev's site (`./formai_dev`), then in Settings set the catalogue address to `http://127.0.0.1:8240/catalog/v1/apps.json` and tick Developer.

Where installs go: macOS `~/Library/Application Support/studio.formai.portal`, Windows `%LOCALAPPDATA%\FormPortal`, Linux `~/.local/share/formportal`. `FORMPORTAL_ROOT` moves it.
