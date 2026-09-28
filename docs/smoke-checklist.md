# Chrome load-unpacked smoke checklist

Manual pass after `npm run build` and **Load unpacked** → select the repo’s `dist` folder. Expect permissions: **bookmarks**, **storage**, **contextMenus** only (no host access).

## New tab grid

- [ ] New tab shows Hearth (not Chrome’s default new tab).
- [ ] Open a nested folder; breadcrumbs navigate back.
- [ ] Reload / open another new tab: last folder is still open.
- [ ] **New folder** and **New bookmark** create in the open folder (not at Chrome root).

## Rename / delete / pictures

- [ ] Tile **⋮** menu: **Rename** opens a dialog; **Delete** asks for confirm in a dialog; folder copy is stronger when the folder is not empty; item disappears from the grid.
- [ ] Rename / delete also work from the current-folder title chrome.
- [ ] **Picture** / **Clear picture** from the tile menu; oversized or non-image file shows an error (no silent success).

## Drag

- [ ] Drag a dial left/right among siblings: order changes and sticks after reload.
- [ ] Drop on a folder tile’s center (or a breadcrumb): dial moves into that folder.
- [ ] Edge drop on a folder tile still reorders among siblings (does not move into).

## Grid settings

- [ ] New-tab **gear** opens Settings (not inline column/tile sliders on the dial).
- [ ] On Settings: change **Columns** and **Tile size** (16:9 faces, size up to 576); layout updates on a new tab.
- [ ] Toggle **Show last bookmarks first**; grid order reverses without changing Chrome’s bookmark manager order.

## Local pictures

- [ ] Covered under tile menu above.

## Add to Hearth (context menu)

- [ ] On a normal `https` page (or link): right-click → **Add to Hearth…**.
- [ ] Popup lists dial folders (Chrome root not offered); name is editable; address is read-only.
- [ ] Choosing a folder and **Add bookmark** creates the dial there; cancel closes without adding.
- [ ] New-tab open folder is not used unless you pick it in the popup.

## Packaging sanity

- [ ] `chrome://extensions` → Hearth details: no host permissions; no unexpected optional permissions.
- [ ] Service worker / Errors panel stays clean while exercising the steps above.
