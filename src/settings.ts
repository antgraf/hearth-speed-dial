const STORAGE_KEY = "hearth.settings";

export type SettingsApi = {
  getOpenFolderId(): Promise<string | null>;
  setOpenFolderId(id: string): Promise<void>;
};

export function readOpenFolderId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { openFolderId?: unknown; rootFolderId?: unknown };
  if (typeof record.openFolderId === "string" && record.openFolderId.length > 0) return record.openFolderId;
  if (typeof record.rootFolderId === "string" && record.rootFolderId.length > 0) return record.rootFolderId;
  return null;
}

function readStored(): unknown {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
  } catch {
    return null;
  }
}

export function previewSettings(): SettingsApi {
  return {
    async getOpenFolderId() {
      return readOpenFolderId(readStored());
    },
    async setOpenFolderId(id) {
      const previous = readStored();
      const base = previous && typeof previous === "object" ? previous : {};
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...base, openFolderId: id }));
    },
  };
}
