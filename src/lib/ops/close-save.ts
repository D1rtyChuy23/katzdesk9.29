/**
 * Closing a ticket, PM, install or deal window (Chuy, 11/9). Closing used to save every time, typed in or not.
 * Now it saves only when what the window would send differs from what it showed when it opened. Pure.
 */

/** What a window would save, as one string, whatever order its fields come in. A field sent as undefined isn't sent. */
export function patchKey(patch: unknown): string {
  const tidy = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(tidy);
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      return Object.fromEntries(
        Object.keys(o)
          .filter((k) => o[k] !== undefined)
          .sort()
          .map((k) => [k, tidy(o[k])]),
      );
    }
    return v;
  };
  return JSON.stringify(tidy(patch));
}

export const CLOSE_UNSAVED = "Not saved: a required box is empty. Fill it in, or close again to leave your changes unsaved.";

/**
 * What a close does. `baseline` is what the window would have saved as it opened (null when it wasn't read), `now`
 * what it would save as it closes, `valid` whether its form can save, `warned` whether this close was already refused
 * once.
 *  - "close": nothing changed, or the user closed again after the warning.
 *  - "save": save, then close, as closing always did.
 *  - "warn": a change that can't save. Stay open and say so.
 */
export function closeDecision(a: { baseline: string | null; now: string | null; valid: boolean; warned: boolean }): "close" | "save" | "warn" {
  const changed = a.baseline == null || a.now == null || a.baseline !== a.now;
  if (!changed) return "close";
  if (a.valid) return "save";
  return a.warned ? "close" : "warn";
}
