#!/usr/bin/env node
/**
 * Pack dist/firefox/ into an AMO / temporary-addon zip (manifest.json at zip root).
 * Usage: node scripts/pack-firefox.mjs
 * Requires `npm run build` (or build:chrome + build:firefox).
 * Output: artifacts/hearth-speed-dial-firefox-vX.Y.Z.zip
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { assertFirefoxManifest } from "./firefox-manifest.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distFirefox = resolve(root, "dist/firefox");
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
  if (!existsSync(distFirefox)) {
    throw new Error("dist/firefox/ missing — run npm run build:firefox first");
  }
  for (const required of ["manifest.json", "background.js", "index.html", "settings.html", "add.html", "icons"]) {
    if (!existsSync(resolve(distFirefox, required))) {
      throw new Error(`dist/firefox/ missing required ${required}`);
    }
  }
  const manifest = JSON.parse(readFileSync(resolve(distFirefox, "manifest.json"), "utf8"));
  assertFirefoxManifest(manifest);
}

const version = readVersion();
assertDistReady();

mkdirSync(artifacts, { recursive: true });
const zipName = `hearth-speed-dial-firefox-v${version}.zip`;
const zipPath = resolve(artifacts, zipName);
rmSync(zipPath, { force: true });

// Omit Vite source maps from the store/sideload zip (still present under dist/firefox/ for local debug).
const result = spawnSync(
  "zip",
  ["-r", "-X", "-q", zipPath, ".", "-x", "*.map", "-x", "**/*.map"],
  {
    cwd: distFirefox,
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
