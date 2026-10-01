import { startAdd } from "./add-app.ts";
import { chromeBookmarks, chromeSettings } from "./browser.ts";
import { t } from "./i18n.ts";
import { extensionBookmarksReady, tryExtensionApi } from "./webext.ts";

document.documentElement.classList.add("add-page");
document.title = t("page_title_add");

const host = document.querySelector("#app");
if (!(host instanceof HTMLElement)) {
  throw new Error("Missing #app");
}

const bookmarksReady = extensionBookmarksReady(tryExtensionApi());

if (bookmarksReady) {
  startAdd(host, {
    bookmarks: chromeBookmarks(),
    settings: chromeSettings(),
    search: location.search,
    close: () => {
      window.close();
    },
  });
} else {
  host.textContent = t("boot_add_required");
}
