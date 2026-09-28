import type { CreateKind, ViewModel } from "./present.ts";
import { openDialog, type DialogHandle } from "./dialog.ts";
import { chromeBeforeIdFromDisplayDrop, type DialItem } from "./model.ts";
import { LAYOUT_LIMITS, type LayoutSettings } from "./settings.ts";

export type ViewActions = {
  openFolder(id: string): void;
  goToFolder(id: string): void;
  beginCreate(kind: CreateKind): void;
  beginEdit(id: string): void;
  requestDelete(id: string): void;
  cancelForm(): void;
  submitForm(input: { title: string; url: string }): void;
  reorderDial(draggedId: string, beforeId: string | null): void;
  moveDialInto(draggedId: string, parentId: string): void;
  attachImage(id: string, file: File): void;
  clearImage(id: string): void;
  setLayout(layout: LayoutSettings): void;
};

type MenuTarget = {
  id: string;
  title: string;
  imageDataUrl: string | null;
};

/** Edit dialog kept across draw cycles; closed silently before each render. */
let editDialog: DialogHandle | null = null;
/** Settings overlay lives on document.body and survives dial re-renders. */
let settingsDialog: DialogHandle | null = null;
let settingsOpen = false;

export function render(host: HTMLElement, view: ViewModel, actions: ViewActions): void {
  editDialog?.close({ silent: true });
  editDialog = null;

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
  if (view.form?.mode === "edit") {
    closeSettingsDialog({ silent: true });
    editDialog = showEditDialog(view, actions);
  }
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
      if (view.canRenameCurrent || view.canDeleteCurrent) {
        current.append(
          menuButton(`Actions for ${crumb.title}`, view.saving, (button) => {
            openActionMenu(
              {
                id: view.currentFolder.id,
                title: view.currentFolder.title,
                imageDataUrl: view.currentFolder.imageDataUrl,
              },
              actions,
              button,
            );
          }),
        );
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
  header.append(settingsGear(view.layout, actions));
  section.append(header);

  if (view.error) section.append(alertLine(view.error));
  if (view.form?.mode === "create") section.append(composer(view, actions));
  if (view.empty) section.append(paragraph(view.empty, "empty"));

  const list = document.createElement("ul");
  list.className = "grid";
  list.setAttribute("aria-label", "Speed dial");
  const canDrag = !view.saving && view.items.length > 0;
  const reverseOrder = view.layout.reverseOrder;
  for (const item of view.items) {
    const entry = document.createElement("li");
    let suppressClick = false;

    const shell = document.createElement("div");
    shell.className = "tile";

    let main: HTMLElement;
    if (item.kind === "link" && item.url) {
      const link = document.createElement("a");
      link.href = item.url;
      link.className = "tile-main";
      link.addEventListener("click", (event) => {
        if (!suppressClick) return;
        event.preventDefault();
        event.stopPropagation();
        suppressClick = false;
      });
      main = link;
    } else if (item.kind === "folder") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tile-main";
      button.addEventListener("click", (event) => {
        if (suppressClick) {
          event.preventDefault();
          event.stopPropagation();
          suppressClick = false;
          return;
        }
        actions.openFolder(item.id);
      });
      main = button;
    } else {
      main = document.createElement("div");
      main.className = "tile-main";
    }
    main.append(tileMark(item), tileCaption(item, actions, view.saving));
    shell.append(main);
    entry.append(shell);
    if (canDrag) {
      bindDialDrag(entry, item, view.items, reverseOrder, actions, () => {
        suppressClick = true;
      });
    }
    list.append(entry);
  }
  if (view.canCreate) {
    list.append(createTile(actions, view.saving));
  }
  if (view.items.length > 0 || view.canCreate) section.append(list);
  return section;
}

function settingsGear(layout: LayoutSettings, actions: ViewActions): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "settings-gear";
  button.setAttribute("aria-label", "Settings");
  button.title = "Settings";
  button.append(iconGear());
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openSettingsDialog(layout, actions, button);
  });
  return button;
}

function closeSettingsDialog(opts?: { silent?: boolean }): void {
  if (!settingsDialog) {
    settingsOpen = false;
    return;
  }
  settingsDialog.close(opts);
  settingsDialog = null;
  settingsOpen = false;
}

function openSettingsDialog(
  layout: LayoutSettings,
  actions: ViewActions,
  returnFocus: HTMLElement,
): void {
  if (settingsOpen && settingsDialog) {
    const focusables = settingsDialog.panel.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled])",
    );
    focusables[0]?.focus();
    return;
  }

  const body = document.createElement("form");
  body.className = "dialog-form settings-dialog-form";

  const reverse = document.createElement("input");
  reverse.type = "checkbox";
  reverse.name = "reverseOrder";
  reverse.checked = layout.reverseOrder;
  reverse.id = "settings-reverseOrder";
  const reverseLabel = document.createElement("label");
  reverseLabel.className = "settings-check";
  reverseLabel.htmlFor = "settings-reverseOrder";
  const reverseCaption = document.createElement("span");
  reverseCaption.textContent = "Show last bookmarks first";
  reverseLabel.append(reverse, reverseCaption);
  const reverseHelp = document.createElement("span");
  reverseHelp.className = "settings-help";
  reverseHelp.textContent = "Newest or last-listed bookmarks appear at the start of the grid.";
  body.append(reverseLabel, reverseHelp);

  const columns = document.createElement("input");
  columns.type = "number";
  columns.name = "columns";
  columns.min = String(LAYOUT_LIMITS.columns.min);
  columns.max = String(LAYOUT_LIMITS.columns.max);
  columns.step = "1";
  columns.value = String(layout.columns);
  columns.setAttribute("aria-label", "Columns");
  body.append(settingsField("Columns", columns));

  const tileSize = document.createElement("input");
  tileSize.type = "range";
  tileSize.name = "tileSize";
  tileSize.min = String(LAYOUT_LIMITS.tileSize.min);
  tileSize.max = String(LAYOUT_LIMITS.tileSize.max);
  tileSize.step = "1";
  tileSize.value = String(layout.tileSize);
  tileSize.setAttribute("aria-label", "Tile size");
  body.append(settingsField("Tile size", tileSize));
  const tileHelp = document.createElement("span");
  tileHelp.className = "settings-help";
  tileHelp.textContent = "Width of each dial face (96–576px). Faces use a 16:9 aspect ratio.";
  body.append(tileHelp);

  const readLayout = (): LayoutSettings => ({
    columns: Number(columns.value),
    tileSize: Number(tileSize.value),
    reverseOrder: reverse.checked,
  });

  const applyLayout = () => {
    actions.setLayout(readLayout());
  };

  columns.addEventListener("change", applyLayout);
  tileSize.addEventListener("change", applyLayout);
  reverse.addEventListener("change", applyLayout);
  body.addEventListener("submit", (event) => {
    event.preventDefault();
    applyLayout();
    closeSettingsDialog();
  });

  const footer = document.createElement("div");
  footer.className = "dialog-actions";
  const done = document.createElement("button");
  done.type = "submit";
  done.className = "primary";
  done.textContent = "Done";
  done.setAttribute("form", "hearth-settings-form");
  body.id = "hearth-settings-form";
  footer.append(done);

  settingsOpen = true;
  settingsDialog = openDialog({
    title: "Settings",
    panelClass: "settings-dialog",
    body,
    footer,
    returnFocus,
    onClose: () => {
      settingsDialog = null;
      settingsOpen = false;
    },
  });
}

function settingsField(labelText: string, control: HTMLInputElement): HTMLLabelElement {
  const label = document.createElement("label");
  const caption = document.createElement("span");
  caption.textContent = labelText;
  label.append(caption, control);
  return label;
}

function menuButton(
  ariaLabel: string,
  disabled: boolean,
  onOpen: (button: HTMLButtonElement) => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "action-menu";
  button.setAttribute("aria-label", ariaLabel);
  button.setAttribute("aria-haspopup", "menu");
  button.disabled = disabled;
  button.append(iconMore());
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    onOpen(button);
  });
  return button;
}

function tileCaption(item: DialItem, actions: ViewActions, disabled: boolean): HTMLElement {
  const caption = document.createElement("div");
  caption.className = "tile-caption";
  const title = document.createElement("span");
  title.className = "title";
  title.textContent = item.title;
  const metaRow = document.createElement("div");
  metaRow.className = "tile-meta-row";
  const meta = document.createElement("span");
  meta.className = "meta";
  meta.textContent = item.meta;
  metaRow.append(
    meta,
    menuButton(`Actions for ${item.title}`, disabled, (button) => {
      openActionMenu(item, actions, button);
    }),
  );
  caption.append(title, metaRow);
  return caption;
}

function openActionMenu(item: MenuTarget, actions: ViewActions, anchor: HTMLElement): void {
  const list = document.createElement("div");
  list.className = "dialog-menu-list";
  list.setAttribute("role", "menu");

  const addItem = (label: string, icon: SVGSVGElement, onPick: () => void, danger = false) => {
    const itemButton = document.createElement("button");
    itemButton.type = "button";
    itemButton.className = danger ? "dialog-menu-item danger" : "dialog-menu-item";
    itemButton.setAttribute("role", "menuitem");
    itemButton.append(icon, document.createTextNode(label));
    itemButton.addEventListener("click", () => {
      handle.close();
      onPick();
    });
    list.append(itemButton);
  };

  addItem("Rename", iconRename(), () => actions.beginEdit(item.id));
  if (item.imageDataUrl) {
    addItem("Clear picture", iconPicture(), () => actions.clearImage(item.id));
  } else {
    addItem("Picture", iconPicture(), () => pickImageFile(item, actions));
  }
  addItem("Delete", iconDelete(), () => actions.requestDelete(item.id), true);

  const handle = openDialog({
    panelClass: "dialog-menu",
    body: list,
    returnFocus: anchor,
    closeOnBackdrop: true,
    closeOnEscape: true,
  });
}

function openCreateMenu(actions: ViewActions, anchor: HTMLElement): void {
  const list = document.createElement("div");
  list.className = "dialog-menu-list";
  list.setAttribute("role", "menu");

  const addItem = (label: string, icon: SVGSVGElement, kind: CreateKind) => {
    const itemButton = document.createElement("button");
    itemButton.type = "button";
    itemButton.className = "dialog-menu-item";
    itemButton.setAttribute("role", "menuitem");
    itemButton.append(icon, document.createTextNode(label));
    itemButton.addEventListener("click", () => {
      handle.close();
      actions.beginCreate(kind);
    });
    list.append(itemButton);
  };

  addItem("New folder", iconFolder(), "folder");
  addItem("New bookmark", iconBookmark(), "bookmark");

  const handle = openDialog({
    panelClass: "dialog-menu",
    body: list,
    returnFocus: anchor,
    closeOnBackdrop: true,
    closeOnEscape: true,
  });
}

function pickImageFile(item: MenuTarget, actions: ViewActions): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/jpeg,image/png,image/gif,image/webp";
  input.hidden = true;
  document.body.append(input);
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    input.remove();
    if (file) actions.attachImage(item.id, file);
  });
  input.addEventListener("cancel", () => input.remove());
  input.click();
}

function showEditDialog(
  view: Extract<ViewModel, { name: "grid" }>,
  actions: ViewActions,
): DialogHandle {
  const form = view.form;
  if (!form || form.mode !== "edit") throw new Error("Missing edit form");

  const body = document.createElement("form");
  body.className = "dialog-form";
  body.append(field(form.kind === "folder" ? "Folder name" : "Name", "title", form.title, view.saving));
  if (form.kind === "bookmark") {
    body.append(field("Address", "url", form.url, view.saving));
  }

  const footer = document.createElement("div");
  footer.className = "dialog-actions";
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "primary";
  submit.textContent = form.kind === "folder" ? "Rename folder" : "Save bookmark";
  submit.disabled = view.saving;
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "quiet";
  cancel.textContent = "Cancel";
  cancel.disabled = view.saving;
  footer.append(cancel, submit);

  // Associate footer submit with the form (footer is outside the form element).
  submit.setAttribute("form", "hearth-edit-form");
  body.id = "hearth-edit-form";

  let closedByAction = false;
  const handle = openDialog({
    title: form.kind === "folder" ? "Rename folder" : "Rename bookmark",
    body,
    footer,
    closeOnBackdrop: !view.saving,
    closeOnEscape: !view.saving,
    onClose: () => {
      if (closedByAction || view.saving) return;
      actions.cancelForm();
    },
  });

  cancel.addEventListener("click", () => {
    if (view.saving) return;
    closedByAction = true;
    handle.close();
    actions.cancelForm();
  });
  body.addEventListener("submit", (event) => {
    event.preventDefault();
    if (view.saving) return;
    const data = new FormData(body);
    closedByAction = true;
    handle.close();
    actions.submitForm({
      title: String(data.get("title") ?? ""),
      url: String(data.get("url") ?? ""),
    });
  });
  return handle;
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
  reverseOrder: boolean,
  actions: ViewActions,
  onDragged: () => void,
): void {
  entry.draggable = true;
  entry.classList.add("reorderable");
  entry.addEventListener("dragstart", (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest(".action-menu")) {
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
      const beforeId = chromeBeforeIdFromDisplayDrop(item.id, zone === "after", items, reverseOrder);
      onDragged();
      actions.reorderDial(draggedId, beforeId);
      return;
    }
    const after = event.clientX > rect.left + rect.width / 2;
    const beforeId = chromeBeforeIdFromDisplayDrop(item.id, after, items, reverseOrder);
    onDragged();
    actions.reorderDial(draggedId, beforeId);
  });
}

function composer(view: Extract<ViewModel, { name: "grid" }>, actions: ViewActions): HTMLFormElement {
  const form = view.form;
  if (!form || form.mode !== "create") throw new Error("Missing create form");
  const composerForm = document.createElement("form");
  composerForm.className = "composer";
  composerForm.append(field(form.kind === "folder" ? "Folder name" : "Name", "title", form.title, view.saving));
  if (form.kind === "bookmark") {
    composerForm.append(field("Address", "url", form.url, view.saving));
  }
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "primary";
  submit.textContent = form.kind === "folder" ? "Add folder" : "Add bookmark";
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
  composerForm.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || view.saving) return;
    event.preventDefault();
    actions.cancelForm();
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

function createTile(actions: ViewActions, disabled: boolean): HTMLLIElement {
  const entry = document.createElement("li");
  const shell = document.createElement("div");
  shell.className = "tile add";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tile-main";
  button.setAttribute("aria-label", "Create dial");
  button.setAttribute("aria-haspopup", "menu");
  button.disabled = disabled;
  button.addEventListener("click", () => {
    if (disabled) return;
    openCreateMenu(actions, button);
  });
  button.append(createMark(), createCaption());
  shell.append(button);
  entry.append(shell);
  return entry;
}

function createMark(): HTMLSpanElement {
  const badge = document.createElement("span");
  badge.className = "mark add-mark";
  badge.setAttribute("aria-hidden", "true");
  badge.textContent = "+";
  return badge;
}

function createCaption(): HTMLElement {
  const caption = document.createElement("div");
  caption.className = "tile-caption";
  const title = document.createElement("span");
  title.className = "title";
  title.textContent = "New";
  const meta = document.createElement("span");
  meta.className = "meta";
  meta.textContent = "Folder or bookmark";
  caption.append(title, meta);
  return caption;
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
  if (item.kind === "folder") return folderMark();
  return mark(item.monogram, false);
}

function folderMark(): HTMLSpanElement {
  const badge = document.createElement("span");
  badge.className = "mark folder mark-icon";
  badge.setAttribute("aria-hidden", "true");
  badge.append(iconFolder());
  return badge;
}

function mark(text: string, folder: boolean): HTMLSpanElement {
  const badge = document.createElement("span");
  badge.className = folder ? "mark folder" : "mark";
  badge.setAttribute("aria-hidden", "true");
  badge.textContent = text;
  return badge;
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

function alertLine(message: string): HTMLParagraphElement {
  const copy = note(message, "error");
  copy.setAttribute("role", "alert");
  return copy;
}

function svgIcon(paths: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("icon");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("fill", "currentColor");
  path.setAttribute("d", paths);
  svg.append(path);
  return svg;
}

function iconGear(): SVGSVGElement {
  return svgIcon(
    "M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.07 7.07 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.55-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.77 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.43.34.68.22l2.39-.96c.5.39 1.04.71 1.63.94l.36 2.54c.05.24.26.42.5.42h3.84c.24 0 .45-.18.5-.42l.36-2.54c.59-.24 1.13-.55 1.63-.94l2.39.96c.25.12.54.02.68-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z",
  );
}

function iconMore(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("icon");
  for (const cy of [6, 12, 18]) {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "12");
    circle.setAttribute("cy", String(cy));
    circle.setAttribute("r", "1.75");
    circle.setAttribute("fill", "currentColor");
    svg.append(circle);
  }
  return svg;
}

function iconRename(): SVGSVGElement {
  return svgIcon(
    "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
  );
}

function iconPicture(): SVGSVGElement {
  return svgIcon(
    "M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z",
  );
}

function iconDelete(): SVGSVGElement {
  return svgIcon(
    "M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z",
  );
}

function iconFolder(): SVGSVGElement {
  return svgIcon(
    "M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z",
  );
}

function iconBookmark(): SVGSVGElement {
  return svgIcon("M17 3H7a2 2 0 0 0-2 2v16l7-3 7 3V5a2 2 0 0 0-2-2z");
}
