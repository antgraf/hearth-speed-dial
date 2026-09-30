/**
 * Local dial pictures live in extension storage (chrome.storage.local), keyed by
 * bookmark id. They do not sync and never leave the browser profile.
 *
 * Quota:
 * - Manifest requests install-time `unlimitedStorage` so dial art is not capped
 *   by Chrome’s default ~10 MB shared `storage.local` quota.
 * - Each image is stored as a data URL (base64), ~33% larger than the file.
 * - Per-file cap below still bounds a single attach/capture; disk can still fill.
 * - Write failures (full disk / remaining Chromium limits) surface honest UX.
 */
export const IMAGE_KEY_PREFIX = "hearth.image.";

/** Max raw file size accepted from the file picker (before data-URL encoding). */
export const MAX_IMAGE_BYTES = 1_500_000;

/**
 * Treat Chromium `QUOTA_BYTES` above this as “effectively unlimited” (the
 * sentinel used when `unlimitedStorage` is granted). Below it, show remaining.
 */
export const MEANINGFUL_STORAGE_QUOTA_BYTES = 100_000_000;

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

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
  const mb = MAX_IMAGE_BYTES / 1_000_000;
  return `Choose an image under ${mb} MB.`;
}

export function imageTypeMessage(): string {
  return "Choose a JPEG, PNG, GIF, or WebP image.";
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
    return "This browser profile is out of space for dial pictures. Remove some pictures or free disk space, then try again.";
  }
  return "Could not save that dial picture. Check that this profile has free disk space, then try again.";
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
  if (safe < 1024) return `${Math.max(0, Math.round(safe))} B`;
  if (safe < 1024 * 1024) {
    const kb = safe / 1024;
    return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  }
  const mb = safe / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/** Body copy under the Settings “Dial picture storage” label. */
export function formatDialStorageUsage(usage: ImageStorageUsage): string {
  const used = formatStorageBytes(usage.bytesUsed);
  const quota = meaningfulStorageQuotaBytes(usage.bytesQuota);
  if (quota == null) {
    return `About ${used} used in this profile. No fixed size cap — still limited by free disk.`;
  }
  return `About ${used} of ${formatStorageBytes(quota)} available in this profile.`;
}

/** Label for the Settings dial-picture storage readout. */
export function dialStorageUsageLabel(): string {
  return "Dial picture storage";
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
  return "Enter an http:// or https:// image address.";
}

export function imageDownloadFailedMessage(status?: number): string {
  if (status) return `Could not download that image (${status}).`;
  return "Could not download that image.";
}

/**
 * Accept only http(s) image URLs. Returns the normalized href, or null.
 * Data URLs and other schemes are rejected — dial pictures are stored locally.
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

/** Infer MIME from a Content-Type header or blob.type (ignore parameters). */
export function mimeFromContentType(value: string | null | undefined): string {
  if (!value) return "";
  return value.split(";")[0]?.trim().toLowerCase() ?? "";
}

/**
 * Read a remote image into a data URL (same store shape as a local file attach).
 * Caller must ensure host permission / network access before calling.
 */
export async function fetchImageAsDataUrl(
  href: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const source = imageSourceUrl(href);
  if (!source) throw new Error(imageUrlInvalidMessage());

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
  if (!isAllowedImageType(type)) throw new Error(imageTypeMessage());
  if (blob.size > MAX_IMAGE_BYTES) throw new Error(imageTooLargeMessage());

  return blobToDataUrl(blob, type);
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
  if (!valid) throw new Error("That file could not be read as an image.");
  return valid;
}

/** Read a local image file into a data URL, enforcing type and size limits. */
export async function fileToDataUrl(file: File): Promise<string> {
  if (!isAllowedImageType(file.type)) {
    throw new Error(imageTypeMessage());
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(imageTooLargeMessage());
  }
  return blobToDataUrl(file, file.type);
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
      if (!valid) throw new Error("That file could not be stored as an image.");
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
