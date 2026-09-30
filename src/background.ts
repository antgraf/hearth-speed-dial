import { addPageQuery } from "./model.ts";
import { refreshAllThumbnailsMessage } from "./messages.ts";

const ADD_MENU_ID = "add-to-hearth";
const REFRESH_ALL_MENU_ID = "refresh-all-thumbnails";

/** Popup size tuned to the Add form; CSS fills larger windows without a tiny floating card. */
const ADD_WINDOW = { width: 420, height: 520 };

/** http(s) pages only — hide Add to Hearth on chrome-extension:// dial / options pages. */
const WEB_DOCUMENT_PATTERNS = ["http://*/*", "https://*/*"] as const;

function dialDocumentPatterns(): string[] {
  // New-tab override is index.html; query strings still match this path pattern.
  return [chrome.runtime.getURL("index.html")];
}

function ensureMenu(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: ADD_MENU_ID,
      title: "Add to Hearth…",
      contexts: ["page", "link"],
      documentUrlPatterns: [...WEB_DOCUMENT_PATTERNS],
    });
    chrome.contextMenus.create({
      id: REFRESH_ALL_MENU_ID,
      title: "Refresh All Thumbnails",
      contexts: ["page"],
      documentUrlPatterns: dialDocumentPatterns(),
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  ensureMenu();
});

// Service workers can restart without onInstalled; keep the menu registered.
chrome.runtime.onStartup.addListener(() => {
  ensureMenu();
});

ensureMenu();

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === ADD_MENU_ID) {
    void openAddWindow(info, tab);
    return;
  }
  if (info.menuItemId === REFRESH_ALL_MENU_ID) {
    void requestRefreshAllThumbnails(tab);
  }
});

async function requestRefreshAllThumbnails(tab: chrome.tabs.Tab | undefined): Promise<void> {
  if (tab?.id == null) return;
  try {
    await chrome.tabs.sendMessage(tab.id, refreshAllThumbnailsMessage());
  } catch {
    // Dial page may not be listening yet (cold load); ignore.
  }
}

async function resolvePageTitle(
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
    const full = await chrome.tabs.get(tab.id);
    const title = full.title?.trim();
    return title || undefined;
  } catch {
    return undefined;
  }
}

async function openAddWindow(
  info: chrome.contextMenus.OnClickData,
  tab: chrome.tabs.Tab | undefined,
): Promise<void> {
  const tabTitle = await resolvePageTitle(info, tab);
  const query = addPageQuery({
    linkUrl: info.linkUrl,
    pageUrl: info.pageUrl,
    selectionText: info.selectionText,
    tabTitle,
  });
  if (!query) return;
  void chrome.windows.create({
    url: chrome.runtime.getURL(`add.html?${query}`),
    type: "popup",
    width: ADD_WINDOW.width,
    height: ADD_WINDOW.height,
    focused: true,
  });
}
