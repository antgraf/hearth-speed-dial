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
    crumbs: [{ id: "1", title: "Bookmarks bar" }],
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
    ...partial,
  };
}

test("grid renders a find-a-dial search field", () => {
  render(kit.host, gridView(), actions());
  const input = kit.host.querySelector<HTMLInputElement>(".dial-search-input");
  assert.ok(input);
  assert.equal(input.getAttribute("aria-label"), t("search_aria_label"));
  assert.equal(input.placeholder, t("search_placeholder"));
  assert.ok(kit.host.querySelector(".dial-search-hint"));
});

test("search input reports query changes and Escape clears a non-empty query", () => {
  const calls: string[] = [];
  render(
    kit.host,
    gridView({ searchQuery: "ex", searching: true, canCreate: false }),
    actions({
      setSearchQuery(query) {
        calls.push(`set:${query}`);
      },
      clearSearch() {
        calls.push("clear");
      },
    }),
  );
  const input = kit.host.querySelector<HTMLInputElement>(".dial-search-input");
  assert.ok(input);
  assert.equal(input.value, "ex");
  assert.equal(kit.host.querySelector(".dial-search-hint"), null);

  input.value = "example";
  input.dispatchEvent(new kit.window.Event("input", { bubbles: true }) as unknown as Event);
  assert.deepEqual(calls, ["set:example"]);

  input.dispatchEvent(
    new kit.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }) as unknown as Event,
  );
  assert.deepEqual(calls, ["set:example", "clear"]);
});

test("searching hides the create tile and marks the search control active", () => {
  render(
    kit.host,
    gridView({ searching: true, searchQuery: "ex", canCreate: false }),
    actions(),
  );
  assert.ok(kit.host.querySelector(".dial-search.is-active"));
  assert.equal(kit.host.querySelector(".tile.add"), null);
  assert.equal(kit.host.querySelector(`[aria-label="${t("aria_search_results")}"]`)?.tagName, "UL");
});
