import { start } from "./app.ts";
import { chromeBookmarks, chromeCapture, chromeImages, chromePermissions, chromeSettings } from "./browser.ts";
import {
  extensionBookmarksReady,
  extensionStorageReady,
  tryExtensionApi,
} from "./webext.ts";

const host = document.querySelector("#app");
if (!(host instanceof HTMLElement)) {
  throw new Error("Missing #app");
}

const api = tryExtensionApi();
const bookmarksReady = extensionBookmarksReady(api);
const storageReady = extensionStorageReady(api);

if (bookmarksReady && storageReady) {
  start(host, {
    bookmarks: chromeBookmarks(),
    settings: chromeSettings(),
    images: chromeImages(),
    permissions: chromePermissions(),
    capture: chromeCapture(),
  });
} else if (import.meta.env.DEV) {
  const { previewBanner, previewPorts } = await import("./preview.ts");
  const ports = previewPorts();
  start(host, {
    ...ports,
    banner: previewBanner,
  });
} else {
  host.textContent =
    "Open Hearth from a new tab after loading the extension in Chrome or Firefox.";
}
