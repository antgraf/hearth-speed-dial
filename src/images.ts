import { t } from "./i18n.ts";

/**
 * Local dial pictures live in extension storage (chrome.storage.local), keyed by
 * bookmark id. They do not sync and never leave the browser profile.
 *
 * Quota:
 * - Manifest requests install-time `unlimitedStorage` so dial art is not capped
 *   by Chrome’s default ~10 MB shared `storage.local` quota.
 * - Each image is stored as a data URL (base64), ~33% larger than the file.
 * - Large / high-res uploads are decoded, downscaled, and recompressed on ingest
 *   before persist; the stored-byte cap below still bounds each entry.
 * - Write failures (full disk / remaining Chromium limits) surface honest UX.
 */
export const IMAGE_KEY_PREFIX = "hearth.image.";

/**
 * Max stored payload size (decoded bytes of the data-URL body) for one dial
 * picture or wallpaper after ingest resize/compress.
 */
export const MAX_IMAGE_BYTES = 1_500_000;

/**
 * Max raw bytes accepted from a local file or URL download before decode.
 * Larger stock / camera files are resized on ingest; beyond this we refuse.
 */
export const MAX_SOURCE_IMAGE_BYTES = 40_000_000;

/** Role picks max pixel dimensions for on-ingest downscale. */
export type ImageIngestRole = "tile" | "background";

export const IMAGE_INGEST_LIMITS = {
  tile: { maxWidth: 1280, maxHeight: 720 },
  background: { maxWidth: 2560, maxHeight: 1440 },
  /** JPEG quality steps tried when the encoded blob is still over the store cap. */
  jpegQualities: [0.85, 0.75, 0.65, 0.55] as const,
  /** Extra downscale factor when quality alone cannot fit the store cap. */
  shrinkFactor: 0.75,
  /** Safety bound so a pathological encode loop cannot hang. */
  maxEncodeAttempts: 12,
} as const;

/**
 * Treat Chromium `QUOTA_BYTES` above this as an “unlimited” sentinel.
 * Note: with install-time `unlimitedStorage`, Chrome often still reports the
 * default ~10 MB constant — callers must check the permission grant too.
 */
export const MEANINGFUL_STORAGE_QUOTA_BYTES = 100_000_000;

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

/** Decoded bitmap used by the ingest codec (browser ImageBitmap or a test double). */
export type ImageBitmapLike = {
  width: number;
  height: number;
  close?: () => void;
};

/**
 * Pluggable decode/encode for unit tests. Production uses createImageBitmap + canvas.
 */
export type ImageIngestCodec = {
  decode(blob: Blob): Promise<ImageBitmapLike>;
  encode(
    bitmap: ImageBitmapLike,
    width: number,
    height: number,
    mime: "image/jpeg" | "image/png" | "image/webp",
    quality: number,
  ): Promise<Blob>;
};

/** `input.accept` value for the dial picture file picker (matches ALLOWED_IMAGE_TYPES). */
export function imagePickerAccept(): string {
  return ALLOWED_IMAGE_TYPES.join(",");
}

/** Bytes used by dial pictures in extension local storage. */
export type ImageStorageUsage = {
  bytesUsed: number;
  /**
   * Reported `chrome.storage.local` quota when finite and meaningful; null when
   * `unlimitedStorage` (or an unknown/huge sentinel) applies.
   */
  bytesQuota: number | null;
};

export type ImagesApi = {
  /** All stored dial images keyed by bookmark id. */
  getAll(): Promise<Record<string, string>>;
  setImage(bookmarkId: string, dataUrl: string): Promise<void>;
  clearImage(bookmarkId: string): Promise<void>;
  /** Best-effort: drop stored images whose bookmark ids are gone. */
  clearMissing(existingIds: ReadonlySet<string>): Promise<void>;
  /** Remove every dial picture from extension storage. */
  clearAll(): Promise<void>;
  /** Approximate local-storage footprint of dial pictures (for Settings). */
  getUsage(): Promise<ImageStorageUsage>;
};

export function imageStorageKey(bookmarkId: string): string {
  return `${IMAGE_KEY_PREFIX}${bookmarkId}`;
}

export function bookmarkIdFromImageKey(key: string): string | null {
  if (!key.startsWith(IMAGE_KEY_PREFIX)) return null;
  const id = key.slice(IMAGE_KEY_PREFIX.length);
  return id.length > 0 ? id : null;
}

export function isAllowedImageType(type: string): boolean {
  const normalized = type.trim().toLowerCase();
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(normalized);
}

/** Accept only data:image/…;base64,… payloads we wrote from a local file. */
export function isImageDataUrl(value: string): boolean {
  return /^data:image\/(jpeg|jpg|png|gif|webp);base64,[a-z0-9+/]+=*$/i.test(value.trim());
}

export function readImageDataUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return isImageDataUrl(trimmed) ? trimmed : null;
}

/**
 * Collect valid dial images from a flat storage map (chrome.storage.local.get(null)
 * or a preview localStorage object).
 */
export function collectImages(stored: Record<string, unknown>): Record<string, string> {
  const images: Record<string, string> = {};
  for (const [key, value] of Object.entries(stored)) {
    const id = bookmarkIdFromImageKey(key);
    if (!id) continue;
    const dataUrl = readImageDataUrl(value);
    if (dataUrl) images[id] = dataUrl;
  }
  return images;
}

/** Storage keys for dial images whose bookmark ids are not in `existingIds`. */
export function orphanImageKeys(
  storedKeys: readonly string[],
  existingIds: ReadonlySet<string>,
): string[] {
  const orphans: string[] = [];
  for (const key of storedKeys) {
    const id = bookmarkIdFromImageKey(key);
    if (id && !existingIds.has(id)) orphans.push(key);
  }
  return orphans;
}

/** All dial-image storage keys in a flat chrome.storage.local key list. */
export function dialImageStorageKeys(storedKeys: readonly string[]): string[] {
  const keys: string[] = [];
  for (const key of storedKeys) {
    if (bookmarkIdFromImageKey(key)) keys.push(key);
  }
  return keys;
}

export function imageTooLargeMessage(): string {
  const mb = MAX_SOURCE_IMAGE_BYTES / 1_000_000;
  return t("error_image_too_large", String(mb));
}

export function imageStillTooLargeMessage(): string {
  return t("error_image_still_too_large");
}

export function imageDecodeFailedMessage(): string {
  return t("error_image_decode");
}

export function imageEncodeFailedMessage(): string {
  return t("error_image_encode");
}

export function imageTypeMessage(): string {
  return t("error_image_type");
}

export function backgroundImageFailedTitle(): string {
  return t("background_failed_title");
}

/** True when Chrome / localStorage rejected a write for quota / space. */
export function isStorageQuotaError(error: unknown): boolean {
  if (error == null) return false;
  const name = error instanceof Error ? error.name : "";
  if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") return true;
  const message = error instanceof Error ? error.message : String(error);
  return /quota/i.test(message) || /QUOTA_BYTES/i.test(message) || /exceeded the storage/i.test(message);
}

/**
 * User-facing copy when persisting a dial picture fails.
 * Distinguishes quota/full-disk from other write errors.
 */
export function imageStorageWriteFailedMessage(error?: unknown): string {
  if (error !== undefined && isStorageQuotaError(error)) {
    return t("error_storage_quota");
  }
  return t("error_storage_write");
}

/** Drop huge Chromium unlimited sentinels so Settings does not show fake %. */
export function meaningfulStorageQuotaBytes(quota: number | null | undefined): number | null {
  if (quota == null || !Number.isFinite(quota) || quota <= 0) return null;
  if (quota >= MEANINGFUL_STORAGE_QUOTA_BYTES) return null;
  return Math.floor(quota);
}

/** Format bytes for the Settings usage line (binary megabytes). */
export function formatStorageBytes(bytes: number): string {
  const safe = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  if (safe < 1024) return t("unit_bytes", String(Math.max(0, Math.round(safe))));
  if (safe < 1024 * 1024) {
    const kb = safe / 1024;
    return t("unit_kb", String(kb < 10 ? kb.toFixed(1) : Math.round(kb)));
  }
  const mb = safe / (1024 * 1024);
  return t("unit_mb", String(mb < 10 ? mb.toFixed(1) : Math.round(mb)));
}

/** Body copy under the Settings “Dial picture storage” label. */
export function formatDialStorageUsage(usage: ImageStorageUsage): string {
  const used = formatStorageBytes(usage.bytesUsed);
  const quota = meaningfulStorageQuotaBytes(usage.bytesQuota);
  if (quota == null) {
    return t("dial_storage_used_unlimited", used);
  }
  return t("dial_storage_used_quota", [used, formatStorageBytes(quota)]);
}

/** Label for the Settings dial-picture storage readout. */
export function dialStorageUsageLabel(): string {
  return t("dial_storage_label");
}

/**
 * Approximate stored size of dial-image values (data URL string length).
 * Used by preview / tests when getBytesInUse is unavailable.
 */
export function estimateDialImageBytes(images: Record<string, string>): number {
  let total = 0;
  for (const dataUrl of Object.values(images)) {
    total += dataUrl.length;
  }
  return total;
}

export function imageUrlInvalidMessage(): string {
  return t("error_image_url_invalid");
}

export function imageDownloadFailedMessage(status?: number): string {
  if (status) return t("error_image_download_status", String(status));
  return t("error_image_download");
}

/**
 * Accept only http(s) image URLs. Returns the normalized href, or null.
 * Data URLs and other schemes are rejected — dial pictures are stored locally.
 * Fragments and colons in the path are allowed (validated further at fetch).
 */
export function imageSourceUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * MediaWiki media-viewer fragment: `#/media/File:Name.ext` or `#/media/Name.ext`
 * (`File:` may be percent-encoded). Captures the file title for path rewrite.
 */
const MEDIAWIKI_MEDIA_HASH = /^#\/media\/(?:File:|File%3A)?([^#?]+)$/i;

/** `/wiki/File:Name.ext` file description pages (HTML, not the image bytes). */
const MEDIAWIKI_FILE_PATH = /^\/wiki\/File:(.+)$/i;

function mediawikiFileTitle(raw: string): string | null {
  const trimmed = decodeURIComponent(raw).replace(/^File:/i, "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Filename hint from an image URL for MIME sniffing when headers/magic are weak.
 * Prefers MediaWiki `#/media/File:…` fragments; otherwise the last path segment.
 * Colons in the basename (e.g. `File:Google.png`) are preserved.
 */
export function fileNameHintFromImageUrl(href: string): string | null {
  try {
    const parsed = new URL(href.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    const fromHash = MEDIAWIKI_MEDIA_HASH.exec(parsed.hash);
    if (fromHash?.[1]) return mediawikiFileTitle(fromHash[1]);
    const fromWikiFile = MEDIAWIKI_FILE_PATH.exec(parsed.pathname);
    if (fromWikiFile?.[1]) return mediawikiFileTitle(fromWikiFile[1]);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (!last) return null;
    return decodeURIComponent(last);
  } catch {
    return null;
  }
}

function specialFilePathUrl(origin: string, fileTitle: string): string {
  // MediaWiki titles use underscores for spaces; encode other reserved chars.
  const pathName = fileTitle.replace(/ /g, "_");
  const encoded = pathName
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${origin}/wiki/Special:FilePath/${encoded}`;
}

/**
 * Normalize an http(s) URL to the resource we should fetch for dial art.
 * MediaWiki media-viewer / File: page URLs are rewritten to `Special:FilePath/…`
 * on the same origin (follows redirects to the real image bytes). Ordinary
 * image URLs keep their href with the fragment dropped (not sent on fetch).
 */
export function resolveImageFetchUrl(raw: string): string | null {
  const source = imageSourceUrl(raw);
  if (!source) return null;
  try {
    const parsed = new URL(source);
    const fromHash = MEDIAWIKI_MEDIA_HASH.exec(parsed.hash);
    if (fromHash?.[1]) {
      const title = mediawikiFileTitle(fromHash[1]);
      if (!title) return null;
      return specialFilePathUrl(parsed.origin, title);
    }
    const fromWikiFile = MEDIAWIKI_FILE_PATH.exec(parsed.pathname);
    if (fromWikiFile?.[1]) {
      const title = mediawikiFileTitle(fromWikiFile[1]);
      if (!title) return null;
      return specialFilePathUrl(parsed.origin, title);
    }
    parsed.hash = "";
    return parsed.href;
  } catch {
    return null;
  }
}

/** Infer MIME from a Content-Type header or blob.type (ignore parameters). */
export function mimeFromContentType(value: string | null | undefined): string {
  if (!value) return "";
  return value.split(";")[0]?.trim().toLowerCase() ?? "";
}

/**
 * Fit `width`×`height` inside `maxWidth`×`maxHeight` without upscaling.
 * Returns integer pixel size (at least 1×1).
 */
export function fitWithinBounds(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const srcW = Math.max(1, Math.floor(width));
  const srcH = Math.max(1, Math.floor(height));
  const scale = Math.min(1, maxWidth / srcW, maxHeight / srcH);
  return {
    width: Math.max(1, Math.round(srcW * scale)),
    height: Math.max(1, Math.round(srcH * scale)),
  };
}

/** Max pixel box for a dial tile vs theme wallpaper. */
export function ingestMaxSize(role: ImageIngestRole): { maxWidth: number; maxHeight: number } {
  return IMAGE_INGEST_LIMITS[role];
}

/** Sniff MIME from magic bytes when the File/Blob type is missing or wrong. */
export function mimeFromMagicBytes(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "image/gif";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/** Infer MIME from a filename extension when type/magic are unavailable. */
export function mimeFromFileName(name: string): string | null {
  const lower = name.trim().toLowerCase();
  // Prefer the last path segment so `…/File:Name.png` and `File:Name.png` work.
  const base = lower.includes("/") ? lower.slice(lower.lastIndexOf("/") + 1) : lower;
  if (base.endsWith(".jpg") || base.endsWith(".jpeg")) return "image/jpeg";
  if (base.endsWith(".png")) return "image/png";
  if (base.endsWith(".gif")) return "image/gif";
  if (base.endsWith(".webp")) return "image/webp";
  return null;
}

/** Resolve an allowed MIME for ingest, or null when the bytes are not a supported image. */
export async function resolveImageMime(
  blob: Blob,
  hintType?: string,
  fileName?: string,
): Promise<string | null> {
  const hinted = mimeFromContentType(hintType ?? blob.type);
  if (isAllowedImageType(hinted)) return hinted;
  const buffer = await blob.slice(0, 16).arrayBuffer();
  const magic = mimeFromMagicBytes(new Uint8Array(buffer));
  if (magic && isAllowedImageType(magic)) return magic;
  const fromName = fileName ? mimeFromFileName(fileName) : null;
  if (fromName && isAllowedImageType(fromName)) return fromName;
  return null;
}

function closeBitmap(bitmap: ImageBitmapLike): void {
  try {
    bitmap.close?.();
  } catch {
    // Best-effort; ImageBitmap.close is optional on doubles.
  }
}

/** Browser codec: createImageBitmap + canvas.toBlob. */
export function browserImageIngestCodec(): ImageIngestCodec {
  return {
    async decode(blob) {
      if (typeof createImageBitmap !== "function") {
        throw new Error(imageDecodeFailedMessage());
      }
      try {
        return await createImageBitmap(blob);
      } catch {
        throw new Error(imageDecodeFailedMessage());
      }
    },
    async encode(bitmap, width, height, mime, quality) {
      const doc = typeof document !== "undefined" ? document : null;
      if (!doc?.createElement) throw new Error(imageEncodeFailedMessage());
      const canvas = doc.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error(imageEncodeFailedMessage());
      // White fill so JPEG has no transparent black fringe from PNG/GIF sources.
      if (mime === "image/jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
      }
      ctx.drawImage(bitmap as CanvasImageSource, 0, 0, width, height);
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((result) => resolve(result), mime, quality);
      });
      if (!blob || blob.size <= 0) throw new Error(imageEncodeFailedMessage());
      return blob;
    },
  };
}

let defaultCodec: ImageIngestCodec | null = null;

function activeCodec(override?: ImageIngestCodec): ImageIngestCodec {
  if (override) return override;
  if (!defaultCodec) defaultCodec = browserImageIngestCodec();
  return defaultCodec;
}

/**
 * Decode → optional downscale → encode so the stored data URL fits role limits.
 * Files already under the stored-byte cap keep their original bytes when they
 * also fit the role’s max dimensions (or when decode is unavailable — e.g. Node
 * unit tests without canvas). Larger files always decode and recompress.
 */
export async function ingestImageBlob(
  blob: Blob,
  role: ImageIngestRole,
  options: { mime?: string; fileName?: string; codec?: ImageIngestCodec } = {},
): Promise<string> {
  if (blob.size > MAX_SOURCE_IMAGE_BYTES) throw new Error(imageTooLargeMessage());

  const mime = await resolveImageMime(blob, options.mime, options.fileName);
  if (!mime) throw new Error(imageTypeMessage());

  const codec = activeCodec(options.codec);
  const bounds = ingestMaxSize(role);
  const alreadyUnderStoreCap = blob.size <= MAX_IMAGE_BYTES;

  let bitmap: ImageBitmapLike;
  try {
    bitmap = await codec.decode(blob);
  } catch (error) {
    // Small files: keep original bytes when the environment cannot decode
    // (Node tests) — same as pre-ingest behavior for tiny icons.
    if (alreadyUnderStoreCap && !options.codec) {
      return blobToDataUrl(blob, mime);
    }
    if (error instanceof Error && error.message === imageDecodeFailedMessage()) throw error;
    throw new Error(imageDecodeFailedMessage(), { cause: error });
  }

  try {
    const fitsPixels =
      bitmap.width <= bounds.maxWidth && bitmap.height <= bounds.maxHeight;
    if (fitsPixels && alreadyUnderStoreCap) {
      return blobToDataUrl(blob, mime);
    }

    let target = fitWithinBounds(bitmap.width, bitmap.height, bounds.maxWidth, bounds.maxHeight);
    let attempts = 0;
    while (attempts < IMAGE_INGEST_LIMITS.maxEncodeAttempts) {
      attempts += 1;
      for (const quality of IMAGE_INGEST_LIMITS.jpegQualities) {
        let encoded: Blob;
        try {
          encoded = await codec.encode(bitmap, target.width, target.height, "image/jpeg", quality);
        } catch (error) {
          if (error instanceof Error && error.message === imageEncodeFailedMessage()) throw error;
          throw new Error(imageEncodeFailedMessage(), { cause: error });
        }
        if (encoded.size <= MAX_IMAGE_BYTES) {
          return blobToDataUrl(encoded, "image/jpeg");
        }
      }
      const nextW = Math.max(1, Math.round(target.width * IMAGE_INGEST_LIMITS.shrinkFactor));
      const nextH = Math.max(1, Math.round(target.height * IMAGE_INGEST_LIMITS.shrinkFactor));
      if (nextW === target.width && nextH === target.height) break;
      target = { width: nextW, height: nextH };
    }
    throw new Error(imageStillTooLargeMessage());
  } finally {
    closeBitmap(bitmap);
  }
}

/**
 * Read a remote image into a data URL (same store shape as a local file attach).
 * Caller must ensure host permission / network access before calling.
 */
export async function fetchImageAsDataUrl(
  href: string,
  fetchImpl: typeof fetch = fetch,
  role: ImageIngestRole = "tile",
  codec?: ImageIngestCodec,
): Promise<string> {
  const source = resolveImageFetchUrl(href);
  if (!source) throw new Error(imageUrlInvalidMessage());
  const fileName = fileNameHintFromImageUrl(href) ?? fileNameHintFromImageUrl(source) ?? undefined;

  let response: Response;
  try {
    response = await fetchImpl(source, { redirect: "follow", credentials: "omit" });
  } catch {
    throw new Error(imageDownloadFailedMessage());
  }
  if (!response.ok) throw new Error(imageDownloadFailedMessage(response.status));

  const headerType = mimeFromContentType(response.headers.get("content-type"));
  const blob = await response.blob();
  const blobType = mimeFromContentType(blob.type);
  const type = blobType || headerType;
  return ingestImageBlob(blob, role, { mime: type || undefined, fileName, codec });
}

/** Approximate decoded byte length of a base64 data URL payload. */
export function dataUrlByteLength(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return 0;
  const base64 = dataUrl.slice(comma + 1).replace(/\s/g, "");
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

/** Encode a blob as a validated image data URL (works in Node and the browser). */
export async function blobToDataUrl(blob: Blob, type: string): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const dataUrl = `data:${type};base64,${btoa(binary)}`;
  const valid = readImageDataUrl(dataUrl);
  if (!valid) throw new Error(t("error_image_read"));
  return valid;
}

/**
 * Read a local image file into a data URL for dial tiles or theme wallpaper.
 * Oversized / high-res files are resized and compressed before persist.
 */
export async function fileToDataUrl(
  file: File,
  role: ImageIngestRole = "tile",
  codec?: ImageIngestCodec,
): Promise<string> {
  return ingestImageBlob(file, role, {
    mime: file.type || undefined,
    fileName: file.name,
    codec,
  });
}

/**
 * Normalize an already-captured JPEG/PNG data URL (thumbnail path) through the
 * same dimension / stored-byte budget as file attach.
 */
export async function ingestDataUrl(
  dataUrl: string,
  role: ImageIngestRole = "tile",
  codec?: ImageIngestCodec,
): Promise<string> {
  const valid = readImageDataUrl(dataUrl);
  if (!valid) throw new Error(t("error_image_read"));
  const comma = valid.indexOf(",");
  const header = valid.slice(0, comma);
  const mimeMatch = /^data:(image\/[a-z0-9.+-]+);base64$/i.exec(header);
  const mime = mimeMatch?.[1]?.toLowerCase() ?? "";
  const base64 = valid.slice(comma + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  return ingestImageBlob(blob, role, { mime, codec });
}

const PREVIEW_IMAGES_KEY = "hearth.previewImages";

function readPreviewMap(): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(PREVIEW_IMAGES_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writePreviewMap(map: Record<string, string>): void {
  localStorage.setItem(PREVIEW_IMAGES_KEY, JSON.stringify(map));
}

export function previewImages(): ImagesApi {
  return {
    async getAll() {
      const raw = readPreviewMap();
      const images: Record<string, string> = {};
      for (const [id, value] of Object.entries(raw)) {
        const dataUrl = readImageDataUrl(value);
        if (dataUrl) images[id] = dataUrl;
      }
      return images;
    },
    async setImage(bookmarkId, dataUrl) {
      const valid = readImageDataUrl(dataUrl);
      if (!valid) throw new Error(t("error_image_store"));
      const map = await this.getAll();
      map[bookmarkId] = valid;
      try {
        writePreviewMap(map);
      } catch (error) {
        throw new Error(imageStorageWriteFailedMessage(error), { cause: error });
      }
    },
    async clearImage(bookmarkId) {
      const map = await this.getAll();
      if (!(bookmarkId in map)) return;
      delete map[bookmarkId];
      writePreviewMap(map);
    },
    async clearMissing(existingIds) {
      const map = await this.getAll();
      let changed = false;
      for (const id of Object.keys(map)) {
        if (!existingIds.has(id)) {
          delete map[id];
          changed = true;
        }
      }
      if (changed) writePreviewMap(map);
    },
    async clearAll() {
      writePreviewMap({});
    },
    async getUsage() {
      const map = await this.getAll();
      return { bytesUsed: estimateDialImageBytes(map), bytesQuota: null };
    },
  };
}
