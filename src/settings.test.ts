import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bindRangeInput,
  clampColumns,
  clampThumbnailWaitSeconds,
  clampTileSize,
  DEFAULT_LAYOUT,
  LAYOUT_LIMITS,
  readColumns,
  readDefaultFolderId,
  readImageUrlFetchEnabled,
  readLayout,
  readOpenFolderId,
  readReverseOrder,
  readThumbnailWaitSeconds,
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
  assert.equal(DEFAULT_LAYOUT.thumbnailWaitSeconds, 45);
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

test("thumbnail wait clamps to 5–120 in steps of 5", () => {
  assert.equal(clampThumbnailWaitSeconds(3), 5);
  assert.equal(clampThumbnailWaitSeconds(200), 120);
  assert.equal(clampThumbnailWaitSeconds(47), 45);
  assert.equal(clampThumbnailWaitSeconds(48), 50);
  assert.equal(clampThumbnailWaitSeconds(Number.NaN), DEFAULT_LAYOUT.thumbnailWaitSeconds);
  assert.equal(readThumbnailWaitSeconds("60"), 60);
  assert.equal(readThumbnailWaitSeconds(null), 45);
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

test("readLayout pulls columns, tileSize, reverseOrder, wait, and opt-in flags", () => {
  assert.deepEqual(readLayout({ columns: 3, tileSize: 128, openFolderId: "1" }), {
    columns: 3,
    tileSize: 128,
    reverseOrder: false,
    thumbnailsEnabled: false,
    imageUrlFetchEnabled: false,
    thumbnailWaitSeconds: 45,
  });
  assert.deepEqual(
    readLayout({
      columns: 99,
      tileSize: 1,
      reverseOrder: true,
      thumbnailsEnabled: true,
      imageUrlFetchEnabled: true,
      thumbnailWaitSeconds: 90,
    }),
    {
      columns: LAYOUT_LIMITS.columns.max,
      tileSize: LAYOUT_LIMITS.tileSize.min,
      reverseOrder: true,
      thumbnailsEnabled: true,
      imageUrlFetchEnabled: true,
      thumbnailWaitSeconds: 90,
    },
  );
  assert.deepEqual(
    readLayout({
      columns: "4",
      tileSize: "200",
      reverseOrder: "true",
      thumbnailsEnabled: "1",
      imageUrlFetchEnabled: "1",
      thumbnailWaitSeconds: "30",
    }),
    {
      columns: 4,
      tileSize: 200,
      reverseOrder: true,
      thumbnailsEnabled: true,
      imageUrlFetchEnabled: true,
      thumbnailWaitSeconds: 30,
    },
  );
  // Legacy square-era values below the new floor clamp up.
  assert.equal(readTileSize(64), LAYOUT_LIMITS.tileSize.min);
  assert.equal(LAYOUT_LIMITS.tileSize.max, 576);
  assert.equal(readTileSize(576), 576);
  assert.equal(readTileSize(600), 576);
});

test("readDefaultFolderId is optional and separate from last-open", () => {
  assert.equal(readDefaultFolderId(null), null);
  assert.equal(readDefaultFolderId({}), null);
  assert.equal(readDefaultFolderId({ defaultFolderId: "" }), null);
  assert.equal(readDefaultFolderId({ defaultFolderId: "1" }), "1");
  assert.equal(readOpenFolderId({ openFolderId: "2", defaultFolderId: "1" }), "2");
  assert.equal(readOpenFolderId({ rootFolderId: "legacy" }), "legacy");
});

test("bindRangeInput sets min/max/step before value", () => {
  // jsdom-free: exercise the attribute/property order on a stub element.
  const order: string[] = [];
  type Stub = {
    type: string;
    _min: string;
    _max: string;
    _step: string;
    _value: string;
    min: string;
    max: string;
    step: string;
    value: string;
  };
  const stub: Stub = {
    type: "",
    _min: "",
    _max: "",
    _step: "",
    _value: "",
    get min() {
      return this._min;
    },
    set min(v: string) {
      order.push(`min:${v}`);
      this._min = v;
    },
    get max() {
      return this._max;
    },
    set max(v: string) {
      order.push(`max:${v}`);
      this._max = v;
    },
    get step() {
      return this._step;
    },
    set step(v: string) {
      order.push(`step:${v}`);
      this._step = v;
    },
    get value() {
      return this._value;
    },
    set value(v: string) {
      order.push(`value:${v}`);
      this._value = v;
    },
  };
  const input = stub as unknown as HTMLInputElement;

  bindRangeInput(input, { min: 96, max: 576, step: 1, value: 400 });
  assert.deepEqual(order, ["min:96", "max:576", "step:1", "value:400"]);
  assert.equal(input.type, "range");
  assert.equal(input.value, "400");
});
