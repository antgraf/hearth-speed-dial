#!/usr/bin/env node
/**
 * Launch Chrome/Chromium with an isolated profile for extension install tests.
 * Never uses the user's default Chrome profile.
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

const loadExt = !flags["no-ext"];
const extPath =
  (typeof flags.ext === "string" && resolve(flags.ext)) || distDir;

/** @type {string[]} */
const args = [
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--no-default-browser-check",
];

if (loadExt) {
  if (!pathExists(extPath) || !existsSync(resolve(extPath, "manifest.json"))) {
    console.error(
      `Extension folder missing or has no manifest.json: ${extPath}\n` +
        `Run \`npm run build\` or \`npm run build:chrome\` first (or pass --no-ext / --ext <path>).`,
    );
    process.exit(1);
  }
  args.push(`--disable-extensions-except=${extPath}`);
  args.push(`--load-extension=${extPath}`);
}

args.push("chrome://newtab/");

const foreground = Boolean(flags.foreground);
console.log(`Chrome:   ${binary}`);
console.log(`Profile:  ${profile}`);
console.log(
  loadExt
    ? `Extension: ${extPath} (--load-extension)`
    : "Extension: not auto-loaded (--no-ext); use chrome://extensions → Load unpacked → dist/chrome/",
);
console.log(`Repo:     ${repoRoot}`);

launchBrowser(binary, args, { foreground });
if (!foreground) {
  console.log("Launched (detached). Close the browser window when finished.");
}
