import { startSettings } from "./settings-app.ts";
import { chromePermissions, chromeSettings } from "./browser.ts";
import { previewSettings } from "./settings.ts";

const host = document.querySelector("#app");
if (!(host instanceof HTMLElement)) {
  throw new Error("Missing #app");
}

const storageReady = typeof chrome !== "undefined" && Boolean(chrome.storage?.local);

if (storageReady) {
  startSettings(host, chromeSettings(), null, chromePermissions());
} else if (import.meta.env.DEV) {
  startSettings(host, previewSettings(), "Preview mode — settings save in this browser’s localStorage.");
} else {
  host.textContent = "Open Hearth settings from the extension after loading it in Chrome.";
}
