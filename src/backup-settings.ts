/**
 * Settings “Backup” category — export / import dial pictures + non-bookmark prefs.
 * Placed before Danger Zone (which must remain last).
 */

import {
  EXPORT_HELP,
  EXPORT_TITLE,
  IMPORT_HELP,
  IMPORT_TITLE,
} from "./backup.ts";

export type BackupCategoryHandle = {
  root: HTMLElement;
  setBusy(busy: boolean): void;
};

export type BackupCategoryOptions = {
  disabled?: boolean;
  onExport: () => void;
  onImport: () => void;
};

/** Build the Settings Backup category (download / restore JSON). */
export function buildBackupCategory(options: BackupCategoryOptions): BackupCategoryHandle {
  const root = settingsCategory("Backup");
  let busy = Boolean(options.disabled);

  const help = document.createElement("span");
  help.className = "settings-help";
  help.textContent = EXPORT_HELP;
  root.append(help);

  const importHelp = document.createElement("span");
  importHelp.className = "settings-help";
  importHelp.textContent = IMPORT_HELP;
  root.append(importHelp);

  const actions = document.createElement("div");
  actions.className = "settings-backup-actions";

  const exportBtn = document.createElement("button");
  exportBtn.type = "button";
  exportBtn.className = "settings-backup-export";
  exportBtn.textContent = "Export…";
  exportBtn.setAttribute("aria-label", EXPORT_TITLE);
  exportBtn.disabled = busy;

  const importBtn = document.createElement("button");
  importBtn.type = "button";
  importBtn.className = "settings-backup-import";
  importBtn.textContent = "Import…";
  importBtn.setAttribute("aria-label", IMPORT_TITLE);
  importBtn.disabled = busy;

  actions.append(exportBtn, importBtn);
  root.append(actions);

  exportBtn.addEventListener("click", () => {
    if (busy) return;
    options.onExport();
  });
  importBtn.addEventListener("click", () => {
    if (busy) return;
    options.onImport();
  });

  return {
    root,
    setBusy(next) {
      busy = next;
      exportBtn.disabled = next;
      importBtn.disabled = next;
    },
  };
}

function settingsCategory(title: string): HTMLElement {
  const section = document.createElement("section");
  section.className = "settings-category";
  const heading = document.createElement("h2");
  heading.className = "settings-category-title";
  heading.textContent = title;
  section.append(heading);
  return section;
}
