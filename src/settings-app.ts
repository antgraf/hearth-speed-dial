import {
  clampColumns,
  clampTileSize,
  DEFAULT_LAYOUT,
  LAYOUT_LIMITS,
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
): void {
  let layout: LayoutSettings = { ...DEFAULT_LAYOUT };
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
      "Off by default. When you turn this on, Chrome asks for optional access so Hearth can open a page briefly and capture a screenshot. Images stay local — nothing is uploaded.";
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
      "Off by default. When you turn this on, Chrome asks for optional site access so Hearth can download an image once from a link and store it locally. Turning it off drops that access.";
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
    tileSize.type = "range";
    tileSize.name = "tileSize";
    tileSize.min = String(LAYOUT_LIMITS.tileSize.min);
    tileSize.max = String(LAYOUT_LIMITS.tileSize.max);
    tileSize.step = "1";
    tileSize.value = String(layout.tileSize);
    tileSize.disabled = saving;
    tileSize.setAttribute("aria-label", "Tile size");
    form.append(labeled("Tile size", tileSize));
    const tileHelp = document.createElement("span");
    tileHelp.className = "settings-help";
    tileHelp.textContent =
      "Width of each dial face (96–576px). Faces use a 16:9 aspect ratio.";
    form.append(tileHelp);

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
    };
    let denial: string | null = null;

    if (next.thumbnailsEnabled && !previous.thumbnailsEnabled && permissions) {
      const granted = await permissions.requestThumbnailAccess();
      if (!granted) {
        next = { ...next, thumbnailsEnabled: false };
        await persistDenied(next, thumbnailPermissionDeniedMessage());
        return;
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

    if (next.imageUrlFetchEnabled && permissions) {
      const stillGranted = await permissions.hasImageUrlFetchAccess();
      if (!stillGranted) {
        next = { ...next, imageUrlFetchEnabled: false };
        denial = imageUrlPermissionDeniedMessage();
      }
    }

    saving = true;
    error = denial;
    savedNote = null;
    layout = next;
    draw();
    try {
      await settings.setLayout(next);
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

function note(text: string, className?: string): HTMLParagraphElement {
  const copy = document.createElement("p");
  if (className) copy.className = className;
  copy.textContent = text;
  return copy;
}
