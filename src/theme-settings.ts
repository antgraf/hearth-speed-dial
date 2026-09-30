/**
 * Shared Theme category controls for the dial Settings overlay and settings.html.
 */

import {
  bindRangeInput,
  syncRangeInputValue,
} from "./settings.ts";
import {
  THEME_ACCENTS,
  THEME_BACKGROUND_FITS,
  THEME_BACKGROUND_POSITIONS,
  THEME_LIMITS,
  THEME_MODES,
  themeAccentLabel,
  themeModeLabel,
  type ThemeAccent,
  type ThemeBackgroundFit,
  type ThemeBackgroundPosition,
  type ThemeMode,
  type ThemeSettings,
} from "./theme.ts";
import { imagePickerAccept } from "./images.ts";

export type ThemeCategoryHandle = {
  root: HTMLElement;
  readTheme(): ThemeSettings;
  syncTheme(theme: ThemeSettings): void;
  setHasBackground(has: boolean): void;
  setBusy(busy: boolean): void;
};

export type ThemeCategoryOptions = {
  theme: ThemeSettings;
  hasBackground: boolean;
  disabled?: boolean;
  /** Prefix for input ids (overlay vs options page). */
  idPrefix?: string;
  onThemeChange: () => void;
  /** User picked a local wallpaper file, or null to clear. */
  onBackgroundFile: (file: File | null) => void;
};

/** Build the Settings “Theme” category with mode, accent, color, and local wallpaper. */
export function buildThemeCategory(options: ThemeCategoryOptions): ThemeCategoryHandle {
  const prefix = options.idPrefix ?? "theme";
  const root = settingsCategory("Theme");
  let hasBackground = options.hasBackground;
  let busy = Boolean(options.disabled);

  const mode = document.createElement("select");
  mode.name = "themeMode";
  mode.setAttribute("aria-label", "Appearance");
  for (const value of THEME_MODES) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = themeModeLabel(value);
    mode.append(option);
  }
  mode.value = options.theme.mode;
  root.append(settingsField("Appearance", mode));
  const modeHelp = document.createElement("span");
  modeHelp.className = "settings-help";
  modeHelp.textContent =
    "Dark matches Hearth’s default look. Auto follows your system light/dark preference.";
  root.append(modeHelp);

  const accentField = document.createElement("div");
  accentField.className = "settings-field";
  const accentCaption = document.createElement("span");
  accentCaption.textContent = "Accent";
  const accentRow = document.createElement("div");
  accentRow.className = "settings-accent-row";
  accentRow.setAttribute("role", "radiogroup");
  accentRow.setAttribute("aria-label", "Accent");
  const accentInputs: HTMLInputElement[] = [];
  for (const accent of THEME_ACCENTS) {
    const label = document.createElement("label");
    label.className = "settings-accent-option";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = `${prefix}-accent`;
    input.value = accent;
    input.checked = options.theme.accent === accent;
    input.id = `${prefix}-accent-${accent}`;
    const swatch = document.createElement("span");
    swatch.className = "settings-accent-swatch";
    swatch.dataset.accent = accent;
    swatch.setAttribute("aria-hidden", "true");
    const text = document.createElement("span");
    text.textContent = themeAccentLabel(accent);
    label.append(input, swatch, text);
    accentRow.append(label);
    accentInputs.push(input);
  }
  accentField.append(accentCaption, accentRow);
  root.append(accentField);
  const accentHelp = document.createElement("span");
  accentHelp.className = "settings-help";
  accentHelp.textContent =
    "A small warm palette that keeps Hearth’s ember identity — not a full recolor.";
  root.append(accentHelp);

  const colorField = document.createElement("div");
  colorField.className = "settings-field";
  const colorCaption = document.createElement("span");
  colorCaption.textContent = "Background color";
  const colorActions = document.createElement("div");
  colorActions.className = "settings-theme-actions";
  const color = document.createElement("input");
  color.type = "color";
  color.name = "themeBackgroundColor";
  color.setAttribute("aria-label", "Background color");
  color.value = options.theme.backgroundColor ?? "#161311";
  const clearColor = document.createElement("button");
  clearColor.type = "button";
  clearColor.className = "quiet";
  clearColor.textContent = "Use theme default";
  colorActions.append(color, clearColor);
  colorField.append(colorCaption, colorActions);
  root.append(colorField);
  const colorHelp = document.createElement("span");
  colorHelp.className = "settings-help";
  colorHelp.textContent = "Optional solid page color. Cleared color restores the light/dark palette.";
  root.append(colorHelp);

  const wallpaperField = document.createElement("div");
  wallpaperField.className = "settings-field";
  const wallpaperCaption = document.createElement("span");
  wallpaperCaption.textContent = "Background image";
  const wallpaperActions = document.createElement("div");
  wallpaperActions.className = "settings-theme-actions";
  const pickWallpaper = document.createElement("button");
  pickWallpaper.type = "button";
  pickWallpaper.className = "quiet";
  pickWallpaper.textContent = "Choose local image…";
  const clearWallpaper = document.createElement("button");
  clearWallpaper.type = "button";
  clearWallpaper.className = "quiet";
  clearWallpaper.textContent = "Remove image";
  const wallpaperStatus = document.createElement("span");
  wallpaperStatus.className = "settings-theme-status";
  wallpaperActions.append(pickWallpaper, clearWallpaper, wallpaperStatus);
  wallpaperField.append(wallpaperCaption, wallpaperActions);
  root.append(wallpaperField);
  const wallpaperHelp = document.createElement("span");
  wallpaperHelp.className = "settings-help";
  wallpaperHelp.textContent =
    "Stored in this browser profile only (same local store as dial pictures). No remote wallpapers.";
  root.append(wallpaperHelp);

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = imagePickerAccept();
  fileInput.hidden = true;
  root.append(fileInput);

  const imageControls = document.createElement("div");
  imageControls.className = "settings-theme-image-controls";

  const fit = document.createElement("select");
  fit.name = "themeBackgroundFit";
  fit.setAttribute("aria-label", "Background fit");
  for (const value of THEME_BACKGROUND_FITS) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value === "cover" ? "Cover" : "Contain";
    fit.append(option);
  }
  fit.value = options.theme.backgroundFit;
  imageControls.append(settingsField("Fit", fit));

  const position = document.createElement("select");
  position.name = "themeBackgroundPosition";
  position.setAttribute("aria-label", "Background position");
  for (const value of THEME_BACKGROUND_POSITIONS) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value[0]!.toUpperCase() + value.slice(1);
    position.append(option);
  }
  position.value = options.theme.backgroundPosition;
  imageControls.append(settingsField("Position", position));

  const opacity = document.createElement("input");
  opacity.name = "themeBackgroundOpacity";
  bindRangeInput(opacity, {
    min: THEME_LIMITS.backgroundOpacity.min,
    max: THEME_LIMITS.backgroundOpacity.max,
    step: THEME_LIMITS.backgroundOpacity.step,
    value: options.theme.backgroundOpacity,
  });
  opacity.setAttribute("aria-label", "Background opacity");
  imageControls.append(settingsField("Opacity", opacity));
  syncRangeInputValue(opacity, options.theme.backgroundOpacity);
  const opacityHelp = document.createElement("span");
  opacityHelp.className = "settings-help";
  opacityHelp.textContent = "How strongly the local wallpaper shows behind the dial (0–100%).";
  imageControls.append(opacityHelp);
  root.append(imageControls);

  const syncWallpaperUi = () => {
    wallpaperStatus.textContent = hasBackground ? "Local image in use" : "No image";
    clearWallpaper.disabled = busy || !hasBackground;
    imageControls.hidden = !hasBackground;
    fit.disabled = busy || !hasBackground;
    position.disabled = busy || !hasBackground;
    opacity.disabled = busy || !hasBackground;
  };

  const setBusy = (next: boolean) => {
    busy = next;
    mode.disabled = busy;
    color.disabled = busy;
    clearColor.disabled = busy;
    pickWallpaper.disabled = busy;
    fileInput.disabled = busy;
    for (const input of accentInputs) input.disabled = busy;
    syncWallpaperUi();
  };

  const readTheme = (): ThemeSettings => {
    const accentValue =
      accentInputs.find((input) => input.checked)?.value ?? options.theme.accent;
    return {
      mode: mode.value as ThemeMode,
      accent: accentValue as ThemeAccent,
      backgroundColor: color.dataset.custom === "1" ? color.value : null,
      backgroundFit: fit.value as ThemeBackgroundFit,
      backgroundPosition: position.value as ThemeBackgroundPosition,
      backgroundOpacity: Number(opacity.value),
    };
  };

  const syncTheme = (theme: ThemeSettings) => {
    mode.value = theme.mode;
    for (const input of accentInputs) {
      input.checked = input.value === theme.accent;
    }
    if (theme.backgroundColor) {
      color.value = theme.backgroundColor;
      color.dataset.custom = "1";
    } else {
      color.dataset.custom = "0";
      color.value = "#161311";
    }
    fit.value = theme.backgroundFit;
    position.value = theme.backgroundPosition;
    syncRangeInputValue(opacity, theme.backgroundOpacity);
  };

  if (options.theme.backgroundColor) {
    color.dataset.custom = "1";
  } else {
    color.dataset.custom = "0";
  }

  mode.addEventListener("change", () => options.onThemeChange());
  for (const input of accentInputs) {
    input.addEventListener("change", () => options.onThemeChange());
  }
  color.addEventListener("input", () => {
    color.dataset.custom = "1";
    options.onThemeChange();
  });
  clearColor.addEventListener("click", () => {
    color.dataset.custom = "0";
    color.value = "#161311";
    options.onThemeChange();
  });
  fit.addEventListener("change", () => options.onThemeChange());
  position.addEventListener("change", () => options.onThemeChange());
  opacity.addEventListener("change", () => options.onThemeChange());
  pickWallpaper.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0] ?? null;
    fileInput.value = "";
    if (file) options.onBackgroundFile(file);
  });
  clearWallpaper.addEventListener("click", () => options.onBackgroundFile(null));

  setBusy(busy);
  syncWallpaperUi();

  return {
    root,
    readTheme,
    syncTheme,
    setHasBackground(next) {
      hasBackground = next;
      syncWallpaperUi();
    },
    setBusy,
  };
}

function settingsCategory(title: string): HTMLElement {
  const section = document.createElement("section");
  section.className = "settings-category";
  const heading = document.createElement("h3");
  heading.className = "settings-category-title";
  heading.textContent = title;
  section.append(heading);
  return section;
}

function settingsField(labelText: string, control: HTMLElement): HTMLLabelElement {
  const label = document.createElement("label");
  label.className = "settings-field";
  const caption = document.createElement("span");
  caption.textContent = labelText;
  label.append(caption, control);
  return label;
}
