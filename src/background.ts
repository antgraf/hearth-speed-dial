import { addPageQuery } from "./model.ts";

const MENU_ID = "add-to-hearth";

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

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== MENU_ID) return;
  const query = addPageQuery({
    linkUrl: info.linkUrl,
    pageUrl: info.pageUrl,
    selectionText: info.selectionText,
  });
  if (!query) return;
  void chrome.windows.create({
    url: chrome.runtime.getURL(`add.html?${query}`),
    type: "popup",
    width: 440,
    height: 560,
    focused: true,
  });
});
