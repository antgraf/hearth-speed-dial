import assert from "node:assert/strict";
import { test } from "node:test";
import {
  acceptsChildren,
  bookmarkUrl,
  breadcrumb,
  childIndex,
  chromeIndexAtEnd,
  chromeIndexBefore,
  classify,
  dialItems,
  folderName,
  monogram,
  openableUrl,
  reorderMoveIndex,
  siteLabel,
  type BookmarkNode,
} from "./model.ts";

const tree: BookmarkNode[] = [
  {
    id: "0",
    title: "",
    children: [
      {
        id: "1",
        title: "Bookmarks bar",
        children: [
          {
            id: "10",
            title: "News",
            children: [
              { id: "11", title: "Example", url: "https://www.example.com/path" },
              { id: "12", title: "", url: "https://developer.mozilla.org/" },
              { id: "13", title: "Script", url: "javascript:alert(1)" },
            ],
          },
          { id: "14", title: "", children: undefined },
        ],
      },
      {
        id: "2",
        title: "Other bookmarks",
        children: [{ id: "20", title: "Hearth", children: [] }],
      },
    ],
  },
];

test("monogram uses the first character", () => {
  assert.equal(monogram("  news"), "N");
  assert.equal(monogram("über"), "Ü");
  assert.equal(monogram("   "), "·");
});

test("site and openable urls ignore a javascript bookmark", () => {
  assert.equal(siteLabel("https://www.example.com/path"), "example.com");
  assert.equal(openableUrl("https://www.example.com/path"), "https://www.example.com/path");
  assert.equal(openableUrl("javascript:alert(1)"), null);
  assert.equal(openableUrl("not a url"), null);
});

test("a typed address can omit the scheme", () => {
  assert.equal(bookmarkUrl("example.com/notes"), "https://example.com/notes");
  assert.equal(bookmarkUrl("https://example.com"), "https://example.com/");
  assert.equal(bookmarkUrl("javascript:alert(1)"), null);
  assert.equal(folderName("  News  "), "News");
  assert.equal(folderName("   "), null);
});

test("classify treats blank nodes without children as separators", () => {
  assert.equal(classify({ id: "a", title: "News", children: [] }), "folder");
  assert.equal(classify({ id: "b", title: "Example", url: "https://example.com" }), "link");
  assert.equal(classify({ id: "c", title: "" }), "skip");
});

test("the chrome root cannot take new children", () => {
  assert.equal(acceptsChildren({ id: "0", title: "", children: [] }), false);
  assert.equal(acceptsChildren({ id: "1", title: "Bookmarks bar", children: [] }), true);
});

test("dial items keep bookmark order and drop separators", () => {
  const news = tree[0]?.children?.[0]?.children?.[0];
  const items = dialItems(news);
  assert.deepEqual(
    items.map((item) => [item.kind, item.title, item.url, item.meta]),
    [
      ["link", "Example", "https://www.example.com/path", "example.com"],
      ["link", "developer.mozilla.org", "https://developer.mozilla.org/", "developer.mozilla.org"],
      ["link", "Script", null, "Unavailable link"],
    ],
  );
});

test("breadcrumb starts at the bookmark root", () => {
  assert.deepEqual(breadcrumb(tree, "0", "10"), [
    { id: "0", title: "Bookmarks" },
    { id: "1", title: "Bookmarks bar" },
    { id: "10", title: "News" },
  ]);
  assert.deepEqual(breadcrumb(tree, "0", "0"), [{ id: "0", title: "Bookmarks" }]);
});

test("chromeIndexBefore matches Chromium same-parent insert-before", () => {
  assert.equal(chromeIndexBefore(0, 2), 2);
  assert.equal(chromeIndexBefore(3, 1), 1);
  assert.equal(chromeIndexBefore(0, 1), null);
  assert.equal(chromeIndexBefore(2, 2), null);
  assert.equal(chromeIndexBefore(1, 3), 3);
  assert.equal(chromeIndexBefore(-1, 1), null);
});

test("chromeIndexAtEnd moves a non-last sibling to the end", () => {
  assert.equal(chromeIndexAtEnd(0, 4), 4);
  assert.equal(chromeIndexAtEnd(2, 4), 4);
  assert.equal(chromeIndexAtEnd(3, 4), null);
  assert.equal(chromeIndexAtEnd(0, 1), null);
});

test("reorderMoveIndex uses full sibling indices including separators", () => {
  const children: BookmarkNode[] = [
    { id: "a", title: "A", url: "https://a.example/" },
    { id: "sep", title: "" },
    { id: "b", title: "B", url: "https://b.example/" },
    { id: "c", title: "C", url: "https://c.example/" },
  ];
  assert.equal(childIndex(children, "b"), 2);
  assert.equal(reorderMoveIndex(children, "a", "b"), 2);
  assert.equal(reorderMoveIndex(children, "c", "a"), 0);
  assert.equal(reorderMoveIndex(children, "a", "a"), null);
  assert.equal(reorderMoveIndex(children, "b", "c"), null);
  assert.equal(reorderMoveIndex(children, "a", null), 4);
  assert.equal(reorderMoveIndex(children, "c", null), null);
  assert.equal(reorderMoveIndex(children, "missing", "b"), null);
});
