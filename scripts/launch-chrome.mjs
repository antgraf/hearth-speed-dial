#!/usr/bin/env node
/**
 * Launch Chrome/Chromium with an isolated profile for extension install tests.
 * Never uses the user's default Chrome profile.
 *
 * Official Chrome 137+ ignores --load-extension; Chrome 139+ also ignores
 * --disable-extensions-except. Default flow is therefore Load unpacked in the
 * isolated profile. Pass --load-ext only when using Chromium / Chrome for Testing.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  distDir,
  ensureProfile,
  findChrome,
  launchBrowser,
  parseArgs,
  pathExists,
  printChromeHelp,
  repoRoot,
} from "./browser-profiles-lib.mjs";

const { flags } = parseArgs(process.argv.slice(2));

if (flags.help || flags.h) {
  printChromeHelp();
  process.exit(0);
}

const binary =
  (typeof flags.binary === "string" && flags.binary) || findChrome();
if (!binary) {
  console.error(
    "Could not find Chrome or Chromium. Install Chrome, or set CHROME_PATH / pass --binary.",
  );
  process.exit(1);
}

const profile =
  (typeof flags.profile === "string" && resolve(flags.profile)) ||
  ensureProfile("chrome");

// Default: manual Load unpacked (works on branded Chrome).
// --load-ext / --ext opt into CLI load (Chromium / Chrome for Testing only).
// --no-ext kept as an explicit alias for the default (older docs / muscle memory).
const wantsCliLoad =
  Boolean(flags["load-ext"]) || typeof flags.ext === "string";
const loadExt = wantsCliLoad && !flags["no-ext"];
const extPath =
  (typeof flags.ext === "string" && resolve(flags.ext)) || distDir;

if (!pathExists(extPath) || !existsSync(resolve(extPath, "manifest.json"))) {
  console.error(
    `Extension folder missing or has no manifest.json: ${extPath}\n` +
      `Run \`npm run build\` or \`npm run build:chrome\` first.\n` +
      `Load unpacked must use dist/chrome/ (not dist/, not the repo root).`,
  );
  process.exit(1);
}

/** @type {string[]} */
const args = [
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--no-default-browser-check",
];

if (loadExt) {
  // Do not pass --disable-extensions-except: branded Chrome 139+ ignores it,
  // and on 137–138 it can force-disable a just-loaded unpacked extension when
  // --load-extension itself is already ignored — toast with an empty list.
  // Also breaks Load unpacked from a different path (e.g. legacy dist/).
  args.push(`--load-extension=${extPath}`);
}

// Open Extensions so Load unpacked is one click away; newtab alone is easy to
// confuse with a personal-profile window when CLI load is ignored.
args.push("chrome://extensions");

const foreground = Boolean(flags.foreground);
console.log(`Chrome:   ${binary}`);
console.log(`Profile:  ${profile}`);
if (loadExt) {
  console.log(`Extension: ${extPath} (--load-extension)`);
  console.log(
    "Note: Official Chrome 137+ ignores --load-extension. If the list stays empty,",
  );
  console.log(
    "       use Load unpacked on dist/chrome/ (or Chrome for Testing / Chromium).",
  );
} else {
  console.log(`Extension: load unpacked from ${extPath}`);
  console.log("Steps in the opened window:");
  console.log(
    "  1. Confirm chrome://version → Profile Path contains .browser-profiles",
  );
  console.log(
    "  2. Developer mode ON → Load unpacked → select dist/chrome/",
  );
  console.log(
    "     (folder that directly contains manifest.json — not dist/, not repo root)",
  );
  console.log("  3. Open a new tab (should be Hearth, not the default NTP)");
}
console.log(`Repo:     ${repoRoot}`);

const child = launchBrowser(binary, args, {
  foreground,
  deferUnref: !foreground,
});

if (!foreground) {
  // Branded Chrome sometimes exits immediately when it hands off to an existing
  // process (wrong profile). Keep this script alive briefly to notice that.
  const earlyMs = 2000;
  let settled = false;
  child.once("exit", (code, signal) => {
    if (settled) return;
    settled = true;
    const detail = signal ? `signal ${signal}` : `code ${code ?? "?"}`;
    console.error(
      `Chrome exited immediately (${detail}). The isolated profile may not have opened.`,
    );
    console.error(
      "Quit every Chrome window, then retry. Confirm chrome://version Profile Path",
    );
    console.error(`contains:\n  ${profile}`);
    process.exitCode = 1;
  });
  setTimeout(() => {
    if (settled) return;
    settled = true;
    console.log("Launched (detached). Close the browser window when finished.");
    child.unref();
  }, earlyMs);
}
