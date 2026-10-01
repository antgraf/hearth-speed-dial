#!/usr/bin/env node
/**
 * Guard: user-facing English copy must stay browser-neutral for Firefox/AMO.
 * Mentions of both product names ("Chrome or Firefox") are fine; "Chrome" alone
 * in UI copy is not (Firefox would show the wrong browser name).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const messagesPath = resolve(root, "_locales/en/messages.json");

test("English UI strings do not hardcode Chrome alone", () => {
  const catalog = JSON.parse(readFileSync(messagesPath, "utf8"));
  /** @type {string[]} */
  const offenders = [];
  for (const [key, entry] of Object.entries(catalog)) {
    const message = typeof entry?.message === "string" ? entry.message : "";
    if (!/\bChrome\b/.test(message)) continue;
    // Allowed: strings that name both browsers for load-unpacked / boot hints.
    if (/\bChrome or Firefox\b/.test(message) || /\bFirefox or Chrome\b/.test(message)) {
      continue;
    }
    offenders.push(`${key}: ${message}`);
  }
  assert.deepEqual(offenders, []);
});

test("ext_description fits the CWS summary length", () => {
  const catalog = JSON.parse(readFileSync(messagesPath, "utf8"));
  const description = catalog.ext_description?.message ?? "";
  assert.ok(description.length > 0);
  assert.ok(description.length <= 132, `ext_description is ${description.length} chars`);
  assert.match(description, /bookmark tree/i);
});
