import assert from "node:assert/strict";
import { before, test } from "node:test";
import { Window } from "happy-dom";
import { startAdd, type AddPorts } from "./add-app.ts";
import type { BookmarksApi } from "./browser.ts";
import { t } from "./i18n.ts";
import type { BookmarkNode } from "./model.ts";
import type { SettingsApi } from "./settings.ts";

type DomKit = {
  window: Window;
  document: Document;
  Event: typeof Event;
};

let kit: DomKit;

before(() => {
  const window = new Window({ url: "https://hearth.test/add.html" });
  const document = window.document as unknown as Document;
  globalThis.document = document;
  globalThis.HTMLElement = window.HTMLElement as unknown as typeof HTMLElement;
  globalThis.HTMLInputElement = window.HTMLInputElement as unknown as typeof HTMLInputElement;
  globalThis.HTMLButtonElement = window.HTMLButtonElement as unknown as typeof HTMLButtonElement;
  globalThis.CSS = window.CSS as unknown as typeof CSS;
  kit = {
    window,
    document,
    Event: window.Event as unknown as typeof Event,
  };
});

function sampleTree(): BookmarkNode[] {
  return [
    {
      id: "0",
      title: "Bookmarks",
      children: [
        {
          id: "1",
          title: "Bookmarks bar",
          children: [
            { id: "10", title: "News", children: [] },
            { id: "11", title: "Example", url: "https://example.com/" },
          ],
        },
        {
          id: "2",
          title: "Other bookmarks",
          children: [],
        },
      ],
    },
  ];
}

function fakeBookmarks(initialTree: BookmarkNode[] = sampleTree()): BookmarksApi & {
  tree: BookmarkNode[];
  createCalls: Array<{ parentId: string; title: string; url: string }>;
} {
  const createCalls: Array<{ parentId: string; title: string; url: string }> = [];
  const api: BookmarksApi & {
    tree: BookmarkNode[];
    createCalls: Array<{ parentId: string; title: string; url: string }>;
  } = {
    tree: initialTree,
    createCalls,
    async getTree() {
      return api.tree;
    },
    async createFolder() {
      throw new Error("unexpected createFolder");
    },
    async createBookmark(parentId, title, url) {
      createCalls.push({ parentId, title, url });
      return { id: "new", title, url, parentId };
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
      return () => undefined;
    },
  };
  return api;
}

function fakeSettings(defaultFolderId: string | null = null): SettingsApi {
  return {
    async getOpenFolderId() {
      return null;
    },
    async setOpenFolderId() {},
    async getDefaultFolderId() {
      return defaultFolderId;
    },
    async setDefaultFolderId() {},
    async getLayout() {
      throw new Error("unexpected getLayout");
    },
    async setLayout() {
      throw new Error("unexpected setLayout");
    },
    async getThemeBackground() {
      throw new Error("unexpected getThemeBackground");
    },
    async setThemeBackground() {
      throw new Error("unexpected setThemeBackground");
    },
    async resetToDefaults() {
      throw new Error("unexpected resetToDefaults");
    },
    async clearAll() {
      throw new Error("unexpected clearAll");
    },
  };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 40; i++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

function mountAdd(ports: Partial<AddPorts> & { bookmarks?: ReturnType<typeof fakeBookmarks> }): {
  host: HTMLElement;
  bookmarks: ReturnType<typeof fakeBookmarks>;
  closed: { count: number };
  stop: () => void;
} {
  const host = kit.document.createElement("div");
  kit.document.body.append(host);
  const bookmarks = ports.bookmarks ?? fakeBookmarks();
  const closed = { count: 0 };
  const stop = startAdd(host, {
    bookmarks,
    settings: ports.settings ?? fakeSettings(),
    search: ports.search ?? "url=https%3A%2F%2Fexample.com%2Fpage&title=Example",
    close: ports.close ?? (() => {
      closed.count += 1;
    }),
  });
  return { host, bookmarks, closed, stop };
}

function chooseFolder(host: HTMLElement, id: string): void {
  const folderRadio = host.querySelector(`input[name="parentId"][value="${id}"]`);
  assert.ok(folderRadio instanceof HTMLInputElement, `missing folder radio ${id}`);
  folderRadio.checked = true;
  folderRadio.dispatchEvent(new kit.Event("change", { bubbles: true }));
}

test("P2-1 invalid page shows cannot-be-added copy", async () => {
  const { host, stop } = mountAdd({ search: "" });
  await settle();
  const alert = host.querySelector(".error");
  assert.ok(alert);
  assert.equal(alert.textContent, "This page cannot be added as a dial.");
  assert.equal(host.querySelector("form"), null);
  const close = host.querySelector("button.quiet");
  assert.ok(close);
  assert.equal(close.textContent, t("btn_close"));
  stop();
  host.remove();
});

test("P2-1 no folders disables submit and shows availability error", async () => {
  const bookmarks = fakeBookmarks([{ id: "0", title: "Bookmarks", children: [] }]);
  const { host, stop } = mountAdd({ bookmarks });
  await settle();

  const alert = host.querySelector(".error");
  assert.ok(alert);
  assert.equal(alert.textContent, "No bookmark folders are available yet.");
  const empty = host.querySelector(".folder-picker .quiet");
  assert.ok(empty);
  assert.equal(empty.textContent, "No folders available.");
  const submit = host.querySelector('button.primary[type="submit"]');
  assert.ok(submit instanceof HTMLButtonElement);
  assert.equal(submit.disabled, true);
  stop();
  host.remove();
});

test("P2-1 submit re-validates tree, clears stale parentId, and shows error", async () => {
  const bookmarks = fakeBookmarks();
  const { host, stop } = mountAdd({ bookmarks });
  await settle();

  chooseFolder(host, "1");
  await settle();

  const submitBefore = host.querySelector('button.primary[type="submit"]');
  assert.ok(submitBefore instanceof HTMLButtonElement);
  assert.equal(submitBefore.disabled, false);

  // Folder "1" disappears before create.
  bookmarks.tree = [
    {
      id: "0",
      title: "Bookmarks",
      children: [
        {
          id: "2",
          title: "Other bookmarks",
          children: [],
        },
      ],
    },
  ];

  const form = host.querySelector("form");
  assert.ok(form);
  form.dispatchEvent(new kit.Event("submit", { bubbles: true, cancelable: true }));
  await settle();

  assert.deepEqual(bookmarks.createCalls, []);
  const alert = host.querySelector(".error");
  assert.ok(alert);
  assert.equal(alert.textContent, t("error_choose_folder_inside"));

  const stale = host.querySelector('input[name="parentId"][value="1"]');
  assert.equal(stale, null);
  const selected = host.querySelector('input[name="parentId"]:checked');
  assert.equal(selected, null);
  const submitAfter = host.querySelector('button.primary[type="submit"]');
  assert.ok(submitAfter instanceof HTMLButtonElement);
  assert.equal(submitAfter.disabled, true);
  stop();
  host.remove();
});

test("P2-1 submit creates when the chosen folder is still valid", async () => {
  const bookmarks = fakeBookmarks();
  const closed = { count: 0 };
  const { host, stop } = mountAdd({
    bookmarks,
    close: () => {
      closed.count += 1;
    },
  });
  await settle();

  chooseFolder(host, "2");
  await settle();

  const form = host.querySelector("form");
  assert.ok(form);
  form.dispatchEvent(new kit.Event("submit", { bubbles: true, cancelable: true }));
  await settle();

  assert.deepEqual(bookmarks.createCalls, [
    { parentId: "2", title: "Example", url: "https://example.com/page" },
  ]);
  assert.equal(closed.count, 1);
  stop();
  host.remove();
});
