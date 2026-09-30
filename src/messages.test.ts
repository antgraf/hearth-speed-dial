import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isRefreshAllThumbnailsMessage,
  REFRESH_ALL_THUMBNAILS_MESSAGE,
  refreshAllThumbnailsMessage,
} from "./messages.ts";

test("refresh-all message helper stays stable for the service worker", () => {
  assert.equal(REFRESH_ALL_THUMBNAILS_MESSAGE, "hearth.refreshAllThumbnails");
  assert.deepEqual(refreshAllThumbnailsMessage(), { type: REFRESH_ALL_THUMBNAILS_MESSAGE });
  assert.equal(isRefreshAllThumbnailsMessage(refreshAllThumbnailsMessage()), true);
  assert.equal(isRefreshAllThumbnailsMessage({ type: "other" }), false);
  assert.equal(isRefreshAllThumbnailsMessage(null), false);
});
