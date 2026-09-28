/**
 * Optional Chrome permissions for dial image URL fetch and thumbnail capture.
 *
 * Default install stays bookmarks + storage + contextMenus only.
 * Thumbnails request tabs + <all_urls> when the user enables the setting.
 * Image-from-URL requests the image origin when <all_urls> is not already granted.
 *
 * Chrome only allows permissions.request origins that are listed (or are a
 * subset of a listed pattern) in optional_host_permissions. Declaring only
 * <all_urls> does not allow requesting a specific https host origin, so the
 * manifest also lists the http and https scheme wildcards for per-origin fetch.
 */

export const OPTIONAL_TABS_PERMISSION = "tabs" as const;

/** Host pattern required for captureVisibleTab on arbitrary dial URLs. */
export const THUMBNAIL_HOST_PERMISSION = "<all_urls>" as const;

/**
 * Scheme wildcards that must appear in manifest optional_host_permissions so
 * origin-scoped Image-from-URL requests are legal to pass to permissions.request.
 */
export const OPTIONAL_FETCH_HOST_PERMISSIONS = ["http://*/*", "https://*/*"] as const;

export type ThumbnailPermissionRequest = {
  permissions: typeof OPTIONAL_TABS_PERMISSION[];
  origins: typeof THUMBNAIL_HOST_PERMISSION[];
};

export function thumbnailPermissionRequest(): ThumbnailPermissionRequest {
  return {
    permissions: [OPTIONAL_TABS_PERMISSION],
    origins: [THUMBNAIL_HOST_PERMISSION],
  };
}

/** Match pattern for chrome.permissions host access to one origin. */
export function originHostPermission(href: string): string | null {
  try {
    const parsed = new URL(href);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return `${parsed.protocol}//${parsed.host}/*`;
  } catch {
    return null;
  }
}

export type FetchPermissionRequest = {
  origins: [string];
};

/** Origins payload for permissions.request when fetching an image URL. */
export function fetchPermissionRequest(href: string): FetchPermissionRequest | null {
  const origin = originHostPermission(href);
  if (!origin) return null;
  return { origins: [origin] };
}

export type PermissionsApi = {
  /** True when tabs + <all_urls> are both granted (thumbnail capture ready). */
  hasThumbnailAccess(): Promise<boolean>;
  /** Prompt for tabs + <all_urls>. Returns false if the user denies. */
  requestThumbnailAccess(): Promise<boolean>;
  /** True when the extension may fetch `href` (origin or <all_urls>). */
  canFetchUrl(href: string): Promise<boolean>;
  /** Request host access for `href`'s origin (no-op if already covered). */
  requestFetchAccess(href: string): Promise<boolean>;
};

export type CaptureApi = {
  /**
   * Open `pageUrl` in a temporary window, capture the visible tab as a JPEG
   * data URL, then close the window.
   */
  capturePage(pageUrl: string): Promise<string>;
};

export function thumbnailPermissionDeniedMessage(): string {
  return "Thumbnail capture needs permission to open pages and take a screenshot. You can enable it again in Settings.";
}

export function imageUrlPermissionDeniedMessage(): string {
  return "Permission is needed to download that image. Allow access when Chrome asks, or enable thumbnails in Settings (which grants site access).";
}

export function thumbnailUnavailableMessage(): string {
  return "Turn on “Generate dial thumbnails” in Settings first.";
}
