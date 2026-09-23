# Hearth Speed Dial — product spec

Status: phase 0 locked. The new tab shows the bookmark tree as a grid and can add a folder or bookmark in the open folder. Rename, delete, drag, right-click add, and local images are still ahead. v1 is Chrome only, with local images only.

## Vision

Hearth Speed Dial replaces the new tab with a grid of sites you can see, group in folders, and rearrange. Adding a page can show a picture of that site. The extension keeps no account and does not upload the dial list, images, or usage anywhere. Every dial is an ordinary browser bookmark, folders included, so Chrome sync is the cloud copy and the bookmark manager edits the same tree.

Thumbnail generation, image URLs, and refresh are part of the vision and are not in v1.

## v1

Chrome, Manifest V3, unpacked load from this repo. One extension, one new-tab page.

- A customizable grid: column count and tile size, saved in `chrome.storage.local`.
- The new tab is a grid of the open bookmark folder. Chrome’s root is that same grid of folders. Nested folders open in the grid. A new tab reopens the last folder. The bookmark’s title, URL, parent, and order are the source of truth. The open folder can gain a new folder or bookmark from the grid.
- Drag a dial to reorder it or move it, including into another folder in the tree.
- Right-click a normal web page to add it as a bookmark in a folder of the dial tree, including a nested folder.
- A dial with no picture shows a monogram drawn in the browser. The user can attach one local image file. That file is stored in the extension, keyed by bookmark id. There is no image URL, no screenshot capture, no favicon lookup, and no refresh action.
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

- The fallback picture is a monogram, not Chrome’s favicon cache. Say if v1 should show the favicon instead.
- The right-click item lets the user pick the destination folder. It does not silently use whichever folder is open on the new-tab page.
- Settings that are not bookmarks (grid, last opened folder id, image blobs) live in extension storage and do not sync in v1.
- Copyright holder for the MIT license is the GitHub account `antgraf`.
