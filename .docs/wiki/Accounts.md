# Accounts

FormPortal needs no account. Installing, updating, rolling back, Files, Fonts, Stock and everything else work signed out. Signing in to GitHub is optional, and it exists for sharing from Files, which uses the person's own GitHub account as its storage (FormPortal has no server of its own).

## Signing in

Preferences, Account, Sign in with GitHub. FormPortal shows a short code; open github.com (the button does it), enter the code, and approve. FormPortal checks back at the interval GitHub asks for and says when you are signed in. Cancel stops it. The code is good for 15 minutes.

From the command line: `./formportal cli sign-in` prints the address and the code and waits; `./formportal cli account` says who is signed in; `./formportal cli sign-out` forgets it. The MCP server has a read-only `account` tool; it never signs anyone in or out.

## What FormPortal asks for

| When | Scope | Why |
| --- | --- | --- |
| Signing in | `read:user` | to show who is signed in |
| Sharing and public links (from v0.48.0; sign in again with sharing allowed) | `repo` added | to make a private repository in your account and invite people to it; GitHub offers OAuth apps no narrower scope for private repositories |

`sign-in --share true` asks for both at once.

## Where the sign-in is kept

In the system keychain: Keychain on macOS, Credential Manager on Windows, and the Secret Service (GNOME Keyring, KWallet) on Linux, under `FormPortal GitHub`. If the computer has no keychain service, FormPortal refuses to sign in before showing a code, rather than keeping the token in a file. Sign out removes it.

## The GitHub app

FormPortal signs in through a GitHub OAuth app that belongs to the `nodemode-ai` organisation, with device flow turned on. Its client ID is public and is compiled in from `core/github_client.txt` (one line). Until it is there, Preferences says signing in is not set up. formcompiler's `docs/ACCOUNTS.md` says how the app is registered. For testing, `FORMPORTAL_GITHUB_CLIENT_ID` sets the client ID, and `FORMPORTAL_GITHUB_WEB` and `FORMPORTAL_GITHUB_API` point at a stand-in on this computer (only https, or http on this computer, is ever fetched).
