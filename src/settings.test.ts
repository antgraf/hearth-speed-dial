import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clampColumns,
  clampTileSize,
  DEFAULT_LAYOUT,
  LAYOUT_LIMITS,
  readColumns,
  readLayout,
  readTileSize,
} from "./settings.ts";

test("defaults match the layout constants", () => {
  assert.equal(DEFAULT_LAYOUT.columns, 5);
  assert.equal(DEFAULT_LAYOUT.tileSize, 64);
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

test("readLayout pulls columns and tileSize from a settings object", () => {
  assert.deepEqual(readLayout({ columns: 3, tileSize: 48, openFolderId: "1" }), {
    columns: 3,
    tileSize: 48,
  });
  assert.deepEqual(readLayout({ columns: 99, tileSize: 1 }), {
    columns: LAYOUT_LIMITS.columns.max,
    tileSize: LAYOUT_LIMITS.tileSize.min,
  });
  assert.deepEqual(readLayout({ columns: "4", tileSize: "100" }), {
    columns: 4,
    tileSize: 100,
  });
});
