import type { CreateKind, ViewModel } from "./present.ts";
import {
  choiceDialog,
  confirmDialog,
  openDialog,
  type DialogHandle,
} from "./dialog.ts";
import {
  dialStorageUsageLabel,
  formatDialStorageUsage,
  imagePickerAccept,
  type ImageStorageUsage,
} from "./images.ts";
import { chromeFaviconSrc } from "./favicon.ts";
import {
  chromeBeforeIdFromDisplayDrop,
  folderDropZone,
  openableUrl,
  type DialItem,
  type FolderOption,
} from "./model.ts";
import {
  bindRangeInput,
  ERASE_ALL_CONFIRM,
  ERASE_ALL_MESSAGE,
  ERASE_ALL_TITLE,
  LAYOUT_LIMITS,
  RESET_DEFAULTS_CONFIRM,
  RESET_DEFAULTS_MESSAGE,
  RESET_DEFAULTS_TITLE,
  syncRangeInputValue,
  type DangerZoneResult,
  type LayoutSettings,
} from "./settings.ts";
import { applyThemeToDocument } from "./theme.ts";
import { buildThemeCategory } from "./theme-settings.ts";
import { buildBackupCategory } from "./backup-settings.ts";
import {
  IMPORT_INVALID_MESSAGE,
  IMPORT_MERGE_LABEL,
  IMPORT_MODE_MESSAGE,
  IMPORT_MODE_TITLE,
  IMPORT_OVERWRITE_LABEL,
  parseBackup,
  pickBackupFile,
  type ImportMode,
} from "./backup.ts";

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
  attachImageUrl(id: string, url: string): void;
  captureThumbnail(id: string): void;
  /** Recapture http(s) bookmark thumbnails in the open folder. */
  refreshAllThumbnails(): void;
  clearImage(id: string): void;
  /** Persist layout; may clear opt-in flags if optional permission is denied. */
  setLayout(layout: LayoutSettings): void | Promise<LayoutSettings>;
  /** Persist optional default folder for new windows; null clears it. */
  setDefaultFolderId(id: string | null): void | Promise<void>;
  /** Persist or clear the local theme wallpaper. */
  setThemeBackground(file: File | null): void | Promise<void>;
  /** Current local wallpaper data URL (for Settings UI state). */
  getThemeBackground(): Promise<string | null>;
  /** Restore settings defaults (keeps dial pictures). */
  resetToDefaults(): void | Promise<DangerZoneResult>;
  /** Clear extension settings + dial pictures (never bookmarks). */
  eraseAllData(): void | Promise<DangerZoneResult>;
  /** Download dial pictures + non-bookmark prefs as JSON. */
  exportPicturesAndSettings(): void | Promise<void>;
  /**
   * Apply a validated backup JSON string. Never touches Chrome bookmarks.
   * Returns the layout/default-folder state to sync into the Settings form.
   */
  importPicturesAndSettings(
    rawJson: string,
    mode: ImportMode,
  ): void | Promise<DangerZoneResult>;
  /** Local dial-picture storage footprint for the Settings usage line. */
  getImageStorageUsage(): Promise<ImageStorageUsage>;
  /** Find-a-dial filter query (titles + URLs in the open folder subtree). */
  setSearchQuery(query: string): void;
  /** Clear the find-a-dial filter. */
  clearSearch(): void;
};

type MenuTarget = {
  id: string;
  title: string;
  kind: "link" | "folder";
  url: string | null;
  imageDataUrl: string | null;
};

/** Edit dialog kept across draw cycles; closed silently before each render. */
let editDialog: DialogHandle | null = null;
/** Settings overlay lives on document.body and survives dial re-renders. */
let settingsDialog: DialogHandle | null = null;
let settingsOpen = false;
/** Restore caret after a redraw when the search field had focus. */
let searchCaret: { start: number; end: number } | null = null;
/** Request focus on the search field after the next render (`/` shortcut). */
let focusSearchAfterRender = false;

export function requestSearchFocus(): void {
  focusSearchAfterRender = true;
}

export function render(host: HTMLElement, view: ViewModel, actions: ViewActions): void {
  editDialog?.close({ silent: true });
  editDialog = null;

  const prevSearch = host.querySelector<HTMLInputElement>(".dial-search-input");
  if (prevSearch && host.ownerDocument.activeElement === prevSearch) {
    searchCaret = {
      start: prevSearch.selectionStart ?? prevSearch.value.length,
      end: prevSearch.selectionEnd ?? prevSearch.value.length,
    };
  } else {
    searchCaret = null;
  }

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

  const nextSearch = host.querySelector<HTMLInputElement>(".dial-search-input");
  if (nextSearch && (focusSearchAfterRender || searchCaret)) {
    focusSearchAfterRender = false;
    const caret = searchCaret;
    searchCaret = null;
    queueMicrotask(() => {
      nextSearch.focus();
      if (caret) {
        const len = nextSearch.value.length;
        nextSearch.setSelectionRange(Math.min(caret.start, len), Math.min(caret.end, len));
      }
    });
  } else {
    focusSearchAfterRender = false;
    searchCaret = null;
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
      current.append(
        menuButton(`Actions for ${crumb.title}`, view.saving, (button) => {
          openCurrentFolderMenu(view, actions, button);
        }),
      );
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
  header.append(searchField(view, actions));
  header.append(
    settingsGear(view.layout, view.defaultFolderId, view.defaultFolderOptions, actions),
  );
  section.append(header);

  if (view.error) section.append(alertLine(view.error));
  if (view.form?.mode === "create") section.append(composer(view, actions));
  if (view.empty) section.append(paragraph(view.empty, "empty"));

  const list = document.createElement("ul");
  list.className = "grid";
  list.setAttribute("aria-label", view.searching ? "Search results" : "Speed dial");
  const canDrag = !view.saving && !view.searching && view.items.length > 0;
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
    main.append(
      tileMark(item),
      tileCaption(item, actions, view.saving, view.thumbnailsActive, view.imageUrlFetchActive),
    );
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

function searchField(
  view: Extract<ViewModel, { name: "grid" }>,
  actions: ViewActions,
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "dial-search";
  if (view.searching) wrap.classList.add("is-active");

  const input = document.createElement("input");
  input.type = "search";
  input.className = "dial-search-input";
  input.value = view.searchQuery;
  input.placeholder = "Find…";
  input.setAttribute("aria-label", "Find a dial");
  input.autocomplete = "off";
  input.spellcheck = false;
  input.disabled = view.saving;
  input.addEventListener("input", () => {
    actions.setSearchQuery(input.value);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    if (view.searchQuery.trim()) {
      actions.clearSearch();
      return;
    }
    input.blur();
  });

  const hint = document.createElement("kbd");
  hint.className = "dial-search-hint";
  hint.textContent = "/";
  hint.title = "Press / to find";
  hint.setAttribute("aria-hidden", "true");

  wrap.append(input);
  if (!view.searching && !view.searchQuery) wrap.append(hint);
  return wrap;
}

function settingsGear(
  layout: LayoutSettings,
  defaultFolderId: string | null,
  defaultFolderOptions: readonly FolderOption[],
  actions: ViewActions,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "settings-gear";
  button.setAttribute("aria-label", "Settings");
  button.title = "Settings";
  button.append(iconGear());
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openSettingsDialog(layout, defaultFolderId, defaultFolderOptions, actions, button);
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
  defaultFolderId: string | null,
  defaultFolderOptions: readonly FolderOption[],
  actions: ViewActions,
  returnFocus: HTMLElement,
): void {
  if (settingsOpen && settingsDialog) {
    const focusables = settingsDialog.panel.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), select:not([disabled])",
    );
    focusables[0]?.focus();
    return;
  }

  const body = document.createElement("form");
  body.className = "dialog-form settings-dialog-form";

  const layoutCategory = settingsCategory("Layout");

  const columns = document.createElement("input");
  columns.name = "columns";
  bindRangeInput(columns, {
    min: LAYOUT_LIMITS.columns.min,
    max: LAYOUT_LIMITS.columns.max,
    step: 1,
    value: layout.columns,
  });
  columns.setAttribute("aria-label", "Columns");
  layoutCategory.append(settingsField("Columns", columns));
  syncRangeInputValue(columns, layout.columns);
  const columnsHelp = document.createElement("span");
  columnsHelp.className = "settings-help";
  columnsHelp.textContent = "Number of dial columns (1–8).";
  layoutCategory.append(columnsHelp);

  const tileSize = document.createElement("input");
  tileSize.name = "tileSize";
  bindRangeInput(tileSize, {
    min: LAYOUT_LIMITS.tileSize.min,
    max: LAYOUT_LIMITS.tileSize.max,
    step: 1,
    value: layout.tileSize,
  });
  tileSize.setAttribute("aria-label", "Tile size");
  layoutCategory.append(settingsField("Tile size", tileSize));
  // Re-apply after the control is in the tree so Chromium positions the thumb
  // against the intended min/max instead of the default midpoint.
  syncRangeInputValue(tileSize, layout.tileSize);
  const tileHelp = document.createElement("span");
  tileHelp.className = "settings-help";
  tileHelp.textContent = "Width of each dial face (96–576px). Faces use a 16:9 aspect ratio.";
  layoutCategory.append(tileHelp);
  body.append(layoutCategory);

  const displayCategory = settingsCategory("Display");

  const reverse = document.createElement("input");
  reverse.type = "checkbox";
  reverse.name = "reverseOrder";
  reverse.checked = layout.reverseOrder;
  reverse.id = "settings-reverseOrder";
  reverse.setAttribute("role", "switch");
  displayCategory.append(
    settingsSwitch(reverse, "Show last bookmarks first", "Newest or last-listed bookmarks appear at the start of the grid."),
  );

  const defaultFolder = document.createElement("select");
  defaultFolder.name = "defaultFolderId";
  defaultFolder.setAttribute("aria-label", "Default folder for new windows");
  const unsetOption = document.createElement("option");
  unsetOption.value = "";
  unsetOption.textContent = "Last open folder (default)";
  defaultFolder.append(unsetOption);
  const knownIds = new Set(defaultFolderOptions.map((option) => option.id));
  for (const option of defaultFolderOptions) {
    const entry = document.createElement("option");
    entry.value = option.id;
    entry.textContent = `${"\u00A0".repeat(option.depth * 2)}${option.title}`;
    defaultFolder.append(entry);
  }
  if (defaultFolderId && knownIds.has(defaultFolderId)) {
    defaultFolder.value = defaultFolderId;
  } else if (defaultFolderId && !knownIds.has(defaultFolderId)) {
    const missing = document.createElement("option");
    missing.value = defaultFolderId;
    missing.textContent = "Missing folder (will fall back)";
    defaultFolder.append(missing);
    defaultFolder.value = defaultFolderId;
  } else {
    defaultFolder.value = "";
  }
  displayCategory.append(settingsFieldSelect("Default folder for new windows", defaultFolder));
  const folderHelp = document.createElement("span");
  folderHelp.className = "settings-help";
  folderHelp.textContent =
    "Unset keeps recalling the last folder you had open. Set a folder and each new window / new tab starts there; navigating still updates last-open for when this is unset.";
  displayCategory.append(folderHelp);
  body.append(displayCategory);

  let themeBackground: string | null = null;
  const themeControls = buildThemeCategory({
    theme: layout.theme,
    backgroundImage: null,
    idPrefix: "overlay-theme",
    onThemeChange: () => {
      applyLayout();
    },
    onBackgroundFile: (file) => {
      void Promise.resolve(actions.setThemeBackground(file))
        .then(async () => {
          themeBackground = await Promise.resolve(actions.getThemeBackground());
          themeControls.setBackgroundImage(themeBackground);
          applyThemeToDocument(document.documentElement, themeControls.readTheme(), {
            backgroundImage: themeBackground,
          });
        })
        .catch(() => {
          // Errors surface via the dial banner on redraw.
        });
    },
  });
  body.append(themeControls.root);
  void Promise.resolve(actions.getThemeBackground())
    .then((dataUrl) => {
      themeBackground = dataUrl;
      if (!themeControls.root.isConnected) return;
      themeControls.setBackgroundImage(dataUrl);
    })
    .catch(() => {
      // Keep Theme UI usable without wallpaper status.
    });

  const picturesCategory = settingsCategory("Pictures");

  const thumbnails = document.createElement("input");
  thumbnails.type = "checkbox";
  thumbnails.name = "thumbnailsEnabled";
  thumbnails.checked = layout.thumbnailsEnabled;
  thumbnails.id = "settings-thumbnailsEnabled";
  thumbnails.setAttribute("role", "switch");
  picturesCategory.append(
    settingsSwitch(
      thumbnails,
      "Generate dial thumbnails",
      "Off by default. The first time you turn this on, Chrome asks for optional access so Hearth can open a page briefly and capture a screenshot. Later turns may restore that access without asking. Images stay local — nothing is uploaded.",
    ),
  );

  const imageUrlFetch = document.createElement("input");
  imageUrlFetch.type = "checkbox";
  imageUrlFetch.name = "imageUrlFetchEnabled";
  imageUrlFetch.checked = layout.imageUrlFetchEnabled;
  imageUrlFetch.id = "settings-imageUrlFetchEnabled";
  imageUrlFetch.setAttribute("role", "switch");
  picturesCategory.append(
    settingsSwitch(
      imageUrlFetch,
      "Assign pictures from URLs",
      "Off by default. The first time you turn this on, Chrome asks for optional site access so Hearth can download an image once from a link and store it locally. Turning it off drops active access; later turns may restore it without asking.",
    ),
  );

  const thumbnailWait = document.createElement("input");
  thumbnailWait.name = "thumbnailWaitSeconds";
  bindRangeInput(thumbnailWait, {
    min: LAYOUT_LIMITS.thumbnailWaitSeconds.min,
    max: LAYOUT_LIMITS.thumbnailWaitSeconds.max,
    step: LAYOUT_LIMITS.thumbnailWaitSeconds.step,
    value: layout.thumbnailWaitSeconds,
  });
  thumbnailWait.setAttribute("aria-label", "Thumbnail wait (seconds)");
  picturesCategory.append(settingsField("Thumbnail wait (seconds)", thumbnailWait));
  syncRangeInputValue(thumbnailWait, layout.thumbnailWaitSeconds);
  const waitHelp = document.createElement("span");
  waitHelp.className = "settings-help";
  waitHelp.textContent =
    "How long capture waits after opening the page before taking the screenshot (1–15s, default 2). Raise this for slow sites.";
  picturesCategory.append(waitHelp);
  const storageUsage = dialStorageUsageRow("Measuring…");
  picturesCategory.append(storageUsage.root);
  void Promise.resolve(actions.getImageStorageUsage())
    .then((usage) => {
      if (!storageUsage.root.isConnected) return;
      storageUsage.setValue(formatDialStorageUsage(usage));
    })
    .catch(() => {
      if (!storageUsage.root.isConnected) return;
      storageUsage.setValue("Storage usage is unavailable right now.");
    });
  body.append(picturesCategory);

  const backupCategory = buildBackupCategory({
    onExport: () => {
      void Promise.resolve(actions.exportPicturesAndSettings()).catch(() => {
        // Errors surface via the dial banner on redraw.
      });
    },
    onImport: () => {
      void (async () => {
        const file = await pickBackupFile();
        if (!file) return;
        let raw: string;
        try {
          raw = await file.text();
          parseBackup(raw);
        } catch (error) {
          await confirmDialog({
            title: "Import failed",
            message:
              error instanceof Error && error.message.trim()
                ? error.message
                : IMPORT_INVALID_MESSAGE,
            confirmLabel: "OK",
            cancelLabel: "Close",
            returnFocus: backupCategory.root,
          });
          return;
        }
        const mode = await choiceDialog<ImportMode>({
          title: IMPORT_MODE_TITLE,
          message: IMPORT_MODE_MESSAGE,
          choices: [
            { value: "merge", label: IMPORT_MERGE_LABEL, primary: true },
            { value: "overwrite", label: IMPORT_OVERWRITE_LABEL, danger: true },
          ],
          cancelLabel: "Cancel",
          returnFocus: backupCategory.root,
        });
        if (!mode) return;
        try {
          const result = await Promise.resolve(
            actions.importPicturesAndSettings(raw, mode),
          );
          if (result) syncForm(result);
        } catch {
          // Errors surface via the dial banner on redraw.
        }
      })();
    },
  });
  body.append(backupCategory.root);

  // Danger Zone must always remain last if new settings categories are added.
  const dangerCategory = settingsCategory("Danger Zone");
  dangerCategory.classList.add("settings-danger-zone");
  const dangerHelp = document.createElement("span");
  dangerHelp.className = "settings-help";
  dangerHelp.textContent =
    "These actions only affect Hearth preferences and stored dial pictures — never your Chrome bookmarks.";
  dangerCategory.append(dangerHelp);
  const dangerActions = document.createElement("div");
  dangerActions.className = "settings-danger-actions";
  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "settings-danger-reset";
  resetBtn.textContent = "Reset to Defaults";
  const eraseBtn = document.createElement("button");
  eraseBtn.type = "button";
  eraseBtn.className = "settings-danger-erase";
  eraseBtn.textContent = "Erase All Data";
  dangerActions.append(resetBtn, eraseBtn);
  dangerCategory.append(dangerActions);
  body.append(dangerCategory);

  const readLayout = (): LayoutSettings => ({
    columns: Number(columns.value),
    tileSize: Number(tileSize.value),
    reverseOrder: reverse.checked,
    thumbnailsEnabled: thumbnails.checked,
    imageUrlFetchEnabled: imageUrlFetch.checked,
    thumbnailWaitSeconds: Number(thumbnailWait.value),
    theme: themeControls.readTheme(),
  });

  const syncForm = (result: DangerZoneResult) => {
    reverse.checked = result.layout.reverseOrder;
    thumbnails.checked = result.layout.thumbnailsEnabled;
    imageUrlFetch.checked = result.layout.imageUrlFetchEnabled;
    syncRangeInputValue(columns, result.layout.columns);
    syncRangeInputValue(tileSize, result.layout.tileSize);
    syncRangeInputValue(thumbnailWait, result.layout.thumbnailWaitSeconds);
    defaultFolder.value = result.defaultFolderId ?? "";
    themeControls.syncTheme(result.layout.theme);
    themeBackground = result.themeBackground;
    themeControls.setBackgroundImage(result.themeBackground);
    applyThemeToDocument(document.documentElement, result.layout.theme, {
      backgroundImage: result.themeBackground,
    });
  };

  const applyLayout = () => {
    const next = readLayout();
    applyThemeToDocument(document.documentElement, next.theme, {
      backgroundImage: themeBackground,
    });
    void Promise.resolve(actions.setLayout(next))
      .then((applied) => {
        if (!applied) return;
        reverse.checked = applied.reverseOrder;
        thumbnails.checked = applied.thumbnailsEnabled;
        imageUrlFetch.checked = applied.imageUrlFetchEnabled;
        syncRangeInputValue(columns, applied.columns);
        syncRangeInputValue(tileSize, applied.tileSize);
        syncRangeInputValue(thumbnailWait, applied.thumbnailWaitSeconds);
        themeControls.syncTheme(applied.theme);
      })
      .catch(() => {
        // Permission API rejections are handled inside setLayout / chromePermissions.
        // Keep the dialog open; next draw syncs switch state from storage.
      });
  };

  const applyDefaultFolder = () => {
    const value = defaultFolder.value.trim();
    void Promise.resolve(actions.setDefaultFolderId(value.length > 0 ? value : null));
  };

  resetBtn.addEventListener("click", () => {
    void (async () => {
      const confirmed = await confirmDialog({
        title: RESET_DEFAULTS_TITLE,
        message: RESET_DEFAULTS_MESSAGE,
        confirmLabel: RESET_DEFAULTS_CONFIRM,
        cancelLabel: "Cancel",
        returnFocus: resetBtn,
      });
      if (!confirmed) return;
      try {
        const result = await Promise.resolve(actions.resetToDefaults());
        if (result) syncForm(result);
      } catch {
        // Errors surface via the dial banner on redraw.
      }
    })();
  });

  eraseBtn.addEventListener("click", () => {
    void (async () => {
      const confirmed = await confirmDialog({
        title: ERASE_ALL_TITLE,
        message: ERASE_ALL_MESSAGE,
        confirmLabel: ERASE_ALL_CONFIRM,
        cancelLabel: "Cancel",
        danger: true,
        returnFocus: eraseBtn,
      });
      if (!confirmed) return;
      try {
        const result = await Promise.resolve(actions.eraseAllData());
        if (result) syncForm(result);
      } catch {
        // Errors surface via the dial banner on redraw.
      }
    })();
  });

  columns.addEventListener("change", applyLayout);
  tileSize.addEventListener("change", applyLayout);
  thumbnailWait.addEventListener("change", applyLayout);
  reverse.addEventListener("change", applyLayout);
  thumbnails.addEventListener("change", applyLayout);
  imageUrlFetch.addEventListener("change", applyLayout);
  defaultFolder.addEventListener("change", applyDefaultFolder);
  body.addEventListener("submit", (event) => {
    event.preventDefault();
    applyLayout();
    applyDefaultFolder();
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

function settingsCategory(title: string): HTMLElement {
  const section = document.createElement("section");
  section.className = "settings-category";
  const heading = document.createElement("h3");
  heading.className = "settings-category-title";
  heading.textContent = title;
  section.append(heading);
  return section;
}

/** Labeled readout so dial-picture storage is visible, not another muted help line. */
function dialStorageUsageRow(initialValue: string): {
  root: HTMLElement;
  setValue: (text: string) => void;
} {
  const root = document.createElement("div");
  root.className = "settings-storage-usage";
  const title = document.createElement("span");
  title.className = "settings-storage-usage-title";
  title.textContent = dialStorageUsageLabel();
  const value = document.createElement("span");
  value.className = "settings-storage-usage-value";
  value.textContent = initialValue;
  root.append(title, value);
  return {
    root,
    setValue(text) {
      value.textContent = text;
    },
  };
}

function settingsSwitch(
  input: HTMLInputElement,
  title: string,
  help: string,
): HTMLLabelElement {
  const label = document.createElement("label");
  label.className = "settings-switch";
  if (input.id) label.htmlFor = input.id;
  const text = document.createElement("span");
  text.className = "settings-switch-text";
  const caption = document.createElement("span");
  caption.className = "settings-switch-title";
  caption.textContent = title;
  const helpEl = document.createElement("span");
  helpEl.className = "settings-help";
  helpEl.textContent = help;
  text.append(caption, helpEl);
  label.append(input, text);
  return label;
}

function settingsField(labelText: string, control: HTMLInputElement): HTMLLabelElement {
  const label = document.createElement("label");
  label.className = "settings-field";
  const caption = document.createElement("span");
  caption.textContent = labelText;
  label.append(caption, control);
  return label;
}

function settingsFieldSelect(labelText: string, control: HTMLSelectElement): HTMLLabelElement {
  const label = document.createElement("label");
  label.className = "settings-field";
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

function tileCaption(
  item: DialItem,
  actions: ViewActions,
  disabled: boolean,
  thumbnailsActive: boolean,
  imageUrlFetchActive: boolean,
): HTMLElement {
  const caption = document.createElement("div");
  caption.className = "tile-caption";
  const titleRow = document.createElement("div");
  titleRow.className = "tile-title-row";
  const favicon = titleFavicon(item);
  if (favicon) titleRow.append(favicon);
  const title = document.createElement("span");
  title.className = "title";
  title.textContent = item.title;
  titleRow.append(title);
  const metaRow = document.createElement("div");
  metaRow.className = "tile-meta-row";
  const meta = document.createElement("span");
  meta.className = "meta";
  meta.textContent = item.meta;
  metaRow.append(
    meta,
    menuButton(`Actions for ${item.title}`, disabled, (button) => {
      openActionMenu(item, actions, button, thumbnailsActive, imageUrlFetchActive);
    }),
  );
  caption.append(titleRow, metaRow);
  return caption;
}

/** Small profile-cache favicon beside the title; monogram remains the dial face. */
function titleFavicon(item: DialItem): HTMLImageElement | null {
  if (item.kind !== "link" || !item.url) return null;
  const src = chromeFaviconSrc(item.url);
  if (!src) return null;
  const icon = document.createElement("img");
  icon.className = "tile-favicon";
  icon.src = src;
  icon.alt = "";
  icon.draggable = false;
  icon.decoding = "async";
  icon.addEventListener("error", () => {
    icon.remove();
  });
  return icon;
}

function openActionMenu(
  item: MenuTarget,
  actions: ViewActions,
  anchor: HTMLElement,
  thumbnailsActive: boolean,
  imageUrlFetchActive: boolean,
): void {
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
  addItem("Picture…", iconPicture(), () =>
    openPictureMenu(item, actions, anchor, thumbnailsActive, imageUrlFetchActive),
  );
  addItem("Delete", iconDelete(), () => actions.requestDelete(item.id), true);

  const handle = openDialog({
    panelClass: "dialog-menu",
    body: list,
    returnFocus: anchor,
    closeOnBackdrop: true,
    closeOnEscape: true,
  });
}

function refreshableCount(items: readonly DialItem[]): number {
  let count = 0;
  for (const item of items) {
    if (item.kind !== "link" || !item.url) continue;
    const pageUrl = openableUrl(item.url);
    if (!pageUrl) continue;
    if (pageUrl.startsWith("http:") || pageUrl.startsWith("https:")) count += 1;
  }
  return count;
}

function openCurrentFolderMenu(
  view: Extract<ViewModel, { name: "grid" }>,
  actions: ViewActions,
  anchor: HTMLElement,
): void {
  const list = document.createElement("div");
  list.className = "dialog-menu-list";
  list.setAttribute("role", "menu");

  const addItem = (
    label: string,
    icon: SVGSVGElement,
    onPick: () => void,
    opts?: { danger?: boolean; disabled?: boolean },
  ) => {
    const itemButton = document.createElement("button");
    itemButton.type = "button";
    itemButton.className = opts?.danger ? "dialog-menu-item danger" : "dialog-menu-item";
    itemButton.setAttribute("role", "menuitem");
    itemButton.disabled = Boolean(opts?.disabled);
    itemButton.append(icon, document.createTextNode(label));
    itemButton.addEventListener("click", () => {
      if (itemButton.disabled) return;
      handle.close();
      onPick();
    });
    list.append(itemButton);
  };

  if (view.canRenameCurrent) {
    addItem("Rename", iconRename(), () => actions.beginEdit(view.currentFolder.id));
  }
  if (view.canRenameCurrent || view.canDeleteCurrent) {
    addItem("Picture…", iconPicture(), () =>
      openPictureMenu(
        view.currentFolder,
        actions,
        anchor,
        view.thumbnailsActive,
        view.imageUrlFetchActive,
      ),
    );
  }

  const count = refreshableCount(view.items);
  if (!view.thumbnailsActive) {
    addItem("Refresh All Thumbnails (enable in Settings)", iconCamera(), () => undefined, {
      disabled: true,
    });
  } else if (count === 0) {
    addItem("Refresh All Thumbnails (no http bookmarks)", iconCamera(), () => undefined, {
      disabled: true,
    });
  } else {
    addItem("Refresh All Thumbnails", iconCamera(), () => actions.refreshAllThumbnails());
  }

  if (view.canDeleteCurrent) {
    addItem("Delete", iconDelete(), () => actions.requestDelete(view.currentFolder.id), {
      danger: true,
    });
  }

  const handle = openDialog({
    panelClass: "dialog-menu",
    body: list,
    returnFocus: anchor,
    closeOnBackdrop: true,
    closeOnEscape: true,
  });
}

function openPictureMenu(
  item: MenuTarget,
  actions: ViewActions,
  anchor: HTMLElement,
  thumbnailsActive: boolean,
  imageUrlFetchActive: boolean,
): void {
  const list = document.createElement("div");
  list.className = "dialog-menu-list";
  list.setAttribute("role", "menu");

  const addItem = (
    label: string,
    icon: SVGSVGElement,
    onPick: () => void,
    opts?: { danger?: boolean; disabled?: boolean },
  ) => {
    const itemButton = document.createElement("button");
    itemButton.type = "button";
    itemButton.className = opts?.danger ? "dialog-menu-item danger" : "dialog-menu-item";
    itemButton.setAttribute("role", "menuitem");
    itemButton.disabled = Boolean(opts?.disabled);
    itemButton.append(icon, document.createTextNode(label));
    itemButton.addEventListener("click", () => {
      if (itemButton.disabled) return;
      handle.close();
      onPick();
    });
    list.append(itemButton);
  };

  addItem("Attach file…", iconPicture(), () => pickImageFile(item, actions));
  if (imageUrlFetchActive) {
    addItem("Image from URL…", iconLink(), () => promptImageUrl(item, actions, anchor));
  } else {
    addItem("Image from URL… (enable in Settings)", iconLink(), () => undefined, {
      disabled: true,
    });
  }

  const pageUrl = item.kind === "link" && item.url ? openableUrl(item.url) : null;
  const canCapture = Boolean(pageUrl && (pageUrl.startsWith("http:") || pageUrl.startsWith("https:")));
  if (canCapture) {
    if (thumbnailsActive) {
      addItem("Capture thumbnail", iconCamera(), () => actions.captureThumbnail(item.id));
    } else {
      addItem("Capture thumbnail (enable in Settings)", iconCamera(), () => undefined, {
        disabled: true,
      });
    }
  }

  if (item.imageDataUrl) {
    addItem("Clear picture", iconPicture(), () => actions.clearImage(item.id), { danger: true });
  }

  const handle = openDialog({
    panelClass: "dialog-menu",
    body: list,
    returnFocus: anchor,
    closeOnBackdrop: true,
    closeOnEscape: true,
  });
}

function promptImageUrl(item: MenuTarget, actions: ViewActions, returnFocus: HTMLElement): void {
  const body = document.createElement("form");
  body.className = "dialog-form";
  body.id = "hearth-image-url-form";

  const input = document.createElement("input");
  input.type = "url";
  input.name = "imageUrl";
  input.placeholder = "https://…";
  input.autocomplete = "off";
  input.required = true;
  input.setAttribute("aria-label", "Image address");

  const label = document.createElement("label");
  const caption = document.createElement("span");
  caption.textContent = "Image address";
  label.append(caption, input);
  body.append(label);

  const help = document.createElement("p");
  help.className = "dialog-message";
  help.textContent =
    "Hearth downloads the image once and stores it locally. The dial does not keep linking to the remote URL.";
  body.append(help);

  const footer = document.createElement("div");
  footer.className = "dialog-actions";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "quiet";
  cancel.textContent = "Cancel";
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "primary";
  submit.textContent = "Use image";
  submit.setAttribute("form", "hearth-image-url-form");
  footer.append(cancel, submit);

  let closedByAction = false;
  const handle = openDialog({
    title: "Image from URL",
    body,
    footer,
    returnFocus,
    onClose: () => {
      if (!closedByAction) return;
    },
  });

  cancel.addEventListener("click", () => {
    closedByAction = true;
    handle.close();
  });
  body.addEventListener("submit", (event) => {
    event.preventDefault();
    const url = input.value.trim();
    if (!url) return;
    closedByAction = true;
    handle.close();
    actions.attachImageUrl(item.id, url);
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
  input.accept = imagePickerAccept();
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
  const titleRow = document.createElement("div");
  titleRow.className = "tile-title-row";
  const title = document.createElement("span");
  title.className = "title";
  title.textContent = "New";
  titleRow.append(title);
  const meta = document.createElement("span");
  meta.className = "meta";
  meta.textContent = "Folder or bookmark";
  caption.append(titleRow, meta);
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

function iconLink(): SVGSVGElement {
  return svgIcon(
    "M3.9 12a5 5 0 0 1 5-5h4v2h-4a3 3 0 1 0 0 6h4v2h-4a5 5 0 0 1-5-5zm7-1h6v2h-6v-2zm5.1-4h-4v2h4a3 3 0 1 1 0 6h-4v2h4a5 5 0 0 0 0-10z",
  );
}

function iconCamera(): SVGSVGElement {
  return svgIcon(
    "M12 15.2A3.2 3.2 0 1 0 12 8.8a3.2 3.2 0 0 0 0 6.4zM9 3l-1.8 2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.2L15 3H9z",
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
