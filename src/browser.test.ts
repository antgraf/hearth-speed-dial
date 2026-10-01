import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { chromeBookmarks, chromeImages, chromeSettings } from "./browser.ts";
import {
  IMAGE_KEY_PREFIX,
  imageStorageWriteFailedMessage,
} from "./images.ts";
import { DEFAULT_LAYOUT, WELCOME_DISMISSED_KEY } from "./settings.ts";
import { THEME_BACKGROUND_KEY } from "./theme.ts";

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
    sync: {
      get: (keys: string | string[] | null) => Promise<StorageBag>;
      set: (items: StorageBag) => Promise<void>;
      remove: (keys: string | string[]) => Promise<void>;
      store: StorageBag;
      calls: string[];
    };
  };
  runtime: {
    getManifest: () => { permissions?: string[] };
  };
  permissions: {
    contains: (request: { permissions?: string[] }) => Promise<boolean>;
  };
};

function installChrome(fake: FakeChrome): void {
  (globalThis as Record<string, unknown>).chrome = fake;
}

afterEach(() => {
  const g = globalThis as Record<string, unknown>;
  delete g.chrome;
  delete g.browser;
});

function makeStorageArea(
  store: StorageBag,
  calls: string[],
  options: { setError?: Error | null; quotaBytes?: number } = {},
) {
  return {
    store,
    calls,
    QUOTA_BYTES: options.quotaBytes ?? 10_485_760,
    setError: options.setError ?? null,
    async get(keys: string | string[] | null) {
      calls.push(`get:${JSON.stringify(keys)}`);
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
    async set(items: StorageBag) {
      calls.push(`set:${Object.keys(items).sort().join(",")}`);
      if (this.setError) throw this.setError;
      Object.assign(store, items);
    },
    async remove(keys: string | string[]) {
      const list = typeof keys === "string" ? [keys] : keys;
      calls.push(`remove:${list.slice().sort().join(",")}`);
      for (const key of list) delete store[key];
    },
    async getBytesInUse(keys: string | string[] | null) {
      calls.push(`getBytesInUse:${JSON.stringify(keys)}`);
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
  };
}

function fakeChrome(
  initialLocal: StorageBag = {},
  options: {
    quotaBytes?: number;
    setError?: Error | null;
    /** When true (default), mimic install-time unlimitedStorage in the manifest. */
    unlimitedStorage?: boolean;
    initialSync?: StorageBag;
  } = {},
): FakeChrome {
  const localStore: StorageBag = { ...initialLocal };
  const syncStore: StorageBag = { ...(options.initialSync ?? {}) };
  const bookmarkCalls: string[] = [];
  const localCalls: string[] = [];
  const syncCalls: string[] = [];
  const unlimited = options.unlimitedStorage !== false;
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
      local: makeStorageArea(localStore, localCalls, {
        quotaBytes: options.quotaBytes,
        setError: options.setError,
      }),
      sync: makeStorageArea(syncStore, syncCalls),
    },
    runtime: {
      getManifest() {
        return {
          permissions: unlimited
            ? ["bookmarks", "storage", "unlimitedStorage", "contextMenus", "activeTab"]
            : ["bookmarks", "storage", "contextMenus", "activeTab"],
        };
      },
    },
    permissions: {
      async contains(request) {
        return Boolean(unlimited && request.permissions?.includes("unlimitedStorage"));
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
  const fake = fakeChrome(
    {
      settings: {
        thumbnailsEnabled: true,
        imageUrlFetchEnabled: true,
        openFolderId: "stay-open",
        defaultFolderId: "was-default",
        rootFolderId: "legacy-ignored-when-open-set",
      },
      [THEME_BACKGROUND_KEY]: "data:image/png;base64,aa==",
    },
    {
      initialSync: {
        settings: {
          columns: 7,
          tileSize: 400,
          reverseOrder: true,
          thumbnailWaitSeconds: 9,
          theme: { mode: "light", accent: "moss" },
        },
      },
    },
  );
  installChrome(fake);
  const api = chromeSettings();

  const layout = await api.resetToDefaults();
  assert.deepEqual(layout, DEFAULT_LAYOUT);

  const local = fake.storage.local.store.settings as Record<string, unknown>;
  const sync = fake.storage.sync.store.settings as Record<string, unknown>;
  assert.equal(local.openFolderId, "stay-open");
  assert.equal("defaultFolderId" in local, false);
  assert.equal(local.thumbnailsEnabled, DEFAULT_LAYOUT.thumbnailsEnabled);
  assert.equal(local.imageUrlFetchEnabled, DEFAULT_LAYOUT.imageUrlFetchEnabled);
  assert.equal("columns" in local, false);
  assert.equal(sync.columns, DEFAULT_LAYOUT.columns);
  assert.equal(sync.tileSize, DEFAULT_LAYOUT.tileSize);
  assert.equal(sync.reverseOrder, DEFAULT_LAYOUT.reverseOrder);
  assert.equal(sync.thumbnailWaitSeconds, DEFAULT_LAYOUT.thumbnailWaitSeconds);
  assert.deepEqual(sync.theme, DEFAULT_LAYOUT.theme);
  assert.equal(THEME_BACKGROUND_KEY in fake.storage.local.store, false);
});

test("P1-4 chromeSettings.clearAll drops sync+local settings, wallpaper, and welcome", async () => {
  const fake = fakeChrome(
    {
      settings: { openFolderId: "1", thumbnailsEnabled: true },
      [`${IMAGE_KEY_PREFIX}11`]: "data:image/png;base64,aa==",
      [THEME_BACKGROUND_KEY]: "data:image/png;base64,bb==",
      [WELCOME_DISMISSED_KEY]: true,
    },
    { initialSync: { settings: { columns: 4 } } },
  );
  installChrome(fake);
  const api = chromeSettings();

  await api.clearAll();

  assert.equal("settings" in fake.storage.local.store, false);
  assert.equal("settings" in fake.storage.sync.store, false);
  assert.equal(THEME_BACKGROUND_KEY in fake.storage.local.store, false);
  assert.equal(WELCOME_DISMISSED_KEY in fake.storage.local.store, false);
  assert.equal(fake.storage.local.store[`${IMAGE_KEY_PREFIX}11`], "data:image/png;base64,aa==");
  assert.ok(fake.storage.local.calls.some((c) => c.includes("settings")));
  assert.ok(fake.storage.sync.calls.some((c) => c.includes("settings")));
});

test("chromeSettings welcome dismissed get/set uses a dedicated local key", async () => {
  const fake = fakeChrome({ settings: {} });
  installChrome(fake);
  const api = chromeSettings();
  assert.equal(await api.getWelcomeDismissed(), false);
  await api.setWelcomeDismissed(true);
  assert.equal(fake.storage.local.store[WELCOME_DISMISSED_KEY], true);
  assert.equal(await api.getWelcomeDismissed(), true);
  await api.setWelcomeDismissed(false);
  assert.equal(WELCOME_DISMISSED_KEY in fake.storage.local.store, false);
  assert.equal(await api.getWelcomeDismissed(), false);
});

test("chromeSettings resetToDefaults preserves welcome dismissed", async () => {
  const fake = fakeChrome({
    settings: { openFolderId: "stay", thumbnailsEnabled: true },
    [WELCOME_DISMISSED_KEY]: true,
  });
  installChrome(fake);
  const api = chromeSettings();
  await api.resetToDefaults();
  assert.equal(fake.storage.local.store[WELCOME_DISMISSED_KEY], true);
  assert.equal(await api.getWelcomeDismissed(), true);
});

test("chromeSettings theme background get/set stores a local data URL", async () => {
  const fake = fakeChrome({ settings: {} });
  installChrome(fake);
  const api = chromeSettings();
  assert.equal(await api.getThemeBackground(), null);
  await api.setThemeBackground("data:image/png;base64,aa==");
  assert.equal(await api.getThemeBackground(), "data:image/png;base64,aa==");
  await api.setThemeBackground(null);
  assert.equal(await api.getThemeBackground(), null);
});

test("chromeSettings writes portable prefs to sync and device prefs to local", async () => {
  const fake = fakeChrome();
  installChrome(fake);
  const api = chromeSettings();

  await api.setLayout({
    ...DEFAULT_LAYOUT,
    columns: 6,
    tileSize: 220,
    reverseOrder: true,
    thumbnailWaitSeconds: 5,
    thumbnailsEnabled: true,
    imageUrlFetchEnabled: true,
    theme: { ...DEFAULT_LAYOUT.theme, mode: "dark", accent: "brass" },
  });
  await api.setOpenFolderId("folder-9");
  await api.setDefaultFolderId("folder-2");

  const sync = fake.storage.sync.store.settings as Record<string, unknown>;
  const local = fake.storage.local.store.settings as Record<string, unknown>;
  assert.equal(sync.columns, 6);
  assert.equal(sync.tileSize, 220);
  assert.equal(sync.reverseOrder, true);
  assert.equal(sync.thumbnailWaitSeconds, 5);
  assert.deepEqual(sync.theme, { ...DEFAULT_LAYOUT.theme, mode: "dark", accent: "brass" });
  assert.equal("thumbnailsEnabled" in sync, false);
  assert.equal("openFolderId" in sync, false);
  assert.equal(local.thumbnailsEnabled, true);
  assert.equal(local.imageUrlFetchEnabled, true);
  assert.equal(local.openFolderId, "folder-9");
  assert.equal(local.defaultFolderId, "folder-2");
  assert.equal("columns" in local, false);

  const layout = await api.getLayout();
  assert.equal(layout.columns, 6);
  assert.equal(layout.thumbnailsEnabled, true);
  assert.equal(await api.getOpenFolderId(), "folder-9");
  assert.equal(await api.getDefaultFolderId(), "folder-2");
});

test("chromeSettings seeds portable prefs from pre-release local into sync once", async () => {
  const fake = fakeChrome({
    settings: {
      columns: 3,
      tileSize: 128,
      reverseOrder: true,
      thumbnailWaitSeconds: 4,
      thumbnailsEnabled: true,
      imageUrlFetchEnabled: false,
      openFolderId: "legacy-open",
      defaultFolderId: "legacy-default",
      theme: { mode: "light", accent: "clay" },
    },
  });
  installChrome(fake);
  const api = chromeSettings();

  const layout = await api.getLayout();
  assert.equal(layout.columns, 3);
  assert.equal(layout.tileSize, 128);
  assert.equal(layout.reverseOrder, true);
  assert.equal(layout.thumbnailWaitSeconds, 4);
  assert.equal(layout.thumbnailsEnabled, true);
  assert.equal(layout.theme.accent, "clay");
  assert.equal(await api.getOpenFolderId(), "legacy-open");

  const sync = fake.storage.sync.store.settings as Record<string, unknown>;
  const local = fake.storage.local.store.settings as Record<string, unknown>;
  assert.equal(sync.columns, 3);
  assert.equal(sync.tileSize, 128);
  assert.equal("thumbnailsEnabled" in sync, false);
  assert.equal(local.openFolderId, "legacy-open");
  assert.equal(local.defaultFolderId, "legacy-default");
  assert.equal(local.thumbnailsEnabled, true);
  assert.equal("columns" in local, false);
  assert.equal("theme" in local, false);
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

test("chromeImages.getUsage ignores QUOTA_BYTES when unlimitedStorage is granted", async () => {
  const png = "data:image/png;base64,aa==";
  // Chrome still reports the default 10 MB constant with unlimitedStorage.
  const fake = fakeChrome(
    {
      settings: { columns: 4 },
      [`${IMAGE_KEY_PREFIX}11`]: png,
      unrelated: "ignore-me",
    },
    { quotaBytes: 10_485_760, unlimitedStorage: true },
  );
  installChrome(fake);
  const api = chromeImages();

  const usage = await api.getUsage();
  assert.equal(usage.bytesUsed, png.length);
  assert.equal(usage.bytesQuota, null);
  assert.ok(fake.storage.local.calls.some((c) => c.startsWith("getBytesInUse:")));
});

test("chromeImages.getUsage keeps a finite quota without unlimitedStorage", async () => {
  const png = "data:image/png;base64,aa==";
  const fake = fakeChrome(
    { [`${IMAGE_KEY_PREFIX}11`]: png },
    { quotaBytes: 10_485_760, unlimitedStorage: false },
  );
  installChrome(fake);
  const api = chromeImages();

  const usage = await api.getUsage();
  assert.equal(usage.bytesUsed, png.length);
  assert.equal(usage.bytesQuota, 10_485_760);
});
