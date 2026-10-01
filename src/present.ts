import {
  acceptsChildren,
  bookmarkRoot,
  breadcrumb,
  classify,
  dialItems,
  dialOpenFolderOptions,
  displayTitle,
  folderLabel,
  isBookmarkTreeRootId,
  nodeIndex,
  normalizeDialQuery,
  orderDialItems,
  searchDialSubtree,
  type BookmarkNode,
  type Crumb,
  type DialItem,
  type FolderOption,
} from "./model.ts";
import type { LayoutSettings } from "./settings.ts";
import { t } from "./i18n.ts";

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
  /** Optional local theme wallpaper data URL. */
  themeBackground: string | null;
  /** True when thumbnails setting is on and optional permissions are granted. */
  thumbnailsActive: boolean;
  /** True when Image-from-URL setting is on and optional host access is granted. */
  imageUrlFetchActive: boolean;
  /** Find-a-dial filter for the open folder + subtree (titles + URLs). */
  searchQuery: string;
  /**
   * True after the user dismisses the first-run welcome (or while boot still
   * loads the flag — hide until we know it should show).
   */
  welcomeDismissed: boolean;
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
      /** Current find-a-dial query (empty when not filtering). */
      searchQuery: string;
      /** True when a non-empty query is filtering the grid. */
      searching: boolean;
      /** Show the first-run welcome card above the dial grid. */
      showWelcome: boolean;
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
  // Chrome `"0"` and Firefox `"root________"` — not user-editable.
  if (kind === "folder" && isBookmarkTreeRootId(node.id)) return false;
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
    return t("delete_link_confirm", title);
  }
  const title = folderLabel(node);
  if (folderHasContents(node)) {
    return t("delete_folder_filled_confirm", title);
  }
  return t("delete_folder_empty_confirm", title);
}

export function refreshAllThumbnailsTitle(): string {
  return t("refresh_all_title");
}

export function refreshAllThumbnailsConfirm(): string {
  return t("refresh_all_confirm_btn");
}

/** Confirm copy before batch-recapturing dial pictures in the open folder. */
export function refreshAllThumbnailsConfirmMessage(count: number): string {
  const n = Math.max(0, Math.floor(count));
  const noun = n === 1 ? t("noun_bookmark") : t("noun_bookmarks");
  return t("refresh_all_message", [String(n), noun]);
}

/**
 * Dial-banner summary when one or more captures fail during Refresh All.
 * Keeps the existing error-banner UX; does not invent a per-tile overlay.
 */
export function refreshAllThumbnailsFailureMessage(
  failed: number,
  total: number,
  detail: string,
): string {
  const failedCount = Math.max(0, Math.floor(failed));
  const totalCount = Math.max(0, Math.floor(total));
  const trimmed = detail.trim();
  if (trimmed) {
    return t("error_refresh_partial", [String(failedCount), String(totalCount), trimmed]);
  }
  return t("error_refresh_partial_no_detail", [String(failedCount), String(totalCount)]);
}

export function present(state: AppState): ViewModel {
  if (state.status === "loading") return { name: "loading", banner: state.banner };

  const root = bookmarkRoot(state.tree);
  if (!root) {
    return {
      name: "unavailable",
      banner: state.banner,
      message: state.error ?? t("unavailable_default"),
    };
  }

  const current = folderNode(state.tree, state.currentId) ?? root;
  const searchQuery = state.searchQuery;
  const searching = normalizeDialQuery(searchQuery).length > 0;
  const baseItems = searching ? searchDialSubtree(current, searchQuery) : dialItems(current);
  const items = orderDialItems(
    baseItems.map((item) => ({
      ...item,
      imageDataUrl: state.images[item.id] ?? null,
    })),
    state.layout.reverseOrder,
  );
  let empty: string | null = null;
  if (items.length === 0) {
    empty = searching
      ? t("empty_search", searchQuery.trim())
      : t("empty_folder");
  }
  return {
    name: "grid",
    banner: state.banner,
    crumbs: breadcrumb(state.tree, root.id, current.id),
    items,
    empty,
    error: state.error,
    canCreate: acceptsChildren(current) && !searching,
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
    searchQuery,
    searching,
    showWelcome: !state.welcomeDismissed,
  };
}