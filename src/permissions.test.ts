import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  fetchPermissionRequest,
  imageUrlFetchPermissionRemove,
  imageUrlFetchPermissionRequest,
  intersectGrantedPermissions,
  isRequestCoveredByOptionalManifest,
  MANIFEST_OPTIONAL_HOST_PERMISSIONS,
  MANIFEST_OPTIONAL_PERMISSIONS,
  originHostPermission,
  permissionRemovePieces,
  imageUrlUnavailableMessage,
  thumbnailAndImageUrlPermissionRequest,
  thumbnailPermissionRemove,
  thumbnailPermissionRequest,
  thumbnailUnavailableMessage,
} from "./permissions.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readManifest(): {
  manifest_version: number;
  optional_permissions?: string[];
  optional_host_permissions: string[];
  permissions: string[];
  chrome_url_overrides?: { newtab?: string };
  options_page?: string;
  background?: { service_worker?: string; type?: string };
} {
  return JSON.parse(readFileSync(join(repoRoot, "manifest.json"), "utf8")) as {
    manifest_version: number;
    optional_permissions?: string[];
    optional_host_permissions: string[];
    permissions: string[];
    chrome_url_overrides?: { newtab?: string };
    options_page?: string;
    background?: { service_worker?: string; type?: string };
  };
}

test("thumbnailPermissionRequest asks for all_urls only (no tabs)", () => {
  assert.deepEqual(thumbnailPermissionRequest(), {
    origins: ["<all_urls>"],
  });
});

test("imageUrlFetchPermissionRequest asks for http and https scheme wildcards", () => {
  assert.deepEqual(imageUrlFetchPermissionRequest(), {
    origins: ["http://*/*", "https://*/*"],
  });
});

test("thumbnailAndImageUrlPermissionRequest covers both Settings toggles in one payload", () => {
  assert.deepEqual(thumbnailAndImageUrlPermissionRequest(), {
    origins: ["<all_urls>", "http://*/*", "https://*/*"],
  });
  assert.equal(
    isRequestCoveredByOptionalManifest(
      thumbnailAndImageUrlPermissionRequest(),
      MANIFEST_OPTIONAL_PERMISSIONS,
      MANIFEST_OPTIONAL_HOST_PERMISSIONS,
    ),
    true,
  );
});

test("originHostPermission builds a match pattern for http(s) URLs", () => {
  assert.equal(originHostPermission("https://cdn.example.com/a/b.png"), "https://cdn.example.com/*");
  assert.equal(originHostPermission("http://localhost:8080/img.jpg"), "http://localhost:8080/*");
  assert.equal(originHostPermission("file:///tmp/x.png"), null);
  assert.equal(originHostPermission("not-a-url"), null);
});

test("fetchPermissionRequest asks only for the image origin", () => {
  assert.deepEqual(fetchPermissionRequest("https://cdn.example.com/a/b.png"), {
    origins: ["https://cdn.example.com/*"],
  });
  assert.equal(fetchPermissionRequest("file:///tmp/x.png"), null);
});

test("manifest optional lists match helpers and stay out of always-on permissions", () => {
  const manifest = readManifest();
  assert.deepEqual(manifest.optional_permissions ?? [], [...MANIFEST_OPTIONAL_PERMISSIONS]);
  assert.deepEqual(manifest.optional_host_permissions, [...MANIFEST_OPTIONAL_HOST_PERMISSIONS]);
  assert.deepEqual(manifest.permissions, [
    "bookmarks",
    "storage",
    "unlimitedStorage",
    "favicon",
    "contextMenus",
    "activeTab",
  ]);
  assert.ok(manifest.permissions.includes("unlimitedStorage"));
  assert.ok(manifest.permissions.includes("favicon"));
  assert.ok(!(manifest.optional_permissions ?? []).includes("tabs"));
  // Host patterns must live in optional_host_permissions, not optional_permissions.
  const optionalApi = new Set<string>(manifest.optional_permissions ?? []);
  for (const host of MANIFEST_OPTIONAL_HOST_PERMISSIONS) {
    assert.equal(optionalApi.has(host), false);
  }
});

test("manifest pins MV3 new-tab, options, and service worker entry", () => {
  const manifest = readManifest();
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.chrome_url_overrides?.newtab, "index.html");
  assert.equal(manifest.options_page, "settings.html");
  assert.equal(manifest.background?.service_worker, "background.js");
  assert.equal(manifest.background?.type, "module");
});

test("toggle and fetch request payloads are covered by optional manifest declarations", () => {
  const manifest = readManifest();
  assert.equal(
    isRequestCoveredByOptionalManifest(
      thumbnailPermissionRequest(),
      manifest.optional_permissions ?? [],
      manifest.optional_host_permissions,
    ),
    true,
  );
  assert.equal(
    isRequestCoveredByOptionalManifest(
      imageUrlFetchPermissionRequest(),
      manifest.optional_permissions ?? [],
      manifest.optional_host_permissions,
    ),
    true,
  );
  assert.equal(
    isRequestCoveredByOptionalManifest(
      fetchPermissionRequest("https://cdn.example.com/a.png")!,
      manifest.optional_permissions ?? [],
      manifest.optional_host_permissions,
    ),
    true,
  );
});

test("isRequestCoveredByOptionalManifest rejects undeclared API and host patterns", () => {
  assert.equal(
    isRequestCoveredByOptionalManifest(
      { permissions: ["downloads"] },
      MANIFEST_OPTIONAL_PERMISSIONS,
      MANIFEST_OPTIONAL_HOST_PERMISSIONS,
    ),
    false,
  );
  assert.equal(
    isRequestCoveredByOptionalManifest(
      { origins: ["ftp://*/*"] },
      MANIFEST_OPTIONAL_PERMISSIONS,
      MANIFEST_OPTIONAL_HOST_PERMISSIONS,
    ),
    false,
  );
  // Specific origins are not covered by <all_urls> alone (Chrome rejects that request).
  assert.equal(
    isRequestCoveredByOptionalManifest(
      { origins: ["https://cdn.example.com/*"] },
      [],
      ["<all_urls>"],
    ),
    false,
  );
  assert.equal(
    isRequestCoveredByOptionalManifest(
      { origins: ["http://*/*", "https://*/*"] },
      [],
      ["<all_urls>"],
    ),
    false,
  );
  // The tabs API permission is no longer optional — requesting it must fail coverage.
  assert.equal(
    isRequestCoveredByOptionalManifest(
      { permissions: ["tabs"], origins: ["<all_urls>"] },
      MANIFEST_OPTIONAL_PERMISSIONS,
      MANIFEST_OPTIONAL_HOST_PERMISSIONS,
    ),
    false,
  );
});

test("permissionRemovePieces splits toggle revokes into one grant per call", () => {
  assert.deepEqual(permissionRemovePieces(thumbnailPermissionRemove()), [
    { origins: ["<all_urls>"] },
  ]);
  assert.deepEqual(permissionRemovePieces(imageUrlFetchPermissionRemove()), [
    { origins: ["http://*/*"] },
    { origins: ["https://*/*"] },
  ]);
});

test("unavailable-feature messages point users back to Settings", () => {
  assert.match(thumbnailUnavailableMessage(), /Generate dial thumbnails/i);
  assert.match(imageUrlUnavailableMessage(), /Assign pictures from URLs/i);
});

test("intersectGrantedPermissions keeps only overlapping optional grants", () => {
  assert.deepEqual(
    intersectGrantedPermissions(
      {
        permissions: ["storage"],
        origins: ["<all_urls>", "http://*/*", "https://example.com/*"],
      },
      thumbnailPermissionRemove(),
    ),
    { permissions: [], origins: ["<all_urls>"] },
  );
  assert.deepEqual(
    intersectGrantedPermissions(
      { permissions: [], origins: ["http://*/*", "https://*/*", "<all_urls>"] },
      imageUrlFetchPermissionRemove(),
    ),
    { permissions: [], origins: ["http://*/*", "https://*/*"] },
  );
  // URL-fetch revoke must not pull in thumbnail <all_urls>.
  assert.deepEqual(
    intersectGrantedPermissions(
      { origins: ["<all_urls>"] },
      imageUrlFetchPermissionRemove(),
    ),
    { permissions: [], origins: [] },
  );
});
