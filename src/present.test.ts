import assert from "node:assert/strict";
import { test } from "node:test";
import type { BookmarkNode } from "./model.ts";
import { canRenameNode, present, type AppState } from "./present.ts";

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
    form: null,
    saving: false,
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
    ["Bookmarks"],
  );
  assert.equal(screen.canCreate, false);
  assert.equal(screen.canRenameCurrent, false);
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
    ["Bookmarks", "Bookmarks bar"],
  );
  assert.equal(screen.canCreate, true);
  assert.equal(screen.canRenameCurrent, true);
  assert.equal(screen.empty, null);
});

test("an empty folder explains that it has no bookmarks", () => {
  const screen = present(state({ currentId: "12" }));
  if (screen.name !== "grid") throw new Error("expected the grid");
  assert.equal(screen.empty, "This folder has no bookmarks yet.");
  assert.equal(screen.canCreate, true);
  assert.deepEqual(
    screen.crumbs.map((crumb) => crumb.title),
    ["Bookmarks", "Bookmarks bar", "News"],
  );
});

test("a missing bookmark tree explains that bookmarks are unavailable", () => {
  const screen = present(state({ tree: [], status: "failed", error: "Bookmarks are unavailable." }));
  if (screen.name !== "unavailable") throw new Error("expected an unavailable screen");
  assert.equal(screen.message, "Bookmarks are unavailable.");
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

test("the Chrome root cannot be renamed", () => {
  assert.equal(canRenameNode(tree[0]), false);
  assert.equal(canRenameNode(tree[0]?.children?.[0]), true);
  assert.equal(canRenameNode({ id: "11", title: "Example", url: "https://example.com/" }), true);
});
