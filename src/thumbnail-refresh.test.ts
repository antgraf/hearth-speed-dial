import assert from "node:assert/strict";
import { test } from "node:test";
import {
  refreshThumbnailsBestEffort,
  thumbnailRefreshFailureSummary,
} from "./thumbnail-refresh.ts";

test("refreshThumbnailsBestEffort continues after a mid-queue capture failure", async () => {
  const calls: string[] = [];
  const progress: number[] = [];
  const results = await refreshThumbnailsBestEffort(
    [
      { id: "a", url: "https://a.example/" },
      { id: "b", url: "https://b.example/" },
      { id: "c", url: "https://c.example/" },
    ],
    async (id, url) => {
      calls.push(`${id}:${url}`);
      if (id === "b") {
        throw new Error('Cannot access contents of url "". Extension manifest must request permission to access this host.');
      }
    },
    (error) => (error instanceof Error ? error.message : "unknown"),
    () => progress.push(calls.length),
  );

  assert.deepEqual(calls, [
    "a:https://a.example/",
    "b:https://b.example/",
    "c:https://c.example/",
  ]);
  assert.deepEqual(progress, [1, 2, 3]);
  assert.deepEqual(results, [
    { id: "a", ok: true },
    {
      id: "b",
      ok: false,
      message:
        'Cannot access contents of url "". Extension manifest must request permission to access this host.',
    },
    { id: "c", ok: true },
  ]);
});

test("refreshThumbnailsBestEffort records every failure when all captures throw", async () => {
  const results = await refreshThumbnailsBestEffort(
    [
      { id: "1", url: "https://one.example/" },
      { id: "2", url: "https://two.example/" },
    ],
    async () => {
      throw new Error("capture blew up");
    },
    () => "normalized",
  );

  assert.deepEqual(results, [
    { id: "1", ok: false, message: "normalized" },
    { id: "2", ok: false, message: "normalized" },
  ]);
});

test("thumbnailRefreshFailureSummary is null when every capture succeeds", () => {
  assert.equal(
    thumbnailRefreshFailureSummary([
      { id: "a", ok: true },
      { id: "b", ok: true },
    ]),
    null,
  );
});

test("thumbnailRefreshFailureSummary counts failures and keeps the last detail", () => {
  assert.deepEqual(
    thumbnailRefreshFailureSummary([
      { id: "a", ok: true },
      { id: "b", ok: false, message: "first boom" },
      { id: "c", ok: false, message: "second boom" },
    ]),
    { failed: 2, total: 3, detail: "second boom" },
  );
});
