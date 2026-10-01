# Developer notes

## Isolated browser profiles

Use these scripts to install, reload, or remove the packed/unpacked extension **without touching your personal Chrome, Firefox, or Edge profile**. Profiles live under `.browser-profiles/` in the repo (gitignored). The scripts create that directory if it is missing.

Requires Node 22+ (same as the rest of the repo). Works on Windows, macOS, and Linux when the browser binary is installed or pointed at via env / `--binary`.

### Chrome

**Official Chrome 137+ ignores `--load-extension`** (and Chrome 139+ also ignores `--disable-extensions-except`). On Anton's Windows Stable build, the reliable flow is: isolated profile → **Load unpacked** → `dist/chrome/`.

```powershell
.\pull_and_build.ps1   # or: .\build.ps1 / .\build.ps1 -Target Chrome
.\reset-browser-profiles.ps1 chrome   # fresh install / first-run only
.\launch-chrome.ps1
```

```bash
npm run build
npm run browser:reset -- chrome   # fresh install / first-run only
npm run browser:chrome
```

In the opened window:

1. Open `chrome://version` and confirm **Profile Path** contains `.browser-profiles\chrome` (or `.browser-profiles/chrome`). If it points at your personal User Data, you are in the wrong window — quit all Chrome windows and relaunch.
2. On `chrome://extensions`: Developer mode ON → **Load unpacked** → select **`dist/chrome`** (the folder that **directly** contains `manifest.json`).
3. Open a new tab — it should be Hearth, not the default NTP.

**Wrong Load unpacked folders (common after #40):**

| Folder | Result |
| --- | --- |
| `dist/chrome/` | Correct |
| `dist/` | No `manifest.json` at this level (only `chrome/` + `firefox/` children) |
| `dist/firefox/` | Firefox tree — not for Chrome |
| Repo root | Has a source `manifest.json` but no built `background.js` / `index.html` — broken install |

If a personal profile still has Hearth pointed at the **old** pre-#40 path (`…\dist` instead of `…\dist\chrome`), remove that card and Load unpacked again from `dist/chrome`, or hit **Reload** only after the stored path already ends in `dist\chrome`.

Useful flags (pass after `--` for npm; for the `.ps1` wrapper pass flags directly, e.g. `.\launch-chrome.ps1 --load-ext`):

| Flag | Meaning |
| --- | --- |
| *(default)* | Open isolated profile + `chrome://extensions`; Load unpacked yourself |
| `--no-ext` | Same as default (kept for older docs) |
| `--load-ext` | Pass `--load-extension` (Chromium / Chrome for Testing only — ignored on official Chrome 137+) |
| `--ext <path>` | Same as `--load-ext` with a custom directory (default target is `<repo>/dist/chrome`) |
| `--profile <path>` | Override the isolated profile directory |
| `--binary <path>` | Chrome/Chromium binary (or set `CHROME_PATH`) |
| `--foreground` | Keep the npm / pwsh process attached until the browser exits |
| `-h` / `--help` | Print help |

Examples:

```powershell
.\launch-chrome.ps1
.\launch-chrome.ps1 --binary "C:\Path\To\chrome.exe"
```

```bash
npm run browser:chrome -- --load-ext
npm run browser:chrome -- --binary /usr/bin/chromium
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run browser:chrome
```

After a rebuild in an already-open isolated window, open `chrome://extensions` and click **Reload** on the Hearth card (path must already be `dist/chrome`).

To test a **fresh install** (permissions / first-run welcome):

```powershell
.\reset-browser-profiles.ps1 chrome
.\build.ps1 -Target Chrome
.\launch-chrome.ps1
# then Load unpacked → dist/chrome
```

### Microsoft Edge

Edge is Chromium-based and uses the **same Chrome MV3 build** (`dist/chrome/`). There is no separate Edge dist or pack pipeline. Same Load unpacked flow as Chrome; isolated profile lives under `.browser-profiles/edge`.

```powershell
.\pull_and_build.ps1   # or: .\build.ps1 / .\build.ps1 -Target Chrome
.\reset-browser-profiles.ps1 edge   # fresh install / first-run only
.\launch-edge.ps1
```

```bash
npm run build
npm run browser:reset -- edge   # fresh install / first-run only
npm run browser:edge
```

In the opened window:

1. Open `edge://version` and confirm **Profile Path** contains `.browser-profiles\edge` (or `.browser-profiles/edge`). If it points at your personal User Data, quit all Edge windows and relaunch.
2. On `edge://extensions`: Developer mode ON → **Load unpacked** → select **`dist/chrome`** (same folder as Chrome).
3. Open a new tab — it should be Hearth, not the default NTP.

Flags match Chrome (`--load-ext`, `--ext`, `--no-ext`, `--profile`, `--binary` / `EDGE_PATH` / `MSEDGE_PATH`, `--foreground`, `--help`). Edge (Chromium 137+) typically ignores `--load-extension` the same way official Chrome does — prefer Load unpacked.

```powershell
.\launch-edge.ps1
.\launch-edge.ps1 --binary "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
```

```bash
npm run browser:edge
EDGE_PATH="/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" npm run browser:edge
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
npm run browser:reset              # chrome, firefox, and edge under .browser-profiles/
npm run browser:reset -- chrome
npm run browser:reset -- firefox
npm run browser:reset -- edge
npm run browser:reset -- all
```

```powershell
.\reset-browser-profiles.ps1 chrome
.\reset-browser-profiles.ps1 edge
```

Only deletes `.browser-profiles/<name>` inside this repository. It never touches OS default profiles under `~/Library/...`, `%LOCALAPPDATA%`, or `~/.config/...`.

### Platform notes

| OS | Chrome discovery | Edge discovery | Firefox discovery |
| --- | --- | --- | --- |
| Linux | `google-chrome-stable`, `google-chrome`, `chromium`, `chromium-browser`, `chrome` on `PATH`, then common `/usr/bin` paths | `microsoft-edge`, `microsoft-edge-stable` (+ beta/dev) on `PATH`, then `/usr/bin` / `/opt/microsoft/msedge` | `firefox`, `firefox-esr` on `PATH`, then `/usr/bin` / snap |
| macOS | `/Applications/Google Chrome.app/...` (and Chromium / Canary), or `PATH` | `/Applications/Microsoft Edge.app/...` (and Beta / Dev / Canary), or `PATH` | `/Applications/Firefox.app/...` (and Dev / Nightly), or `PATH` |
| Windows | `%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe`, Program Files, or `PATH` | `%PROGRAMFILES(X86)%\Microsoft\Edge\Application\msedge.exe` (and Program Files / Beta / Dev), or `PATH` | `Program Files\Mozilla Firefox\firefox.exe`, or `PATH` |

Override with `CHROME_PATH` / `EDGE_PATH` / `FIREFOX_PATH` or `--binary` when discovery fails (Flatpak, custom installs, Chrome Canary-only machines).

Manual product checks after load: [smoke-checklist.md](smoke-checklist.md).

## Cross-browser API notes

- Runtime code resolves `browser` before `chrome` (`src/webext.ts`) so Firefox gets promise-based APIs.
- Chrome root `manifest.json` stays the Chrome source of truth; Firefox packaging is generated (`scripts/firefox-manifest.mjs` → `dist/firefox/`), including `background.scripts` instead of `service_worker` so temporary add-on load works.
- Edge Add-ons listing uses the same Chrome MV3 package (`dist/chrome`); smoke on Edge with `.\launch-edge.ps1` before store submit.
- Title-strip favicons stay Chrome-only (`favicon` + `/_favicon/`). Firefox omits them without adding host permissions. Edge may or may not honor the Chrome favicon permission — verify on a real Edge smoke.
- Optional thumbnail / URL-image permission UX can differ on Firefox (may re-prompt more often after revoke); degrade gracefully either way.

## Follow-ups (not blocking Firefox)

- **Additional languages** — English `_locales` scaffolding and runtime `t()` wiring are in; translations beyond `en` remain a separate Pre-publish item.
- AMO listing screenshots, privacy policy text, and reviewer permissions narrative are separate Pre-publish lanes.
- Engineering package for AMO (data-collection key, source zip, rebuild notes): [AMO.md](AMO.md).
