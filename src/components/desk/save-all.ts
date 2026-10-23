import { createContext, useContext, useEffect, useRef } from "react";

/**
 * One Save for a window with tabs (the install window). Each part that holds typed-but-unsaved edits registers how to
 * store them; Save stores every part's edits, then the window's own form. Outside such a window there is no context,
 * and each part keeps its own save buttons.
 */
export type SaveAll = {
  /** Store everything the window holds. */
  save: () => void;
  pending: boolean;
  /** Called by Save: store this part's unsaved edits, quietly (Save says "Saved" once). Returns the unregister. */
  register: (flush: () => void) => () => void;
  /** Hides the window's Save bar while a part shows its own (the pre-inspection's Save / Next machine bar). */
  hideBar: () => () => void;
};

const SaveAllContext = createContext<SaveAll | null>(null);

export const SaveAllProvider = SaveAllContext.Provider;

export function useSaveAll(): SaveAll | null {
  return useContext(SaveAllContext);
}

/** Store this part's unsaved edits when the window's Save is pressed. The newest `flush` is the one called. */
export function useFlushOnSave(flush: () => void): void {
  const ctx = useContext(SaveAllContext);
  const latest = useRef(flush);
  latest.current = flush;
  const register = ctx?.register;
  useEffect(() => register?.(() => latest.current()), [register]);
}

/** While `hide` is true, the window's Save bar steps aside for this part's own. */
export function useHideSaveBar(hide: boolean): void {
  const hideBar = useContext(SaveAllContext)?.hideBar;
  useEffect(() => (hide && hideBar ? hideBar() : undefined), [hide, hideBar]);
}
