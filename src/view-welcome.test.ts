import assert from "node:assert/strict";
import { afterEach, before, test } from "node:test";
import { Window } from "happy-dom";
import { DEFAULT_LAYOUT } from "./settings.ts";
import type { ViewModel } from "./present.ts";
import { render, type ViewActions } from "./view.ts";
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

test("welcome card teaches bookmarks, settings, and Picture… with Open Settings + Got it", () => {
  const calls: string[] = [];
  render(
    kit.host,
    gridView({ showWelcome: true }),
    actions({
      dismissWelcome() {
        calls.push("dismiss");
      },
    }),
  );

  const card = kit.host.querySelector(".welcome");
  assert.ok(card, "expected .welcome card");
  assert.equal(card.getAttribute("role"), "region");
  assert.equal(kit.host.querySelector(".welcome-title")?.textContent, t("welcome_title"));
  const points = [...kit.host.querySelectorAll(".welcome-points li")].map((el) => el.textContent);
  assert.deepEqual(points, [t("welcome_bookmarks"), t("welcome_settings"), t("welcome_picture")]);
  assert.equal(kit.host.querySelector(".welcome-privacy")?.textContent, t("welcome_privacy"));

  const openSettings = kit.host.querySelector<HTMLButtonElement>(".welcome-actions .primary");
  const gotIt = kit.host.querySelector<HTMLButtonElement>(".welcome-actions .quiet");
  assert.ok(openSettings);
  assert.ok(gotIt);
  assert.equal(openSettings.textContent, t("welcome_open_settings"));
  assert.equal(gotIt.textContent, t("welcome_got_it"));
  assert.equal(kit.host.querySelectorAll(".welcome input[type='checkbox']").length, 0);

  gotIt.click();
  assert.deepEqual(calls, ["dismiss"]);

  openSettings.click();
  assert.ok(kit.document.querySelector(".dialog-root.settings-dialog, .dialog-panel.settings-dialog"));
});

test("welcome card is omitted when showWelcome is false", () => {
  render(kit.host, gridView({ showWelcome: false }), actions());
  assert.equal(kit.host.querySelector(".welcome"), null);
});
