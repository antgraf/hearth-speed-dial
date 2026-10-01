import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  extensionApi,
  extensionBookmarksReady,
  extensionStorageReady,
  supportsChromeFavicon,
  tryExtensionApi,
} from "./webext.ts";

type FakeRuntime = {
  getManifest: () => { permissions?: string[] };
  getURL?: (path: string) => string;
};

type FakeApi = {
  runtime: FakeRuntime;
  bookmarks?: object;
  storage?: { local?: object };
};

function installGlobals(values: { browser?: FakeApi | null; chrome?: FakeApi | null }): void {
  const g = globalThis as Record<string, unknown>;
  if (values.browser === null) delete g.browser;
  else if (values.browser) g.browser = values.browser;
  if (values.chrome === null) delete g.chrome;
  else if (values.chrome) g.chrome = values.chrome;
}

afterEach(() => {
  const g = globalThis as Record<string, unknown>;
  delete g.browser;
  delete g.chrome;
});

test("tryExtensionApi prefers browser over chrome", () => {
  installGlobals({
    browser: { runtime: { getManifest: () => ({ permissions: [] }) }, bookmarks: {} },
    chrome: { runtime: { getManifest: () => ({ permissions: ["favicon"] }) } },
  });
  const api = tryExtensionApi();
  assert.ok(api);
  assert.deepEqual(api.runtime.getManifest().permissions, []);
});

test("tryExtensionApi falls back to chrome when browser is absent", () => {
  installGlobals({
    browser: null,
    chrome: { runtime: { getManifest: () => ({}) }, storage: { local: {} } },
  });
  assert.ok(tryExtensionApi()?.storage?.local);
  assert.equal(extensionStorageReady(), true);
  assert.equal(extensionBookmarksReady(), false);
});

test("extensionApi throws when neither global is present", () => {
  installGlobals({ browser: null, chrome: null });
  assert.equal(tryExtensionApi(), null);
  assert.throws(() => extensionApi(), /browser \/ chrome/);
});

test("supportsChromeFavicon requires favicon in the manifest permissions", () => {
  installGlobals({
    chrome: {
      runtime: {
        getManifest: () => ({ permissions: ["bookmarks", "favicon"] }),
        getURL: (path) => `chrome-extension://id${path}`,
      },
    },
  });
  assert.equal(supportsChromeFavicon(), true);

  installGlobals({
    browser: {
      runtime: {
        getManifest: () => ({ permissions: ["bookmarks", "storage"] }),
        getURL: (path) => `moz-extension://id${path}`,
      },
    },
    chrome: null,
  });
  assert.equal(supportsChromeFavicon(), false);
});
