#!/usr/bin/env node
/**
 * Pack a clean source archive for AMO reviewers (Vite-bundled / minified dist).
 * Usage: node scripts/pack-source.mjs
 * Output: artifacts/hearth-speed-dial-source-vX.Y.Z.zip
 *
 * Reviewers rebuild with: npm ci && npm run build
 * Then compare dist/firefox/ to the uploaded Firefox extension zip.
 * See docs/AMO.md.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const artifacts = resolve(root, "artifacts");

function readVersion() {
  const manifest = JSON.parse(readFileSync(resolve(root, "manifest.json"), "utf8"));
  const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  if (manifest.version !== pkg.version) {
    throw new Error(`Version mismatch: manifest ${manifest.version} vs package ${pkg.version}`);
  }
  return manifest.version;
}

for (const required of [
  "package.json",
  "package-lock.json",
  "manifest.json",
  "vite.config.ts",
  "tsconfig.json",
  "docs/AMO.md",
  "src",
  "_locales",
  "scripts",
  "icons",
]) {
  if (!existsSync(resolve(root, required))) {
    throw new Error(`Source tree missing required ${required}`);
  }
}

const version = readVersion();
mkdirSync(artifacts, { recursive: true });
const zipName = `hearth-speed-dial-source-v${version}.zip`;
const zipPath = resolve(artifacts, zipName);
rmSync(zipPath, { force: true });

// Zip from repo root so reviewers unpack a flat project (manifest.json at zip root).
// Exclude build outputs, deps, local profiles, VCS, and unrelated agent/editor noise.
const result = spawnSync(
  "zip",
  [
    "-r",
    "-X",
    "-q",
    zipPath,
    ".",
    "-x",
    "*/.git/*",
    "-x",
    ".git/*",
    "-x",
    "*/node_modules/*",
    "-x",
    "node_modules/*",
    "-x",
    "*/dist/*",
    "-x",
    "dist/*",
    "-x",
    "*/artifacts/*",
    "-x",
    "artifacts/*",
    "-x",
    "*/.browser-profiles/*",
    "-x",
    ".browser-profiles/*",
    "-x",
    "*/.cursor/*",
    "-x",
    ".cursor/*",
    "-x",
    "*.zip",
    "-x",
    "*.log",
    "-x",
    ".DS_Store",
    "-x",
    "*/.DS_Store",
  ],
  {
    cwd: root,
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
