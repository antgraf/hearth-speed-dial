import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FOLDER_DEEP_LINK_PARAM,
  folderDeepLinkHref,
  folderDeepLinkPath,
  parseFolderDeepLink,
} from "./folder-deeplink.ts";

test("parseFolderDeepLink reads the folder query param", () => {
  assert.equal(parseFolderDeepLink("?folder=12"), "12");
  assert.equal(parseFolderDeepLink("folder=12"), "12");
  assert.equal(parseFolderDeepLink("?folder=ab%2Fcd"), "ab/cd");
  assert.equal(parseFolderDeepLink(`?${FOLDER_DEEP_LINK_PARAM}=root`), "root");
});

test("parseFolderDeepLink ignores missing empty or whitespace ids", () => {
  assert.equal(parseFolderDeepLink(""), null);
  assert.equal(parseFolderDeepLink("?"), null);
  assert.equal(parseFolderDeepLink("?other=1"), null);
  assert.equal(parseFolderDeepLink("?folder="), null);
  assert.equal(parseFolderDeepLink("?folder=%20%20"), null);
  assert.equal(parseFolderDeepLink("#folder=12"), null);
});

test("parseFolderDeepLink prefers the folder query over unrelated params", () => {
  assert.equal(parseFolderDeepLink("?title=x&folder=10&url=https%3A%2F%2Fe.example%2F"), "10");
});

test("folderDeepLinkPath encodes the bookmark id", () => {
  assert.equal(folderDeepLinkPath("10"), "index.html?folder=10");
  assert.equal(folderDeepLinkPath("a b"), "index.html?folder=a%20b");
  assert.equal(folderDeepLinkPath("x&y"), "index.html?folder=x%26y");
});

test("folderDeepLinkHref uses runtime.getURL when provided", () => {
  assert.equal(
    folderDeepLinkHref("12", (path) => `chrome-extension://hearth-test/${path}`),
    "chrome-extension://hearth-test/index.html?folder=12",
  );
  assert.equal(
    folderDeepLinkHref("12", (path) => `moz-extension://uuid/${path}`),
    "moz-extension://uuid/index.html?folder=12",
  );
});

test("folderDeepLinkHref falls back to the relative path without getURL", () => {
  assert.equal(folderDeepLinkHref("12", null), "index.html?folder=12");
});

test("folderDeepLinkHref swallows getURL failures", () => {
  assert.equal(
    folderDeepLinkHref("12", () => {
      throw new Error("no runtime");
    }),
    "index.html?folder=12",
  );
});
