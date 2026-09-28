import assert from "node:assert/strict";
import { test } from "node:test";
import {
  originHostPermission,
  OPTIONAL_TABS_PERMISSION,
  THUMBNAIL_HOST_PERMISSION,
  thumbnailPermissionRequest,
} from "./permissions.ts";

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
