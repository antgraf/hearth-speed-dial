/**
 * Local dial pictures live in extension storage (chrome.storage.local), keyed by
 * bookmark id. They do not sync and never leave the browser profile.
 *
 * Quota (Chrome defaults, no unlimitedStorage):
 * - chrome.storage.local total ≈ 10 MB for settings + all dial images.
 * - Each image is stored as a data URL (base64), ~33% larger than the file.
 * - Per-file cap below keeps several dials under the default quota without
 *   requesting unlimitedStorage. Revisit that permission only if real use hits
 *   QUOTA_BYTES.
 */
export const IMAGE_KEY_PREFIX = "hearth.image.";

/** Max raw file size accepted from the file picker (before data-URL encoding). */
export const MAX_IMAGE_BYTES = 1_500_000;

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

export type ImagesApi = {
  /** All stored dial images keyed by bookmark id. */
  getAll(): Promise<Record<string, string>>;
  setImage(bookmarkId: string, dataUrl: string): Promise<void>;
  clearImage(bookmarkId: string): Promise<void>;
  /** Best-effort: drop stored images whose bookmark ids are gone. */
  clearMissing(existingIds: ReadonlySet<string>): Promise<void>;
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

export function imageTooLargeMessage(): string {
  const mb = MAX_IMAGE_BYTES / 1_000_000;
  return `Choose an image under ${mb} MB.`;
}

export function imageTypeMessage(): string {
  return "Choose a JPEG, PNG, GIF, or WebP image.";
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
      writePreviewMap(map);
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
  };
}
