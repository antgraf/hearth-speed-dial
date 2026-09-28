import {
  acceptsChildren,
  alreadyInFolder,
  bookmarkRoot,
  bookmarkUrl,
  classify,
  folderName,
  moveIntoFolderError,
  nodeIndex,
  openableUrl,
  parentIds,
  reorderMoveIndex,
  type BookmarkNode,
} from "./model.ts";
import { canDeleteNode, canRenameNode, deleteConfirmMessage, present, type AppState, type CreateKind } from "./present.ts";
import type { BookmarksApi } from "./browser.ts";
import { confirmDialog } from "./dialog.ts";
import { fetchImageAsDataUrl, fileToDataUrl, imageSourceUrl, imageUrlInvalidMessage, type ImagesApi } from "./images.ts";
import {
  imageUrlPermissionDeniedMessage,
  thumbnailPermissionDeniedMessage,
  thumbnailUnavailableMessage,
  type CaptureApi,
  type PermissionsApi,
} from "./permissions.ts";
import {
  clampColumns,
  clampTileSize,
  DEFAULT_LAYOUT,
  type LayoutSettings,
  type SettingsApi,
} from "./settings.ts";
import { render } from "./view.ts";

export type AppPorts = {
  bookmarks: BookmarksApi;
  settings: SettingsApi;
  images: ImagesApi;
  permissions: PermissionsApi;
  capture: CaptureApi;
  banner?: string | null;
};

export function start(host: HTMLElement, ports: AppPorts): () => void {
  const state: AppState = {
    banner: ports.banner ?? null,
    status: "loading",
    error: null,
    tree: [],
    currentId: null,
    form: null,
    saving: false,
    layout: { ...DEFAULT_LAYOUT },
    images: {},
    thumbnailsActive: false,
  };
  let request = 0;

  const draw = () =>
    render(host, present(state), {
      openFolder: (id) => {
        void showFolder(id);
      },
      goToFolder: (id) => {
        void showFolder(id);
      },
      beginCreate: (kind) => {
        if (state.saving) return;
        state.error = null;
        state.form = { mode: "create", kind, title: "", url: "" };
        draw();
      },
      beginEdit: (id) => {
        if (state.saving) return;
        const node = nodeIndex(state.tree).get(id);
        if (!canRenameNode(node) || !node) return;
        const kind = classify(node) === "folder" ? "folder" : "bookmark";
        state.error = null;
        state.form = {
          mode: "edit",
          id: node.id,
          kind,
          title: node.title,
          url: kind === "bookmark" ? (node.url ?? "") : "",
        };
        draw();
      },
      requestDelete: (id) => {
        void deleteNode(id);
      },
      cancelForm: () => {
        if (state.saving) return;
        state.form = null;
        state.error = null;
        draw();
      },
      submitForm: (input) => {
        void saveForm(input);
      },
      reorderDial: (draggedId, beforeId) => {
        void reorderDial(draggedId, beforeId);
      },
      moveDialInto: (draggedId, parentId) => {
        void moveDialInto(draggedId, parentId);
      },
      attachImage: (id, file) => {
        void attachImage(id, file);
      },
      attachImageUrl: (id, url) => {
        void attachImageUrl(id, url);
      },
      captureThumbnail: (id) => {
        void captureThumbnail(id);
      },
      clearImage: (id) => {
        void clearImage(id);
      },
      setLayout: (layout) => saveLayout(layout),
    });

  const syncThumbnailActive = async (preferEnabled: boolean): Promise<boolean> => {
    if (!preferEnabled) {
      state.thumbnailsActive = false;
      return false;
    }
    const granted = await ports.permissions.hasThumbnailAccess();
    state.thumbnailsActive = granted;
    return granted;
  };

  const showFolder = async (id: string) => {
    const folder = nodeIndex(state.tree).get(id);
    if (!folder || classify(folder) !== "folder") return;
    state.currentId = id;
    state.form = null;
    state.error = null;
    draw();
    try {
      await ports.settings.setOpenFolderId(id);
    } catch (error) {
      state.error = errorText(error);
      draw();
    }
  };

  const deleteNode = async (id: string) => {
    if (state.saving) return;
    const node = nodeIndex(state.tree).get(id);
    if (!canDeleteNode(node) || !node) return;
    const kind = classify(node);
    const confirmed = await confirmDialog({
      title: kind === "folder" ? "Delete folder" : "Delete bookmark",
      message: deleteConfirmMessage(node),
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      danger: true,
    });
    if (!confirmed) return;
    const removedIds = collectDescendantIds(node);
    state.form = null;
    state.saving = true;
    state.error = null;
    draw();
    try {
      await ports.bookmarks.remove(id);
      // Best-effort: clear pictures for the deleted node (and folder contents).
      await Promise.allSettled(removedIds.map((removedId) => ports.images.clearImage(removedId)));
      state.saving = false;
      await reload();
    } catch (error) {
      state.saving = false;
      state.error = errorText(error);
      draw();
    }
  };

  const attachImage = async (id: string, file: File) => {
    if (state.saving) return;
    const node = nodeIndex(state.tree).get(id);
    if (!node || classify(node) === "skip") return;
    state.saving = true;
    state.error = null;
    draw();
    try {
      const dataUrl = await fileToDataUrl(file);
      await ports.images.setImage(id, dataUrl);
      state.images = { ...state.images, [id]: dataUrl };
      state.saving = false;
      draw();
    } catch (error) {
      state.saving = false;
      state.error = errorText(error);
      draw();
    }
  };

  const attachImageUrl = async (id: string, rawUrl: string) => {
    if (state.saving) return;
    const node = nodeIndex(state.tree).get(id);
    if (!node || classify(node) === "skip") return;
    const href = imageSourceUrl(rawUrl);
    if (!href) {
      state.error = imageUrlInvalidMessage();
      draw();
      return;
    }
    state.saving = true;
    state.error = null;
    draw();
    try {
      const allowed = await ports.permissions.requestFetchAccess(href);
      if (!allowed) throw new Error(imageUrlPermissionDeniedMessage());
      const dataUrl = await fetchImageAsDataUrl(href);
      await ports.images.setImage(id, dataUrl);
      state.images = { ...state.images, [id]: dataUrl };
      state.saving = false;
      draw();
    } catch (error) {
      state.saving = false;
      state.error = errorText(error);
      draw();
    }
  };

  const captureThumbnail = async (id: string) => {
    if (state.saving) return;
    const node = nodeIndex(state.tree).get(id);
    if (!node || classify(node) !== "link" || !node.url) return;
    const pageUrl = openableUrl(node.url);
    if (!pageUrl || pageUrl.startsWith("file:")) {
      state.error = "Thumbnails work for http:// and https:// bookmarks only.";
      draw();
      return;
    }
    if (!state.layout.thumbnailsEnabled) {
      state.error = thumbnailUnavailableMessage();
      draw();
      return;
    }
    const granted = await syncThumbnailActive(true);
    if (!granted) {
      state.layout = { ...state.layout, thumbnailsEnabled: false };
      state.error = thumbnailPermissionDeniedMessage();
      draw();
      try {
        await ports.settings.setLayout(state.layout);
      } catch {
        // Keep the in-memory off state even if persist fails.
      }
      return;
    }
    state.saving = true;
    state.error = null;
    draw();
    try {
      const dataUrl = await ports.capture.capturePage(pageUrl);
      await ports.images.setImage(id, dataUrl);
      state.images = { ...state.images, [id]: dataUrl };
      state.saving = false;
      draw();
    } catch (error) {
      state.saving = false;
      state.error = errorText(error);
      draw();
    }
  };

  const clearImage = async (id: string) => {
    if (state.saving) return;
    state.saving = true;
    state.error = null;
    draw();
    try {
      await ports.images.clearImage(id);
      const next = { ...state.images };
      delete next[id];
      state.images = next;
      state.saving = false;
      draw();
    } catch (error) {
      state.saving = false;
      state.error = errorText(error);
      draw();
    }
  };

  const reorderDial = async (draggedId: string, beforeId: string | null) => {
    if (state.saving) return;
    const folder = nodeIndex(state.tree).get(state.currentId ?? "");
    if (!folder || classify(folder) !== "folder" || !folder.children) return;
    const index = reorderMoveIndex(folder.children, draggedId, beforeId);
    if (index === null) return;
    state.form = null;
    state.saving = true;
    state.error = null;
    draw();
    try {
      // Same parentId keeps the move in-folder; subscribe/reload apply the new order.
      await ports.bookmarks.move(draggedId, { parentId: folder.id, index });
      state.saving = false;
      await reload();
    } catch (error) {
      state.saving = false;
      state.error = errorText(error);
      draw();
    }
  };

  const moveDialInto = async (draggedId: string, parentId: string) => {
    if (state.saving) return;
    const illegal = moveIntoFolderError(state.tree, draggedId, parentId);
    if (illegal) {
      state.error = illegal;
      draw();
      return;
    }
    if (alreadyInFolder(state.tree, draggedId, parentId)) return;
    state.form = null;
    state.saving = true;
    state.error = null;
    draw();
    try {
      // Omit index so Chrome appends at the end of the destination folder.
      await ports.bookmarks.move(draggedId, { parentId });
      state.saving = false;
      await reload();
    } catch (error) {
      state.saving = false;
      state.error = errorText(error);
      draw();
    }
  };

  const saveLayout = async (layout: LayoutSettings): Promise<LayoutSettings> => {
    const previous = state.layout;
    let next = {
      columns: clampColumns(layout.columns),
      tileSize: clampTileSize(layout.tileSize),
      reverseOrder: Boolean(layout.reverseOrder),
      thumbnailsEnabled: Boolean(layout.thumbnailsEnabled),
    };

    if (next.thumbnailsEnabled && !previous.thumbnailsEnabled) {
      const granted = await ports.permissions.requestThumbnailAccess();
      if (!granted) {
        next = { ...next, thumbnailsEnabled: false };
        state.layout = next;
        state.thumbnailsActive = false;
        state.error = thumbnailPermissionDeniedMessage();
        draw();
        try {
          await ports.settings.setLayout(next);
        } catch (error) {
          state.error = errorText(error);
          draw();
        }
        return next;
      }
      state.thumbnailsActive = true;
    } else if (!next.thumbnailsEnabled) {
      state.thumbnailsActive = false;
    } else {
      await syncThumbnailActive(true);
      if (!state.thumbnailsActive) {
        next = { ...next, thumbnailsEnabled: false };
        state.error = thumbnailPermissionDeniedMessage();
      }
    }

    state.layout = next;
    draw();
    try {
      await ports.settings.setLayout(next);
    } catch (error) {
      state.error = errorText(error);
      draw();
    }
    return next;
  };

  const saveForm = async (input: { title: string; url: string }) => {
    if (state.saving || !state.form) return;
    if (state.form.mode === "create") await saveCreate(input);
    else await saveEdit(input);
  };

  const saveCreate = async (input: { title: string; url: string }) => {
    if (!state.form || state.form.mode !== "create") return;
    const parent = nodeIndex(state.tree).get(state.currentId ?? "");
    if (!parent || !acceptsChildren(parent)) return;
    const kind: CreateKind = state.form.kind;
    const title = folderName(input.title);
    const url = kind === "bookmark" ? bookmarkUrl(input.url) : null;
    if (!title || (kind === "bookmark" && !url)) {
      state.form = { mode: "create", kind, title: input.title, url: input.url };
      state.error = kind === "folder" ? "Name the folder." : "Name the bookmark and enter its address.";
      draw();
      return;
    }
    state.form = { mode: "create", kind, title, url: input.url };
    state.saving = true;
    state.error = null;
    draw();
    try {
      if (kind === "folder") await ports.bookmarks.createFolder(parent.id, title);
      else await ports.bookmarks.createBookmark(parent.id, title, url ?? "");
      state.form = null;
      state.saving = false;
      await reload();
    } catch (error) {
      state.saving = false;
      state.error = errorText(error);
      draw();
    }
  };

  const saveEdit = async (input: { title: string; url: string }) => {
    if (!state.form || state.form.mode !== "edit") return;
    const node = nodeIndex(state.tree).get(state.form.id);
    if (!canRenameNode(node) || !node) return;
    const kind = state.form.kind;
    const title = folderName(input.title);
    const url = kind === "bookmark" ? bookmarkUrl(input.url) : null;
    if (!title || (kind === "bookmark" && !url)) {
      state.form = { mode: "edit", id: state.form.id, kind, title: input.title, url: input.url };
      state.error = kind === "folder" ? "Name the folder." : "Name the bookmark and enter its address.";
      draw();
      return;
    }
    state.form = { mode: "edit", id: state.form.id, kind, title, url: input.url };
    state.saving = true;
    state.error = null;
    draw();
    try {
      if (kind === "folder") await ports.bookmarks.update(state.form.id, { title });
      else await ports.bookmarks.update(state.form.id, { title, url: url ?? undefined });
      state.form = null;
      state.saving = false;
      await reload();
    } catch (error) {
      state.saving = false;
      state.error = errorText(error);
      draw();
    }
  };

  const reload = async () => {
    const ticket = ++request;
    const previousId = state.currentId;
    try {
      const tree = await ports.bookmarks.getTree();
      if (ticket !== request) return;
      state.tree = tree;
      state.status = "ready";
      state.error = null;
      state.saving = false;
      const opened = resolveFolder(state);
      state.currentId = opened;
      if (opened && opened !== previousId) void ports.settings.setOpenFolderId(opened);
      try {
        const images = await ports.images.getAll();
        if (ticket !== request) return;
        state.images = images;
        // Best-effort orphan sweep when bookmarks were removed outside Hearth.
        void ports.images.clearMissing(new Set(nodeIndex(tree).keys()));
      } catch (imageError) {
        if (ticket !== request) return;
        state.error = errorText(imageError);
      }
    } catch (error) {
      if (ticket !== request) return;
      state.status = state.tree.length > 0 ? "ready" : "failed";
      state.error = errorText(error);
      state.saving = false;
    }
    if (ticket === request) draw();
  };

  let unsubscribe = (): void => undefined;
  try {
    unsubscribe = ports.bookmarks.subscribe(() => {
      void reload();
    });
  } catch (error) {
    state.error = errorText(error);
  }

  void (async () => {
    try {
      state.currentId = await ports.settings.getOpenFolderId();
      const layout = await ports.settings.getLayout();
      state.layout = layout;
      const active = await syncThumbnailActive(layout.thumbnailsEnabled);
      if (layout.thumbnailsEnabled && !active) {
        // Permission revoked while the preference was on — degrade gracefully.
        state.layout = { ...layout, thumbnailsEnabled: false };
        void ports.settings.setLayout(state.layout);
      }
    } catch (error) {
      state.error = errorText(error);
    }
    await reload();
  })();

  return unsubscribe;
}

function collectDescendantIds(node: BookmarkNode): string[] {
  const ids: string[] = [node.id];
  const walk = (children: readonly BookmarkNode[] | undefined) => {
    if (!children) return;
    for (const child of children) {
      ids.push(child.id);
      walk(child.children);
    }
  };
  walk(node.children);
  return ids;
}

function resolveFolder(state: AppState): string | null {
  const root = bookmarkRoot(state.tree);
  if (!root) return null;
  const current = state.currentId ? nodeIndex(state.tree).get(state.currentId) : undefined;
  if (current && classify(current) === "folder" && isInside(state.tree, root.id, current.id)) return current.id;
  return root.id;
}

function isInside(tree: readonly BookmarkNode[], rootId: string, id: string): boolean {
  const parents = parentIds(tree);
  const seen = new Set<string>();
  let current: string | undefined = id;
  while (current && !seen.has(current)) {
    if (current === rootId) return true;
    seen.add(current);
    current = parents.get(current);
  }
  return false;
}

function errorText(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Something went wrong while reading bookmarks.";
}
