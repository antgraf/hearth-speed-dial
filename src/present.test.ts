import assert from "node:assert/strict";
import { test } from "node:test";
import type { BookmarkNode } from "./model.ts";
import {
  canDeleteNode,
  canRenameNode,
  deleteConfirmMessage,
  folderHasContents,
  present,
  refreshAllThumbnailsConfirmMessage,
  refreshAllThumbnailsFailureMessage,
  type AppState,
} from "./present.ts";
import { DEFAULT_LAYOUT } from "./settings.ts";
import { t } from "./i18n.ts";

const tree: BookmarkNode[] = [
  {
    id: "0",
    title: "",
    children: [
      {
        id: "1",
        title: "Bookmarks bar",
        children: [
          { id: "11", title: "Example", url: "https://example.com/" },
          { id: "12", title: "News", children: [] },
        ],
      },
      { id: "2", title: "Other bookmarks", children: [] },
    ],
  },
];

function state(overrides: Partial<AppState> = {}): AppState {
  return {
    banner: null,
    status: "ready",
    error: null,
    tree,
    currentId: null,
    defaultFolderId: null,
    form: null,
    saving: false,
    layout: { ...DEFAULT_LAYOUT, theme: { ...DEFAULT_LAYOUT.theme } },
    images: {},
    themeBackground: null,
    thumbnailsActive: false,
    imageUrlFetchActive: false,
    searchQuery: "",
    welcomeDismissed: true,
    ...overrides,
  };
}

test("loading hides the grid", () => {
  assert.equal(present(state({ status: "loading" })).name, "loading");
});

test("the top level is a grid of the root folders", () => {
  const screen = present(state());
  if (screen.name !== "grid") throw new Error("expected the grid");
  assert.deepEqual(
    screen.items.map((item) => item.title),
    ["Bookmarks bar", "Other bookmarks"],
  );
  assert.deepEqual(
    screen.crumbs.map((crumb) => crumb.title),
    ["Bookmarks root"],
  );
  assert.equal(screen.canCreate, false);
  assert.equal(screen.canRenameCurrent, false);
  assert.equal(screen.canDeleteCurrent, false);
  assert.equal(screen.canRefreshAll, false);
  assert.equal(screen.currentFolder.id, "0");
  assert.equal(screen.currentFolder.imageDataUrl, null);
  assert.ok(screen.defaultFolderOptions.some((option) => option.id === "0"));
});

test("an open folder uses the same grid and can add tiles", () => {
  const screen = present(state({ currentId: "1" }));
  if (screen.name !== "grid") throw new Error("expected the grid");
  assert.deepEqual(
    screen.items.map((item) => item.title),
    ["Example", "News"],
  );
  assert.deepEqual(
    screen.crumbs.map((crumb) => crumb.title),
    ["Bookmarks root", "Bookmarks bar"],
  );
  assert.equal(screen.canCreate, true);
  assert.equal(screen.canRenameCurrent, true);
  assert.equal(screen.canDeleteCurrent, true);
  assert.equal(screen.canRefreshAll, true);
  assert.equal(screen.currentFolder.id, "1");
  assert.equal(screen.currentFolder.title, "Bookmarks bar");
  assert.equal(screen.empty, null);
});

test("an empty folder explains that it has no bookmarks", () => {
  const screen = present(state({ currentId: "12" }));
  if (screen.name !== "grid") throw new Error("expected the grid");
  assert.equal(screen.empty, t("empty_folder"));
  assert.equal(screen.canCreate, true);
  assert.equal(screen.canRefreshAll, false);
  assert.deepEqual(
    screen.crumbs.map((crumb) => crumb.title),
    ["Bookmarks root", "Bookmarks bar", "News"],
  );
});

test("a missing bookmark tree explains that bookmarks are unavailable", () => {
  const screen = present(state({ tree: [], status: "failed", error: "Bookmarks are unavailable." }));
  if (screen.name !== "unavailable") throw new Error("expected an unavailable screen");
  assert.equal(screen.message, "Bookmarks are unavailable.");
});

test("unavailable falls back to the default message when error is null", () => {
  const screen = present(state({ tree: [], status: "failed", error: null }));
  if (screen.name !== "unavailable") throw new Error("expected an unavailable screen");
  assert.equal(screen.message, t("unavailable_default"));
});

test("grid falls back to the root when currentId is a bookmark or deleted", () => {
  const bookmarkId = present(state({ currentId: "11" }));
  if (bookmarkId.name !== "grid") throw new Error("expected the grid");
  assert.equal(bookmarkId.currentFolder.id, "0");
  assert.deepEqual(
    bookmarkId.items.map((item) => item.title),
    ["Bookmarks bar", "Other bookmarks"],
  );

  const deleted = present(state({ currentId: "missing" }));
  if (deleted.name !== "grid") throw new Error("expected the grid");
  assert.equal(deleted.currentFolder.id, "0");
});

test("reverseOrder shows last bookmarks first without changing empty copy", () => {
  const screen = present(
    state({
      currentId: "1",
      layout: { ...DEFAULT_LAYOUT, reverseOrder: true },
    }),
  );
  if (screen.name !== "grid") throw new Error("expected the grid");
  assert.deepEqual(
    screen.items.map((item) => item.title),
    ["News", "Example"],
  );
  assert.equal(screen.layout.reverseOrder, true);
});

test("stored images attach to matching dial items", () => {
  const dataUrl = "data:image/png;base64,aaaa";
  const screen = present(
    state({
      currentId: "1",
      images: { "11": dataUrl, "1": dataUrl },
    }),
  );
  if (screen.name !== "grid") throw new Error("expected the grid");
  const example = screen.items.find((item) => item.id === "11");
  const news = screen.items.find((item) => item.id === "12");
  assert.equal(example?.imageDataUrl, dataUrl);
  assert.equal(news?.imageDataUrl, null);
  assert.equal(screen.currentFolder.imageDataUrl, dataUrl);
});

test("search filters the open folder and nested dials by title or URL", () => {
  const nested: BookmarkNode[] = [
    {
      id: "0",
      title: "",
      children: [
        {
          id: "1",
          title: "Bookmarks bar",
          children: [
            { id: "11", title: "Example", url: "https://example.com/" },
            {
              id: "12",
              title: "News",
              children: [{ id: "121", title: "BBC", url: "https://bbc.co.uk/news" }],
            },
          ],
        },
      ],
    },
  ];
  const byTitle = present(state({ tree: nested, currentId: "1", searchQuery: "bbc" }));
  if (byTitle.name !== "grid") throw new Error("expected the grid");
  assert.equal(byTitle.searching, true);
  assert.equal(byTitle.canCreate, false);
  assert.deepEqual(
    byTitle.items.map((item) => item.id),
    ["121"],
  );
  assert.match(byTitle.items[0]?.meta ?? "", /News/);

  const byUrl = present(state({ tree: nested, currentId: "1", searchQuery: "example.com" }));
  if (byUrl.name !== "grid") throw new Error("expected the grid");
  assert.deepEqual(
    byUrl.items.map((item) => item.id),
    ["11"],
  );

  const none = present(state({ tree: nested, currentId: "1", searchQuery: "zzzz" }));
  if (none.name !== "grid") throw new Error("expected the grid");
  assert.equal(none.empty, t("empty_search", "zzzz"));
  assert.deepEqual(none.items, []);
});

test("whitespace-only searchQuery does not filter the grid", () => {
  const screen = present(state({ currentId: "1", searchQuery: "   " }));
  if (screen.name !== "grid") throw new Error("expected the grid");
  assert.equal(screen.searching, false);
  assert.equal(screen.canCreate, true);
  assert.deepEqual(
    screen.items.map((item) => item.title),
    ["Example", "News"],
  );
});

test("edit form state is passed through to the grid", () => {
  const screen = present(
    state({
      currentId: "1",
      form: { mode: "edit", id: "11", kind: "bookmark", title: "Example", url: "https://example.com/" },
    }),
  );
  if (screen.name !== "grid") throw new Error("expected the grid");
  assert.deepEqual(screen.form, {
    mode: "edit",
    id: "11",
    kind: "bookmark",
    title: "Example",
    url: "https://example.com/",
  });
});

test("the Chrome root cannot be renamed or deleted", () => {
  assert.equal(canRenameNode(tree[0]), false);
  assert.equal(canDeleteNode(tree[0]), false);
  assert.equal(canRenameNode(tree[0]?.children?.[0]), true);
  assert.equal(canDeleteNode(tree[0]?.children?.[0]), true);
  assert.equal(canDeleteNode({ id: "11", title: "Example", url: "https://example.com/" }), true);
});

test("the Firefox bookmark root cannot create, rename, or delete", () => {
  const firefoxRoot: BookmarkNode = {
    id: "root________",
    title: "",
    children: [{ id: "toolbar_____", title: "Bookmarks Toolbar", children: [] }],
  };
  const screen = present(
    state({
      tree: [firefoxRoot],
      currentId: "root________",
    }),
  );
  if (screen.name !== "grid") throw new Error("expected the grid");
  assert.equal(screen.canCreate, false);
  assert.equal(screen.canRenameCurrent, false);
  assert.equal(screen.canDeleteCurrent, false);
  assert.equal(screen.canRefreshAll, false);
  assert.equal(screen.crumbs[0]?.isRoot, true);
  assert.equal(screen.crumbs[0]?.title, "Bookmarks root");
  assert.equal(canRenameNode(firefoxRoot), false);

  const toolbar = present(
    state({
      tree: [firefoxRoot],
      currentId: "toolbar_____",
    }),
  );
  if (toolbar.name !== "grid") throw new Error("expected the grid");
  assert.equal(toolbar.canCreate, true);
  assert.equal(toolbar.canRenameCurrent, true);
});

test("delete confirm messages warn harder for non-empty folders", () => {
  const link = tree[0]?.children?.[0]?.children?.[0];
  const empty = tree[0]?.children?.[0]?.children?.[1];
  const filled = tree[0]?.children?.[0];
  if (!link || !empty || !filled) throw new Error("expected sample nodes");
  assert.equal(folderHasContents(empty), false);
  assert.equal(folderHasContents(filled), true);
  assert.equal(deleteConfirmMessage(link), t("delete_link_confirm", "Example"));
  assert.equal(deleteConfirmMessage(empty), t("delete_folder_empty_confirm", "News"));
  assert.equal(deleteConfirmMessage(filled), t("delete_folder_filled_confirm", "Bookmarks bar"));
});

test("refresh-all confirm mentions count and nested-folder scope", () => {
  assert.equal(
    refreshAllThumbnailsConfirmMessage(1),
    t("refresh_all_message", ["1", t("noun_bookmark")]),
  );
  assert.equal(
    refreshAllThumbnailsConfirmMessage(3),
    t("refresh_all_message", ["3", t("noun_bookmarks")]),
  );
});

test("refresh-all failure banner summarizes count and detail", () => {
  assert.equal(
    refreshAllThumbnailsFailureMessage(1, 5, "page not ready"),
    t("error_refresh_partial", ["1", "5", "page not ready"]),
  );
  assert.equal(
    refreshAllThumbnailsFailureMessage(2, 2, "   "),
    t("error_refresh_partial_no_detail", ["2", "2"]),
  );
});

test("first-run welcome shows until dismissed", () => {
  const shown = present(state({ welcomeDismissed: false }));
  if (shown.name !== "grid") throw new Error("expected the grid");
  assert.equal(shown.showWelcome, true);

  const hidden = present(state({ welcomeDismissed: true }));
  if (hidden.name !== "grid") throw new Error("expected the grid");
  assert.equal(hidden.showWelcome, false);
});
