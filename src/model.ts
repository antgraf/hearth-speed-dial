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
