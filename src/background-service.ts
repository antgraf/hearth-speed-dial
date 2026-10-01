/**
 * Pure / injectable pieces of the MV3 service worker so Node tests can cover
 * menu re-registration and Add-popup window sizing without importing chrome.
 */

import { addPageQuery } from "./model.ts";
import { refreshAllThumbnailsMessage } from "./messages.ts";
import { t } from "./i18n.ts";

export const ADD_MENU_ID = "add-to-hearth";
export const REFRESH_ALL_MENU_ID = "refresh-all-thumbnails";

/** Popup size tuned to the Add form; CSS fills larger windows without a tiny floating card. */
export const ADD_WINDOW = { width: 420, height: 520 } as const;

/** http(s) pages only — hide Add to Hearth on chrome-extension:// / moz-extension:// dial pages. */
export const WEB_DOCUMENT_PATTERNS = ["http://*/*", "https://*/*"] as const;

export type BackgroundChrome = {
  runtime: {
    getURL: (path: string) => string;
    onInstalled: { addListener: (listener: () => void) => void };
    onStartup: { addListener: (listener: () => void) => void };
  };
  contextMenus: {
    removeAll: (callback?: () => void) => void | Promise<void>;
    create: (createProperties: chrome.contextMenus.CreateProperties) => string | number | Promise<string | number>;
    onClicked: {
      addListener: (
        listener: (
          info: chrome.contextMenus.OnClickData,
          tab?: chrome.tabs.Tab,
        ) => void,
      ) => void;
    };
  };
  windows: {
    create: (createData: chrome.windows.CreateData) => Promise<chrome.windows.Window>;
  };
  tabs: {
    get: (tabId: number) => Promise<chrome.tabs.Tab>;
    sendMessage: (tabId: number, message: unknown) => Promise<unknown>;
  };
};

export function dialDocumentPatterns(getURL: (path: string) => string): string[] {
  // New-tab override is index.html; query strings still match this path pattern.
  // getURL yields chrome-extension://… or moz-extension://… per browser.
  return [getURL("index.html")];
}

/**
 * Clear and recreate context menus.
 * Chrome’s removeAll may invoke a callback and/or return a Promise; Firefox’s
 * `browser.contextMenus.removeAll` is promise-only. Settle once, then create.
 */
export async function ensureMenu(api: BackgroundChrome): Promise<void> {
  await clearContextMenus(api);
  api.contextMenus.create({
    id: ADD_MENU_ID,
    title: t("context_add_to_hearth"),
    contexts: ["page", "link"],
    documentUrlPatterns: [...WEB_DOCUMENT_PATTERNS],
  });
  api.contextMenus.create({
    id: REFRESH_ALL_MENU_ID,
    title: t("context_refresh_all_thumbnails"),
    contexts: ["page"],
    documentUrlPatterns: dialDocumentPatterns(api.runtime.getURL),
  });
}

export function clearContextMenus(api: BackgroundChrome): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    try {
      const result = api.contextMenus.removeAll(done);
      if (result != null && typeof (result as PromiseLike<void>).then === "function") {
        void Promise.resolve(result).then(done, done);
      }
    } catch {
      done();
    }
  });
}

/** Register install/startup listeners and create menus once at load. */
export function registerBackgroundMenus(api: BackgroundChrome): void {
  api.runtime.onInstalled.addListener(() => {
    void ensureMenu(api);
  });
  // Service workers can restart without onInstalled; keep the menu registered.
  api.runtime.onStartup.addListener(() => {
    void ensureMenu(api);
  });
  void ensureMenu(api);
}

export function addPopupCreateData(
  query: string,
  getURL: (path: string) => string,
): chrome.windows.CreateData {
  return {
    url: getURL(`add.html?${query}`),
    type: "popup",
    width: ADD_WINDOW.width,
    height: ADD_WINDOW.height,
    focused: true,
  };
}

export async function resolvePageTitle(
  api: BackgroundChrome,
  info: chrome.contextMenus.OnClickData,
  tab: chrome.tabs.Tab | undefined,
): Promise<string | undefined> {
  // Link adds should not inherit the hosting page title.
  if (info.linkUrl) return undefined;
  const fromEvent = tab?.title?.trim();
  if (fromEvent) return fromEvent;
  if (tab?.id == null) return undefined;
  try {
    // `activeTab` (context-menu gesture) or optional `tabs` can unlock title.
    const full = await api.tabs.get(tab.id);
    const title = full.title?.trim();
    return title || undefined;
  } catch {
    return undefined;
  }
}

export async function openAddWindow(
  api: BackgroundChrome,
  info: chrome.contextMenus.OnClickData,
  tab: chrome.tabs.Tab | undefined,
): Promise<void> {
  const tabTitle = await resolvePageTitle(api, info, tab);
  const query = addPageQuery({
    linkUrl: info.linkUrl,
    pageUrl: info.pageUrl,
    selectionText: info.selectionText,
    tabTitle,
  });
  if (!query) return;
  void api.windows.create(addPopupCreateData(query, api.runtime.getURL));
}

export async function requestRefreshAllThumbnails(
  api: BackgroundChrome,
  tab: chrome.tabs.Tab | undefined,
): Promise<void> {
  if (tab?.id == null) return;
  try {
    await api.tabs.sendMessage(tab.id, refreshAllThumbnailsMessage());
  } catch {
    // Dial page may not be listening yet (cold load); ignore.
  }
}

export function registerContextMenuClicks(api: BackgroundChrome): void {
  api.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === ADD_MENU_ID) {
      void openAddWindow(api, info, tab);
      return;
    }
    if (info.menuItemId === REFRESH_ALL_MENU_ID) {
      void requestRefreshAllThumbnails(api, tab);
    }
  });
}

/** Wire the full service-worker surface against a chrome-like API. */
export function startBackground(api: BackgroundChrome): void {
  registerBackgroundMenus(api);
  registerContextMenuClicks(api);
}
