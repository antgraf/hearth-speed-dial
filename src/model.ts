import { t } from "./i18n.ts";

export type BookmarkNode = {
  id: string;
  parentId?: string;
  title: string;
  url?: string;
  children?: BookmarkNode[];
};

export type DialItem = {
  id: string;
  title: string;
  kind: "link" | "folder";
  url: string | null;
  meta: string;
  monogram: string;
  /** Local data-URL picture when the user attached one; otherwise null. */
  imageDataUrl: string | null;
};

export type Crumb = {
  id: string;
  /**
   * Accessible name / tooltip. For the tree root this is the i18n root label
   * (not the browser’s raw folder title); the UI shows a home icon instead.
   */
  title: string;
  /** True for the browser bookmark tree root crumb. */
  isRoot: boolean;
};

/** Chrome `bookmarks.getTree()` root folder id. */
export const CHROME_BOOKMARK_ROOT_ID = "0";

/**
 * Firefox `bookmarks.getTree()` root folder id (12-char padded name).
 * Creating bookmarks directly under this node fails in Firefox.
 */
export const FIREFOX_BOOKMARK_ROOT_ID = "root________";

/** True for the unwritable bookmark-tree root in Chrome or Firefox. */
export function isBookmarkTreeRootId(id: string): boolean {
  return id === CHROME_BOOKMARK_ROOT_ID || id === FIREFOX_BOOKMARK_ROOT_ID;
}

export function classify(node: BookmarkNode): "folder" | "link" | "skip" {
  if (typeof node.url === "string") return "link";
  if (node.children || node.title.trim() !== "") return "folder";
  return "skip";
}

export function monogram(title: string): string {
  const trimmed = title.trim();
  const first = Array.from(trimmed)[0];
  if (!first) return "·";
  return first.toLocaleUpperCase();
}

export function siteLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function openableUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "file:") {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

export function nodeIndex(roots: readonly BookmarkNode[]): Map<string, BookmarkNode> {
  const map = new Map<string, BookmarkNode>();
  const walk = (nodes: readonly BookmarkNode[]) => {
    for (const node of nodes) {
      map.set(node.id, node);
      if (node.children) walk(node.children);
    }
  };
  walk(roots);
  return map;
}

export function parentIds(roots: readonly BookmarkNode[]): Map<string, string | undefined> {
  const parents = new Map<string, string | undefined>();
  const walk = (nodes: readonly BookmarkNode[], parentId?: string) => {
    for (const node of nodes) {
      parents.set(node.id, node.parentId ?? parentId);
      if (node.children) walk(node.children, node.id);
    }
  };
  walk(roots);
  return parents;
}

export function displayTitle(title: string, kind: "folder" | "link"): string {
  const trimmed = title.trim();
  if (trimmed) return trimmed;
  return kind === "folder" ? t("fallback_untitled_folder") : t("fallback_untitled");
}

export function folderLabel(node: { id: string; title: string }): string {
  if (isBookmarkTreeRootId(node.id)) return t("fallback_bookmarks_root");
  return displayTitle(node.title, "folder");
}

export function bookmarkRoot(roots: readonly BookmarkNode[]): BookmarkNode | null {
  return (
    roots.find((node) => isBookmarkTreeRootId(node.id) && classify(node) === "folder") ??
    roots.find((node) => classify(node) === "folder") ??
    null
  );
}

/**
 * Folders that can receive a new dial.
 * Chrome and Firefox both reject creates under the bookmark-tree root
 * (`"0"` / `"root________"`); match that in the UI so New is not offered there.
 */
export function acceptsChildren(node: BookmarkNode): boolean {
  return classify(node) === "folder" && !isBookmarkTreeRootId(node.id);
}

export type FolderOption = {
  id: string;
  title: string;
  depth: number;
};

export type FolderTreeNode = {
  id: string;
  title: string;
  children: FolderTreeNode[];
};

/** Nested folder children that can receive a new dial (skips non-folder nodes). */
function dialFolderTreeChildren(node: BookmarkNode): FolderTreeNode[] {
  const out: FolderTreeNode[] = [];
  for (const child of node.children ?? []) {
    if (classify(child) !== "folder") continue;
    if (acceptsChildren(child)) {
      out.push({
        id: child.id,
        title: folderLabel(child),
        children: dialFolderTreeChildren(child),
      });
    } else {
      out.push(...dialFolderTreeChildren(child));
    }
  }
  return out;
}

/**
 * Folder tree for the Add-to-Hearth picker.
 * When `scopeId` names a known folder, only that folder (if it can accept children)
 * and its descendants are listed. Invalid/missing scope falls back to the full tree.
 * The Chrome bookmarks root is never selectable; its children become top-level entries.
 */
export function dialFolderTree(
  roots: readonly BookmarkNode[],
  scopeId?: string | null,
): FolderTreeNode[] {
  if (scopeId) {
    const scope = nodeIndex(roots).get(scopeId);
    if (scope && classify(scope) === "folder") {
      if (acceptsChildren(scope)) {
        return [
          {
            id: scope.id,
            title: folderLabel(scope),
            children: dialFolderTreeChildren(scope),
          },
        ];
      }
      return dialFolderTreeChildren(scope);
    }
  }

  const out: FolderTreeNode[] = [];
  for (const root of roots) {
    if (classify(root) !== "folder") continue;
    if (acceptsChildren(root)) {
      out.push({
        id: root.id,
        title: folderLabel(root),
        children: dialFolderTreeChildren(root),
      });
    } else {
      out.push(...dialFolderTreeChildren(root));
    }
  }
  return out;
}

/** Depth-first flatten of a folder tree (same shape as dialFolderOptions). */
export function flattenFolderTree(
  tree: readonly FolderTreeNode[],
  depth = 0,
): FolderOption[] {
  const options: FolderOption[] = [];
  for (const node of tree) {
    options.push({ id: node.id, title: node.title, depth });
    options.push(...flattenFolderTree(node.children, depth + 1));
  }
  return options;
}

/** Folders that can receive a new dial, depth-first, excluding the Chrome root. */
export function dialFolderOptions(roots: readonly BookmarkNode[]): FolderOption[] {
  return flattenFolderTree(dialFolderTree(roots));
}

/**
 * Folders the dial can open, including the Chrome bookmarks root.
 * Used for the optional default-folder Settings picker.
 */
export function dialOpenFolderOptions(roots: readonly BookmarkNode[]): FolderOption[] {
  const root = bookmarkRoot(roots);
  if (!root) return dialFolderOptions(roots);
  return [{ id: root.id, title: folderLabel(root), depth: 0 }, ...dialFolderOptions(roots).map((option) => ({
    ...option,
    depth: option.depth + 1,
  }))];
}

export type AddPageFields = {
  url: string;
  title: string;
};

/**
 * Parse `url` / `title` query fields for the context-menu add page.
 * Returns null when the URL is missing or not an openable dial link.
 */
export function parseAddPageFields(search: string): AddPageFields | null {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  const url = bookmarkUrl(params.get("url") ?? "");
  if (!url) return null;
  const title = (params.get("title") ?? "").trim() || siteLabel(url) || t("fallback_untitled");
  return { url, title };
}

/**
 * Build the add-page query string from a context-menu click.
 * Returns null when there is no openable page or link URL.
 *
 * Title preference: for a page, use the tab title; for a link, use selection text
 * when present (never the hosting page title). Domain fallback happens in parse.
 */
export function addPageQuery(info: {
  linkUrl?: string;
  pageUrl?: string;
  selectionText?: string;
  tabTitle?: string;
}): string | null {
  const rawUrl = info.linkUrl || info.pageUrl;
  if (!rawUrl) return null;
  const url = bookmarkUrl(rawUrl);
  if (!url) return null;
  const params = new URLSearchParams();
  params.set("url", url);
  const selection = info.selectionText?.trim();
  const tabTitle = info.tabTitle?.trim();
  const title = info.linkUrl ? selection : tabTitle || selection;
  if (title) params.set("title", title);
  return params.toString();
}

export function folderName(input: string): string | null {
  const name = input.trim();
  return name.length > 0 ? name : null;
}

export function bookmarkUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return openableUrl(withScheme);
}

/**
 * Chrome `bookmarks.move` index when inserting before the sibling currently at
 * `beforeIndex` in the same parent. Returns null when the move is a no-op.
 *
 * Chromium removes the node first, then inserts. Passing the live `beforeIndex`
 * matches that API for both forward and backward moves (including the
 * `index === oldIndex + 1` no-op).
 */
export function chromeIndexBefore(fromIndex: number, beforeIndex: number): number | null {
  if (!Number.isInteger(fromIndex) || !Number.isInteger(beforeIndex)) return null;
  if (fromIndex < 0 || beforeIndex < 0) return null;
  if (beforeIndex === fromIndex || beforeIndex === fromIndex + 1) return null;
  return beforeIndex;
}

/**
 * Chrome `bookmarks.move` index when moving to the end of the same parent.
 * Returns null when the node is already last (or the list is too small).
 */
export function chromeIndexAtEnd(fromIndex: number, siblingCount: number): number | null {
  if (!Number.isInteger(fromIndex) || !Number.isInteger(siblingCount)) return null;
  if (fromIndex < 0 || siblingCount < 2 || fromIndex >= siblingCount) return null;
  if (fromIndex === siblingCount - 1) return null;
  return siblingCount;
}

/** Index of `id` among `children`, or -1 when missing. */
export function childIndex(children: readonly BookmarkNode[], id: string): number {
  return children.findIndex((child) => child.id === id);
}

/**
 * Drop zone on a folder tile: left/right edge thirds reorder (before/after);
 * the center moves into the folder. Edge width is `min(28, width/3)` so narrow
 * tiles still keep a usable into-zone.
 */
export function folderDropZone(
  clientX: number,
  rect: { left: number; width: number },
): "before" | "into" | "after" {
  const offset = clientX - rect.left;
  const edge = Math.min(28, rect.width / 3);
  if (offset < edge) return "before";
  if (offset > rect.width - edge) return "after";
  return "into";
}

/**
 * Same-parent Chrome move index to place `draggedId` before `beforeId`
 * (or at the end when `beforeId` is null). Uses the full children list so
 * separator/skip nodes keep their Chrome indices.
 */
export function reorderMoveIndex(
  children: readonly BookmarkNode[],
  draggedId: string,
  beforeId: string | null,
): number | null {
  const fromIndex = childIndex(children, draggedId);
  if (fromIndex < 0) return null;
  if (beforeId === null) return chromeIndexAtEnd(fromIndex, children.length);
  if (beforeId === draggedId) return null;
  const beforeIndex = childIndex(children, beforeId);
  if (beforeIndex < 0) return null;
  return chromeIndexBefore(fromIndex, beforeIndex);
}

/** True when `id` is `ancestorId` or nested under it. */
export function isUnderAncestor(
  parents: ReadonlyMap<string, string | undefined>,
  id: string,
  ancestorId: string,
): boolean {
  if (id === ancestorId) return true;
  const seen = new Set<string>();
  let current: string | undefined = id;
  while (current && !seen.has(current)) {
    if (current === ancestorId) return true;
    seen.add(current);
    current = parents.get(current);
  }
  return false;
}

/**
 * Error when `draggedId` cannot be moved into `targetFolderId`.
 * Returns null when the move is allowed (including a same-parent no-op).
 */
export function moveIntoFolderError(
  roots: readonly BookmarkNode[],
  draggedId: string,
  targetFolderId: string,
): string | null {
  const nodes = nodeIndex(roots);
  const parents = parentIds(roots);
  const dragged = nodes.get(draggedId);
  if (!dragged) return t("error_bookmark_gone");
  if (isBookmarkTreeRootId(draggedId)) return t("error_root_cannot_move");

  const target = nodes.get(targetFolderId);
  if (!target || classify(target) !== "folder") return t("error_drop_onto_folder");
  if (!acceptsChildren(target)) return t("error_choose_folder_inside");

  if (draggedId === targetFolderId) return t("error_folder_into_self");
  if (isUnderAncestor(parents, targetFolderId, draggedId)) {
    return t("error_folder_into_descendant");
  }
  return null;
}

/** True when `draggedId` already has `parentId` as its parent. */
export function alreadyInFolder(
  roots: readonly BookmarkNode[],
  draggedId: string,
  parentId: string,
): boolean {
  const nodes = nodeIndex(roots);
  const parents = parentIds(roots);
  const dragged = nodes.get(draggedId);
  if (!dragged) return false;
  return (dragged.parentId ?? parents.get(draggedId)) === parentId;
}

function dialItemFromNode(node: BookmarkNode, parentTitle?: string): DialItem | null {
  const kind = classify(node);
  if (kind === "skip") return null;
  if (kind === "folder") {
    const title = folderLabel(node);
    return {
      id: node.id,
      title,
      kind: "folder",
      url: null,
      meta: parentTitle || t("meta_folder"),
      monogram: monogram(title),
      imageDataUrl: null,
    };
  }
  const href = node.url ? openableUrl(node.url) : null;
  const title = node.title.trim() || (href ? siteLabel(href) : "") || t("fallback_untitled");
  const site = href ? siteLabel(href) : t("meta_unavailable_link");
  return {
    id: node.id,
    title,
    kind: "link",
    url: href,
    meta: parentTitle ? `${site} · ${parentTitle}` : site,
    monogram: monogram(title),
    imageDataUrl: null,
  };
}

export function dialItems(folder: BookmarkNode | undefined): DialItem[] {
  if (!folder?.children) return [];
  const items: DialItem[] = [];
  for (const child of folder.children) {
    const item = dialItemFromNode(child);
    if (item) items.push(item);
  }
  return items;
}

/** Normalize a find-a-dial query; empty/whitespace → "". */
export function normalizeDialQuery(query: string): string {
  return query.trim().toLocaleLowerCase();
}

/** True when title or URL contains the normalized query (case-insensitive). */
export function dialMatchesQuery(node: BookmarkNode, normalizedQuery: string): boolean {
  if (!normalizedQuery) return false;
  const kind = classify(node);
  if (kind === "skip") return false;
  if (kind === "folder") {
    return folderLabel(node).toLocaleLowerCase().includes(normalizedQuery);
  }
  const href = node.url ? openableUrl(node.url) : null;
  const title = node.title.trim() || (href ? siteLabel(href) : "") || t("fallback_untitled");
  if (title.toLocaleLowerCase().includes(normalizedQuery)) return true;
  if (node.url && node.url.toLocaleLowerCase().includes(normalizedQuery)) return true;
  if (href && href.toLocaleLowerCase().includes(normalizedQuery)) return true;
  return false;
}

/**
 * Flatten matching dials from `folder` and its nested folders (titles + URLs).
 * Direct children keep normal meta; nested hits show the containing folder in meta.
 * Empty/whitespace query returns [] — callers should use `dialItems` instead.
 */
export function searchDialSubtree(
  folder: BookmarkNode | undefined,
  query: string,
): DialItem[] {
  const needle = normalizeDialQuery(query);
  if (!needle || !folder?.children) return [];
  const hits: DialItem[] = [];
  const walk = (nodes: readonly BookmarkNode[], parent: BookmarkNode, depth: number) => {
    const parentLabel = folderLabel(parent);
    for (const node of nodes) {
      const kind = classify(node);
      if (kind === "skip") continue;
      if (dialMatchesQuery(node, needle)) {
        const item = dialItemFromNode(node, depth > 0 ? parentLabel : undefined);
        if (item) hits.push(item);
      }
      if (kind === "folder" && node.children?.length) {
        walk(node.children, node, depth + 1);
      }
    }
  };
  walk(folder.children, folder, 0);
  return hits;
}

export type RefreshableThumbnailTarget = {
  id: string;
  url: string;
};

/**
 * Direct http(s) bookmark children of the open dial folder that can be
 * thumbnail-captured. Nested folder contents and folder tiles are skipped —
 * refresh is scoped to the currently open folder only.
 */
export function refreshableThumbnailTargets(
  folder: BookmarkNode | undefined,
): RefreshableThumbnailTarget[] {
  if (!folder?.children) return [];
  const targets: RefreshableThumbnailTarget[] = [];
  for (const child of folder.children) {
    if (classify(child) !== "link" || !child.url) continue;
    const pageUrl = openableUrl(child.url);
    if (!pageUrl || pageUrl.startsWith("file:")) continue;
    if (!pageUrl.startsWith("http:") && !pageUrl.startsWith("https:")) continue;
    targets.push({ id: child.id, url: pageUrl });
  }
  return targets;
}

/** Display-order helper: last bookmarks first when `reverseOrder` is on. Does not mutate the tree. */
export function orderDialItems<T>(items: readonly T[], reverseOrder: boolean): T[] {
  return reverseOrder ? items.slice().reverse() : [...items];
}

/**
 * Maps a visual drop (before/after a displayed tile) to the Chrome `beforeId`
 * expected by `reorderMoveIndex`. When the grid is reversed for display,
 * visual before/after flips relative to bookmark order.
 */
export function chromeBeforeIdFromDisplayDrop(
  targetId: string,
  afterInDisplay: boolean,
  displayItems: readonly { id: string }[],
  reverseOrder: boolean,
): string | null {
  if (!reverseOrder) {
    if (!afterInDisplay) return targetId;
    const index = displayItems.findIndex((entry) => entry.id === targetId);
    if (index < 0 || index >= displayItems.length - 1) return null;
    return displayItems[index + 1]?.id ?? null;
  }
  // Reversed: visual before target ⇒ chrome after target; visual after ⇒ chrome before.
  if (!afterInDisplay) {
    const index = displayItems.findIndex((entry) => entry.id === targetId);
    if (index <= 0) return null;
    return displayItems[index - 1]?.id ?? null;
  }
  return targetId;
}

export function breadcrumb(roots: readonly BookmarkNode[], rootId: string, currentId: string): Crumb[] {
  const nodes = nodeIndex(roots);
  const parents = parentIds(roots);
  const crumbs: Crumb[] = [];
  const seen = new Set<string>();
  let id: string | undefined = currentId;
  while (id && !seen.has(id)) {
    seen.add(id);
    const node = nodes.get(id);
    if (!node || classify(node) !== "folder") break;
    crumbs.push({
      id: node.id,
      title: folderLabel(node),
      isRoot: node.id === rootId,
    });
    if (node.id === rootId) break;
    id = parents.get(node.id);
  }
  crumbs.reverse();
  if (crumbs[0]?.id === rootId) return crumbs;
  const root = nodes.get(rootId);
  if (!root || classify(root) !== "folder") return [];
  return [{ id: root.id, title: folderLabel(root), isRoot: true }];
}
