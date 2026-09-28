# Chrome load-unpacked smoke checklist

Manual pass after `npm run build` and **Load unpacked** → select the repo’s `dist` folder. Expect permissions: **bookmarks**, **storage**, **contextMenus** only (no host access).

## New tab grid

- [ ] New tab shows Hearth (not Chrome’s default new tab).
- [ ] Open a nested folder; breadcrumbs navigate back.
- [ ] Reload / open another new tab: last folder is still open.
- [ ] **New** control → choose folder or bookmark; creates in the open folder (not at Chrome root).

## Rename / delete / pictures

- [ ] Tile **⋮** sits on the meta row (Folder / domain); menu: **Rename**, **Picture** / **Clear picture**, **Delete** (delete confirms in a dialog).
- [ ] Current-folder breadcrumb **⋮** offers the same actions (including Picture); Chrome root has no menu.
- [ ] New-tab **gear** opens Settings in the in-page dialog overlay (columns, tile size, reverse order). `settings.html` remains available as the extension options page.

## Drag

- [ ] Drag a dial left/right among siblings: order changes and sticks after reload.
- [ ] Drop on a folder tile’s center (or a breadcrumb): dial moves into that folder.
- [ ] Edge drop on a folder tile still reorders among siblings (does not move into).

## Grid settings

- [ ] In the Settings overlay: change **Columns** and **Tile size** (16:9 faces, size up to 576); layout updates on the open new tab.
- [ ] Toggle **Show last bookmarks first**; grid order reverses without changing Chrome’s bookmark manager order.

## Local pictures

- [ ] Oversized or non-image file shows an error (no silent success). Folder default art is a folder icon; bookmarks keep monogram until a picture is set.

## Add to Hearth (context menu)

- [ ] On a normal `https` page (or link): right-click → **Add to Hearth…**.
- [ ] Popup lists dial folders (Chrome root not offered); name is editable; address is read-only.
- [ ] Choosing a folder and **Add bookmark** creates the dial there; cancel closes without adding.
- [ ] New-tab open folder is not used unless you pick it in the popup.

## Packaging sanity

- [ ] `chrome://extensions` → Hearth details: no host permissions; no unexpected optional permissions.
- [ ] Service worker / Errors panel stays clean while exercising the steps above.
