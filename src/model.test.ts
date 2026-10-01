import assert from "node:assert/strict";
import { test } from "node:test";
import {
  acceptsChildren,
  addPageQuery,
  bookmarkUrl,
  breadcrumb,
  childIndex,
  alreadyInFolder,
  chromeBeforeIdFromDisplayDrop,
  chromeIndexAtEnd,
  chromeIndexBefore,
  classify,
  folderDropZone,
  dialFolderOptions,
  dialFolderTree,
  dialOpenFolderOptions,
  flattenFolderTree,
  dialItems,
  folderName,
  isUnderAncestor,
  monogram,
  moveIntoFolderError,
  openableUrl,
  orderDialItems,
  parentIds,
  parseAddPageFields,
  refreshableThumbnailTargets,
  reorderMoveIndex,
  searchDialSubtree,
  dialMatchesQuery,
  normalizeDialQuery,
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
  assert.equal(siteLabel("not a url"), "");
  assert.equal(siteLabel(""), "");
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

test("refreshable thumbnail targets are direct http(s) children only", () => {
  const news = tree[0]?.children?.[0]?.children?.[0];
  const bar = tree[0]?.children?.[0];
  assert.deepEqual(refreshableThumbnailTargets(news), [
    { id: "11", url: "https://www.example.com/path" },
    { id: "12", url: "https://developer.mozilla.org/" },
  ]);
  // Nested folder contents are not included when refreshing the parent folder.
  assert.deepEqual(refreshableThumbnailTargets(bar), []);
  assert.deepEqual(refreshableThumbnailTargets(undefined), []);
  assert.deepEqual(
    refreshableThumbnailTargets({
      id: "mixed",
      title: "Mixed",
      children: [
        { id: "a", title: "Ok", url: "http://example.com/" },
        { id: "b", title: "Nested", children: [{ id: "c", title: "Deep", url: "https://deep.example/" }] },
        { id: "d", title: "Local", url: "file:///tmp/x.html" },
        { id: "e", title: "Bad", url: "javascript:void(0)" },
      ],
    }),
    [{ id: "a", url: "http://example.com/" }],
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

test("breadcrumb falls back to the root when the current folder is stale", () => {
  assert.deepEqual(breadcrumb(tree, "0", "missing"), [{ id: "0", title: "Bookmarks" }]);
  assert.deepEqual(breadcrumb(tree, "0", "11"), [{ id: "0", title: "Bookmarks" }]);
  assert.deepEqual(breadcrumb(tree, "missing-root", "10"), []);
});

test("folderDropZone uses edge thirds for reorder and center for into", () => {
  const wide = { left: 100, width: 90 };
  // edge = min(28, 30) = 28
  assert.equal(folderDropZone(100, wide), "before");
  assert.equal(folderDropZone(100 + 27, wide), "before");
  assert.equal(folderDropZone(100 + 28, wide), "into");
  assert.equal(folderDropZone(100 + 45, wide), "into");
  assert.equal(folderDropZone(100 + 62, wide), "into");
  assert.equal(folderDropZone(100 + 63, wide), "after");
  assert.equal(folderDropZone(100 + 89, wide), "after");

  const narrow = { left: 0, width: 60 };
  // edge = min(28, 20) = 20
  assert.equal(folderDropZone(0, narrow), "before");
  assert.equal(folderDropZone(19, narrow), "before");
  assert.equal(folderDropZone(20, narrow), "into");
  assert.equal(folderDropZone(40, narrow), "into");
  assert.equal(folderDropZone(41, narrow), "after");
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

test("orderDialItems reverses only for display", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(
    orderDialItems(items, false).map((item) => item.id),
    ["a", "b", "c"],
  );
  assert.deepEqual(
    orderDialItems(items, true).map((item) => item.id),
    ["c", "b", "a"],
  );
  assert.deepEqual(
    items.map((item) => item.id),
    ["a", "b", "c"],
  );
});

test("chromeBeforeIdFromDisplayDrop maps visual drops to Chrome beforeId", () => {
  const natural = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.equal(chromeBeforeIdFromDisplayDrop("b", false, natural, false), "b");
  assert.equal(chromeBeforeIdFromDisplayDrop("b", true, natural, false), "c");
  assert.equal(chromeBeforeIdFromDisplayDrop("c", true, natural, false), null);

  const reversed = [{ id: "c" }, { id: "b" }, { id: "a" }];
  // Visual before B (between C and B) ⇒ Chrome after B ⇒ before C
  assert.equal(chromeBeforeIdFromDisplayDrop("b", false, reversed, true), "c");
  // Visual after B (between B and A) ⇒ Chrome before B
  assert.equal(chromeBeforeIdFromDisplayDrop("b", true, reversed, true), "b");
  // Visual before first (C) ⇒ end of Chrome order
  assert.equal(chromeBeforeIdFromDisplayDrop("c", false, reversed, true), null);
  // Visual after last (A) ⇒ Chrome before A
  assert.equal(chromeBeforeIdFromDisplayDrop("a", true, reversed, true), "a");
});

test("isUnderAncestor walks parents including self", () => {
  const parents = parentIds(tree);
  assert.equal(isUnderAncestor(parents, "11", "10"), true);
  assert.equal(isUnderAncestor(parents, "10", "10"), true);
  assert.equal(isUnderAncestor(parents, "10", "11"), false);
  assert.equal(isUnderAncestor(parents, "20", "1"), false);
});

test("moveIntoFolderError rejects self, descendants, non-folders, and root", () => {
  assert.equal(moveIntoFolderError(tree, "11", "2"), null);
  assert.equal(moveIntoFolderError(tree, "11", "10"), null);
  assert.equal(alreadyInFolder(tree, "11", "10"), true);
  assert.equal(alreadyInFolder(tree, "11", "2"), false);
  assert.equal(moveIntoFolderError(tree, "10", "10"), "A folder cannot be moved into itself.");
  assert.equal(moveIntoFolderError(tree, "11", "12"), "Drop onto a folder.");
  assert.equal(
    moveIntoFolderError(tree, "1", "10"),
    "A folder cannot be moved into one of its subfolders.",
  );
  assert.equal(moveIntoFolderError(tree, "11", "0"), "Choose a folder inside Bookmarks.");
  assert.equal(moveIntoFolderError(tree, "11", "20"), null);
  assert.equal(moveIntoFolderError(tree, "11", "missing"), "Drop onto a folder.");
  assert.equal(moveIntoFolderError(tree, "0", "1"), "The bookmarks root cannot be moved.");
});

test("dialFolderOptions lists nested folders and skips the chrome root", () => {
  assert.deepEqual(dialFolderOptions(tree), [
    { id: "1", title: "Bookmarks bar", depth: 0 },
    { id: "10", title: "News", depth: 1 },
    { id: "2", title: "Other bookmarks", depth: 0 },
    { id: "20", title: "Hearth", depth: 1 },
  ]);
});

test("dialFolderTree nests folders and can scope under defaultFolderId", () => {
  assert.deepEqual(dialFolderTree(tree), [
    {
      id: "1",
      title: "Bookmarks bar",
      children: [{ id: "10", title: "News", children: [] }],
    },
    {
      id: "2",
      title: "Other bookmarks",
      children: [{ id: "20", title: "Hearth", children: [] }],
    },
  ]);
  assert.deepEqual(flattenFolderTree(dialFolderTree(tree)), dialFolderOptions(tree));
  assert.deepEqual(dialFolderTree(tree, "20"), [
    { id: "20", title: "Hearth", children: [] },
  ]);
  assert.deepEqual(dialFolderTree(tree, "1"), [
    {
      id: "1",
      title: "Bookmarks bar",
      children: [{ id: "10", title: "News", children: [] }],
    },
  ]);
  assert.deepEqual(dialFolderTree(tree, "0"), dialFolderTree(tree));
  assert.deepEqual(dialFolderTree(tree, "missing"), dialFolderTree(tree));
});

test("dialOpenFolderOptions includes the chrome root for default-folder picking", () => {
  assert.deepEqual(dialOpenFolderOptions(tree), [
    { id: "0", title: "Bookmarks", depth: 0 },
    { id: "1", title: "Bookmarks bar", depth: 1 },
    { id: "10", title: "News", depth: 2 },
    { id: "2", title: "Other bookmarks", depth: 1 },
    { id: "20", title: "Hearth", depth: 2 },
  ]);
});

test("add page query keeps an openable url and prefers tab title for pages", () => {
  assert.equal(
    addPageQuery({ pageUrl: "https://example.com/path", selectionText: " Example " }),
    "url=https%3A%2F%2Fexample.com%2Fpath&title=Example",
  );
  assert.equal(
    addPageQuery({
      pageUrl: "https://translate.google.com/",
      tabTitle: "Google Translate",
    }),
    "url=https%3A%2F%2Ftranslate.google.com%2F&title=Google+Translate",
  );
  assert.equal(
    addPageQuery({
      pageUrl: "https://translate.google.com/",
      tabTitle: "Google Translate",
      selectionText: "ignored when tab title exists",
    }),
    "url=https%3A%2F%2Ftranslate.google.com%2F&title=Google+Translate",
  );
  assert.equal(
    addPageQuery({
      linkUrl: "https://news.example/",
      pageUrl: "https://ignored.example/",
      tabTitle: "Hosting page title",
    }),
    "url=https%3A%2F%2Fnews.example%2F",
  );
  assert.equal(
    addPageQuery({
      linkUrl: "https://news.example/",
      selectionText: "News link",
      tabTitle: "Hosting page title",
    }),
    "url=https%3A%2F%2Fnews.example%2F&title=News+link",
  );
  assert.equal(addPageQuery({ pageUrl: "javascript:alert(1)" }), null);
  assert.equal(addPageQuery({}), null);
});

test("parseAddPageFields requires an openable url and fills a title", () => {
  assert.deepEqual(parseAddPageFields("?url=https%3A%2F%2Fwww.example.com%2F&title=News"), {
    url: "https://www.example.com/",
    title: "News",
  });
  assert.deepEqual(parseAddPageFields("url=https://www.example.com/path"), {
    url: "https://www.example.com/path",
    title: "example.com",
  });
  assert.equal(parseAddPageFields("url=chrome://extensions"), null);
  assert.equal(parseAddPageFields(""), null);
});

test("normalizeDialQuery trims and lowercases", () => {
  assert.equal(normalizeDialQuery("  HeLLo  "), "hello");
  assert.equal(normalizeDialQuery("\t"), "");
});

test("dialMatchesQuery checks title and URL case-insensitively", () => {
  const link = { id: "11", title: "Example", url: "https://www.example.com/path" };
  const folder = { id: "10", title: "News", children: [] };
  assert.equal(dialMatchesQuery(link, "example"), true);
  assert.equal(dialMatchesQuery(link, "example.com"), true);
  assert.equal(dialMatchesQuery(link, "path"), true);
  assert.equal(dialMatchesQuery(link, "missing"), false);
  assert.equal(dialMatchesQuery(folder, "news"), true);
  assert.equal(dialMatchesQuery(folder, "zzz"), false);
});

test("searchDialSubtree finds nested dials and annotates parent meta", () => {
  const folder = tree[0]?.children?.[0];
  assert.ok(folder);
  const hits = searchDialSubtree(folder, "mozilla");
  assert.deepEqual(
    hits.map((hit) => hit.id),
    ["12"],
  );
  assert.match(hits[0]?.meta ?? "", /News/);

  const byFolderTitle = searchDialSubtree(folder, "news");
  assert.ok(byFolderTitle.some((hit) => hit.id === "10"));

  assert.deepEqual(searchDialSubtree(folder, "   "), []);
  assert.deepEqual(searchDialSubtree(undefined, "x"), []);
});
