/**
 * Optional extension permissions for dial image URL fetch and thumbnail capture.
 *
 * Default install stays bookmarks + storage + unlimitedStorage + contextMenus
 * (+ activeTab). Chrome also installs `favicon` for title-strip icons from the
 * profile cache (no network / no CDN). Firefox omits `favicon` (no equivalent
 * without host access) — title icons stay hidden; monogram / folder remain
 * dial-face fallbacks. unlimitedStorage lifts the shared local quota for dial
 * art only — no network, no sync of blobs.
 * Thumbnails request optional host `<all_urls>` when the user enables the
 * setting (`captureVisibleTab` is gated by host access / `activeTab`, not the
 * `tabs` permission). Image-from-URL requests http/https scheme wildcards when
 * that Settings toggle is enabled (origin-scoped fetch stays available as a
 * fallback).
 *
 * Chrome only allows permissions.request for API names listed in
 * optional_permissions and host patterns listed in optional_host_permissions.
 * Host patterns must NOT be placed in optional_permissions — Chrome then
 * rejects origins: [...] with "Only permissions specified in the manifest
 * may be requested." Declaring only <all_urls> also does not allow requesting
 * a specific https host origin, so the Chrome manifest lists the http and https
 * scheme wildcards for per-origin fetch.
 *
 * Firefox folds those host patterns into optional_permissions (see
 * scripts/firefox-manifest.mjs) because older Firefox MV3 builds expect hosts
 * there; runtime request payloads stay the same.
 *
 * Toggle-off calls permissions.remove to drop *active* access (least privilege
 * while the feature is off). Chrome keeps a separate “previously granted”
 * memory: after remove, the next permissions.request for the same optional
 * grant usually succeeds without showing the dialog again. Only the user can
 * clear that memory (chrome://extensions → extension details → site access).
 * Firefox optional-permission UX can differ (may re-prompt more often).
 */

import { t } from "./i18n.ts";

/** Host pattern required for captureVisibleTab on arbitrary dial URLs. */
export const THUMBNAIL_HOST_PERMISSION = "<all_urls>" as const;

/**
 * Scheme wildcards that must appear in manifest optional_host_permissions so
 * Image-from-URL can request host access without expanding always-on install
 * permissions. Requested when the URL-fetch Settings toggle turns on.
 */
export const OPTIONAL_FETCH_HOST_PERMISSIONS = ["http://*/*", "https://*/*"] as const;

/**
 * Optional API permissions declared in the root manifest.
 * Empty: thumbnail capture needs host `<all_urls>` only (not the `tabs` API
 * permission). Keep the constant so coverage checks stay explicit.
 */
export const MANIFEST_OPTIONAL_PERMISSIONS = [] as const;

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
  origins: typeof THUMBNAIL_HOST_PERMISSION[];
};

export function thumbnailPermissionRequest(): ThumbnailPermissionRequest {
  return {
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
 * One permissions.request payload when both Settings toggles turn on in the
 * same user gesture (options-page Save). Firefox rejects a second request()
 * after any prior await — including the first permission prompt resolving.
 */
export type ThumbnailAndImageUrlPermissionRequest = {
  origins: Array<typeof THUMBNAIL_HOST_PERMISSION | (typeof OPTIONAL_FETCH_HOST_PERMISSIONS)[number]>;
};

export function thumbnailAndImageUrlPermissionRequest(): ThumbnailAndImageUrlPermissionRequest {
  return {
    origins: [THUMBNAIL_HOST_PERMISSION, ...OPTIONAL_FETCH_HOST_PERMISSIONS],
  };
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
  /** True when `<all_urls>` is granted (thumbnail capture ready). */
  hasThumbnailAccess(): Promise<boolean>;
  /** Prompt for `<all_urls>`. Returns false if the user denies or Chrome rejects. */
  requestThumbnailAccess(): Promise<boolean>;
  /**
   * Drop active `<all_urls>` for thumbnails. Does not remove http/https
   * scheme wildcards used by Image-from-URL. The next enable still calls
   * request(); Chrome usually restores without a dialog after the first Allow.
   */
  removeThumbnailAccess(): Promise<void>;
  /**
   * True when Image-from-URL host access is available: http/https scheme
   * wildcards, or <all_urls> already granted via thumbnails.
   */
  hasImageUrlFetchAccess(): Promise<boolean>;
  /**
   * Request http/https scheme wildcards so this toggle owns its grants
   * (survives thumbnails revoke of <all_urls>). Returns false if denied or
   * rejected. Shows a dialog only when Chrome has not already allowed those
   * grants (or an overlapping grant such as <all_urls>).
   *
   * Must be invoked as the first awaited extension call from a user-gesture
   * handler on Firefox (`permissions.request` after any prior await — including
   * `permissions.contains` — is rejected as "not from a user input handler").
   */
  requestImageUrlFetchAccess(): Promise<boolean>;
  /**
   * Single request for `<all_urls>` + http/https wildcards when both
   * Settings toggles enable in one gesture. Prefer this over sequential
   * requestThumbnailAccess + requestImageUrlFetchAccess (Firefox loses the
   * user gesture after the first prompt).
   */
  requestThumbnailAndImageUrlFetchAccess(): Promise<boolean>;
  /**
   * Drop active http/https scheme wildcards for Image-from-URL. Does not
   * remove `<all_urls>` used by thumbnails. The next enable still calls
   * request(); Chrome usually restores without a dialog after the first Allow.
   */
  removeImageUrlFetchAccess(): Promise<void>;
  /** True when the extension may fetch `href` (wildcards, origin, or <all_urls>). */
  canFetchUrl(href: string): Promise<boolean>;
  /** Request host access for `href`'s origin (no-op if already covered). */
  requestFetchAccess(href: string): Promise<boolean>;
};

export type CaptureApi = {
  /**
   * Open `pageUrl` in a temporary window, wait `waitMs` for the page to paint,
   * capture the visible tab as a JPEG data URL, then close the window.
   * `waitMs` defaults to the layout preference (2s).
   */
  capturePage(pageUrl: string, waitMs?: number): Promise<string>;
};

export function thumbnailPermissionDeniedMessage(): string {
  return t("error_thumbnail_permission_denied");
}

export function imageUrlPermissionDeniedMessage(): string {
  return t("error_image_url_permission_denied");
}

export function thumbnailUnavailableMessage(): string {
  return t("error_thumbnail_unavailable");
}

export function imageUrlUnavailableMessage(): string {
  return t("error_image_url_unavailable");
}
