import { startSettings } from "./settings-app.ts";
import { chromeBookmarks, chromeImages, chromePermissions, chromeSettings } from "./browser.ts";
import { t } from "./i18n.ts";
import { previewSettings } from "./settings.ts";
import { previewPorts } from "./preview.ts";
import { extensionStorageReady, tryExtensionApi } from "./webext.ts";

document.title = t("page_title_settings");

const host = document.querySelector("#app");
if (!(host instanceof HTMLElement)) {
  throw new Error("Missing #app");
}

const storageReady = extensionStorageReady(tryExtensionApi());

if (storageReady) {
  startSettings(host, chromeSettings(), null, chromePermissions(), chromeBookmarks(), chromeImages());
} else if (import.meta.env.DEV) {
  const ports = previewPorts();
  startSettings(
    host,
    previewSettings(),
    t("preview_settings_banner"),
    ports.permissions,
    ports.bookmarks,
    ports.images,
  );
} else {
  host.textContent = t("boot_settings_required");
}
