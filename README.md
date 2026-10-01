# Hearth Speed Dial

A visual new-tab speed dial for Chrome. Every dial is a normal bookmark, so the browser’s own sync is what copies them between devices.

The extension has no account and no service of its own. The product scope is [docs/SPEC.md](docs/SPEC.md). On the dial page, **Find…** (`/` to focus, `Esc` to clear) filters the open folder and its nested dials by title or URL using bookmark data already in memory.

## Privacy

Hearth asks for these permissions at install:

- **Bookmarks**, so it can show your bookmark folders and, when you ask, add, rename, delete, or move a folder or bookmark. The dial list stays in Chrome bookmarks.
- **Storage**, so it can remember the folder you had open (or an optional default folder for new windows), your grid layout (columns, 16:9 dial face width up to 576px, whether last bookmarks show first, thumbnail wait time, and the thumbnail / URL-image opt-ins), theme preferences (appearance mode, accent palette, optional background color, and an optional locally uploaded wallpaper), and any dial pictures you assign. Those values stay in the browser profile (they do not sync with bookmarks). Layout and theme controls open from the new-tab gear (in-page Settings overlay); `settings.html` is also listed as the extension options page. **Backup** in Settings can download or restore a JSON file of dial pictures and those non-bookmark prefs (never your Chrome bookmarks — the browser already syncs those). Import asks whether to overwrite local Hearth data or merge (keep pictures that are not in the file).
- **Unlimited storage**, so dial pictures are not capped by Chrome’s default ~10 MB shared `storage.local` quota. Pictures still stay in this browser profile only (no network, no sync of image blobs). Settings shows how much local space dial pictures use; if a write still fails (full disk), Hearth shows an error instead of a silent miss.
- **Favicon**, so the title strip can show each http(s) bookmark’s site icon from Chrome’s local profile favicon cache. That uses no network and no third-party icon service (those would leak your bookmark list). A missing cache entry just omits the title icon; dial faces still fall back to a monogram or folder icon until you assign a picture.
- **Context menus**, so you can right-click a normal web page or link and choose **Add to Hearth…**, or right-click the Hearth dial page and choose **Refresh All Thumbnails**. You pick the destination folder in a small extension window; the new-tab’s open folder is not used by default for Add.
- **Active tab**, only for the clicked tab after that context-menu gesture, so **Add to Hearth…** can prefill the dial name from the page title (not just the domain). It does not grant lasting host access.

Optional permissions (not requested at install or on first new-tab open):

- **Tabs** and **site access (`<all_urls>`)** — only when you turn on **Generate dial thumbnails** in Settings. That lets Hearth open a page briefly, capture a screenshot, store it locally as a dial picture, and close the temporary window.
- **Host access (`http://*/*`, `https://*/*`)** — only when you turn on **Assign pictures from URLs** in Settings. That lets Hearth download an image once from a link and store it as a local data URL. Turning the toggle off drops those grants. If thumbnails already granted `<all_urls>`, URL fetch can use that access while its own toggle is on.

Dial pictures are JPEG, PNG, GIF, or WebP (about 1.5 MB each), stored as data URLs in `chrome.storage.local` with install-time `unlimitedStorage` so picture count is not artificially capped by the default shared quota. Capture and URL assign use the same local image store as file attach.

The extension does not add an account, analytics, or a server of its own.

## Load unpacked

Requires Node 22 or newer.

```powershell
npm install
npm run build
```

Or from the repo root: `.\build.ps1` (or `pwsh ./build.ps1`). Runs `npm install` if `node_modules` is missing, then the production build into `dist`. To update from git first, use `.\pull_and_build.ps1` (or `pwsh ./pull_and_build.ps1`) — it runs `git pull`, then the same build path.

1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Choose **Load unpacked**.
4. Select the `dist` folder in this repo (not the repo root).
5. Open a new tab.

After a rebuild, use **Reload** on the extension card so Chrome picks up `dist` changes.

`npm test`, `npm run typecheck`, and `npm run lint` check the project. `npm run test:coverage` prints V8 coverage for modules the tests import (not whole-project until controllers have tests). `npm run dev` opens a preview that uses sample bookmarks. That sample is left out of the built extension.

Manual Chrome checks: [docs/smoke-checklist.md](docs/smoke-checklist.md).

## Build output (`dist`)

`npm run build` empties and fills `dist/` with:

| Path | Role |
| --- | --- |
| `manifest.json` | Copied from the repo root (always-on: `bookmarks`, `storage`, `unlimitedStorage`, `favicon`, `contextMenus`, `activeTab`; optional: `tabs`, `<all_urls>`, `http://*/*`, `https://*/*`) |
| `icons/` | Extension icons (16 / 32 / 48 / 128) |
| `index.html` | New-tab page (`chrome_url_overrides.newtab`) |
| `settings.html` | Extension options / settings page (`manifest.json` `options_page`) |
| `add.html` | **Add to Hearth…** popup |
| `background.js` | MV3 service worker (context menu) |
| `assets/` | Hashed JS/CSS for the pages |

Do not ship `node_modules`, `src`, or the Vite preview into the package. `dist/` is gitignored; always build before load-unpacked or packaging a zip of `dist`.

## License

[MIT](LICENSE)
