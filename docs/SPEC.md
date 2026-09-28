# Hearth Speed Dial — product spec

Status: Chrome Manifest V3 new-tab speed dial of the bookmark tree; create, rename, delete; drag reorder and drag into folders; grid columns/tile size and display-order reverse in an in-page **Settings** overlay (gear; 16:9 faces, width up to 576px; `settings.html` remains a secondary options entry); context-menu **Add to Hearth…** with folder picker; dial pictures from a local file, an image URL (fetched once into local storage), or an optional captured thumbnail; monogram fallback for bookmarks and a folder icon for folders; in-page dialogs for rename, delete confirm, settings, and ⋮ action menus (tile + current folder). Create uses one **New** control that chooses folder vs bookmark. Still Chrome only; refresh one / refresh folder remain out of scope.

## Vision

Hearth Speed Dial replaces the new tab with a grid of sites you can see, group in folders, and rearrange. Adding a page can show a picture of that site. The extension keeps no account and does not upload the dial list, images, or usage anywhere. Every dial is an ordinary browser bookmark, folders included, so Chrome sync is the cloud copy and the bookmark manager edits the same tree.

Refresh of one thumbnail or a whole folder is part of the vision and is not required yet. Image URLs and optional thumbnail capture are in product scope under the opt-in permission model below.

## Product bar (Chrome MV3)

Chrome, Manifest V3, unpacked load from this repo. One extension, one new-tab page.

- A customizable grid: column count and dial face width (faces are **16:9**, width up to 576px), saved in `chrome.storage.local` and edited from the new-tab **Settings** overlay (gear). That overlay can also reverse display order so last bookmarks appear first (display preference only; Chrome bookmark order stays the store of truth). `settings.html` / `options_page` remains a secondary entry from Chrome’s extension details.
- The new tab is a grid of the open bookmark folder. Chrome’s root is that same grid of folders. Nested folders open in the grid. A new tab reopens the last folder. The bookmark’s title, URL, parent, and order are the source of truth. The open folder can gain a new folder or bookmark from a single **New** control (chooser for folder vs bookmark).
- Drag a dial to reorder it or move it, including into another folder in the tree.
- Right-click a normal web page to add it as a bookmark in a folder of the dial tree, including a nested folder.
- A dial with no picture shows a monogram for bookmarks, or a folder icon for folders. The user can assign a picture by:
  - attaching one local image file, or
  - entering an image URL (http/https) when that opt-in is on. Hearth fetches the image **once** and stores it as a local data URL in `chrome.storage.local` (same store as file attach). The dial does **not** hotlink the remote URL afterward.
  - capturing a page thumbnail when that opt-in is on (see Permissions).
- **Thumbnail generation** is optional and **disabled by default** in Settings. Enabling it calls `chrome.permissions.request` for the optional permissions needed to open the page and capture a screenshot. On grant, the tile **Picture…** menu offers **Capture thumbnail** (temporary window → `captureVisibleTab` → store JPEG data URL → close window). If the user denies the prompt, or later revokes optional access in Chrome’s extension details, the setting stays off / capture degrades gracefully.
- **Assign pictures from URLs** is a separate Settings toggle, also **off by default**. Enabling it requests optional http/https host access. On grant, **Picture… → Image from URL…** is unlocked. Turning the toggle off calls `chrome.permissions.remove` for those http/https grants (not `tabs` / `<all_urls>` used by thumbnails), so active access drops while the setting is off. Chrome usually restores a previously allowed optional grant on the next enable **without** showing the dialog again; to force a new prompt, revoke site access under `chrome://extensions` → Hearth. Deny or revoke degrades gracefully like thumbnails. Optional permissions are **not** requested at install or on first new-tab open.
- No account, no analytics, and no request to a service run for this extension.

Default install permissions stay narrow: `bookmarks`, `storage`, `contextMenus` only. Host access and `tabs` are **optional** (see Permissions).

Out of scope for now: Firefox; refresh one; refresh a folder; `unlimitedStorage` (revisit only if local images outgrow the default quota); favicon-as-fallback (monogram / folder icon remain the defaults).

## Permissions

| Kind | Permissions | When |
| --- | --- | --- |
| Always on | `bookmarks`, `storage`, `contextMenus` | Install |
| Optional | `tabs` + host `<all_urls>` | Only when the user enables **Generate dial thumbnails** in Settings |
| Optional | Host `http://*/*` + `https://*/*` | Only when the user enables **Assign pictures from URLs** in Settings. Manifest `optional_host_permissions` lists those scheme wildcards (plus `<all_urls>` for thumbnails). Turning the toggle off removes those http/https grants from the **active** set. |

**Choice:** The two opt-ins are independent. Thumbnails keep `tabs` + `<all_urls>`; URL fetch uses the http/https scheme wildcards. If thumbnails already granted `<all_urls>`, URL fetch can use that host access when its own toggle is on (no second host prompt). Turning URL fetch off does **not** revoke thumbnail `<all_urls>` / `tabs`. Toggle-off `permissions.remove` drops active capability; Chrome’s optional-permission “granted” memory means a later `permissions.request` for the same grant typically returns true without a dialog (documented Chrome behavior). Always-on install permissions stay narrow.

## Hard requirements this spec is aiming at

These stay the product bar.

1. New-tab speed dial with a customizable grid.
2. Assign an image (local file, or URL / thumbnail when the matching Settings opt-in and optional permissions are granted). Favicon-on-creation and refresh of one / all thumbnails remain later vision.
3. Add the current page from a right-click, into a chosen folder.
4. Items are normal bookmarks. Sync is the browser’s. The bookmark manager can edit them.
5. Drag to order and to move.
6. Folders nest, and add, drag, and (later) thumbnail refresh apply inside a folder.

## Assumptions

- The fallback picture is a monogram for bookmarks (not Chrome’s favicon cache). Folders without a picture use a folder icon. Say if the product should show the favicon instead.
- The right-click item lets the user pick the destination folder. It does not silently use whichever folder is open on the new-tab page.
- Settings that are not bookmarks (grid, display-order reverse, thumbnail opt-in, last opened folder id, image blobs) live in extension storage and do not sync yet.
- Copyright holder for the MIT license is the GitHub account `antgraf`.
