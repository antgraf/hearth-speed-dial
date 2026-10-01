import { start } from "./app.ts";
import { chromeBookmarks, chromeCapture, chromeImages, chromePermissions, chromeSettings } from "./browser.ts";
import { t } from "./i18n.ts";
import {
  extensionBookmarksReady,
  extensionStorageReady,
  tryExtensionApi,
} from "./webext.ts";

document.title = t("page_title_new_tab");

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
    banner: previewBanner(),
  });
} else {
  host.textContent = t("boot_extension_required");
}
