import type { BookmarksApi } from "./browser.ts";
import { t } from "./i18n.ts";
import {
  acceptsChildren,
  dialFolderTree,
  flattenFolderTree,
  folderName,
  nodeIndex,
  parseAddPageFields,
  type BookmarkNode,
  type FolderTreeNode,
} from "./model.ts";
import type { SettingsApi } from "./settings.ts";
import { applyThemeToDocument } from "./theme.ts";

export type AddPorts = {
  bookmarks: BookmarksApi;
  settings: SettingsApi;
  search: string;
  close: () => void;
};

type AddState = {
  status: "loading" | "ready" | "invalid" | "failed";
  error: string | null;
  url: string;
  title: string;
  folderTree: FolderTreeNode[];
  /** Folder ids with children that are expanded in the picker. */
  expandedIds: ReadonlySet<string>;
  parentId: string | null;
  saving: boolean;
  done: boolean;
};

export function startAdd(host: HTMLElement, ports: AddPorts): () => void {
  const parsed = parseAddPageFields(ports.search);
  const state: AddState = {
    status: parsed ? "loading" : "invalid",
    error: parsed ? null : t("add_invalid"),
    url: parsed?.url ?? "",
    title: parsed?.title ?? "",
    folderTree: [],
    expandedIds: new Set(),
    parentId: null,
    saving: false,
    done: false,
  };
  /** Autofocus the name field once when the form becomes ready; restore focus after redraws. */
  let titleFocused = false;
  let restoreFocus: "title" | "folder" | "toggle" | null = null;
  let restoreToggleId: string | null = null;

  const draw = () => {
    renderAdd(host, state, {
      setTitle: (title) => {
        if (state.saving || state.done) return;
        state.title = title;
        if (state.error) {
          state.error = null;
          restoreFocus = "title";
          draw();
        }
      },
      chooseFolder: (id) => {
        if (state.saving || state.done) return;
        state.parentId = id;
        state.error = null;
        restoreFocus = "folder";
        draw();
      },
      toggleFolder: (id) => {
        if (state.saving || state.done) return;
        const next = new Set(state.expandedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        state.expandedIds = next;
        restoreFocus = "toggle";
        restoreToggleId = id;
        draw();
      },
      submit: () => {
        void save();
      },
      cancel: () => {
        ports.close();
      },
    }, {
      focusTitle: !titleFocused && state.status === "ready" && !state.saving && !state.done,
      restoreFocus,
      restoreToggleId,
      onTitleFocused: () => {
        titleFocused = true;
        restoreFocus = null;
        restoreToggleId = null;
      },
      onFocusRestored: () => {
        restoreFocus = null;
        restoreToggleId = null;
      },
    });
  };

  const applyTree = (tree: BookmarkNode[], defaultFolderId: string | null) => {
    state.folderTree = dialFolderTree(tree, defaultFolderId);
    state.expandedIds = new Set();
    if (state.parentId && !flattenFolderTree(state.folderTree).some((f) => f.id === state.parentId)) {
      state.parentId = null;
    }
  };

  const applyTheme = async () => {
    if (typeof document === "undefined") return;
    try {
      const [layout, backgroundImage] = await Promise.all([
        ports.settings.getLayout(),
        ports.settings.getThemeBackground(),
      ]);
      applyThemeToDocument(document.documentElement, layout.theme, { backgroundImage });
    } catch {
      // Keep the Add window usable if theme prefs fail to load.
    }
  };

  const load = async () => {
    await applyTheme();
    if (state.status === "invalid") {
      draw();
      return;
    }
    try {
      const [tree, defaultFolderId] = await Promise.all([
        ports.bookmarks.getTree(),
        ports.settings.getDefaultFolderId(),
      ]);
      applyTree(tree, defaultFolderId);
      state.status = "ready";
      state.error = null;
      if (state.folderTree.length === 0) {
        state.error = t("add_no_folders_error");
      }
    } catch {
      state.status = "failed";
      state.error = t("add_load_failed");
    }
    draw();
  };

  const save = async () => {
    if (state.saving || state.done || state.status !== "ready") return;
    const title = folderName(state.title);
    if (!title) {
      state.error = t("add_enter_name");
      draw();
      return;
    }
    if (!state.parentId) {
      state.error = t("add_choose_folder");
      draw();
      return;
    }
    let tree: BookmarkNode[];
    let defaultFolderId: string | null;
    try {
      [tree, defaultFolderId] = await Promise.all([
        ports.bookmarks.getTree(),
        ports.settings.getDefaultFolderId(),
      ]);
    } catch {
      state.error = t("add_load_failed");
      draw();
      return;
    }
    const parent = nodeIndex(tree).get(state.parentId);
    if (!parent || !acceptsChildren(parent)) {
      state.error = t("error_choose_folder_inside");
      applyTree(tree, defaultFolderId);
      state.parentId = null;
      draw();
      return;
    }
    state.saving = true;
    state.error = null;
    draw();
    try {
      await ports.bookmarks.createBookmark(parent.id, title, state.url);
      state.done = true;
      state.saving = false;
      draw();
      ports.close();
    } catch {
      state.saving = false;
      state.error = t("add_create_failed");
      draw();
    }
  };

  void load();
  return () => {};
}

type AddHandlers = {
  setTitle: (title: string) => void;
  chooseFolder: (id: string) => void;
  toggleFolder: (id: string) => void;
  submit: () => void;
  cancel: () => void;
};

type AddFocus = {
  focusTitle: boolean;
  restoreFocus: "title" | "folder" | "toggle" | null;
  restoreToggleId: string | null;
  onTitleFocused: () => void;
  onFocusRestored: () => void;
};

function renderAdd(host: HTMLElement, state: AddState, handlers: AddHandlers, focus: AddFocus): void {
  host.replaceChildren();
  const frame = el("div", "frame add-frame");
  host.append(frame);

  const brand = el("p", "brand");
  brand.textContent = t("brand_name");
  frame.append(brand);

  const heading = el("h1");
  heading.textContent = state.done ? t("add_heading_done") : t("add_heading");
  frame.append(heading);

  if (state.status === "loading") {
    const note = el("p", "quiet");
    note.textContent = t("add_loading");
    frame.append(note);
    return;
  }

  if (state.status === "invalid" || state.status === "failed") {
    if (state.error) frame.append(errorLine(state.error));
    frame.append(cancelButton(handlers));
    return;
  }

  const form = el("form", "composer add-form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    handlers.submit();
  });
  form.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || state.saving) return;
    event.preventDefault();
    handlers.cancel();
  });

  const titleLabel = el("label");
  titleLabel.textContent = t("field_name");
  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.name = "title";
  titleInput.value = state.title;
  titleInput.required = true;
  titleInput.autocomplete = "off";
  titleInput.disabled = state.saving || state.done;
  titleInput.addEventListener("input", () => handlers.setTitle(titleInput.value));
  titleLabel.append(titleInput);
  form.append(titleLabel);

  const urlLabel = el("label");
  urlLabel.textContent = t("field_address");
  const urlInput = document.createElement("input");
  urlInput.type = "url";
  urlInput.name = "url";
  urlInput.value = state.url;
  urlInput.readOnly = true;
  urlInput.tabIndex = -1;
  urlLabel.append(urlInput);
  form.append(urlLabel);

  const folderField = el("fieldset", "folder-picker");
  const legend = el("legend");
  legend.textContent = t("field_folder");
  folderField.append(legend);

  if (state.folderTree.length === 0) {
    const empty = el("p", "quiet");
    empty.textContent = t("add_no_folders_empty");
    folderField.append(empty);
  } else {
    const list = el("div", "folder-tree");
    list.setAttribute("role", "tree");
    list.setAttribute("aria-label", t("aria_destination_folder"));
    for (const node of state.folderTree) {
      list.append(renderFolderTreeNode(node, state, handlers));
    }
    folderField.append(list);
  }
  form.append(folderField);

  if (state.error) form.append(errorLine(state.error));

  const actions = el("div", "add-actions");
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "primary";
  submit.textContent = state.saving ? t("btn_adding") : t("btn_add_bookmark");
  submit.disabled = state.saving || state.done || !state.parentId || state.folderTree.length === 0;
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "quiet";
  cancel.textContent = t("btn_cancel");
  cancel.disabled = state.saving;
  cancel.addEventListener("click", () => handlers.cancel());
  actions.append(submit, cancel);
  form.append(actions);

  frame.append(form);
  if (focus.focusTitle) {
    titleInput.focus();
    focus.onTitleFocused();
  } else if (focus.restoreFocus === "title") {
    titleInput.focus();
    focus.onFocusRestored();
  } else if (focus.restoreFocus === "folder" && state.parentId) {
    const selected = form.querySelector(`input[name="parentId"][value="${CSS.escape(state.parentId)}"]`);
    if (selected instanceof HTMLInputElement) selected.focus();
    focus.onFocusRestored();
  } else if (focus.restoreFocus === "toggle" && focus.restoreToggleId) {
    const toggle = form.querySelector(`button[data-folder-toggle="${CSS.escape(focus.restoreToggleId)}"]`);
    if (toggle instanceof HTMLButtonElement) toggle.focus();
    focus.onFocusRestored();
  }
}

function renderFolderTreeNode(
  node: FolderTreeNode,
  state: AddState,
  handlers: AddHandlers,
): HTMLElement {
  const item = el("div", "folder-tree-node");
  item.setAttribute("role", "treeitem");
  item.setAttribute("aria-selected", state.parentId === node.id ? "true" : "false");
  const hasChildren = node.children.length > 0;
  const expanded = hasChildren && state.expandedIds.has(node.id);
  if (hasChildren) item.setAttribute("aria-expanded", expanded ? "true" : "false");

  const row = el("div", "folder-tree-row");
  if (hasChildren) {
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "folder-tree-toggle";
    toggle.dataset.folderToggle = node.id;
    toggle.setAttribute("aria-label", expanded ? t("aria_collapse_folder", node.title) : t("aria_expand_folder", node.title));
    toggle.textContent = expanded ? "▾" : "▸";
    toggle.disabled = state.saving || state.done;
    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      handlers.toggleFolder(node.id);
    });
    row.append(toggle);
  } else {
    const spacer = el("span", "folder-tree-spacer");
    spacer.setAttribute("aria-hidden", "true");
    row.append(spacer);
  }

  const option = el("label", "folder-option");
  const radio = document.createElement("input");
  radio.type = "radio";
  radio.name = "parentId";
  radio.value = node.id;
  radio.checked = state.parentId === node.id;
  radio.disabled = state.saving || state.done;
  radio.addEventListener("change", () => {
    if (radio.checked) handlers.chooseFolder(node.id);
  });
  const name = el("span");
  name.textContent = node.title;
  option.append(radio, name);
  row.append(option);
  item.append(row);

  if (hasChildren && expanded) {
    const group = el("div", "folder-tree-children");
    group.setAttribute("role", "group");
    for (const child of node.children) {
      group.append(renderFolderTreeNode(child, state, handlers));
    }
    item.append(group);
  }

  return item;
}

function cancelButton(handlers: AddHandlers): HTMLButtonElement {
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "quiet";
  cancel.textContent = t("btn_close");
  cancel.addEventListener("click", () => handlers.cancel());
  return cancel;
}

function errorLine(message: string): HTMLParagraphElement {
  const error = el("p", "error");
  error.setAttribute("role", "alert");
  error.textContent = message;
  return error;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}
