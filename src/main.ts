import { start } from "./app.ts";
import { chromeBookmarks, chromeSettings } from "./browser.ts";

const host = document.querySelector("#app");
if (!(host instanceof HTMLElement)) {
  throw new Error("Missing #app");
}

const bookmarksReady = typeof chrome !== "undefined" && Boolean(chrome.bookmarks);
const storageReady = typeof chrome !== "undefined" && Boolean(chrome.storage?.local);

if (bookmarksReady && storageReady) {
  start(host, { bookmarks: chromeBookmarks(), settings: chromeSettings() });
} else if (import.meta.env.DEV) {
  const { previewBanner, previewPorts } = await import("./preview.ts");
  const ports = previewPorts();
  start(host, { ...ports, banner: previewBanner });
} else {
  host.textContent = "Open Hearth from a Chrome new tab after loading the extension.";
}
