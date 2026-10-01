#!/usr/bin/env node
/**
 * Launch Firefox with an isolated profile for temporary add-on install tests.
 * Never uses the user's default Firefox profile.
 *
 * Build the Firefox tree first (`npm run build && npm run build:firefox`, or
 * `.\build.ps1 -Target Firefox`), then load dist-firefox/manifest.json via
 * about:debugging (see --help / docs/DEV.md).
 */
import { resolve } from "node:path";
import {
  ensureProfile,
  findFirefox,
  launchBrowser,
  parseArgs,
  printFirefoxHelp,
  repoRoot,
} from "./browser-profiles-lib.mjs";

const { flags } = parseArgs(process.argv.slice(2));

if (flags.help || flags.h) {
  printFirefoxHelp();
  process.exit(0);
}

const binary =
  (typeof flags.binary === "string" && flags.binary) || findFirefox();
if (!binary) {
  console.error(
    "Could not find Firefox. Install Firefox, or set FIREFOX_PATH / pass --binary.",
  );
  process.exit(1);
}

const profile =
  (typeof flags.profile === "string" && resolve(flags.profile)) ||
  ensureProfile("firefox");

const firefoxDist = resolve(repoRoot, "dist-firefox");

/** @type {string[]} */
const args = [
  "-no-remote",
  "-profile",
  profile,
  "about:debugging#/runtime/this-firefox",
];

const foreground = Boolean(flags.foreground);
console.log(`Firefox:  ${binary}`);
console.log(`Profile:  ${profile}`);
console.log(`Repo:     ${repoRoot}`);
console.log("");
console.log("Temporary add-on (Firefox MV3, min 121):");
console.log('  1. Click "Load Temporary Add-on…" in the opened debugging page');
console.log(`  2. Select ${firefoxDist}/manifest.json`);
console.log("     (run: npm run build && npm run build:firefox — or .\\build.ps1 -Target Firefox)");
console.log("  3. To uninstall, click Remove on the temporary add-on, or close Firefox");
console.log("     / run: npm run browser:reset -- firefox");

launchBrowser(binary, args, { foreground });
if (!foreground) {
  console.log("Launched (detached). Close the browser window when finished.");
}
