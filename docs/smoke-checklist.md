# Chrome load-unpacked smoke checklist

Manual pass after `npm run build` and **Load unpacked** → select the repo’s `dist` folder. Expect permissions: **bookmarks**, **storage**, **contextMenus** only (no host access).

## New tab grid

- [ ] New tab shows Hearth (not Chrome’s default new tab).
- [ ] Open a nested folder; breadcrumbs navigate back.
- [ ] Reload / open another new tab: last folder is still open.
- [ ] **New folder** and **New bookmark** create in the open folder (not at Chrome root).

## Rename / delete

- [ ] **Rename** on a dial and on the current-folder title; titles update in the grid and in Chrome’s bookmark manager.
- [ ] **Delete** asks for confirm; folder copy is stronger when the folder is not empty; item disappears from the grid.

## Drag

- [ ] Drag a dial left/right among siblings: order changes and sticks after reload.
- [ ] Drop on a folder tile’s center (or a breadcrumb): dial moves into that folder.
- [ ] Edge drop on a folder tile still reorders among siblings (does not move into).

## Grid settings

- [ ] Change **Columns** and **Tile size**; layout updates and survives a new tab.

## Local pictures

- [ ] **Picture** on a dial without art: pick a small JPEG/PNG/GIF/WebP; tile shows the image.
- [ ] **Clear picture** restores the monogram.
- [ ] Oversized or non-image file shows an error (no silent success).

## Add to Hearth (context menu)

- [ ] On a normal `https` page (or link): right-click → **Add to Hearth…**.
- [ ] Popup lists dial folders (Chrome root not offered); name is editable; address is read-only.
- [ ] Choosing a folder and **Add bookmark** creates the dial there; cancel closes without adding.
- [ ] New-tab open folder is not used unless you pick it in the popup.

## Packaging sanity

- [ ] `chrome://extensions` → Hearth details: no host permissions; no unexpected optional permissions.
- [ ] Service worker / Errors panel stays clean while exercising the steps above.
