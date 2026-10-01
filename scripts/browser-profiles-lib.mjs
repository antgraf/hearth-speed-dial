/**
 * Shared helpers for launching browsers with an isolated repo-local profile.
 * Profiles live under .browser-profiles/ (gitignored) — never the OS default.
 */
import { existsSync, mkdirSync, rmSync, accessSync, constants } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const profilesRoot = join(repoRoot, ".browser-profiles");
export const distDir = join(repoRoot, "dist");

const isWindows = process.platform === "win32";
const isMac = process.platform === "darwin";

/**
 * @param {string[]} candidates
 * @returns {string | null}
 */
export function firstExisting(candidates) {
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Resolve a command on PATH via `where` (Windows) or `which` (POSIX).
 * @param {string} command
 * @returns {string | null}
 */
export function findOnPath(command) {
  if (isWindows) {
    const result = spawnSync("where.exe", [command], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (result.status !== 0) return null;
    const line = result.stdout
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find(Boolean);
    return line ?? null;
  }
  const result = spawnSync("which", [command], { encoding: "utf8" });
  if (result.status !== 0) return null;
  const line = result.stdout.trim().split(/\n/)[0]?.trim();
  return line || null;
}

/**
 * @param {"chrome" | "firefox"} browser
 * @returns {string}
 */
export function profileDir(browser) {
  return join(profilesRoot, browser);
}

/**
 * Create the isolated profile directory if missing (idempotent).
 * @param {"chrome" | "firefox"} browser
 * @returns {string} absolute profile path
 */
export function ensureProfile(browser) {
  const dir = profileDir(browser);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Remove one or both isolated profile directories.
 * @param {"chrome" | "firefox" | "all"} target
 */
export function resetProfiles(target) {
  /** @type {Array<"chrome" | "firefox">} */
  const targets = target === "all" ? ["chrome", "firefox"] : [target];
  for (const name of targets) {
    const dir = profileDir(name);
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
      console.log(`Removed ${dir}`);
    } else {
      console.log(`Nothing to remove: ${dir}`);
    }
  }
}

/**
 * @returns {string | null}
 */
export function findChrome() {
  const fromEnv = process.env.CHROME_PATH || process.env.GOOGLE_CHROME_BIN;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  for (const name of [
    "google-chrome-stable",
    "google-chrome",
    "chromium",
    "chromium-browser",
    "chrome",
  ]) {
    const found = findOnPath(name);
    if (found) return found;
  }

  if (isMac) {
    return firstExisting([
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    ]);
  }

  if (isWindows) {
    const local = process.env.LOCALAPPDATA || "";
    const programFiles = process.env.PROGRAMFILES || "C:\\Program Files";
    const programFilesX86 =
      process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)";
    return firstExisting([
      join(local, "Google", "Chrome", "Application", "chrome.exe"),
      join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
      join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
      join(local, "Chromium", "Application", "chrome.exe"),
    ]);
  }

  return firstExisting([
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
  ]);
}

/**
 * @returns {string | null}
 */
export function findFirefox() {
  const fromEnv = process.env.FIREFOX_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  for (const name of ["firefox", "firefox-esr", "firefox-bin"]) {
    const found = findOnPath(name);
    if (found) return found;
  }

  if (isMac) {
    return firstExisting([
      "/Applications/Firefox.app/Contents/MacOS/firefox",
      "/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox",
      "/Applications/Firefox Nightly.app/Contents/MacOS/firefox",
    ]);
  }

  if (isWindows) {
    const programFiles = process.env.PROGRAMFILES || "C:\\Program Files";
    const programFilesX86 =
      process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)";
    const local = process.env.LOCALAPPDATA || "";
    return firstExisting([
      join(programFiles, "Mozilla Firefox", "firefox.exe"),
      join(programFilesX86, "Mozilla Firefox", "firefox.exe"),
      join(local, "Mozilla Firefox", "firefox.exe"),
    ]);
  }

  return firstExisting([
    "/usr/bin/firefox",
    "/usr/bin/firefox-esr",
    "/snap/bin/firefox",
  ]);
}

/**
 * @param {string} binary
 * @param {string[]} args
 * @param {{ foreground?: boolean }} [opts]
 * @returns {import("node:child_process").ChildProcess}
 */
export function launchBrowser(binary, args, opts = {}) {
  if (opts.foreground) {
    const child = spawn(binary, args, {
      stdio: "inherit",
      windowsHide: false,
    });
    child.on("exit", (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }
      process.exitCode = code ?? 0;
    });
    return child;
  }

  const child = spawn(binary, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  });
  child.unref();
  return child;
}

/**
 * Parse simple CLI flags from argv (no dependencies).
 * @param {string[]} argv
 * @returns {{ flags: Record<string, string | boolean>, positionals: string[] }}
 */
export function parseArgs(argv) {
  /** @type {Record<string, string | boolean>} */
  const flags = {};
  /** @type {string[]} */
  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else {
        const key = arg.slice(2);
        const next = argv[i + 1];
        if (next && !next.startsWith("-")) {
          flags[key] = next;
          i += 1;
        } else {
          flags[key] = true;
        }
      }
    } else if (arg.startsWith("-") && arg.length === 2) {
      flags[arg.slice(1)] = true;
    } else {
      positionals.push(arg);
    }
  }
  return { flags, positionals };
}

/**
 * @param {string} path
 * @returns {boolean}
 */
export function pathExists(path) {
  try {
    accessSync(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function printChromeHelp() {
  console.log(`Usage: npm run browser:chrome -- [options]

Launch Chrome/Chromium with an isolated profile under .browser-profiles/chrome
(never your personal Chrome profile). Optionally loads dist/ as an unpacked
extension.

Options:
  --no-ext          Do not pass --load-extension (open chrome://extensions yourself)
  --ext <path>      Extension directory to load (default: <repo>/dist)
  --profile <path>  Override profile directory
  --binary <path>   Chrome/Chromium binary (or set CHROME_PATH)
  --foreground      Keep this process attached until the browser exits
  -h, --help        Show this help

Examples:
  npm run build && npm run browser:chrome
  npm run browser:chrome -- --no-ext
  npm run browser:reset -- chrome
`);
}

export function printFirefoxHelp() {
  console.log(`Usage: npm run browser:firefox -- [options]

Launch Firefox with an isolated profile under .browser-profiles/firefox
(never your personal Firefox profile).

Hearth v1 is Chrome-only. This script only opens a clean Firefox profile so
you can manually install/uninstall a temporary add-on without touching your
default profile. web-ext is not required.

Load the built extension temporarily:
  1. npm run build
  2. npm run browser:firefox
  3. Open about:debugging#/runtime/this-firefox
  4. Click "Load Temporary Add-on…"
  5. Choose <repo>/dist/manifest.json

Options:
  --profile <path>  Override profile directory
  --binary <path>   Firefox binary (or set FIREFOX_PATH)
  --foreground      Keep this process attached until the browser exits
  -h, --help        Show this help

Examples:
  npm run browser:firefox
  npm run browser:reset -- firefox
`);
}
