import type { BookmarksApi } from "./browser.ts";
import { dialOpenFolderOptions, type FolderOption } from "./model.ts";
import {
  bindRangeInput,
  clampColumns,
  clampThumbnailWaitSeconds,
  clampTileSize,
  DEFAULT_LAYOUT,
  LAYOUT_LIMITS,
  syncRangeInputValue,
  type LayoutSettings,
  type SettingsApi,
} from "./settings.ts";
import {
  imageUrlPermissionDeniedMessage,
  thumbnailPermissionDeniedMessage,
  type PermissionsApi,
} from "./permissions.ts";

export function startSettings(
  host: HTMLElement,
  settings: SettingsApi,
  banner?: string | null,
  permissions?: PermissionsApi,
  bookmarks?: BookmarksApi,
): void {
  let layout: LayoutSettings = { ...DEFAULT_LAYOUT };
  let defaultFolderId: string | null = null;
  let folderOptions: FolderOption[] = [];
  let saving = false;
  let error: string | null = null;
  let savedNote: string | null = null;

  const draw = () => {
    host.replaceChildren();
    if (banner) host.append(note(banner, "preview"));

    const frame = document.createElement("div");
    frame.className = "frame settings-page";
    host.append(frame);

    const brand = document.createElement("p");
    brand.className = "brand";
    brand.textContent = "Hearth";
    frame.append(brand);

    const title = document.createElement("h1");
    title.textContent = "Settings";
    frame.append(title);

    const intro = document.createElement("p");
    intro.className = "settings-intro";
    intro.textContent =
      "Layout preferences stay in this browser profile. Bookmark order in Chrome is unchanged — reverse only affects how the dial grid is shown.";
    frame.append(intro);

    if (error) {
      const alert = note(error, "error");
      alert.setAttribute("role", "alert");
      frame.append(alert);
    }
    if (savedNote) frame.append(note(savedNote, "settings-saved"));

    const form = document.createElement("form");
    form.className = "settings-form";
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void save();
    });

    const reverse = document.createElement("input");
    reverse.type = "checkbox";
    reverse.name = "reverseOrder";
    reverse.checked = layout.reverseOrder;
    reverse.id = "reverseOrder";
    reverse.disabled = saving;
    const reverseLabel = document.createElement("label");
    reverseLabel.className = "settings-check";
    reverseLabel.htmlFor = "reverseOrder";
    const reverseText = document.createElement("span");
    reverseText.className = "settings-check-text";
    const reverseCaption = document.createElement("span");
    reverseCaption.className = "settings-check-title";
    reverseCaption.textContent = "Show last bookmarks first";
    const reverseHelp = document.createElement("span");
    reverseHelp.className = "settings-help";
    reverseHelp.textContent = "Newest or last-listed bookmarks appear at the start of the grid.";
    reverseText.append(reverseCaption, reverseHelp);
    reverseLabel.append(reverse, reverseText);
    form.append(reverseLabel);

    const thumbnails = document.createElement("input");
    thumbnails.type = "checkbox";
    thumbnails.name = "thumbnailsEnabled";
    thumbnails.checked = layout.thumbnailsEnabled;
    thumbnails.id = "thumbnailsEnabled";
    thumbnails.disabled = saving;
    const thumbnailsLabel = document.createElement("label");
    thumbnailsLabel.className = "settings-check";
    thumbnailsLabel.htmlFor = "thumbnailsEnabled";
    const thumbnailsText = document.createElement("span");
    thumbnailsText.className = "settings-check-text";
    const thumbnailsCaption = document.createElement("span");
    thumbnailsCaption.className = "settings-check-title";
    thumbnailsCaption.textContent = "Generate dial thumbnails";
    const thumbnailsHelp = document.createElement("span");
    thumbnailsHelp.className = "settings-help";
    thumbnailsHelp.textContent =
      "Off by default. The first time you turn this on, Chrome asks for optional access so Hearth can open a page briefly and capture a screenshot. Later turns may restore that access without asking. Images stay local — nothing is uploaded.";
    thumbnailsText.append(thumbnailsCaption, thumbnailsHelp);
    thumbnailsLabel.append(thumbnails, thumbnailsText);
    form.append(thumbnailsLabel);

    const imageUrlFetch = document.createElement("input");
    imageUrlFetch.type = "checkbox";
    imageUrlFetch.name = "imageUrlFetchEnabled";
    imageUrlFetch.checked = layout.imageUrlFetchEnabled;
    imageUrlFetch.id = "imageUrlFetchEnabled";
    imageUrlFetch.disabled = saving;
    const imageUrlFetchLabel = document.createElement("label");
    imageUrlFetchLabel.className = "settings-check";
    imageUrlFetchLabel.htmlFor = "imageUrlFetchEnabled";
    const imageUrlFetchText = document.createElement("span");
    imageUrlFetchText.className = "settings-check-text";
    const imageUrlFetchCaption = document.createElement("span");
    imageUrlFetchCaption.className = "settings-check-title";
    imageUrlFetchCaption.textContent = "Assign pictures from URLs";
    const imageUrlFetchHelp = document.createElement("span");
    imageUrlFetchHelp.className = "settings-help";
    imageUrlFetchHelp.textContent =
      "Off by default. The first time you turn this on, Chrome asks for optional site access so Hearth can download an image once from a link and store it locally. Turning it off drops active access; later turns may restore it without asking.";
    imageUrlFetchText.append(imageUrlFetchCaption, imageUrlFetchHelp);
    imageUrlFetchLabel.append(imageUrlFetch, imageUrlFetchText);
    form.append(imageUrlFetchLabel);

    const columns = document.createElement("input");
    columns.type = "number";
    columns.name = "columns";
    columns.min = String(LAYOUT_LIMITS.columns.min);
    columns.max = String(LAYOUT_LIMITS.columns.max);
    columns.step = "1";
    columns.value = String(layout.columns);
    columns.disabled = saving;
    columns.setAttribute("aria-label", "Columns");
    form.append(labeled("Columns", columns));

    const tileSize = document.createElement("input");
    tileSize.name = "tileSize";
    bindRangeInput(tileSize, {
      min: LAYOUT_LIMITS.tileSize.min,
      max: LAYOUT_LIMITS.tileSize.max,
      step: 1,
      value: layout.tileSize,
    });
    tileSize.disabled = saving;
    tileSize.setAttribute("aria-label", "Tile size");
    form.append(labeled("Tile size", tileSize));
    syncRangeInputValue(tileSize, layout.tileSize);
    const tileHelp = document.createElement("span");
    tileHelp.className = "settings-help";
    tileHelp.textContent =
      "Width of each dial face (96–576px). Faces use a 16:9 aspect ratio.";
    form.append(tileHelp);

    const thumbnailWait = document.createElement("input");
    thumbnailWait.type = "number";
    thumbnailWait.name = "thumbnailWaitSeconds";
    thumbnailWait.min = String(LAYOUT_LIMITS.thumbnailWaitSeconds.min);
    thumbnailWait.max = String(LAYOUT_LIMITS.thumbnailWaitSeconds.max);
    thumbnailWait.step = String(LAYOUT_LIMITS.thumbnailWaitSeconds.step);
    thumbnailWait.value = String(layout.thumbnailWaitSeconds);
    thumbnailWait.disabled = saving;
    thumbnailWait.setAttribute("aria-label", "Thumbnail wait (seconds)");
    form.append(labeled("Thumbnail wait (seconds)", thumbnailWait));
    const waitHelp = document.createElement("span");
    waitHelp.className = "settings-help";
    waitHelp.textContent =
      "How long capture waits for a page to finish loading (5–120s, default 45). Raise this for slow sites.";
    form.append(waitHelp);

    const defaultFolder = document.createElement("select");
    defaultFolder.name = "defaultFolderId";
    defaultFolder.disabled = saving || folderOptions.length === 0;
    defaultFolder.setAttribute("aria-label", "Default folder for new windows");
    const unsetOption = document.createElement("option");
    unsetOption.value = "";
    unsetOption.textContent = "Last open folder (default)";
    defaultFolder.append(unsetOption);
    const knownIds = new Set(folderOptions.map((option) => option.id));
    for (const option of folderOptions) {
      const entry = document.createElement("option");
      entry.value = option.id;
      entry.textContent = `${"\u00A0".repeat(option.depth * 2)}${option.title}`;
      defaultFolder.append(entry);
    }
    if (defaultFolderId && knownIds.has(defaultFolderId)) {
      defaultFolder.value = defaultFolderId;
    } else if (defaultFolderId && !knownIds.has(defaultFolderId)) {
      const missing = document.createElement("option");
      missing.value = defaultFolderId;
      missing.textContent = "Missing folder (will fall back)";
      defaultFolder.append(missing);
      defaultFolder.value = defaultFolderId;
    } else {
      defaultFolder.value = "";
    }
    form.append(labeledSelect("Default folder for new windows", defaultFolder));
    const folderHelp = document.createElement("span");
    folderHelp.className = "settings-help";
    folderHelp.textContent =
      "Unset keeps recalling the last folder you had open. Set a folder and each new window / new tab starts there; navigating still updates last-open for when this is unset.";
    form.append(folderHelp);

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "primary";
    submit.textContent = saving ? "Saving…" : "Save";
    submit.disabled = saving;
    form.append(submit);

    frame.append(form);
  };

  const persistDenied = async (next: LayoutSettings, message: string) => {
    error = message;
    savedNote = null;
    layout = next;
    draw();
    try {
      await settings.setLayout(next);
    } catch (caught) {
      error =
        caught instanceof Error && caught.message.trim()
          ? caught.message
          : "Could not save settings.";
      draw();
    }
  };

  const save = async () => {
    if (saving) return;
    const form = host.querySelector("form");
    if (!(form instanceof HTMLFormElement)) return;
    const data = new FormData(form);
    const previous = layout;
    let next: LayoutSettings = {
      columns: clampColumns(Number(data.get("columns"))),
      tileSize: clampTileSize(Number(data.get("tileSize"))),
      reverseOrder: data.get("reverseOrder") === "on",
      thumbnailsEnabled: data.get("thumbnailsEnabled") === "on",
      imageUrlFetchEnabled: data.get("imageUrlFetchEnabled") === "on",
      thumbnailWaitSeconds: clampThumbnailWaitSeconds(Number(data.get("thumbnailWaitSeconds"))),
    };
    const nextDefaultRaw = String(data.get("defaultFolderId") ?? "").trim();
    const nextDefault = nextDefaultRaw.length > 0 ? nextDefaultRaw : null;
    let denial: string | null = null;

    if (next.thumbnailsEnabled && !previous.thumbnailsEnabled && permissions) {
      const granted = await permissions.requestThumbnailAccess();
      if (!granted) {
        next = { ...next, thumbnailsEnabled: false };
        await persistDenied(next, thumbnailPermissionDeniedMessage());
        return;
      }
    }

    if (!next.thumbnailsEnabled && previous.thumbnailsEnabled && permissions) {
      // Keep URL-fetch independent: own http/https before dropping <all_urls>.
      if (next.imageUrlFetchEnabled) {
        const urlKept = await permissions.requestImageUrlFetchAccess();
        if (!urlKept) {
          next = { ...next, imageUrlFetchEnabled: false };
        }
      }
      try {
        await permissions.removeThumbnailAccess();
      } catch {
        // Best-effort; setting still turns off.
      }
    }

    if (next.thumbnailsEnabled && permissions) {
      const stillGranted = await permissions.hasThumbnailAccess();
      if (!stillGranted) {
        next = { ...next, thumbnailsEnabled: false };
        denial = thumbnailPermissionDeniedMessage();
      }
    }

    if (next.imageUrlFetchEnabled && !previous.imageUrlFetchEnabled && permissions) {
      const granted = await permissions.requestImageUrlFetchAccess();
      if (!granted) {
        next = { ...next, imageUrlFetchEnabled: false };
        await persistDenied(next, imageUrlPermissionDeniedMessage());
        return;
      }
    }

    if (!next.imageUrlFetchEnabled && previous.imageUrlFetchEnabled && permissions) {
      try {
        await permissions.removeImageUrlFetchAccess();
      } catch {
        // Best-effort; setting still turns off.
      }
    }

    // Do not demote imageUrlFetchEnabled here when <all_urls> was revoked with
    // thumbnails — that path is handled above. Denial banner only on enable deny.

    saving = true;
    error = denial;
    savedNote = null;
    layout = next;
    defaultFolderId = nextDefault;
    draw();
    try {
      await settings.setLayout(next);
      await settings.setDefaultFolderId(nextDefault);
      saving = false;
      if (!denial) savedNote = "Saved. Open a new tab to see layout changes.";
      draw();
    } catch (caught) {
      saving = false;
      error = caught instanceof Error && caught.message.trim() ? caught.message : "Could not save settings.";
      draw();
    }
  };

  void (async () => {
    try {
      layout = await settings.getLayout();
      defaultFolderId = await settings.getDefaultFolderId();
      if (bookmarks) {
        try {
          folderOptions = dialOpenFolderOptions(await bookmarks.getTree());
        } catch {
          folderOptions = [];
        }
      }
      let changed = false;
      if (layout.thumbnailsEnabled && permissions) {
        const granted = await permissions.hasThumbnailAccess();
        if (!granted) {
          layout = { ...layout, thumbnailsEnabled: false };
          changed = true;
        }
      }
      if (layout.imageUrlFetchEnabled && permissions) {
        const granted = await permissions.hasImageUrlFetchAccess();
        if (!granted) {
          layout = { ...layout, imageUrlFetchEnabled: false };
          changed = true;
        }
      }
      if (changed) void settings.setLayout(layout);
    } catch (caught) {
      error = caught instanceof Error && caught.message.trim() ? caught.message : "Could not load settings.";
    }
    draw();
  })();
}

function labeled(labelText: string, control: HTMLInputElement): HTMLLabelElement {
  const label = document.createElement("label");
  const caption = document.createElement("span");
  caption.textContent = labelText;
  label.append(caption, control);
  return label;
}

function labeledSelect(labelText: string, control: HTMLSelectElement): HTMLLabelElement {
  const label = document.createElement("label");
  const caption = document.createElement("span");
  caption.textContent = labelText;
  label.append(caption, control);
  return label;
}

function note(text: string, className?: string): HTMLParagraphElement {
  const copy = document.createElement("p");
  if (className) copy.className = className;
  copy.textContent = text;
  return copy;
}
