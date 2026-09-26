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
  title: string;
};

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
  return kind === "folder" ? "Untitled folder" : "Untitled";
}

export function folderLabel(node: { id: string; title: string }): string {
  if (node.id === "0") return "Bookmarks";
  return displayTitle(node.title, "folder");
}

export function bookmarkRoot(roots: readonly BookmarkNode[]): BookmarkNode | null {
  return roots.find((node) => node.id === "0" && classify(node) === "folder") ?? roots.find((node) => classify(node) === "folder") ?? null;
}

export function acceptsChildren(node: BookmarkNode): boolean {
  return classify(node) === "folder" && node.id !== "0";
}

export type FolderOption = {
  id: string;
  title: string;
  depth: number;
};

/** Folders that can receive a new dial, depth-first, excluding the Chrome root. */
export function dialFolderOptions(roots: readonly BookmarkNode[]): FolderOption[] {
  const options: FolderOption[] = [];
  const walk = (nodes: readonly BookmarkNode[], depth: number) => {
    for (const node of nodes) {
      if (classify(node) !== "folder") continue;
      if (acceptsChildren(node)) {
        options.push({ id: node.id, title: folderLabel(node), depth });
      }
      if (node.children?.length) {
        const nextDepth = acceptsChildren(node) ? depth + 1 : depth;
        walk(node.children, nextDepth);
      }
    }
  };
  walk(roots, 0);
  return options;
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
  const title = (params.get("title") ?? "").trim() || siteLabel(url) || "Untitled";
  return { url, title };
}

/**
 * Build the add-page query string from a context-menu click.
 * Returns null when there is no openable page or link URL.
 */
export function addPageQuery(info: {
  linkUrl?: string;
  pageUrl?: string;
  selectionText?: string;
}): string | null {
  const rawUrl = info.linkUrl || info.pageUrl;
  if (!rawUrl) return null;
  const url = bookmarkUrl(rawUrl);
  if (!url) return null;
  const params = new URLSearchParams();
  params.set("url", url);
  const title = info.selectionText?.trim();
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
  if (!dragged) return "That bookmark is no longer available.";
  if (draggedId === "0") return "The bookmarks root cannot be moved.";

  const target = nodes.get(targetFolderId);
  if (!target || classify(target) !== "folder") return "Drop onto a folder.";
  if (!acceptsChildren(target)) return "Choose a folder inside Bookmarks.";

  if (draggedId === targetFolderId) return "A folder cannot be moved into itself.";
  if (isUnderAncestor(parents, targetFolderId, draggedId)) {
    return "A folder cannot be moved into one of its subfolders.";
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

export function dialItems(folder: BookmarkNode | undefined): DialItem[] {
  if (!folder?.children) return [];
  const items: DialItem[] = [];
  for (const child of folder.children) {
    const kind = classify(child);
    if (kind === "skip") continue;
    if (kind === "folder") {
      const title = folderLabel(child);
      items.push({
        id: child.id,
        title,
        kind: "folder",
        url: null,
        meta: "Folder",
        monogram: monogram(title),
        imageDataUrl: null,
      });
      continue;
    }
    const href = child.url ? openableUrl(child.url) : null;
    const title = child.title.trim() || (href ? siteLabel(href) : "") || "Untitled";
    items.push({
      id: child.id,
      title,
      kind: "link",
      url: href,
      meta: href ? siteLabel(href) : "Unavailable link",
      monogram: monogram(title),
      imageDataUrl: null,
    });
  }
  return items;
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
    crumbs.push({ id: node.id, title: folderLabel(node) });
    if (node.id === rootId) break;
    id = parents.get(node.id);
  }
  crumbs.reverse();
  if (crumbs[0]?.id === rootId) return crumbs;
  const root = nodes.get(rootId);
  if (!root || classify(root) !== "folder") return [];
  return [{ id: root.id, title: folderLabel(root) }];
}
