import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  fetchPermissionRequest,
  OPTIONAL_FETCH_HOST_PERMISSIONS,
  originHostPermission,
  OPTIONAL_TABS_PERMISSION,
  THUMBNAIL_HOST_PERMISSION,
  thumbnailPermissionRequest,
} from "./permissions.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

test("thumbnailPermissionRequest asks for tabs and all_urls optionally", () => {
  assert.deepEqual(thumbnailPermissionRequest(), {
    permissions: [OPTIONAL_TABS_PERMISSION],
    origins: [THUMBNAIL_HOST_PERMISSION],
  });
  assert.equal(OPTIONAL_TABS_PERMISSION, "tabs");
  assert.equal(THUMBNAIL_HOST_PERMISSION, "<all_urls>");
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

test("manifest optional_host_permissions allow origin-scoped URL fetch", () => {
  const manifest = JSON.parse(readFileSync(join(repoRoot, "manifest.json"), "utf8")) as {
    optional_host_permissions: string[];
  };
  for (const pattern of OPTIONAL_FETCH_HOST_PERMISSIONS) {
    assert.ok(
      manifest.optional_host_permissions.includes(pattern),
      `expected optional_host_permissions to include ${pattern}`,
    );
  }
  assert.ok(manifest.optional_host_permissions.includes(THUMBNAIL_HOST_PERMISSION));
});
