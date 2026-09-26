import type { BookmarksApi } from "./browser.ts";
import {
  acceptsChildren,
  dialFolderOptions,
  folderName,
  nodeIndex,
  parseAddPageFields,
  type BookmarkNode,
  type FolderOption,
} from "./model.ts";

export type AddPorts = {
  bookmarks: BookmarksApi;
  search: string;
  close: () => void;
};

type AddState = {
  status: "loading" | "ready" | "invalid" | "failed";
  error: string | null;
  url: string;
  title: string;
  folders: FolderOption[];
  parentId: string | null;
  saving: boolean;
  done: boolean;
};

export function startAdd(host: HTMLElement, ports: AddPorts): () => void {
  const parsed = parseAddPageFields(ports.search);
  const state: AddState = {
    status: parsed ? "loading" : "invalid",
    error: parsed ? null : "This page cannot be added as a dial.",
    url: parsed?.url ?? "",
    title: parsed?.title ?? "",
    folders: [],
    parentId: null,
    saving: false,
    done: false,
  };

  const draw = () => {
    renderAdd(host, state, {
      setTitle: (title) => {
        if (state.saving || state.done) return;
        state.title = title;
        state.error = null;
        draw();
      },
      chooseFolder: (id) => {
        if (state.saving || state.done) return;
        state.parentId = id;
        state.error = null;
        draw();
      },
      submit: () => {
        void save();
      },
      cancel: () => {
        ports.close();
      },
    });
  };

  const load = async () => {
    if (state.status === "invalid") {
      draw();
      return;
    }
    try {
      const tree = await ports.bookmarks.getTree();
      state.folders = dialFolderOptions(tree);
      state.status = "ready";
      state.error = null;
      if (state.folders.length === 0) {
        state.error = "No bookmark folders are available yet.";
      }
    } catch {
      state.status = "failed";
      state.error = "Could not load bookmark folders.";
    }
    draw();
  };

  const save = async () => {
    if (state.saving || state.done || state.status !== "ready") return;
    const title = folderName(state.title);
    if (!title) {
      state.error = "Enter a name.";
      draw();
      return;
    }
    if (!state.parentId) {
      state.error = "Choose a folder.";
      draw();
      return;
    }
    let tree: BookmarkNode[];
    try {
      tree = await ports.bookmarks.getTree();
    } catch {
      state.error = "Could not load bookmark folders.";
      draw();
      return;
    }
    const parent = nodeIndex(tree).get(state.parentId);
    if (!parent || !acceptsChildren(parent)) {
      state.error = "Choose a folder inside Bookmarks.";
      state.folders = dialFolderOptions(tree);
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
      state.error = "Could not add that bookmark.";
      draw();
    }
  };

  void load();
  return () => {};
}

type AddHandlers = {
  setTitle: (title: string) => void;
  chooseFolder: (id: string) => void;
  submit: () => void;
  cancel: () => void;
};

function renderAdd(host: HTMLElement, state: AddState, handlers: AddHandlers): void {
  host.replaceChildren();
  const frame = el("div", "frame add-frame");
  host.append(frame);

  const brand = el("p", "brand");
  brand.textContent = "Hearth";
  frame.append(brand);

  const heading = el("h1");
  heading.textContent = state.done ? "Added" : "Add to Hearth";
  frame.append(heading);

  if (state.status === "loading") {
    const note = el("p", "quiet");
    note.textContent = "Loading folders…";
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

  const titleLabel = el("label");
  titleLabel.textContent = "Name";
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
  urlLabel.textContent = "Address";
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
  legend.textContent = "Folder";
  folderField.append(legend);

  if (state.folders.length === 0) {
    const empty = el("p", "quiet");
    empty.textContent = "No folders available.";
    folderField.append(empty);
  } else {
    const list = el("div", "folder-list");
    for (const folder of state.folders) {
      const option = el("label", "folder-option");
      option.style.setProperty("--depth", String(folder.depth));
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "parentId";
      radio.value = folder.id;
      radio.checked = state.parentId === folder.id;
      radio.disabled = state.saving || state.done;
      radio.addEventListener("change", () => {
        if (radio.checked) handlers.chooseFolder(folder.id);
      });
      const name = el("span");
      name.textContent = folder.title;
      option.append(radio, name);
      list.append(option);
    }
    folderField.append(list);
  }
  form.append(folderField);

  if (state.error) form.append(errorLine(state.error));

  const actions = el("div", "add-actions");
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "primary";
  submit.textContent = state.saving ? "Adding…" : "Add bookmark";
  submit.disabled = state.saving || state.done || !state.parentId || state.folders.length === 0;
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "quiet";
  cancel.textContent = "Cancel";
  cancel.disabled = state.saving;
  cancel.addEventListener("click", () => handlers.cancel());
  actions.append(submit, cancel);
  form.append(actions);

  frame.append(form);
  if (!state.saving && !state.done) titleInput.focus();
}

function cancelButton(handlers: AddHandlers): HTMLButtonElement {
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "quiet";
  cancel.textContent = "Close";
  cancel.addEventListener("click", () => handlers.cancel());
  return cancel;
}

function errorLine(message: string): HTMLParagraphElement {
  const error = el("p", "error");
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
