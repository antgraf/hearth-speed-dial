import assert from "node:assert/strict";
import { afterEach, before, test } from "node:test";
import { Window } from "happy-dom";
import { choiceDialog, confirmDialog, openDialog, tabCycleIndex } from "./dialog.ts";
import { t } from "./i18n.ts";

test("tabCycleIndex wraps forward from the last item or outside", () => {
  assert.equal(tabCycleIndex(2, 3, false), 0);
  assert.equal(tabCycleIndex(-1, 3, false), 0);
  assert.equal(tabCycleIndex(0, 3, false), null);
  assert.equal(tabCycleIndex(1, 3, false), null);
});

test("tabCycleIndex wraps backward from the first item or outside", () => {
  assert.equal(tabCycleIndex(0, 3, true), 2);
  assert.equal(tabCycleIndex(-1, 3, true), 2);
  assert.equal(tabCycleIndex(1, 3, true), null);
  assert.equal(tabCycleIndex(2, 3, true), null);
});

test("tabCycleIndex returns null for an empty set", () => {
  assert.equal(tabCycleIndex(0, 0, false), null);
  assert.equal(tabCycleIndex(0, 0, true), null);
});

type DomKit = {
  window: Window;
  document: Document;
  mount: HTMLElement;
  returnFocus: HTMLElement;
};

let kit: DomKit;

before(() => {
  const window = new Window({ url: "https://hearth.test/" });
  const document = window.document as unknown as Document;
  globalThis.document = document;
  globalThis.Document = window.Document as unknown as typeof Document;
  globalThis.HTMLElement = window.HTMLElement as unknown as typeof HTMLElement;
  globalThis.KeyboardEvent = window.KeyboardEvent as unknown as typeof KeyboardEvent;

  const returnFocus = document.createElement("button");
  returnFocus.id = "return-focus";
  returnFocus.textContent = "caller";
  document.body.append(returnFocus);

  kit = {
    window,
    document,
    mount: document.body,
    returnFocus,
  };
});

afterEach(() => {
  for (const root of kit.mount.querySelectorAll(".dialog-root")) {
    root.remove();
  }
});

async function settle(): Promise<void> {
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

test("confirmDialog resolves true on Confirm and restores returnFocus", async () => {
  kit.returnFocus.focus();
  const pending = confirmDialog(
    { title: "Delete folder", message: "Delete everything?", returnFocus: kit.returnFocus },
    kit.mount,
  );
  await settle();
  const confirm = kit.mount.querySelector<HTMLButtonElement>(".dialog-actions .primary");
  assert.ok(confirm);
  confirm.click();
  assert.equal(await pending, true);
  assert.equal(kit.document.activeElement, kit.returnFocus);
  assert.equal(kit.mount.querySelectorAll(".dialog-root").length, 0);
});

test("confirmDialog resolves false on Cancel", async () => {
  kit.returnFocus.focus();
  const pending = confirmDialog(
    { title: "Delete", message: "Sure?", returnFocus: kit.returnFocus },
    kit.mount,
  );
  await settle();
  const cancel = kit.mount.querySelector<HTMLButtonElement>(".dialog-actions .quiet");
  assert.ok(cancel);
  cancel.click();
  assert.equal(await pending, false);
  assert.equal(kit.document.activeElement, kit.returnFocus);
});

test("confirmDialog resolves false on Escape", async () => {
  kit.returnFocus.focus();
  const pending = confirmDialog(
    { title: "Delete", message: "Sure?", returnFocus: kit.returnFocus },
    kit.mount,
  );
  await settle();
  kit.document.dispatchEvent(
    new kit.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }) as unknown as Event,
  );
  assert.equal(await pending, false);
  assert.equal(kit.document.activeElement, kit.returnFocus);
});

test("confirmDialog resolves false on backdrop click", async () => {
  kit.returnFocus.focus();
  const pending = confirmDialog(
    { title: "Delete", message: "Sure?", returnFocus: kit.returnFocus },
    kit.mount,
  );
  await settle();
  const backdrop = kit.mount.querySelector<HTMLElement>(".dialog-backdrop");
  assert.ok(backdrop);
  backdrop.click();
  assert.equal(await pending, false);
  assert.equal(kit.document.activeElement, kit.returnFocus);
});

test("choiceDialog resolves the selected value and null on Cancel", async () => {
  kit.returnFocus.focus();
  const pending = choiceDialog(
    {
      title: "Import",
      message: "How?",
      choices: [
        { value: "merge", label: "Merge", primary: true },
        { value: "overwrite", label: "Overwrite", danger: true },
      ],
      returnFocus: kit.returnFocus,
    },
    kit.mount,
  );
  await settle();
  const overwrite = [...kit.mount.querySelectorAll("button")].find(
    (el) => el.textContent === "Overwrite",
  );
  assert.ok(overwrite);
  overwrite.click();
  assert.equal(await pending, "overwrite");
  assert.equal(kit.document.activeElement, kit.returnFocus);

  const cancelled = choiceDialog(
    {
      title: "Import",
      message: "How?",
      choices: [{ value: "merge", label: "Merge", primary: true }],
      returnFocus: kit.returnFocus,
    },
    kit.mount,
  );
  await settle();
  const cancel = [...kit.mount.querySelectorAll("button")].find((el) => el.textContent === t("btn_cancel"));
  assert.ok(cancel);
  cancel.click();
  assert.equal(await cancelled, null);
});

test("openDialog fires onClose once and restores focus", async () => {
  kit.returnFocus.focus();
  let closes = 0;
  const body = kit.document.createElement("p");
  body.textContent = "body";
  const handle = openDialog(
    {
      title: "Menu",
      body,
      returnFocus: kit.returnFocus,
      onClose: () => {
        closes += 1;
      },
    },
    kit.mount,
  );
  await settle();
  handle.close();
  handle.close();
  assert.equal(closes, 1);
  assert.equal(kit.document.activeElement, kit.returnFocus);
  assert.equal(kit.mount.querySelectorAll(".dialog-root").length, 0);
});
