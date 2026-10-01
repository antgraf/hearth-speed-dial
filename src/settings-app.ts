import type { BookmarksApi } from "./browser.ts";
import { t } from "./i18n.ts";
import { choiceDialog, confirmDialog } from "./dialog.ts";
import {
  bookmarkIdsByUrl,
  bookmarkUrlsById,
  backupFilename,
  buildBackup,
  downloadTextFile,
  importInvalidMessage,
  importMergeLabel,
  importModeMessage,
  importModeTitle,
  importOverwriteLabel,
  parseBackup,
  pickBackupFile,
  planBackupApply,
  serializeBackup,
  type ImportMode,
} from "./backup.ts";
import { buildBackupCategory } from "./backup-settings.ts";
import { dialOpenFolderOptions, nodeIndex, type FolderOption } from "./model.ts";
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
  eraseAllConfirm,
  eraseAllMessage,
  eraseAllTitle,
  LAYOUT_LIMITS,
  resetDefaultsConfirm,
  resetDefaultsMessage,
  resetDefaultsTitle,
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
    brand.textContent = t("brand_name");
    frame.append(brand);

    const title = document.createElement("h1");
    title.textContent = t("settings_title");
    frame.append(title);

    const intro = document.createElement("p");
    intro.className = "settings-intro";
    intro.textContent =
      t("settings_intro");
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

    const layoutCategory = category(t("cat_layout"));

    const columns = document.createElement("input");
    columns.name = "columns";
    bindRangeInput(columns, {
      min: LAYOUT_LIMITS.columns.min,
      max: LAYOUT_LIMITS.columns.max,
      step: 1,
      value: layout.columns,
    });
    columns.disabled = saving;
    columns.setAttribute("aria-label", t("label_columns"));
    layoutCategory.append(labeled(t("label_columns"), columns));
    syncRangeInputValue(columns, layout.columns);
    const columnsHelp = document.createElement("span");
    columnsHelp.className = "settings-help";
    columnsHelp.textContent = t("help_columns");
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
    tileSize.setAttribute("aria-label", t("label_tile_size"));
    layoutCategory.append(labeled(t("label_tile_size"), tileSize));
    syncRangeInputValue(tileSize, layout.tileSize);
    const tileHelp = document.createElement("span");
    tileHelp.className = "settings-help";
    tileHelp.textContent =
      t("help_tile_size");
    layoutCategory.append(tileHelp);
    form.append(layoutCategory);

    const displayCategory = category(t("cat_display"));

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
        t("switch_reverse_title"),
        t("switch_reverse_help"),
      ),
    );

    const defaultFolder = document.createElement("select");
    defaultFolder.name = "defaultFolderId";
    defaultFolder.disabled = saving || folderOptions.length === 0;
    defaultFolder.setAttribute("aria-label", t("label_default_folder"));
    const unsetOption = document.createElement("option");
    unsetOption.value = "";
    unsetOption.textContent = t("option_last_open_folder");
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
      missing.textContent = t("option_missing_folder");
      defaultFolder.append(missing);
      defaultFolder.value = defaultFolderId;
    } else {
      defaultFolder.value = "";
    }
    displayCategory.append(labeledSelect(t("label_default_folder"), defaultFolder));
    const folderHelp = document.createElement("span");
    folderHelp.className = "settings-help";
    folderHelp.textContent =
      t("help_default_folder");
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
              const dataUrl = await fileToDataUrl(file, "background");
              themeBackground = dataUrl;
              await settings.setThemeBackground(dataUrl);
            }
            themeControls?.setBackgroundImage(themeBackground);
            applyTheme();
            savedNote = t("note_background_updated");
            error = null;
            draw();
          } catch (caught) {
            error =
              caught instanceof Error && caught.message.trim()
                ? caught.message
                : t("error_update_background");
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

    const picturesCategory = category(t("cat_pictures"));

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
        t("switch_thumbnails_title"),
        t("switch_thumbnails_help"),
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
        t("switch_image_url_title"),
        t("switch_image_url_help"),
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
    thumbnailWait.setAttribute("aria-label", t("label_thumbnail_wait"));
    picturesCategory.append(labeled(t("label_thumbnail_wait"), thumbnailWait));
    syncRangeInputValue(thumbnailWait, layout.thumbnailWaitSeconds);
    const waitHelp = document.createElement("span");
    waitHelp.className = "settings-help";
    waitHelp.textContent =
      t("help_thumbnail_wait");
    picturesCategory.append(waitHelp);
    if (images) {
      let valueText = t("storage_measuring");
      if (storageUsageError) valueText = t("storage_unavailable");
      else if (storageUsage) valueText = formatDialStorageUsage(storageUsage);
      picturesCategory.append(dialStorageUsageRow(valueText));
    }
    form.append(picturesCategory);

    const backupCategory = buildBackupCategory({
      disabled: saving,
      onExport: () => {
        void exportBackup();
      },
      onImport: () => {
        void importBackup();
      },
    });
    form.append(backupCategory.root);

    // Danger Zone must always remain last if new settings categories are added.
    const dangerCategory = category(t("cat_danger"));
    dangerCategory.classList.add("settings-danger-zone");
    const dangerHelp = document.createElement("span");
    dangerHelp.className = "settings-help";
    dangerHelp.textContent =
      t("danger_help");
    dangerCategory.append(dangerHelp);
    const dangerActions = document.createElement("div");
    dangerActions.className = "settings-danger-actions";
    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "settings-danger-reset";
    resetBtn.textContent = t("btn_reset_defaults");
    resetBtn.disabled = saving;
    const eraseBtn = document.createElement("button");
    eraseBtn.type = "button";
    eraseBtn.className = "settings-danger-erase";
    eraseBtn.textContent = t("btn_erase_all");
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
    submit.textContent = saving ? t("btn_saving") : t("btn_save");
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
      title: resetDefaultsTitle(),
      message: resetDefaultsMessage(),
      confirmLabel: resetDefaultsConfirm(),
      cancelLabel: t("btn_cancel"),
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
      savedNote = t("note_reset");
      draw();
    } catch (caught) {
      saving = false;
      error =
        caught instanceof Error && caught.message.trim()
          ? caught.message
          : t("error_reset_settings");
      draw();
    }
  };

  const eraseAllData = async (returnFocus: HTMLElement) => {
    if (saving) return;
    const confirmed = await confirmDialog({
      title: eraseAllTitle(),
      message: eraseAllMessage(),
      confirmLabel: eraseAllConfirm(),
      cancelLabel: t("btn_cancel"),
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
      savedNote = t("note_erased");
      draw();
    } catch (caught) {
      saving = false;
      error =
        caught instanceof Error && caught.message.trim()
          ? caught.message
          : t("error_erase_data");
      draw();
    }
  };

  const exportBackup = async () => {
    if (saving) return;
    saving = true;
    error = null;
    savedNote = null;
    draw();
    try {
      const openFolderId = await settings.getOpenFolderId();
      const imageMap = images ? await images.getAll() : {};
      let imageUrls: Record<string, string> = {};
      if (bookmarks) {
        try {
          imageUrls = bookmarkUrlsById(await bookmarks.getTree());
        } catch {
          imageUrls = {};
        }
      }
      const backup = buildBackup({
        layout,
        defaultFolderId,
        openFolderId,
        themeBackground,
        images: imageMap,
        imageUrls,
      });
      downloadTextFile(backupFilename(), serializeBackup(backup));
      saving = false;
      savedNote = t("note_backup_downloaded");
      draw();
    } catch (caught) {
      saving = false;
      error =
        caught instanceof Error && caught.message.trim()
          ? caught.message
          : t("error_export_backup");
      draw();
    }
  };

  const importBackup = async () => {
    if (saving) return;
    const file = await pickBackupFile();
    if (!file) return;
    let raw: string;
    try {
      raw = await file.text();
      parseBackup(raw);
    } catch (caught) {
      error =
        caught instanceof Error && caught.message.trim()
          ? caught.message
          : importInvalidMessage();
      savedNote = null;
      draw();
      return;
    }
    const mode = await choiceDialog<ImportMode>({
      title: importModeTitle(),
      message: importModeMessage(),
      choices: [
        { value: "merge", label: importMergeLabel(), primary: true },
        { value: "overwrite", label: importOverwriteLabel(), danger: true },
      ],
      cancelLabel: t("btn_cancel"),
    });
    if (!mode) return;

    saving = true;
    error = null;
    savedNote = null;
    draw();
    try {
      const backup = parseBackup(raw);
      let existingIds: Set<string> | undefined;
      let urlToId: Map<string, string> | undefined;
      if (bookmarks) {
        try {
          const tree = await bookmarks.getTree();
          existingIds = new Set(nodeIndex(tree).keys());
          urlToId = bookmarkIdsByUrl(tree);
        } catch {
          existingIds = undefined;
          urlToId = undefined;
        }
      }
      const plan = planBackupApply(backup, mode, { existingIds, urlToId });

      await revokeOptionalFeaturePermissions(
        {
          ...layout,
          thumbnailsEnabled: layout.thumbnailsEnabled && !plan.layout.thumbnailsEnabled,
          imageUrlFetchEnabled:
            layout.imageUrlFetchEnabled && !plan.layout.imageUrlFetchEnabled,
        },
        permissions ?? null,
      );

      if (plan.clearAllImages && images) await images.clearAll();
      if (images) {
        for (const [id, dataUrl] of Object.entries(plan.imagesToSet)) {
          await images.setImage(id, dataUrl);
        }
      }
      await settings.setLayout(plan.layout);
      await settings.setDefaultFolderId(plan.defaultFolderId);
      if (plan.openFolderId) await settings.setOpenFolderId(plan.openFolderId);
      if (plan.themeBackground !== undefined) {
        await settings.setThemeBackground(plan.themeBackground);
        themeBackground = plan.themeBackground;
      }
      layout = plan.layout;
      defaultFolderId = plan.defaultFolderId;
      await refreshStorageUsage();
      saving = false;
      savedNote =
        mode === "overwrite"
          ? t("note_import_overwrite")
          : t("note_import_merge");
      draw();
    } catch (caught) {
      saving = false;
      error =
        caught instanceof Error && caught.message.trim()
          ? caught.message
          : t("error_import_backup");
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
            : t("error_save_settings");
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
      if (!result.error) savedNote = t("note_saved");
      draw();
    } catch (caught) {
      saving = false;
      error = caught instanceof Error && caught.message.trim() ? caught.message : t("error_save_settings");
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
      error = caught instanceof Error && caught.message.trim() ? caught.message : t("error_load_settings");
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
