# Hearth Speed Dial

A visual new-tab speed dial for **Chrome and Firefox**. Every dial is a normal bookmark, so the browser’s own sync is what copies them between devices.

The extension has no account and no service of its own. The product scope is [docs/SPEC.md](docs/SPEC.md).

## Privacy

Hearth asks for these permissions at install:

- **Bookmarks**, so it can show your bookmark folders and, when you ask, add, rename, delete, or move a folder or bookmark. The dial list stays in browser bookmarks.
- **Storage**, so it can remember the folder you had open (or an optional default folder for new windows), your grid layout (columns, 16:9 dial face width up to 576px, whether last bookmarks show first, thumbnail wait time, and the thumbnail / URL-image opt-ins), and any dial pictures you assign. Those values stay in the browser profile (they do not sync with bookmarks). Layout controls open from the new-tab gear (in-page Settings overlay); `settings.html` is also listed as the extension options page.
- **Unlimited storage**, so dial pictures are not capped by the browser’s default shared `storage.local` quota. Pictures still stay in this browser profile only (no network, no sync of image blobs). Settings shows how much local space dial pictures use; if a write still fails (full disk), Hearth shows an error instead of a silent miss.
- **Favicon** (**Chrome only**), so the title strip can show each http(s) bookmark’s site icon from Chrome’s local profile favicon cache. That uses no network and no third-party icon service (those would leak your bookmark list). Firefox has no equivalent without host access, so title icons are omitted there; dial faces still fall back to a monogram or folder icon until you assign a picture.
- **Context menus**, so you can right-click a normal web page or link and choose **Add to Hearth…**, or right-click the Hearth dial page and choose **Refresh All Thumbnails**. You pick the destination folder in a small extension window; the new-tab’s open folder is not used by default for Add.
- **Active tab**, only for the clicked tab after that context-menu gesture, so **Add to Hearth…** can prefill the dial name from the page title (not just the domain). It does not grant lasting host access.

Optional permissions (not requested at install or on first new-tab open):

- **Tabs** and **site access (`<all_urls>`)** — only when you turn on **Generate dial thumbnails** in Settings. That lets Hearth open a page briefly, capture a screenshot, store it locally as a dial picture, and close the temporary window.
- **Host access (`http://*/*`, `https://*/*`)** — only when you turn on **Assign pictures from URLs** in Settings. That lets Hearth download an image once from a link and store it as a local data URL. Turning the toggle off drops those grants. If thumbnails already granted `<all_urls>`, URL fetch can use that access while its own toggle is on.

Dial pictures are JPEG, PNG, GIF, or WebP. Large or high-resolution files are resized and compressed on ingest (tiles up to 1280×720, wallpapers up to 2560×1440) and stored as data URLs under about 1.5 MB each in extension `storage.local`, with install-time `unlimitedStorage` so picture count is not artificially capped by the default shared quota. Capture and URL assign use the same local image store as file attach. Decode or store failures show an error instead of failing silently.

The extension does not add an account, analytics, or a server of its own.

## Load unpacked (Chrome)

Requires Node 22 or newer.

```powershell
npm install
npm run build
```

Or from the repo root: `.\build.ps1` (or `pwsh ./build.ps1`). Runs `npm install` if `node_modules` is missing, then builds **both** Chrome and Firefox under `dist/chrome` and `dist/firefox`. Pass `-Target Chrome` or `-Target Firefox` to build only one. To update from git first, use `.\pull_and_build.ps1` (or `pwsh ./pull_and_build.ps1`) — same `-Target` options; default is all.

1. Open `chrome://extensions` (for an isolated empty profile: `.\launch-chrome.ps1` — see [docs/DEV.md](docs/DEV.md)).
2. Turn on Developer mode.
3. Choose **Load unpacked**.
4. Select the `dist/chrome` folder in this repo — the folder that **directly** contains `manifest.json`. Do **not** pick the repo root, `dist/`, or `dist/firefox` (since #40 the Chrome build lives under `dist/chrome/`, not `dist/`).
5. Open a new tab.

After a rebuild, use **Reload** on the extension card so Chrome picks up `dist/chrome` changes. If an older install still points at the pre-#40 `dist\` path, remove it and Load unpacked again from `dist/chrome`.

## Temporary add-on (Firefox)

Firefox **121+** (MV3 service worker). Build (default builds both targets), then load the Firefox tree from an isolated profile:

```powershell
.\build.ps1
# or single-target: .\build.ps1 -Target Firefox
# or: npm run build
npm run browser:firefox
```

In `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…** → select `dist/firefox/manifest.json`. Isolated profiles: [docs/DEV.md](docs/DEV.md).

`npm test`, `npm run typecheck`, and `npm run lint` check the project. `npm run test:coverage` prints V8 coverage for modules the tests import (not whole-project until controllers have tests). `npm run dev` opens a preview that uses sample bookmarks. That sample is left out of the built extension.

Manual checks: [docs/smoke-checklist.md](docs/smoke-checklist.md).

## Build output

`npm run build` (or `.\build.ps1`) builds **all** targets. `npm run build:chrome` / `.\build.ps1 -Target Chrome` fills only `dist/chrome/`. `npm run build:firefox` (after Chrome) or `.\build.ps1 -Target Firefox` writes `dist/firefox/`.

| Path | Role |
| --- | --- |
| `dist/chrome/manifest.json` | Copied from the repo root (always-on: `bookmarks`, `storage`, `unlimitedStorage`, `favicon`, `contextMenus`, `activeTab`; optional: `tabs`, `<all_urls>`, `http://*/*`, `https://*/*`) |
| `dist/chrome/icons/` | Extension icons (16 / 32 / 48 / 128) |
| `dist/chrome/index.html` | New-tab page (`chrome_url_overrides.newtab`) |
| `dist/chrome/settings.html` | Extension options / settings page (`manifest.json` `options_page`) |
| `dist/chrome/add.html` | **Add to Hearth…** popup |
| `dist/chrome/background.js` | MV3 service worker (context menu) |
| `dist/chrome/assets/` | Hashed JS/CSS for the pages |

`npm run build:firefox` copies the Chrome tree to `dist/firefox/` and writes a Firefox manifest: no `favicon`; optional hosts folded into `optional_permissions`; `browser_specific_settings.gecko` (`hearth-speed-dial@antgraf`, min `121.0`, `data_collection_permissions.required: ["none"]`); `background.scripts` (Chrome keeps `background.service_worker`).

Do not ship `node_modules`, `src`, or the Vite preview into the package. `dist/` is gitignored; always build before load-unpacked or packaging.

After a production build:

- `npm run pack:chrome` → `artifacts/hearth-speed-dial-chrome-vX.Y.Z.zip`
- `npm run pack:firefox` → `artifacts/hearth-speed-dial-firefox-vX.Y.Z.zip` (requires `dist/firefox`)
- `npm run pack:source` → `artifacts/hearth-speed-dial-source-vX.Y.Z.zip` (AMO reviewer source; see [docs/AMO.md](docs/AMO.md))

Versioning and the GitHub Release Action: [docs/VERSIONING.md](docs/VERSIONING.md).

## License

[MIT](LICENSE)
