import React from "react";

const RELOAD_KEY = "pitchnest:chunk-reload-at";
const RELOAD_COOLDOWN_MS = 60_000;

/**
 * React.lazy for route pages, with one safety net.
 *
 * Every deploy renames the page files (content hashes). A tab opened before
 * the deploy still asks for the OLD names; the host's SPA fallback answers
 * those requests with index.html, so the import fails and
 * the page would go blank. On that failure we reload once to pick up the new
 * build. The cooldown in sessionStorage guarantees this can never loop: a
 * second failure inside a minute is re-thrown to the nearest ErrorBoundary.
 */
export function lazyPage<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      let lastReload = 0;
      try {
        lastReload = Number(window.sessionStorage.getItem(RELOAD_KEY)) || 0;
      } catch {
        // Storage blocked: fall through to the error boundary.
      }
      if (Date.now() - lastReload > RELOAD_COOLDOWN_MS) {
        try {
          window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
          window.location.reload();
          // Stay suspended while the browser reloads.
          return await new Promise<never>(() => {});
        } catch {
          // Storage blocked: do not risk a reload loop.
        }
      }
      throw error;
    }
  });
}
