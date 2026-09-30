import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bookmarkIdFromImageKey,
  collectImages,
  dataUrlByteLength,
  dialImageStorageKeys,
  fetchImageAsDataUrl,
  fileToDataUrl,
  IMAGE_KEY_PREFIX,
  imageDownloadFailedMessage,
  imagePickerAccept,
  imageSourceUrl,
  imageStorageKey,
  imageTooLargeMessage,
  imageTypeMessage,
  imageUrlInvalidMessage,
  isAllowedImageType,
  isImageDataUrl,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  mimeFromContentType,
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

test("allowed MIME types match the file picker accept string", () => {
  assert.equal(isAllowedImageType("image/png"), true);
  assert.equal(isAllowedImageType("IMAGE/JPEG"), true);
  assert.equal(isAllowedImageType("image/svg+xml"), false);
  assert.equal(isAllowedImageType(""), false);
  assert.equal(imagePickerAccept(), ALLOWED_IMAGE_TYPES.join(","));
  assert.equal(imagePickerAccept(), "image/jpeg,image/png,image/gif,image/webp");
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

test("dialImageStorageKeys lists only dial picture keys", () => {
  assert.deepEqual(
    dialImageStorageKeys([
      "settings",
      `${IMAGE_KEY_PREFIX}11`,
      `${IMAGE_KEY_PREFIX}`,
      "other",
      `${IMAGE_KEY_PREFIX}99`,
    ]),
    [`${IMAGE_KEY_PREFIX}11`, `${IMAGE_KEY_PREFIX}99`],
  );
});

test("imageSourceUrl accepts only http(s)", () => {
  assert.equal(imageSourceUrl("https://cdn.example.com/a.png"), "https://cdn.example.com/a.png");
  assert.equal(imageSourceUrl(" http://example.com/x.jpg "), "http://example.com/x.jpg");
  assert.equal(imageSourceUrl("data:image/png;base64,aa=="), null);
  assert.equal(imageSourceUrl("file:///tmp/x.png"), null);
  assert.equal(imageSourceUrl("ftp://example.com/x.png"), null);
  assert.equal(imageSourceUrl(""), null);
  assert.equal(imageSourceUrl("not a url"), null);
});

test("mimeFromContentType strips parameters", () => {
  assert.equal(mimeFromContentType("image/png"), "image/png");
  assert.equal(mimeFromContentType("image/jpeg; charset=binary"), "image/jpeg");
  assert.equal(mimeFromContentType(null), "");
  assert.equal(mimeFromContentType(undefined), "");
});

test("dataUrlByteLength estimates payload size", () => {
  // "QQ==" is one byte (0x41)
  assert.equal(dataUrlByteLength("data:image/jpeg;base64,QQ=="), 1);
  assert.equal(dataUrlByteLength("data:image/png;base64,"), 0);
});

test("fetchImageAsDataUrl stores a remote image as a local data URL", async () => {
  const pngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const bytes = Uint8Array.from(atob(pngBase64), (c) => c.charCodeAt(0));
  const fakeFetch: typeof fetch = async () =>
    new Response(bytes, {
      status: 200,
      headers: { "content-type": "image/png" },
    });

  const dataUrl = await fetchImageAsDataUrl("https://example.com/dot.png", fakeFetch);
  assert.match(dataUrl, /^data:image\/png;base64,/i);
});

test("fetchImageAsDataUrl rejects non-images and bad URLs", async () => {
  await assert.rejects(
    () => fetchImageAsDataUrl("ftp://example.com/x.png"),
    (error: unknown) => error instanceof Error && error.message === imageUrlInvalidMessage(),
  );

  const textFetch: typeof fetch = async () =>
    new Response("hello", { status: 200, headers: { "content-type": "text/plain" } });
  await assert.rejects(() => fetchImageAsDataUrl("https://example.com/x.txt", textFetch));

  const failFetch: typeof fetch = async () => new Response(null, { status: 404 });
  await assert.rejects(() => fetchImageAsDataUrl("https://example.com/missing.png", failFetch));
});

test("fetchImageAsDataUrl maps a thrown fetch to the download-failed message", async () => {
  const boom: typeof fetch = async () => {
    throw new TypeError("network down");
  };
  await assert.rejects(
    () => fetchImageAsDataUrl("https://example.com/dot.png", boom),
    (error: unknown) => error instanceof Error && error.message === imageDownloadFailedMessage(),
  );
});

test("fetchImageAsDataUrl rejects oversized remote images", async () => {
  const oversized = new Uint8Array(MAX_IMAGE_BYTES + 1);
  const fakeFetch: typeof fetch = async () =>
    new Response(oversized, {
      status: 200,
      headers: { "content-type": "image/png" },
    });
  await assert.rejects(
    () => fetchImageAsDataUrl("https://example.com/big.png", fakeFetch),
    (error: unknown) => error instanceof Error && error.message === imageTooLargeMessage(),
  );
});

test("fetchImageAsDataUrl falls back to Content-Type when the blob has no type", async () => {
  const pngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const bytes = Uint8Array.from(atob(pngBase64), (c) => c.charCodeAt(0));
  const fakeFetch: typeof fetch = async () => {
    const response = new Response(bytes, {
      status: 200,
      headers: { "content-type": "image/png" },
    });
    const originalBlob = response.blob.bind(response);
    response.blob = async () => {
      const blob = await originalBlob();
      return new Blob([await blob.arrayBuffer()], { type: "" });
    };
    return response;
  };

  const dataUrl = await fetchImageAsDataUrl("https://example.com/dot.png", fakeFetch);
  assert.match(dataUrl, /^data:image\/png;base64,/i);
});

test("fileToDataUrl accepts a local PNG file", async () => {
  const pngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const bytes = Uint8Array.from(atob(pngBase64), (c) => c.charCodeAt(0));
  const file = new File([bytes], "dot.png", { type: "image/png" });
  const dataUrl = await fileToDataUrl(file);
  assert.match(dataUrl, /^data:image\/png;base64,/i);
  assert.ok(isImageDataUrl(dataUrl));
});

test("fileToDataUrl rejects SVG with the type message", async () => {
  const file = new File(["<svg xmlns='http://www.w3.org/2000/svg'></svg>"], "x.svg", {
    type: "image/svg+xml",
  });
  await assert.rejects(
    () => fileToDataUrl(file),
    (error: unknown) => error instanceof Error && error.message === imageTypeMessage(),
  );
});

test("fileToDataUrl rejects oversized files with the size message", async () => {
  const oversized = new Uint8Array(MAX_IMAGE_BYTES + 1);
  const file = new File([oversized], "big.png", { type: "image/png" });
  await assert.rejects(
    () => fileToDataUrl(file),
    (error: unknown) => error instanceof Error && error.message === imageTooLargeMessage(),
  );
});
