import { addPageQuery } from "./model.ts";

const MENU_ID = "add-to-hearth";

/** Popup size tuned to the Add form; CSS fills larger windows without a tiny floating card. */
const ADD_WINDOW = { width: 420, height: 520 };

function ensureMenu(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Add to Hearth…",
      contexts: ["page", "link"],
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
  if (info.menuItemId !== MENU_ID) return;
  void openAddWindow(info, tab);
});

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
