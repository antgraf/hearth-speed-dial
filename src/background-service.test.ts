import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ADD_MENU_ID,
  ADD_WINDOW,
  REFRESH_ALL_MENU_ID,
  WEB_DOCUMENT_PATTERNS,
  addPopupCreateData,
  dialDocumentPatterns,
  ensureMenu,
  registerBackgroundMenus,
  startBackground,
  type BackgroundChrome,
} from "./background-service.ts";
import { t } from "./i18n.ts";

type FakeChrome = BackgroundChrome & {
  calls: string[];
  menus: chrome.contextMenus.CreateProperties[];
  installed?: () => void;
  startup?: () => void;
  clicked?: (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => void;
  windowsCreated: chrome.windows.CreateData[];
};

function fakeChrome(): FakeChrome {
  const calls: string[] = [];
  const menus: chrome.contextMenus.CreateProperties[] = [];
  const windowsCreated: chrome.windows.CreateData[] = [];
  const api: FakeChrome = {
    calls,
    menus,
    windowsCreated,
    runtime: {
      getURL: (path) => `chrome-extension://hearth-test/${path}`,
      onInstalled: {
        addListener(listener) {
          calls.push("onInstalled.addListener");
          api.installed = listener;
        },
      },
      onStartup: {
        addListener(listener) {
          calls.push("onStartup.addListener");
          api.startup = listener;
        },
      },
    },
    contextMenus: {
      removeAll(callback) {
        calls.push("contextMenus.removeAll");
        menus.length = 0;
        callback?.();
      },
      create(createProperties, callback) {
        calls.push(`contextMenus.create:${String(createProperties.id)}`);
        menus.push(createProperties);
        callback?.();
        return createProperties.id ?? "menu";
      },
      onClicked: {
        addListener(listener) {
          calls.push("contextMenus.onClicked.addListener");
          api.clicked = listener;
        },
      },
    },
    windows: {
      async create(createData) {
        calls.push("windows.create");
        windowsCreated.push(createData);
        return { id: 1 } as chrome.windows.Window;
      },
    },
    tabs: {
      async get(tabId) {
        calls.push(`tabs.get:${tabId}`);
        return { id: tabId, title: "Fetched title" } as chrome.tabs.Tab;
      },
      async sendMessage(tabId, message) {
        calls.push(`tabs.sendMessage:${tabId}:${JSON.stringify(message)}`);
        return undefined;
      },
    },
  };
  return api;
}

test("ADD_WINDOW pins the Add-to-Hearth popup size", () => {
  assert.deepEqual(ADD_WINDOW, { width: 420, height: 520 });
  const createData = addPopupCreateData("url=https%3A%2F%2Fexample.com%2F", (path) => `ext://${path}`);
  assert.equal(createData.type, "popup");
  assert.equal(createData.width, 420);
  assert.equal(createData.height, 520);
  assert.equal(createData.focused, true);
  assert.equal(createData.url, "ext://add.html?url=https%3A%2F%2Fexample.com%2F");
});

test("dialDocumentPatterns keeps exact dial URL plus extension origin /*", () => {
  const chromePatterns = dialDocumentPatterns((path) => `chrome-extension://id/${path}`);
  assert.deepEqual(chromePatterns, [
    "chrome-extension://id/index.html",
    "chrome-extension://id/*",
  ]);
  const firefoxPatterns = dialDocumentPatterns((path) => `moz-extension://ff/${path}`);
  assert.deepEqual(firefoxPatterns, ["moz-extension://ff/index.html", "moz-extension://ff/*"]);
  // Regression: literal `?*` / `index.html*` left Refresh All missing on every
  // dial page in Chrome after removeAll + create. Prefer exact + origin/*.
  for (const pattern of [...chromePatterns, ...firefoxPatterns]) {
    assert.equal(pattern.includes("?*"), false);
    assert.equal(pattern.endsWith("index.html*"), false);
  }
});

test("ensureMenu registers Add and Refresh All with the expected patterns", async () => {
  const api = fakeChrome();
  await ensureMenu(api);
  assert.ok(api.calls.includes("contextMenus.removeAll"));
  assert.equal(api.menus.length, 2);
  assert.deepEqual(api.menus[0], {
    id: ADD_MENU_ID,
    title: t("context_add_to_hearth"),
    contexts: ["page", "link"],
    documentUrlPatterns: [...WEB_DOCUMENT_PATTERNS],
  });
  assert.deepEqual(api.menus[1], {
    id: REFRESH_ALL_MENU_ID,
    title: t("context_refresh_all_thumbnails"),
    contexts: ["page"],
    documentUrlPatterns: [
      "chrome-extension://hearth-test/index.html",
      "chrome-extension://hearth-test/*",
    ],
  });
});

test("ensureMenu falls back to exact dial when multi-pattern create fails", async () => {
  const api = fakeChrome();
  let refreshCreates = 0;
  api.contextMenus.create = (createProperties, callback) => {
    api.calls.push(`contextMenus.create:${String(createProperties.id)}`);
    api.menus.push(createProperties);
    if (createProperties.id === REFRESH_ALL_MENU_ID) {
      refreshCreates += 1;
      const patterns = createProperties.documentUrlPatterns ?? [];
      if (refreshCreates === 1 && patterns.length > 1) {
        api.runtime.lastError = { message: "Invalid url pattern '*'" };
        callback?.();
        api.runtime.lastError = null;
        return createProperties.id ?? "menu";
      }
    }
    callback?.();
    return createProperties.id ?? "menu";
  };
  await ensureMenu(api);
  const refreshMenus = api.menus.filter((menu) => menu.id === REFRESH_ALL_MENU_ID);
  assert.equal(refreshCreates, 2);
  assert.equal(refreshMenus.length, 2);
  assert.deepEqual(refreshMenus[1]?.documentUrlPatterns, [
    "chrome-extension://hearth-test/index.html",
  ]);
});

test("ensureMenu works when removeAll is promise-only (Firefox browser.*)", async () => {
  const api = fakeChrome();
  api.contextMenus.removeAll = () => {
    api.calls.push("contextMenus.removeAll");
    api.menus.length = 0;
    return Promise.resolve();
  };
  await ensureMenu(api);
  assert.equal(api.menus.length, 2);
  assert.equal(api.menus[0]?.id, ADD_MENU_ID);
});

test("registerBackgroundMenus re-registers on onStartup after the initial ensure", async () => {
  const api = fakeChrome();
  registerBackgroundMenus(api);
  await Promise.resolve();
  await Promise.resolve();

  assert.ok(api.calls.includes("onInstalled.addListener"));
  assert.ok(api.calls.includes("onStartup.addListener"));
  const ensureCalls = () => api.calls.filter((c) => c === "contextMenus.removeAll").length;
  assert.equal(ensureCalls(), 1);

  assert.ok(api.startup);
  api.startup();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(ensureCalls(), 2);
  assert.equal(api.menus.length, 2);

  assert.ok(api.installed);
  api.installed();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(ensureCalls(), 3);
});

test("startBackground opens a sized popup for Add to Hearth clicks", async () => {
  const api = fakeChrome();
  startBackground(api);
  assert.ok(api.clicked);

  api.clicked(
    {
      menuItemId: ADD_MENU_ID,
      pageUrl: "https://example.com/article",
    } as chrome.contextMenus.OnClickData,
    { id: 9, title: "Example Article" } as chrome.tabs.Tab,
  );

  for (let i = 0; i < 40; i++) {
    if (api.windowsCreated.length > 0) break;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }

  assert.equal(api.windowsCreated.length, 1);
  const created = api.windowsCreated[0]!;
  assert.equal(created.type, "popup");
  assert.equal(created.width, ADD_WINDOW.width);
  assert.equal(created.height, ADD_WINDOW.height);
  assert.equal(created.focused, true);
  assert.match(String(created.url), /^chrome-extension:\/\/hearth-test\/add\.html\?/);
  assert.match(String(created.url), /url=https%3A%2F%2Fexample\.com%2Farticle/);
  assert.match(String(created.url), /title=Example(\+|%20)Article/);
});
