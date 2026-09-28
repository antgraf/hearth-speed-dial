import assert from "node:assert/strict";
import { test } from "node:test";
import { openChromeSettingsPage } from "./open-settings.ts";

test("openChromeSettingsPage prefers openOptionsPage when it succeeds", async () => {
  const calls: string[] = [];
  await openChromeSettingsPage(
    {
      openOptionsPage: async () => {
        calls.push("options");
      },
      getURL: (path) => `chrome-extension://id/${path}`,
    },
    {
      create: async ({ url }) => {
        calls.push(`tab:${url}`);
        return {} as chrome.tabs.Tab;
      },
    },
    (url) => {
      calls.push(`window:${url}`);
    },
  );
  assert.deepEqual(calls, ["options"]);
});

test("openChromeSettingsPage falls back to tabs.create when openOptionsPage fails", async () => {
  const calls: string[] = [];
  await openChromeSettingsPage(
    {
      openOptionsPage: async () => {
        throw new Error("Could not create an options page.");
      },
      getURL: (path) => `chrome-extension://id/${path}`,
    },
    {
      create: async ({ url }) => {
        calls.push(`tab:${url}`);
        return {} as chrome.tabs.Tab;
      },
    },
    (url) => {
      calls.push(`window:${url}`);
    },
  );
  assert.deepEqual(calls, ["tab:chrome-extension://id/settings.html"]);
});

test("openChromeSettingsPage uses window.open when tabs.create is unavailable", async () => {
  const calls: string[] = [];
  await openChromeSettingsPage(
    {
      openOptionsPage: async () => {
        throw new Error("Could not create an options page.");
      },
      getURL: (path) => `chrome-extension://id/${path}`,
    },
    null,
    (url) => {
      calls.push(url);
    },
  );
  assert.deepEqual(calls, ["chrome-extension://id/settings.html"]);
});
