import {
  acceptsChildren,
  bookmarkRoot,
  breadcrumb,
  classify,
  dialItems,
  nodeIndex,
  type BookmarkNode,
  type Crumb,
  type DialItem,
} from "./model.ts";
import type { LayoutSettings } from "./settings.ts";

export type CreateKind = "folder" | "bookmark";

export type CreateForm = {
  kind: CreateKind;
  title: string;
  url: string;
};

export type AppState = {
  banner: string | null;
  status: "loading" | "ready" | "failed";
  error: string | null;
  tree: BookmarkNode[];
  currentId: string | null;
  form: CreateForm | null;
  saving: boolean;
  layout: LayoutSettings;
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
      form: CreateForm | null;
      saving: boolean;
      layout: LayoutSettings;
    };

function folderNode(tree: readonly BookmarkNode[], id: string | null): BookmarkNode | null {
  if (!id) return null;
  const node = nodeIndex(tree).get(id);
  if (!node || classify(node) !== "folder") return null;
  return node;
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
  const items = dialItems(current);
  return {
    name: "grid",
    banner: state.banner,
    crumbs: breadcrumb(state.tree, root.id, current.id),
    items,
    empty: items.length === 0 ? "This folder has no bookmarks yet." : null,
    error: state.error,
    canCreate: acceptsChildren(current),
    form: state.form,
    saving: state.saving,
    layout: state.layout,
  };
}