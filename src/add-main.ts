import { startAdd } from "./add-app.ts";
import { chromeBookmarks } from "./browser.ts";

const host = document.querySelector("#app");
if (!(host instanceof HTMLElement)) {
  throw new Error("Missing #app");
}

const bookmarksReady = typeof chrome !== "undefined" && Boolean(chrome.bookmarks);

if (bookmarksReady) {
  startAdd(host, {
    bookmarks: chromeBookmarks(),
    search: location.search,
    close: () => {
      window.close();
    },
  });
} else {
  host.textContent = "Open Add to Hearth from the extension context menu in Chrome.";
}
