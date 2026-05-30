import { lazy } from "react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirror React.lazy's own ComponentType<any> bound so caller prop types are preserved
type AnyComponent = React.ComponentType<any>;

/**
 * Drop-in replacement for React.lazy that survives a redeploy.
 *
 * When a new version ships, the hashed chunk filenames change (e.g.
 * `Completion-Dv-uFT5R.js`). A client that loaded the page BEFORE the deploy
 * still references the OLD chunk name; after the deploy that file is gone and
 * the server returns 403/404, so the dynamic import throws
 * "Failed to fetch dynamically imported module" and the user is stuck on an
 * error screen (e.g. a student finishing a quiz never sees the results page).
 *
 * The fix: on a chunk-load failure, force a one-time full page reload so the
 * browser fetches the fresh index.html (which points at the new chunk names).
 * A sessionStorage flag prevents an infinite reload loop if the import fails
 * for some other reason (genuinely missing file, offline, etc.).
 */
export function lazyWithReload<T extends AnyComponent>(
  factory: () => Promise<{ default: T }>,
  key: string,
) {
  return lazy<T>(async () => {
    const flag = `chunk_reload_${key}`;
    try {
      const mod = await factory();
      // Success — clear any prior reload marker for this chunk.
      try {
        sessionStorage.removeItem(flag);
      } catch {
        /* sessionStorage unavailable — ignore */
      }
      return mod;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isChunkError =
        /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(
          message,
        );

      let alreadyTried = false;
      try {
        alreadyTried = sessionStorage.getItem(flag) === "1";
      } catch {
        /* ignore */
      }

      if (isChunkError && !alreadyTried && typeof window !== "undefined") {
        try {
          sessionStorage.setItem(flag, "1");
        } catch {
          /* ignore */
        }
        // Hard reload to pick up the freshly deployed index.html + chunks.
        window.location.reload();
        // Return a never-resolving promise so React keeps showing the Suspense
        // fallback during the brief moment before the reload kicks in.
        return new Promise<{ default: T }>(() => {});
      }

      // Not a chunk error, or we already retried — surface it to the boundary.
      throw err;
    }
  });
}
