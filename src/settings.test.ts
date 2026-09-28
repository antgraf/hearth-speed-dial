import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clampColumns,
  clampTileSize,
  DEFAULT_LAYOUT,
  LAYOUT_LIMITS,
  readColumns,
  readLayout,
  readReverseOrder,
  readTileSize,
} from "./settings.ts";

test("defaults match the layout constants", () => {
  assert.equal(DEFAULT_LAYOUT.columns, 5);
  assert.equal(DEFAULT_LAYOUT.tileSize, 64);
  assert.equal(DEFAULT_LAYOUT.reverseOrder, false);
  assert.deepEqual(readLayout(null), DEFAULT_LAYOUT);
  assert.deepEqual(readLayout(undefined), DEFAULT_LAYOUT);
  assert.deepEqual(readLayout({}), DEFAULT_LAYOUT);
});

test("columns and tile size clamp to the allowed ranges", () => {
  assert.equal(clampColumns(LAYOUT_LIMITS.columns.min - 3), LAYOUT_LIMITS.columns.min);
  assert.equal(clampColumns(LAYOUT_LIMITS.columns.max + 3), LAYOUT_LIMITS.columns.max);
  assert.equal(clampColumns(4.6), 5);
  assert.equal(clampColumns(Number.NaN), DEFAULT_LAYOUT.columns);

  assert.equal(clampTileSize(LAYOUT_LIMITS.tileSize.min - 10), LAYOUT_LIMITS.tileSize.min);
  assert.equal(clampTileSize(LAYOUT_LIMITS.tileSize.max + 10), LAYOUT_LIMITS.tileSize.max);
  assert.equal(clampTileSize(71.4), 71);
  assert.equal(clampTileSize(Number.POSITIVE_INFINITY), DEFAULT_LAYOUT.tileSize);
});

test("parsers accept numbers and numeric strings", () => {
  assert.equal(readColumns(3), 3);
  assert.equal(readColumns("7"), 7);
  assert.equal(readColumns("  2 "), 2);
  assert.equal(readColumns("nope"), DEFAULT_LAYOUT.columns);
  assert.equal(readColumns(null), DEFAULT_LAYOUT.columns);

  assert.equal(readTileSize(80), 80);
  assert.equal(readTileSize("96"), 96);
  assert.equal(readTileSize(""), DEFAULT_LAYOUT.tileSize);
  assert.equal(readTileSize({}), DEFAULT_LAYOUT.tileSize);
});

test("readReverseOrder accepts booleans and common encodings", () => {
  assert.equal(readReverseOrder(true), true);
  assert.equal(readReverseOrder(false), false);
  assert.equal(readReverseOrder("true"), true);
  assert.equal(readReverseOrder("false"), false);
  assert.equal(readReverseOrder(1), true);
  assert.equal(readReverseOrder(0), false);
  assert.equal(readReverseOrder("1"), true);
  assert.equal(readReverseOrder("0"), false);
  assert.equal(readReverseOrder(null), false);
  assert.equal(readReverseOrder("maybe"), false);
});

test("readLayout pulls columns, tileSize, and reverseOrder from a settings object", () => {
  assert.deepEqual(readLayout({ columns: 3, tileSize: 48, openFolderId: "1" }), {
    columns: 3,
    tileSize: 48,
    reverseOrder: false,
  });
  assert.deepEqual(readLayout({ columns: 99, tileSize: 1, reverseOrder: true }), {
    columns: LAYOUT_LIMITS.columns.max,
    tileSize: LAYOUT_LIMITS.tileSize.min,
    reverseOrder: true,
  });
  assert.deepEqual(readLayout({ columns: "4", tileSize: "100", reverseOrder: "true" }), {
    columns: 4,
    tileSize: 100,
    reverseOrder: true,
  });
});
