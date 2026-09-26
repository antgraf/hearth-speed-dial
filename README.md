# Hearth Speed Dial

A visual new-tab speed dial for Chrome. Every dial is a normal bookmark, so the browser’s own sync is what copies them between devices.

The extension has no account and no service of its own. The product scope is [docs/SPEC.md](docs/SPEC.md).

## Privacy

Hearth asks for three permissions:

- **Bookmarks**, so it can show your bookmark folders and, when you ask, add a folder or bookmark. The dial list stays in Chrome bookmarks.
- **Storage**, so it can remember the folder you had open, your grid layout, and any local pictures you attach to dials. Those values stay in the browser profile (they do not sync with bookmarks).
- **Context menus**, so you can right-click a page or link and choose **Add to Hearth…**. You pick the destination folder in a small extension window; the new-tab’s open folder is not used by default.

Local dial pictures are optional JPEG, PNG, GIF, or WebP files you pick from disk (about 1.5 MB each). They are stored as data URLs under the default `chrome.storage.local` quota (~10 MB total for settings and images). Hearth does not request `unlimitedStorage` in v1. There is no image URL, screenshot capture, or favicon lookup.

The extension does not request access to websites. It does not add an account, analytics, or a server of its own.

## Load unpacked

Requires Node 22 or newer.

```powershell
npm install
npm run build
```

1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Choose **Load unpacked**.
4. Select the `dist` folder in this repo.
5. Open a new tab.

`npm test`, `npm run typecheck`, and `npm run lint` check the project. `npm run dev` opens a preview that uses sample bookmarks. That sample is left out of the built extension.

## License

[MIT](LICENSE)
