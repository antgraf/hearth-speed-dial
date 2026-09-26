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

/** Read a local image file into a data URL, enforcing type and size limits. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!isAllowedImageType(file.type)) {
      reject(new Error(imageTypeMessage()));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      reject(new Error(imageTooLargeMessage()));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("That file could not be read as an image."));
        return;
      }
      const dataUrl = readImageDataUrl(result);
      if (!dataUrl) {
        reject(new Error("That file could not be read as an image."));
        return;
      }
      resolve(dataUrl);
    };
    reader.onerror = () => reject(new Error("That file could not be read."));
    reader.readAsDataURL(file);
  });
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
