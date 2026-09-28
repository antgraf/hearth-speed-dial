const STORAGE_KEY = "hearth.settings";

export type LayoutSettings = {
  columns: number;
  tileSize: number;
  /** When true, dial tiles show last bookmarks first (display only). */
  reverseOrder: boolean;
  /**
   * When true, the user opted into optional thumbnail capture.
   * Still requires chrome.permissions (tabs + host access); if those are
   * missing, the UI treats capture as off until permissions are granted again.
   */
  thumbnailsEnabled: boolean;
  /**
   * When true, the user opted into Image-from-URL (optional http/https host
   * access). If those grants are missing, the UI treats the feature as off.
   */
  imageUrlFetchEnabled: boolean;
};

/** Width of each dial face; height follows TILE_ASPECT (16:9). */
export const DEFAULT_LAYOUT: LayoutSettings = {
  columns: 5,
  tileSize: 176,
  reverseOrder: false,
  thumbnailsEnabled: false,
  imageUrlFetchEnabled: false,
};

/** Dial face width ÷ height. */
export const TILE_ASPECT = 16 / 9;

export const LAYOUT_LIMITS = {
  columns: { min: 2, max: 8 },
  /** Width in CSS pixels of the 16:9 dial face. */
  tileSize: { min: 96, max: 576 },
} as const;

export type SettingsApi = {
  getOpenFolderId(): Promise<string | null>;
  setOpenFolderId(id: string): Promise<void>;
  getLayout(): Promise<LayoutSettings>;
  setLayout(layout: LayoutSettings): Promise<void>;
};

export function clampColumns(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_LAYOUT.columns;
  return Math.min(
    LAYOUT_LIMITS.columns.max,
    Math.max(LAYOUT_LIMITS.columns.min, Math.round(value)),
  );
}

export function clampTileSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_LAYOUT.tileSize;
  return Math.min(
    LAYOUT_LIMITS.tileSize.max,
    Math.max(LAYOUT_LIMITS.tileSize.min, Math.round(value)),
  );
}

export function readColumns(value: unknown): number {
  const parsed = asNumber(value);
  return parsed === null ? DEFAULT_LAYOUT.columns : clampColumns(parsed);
}

export function readTileSize(value: unknown): number {
  const parsed = asNumber(value);
  return parsed === null ? DEFAULT_LAYOUT.tileSize : clampTileSize(parsed);
}

export function readReverseOrder(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return DEFAULT_LAYOUT.reverseOrder;
}

export function readThumbnailsEnabled(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return DEFAULT_LAYOUT.thumbnailsEnabled;
}

export function readImageUrlFetchEnabled(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return DEFAULT_LAYOUT.imageUrlFetchEnabled;
}

export function readLayout(value: unknown): LayoutSettings {
  if (!value || typeof value !== "object") return { ...DEFAULT_LAYOUT };
  const record = value as {
    columns?: unknown;
    tileSize?: unknown;
    reverseOrder?: unknown;
    thumbnailsEnabled?: unknown;
    imageUrlFetchEnabled?: unknown;
  };
  return {
    columns: readColumns(record.columns),
    tileSize: readTileSize(record.tileSize),
    reverseOrder: readReverseOrder(record.reverseOrder),
    thumbnailsEnabled: readThumbnailsEnabled(record.thumbnailsEnabled),
    imageUrlFetchEnabled: readImageUrlFetchEnabled(record.imageUrlFetchEnabled),
  };
}

export function readOpenFolderId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { openFolderId?: unknown; rootFolderId?: unknown };
  if (typeof record.openFolderId === "string" && record.openFolderId.length > 0) return record.openFolderId;
  if (typeof record.rootFolderId === "string" && record.rootFolderId.length > 0) return record.rootFolderId;
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readStored(): unknown {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
  } catch {
    return null;
  }
}

function writeStored(patch: Record<string, unknown>): void {
  const previous = readStored();
  const base = previous && typeof previous === "object" ? (previous as Record<string, unknown>) : {};
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...base, ...patch }));
}

export function previewSettings(): SettingsApi {
  return {
    async getOpenFolderId() {
      return readOpenFolderId(readStored());
    },
    async setOpenFolderId(id) {
      writeStored({ openFolderId: id });
    },
    async getLayout() {
      return readLayout(readStored());
    },
    async setLayout(layout) {
      writeStored({
        columns: clampColumns(layout.columns),
        tileSize: clampTileSize(layout.tileSize),
        reverseOrder: Boolean(layout.reverseOrder),
        thumbnailsEnabled: Boolean(layout.thumbnailsEnabled),
        imageUrlFetchEnabled: Boolean(layout.imageUrlFetchEnabled),
      });
    },
  };
}
