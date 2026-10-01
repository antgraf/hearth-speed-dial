#!/usr/bin/env node
/**
 * Build a Firefox-ready extension tree at dist/firefox/ from dist/chrome/.
 * Usage: node scripts/prepare-firefox-dist.mjs
 * Requires a prior `npm run build:chrome` (or `npm run build`).
 */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertFirefoxManifest, chromeManifestToFirefox } from "./firefox-manifest.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distChrome = resolve(root, "dist/chrome");
const distFirefox = resolve(root, "dist/firefox");

function assertChromeDistReady() {
  if (!existsSync(distChrome)) {
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
    if (!existsSync(resolve(distChrome, required))) {
      throw new Error(`dist/chrome/ missing required ${required}`);
    }
  }
}

assertChromeDistReady();

const chromeManifest = JSON.parse(readFileSync(resolve(distChrome, "manifest.json"), "utf8"));
const firefoxManifest = chromeManifestToFirefox(chromeManifest);
assertFirefoxManifest(firefoxManifest);

rmSync(distFirefox, { recursive: true, force: true });
mkdirSync(distFirefox, { recursive: true });
cpSync(distChrome, distFirefox, { recursive: true });
writeFileSync(resolve(distFirefox, "manifest.json"), `${JSON.stringify(firefoxManifest, null, 2)}\n`);

process.stdout.write(`${distFirefox}\n`);
