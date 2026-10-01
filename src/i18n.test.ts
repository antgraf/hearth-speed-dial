import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  englishMessage,
  englishMessageNames,
  formatMessageTemplate,
  t,
  type MessageName,
} from "./i18n.ts";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

test("English catalog covers store name and description", () => {
  assert.equal(englishMessage("ext_name"), "Hearth Speed Dial");
  assert.equal(
    englishMessage("ext_description"),
    "New-tab speed dial of your bookmark tree — nested folders, local pictures, browser sync. No account.",
  );
  assert.ok(englishMessage("ext_description").length <= 132);
  assert.ok(englishMessageNames().includes("ext_name"));
  assert.ok(englishMessageNames().length >= 200);
});

test("t() falls back to English catalog outside an extension page", () => {
  assert.equal(t("brand_name"), "Hearth");
  assert.equal(t("empty_search", "zzzz"), "No dials match “zzzz”.");
  assert.equal(t("actions_for", "News"), "Actions for News");
  assert.equal(
    t("refresh_all_message", ["3", t("noun_bookmarks")]),
    "Recapture thumbnails for 3 bookmarks in this folder? Existing dial pictures for those bookmarks will be replaced. Nested folders are not included.",
  );
});

test("formatMessageTemplate leaves unmatched placeholders alone", () => {
  assert.equal(formatMessageTemplate("Hello $1", "world"), "Hello world");
  assert.equal(formatMessageTemplate("Hello $1 $2", "world"), "Hello world $2");
});

test("_locales/en/messages.json stays the on-disk store locale source", () => {
  const disk = JSON.parse(
    readFileSync(resolve(root, "_locales/en/messages.json"), "utf8"),
  ) as Record<string, { message: string }>;
  const names = englishMessageNames();
  assert.deepEqual(Object.keys(disk).sort(), [...names].sort());
  for (const name of names) {
    assert.equal(disk[name]?.message, englishMessage(name as MessageName));
  }
});
