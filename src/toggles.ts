/**
 * Shared permission-toggle and Danger Zone helpers for the new-tab Settings
 * overlay (`app.ts`) and the options page (`settings-app.ts`).
 *
 * Keeps enable/deny/revoke/degrade decisions in one place so both UIs cannot
 * drift (e.g. URL-fetch must re-own http/https before thumbnails drop <all_urls>).
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

/** Permission subset required by layout toggle transitions. */
export type LayoutTogglePermissions = Pick<
  PermissionsApi,
  | "requestThumbnailAccess"
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
  };

  let error: string | null = null;
  let thumbnailsActive: boolean;
  let imageUrlFetchActive: boolean;

  if (!permissions) {
    return {
      next,
      error: null,
      earlyDenial: false,
      thumbnailsActive: next.thumbnailsEnabled,
      imageUrlFetchActive: next.imageUrlFetchEnabled,
    };
  }

  if (next.thumbnailsEnabled && !previous.thumbnailsEnabled) {
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
    thumbnailsActive = true;
    error = null;
  } else if (!next.thumbnailsEnabled) {
    if (previous.thumbnailsEnabled) {
      // URL fetch may have been riding on <all_urls>. Ensure it owns
      // http/https wildcards before dropping thumbnail grants (same click).
      if (next.imageUrlFetchEnabled) {
        const urlKept = await permissions.requestImageUrlFetchAccess();
        if (!urlKept) {
          next = { ...next, imageUrlFetchEnabled: false };
        }
      }
      try {
        await permissions.removeThumbnailAccess();
      } catch {
        // Best-effort; setting still turns off.
      }
    }
    thumbnailsActive = false;
  } else {
    thumbnailsActive = await permissions.hasThumbnailAccess();
    if (!thumbnailsActive) {
      next = { ...next, thumbnailsEnabled: false };
      error = thumbnailPermissionDeniedMessage();
    }
  }

  if (next.imageUrlFetchEnabled && !previous.imageUrlFetchEnabled) {
    const granted = await permissions.requestImageUrlFetchAccess();
    if (!granted) {
      next = { ...next, imageUrlFetchEnabled: false };
      return {
        next,
        error: imageUrlPermissionDeniedMessage(),
        earlyDenial: true,
        thumbnailsActive,
        imageUrlFetchActive: false,
      };
    }
    imageUrlFetchActive = true;
    error = null;
  } else if (!next.imageUrlFetchEnabled) {
    if (previous.imageUrlFetchEnabled) {
      try {
        await permissions.removeImageUrlFetchAccess();
      } catch {
        // Best-effort; setting still turns off.
      }
    }
    imageUrlFetchActive = false;
  } else {
    // Still on — sync active flag only. Do not clear the URL toggle or show
    // a denial banner here (thumbnail revoke must not look like a URL deny).
    imageUrlFetchActive = await permissions.hasImageUrlFetchAccess();
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
