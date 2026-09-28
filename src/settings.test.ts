import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clampColumns,
  clampTileSize,
  DEFAULT_LAYOUT,
  LAYOUT_LIMITS,
  readColumns,
  readImageUrlFetchEnabled,
  readLayout,
  readReverseOrder,
  readThumbnailsEnabled,
  readTileSize,
  TILE_ASPECT,
} from "./settings.ts";

test("defaults match the layout constants", () => {
  assert.equal(DEFAULT_LAYOUT.columns, 5);
  assert.equal(DEFAULT_LAYOUT.tileSize, 176);
  assert.equal(DEFAULT_LAYOUT.reverseOrder, false);
  assert.equal(DEFAULT_LAYOUT.thumbnailsEnabled, false);
  assert.equal(DEFAULT_LAYOUT.imageUrlFetchEnabled, false);
  assert.equal(TILE_ASPECT, 16 / 9);
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
  assert.equal(clampTileSize(171.4), 171);
  assert.equal(clampTileSize(Number.POSITIVE_INFINITY), DEFAULT_LAYOUT.tileSize);
});

test("parsers accept numbers and numeric strings", () => {
  assert.equal(readColumns(3), 3);
  assert.equal(readColumns("7"), 7);
  assert.equal(readColumns("  2 "), 2);
  assert.equal(readColumns("nope"), DEFAULT_LAYOUT.columns);
  assert.equal(readColumns(null), DEFAULT_LAYOUT.columns);

  assert.equal(readTileSize(160), 160);
  assert.equal(readTileSize("200"), 200);
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

test("readThumbnailsEnabled defaults off and accepts common encodings", () => {
  assert.equal(readThumbnailsEnabled(true), true);
  assert.equal(readThumbnailsEnabled(false), false);
  assert.equal(readThumbnailsEnabled("true"), true);
  assert.equal(readThumbnailsEnabled("false"), false);
  assert.equal(readThumbnailsEnabled(1), true);
  assert.equal(readThumbnailsEnabled(0), false);
  assert.equal(readThumbnailsEnabled(null), false);
  assert.equal(readThumbnailsEnabled("maybe"), false);
});

test("readImageUrlFetchEnabled defaults off and accepts common encodings", () => {
  assert.equal(readImageUrlFetchEnabled(true), true);
  assert.equal(readImageUrlFetchEnabled(false), false);
  assert.equal(readImageUrlFetchEnabled("true"), true);
  assert.equal(readImageUrlFetchEnabled("false"), false);
  assert.equal(readImageUrlFetchEnabled(1), true);
  assert.equal(readImageUrlFetchEnabled(0), false);
  assert.equal(readImageUrlFetchEnabled(null), false);
  assert.equal(readImageUrlFetchEnabled("maybe"), false);
});

test("readLayout pulls columns, tileSize, reverseOrder, and opt-in flags", () => {
  assert.deepEqual(readLayout({ columns: 3, tileSize: 128, openFolderId: "1" }), {
    columns: 3,
    tileSize: 128,
    reverseOrder: false,
    thumbnailsEnabled: false,
    imageUrlFetchEnabled: false,
  });
  assert.deepEqual(
    readLayout({
      columns: 99,
      tileSize: 1,
      reverseOrder: true,
      thumbnailsEnabled: true,
      imageUrlFetchEnabled: true,
    }),
    {
      columns: LAYOUT_LIMITS.columns.max,
      tileSize: LAYOUT_LIMITS.tileSize.min,
      reverseOrder: true,
      thumbnailsEnabled: true,
      imageUrlFetchEnabled: true,
    },
  );
  assert.deepEqual(
    readLayout({
      columns: "4",
      tileSize: "200",
      reverseOrder: "true",
      thumbnailsEnabled: "1",
      imageUrlFetchEnabled: "1",
    }),
    {
      columns: 4,
      tileSize: 200,
      reverseOrder: true,
      thumbnailsEnabled: true,
      imageUrlFetchEnabled: true,
    },
  );
  // Legacy square-era values below the new floor clamp up.
  assert.equal(readTileSize(64), LAYOUT_LIMITS.tileSize.min);
  assert.equal(LAYOUT_LIMITS.tileSize.max, 576);
  assert.equal(readTileSize(576), 576);
  assert.equal(readTileSize(600), 576);
});
