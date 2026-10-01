/**
 * Local theme surface for the dial: appearance mode, ember-preserving accent
 * palette, optional solid background color, and optional local wallpaper.
 * No remote wallpaper providers and no webfont CDNs.
 */

import { readImageDataUrl } from "./images.ts";

/** Storage key for the optional local wallpaper (data URL). */
export const THEME_BACKGROUND_KEY = "hearth.theme.background";

export type ThemeMode = "light" | "dark" | "auto";
export type ThemeAccent = "ember" | "brass" | "clay" | "moss";
export type ThemeBackgroundFit = "cover" | "contain";
export type ThemeBackgroundPosition = "center" | "top" | "bottom";

export type ThemeSettings = {
  mode: ThemeMode;
  accent: ThemeAccent;
  /** Optional solid page background override (`#rrggbb`); null uses the mode palette. */
  backgroundColor: string | null;
  backgroundFit: ThemeBackgroundFit;
  backgroundPosition: ThemeBackgroundPosition;
  /** Wallpaper opacity 0–100 (under dial chrome). */
  backgroundOpacity: number;
};

export const DEFAULT_THEME: ThemeSettings = {
  mode: "auto",
  accent: "ember",
  backgroundColor: null,
  backgroundFit: "cover",
  backgroundPosition: "center",
  backgroundOpacity: 45,
};

export const THEME_LIMITS = {
  backgroundOpacity: { min: 0, max: 100, step: 5 },
} as const;

export const THEME_MODES: readonly ThemeMode[] = ["auto", "light", "dark"];
export const THEME_ACCENTS: readonly ThemeAccent[] = ["ember", "brass", "clay", "moss"];
export const THEME_BACKGROUND_FITS: readonly ThemeBackgroundFit[] = ["cover", "contain"];
export const THEME_BACKGROUND_POSITIONS: readonly ThemeBackgroundPosition[] = [
  "center",
  "top",
  "bottom",
];

const ACCENT_LABELS: Record<ThemeAccent, string> = {
  ember: "Ember",
  brass: "Brass",
  clay: "Clay",
  moss: "Moss",
};

const MODE_LABELS: Record<ThemeMode, string> = {
  light: "Light",
  dark: "Dark",
  auto: "Auto (system)",
};

/** Short labels for Settings accent swatches. */
export function themeAccentLabel(accent: ThemeAccent): string {
  return ACCENT_LABELS[accent];
}

export function themeModeLabel(mode: ThemeMode): string {
  return MODE_LABELS[mode];
}

export function clampBackgroundOpacity(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_THEME.backgroundOpacity;
  const step = THEME_LIMITS.backgroundOpacity.step;
  const rounded = Math.round(value / step) * step;
  return Math.min(
    THEME_LIMITS.backgroundOpacity.max,
    Math.max(THEME_LIMITS.backgroundOpacity.min, rounded),
  );
}

export function readBackgroundOpacity(value: unknown): number {
  const parsed = asNumber(value);
  return parsed === null ? DEFAULT_THEME.backgroundOpacity : clampBackgroundOpacity(parsed);
}

export function readThemeMode(value: unknown): ThemeMode {
  if (value === "light" || value === "dark" || value === "auto") return value;
  return DEFAULT_THEME.mode;
}

export function readThemeAccent(value: unknown): ThemeAccent {
  if (value === "ember" || value === "brass" || value === "clay" || value === "moss") return value;
  return DEFAULT_THEME.accent;
}

export function readThemeBackgroundFit(value: unknown): ThemeBackgroundFit {
  if (value === "cover" || value === "contain") return value;
  return DEFAULT_THEME.backgroundFit;
}

export function readThemeBackgroundPosition(value: unknown): ThemeBackgroundPosition {
  if (value === "center" || value === "top" || value === "bottom") return value;
  return DEFAULT_THEME.backgroundPosition;
}

/** Accept `#rgb` / `#rrggbb` (case-insensitive); normalize to lowercase `#rrggbb`. */
export function readBackgroundColor(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "" || trimmed === "null" || trimmed === "default") return null;
  const short = /^#([0-9a-f]{3})$/.exec(trimmed);
  if (short) {
    const [r, g, b] = short[1]!.split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (/^#[0-9a-f]{6}$/.test(trimmed)) return trimmed;
  return null;
}

export function readTheme(value: unknown): ThemeSettings {
  if (!value || typeof value !== "object") return { ...DEFAULT_THEME };
  const record = value as {
    mode?: unknown;
    accent?: unknown;
    backgroundColor?: unknown;
    backgroundFit?: unknown;
    backgroundPosition?: unknown;
    backgroundOpacity?: unknown;
  };
  return {
    mode: readThemeMode(record.mode),
    accent: readThemeAccent(record.accent),
    backgroundColor: readBackgroundColor(record.backgroundColor),
    backgroundFit: readThemeBackgroundFit(record.backgroundFit),
    backgroundPosition: readThemeBackgroundPosition(record.backgroundPosition),
    backgroundOpacity: readBackgroundOpacity(record.backgroundOpacity),
  };
}

export function normalizeTheme(theme: ThemeSettings): ThemeSettings {
  return {
    mode: readThemeMode(theme.mode),
    accent: readThemeAccent(theme.accent),
    backgroundColor: readBackgroundColor(theme.backgroundColor),
    backgroundFit: readThemeBackgroundFit(theme.backgroundFit),
    backgroundPosition: readThemeBackgroundPosition(theme.backgroundPosition),
    backgroundOpacity: clampBackgroundOpacity(theme.backgroundOpacity),
  };
}

/** Resolve light/dark for `auto` using a prefers-dark flag (from matchMedia). */
export function resolveThemeMode(mode: ThemeMode, prefersDark: boolean): "light" | "dark" {
  if (mode === "auto") return prefersDark ? "dark" : "light";
  return mode;
}

export function readThemeBackgroundDataUrl(value: unknown): string | null {
  return readImageDataUrl(value);
}

export type ApplyThemeOptions = {
  /** When omitted, `window.matchMedia("(prefers-color-scheme: dark)")` is used if available. */
  prefersDark?: boolean;
  /** Local wallpaper data URL, or null/undefined when none. */
  backgroundImage?: string | null;
};

/**
 * Apply theme tokens to a document element (and optional body backdrop styles).
 * Safe to call from dial, settings page, and tests (happy-dom).
 */
export function applyThemeToDocument(
  root: HTMLElement,
  theme: ThemeSettings,
  options: ApplyThemeOptions = {},
): "light" | "dark" {
  const normalized = normalizeTheme(theme);
  const prefersDark =
    options.prefersDark ??
    (typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches);
  const resolved = resolveThemeMode(normalized.mode, prefersDark);

  root.dataset.hearthTheme = resolved;
  root.dataset.hearthAccent = normalized.accent;
  root.dataset.hearthMode = normalized.mode;

  if (normalized.backgroundColor) {
    root.style.setProperty("--bg", normalized.backgroundColor);
  } else {
    root.style.removeProperty("--bg");
  }

  const image = options.backgroundImage ? readThemeBackgroundDataUrl(options.backgroundImage) : null;
  const opacity = image ? normalized.backgroundOpacity / 100 : 0;
  const position =
    normalized.backgroundPosition === "top"
      ? "center top"
      : normalized.backgroundPosition === "bottom"
        ? "center bottom"
        : "center center";

  root.style.setProperty("--theme-bg-image", image ? `url("${image}")` : "none");
  root.style.setProperty("--theme-bg-opacity", String(opacity));
  root.style.setProperty("--theme-bg-size", normalized.backgroundFit);
  root.style.setProperty("--theme-bg-position", position);

  return resolved;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
