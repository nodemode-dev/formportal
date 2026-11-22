# Security policy

## Supported versions

Security fixes go into the newest release. Please update before reporting, and
check whether the problem is still there.

| Version | Supported |
| --- | --- |
| 0.70.x (latest release) | Yes |
| Anything older | No |

## Reporting a vulnerability

**Do not open a public issue for a security problem.** Use GitHub's private
reporting instead: on the repository's **Security** tab, choose **Report a
vulnerability**. Include what you found, the steps to reproduce it, the version and
platform, and what an attacker could do with it.

You can expect an acknowledgement within a week. We will keep you informed while it
is fixed and credit you in the release notes, unless you would rather not be named.

## What counts

FormPortal installs software on your own machine, so the things that matter most are
the ways something outside it could get in:

- **The catalogue**: getting FormPortal to trust a catalogue that was not signed with
  a key it carries, or to accept one that was altered after signing.
- **Downloads**: anything that gets a file past its SHA-256 check, or makes FormPortal
  fetch from an address other than https or this computer.
- **Installing, updating and rolling back**: writing outside the per-user install
  folder, or extracting an archive in a way that escapes where it should go.
- **Links and hand-offs**: a link or a web page opening something, or handing a file
  to an app, without the person agreeing.
- **Organisation policy**: getting past a policy an organisation has set.
- **Keys and tokens** kept in the system keychain: anything that leaks them.

Bugs that need someone to already control your machine, or to run a modified build
of FormPortal, are ordinary bugs: please open an issue for those.

## What FormPortal keeps and sends

FormPortal has no account and no telemetry. It sends no usage data, no crash reports
and no identifiers anywhere. What it does send, and to whom, is below; nothing else
leaves this computer.

- **Your profile** (Preferences, Profile) is kept only on this computer.
- **The supporter code**, if you enter one, is kept in FormPortal's preferences on
  this computer and sent only to formai.studio (`/api/supporter/check`), to be checked:
  when you choose Check, and otherwise at most once a day. The answer is kept beside it.
- **GitHub, if you connect it** (optional; Preferences, Profile, Connect to GitHub):
  FormPortal signs in with GitHub's device flow, and the token GitHub gives it is kept
  in the system keychain (Keychain on macOS, Credential Manager on Windows, the Secret
  Service on Linux) under `FormPortal GitHub`, never in a file. It is never shown to
  the window, never logged, never put in an error message, and sent only to
  `github.com` and `api.github.com`, with a time limit on every request. The scopes:
  - `read:user` when you connect, to show who is connected;
  - `repo` only if you choose Allow sharing, for sharing a Files folder as a private
    repository in your own account and giving a file a public link;
  - `public_repo` only if you choose Set up my extension registry fork and approve it,
    to fork `nodemode-dev/form.ext-registry` into your account. That fork is made only
    when you then choose Fork it now; nothing is forked, created or written before.
  Disconnect removes the token from the keychain; revoke FormPortal under Settings,
  Applications on github.com to withdraw its access there too.
- **API keys for outside services** (Pexels, Pixabay, Freesound, Google Fonts), if you
  give one, are kept in the system keychain and sent only to the service they belong
  to. A stock or font search goes from this computer straight to the service you
  chose; FormPortal does not see or keep what you search for anywhere else.
- **Templates**: the templates list and the files you pick are plain requests to
  GitHub, made only when you ask for them.
- **Update checks**: while FormPortal is open, it fetches the signed catalogue from
  `dl.formai.studio` and each app's newest release manifest from its GitHub releases,
  and asks formai.studio (`/api/upcoming`) what is on the way, at most every 15
  minutes. These requests carry nothing about you or your computer beyond what any web
  request carries.
- **Links** in the window, such as the social links in the sidebar, open in your own
  browser; FormPortal itself makes no request for them.

## Your choices, your responsibility

FormPortal's core, installing, opening, updating, rolling back and removing the Form
apps, works without any outside connection beyond the catalogue and the downloads.
Connecting FormPortal to GitHub, to an agent program or a command-line agent, or to an
outside API is your own choice, always optional, and off until you turn it on. If you
make that choice, you are solely responsible for any damage or harm to your
information, your accounts or your computer that follows from it, including what an
agent you allow does with the access you give it. Give each connection only the
access you need, and remove it when you no longer use it.
