import type { BookmarkNode } from "./model.ts";
import { t } from "./i18n.ts";
import {
  collectImages,
  dialImageStorageKeys,
  imageStorageKey,
  imageStorageWriteFailedMessage,
  ingestDataUrl,
  meaningfulStorageQuotaBytes,
  orphanImageKeys,
  readImageDataUrl,
  type ImagesApi,
} from "./images.ts";
import {
  fetchPermissionRequest,
  imageUrlFetchPermissionRemove,
  imageUrlFetchPermissionRequest,
  intersectGrantedPermissions,
  isRequestCoveredByOptionalManifest,
  OPTIONAL_FETCH_HOST_PERMISSIONS,
  originHostPermission,
  permissionRemovePieces,
  THUMBNAIL_HOST_PERMISSION,
  thumbnailAndImageUrlPermissionRequest,
  thumbnailPermissionDeniedMessage,
  thumbnailPermissionRemove,
  thumbnailPermissionRequest,
  type CaptureApi,
  type PermissionRequestPayload,
  type PermissionsApi,
} from "./permissions.ts";
import {
  DEFAULT_LAYOUT,
  deviceFromLayout,
  deviceSettingsBlobFromUnknown,
  hasPortableSettingsFields,
  mergeLayoutParts,
  portableFromLayout,
  portableSettingsBlob,
  readDefaultFolderId,
  readDeviceLayout,
  readOpenFolderId,
  readPortableLayout,
  readWelcomeDismissed,
  SETTINGS_STORAGE_KEY,
  thumbnailWaitMs,
  WELCOME_DISMISSED_KEY,
  type LayoutSettings,
  type SettingsApi,
} from "./settings.ts";
import { extensionApi } from "./webext.ts";
import {
  DEFAULT_THEME,
  readThemeBackgroundDataUrl,
  THEME_BACKGROUND_KEY,
} from "./theme.ts";

export type BookmarkUpdate = {
  title?: string;
  url?: string;
};

export type BookmarkMoveDestination = {
  parentId?: string;
  index?: number;
};

export type BookmarksApi = {
  getTree(): Promise<BookmarkNode[]>;
  createFolder(parentId: string, title: string): Promise<BookmarkNode>;
  createBookmark(parentId: string, title: string, url: string): Promise<BookmarkNode>;
  update(id: string, changes: BookmarkUpdate): Promise<BookmarkNode>;
  move(id: string, destination: BookmarkMoveDestination): Promise<BookmarkNode>;
  remove(id: string): Promise<void>;
  subscribe(listener: () => void): () => void;
};

function fromChrome(node: chrome.bookmarks.BookmarkTreeNode): BookmarkNode {
  const mapped: BookmarkNode = { id: node.id, title: node.title };
  if (node.parentId !== undefined) mapped.parentId = node.parentId;
  if (node.url !== undefined) mapped.url = node.url;
  if (node.children) mapped.children = node.children.map(fromChrome);
  return mapped;
}

export function chromeBookmarks(): BookmarksApi {
  const api = extensionApi();
  return {
    async getTree() {
      const tree = await api.bookmarks.getTree();
      return tree.map(fromChrome);
    },
    async createFolder(parentId, title) {
      const created = await api.bookmarks.create({ parentId, title });
      return fromChrome(created);
    },
    async createBookmark(parentId, title, url) {
      const created = await api.bookmarks.create({ parentId, title, url });
      return fromChrome(created);
    },
    async update(id, changes) {
      const updated = await api.bookmarks.update(id, changes);
      return fromChrome(updated);
    },
    async move(id, destination) {
      const destinationArg: chrome.bookmarks.MoveDestination = {};
      if (destination.parentId !== undefined) destinationArg.parentId = destination.parentId;
      if (destination.index !== undefined) destinationArg.index = destination.index;
      const moved = await api.bookmarks.move(id, destinationArg);
      return fromChrome(moved);
    },
    async remove(id) {
      const nodes = await api.bookmarks.get(id);
      const node = nodes[0];
      if (!node) throw new Error(t("error_bookmark_gone"));
      if (node.url !== undefined) await api.bookmarks.remove(id);
      else await api.bookmarks.removeTree(id);
    },
    subscribe(listener) {
      const onCreated = () => listener();
      const onRemoved = () => listener();
      const onChanged = () => listener();
      const onMoved = () => listener();
      const onReordered = () => listener();
      api.bookmarks.onCreated.addListener(onCreated);
      api.bookmarks.onRemoved.addListener(onRemoved);
      api.bookmarks.onChanged.addListener(onChanged);
      api.bookmarks.onMoved.addListener(onMoved);
      api.bookmarks.onChildrenReordered.addListener(onReordered);
      return () => {
        api.bookmarks.onCreated.removeListener(onCreated);
        api.bookmarks.onRemoved.removeListener(onRemoved);
        api.bookmarks.onChanged.removeListener(onChanged);
        api.bookmarks.onMoved.removeListener(onMoved);
        api.bookmarks.onChildrenReordered.removeListener(onReordered);
      };
    },
  };
}

export function chromeSettings(): SettingsApi {
  return {
    async getOpenFolderId() {
      await seedPortableSettingsFromLocalIfNeeded();
      const stored = await extensionApi().storage.local.get(SETTINGS_STORAGE_KEY);
      return readOpenFolderId(stored[SETTINGS_STORAGE_KEY]);
    },
    async setOpenFolderId(id) {
      await patchLocalSettings({ openFolderId: id });
    },
    async getDefaultFolderId() {
      await seedPortableSettingsFromLocalIfNeeded();
      const stored = await extensionApi().storage.local.get(SETTINGS_STORAGE_KEY);
      return readDefaultFolderId(stored[SETTINGS_STORAGE_KEY]);
    },
    async setDefaultFolderId(id) {
      await patchLocalSettings({ defaultFolderId: id });
    },
    async getLayout() {
      await seedPortableSettingsFromLocalIfNeeded();
      const api = extensionApi();
      const [syncStored, localStored] = await Promise.all([
        api.storage.sync.get(SETTINGS_STORAGE_KEY),
        api.storage.local.get(SETTINGS_STORAGE_KEY),
      ]);
      return mergeLayoutParts(
        readPortableLayout(syncStored[SETTINGS_STORAGE_KEY]),
        readDeviceLayout(localStored[SETTINGS_STORAGE_KEY]),
      );
    },
    async setLayout(layout: LayoutSettings) {
      await seedPortableSettingsFromLocalIfNeeded();
      const portable = portableFromLayout(layout);
      const device = deviceFromLayout(layout);
      await Promise.all([
        extensionApi().storage.sync.set({
          [SETTINGS_STORAGE_KEY]: portableSettingsBlob(portable),
        }),
        patchLocalSettings({
          thumbnailsEnabled: device.thumbnailsEnabled,
          imageUrlFetchEnabled: device.imageUrlFetchEnabled,
        }),
      ]);
    },
    async getThemeBackground() {
      const stored = await extensionApi().storage.local.get(THEME_BACKGROUND_KEY);
      return readThemeBackgroundDataUrl(stored[THEME_BACKGROUND_KEY]);
    },
    async setThemeBackground(dataUrl) {
      if (dataUrl == null) {
        await extensionApi().storage.local.remove(THEME_BACKGROUND_KEY);
        return;
      }
      const valid = readThemeBackgroundDataUrl(dataUrl);
      if (!valid) throw new Error(t("error_background_store"));
      try {
        await extensionApi().storage.local.set({ [THEME_BACKGROUND_KEY]: valid });
      } catch (error) {
        throw new Error(imageStorageWriteFailedMessage(error), { cause: error });
      }
    },
    async getWelcomeDismissed() {
      const stored = await extensionApi().storage.local.get(WELCOME_DISMISSED_KEY);
      return readWelcomeDismissed(stored[WELCOME_DISMISSED_KEY]);
    },
    async setWelcomeDismissed(dismissed) {
      if (dismissed) {
        await extensionApi().storage.local.set({ [WELCOME_DISMISSED_KEY]: true });
        return;
      }
      await extensionApi().storage.local.remove(WELCOME_DISMISSED_KEY);
    },
    async resetToDefaults() {
      await seedPortableSettingsFromLocalIfNeeded();
      const portable = portableFromLayout(DEFAULT_LAYOUT);
      const device = deviceFromLayout(DEFAULT_LAYOUT);
      await Promise.all([
        extensionApi().storage.sync.set({
          [SETTINGS_STORAGE_KEY]: portableSettingsBlob(portable),
        }),
        patchLocalSettings({
          thumbnailsEnabled: device.thumbnailsEnabled,
          imageUrlFetchEnabled: device.imageUrlFetchEnabled,
          defaultFolderId: null,
        }),
        extensionApi().storage.local.remove(THEME_BACKGROUND_KEY),
      ]);
      return { ...DEFAULT_LAYOUT, theme: { ...DEFAULT_THEME } };
    },
    async clearAll() {
      await Promise.all([
        extensionApi().storage.sync.remove(SETTINGS_STORAGE_KEY),
        extensionApi().storage.local.remove([
          SETTINGS_STORAGE_KEY,
          THEME_BACKGROUND_KEY,
          WELCOME_DISMISSED_KEY,
        ]),
      ]);
    },
  };
}

/**
 * One-time bootstrap for pre-release / unpacked profiles that wrote portable
 * prefs into `storage.local` before sync landed. First-store users write sync
 * from day one — this is not a deferred shipped-user migration.
 */
async function seedPortableSettingsFromLocalIfNeeded(): Promise<void> {
  const api = extensionApi();
  const [syncStored, localStored] = await Promise.all([
    api.storage.sync.get(SETTINGS_STORAGE_KEY),
    api.storage.local.get(SETTINGS_STORAGE_KEY),
  ]);
  const syncBlob = syncStored[SETTINGS_STORAGE_KEY];
  const localBlob = localStored[SETTINGS_STORAGE_KEY];
  if (hasPortableSettingsFields(syncBlob)) return;
  if (!hasPortableSettingsFields(localBlob)) return;

  const portable = portableSettingsBlob(readPortableLayout(localBlob));
  const deviceOnly = deviceSettingsBlobFromUnknown(localBlob);
  await api.storage.sync.set({ [SETTINGS_STORAGE_KEY]: portable });
  await api.storage.local.set({ [SETTINGS_STORAGE_KEY]: deviceOnly });
}

async function patchLocalSettings(patch: Record<string, unknown>): Promise<void> {
  await seedPortableSettingsFromLocalIfNeeded();
  const stored = await extensionApi().storage.local.get(SETTINGS_STORAGE_KEY);
  const previous =
    stored[SETTINGS_STORAGE_KEY] && typeof stored[SETTINGS_STORAGE_KEY] === "object"
      ? (stored[SETTINGS_STORAGE_KEY] as Record<string, unknown>)
      : {};
  // Never re-introduce portable fields into local after the sync split.
  const base = deviceSettingsBlobFromUnknown(previous);
  const next = { ...base, ...patch };
  // Explicit null clears defaultFolderId (Reset / Erase paths).
  if (patch.defaultFolderId === null) delete next.defaultFolderId;
  await extensionApi().storage.local.set({ [SETTINGS_STORAGE_KEY]: next });
}

export function chromeImages(): ImagesApi {
  return {
    async getAll() {
      const stored = await extensionApi().storage.local.get(null);
      return collectImages(stored as Record<string, unknown>);
    },
    async setImage(bookmarkId, dataUrl) {
      const valid = readImageDataUrl(dataUrl);
      if (!valid) throw new Error(t("error_image_store"));
      try {
        await extensionApi().storage.local.set({ [imageStorageKey(bookmarkId)]: valid });
      } catch (error) {
        throw new Error(imageStorageWriteFailedMessage(error), { cause: error });
      }
    },
    async clearImage(bookmarkId) {
      await extensionApi().storage.local.remove(imageStorageKey(bookmarkId));
    },
    async clearMissing(existingIds) {
      const stored = await extensionApi().storage.local.get(null);
      const orphans = orphanImageKeys(Object.keys(stored), existingIds);
      if (orphans.length > 0) await extensionApi().storage.local.remove(orphans);
    },
    async clearAll() {
      const stored = await extensionApi().storage.local.get(null);
      const keys = dialImageStorageKeys(Object.keys(stored));
      if (keys.length > 0) await extensionApi().storage.local.remove(keys);
    },
    async getUsage() {
      const stored = await extensionApi().storage.local.get(null);
      const keys = dialImageStorageKeys(Object.keys(stored));
      let bytesUsed = 0;
      if (keys.length > 0) {
        try {
          bytesUsed = await extensionApi().storage.local.getBytesInUse(keys);
        } catch {
          // Fall back to data-URL string lengths if getBytesInUse is unavailable.
          const images = collectImages(stored as Record<string, unknown>);
          for (const dataUrl of Object.values(images)) bytesUsed += dataUrl.length;
        }
      }
      // Chrome often still exposes QUOTA_BYTES as ~10 MB even when
      // unlimitedStorage is granted; trust the permission, not the constant.
      if (await hasUnlimitedStorageGrant()) {
        return { bytesUsed, bytesQuota: null };
      }
      return {
        bytesUsed,
        bytesQuota: meaningfulStorageQuotaBytes(extensionApi().storage.local.QUOTA_BYTES),
      };
    },
  };
}

/** True when install-time or optional unlimitedStorage is active for this load. */
async function hasUnlimitedStorageGrant(): Promise<boolean> {
  try {
    const declared = extensionApi().runtime.getManifest().permissions ?? [];
    if (declared.includes("unlimitedStorage")) return true;
    return await extensionApi().permissions.contains({ permissions: ["unlimitedStorage"] });
  } catch {
    return false;
  }
}

async function readGrantedPermissions(): Promise<PermissionRequestPayload> {
  try {
    const granted = await extensionApi().permissions.getAll();
    return {
      permissions: granted.permissions ? [...granted.permissions] : [],
      origins: granted.origins ? [...granted.origins] : [],
    };
  } catch {
    return { permissions: [], origins: [] };
  }
}

async function removePermissionPiece(piece: PermissionRequestPayload): Promise<void> {
  const permissions = piece.permissions?.length ? [...piece.permissions] : undefined;
  const origins = piece.origins?.length ? [...piece.origins] : undefined;
  if (!permissions && !origins) return;
  try {
    // Cast: our payloads are manifest-declared optional strings; @types/chrome
    // wants ManifestPermission for the permissions field only.
    await extensionApi().permissions.remove({
      ...(permissions ? { permissions: permissions as chrome.runtime.ManifestPermission[] } : {}),
      ...(origins ? { origins } : {}),
    });
  } catch {
    // Best-effort; caller verifies with contains/getAll.
  }
}

/**
 * Revoke optional grants for one Settings toggle.
 * Uses getAll ∩ target, then also tries each target piece directly, so a
 * mismatched getAll listing still clears http(s) / tabs / <all_urls>.
 */
async function revokeOptionalGrants(target: PermissionRequestPayload): Promise<void> {
  const granted = await readGrantedPermissions();
  const overlap = intersectGrantedPermissions(granted, target);
  for (const piece of permissionRemovePieces(overlap)) {
    await removePermissionPiece(piece);
  }
  for (const piece of permissionRemovePieces(target)) {
    await removePermissionPiece(piece);
  }
}

export function chromePermissions(): PermissionsApi {
  return {
    async hasThumbnailAccess() {
      const request = thumbnailPermissionRequest();
      try {
        return await extensionApi().permissions.contains({
          permissions: [...request.permissions],
          origins: [...request.origins],
        });
      } catch {
        return false;
      }
    },
    async requestThumbnailAccess() {
      // Always call request (no contains short-circuit). After toggle-off
      // remove(), Chrome usually re-grants silently if the user Allowed before;
      // a dialog appears only on first grant or after the user revokes in
      // chrome://extensions.
      const request = thumbnailPermissionRequest();
      if (!isRequestCoveredByOptionalManifest(request)) return false;
      try {
        return await extensionApi().permissions.request({
          permissions: [...request.permissions],
          origins: [...request.origins],
        });
      } catch {
        // Chrome rejects undeclared optional permissions with a thrown Error
        // (not granted:false). Treat as deny so Settings toggles stay off.
        return false;
      }
    },
    async removeThumbnailAccess() {
      // Drops active access only. Chrome remembers prior Allow for silent restore.
      await revokeOptionalGrants(thumbnailPermissionRemove());
    },
    async hasImageUrlFetchAccess() {
      // Prefer getAll over batch contains(http+https): more reliable when the
      // browser lists scheme wildcards individually after a grant.
      try {
        const granted = await readGrantedPermissions();
        const origins = new Set(granted.origins ?? []);
        if (origins.has(THUMBNAIL_HOST_PERMISSION) || origins.has("*://*/*")) return true;
        return OPTIONAL_FETCH_HOST_PERMISSIONS.every((origin) => origins.has(origin));
      } catch {
        return false;
      }
    },
    async requestImageUrlFetchAccess() {
      // Always request the scheme wildcards so this toggle owns its grants and
      // survives thumbnails revoke of <all_urls>. Silent when already covered
      // (<all_urls> or Chrome’s prior-Allow memory after remove).
      // Do not await contains/getAll first — Firefox drops the user gesture.
      const request = imageUrlFetchPermissionRequest();
      if (!isRequestCoveredByOptionalManifest(request)) return false;
      try {
        return await extensionApi().permissions.request({ origins: [...request.origins] });
      } catch {
        return false;
      }
    },
    async requestThumbnailAndImageUrlFetchAccess() {
      const request = thumbnailAndImageUrlPermissionRequest();
      if (!isRequestCoveredByOptionalManifest(request)) return false;
      try {
        return await extensionApi().permissions.request({
          permissions: [...request.permissions],
          origins: [...request.origins],
        });
      } catch {
        return false;
      }
    },
    async removeImageUrlFetchAccess() {
      // Drops active http/https access only. Prior Allow may restore silently.
      await revokeOptionalGrants(imageUrlFetchPermissionRemove());
    },
    async canFetchUrl(href) {
      if (await this.hasImageUrlFetchAccess()) return Boolean(originHostPermission(href));
      const origin = originHostPermission(href);
      if (!origin) return false;
      try {
        return await extensionApi().permissions.contains({ origins: [origin] });
      } catch {
        return false;
      }
    },
    async requestFetchAccess(href) {
      // Always call request (no contains short-circuit). A prior await of
      // contains/getAll drops Firefox’s user-gesture requirement.
      const request = fetchPermissionRequest(href);
      if (!request) return false;
      if (!isRequestCoveredByOptionalManifest(request)) return false;
      try {
        return await extensionApi().permissions.request({ origins: [...request.origins] });
      } catch {
        return false;
      }
    },
  };
}

const DEFAULT_CAPTURE_WAIT_MS = thumbnailWaitMs(DEFAULT_LAYOUT.thumbnailWaitSeconds);

export function chromeCapture(): CaptureApi {
  return {
    async capturePage(pageUrl, waitMs = DEFAULT_CAPTURE_WAIT_MS) {
      const permissions = chromePermissions();
      if (!(await permissions.hasThumbnailAccess())) {
        throw new Error(thumbnailPermissionDeniedMessage());
      }

      const delayMs =
        Number.isFinite(waitMs) && waitMs > 0 ? waitMs : DEFAULT_CAPTURE_WAIT_MS;

      const windowId = await openCaptureWindow(pageUrl);
      try {
        // Always wait the configured duration from open. Waiting only for
        // tabs.onUpdated "complete" (previous behavior) finished in ~1–2s on
        // typical pages and ignored the Settings value for anything larger.
        await delay(delayMs);
        const dataUrl = await extensionApi().tabs.captureVisibleTab(windowId, {
          format: "jpeg",
          quality: 72,
        });
        const valid = readImageDataUrl(dataUrl);
        if (!valid) throw new Error(t("error_screenshot_store"));
        // Same on-ingest resize budget as file attach (tile role).
        return ingestDataUrl(valid, "tile");
      } finally {
        try {
          await extensionApi().windows.remove(windowId);
        } catch {
          // Window may already be closed by the user.
        }
      }
    },
  };
}

async function openCaptureWindow(pageUrl: string): Promise<number> {
  const created = await extensionApi().windows.create({
    url: pageUrl,
    type: "popup",
    focused: true,
    width: 1280,
    height: 720,
  });
  const windowId = created?.id;
  if (windowId === undefined) throw new Error(t("error_capture_window"));
  return windowId;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
