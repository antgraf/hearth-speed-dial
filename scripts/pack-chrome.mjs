#!/usr/bin/env node
/**
 * Pack dist/chrome/ into a Chrome Web Store / sideload zip (manifest.json at zip root).
 * Usage: node scripts/pack-chrome.mjs
 * Requires a prior `npm run build` or `npm run build:chrome`.
 * Output: artifacts/hearth-speed-dial-chrome-vX.Y.Z.zip
 *
 * Firefox: npm run build:firefox && npm run pack:firefox
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = resolve(root, "dist/chrome");
const artifacts = resolve(root, "artifacts");

function readVersion() {
  const manifest = JSON.parse(readFileSync(resolve(root, "manifest.json"), "utf8"));
  const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  if (manifest.version !== pkg.version) {
    throw new Error(`Version mismatch: manifest ${manifest.version} vs package ${pkg.version}`);
  }
  return manifest.version;
}

function assertDistReady() {
  if (!existsSync(dist)) {
    throw new Error("dist/chrome/ missing — run npm run build:chrome first");
  }
  for (const required of [
    "manifest.json",
    "background.js",
    "index.html",
    "settings.html",
    "add.html",
    "icons",
    "_locales/en/messages.json",
  ]) {
    if (!existsSync(resolve(dist, required))) {
      throw new Error(`dist/chrome/ missing required ${required}`);
    }
  }
}

const version = readVersion();
assertDistReady();

mkdirSync(artifacts, { recursive: true });
const zipName = `hearth-speed-dial-chrome-v${version}.zip`;
const zipPath = resolve(artifacts, zipName);
rmSync(zipPath, { force: true });

// Omit Vite source maps from the store/sideload zip (still present under dist/chrome/ for local debug).
const result = spawnSync(
  "zip",
  ["-r", "-X", "-q", zipPath, ".", "-x", "*.map", "-x", "**/*.map"],
  {
    cwd: dist,
    stdio: "inherit",
  },
);

if (result.error) {
  throw result.error;
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

process.stdout.write(`${zipPath}\n`);
