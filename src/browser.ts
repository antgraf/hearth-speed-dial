import type { BookmarkNode } from "./model.ts";
import {
  collectImages,
  imageStorageKey,
  orphanImageKeys,
  readImageDataUrl,
  type ImagesApi,
} from "./images.ts";
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
