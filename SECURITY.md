# Security policy

## Supported versions

Security fixes go into the newest release. Please update before reporting, and
check whether the problem is still there.

| Version | Supported |
| --- | --- |
| 0.71.x (latest release) | Yes |
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
  when you choose Check (or Check again), and otherwise once when FormPortal starts,
  only if Ask formai.studio what is on the way is on. The answer is kept beside it, and
  a supporter's upcoming names are shown for 7 days after the last check (or until the
  code's own end date, if sooner); after that Profile says to press Check again.
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
  give one, are kept in the system keychain under `FormPortal keys` and sent only to
  the service they belong to. They are never shown to the window, never logged and
  never written to a file. Openverse, ccMixter and Fontsource need no key.
- **Stock** (Stock & templates): a search goes from this computer straight to the
  sources you chose (`api.pexels.com`, `pixabay.com`, `api.openverse.org`,
  `freesound.org`, `ccmixter.org`). The thumbnails, previews and files you save are
  then fetched by FormPortal from the addresses that answer gave: the service's own
  media servers, or for Openverse the site that holds the original (Flickr, Wikimedia
  Commons and others). Those requests carry no key. Answers are kept in memory for
  24 hours; FormPortal does not keep what you search for anywhere else.
- **Fonts**: nothing is asked of a font source until you press Browse Fontsource or
  Browse Google Fonts on the Fonts page. Browse Fontsource reads Fontsource's public
  catalogue from `api.fontsource.org`; a family's licence and files come from
  `cdn.jsdelivr.net`. A catalogue read is kept in memory for the rest of the run, so
  switching sources or coming back to Fonts asks nothing again. Google Fonts is used
  only with your own key:
  the catalogue comes from `www.googleapis.com`, the files from `fonts.gstatic.com`,
  and each family's licence from Fontsource's copy at `cdn.jsdelivr.net`. A family is
  installed only when its licence is stated and is OFL-1.1, Apache-2.0 or MIT.
- **Templates**: the list of templates and demos comes from the public repository
  `nodemode-dev/formai-templates` at `raw.githubusercontent.com`, only when you choose
  Get the list or Check again, and is then kept on this computer. Each file is fetched
  from there only when you choose Download, with no account, and is kept only if its
  size and SHA-256 match the list.
- **Update checks**: while FormPortal is open, it fetches the signed catalogue from
  `dl.formai.studio` and each app's newest release manifest from its GitHub releases.
  These requests carry nothing about you or your computer beyond what any web request
  carries.
- **What is on the way**: by default FormPortal asks formai.studio nothing about it
  and shows the schedule it was built with, and it learns that the launch is complete
  from the signed catalogue it reads anyway. Only if you turn on Preferences, General,
  Ask formai.studio what is on the way does it ask formai.studio (`/api/upcoming`),
  once each time it starts (and once when you turn the switch on), never again in that
  run. The command line and the MCP server ask only when given `--ask-site`
  (`ask_site`).
- **Links** in the window open in your own browser, and only addresses on FormPortal's
  list (`core/src/links.rs`) open; FormPortal itself makes no request for them. These
  include the nine social links in the sidebar (formai.studio, YouTube, two Reddit
  pages, Instagram, Threads, TikTok, X and Discord), the stock sources' pages and key pages,
  Creative Commons licence pages, Google Cloud's credentials page and GitHub's
  application settings. Request a new Form App opens a GitHub discussion page in your
  browser with your words filled in; FormPortal sends nothing itself, and nothing is
  posted until you press Start discussion there.
- **Every host FormPortal itself may contact**: `dl.formai.studio` and `formai.studio`
  (the catalogue, the store, what is on the way, the supporter check); `github.com`,
  `raw.githubusercontent.com` and the download hosts GitHub hands its release files
  to (app releases, extensions from `nodemode-dev/form.ext-registry`, templates);
  `api.github.com` (only if you connect GitHub); `api.fontsource.org`,
  `cdn.jsdelivr.net`, `www.googleapis.com` and `fonts.gstatic.com` (fonts);
  `api.pexels.com`, `pixabay.com`, `api.openverse.org`, `freesound.org`,
  `ccmixter.org` and the media addresses their answers give (stock).

## Your choices, your responsibility

FormPortal's core, installing, opening, updating, rolling back and removing the Form
apps, works without any outside connection beyond the catalogue and the downloads.
Connecting FormPortal to GitHub, to an agent program or a command-line agent, or to an
outside API is your own choice, always optional, and off until you turn it on. If you
make that choice, you are solely responsible for any damage or harm to your
information, your accounts or your computer that follows from it, including what an
agent you allow does with the access you give it. Give each connection only the
access you need, and remove it when you no longer use it.
