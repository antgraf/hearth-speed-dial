import assert from "node:assert/strict";
import { afterEach, before, test } from "node:test";
import { Window } from "happy-dom";
import { DEFAULT_LAYOUT } from "./settings.ts";
import type { ViewModel } from "./present.ts";
import { render, type ViewActions } from "./view.ts";
import { folderDeepLinkHref, folderDeepLinkPath } from "./folder-deeplink.ts";
import { t } from "./i18n.ts";

type DomKit = {
  window: Window;
  document: Document;
  host: HTMLElement;
};

let kit: DomKit;

before(() => {
  const window = new Window({ url: "https://hearth.test/" });
  const document = window.document as unknown as Document;
  globalThis.document = document;
  globalThis.Document = window.Document as unknown as typeof Document;
  globalThis.HTMLElement = window.HTMLElement as unknown as typeof HTMLElement;
  globalThis.KeyboardEvent = window.KeyboardEvent as unknown as typeof KeyboardEvent;

  const host = document.createElement("div");
  host.id = "app";
  document.body.append(host);
  kit = { window, document, host };
});

afterEach(() => {
  kit.host.replaceChildren();
  for (const root of kit.document.querySelectorAll(".dialog-root")) {
    root.remove();
  }
  for (const toast of kit.document.querySelectorAll(".status-toast")) {
    toast.remove();
  }
});

function gridView(overrides: Partial<Extract<ViewModel, { name: "grid" }>> = {}): Extract<
  ViewModel,
  { name: "grid" }
> {
  return {
    name: "grid",
    banner: null,
    crumbs: [{ id: "1", title: "Bookmarks bar", isRoot: false }],
    items: [
      {
        id: "10",
        title: "News",
        kind: "folder",
        url: null,
        meta: "Folder",
        monogram: "N",
        imageDataUrl: null,
      },
      {
        id: "11",
        title: "Example",
        kind: "link",
        url: "https://example.com/",
        meta: "example.com",
        monogram: "E",
        imageDataUrl: null,
      },
    ],
    empty: null,
    error: null,
    canCreate: true,
    canRenameCurrent: true,
    canDeleteCurrent: true,
    canRefreshAll: true,
    currentFolder: { id: "1", title: "Bookmarks bar", imageDataUrl: null, kind: "folder", url: null },
    form: null,
    saving: false,
    layout: { ...DEFAULT_LAYOUT, theme: { ...DEFAULT_LAYOUT.theme } },
    defaultFolderId: null,
    defaultFolderOptions: [{ id: "1", title: "Bookmarks bar", depth: 0 }],
    thumbnailsActive: false,
    imageUrlFetchActive: false,
    searchQuery: "",
    searching: false,
    showWelcome: false,
    ...overrides,
  };
}

function actions(partial: Partial<ViewActions> = {}): ViewActions {
  return {
    openFolder() {},
    goToFolder() {},
    beginCreate() {},
    beginEdit() {},
    requestDelete() {},
    cancelForm() {},
    submitForm() {},
    reorderDial() {},
    moveDialInto() {},
    attachImage() {},
    attachImageUrl() {},
    captureThumbnail() {},
    refreshAllThumbnails() {},
    clearImage() {},
    setLayout() {},
    setDefaultFolderId() {},
    setThemeBackground() {},
    getThemeBackground: async () => null,
    resetToDefaults: async () => ({
      layout: DEFAULT_LAYOUT,
      defaultFolderId: null,
      themeBackground: null,
    }),
    eraseAllData: async () => ({
      layout: DEFAULT_LAYOUT,
      defaultFolderId: null,
      themeBackground: null,
    }),
    exportPicturesAndSettings: async () => {},
    importPicturesAndSettings: async () => ({
      layout: DEFAULT_LAYOUT,
      defaultFolderId: null,
      themeBackground: null,
    }),
    getImageStorageUsage: async () => ({ bytesUsed: 0, bytesQuota: null }),
    setSearchQuery() {},
    clearSearch() {},
    dismissWelcome() {},
    ...partial,
  };
}

test("folder tiles expose a deep-link href", () => {
  render(kit.host, gridView(), actions());
  const folderLink = kit.host.querySelector<HTMLAnchorElement>('a.tile-main[href*="folder="]');
  assert.ok(folderLink, "expected folder tile to be an anchor with folder= href");
  assert.ok(
    folderLink.getAttribute("href")?.endsWith(folderDeepLinkPath("10")) ||
      folderLink.getAttribute("href") === folderDeepLinkPath("10"),
    `href should target index.html?folder=10, got ${folderLink.getAttribute("href")}`,
  );

  const bookmarkLink = kit.host.querySelector<HTMLAnchorElement>('a.tile-main[href="https://example.com/"]');
  assert.ok(bookmarkLink, "bookmark tiles stay plain URL links");
});

test("primary click on a folder tile opens in-page without following the href", () => {
  const calls: string[] = [];
  render(
    kit.host,
    gridView(),
    actions({
      openFolder(id) {
        calls.push(id);
      },
    }),
  );
  const folderLink = kit.host.querySelector<HTMLAnchorElement>("a.tile-main");
  assert.ok(folderLink);
  folderLink.click();
  assert.deepEqual(calls, ["10"]);
});

test("folder tile ⋮ includes Copy folder link; bookmark tile ⋮ does not", () => {
  render(kit.host, gridView(), actions());
  const menus = [...kit.host.querySelectorAll<HTMLButtonElement>(".tile .action-menu")];
  assert.equal(menus.length, 2, "folder + bookmark tile menus");

  menus[0]!.click();
  const folderLabels = [...kit.document.querySelectorAll(".dialog-menu-item")].map(
    (el) => el.textContent ?? "",
  );
  assert.ok(folderLabels.includes(t("menu_copy_folder_link")));
  for (const root of kit.document.querySelectorAll(".dialog-root")) root.remove();

  menus[1]!.click();
  const linkLabels = [...kit.document.querySelectorAll(".dialog-menu-item")].map(
    (el) => el.textContent ?? "",
  );
  assert.equal(linkLabels.includes(t("menu_copy_folder_link")), false);
});

test("Copy folder link writes folderDeepLinkHref to the clipboard", async () => {
  const written: string[] = [];
  const clipboard = {
    writeText(text: string) {
      written.push(text);
      return Promise.resolve();
    },
  };
  Object.defineProperty(kit.window.navigator, "clipboard", {
    configurable: true,
    value: clipboard,
  });
  Object.defineProperty(globalThis.navigator, "clipboard", {
    configurable: true,
    value: clipboard,
  });

  render(kit.host, gridView(), actions());
  kit.host.querySelector<HTMLButtonElement>(".tile .action-menu")?.click();
  const copyItem = [...kit.document.querySelectorAll(".dialog-menu-item")].find(
    (el) => el.textContent === t("menu_copy_folder_link"),
  );
  assert.ok(copyItem);
  (copyItem as HTMLButtonElement).click();

  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(written, [folderDeepLinkHref("10")]);
  const toast = kit.document.querySelector(".status-toast");
  assert.ok(toast);
  assert.equal(toast.textContent, t("note_folder_link_copied"));
  assert.equal(toast.getAttribute("role"), "status");
});

test("current-folder ⋮ includes Copy folder link", () => {
  render(kit.host, gridView(), actions());
  kit.host.querySelector<HTMLButtonElement>(".current .action-menu")?.click();
  const labels = [...kit.document.querySelectorAll(".dialog-menu-item")].map((el) => el.textContent ?? "");
  assert.ok(labels.includes(t("menu_copy_folder_link")));
});
