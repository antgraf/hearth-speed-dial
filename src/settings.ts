import {
  DEFAULT_THEME,
  normalizeTheme,
  readTheme,
  readThemeBackgroundDataUrl,
  THEME_BACKGROUND_KEY,
  type ThemeSettings,
} from "./theme.ts";
import { t } from "./i18n.ts";

const STORAGE_KEY = "hearth.settings";

/**
 * Shared chrome.storage key for the settings blob.
 * Portable layout/theme fields live in `storage.sync` under this key;
 * device-local fields (folder ids, picture opt-ins) live in `storage.local`.
 */
export const SETTINGS_STORAGE_KEY = "settings";

/** Local-only first-run welcome dismissed flag (not synced; not in backup). */
export const WELCOME_DISMISSED_KEY = "hearth.welcome.dismissed";

/**
 * Prefs that roam with the browser account via `storage.sync`.
 * Kept tiny (well under sync item / total quotas). No image blobs, no
 * profile-local bookmark ids, no per-install permission opt-ins.
 */
export type PortableLayoutSettings = {
  columns: number;
  tileSize: number;
  reverseOrder: boolean;
  thumbnailWaitSeconds: number;
  theme: ThemeSettings;
};

/**
 * Prefs that stay on the device in `storage.local`.
 * Picture toggles mirror optional grants per install; folder ids are
 * profile-local bookmark ids and must not roam.
 */
export type DeviceLayoutSettings = {
  thumbnailsEnabled: boolean;
  imageUrlFetchEnabled: boolean;
};

export type LayoutSettings = PortableLayoutSettings & DeviceLayoutSettings;

/** Width of each dial face; height follows TILE_ASPECT (16:9). */
export const DEFAULT_LAYOUT: LayoutSettings = {
  columns: 5,
  tileSize: 176,
  reverseOrder: false,
  thumbnailsEnabled: false,
  imageUrlFetchEnabled: false,
  thumbnailWaitSeconds: 2,
  theme: { ...DEFAULT_THEME },
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
  /** Optional local wallpaper data URL (or null when none). */
  getThemeBackground(): Promise<string | null>;
  /** Persist or clear the local wallpaper (data URL / null). */
  setThemeBackground(dataUrl: string | null): Promise<void>;
  /** True after the user dismisses the first-run welcome card. */
  getWelcomeDismissed(): Promise<boolean>;
  /** Persist whether the first-run welcome has been dismissed. */
  setWelcomeDismissed(dismissed: boolean): Promise<void>;
  /**
   * Restore portable layout/theme + device picture toggles + default-folder
   * prefs to product defaults. Preserves last-open folder (`openFolderId`).
   * Clears the theme wallpaper. Does not touch dial images or the welcome
   * dismissed flag.
   */
  resetToDefaults(): Promise<LayoutSettings>;
  /**
   * Remove sync portable settings, the local settings blob (layout toggles,
   * default folder, last-open), the theme wallpaper key, and the welcome
   * dismissed flag. Does not touch dial image keys — pair with
   * ImagesApi.clearAll for Erase.
   */
  clearAll(): Promise<void>;
};

/** Result applied to Settings UI after Reset, Erase, or Import. */
export type DangerZoneResult = {
  layout: LayoutSettings;
  defaultFolderId: string | null;
  /** Local wallpaper after the action; null clears the preview. */
  themeBackground: string | null;
};

export function resetDefaultsTitle(): string {
  return t("reset_defaults_title");
}

export function resetDefaultsMessage(): string {
  return t("reset_defaults_message");
}

export function resetDefaultsConfirm(): string {
  return t("reset_defaults_confirm");
}

export function eraseAllTitle(): string {
  return t("erase_all_title");
}

export function eraseAllMessage(): string {
  return t("erase_all_message");
}

export function eraseAllConfirm(): string {
  return t("erase_all_confirm");
}

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
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_LAYOUT, theme: { ...DEFAULT_THEME } };
  }
  const record = value as {
    columns?: unknown;
    tileSize?: unknown;
    reverseOrder?: unknown;
    thumbnailsEnabled?: unknown;
    imageUrlFetchEnabled?: unknown;
    thumbnailWaitSeconds?: unknown;
    theme?: unknown;
  };
  return {
    columns: readColumns(record.columns),
    tileSize: readTileSize(record.tileSize),
    reverseOrder: readReverseOrder(record.reverseOrder),
    thumbnailsEnabled: readThumbnailsEnabled(record.thumbnailsEnabled),
    imageUrlFetchEnabled: readImageUrlFetchEnabled(record.imageUrlFetchEnabled),
    thumbnailWaitSeconds: readThumbnailWaitSeconds(record.thumbnailWaitSeconds),
    theme: readTheme(record.theme),
  };
}

/** Normalize portable fields from a sync (or legacy combined) blob. */
export function readPortableLayout(value: unknown): PortableLayoutSettings {
  const full = readLayout(value);
  return portableFromLayout(full);
}

/** Normalize device-local picture opt-ins from a local (or legacy) blob. */
export function readDeviceLayout(value: unknown): DeviceLayoutSettings {
  const full = readLayout(value);
  return deviceFromLayout(full);
}

export function portableFromLayout(layout: LayoutSettings): PortableLayoutSettings {
  return {
    columns: clampColumns(layout.columns),
    tileSize: clampTileSize(layout.tileSize),
    reverseOrder: Boolean(layout.reverseOrder),
    thumbnailWaitSeconds: clampThumbnailWaitSeconds(layout.thumbnailWaitSeconds),
    theme: normalizeTheme(layout.theme),
  };
}

export function deviceFromLayout(layout: LayoutSettings): DeviceLayoutSettings {
  return {
    thumbnailsEnabled: Boolean(layout.thumbnailsEnabled),
    imageUrlFetchEnabled: Boolean(layout.imageUrlFetchEnabled),
  };
}

/** Merge sync portable prefs with local device prefs into the Settings UI model. */
export function mergeLayoutParts(
  portable: PortableLayoutSettings,
  device: DeviceLayoutSettings,
): LayoutSettings {
  return {
    ...portable,
    theme: { ...portable.theme },
    ...device,
  };
}

/**
 * True when a stored blob still holds portable layout/theme fields.
 * Used to one-time seed `storage.sync` from pre-release `storage.local` data
 * (no deferred migration for first-release users — they write sync from day one).
 */
export function hasPortableSettingsFields(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    "columns" in record ||
    "tileSize" in record ||
    "reverseOrder" in record ||
    "thumbnailWaitSeconds" in record ||
    "theme" in record
  );
}

/**
 * Device-local fields to keep in `storage.local` after stripping portable prefs
 * (and dropping unknown keys that are neither portable nor device).
 */
export function deviceSettingsBlobFromUnknown(value: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!value || typeof value !== "object") return out;
  const record = value as Record<string, unknown>;
  const openFolderId = readOpenFolderId(record);
  if (openFolderId !== null) out.openFolderId = openFolderId;
  const defaultFolderId = readDefaultFolderId(record);
  if (defaultFolderId !== null) out.defaultFolderId = defaultFolderId;
  if ("thumbnailsEnabled" in record) {
    out.thumbnailsEnabled = readThumbnailsEnabled(record.thumbnailsEnabled);
  }
  if ("imageUrlFetchEnabled" in record) {
    out.imageUrlFetchEnabled = readImageUrlFetchEnabled(record.imageUrlFetchEnabled);
  }
  return out;
}

/** Plain object written to `storage.sync` for portable prefs. */
export function portableSettingsBlob(layout: PortableLayoutSettings): Record<string, unknown> {
  const portable = portableFromLayout({
    ...layout,
    thumbnailsEnabled: DEFAULT_LAYOUT.thumbnailsEnabled,
    imageUrlFetchEnabled: DEFAULT_LAYOUT.imageUrlFetchEnabled,
  });
  return {
    columns: portable.columns,
    tileSize: portable.tileSize,
    reverseOrder: portable.reverseOrder,
    thumbnailWaitSeconds: portable.thumbnailWaitSeconds,
    theme: portable.theme,
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

/** Absent / unknown values mean the welcome has not been dismissed yet. */
export function readWelcomeDismissed(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return false;
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
        theme: normalizeTheme(layout.theme),
      });
    },
    async getThemeBackground() {
      try {
        return readThemeBackgroundDataUrl(localStorage.getItem(THEME_BACKGROUND_KEY));
      } catch {
        return null;
      }
    },
    async setThemeBackground(dataUrl) {
      if (dataUrl == null) {
        localStorage.removeItem(THEME_BACKGROUND_KEY);
        return;
      }
      const valid = readThemeBackgroundDataUrl(dataUrl);
      if (!valid) throw new Error(t("error_background_store"));
      localStorage.setItem(THEME_BACKGROUND_KEY, valid);
    },
    async getWelcomeDismissed() {
      try {
        return readWelcomeDismissed(localStorage.getItem(WELCOME_DISMISSED_KEY));
      } catch {
        return false;
      }
    },
    async setWelcomeDismissed(dismissed) {
      if (dismissed) {
        localStorage.setItem(WELCOME_DISMISSED_KEY, "true");
        return;
      }
      localStorage.removeItem(WELCOME_DISMISSED_KEY);
    },
    async resetToDefaults() {
      writeStored({
        columns: DEFAULT_LAYOUT.columns,
        tileSize: DEFAULT_LAYOUT.tileSize,
        reverseOrder: DEFAULT_LAYOUT.reverseOrder,
        thumbnailsEnabled: DEFAULT_LAYOUT.thumbnailsEnabled,
        imageUrlFetchEnabled: DEFAULT_LAYOUT.imageUrlFetchEnabled,
        thumbnailWaitSeconds: DEFAULT_LAYOUT.thumbnailWaitSeconds,
        theme: { ...DEFAULT_THEME },
        defaultFolderId: null,
      });
      localStorage.removeItem(THEME_BACKGROUND_KEY);
      return { ...DEFAULT_LAYOUT, theme: { ...DEFAULT_THEME } };
    },
    async clearAll() {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(THEME_BACKGROUND_KEY);
      localStorage.removeItem(WELCOME_DISMISSED_KEY);
    },
  };
}
