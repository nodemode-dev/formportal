---
name: install-and-update
description: Installing, updating, opening, rolling back and removing Form apps with FormPortal. Use when the person wants a Form app installed or updated, an update undone, an app opened, or an app removed, or when install, open, rollback or remove fails.
---

# install-and-update

## Install or update

`install {product, channel?}`. An update is an install of the newer version the catalogue offers; FormPortal keeps the version it replaces. Before calling:

1. `apps` shows `available` for that channel. Anything else: stop and say which state it is in.
2. Tell the person the version and the size, and get a yes.

The result carries `installed.current` (version, path, SHA-256), `installed.previous` (what rollback would return to) and `opens` (the file `open` will start). A release FormPortal cannot unpack yet (a dmg, msi or deb) fails with "this build cannot install a ... file yet": point the person to the app's download page on formai.dev.

## Open

`open {product, channel?}` starts the installed app and returns its process id. Only when asked. On macOS the first start of an unsigned build may be stopped by the system; the person allows it once under Privacy and Security.

## Roll back

`rollback {product, channel?}` swaps current and previous. It fails when no previous version is kept (a first install). After it, `installs` shows the older version as current; rolling back again returns to the newer one.

## Remove

`remove {product, channel?}` deletes the channel's install folder, the kept previous version included. The app's own documents and settings live elsewhere and stay. Confirm with the person, naming what will be deleted.

## Open apps

FormPortal checks for open copies (`installs` lists their `open_processes`).

- **Update while open:** allowed. The new version unpacks into its own folder and the open copy keeps running from the old one; the result carries `still_open` and a `note`. Tell the person the new version opens next time they start the app.
- **Reinstalling the version that is open, or remove:** refused with "[app] is open (process ...); close it first". Ask the person to close the app, then retry. Never end the process yourself.
- **Rollback while open:** allowed; it changes which version opens next time, not the open copy.
