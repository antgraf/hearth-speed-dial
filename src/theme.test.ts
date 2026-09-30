import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyThemeToDocument,
  clampBackgroundOpacity,
  DEFAULT_THEME,
  normalizeTheme,
  readBackgroundColor,
  readTheme,
  readThemeAccent,
  readThemeMode,
  resolveThemeMode,
  THEME_BACKGROUND_KEY,
} from "./theme.ts";

test("theme defaults preserve dark ember identity", () => {
  assert.equal(DEFAULT_THEME.mode, "dark");
  assert.equal(DEFAULT_THEME.accent, "ember");
  assert.equal(DEFAULT_THEME.backgroundColor, null);
  assert.equal(DEFAULT_THEME.backgroundFit, "cover");
  assert.equal(DEFAULT_THEME.backgroundPosition, "center");
  assert.equal(DEFAULT_THEME.backgroundOpacity, 45);
  assert.equal(THEME_BACKGROUND_KEY, "hearth.theme.background");
});

test("readThemeMode / readThemeAccent reject unknown values", () => {
  assert.equal(readThemeMode("light"), "light");
  assert.equal(readThemeMode("auto"), "auto");
  assert.equal(readThemeMode("neon"), "dark");
  assert.equal(readThemeAccent("brass"), "brass");
  assert.equal(readThemeAccent("purple"), "ember");
});

test("readBackgroundColor normalizes hex and rejects junk", () => {
  assert.equal(readBackgroundColor("#Abc"), "#aabbcc");
  assert.equal(readBackgroundColor("#112233"), "#112233");
  assert.equal(readBackgroundColor("112233"), null);
  assert.equal(readBackgroundColor(""), null);
  assert.equal(readBackgroundColor(null), null);
});

test("clampBackgroundOpacity steps by 5", () => {
  assert.equal(clampBackgroundOpacity(47), 45);
  assert.equal(clampBackgroundOpacity(-10), 0);
  assert.equal(clampBackgroundOpacity(999), 100);
  assert.equal(clampBackgroundOpacity(Number.NaN), DEFAULT_THEME.backgroundOpacity);
});

test("readTheme fills defaults for partial records", () => {
  assert.deepEqual(readTheme(null), DEFAULT_THEME);
  assert.deepEqual(readTheme({ mode: "light", accent: "moss", backgroundOpacity: 70 }), {
    mode: "light",
    accent: "moss",
    backgroundColor: null,
    backgroundFit: "cover",
    backgroundPosition: "center",
    backgroundOpacity: 70,
  });
  assert.deepEqual(
    normalizeTheme({
      mode: "auto",
      accent: "clay",
      backgroundColor: "#Fed",
      backgroundFit: "contain",
      backgroundPosition: "top",
      backgroundOpacity: 12,
    }),
    {
      mode: "auto",
      accent: "clay",
      backgroundColor: "#ffeedd",
      backgroundFit: "contain",
      backgroundPosition: "top",
      backgroundOpacity: 10,
    },
  );
});

test("resolveThemeMode maps auto to system preference", () => {
  assert.equal(resolveThemeMode("light", true), "light");
  assert.equal(resolveThemeMode("dark", false), "dark");
  assert.equal(resolveThemeMode("auto", true), "dark");
  assert.equal(resolveThemeMode("auto", false), "light");
});

test("applyThemeToDocument sets data attributes and CSS variables", () => {
  const props = new Map<string, string>();
  const dataset: Record<string, string> = {};
  const root = {
    dataset,
    style: {
      setProperty(name: string, value: string) {
        props.set(name, value);
      },
      removeProperty(name: string) {
        props.delete(name);
      },
      getPropertyValue(name: string) {
        return props.get(name) ?? "";
      },
    },
  } as unknown as HTMLElement;

  const resolved = applyThemeToDocument(
    root,
    {
      mode: "light",
      accent: "brass",
      backgroundColor: "#223344",
      backgroundFit: "contain",
      backgroundPosition: "bottom",
      backgroundOpacity: 60,
    },
    {
      prefersDark: true,
      backgroundImage: "data:image/png;base64,aa==",
    },
  );

  assert.equal(resolved, "light");
  assert.equal(dataset.hearthTheme, "light");
  assert.equal(dataset.hearthAccent, "brass");
  assert.equal(dataset.hearthMode, "light");
  assert.equal(root.style.getPropertyValue("--bg"), "#223344");
  assert.match(root.style.getPropertyValue("--theme-bg-image"), /^url\("data:image\/png;base64,aa=="\)$/);
  assert.equal(root.style.getPropertyValue("--theme-bg-opacity"), "0.6");
  assert.equal(root.style.getPropertyValue("--theme-bg-size"), "contain");
  assert.equal(root.style.getPropertyValue("--theme-bg-position"), "center bottom");

  applyThemeToDocument(root, { ...DEFAULT_THEME }, { prefersDark: false, backgroundImage: null });
  assert.equal(dataset.hearthTheme, "dark");
  assert.equal(root.style.getPropertyValue("--bg"), "");
  assert.equal(root.style.getPropertyValue("--theme-bg-image"), "none");
  assert.equal(root.style.getPropertyValue("--theme-bg-opacity"), "0");
});
