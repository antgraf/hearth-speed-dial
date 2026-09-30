/** Runtime messages between the dial page and the MV3 service worker. */

export const REFRESH_ALL_THUMBNAILS_MESSAGE = "hearth.refreshAllThumbnails" as const;

export type RefreshAllThumbnailsMessage = {
  type: typeof REFRESH_ALL_THUMBNAILS_MESSAGE;
};

export function isRefreshAllThumbnailsMessage(value: unknown): value is RefreshAllThumbnailsMessage {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as { type?: unknown }).type === REFRESH_ALL_THUMBNAILS_MESSAGE
  );
}

export function refreshAllThumbnailsMessage(): RefreshAllThumbnailsMessage {
  return { type: REFRESH_ALL_THUMBNAILS_MESSAGE };
}
