# Load-unpacked / temporary-addon smoke checklist

Manual pass after a production build. Agents do not run browser automation — Anton smokes on Windows.

**Chrome:** `npm run build` (or `.\build.ps1`; Chrome-only: `-Target Chrome`) → **Load unpacked** → select `dist/chrome/`. Expect always-on: **bookmarks**, **storage**, **unlimitedStorage**, **favicon**, **contextMenus**, **activeTab**.

**Firefox (121+):** `.\build.ps1` / `npm run build` (or `-Target Firefox`) → temporary add-on from `dist/firefox/manifest.json`. Expect always-on: **bookmarks**, **storage**, **unlimitedStorage**, **contextMenus**, **activeTab** (no **favicon**). Optional **tabs** / site access appear only after you enable thumbnails or **Assign pictures from URLs** in Settings.

## New tab grid

- [ ] New tab shows Hearth (not the browser’s default new tab).
- [ ] Open a nested folder; breadcrumbs navigate back.
- [ ] **Find a dial**: type in the header Find field (or press `/` to focus) to filter the open folder and nested dials by title or URL; `Esc` clears. Nested hits stay visible without opening the parent first; opening a folder clears the filter.
- [ ] Reload / open another new tab: last folder is still open (or the Settings default folder, when one is set).
- [ ] **New** control → choose folder or bookmark; creates in the open folder (not at the browser bookmark root).
- [ ] **Chrome:** http(s) bookmark tiles show a small favicon beside the title when Chrome has one cached; folders and `file:` bookmarks do not; missing/broken icons leave the title text alone (monogram / folder icon still on the dial face).
- [ ] **Firefox:** title-strip favicons are absent (expected); monogram / folder icon still on the dial face.

## Rename / delete / pictures

- [ ] Tile **⋮** sits on the meta row (Folder / domain); menu: **Rename**, **Picture…**, **Delete** (delete confirms in a dialog).
- [ ] **Picture…** offers **Attach file…**, **Image from URL…**, and (for http(s) bookmarks) **Capture thumbnail** — URL and capture items disabled with “enable in Settings” until each opt-in is on.
- [ ] Current-folder breadcrumb **⋮** offers Rename / Picture / Delete when allowed, plus **Refresh All Thumbnails** (disabled with “enable in Settings” when thumbnails are off; disabled when the open folder has no http(s) bookmarks). Browser bookmark root shows the ⋮ menu for Refresh All (no Rename/Delete).
- [ ] **Refresh All Thumbnails** confirms before replacing dial pictures; runs the same capture path as per-tile Capture thumbnail, sequentially, for direct http(s) children only (not nested folders).
- [ ] New-tab **gear** opens Settings in the in-page dialog overlay (categorized: layout sliders, display switches / default folder, **Theme** mode / accent / local background, picture switches + wait slider, **Backup** export/import, Danger Zone). `settings.html` remains available as the extension options page.

## Drag

- [ ] Drag a dial left/right among siblings: order changes and sticks after reload.
- [ ] Drop on a folder tile’s center (or a breadcrumb): dial moves into that folder.
- [ ] Edge drop on a folder tile still reorders among siblings (does not move into).

## Grid settings

- [ ] In the Settings overlay: **Layout / Display / Theme / Pictures / Backup / Danger Zone** categories; Danger Zone stays last; panel scrolls when content is tall.
- [ ] **Columns**, **Tile size**, and **Thumbnail wait** are all sliders (columns 1–8; wait 1–15; tile size unchanged). Layout updates on the open new tab.
- [ ] Close and reopen Settings: **Tile size** (and other) sliders sit at the saved values (not the middle/default).
- [ ] Boolean prefs use switch toggles (not checkboxes): reverse order, thumbnails, URL pictures.
- [ ] **Theme → Appearance**: Auto (system) is the default; Light and Dark lock the look. Switching updates the dial immediately.
- [ ] **Theme → Accent**: Ember / Brass / Clay / Moss visibly tint page wash, tile surfaces, titles, domain/meta labels, breadcrumbs, gear/⋮ icons, and CTAs (still a small warm palette — not a full arbitrary recolor).
- [ ] **Theme → Page color override**: optional solid override; **Use accent default** restores the Appearance+Accent wash (shared by dial, Settings, and Add).
- [ ] **Theme → Background image**: full-width preview above **Add image** / **Remove image** buttons; choose a local JPEG/PNG/GIF/WebP; fit / position / opacity appear when an image is set; **Remove image** clears it. No remote wallpaper URL field.
- [ ] **Thumbnail wait** defaults to 2s (range 1–15); raising it delays the screenshot so slow pages can paint.
- [ ] **Default folder for new windows** unset → new tab recalls last open; set to a folder → new tab / new window opens there; navigating still updates last-open; missing folder falls back gracefully.
- [ ] Toggle **Show last bookmarks first**; grid order reverses without changing the browser’s bookmark manager order.
- [ ] Dial face / photo corner radius is subtle (~2% of tile width), not a large rounded rect.
- [ ] Dragging **Tile size** up grows the dial face / preview image steadily (grid gap stays ~16px; faces do not grow-then-shrink).
- [ ] **Reset to Defaults** restores theme prefs and clears the wallpaper (keeps dial pictures); **Erase All Data** also clears dial pictures and the wallpaper (never bookmarks).
- [ ] **Backup → Export…** downloads a JSON file (dial pictures, theme wallpaper, layout/theme prefs). Browser bookmarks are not in the file.
- [ ] **Backup → Import…** rejects a non-Hearth file; for a valid backup, offers **Merge** (keep local pictures not in the file) or **Overwrite** (replace Hearth settings + all dial pictures). Neither path changes browser bookmarks.

## Local pictures / URL / thumbnails

- [ ] Oversized or non-image file shows an error (no silent success). Folder default art is a folder icon; bookmarks keep monogram until a picture is set.
- [ ] Settings **Pictures** shows a labeled **Dial picture storage** readout (not just help text under wait); updates after Erase All Data clears pictures.
- [ ] If the browser rejects a picture write (full disk / remaining storage limits), the dial shows a clear error — not a silent miss.
- [ ] **Assign pictures from URLs** off by default; **Image from URL…** disabled until enabled. First turn on → browser prompts for optional http/https site access. Deny → setting stays off. Grant → menu unlocks; enter an https image URL → dial shows the picture; storage holds a data URL.
- [ ] Turn **Assign pictures from URLs** off → active access is dropped; menu locks again. Turn on again → `permissions.request` runs; Chrome usually restores without a dialog after the first Allow (expected); Firefox may re-prompt. To force a new prompt on Chrome, revoke under `chrome://extensions` → Hearth → site access, then enable again.
- [ ] **Generate dial thumbnails** off by default; first enable prompts for optional tabs + site access. Deny → setting stays off; grant → **Capture thumbnail** works (temp window opens, then closes; dial face updates). Off → on after Allow may be silent on Chrome; revoke in extension details to force a new prompt.
- [ ] After grant: revoke optional site access in the browser’s extension details → reopen new tab → thumbnail / URL-fetch settings degrade (off / menu locked), no crash.

## Add to Hearth (context menu)

- [ ] On a normal `https` page (or link): right-click → **Add to Hearth…**.
- [ ] On the Hearth new-tab dial page: right-click → **Refresh All Thumbnails** (not **Add to Hearth…**). Settings / Add popup pages do not show Refresh All.
- [ ] Popup fits its content (no dual scrollbars); maximizing fills the window (not a tiny floating card).
- [ ] **Name** prefers the page title (not only the domain); address is read-only.
- [ ] Folder picker is a collapsible tree (collapsed by default). When Settings **default folder for new windows** is set, the picker is scoped to that folder and its descendants.
- [ ] Choosing a folder and **Add bookmark** creates the dial there; cancel closes without adding.
- [ ] New-tab open folder is not used unless you pick it in the popup (or it is the Settings default and thus in scope).

## Packaging sanity

- [ ] **Chrome:** Fresh install / after adding install-time permissions: Remove the unpacked extension and **Load unpacked** again from `dist/chrome` (Reload alone can leave an old permission set). Details: always-on includes **Unlimited storage** and **Favicon**; no host permissions granted yet; optional permissions listed but inactive until used.
- [ ] **Firefox:** Temporary add-on loads from `dist/firefox/manifest.json`; about:addons / debugging shows no favicon permission; gecko id `hearth-speed-dial@antgraf`; new tab override works.
- [ ] Settings **Dial picture storage** shows used size with “no fixed size cap” (not “of 10 MB”) when `unlimitedStorage` is active.
- [ ] Service worker / Errors panel (or Firefox browser console for the extension) stays clean while exercising the steps above.
- [ ] Optional: `npm run pack:chrome` / `npm run pack:firefox` produce zips under `artifacts/` with `manifest.json` at the zip root.