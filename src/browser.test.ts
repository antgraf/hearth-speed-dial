import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { chromeBookmarks, chromeImages, chromeSettings } from "./browser.ts";
import {
  IMAGE_KEY_PREFIX,
  imageStorageWriteFailedMessage,
} from "./images.ts";
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
      getBytesInUse: (keys: string | string[] | null) => Promise<number>;
      QUOTA_BYTES: number;
      store: StorageBag;
      calls: string[];
      setError?: Error | null;
    };
  };
};

function installChrome(fake: FakeChrome): void {
  (globalThis as unknown as { chrome: FakeChrome }).chrome = fake;
}

afterEach(() => {
  delete (globalThis as unknown as { chrome?: FakeChrome }).chrome;
});

function fakeChrome(
  initialStore: StorageBag = {},
  options: { quotaBytes?: number; setError?: Error | null } = {},
): FakeChrome {
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
        QUOTA_BYTES: options.quotaBytes ?? 10_485_760,
        setError: options.setError ?? null,
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
          if (this.setError) throw this.setError;
          Object.assign(store, items);
        },
        async remove(keys) {
          const list = typeof keys === "string" ? [keys] : keys;
          storageCalls.push(`remove:${list.slice().sort().join(",")}`);
          for (const key of list) delete store[key];
        },
        async getBytesInUse(keys) {
          storageCalls.push(`getBytesInUse:${JSON.stringify(keys)}`);
          const list =
            keys === null ? Object.keys(store) : typeof keys === "string" ? [keys] : keys;
          let total = 0;
          for (const key of list) {
            const value = store[key];
            if (typeof value === "string") total += value.length;
            else if (value != null) total += JSON.stringify(value).length;
          }
          return total;
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

test("chromeImages.setImage maps quota errors to honest UX copy", async () => {
  const fake = fakeChrome(
    {},
    { setError: new Error("QUOTA_BYTES quota exceeded") },
  );
  installChrome(fake);
  const api = chromeImages();

  await assert.rejects(
    () => api.setImage("11", "data:image/png;base64,aa=="),
    (error: unknown) =>
      error instanceof Error &&
      error.message === imageStorageWriteFailedMessage(new Error("QUOTA_BYTES quota exceeded")),
  );
  assert.equal(`${IMAGE_KEY_PREFIX}11` in fake.storage.local.store, false);
});

test("chromeImages.setImage maps generic write failures to honest UX copy", async () => {
  const fake = fakeChrome({}, { setError: new Error("disk I/O failed") });
  installChrome(fake);
  const api = chromeImages();

  await assert.rejects(
    () => api.setImage("11", "data:image/png;base64,aa=="),
    (error: unknown) =>
      error instanceof Error && error.message === imageStorageWriteFailedMessage(),
  );
});

test("chromeImages.getUsage reports dial-picture bytes and drops unlimited quotas", async () => {
  const png = "data:image/png;base64,aa==";
  const fake = fakeChrome(
    {
      settings: { columns: 4 },
      [`${IMAGE_KEY_PREFIX}11`]: png,
      unrelated: "ignore-me",
    },
    { quotaBytes: Number.MAX_SAFE_INTEGER },
  );
  installChrome(fake);
  const api = chromeImages();

  const usage = await api.getUsage();
  assert.equal(usage.bytesUsed, png.length);
  assert.equal(usage.bytesQuota, null);
  assert.ok(fake.storage.local.calls.some((c) => c.startsWith("getBytesInUse:")));
});

test("chromeImages.getUsage keeps a meaningful finite quota", async () => {
  const png = "data:image/png;base64,aa==";
  const fake = fakeChrome(
    { [`${IMAGE_KEY_PREFIX}11`]: png },
    { quotaBytes: 10_485_760 },
  );
  installChrome(fake);
  const api = chromeImages();

  const usage = await api.getUsage();
  assert.equal(usage.bytesUsed, png.length);
  assert.equal(usage.bytesQuota, 10_485_760);
});
