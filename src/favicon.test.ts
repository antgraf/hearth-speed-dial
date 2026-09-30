import assert from "node:assert/strict";
import { test } from "node:test";
import {
  TITLE_FAVICON_SIZE,
  buildFaviconSrc,
  chromeFaviconSrc,
  faviconEligibleUrl,
} from "./favicon.ts";

test("faviconEligibleUrl accepts only http(s) openable URLs", () => {
  assert.equal(faviconEligibleUrl("https://example.com/path"), "https://example.com/path");
  assert.equal(faviconEligibleUrl("http://localhost:3000/"), "http://localhost:3000/");
  assert.equal(faviconEligibleUrl("file:///tmp/x.html"), null);
  assert.equal(faviconEligibleUrl("chrome://settings"), null);
  assert.equal(faviconEligibleUrl("not-a-url"), null);
});

test("buildFaviconSrc builds a Chrome _favicon URL with pageUrl and size", () => {
  const src = buildFaviconSrc(
    "https://example.com/docs",
    "chrome-extension://abc123/_favicon/",
    32,
  );
  assert.ok(src);
  const parsed = new URL(src!);
  assert.equal(parsed.protocol, "chrome-extension:");
  assert.equal(parsed.hostname, "abc123");
  assert.equal(parsed.pathname, "/_favicon/");
  assert.equal(parsed.searchParams.get("pageUrl"), "https://example.com/docs");
  assert.equal(parsed.searchParams.get("size"), "32");
});

test("buildFaviconSrc defaults size and rejects non-http(s)", () => {
  const src = buildFaviconSrc("https://news.example/", "chrome-extension://id/_favicon/");
  assert.equal(new URL(src!).searchParams.get("size"), String(TITLE_FAVICON_SIZE));
  assert.equal(buildFaviconSrc("file:///tmp/a.html", "chrome-extension://id/_favicon/"), null);
  assert.equal(buildFaviconSrc("https://x.test/", "not a url"), null);
});

test("chromeFaviconSrc uses runtime.getURL and degrades without runtime", () => {
  assert.equal(chromeFaviconSrc("https://example.com/", null), null);
  const src = chromeFaviconSrc("https://example.com/a", {
    getURL(path) {
      assert.equal(path, "/_favicon/");
      return "chrome-extension://extid/_favicon/";
    },
  });
  assert.equal(
    src,
    "chrome-extension://extid/_favicon/?pageUrl=https%3A%2F%2Fexample.com%2Fa&size=16",
  );
});

test("chromeFaviconSrc swallows getURL failures", () => {
  assert.equal(
    chromeFaviconSrc("https://example.com/", {
      getURL() {
        throw new Error("no extension context");
      },
    }),
    null,
  );
});
