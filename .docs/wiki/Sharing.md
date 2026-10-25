# Sharing

From v0.48.0, FormPortal shares through your own GitHub account. There is no FormPortal server: what you share lives in repositories you own, and you can see, change or delete them on github.com like any other. Signing in is described in [Accounts](Accounts); sharing needs the repository access FormPortal asks for when you sign in with sharing allowed.

## Share a folder

Files, Folders, Share. FormPortal makes a private repository named `formportal-library-[folder name]` in your account, sends the folder's files to it, and invites the GitHub users you name. Run Share again to send what changed: only files whose content changed are sent. Files whose names start with a dot stay on your computer, and so do files over 100 MB. Only folders listed in Files can be shared.

Command line: `./formportal cli share "/path/to/folder" --invite riley,sam`, and `share-send` for the changes.

## Shared with you

When someone shares with you, the invitation appears at the bottom of Files under Shared with you. Accept downloads the library into `Shared/[name] from [owner]` inside your projects folder and adds it to Files. Get the latest downloads what changed since; a file you changed in that folder is replaced by the shared version, so keep your own edits elsewhere.

Command line: `./formportal cli shares`, `share-accept ID`, `share-pull OWNER/REPO`.

## Public links

A file's Public link puts it in one public repository in your account, `formportal-public`, and gives you a github.com link anyone can open. Remove the link deletes it there. Command line: `publish FILE` and `unpublish FILE`.

## Your portfolio

The front page of `formportal-public` is your portfolio: FormPortal rewrites its `README.md` whenever you add or remove a public link, with each file's name linking to its own page and pictures shown inline. The Public link dialog shows its address, and so does `shares` on the command line (`portfolio`).

## What is kept where

`shares.json` in FormPortal's folder remembers what you shared, what was shared with you, and your public links. GitHub keeps the files and their history, so a removed link or file can still be in the repository's history; delete the repository on github.com to remove everything.
