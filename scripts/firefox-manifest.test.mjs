#!/usr/bin/env node
/**
 * Unit tests for Firefox manifest transform (no browser).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  FIREFOX_DATA_COLLECTION_PERMISSIONS,
  FIREFOX_EXTENSION_ID,
  FIREFOX_STRICT_MIN_VERSION,
  assertFirefoxManifest,
  chromeManifestToFirefox,
} from "./firefox-manifest.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

/** @returns {object} */
function validGecko() {
  return {
    id: FIREFOX_EXTENSION_ID,
    strict_min_version: FIREFOX_STRICT_MIN_VERSION,
    data_collection_permissions: {
      required: [...FIREFOX_DATA_COLLECTION_PERMISSIONS.required],
    },
  };
}

test("chromeManifestToFirefox drops favicon and folds optional hosts", () => {
  const chrome = JSON.parse(readFileSync(resolve(root, "manifest.json"), "utf8"));
  const firefox = chromeManifestToFirefox(chrome);

  assert.equal(firefox.manifest_version, 3);
  assert.equal(firefox.version, chrome.version);
  assert.ok(!firefox.permissions.includes("favicon"));
  assert.deepEqual(
    firefox.permissions,
    chrome.permissions.filter((p) => p !== "favicon"),
  );
  assert.equal(firefox.optional_host_permissions, undefined);
  assert.ok(firefox.optional_permissions.includes("tabs"));
  assert.ok(firefox.optional_permissions.includes("<all_urls>"));
  assert.ok(firefox.optional_permissions.includes("http://*/*"));
  assert.ok(firefox.optional_permissions.includes("https://*/*"));
  assert.equal(firefox.browser_specific_settings.gecko.id, FIREFOX_EXTENSION_ID);
  assert.equal(
    firefox.browser_specific_settings.gecko.strict_min_version,
    FIREFOX_STRICT_MIN_VERSION,
  );
  assert.deepEqual(
    firefox.browser_specific_settings.gecko.data_collection_permissions,
    { required: ["none"] },
  );
  assert.equal(firefox.chrome_url_overrides.newtab, "index.html");
  assert.deepEqual(firefox.background.scripts, ["background.js"]);
  assert.equal(firefox.background.type, "module");
  assert.equal(firefox.background.service_worker, undefined);
  assertFirefoxManifest(firefox);
});

test("assertFirefoxManifest rejects Chrome favicon leftover", () => {
  assert.throws(
    () =>
      assertFirefoxManifest({
        manifest_version: 3,
        permissions: ["bookmarks", "favicon"],
        optional_permissions: ["tabs", "<all_urls>", "http://*/*", "https://*/*"],
        chrome_url_overrides: { newtab: "index.html" },
        background: { scripts: ["background.js"], type: "module" },
        browser_specific_settings: {
          gecko: validGecko(),
        },
      }),
    /favicon/,
  );
});

test("assertFirefoxManifest rejects missing data_collection_permissions", () => {
  assert.throws(
    () =>
      assertFirefoxManifest({
        manifest_version: 3,
        permissions: ["bookmarks", "storage"],
        optional_permissions: ["tabs", "<all_urls>", "http://*/*", "https://*/*"],
        chrome_url_overrides: { newtab: "index.html" },
        background: { scripts: ["background.js"], type: "module" },
        browser_specific_settings: {
          gecko: {
            id: FIREFOX_EXTENSION_ID,
            strict_min_version: FIREFOX_STRICT_MIN_VERSION,
          },
        },
      }),
    /data_collection_permissions/,
  );
});

test("assertFirefoxManifest rejects leftover service_worker", () => {
  assert.throws(
    () =>
      assertFirefoxManifest({
        manifest_version: 3,
        permissions: ["bookmarks"],
        optional_permissions: ["tabs", "<all_urls>", "http://*/*", "https://*/*"],
        chrome_url_overrides: { newtab: "index.html" },
        background: { service_worker: "background.js", type: "module" },
        browser_specific_settings: {
          gecko: validGecko(),
        },
      }),
    /background\.scripts/,
  );
});
