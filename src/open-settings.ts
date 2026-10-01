/** Open the extension Settings page (new-tab gear, etc.). */
import { tryExtensionApi, type ExtensionApi } from "./webext.ts";

export type SettingsRuntime = Pick<ExtensionApi["runtime"], "openOptionsPage" | "getURL">;
export type SettingsTabs = Pick<ExtensionApi["tabs"], "create">;

function defaultRuntime(): SettingsRuntime {
  const api = tryExtensionApi();
  if (!api?.runtime) {
    throw new Error("Extension runtime is not available.");
  }
  return api.runtime;
}

function defaultTabs(): SettingsTabs | null {
  const api = tryExtensionApi();
  return api?.tabs ?? null;
}

export async function openChromeSettingsPage(
  runtime: SettingsRuntime = defaultRuntime(),
  tabs: SettingsTabs | null = defaultTabs(),
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
