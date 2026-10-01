/**
 * Best-effort batch thumbnail refresh: one capture failure must not abort
 * the rest of the queue.
 */

export type ThumbnailRefreshTarget = {
  id: string;
  url: string;
};

export type ThumbnailRefreshItemResult =
  | { id: string; ok: true }
  | { id: string; ok: false; message: string };

/**
 * Capture each target sequentially. Failures are recorded and the loop
 * continues so remaining bookmarks still get a chance.
 */
export async function refreshThumbnailsBestEffort(
  targets: readonly ThumbnailRefreshTarget[],
  capture: (id: string, url: string) => Promise<void>,
  toMessage: (error: unknown) => string,
  onProgress?: () => void,
): Promise<ThumbnailRefreshItemResult[]> {
  const results: ThumbnailRefreshItemResult[] = [];
  for (const target of targets) {
    try {
      await capture(target.id, target.url);
      results.push({ id: target.id, ok: true });
    } catch (error) {
      results.push({ id: target.id, ok: false, message: toMessage(error) });
    }
    onProgress?.();
  }
  return results;
}

/** Aggregate failed captures for a dial-banner summary, or null when all ok. */
export function thumbnailRefreshFailureSummary(
  results: readonly ThumbnailRefreshItemResult[],
): { failed: number; total: number; detail: string } | null {
  const failures = results.filter(
    (result): result is Extract<ThumbnailRefreshItemResult, { ok: false }> => !result.ok,
  );
  if (failures.length === 0) return null;
  const last = failures[failures.length - 1];
  return {
    failed: failures.length,
    total: results.length,
    detail: last?.message ?? "",
  };
}
