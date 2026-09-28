/** Open the extension Settings page from Chrome (new-tab gear, etc.). */
export type SettingsRuntime = Pick<typeof chrome.runtime, "openOptionsPage" | "getURL">;
export type SettingsTabs = Pick<typeof chrome.tabs, "create">;

export async function openChromeSettingsPage(
  runtime: SettingsRuntime = chrome.runtime,
  tabs: SettingsTabs | null = typeof chrome !== "undefined" && chrome.tabs ? chrome.tabs : null,
  openWindow: (url: string) => void = (url) => {
    window.open(url, "_blank", "noopener,noreferrer");
  },
): Promise<void> {
  try {
    await runtime.openOptionsPage();
  } catch {
    const url = runtime.getURL("settings.html");
    if (tabs?.create) {
      await tabs.create({ url });
      return;
    }
    openWindow(url);
  }
}
