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

/** NTP scheme for contextMenus documentUrlPatterns (Chrome rejects edge://). */
export type DialNtpKind = "chrome" | "edge";

export const CHROME_NTP_DOCUMENT_PATTERNS = ["chrome://newtab/", "chrome://newtab/*"] as const;
export const EDGE_NTP_DOCUMENT_PATTERNS = ["edge://newtab/", "edge://newtab/*"] as const;

/**
 * Edge Chromium UA includes `Edg/` (not legacy `Edge/`). Service workers expose
 * `navigator.userAgent`; Node tests pass an explicit string.
 */
export function detectDialNtpKind(
  userAgent: string = typeof navigator !== "undefined" ? navigator.userAgent ?? "" : "",
): DialNtpKind {
  return /\bEdg\//.test(userAgent) ? "edge" : "chrome";
}

export function dialNtpDocumentPatterns(kind: DialNtpKind): readonly string[] {
  return kind === "edge" ? EDGE_NTP_DOCUMENT_PATTERNS : CHROME_NTP_DOCUMENT_PATTERNS;
}

/**
 * Refresh All documentUrlPatterns:
 * - chrome://newtab/ (+ /*) on Chrome — Ctrl+T NTP override (Anton: bare dial)
 * - edge://newtab/ (+ /*) only when Edge UA — Chrome rejects edge:// as invalid
 * - getURL("index.html") — direct extension open
 * - getURL("index.html") + "?*" — middle-click / ?folder= deep links
 *
 * Extension-only patterns never match bare NTP (document URL stays chrome://newtab/).
 */
export function dialDocumentPatterns(
  getURL: (path: string) => string,
  kind: DialNtpKind = detectDialNtpKind(),
): string[] {
  const dial = getURL("index.html");
  return [...dialNtpDocumentPatterns(kind), dial, `${dial}?*`];
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

  const ntpKind = detectDialNtpKind();
  const patterns = dialDocumentPatterns(api.runtime.getURL, ntpKind);
  const refreshResult = await createContextMenu(api, {
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
    ntpKind,
    visible: true,
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
