# Security policy

## Supported versions

Security fixes go into the newest release. Please update before reporting, and
check whether the problem is still there.

| Version | Supported |
| --- | --- |
| 0.54.x (latest release) | Yes |
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
