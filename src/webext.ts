import { t } from "./i18n.ts";

/**
 * Cross-browser extension API entry point.
 *
 * Prefer Firefox’s promise-based `browser` namespace when present; fall back to
 * Chromium’s `chrome`. Call sites should not touch `chrome` / `browser` globals
 * directly except through this module (tests may still inject `chrome`).
 */

export type ExtensionApi = typeof chrome;

type ExtensionGlobals = typeof globalThis & {
  browser?: ExtensionApi;
  chrome?: ExtensionApi;
};

function globals(): ExtensionGlobals {
  return globalThis as ExtensionGlobals;
}

/**
 * Resolve the WebExtension API. Returns null outside an extension page / worker
 * (and in Vite preview when neither global is injected).
 */
export function tryExtensionApi(): ExtensionApi | null {
  const g = globals();
  // Prefer `browser` so Firefox gets promise-based APIs (its `chrome.*` is
  // callback-style and breaks our async/await adapters).
  if (g.browser?.runtime) return g.browser;
  if (g.chrome?.runtime) return g.chrome;
  return null;
}

/** Like tryExtensionApi, but throws when the API is missing. */
export function extensionApi(): ExtensionApi {
  const api = tryExtensionApi();
  if (!api) {
    throw new Error(t("error_extension_api_missing"));
  }
  return api;
}

/** True when bookmarks + storage.local are available (dial / settings boot). */
export function extensionStorageReady(api: ExtensionApi | null = tryExtensionApi()): boolean {
  return Boolean(api?.storage?.local);
}

/** True when the bookmarks API is available. */
export function extensionBookmarksReady(api: ExtensionApi | null = tryExtensionApi()): boolean {
  return Boolean(api?.bookmarks);
}

/**
 * Chrome-only: install-time `favicon` + `/_favicon/` profile-cache endpoint.
 * Firefox has no equivalent without network / host access — title icons stay off.
 */
export function supportsChromeFavicon(api: ExtensionApi | null = tryExtensionApi()): boolean {
  if (!api?.runtime?.getManifest) return false;
  try {
    const manifest = api.runtime.getManifest() as { permissions?: string[] };
    const permissions = manifest.permissions ?? [];
    return permissions.includes("favicon");
  } catch {
    return false;
  }
}
