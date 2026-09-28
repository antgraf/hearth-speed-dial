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
  originHostPermission,
  THUMBNAIL_HOST_PERMISSION,
  thumbnailPermissionDeniedMessage,
  thumbnailPermissionRequest,
  type CaptureApi,
  type PermissionsApi,
} from "./permissions.ts";
import {
  clampColumns,
  clampTileSize,
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

export function chromePermissions(): PermissionsApi {
  return {
    async hasThumbnailAccess() {
      const request = thumbnailPermissionRequest();
      return chrome.permissions.contains({
        permissions: [...request.permissions],
        origins: [...request.origins],
      });
    },
    async requestThumbnailAccess() {
      const request = thumbnailPermissionRequest();
      return chrome.permissions.request({
        permissions: [...request.permissions],
        origins: [...request.origins],
      });
    },
    async canFetchUrl(href) {
      const hasAll = await chrome.permissions.contains({ origins: [THUMBNAIL_HOST_PERMISSION] });
      if (hasAll) return true;
      const origin = originHostPermission(href);
      if (!origin) return false;
      return chrome.permissions.contains({ origins: [origin] });
    },
    async requestFetchAccess(href) {
      if (await this.canFetchUrl(href)) return true;
      const request = fetchPermissionRequest(href);
      if (!request) return false;
      return chrome.permissions.request({ origins: [...request.origins] });
    },
  };
}

const CAPTURE_LOAD_TIMEOUT_MS = 45_000;

export function chromeCapture(): CaptureApi {
  return {
    async capturePage(pageUrl) {
      const permissions = chromePermissions();
      if (!(await permissions.hasThumbnailAccess())) {
        throw new Error(thumbnailPermissionDeniedMessage());
      }

      const windowId = await openCaptureWindow(pageUrl);
      try {
        await waitForWindowTabComplete(windowId);
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

function waitForWindowTabComplete(windowId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      finish(() => reject(new Error("That page took too long to load for a thumbnail.")));
    }, CAPTURE_LOAD_TIMEOUT_MS);

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
