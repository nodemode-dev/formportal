# Connect to GitHub

FormPortal needs no account. Installing, updating, rolling back, Files, Fonts, Stock and everything else work without GitHub. Connecting to GitHub is optional, and it exists for sharing from Files, which uses the person's own GitHub account as its storage (FormPortal has no server of its own), and for setting up the person's own fork of form.ext-registry.

## Connecting

Preferences, Profile, Connect to GitHub. The part is shown only in a build with a GitHub app set up (below); without one it is not there at all. Before you connect, it says what will happen. FormPortal shows a short code; open github.com (the button does it), enter the code, and approve. FormPortal checks back at the interval GitHub asks for and says who is connected. Cancel stops it. The code is good for 15 minutes. Disconnect removes the token from the keychain; to withdraw FormPortal's access on GitHub as well, revoke it under Settings, Applications on github.com.

## Your extension registry fork

Once connected, Set up my extension registry fork says first what it will do and which permission it needs. If GitHub has not given FormPortal `public_repo` yet, Approve on GitHub asks for it with a new code. Only Fork it now forks `nodemode-dev/form.ext-registry` into your account (`POST /repos/nodemode-dev/form.ext-registry/forks`, after `GET /repos/<you>/form.ext-registry` to see whether you have one already). It then shows the fork's address and the next steps from the registry's [SUBMITTING.md](https://github.com/nodemode-dev/form.ext-registry/blob/main/SUBMITTING.md), and opens form.ext if it is installed.

From the command line: `./formportal cli sign-in` prints the address and the code and waits; `./formportal cli account` says who is signed in; `./formportal cli sign-out` forgets it. The MCP server has a read-only `account` tool; it never signs anyone in or out.

## What FormPortal asks for

| When | Scope | Why |
| --- | --- | --- |
| Connecting | `read:user` | to show who is connected |
| Sharing and public links (from v0.48.0; connect again with sharing allowed) | `repo` added | to make a private repository in your account and invite people to it; GitHub offers OAuth apps no narrower scope for private repositories |
| Your extension registry fork (from v0.71.0; only after you confirm) | `public_repo` added | to fork the public `nodemode-dev/form.ext-registry` into your account; the narrowest scope that can fork a public repository. `repo` covers it too |

`sign-in --share true` asks for both at once.

## Where the sign-in is kept

In the system keychain: Keychain on macOS, Credential Manager on Windows, and the Secret Service (GNOME Keyring, KWallet) on Linux, under `FormPortal GitHub`. If the computer has no keychain service, FormPortal refuses to sign in before showing a code, rather than keeping the token in a file. Disconnect removes it. The token is never given to the window, never logged and never put in an error message; every request that carries it goes only to `github.com` or `api.github.com` (or the stand-in on this computer below), with a time limit.

## The GitHub app

FormPortal signs in through a GitHub OAuth app that belongs to the `nodemode-dev` organisation, with device flow turned on and user tokens that do not expire. Its client ID is public and is compiled in from `core/github_client.txt` (one line); builds from 0.71.1 carry it, so Preferences, Profile shows Connect to GitHub. A build made without it shows no Connect to GitHub part at all, and everything else works. Nothing is sent to GitHub until you press Connect to GitHub. formcompiler's `docs/ACCOUNTS.md` says how the app is registered. For testing, `FORMPORTAL_GITHUB_CLIENT_ID` sets the client ID, and `FORMPORTAL_GITHUB_WEB` and `FORMPORTAL_GITHUB_API` point at a stand-in on this computer (only https, or http on this computer, is ever fetched).
