import {
  clampColumns,
  clampTileSize,
  DEFAULT_LAYOUT,
  LAYOUT_LIMITS,
  type LayoutSettings,
  type SettingsApi,
} from "./settings.ts";
import {
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

  const save = async () => {
    if (saving) return;
    const form = host.querySelector("form");
    if (!(form instanceof HTMLFormElement)) return;
    const data = new FormData(form);
    let next: LayoutSettings = {
      columns: clampColumns(Number(data.get("columns"))),
      tileSize: clampTileSize(Number(data.get("tileSize"))),
      reverseOrder: data.get("reverseOrder") === "on",
      thumbnailsEnabled: data.get("thumbnailsEnabled") === "on",
    };

    if (next.thumbnailsEnabled && !layout.thumbnailsEnabled && permissions) {
      const granted = await permissions.requestThumbnailAccess();
      if (!granted) {
        next = { ...next, thumbnailsEnabled: false };
        error = thumbnailPermissionDeniedMessage();
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
        return;
      }
    }

    if (next.thumbnailsEnabled && permissions) {
      const stillGranted = await permissions.hasThumbnailAccess();
      if (!stillGranted) {
        next = { ...next, thumbnailsEnabled: false };
        error = thumbnailPermissionDeniedMessage();
      }
    }

    saving = true;
    error = null;
    savedNote = null;
    layout = next;
    draw();
    try {
      await settings.setLayout(next);
      saving = false;
      savedNote = "Saved. Open a new tab to see layout changes.";
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
      if (layout.thumbnailsEnabled && permissions) {
        const granted = await permissions.hasThumbnailAccess();
        if (!granted) {
          layout = { ...layout, thumbnailsEnabled: false };
          void settings.setLayout(layout);
        }
      }
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
