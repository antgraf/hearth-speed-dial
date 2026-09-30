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
  /**
   * How long thumbnail capture waits after opening the page before taking the
   * screenshot (seconds). Lets late paints finish; default matches the prior
   * observed fast capture timing.
   */
  thumbnailWaitSeconds: number;
};

/** Width of each dial face; height follows TILE_ASPECT (16:9). */
export const DEFAULT_LAYOUT: LayoutSettings = {
  columns: 5,
  tileSize: 176,
  reverseOrder: false,
  thumbnailsEnabled: false,
  imageUrlFetchEnabled: false,
  thumbnailWaitSeconds: 2,
};

/** Dial face width ÷ height. */
export const TILE_ASPECT = 16 / 9;

export const LAYOUT_LIMITS = {
  columns: { min: 1, max: 8 },
  /** Width in CSS pixels of the 16:9 dial face. */
  tileSize: { min: 96, max: 576 },
  /** Seconds to wait after opening the capture tab before screenshot. */
  thumbnailWaitSeconds: { min: 1, max: 15, step: 1 },
} as const;

export type SettingsApi = {
  getOpenFolderId(): Promise<string | null>;
  setOpenFolderId(id: string): Promise<void>;
  /**
   * Optional folder opened on each new window / initial new-tab load.
   * Null means recall last open folder (`openFolderId`) instead.
   */
  getDefaultFolderId(): Promise<string | null>;
  setDefaultFolderId(id: string | null): Promise<void>;
  getLayout(): Promise<LayoutSettings>;
  setLayout(layout: LayoutSettings): Promise<void>;
  /**
   * Restore layout + default-folder prefs to product defaults.
   * Preserves last-open folder (`openFolderId`). Does not touch dial images.
   */
  resetToDefaults(): Promise<LayoutSettings>;
  /**
   * Remove the entire settings blob (layout, default folder, last-open).
   * Does not touch dial image keys — pair with ImagesApi.clearAll for Erase.
   */
  clearAll(): Promise<void>;
};

/** Result applied to Settings UI after Reset or Erase. */
export type DangerZoneResult = {
  layout: LayoutSettings;
  defaultFolderId: string | null;
};

export const RESET_DEFAULTS_TITLE = "Reset to defaults?";
export const RESET_DEFAULTS_MESSAGE =
  "Restore layout, display, and picture preferences to product defaults. Your bookmarks and dial pictures stay.";
export const RESET_DEFAULTS_CONFIRM = "Reset";

export const ERASE_ALL_TITLE = "Erase all data?";
export const ERASE_ALL_MESSAGE =
  "Permanently clear all Hearth settings and stored dial pictures in this browser profile. Your Chrome bookmarks are not deleted.";
export const ERASE_ALL_CONFIRM = "Erase all data";

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

export function clampThumbnailWaitSeconds(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_LAYOUT.thumbnailWaitSeconds;
  const step = LAYOUT_LIMITS.thumbnailWaitSeconds.step;
  const rounded = Math.round(value / step) * step;
  return Math.min(
    LAYOUT_LIMITS.thumbnailWaitSeconds.max,
    Math.max(LAYOUT_LIMITS.thumbnailWaitSeconds.min, rounded),
  );
}

/** Milliseconds to wait after opening a capture window before screenshot. */
export function thumbnailWaitMs(seconds: number): number {
  return clampThumbnailWaitSeconds(seconds) * 1000;
}

export function readColumns(value: unknown): number {
  const parsed = asNumber(value);
  return parsed === null ? DEFAULT_LAYOUT.columns : clampColumns(parsed);
}

export function readTileSize(value: unknown): number {
  const parsed = asNumber(value);
  return parsed === null ? DEFAULT_LAYOUT.tileSize : clampTileSize(parsed);
}

export function readThumbnailWaitSeconds(value: unknown): number {
  const parsed = asNumber(value);
  return parsed === null ? DEFAULT_LAYOUT.thumbnailWaitSeconds : clampThumbnailWaitSeconds(parsed);
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
    thumbnailWaitSeconds?: unknown;
  };
  return {
    columns: readColumns(record.columns),
    tileSize: readTileSize(record.tileSize),
    reverseOrder: readReverseOrder(record.reverseOrder),
    thumbnailsEnabled: readThumbnailsEnabled(record.thumbnailsEnabled),
    imageUrlFetchEnabled: readImageUrlFetchEnabled(record.imageUrlFetchEnabled),
    thumbnailWaitSeconds: readThumbnailWaitSeconds(record.thumbnailWaitSeconds),
  };
}

export function readOpenFolderId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  // Legacy installs may have used rootFolderId for the last-open folder.
  const record = value as { openFolderId?: unknown; rootFolderId?: unknown };
  if (typeof record.openFolderId === "string" && record.openFolderId.length > 0) return record.openFolderId;
  if (typeof record.rootFolderId === "string" && record.rootFolderId.length > 0) return record.rootFolderId;
  return null;
}

export function readDefaultFolderId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { defaultFolderId?: unknown };
  if (typeof record.defaultFolderId === "string" && record.defaultFolderId.length > 0) {
    return record.defaultFolderId;
  }
  return null;
}

/**
 * Apply min/max/step before value on a range input.
 * Chromium defaults max to 100; assigning value first clamps it, and after max
 * is raised the thumb sits near the default midpoint instead of the stored size.
 */
export function bindRangeInput(
  input: HTMLInputElement,
  options: { min: number; max: number; step: number | string; value: number },
): void {
  input.type = "range";
  input.min = String(options.min);
  input.max = String(options.max);
  input.step = String(options.step);
  input.value = String(options.value);
}

/** Re-apply range value after the control is in the tree (Chromium thumb sync). */
export function syncRangeInputValue(input: HTMLInputElement, value: number): void {
  input.value = String(value);
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
    async getDefaultFolderId() {
      return readDefaultFolderId(readStored());
    },
    async setDefaultFolderId(id) {
      writeStored({ defaultFolderId: id });
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
        thumbnailWaitSeconds: clampThumbnailWaitSeconds(layout.thumbnailWaitSeconds),
      });
    },
    async resetToDefaults() {
      writeStored({
        columns: DEFAULT_LAYOUT.columns,
        tileSize: DEFAULT_LAYOUT.tileSize,
        reverseOrder: DEFAULT_LAYOUT.reverseOrder,
        thumbnailsEnabled: DEFAULT_LAYOUT.thumbnailsEnabled,
        imageUrlFetchEnabled: DEFAULT_LAYOUT.imageUrlFetchEnabled,
        thumbnailWaitSeconds: DEFAULT_LAYOUT.thumbnailWaitSeconds,
        defaultFolderId: null,
      });
      return { ...DEFAULT_LAYOUT };
    },
    async clearAll() {
      localStorage.removeItem(STORAGE_KEY);
    },
  };
}
