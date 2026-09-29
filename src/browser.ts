import type { BookmarkNode } from "./model.ts";
import {
  collectImages,
  dataUrlByteLength,
  imageStorageKey,
  MAX_IMAGE_BYTES,
  orphanImageKeys,
  readImageDataUrl,
  type ImagesApi,
} from "./images.ts";
import {
  fetchPermissionRequest,
  imageUrlFetchPermissionRemove,
  imageUrlFetchPermissionRequest,
  intersectGrantedPermissions,
  originHostPermission,
  permissionRemovePieces,
  THUMBNAIL_HOST_PERMISSION,
  thumbnailPermissionDeniedMessage,
  thumbnailPermissionRemove,
  thumbnailPermissionRequest,
  type CaptureApi,
  type PermissionRequestPayload,
  type PermissionsApi,
} from "./permissions.ts";
import {
  clampColumns,
  clampThumbnailWaitSeconds,
  clampTileSize,
  DEFAULT_LAYOUT,
  readDefaultFolderId,
  readLayout,
  readOpenFolderId,
  type LayoutSettings,
  type SettingsApi,
} from "./settings.ts";

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
  return {
    async getTree() {
      const tree = await chrome.bookmarks.getTree();
      return tree.map(fromChrome);
    },
    async createFolder(parentId, title) {
      const created = await chrome.bookmarks.create({ parentId, title });
      return fromChrome(created);
    },
    async createBookmark(parentId, title, url) {
      const created = await chrome.bookmarks.create({ parentId, title, url });
      return fromChrome(created);
    },
    async update(id, changes) {
      const updated = await chrome.bookmarks.update(id, changes);
      return fromChrome(updated);
    },
    async move(id, destination) {
      const destinationArg: chrome.bookmarks.MoveDestination = {};
      if (destination.parentId !== undefined) destinationArg.parentId = destination.parentId;
      if (destination.index !== undefined) destinationArg.index = destination.index;
      const moved = await chrome.bookmarks.move(id, destinationArg);
      return fromChrome(moved);
    },
    async remove(id) {
      const nodes = await chrome.bookmarks.get(id);
      const node = nodes[0];
      if (!node) throw new Error("That bookmark is no longer available.");
      if (node.url !== undefined) await chrome.bookmarks.remove(id);
      else await chrome.bookmarks.removeTree(id);
    },
    subscribe(listener) {
      const onCreated = () => listener();
      const onRemoved = () => listener();
      const onChanged = () => listener();
      const onMoved = () => listener();
      const onReordered = () => listener();
      chrome.bookmarks.onCreated.addListener(onCreated);
      chrome.bookmarks.onRemoved.addListener(onRemoved);
      chrome.bookmarks.onChanged.addListener(onChanged);
      chrome.bookmarks.onMoved.addListener(onMoved);
      chrome.bookmarks.onChildrenReordered.addListener(onReordered);
      return () => {
        chrome.bookmarks.onCreated.removeListener(onCreated);
        chrome.bookmarks.onRemoved.removeListener(onRemoved);
        chrome.bookmarks.onChanged.removeListener(onChanged);
        chrome.bookmarks.onMoved.removeListener(onMoved);
        chrome.bookmarks.onChildrenReordered.removeListener(onReordered);
      };
    },
  };
}

export function chromeSettings(): SettingsApi {
  return {
    async getOpenFolderId() {
      const stored = await chrome.storage.local.get("settings");
      return readOpenFolderId(stored.settings);
    },
    async setOpenFolderId(id) {
      await patchSettings({ openFolderId: id });
    },
    async getDefaultFolderId() {
      const stored = await chrome.storage.local.get("settings");
      return readDefaultFolderId(stored.settings);
    },
    async setDefaultFolderId(id) {
      await patchSettings({ defaultFolderId: id });
    },
    async getLayout() {
      const stored = await chrome.storage.local.get("settings");
      return readLayout(stored.settings);
    },
    async setLayout(layout: LayoutSettings) {
      await patchSettings({
        columns: clampColumns(layout.columns),
        tileSize: clampTileSize(layout.tileSize),
        reverseOrder: Boolean(layout.reverseOrder),
        thumbnailsEnabled: Boolean(layout.thumbnailsEnabled),
        imageUrlFetchEnabled: Boolean(layout.imageUrlFetchEnabled),
        thumbnailWaitSeconds: clampThumbnailWaitSeconds(layout.thumbnailWaitSeconds),
      });
    },
  };
}

async function patchSettings(patch: Record<string, unknown>): Promise<void> {
  const stored = await chrome.storage.local.get("settings");
  const previous =
    stored.settings && typeof stored.settings === "object"
      ? (stored.settings as Record<string, unknown>)
      : {};
  await chrome.storage.local.set({ settings: { ...previous, ...patch } });
}

export function chromeImages(): ImagesApi {
  return {
    async getAll() {
      const stored = await chrome.storage.local.get(null);
      return collectImages(stored as Record<string, unknown>);
    },
    async setImage(bookmarkId, dataUrl) {
      const valid = readImageDataUrl(dataUrl);
      if (!valid) throw new Error("That file could not be stored as an image.");
      await chrome.storage.local.set({ [imageStorageKey(bookmarkId)]: valid });
    },
    async clearImage(bookmarkId) {
      await chrome.storage.local.remove(imageStorageKey(bookmarkId));
    },
    async clearMissing(existingIds) {
      const stored = await chrome.storage.local.get(null);
      const orphans = orphanImageKeys(Object.keys(stored), existingIds);
      if (orphans.length > 0) await chrome.storage.local.remove(orphans);
    },
  };
}

async function readGrantedPermissions(): Promise<PermissionRequestPayload> {
  try {
    const granted = await chrome.permissions.getAll();
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
    await chrome.permissions.remove({
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
        return await chrome.permissions.contains({
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
      try {
        return await chrome.permissions.request({
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
      try {
        const hasAll = await chrome.permissions.contains({ origins: [THUMBNAIL_HOST_PERMISSION] });
        if (hasAll) return true;
        const request = imageUrlFetchPermissionRequest();
        return await chrome.permissions.contains({ origins: [...request.origins] });
      } catch {
        return false;
      }
    },
    async requestImageUrlFetchAccess() {
      // Always request the scheme wildcards so this toggle owns its grants and
      // survives thumbnails revoke of <all_urls>. Silent when already covered
      // (<all_urls> or Chrome’s prior-Allow memory after remove).
      const request = imageUrlFetchPermissionRequest();
      try {
        return await chrome.permissions.request({ origins: [...request.origins] });
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
        return await chrome.permissions.contains({ origins: [origin] });
      } catch {
        return false;
      }
    },
    async requestFetchAccess(href) {
      if (await this.canFetchUrl(href)) return true;
      const request = fetchPermissionRequest(href);
      if (!request) return false;
      try {
        return await chrome.permissions.request({ origins: [...request.origins] });
      } catch {
        return false;
      }
    },
  };
}

const DEFAULT_CAPTURE_LOAD_TIMEOUT_MS = DEFAULT_LAYOUT.thumbnailWaitSeconds * 1000;

export function chromeCapture(): CaptureApi {
  return {
    async capturePage(pageUrl, loadTimeoutMs = DEFAULT_CAPTURE_LOAD_TIMEOUT_MS) {
      const permissions = chromePermissions();
      if (!(await permissions.hasThumbnailAccess())) {
        throw new Error(thumbnailPermissionDeniedMessage());
      }

      const timeoutMs =
        Number.isFinite(loadTimeoutMs) && loadTimeoutMs > 0
          ? loadTimeoutMs
          : DEFAULT_CAPTURE_LOAD_TIMEOUT_MS;

      const windowId = await openCaptureWindow(pageUrl);
      try {
        await waitForWindowTabComplete(windowId, timeoutMs);
        const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
          format: "jpeg",
          quality: 72,
        });
        const valid = readImageDataUrl(dataUrl);
        if (!valid) throw new Error("The page screenshot could not be stored as an image.");
        if (dataUrlByteLength(valid) > MAX_IMAGE_BYTES) {
          throw new Error(
            "That screenshot is too large to store. Try a simpler page, or attach a smaller image file.",
          );
        }
        return valid;
      } finally {
        try {
          await chrome.windows.remove(windowId);
        } catch {
          // Window may already be closed by the user.
        }
      }
    },
  };
}

async function openCaptureWindow(pageUrl: string): Promise<number> {
  const created = await chrome.windows.create({
    url: pageUrl,
    type: "popup",
    focused: true,
    width: 1280,
    height: 720,
  });
  const windowId = created?.id;
  if (windowId === undefined) throw new Error("Could not open a window to capture that page.");
  return windowId;
}

function waitForWindowTabComplete(windowId: number, loadTimeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      finish(() => reject(new Error("That page took too long to load for a thumbnail.")));
    }, loadTimeoutMs);

    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      action();
    };

    const onUpdated = (
      _tabId: number,
      changeInfo: { status?: string },
      tab: chrome.tabs.Tab,
    ) => {
      if (tab.windowId !== windowId) return;
      if (changeInfo.status === "complete") {
        finish(() => {
          // Brief settle so late paints / redirects finish before capture.
          setTimeout(() => resolve(), 400);
        });
      }
    };

    chrome.tabs.onUpdated.addListener(onUpdated);

    void chrome.tabs.query({ windowId, active: true }).then((tabs) => {
      const tab = tabs[0];
      if (tab?.status === "complete") {
        finish(() => setTimeout(() => resolve(), 400));
      }
    });
  });
}
