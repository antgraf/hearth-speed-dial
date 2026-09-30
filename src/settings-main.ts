import { startSettings } from "./settings-app.ts";
import { chromeBookmarks, chromeImages, chromePermissions, chromeSettings } from "./browser.ts";
import { previewSettings } from "./settings.ts";
import { previewPorts } from "./preview.ts";

const host = document.querySelector("#app");
if (!(host instanceof HTMLElement)) {
  throw new Error("Missing #app");
}

const storageReady = typeof chrome !== "undefined" && Boolean(chrome.storage?.local);

if (storageReady) {
  startSettings(host, chromeSettings(), null, chromePermissions(), chromeBookmarks(), chromeImages());
} else if (import.meta.env.DEV) {
  const ports = previewPorts();
  startSettings(
    host,
    previewSettings(),
    "Preview mode — settings save in this browser’s localStorage.",
    ports.permissions,
    ports.bookmarks,
    ports.images,
  );
} else {
  host.textContent = "Open Hearth settings from the extension after loading it in Chrome.";
}
