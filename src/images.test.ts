import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bookmarkIdFromImageKey,
  collectImages,
  IMAGE_KEY_PREFIX,
  imageStorageKey,
  isAllowedImageType,
  isImageDataUrl,
  MAX_IMAGE_BYTES,
  orphanImageKeys,
  readImageDataUrl,
} from "./images.ts";

test("image storage keys round-trip bookmark ids", () => {
  assert.equal(imageStorageKey("42"), `${IMAGE_KEY_PREFIX}42`);
  assert.equal(bookmarkIdFromImageKey(`${IMAGE_KEY_PREFIX}42`), "42");
  assert.equal(bookmarkIdFromImageKey("settings"), null);
  assert.equal(bookmarkIdFromImageKey(IMAGE_KEY_PREFIX), null);
});

test("image data URLs accept common local image types", () => {
  assert.equal(isImageDataUrl("data:image/png;base64,abc+/="), true);
  assert.equal(isImageDataUrl("data:image/jpeg;base64,QQ=="), true);
  assert.equal(isImageDataUrl("data:image/webp;base64,QQ"), true);
  assert.equal(isImageDataUrl("data:image/gif;base64,QQ=="), true);
  assert.equal(isImageDataUrl("data:text/plain;base64,QQ=="), false);
  assert.equal(isImageDataUrl("https://example.com/x.png"), false);
  assert.equal(readImageDataUrl(" data:image/png;base64,aa== "), "data:image/png;base64,aa==");
  assert.equal(readImageDataUrl(null), null);
});

test("allowed MIME types match the file picker", () => {
  assert.equal(isAllowedImageType("image/png"), true);
  assert.equal(isAllowedImageType("IMAGE/JPEG"), true);
  assert.equal(isAllowedImageType("image/svg+xml"), false);
  assert.equal(isAllowedImageType(""), false);
  assert.ok(MAX_IMAGE_BYTES > 0);
});

test("collectImages keeps only valid dial picture entries", () => {
  assert.deepEqual(
    collectImages({
      settings: { columns: 5 },
      [`${IMAGE_KEY_PREFIX}11`]: "data:image/png;base64,aa==",
      [`${IMAGE_KEY_PREFIX}12`]: "https://example.com/x.png",
      other: "data:image/png;base64,bb==",
    }),
    { "11": "data:image/png;base64,aa==" },
  );
});

test("orphanImageKeys lists pictures whose bookmarks are gone", () => {
  const keys = [
    `${IMAGE_KEY_PREFIX}11`,
    `${IMAGE_KEY_PREFIX}99`,
    "settings",
    `${IMAGE_KEY_PREFIX}`,
  ];
  assert.deepEqual(orphanImageKeys(keys, new Set(["11", "12"])), [`${IMAGE_KEY_PREFIX}99`]);
});
