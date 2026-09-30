import assert from "node:assert/strict";
import { test } from "node:test";
import { start, type AppPorts } from "./app.ts";
import type { BookmarksApi } from "./browser.ts";
import type { ConfirmDialogOptions } from "./dialog.ts";
import type { ImagesApi } from "./images.ts";
import type { BookmarkNode } from "./model.ts";
import {
  imageUrlPermissionDeniedMessage,
  thumbnailPermissionDeniedMessage,
  type CaptureApi,
  type PermissionsApi,
} from "./permissions.ts";
import type { ViewModel } from "./present.ts";
import { DEFAULT_LAYOUT, type LayoutSettings, type SettingsApi } from "./settings.ts";
import type { ViewActions } from "./view.ts";

type CallLog = string[];

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
            { id: "12", title: "Projects", children: [] },
          ],
        },
        {
          id: "2",
          title: "Other bookmarks",
          children: [{ id: "20", title: "Archive", children: [] }],
        },
      ],
    },
  ];
}

function layout(partial: Partial<LayoutSettings> = {}): LayoutSettings {
  return { ...DEFAULT_LAYOUT, ...partial };
}

function fakeBookmarks(tree: BookmarkNode[] = sampleTree()): BookmarksApi & {
  calls: CallLog;
  tree: BookmarkNode[];
  listeners: Array<() => void>;
} {
  const calls: CallLog = [];
  const listeners: Array<() => void> = [];
  return {
    calls,
    tree,
    listeners,
    async getTree() {
      calls.push("getTree");
      return tree;
    },
    async createFolder() {
      calls.push("createFolder");
      throw new Error("unexpected createFolder");
    },
    async createBookmark() {
      calls.push("createBookmark");
      throw new Error("unexpected createBookmark");
    },
    async update() {
      calls.push("update");
      throw new Error("unexpected update");
    },
    async move() {
      calls.push("move");
      throw new Error("unexpected move");
    },
    async remove(id) {
      calls.push(`remove:${id}`);
      const removeFrom = (nodes: BookmarkNode[]): boolean => {
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          if (!node) continue;
          if (node.id === id) {
            nodes.splice(i, 1);
            return true;
          }
          if (node.children && removeFrom(node.children)) return true;
        }
        return false;
      };
      if (!removeFrom(tree)) throw new Error(`missing node ${id}`);
    },
    subscribe(listener) {
      calls.push("subscribe");
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      };
    },
  };
}

function fakeSettings(initial: {
  layout?: LayoutSettings;
  defaultFolderId?: string | null;
  openFolderId?: string | null;
} = {}): SettingsApi & { calls: CallLog; storedLayout: LayoutSettings } {
  const calls: CallLog = [];
  let storedLayout = layout(initial.layout);
  let defaultFolderId = initial.defaultFolderId ?? null;
  let openFolderId = initial.openFolderId ?? null;
  return {
    calls,
    get storedLayout() {
      return storedLayout;
    },
    async getOpenFolderId() {
      calls.push("getOpenFolderId");
      return openFolderId;
    },
    async setOpenFolderId(id) {
      calls.push(`setOpenFolderId:${id}`);
      openFolderId = id;
    },
    async getDefaultFolderId() {
      calls.push("getDefaultFolderId");
      return defaultFolderId;
    },
    async setDefaultFolderId(id) {
      calls.push(`setDefaultFolderId:${id}`);
      defaultFolderId = id;
    },
    async getLayout() {
      calls.push("getLayout");
      return { ...storedLayout };
    },
    async setLayout(next) {
      calls.push("setLayout");
      storedLayout = { ...next };
    },
    async resetToDefaults() {
      calls.push("resetToDefaults");
      storedLayout = { ...DEFAULT_LAYOUT };
      defaultFolderId = null;
      return { ...storedLayout };
    },
    async clearAll() {
      calls.push("clearAll");
      storedLayout = { ...DEFAULT_LAYOUT };
      defaultFolderId = null;
      openFolderId = null;
    },
  };
}

function fakeImages(initial: Record<string, string> = {}): ImagesApi & { calls: CallLog; map: Record<string, string> } {
  const calls: CallLog = [];
  const map = { ...initial };
  return {
    calls,
    map,
    async getAll() {
      calls.push("getAll");
      return { ...map };
    },
    async setImage(id, dataUrl) {
      calls.push(`setImage:${id}`);
      map[id] = dataUrl;
    },
    async clearImage(id) {
      calls.push(`clearImage:${id}`);
      delete map[id];
    },
    async clearMissing() {
      calls.push("clearMissing");
    },
    async clearAll() {
      calls.push("clearAll");
      for (const key of Object.keys(map)) delete map[key];
    },
  };
}

function fakePermissions(overrides: Partial<PermissionsApi> = {}): PermissionsApi & { calls: CallLog } {
  const calls: CallLog = [];
  const base: PermissionsApi & { calls: CallLog } = {
    calls,
    async requestThumbnailAccess() {
      calls.push("requestThumbnailAccess");
      return true;
    },
    async removeThumbnailAccess() {
      calls.push("removeThumbnailAccess");
    },
    async hasThumbnailAccess() {
      calls.push("hasThumbnailAccess");
      return false;
    },
    async requestImageUrlFetchAccess() {
      calls.push("requestImageUrlFetchAccess");
      return true;
    },
    async removeImageUrlFetchAccess() {
      calls.push("removeImageUrlFetchAccess");
    },
    async hasImageUrlFetchAccess() {
      calls.push("hasImageUrlFetchAccess");
      return false;
    },
    async canFetchUrl() {
      calls.push("canFetchUrl");
      return false;
    },
    async requestFetchAccess() {
      calls.push("requestFetchAccess");
      return false;
    },
  };
  return { ...base, ...overrides, calls };
}

function fakeCapture(): CaptureApi {
  return {
    async capturePage() {
      throw new Error("unexpected capturePage");
    },
  };
}

type Harness = {
  views: ViewModel[];
  actions: () => ViewActions;
  bookmarks: ReturnType<typeof fakeBookmarks>;
  settings: ReturnType<typeof fakeSettings>;
  images: ReturnType<typeof fakeImages>;
  permissions: ReturnType<typeof fakePermissions>;
  stop: () => void;
  ready: () => Promise<ViewModel>;
};

async function boot(ports: {
  bookmarks?: ReturnType<typeof fakeBookmarks>;
  settings?: ReturnType<typeof fakeSettings>;
  images?: ReturnType<typeof fakeImages>;
  permissions?: ReturnType<typeof fakePermissions>;
  confirm?: (options: ConfirmDialogOptions) => Promise<boolean>;
} = {}): Promise<Harness> {
  const bookmarks = ports.bookmarks ?? fakeBookmarks();
  const settings = ports.settings ?? fakeSettings();
  const images = ports.images ?? fakeImages();
  const permissions = ports.permissions ?? fakePermissions();
  const views: ViewModel[] = [];
  let actions: ViewActions | null = null;

  const appPorts: AppPorts = {
    bookmarks,
    settings,
    images,
    permissions,
    capture: fakeCapture(),
    render(_host, view, nextActions) {
      views.push(view);
      actions = nextActions;
    },
    confirm: ports.confirm ?? (async () => false),
  };

  const stop = start({} as HTMLElement, appPorts);

  const ready = async (): Promise<ViewModel> => {
    for (let i = 0; i < 80; i++) {
      const last = views.at(-1);
      if (last && last.name !== "loading") {
        assert.ok(actions, "render should provide ViewActions");
        return last;
      }
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    throw new Error(`app stayed loading: ${JSON.stringify(views.at(-1))}`);
  };

  await ready();
  return {
    views,
    actions: () => {
      assert.ok(actions, "ViewActions missing");
      return actions;
    },
    bookmarks,
    settings,
    images,
    permissions,
    stop,
    ready,
  };
}

function lastGrid(views: ViewModel[]): Extract<ViewModel, { name: "grid" }> {
  for (let i = views.length - 1; i >= 0; i--) {
    const view = views[i];
    if (view?.name === "grid") return view;
  }
  throw new Error("no grid view rendered");
}

function permissionCallsSince(permissions: { calls: CallLog }, startIndex: number): string[] {
  return permissions.calls.slice(startIndex);
}

test("P0-1 saveLayout permission transitions persist via SettingsApi", async () => {
  type Case = {
    name: string;
    initial: Partial<LayoutSettings>;
    requested: Partial<LayoutSettings>;
    /** Return values for permission probes during the layout change (after boot). */
    answers: {
      requestThumbnailAccess?: boolean;
      requestImageUrlFetchAccess?: boolean;
      hasThumbnailAccess?: boolean;
      hasImageUrlFetchAccess?: boolean;
    };
    expectPersisted: Partial<LayoutSettings>;
    expectError: string | null;
    expectThumbnailsActive?: boolean;
    expectPermissionCalls: string[];
  };

  const cases: Case[] = [
    {
      name: "deny thumbnail enable stays off and persists off",
      initial: {},
      requested: { thumbnailsEnabled: true },
      answers: { requestThumbnailAccess: false },
      expectPersisted: { thumbnailsEnabled: false },
      expectError: thumbnailPermissionDeniedMessage(),
      expectThumbnailsActive: false,
      expectPermissionCalls: ["requestThumbnailAccess"],
    },
    {
      name: "grant thumbnail enable becomes active",
      initial: {},
      requested: { thumbnailsEnabled: true },
      answers: { requestThumbnailAccess: true },
      expectPersisted: { thumbnailsEnabled: true },
      expectError: null,
      expectThumbnailsActive: true,
      expectPermissionCalls: ["requestThumbnailAccess"],
    },
    {
      name: "thumbnails off while URL-fetch on re-owns hosts before revoke",
      initial: { thumbnailsEnabled: true, imageUrlFetchEnabled: true },
      requested: { thumbnailsEnabled: false, imageUrlFetchEnabled: true },
      answers: {
        requestImageUrlFetchAccess: true,
        hasImageUrlFetchAccess: true,
      },
      expectPersisted: { thumbnailsEnabled: false, imageUrlFetchEnabled: true },
      expectError: null,
      expectPermissionCalls: [
        "requestImageUrlFetchAccess",
        "removeThumbnailAccess",
        "hasImageUrlFetchAccess",
      ],
    },
    {
      name: "URL-fetch off leaves thumbnail grants alone",
      initial: { thumbnailsEnabled: true, imageUrlFetchEnabled: true },
      requested: { thumbnailsEnabled: true, imageUrlFetchEnabled: false },
      answers: { hasThumbnailAccess: true },
      expectPersisted: { thumbnailsEnabled: true, imageUrlFetchEnabled: false },
      expectError: null,
      expectThumbnailsActive: true,
      expectPermissionCalls: ["hasThumbnailAccess", "removeImageUrlFetchAccess"],
    },
    {
      name: "revoked thumbnails demote without URL denial banner",
      initial: { thumbnailsEnabled: true, imageUrlFetchEnabled: true },
      requested: { thumbnailsEnabled: true, imageUrlFetchEnabled: true },
      answers: { hasThumbnailAccess: false, hasImageUrlFetchAccess: true },
      expectPersisted: { thumbnailsEnabled: false, imageUrlFetchEnabled: true },
      expectError: thumbnailPermissionDeniedMessage(),
      expectPermissionCalls: ["hasThumbnailAccess", "hasImageUrlFetchAccess"],
    },
    {
      name: "deny URL-fetch enable stays off",
      initial: {},
      requested: { imageUrlFetchEnabled: true },
      answers: { requestImageUrlFetchAccess: false },
      expectPersisted: { imageUrlFetchEnabled: false },
      expectError: imageUrlPermissionDeniedMessage(),
      expectPermissionCalls: ["requestImageUrlFetchAccess"],
    },
  ];

  for (const entry of cases) {
    let thumbnailProbeCount = 0;
    const permissions = fakePermissions({
      async requestThumbnailAccess() {
        permissions.calls.push("requestThumbnailAccess");
        return entry.answers.requestThumbnailAccess ?? true;
      },
      async removeThumbnailAccess() {
        permissions.calls.push("removeThumbnailAccess");
      },
      async hasThumbnailAccess() {
        permissions.calls.push("hasThumbnailAccess");
        thumbnailProbeCount += 1;
        // Boot sync must see the grant so the preference stays on; the layout
        // change then observes a mid-session revoke (chrome://extensions).
        if (entry.answers.hasThumbnailAccess === false) {
          return thumbnailProbeCount === 1;
        }
        if (entry.answers.hasThumbnailAccess !== undefined) {
          return entry.answers.hasThumbnailAccess;
        }
        return Boolean(entry.initial.thumbnailsEnabled);
      },
      async requestImageUrlFetchAccess() {
        permissions.calls.push("requestImageUrlFetchAccess");
        return entry.answers.requestImageUrlFetchAccess ?? true;
      },
      async removeImageUrlFetchAccess() {
        permissions.calls.push("removeImageUrlFetchAccess");
      },
      async hasImageUrlFetchAccess() {
        permissions.calls.push("hasImageUrlFetchAccess");
        if (entry.answers.hasImageUrlFetchAccess !== undefined) {
          return entry.answers.hasImageUrlFetchAccess;
        }
        return Boolean(entry.initial.imageUrlFetchEnabled);
      },
    });

    const settings = fakeSettings({ layout: layout(entry.initial) });
    const harness = await boot({ settings, permissions });
    const afterBoot = permissions.calls.length;
    settings.calls.length = 0;

    const returned = await Promise.resolve(
      harness.actions().setLayout(layout({ ...entry.initial, ...entry.requested })),
    );
    assert.ok(returned, `${entry.name}: setLayout should return LayoutSettings`);
    await harness.ready();

    for (const [key, value] of Object.entries(entry.expectPersisted)) {
      assert.equal(
        returned[key as keyof LayoutSettings],
        value,
        `${entry.name}: returned.${key}`,
      );
      assert.equal(
        settings.storedLayout[key as keyof LayoutSettings],
        value,
        `${entry.name}: persisted.${key}`,
      );
    }
    assert.ok(settings.calls.includes("setLayout"), `${entry.name}: setLayout persisted`);

    const grid = lastGrid(harness.views);
    assert.equal(grid.error, entry.expectError, `${entry.name}: error copy`);
    if (entry.expectThumbnailsActive !== undefined) {
      assert.equal(grid.thumbnailsActive, entry.expectThumbnailsActive, `${entry.name}: active`);
    }
    if (entry.expectError === thumbnailPermissionDeniedMessage()) {
      assert.notEqual(
        grid.error,
        imageUrlPermissionDeniedMessage(),
        `${entry.name}: must not show sibling URL denial`,
      );
    }
    assert.deepEqual(
      permissionCallsSince(permissions, afterBoot),
      entry.expectPermissionCalls,
      `${entry.name}: permission call order`,
    );
    harness.stop();
  }
});
test("P0-2 Reset never clears images or bookmarks; revokes only enabled grants", async () => {
  const settings = fakeSettings({
    layout: layout({ thumbnailsEnabled: true, imageUrlFetchEnabled: false, columns: 7 }),
    defaultFolderId: "10",
  });
  const images = fakeImages({ "11": "data:image/png;base64,aa==" });
  const permissions = fakePermissions({
    async hasThumbnailAccess() {
      permissions.calls.push("hasThumbnailAccess");
      return true;
    },
  });
  const harness = await boot({ settings, images, permissions });
  const bookmarkCallsBefore = [...harness.bookmarks.calls];
  permissions.calls.length = 0;
  settings.calls.length = 0;
  images.calls.length = 0;

  const result = await Promise.resolve(harness.actions().resetToDefaults());
  if (!result) throw new Error("resetToDefaults should return DangerZoneResult");
  await harness.ready();

  assert.deepEqual(result.layout, DEFAULT_LAYOUT);
  assert.equal(result.defaultFolderId, null);
  assert.deepEqual(permissions.calls, ["removeThumbnailAccess"]);
  assert.ok(settings.calls.includes("resetToDefaults"));
  assert.ok(!settings.calls.includes("clearAll"));
  assert.deepEqual(images.calls, []);
  assert.equal(images.map["11"], "data:image/png;base64,aa==");
  assert.deepEqual(
    harness.bookmarks.calls.filter((c) => c !== "getTree" && c !== "subscribe"),
    bookmarkCallsBefore.filter((c) => c !== "getTree" && c !== "subscribe"),
  );
  const grid = lastGrid(harness.views);
  assert.deepEqual(grid.layout, DEFAULT_LAYOUT);
  assert.equal(grid.defaultFolderId, null);
  harness.stop();
});

test("P0-2 Erase clears settings and images, never bookmarks; revokes enabled grants", async () => {
  const settings = fakeSettings({
    layout: layout({ thumbnailsEnabled: true, imageUrlFetchEnabled: true }),
    defaultFolderId: "10",
  });
  const images = fakeImages({
    "11": "data:image/png;base64,aa==",
    "12": "data:image/png;base64,bb==",
  });
  const permissions = fakePermissions({
    async hasThumbnailAccess() {
      permissions.calls.push("hasThumbnailAccess");
      return true;
    },
    async hasImageUrlFetchAccess() {
      permissions.calls.push("hasImageUrlFetchAccess");
      return true;
    },
  });
  const harness = await boot({ settings, images, permissions });
  permissions.calls.length = 0;
  settings.calls.length = 0;
  images.calls.length = 0;
  const bookmarkMutations = () =>
    harness.bookmarks.calls.filter((c) => !["getTree", "subscribe"].includes(c));
  const mutationsBefore = bookmarkMutations();

  const result = await Promise.resolve(harness.actions().eraseAllData());
  if (!result) throw new Error("eraseAllData should return DangerZoneResult");
  await harness.ready();

  assert.deepEqual(result.layout, DEFAULT_LAYOUT);
  assert.equal(result.defaultFolderId, null);
  assert.deepEqual(permissions.calls, ["removeImageUrlFetchAccess", "removeThumbnailAccess"]);
  assert.ok(settings.calls.includes("clearAll"));
  assert.ok(!settings.calls.includes("resetToDefaults"));
  assert.deepEqual(images.calls, ["clearAll"]);
  assert.deepEqual(images.map, {});
  assert.deepEqual(bookmarkMutations(), mutationsBefore);
  const grid = lastGrid(harness.views);
  assert.deepEqual(grid.layout, DEFAULT_LAYOUT);
  assert.equal(grid.defaultFolderId, null);
  harness.stop();
});

test("P0-2 Danger Zone skips revoke when both optional toggles were already off", async () => {
  const settings = fakeSettings({ layout: layout() });
  const permissions = fakePermissions();
  const harness = await boot({ settings, permissions });
  permissions.calls.length = 0;

  await harness.actions().resetToDefaults();
  assert.deepEqual(permissions.calls, []);

  permissions.calls.length = 0;
  await harness.actions().eraseAllData();
  assert.deepEqual(permissions.calls, []);
  harness.stop();
});

test("P0-4 default folder wins for a new window", async () => {
  const settings = fakeSettings({
    defaultFolderId: "10",
    openFolderId: "20",
  });
  const harness = await boot({ settings });
  const grid = lastGrid(harness.views);
  assert.equal(grid.currentFolder.id, "10");
  harness.stop();
});

test("P0-4 unset default recalls last-open folder", async () => {
  const settings = fakeSettings({
    defaultFolderId: null,
    openFolderId: "20",
  });
  const harness = await boot({ settings });
  const grid = lastGrid(harness.views);
  assert.equal(grid.currentFolder.id, "20");
  harness.stop();
});

test("P0-4 deleted stored folder falls back to root", async () => {
  const settings = fakeSettings({
    defaultFolderId: null,
    openFolderId: "missing-folder",
  });
  const harness = await boot({ settings });
  const grid = lastGrid(harness.views);
  assert.equal(grid.currentFolder.id, "0");
  harness.stop();
});

test("P0-4 bookmark-id stored as folder falls back to root", async () => {
  const settings = fakeSettings({
    defaultFolderId: "11", // Example bookmark, not a folder
    openFolderId: "11",
  });
  const harness = await boot({ settings });
  const grid = lastGrid(harness.views);
  assert.equal(grid.currentFolder.id, "0");
  harness.stop();
});

test("P1-3 folder delete clears pictures for every descendant id", async () => {
  const tree = sampleTree();
  const news = tree[0]?.children?.[0]?.children?.[0];
  assert.ok(news && news.children);
  news.children.push(
    { id: "101", title: "Nested link", url: "https://nested.example/" },
    { id: "102", title: "Deep folder", children: [{ id: "1021", title: "Deep link", url: "https://deep.example/" }] },
  );

  const bookmarks = fakeBookmarks(tree);
  const images = fakeImages({
    "10": "data:image/png;base64,folder==",
    "101": "data:image/png;base64,child==",
    "102": "data:image/png;base64,sub==",
    "1021": "data:image/png;base64,deep==",
    "11": "data:image/png;base64,keep==",
  });
  const harness = await boot({
    bookmarks,
    images,
    confirm: async () => true,
  });

  harness.actions().requestDelete("10");

  for (let i = 0; i < 80; i++) {
    const cleared = images.calls.filter((c) => c.startsWith("clearImage:"));
    if (cleared.length >= 4 && bookmarks.calls.includes("remove:10")) break;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  await harness.ready();

  assert.ok(bookmarks.calls.includes("remove:10"));
  assert.deepEqual(
    images.calls.filter((c) => c.startsWith("clearImage:")).sort(),
    ["clearImage:10", "clearImage:101", "clearImage:102", "clearImage:1021"].sort(),
  );
  assert.equal(images.map["11"], "data:image/png;base64,keep==");
  assert.equal(images.map["10"], undefined);
  assert.equal(images.map["101"], undefined);
  assert.equal(images.map["102"], undefined);
  assert.equal(images.map["1021"], undefined);
  harness.stop();
});

test("P1-3 declined delete confirm calls nothing", async () => {
  const bookmarks = fakeBookmarks();
  const images = fakeImages({ "11": "data:image/png;base64,keep==" });
  let confirmCalls = 0;
  const harness = await boot({
    bookmarks,
    images,
    confirm: async () => {
      confirmCalls += 1;
      return false;
    },
  });

  const bookmarkCallsBefore = bookmarks.calls.slice();
  const imageCallsBefore = images.calls.slice();

  harness.actions().requestDelete("11");
  await new Promise<void>((resolve) => setImmediate(resolve));
  await harness.ready();

  assert.equal(confirmCalls, 1);
  assert.deepEqual(bookmarks.calls, bookmarkCallsBefore);
  assert.deepEqual(images.calls, imageCallsBefore);
  assert.equal(images.map["11"], "data:image/png;base64,keep==");
  harness.stop();
});

test("P2-4 reload drops stale getTree responses when a newer request wins", async () => {
  const bookmarks = fakeBookmarks();
  const harness = await boot({ bookmarks });
  assert.equal(bookmarks.listeners.length, 1);
  const listener = bookmarks.listeners[0];
  assert.ok(listener);

  type Gate = { resolve: (tree: BookmarkNode[]) => void };
  const gates: Gate[] = [];
  bookmarks.getTree = async () => {
    bookmarks.calls.push("getTree");
    return await new Promise<BookmarkNode[]>((resolve) => {
      gates.push({ resolve });
    });
  };

  // Stale request starts first.
  listener();
  // Newer request starts while the first is still pending.
  listener();

  for (let i = 0; i < 40; i++) {
    if (gates.length >= 2) break;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  assert.equal(gates.length, 2);

  const viewsBefore = harness.views.length;
  const staleTree: BookmarkNode[] = [
    {
      id: "0",
      title: "Bookmarks",
      children: [{ id: "stale", title: "Stale Only", children: [] }],
    },
  ];
  const freshTree: BookmarkNode[] = [
    {
      id: "0",
      title: "Bookmarks",
      children: [{ id: "fresh", title: "Fresh Only", children: [] }],
    },
  ];

  // Newer (second) response arrives first.
  gates[1]!.resolve(freshTree);
  for (let i = 0; i < 40; i++) {
    if (harness.views.length > viewsBefore) break;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  await harness.ready();
  assert.equal(lastGrid(harness.views).items.some((item) => item.id === "fresh"), true);
  assert.equal(lastGrid(harness.views).items.some((item) => item.id === "stale"), false);

  const viewsAfterFresh = harness.views.length;
  // Stale (first) response arrives later and must be ignored.
  gates[0]!.resolve(staleTree);
  for (let i = 0; i < 20; i++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  assert.equal(harness.views.length, viewsAfterFresh);
  assert.equal(lastGrid(harness.views).items.some((item) => item.id === "fresh"), true);
  assert.equal(lastGrid(harness.views).items.some((item) => item.id === "stale"), false);
  harness.stop();
});
