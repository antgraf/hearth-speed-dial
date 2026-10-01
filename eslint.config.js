import js from "@eslint/js";
import tseslint from "typescript-eslint";

/** Minimal Node globals for scripts/*.mjs (avoid adding the `globals` package). */
const nodeGlobals = {
  console: "readonly",
  process: "readonly",
  Buffer: "readonly",
  URL: "readonly",
  structuredClone: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
};

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", ".browser-profiles/**", "artifacts/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["scripts/**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: nodeGlobals,
    },
  },
);
