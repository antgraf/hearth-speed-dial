import {
  backupFilename,
  bookmarkIdsByUrl,
  bookmarkUrlsById,
  buildBackup,
  downloadTextFile,
  parseBackup,
  planBackupApply,
  serializeBackup,
  type ImportMode,
} from "./backup.ts";
import {
  acceptsChildren,
  alreadyInFolder,
  bookmarkRoot,
  bookmarkUrl,
  classify,
  folderName,
  moveIntoFolderError,
  nodeIndex,
  openableUrl,
  parentIds,
  refreshableThumbnailTargets,
  reorderMoveIndex,
  type BookmarkNode,
} from "./model.ts";
import {
  canDeleteNode,
  canRenameNode,
  deleteConfirmMessage,
  present,
  refreshAllThumbnailsConfirm,
  refreshAllThumbnailsTitle,
  refreshAllThumbnailsConfirmMessage,
  refreshAllThumbnailsFailureMessage,
  type AppState,
  type CreateKind,
} from "./present.ts";
import {
  refreshThumbnailsBestEffort,
  thumbnailRefreshFailureSummary,
} from "./thumbnail-refresh.ts";
import type { BookmarksApi } from "./browser.ts";
import { REFRESH_ALL_MENU_ID } from "./background-service.ts";
import { confirmDialog, type ConfirmDialogOptions } from "./dialog.ts";
import { fetchImageAsDataUrl, fileToDataUrl, imageSourceUrl, imageUrlInvalidMessage, type ImagesApi } from "./images.ts";
import { t } from "./i18n.ts";
import { isRefreshAllThumbnailsMessage } from "./messages.ts";
import {
  imageUrlPermissionDeniedMessage,
  imageUrlUnavailableMessage,
  thumbnailPermissionDeniedMessage,
  thumbnailUnavailableMessage,
  type CaptureApi,
  type PermissionsApi,
} from "./permissions.ts";
import { tryExtensionApi } from "./webext.ts";
import {
  DEFAULT_LAYOUT,
  thumbnailWaitMs,
  type DangerZoneResult,
  type LayoutSettings,
  type SettingsApi,
} from "./settings.ts";
import { applyLayoutChange, revokeOptionalFeaturePermissions } from "./toggles.ts";
import { applyThemeToDocument } from "./theme.ts";
import { render as defaultRender, requestSearchFocus, type ViewActions } from "./view.ts";

function isEditableKeyTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function dialDialogOpen(doc: Document): boolean {
  return Boolean(doc.querySelector(".dialog-root"));
}

export type AppPorts = {
  bookmarks: BookmarksApi;
  settings: SettingsApi;
  images: ImagesApi;
  permissions: PermissionsApi;
  capture: CaptureApi;
  banner?: string | null;
  /**
   * DOM render seam for tests. Defaults to `view.render`.
   * Production callers omit this.
   */
  render?: (host: HTMLElement, view: ReturnType<typeof present>, actions: ViewActions) => void;
  /**
   * Confirm-dialog seam for tests. Defaults to `confirmDialog`.
   * Production callers omit this.
   */
  confirm?: (options: ConfirmDialogOptions) => Promise<boolean>;
};

export function start(host: HTMLElement, ports: AppPorts): () => void {
  const drawView = ports.render ?? defaultRender;
  const confirm = ports.confirm ?? confirmDialog;
  const state: AppState = {
    banner: ports.banner ?? null,
    status: "loading",
    error: null,
    tree: [],
    currentId: null,
    defaultFolderId: null,
    form: null,
    saving: false,
    layout: { ...DEFAULT_LAYOUT, theme: { ...DEFAULT_LAYOUT.theme } },
    images: {},
    themeBackground: null,
    thumbnailsActive: false,
    imageUrlFetchActive: false,
    searchQuery: "",
    // Hide until boot reads storage so returning users do not flash the card.
    welcomeDismissed: true,
  };
  let request = 0;
  /** Last-open folder from storage; used once if the default folder is missing. */
  let bootOpenFolderId: string | null = null;
  let colorSchemeMedia: MediaQueryList | null = null;
  let onColorSchemeChange: (() => void) | null = null;

  const applyTheme = () => {
    if (typeof document === "undefined") return;
    applyThemeToDocument(document.documentElement, state.layout.theme, {
      backgroundImage: state.themeBackground,
    });
  };

  const draw = () => {
    applyTheme();
    const view = present(state);
    drawView(host, view, {
      openFolder: (id) => {
        void showFolder(id);
      },
      goToFolder: (id) => {
        void showFolder(id);
      },
      beginCreate: (kind) => {
        if (state.saving) return;
        state.error = null;
        state.form = { mode: "create", kind, title: "", url: "" };
        draw();
      },
      beginEdit: (id) => {
        if (state.saving) return;
        const node = nodeIndex(state.tree).get(id);
        if (!canRenameNode(node) || !node) return;
        const kind = classify(node) === "folder" ? "folder" : "bookmark";
        state.error = null;
        state.form = {
          mode: "edit",
          id: node.id,
          kind,
          title: node.title,
          url: kind === "bookmark" ? (node.url ?? "") : "",
        };
        draw();
      },
      requestDelete: (id) => {
        void deleteNode(id);
      },
      cancelForm: () => {
        if (state.saving) return;
        state.form = null;
        state.error = null;
        draw();
      },
      submitForm: (input) => {
        void saveForm(input);
      },
      reorderDial: (draggedId, beforeId) => {
        void reorderDial(draggedId, beforeId);
      },
      moveDialInto: (draggedId, parentId) => {
        void moveDialInto(draggedId, parentId);
      },
      attachImage: (id, file) => {
        void attachImage(id, file);
      },
      attachImageUrl: (id, url) => {
        void attachImageUrl(id, url);
      },
      captureThumbnail: (id) => {
        void captureThumbnail(id);
      },
      refreshAllThumbnails: () => {
        void refreshAllThumbnails();
      },
      clearImage: (id) => {
        void clearImage(id);
      },
      setLayout: (layout) => saveLayout(layout),
      setDefaultFolderId: (id) => saveDefaultFolderId(id),
      setThemeBackground: (file) => saveThemeBackground(file),
      resetToDefaults: () => resetToDefaults(),
      eraseAllData: () => eraseAllData(),
      exportPicturesAndSettings: () => exportPicturesAndSettings(),
      importPicturesAndSettings: (raw, mode) => importPicturesAndSettings(raw, mode),
      getImageStorageUsage: () => ports.images.getUsage(),
      getThemeBackground: () => Promise.resolve(state.themeBackground),
      setSearchQuery: (query) => {
        state.searchQuery = query;
        state.error = null;
        draw();
      },
      clearSearch: () => {
        if (!state.searchQuery) return;
        state.searchQuery = "";
        state.error = null;
        draw();
      },
      dismissWelcome: () => {
        void dismissWelcome();
      },
    });
    // Hide the dial-page context-menu item when Refresh All has nothing to do
    // (bookmark root / folders with no direct http(s) children).
    syncRefreshAllContextMenu(view.name === "grid" && view.canRefreshAll);
  };

  const syncRefreshAllContextMenu = (visible: boolean): void => {
    const api = tryExtensionApi();
    try {
      void api?.contextMenus?.update?.(REFRESH_ALL_MENU_ID, { visible });
    } catch {
      // Menu may not be registered yet; ignore.
    }
  };
  const syncThumbnailActive = async (preferEnabled: boolean): Promise<boolean> => {
    if (!preferEnabled) {
      state.thumbnailsActive = false;
      return false;
    }
    const granted = await ports.permissions.hasThumbnailAccess();
    state.thumbnailsActive = granted;
    return granted;
  };

  const syncImageUrlFetchActive = async (preferEnabled: boolean): Promise<boolean> => {
    if (!preferEnabled) {
      state.imageUrlFetchActive = false;
      return false;
    }
    const granted = await ports.permissions.hasImageUrlFetchAccess();
    state.imageUrlFetchActive = granted;
    return granted;
  };

  const showFolder = async (id: string) => {
    const folder = nodeIndex(state.tree).get(id);
    if (!folder || classify(folder) !== "folder") return;
    state.currentId = id;
    state.form = null;
    state.searchQuery = "";
    state.error = null;
    draw();
    try {
      await ports.settings.setOpenFolderId(id);
    } catch (error) {
      state.error = errorText(error);
      draw();
    }
  };

  const deleteNode = async (id: string) => {
    if (state.saving) return;
    const node = nodeIndex(state.tree).get(id);
    if (!canDeleteNode(node) || !node) return;
    const kind = classify(node);
    const confirmed = await confirm({
      title: kind === "folder" ? t("delete_folder_title") : t("delete_bookmark_title"),
      message: deleteConfirmMessage(node),
      confirmLabel: t("btn_delete"),
      cancelLabel: t("btn_cancel"),
      danger: true,
    });
    if (!confirmed) return;
    const removedIds = collectDescendantIds(node);
    state.form = null;
    state.saving = true;
    state.error = null;
    draw();
    try {
      await ports.bookmarks.remove(id);
      // Best-effort: clear pictures for the deleted node (and folder contents).
      await Promise.allSettled(removedIds.map((removedId) => ports.images.clearImage(removedId)));
      state.saving = false;
      await reload();
    } catch (error) {
      state.saving = false;
      state.error = errorText(error);
      draw();
    }
  };

  const attachImage = async (id: string, file: File) => {
    if (state.saving) return;
    const node = nodeIndex(state.tree).get(id);
    if (!node || classify(node) === "skip") return;
    state.saving = true;
    state.error = null;
    draw();
    try {
      const dataUrl = await fileToDataUrl(file, "tile");
      await ports.images.setImage(id, dataUrl);
      state.images = { ...state.images, [id]: dataUrl };
      state.saving = false;
      draw();
    } catch (error) {
      state.saving = false;
      state.error = errorText(error);
      draw();
    }
  };

  const attachImageUrl = async (id: string, rawUrl: string) => {
    if (state.saving) return;
    const node = nodeIndex(state.tree).get(id);
    if (!node || classify(node) === "skip") return;
    const href = imageSourceUrl(rawUrl);
    if (!href) {
      state.error = imageUrlInvalidMessage();
      draw();
      return;
    }
    if (!state.layout.imageUrlFetchEnabled) {
      state.error = imageUrlUnavailableMessage();
      draw();
      return;
    }
    const featureGranted = await syncImageUrlFetchActive(true);
    if (!featureGranted) {
      state.layout = { ...state.layout, imageUrlFetchEnabled: false };
      state.error = imageUrlPermissionDeniedMessage();
      draw();
      try {
        await ports.settings.setLayout(state.layout);
      } catch (error) {
        state.error = errorText(error);
        draw();
      }
      return;
    }
    state.saving = true;
    state.error = null;
    draw();
    try {
      // Host access comes from the Settings URL-images toggle (http/https
      // wildcards or <all_urls>). Do not call permissions.request here — any
      // prior await (syncImageUrlFetchActive) already consumed Firefox’s
      // user-gesture, and the toggle path is the supported grant UX.
      const dataUrl = await fetchImageAsDataUrl(href, fetch, "tile");
      await ports.images.setImage(id, dataUrl);
      state.images = { ...state.images, [id]: dataUrl };
      state.saving = false;
      draw();
    } catch (error) {
      state.saving = false;
      state.error = errorText(error);
      draw();
    }
  };

  const ensureThumbnailCaptureReady = async (): Promise<boolean> => {
    if (!state.layout.thumbnailsEnabled) {
      state.error = thumbnailUnavailableMessage();
      draw();
      return false;
    }
    const granted = await syncThumbnailActive(true);
    if (!granted) {
      state.layout = { ...state.layout, thumbnailsEnabled: false };
      state.error = thumbnailPermissionDeniedMessage();
      draw();
      try {
        await ports.settings.setLayout(state.layout);
      } catch {
        // Keep the in-memory off state even if persist fails.
      }
      return false;
    }
    return true;
  };

  const captureAndStoreThumbnail = async (id: string, pageUrl: string): Promise<void> => {
    const dataUrl = await ports.capture.capturePage(
      pageUrl,
      thumbnailWaitMs(state.layout.thumbnailWaitSeconds),
    );
    await ports.images.setImage(id, dataUrl);
    state.images = { ...state.images, [id]: dataUrl };
  };

  const captureThumbnail = async (id: string) => {
    if (state.saving) return;
    const node = nodeIndex(state.tree).get(id);
    if (!node || classify(node) !== "link" || !node.url) return;
    const pageUrl = openableUrl(node.url);
    if (!pageUrl || pageUrl.startsWith("file:")) {
      state.error = t("error_thumbnails_http_only");
      draw();
      return;
    }
    if (!(await ensureThumbnailCaptureReady())) return;
    state.saving = true;
    state.error = null;
    draw();
    try {
      await captureAndStoreThumbnail(id, pageUrl);
      state.saving = false;
      draw();
    } catch (error) {
      state.saving = false;
      state.error = errorText(error);
      draw();
    }
  };

  const refreshAllThumbnails = async () => {
    if (state.saving) return;
    const folder = nodeIndex(state.tree).get(state.currentId ?? "");
    if (!folder || classify(folder) !== "folder") return;
    const targets = refreshableThumbnailTargets(folder);
    if (targets.length === 0) {
      // Menu should already be hidden; stay quiet if a stale click arrives.
      return;
    }
    if (!(await ensureThumbnailCaptureReady())) return;
    const confirmed = await confirm({
      title: refreshAllThumbnailsTitle(),
      message: refreshAllThumbnailsConfirmMessage(targets.length),
      confirmLabel: refreshAllThumbnailsConfirm(),
      cancelLabel: t("btn_cancel"),
      danger: true,
    });
    if (!confirmed) return;
    state.form = null;
    state.saving = true;
    state.error = null;
    draw();
    // Per-tile failures must not abort the batch — continue best-effort.
    const results = await refreshThumbnailsBestEffort(
      targets,
      captureAndStoreThumbnail,
      errorText,
      draw,
    );
    state.saving = false;
    const summary = thumbnailRefreshFailureSummary(results);
    state.error = summary
      ? refreshAllThumbnailsFailureMessage(summary.failed, summary.total, summary.detail)
      : null;
    draw();
  };

  const clearImage = async (id: string) => {
    if (state.saving) return;
    state.saving = true;
    state.error = null;
    draw();
    try {
      await ports.images.clearImage(id);
      const next = { ...state.images };
      delete next[id];
      state.images = next;
      state.saving = false;
      draw();
    } catch (error) {
      state.saving = false;
      state.error = errorText(error);
      draw();
    }
  };

  const reorderDial = async (draggedId: string, beforeId: string | null) => {
    if (state.saving) return;
    const folder = nodeIndex(state.tree).get(state.currentId ?? "");
    if (!folder || classify(folder) !== "folder" || !folder.children) return;
    const index = reorderMoveIndex(folder.children, draggedId, beforeId);
    if (index === null) return;
    state.form = null;
    state.saving = true;
    state.error = null;
    draw();
    try {
      // Same parentId keeps the move in-folder; subscribe/reload apply the new order.
      await ports.bookmarks.move(draggedId, { parentId: folder.id, index });
      state.saving = false;
      await reload();
    } catch (error) {
      state.saving = false;
      state.error = errorText(error);
      draw();
    }
  };

  const moveDialInto = async (draggedId: string, parentId: string) => {
    if (state.saving) return;
    const illegal = moveIntoFolderError(state.tree, draggedId, parentId);
    if (illegal) {
      state.error = illegal;
      draw();
      return;
    }
    if (alreadyInFolder(state.tree, draggedId, parentId)) return;
    state.form = null;
    state.saving = true;
    state.error = null;
    draw();
    try {
      // Omit index so Chrome appends at the end of the destination folder.
      await ports.bookmarks.move(draggedId, { parentId });
      state.saving = false;
      await reload();
    } catch (error) {
      state.saving = false;
      state.error = errorText(error);
      draw();
    }
  };

  const saveLayout = async (layout: LayoutSettings): Promise<LayoutSettings> => {
    const previous = state.layout;
    const result = await applyLayoutChange(previous, layout, ports.permissions);
    state.layout = result.next;
    state.thumbnailsActive = result.thumbnailsActive;
    state.imageUrlFetchActive = result.imageUrlFetchActive;
    state.error = result.error;
    draw();
    try {
      await ports.settings.setLayout(result.next);
    } catch (error) {
      state.error = errorText(error);
      draw();
    }
    return result.next;
  };

  const saveDefaultFolderId = async (id: string | null): Promise<void> => {
    state.defaultFolderId = id;
    try {
      await ports.settings.setDefaultFolderId(id);
    } catch (error) {
      state.error = errorText(error);
      draw();
    }
  };

  const saveThemeBackground = async (file: File | null): Promise<void> => {
    try {
      if (file == null) {
        state.themeBackground = null;
        await ports.settings.setThemeBackground(null);
      } else {
        const dataUrl = await fileToDataUrl(file, "background");
        state.themeBackground = dataUrl;
        await ports.settings.setThemeBackground(dataUrl);
      }
      state.error = null;
      draw();
    } catch (error) {
      state.error = errorText(error);
      draw();
      // Rethrow so Settings overlay / options page can show an in-dialog error
      // (the dial banner alone is hidden behind the Settings panel).
      throw error instanceof Error ? error : new Error(errorText(error));
    }
  };

  const resetToDefaults = async (): Promise<DangerZoneResult> => {
    const previous = state.layout;
    await revokeOptionalFeaturePermissions(previous, ports.permissions);
    const layout = { ...DEFAULT_LAYOUT, theme: { ...DEFAULT_LAYOUT.theme } };
    state.layout = layout;
    state.defaultFolderId = null;
    state.themeBackground = null;
    state.thumbnailsActive = false;
    state.imageUrlFetchActive = false;
    state.error = null;
    draw();
    try {
      await ports.settings.resetToDefaults();
    } catch (error) {
      state.error = errorText(error);
      draw();
    }
    return { layout, defaultFolderId: null, themeBackground: null };
  };

  const eraseAllData = async (): Promise<DangerZoneResult> => {
    const previous = state.layout;
    await revokeOptionalFeaturePermissions(previous, ports.permissions);
    const layout = { ...DEFAULT_LAYOUT, theme: { ...DEFAULT_LAYOUT.theme } };
    state.layout = layout;
    state.defaultFolderId = null;
    state.images = {};
    state.themeBackground = null;
    state.thumbnailsActive = false;
    state.imageUrlFetchActive = false;
    state.welcomeDismissed = false;
    state.error = null;
    draw();
    try {
      await ports.settings.clearAll();
      await ports.images.clearAll();
    } catch (error) {
      state.error = errorText(error);
      draw();
    }
    return { layout, defaultFolderId: null, themeBackground: null };
  };

  const dismissWelcome = async (): Promise<void> => {
    if (state.welcomeDismissed) return;
    state.welcomeDismissed = true;
    state.error = null;
    draw();
    try {
      await ports.settings.setWelcomeDismissed(true);
    } catch (error) {
      state.welcomeDismissed = false;
      state.error = errorText(error);
      draw();
    }
  };

  const exportPicturesAndSettings = async (): Promise<void> => {
    try {
      const openFolderId = await ports.settings.getOpenFolderId();
      const urls = bookmarkUrlsById(state.tree);
      const backup = buildBackup({
        layout: state.layout,
        defaultFolderId: state.defaultFolderId,
        openFolderId,
        themeBackground: state.themeBackground,
        images: state.images,
        imageUrls: urls,
      });
      downloadTextFile(backupFilename(), serializeBackup(backup));
      state.error = null;
      draw();
    } catch (error) {
      state.error = errorText(error);
      draw();
    }
  };

  const importPicturesAndSettings = async (
    rawJson: string,
    mode: ImportMode,
  ): Promise<DangerZoneResult> => {
    const backup = parseBackup(rawJson);
    const existingIds = new Set(nodeIndex(state.tree).keys());
    const plan = planBackupApply(backup, mode, {
      existingIds,
      urlToId: bookmarkIdsByUrl(state.tree),
    });

    const previous = state.layout;
    // Drop optional grants only for features the import turns off.
    await revokeOptionalFeaturePermissions(
      {
        ...previous,
        thumbnailsEnabled: previous.thumbnailsEnabled && !plan.layout.thumbnailsEnabled,
        imageUrlFetchEnabled:
          previous.imageUrlFetchEnabled && !plan.layout.imageUrlFetchEnabled,
      },
      ports.permissions,
    );

    try {
      if (plan.clearAllImages) await ports.images.clearAll();
      for (const [id, dataUrl] of Object.entries(plan.imagesToSet)) {
        await ports.images.setImage(id, dataUrl);
      }
      await ports.settings.setLayout(plan.layout);
      await ports.settings.setDefaultFolderId(plan.defaultFolderId);
      if (plan.openFolderId) await ports.settings.setOpenFolderId(plan.openFolderId);
      if (plan.themeBackground !== undefined) {
        await ports.settings.setThemeBackground(plan.themeBackground);
        state.themeBackground = plan.themeBackground;
      }

      state.layout = plan.layout;
      state.defaultFolderId = plan.defaultFolderId;
      if (plan.clearAllImages) {
        state.images = { ...plan.imagesToSet };
      } else {
        state.images = { ...state.images, ...plan.imagesToSet };
      }
      await syncThumbnailActive(plan.layout.thumbnailsEnabled);
      await syncImageUrlFetchActive(plan.layout.imageUrlFetchEnabled);
      state.error = null;

      if (plan.openFolderId && nodeIndex(state.tree).has(plan.openFolderId)) {
        state.currentId = plan.openFolderId;
        state.searchQuery = "";
      }
      draw();
    } catch (error) {
      state.error = errorText(error);
      draw();
      throw error;
    }

    return {
      layout: state.layout,
      defaultFolderId: state.defaultFolderId,
      themeBackground: state.themeBackground,
    };
  };

  const saveForm = async (input: { title: string; url: string }) => {
    if (state.saving || !state.form) return;
    if (state.form.mode === "create") await saveCreate(input);
    else await saveEdit(input);
  };

  const saveCreate = async (input: { title: string; url: string }) => {
    if (!state.form || state.form.mode !== "create") return;
    const parent = nodeIndex(state.tree).get(state.currentId ?? "");
    if (!parent || !acceptsChildren(parent)) return;
    const kind: CreateKind = state.form.kind;
    const title = folderName(input.title);
    const url = kind === "bookmark" ? bookmarkUrl(input.url) : null;
    if (!title || (kind === "bookmark" && !url)) {
      state.form = { mode: "create", kind, title: input.title, url: input.url };
      state.error = kind === "folder" ? t("error_name_folder") : t("error_name_bookmark");
      draw();
      return;
    }
    state.form = { mode: "create", kind, title, url: input.url };
    state.saving = true;
    state.error = null;
    draw();
    try {
      if (kind === "folder") await ports.bookmarks.createFolder(parent.id, title);
      else await ports.bookmarks.createBookmark(parent.id, title, url ?? "");
      state.form = null;
      state.saving = false;
      await reload();
    } catch (error) {
      state.saving = false;
      state.error = errorText(error);
      draw();
    }
  };

  const saveEdit = async (input: { title: string; url: string }) => {
    if (!state.form || state.form.mode !== "edit") return;
    const node = nodeIndex(state.tree).get(state.form.id);
    if (!canRenameNode(node) || !node) return;
    const kind = state.form.kind;
    const title = folderName(input.title);
    const url = kind === "bookmark" ? bookmarkUrl(input.url) : null;
    if (!title || (kind === "bookmark" && !url)) {
      state.form = { mode: "edit", id: state.form.id, kind, title: input.title, url: input.url };
      state.error = kind === "folder" ? t("error_name_folder") : t("error_name_bookmark");
      draw();
      return;
    }
    state.form = { mode: "edit", id: state.form.id, kind, title, url: input.url };
    state.saving = true;
    state.error = null;
    draw();
    try {
      if (kind === "folder") await ports.bookmarks.update(state.form.id, { title });
      else await ports.bookmarks.update(state.form.id, { title, url: url ?? undefined });
      state.form = null;
      state.saving = false;
      await reload();
    } catch (error) {
      state.saving = false;
      state.error = errorText(error);
      draw();
    }
  };

  const reload = async () => {
    const ticket = ++request;
    const previousId = state.currentId;
    try {
      const tree = await ports.bookmarks.getTree();
      if (ticket !== request) return;
      state.tree = tree;
      state.status = "ready";
      state.error = null;
      state.saving = false;
      const opened = resolveFolder(state, bootOpenFolderId);
      bootOpenFolderId = null;
      state.currentId = opened;
      if (opened && opened !== previousId) void ports.settings.setOpenFolderId(opened);
      try {
        const images = await ports.images.getAll();
        if (ticket !== request) return;
        state.images = images;
        // Best-effort orphan sweep when bookmarks were removed outside Hearth.
        void ports.images.clearMissing(new Set(nodeIndex(tree).keys()));
      } catch (imageError) {
        if (ticket !== request) return;
        state.error = errorText(imageError);
      }
    } catch (error) {
      if (ticket !== request) return;
      state.status = state.tree.length > 0 ? "ready" : "failed";
      state.error = errorText(error);
      state.saving = false;
    }
    if (ticket === request) draw();
  };

  let unsubscribe = (): void => undefined;
  try {
    unsubscribe = ports.bookmarks.subscribe(() => {
      void reload();
    });
  } catch (error) {
    state.error = errorText(error);
  }

  const onRuntimeMessage = (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ): boolean => {
    if (!isRefreshAllThumbnailsMessage(message)) return false;
    void refreshAllThumbnails();
    sendResponse({ ok: true });
    return true;
  };
  const runtimeApi = tryExtensionApi();
  if (runtimeApi?.runtime?.onMessage) {
    runtimeApi.runtime.onMessage.addListener(onRuntimeMessage);
  }

  void (async () => {
    try {
      const defaultFolderId = await ports.settings.getDefaultFolderId();
      const openFolderId = await ports.settings.getOpenFolderId();
      state.defaultFolderId = defaultFolderId;
      bootOpenFolderId = openFolderId;
      // Set default folder wins for new window / initial new-tab open; otherwise last open.
      state.currentId = defaultFolderId ?? openFolderId;
      const layout = await ports.settings.getLayout();
      state.layout = layout;
      state.themeBackground = await ports.settings.getThemeBackground();
      state.welcomeDismissed = await ports.settings.getWelcomeDismissed();
      const thumbnailsActive = await syncThumbnailActive(layout.thumbnailsEnabled);
      const imageUrlFetchActive = await syncImageUrlFetchActive(layout.imageUrlFetchEnabled);
      let nextLayout = layout;
      if (layout.thumbnailsEnabled && !thumbnailsActive) {
        // Permission revoked while the preference was on — degrade gracefully.
        nextLayout = { ...nextLayout, thumbnailsEnabled: false };
      }
      if (layout.imageUrlFetchEnabled && !imageUrlFetchActive) {
        nextLayout = { ...nextLayout, imageUrlFetchEnabled: false };
      }
      if (nextLayout !== layout) {
        state.layout = nextLayout;
        void ports.settings.setLayout(state.layout);
      }
      applyTheme();
      if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
        colorSchemeMedia = window.matchMedia("(prefers-color-scheme: dark)");
        onColorSchemeChange = () => {
          if (state.layout.theme.mode === "auto") applyTheme();
        };
        colorSchemeMedia.addEventListener("change", onColorSchemeChange);
      }
    } catch (error) {
      state.error = errorText(error);
    }
    await reload();
  })();

  const onDocumentKeydown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const doc = typeof document !== "undefined" ? document : null;
    if (!doc) return;

    if (event.key === "/" && !event.shiftKey) {
      if (state.status !== "ready" || state.saving) return;
      if (dialDialogOpen(doc) || isEditableKeyTarget(event.target)) return;
      event.preventDefault();
      const existing = doc.querySelector<HTMLInputElement>(".dial-search-input");
      if (existing) {
        existing.focus();
        return;
      }
      requestSearchFocus();
      draw();
      return;
    }

    if (event.key === "Escape") {
      if (dialDialogOpen(doc)) return;
      if (!state.searchQuery) return;
      if (isEditableKeyTarget(event.target)) {
        const target = event.target;
        if (
          target instanceof HTMLInputElement &&
          target.classList.contains("dial-search-input")
        ) {
          // Search input handles Escape itself (clear / blur).
          return;
        }
        // Create form / other fields keep their own Escape behavior.
        return;
      }
      event.preventDefault();
      state.searchQuery = "";
      state.error = null;
      draw();
    }
  };
  if (typeof document !== "undefined") {
    document.addEventListener("keydown", onDocumentKeydown);
  }

  return () => {
    unsubscribe();
    if (typeof document !== "undefined") {
      document.removeEventListener("keydown", onDocumentKeydown);
    }
    if (colorSchemeMedia && onColorSchemeChange) {
      colorSchemeMedia.removeEventListener("change", onColorSchemeChange);
    }
    if (runtimeApi?.runtime?.onMessage) {
      runtimeApi.runtime.onMessage.removeListener(onRuntimeMessage);
    }
  };
}

function collectDescendantIds(node: BookmarkNode): string[] {
  const ids: string[] = [node.id];
  const walk = (children: readonly BookmarkNode[] | undefined) => {
    if (!children) return;
    for (const child of children) {
      ids.push(child.id);
      walk(child.children);
    }
  };
  walk(node.children);
  return ids;
}

function resolveFolder(state: AppState, fallbackId: string | null = null): string | null {
  const root = bookmarkRoot(state.tree);
  if (!root) return null;
  const usable = (id: string | null): string | null => {
    if (!id) return null;
    const current = nodeIndex(state.tree).get(id);
    if (current && classify(current) === "folder" && isInside(state.tree, root.id, current.id)) {
      return current.id;
    }
    return null;
  };
  return usable(state.currentId) ?? usable(fallbackId) ?? root.id;
}

function isInside(tree: readonly BookmarkNode[], rootId: string, id: string): boolean {
  const parents = parentIds(tree);
  const seen = new Set<string>();
  let current: string | undefined = id;
  while (current && !seen.has(current)) {
    if (current === rootId) return true;
    seen.add(current);
    current = parents.get(current);
  }
  return false;
}

function errorText(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return t("error_generic_bookmarks");
}
