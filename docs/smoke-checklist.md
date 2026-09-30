# Chrome load-unpacked smoke checklist

Manual pass after `npm run build` (or `.\build.ps1` / `.\pull_and_build.ps1`) and **Load unpacked** → select the repo’s `dist` folder. Expect always-on permissions: **bookmarks**, **storage**, **contextMenus** only. Optional **tabs** / **site access** appear only after you enable thumbnails or **Assign pictures from URLs** in Settings.

## New tab grid

- [ ] New tab shows Hearth (not Chrome’s default new tab).
- [ ] Open a nested folder; breadcrumbs navigate back.
- [ ] Reload / open another new tab: last folder is still open (or the Settings default folder, when one is set).
- [ ] **New** control → choose folder or bookmark; creates in the open folder (not at Chrome root).

## Rename / delete / pictures

- [ ] Tile **⋮** sits on the meta row (Folder / domain); menu: **Rename**, **Picture…**, **Delete** (delete confirms in a dialog).
- [ ] **Picture…** offers **Attach file…**, **Image from URL…**, and (for http(s) bookmarks) **Capture thumbnail** — URL and capture items disabled with “enable in Settings” until each opt-in is on.
- [ ] Current-folder breadcrumb **⋮** offers the same actions (including Picture); Chrome root has no menu.
- [ ] New-tab **gear** opens Settings in the in-page dialog overlay (columns, tile size, thumbnail wait, default folder for new windows, reverse order, **Generate dial thumbnails**, **Assign pictures from URLs**). `settings.html` remains available as the extension options page.

## Drag

- [ ] Drag a dial left/right among siblings: order changes and sticks after reload.
- [ ] Drop on a folder tile’s center (or a breadcrumb): dial moves into that folder.
- [ ] Edge drop on a folder tile still reorders among siblings (does not move into).

## Grid settings

- [ ] In the Settings overlay: change **Columns** and **Tile size** (16:9 faces, size up to 576); layout updates on the open new tab.
- [ ] Close and reopen Settings: **Tile size** slider sits at the saved width (not the middle/default).
- [ ] **Thumbnail wait** defaults to 2s (range 1–15); raising it delays the screenshot so slow pages can paint.
- [ ] **Default folder for new windows** unset → new tab recalls last open; set to a folder → new tab / new window opens there; navigating still updates last-open; missing folder falls back gracefully.
- [ ] Toggle **Show last bookmarks first**; grid order reverses without changing Chrome’s bookmark manager order.

## Local pictures / URL / thumbnails

- [ ] Oversized or non-image file shows an error (no silent success). Folder default art is a folder icon; bookmarks keep monogram until a picture is set.
- [ ] **Assign pictures from URLs** off by default; **Image from URL…** disabled until enabled. First turn on → Chrome prompts for optional http/https site access. Deny → setting stays off. Grant → menu unlocks; enter an https image URL → dial shows the picture; storage holds a data URL.
- [ ] Turn **Assign pictures from URLs** off → active access is dropped; menu locks again. Turn on again → `permissions.request` runs; Chrome usually restores without a dialog after the first Allow (expected). To force a new prompt, revoke under `chrome://extensions` → Hearth → site access, then enable again.
- [ ] **Generate dial thumbnails** off by default; first enable prompts for optional tabs + site access. Deny → setting stays off; grant → **Capture thumbnail** works (temp window opens, then closes; dial face updates). Off → on after Allow usually silent; revoke in extension details to force a new prompt.
- [ ] After grant: revoke optional site access in `chrome://extensions` → Hearth details → reopen new tab → thumbnail / URL-fetch settings degrade (off / menu locked), no crash.

## Add to Hearth (context menu)

- [ ] On a normal `https` page (or link): right-click → **Add to Hearth…**.
- [ ] Popup fits its content (no dual scrollbars); maximizing fills the window (not a tiny floating card).
- [ ] **Name** prefers the page title (not only the domain); address is read-only.
- [ ] Folder picker is a collapsible tree (collapsed by default). When Settings **default folder for new windows** is set, the picker is scoped to that folder and its descendants.
- [ ] Choosing a folder and **Add bookmark** creates the dial there; cancel closes without adding.
- [ ] New-tab open folder is not used unless you pick it in the popup (or it is the Settings default and thus in scope).

## Packaging sanity

- [ ] Fresh install: `chrome://extensions` → Hearth details: no host permissions granted yet; optional permissions listed but inactive until used.
- [ ] Service worker / Errors panel stays clean while exercising the steps above.
