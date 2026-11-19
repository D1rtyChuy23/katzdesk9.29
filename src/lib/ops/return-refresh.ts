/**
 * Lists refresh when you come back to a tab (site pass #7, 11/19). Someone else's change — a ticket dispatched, a PM
 * completed, an import — shows the next time you look, instead of after a reload.
 *
 * Only after being away 30 seconds or more: a quick switch to another tab and back reads nothing, so the desk isn't
 * read again on every alt-tab. Only lists on screen are read (the query library's rule); one that is off screen reads
 * the next time it shows. A query can still opt out with `refetchOnWindowFocus: false` (the merge preview does).
 *
 * Open windows are safe: their fields are set from the record when it opens, and keep what you typed. The customer and
 * equipment pickers take the saved value again only when it changed on the server, as they already do after any save.
 */

export const AWAY_BEFORE_REFRESH_MS = 30_000;

/** The desk's query defaults: lists are fresh for 8 seconds, one retry, and read again on coming back to the tab. */
export const QUERY_DEFAULTS = { staleTime: 8_000, retry: 1, refetchOnWindowFocus: true } as const;

type VisibilityDoc = { visibilityState: string };
type EventTarget = {
  addEventListener: (type: string, fn: () => void, capture?: boolean) => void;
  removeEventListener: (type: string, fn: () => void) => void;
};

/**
 * The focus listener for the query library's focusManager: it says "focus came back" only when the page was hidden at
 * least `minAwayMs`. It never reports the page as unfocused, so retries and saves carry on in a hidden tab as before.
 */
export function returnRefreshListener({
  minAwayMs = AWAY_BEFORE_REFRESH_MS,
  now = () => Date.now(),
  doc = globalThis.document as VisibilityDoc | undefined,
  target = globalThis.window as unknown as EventTarget | undefined,
}: { minAwayMs?: number; now?: () => number; doc?: VisibilityDoc; target?: EventTarget } = {}) {
  return (handleFocus: (focused?: boolean) => void): (() => void) | undefined => {
    if (!doc || !target?.addEventListener) return undefined;
    let hiddenAt: number | null = doc.visibilityState === "hidden" ? now() : null;
    const listener = () => {
      if (doc.visibilityState === "hidden") {
        hiddenAt ??= now();
        return;
      }
      if (hiddenAt == null) return;
      const away = now() - hiddenAt;
      hiddenAt = null;
      if (away >= minAwayMs) handleFocus();
    };
    target.addEventListener("visibilitychange", listener, false);
    return () => target.removeEventListener("visibilitychange", listener);
  };
}
