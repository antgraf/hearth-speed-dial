# Privacy policy — Hearth Speed Dial

_Last updated: October 6, 2026_

Hearth Speed Dial ("Hearth") is a browser extension for Google Chrome, Mozilla Firefox, and Microsoft Edge. It replaces the new tab page with a speed dial of your own bookmarks. This policy explains what information Hearth uses, where it is kept, and what leaves your device.

## Summary

- **Hearth does not collect your data.** It has no server, no account, no analytics, no ads, and no tracking. Nothing is sent to the developer.
- **Your dials are your browser's bookmarks.** Hearth's own settings and pictures are kept in your browser's extension storage.
- **Your browser's sync is the only cloud copy.** If you turn on sync in your browser, the browser copies your bookmarks and Hearth's small layout and theme preferences to your other devices. Pictures are never synced or uploaded.
- **Two optional picture features are off by default.** They contact a website only when you use them, and only the website you chose.

In this policy, "collect" means sending information off your device to the developer, or to anyone else on Hearth's behalf. Hearth does not do this.

## Information Hearth uses on your device

### Bookmarks

The speed dial is your bookmark tree (Microsoft Edge calls bookmarks "favorites"). Hearth reads your bookmark folders and bookmarks to show them as tiles. It changes them only when you ask: when you add, rename, move, reorder, or delete a dial or folder in Hearth, or save a page with **Add to Hearth…**. Deleting a dial asks for confirmation first and removes that bookmark from your browser. Hearth does not keep its own copy of your bookmark list.

### Settings

Hearth saves its settings in your browser's extension storage.

- **Layout and theme preferences** (columns, tile size, display order, thumbnail wait time, appearance mode, accent color, page color, and wallpaper fit, position, and opacity) are saved in the browser's extension sync storage. If browser sync is on, your browser can copy these preferences to your other signed-in devices. If it is off, they stay on this device.
- **Device settings** stay on this device: the folder you last opened, an optional default folder, whether each optional picture feature is turned on, and whether you have dismissed the welcome card.

### Pictures

Dial pictures and an optional theme wallpaper are resized on your device and saved in the extension's local storage in this browser profile. They are not synced and not uploaded.

### Page title when you use Add to Hearth…

When you right-click a web page or a link and choose **Add to Hearth…**, Hearth uses the address of that page or link. For a page, it also reads the tab's title once, so the new bookmark starts with a sensible name. You can edit the name before saving. Hearth reads nothing else from the page.

### Site icons (Chrome and Edge)

Next to dial titles, Hearth shows small site icons that your browser has already cached. Hearth does not download icons or use an icon service. Firefox does not offer this to extensions, so Hearth shows no title icons there.

## Optional features that contact websites

Both features are off by default. When you turn one on in Hearth's Settings, your browser asks you to allow the extra access. Turning the feature off removes that access.

- **Assign pictures from URLs.** When you enter an image address, Hearth downloads that one image from the website you named, without sending cookies, and stores a resized copy on your device. The dial does not keep loading the image from that website.
- **Generate dial thumbnails.** When you capture a thumbnail, or use **Refresh All Thumbnails** for a folder, Hearth opens each bookmarked page in a temporary window, waits the time set in Settings (2 seconds by default), takes a screenshot, stores a resized copy on your device, and closes the window. The website sees an ordinary visit from your browser.

In both cases the only request goes to the website you chose. Hearth sends nothing to the developer.

## Backup files

**Settings → Backup → Export…** saves a file with your Hearth settings, theme wallpaper, and dial pictures. Each picture records the address of the bookmark it belongs to, so it can be matched on another device. The file is saved where you choose, and Hearth never uploads it. **Import…** reads only a file you select. Backups do not contain your bookmark tree, and importing never changes your bookmarks.

## What Hearth does not do

- No account or sign-in
- No analytics, telemetry, or crash reporting
- No ads, and no selling, sharing, or transferring of your information
- No remote code: everything Hearth runs is included in the extension package
- No reading of the pages you visit, apart from the title of a page you choose to add and the screenshots you ask the optional thumbnail feature to take

## Permissions

| Permission | When | Why |
| --- | --- | --- |
| Bookmarks | Install | Show your bookmarks as the dial and make the changes you ask for |
| Storage | Install | Save Hearth's settings and pictures |
| Unlimited storage | Install | Let pictures use more than the browser's default extension storage limit — still on your device only |
| Context menus | Install | Add **Add to Hearth…** to the right-click menu, plus Hearth's own actions on the Hearth page |
| Active tab | Install | Read the title of the page you right-click, only when you choose **Add to Hearth…** |
| Favicon (Chrome and Edge only) | Install | Show site icons from the browser's local icon cache |
| Access to all sites | Optional — only if you turn on **Generate dial thumbnails** | Open a page briefly and capture its thumbnail |
| Access to http and https sites | Optional — only if you turn on **Assign pictures from URLs** | Download an image you chose |

## Your choices

- Turn either optional picture feature on or off in Settings at any time. You can also remove optional access from your browser's extension settings.
- **Settings → Danger Zone → Erase All Data** deletes Hearth's settings (including synced preferences), theme wallpaper, and all dial pictures, and turns the optional picture features off. It does not delete your bookmarks.
- Uninstalling Hearth removes its locally stored data from that browser profile. To clear synced preferences as well, use **Erase All Data** before you uninstall. Your bookmarks stay either way.

## Browser and store services

Hearth works with features your browser provides. When you use browser sync, your browser's maker (Google, Mozilla, or Microsoft) handles that data under its own privacy policy. The Chrome Web Store, Firefox Add-ons, and Microsoft Edge Add-ons show the developer aggregate statistics such as install counts. Hearth itself sends nothing.

## Chrome Web Store User Data Policy

Hearth's use of information complies with the Chrome Web Store User Data Policy, including the Limited Use requirements. Information is used only to provide Hearth's speed dial features. It is never sold or transferred, never used for advertising or to determine creditworthiness, and never read by people.

## Children

Hearth is a general-purpose tool and is not directed at children. It does not collect personal information from anyone.

## Changes to this policy

If Hearth's handling of information changes, this policy will be updated in the same release and the date at the top will change. Earlier versions are in the history of this file in the project repository.

## Contact

Questions or concerns: open an issue at <https://github.com/antgraf/hearth-speed-dial/issues>.
