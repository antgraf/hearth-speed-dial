import assert from "node:assert/strict";
import { before, test } from "node:test";
import { Window } from "happy-dom";
import type { BookmarksApi } from "./browser.ts";
import { dialStorageUsageLabel, type ImagesApi } from "./images.ts";
import { t } from "./i18n.ts";
import type { BookmarkNode } from "./model.ts";
import { DEFAULT_LAYOUT, type SettingsApi } from "./settings.ts";
import { startSettings } from "./settings-app.ts";

type DomKit = {
  window: Window;
  document: Document;
};

let kit: DomKit;

before(() => {
  const window = new Window({ url: "https://hearth.test/settings.html" });
  const document = window.document as unknown as Document;
  globalThis.document = document;
  globalThis.HTMLElement = window.HTMLElement as unknown as typeof HTMLElement;
  globalThis.HTMLInputElement = window.HTMLInputElement as unknown as typeof HTMLInputElement;
  globalThis.HTMLButtonElement = window.HTMLButtonElement as unknown as typeof HTMLButtonElement;
  globalThis.HTMLSelectElement = window.HTMLSelectElement as unknown as typeof HTMLSelectElement;
  globalThis.HTMLFormElement = window.HTMLFormElement as unknown as typeof HTMLFormElement;
  globalThis.CSS = window.CSS as unknown as typeof CSS;
  kit = { window, document };
});

function fakeSettings(): SettingsApi {
  return {
    async getOpenFolderId() {
      return null;
    },
    async setOpenFolderId() {},
    async getDefaultFolderId() {
      return null;
    },
    async setDefaultFolderId() {},
    async getLayout() {
      return { ...DEFAULT_LAYOUT, theme: { ...DEFAULT_LAYOUT.theme } };
    },
    async setLayout() {},
    async getThemeBackground() {
      return null;
    },
    async setThemeBackground() {},
    async getWelcomeDismissed() {
      return true;
    },
    async setWelcomeDismissed() {},
    async resetToDefaults() {
      return { ...DEFAULT_LAYOUT, theme: { ...DEFAULT_LAYOUT.theme } };
    },
    async clearAll() {},
  };
}

function fakeBookmarks(): BookmarksApi {
  const tree: BookmarkNode[] = [
    {
      id: "0",
      title: "Bookmarks",
      children: [{ id: "1", title: "Bookmarks bar", children: [] }],
    },
  ];
  return {
    async getTree() {
      return structuredClone(tree);
    },
    async createFolder() {
      throw new Error("unexpected createFolder");
    },
    async createBookmark() {
      throw new Error("unexpected createBookmark");
    },
    async update() {
      throw new Error("unexpected update");
    },
    async move() {
      throw new Error("unexpected move");
    },
    async remove() {
      throw new Error("unexpected remove");
    },
    subscribe() {
      return () => {};
    },
  };
}

function fakeImages(bytesUsed = 2048): ImagesApi {
  return {
    async getAll() {
      return {};
    },
    async setImage() {},
    async clearImage() {},
    async clearMissing() {},
    async clearAll() {},
    async getUsage() {
      return { bytesUsed, bytesQuota: null };
    },
  };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 40; i++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

test("settings Pictures shows a labeled Dial picture storage readout", async () => {
  const host = kit.document.createElement("div");
  kit.document.body.replaceChildren(host);
  startSettings(host, fakeSettings(), null, undefined, fakeBookmarks(), fakeImages(4096));
  await settle();

  const row = host.querySelector(".settings-storage-usage");
  assert.ok(row, "expected .settings-storage-usage in Pictures");
  const title = row.querySelector(".settings-storage-usage-title");
  const value = row.querySelector(".settings-storage-usage-value");
  assert.ok(title);
  assert.ok(value);
  assert.equal(title.textContent, dialStorageUsageLabel());
  assert.match(value.textContent ?? "", /About .+ used in this profile/i);
  assert.ok(
    [...host.querySelectorAll(".settings-category-title")].some((el) => el.textContent === t("cat_pictures")),
  );
});

test("settings Theme category exposes mode, accent, and local wallpaper controls", async () => {
  const host = kit.document.createElement("div");
  kit.document.body.replaceChildren(host);
  startSettings(host, fakeSettings(), null, undefined, fakeBookmarks(), fakeImages());
  await settle();

  const titles = [...host.querySelectorAll(".settings-category-title")].map((el) => el.textContent);
  assert.ok(titles.includes(t("cat_theme")));
  assert.ok(host.querySelector('select[name="themeMode"]'));
  assert.ok(host.querySelector('input[name="page-theme-accent"]'));
  assert.ok(host.querySelector('input[name="themeBackgroundColor"]'));
  assert.match(host.textContent ?? "", /Page color override/);
  assert.match(host.textContent ?? "", /Use accent default/);
  assert.match(host.textContent ?? "", /Add image/);
  assert.match(host.textContent ?? "", /Remove image/);
  assert.ok(host.querySelector(".settings-theme-preview"));
  assert.ok(host.querySelector("button.settings-theme-btn"));
});

test("settings Backup category sits before Danger Zone with export/import", async () => {
  const host = kit.document.createElement("div");
  kit.document.body.replaceChildren(host);
  startSettings(host, fakeSettings(), null, undefined, fakeBookmarks(), fakeImages());
  await settle();

  const titles = [...host.querySelectorAll(".settings-category-title")].map((el) => el.textContent);
  const backupIdx = titles.indexOf(t("cat_backup"));
  const dangerIdx = titles.indexOf(t("cat_danger"));
  assert.ok(backupIdx >= 0, "expected Backup category");
  assert.ok(dangerIdx >= 0, "expected Danger Zone category");
  assert.ok(backupIdx < dangerIdx, "Backup must come before Danger Zone");
  assert.ok(host.querySelector("button.settings-backup-export"));
  assert.ok(host.querySelector("button.settings-backup-import"));
  assert.match(host.textContent ?? "", /Chrome bookmarks are not included/i);
  assert.match(host.textContent ?? "", /overwrite/i);
});
