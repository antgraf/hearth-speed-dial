# Firefox Add-ons (AMO) — paste-ready listing copy

**Product:** Hearth Speed Dial · **Default locale:** English (US)  
**Categories:** Bookmarks + Tabs · **Tags:** leave empty  
**Privacy URL:** https://github.com/antgraf/hearth-speed-dial/blob/main/docs/PRIVACY.md

AMO description and privacy accept a Markdown subset (bold, italic, links, lists,
code — **no headings, no HTML**). Fenced blocks are paste-ready.

---

## Summary

(212 / 250)

```text
A visual new-tab speed dial made from your own Firefox bookmarks: nested folders, drag and drop, local pictures, themes, and backup. No account, no analytics, no Hearth server. Your dials stay ordinary bookmarks.
```

---

## Description

(3,236)

```markdown
Hearth replaces your new tab page with a visual speed dial of your own Firefox bookmarks.

Every dial is an ordinary bookmark, and every folder is a bookmark folder. Hearth shows your bookmark tree as a grid of tiles: open a folder to see what's inside, drag tiles to reorder them or drop them into another folder, and rename or delete dials in place. Changes go straight to your Firefox bookmarks, so the Library and Firefox Sync see the same tree. There is no second list to maintain.

**What you get**

- Your bookmarks and folders as tiles on every new tab, with breadcrumbs back up the tree
- Drag and drop to reorder dials or move them into folders
- A **New** tile to add a bookmark or folder to the open folder
- **Add to Hearth…** in the right-click menu on any web page or link: pick a folder, check the name, save
- **Find a dial**: press `/` and type to filter the open folder and everything inside it by title or address
- **Layout**: 1 to 8 columns, adjustable tile size with 16:9 faces, optional last-bookmarks-first order, and an optional default folder for new windows
- **Themes**: light, dark, or follow your system; four warm accent colors; an optional page color; an optional wallpaper from your own computer
- **Backup**: export pictures and settings to a file, then import it later with merge or overwrite
- A short welcome card the first time you open a new tab

**Pictures, your way**

Tiles show a monogram, or a folder icon, until you give them a picture. Choose **⋮ → Picture…** on any tile to:

- Attach an image file from your computer
- Download an image once from a link (optional: turn on *Assign pictures from URLs* in Settings)
- Capture a thumbnail of the page (optional: turn on *Generate dial thumbnails* in Settings), or refresh the thumbnails of every web bookmark in the open folder at once

Both optional features are off by default. Firefox asks for the extra access when you switch one on, and switching it off releases that access. Pictures are resized on your device and stored in your Firefox profile, so dials never load pictures from other sites.

**Privacy**

- No account and no sign-up
- No analytics, ads, or tracking
- No Hearth server: nothing is sent to the developer
- Your bookmarks stay in Firefox's bookmarks
- Small layout and theme preferences use Firefox's extension sync storage, so they follow you when Firefox Sync is on. Pictures, the wallpaper, and folder pins stay on this device.
- **Settings → Danger Zone → Erase All Data** removes everything Hearth stored and never touches your bookmarks

**Permissions, in plain words**

- **Always on:** your bookmarks (the dial is your bookmark tree), storage without the default size cap (settings and pictures on this device), the right-click menu (*Add to Hearth…*), and the active tab when you choose *Add to Hearth…* (to name the new dial after the page).
- **Only if you turn them on in Settings:** all-site access for thumbnail capture, and http/https site access for pictures from links.

Firefox doesn't give extensions a local site-icon cache, so dial titles appear without small site icons.

Hearth is open source under the MIT license: [source code and issue tracker](https://github.com/antgraf/hearth-speed-dial).
```

---

## Privacy policy (AMO Markdown variant)

```markdown
**Hearth Speed Dial privacy policy** (last updated October 6, 2026)

Hearth replaces the new tab page with a speed dial of your own Firefox bookmarks. This policy explains what information Hearth uses, where it is kept, and what leaves your device. The same policy is published [on GitHub](https://github.com/antgraf/hearth-speed-dial/blob/main/docs/PRIVACY.md).

**Summary**

- **Hearth does not collect your data.** It has no server, no account, no analytics, no ads, and no tracking. Nothing is sent to the developer.
- **Your dials are your Firefox bookmarks.** Hearth's own settings and pictures are kept in Firefox's extension storage.
- **Firefox Sync is the only cloud copy.** If you use Firefox Sync, Firefox copies your bookmarks and Hearth's small layout and theme preferences to your other devices. Pictures are never synced or uploaded.
- **Two optional picture features are off by default.** They contact a website only when you use them, and only the website you chose.

"Collect" here means sending information off your device to the developer, or to anyone else on Hearth's behalf. Hearth does not do this.

**What Hearth uses on your device**

- **Bookmarks.** Hearth reads your bookmark folders and bookmarks to show them as tiles, and changes them only when you ask (add, rename, move, reorder, delete, or *Add to Hearth…*). Deleting a dial asks for confirmation first. Hearth does not keep its own copy of your bookmark list.
- **Layout and theme preferences** (columns, tile size, display order, thumbnail wait time, appearance, accent, page color, and wallpaper fit, position, and opacity) are saved in extension sync storage. With Firefox Sync on, Firefox can copy them to your other devices; otherwise they stay on this device.
- **Device settings** stay on this device: the last open folder, an optional default folder, whether each optional picture feature is on, and whether you dismissed the welcome card.
- **Pictures.** Dial pictures and an optional wallpaper are resized on your device and saved in the extension's local storage. They are not synced and not uploaded.
- **Add to Hearth….** When you right-click a page or link and choose *Add to Hearth…*, Hearth uses that address and, for a page, reads the tab's title once to name the new bookmark. Hearth reads nothing else from the page.

**Optional features that contact websites**

Both are off by default. Firefox asks for access when you turn one on, and turning it off removes that access.

- **Assign pictures from URLs.** Hearth downloads the one image you entered, without sending cookies, and stores a resized copy on your device.
- **Generate dial thumbnails.** Hearth opens the bookmarked page in a temporary window, waits the time set in Settings, takes a screenshot, stores a resized copy on your device, and closes the window. The website sees an ordinary visit.

In both cases the only request goes to the website you chose. Hearth sends nothing to the developer.

**Backup files**

*Export…* saves a file with your Hearth settings, wallpaper, and dial pictures. Each picture records its bookmark's address so it can be matched on another device. The file is saved where you choose and is never uploaded. *Import…* reads only a file you select and never changes your bookmarks.

**What Hearth does not do**

- No account or sign-in
- No analytics, telemetry, or crash reporting
- No ads, and no selling, sharing, or transferring of your information
- No remote code: everything Hearth runs is included in the add-on
- No reading of the pages you visit, apart from the title of a page you choose to add and the screenshots you ask the optional thumbnail feature to take

**Your choices**

- Turn either optional picture feature on or off in Settings at any time, or remove optional access in Firefox's add-on settings.
- **Settings → Danger Zone → Erase All Data** deletes Hearth's settings (including synced preferences), wallpaper, and all dial pictures, and turns the optional features off. It never deletes bookmarks.
- Uninstalling Hearth removes its locally stored data. To clear synced preferences too, use *Erase All Data* first.

**Changes and contact**

If Hearth's handling of information changes, this policy will be updated in the same release. Questions: [open an issue on GitHub](https://github.com/antgraf/hearth-speed-dial/issues).
```

Also paste the policy **URL** in the listing link field:
`https://github.com/antgraf/hearth-speed-dial/blob/main/docs/PRIVACY.md`

---

## Notes for Reviewers

(1,737 — edit the version if the cut is not `0.3.0`)

```text
Build from source (TypeScript + Vite; the shipped JS is minified):
  Node.js 22 or newer
  npm ci
  npm run build
  npm run pack:firefox
dist/firefox/ is the uploaded package (artifacts/hearth-speed-dial-firefox-v0.3.0.zip). The source zip was made with npm run pack:source. docs/AMO.md in the source lists the same steps and the expected Firefox manifest differences from manifest.json (no favicon permission; optional hosts folded into optional_permissions; gecko id, strict_min_version 121.0, data_collection_permissions; background.scripts).

What it does: Hearth replaces the new tab page with a speed dial of the user's bookmarks. The new tab page is bundled (index.html); nothing is loaded remotely.

Testing (no account needed): open a new tab. A fresh profile starts at the bookmarks root, which lists the Bookmarks Menu, Bookmarks Toolbar, and Other Bookmarks folders; open one to see the New tile (the root itself cannot hold new items). Right-click any http(s) page and choose "Add to Hearth…" to save it into a folder. The gear opens Settings.

Optional permissions: <all_urls> (Generate dial thumbnails) and http/https origins (Assign pictures from URLs) are requested only when the user turns on the matching switch in Settings → Pictures; both are off by default and removed when switched off. The tabs API permission is not declared.

Data: data_collection_permissions is ["none"]. No server, analytics, or remote code. Layout/theme prefs use storage.sync (Firefox Sync if enabled); pictures stay in storage.local. The only requests Hearth makes are user-initiated: "Image from URL" fetches the image address the user entered once (credentials omitted), and "Capture thumbnail" opens the bookmark's own page in a temporary window and captures it locally.
```

---

## Version release notes — v0.3.0

(521)

```text
First public release.
- Speed dial of your bookmark tree: nested folders, breadcrumbs, drag and drop, rename, delete, and a New tile
- Add to Hearth… in the right-click menu, with a folder picker
- Pictures from local files, plus optional image links and page thumbnails (both off by default)
- Find a dial, layout controls, themes with an optional local wallpaper, and backup/restore
- Layout and theme preferences use Firefox Sync when it is on; pictures stay on this device
- No account, no analytics, no Hearth server
```

---

## Screenshot captions (AMO per-image fields)

Upload `images/` 01–05 in this order. Captions:

| # | File | Caption |
| --- | --- | --- |
| 1 | `hearth-screenshot-01-dial-grid-1280x800.png` | Your bookmarks as a speed dial. Every tile is a real browser bookmark. |
| 2 | `hearth-screenshot-02-nested-folder-1280x800.png` | Open folders right on the dial; breadcrumbs lead back up the tree. |
| 3 | `hearth-screenshot-03-picture-menu-1280x800.png` | Give any dial a picture: a file from your computer, or an image link or page thumbnail once you turn those on. |
| 4 | `hearth-screenshot-04-settings-1280x800.png` | Choose columns, tile size, and a theme. Layout and theme can follow you through Firefox Sync. |
| 5 | `hearth-screenshot-05-find-1280x800.png` | Press / to find any dial by name or address, including inside folders. |

Also upload listing icons: `hearth-amo-icon-32x32.png`, `hearth-amo-icon-64x64.png`.  
No CWS-style 440×280 promo tile on AMO.
