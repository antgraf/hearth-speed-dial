import type { BookmarksApi } from "./browser.ts";
import { confirmDialog } from "./dialog.ts";
import { dialOpenFolderOptions, type FolderOption } from "./model.ts";
import {
  dialStorageUsageLabel,
  fileToDataUrl,
  formatDialStorageUsage,
  type ImageStorageUsage,
  type ImagesApi,
} from "./images.ts";
import {
  bindRangeInput,
  DEFAULT_LAYOUT,
  ERASE_ALL_CONFIRM,
  ERASE_ALL_MESSAGE,
  ERASE_ALL_TITLE,
  LAYOUT_LIMITS,
  RESET_DEFAULTS_CONFIRM,
  RESET_DEFAULTS_MESSAGE,
  RESET_DEFAULTS_TITLE,
  syncRangeInputValue,
  type LayoutSettings,
  type SettingsApi,
} from "./settings.ts";
import type { PermissionsApi } from "./permissions.ts";
import { applyLayoutChange, revokeOptionalFeaturePermissions } from "./toggles.ts";
import { applyThemeToDocument } from "./theme.ts";
import { buildThemeCategory, type ThemeCategoryHandle } from "./theme-settings.ts";

export function startSettings(
  host: HTMLElement,
  settings: SettingsApi,
  banner?: string | null,
  permissions?: PermissionsApi,
  bookmarks?: BookmarksApi,
  images?: ImagesApi,
): void {
  let layout: LayoutSettings = { ...DEFAULT_LAYOUT, theme: { ...DEFAULT_LAYOUT.theme } };
  let defaultFolderId: string | null = null;
  let folderOptions: FolderOption[] = [];
  let saving = false;
  let error: string | null = null;
  let savedNote: string | null = null;
  let storageUsage: ImageStorageUsage | null = null;
  let storageUsageError = false;
  let themeBackground: string | null = null;
  let themeControls: ThemeCategoryHandle | null = null;

  const applyTheme = () => {
    if (typeof document === "undefined") return;
    applyThemeToDocument(document.documentElement, layout.theme, {
      backgroundImage: themeBackground,
    });
  };

  const draw = () => {
    host.replaceChildren();
    if (banner) host.append(note(banner, "preview"));

    const frame = document.createElement("div");
    frame.className = "frame settings-page";
    host.append(frame);

    const brand = document.createElement("p");
    brand.className = "brand";
    brand.textContent = "Hearth";
    frame.append(brand);

    const title = document.createElement("h1");
    title.textContent = "Settings";
    frame.append(title);

    const intro = document.createElement("p");
    intro.className = "settings-intro";
    intro.textContent =
      "Layout and theme preferences stay in this browser profile. Bookmark order in Chrome is unchanged — reverse only affects how the dial grid is shown.";
    frame.append(intro);

    if (error) {
      const alert = note(error, "error");
      alert.setAttribute("role", "alert");
      frame.append(alert);
    }
    if (savedNote) frame.append(note(savedNote, "settings-saved"));

    const form = document.createElement("form");
    form.className = "settings-form";
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void save();
    });

    const layoutCategory = category("Layout");

    const columns = document.createElement("input");
    columns.name = "columns";
    bindRangeInput(columns, {
      min: LAYOUT_LIMITS.columns.min,
      max: LAYOUT_LIMITS.columns.max,
      step: 1,
      value: layout.columns,
    });
    columns.disabled = saving;
    columns.setAttribute("aria-label", "Columns");
    layoutCategory.append(labeled("Columns", columns));
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
    tileSize.disabled = saving;
    tileSize.setAttribute("aria-label", "Tile size");
    layoutCategory.append(labeled("Tile size", tileSize));
    syncRangeInputValue(tileSize, layout.tileSize);
    const tileHelp = document.createElement("span");
    tileHelp.className = "settings-help";
    tileHelp.textContent =
      "Width of each dial face (96–576px). Faces use a 16:9 aspect ratio.";
    layoutCategory.append(tileHelp);
    form.append(layoutCategory);

    const displayCategory = category("Display");

    const reverse = document.createElement("input");
    reverse.type = "checkbox";
    reverse.name = "reverseOrder";
    reverse.checked = layout.reverseOrder;
    reverse.id = "reverseOrder";
    reverse.disabled = saving;
    reverse.setAttribute("role", "switch");
    displayCategory.append(
      switchControl(
        reverse,
        "Show last bookmarks first",
        "Newest or last-listed bookmarks appear at the start of the grid.",
      ),
    );

    const defaultFolder = document.createElement("select");
    defaultFolder.name = "defaultFolderId";
    defaultFolder.disabled = saving || folderOptions.length === 0;
    defaultFolder.setAttribute("aria-label", "Default folder for new windows");
    const unsetOption = document.createElement("option");
    unsetOption.value = "";
    unsetOption.textContent = "Last open folder (default)";
    defaultFolder.append(unsetOption);
    const knownIds = new Set(folderOptions.map((option) => option.id));
    for (const option of folderOptions) {
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
    displayCategory.append(labeledSelect("Default folder for new windows", defaultFolder));
    const folderHelp = document.createElement("span");
    folderHelp.className = "settings-help";
    folderHelp.textContent =
      "Unset keeps recalling the last folder you had open. Set a folder and each new window / new tab starts there; navigating still updates last-open for when this is unset.";
    displayCategory.append(folderHelp);
    form.append(displayCategory);

    themeControls = buildThemeCategory({
      theme: layout.theme,
      backgroundImage: themeBackground,
      disabled: saving,
      idPrefix: "page-theme",
      onThemeChange: () => {
        layout = { ...layout, theme: themeControls!.readTheme() };
        applyTheme();
      },
      onBackgroundFile: (file) => {
        void (async () => {
          try {
            if (file == null) {
              themeBackground = null;
              await settings.setThemeBackground(null);
            } else {
              const dataUrl = await fileToDataUrl(file);
              themeBackground = dataUrl;
              await settings.setThemeBackground(dataUrl);
            }
            themeControls?.setBackgroundImage(themeBackground);
            applyTheme();
            savedNote = "Background image updated.";
            error = null;
            draw();
          } catch (caught) {
            error =
              caught instanceof Error && caught.message.trim()
                ? caught.message
                : "Could not update background image.";
            draw();
          }
        })();
      },
    });
    // Match options-page heading level used by other categories.
    const themeHeading = themeControls.root.querySelector(".settings-category-title");
    if (themeHeading) {
      const h2 = document.createElement("h2");
      h2.className = "settings-category-title";
      h2.textContent = themeHeading.textContent;
      themeHeading.replaceWith(h2);
    }
    form.append(themeControls.root);

    const picturesCategory = category("Pictures");

    const thumbnails = document.createElement("input");
    thumbnails.type = "checkbox";
    thumbnails.name = "thumbnailsEnabled";
    thumbnails.checked = layout.thumbnailsEnabled;
    thumbnails.id = "thumbnailsEnabled";
    thumbnails.disabled = saving;
    thumbnails.setAttribute("role", "switch");
    picturesCategory.append(
      switchControl(
        thumbnails,
        "Generate dial thumbnails",
        "Off by default. The first time you turn this on, Chrome asks for optional access so Hearth can open a page briefly and capture a screenshot. Later turns may restore that access without asking. Images stay local — nothing is uploaded.",
      ),
    );

    const imageUrlFetch = document.createElement("input");
    imageUrlFetch.type = "checkbox";
    imageUrlFetch.name = "imageUrlFetchEnabled";
    imageUrlFetch.checked = layout.imageUrlFetchEnabled;
    imageUrlFetch.id = "imageUrlFetchEnabled";
    imageUrlFetch.disabled = saving;
    imageUrlFetch.setAttribute("role", "switch");
    picturesCategory.append(
      switchControl(
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
    thumbnailWait.disabled = saving;
    thumbnailWait.setAttribute("aria-label", "Thumbnail wait (seconds)");
    picturesCategory.append(labeled("Thumbnail wait (seconds)", thumbnailWait));
    syncRangeInputValue(thumbnailWait, layout.thumbnailWaitSeconds);
    const waitHelp = document.createElement("span");
    waitHelp.className = "settings-help";
    waitHelp.textContent =
      "How long capture waits after opening the page before taking the screenshot (1–15s, default 2). Raise this for slow sites.";
    picturesCategory.append(waitHelp);
    if (images) {
      let valueText = "Measuring…";
      if (storageUsageError) valueText = "Storage usage is unavailable right now.";
      else if (storageUsage) valueText = formatDialStorageUsage(storageUsage);
      picturesCategory.append(dialStorageUsageRow(valueText));
    }
    form.append(picturesCategory);

    // Danger Zone must always remain last if new settings categories are added.
    const dangerCategory = category("Danger Zone");
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
    resetBtn.disabled = saving;
    const eraseBtn = document.createElement("button");
    eraseBtn.type = "button";
    eraseBtn.className = "settings-danger-erase";
    eraseBtn.textContent = "Erase All Data";
    eraseBtn.disabled = saving;
    dangerActions.append(resetBtn, eraseBtn);
    dangerCategory.append(dangerActions);
    form.append(dangerCategory);

    resetBtn.addEventListener("click", () => {
      void resetToDefaults(resetBtn);
    });
    eraseBtn.addEventListener("click", () => {
      void eraseAllData(eraseBtn);
    });

    const actions = document.createElement("div");
    actions.className = "settings-actions";
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "primary";
    submit.textContent = saving ? "Saving…" : "Save";
    submit.disabled = saving;
    actions.append(submit);
    form.append(actions);

    frame.append(form);
    applyTheme();
  };

  const refreshStorageUsage = async () => {
    if (!images) {
      storageUsage = null;
      storageUsageError = false;
      return;
    }
    try {
      storageUsage = await images.getUsage();
      storageUsageError = false;
    } catch {
      storageUsage = null;
      storageUsageError = true;
    }
  };

  const resetToDefaults = async (returnFocus: HTMLElement) => {
    if (saving) return;
    const confirmed = await confirmDialog({
      title: RESET_DEFAULTS_TITLE,
      message: RESET_DEFAULTS_MESSAGE,
      confirmLabel: RESET_DEFAULTS_CONFIRM,
      cancelLabel: "Cancel",
      returnFocus,
    });
    if (!confirmed) return;
    saving = true;
    error = null;
    savedNote = null;
    draw();
    try {
      await revokeOptionalFeaturePermissions(layout, permissions ?? null);
      layout = await settings.resetToDefaults();
      defaultFolderId = null;
      themeBackground = null;
      saving = false;
      savedNote = "Reset to defaults. Open a new tab to see layout changes.";
      draw();
    } catch (caught) {
      saving = false;
      error =
        caught instanceof Error && caught.message.trim()
          ? caught.message
          : "Could not reset settings.";
      draw();
    }
  };

  const eraseAllData = async (returnFocus: HTMLElement) => {
    if (saving) return;
    const confirmed = await confirmDialog({
      title: ERASE_ALL_TITLE,
      message: ERASE_ALL_MESSAGE,
      confirmLabel: ERASE_ALL_CONFIRM,
      cancelLabel: "Cancel",
      danger: true,
      returnFocus,
    });
    if (!confirmed) return;
    saving = true;
    error = null;
    savedNote = null;
    draw();
    try {
      await revokeOptionalFeaturePermissions(layout, permissions ?? null);
      await settings.clearAll();
      if (images) await images.clearAll();
      layout = { ...DEFAULT_LAYOUT, theme: { ...DEFAULT_LAYOUT.theme } };
      defaultFolderId = null;
      themeBackground = null;
      await refreshStorageUsage();
      saving = false;
      savedNote = "All Hearth data erased. Open a new tab to see the dial.";
      draw();
    } catch (caught) {
      saving = false;
      error =
        caught instanceof Error && caught.message.trim()
          ? caught.message
          : "Could not erase data.";
      draw();
    }
  };

  const save = async () => {
    if (saving) return;
    const form = host.querySelector("form");
    if (!(form instanceof HTMLFormElement)) return;
    const data = new FormData(form);
    const previous = layout;
    const requested: LayoutSettings = {
      columns: Number(data.get("columns")),
      tileSize: Number(data.get("tileSize")),
      reverseOrder: data.get("reverseOrder") === "on",
      thumbnailsEnabled: data.get("thumbnailsEnabled") === "on",
      imageUrlFetchEnabled: data.get("imageUrlFetchEnabled") === "on",
      thumbnailWaitSeconds: Number(data.get("thumbnailWaitSeconds")),
      theme: themeControls?.readTheme() ?? layout.theme,
    };
    const nextDefaultRaw = String(data.get("defaultFolderId") ?? "").trim();
    const nextDefault = nextDefaultRaw.length > 0 ? nextDefaultRaw : null;

    const result = await applyLayoutChange(previous, requested, permissions ?? null);
    layout = result.next;
    error = result.error;
    savedNote = null;

    if (result.earlyDenial) {
      draw();
      try {
        await settings.setLayout(result.next);
      } catch (caught) {
        error =
          caught instanceof Error && caught.message.trim()
            ? caught.message
            : "Could not save settings.";
        draw();
      }
      return;
    }

    saving = true;
    defaultFolderId = nextDefault;
    draw();
    try {
      await settings.setLayout(result.next);
      await settings.setDefaultFolderId(nextDefault);
      saving = false;
      if (!result.error) savedNote = "Saved. Open a new tab to see layout changes.";
      draw();
    } catch (caught) {
      saving = false;
      error = caught instanceof Error && caught.message.trim() ? caught.message : "Could not save settings.";
      draw();
    }
  };

  void (async () => {
    try {
      layout = await settings.getLayout();
      defaultFolderId = await settings.getDefaultFolderId();
      themeBackground = await settings.getThemeBackground();
      if (bookmarks) {
        try {
          folderOptions = dialOpenFolderOptions(await bookmarks.getTree());
        } catch {
          folderOptions = [];
        }
      }
      let changed = false;
      if (layout.thumbnailsEnabled && permissions) {
        const granted = await permissions.hasThumbnailAccess();
        if (!granted) {
          layout = { ...layout, thumbnailsEnabled: false };
          changed = true;
        }
      }
      if (layout.imageUrlFetchEnabled && permissions) {
        const granted = await permissions.hasImageUrlFetchAccess();
        if (!granted) {
          layout = { ...layout, imageUrlFetchEnabled: false };
          changed = true;
        }
      }
      if (changed) void settings.setLayout(layout);
      await refreshStorageUsage();
      applyTheme();
    } catch (caught) {
      error = caught instanceof Error && caught.message.trim() ? caught.message : "Could not load settings.";
    }
    draw();
  })();
}

function category(title: string): HTMLElement {
  const section = document.createElement("section");
  section.className = "settings-category";
  const heading = document.createElement("h2");
  heading.className = "settings-category-title";
  heading.textContent = title;
  section.append(heading);
  return section;
}

/** Labeled readout so dial-picture storage is visible, not another muted help line. */
function dialStorageUsageRow(valueText: string): HTMLElement {
  const root = document.createElement("div");
  root.className = "settings-storage-usage";
  const title = document.createElement("span");
  title.className = "settings-storage-usage-title";
  title.textContent = dialStorageUsageLabel();
  const value = document.createElement("span");
  value.className = "settings-storage-usage-value";
  value.textContent = valueText;
  root.append(title, value);
  return root;
}

function switchControl(
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

function labeled(labelText: string, control: HTMLInputElement): HTMLLabelElement {
  const label = document.createElement("label");
  label.className = "settings-field";
  const caption = document.createElement("span");
  caption.textContent = labelText;
  label.append(caption, control);
  return label;
}

function labeledSelect(labelText: string, control: HTMLSelectElement): HTMLLabelElement {
  const label = document.createElement("label");
  label.className = "settings-field";
  const caption = document.createElement("span");
  caption.textContent = labelText;
  label.append(caption, control);
  return label;
}

function note(text: string, className?: string): HTMLParagraphElement {
  const copy = document.createElement("p");
  if (className) copy.className = className;
  copy.textContent = text;
  return copy;
}
