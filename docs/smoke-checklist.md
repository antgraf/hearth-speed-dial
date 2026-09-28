# Chrome load-unpacked smoke checklist

Manual pass after `npm run build` (or `.\build.ps1` / `.\pull_and_build.ps1`) and **Load unpacked** → select the repo’s `dist` folder. Expect always-on permissions: **bookmarks**, **storage**, **contextMenus** only. Optional **tabs** / **site access** appear only after you enable thumbnails or **Assign pictures from URLs** in Settings.

## New tab grid

- [ ] New tab shows Hearth (not Chrome’s default new tab).
- [ ] Open a nested folder; breadcrumbs navigate back.
- [ ] Reload / open another new tab: last folder is still open.
- [ ] **New** control → choose folder or bookmark; creates in the open folder (not at Chrome root).

## Rename / delete / pictures

- [ ] Tile **⋮** sits on the meta row (Folder / domain); menu: **Rename**, **Picture…**, **Delete** (delete confirms in a dialog).
- [ ] **Picture…** offers **Attach file…**, **Image from URL…**, and (for http(s) bookmarks) **Capture thumbnail** — URL and capture items disabled with “enable in Settings” until each opt-in is on.
- [ ] Current-folder breadcrumb **⋮** offers the same actions (including Picture); Chrome root has no menu.
- [ ] New-tab **gear** opens Settings in the in-page dialog overlay (columns, tile size, reverse order, **Generate dial thumbnails**, **Assign pictures from URLs**). `settings.html` remains available as the extension options page.

## Drag

- [ ] Drag a dial left/right among siblings: order changes and sticks after reload.
- [ ] Drop on a folder tile’s center (or a breadcrumb): dial moves into that folder.
- [ ] Edge drop on a folder tile still reorders among siblings (does not move into).

## Grid settings

- [ ] In the Settings overlay: change **Columns** and **Tile size** (16:9 faces, size up to 576); layout updates on the open new tab.
- [ ] Toggle **Show last bookmarks first**; grid order reverses without changing Chrome’s bookmark manager order.

## Local pictures / URL / thumbnails

- [ ] Oversized or non-image file shows an error (no silent success). Folder default art is a folder icon; bookmarks keep monogram until a picture is set.
- [ ] **Assign pictures from URLs** off by default; **Image from URL…** disabled until enabled. Turn on → Chrome prompts for optional http/https site access. Deny → setting stays off. Grant → menu unlocks; enter an https image URL → dial shows the picture; storage holds a data URL.
- [ ] Turn **Assign pictures from URLs** off → access is dropped; menu locks again; turning on prompts again.
- [ ] **Generate dial thumbnails** off by default; enabling prompts for optional tabs + site access. Deny → setting stays off; grant → **Capture thumbnail** works (temp window opens, then closes; dial face updates).
- [ ] After grant: revoke optional site access in `chrome://extensions` → Hearth details → reopen new tab → thumbnail / URL-fetch settings degrade (off / menu locked), no crash.

## Add to Hearth (context menu)

- [ ] On a normal `https` page (or link): right-click → **Add to Hearth…**.
- [ ] Popup lists dial folders (Chrome root not offered); name is editable; address is read-only.
- [ ] Choosing a folder and **Add bookmark** creates the dial there; cancel closes without adding.
- [ ] New-tab open folder is not used unless you pick it in the popup.

## Packaging sanity

- [ ] Fresh install: `chrome://extensions` → Hearth details: no host permissions granted yet; optional permissions listed but inactive until used.
- [ ] Service worker / Errors panel stays clean while exercising the steps above.
