import { t } from "./i18n.ts";
/**
 * Settings “Backup” category — export / import dial pictures + non-bookmark prefs.
 * Placed before Danger Zone (which must remain last).
 */

import {
  exportHelp,
  exportTitle,
  importHelp,
  importTitle,
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
  const root = settingsCategory(t("cat_backup"));
  let busy = Boolean(options.disabled);

  const help = document.createElement("span");
  help.className = "settings-help";
  help.textContent = exportHelp();
  root.append(help);

  const importHelpEl = document.createElement("span");
  importHelpEl.className = "settings-help";
  importHelpEl.textContent = importHelp();
  root.append(importHelpEl);

  const actions = document.createElement("div");
  actions.className = "settings-backup-actions";

  const exportBtn = document.createElement("button");
  exportBtn.type = "button";
  exportBtn.className = "settings-backup-export";
  exportBtn.textContent = t("btn_export");
  exportBtn.setAttribute("aria-label", exportTitle());
  exportBtn.disabled = busy;

  const importBtn = document.createElement("button");
  importBtn.type = "button";
  importBtn.className = "settings-backup-import";
  importBtn.textContent = t("btn_import");
  importBtn.setAttribute("aria-label", importTitle());
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
