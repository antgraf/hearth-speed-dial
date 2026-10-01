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
  requestThumbnailAndImageUrlFetchAccess: () => Promise<boolean>;
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
    async requestThumbnailAndImageUrlFetchAccess() {
      calls.push("requestThumbnailAndImageUrlFetchAccess");
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
  return {
    ...DEFAULT_LAYOUT,
    ...partial,
    theme: { ...DEFAULT_LAYOUT.theme, ...(partial.theme ?? {}) },
  };
}

test("applyLayoutChange table: permission toggle state machine", async () => {
  type Case = {
    name: string;
    previous: Partial<LayoutSettings>;
    requested: Partial<LayoutSettings>;
    answers?: {
      requestThumbnailAccess?: boolean;
      requestThumbnailAndImageUrlFetchAccess?: boolean;
      requestImageUrlFetchAccess?: boolean;
      hasThumbnailAccess?: boolean;
      hasImageUrlFetchAccess?: boolean;
    };
    expect: {
      thumbnailsEnabled?: boolean;
      imageUrlFetchEnabled?: boolean;
      earlyDenial?: boolean;
      thumbnailsActive?: boolean;
      imageUrlFetchActive?: boolean;
      error?: string | null;
      calls: string[];
    };
  };

  const cases: Case[] = [
    {
      name: "deny thumbnail enable stays off",
      previous: { imageUrlFetchEnabled: true },
      requested: { thumbnailsEnabled: true, imageUrlFetchEnabled: true },
      answers: { requestThumbnailAccess: false, hasImageUrlFetchAccess: true },
      expect: {
        thumbnailsEnabled: false,
        imageUrlFetchEnabled: true,
        earlyDenial: true,
        thumbnailsActive: false,
        imageUrlFetchActive: true,
        error: thumbnailPermissionDeniedMessage(),
        calls: ["requestThumbnailAccess", "hasImageUrlFetchAccess"],
      },
    },
    {
      name: "grant thumbnail enable becomes active",
      previous: {},
      requested: { thumbnailsEnabled: true },
      answers: { requestThumbnailAccess: true },
      expect: {
        thumbnailsEnabled: true,
        earlyDenial: false,
        thumbnailsActive: true,
        error: null,
        calls: ["requestThumbnailAccess"],
      },
    },
    {
      name: "thumbnails off while URL-fetch on re-owns before revoke",
      previous: { thumbnailsEnabled: true, imageUrlFetchEnabled: true },
      requested: { thumbnailsEnabled: false, imageUrlFetchEnabled: true },
      expect: {
        thumbnailsEnabled: false,
        imageUrlFetchEnabled: true,
        earlyDenial: false,
        imageUrlFetchActive: true,
        calls: ["requestImageUrlFetchAccess", "removeThumbnailAccess", "hasImageUrlFetchAccess"],
      },
    },
    {
      name: "URL-fetch off leaves thumbnail grants alone",
      previous: { thumbnailsEnabled: true, imageUrlFetchEnabled: true },
      requested: { thumbnailsEnabled: true, imageUrlFetchEnabled: false },
      answers: { hasThumbnailAccess: true },
      expect: {
        imageUrlFetchEnabled: false,
        thumbnailsActive: true,
        calls: ["hasThumbnailAccess", "removeImageUrlFetchAccess"],
      },
    },
    {
      name: "revoked thumbnails demote without URL denial banner",
      previous: { thumbnailsEnabled: true, imageUrlFetchEnabled: true },
      requested: { thumbnailsEnabled: true, imageUrlFetchEnabled: true },
      answers: { hasThumbnailAccess: false, hasImageUrlFetchAccess: true },
      expect: {
        thumbnailsEnabled: false,
        imageUrlFetchEnabled: true,
        error: thumbnailPermissionDeniedMessage(),
        imageUrlFetchActive: true,
        calls: ["hasThumbnailAccess", "hasImageUrlFetchAccess"],
      },
    },
    {
      name: "deny URL-fetch enable stays off",
      previous: {},
      requested: { imageUrlFetchEnabled: true },
      answers: { requestImageUrlFetchAccess: false },
      expect: {
        imageUrlFetchEnabled: false,
        earlyDenial: true,
        imageUrlFetchActive: false,
        error: imageUrlPermissionDeniedMessage(),
        calls: ["requestImageUrlFetchAccess"],
      },
    },
    {
      name: "grant URL-fetch enable becomes active",
      previous: {},
      requested: { imageUrlFetchEnabled: true },
      answers: { requestImageUrlFetchAccess: true },
      expect: {
        imageUrlFetchEnabled: true,
        earlyDenial: false,
        imageUrlFetchActive: true,
        error: null,
        calls: ["requestImageUrlFetchAccess"],
      },
    },
    {
      name: "URL enable while thumbnails stay on requests before hasThumbnailAccess",
      previous: { thumbnailsEnabled: true },
      requested: { thumbnailsEnabled: true, imageUrlFetchEnabled: true },
      answers: { requestImageUrlFetchAccess: true, hasThumbnailAccess: true },
      expect: {
        imageUrlFetchEnabled: true,
        thumbnailsEnabled: true,
        earlyDenial: false,
        imageUrlFetchActive: true,
        thumbnailsActive: true,
        error: null,
        // request() must precede any contains/has* await (Firefox user-gesture).
        calls: ["requestImageUrlFetchAccess", "hasThumbnailAccess"],
      },
    },
    {
      name: "both toggles enable in one gesture use combined request",
      previous: {},
      requested: { thumbnailsEnabled: true, imageUrlFetchEnabled: true },
      answers: { requestThumbnailAndImageUrlFetchAccess: true },
      expect: {
        thumbnailsEnabled: true,
        imageUrlFetchEnabled: true,
        earlyDenial: false,
        thumbnailsActive: true,
        imageUrlFetchActive: true,
        error: null,
        calls: ["requestThumbnailAndImageUrlFetchAccess"],
      },
    },
    {
      name: "combined both-enable deny clears both toggles",
      previous: {},
      requested: { thumbnailsEnabled: true, imageUrlFetchEnabled: true },
      answers: { requestThumbnailAndImageUrlFetchAccess: false },
      expect: {
        thumbnailsEnabled: false,
        imageUrlFetchEnabled: false,
        earlyDenial: true,
        thumbnailsActive: false,
        imageUrlFetchActive: false,
        error: thumbnailPermissionDeniedMessage(),
        calls: ["requestThumbnailAndImageUrlFetchAccess"],
      },
    },
  ];

  for (const entry of cases) {
    const permissions = fakePermissions({
      async requestThumbnailAccess() {
        permissions.calls.push("requestThumbnailAccess");
        return entry.answers?.requestThumbnailAccess ?? true;
      },
      async requestThumbnailAndImageUrlFetchAccess() {
        permissions.calls.push("requestThumbnailAndImageUrlFetchAccess");
        return entry.answers?.requestThumbnailAndImageUrlFetchAccess ?? true;
      },
      async removeThumbnailAccess() {
        permissions.calls.push("removeThumbnailAccess");
      },
      async hasThumbnailAccess() {
        permissions.calls.push("hasThumbnailAccess");
        return entry.answers?.hasThumbnailAccess ?? true;
      },
      async requestImageUrlFetchAccess() {
        permissions.calls.push("requestImageUrlFetchAccess");
        return entry.answers?.requestImageUrlFetchAccess ?? true;
      },
      async removeImageUrlFetchAccess() {
        permissions.calls.push("removeImageUrlFetchAccess");
      },
      async hasImageUrlFetchAccess() {
        permissions.calls.push("hasImageUrlFetchAccess");
        return entry.answers?.hasImageUrlFetchAccess ?? true;
      },
    });

    const result = await applyLayoutChange(
      layout(entry.previous),
      layout({ ...entry.previous, ...entry.requested }),
      permissions,
    );

    if (entry.expect.thumbnailsEnabled !== undefined) {
      assert.equal(result.next.thumbnailsEnabled, entry.expect.thumbnailsEnabled, entry.name);
    }
    if (entry.expect.imageUrlFetchEnabled !== undefined) {
      assert.equal(result.next.imageUrlFetchEnabled, entry.expect.imageUrlFetchEnabled, entry.name);
    }
    if (entry.expect.earlyDenial !== undefined) {
      assert.equal(result.earlyDenial, entry.expect.earlyDenial, entry.name);
    }
    if (entry.expect.thumbnailsActive !== undefined) {
      assert.equal(result.thumbnailsActive, entry.expect.thumbnailsActive, entry.name);
    }
    if (entry.expect.imageUrlFetchActive !== undefined) {
      assert.equal(result.imageUrlFetchActive, entry.expect.imageUrlFetchActive, entry.name);
    }
    if (entry.expect.error !== undefined) {
      assert.equal(result.error, entry.expect.error, entry.name);
    }
    if (entry.expect.error === thumbnailPermissionDeniedMessage()) {
      assert.notEqual(result.error, imageUrlPermissionDeniedMessage(), entry.name);
    }
    assert.deepEqual(permissions.calls, entry.expect.calls, entry.name);
  }
});

test("revokeOptionalFeaturePermissions only removes grants that were on", async () => {
  const onlyThumbnails = fakePermissions();
  await revokeOptionalFeaturePermissions(
    layout({ thumbnailsEnabled: true, imageUrlFetchEnabled: false }),
    onlyThumbnails,
  );
  assert.deepEqual(onlyThumbnails.calls, ["removeThumbnailAccess"]);

  const onlyUrl = fakePermissions();
  await revokeOptionalFeaturePermissions(
    layout({ thumbnailsEnabled: false, imageUrlFetchEnabled: true }),
    onlyUrl,
  );
  assert.deepEqual(onlyUrl.calls, ["removeImageUrlFetchAccess"]);

  const both = fakePermissions();
  await revokeOptionalFeaturePermissions(
    layout({ thumbnailsEnabled: true, imageUrlFetchEnabled: true }),
    both,
  );
  assert.deepEqual(both.calls, ["removeImageUrlFetchAccess", "removeThumbnailAccess"]);

  const neither = fakePermissions();
  await revokeOptionalFeaturePermissions(layout(), neither);
  assert.deepEqual(neither.calls, []);
});
