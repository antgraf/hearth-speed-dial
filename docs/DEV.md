# Developer notes

## Isolated browser profiles

Use these scripts to install, reload, or remove the packed/unpacked extension **without touching your personal Chrome or Firefox profile**. Profiles live under `.browser-profiles/` in the repo (gitignored). The scripts create that directory if it is missing.

Requires Node 22+ (same as the rest of the repo). Works on Windows, macOS, and Linux when the browser binary is installed or pointed at via env / `--binary`.

### Chrome

Build, then launch Chrome with `--user-data-dir` pointing at `.browser-profiles/chrome` and `--load-extension` pointing at `dist/chrome/`:

```bash
npm run build
npm run browser:chrome
```

```powershell
npm run build
npm run browser:chrome
# or: .\build.ps1 ; .\launch-chrome.ps1
# Chrome-only: .\build.ps1 -Target Chrome
```

Useful flags (pass after `--` for npm):

| Flag | Meaning |
| --- | --- |
| `--no-ext` | Do not auto-load `dist/chrome/`; open `chrome://extensions` → **Load unpacked** yourself |
| `--ext <path>` | Load a different extension directory (default: `<repo>/dist/chrome`) |
| `--profile <path>` | Override the isolated profile directory |
| `--binary <path>` | Chrome/Chromium binary (or set `CHROME_PATH`) |
| `--foreground` | Keep the npm process attached until the browser exits |
| `-h` / `--help` | Print help |

Examples:

```bash
npm run browser:chrome -- --no-ext
npm run browser:chrome -- --binary /usr/bin/chromium
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run browser:chrome
```

After a rebuild, either restart with `npm run browser:chrome` (fresh `--load-extension`) or, in the already-open window, open `chrome://extensions` and click **Reload** on the Hearth card.

To test a **fresh install** (permissions / first-run), reset the isolated profile then relaunch:

```bash
npm run browser:reset -- chrome
npm run build && npm run browser:chrome
```

### Firefox

Build the Firefox tree (`dist/firefox/`), then open an isolated profile and load a **temporary add-on**. Requires Firefox **121+**. `web-ext` is not in this repo and is not required. Default `npm run build` / `.\build.ps1` already produces both targets.

```powershell
.\build.ps1
npm run browser:firefox
# or: .\launch-firefox.ps1
# Firefox-only (still runs the Chrome Vite tree as input): .\build.ps1 -Target Firefox
```

```bash
npm run build
npm run browser:firefox
```

Then in the opened debugging page (`about:debugging#/runtime/this-firefox`):

1. Click **Load Temporary Add-on…**
2. Select `<repo>/dist/firefox/manifest.json` (not `dist/chrome/`)
3. Remove the temporary add-on from that page when finished, or close Firefox / run `npm run browser:reset -- firefox`

Flags: `--profile`, `--binary` (or `FIREFOX_PATH`), `--foreground`, `--help`.

### Reset profiles

```bash
npm run browser:reset              # both chrome and firefox under .browser-profiles/
npm run browser:reset -- chrome
npm run browser:reset -- firefox
npm run browser:reset -- all
```

```powershell
.\reset-browser-profiles.ps1 chrome
```

Only deletes `.browser-profiles/<name>` inside this repository. It never touches OS default profiles under `~/Library/...`, `%LOCALAPPDATA%`, or `~/.config/...`.

### Platform notes

| OS | Chrome discovery | Firefox discovery |
| --- | --- | --- |
| Linux | `google-chrome-stable`, `google-chrome`, `chromium`, `chromium-browser`, `chrome` on `PATH`, then common `/usr/bin` paths | `firefox`, `firefox-esr` on `PATH`, then `/usr/bin` / snap |
| macOS | `/Applications/Google Chrome.app/...` (and Chromium / Canary), or `PATH` | `/Applications/Firefox.app/...` (and Dev / Nightly), or `PATH` |
| Windows | `%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe`, Program Files, or `PATH` | `Program Files\Mozilla Firefox\firefox.exe`, or `PATH` |

Override with `CHROME_PATH` / `FIREFOX_PATH` or `--binary` when discovery fails (Flatpak, custom installs, Chrome Canary-only machines).

Manual product checks after load: [smoke-checklist.md](smoke-checklist.md).

## Cross-browser API notes

- Runtime code resolves `browser` before `chrome` (`src/webext.ts`) so Firefox gets promise-based APIs.
- Chrome root `manifest.json` stays the Chrome source of truth; Firefox packaging is generated (`scripts/firefox-manifest.mjs` → `dist/firefox/`).
- Title-strip favicons stay Chrome-only (`favicon` + `/_favicon/`). Firefox omits them without adding host permissions.
- Optional thumbnail / URL-image permission UX can differ on Firefox (may re-prompt more often after revoke); degrade gracefully either way.

## Follow-ups (not blocking Firefox)

- **`_locales` scaffolding** — English message extract for store locale fields and later translations is a separate Pre-publish item. Firefox packaging does not require it yet.
- AMO listing screenshots, privacy policy text, and reviewer permissions narrative are separate Pre-publish lanes.
