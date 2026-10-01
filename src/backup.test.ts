import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupFilename,
  bookmarkIdsByUrl,
  bookmarkUrlsById,
  buildBackup,
  parseBackup,
  planBackupApply,
  readBackup,
  serializeBackup,
  importInvalidMessage,
} from "./backup.ts";
import { DEFAULT_LAYOUT } from "./settings.ts";
import { DEFAULT_THEME } from "./theme.ts";
import type { BookmarkNode } from "./model.ts";

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const TINY_JPEG =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z";

describe("backup format", () => {
  test("buildBackup serializes layout, wallpaper, and dial images with URL hints", () => {
    const backup = buildBackup({
      layout: {
        ...DEFAULT_LAYOUT,
        columns: 4,
        reverseOrder: true,
        theme: { ...DEFAULT_THEME, mode: "dark", accent: "brass" },
      },
      defaultFolderId: "folder-1",
      openFolderId: "folder-2",
      themeBackground: TINY_PNG,
      images: { "10": TINY_PNG, "20": TINY_JPEG },
      imageUrls: { "10": "https://example.com/", "20": "https://other.test/x" },
      now: new Date("2026-10-01T12:00:00.000Z"),
    });

    assert.equal(backup.format, BACKUP_FORMAT);
    assert.equal(backup.version, BACKUP_VERSION);
    assert.equal(backup.exportedAt, "2026-10-01T12:00:00.000Z");
    assert.equal(backup.settings.columns, 4);
    assert.equal(backup.settings.reverseOrder, true);
    assert.equal(backup.settings.defaultFolderId, "folder-1");
    assert.equal(backup.settings.openFolderId, "folder-2");
    assert.equal(backup.settings.theme.mode, "dark");
    assert.equal(backup.settings.theme.accent, "brass");
    assert.equal(backup.themeBackground, TINY_PNG);
    assert.equal(backup.images.length, 2);
    assert.deepEqual(backup.images[0], {
      bookmarkId: "10",
      dataUrl: TINY_PNG,
      url: "https://example.com/",
    });
    assert.equal(backup.images[1]?.bookmarkId, "20");
    assert.equal(backup.images[1]?.url, "https://other.test/x");
  });

  test("buildBackup skips invalid image payloads and empty ids", () => {
    const backup = buildBackup({
      layout: { ...DEFAULT_LAYOUT },
      defaultFolderId: null,
      openFolderId: null,
      themeBackground: "not-an-image",
      images: {
        "": TINY_PNG,
        ok: TINY_PNG,
        bad: "data:text/plain;base64,YQ==",
      },
    });
    assert.equal(backup.themeBackground, null);
    assert.deepEqual(backup.images, [{ bookmarkId: "ok", dataUrl: TINY_PNG }]);
  });

  test("serializeBackup round-trips through parseBackup", () => {
    const original = buildBackup({
      layout: { ...DEFAULT_LAYOUT, tileSize: 200 },
      defaultFolderId: null,
      openFolderId: "1",
      themeBackground: null,
      images: { a: TINY_PNG },
      now: new Date("2026-01-15T00:00:00.000Z"),
    });
    const text = serializeBackup(original);
    const parsed = parseBackup(text);
    assert.deepEqual(parsed, original);
  });

  test("readBackup accepts object-map images form", () => {
    const backup = readBackup({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: "2026-01-01T00:00:00.000Z",
      settings: {
        columns: 3,
        tileSize: 160,
        reverseOrder: false,
        thumbnailsEnabled: true,
        imageUrlFetchEnabled: false,
        thumbnailWaitSeconds: 5,
        defaultFolderId: null,
        openFolderId: null,
        theme: { ...DEFAULT_THEME },
      },
      themeBackground: null,
      images: { "99": TINY_PNG },
    });
    assert.deepEqual(backup.images, [{ bookmarkId: "99", dataUrl: TINY_PNG }]);
    assert.equal(backup.settings.thumbnailWaitSeconds, 5);
    assert.equal(backup.settings.thumbnailsEnabled, true);
  });

  test("parseBackup rejects garbage and wrong format", () => {
    assert.throws(() => parseBackup("{"), (err: Error) => err.message === importInvalidMessage());
    assert.throws(
      () => parseBackup(JSON.stringify({ format: "other", version: 1 })),
      (err: Error) => err.message === importInvalidMessage(),
    );
    assert.throws(
      () =>
        parseBackup(
          JSON.stringify({
            format: BACKUP_FORMAT,
            version: 99,
            settings: {},
            themeBackground: null,
            images: [],
          }),
        ),
      (err: Error) => /Unsupported backup version/.test(err.message),
    );
  });

  test("backupFilename uses calendar date", () => {
    assert.equal(backupFilename(new Date("2026-10-01T15:00:00Z")), "hearth-speed-dial-backup-2026-10-01.json");
  });
});

describe("backup apply planning", () => {
  const sample = buildBackup({
    layout: {
      ...DEFAULT_LAYOUT,
      columns: 6,
      thumbnailsEnabled: true,
      theme: { ...DEFAULT_THEME, mode: "light" },
    },
    defaultFolderId: "def",
    openFolderId: "open",
    themeBackground: TINY_JPEG,
    images: {
      oldA: TINY_PNG,
      oldB: TINY_JPEG,
    },
    imageUrls: {
      oldA: "https://a.example/",
      oldB: "https://b.example/",
    },
  });

  test("overwrite replaces wallpaper and clears images first", () => {
    const plan = planBackupApply(sample, "overwrite");
    assert.equal(plan.clearAllImages, true);
    assert.equal(plan.themeBackground, TINY_JPEG);
    assert.equal(plan.layout.columns, 6);
    assert.equal(plan.defaultFolderId, "def");
    assert.equal(plan.openFolderId, "open");
    assert.deepEqual(plan.imagesToSet, { oldA: TINY_PNG, oldB: TINY_JPEG });
  });

  test("merge keeps existing wallpaper when backup has none", () => {
    const noWallpaper = { ...sample, themeBackground: null };
    const plan = planBackupApply(noWallpaper, "merge");
    assert.equal(plan.clearAllImages, false);
    assert.equal(plan.themeBackground, undefined);
    assert.deepEqual(plan.imagesToSet, { oldA: TINY_PNG, oldB: TINY_JPEG });
  });

  test("rematch dial pictures by URL when bookmark ids differ", () => {
    const plan = planBackupApply(sample, "merge", {
      existingIds: new Set(["newA", "newB", "folder"]),
      urlToId: new Map([
        ["https://a.example/", "newA"],
        ["https://b.example/", "newB"],
      ]),
    });
    assert.deepEqual(plan.imagesToSet, { newA: TINY_PNG, newB: TINY_JPEG });
  });

  test("skips pictures that cannot rematch when existingIds is provided", () => {
    const plan = planBackupApply(sample, "overwrite", {
      existingIds: new Set(["unrelated"]),
      urlToId: new Map(),
    });
    assert.deepEqual(plan.imagesToSet, {});
  });
});

describe("bookmark URL indexes for rematch", () => {
  const tree: BookmarkNode[] = [
    {
      id: "0",
      title: "root",
      children: [
        { id: "1", title: "Alpha", url: "https://a.example/" },
        { id: "2", title: "Folder", children: [{ id: "3", title: "Beta", url: "https://b.example/" }] },
        { id: "4", title: "Dup", url: "https://a.example/" },
      ],
    },
  ];

  test("bookmarkUrlsById indexes link dials only", () => {
    assert.deepEqual(bookmarkUrlsById(tree), {
      "1": "https://a.example/",
      "3": "https://b.example/",
      "4": "https://a.example/",
    });
  });

  test("bookmarkIdsByUrl keeps first id per URL", () => {
    const map = bookmarkIdsByUrl(tree);
    assert.equal(map.get("https://a.example/"), "1");
    assert.equal(map.get("https://b.example/"), "3");
  });
});
