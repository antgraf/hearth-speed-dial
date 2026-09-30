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
      create(createProperties) {
        calls.push(`contextMenus.create:${String(createProperties.id)}`);
        menus.push(createProperties);
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

test("dialDocumentPatterns targets the new-tab override page", () => {
  assert.deepEqual(dialDocumentPatterns((path) => `chrome-extension://id/${path}`), [
    "chrome-extension://id/index.html",
  ]);
});

test("ensureMenu registers Add and Refresh All with the expected patterns", () => {
  const api = fakeChrome();
  ensureMenu(api);
  assert.ok(api.calls.includes("contextMenus.removeAll"));
  assert.equal(api.menus.length, 2);
  assert.deepEqual(api.menus[0], {
    id: ADD_MENU_ID,
    title: "Add to Hearth…",
    contexts: ["page", "link"],
    documentUrlPatterns: [...WEB_DOCUMENT_PATTERNS],
  });
  assert.deepEqual(api.menus[1], {
    id: REFRESH_ALL_MENU_ID,
    title: "Refresh All Thumbnails",
    contexts: ["page"],
    documentUrlPatterns: ["chrome-extension://hearth-test/index.html"],
  });
});

test("registerBackgroundMenus re-registers on onStartup after the initial ensure", () => {
  const api = fakeChrome();
  registerBackgroundMenus(api);

  assert.ok(api.calls.includes("onInstalled.addListener"));
  assert.ok(api.calls.includes("onStartup.addListener"));
  const ensureCalls = () => api.calls.filter((c) => c === "contextMenus.removeAll").length;
  assert.equal(ensureCalls(), 1);

  assert.ok(api.startup);
  api.startup();
  assert.equal(ensureCalls(), 2);
  assert.equal(api.menus.length, 2);

  assert.ok(api.installed);
  api.installed();
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
