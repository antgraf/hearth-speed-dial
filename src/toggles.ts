/**
 * Shared permission-toggle and Danger Zone helpers for the new-tab Settings
 * overlay (`app.ts`) and the options page (`settings-app.ts`).
 *
 * Keeps enable/deny/revoke/degrade decisions in one place so both UIs cannot
 * drift (e.g. URL-fetch must re-own http/https before thumbnails drop <all_urls>).
 *
 * Firefox: `browser.permissions.request` must run as the first awaited
 * extension call from a user-gesture handler. Any prior `await` (including
 * `permissions.contains` via has*) drops the gesture and the request rejects
 * with "may only be called from a user input handler" — which we previously
 * treated as deny, leaving the toggle stuck off with a Settings loop.
 */

import {
  imageUrlPermissionDeniedMessage,
  thumbnailPermissionDeniedMessage,
  type PermissionsApi,
} from "./permissions.ts";
import {
  clampColumns,
  clampThumbnailWaitSeconds,
  clampTileSize,
  type LayoutSettings,
} from "./settings.ts";
import { normalizeTheme } from "./theme.ts";

/** Permission subset required by layout toggle transitions. */
export type LayoutTogglePermissions = Pick<
  PermissionsApi,
  | "requestThumbnailAccess"
  | "requestThumbnailAndImageUrlFetchAccess"
  | "removeThumbnailAccess"
  | "hasThumbnailAccess"
  | "requestImageUrlFetchAccess"
  | "removeImageUrlFetchAccess"
  | "hasImageUrlFetchAccess"
>;

export type ApplyLayoutChangeResult = {
  /** Normalized layout after permission transitions (may demote denied toggles). */
  next: LayoutSettings;
  /** Denial / revoke message to show, or null when the transition succeeded. */
  error: string | null;
  /**
   * True when an enable request was denied and the caller should persist
   * `next` immediately and stop (matching both UI entry points).
   */
  earlyDenial: boolean;
  /** Whether thumbnail capture grants are active after this change. */
  thumbnailsActive: boolean;
  /** Whether Image-from-URL host access is active after this change. */
  imageUrlFetchActive: boolean;
};

/**
 * Clamp layout numbers and run the optional-permission state machine for the
 * thumbnails and Image-from-URL toggles.
 *
 * When `permissions` is null (options page without a PermissionsApi), toggle
 * flags are accepted as requested with no grant/revoke calls.
 *
 * Rising-edge `permissions.request` calls run before any `has*` / contains
 * awaits so Firefox still sees a user gesture.
 */
export async function applyLayoutChange(
  previous: LayoutSettings,
  requested: LayoutSettings,
  permissions: LayoutTogglePermissions | null,
): Promise<ApplyLayoutChangeResult> {
  let next: LayoutSettings = {
    columns: clampColumns(requested.columns),
    tileSize: clampTileSize(requested.tileSize),
    reverseOrder: Boolean(requested.reverseOrder),
    thumbnailsEnabled: Boolean(requested.thumbnailsEnabled),
    imageUrlFetchEnabled: Boolean(requested.imageUrlFetchEnabled),
    thumbnailWaitSeconds: clampThumbnailWaitSeconds(requested.thumbnailWaitSeconds),
    theme: normalizeTheme(requested.theme ?? previous.theme),
  };

  let error: string | null = null;

  if (!permissions) {
    return {
      next,
      error: null,
      earlyDenial: false,
      thumbnailsActive: next.thumbnailsEnabled,
      imageUrlFetchActive: next.imageUrlFetchEnabled,
    };
  }

  const enablingThumbnails = next.thumbnailsEnabled && !previous.thumbnailsEnabled;
  const enablingUrl = next.imageUrlFetchEnabled && !previous.imageUrlFetchEnabled;
  const disablingThumbnails = !next.thumbnailsEnabled && previous.thumbnailsEnabled;
  const disablingUrl = !next.imageUrlFetchEnabled && previous.imageUrlFetchEnabled;

  // Rising edges first — no has*/contains awaits before these request() calls.
  if (enablingThumbnails && enablingUrl) {
    const granted = await permissions.requestThumbnailAndImageUrlFetchAccess();
    if (!granted) {
      next = { ...next, thumbnailsEnabled: false, imageUrlFetchEnabled: false };
      return {
        next,
        error: thumbnailPermissionDeniedMessage(),
        earlyDenial: true,
        thumbnailsActive: false,
        imageUrlFetchActive: false,
      };
    }
  } else if (enablingThumbnails) {
    const granted = await permissions.requestThumbnailAccess();
    if (!granted) {
      next = { ...next, thumbnailsEnabled: false };
      let urlActive = false;
      if (next.imageUrlFetchEnabled) {
        urlActive = await permissions.hasImageUrlFetchAccess();
      }
      return {
        next,
        error: thumbnailPermissionDeniedMessage(),
        earlyDenial: true,
        thumbnailsActive: false,
        imageUrlFetchActive: urlActive,
      };
    }
  } else if (enablingUrl) {
    const granted = await permissions.requestImageUrlFetchAccess();
    if (!granted) {
      next = { ...next, imageUrlFetchEnabled: false };
      let thumbnailsActive = false;
      if (next.thumbnailsEnabled) {
        thumbnailsActive = await permissions.hasThumbnailAccess();
        if (!thumbnailsActive) {
          next = { ...next, thumbnailsEnabled: false };
        }
      }
      return {
        next,
        error: imageUrlPermissionDeniedMessage(),
        earlyDenial: true,
        thumbnailsActive,
        imageUrlFetchActive: false,
      };
    }
  } else if (disablingThumbnails && next.imageUrlFetchEnabled) {
    // Thumbnails off while URL stays on: re-own http/https before dropping
    // <all_urls>. This request is the first await on that checkbox gesture.
    const urlKept = await permissions.requestImageUrlFetchAccess();
    if (!urlKept) {
      next = { ...next, imageUrlFetchEnabled: false };
    }
  }

  let thumbnailsActive: boolean;
  if (disablingThumbnails) {
    try {
      await permissions.removeThumbnailAccess();
    } catch {
      // Best-effort; setting still turns off.
    }
    thumbnailsActive = false;
  } else if (enablingThumbnails) {
    thumbnailsActive = true;
  } else if (next.thumbnailsEnabled) {
    thumbnailsActive = await permissions.hasThumbnailAccess();
    if (!thumbnailsActive) {
      next = { ...next, thumbnailsEnabled: false };
      error = thumbnailPermissionDeniedMessage();
    }
  } else {
    thumbnailsActive = false;
  }

  let imageUrlFetchActive: boolean;
  if (disablingUrl) {
    try {
      await permissions.removeImageUrlFetchAccess();
    } catch {
      // Best-effort; setting still turns off.
    }
    imageUrlFetchActive = false;
  } else if (enablingUrl || (enablingThumbnails && enablingUrl)) {
    imageUrlFetchActive = true;
  } else if (next.imageUrlFetchEnabled) {
    // Still on — sync active flag only. Do not clear the URL toggle or show
    // a denial banner here (thumbnail revoke must not look like a URL deny).
    imageUrlFetchActive = await permissions.hasImageUrlFetchAccess();
  } else {
    imageUrlFetchActive = false;
  }

  return {
    next,
    error,
    earlyDenial: false,
    thumbnailsActive,
    imageUrlFetchActive,
  };
}

/**
 * Drop optional grants that were active for the given layout preference.
 * Best-effort: failures are swallowed so Reset / Erase still proceed.
 */
export async function revokeOptionalFeaturePermissions(
  layout: LayoutSettings,
  permissions: Pick<PermissionsApi, "removeImageUrlFetchAccess" | "removeThumbnailAccess"> | null,
): Promise<void> {
  if (!permissions) return;
  if (layout.imageUrlFetchEnabled) {
    try {
      await permissions.removeImageUrlFetchAccess();
    } catch {
      // Best-effort; defaults still apply.
    }
  }
  if (layout.thumbnailsEnabled) {
    try {
      await permissions.removeThumbnailAccess();
    } catch {
      // Best-effort; defaults still apply.
    }
  }
}
