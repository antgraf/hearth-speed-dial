/**
 * Chrome profile favicon cache for dial title strips.
 *
 * Requires install-time `favicon` permission. Builds a chrome-extension://
 * `_favicon` URL against the local cache only — no network fetch and no
 * third-party icon CDN (those would leak the bookmark list).
 *
 * Install-time (not optional): fresh installs over a real bookmark tree need
 * icons immediately for recognizability. Monogram / folder icon remain the
 * dial-face fallbacks; a missing cache entry simply hides the title icon.
 */

import { openableUrl } from "./model.ts";

/** Default pixel size for the title-strip favicon. */
export const TITLE_FAVICON_SIZE = 16;

export type FaviconRuntime = Pick<typeof chrome.runtime, "getURL">;

/**
 * True when `href` can resolve a Chrome favicon (http/https only).
 * file: bookmarks stay openable but usually have no profile favicon.
 */
export function faviconEligibleUrl(href: string): string | null {
  const openable = openableUrl(href);
  if (!openable) return null;
  try {
    const protocol = new URL(openable).protocol;
    if (protocol !== "http:" && protocol !== "https:") return null;
    return openable;
  } catch {
    return null;
  }
}

/**
 * Build a `_favicon` image URL for `pageUrl`.
 * `faviconBaseUrl` is typically `runtime.getURL("/_favicon/")`.
 */
export function buildFaviconSrc(
  pageUrl: string,
  faviconBaseUrl: string,
  size: number = TITLE_FAVICON_SIZE,
): string | null {
  const eligible = faviconEligibleUrl(pageUrl);
  if (!eligible) return null;
  const pixels = Number.isFinite(size) ? Math.max(1, Math.floor(size)) : TITLE_FAVICON_SIZE;
  try {
    const url = new URL(faviconBaseUrl);
    url.searchParams.set("pageUrl", eligible);
    url.searchParams.set("size", String(pixels));
    return url.toString();
  } catch {
    return null;
  }
}

/** Resolve a title-strip favicon src via Chrome's local favicon API. */
export function chromeFaviconSrc(
  pageUrl: string,
  runtime: FaviconRuntime | null = defaultFaviconRuntime(),
  size: number = TITLE_FAVICON_SIZE,
): string | null {
  if (!runtime?.getURL) return null;
  let base: string;
  try {
    base = runtime.getURL("/_favicon/");
  } catch {
    return null;
  }
  return buildFaviconSrc(pageUrl, base, size);
}

function defaultFaviconRuntime(): FaviconRuntime | null {
  if (typeof chrome === "undefined" || !chrome.runtime?.getURL) return null;
  return chrome.runtime;
}
