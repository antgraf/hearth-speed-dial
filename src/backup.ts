/**
 * Export / import of dial pictures and non-bookmark prefs.
 * Bookmarks stay in Chrome (browser sync); this file covers decoration only.
 */

import { isImageDataUrl, readImageDataUrl } from "./images.ts";
import {
  clampColumns,
  clampThumbnailWaitSeconds,
  clampTileSize,
  DEFAULT_LAYOUT,
  readDefaultFolderId,
  readImageUrlFetchEnabled,
  readOpenFolderId,
  readReverseOrder,
  readThumbnailsEnabled,
  type LayoutSettings,
} from "./settings.ts";
import {
  normalizeTheme,
  readTheme,
  readThemeBackgroundDataUrl,
  type ThemeSettings,
} from "./theme.ts";
import type { BookmarkNode } from "./model.ts";
import { classify } from "./model.ts";

export const BACKUP_FORMAT = "hearth-speed-dial-backup";
export const BACKUP_VERSION = 1 as const;

export type BackupImageEntry = {
  bookmarkId: string;
  dataUrl: string;
  /** Rematch hint when local bookmark ids differ across profiles. */
  url?: string;
};

export type BackupSettings = {
  columns: number;
  tileSize: number;
  reverseOrder: boolean;
  thumbnailsEnabled: boolean;
  imageUrlFetchEnabled: boolean;
  thumbnailWaitSeconds: number;
  defaultFolderId: string | null;
  openFolderId: string | null;
  theme: ThemeSettings;
};

export type HearthBackupV1 = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  settings: BackupSettings;
  themeBackground: string | null;
  images: BackupImageEntry[];
};

export type ImportMode = "overwrite" | "merge";

export type BuildBackupInput = {
  layout: LayoutSettings;
  defaultFolderId: string | null;
  openFolderId: string | null;
  themeBackground: string | null;
  images: Record<string, string>;
  /** Optional URL hints keyed by bookmark id (http/https/file dials). */
  imageUrls?: Readonly<Record<string, string>>;
  /** Override clock for tests. */
  now?: Date;
};

export type ApplyBackupResult = {
  layout: LayoutSettings;
  defaultFolderId: string | null;
  openFolderId: string | null;
  /** Wallpaper to persist; `undefined` means leave the current wallpaper alone. */
  themeBackground: string | null | undefined;
  /** When true, clear every dial picture before writing `imagesToSet`. */
  clearAllImages: boolean;
  /** Dial pictures to write (bookmark id → data URL), after rematch. */
  imagesToSet: Record<string, string>;
};

export const EXPORT_TITLE = "Export pictures & settings";
export const IMPORT_TITLE = "Import pictures & settings";

export const EXPORT_HELP =
  "Download a JSON file of dial pictures, theme wallpaper, and layout preferences. Chrome bookmarks are not included — the browser already syncs those.";

export const IMPORT_HELP =
  "Restore from a Hearth backup file. Choose overwrite (replace local Hearth data) or merge (keep pictures not in the file). Bookmarks are never changed.";

export const IMPORT_MODE_TITLE = "How should import apply?";
export const IMPORT_MODE_MESSAGE =
  "Overwrite replaces Hearth settings, theme wallpaper, and all dial pictures with the file. Merge updates settings and adds or replaces pictures from the file, keeping local pictures that are not in the backup. Chrome bookmarks are never changed.";
export const IMPORT_OVERWRITE_LABEL = "Overwrite";
export const IMPORT_MERGE_LABEL = "Merge";

export const IMPORT_INVALID_MESSAGE =
  "That file is not a valid Hearth Speed Dial backup.";

export function backupFilename(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `hearth-speed-dial-backup-${y}-${m}-${d}.json`;
}

/** Map bookmark id → URL for link dials (folders have no URL). */
export function bookmarkUrlsById(roots: readonly BookmarkNode[]): Record<string, string> {
  const map: Record<string, string> = {};
  const walk = (nodes: readonly BookmarkNode[]) => {
    for (const node of nodes) {
      if (classify(node) === "link" && typeof node.url === "string" && node.url.length > 0) {
        map[node.id] = node.url;
      }
      if (node.children) walk(node.children);
    }
  };
  walk(roots);
  return map;
}

/** First bookmark id for each URL (for rematch on import). */
export function bookmarkIdsByUrl(roots: readonly BookmarkNode[]): Map<string, string> {
  const map = new Map<string, string>();
  const walk = (nodes: readonly BookmarkNode[]) => {
    for (const node of nodes) {
      if (classify(node) === "link" && typeof node.url === "string" && node.url.length > 0) {
        if (!map.has(node.url)) map.set(node.url, node.id);
      }
      if (node.children) walk(node.children);
    }
  };
  walk(roots);
  return map;
}

export function buildBackup(input: BuildBackupInput): HearthBackupV1 {
  const theme = normalizeTheme(input.layout.theme ?? DEFAULT_LAYOUT.theme);
  const settings: BackupSettings = {
    columns: clampColumns(input.layout.columns),
    tileSize: clampTileSize(input.layout.tileSize),
    reverseOrder: Boolean(input.layout.reverseOrder),
    thumbnailsEnabled: Boolean(input.layout.thumbnailsEnabled),
    imageUrlFetchEnabled: Boolean(input.layout.imageUrlFetchEnabled),
    thumbnailWaitSeconds: clampThumbnailWaitSeconds(input.layout.thumbnailWaitSeconds),
    defaultFolderId:
      typeof input.defaultFolderId === "string" && input.defaultFolderId.length > 0
        ? input.defaultFolderId
        : null,
    openFolderId:
      typeof input.openFolderId === "string" && input.openFolderId.length > 0
        ? input.openFolderId
        : null,
    theme,
  };

  const images: BackupImageEntry[] = [];
  for (const [bookmarkId, raw] of Object.entries(input.images)) {
    if (!bookmarkId) continue;
    const dataUrl = readImageDataUrl(raw);
    if (!dataUrl) continue;
    const entry: BackupImageEntry = { bookmarkId, dataUrl };
    const hint = input.imageUrls?.[bookmarkId];
    if (typeof hint === "string" && hint.trim()) entry.url = hint.trim();
    images.push(entry);
  }
  images.sort((a, b) => a.bookmarkId.localeCompare(b.bookmarkId));

  const wallpaper = input.themeBackground
    ? readThemeBackgroundDataUrl(input.themeBackground)
    : null;

  const now = input.now ?? new Date();
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    settings,
    themeBackground: wallpaper,
    images,
  };
}

export function serializeBackup(backup: HearthBackupV1): string {
  return `${JSON.stringify(backup, null, 2)}\n`;
}

/**
 * Parse and validate a backup JSON string.
 * Throws Error with IMPORT_INVALID_MESSAGE (or a more specific message) on failure.
 */
export function parseBackup(raw: string): HearthBackupV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(IMPORT_INVALID_MESSAGE);
  }
  return readBackup(parsed);
}

export function readBackup(value: unknown): HearthBackupV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(IMPORT_INVALID_MESSAGE);
  }
  const record = value as Record<string, unknown>;
  if (record.format !== BACKUP_FORMAT) {
    throw new Error(IMPORT_INVALID_MESSAGE);
  }
  if (record.version !== BACKUP_VERSION) {
    throw new Error(
      `Unsupported backup version (${String(record.version)}). This build reads version ${BACKUP_VERSION}.`,
    );
  }

  const settings = readBackupSettings(record.settings);
  const themeBackground = readBackupThemeBackground(record.themeBackground);
  const images = readBackupImages(record.images);
  const exportedAt =
    typeof record.exportedAt === "string" && record.exportedAt.trim()
      ? record.exportedAt.trim()
      : new Date(0).toISOString();

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    settings,
    themeBackground,
    images,
  };
}

function readBackupSettings(value: unknown): BackupSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(IMPORT_INVALID_MESSAGE);
  }
  const record = value as Record<string, unknown>;
  const theme: ThemeSettings = readTheme(record.theme);
  return {
    columns: clampColumns(asFiniteNumber(record.columns) ?? DEFAULT_LAYOUT.columns),
    tileSize: clampTileSize(asFiniteNumber(record.tileSize) ?? DEFAULT_LAYOUT.tileSize),
    reverseOrder: readReverseOrder(record.reverseOrder),
    thumbnailsEnabled: readThumbnailsEnabled(record.thumbnailsEnabled),
    imageUrlFetchEnabled: readImageUrlFetchEnabled(record.imageUrlFetchEnabled),
    thumbnailWaitSeconds: clampThumbnailWaitSeconds(
      asFiniteNumber(record.thumbnailWaitSeconds) ?? DEFAULT_LAYOUT.thumbnailWaitSeconds,
    ),
    defaultFolderId: readDefaultFolderId({ defaultFolderId: record.defaultFolderId }),
    openFolderId: readOpenFolderId({ openFolderId: record.openFolderId }),
    theme,
  };
}

function readBackupThemeBackground(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") throw new Error(IMPORT_INVALID_MESSAGE);
  if (value.trim() === "") return null;
  const dataUrl = readThemeBackgroundDataUrl(value);
  if (!dataUrl) throw new Error(IMPORT_INVALID_MESSAGE);
  return dataUrl;
}

function readBackupImages(value: unknown): BackupImageEntry[] {
  if (value == null) return [];
  // Object map form: { [bookmarkId]: dataUrl }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const entries: BackupImageEntry[] = [];
    for (const [bookmarkId, raw] of Object.entries(value as Record<string, unknown>)) {
      if (!bookmarkId) continue;
      if (typeof raw !== "string" || !isImageDataUrl(raw)) {
        throw new Error(IMPORT_INVALID_MESSAGE);
      }
      const dataUrl = readImageDataUrl(raw);
      if (!dataUrl) throw new Error(IMPORT_INVALID_MESSAGE);
      entries.push({ bookmarkId, dataUrl });
    }
    return entries;
  }
  if (!Array.isArray(value)) throw new Error(IMPORT_INVALID_MESSAGE);
  const entries: BackupImageEntry[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(IMPORT_INVALID_MESSAGE);
    }
    const row = item as Record<string, unknown>;
    if (typeof row.bookmarkId !== "string" || !row.bookmarkId) {
      throw new Error(IMPORT_INVALID_MESSAGE);
    }
    if (typeof row.dataUrl !== "string" || !isImageDataUrl(row.dataUrl)) {
      throw new Error(IMPORT_INVALID_MESSAGE);
    }
    const dataUrl = readImageDataUrl(row.dataUrl);
    if (!dataUrl) throw new Error(IMPORT_INVALID_MESSAGE);
    const entry: BackupImageEntry = { bookmarkId: row.bookmarkId, dataUrl };
    if (typeof row.url === "string" && row.url.trim()) entry.url = row.url.trim();
    entries.push(entry);
  }
  return entries;
}

/**
 * Plan how a validated backup applies to the current profile.
 * When `existingIds` is provided, pictures whose bookmark id is missing are
 * rematched by URL (if present) or skipped. When omitted, ids from the file
 * are used as-is (settings-only import without a bookmark tree).
 */
export function planBackupApply(
  backup: HearthBackupV1,
  mode: ImportMode,
  options: {
    existingIds?: ReadonlySet<string>;
    urlToId?: ReadonlyMap<string, string>;
  } = {},
): ApplyBackupResult {
  const layout: LayoutSettings = {
    columns: backup.settings.columns,
    tileSize: backup.settings.tileSize,
    reverseOrder: backup.settings.reverseOrder,
    thumbnailsEnabled: backup.settings.thumbnailsEnabled,
    imageUrlFetchEnabled: backup.settings.imageUrlFetchEnabled,
    thumbnailWaitSeconds: backup.settings.thumbnailWaitSeconds,
    theme: normalizeTheme(backup.settings.theme),
  };

  const imagesToSet = resolveImagesToSet(backup.images, options.existingIds, options.urlToId);

  if (mode === "overwrite") {
    return {
      layout,
      defaultFolderId: backup.settings.defaultFolderId,
      openFolderId: backup.settings.openFolderId,
      themeBackground: backup.themeBackground,
      clearAllImages: true,
      imagesToSet,
    };
  }

  return {
    layout,
    defaultFolderId: backup.settings.defaultFolderId,
    openFolderId: backup.settings.openFolderId,
    // Merge: only replace wallpaper when the file includes one.
    themeBackground: backup.themeBackground ?? undefined,
    clearAllImages: false,
    imagesToSet,
  };
}

function resolveImagesToSet(
  entries: readonly BackupImageEntry[],
  existingIds: ReadonlySet<string> | undefined,
  urlToId: ReadonlyMap<string, string> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of entries) {
    let id = entry.bookmarkId;
    if (existingIds && !existingIds.has(id)) {
      const rematched = entry.url && urlToId ? urlToId.get(entry.url) : undefined;
      if (!rematched || !existingIds.has(rematched)) continue;
      id = rematched;
    }
    out[id] = entry.dataUrl;
  }
  return out;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Trigger a browser download of a UTF-8 JSON blob. */
export function downloadTextFile(filename: string, contents: string, doc: Document = document): void {
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  doc.body.append(anchor);
  anchor.click();
  anchor.remove();
  queueMicrotask(() => URL.revokeObjectURL(url));
}

/** Open a hidden file picker for a JSON backup. Resolves null when cancelled. */
export function pickBackupFile(doc: Document = document): Promise<File | null> {
  return new Promise((resolve) => {
    const input = doc.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.style.display = "none";
    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(file);
    };
    input.addEventListener("change", () => {
      finish(input.files?.[0] ?? null);
    });
    input.addEventListener("cancel", () => finish(null));
    doc.body.append(input);
    input.click();
    // Some environments never fire cancel; GC of the input is fine if abandoned.
  });
}
