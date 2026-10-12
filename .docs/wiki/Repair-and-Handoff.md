# Repair and Handoff

## Check and repair

Preferences, About, Check and repair (or `formportal cli repair`, or the `repair` MCP tool) checks:

| Kind | Found when | Repair |
| --- | --- | --- |
| missing | an install record's folder is gone | install the same version again if the catalogue still offers that exact file (same SHA-256), otherwise forget the record |
| broken | the folder has nothing FormPortal can open | the same as missing |
| previous | the kept earlier version is gone | forget it, so Go back is not offered |
| leftover | a version folder no record points to | delete it |
| staging | an install that did not finish (`.tmp`) | delete it |
| download | a download that was not cleaned up | delete it |

Nothing outside FormPortal's folder is touched, nothing younger than ten minutes, and nothing a running app uses. There is no hosts file or registry to repair: each install is one folder and one record.

For administrators, `formportal cli repair` reports as JSON and changes nothing, and `formportal cli repair --fix` repairs, both with no window.

## Update when I close it

When an update waits, an app's More menu offers Update when I close it. FormPortal installs it once the app is closed, whatever the automatic-update setting: at its next start, and every five minutes while it is open. Cancel the later update undoes it. The list is `later.json` in FormPortal's folder; `formportal cli later APP [--off]` and the `update` tool's `later` do the same.

## Links from a web page

A web page can link to FormPortal:

- `formai://app/<id>`: the app's page, with Install, Update or Open.
- `formai://apps`, `updates`, `beta`, `extensions`, `settings`: those screens.
- `formai://file/<id>?url=<encoded https address>`: FormPortal asks first, then downloads the file into From the web in the first projects folder and opens it in its app. Only Form project files (by the registry's extensions, such as `.fc`) are accepted, from https or this computer, up to 4 GB. If the app is not installed, its page opens with a notice instead.

On Linux the browser hands the link to the system, which starts FormPortal through the `x-scheme-handler/formai` entry the app registers. From the command line: `formportal cli open-url URL [--check] [--no-open]`.
