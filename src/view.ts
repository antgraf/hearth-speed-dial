import type { CreateKind, ViewModel } from "./present.ts";
import { LAYOUT_LIMITS, type LayoutSettings } from "./settings.ts";
import type { DialItem } from "./model.ts";

export type ViewActions = {
  openFolder(id: string): void;
  goToFolder(id: string): void;
  beginCreate(kind: CreateKind): void;
  beginEdit(id: string): void;
  requestDelete(id: string): void;
  cancelForm(): void;
  submitForm(input: { title: string; url: string }): void;
  setLayout(layout: LayoutSettings): void;
  reorderDial(draggedId: string, beforeId: string | null): void;
  moveDialInto(draggedId: string, parentId: string): void;
  attachImage(id: string, file: File): void;
  clearImage(id: string): void;
};

export function render(host: HTMLElement, view: ViewModel, actions: ViewActions): void {
  host.replaceChildren();
  if (view.banner) host.append(note(view.banner, "preview"));

  const frame = document.createElement("div");
  frame.className = "frame";
  host.append(frame);

  if (view.name === "loading") {
    frame.append(paragraph("Loading bookmarks…"));
    return;
  }
  if (view.name === "unavailable") {
    frame.append(brand(), heading("Bookmarks"), paragraph(view.message, "error"));
    return;
  }

  frame.append(grid(view, actions));
}

function grid(view: Extract<ViewModel, { name: "grid" }>, actions: ViewActions): HTMLElement {
  const section = document.createElement("section");
  section.className = "dial";
  section.style.setProperty("--columns", String(view.layout.columns));
  section.style.setProperty("--tile-size", `${view.layout.tileSize}px`);

  const header = document.createElement("header");
  header.className = "top";
  header.append(brand());

  const nav = document.createElement("nav");
  nav.className = "crumbs";
  nav.setAttribute("aria-label", "Folder");
  view.crumbs.forEach((crumb, index) => {
    if (index > 0) {
      const separator = document.createElement("span");
      separator.className = "sep";
      separator.setAttribute("aria-hidden", "true");
      separator.textContent = "/";
      nav.append(separator);
    }
    const last = index === view.crumbs.length - 1;
    if (last) {
      const current = document.createElement("div");
      current.className = "current";
      const title = document.createElement("h1");
      title.textContent = crumb.title;
      current.append(title);
      if (view.canRenameCurrent) {
        current.append(renameButton(() => actions.beginEdit(crumb.id), view.saving));
      }
      if (view.canDeleteCurrent) {
        current.append(deleteButton(() => actions.requestDelete(crumb.id), view.saving));
      }
      nav.append(current);
      return;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "crumb";
    button.textContent = crumb.title;
    button.addEventListener("click", () => actions.goToFolder(crumb.id));
    if (!view.saving) bindMoveIntoTarget(button, crumb.id, actions);
    nav.append(button);
  });
  header.append(nav);
  section.append(header);
  section.append(layoutControls(view.layout, actions));

  if (view.error) section.append(paragraph(view.error, "error"));
  if (view.form) section.append(composer(view, actions));
  if (view.empty) section.append(paragraph(view.empty, "empty"));

  const list = document.createElement("ul");
  list.className = "grid";
  const canDrag = !view.saving && view.items.length > 0;
  for (const item of view.items) {
    const entry = document.createElement("li");
    let tile: HTMLElement;
    let suppressClick = false;
    if (item.kind === "link" && item.url) {
      const link = document.createElement("a");
      link.href = item.url;
      tile = link;
    } else if (item.kind === "folder") {
      const button = document.createElement("button");
      button.type = "button";
      button.addEventListener("click", (event) => {
        if (suppressClick) {
          event.preventDefault();
          event.stopPropagation();
          suppressClick = false;
          return;
        }
        actions.openFolder(item.id);
      });
      tile = button;
    } else {
      tile = document.createElement("div");
    }
    tile.className = "tile";
    if (item.kind === "link" && item.url) {
      tile.addEventListener("click", (event) => {
        if (!suppressClick) return;
        event.preventDefault();
        event.stopPropagation();
        suppressClick = false;
      });
    }
    tile.append(tileMark(item), labeled(item.title, item.meta));
    entry.append(tile);
    entry.append(tileActions(item, actions, view.saving));
    if (canDrag) {
      bindDialDrag(entry, item, view.items, actions, () => {
        suppressClick = true;
      });
    }
    list.append(entry);
  }
  if (view.canCreate) {
    list.append(actionTile("folder", "New folder", () => actions.beginCreate("folder")));
    list.append(actionTile("bookmark", "New bookmark", () => actions.beginCreate("bookmark")));
  }
  if (view.items.length > 0 || view.canCreate) section.append(list);
  return section;
}

function isDialDrag(event: DragEvent): boolean {
  return Boolean(
    event.dataTransfer?.types.includes("text/hearth-dial-id") ||
      event.dataTransfer?.types.includes("text/plain"),
  );
}

function dialDragId(event: DragEvent): string {
  return event.dataTransfer?.getData("text/hearth-dial-id") || event.dataTransfer?.getData("text/plain") || "";
}

function clearDragMarks(root: ParentNode | null | undefined): void {
  for (const marked of root?.querySelectorAll(".drag-before, .drag-after, .drag-into") ?? []) {
    marked.classList.remove("drag-before", "drag-after", "drag-into");
  }
}

function folderDropZone(clientX: number, rect: DOMRect): "before" | "into" | "after" {
  const offset = clientX - rect.left;
  const edge = Math.min(28, rect.width / 3);
  if (offset < edge) return "before";
  if (offset > rect.width - edge) return "after";
  return "into";
}

function bindMoveIntoTarget(target: HTMLElement, parentId: string, actions: ViewActions): void {
  target.addEventListener("dragover", (event) => {
    if (!isDialDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    target.classList.add("drag-into");
  });
  target.addEventListener("dragleave", () => {
    target.classList.remove("drag-into");
  });
  target.addEventListener("drop", (event) => {
    event.preventDefault();
    event.stopPropagation();
    target.classList.remove("drag-into");
    const draggedId = dialDragId(event);
    if (!draggedId) return;
    actions.moveDialInto(draggedId, parentId);
  });
}

function bindDialDrag(
  entry: HTMLLIElement,
  item: DialItem,
  items: readonly DialItem[],
  actions: ViewActions,
  onDragged: () => void,
): void {
  entry.draggable = true;
  entry.classList.add("reorderable");
  entry.addEventListener("dragstart", (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest(".tile-actions")) {
      event.preventDefault();
      return;
    }
    event.dataTransfer?.setData("text/hearth-dial-id", item.id);
    event.dataTransfer?.setData("text/plain", item.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    entry.classList.add("dragging");
  });
  entry.addEventListener("dragend", () => {
    entry.classList.remove("dragging");
    clearDragMarks(entry.parentElement);
    clearDragMarks(entry.ownerDocument);
  });
  entry.addEventListener("dragover", (event) => {
    if (!isDialDrag(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    const rect = entry.getBoundingClientRect();
    entry.classList.remove("drag-before", "drag-after", "drag-into");
    if (item.kind === "folder") {
      const zone = folderDropZone(event.clientX, rect);
      if (zone === "into") entry.classList.add("drag-into");
      else entry.classList.add(zone === "before" ? "drag-before" : "drag-after");
      return;
    }
    const after = event.clientX > rect.left + rect.width / 2;
    entry.classList.toggle("drag-before", !after);
    entry.classList.toggle("drag-after", after);
  });
  entry.addEventListener("dragleave", () => {
    entry.classList.remove("drag-before", "drag-after", "drag-into");
  });
  entry.addEventListener("drop", (event) => {
    event.preventDefault();
    entry.classList.remove("drag-before", "drag-after", "drag-into");
    const draggedId = dialDragId(event);
    if (!draggedId || draggedId === item.id) return;
    const rect = entry.getBoundingClientRect();
    if (item.kind === "folder") {
      const zone = folderDropZone(event.clientX, rect);
      if (zone === "into") {
        onDragged();
        actions.moveDialInto(draggedId, item.id);
        return;
      }
      const beforeId = dropBeforeId(item.id, zone === "after", items);
      onDragged();
      actions.reorderDial(draggedId, beforeId);
      return;
    }
    const after = event.clientX > rect.left + rect.width / 2;
    const beforeId = dropBeforeId(item.id, after, items);
    onDragged();
    actions.reorderDial(draggedId, beforeId);
  });
}

function dropBeforeId(targetId: string, after: boolean, items: readonly { id: string }[]): string | null {
  if (!after) return targetId;
  const index = items.findIndex((entry) => entry.id === targetId);
  if (index < 0 || index >= items.length - 1) return null;
  return items[index + 1]?.id ?? null;
}

function layoutControls(layout: LayoutSettings, actions: ViewActions): HTMLElement {
  const row = document.createElement("div");
  row.className = "layout";

  const columns = document.createElement("input");
  columns.type = "number";
  columns.name = "columns";
  columns.min = String(LAYOUT_LIMITS.columns.min);
  columns.max = String(LAYOUT_LIMITS.columns.max);
  columns.step = "1";
  columns.value = String(layout.columns);
  columns.setAttribute("aria-label", "Columns");
  columns.addEventListener("change", () => {
    actions.setLayout({
      columns: Number(columns.value),
      tileSize: layout.tileSize,
    });
  });

  const tileSize = document.createElement("input");
  tileSize.type = "range";
  tileSize.name = "tileSize";
  tileSize.min = String(LAYOUT_LIMITS.tileSize.min);
  tileSize.max = String(LAYOUT_LIMITS.tileSize.max);
  tileSize.step = "1";
  tileSize.value = String(layout.tileSize);
  tileSize.setAttribute("aria-label", "Tile size");
  tileSize.addEventListener("change", () => {
    actions.setLayout({
      columns: layout.columns,
      tileSize: Number(tileSize.value),
    });
  });

  row.append(
    labeledControl("Columns", columns),
    labeledControl("Tile size", tileSize),
  );
  return row;
}

function labeledControl(labelText: string, control: HTMLInputElement): HTMLLabelElement {
  const label = document.createElement("label");
  const caption = document.createElement("span");
  caption.textContent = labelText;
  label.append(caption, control);
  return label;
}

function composer(view: Extract<ViewModel, { name: "grid" }>, actions: ViewActions): HTMLFormElement {
  const form = view.form;
  if (!form) throw new Error("Missing form");
  const editing = form.mode === "edit";
  const composerForm = document.createElement("form");
  composerForm.className = "composer";
  composerForm.append(field(form.kind === "folder" ? "Folder name" : "Name", "title", form.title, view.saving));
  if (form.kind === "bookmark") {
    composerForm.append(field("Address", "url", form.url, view.saving));
  }
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "primary";
  if (editing) submit.textContent = form.kind === "folder" ? "Rename folder" : "Save bookmark";
  else submit.textContent = form.kind === "folder" ? "Add folder" : "Add bookmark";
  submit.disabled = view.saving;
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "quiet";
  cancel.textContent = "Cancel";
  cancel.disabled = view.saving;
  cancel.addEventListener("click", () => actions.cancelForm());
  composerForm.append(submit, cancel);
  composerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(composerForm);
    actions.submitForm({
      title: String(data.get("title") ?? ""),
      url: String(data.get("url") ?? ""),
    });
  });
  if (!view.saving) {
    const input = composerForm.querySelector("input");
    if (input instanceof HTMLInputElement) queueMicrotask(() => input.focus());
  }
  return composerForm;
}

function field(labelText: string, name: string, value: string, disabled: boolean): HTMLLabelElement {
  const label = document.createElement("label");
  label.textContent = labelText;
  const input = document.createElement("input");
  input.name = name;
  input.value = value;
  input.disabled = disabled;
  input.autocomplete = "off";
  label.append(input);
  return label;
}

function tileActions(item: DialItem, actions: ViewActions, disabled: boolean): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "tile-actions";
  row.append(
    renameButton(() => actions.beginEdit(item.id), disabled),
    pictureButton(item, actions, disabled),
    deleteButton(() => actions.requestDelete(item.id), disabled),
  );
  return row;
}

function pictureButton(item: DialItem, actions: ViewActions, disabled: boolean): HTMLSpanElement {
  const wrap = document.createElement("span");
  wrap.className = "picture-actions";

  if (item.imageDataUrl) {
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "picture";
    clear.textContent = "Clear picture";
    clear.disabled = disabled;
    clear.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      actions.clearImage(item.id);
    });
    wrap.append(clear);
    return wrap;
  }

  const label = document.createElement("label");
  label.className = "picture";
  const caption = document.createElement("span");
  caption.textContent = "Picture";
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/jpeg,image/png,image/gif,image/webp";
  input.disabled = disabled;
  input.setAttribute("aria-label", `Attach picture for ${item.title}`);
  input.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    input.value = "";
    if (file) actions.attachImage(item.id, file);
  });
  label.append(caption, input);
  wrap.append(label);
  return wrap;
}

function renameButton(onClick: () => void, disabled: boolean): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "rename";
  button.textContent = "Rename";
  button.disabled = disabled;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  return button;
}

function deleteButton(onClick: () => void, disabled: boolean): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "delete";
  button.textContent = "Delete";
  button.disabled = disabled;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  return button;
}

function actionTile(kind: "folder" | "bookmark", title: string, onClick: () => void): HTMLLIElement {
  const entry = document.createElement("li");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tile add";
  button.addEventListener("click", onClick);
  button.append(mark("+", kind === "folder"), labeled(title, kind === "folder" ? "Folder" : "Link"));
  entry.append(button);
  return entry;
}

function tileMark(item: DialItem): HTMLElement {
  if (item.imageDataUrl) {
    const figure = document.createElement("span");
    figure.className = item.kind === "folder" ? "mark photo folder" : "mark photo";
    figure.setAttribute("aria-hidden", "true");
    const image = document.createElement("img");
    image.src = item.imageDataUrl;
    image.alt = "";
    image.draggable = false;
    figure.append(image);
    return figure;
  }
  return mark(item.monogram, item.kind === "folder");
}

function mark(text: string, folder: boolean): HTMLSpanElement {
  const badge = document.createElement("span");
  badge.className = folder ? "mark folder" : "mark";
  badge.setAttribute("aria-hidden", "true");
  badge.textContent = text;
  return badge;
}

function labeled(title: string, meta: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const titleNode = document.createElement("span");
  titleNode.className = "title";
  titleNode.textContent = title;
  const metaNode = document.createElement("span");
  metaNode.className = "meta";
  metaNode.textContent = meta;
  fragment.append(titleNode, metaNode);
  return fragment;
}

function brand(): HTMLElement {
  const name = document.createElement("p");
  name.className = "brand";
  name.textContent = "Hearth";
  return name;
}

function heading(text: string): HTMLElement {
  const title = document.createElement("h1");
  title.textContent = text;
  return title;
}

function paragraph(text: string, className?: string): HTMLParagraphElement {
  return note(text, className);
}

function note(text: string, className?: string): HTMLParagraphElement {
  const copy = document.createElement("p");
  if (className) copy.className = className;
  copy.textContent = text;
  return copy;
}
