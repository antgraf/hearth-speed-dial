/**
 * Optional Chrome permissions for dial image URL fetch and thumbnail capture.
 *
 * Default install stays bookmarks + storage + contextMenus only.
 * Thumbnails request tabs + <all_urls> when the user enables the setting.
 * Image-from-URL requests http/https scheme wildcards when that Settings
 * toggle is enabled (origin-scoped fetch stays available as a fallback).
 *
 * Chrome only allows permissions.request for API names listed in
 * optional_permissions and host patterns listed in optional_host_permissions.
 * Host patterns must NOT be placed in optional_permissions — Chrome then
 * rejects origins: [...] with "Only permissions specified in the manifest
 * may be requested." Declaring only <all_urls> also does not allow requesting
 * a specific https host origin, so the manifest lists the http and https
 * scheme wildcards for per-origin fetch.
 */

export const OPTIONAL_TABS_PERMISSION = "tabs" as const;

/** Host pattern required for captureVisibleTab on arbitrary dial URLs. */
export const THUMBNAIL_HOST_PERMISSION = "<all_urls>" as const;

/**
 * Scheme wildcards that must appear in manifest optional_host_permissions so
 * Image-from-URL can request host access without expanding always-on install
 * permissions. Requested when the URL-fetch Settings toggle turns on.
 */
export const OPTIONAL_FETCH_HOST_PERMISSIONS = ["http://*/*", "https://*/*"] as const;

/** API permissions declared optional in the root manifest. */
export const MANIFEST_OPTIONAL_PERMISSIONS = [OPTIONAL_TABS_PERMISSION] as const;

/** Host patterns declared in manifest optional_host_permissions. */
export const MANIFEST_OPTIONAL_HOST_PERMISSIONS = [
  THUMBNAIL_HOST_PERMISSION,
  ...OPTIONAL_FETCH_HOST_PERMISSIONS,
] as const;

export type PermissionRequestPayload = {
  permissions?: string[];
  origins?: string[];
};

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

/** Same shape as the grant — used when the thumbnails Settings toggle turns off. */
export function thumbnailPermissionRemove(): ThumbnailPermissionRequest {
  return thumbnailPermissionRequest();
}

export type ImageUrlFetchPermissionRequest = {
  origins: (typeof OPTIONAL_FETCH_HOST_PERMISSIONS)[number][];
};

/** Optional host access requested when enabling Image-from-URL in Settings. */
export function imageUrlFetchPermissionRequest(): ImageUrlFetchPermissionRequest {
  return {
    origins: [...OPTIONAL_FETCH_HOST_PERMISSIONS],
  };
}

/** Drop the http/https grants added by the Image-from-URL toggle. */
export function imageUrlFetchPermissionRemove(): ImageUrlFetchPermissionRequest {
  return imageUrlFetchPermissionRequest();
}

/**
 * Split a remove payload into one-permission / one-origin calls.
 * Chrome is more reliable revoking optional grants piecemeal than in one batch
 * (a single failing member can leave the rest still granted).
 */
export function permissionRemovePieces(payload: PermissionRequestPayload): PermissionRequestPayload[] {
  const pieces: PermissionRequestPayload[] = [];
  for (const permission of payload.permissions ?? []) {
    pieces.push({ permissions: [permission] });
  }
  for (const origin of payload.origins ?? []) {
    pieces.push({ origins: [origin] });
  }
  return pieces;
}

/**
 * Intersection of currently granted permissions with the optional grants a
 * Settings toggle is responsible for removing.
 */
export function intersectGrantedPermissions(
  granted: PermissionRequestPayload,
  target: PermissionRequestPayload,
): PermissionRequestPayload {
  const grantedPermissions = new Set(granted.permissions ?? []);
  const grantedOrigins = new Set(granted.origins ?? []);
  return {
    permissions: (target.permissions ?? []).filter((permission) => grantedPermissions.has(permission)),
    origins: (target.origins ?? []).filter((origin) => grantedOrigins.has(origin)),
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

/** Origins payload for permissions.request when fetching one image URL. */
export function fetchPermissionRequest(href: string): FetchPermissionRequest | null {
  const origin = originHostPermission(href);
  if (!origin) return null;
  return { origins: [origin] };
}

/**
 * True when every API permission / origin in `request` is allowed by the
 * declared optional manifest lists. Specific http(s) origins are allowed when
 * the matching scheme wildcard (or <all_urls>) is declared.
 */
export function isRequestCoveredByOptionalManifest(
  request: PermissionRequestPayload,
  optionalPermissions: readonly string[] = MANIFEST_OPTIONAL_PERMISSIONS,
  optionalHostPermissions: readonly string[] = MANIFEST_OPTIONAL_HOST_PERMISSIONS,
): boolean {
  for (const permission of request.permissions ?? []) {
    if (!optionalPermissions.includes(permission)) return false;
  }
  for (const origin of request.origins ?? []) {
    if (!originCoveredByOptionalHosts(origin, optionalHostPermissions)) return false;
  }
  return true;
}

function originCoveredByOptionalHosts(origin: string, optionalHosts: readonly string[]): boolean {
  if (optionalHosts.includes(origin)) return true;
  // Chrome does not treat declared <all_urls> as covering a specific-origin
  // permissions.request — only an exact match or a scheme wildcard does.
  const specific = /^(https?):\/\/\*\/\*$/.exec(origin);
  if (specific) return optionalHosts.includes(`${specific[1]}://*/*`);
  const hostPattern = /^(https?):\/\/[^/]+\/\*$/.exec(origin);
  if (!hostPattern) return false;
  const schemeWildcard = `${hostPattern[1]}://*/*`;
  return optionalHosts.includes(schemeWildcard) || optionalHosts.includes("*://*/*");
}

export type PermissionsApi = {
  /** True when tabs + <all_urls> are both granted (thumbnail capture ready). */
  hasThumbnailAccess(): Promise<boolean>;
  /** Prompt for tabs + <all_urls>. Returns false if the user denies or Chrome rejects. */
  requestThumbnailAccess(): Promise<boolean>;
  /**
   * Drop tabs + <all_urls> granted for thumbnails so the next enable prompts
   * again. Does not remove http/https scheme wildcards used by Image-from-URL.
   */
  removeThumbnailAccess(): Promise<void>;
  /**
   * True when Image-from-URL host access is available: http/https scheme
   * wildcards, or <all_urls> already granted via thumbnails.
   */
  hasImageUrlFetchAccess(): Promise<boolean>;
  /**
   * Prompt for http/https scheme wildcards (or no-op if <all_urls> already
   * covers fetch). Returns false if denied or rejected.
   */
  requestImageUrlFetchAccess(): Promise<boolean>;
  /**
   * Drop the http/https scheme wildcards granted for Image-from-URL so the
   * next enable prompts again. Does not remove tabs or <all_urls> used by
   * thumbnails.
   */
  removeImageUrlFetchAccess(): Promise<void>;
  /** True when the extension may fetch `href` (wildcards, origin, or <all_urls>). */
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
  return "Downloading an image from a URL needs permission. You can enable it again in Settings.";
}

export function thumbnailUnavailableMessage(): string {
  return "Turn on “Generate dial thumbnails” in Settings first.";
}

export function imageUrlUnavailableMessage(): string {
  return "Turn on “Assign pictures from URLs” in Settings first.";
}
