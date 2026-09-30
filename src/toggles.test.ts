import assert from "node:assert/strict";
import { test } from "node:test";
import {
  imageUrlPermissionDeniedMessage,
  thumbnailPermissionDeniedMessage,
  type PermissionsApi,
} from "./permissions.ts";
import { DEFAULT_LAYOUT, type LayoutSettings } from "./settings.ts";
import { applyLayoutChange, revokeOptionalFeaturePermissions } from "./toggles.ts";

type FakePermissions = LayoutToggleFake & PermissionsApi;

type LayoutToggleFake = {
  requestThumbnailAccess: () => Promise<boolean>;
  removeThumbnailAccess: () => Promise<void>;
  hasThumbnailAccess: () => Promise<boolean>;
  requestImageUrlFetchAccess: () => Promise<boolean>;
  removeImageUrlFetchAccess: () => Promise<void>;
  hasImageUrlFetchAccess: () => Promise<boolean>;
  canFetchUrl: () => Promise<boolean>;
  requestFetchAccess: () => Promise<boolean>;
  calls: string[];
};

function fakePermissions(overrides: Partial<LayoutToggleFake> = {}): FakePermissions {
  const calls: string[] = [];
  const base: FakePermissions = {
    calls,
    async requestThumbnailAccess() {
      calls.push("requestThumbnailAccess");
      return true;
    },
    async removeThumbnailAccess() {
      calls.push("removeThumbnailAccess");
    },
    async hasThumbnailAccess() {
      calls.push("hasThumbnailAccess");
      return true;
    },
    async requestImageUrlFetchAccess() {
      calls.push("requestImageUrlFetchAccess");
      return true;
    },
    async removeImageUrlFetchAccess() {
      calls.push("removeImageUrlFetchAccess");
    },
    async hasImageUrlFetchAccess() {
      calls.push("hasImageUrlFetchAccess");
      return true;
    },
    async canFetchUrl() {
      return false;
    },
    async requestFetchAccess() {
      return false;
    },
  };
  return { ...base, ...overrides, calls };
}

function layout(partial: Partial<LayoutSettings> = {}): LayoutSettings {
  return { ...DEFAULT_LAYOUT, ...partial };
}

test("applyLayoutChange denies thumbnail enable and keeps URL-fetch active state", async () => {
  const permissions = fakePermissions({
    async requestThumbnailAccess() {
      permissions.calls.push("requestThumbnailAccess");
      return false;
    },
    async hasImageUrlFetchAccess() {
      permissions.calls.push("hasImageUrlFetchAccess");
      return true;
    },
  });
  const result = await applyLayoutChange(
    layout({ imageUrlFetchEnabled: true }),
    layout({ thumbnailsEnabled: true, imageUrlFetchEnabled: true }),
    permissions,
  );
  assert.equal(result.next.thumbnailsEnabled, false);
  assert.equal(result.next.imageUrlFetchEnabled, true);
  assert.equal(result.earlyDenial, true);
  assert.equal(result.thumbnailsActive, false);
  assert.equal(result.imageUrlFetchActive, true);
  assert.equal(result.error, thumbnailPermissionDeniedMessage());
  assert.deepEqual(permissions.calls, ["requestThumbnailAccess", "hasImageUrlFetchAccess"]);
});

test("applyLayoutChange re-owns URL-fetch before dropping thumbnail grants", async () => {
  const permissions = fakePermissions();
  const result = await applyLayoutChange(
    layout({ thumbnailsEnabled: true, imageUrlFetchEnabled: true }),
    layout({ thumbnailsEnabled: false, imageUrlFetchEnabled: true }),
    permissions,
  );
  assert.equal(result.next.thumbnailsEnabled, false);
  assert.equal(result.next.imageUrlFetchEnabled, true);
  assert.equal(result.earlyDenial, false);
  assert.equal(result.imageUrlFetchActive, true);
  assert.deepEqual(permissions.calls, [
    "requestImageUrlFetchAccess",
    "removeThumbnailAccess",
    "hasImageUrlFetchAccess",
  ]);
});

test("applyLayoutChange turns URL-fetch off without touching thumbnail grants", async () => {
  const permissions = fakePermissions({
    async hasThumbnailAccess() {
      permissions.calls.push("hasThumbnailAccess");
      return true;
    },
  });
  const result = await applyLayoutChange(
    layout({ thumbnailsEnabled: true, imageUrlFetchEnabled: true }),
    layout({ thumbnailsEnabled: true, imageUrlFetchEnabled: false }),
    permissions,
  );
  assert.equal(result.next.imageUrlFetchEnabled, false);
  assert.equal(result.thumbnailsActive, true);
  assert.deepEqual(permissions.calls, ["hasThumbnailAccess", "removeImageUrlFetchAccess"]);
});

test("applyLayoutChange demotes revoked thumbnails without a URL denial banner", async () => {
  const permissions = fakePermissions({
    async hasThumbnailAccess() {
      permissions.calls.push("hasThumbnailAccess");
      return false;
    },
    async hasImageUrlFetchAccess() {
      permissions.calls.push("hasImageUrlFetchAccess");
      return true;
    },
  });
  const result = await applyLayoutChange(
    layout({ thumbnailsEnabled: true, imageUrlFetchEnabled: true }),
    layout({ thumbnailsEnabled: true, imageUrlFetchEnabled: true }),
    permissions,
  );
  assert.equal(result.next.thumbnailsEnabled, false);
  assert.equal(result.next.imageUrlFetchEnabled, true);
  assert.equal(result.error, thumbnailPermissionDeniedMessage());
  assert.notEqual(result.error, imageUrlPermissionDeniedMessage());
  assert.equal(result.imageUrlFetchActive, true);
});

test("revokeOptionalFeaturePermissions only removes grants that were on", async () => {
  const permissions = fakePermissions();
  await revokeOptionalFeaturePermissions(
    layout({ thumbnailsEnabled: true, imageUrlFetchEnabled: false }),
    permissions,
  );
  assert.deepEqual(permissions.calls, ["removeThumbnailAccess"]);
});
