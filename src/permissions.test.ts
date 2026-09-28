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
  OPTIONAL_FETCH_HOST_PERMISSIONS,
  originHostPermission,
  OPTIONAL_TABS_PERMISSION,
  permissionRemovePieces,
  THUMBNAIL_HOST_PERMISSION,
  thumbnailPermissionRemove,
  thumbnailPermissionRequest,
} from "./permissions.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readManifest(): {
  optional_permissions: string[];
  optional_host_permissions: string[];
  permissions: string[];
} {
  return JSON.parse(readFileSync(join(repoRoot, "manifest.json"), "utf8")) as {
    optional_permissions: string[];
    optional_host_permissions: string[];
    permissions: string[];
  };
}

test("thumbnailPermissionRequest asks for tabs and all_urls optionally", () => {
  assert.deepEqual(thumbnailPermissionRequest(), {
    permissions: [OPTIONAL_TABS_PERMISSION],
    origins: [THUMBNAIL_HOST_PERMISSION],
  });
  assert.deepEqual(thumbnailPermissionRemove(), thumbnailPermissionRequest());
  assert.equal(OPTIONAL_TABS_PERMISSION, "tabs");
  assert.equal(THUMBNAIL_HOST_PERMISSION, "<all_urls>");
});

test("imageUrlFetchPermissionRequest asks for http and https scheme wildcards", () => {
  assert.deepEqual(imageUrlFetchPermissionRequest(), {
    origins: [...OPTIONAL_FETCH_HOST_PERMISSIONS],
  });
  assert.deepEqual(imageUrlFetchPermissionRemove(), imageUrlFetchPermissionRequest());
  assert.deepEqual(OPTIONAL_FETCH_HOST_PERMISSIONS, ["http://*/*", "https://*/*"]);
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
  assert.deepEqual(manifest.optional_permissions, [...MANIFEST_OPTIONAL_PERMISSIONS]);
  assert.deepEqual(manifest.optional_host_permissions, [...MANIFEST_OPTIONAL_HOST_PERMISSIONS]);
  assert.deepEqual(manifest.permissions, ["bookmarks", "storage", "contextMenus"]);
  // Host patterns must live in optional_host_permissions, not optional_permissions.
  const optionalApi = new Set<string>(manifest.optional_permissions);
  for (const host of MANIFEST_OPTIONAL_HOST_PERMISSIONS) {
    assert.equal(optionalApi.has(host), false);
  }
});

test("toggle and fetch request payloads are covered by optional manifest declarations", () => {
  const manifest = readManifest();
  assert.equal(
    isRequestCoveredByOptionalManifest(
      thumbnailPermissionRequest(),
      manifest.optional_permissions,
      manifest.optional_host_permissions,
    ),
    true,
  );
  assert.equal(
    isRequestCoveredByOptionalManifest(
      imageUrlFetchPermissionRequest(),
      manifest.optional_permissions,
      manifest.optional_host_permissions,
    ),
    true,
  );
  assert.equal(
    isRequestCoveredByOptionalManifest(
      fetchPermissionRequest("https://cdn.example.com/a.png")!,
      manifest.optional_permissions,
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
      ["tabs"],
      ["<all_urls>"],
    ),
    false,
  );
  assert.equal(
    isRequestCoveredByOptionalManifest(
      { origins: ["http://*/*", "https://*/*"] },
      ["tabs"],
      ["<all_urls>"],
    ),
    false,
  );
});

test("permissionRemovePieces splits toggle revokes into one grant per call", () => {
  assert.deepEqual(permissionRemovePieces(thumbnailPermissionRemove()), [
    { permissions: ["tabs"] },
    { origins: ["<all_urls>"] },
  ]);
  assert.deepEqual(permissionRemovePieces(imageUrlFetchPermissionRemove()), [
    { origins: ["http://*/*"] },
    { origins: ["https://*/*"] },
  ]);
});

test("intersectGrantedPermissions keeps only overlapping optional grants", () => {
  assert.deepEqual(
    intersectGrantedPermissions(
      {
        permissions: ["tabs", "storage"],
        origins: ["<all_urls>", "http://*/*", "https://example.com/*"],
      },
      thumbnailPermissionRemove(),
    ),
    { permissions: ["tabs"], origins: ["<all_urls>"] },
  );
  assert.deepEqual(
    intersectGrantedPermissions(
      { permissions: ["tabs"], origins: ["http://*/*", "https://*/*", "<all_urls>"] },
      imageUrlFetchPermissionRemove(),
    ),
    { permissions: [], origins: ["http://*/*", "https://*/*"] },
  );
  // URL-fetch revoke must not pull in thumbnail <all_urls>.
  assert.deepEqual(
    intersectGrantedPermissions(
      { permissions: ["tabs"], origins: ["<all_urls>"] },
      imageUrlFetchPermissionRemove(),
    ),
    { permissions: [], origins: [] },
  );
});
