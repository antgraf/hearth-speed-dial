# Hearth Speed Dial — product spec

Status: v1 product bar is implemented on Chrome (Manifest V3). New-tab grid of the bookmark tree; create, rename, delete; drag reorder and drag into folders; grid columns/tile size and display-order reverse in an in-page **Settings** overlay (gear; 16:9 faces, width up to 576px; `settings.html` remains a secondary options entry); context-menu **Add to Hearth…** with folder picker; local image per dial with monogram fallback for bookmarks and a folder icon for folders; in-page dialogs for rename, delete confirm, settings, and ⋮ action menus (tile + current folder). Create uses one **New** control that chooses folder vs bookmark. Still Chrome only; no image URLs, thumbnails, or refresh.

## Vision

Hearth Speed Dial replaces the new tab with a grid of sites you can see, group in folders, and rearrange. Adding a page can show a picture of that site. The extension keeps no account and does not upload the dial list, images, or usage anywhere. Every dial is an ordinary browser bookmark, folders included, so Chrome sync is the cloud copy and the bookmark manager edits the same tree.

Thumbnail generation, image URLs, and refresh are part of the vision and are not in v1.

## v1

Chrome, Manifest V3, unpacked load from this repo. One extension, one new-tab page.

- A customizable grid: column count and dial face width (faces are **16:9**, width up to 576px), saved in `chrome.storage.local` and edited from the new-tab **Settings** overlay (gear). That overlay can also reverse display order so last bookmarks appear first (display preference only; Chrome bookmark order stays the store of truth). `settings.html` / `options_page` remains a secondary entry from Chrome’s extension details.
- The new tab is a grid of the open bookmark folder. Chrome’s root is that same grid of folders. Nested folders open in the grid. A new tab reopens the last folder. The bookmark’s title, URL, parent, and order are the source of truth. The open folder can gain a new folder or bookmark from a single **New** control (chooser for folder vs bookmark).
- Drag a dial to reorder it or move it, including into another folder in the tree.
- Right-click a normal web page to add it as a bookmark in a folder of the dial tree, including a nested folder.
- A dial with no picture shows a monogram for bookmarks, or a folder icon for folders. The user can attach one local image file. That file is stored in the extension, keyed by bookmark id. There is no image URL, no screenshot capture, no favicon lookup, and no refresh action.
- No account, no analytics, and no request to a service run for this extension. v1 does not ask for host permissions.

Out of v1: Firefox, image URLs, generated thumbnails, refresh one, refresh a folder, `unlimitedStorage` (revisit only if local images outgrow the default quota).

## Hard requirements this spec is aiming at

These stay the product bar. v1 covers each one except remote and generated images.

1. New-tab speed dial with a customizable grid.
2. Assign an image, or generate a thumbnail, with a picture or favicon on creation, plus refresh of one thumbnail or all of them. v1 assigns a local image only.
3. Add the current page from a right-click, into a chosen folder.
4. Items are normal bookmarks. Sync is the browser’s. The bookmark manager can edit them.
5. Drag to order and to move.
6. Folders nest, and add, drag, and (later) thumbnail refresh apply inside a folder.

## Assumptions

- The fallback picture is a monogram for bookmarks (not Chrome’s favicon cache). Folders without a picture use a folder icon. Say if v1 should show the favicon instead.
- The right-click item lets the user pick the destination folder. It does not silently use whichever folder is open on the new-tab page.
- Settings that are not bookmarks (grid, display-order reverse, last opened folder id, image blobs) live in extension storage and do not sync in v1.
- Copyright holder for the MIT license is the GitHub account `antgraf`.
