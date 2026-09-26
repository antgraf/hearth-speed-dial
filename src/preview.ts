import type { BookmarkNode } from "./model.ts";
import { moveIntoFolderError } from "./model.ts";
import type { BookmarksApi } from "./browser.ts";
import { previewSettings, type SettingsApi } from "./settings.ts";

const sampleTree = (): BookmarkNode[] => [
  {
    id: "0",
    title: "",
    children: [
      {
        id: "1",
        title: "Bookmarks bar",
        children: [
          {
            id: "10",
            title: "News",
            children: [
              { id: "11", title: "Example", url: "https://example.com/" },
              { id: "12", title: "MDN", url: "https://developer.mozilla.org/" },
            ],
          },
          { id: "13", title: "Notes", url: "https://example.com/notes" },
        ],
      },
      {
        id: "2",
        title: "Other bookmarks",
        children: [{ id: "20", title: "Read later", children: [] }],
      },
      { id: "3", title: "Mobile bookmarks", children: [] },
    ],
  },
];

export const previewBanner =
  "Preview with sample bookmarks. After you load the extension, a new tab uses your Chrome folders.";

const PREVIEW_TREE_KEY = "hearth.previewTree";
const PREVIEW_TREE_VERSION = 1;

export function previewPorts(): { bookmarks: BookmarksApi; settings: SettingsApi } {
  const tree = loadPreviewTree();
  let nextId = nextPreviewId(tree);
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) listener();
  };

  const bookmarks: BookmarksApi = {
    async getTree() {
      return structuredClone(tree);
    },
    async createFolder(parentId, title) {
      return addChild(parentId, { title, children: [] });
    },
    async createBookmark(parentId, title, url) {
      return addChild(parentId, { title, url });
    },
    async update(id, changes) {
      const node = findNode(tree, id);
      if (!node) throw new Error("That bookmark is no longer available.");
      if (changes.title !== undefined) node.title = changes.title;
      if (changes.url !== undefined) {
        if (node.children) throw new Error("Folders do not have an address.");
        node.url = changes.url;
      }
      savePreviewTree(tree);
      return structuredClone(node);
    },
    async move(id, destination) {
      if (id === "0") throw new Error("The bookmarks root cannot be moved.");
      const located = locateNode(tree, id);
      if (!located) throw new Error("That bookmark is no longer available.");
      const { node, siblings: fromSiblings, index: fromIndex } = located;
      const parentId = destination.parentId ?? node.parentId;
      if (parentId === undefined) throw new Error("That bookmark is no longer available.");
      const sameParent = parentId === node.parentId;
      if (!sameParent) {
        const illegal = moveIntoFolderError(tree, id, parentId);
        if (illegal) throw new Error(illegal);
      }
      const toParent = sameParent ? null : findFolder(tree, parentId);
      if (!sameParent && !toParent) throw new Error("That folder is no longer available.");
      const toSiblings = sameParent ? fromSiblings : (toParent!.children ??= []);
      const toIndex = destination.index;

      if (sameParent && toIndex === undefined) {
        if (fromIndex === fromSiblings.length - 1) return structuredClone(node);
        fromSiblings.splice(fromIndex, 1);
        fromSiblings.push(node);
      } else if (sameParent) {
        if (toIndex === undefined || !Number.isInteger(toIndex) || toIndex < 0) {
          throw new Error("That bookmark position is not valid.");
        }
        // Mirror Chromium BookmarkModel::Move for same-parent moves.
        if (toIndex === fromIndex || toIndex === fromIndex + 1) return structuredClone(node);
        let insertAt = toIndex;
        if (insertAt > fromIndex) insertAt -= 1;
        fromSiblings.splice(fromIndex, 1);
        fromSiblings.splice(Math.min(insertAt, fromSiblings.length), 0, node);
      } else {
        fromSiblings.splice(fromIndex, 1);
        node.parentId = parentId;
        const insertAt =
          toIndex === undefined || !Number.isInteger(toIndex) || toIndex < 0
            ? toSiblings.length
            : Math.min(toIndex, toSiblings.length);
        toSiblings.splice(insertAt, 0, node);
      }
      savePreviewTree(tree);
      notify();
      return structuredClone(node);
    },
    async remove(id) {
      if (id === "0") throw new Error("The bookmarks root cannot be deleted.");
      const removed = removeNode(tree, id);
      if (!removed) throw new Error("That bookmark is no longer available.");
      savePreviewTree(tree);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  function addChild(parentId: string, fields: { title: string; url?: string; children?: BookmarkNode[] }): BookmarkNode {
    const parent = findFolder(tree, parentId);
    if (!parent) throw new Error("That folder is no longer available.");
    const node: BookmarkNode = { id: `preview-${nextId}`, parentId, ...fields };
    nextId += 1;
    parent.children = [...(parent.children ?? []), node];
    savePreviewTree(tree);
    return structuredClone(node);
  }

  return { bookmarks, settings: previewSettings() };
}

function loadPreviewTree(): BookmarkNode[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(PREVIEW_TREE_KEY) ?? "null");
    if (!parsed || typeof parsed !== "object" || !("tree" in parsed) || !("version" in parsed)) return sampleTree();
    if (parsed.version !== PREVIEW_TREE_VERSION || !Array.isArray(parsed.tree)) return sampleTree();
    return parsed.tree as BookmarkNode[];
  } catch {
    return sampleTree();
  }
}

function savePreviewTree(tree: readonly BookmarkNode[]): void {
  localStorage.setItem(PREVIEW_TREE_KEY, JSON.stringify({ version: PREVIEW_TREE_VERSION, tree }));
}

function nextPreviewId(nodes: readonly BookmarkNode[]): number {
  let max = 100;
  const walk = (items: readonly BookmarkNode[]) => {
    for (const node of items) {
      const match = /^preview-(\d+)$/.exec(node.id);
      if (match) max = Math.max(max, Number(match[1]) + 1);
      if (node.children) walk(node.children);
    }
  };
  walk(nodes);
  return max;
}

function findNode(nodes: readonly BookmarkNode[], id: string): BookmarkNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

function findFolder(nodes: readonly BookmarkNode[], id: string): BookmarkNode | null {
  const node = findNode(nodes, id);
  if (!node || typeof node.url === "string") return null;
  return node;
}

function locateNode(
  nodes: BookmarkNode[],
  id: string,
): { node: BookmarkNode; siblings: BookmarkNode[]; index: number } | null {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (!node) continue;
    if (node.id === id) return { node, siblings: nodes, index };
    if (node.children) {
      const found = locateNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

function removeNode(nodes: BookmarkNode[], id: string): boolean {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (!node) continue;
    if (node.id === id) {
      nodes.splice(index, 1);
      return true;
    }
    if (node.children && removeNode(node.children, id)) return true;
  }
  return false;
}
