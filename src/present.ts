import {
  acceptsChildren,
  bookmarkRoot,
  breadcrumb,
  classify,
  dialItems,
  dialOpenFolderOptions,
  displayTitle,
  folderLabel,
  nodeIndex,
  orderDialItems,
  type BookmarkNode,
  type Crumb,
  type DialItem,
  type FolderOption,
} from "./model.ts";
import type { LayoutSettings } from "./settings.ts";

export type CreateKind = "folder" | "bookmark";

export type CreateForm = {
  mode: "create";
  kind: CreateKind;
  title: string;
  url: string;
};

export type EditForm = {
  mode: "edit";
  id: string;
  kind: "folder" | "bookmark";
  title: string;
  url: string;
};

export type DialForm = CreateForm | EditForm;

export type AppState = {
  banner: string | null;
  status: "loading" | "ready" | "failed";
  error: string | null;
  tree: BookmarkNode[];
  currentId: string | null;
  /** Optional default folder for new windows; null = recall last open. */
  defaultFolderId: string | null;
  form: DialForm | null;
  saving: boolean;
  layout: LayoutSettings;
  /** Local dial pictures keyed by bookmark id (data URLs). */
  images: Record<string, string>;
  /** True when thumbnails setting is on and optional permissions are granted. */
  thumbnailsActive: boolean;
  /** True when Image-from-URL setting is on and optional host access is granted. */
  imageUrlFetchActive: boolean;
};

export type ViewModel =
  | { name: "loading"; banner: string | null }
  | { name: "unavailable"; banner: string | null; message: string }
  | {
      name: "grid";
      banner: string | null;
      crumbs: Crumb[];
      items: DialItem[];
      empty: string | null;
      error: string | null;
      canCreate: boolean;
      canRenameCurrent: boolean;
      canDeleteCurrent: boolean;
      /** Open folder id and optional picture for the breadcrumb ⋮ menu. */
      currentFolder: { id: string; title: string; imageDataUrl: string | null; kind: "folder"; url: null };
      form: DialForm | null;
      saving: boolean;
      layout: LayoutSettings;
      /** Optional default folder for new windows; null = last open. */
      defaultFolderId: string | null;
      /** Bookmark folders offered in the default-folder Settings picker. */
      defaultFolderOptions: FolderOption[];
      /** Capture thumbnail is available in the picture menu. */
      thumbnailsActive: boolean;
      /** Image from URL is available in the picture menu. */
      imageUrlFetchActive: boolean;
    };

function folderNode(tree: readonly BookmarkNode[], id: string | null): BookmarkNode | null {
  if (!id) return null;
  const node = nodeIndex(tree).get(id);
  if (!node || classify(node) !== "folder") return null;
  return node;
}

export function canRenameNode(node: BookmarkNode | undefined | null): boolean {
  if (!node) return false;
  const kind = classify(node);
  if (kind === "skip") return false;
  if (kind === "folder" && node.id === "0") return false;
  return true;
}

export function canDeleteNode(node: BookmarkNode | undefined | null): boolean {
  return canRenameNode(node);
}

export function folderHasContents(node: BookmarkNode): boolean {
  return (node.children?.length ?? 0) > 0;
}

export function deleteConfirmMessage(node: BookmarkNode): string {
  const kind = classify(node);
  if (kind === "link") {
    const title = displayTitle(node.title, "link");
    return `Delete “${title}”? This removes the bookmark from Chrome.`;
  }
  const title = folderLabel(node);
  if (folderHasContents(node)) {
    return `Delete folder “${title}” and everything inside it? This cannot be undone from Hearth.`;
  }
  return `Delete empty folder “${title}”?`;
}

export const REFRESH_ALL_THUMBNAILS_TITLE = "Refresh All Thumbnails";
export const REFRESH_ALL_THUMBNAILS_CONFIRM = "Refresh";

/** Confirm copy before batch-recapturing dial pictures in the open folder. */
export function refreshAllThumbnailsConfirmMessage(count: number): string {
  const n = Math.max(0, Math.floor(count));
  const noun = n === 1 ? "bookmark" : "bookmarks";
  return `Recapture thumbnails for ${n} ${noun} in this folder? Existing dial pictures for those bookmarks will be replaced. Nested folders are not included.`;
}

export function present(state: AppState): ViewModel {
  if (state.status === "loading") return { name: "loading", banner: state.banner };

  const root = bookmarkRoot(state.tree);
  if (!root) {
    return {
      name: "unavailable",
      banner: state.banner,
      message: state.error ?? "Hearth could not read Chrome bookmarks.",
    };
  }

  const current = folderNode(state.tree, state.currentId) ?? root;
  const items = orderDialItems(
    dialItems(current).map((item) => ({
      ...item,
      imageDataUrl: state.images[item.id] ?? null,
    })),
    state.layout.reverseOrder,
  );
  return {
    name: "grid",
    banner: state.banner,
    crumbs: breadcrumb(state.tree, root.id, current.id),
    items,
    empty: items.length === 0 ? "This folder has no bookmarks yet." : null,
    error: state.error,
    canCreate: acceptsChildren(current),
    canRenameCurrent: canRenameNode(current),
    canDeleteCurrent: canDeleteNode(current),
    currentFolder: {
      id: current.id,
      title: folderLabel(current),
      imageDataUrl: state.images[current.id] ?? null,
      kind: "folder",
      url: null,
    },
    form: state.form,
    saving: state.saving,
    layout: state.layout,
    defaultFolderId: state.defaultFolderId,
    defaultFolderOptions: dialOpenFolderOptions(state.tree),
    thumbnailsActive: state.thumbnailsActive,
    imageUrlFetchActive: state.imageUrlFetchActive,
  };
}