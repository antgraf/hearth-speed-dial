import { tryExtensionApi } from "./webext.ts";

/**
 * Query key for dial deep links: `index.html?folder=<bookmarkNodeId>`.
 * Prefer query over hash so reload / bookmark keep the intent.
 */
export const FOLDER_DEEP_LINK_PARAM = "folder";

/**
 * Parse a folder deep-link id from a location search string.
 * Returns null when the param is absent or empty after trim.
 * Does not validate against the bookmark tree — callers must.
 */
export function parseFolderDeepLink(search: string): string | null {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  const value = params.get(FOLDER_DEEP_LINK_PARAM);
  if (value === null) return null;
  const id = value.trim();
  return id.length > 0 ? id : null;
}

/**
 * Relative dial path with a folder query (same document as the NTP override).
 */
export function folderDeepLinkPath(id: string): string {
  return `index.html?${FOLDER_DEEP_LINK_PARAM}=${encodeURIComponent(id)}`;
}

/**
 * Absolute extension URL for a folder deep link via `runtime.getURL`.
 * Falls back to the relative path when the extension API is unavailable
 * (unit tests / Vite preview).
 */
export function folderDeepLinkHref(
  id: string,
  getURL: ((path: string) => string) | null = tryExtensionApi()?.runtime.getURL ?? null,
): string {
  const path = folderDeepLinkPath(id);
  if (!getURL) return path;
  try {
    return getURL(path);
  } catch {
    return path;
  }
}
