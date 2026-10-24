# Languages and Launch

## Interface language

Preferences, General, Language: English, or Español (borrador). The Spanish is a first draft that a Spanish speaker has not reviewed yet, and some messages (the notices in the bell, tutorial text, error messages from the engine) are still in English. The choice is `language` in `preferences.json` (`null` for English, `"es"` for Spanish).

How it works, so the first frame is already in the chosen language:

- English text is the key. `frontend/src/i18n/es.json` holds the table: `strings` maps an English text to its Spanish, and `patterns` covers the sentences that repeat for every app (`{app} beta`, `Instead of {x}`).
- At build time, `vite.config.ts` writes `es/index.html` from the finished English page, translating text and the `aria-label`, `placeholder`, `title` and `data-title` attributes. The dev server serves `/es/index.html` the same way.
- Text set while FormPortal runs (app statuses, extension buttons, Learn's labels) goes through `t()` in `src/i18n`.
- The desktop app reads the preference before it creates its window and opens `index.html` or `es/index.html`. Changing the language in Preferences saves it and loads the other page, the way Creative Cloud restarts for a new language.

### Adding or reviewing a language

1. Copy `es.json` to `xx.json`, set `language`, `name` and `reviewed`, and translate every value. Keep `{placeholders}` as they are.
2. Register it in `src/i18n/index.ts` and in `vite.config.ts`'s `TABLES`, add a button in Preferences, and extend `Preferences::page` in `core/src/prefs.rs`.
3. A speaker reviews the text in the running app (every screen, Preferences, the dialogs), then `reviewed` becomes true and `(borrador)` leaves the name.

## Opening where you left off

Preferences, General, When FormPortal opens: Home (the default) or Where I left off. The second remembers the last screen (an app's page counts as Apps) and opens on it. `public/prepaint.js` reads `formportal-open` and `formportal-last` from the window's storage before anything is drawn and sets `data-launch`; the stylesheet shows that screen and its sidebar entry; the router then takes over without anything moving. A `formai://` link still wins.

## Opening at login

Preferences, General, Open FormPortal when I log in (off by default, from v0.46.0). On, the window adds a login item that opens it and nothing else: `~/.config/autostart/formportal.desktop` on Linux (or under `$XDG_CONFIG_HOME`), `~/Library/LaunchAgents/dev.formai.portal.login.plist` on macOS, and the `FormPortal` value under `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` on Windows. Off removes it. The command line and MCP can set `open_at_login` too; the window applies it the next time it starts, and every start points the item at the program's current path. FormPortal still runs only while it is open.
