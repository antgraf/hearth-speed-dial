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

/**
 * TEMP diagnostics for Anton (service worker DevTools).
 * Set to false / remove once Refresh All + deep-link matching is confirmed.
 */
export const TEMP_CONTEXT_MENU_DIAGNOSTICS = true;

export type BackgroundChrome = {
  runtime: {
    getURL: (path: string) => string;
    onInstalled: { addListener: (listener: () => void) => void };
    onStartup: { addListener: (listener: () => void) => void };
    /** Present on real chrome.runtime; used to surface create failures. */
    lastError?: { message?: string } | null;
  };
  contextMenus: {
    removeAll: (callback?: () => void) => void | Promise<void>;
    create: (
      createProperties: chrome.contextMenus.CreateProperties,
      callback?: () => void,
    ) => string | number | Promise<string | number>;
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

/** Serialize overlapping ensureMenu calls (onInstalled + onStartup + boot). */
let ensureMenuTail: Promise<void> = Promise.resolve();

function tempMenuLog(message: string, detail?: unknown): void {
  if (!TEMP_CONTEXT_MENU_DIAGNOSTICS) return;
  // Extension error UI stringifies poorly ([object Object]); keep one line of JSON.
  if (detail !== undefined) {
    let serialized: string;
    try {
      serialized = JSON.stringify(detail);
    } catch {
      serialized = String(detail);
    }
    console.warn(`[hearth:TEMP menu] ${message} ${serialized}`);
    return;
  }
  console.warn(`[hearth:TEMP menu] ${message}`);
}

function readLastError(api: BackgroundChrome): string | null {
  const message = api.runtime.lastError?.message?.trim();
  return message ? message : null;
}

/**
 * Create a context menu item and surface chrome.runtime.lastError.
 * Chrome uses an optional callback; Firefox `browser.*` may return a Promise.
 */
export function createContextMenu(
  api: BackgroundChrome,
  props: chrome.contextMenus.CreateProperties,
): Promise<{ ok: boolean; error: string | null }> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (error: string | null) => {
      if (settled) return;
      settled = true;
      resolve({ ok: !error, error });
    };
    try {
      const result = api.contextMenus.create(props, () => {
        finish(readLastError(api));
      });
      if (result != null && typeof (result as PromiseLike<unknown>).then === "function") {
        void Promise.resolve(result).then(
          () => finish(readLastError(api)),
          (error) => finish(error instanceof Error ? error.message : String(error)),
        );
      }
    } catch (error) {
      finish(error instanceof Error ? error.message : String(error));
    }
  });
}

/**
 * Browser NTP override document URLs (contextMenus match these, not the
 * bundled extension path). Anton logged bare dial as `chrome://newtab/`.
 */
export const DIAL_NTP_DOCUMENT_PATTERNS = [
  "chrome://newtab/",
  "chrome://newtab/*",
  "edge://newtab/",
  "edge://newtab/*",
] as const;

/**
 * Refresh All documentUrlPatterns:
 * - chrome://newtab/ (+ /*) / edge://newtab/ — Ctrl+T NTP override tabs
 * - getURL("index.html") — direct extension open
 * - getURL("index.html") + "?*" — middle-click / ?folder= deep links
 *
 * Extension-only patterns never match bare NTP (document URL stays chrome://newtab/).
 */
export function dialDocumentPatterns(getURL: (path: string) => string): string[] {
  const dial = getURL("index.html");
  return [...DIAL_NTP_DOCUMENT_PATTERNS, dial, `${dial}?*`];
}

/** Patterns without edge:// (Chrome may reject edge: as invalid in match patterns). */
export function dialDocumentPatternsChromiumOnly(getURL: (path: string) => string): string[] {
  return dialDocumentPatterns(getURL).filter((pattern) => !pattern.startsWith("edge:"));
}

/**
 * Clear and recreate context menus.
 * Overlapping callers share one chain so removeAll/create cannot interleave.
 */
export function ensureMenu(api: BackgroundChrome): Promise<void> {
  const run = ensureMenuTail.then(() => ensureMenuUnlocked(api));
  ensureMenuTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function ensureMenuUnlocked(api: BackgroundChrome): Promise<void> {
  await clearContextMenus(api);
  tempMenuLog("ensureMenu: cleared; creating Add + Refresh All");

  const addResult = await createContextMenu(api, {
    id: ADD_MENU_ID,
    title: t("context_add_to_hearth"),
    contexts: ["page", "link"],
    documentUrlPatterns: [...WEB_DOCUMENT_PATTERNS],
  });
  tempMenuLog("ensureMenu: Add create", {
    ok: addResult.ok,
    error: addResult.error,
    patterns: [...WEB_DOCUMENT_PATTERNS],
    note: "Add should NOT appear on dial (http/https only)",
  });

  const fullPatterns = dialDocumentPatterns(api.runtime.getURL);
  let patterns = fullPatterns;
  let refreshResult = await createContextMenu(api, {
    id: REFRESH_ALL_MENU_ID,
    title: t("context_refresh_all_thumbnails"),
    contexts: ["page"],
    // Explicit true so a prior update({visible:false}) during dial loading
    // cannot leave a newly recreated item stuck hidden after removeAll.
    visible: true,
    documentUrlPatterns: patterns,
  });
  tempMenuLog("ensureMenu: Refresh All create", {
    ok: refreshResult.ok,
    error: refreshResult.error,
    patterns,
    visible: true,
  });

  // Chrome may reject edge:// in match patterns; retry without Edge NTP entries.
  if (!refreshResult.ok) {
    patterns = dialDocumentPatternsChromiumOnly(api.runtime.getURL);
    refreshResult = await createContextMenu(api, {
      id: REFRESH_ALL_MENU_ID,
      title: t("context_refresh_all_thumbnails"),
      contexts: ["page"],
      visible: true,
      documentUrlPatterns: patterns,
    });
    tempMenuLog("ensureMenu: Refresh All create RETRY without edge://", {
      ok: refreshResult.ok,
      error: refreshResult.error,
      patterns,
      visible: true,
      priorError: fullPatterns === patterns ? null : "edge patterns dropped",
    });
  }
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
    // `activeTab` from the context-menu gesture unlocks the title.
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
      tempMenuLog("onClicked Refresh All", {
        menuItemId: info.menuItemId,
        pageUrl: info.pageUrl ?? null,
        tabUrl: tab?.url ?? null,
      });
      void requestRefreshAllThumbnails(api, tab);
    }
  });
}

/** Wire the full service-worker surface against a chrome-like API. */
export function startBackground(api: BackgroundChrome): void {
  registerBackgroundMenus(api);
  registerContextMenuClicks(api);
}
