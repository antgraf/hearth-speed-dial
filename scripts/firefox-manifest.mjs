/**
 * Transform the Chrome root manifest into a Firefox MV3 WebExtension manifest.
 * Shared by prepare-firefox-dist and unit tests.
 */

/** Stable AMO / temporary-addon id (email-like; not a random UUID). */
export const FIREFOX_EXTENSION_ID = "hearth-speed-dial@antgraf";

/** Firefox 121+ for MV3 background service workers. */
export const FIREFOX_STRICT_MIN_VERSION = "121.0";

/**
 * AMO requires this for new extensions (2025-11-03+). Hearth collects nothing
 * outside the local browser, so the only valid required value is "none".
 * @see https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/
 */
export const FIREFOX_DATA_COLLECTION_PERMISSIONS = Object.freeze({
  required: Object.freeze(["none"]),
});

/**
 * @typedef {object} ChromeManifest
 * @property {number} manifest_version
 * @property {string} name
 * @property {string} version
 * @property {string} [description]
 * @property {string[]} [permissions]
 * @property {string[]} [optional_permissions]
 * @property {string[]} [optional_host_permissions]
 * @property {object} [background]
 * @property {object} [icons]
 * @property {object} [chrome_url_overrides]
 * @property {string} [options_page]
 * @property {object} [browser_specific_settings]
 */

/**
 * @param {ChromeManifest} chromeManifest
 * @returns {ChromeManifest}
 */
export function chromeManifestToFirefox(chromeManifest) {
  if (chromeManifest.manifest_version !== 3) {
    throw new Error(`Expected manifest_version 3, got ${chromeManifest.manifest_version}`);
  }

  /** @type {ChromeManifest} */
  const firefox = structuredClone(chromeManifest);

  // Chrome-only: profile favicon cache. No AMO equivalent without host/network.
  firefox.permissions = (firefox.permissions ?? []).filter((p) => p !== "favicon");

  // Firefox 121–127: host patterns belong in optional_permissions.
  // Keep listing them there for optional permissions.request({ origins }).
  const hosts = firefox.optional_host_permissions ?? [];
  delete firefox.optional_host_permissions;
  const optionalApi = firefox.optional_permissions ?? [];
  firefox.optional_permissions = [...new Set([...optionalApi, ...hosts])];

  firefox.browser_specific_settings = {
    gecko: {
      id: FIREFOX_EXTENSION_ID,
      strict_min_version: FIREFOX_STRICT_MIN_VERSION,
      data_collection_permissions: {
        required: [...FIREFOX_DATA_COLLECTION_PERMISSIONS.required],
      },
    },
  };

  // background.service_worker + type:module matches the Vite Chrome build output
  // and is supported on Firefox 121+.
  if (!firefox.background?.service_worker) {
    throw new Error("Chrome manifest missing background.service_worker");
  }

  return firefox;
}

/**
 * @param {ChromeManifest} firefoxManifest
 */
export function assertFirefoxManifest(firefoxManifest) {
  if (firefoxManifest.manifest_version !== 3) {
    throw new Error("Firefox manifest must be MV3");
  }
  if (firefoxManifest.permissions?.includes("favicon")) {
    throw new Error("Firefox manifest must not declare Chrome-only favicon");
  }
  if (firefoxManifest.optional_host_permissions) {
    throw new Error("Firefox manifest should fold hosts into optional_permissions");
  }
  const optional = new Set(firefoxManifest.optional_permissions ?? []);
  for (const required of ["tabs", "<all_urls>", "http://*/*", "https://*/*"]) {
    if (!optional.has(required)) {
      throw new Error(`Firefox optional_permissions missing ${required}`);
    }
  }
  const gecko = firefoxManifest.browser_specific_settings?.gecko;
  if (!gecko?.id || !gecko?.strict_min_version) {
    throw new Error("Firefox manifest missing browser_specific_settings.gecko id/min version");
  }
  const requiredCollection = gecko.data_collection_permissions?.required;
  if (
    !Array.isArray(requiredCollection) ||
    requiredCollection.length !== 1 ||
    requiredCollection[0] !== "none"
  ) {
    throw new Error(
      'Firefox manifest must set gecko.data_collection_permissions.required to ["none"]',
    );
  }
  if (firefoxManifest.chrome_url_overrides?.newtab !== "index.html") {
    throw new Error("Firefox manifest missing chrome_url_overrides.newtab");
  }
  if (!firefoxManifest.background?.service_worker) {
    throw new Error("Firefox manifest missing background.service_worker");
  }
}
