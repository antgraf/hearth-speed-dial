import assert from "node:assert/strict";
import { test } from "node:test";
import { tabCycleIndex } from "./dialog.ts";

test("tabCycleIndex wraps forward from the last item or outside", () => {
  assert.equal(tabCycleIndex(2, 3, false), 0);
  assert.equal(tabCycleIndex(-1, 3, false), 0);
  assert.equal(tabCycleIndex(0, 3, false), null);
  assert.equal(tabCycleIndex(1, 3, false), null);
});

test("tabCycleIndex wraps backward from the first item or outside", () => {
  assert.equal(tabCycleIndex(0, 3, true), 2);
  assert.equal(tabCycleIndex(-1, 3, true), 2);
  assert.equal(tabCycleIndex(1, 3, true), null);
  assert.equal(tabCycleIndex(2, 3, true), null);
});

test("tabCycleIndex returns null for an empty set", () => {
  assert.equal(tabCycleIndex(0, 0, false), null);
  assert.equal(tabCycleIndex(0, 0, true), null);
});
