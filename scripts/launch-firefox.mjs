#!/usr/bin/env node
/**
 * Launch Firefox with an isolated profile for temporary add-on install tests.
 * Never uses the user's default Firefox profile.
 *
 * Hearth v1 is Chrome-only; this only provides a clean profile. Load the
 * built extension manually via about:debugging (see --help / docs/DEV.md).
 */
import { resolve } from "node:path";
import {
  ensureProfile,
  findFirefox,
  launchBrowser,
  parseArgs,
  printFirefoxHelp,
  repoRoot,
  distDir,
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
console.log("Temporary add-on (manual — Hearth is Chrome-first):");
console.log('  1. Click "Load Temporary Add-on…" in the opened debugging page');
console.log(`  2. Select ${distDir}/manifest.json (run npm run build first)`);
console.log("  3. To uninstall, click Remove on the temporary add-on, or close Firefox");
console.log("     / run: npm run browser:reset -- firefox");

launchBrowser(binary, args, { foreground });
if (!foreground) {
  console.log("Launched (detached). Close the browser window when finished.");
}
