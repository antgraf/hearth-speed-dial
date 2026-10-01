#!/usr/bin/env node
/**
 * Clear isolated browser profiles under .browser-profiles/.
 * Does not touch the user's personal Chrome/Firefox/Edge profiles.
 */
import { parseArgs, printChromeHelp, resetProfiles } from "./browser-profiles-lib.mjs";

const { flags, positionals } = parseArgs(process.argv.slice(2));

if (flags.help || flags.h) {
  console.log(`Usage: npm run browser:reset -- [chrome|firefox|edge|all]

Delete the isolated profile directory used by browser:chrome / browser:firefox / browser:edge.
Safe: only removes .browser-profiles/<name> under this repo (gitignored).

Examples:
  npm run browser:reset
  npm run browser:reset -- chrome
  npm run browser:reset -- firefox
  npm run browser:reset -- edge
  npm run browser:reset -- all
`);
  process.exit(0);
}

const target = (positionals[0] || "all").toLowerCase();
if (
  target !== "chrome" &&
  target !== "firefox" &&
  target !== "edge" &&
  target !== "all"
) {
  console.error(
    `Unknown target "${target}". Use chrome, firefox, edge, or all.`,
  );
  printChromeHelp();
  process.exit(1);
}

resetProfiles(
  /** @type {"chrome" | "firefox" | "edge" | "all"} */ (target),
);
