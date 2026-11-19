/**
 * Each page is its own script (site pass #5, 11/19). After a publish, a tab still on the older build asks for a page
 * script that the new build no longer has: the request misses, and before this the page sat on the loading clock. Now
 * the tab reloads itself once, onto the new build. If it misses again within a minute (something else is wrong), it
 * doesn't loop: the error screen says what happened and offers Reload.
 *
 * Caught three ways: Vite's own `vite:preloadError` event, an unhandled failure with a browser's "couldn't load this
 * module" message, and the router's error screen (src/lib/error-component.tsx).
 */

export const RELOAD_GUARD_MS = 60_000;
const KEY = "katz-stale-build-reload";

/** The messages browsers give when a page script (or its styles) can't be loaded: Chrome, Firefox, Safari, Vite. */
const STALE = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /unable to preload css/i,
  /is not a valid javascript mime type/i,
];

export function isStaleBuildError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return !!message && STALE.some((re) => re.test(message));
}

type Store = { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void };

type ReloadDeps = {
  storage?: Store;
  now?: () => number;
  reload?: () => void;
  /** Where the last reload is kept when session storage is blocked: this page only. */
  memo?: { at?: number };
};

const pageMemo: { at?: number } = {};

function sessionStore(): Store | undefined {
  try {
    return globalThis.sessionStorage ?? undefined;
  } catch {
    return undefined;
  }
}

/** Reloads the tab unless it already did so in the last minute. Says whether it reloaded. */
export function reloadForNewBuild({
  storage = sessionStore(),
  now = () => Date.now(),
  reload = () => globalThis.location?.reload(),
  memo = pageMemo,
}: ReloadDeps = {}): boolean {
  let last = memo.at ?? 0;
  try {
    last = Math.max(last, Number(storage?.getItem(KEY) ?? 0) || 0);
  } catch {
    /* blocked storage: the page memo stands in */
  }
  const t = now();
  if (last && t - last < RELOAD_GUARD_MS) return false;
  memo.at = t;
  try {
    storage?.setItem(KEY, String(t));
  } catch {
    /* blocked storage: the page memo stands in */
  }
  reload();
  return true;
}

type Target = { addEventListener: (type: string, fn: (e: any) => void) => void; removeEventListener: (type: string, fn: (e: any) => void) => void };

/** Listens for a missing page script on the window and reloads once. Returns how to stop listening. */
export function installStaleBuildRecovery({
  target = globalThis.window as unknown as Target | undefined,
  ...deps
}: ReloadDeps & { target?: Target } = {}): (() => void) | undefined {
  if (!target?.addEventListener) return undefined;
  const onPreload = (e: { payload?: unknown; preventDefault?: () => void }) => {
    // Vite throws the error on after this event unless it is prevented: keep it when the tab doesn't reload.
    if (reloadForNewBuild(deps)) e.preventDefault?.();
  };
  const onRejection = (e: { reason?: unknown; preventDefault?: () => void }) => {
    if (isStaleBuildError(e.reason) && reloadForNewBuild(deps)) e.preventDefault?.();
  };
  target.addEventListener("vite:preloadError", onPreload);
  target.addEventListener("unhandledrejection", onRejection);
  return () => {
    target.removeEventListener("vite:preloadError", onPreload);
    target.removeEventListener("unhandledrejection", onRejection);
  };
}
