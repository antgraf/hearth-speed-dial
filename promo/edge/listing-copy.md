# Microsoft Edge Add-ons — paste-ready listing copy

**Product:** Hearth Speed Dial · **Locale:** `en-US`  
**Category:** Productivity  
**Privacy URL:** https://github.com/antgraf/hearth-speed-dial/blob/main/docs/PRIVACY.md

Edge listing uses **favorites** where the UI says favorites. Package is the
Chrome zip (includes `favicon`). Fenced blocks are paste-ready.

---

## Description

(3,223; Edge range 250–10,000)

```text
Hearth turns your new tab page into a visual speed dial of your own favorites.

Every dial is an ordinary Microsoft Edge favorite (bookmark), and every folder is a favorites folder. Hearth shows your favorites as a grid of tiles: open a folder to see what's inside, drag tiles to reorder them or drop them into another folder, and rename or delete dials in place. Changes go straight to your Edge favorites, so the Favorites manager and Edge sync see the same tree. There is no second list to maintain.

What you get
• Your favorites and folders as tiles on every new tab, with breadcrumbs back up the tree
• Drag and drop to reorder dials or move them into folders
• A New tile to add a favorite or folder to the open folder
• Add to Hearth… in the right-click menu on any web page or link: pick a folder, check the name, save
• Find a dial: press / and type to filter the open folder and everything inside it by title or address
• Layout: 1 to 8 columns, adjustable tile size with 16:9 faces, optional last-bookmarks-first order, and an optional default folder for new windows
• Themes: light, dark, or follow your system; four warm accent colors; an optional page color; an optional wallpaper from your own computer
• Small site icons beside titles, taken from Edge's local icon cache when Edge has one
• Backup: export pictures and settings to a file, then import it later with merge or overwrite
• A short welcome card the first time you open a new tab

Pictures, your way
Tiles show a monogram, or a folder icon, until you give them a picture. Choose ⋮ → Picture… on any tile to:
• Attach an image file from your computer
• Download an image once from a link (optional: turn on "Assign pictures from URLs" in Settings)
• Capture a thumbnail of the page (optional: turn on "Generate dial thumbnails" in Settings), or refresh the thumbnails of every web favorite in the open folder at once

Both optional features are off by default. Edge asks for the extra access only when you switch one on, and switching it off releases that access. Pictures are resized on your device and stored in your Edge profile, so dials never load pictures from other sites.

Privacy
• No account and no sign-up
• No analytics, ads, or tracking
• No Hearth server: nothing is sent to the developer
• Your favorites stay in Edge's favorites
• Small layout and theme preferences use Edge's extension sync storage, so they can follow you when Edge sync is on. Pictures, the wallpaper, and folder pins stay on this device.
• Settings → Danger Zone → Erase All Data removes everything Hearth stored and never touches your favorites

Permissions, in plain words
Always on: your favorites (the dial is your favorites tree), storage without the default size cap (settings and pictures on this device), the right-click menu (Add to Hearth…), the active tab when you choose Add to Hearth… (to name the new dial after the page), and Edge's local site-icon cache (icons beside titles).
Only if you turn them on in Settings: all-site access for thumbnail capture, and http/https site access for pictures from links.

Hearth is open source under the MIT license. Source code, privacy policy, and issue tracker:
https://github.com/antgraf/hearth-speed-dial
```

---

## Search terms

| # | Term |
| --- | --- |
| 1 | `speed dial` |
| 2 | `new tab` |
| 3 | `favorites` |
| 4 | `bookmarks` |
| 5 | `visual bookmarks` |
| 6 | `start page` |
| 7 | `bookmark folders` |

(7 terms / 12 words — within 7 terms / 30 chars each / 21 words.)

---

## Single purpose (Privacy page)

Same as CWS (333):

```text
Hearth replaces the new tab page with a visual speed dial of the user's own bookmarks. The dial is the browser's bookmark tree shown as a grid of tiles: the user opens folders, rearranges, renames, and deletes dials, gives dials pictures, and saves the current page into a chosen folder with "Add to Hearth…" in the right-click menu.
```

---

## Permission justifications

Paste the same blocks as Chrome (Chromium package includes `favicon`):

### `bookmarks`

```text
The dial grid is the user's bookmark tree, so this is Hearth's core permission. Hearth reads bookmarks and folders to draw the grid and breadcrumbs, and it creates, renames, moves, reorders, or deletes a bookmark or folder only when the user does so in Hearth: the New tile, Rename, Delete (after a confirmation), drag and drop, or "Add to Hearth…" from the right-click menu. Hearth does not keep its own copy of the bookmark list and never transmits it.
```

### `storage`

```text
Saves Hearth's own settings and dial pictures in extension storage. Small layout and theme preferences (columns, tile size, display order, thumbnail wait, and theme settings) go in storage.sync so the browser's own sync can carry them to the user's other devices; Hearth has no account or server. Device-specific values (last open folder, default folder, optional-feature switches, welcome-card flag) and all images (dial pictures, theme wallpaper) stay in storage.local on this device.
```

### `unlimitedStorage`

```text
Dial pictures and the optional theme wallpaper are stored on the device in storage.local as image data, resized on the device first (about 1.5 MB at most per picture). The default extension quota of about 10 MB fills after a handful of pictures, so unlimitedStorage lifts that cap for local storage only. Nothing is uploaded or synced. Settings shows how much space pictures use, and a failed write shows an error instead of failing silently.
```

### `favicon` (keep — Edge favicons confirmed OK)

```text
Shows a small site icon next to each web bookmark's title on the dial, read from the browser's own local favicon cache through the _favicon URL. This makes a fresh install over an existing bookmark tree recognizable before the user adds any pictures. Hearth does not fetch icons from the network or use a third-party icon service; if the cache has no icon, none is shown.
```

### `contextMenus`

```text
Adds Hearth's right-click menu items: "Add to Hearth…" on http and https pages and links, which opens a small Hearth window where the user picks a bookmark folder and confirms the name before anything is saved; and Hearth actions on Hearth's own new tab page, such as "Refresh All Thumbnails" for the open folder. documentUrlPatterns limit each item to the pages where it applies.
```

### `activeTab`

```text
Used only by "Add to Hearth…". When the user right-clicks a web page and chooses that menu item, activeTab lets Hearth read that tab's title once, so the new bookmark's name starts as the page title instead of just the domain; the user can edit it before saving. The grant is temporary and covers only the tab the user clicked. Hearth injects no scripts, reads no page content, and gets no lasting site access from it. Hearth does not request the tabs permission.
```

### Optional host permissions

```text
Optional only; no host access at install. Hearth declares these in optional_host_permissions and requests them with permissions.request only after the user turns on a Settings switch (both off by default):
• <all_urls>, with "Generate dial thumbnails": tabs.captureVisibleTab needs it to screenshot a bookmark's page, opened in a temporary window, as a local dial picture.
• http://*/* and https://*/*, with "Assign pictures from URLs": one fetch, without credentials, of the image address the user typed; the image is stored locally.
Turning a switch off calls permissions.remove. Hearth has no content scripts and never contacts a developer server.
```

---

## Remote code

**No.** If a justification box appears:

```text
No. All JavaScript ships inside the package (TypeScript bundled with Vite). Hearth loads no remote scripts, uses no eval, and its new tab page is a packaged HTML file.
```

---

## Notes for certification

(1,021)

```text
No account, sign-in, or test credentials are needed.

Hearth replaces the new tab page with a speed dial of the user's favorites (bookmarks). The page is bundled in the package; nothing is loaded remotely and there is no server.

To test:
1. Open a new tab. A fresh profile starts at the favorites root, which shows the Favorites bar and Other favorites folders. Open one to see the New tile (the root itself cannot hold new items).
2. Use New to add a favorite or folder. Drag a tile to reorder it, or drop it on a folder to move it. Use ⋮ on a tile to rename, delete, or set a picture.
3. On any web page, right-click, choose "Add to Hearth…", pick a folder, and save.
4. The gear icon opens Settings (layout, theme, pictures, backup).

Optional permissions: "Generate dial thumbnails" and "Assign pictures from URLs" (Settings → Pictures) are off by default. Edge asks for the extra access only when one is turned on, and turning it off removes it.

This is the same Chromium package we submit to the Chrome Web Store.
```

---

## Promo / marquee taglines (on-image; already baked into PNGs)

| Asset | On-image text |
| --- | --- |
| Small promo 440×280 | `Hearth Speed Dial` + `Your bookmarks, at a glance.` |
| Large / marquee 1400×560 | `Every new tab, your own bookmarks.` + `No account. No server. Just your bookmarks.` |

---

## Screenshot upload order (≤6)

1. `hearth-screenshot-01-dial-grid-1280x800.png`  
2. `hearth-screenshot-02-nested-folder-1280x800.png`  
3. `hearth-screenshot-03-picture-menu-1280x800.png`  
4. `hearth-screenshot-04-settings-1280x800.png`  
5. `hearth-screenshot-05-find-1280x800.png`  
6. `hearth-screenshot-06-add-to-hearth-1280x800.png` (optional 6th — Add to Hearth)

Also: `hearth-edge-logo-300x300.png`, `hearth-promo-small-440x280.png`, `hearth-promo-marquee-1400x560.png`.
