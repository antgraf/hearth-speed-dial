# Hearth Speed Dial

A visual new-tab speed dial for Chrome. Every dial is a normal bookmark, so the browser’s own sync is what copies them between devices.

The extension has no account and no service of its own. The product scope is [docs/SPEC.md](docs/SPEC.md).

## Privacy

Hearth asks for three permissions at install:

- **Bookmarks**, so it can show your bookmark folders and, when you ask, add, rename, delete, or move a folder or bookmark. The dial list stays in Chrome bookmarks.
- **Storage**, so it can remember the folder you had open, your grid layout (columns, 16:9 dial face width up to 576px, whether last bookmarks show first, and the thumbnail opt-in), and any dial pictures you assign. Those values stay in the browser profile (they do not sync with bookmarks). Layout controls open from the new-tab gear (in-page Settings overlay); `settings.html` is also listed as the extension options page.
- **Context menus**, so you can right-click a page or link and choose **Add to Hearth…**. You pick the destination folder in a small extension window; the new-tab’s open folder is not used by default.

Optional permissions (not requested at install or on first new-tab open):

- **Tabs** and **site access (`<all_urls>`)** — only when you turn on **Generate dial thumbnails** in Settings. That lets Hearth open a page briefly, capture a screenshot, store it locally as a dial picture, and close the temporary window.
- **Host access for an image origin** — when you assign a picture from a URL and you have not already granted `<all_urls>` via thumbnails. The image is fetched once and stored as a local data URL (no permanent remote hotlink).

Dial pictures are JPEG, PNG, GIF, or WebP (about 1.5 MB each), stored as data URLs under the default `chrome.storage.local` quota (~10 MB total for settings and images). Hearth does not request `unlimitedStorage`. Capture and URL assign use the same local image store as file attach.

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

`npm test`, `npm run typecheck`, and `npm run lint` check the project. `npm run dev` opens a preview that uses sample bookmarks. That sample is left out of the built extension.

Manual Chrome checks: [docs/smoke-checklist.md](docs/smoke-checklist.md).

## Build output (`dist`)

`npm run build` empties and fills `dist/` with:

| Path | Role |
| --- | --- |
| `manifest.json` | Copied from the repo root (always-on: `bookmarks`, `storage`, `contextMenus`; optional: `tabs`, `<all_urls>`, `http://*/*`, `https://*/*`) |
| `icons/` | Extension icons (16 / 32 / 48 / 128) |
| `index.html` | New-tab page (`chrome_url_overrides.newtab`) |
| `settings.html` | Extension options / settings page (`manifest.json` `options_page`) |
| `add.html` | **Add to Hearth…** popup |
| `background.js` | MV3 service worker (context menu) |
| `assets/` | Hashed JS/CSS for the pages |

Do not ship `node_modules`, `src`, or the Vite preview into the package. `dist/` is gitignored; always build before load-unpacked or packaging a zip of `dist`.

## License

[MIT](LICENSE)
