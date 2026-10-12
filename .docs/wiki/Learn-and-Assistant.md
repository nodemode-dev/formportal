# Learn and Assistant

FormPortal teaches itself and the Form apps with tutorials you follow step by step, suggests what to do next on Home, files notices by kind, and lets your own agent answer questions about your apps. Everything stays on your computer; there is no account.

## Tutorials

FormPortal's six tutorials ship inside it (`core/data/learn-portal.json`). The Form apps' tutorials come from `learn.json` beside the catalogue (`https://formai.dev/catalog/v1/learn.json`, or `FORMPORTAL_LEARN`), with a detached Ed25519 signature `learn.json.sig` made with the catalogue's key. When an organisation locks the catalogue, the tutorial index follows it. formai.dev does not publish it yet; that is part of Phase 9 on formai_dev's side.

```json
{
  "format": "formai-learn",
  "format_version": 1,
  "generated": "2026-10-12T00:00:00Z",
  "tutorials": [
    {
      "id": "formcut-first-cut",
      "product": "formcut",
      "title": "Make your first cut",
      "summary": "Import a clip, trim it and export.",
      "minutes": 5,
      "level": "beginner",
      "steps": [
        { "title": "Import a clip", "body": "...", "route": null, "url": "https://..." }
      ]
    }
  ]
}
```

`level` is `beginner`, `intermediate` or `advanced`. A step's `route` names a FormPortal screen (Go there); `url` opens in the browser. Entries with product `formportal`, or with the id of one of FormPortal's own, are ignored.

Progress is `learn-progress.json` in FormPortal's folder: the finished steps of each tutorial. Start again clears one tutorial.

## Suggested for you

The end of Home shows up to three suggestions, worked out on this computer from what is installed, your tutorial progress and your projects folders: the next step of a tutorial you started (or a tutorial for an app you have), choosing a projects folder when there is none, and an app you could install from the same part of the family as yours.

## Notice categories

Every notice is filed under Updates, Installs, Files and library, Agents, Learning or FormPortal. The bell shows one kind at a time. Preferences, General chooses which kinds pop up; the rest only go to the bell. Failures always pop up. The choice is `quiet` in `preferences.json`.

## Ask your agent

The speech bubble in the top bar asks Claude Code or Codex, whichever is on this computer, one question. FormPortal starts it with its own account and with FormPortal's reading server attached:

- Claude Code: `claude -p QUESTION --mcp-config ... --strict-mcp-config --allowedTools mcp__formportal__status ...`, only the reading tools allowed.
- Codex: `codex exec --sandbox read-only` with FormPortal's server added by `-c mcp_servers.formportal...`.

The server is `FormPortal mcp --read-only` (or `formportal mcp --read-only` from the command line): it lists only the tools annotated read-only and refuses the rest, so an answer can describe what to install but never install it. An agent that does not answer within 240 seconds is stopped. From the command line: `formportal ask "QUESTION" [--client claude|codex]`.

## Ask the community

Every app's help links, on Learn and on its page, include Ask the community, which opens the Discussions of its repository in the browser.

## Where to reach it

- Interface: Learn in the sidebar; Suggested for you on Home; the bell; Ask your agent in the top bar.
- Command line: `formportal learn [PRODUCT]`, `learn-step ID --step N [--done false]`, `learn-reset ID`, `ask "QUESTION"`.
- MCP: `learn`, `learn_progress`.
