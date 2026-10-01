/** Focusable controls inside a dialog root (for trap / initial focus). */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusableElements(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true",
  );
}

/**
 * Pure Tab-cycle index helper. `activeIndex` is -1 when focus is outside the set.
 * Returns the index that should receive focus, or null when the browser should handle Tab normally.
 */
export function tabCycleIndex(
  activeIndex: number,
  count: number,
  shiftKey: boolean,
): number | null {
  if (count === 0) return null;
  if (shiftKey) {
    if (activeIndex <= 0) return count - 1;
    return null;
  }
  if (activeIndex < 0 || activeIndex >= count - 1) return 0;
  return null;
}

/** Cycle Tab / Shift+Tab within `root`. Returns true when the event was handled. */
export function trapTabKey(event: KeyboardEvent, root: HTMLElement): boolean {
  if (event.key !== "Tab") return false;
  const items = focusableElements(root);
  if (items.length === 0) {
    event.preventDefault();
    return true;
  }
  const active = root.ownerDocument.activeElement;
  const activeIndex = active instanceof HTMLElement ? items.indexOf(active) : -1;
  const next = tabCycleIndex(activeIndex, items.length, event.shiftKey);
  if (next === null) return false;
  const target = items[next];
  if (!target) return false;
  event.preventDefault();
  target.focus();
  return true;
}

export type DialogHandle = {
  /** Overlay root (`.dialog-root`). */
  root: HTMLElement;
  /** Panel (`.dialog-panel`). */
  panel: HTMLElement;
  /** Close the dialog. Pass `{ silent: true }` to skip `onClose` and focus restore (e.g. re-render). */
  close: (opts?: { silent?: boolean }) => void;
};

export type OpenDialogOptions = {
  /** Extra class on the panel (e.g. `dialog-menu`). */
  panelClass?: string;
  title?: string;
  /** Optional id for the title element (`aria-labelledby`). */
  titleId?: string;
  body: HTMLElement | DocumentFragment;
  /** Footer actions row; omitted for compact menus that build their own list. */
  footer?: HTMLElement | DocumentFragment;
  returnFocus?: HTMLElement | null;
  /** Fired once when the dialog closes (any path). */
  onClose?: () => void;
  /** Default true. */
  closeOnBackdrop?: boolean;
  /** Default true — Escape closes. */
  closeOnEscape?: boolean;
};

let openCount = 0;
/** Open dialogs, bottom → top. Only the topmost handles Escape. */
const dialogStack: DialogHandle[] = [];

/**
 * Modal overlay with focus trap and Escape-to-close.
 * Appends to `document.body` (or `mount` when provided).
 */
function resolveMountDocument(mount?: ParentNode): Document {
  if (typeof Document !== "undefined" && mount instanceof Document) return mount;
  if (mount?.ownerDocument) return mount.ownerDocument;
  return document;
}

export function openDialog(options: OpenDialogOptions, mount?: ParentNode): DialogHandle {
  const doc = resolveMountDocument(mount);
  const parent =
    typeof Document !== "undefined" && mount instanceof Document
      ? mount.body
      : (mount ?? doc.body);

  const root = doc.createElement("div");
  root.className = "dialog-root";
  root.setAttribute("role", "presentation");

  const backdrop = doc.createElement("div");
  backdrop.className = "dialog-backdrop";
  backdrop.setAttribute("aria-hidden", "true");

  const panel = doc.createElement("div");
  panel.className = options.panelClass ? `dialog-panel ${options.panelClass}` : "dialog-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");

  const titleId = options.titleId ?? (options.title ? `dialog-title-${++openCount}` : null);
  if (options.title && titleId) {
    const heading = doc.createElement("h2");
    heading.className = "dialog-title";
    heading.id = titleId;
    heading.textContent = options.title;
    panel.append(heading);
    panel.setAttribute("aria-labelledby", titleId);
  }

  const body = doc.createElement("div");
  body.className = "dialog-body";
  body.append(options.body);
  panel.append(body);

  if (options.footer) {
    const footer = doc.createElement("div");
    footer.className = "dialog-footer";
    footer.append(options.footer);
    panel.append(footer);
  }

  root.append(backdrop, panel);

  let closed = false;
  const previousFocus =
    options.returnFocus ??
    (doc.activeElement instanceof HTMLElement ? doc.activeElement : null);

  const close = (opts?: { silent?: boolean }) => {
    if (closed) return;
    closed = true;
    doc.removeEventListener("keydown", onDocKey, true);
    const stackIndex = dialogStack.lastIndexOf(handle);
    if (stackIndex >= 0) dialogStack.splice(stackIndex, 1);
    root.remove();
    if (opts?.silent) return;
    if (previousFocus && previousFocus.isConnected) previousFocus.focus();
    options.onClose?.();
  };

  const onDocKey = (event: KeyboardEvent) => {
    if (closed) return;
    // Nested dialogs: only the topmost Escape / Tab trap runs.
    if (dialogStack[dialogStack.length - 1] !== handle) return;
    if (event.key === "Escape" && options.closeOnEscape !== false) {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === "Tab") trapTabKey(event, panel);
  };

  if (options.closeOnBackdrop !== false) {
    backdrop.addEventListener("click", () => close());
  }

  doc.addEventListener("keydown", onDocKey, true);
  parent.append(root);

  const focusables = focusableElements(panel);
  const initial = focusables[0] ?? panel;
  if (!panel.hasAttribute("tabindex") && focusables.length === 0) {
    panel.tabIndex = -1;
  }
  queueMicrotask(() => initial.focus());

  const handle: DialogHandle = { root, panel, close };
  dialogStack.push(handle);
  return handle;
}

export type ConfirmDialogOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  returnFocus?: HTMLElement | null;
};

/** Promise-based confirm dialog (Cancel / Confirm). */
export function confirmDialog(options: ConfirmDialogOptions, mount?: ParentNode): Promise<boolean> {
  return new Promise((resolve) => {
    const doc = resolveMountDocument(mount);
    const body = doc.createElement("p");
    body.className = "dialog-message";
    body.textContent = options.message;

    const footer = doc.createElement("div");
    footer.className = "dialog-actions";

    const cancel = doc.createElement("button");
    cancel.type = "button";
    cancel.className = "quiet";
    cancel.textContent = options.cancelLabel ?? "Cancel";

    const confirm = doc.createElement("button");
    confirm.type = "button";
    confirm.className = options.danger ? "primary danger" : "primary";
    confirm.textContent = options.confirmLabel ?? "Confirm";

    footer.append(cancel, confirm);

    let settled = false;
    const handle = openDialog(
      {
        title: options.title,
        body,
        footer,
        returnFocus: options.returnFocus,
        closeOnEscape: true,
        closeOnBackdrop: true,
        onClose: () => {
          if (settled) return;
          settled = true;
          resolve(false);
        },
      },
      mount,
    );

    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
      handle.close();
    };

    cancel.addEventListener("click", () => finish(false));
    confirm.addEventListener("click", () => finish(true));
  });
}

export type ChoiceDialogOption<T extends string> = {
  value: T;
  label: string;
  /** Primary styling; at most one option should set this. */
  primary?: boolean;
  danger?: boolean;
};

export type ChoiceDialogOptions<T extends string> = {
  title: string;
  message: string;
  choices: readonly ChoiceDialogOption<T>[];
  cancelLabel?: string;
  returnFocus?: HTMLElement | null;
};

/**
 * Promise-based multi-choice dialog. Resolves the chosen value, or null when
 * cancelled / dismissed (Escape, backdrop, Cancel).
 */
export function choiceDialog<T extends string>(
  options: ChoiceDialogOptions<T>,
  mount?: ParentNode,
): Promise<T | null> {
  return new Promise((resolve) => {
    const doc = resolveMountDocument(mount);
    const body = doc.createElement("p");
    body.className = "dialog-message";
    body.textContent = options.message;

    const footer = doc.createElement("div");
    footer.className = "dialog-actions";

    const cancel = doc.createElement("button");
    cancel.type = "button";
    cancel.className = "quiet";
    cancel.textContent = options.cancelLabel ?? "Cancel";
    footer.append(cancel);

    const choiceButtons: { value: T; button: HTMLButtonElement }[] = [];
    for (const choice of options.choices) {
      const button = doc.createElement("button");
      button.type = "button";
      if (choice.danger) button.className = "primary danger";
      else if (choice.primary) button.className = "primary";
      else button.className = "quiet";
      button.textContent = choice.label;
      footer.append(button);
      choiceButtons.push({ value: choice.value, button });
    }

    let settled = false;
    const handle = openDialog(
      {
        title: options.title,
        body,
        footer,
        returnFocus: options.returnFocus,
        closeOnEscape: true,
        closeOnBackdrop: true,
        onClose: () => {
          if (settled) return;
          settled = true;
          resolve(null);
        },
      },
      mount,
    );

    const finish = (value: T | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
      handle.close();
    };

    cancel.addEventListener("click", () => finish(null));
    for (const { value, button } of choiceButtons) {
      button.addEventListener("click", () => finish(value));
    }
  });
}
