import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { chromeBookmarks, chromeImages, chromeSettings } from "./browser.ts";
import { IMAGE_KEY_PREFIX } from "./images.ts";
import { DEFAULT_LAYOUT } from "./settings.ts";

type StorageBag = Record<string, unknown>;

type FakeChrome = {
  bookmarks: {
    get: (id: string) => Promise<chrome.bookmarks.BookmarkTreeNode[]>;
    remove: (id: string) => Promise<void>;
    removeTree: (id: string) => Promise<void>;
    calls: string[];
  };
  storage: {
    local: {
      get: (keys: string | string[] | null) => Promise<StorageBag>;
      set: (items: StorageBag) => Promise<void>;
      remove: (keys: string | string[]) => Promise<void>;
      store: StorageBag;
      calls: string[];
    };
  };
};

function installChrome(fake: FakeChrome): void {
  (globalThis as unknown as { chrome: FakeChrome }).chrome = fake;
}

afterEach(() => {
  delete (globalThis as unknown as { chrome?: FakeChrome }).chrome;
});

function fakeChrome(initialStore: StorageBag = {}): FakeChrome {
  const store: StorageBag = { ...initialStore };
  const bookmarkCalls: string[] = [];
  const storageCalls: string[] = [];
  const nodes = new Map<string, { id: string; title: string; url?: string; children?: unknown[] }>([
    ["link-1", { id: "link-1", title: "Example", url: "https://example.com/" }],
    ["folder-1", { id: "folder-1", title: "News", children: [] }],
  ]);

  return {
    bookmarks: {
      calls: bookmarkCalls,
      async get(id) {
        bookmarkCalls.push(`get:${id}`);
        const node = nodes.get(id);
        return (node ? [node] : []) as chrome.bookmarks.BookmarkTreeNode[];
      },
      async remove(id) {
        bookmarkCalls.push(`remove:${id}`);
      },
      async removeTree(id) {
        bookmarkCalls.push(`removeTree:${id}`);
      },
    },
    storage: {
      local: {
        store,
        calls: storageCalls,
        async get(keys) {
          storageCalls.push(`get:${JSON.stringify(keys)}`);
          if (keys === null) return { ...store };
          if (typeof keys === "string") {
            return keys in store ? { [keys]: store[keys] } : {};
          }
          const out: StorageBag = {};
          for (const key of keys) {
            if (key in store) out[key] = store[key];
          }
          return out;
        },
        async set(items) {
          storageCalls.push(`set:${Object.keys(items).sort().join(",")}`);
          Object.assign(store, items);
        },
        async remove(keys) {
          const list = typeof keys === "string" ? [keys] : keys;
          storageCalls.push(`remove:${list.slice().sort().join(",")}`);
          for (const key of list) delete store[key];
        },
      },
    },
  };
}

test("P1-4 chromeBookmarks.remove uses remove for links and removeTree for folders", async () => {
  const fake = fakeChrome();
  installChrome(fake);
  const api = chromeBookmarks();

  await api.remove("link-1");
  await api.remove("folder-1");

  assert.deepEqual(fake.bookmarks.calls, [
    "get:link-1",
    "remove:link-1",
    "get:folder-1",
    "removeTree:folder-1",
  ]);
});

test("P1-4 chromeSettings.resetToDefaults preserves openFolderId", async () => {
  const fake = fakeChrome({
    settings: {
      columns: 7,
      tileSize: 400,
      reverseOrder: true,
      thumbnailsEnabled: true,
      imageUrlFetchEnabled: true,
      thumbnailWaitSeconds: 9,
      openFolderId: "stay-open",
      defaultFolderId: "was-default",
      rootFolderId: "legacy-ignored-when-open-set",
    },
  });
  installChrome(fake);
  const api = chromeSettings();

  const layout = await api.resetToDefaults();
  assert.deepEqual(layout, DEFAULT_LAYOUT);

  const stored = fake.storage.local.store.settings as Record<string, unknown>;
  assert.equal(stored.openFolderId, "stay-open");
  assert.equal(stored.defaultFolderId, null);
  assert.equal(stored.columns, DEFAULT_LAYOUT.columns);
  assert.equal(stored.tileSize, DEFAULT_LAYOUT.tileSize);
  assert.equal(stored.reverseOrder, DEFAULT_LAYOUT.reverseOrder);
  assert.equal(stored.thumbnailsEnabled, DEFAULT_LAYOUT.thumbnailsEnabled);
  assert.equal(stored.imageUrlFetchEnabled, DEFAULT_LAYOUT.imageUrlFetchEnabled);
  assert.equal(stored.thumbnailWaitSeconds, DEFAULT_LAYOUT.thumbnailWaitSeconds);
});

test("P1-4 chromeSettings.clearAll drops the whole settings key", async () => {
  const fake = fakeChrome({
    settings: { openFolderId: "1", columns: 4 },
    [`${IMAGE_KEY_PREFIX}11`]: "data:image/png;base64,aa==",
  });
  installChrome(fake);
  const api = chromeSettings();

  await api.clearAll();

  assert.equal("settings" in fake.storage.local.store, false);
  assert.equal(fake.storage.local.store[`${IMAGE_KEY_PREFIX}11`], "data:image/png;base64,aa==");
  assert.ok(fake.storage.local.calls.some((c) => c === "remove:settings"));
});

test("P1-4 chromeImages.clearAll removes only hearth.image.* keys", async () => {
  const fake = fakeChrome({
    settings: { openFolderId: "1" },
    [`${IMAGE_KEY_PREFIX}11`]: "data:image/png;base64,aa==",
    [`${IMAGE_KEY_PREFIX}99`]: "data:image/png;base64,bb==",
    "hearth.other": "keep",
    unrelated: true,
  });
  installChrome(fake);
  const api = chromeImages();

  await api.clearAll();

  assert.deepEqual(fake.storage.local.store, {
    settings: { openFolderId: "1" },
    "hearth.other": "keep",
    unrelated: true,
  });
  const removeCall = fake.storage.local.calls.find((c) => c.startsWith("remove:"));
  assert.ok(removeCall);
  assert.match(removeCall, new RegExp(`${IMAGE_KEY_PREFIX}11`));
  assert.match(removeCall, new RegExp(`${IMAGE_KEY_PREFIX}99`));
  assert.ok(!removeCall.includes("settings"));
  assert.ok(!removeCall.includes("hearth.other"));
});
