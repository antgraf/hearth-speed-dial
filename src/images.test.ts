import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bookmarkIdFromImageKey,
  collectImages,
  dataUrlByteLength,
  dialImageStorageKeys,
  dialStorageUsageLabel,
  estimateDialImageBytes,
  fetchImageAsDataUrl,
  fileToDataUrl,
  fitWithinBounds,
  formatDialStorageUsage,
  formatStorageBytes,
  IMAGE_INGEST_LIMITS,
  IMAGE_KEY_PREFIX,
  imageDecodeFailedMessage,
  imageDownloadFailedMessage,
  imageEncodeFailedMessage,
  imagePickerAccept,
  imageSourceUrl,
  imageStillTooLargeMessage,
  imageStorageKey,
  imageStorageWriteFailedMessage,
  imageTooLargeMessage,
  imageTypeMessage,
  imageUrlInvalidMessage,
  ingestImageBlob,
  ingestMaxSize,
  isAllowedImageType,
  isImageDataUrl,
  isStorageQuotaError,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_SOURCE_IMAGE_BYTES,
  meaningfulStorageQuotaBytes,
  mimeFromContentType,
  mimeFromFileName,
  mimeFromMagicBytes,
  orphanImageKeys,
  readImageDataUrl,
  type ImageIngestCodec,
} from "./images.ts";
import { t } from "./i18n.ts";

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function tinyPngBytes(): Uint8Array<ArrayBuffer> {
  const raw = atob(TINY_PNG_BASE64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Codec that reports fixed source dimensions and emits controllable JPEG blobs. */
function fakeCodec(options: {
  width: number;
  height: number;
  /** Encoded blob size returned for each encode call (cycles if shorter than attempts). */
  encodeSizes: number[];
}): ImageIngestCodec {
  let encodeIndex = 0;
  return {
    async decode() {
      return { width: options.width, height: options.height };
    },
    async encode(_bitmap, _width, _height, mime) {
      const size = options.encodeSizes[Math.min(encodeIndex, options.encodeSizes.length - 1)]!;
      encodeIndex += 1;
      // Minimal payload; size is what ingest checks.
      const bytes = new Uint8Array(Math.max(1, size));
      bytes[0] = 0xff;
      bytes[1] = 0xd8;
      return new Blob([bytes], { type: mime });
    },
  };
}

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

test("mimeFromMagicBytes and mimeFromFileName recover common types", () => {
  assert.equal(mimeFromMagicBytes(Uint8Array.of(0xff, 0xd8, 0xff, 0xe0)), "image/jpeg");
  assert.equal(
    mimeFromMagicBytes(Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)),
    "image/png",
  );
  assert.equal(mimeFromMagicBytes(Uint8Array.of(0x47, 0x49, 0x46, 0x38, 0x39, 0x61)), "image/gif");
  assert.equal(
    mimeFromMagicBytes(
      Uint8Array.of(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50),
    ),
    "image/webp",
  );
  assert.equal(mimeFromMagicBytes(Uint8Array.of(1, 2, 3)), null);
  assert.equal(mimeFromFileName("photo.JPG"), "image/jpeg");
  assert.equal(mimeFromFileName("x.webp"), "image/webp");
  assert.equal(mimeFromFileName("notes.txt"), null);
});

test("fitWithinBounds never upscales and respects both axes", () => {
  assert.deepEqual(fitWithinBounds(800, 600, 1280, 720), { width: 800, height: 600 });
  assert.deepEqual(fitWithinBounds(4000, 3000, 1280, 720), { width: 960, height: 720 });
  assert.deepEqual(fitWithinBounds(5000, 1000, 1280, 720), { width: 1280, height: 256 });
  assert.deepEqual(ingestMaxSize("tile"), IMAGE_INGEST_LIMITS.tile);
  assert.deepEqual(ingestMaxSize("background"), IMAGE_INGEST_LIMITS.background);
});

test("dataUrlByteLength estimates payload size", () => {
  // "QQ==" is one byte (0x41)
  assert.equal(dataUrlByteLength("data:image/jpeg;base64,QQ=="), 1);
  assert.equal(dataUrlByteLength("data:image/png;base64,"), 0);
});

test("fetchImageAsDataUrl stores a remote image as a local data URL", async () => {
  const bytes = tinyPngBytes();
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

test("fetchImageAsDataUrl rejects source files over the ingest input cap", async () => {
  const oversized = new Uint8Array(MAX_SOURCE_IMAGE_BYTES + 1);
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
  const bytes = tinyPngBytes();
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

test("fileToDataUrl accepts a local PNG file that already fits limits", async () => {
  const bytes = tinyPngBytes();
  const file = new File([bytes], "dot.png", { type: "image/png" });
  const dataUrl = await fileToDataUrl(file, "tile", fakeCodec({ width: 1, height: 1, encodeSizes: [1] }));
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

test("fileToDataUrl rejects source files over the ingest input cap", async () => {
  const oversized = new Uint8Array(MAX_SOURCE_IMAGE_BYTES + 1);
  const file = new File([oversized], "big.png", { type: "image/png" });
  await assert.rejects(
    () => fileToDataUrl(file),
    (error: unknown) => error instanceof Error && error.message === imageTooLargeMessage(),
  );
  assert.match(imageTooLargeMessage(), /40/);
});

test("ingestImageBlob downscales oversized dimensions and stores JPEG under the cap", async () => {
  // Bytes larger than MAX_IMAGE_BYTES so the skip-reencode path is not taken.
  const source = new Uint8Array(MAX_IMAGE_BYTES + 50_000);
  source[0] = 0xff;
  source[1] = 0xd8;
  source[2] = 0xff;
  const blob = new Blob([source], { type: "image/jpeg" });
  const dataUrl = await ingestImageBlob(blob, "tile", {
    codec: fakeCodec({
      width: 4000,
      height: 3000,
      encodeSizes: [MAX_IMAGE_BYTES + 10, 120_000],
    }),
  });
  assert.match(dataUrl, /^data:image\/jpeg;base64,/i);
  assert.ok(dataUrlByteLength(dataUrl) <= MAX_IMAGE_BYTES);
});

test("ingestImageBlob uses background max dimensions", async () => {
  const source = new Uint8Array(MAX_IMAGE_BYTES + 10);
  source[0] = 0xff;
  source[1] = 0xd8;
  source[2] = 0xff;
  let seenWidth = 0;
  let seenHeight = 0;
  const codec: ImageIngestCodec = {
    async decode() {
      return { width: 5000, height: 4000 };
    },
    async encode(_bitmap, width, height, mime) {
      seenWidth = width;
      seenHeight = height;
      return new Blob([new Uint8Array(80_000)], { type: mime });
    },
  };
  await ingestImageBlob(new Blob([source], { type: "image/jpeg" }), "background", { codec });
  const expected = fitWithinBounds(
    5000,
    4000,
    IMAGE_INGEST_LIMITS.background.maxWidth,
    IMAGE_INGEST_LIMITS.background.maxHeight,
  );
  assert.equal(seenWidth, expected.width);
  assert.equal(seenHeight, expected.height);
});

test("ingestImageBlob surfaces decode and still-too-large failures", async () => {
  const jpegHeader = Uint8Array.of(0xff, 0xd8, 0xff, 0xe0);
  const blob = new Blob([jpegHeader], { type: "image/jpeg" });

  await assert.rejects(
    () =>
      ingestImageBlob(blob, "tile", {
        codec: {
          async decode() {
            throw new Error("boom");
          },
          async encode() {
            throw new Error("unused");
          },
        },
      }),
    (error: unknown) => error instanceof Error && error.message === imageDecodeFailedMessage(),
  );

  const large = new Uint8Array(MAX_IMAGE_BYTES + 20);
  large[0] = 0xff;
  large[1] = 0xd8;
  large[2] = 0xff;
  await assert.rejects(
    () =>
      ingestImageBlob(new Blob([large], { type: "image/jpeg" }), "tile", {
        codec: fakeCodec({
          width: 2000,
          height: 2000,
          encodeSizes: [MAX_IMAGE_BYTES + 1],
        }),
      }),
    (error: unknown) => error instanceof Error && error.message === imageStillTooLargeMessage(),
  );

  await assert.rejects(
    () =>
      ingestImageBlob(new Blob([large], { type: "image/jpeg" }), "tile", {
        codec: {
          async decode() {
            return { width: 2000, height: 2000 };
          },
          async encode() {
            throw new Error("canvas failed");
          },
        },
      }),
    (error: unknown) => error instanceof Error && error.message === imageEncodeFailedMessage(),
  );
});

test("fileToDataUrl recovers MIME from filename when type is empty", async () => {
  const bytes = tinyPngBytes();
  const file = new File([bytes], "dot.png", { type: "" });
  const dataUrl = await fileToDataUrl(
    file,
    "tile",
    fakeCodec({ width: 1, height: 1, encodeSizes: [1] }),
  );
  assert.match(dataUrl, /^data:image\/png;base64,/i);
});

test("isStorageQuotaError recognizes Chromium and DOM quota failures", () => {
  assert.equal(isStorageQuotaError(new Error("QUOTA_BYTES quota exceeded")), true);
  assert.equal(isStorageQuotaError(new Error("Resource's quota has been exceeded.")), true);
  const dom = new Error("The quota has been exceeded.");
  dom.name = "QuotaExceededError";
  assert.equal(isStorageQuotaError(dom), true);
  assert.equal(isStorageQuotaError(new Error("disk I/O failed")), false);
  assert.equal(isStorageQuotaError(null), false);
});

test("imageStorageWriteFailedMessage distinguishes quota from other write failures", () => {
  assert.match(
    imageStorageWriteFailedMessage(new Error("QUOTA_BYTES quota exceeded")),
    /out of space for dial pictures/i,
  );
  assert.match(imageStorageWriteFailedMessage(new Error("boom")), /Could not save that dial picture/);
  assert.equal(imageStorageWriteFailedMessage(), imageStorageWriteFailedMessage(new Error("other")));
});

test("meaningfulStorageQuotaBytes drops unlimited sentinels", () => {
  assert.equal(meaningfulStorageQuotaBytes(10_485_760), 10_485_760);
  assert.equal(meaningfulStorageQuotaBytes(Number.MAX_SAFE_INTEGER), null);
  assert.equal(meaningfulStorageQuotaBytes(0), null);
  assert.equal(meaningfulStorageQuotaBytes(undefined), null);
});

test("formatDialStorageUsage describes used space with and without a quota", () => {
  assert.equal(
    formatDialStorageUsage({ bytesUsed: 0, bytesQuota: null }),
    t("dial_storage_used_unlimited", t("unit_bytes", "0")),
  );
  const used2MiB = 2 * 1024 * 1024;
  assert.equal(
    formatDialStorageUsage({ bytesUsed: used2MiB, bytesQuota: 10_485_760 }),
    t("dial_storage_used_quota", [formatStorageBytes(used2MiB), formatStorageBytes(10_485_760)]),
  );
  assert.equal(formatStorageBytes(512), t("unit_bytes", "512"));
  assert.equal(dialStorageUsageLabel(), t("dial_storage_label"));
  assert.equal(estimateDialImageBytes({ a: "data:image/png;base64,aa==" }), "data:image/png;base64,aa==".length);
});
