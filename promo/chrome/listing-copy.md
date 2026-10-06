# Chrome Web Store — paste-ready listing copy

**Product:** Hearth Speed Dial · **Language:** English  
**Category:** Functionality & UI  
**Privacy URL:** https://github.com/antgraf/hearth-speed-dial/blob/main/docs/PRIVACY.md

Text inside a fenced `text` block is paste-ready. Straight quotes; `…` is the
ellipsis character (matches **Add to Hearth…**, **Picture…**).

---

## Detailed description

(3,221 / ~16,000; plain text — CWS strips markdown)

```text
Hearth turns your new tab page into a visual speed dial of your own bookmarks.

Every dial is an ordinary Chrome bookmark, and every folder is a bookmark folder. Hearth shows your bookmark tree as a grid of tiles: open a folder to see what's inside, drag tiles to reorder them or drop them into another folder, and rename or delete dials in place. Changes go straight to your Chrome bookmarks, so the bookmark manager and Chrome sync see the same tree. There is no second list to maintain.

What you get
• Your bookmarks and folders as tiles on every new tab, with breadcrumbs back up the tree
• Drag and drop to reorder dials or move them into folders
• A New tile to add a bookmark or folder to the open folder
• Add to Hearth… in the right-click menu on any web page or link: pick a folder, check the name, save
• Find a dial: press / and type to filter the open folder and everything inside it by title or address
• Layout: 1 to 8 columns, adjustable tile size with 16:9 faces, optional last-bookmarks-first order, and an optional default folder for new windows
• Themes: light, dark, or follow your system; four warm accent colors; an optional page color; an optional wallpaper from your own computer
• Small site icons beside titles, taken from Chrome's local icon cache when Chrome has one
• Backup: export pictures and settings to a file, then import it later with merge or overwrite
• A short welcome card the first time you open a new tab

Pictures, your way
Tiles show a monogram, or a folder icon, until you give them a picture. Choose ⋮ → Picture… on any tile to:
• Attach an image file from your computer
• Download an image once from a link (optional: turn on "Assign pictures from URLs" in Settings)
• Capture a thumbnail of the page (optional: turn on "Generate dial thumbnails" in Settings), or refresh the thumbnails of every web bookmark in the open folder at once

Both optional features are off by default. Chrome asks for the extra access only when you switch one on, and switching it off releases that access. Pictures are resized on your device and stored in your Chrome profile, so dials never load pictures from other sites.

Privacy
• No account and no sign-up
• No analytics, ads, or tracking
• No Hearth server: nothing is sent to the developer
• Your bookmarks stay in Chrome's bookmarks
• Small layout and theme preferences use Chrome's extension sync storage, so they follow you when Chrome sync is on. Pictures, the wallpaper, and folder pins stay on this device.
• Settings → Danger Zone → Erase All Data removes everything Hearth stored and never touches your bookmarks

Permissions, in plain words
Always on: your bookmarks (the dial is your bookmark tree), storage without the default size cap (settings and pictures on this device), the right-click menu (Add to Hearth…), the active tab when you choose Add to Hearth… (to name the new dial after the page), and Chrome's local site-icon cache (icons beside titles).
Only if you turn them on in Settings: all-site access for thumbnail capture, and http/https site access for pictures from links.

Hearth is open source under the MIT license. Source code, privacy policy, and issue tracker:
https://github.com/antgraf/hearth-speed-dial
```

---

## Single purpose (Privacy tab)

(333)

```text
Hearth replaces the new tab page with a visual speed dial of the user's own bookmarks. The dial is the browser's bookmark tree shown as a grid of tiles: the user opens folders, rearranges, renames, and deletes dials, gives dials pictures, and saves the current page into a chosen folder with "Add to Hearth…" in the right-click menu.
```

---

## Permission justifications

### `bookmarks` (454)

```text
The dial grid is the user's bookmark tree, so this is Hearth's core permission. Hearth reads bookmarks and folders to draw the grid and breadcrumbs, and it creates, renames, moves, reorders, or deletes a bookmark or folder only when the user does so in Hearth: the New tile, Rename, Delete (after a confirmation), drag and drop, or "Add to Hearth…" from the right-click menu. Hearth does not keep its own copy of the bookmark list and never transmits it.
```

### `storage` (486)

```text
Saves Hearth's own settings and dial pictures in extension storage. Small layout and theme preferences (columns, tile size, display order, thumbnail wait, and theme settings) go in storage.sync so the browser's own sync can carry them to the user's other devices; Hearth has no account or server. Device-specific values (last open folder, default folder, optional-feature switches, welcome-card flag) and all images (dial pictures, theme wallpaper) stay in storage.local on this device.
```

### `unlimitedStorage` (442)

```text
Dial pictures and the optional theme wallpaper are stored on the device in storage.local as image data, resized on the device first (about 1.5 MB at most per picture). The default extension quota of about 10 MB fills after a handful of pictures, so unlimitedStorage lifts that cap for local storage only. Nothing is uploaded or synced. Settings shows how much space pictures use, and a failed write shows an error instead of failing silently.
```

### `favicon` (371)

```text
Shows a small site icon next to each web bookmark's title on the dial, read from the browser's own local favicon cache through the _favicon URL. This makes a fresh install over an existing bookmark tree recognizable before the user adds any pictures. Hearth does not fetch icons from the network or use a third-party icon service; if the cache has no icon, none is shown.
```

### `contextMenus` (380)

```text
Adds Hearth's right-click menu items: "Add to Hearth…" on http and https pages and links, which opens a small Hearth window where the user picks a bookmark folder and confirms the name before anything is saved; and Hearth actions on Hearth's own new tab page, such as "Refresh All Thumbnails" for the open folder. documentUrlPatterns limit each item to the pages where it applies.
```

### `activeTab` (490)

```text
Used only by "Add to Hearth…". When the user right-clicks a web page and chooses that menu item, activeTab lets Hearth read that tab's title once, so the new bookmark's name starts as the page title instead of just the domain; the user can edit it before saving. The grant is temporary and covers only the tab the user clicked. Hearth injects no scripts, reads no page content, and gets no lasting site access from it. Hearth does not request the tabs permission.
```

### Optional host permissions (650)

```text
Optional only; no host access at install. Hearth declares these in optional_host_permissions and requests them with permissions.request only after the user turns on a Settings switch (both off by default):
• <all_urls>, with "Generate dial thumbnails": tabs.captureVisibleTab needs it to screenshot a bookmark's page, opened in a temporary window, as a local dial picture.
• http://*/* and https://*/*, with "Assign pictures from URLs": one fetch, without credentials, of the image address the user typed; the image is stored locally.
Turning a switch off calls permissions.remove. Hearth has no content scripts and never contacts a developer server.
```

---

## Remote code

Select **No, I am not using remote code.** If a justification box appears:

```text
No. All JavaScript ships inside the package (TypeScript bundled with Vite). Hearth loads no remote scripts, uses no eval, and its new tab page is a packaged HTML file.
```

---

## Test instructions (optional)

(447)

```text
No account or credentials are needed. Open a new tab: a fresh profile starts at the bookmarks root (Bookmarks bar / Other bookmarks); open a folder to see the New tile, since the root cannot hold new items. Right-click any web page and choose "Add to Hearth…" to save it into a folder. The gear opens Settings; the two optional picture features (Settings → Pictures) are off by default and request their optional permissions only when switched on.
```

---

## Promo / marquee taglines (on-image; already baked into PNGs)

| Asset | On-image text |
| --- | --- |
| Small promo 440×280 | `Hearth Speed Dial` + `Your bookmarks, at a glance.` |
| Marquee 1400×560 | `Every new tab, your own bookmarks.` + `No account. No server. Just your bookmarks.` |

Alt (if asked): small — “Hearth Speed Dial wordmark beside a few bookmark tiles.” · marquee — “Hearth Speed Dial: a new tab page showing bookmark tiles and folders in a grid.”

---

## Screenshot story (CWS has no caption fields)

Upload order for `images/` (max 5):

1. `hearth-screenshot-01-dial-grid-1280x800.png` — dial grid hero  
2. `hearth-screenshot-02-nested-folder-1280x800.png` — nested folder  
3. `hearth-screenshot-03-picture-menu-1280x800.png` — Picture…  
4. `hearth-screenshot-04-settings-1280x800.png` — Settings  
5. `hearth-screenshot-05-find-1280x800.png` — Find a dial  

Also upload: `hearth-cws-icon-128x128.png`, `hearth-promo-small-440x280.png`, `hearth-promo-marquee-1400x560.png`.
