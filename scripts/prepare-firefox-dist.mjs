#!/usr/bin/env node
/**
 * Build a Firefox-ready extension tree at dist-firefox/ from a Chrome dist/.
 * Usage: node scripts/prepare-firefox-dist.mjs
 * Requires a prior `npm run build` (Chrome dist).
 */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertFirefoxManifest, chromeManifestToFirefox } from "./firefox-manifest.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = resolve(root, "dist");
const distFirefox = resolve(root, "dist-firefox");

function assertChromeDistReady() {
  if (!existsSync(dist)) {
    throw new Error("dist/ missing — run npm run build first");
  }
  for (const required of ["manifest.json", "background.js", "index.html", "settings.html", "add.html", "icons"]) {
    if (!existsSync(resolve(dist, required))) {
      throw new Error(`dist/ missing required ${required}`);
    }
  }
}

assertChromeDistReady();

const chromeManifest = JSON.parse(readFileSync(resolve(dist, "manifest.json"), "utf8"));
const firefoxManifest = chromeManifestToFirefox(chromeManifest);
assertFirefoxManifest(firefoxManifest);

rmSync(distFirefox, { recursive: true, force: true });
mkdirSync(distFirefox, { recursive: true });
cpSync(dist, distFirefox, { recursive: true });
writeFileSync(resolve(distFirefox, "manifest.json"), `${JSON.stringify(firefoxManifest, null, 2)}\n`);

process.stdout.write(`${distFirefox}\n`);
