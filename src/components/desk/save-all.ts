import { createContext, useContext, useEffect, useRef } from "react";

/**
 * One Save for a window with tabs (the install window). Each part that holds typed-but-unsaved edits registers how to
 * store them; Save stores every part's edits, then the window's own form. Outside such a window there is no context,
 * and each part keeps its own save buttons.
 */
export type SaveAll = {
  /** Store everything the window holds. */
  save: () => void;
  /**
   * Store everything, then wait until every save has finished. False when one failed (its message is already shown).
   * The Equipment Form button uses it, so the form opens with what was just typed.
   */
  saveAndWait: () => Promise<boolean>;
  pending: boolean;
  /** Called by Save: store this part's unsaved edits, quietly (Save says "Saved" once). Returns the unregister. */
  register: (flush: () => void, opts?: FlushOptions) => () => void;
  /** Hides the window's Save bar while a part shows its own (the pre-inspection's Save / Next machine bar). */
  hideBar: () => () => void;
};

export type FlushOptions = {
  /** Also when the window closes (X, Escape, a click outside), which stores the window's own form too. */
  onClose?: boolean;
};

const SaveAllContext = createContext<SaveAll | null>(null);

export const SaveAllProvider = SaveAllContext.Provider;

export function useSaveAll(): SaveAll | null {
  return useContext(SaveAllContext);
}

/** Store this part's unsaved edits when the window's Save is pressed. The newest `flush` is the one called. */
export function useFlushOnSave(flush: () => void, opts?: FlushOptions): void {
  const ctx = useContext(SaveAllContext);
  const latest = useRef(flush);
  latest.current = flush;
  const register = ctx?.register;
  const onClose = !!opts?.onClose;
  useEffect(() => register?.(() => latest.current(), { onClose }), [register, onClose]);
}

/** While `hide` is true, the window's Save bar steps aside for this part's own. */
export function useHideSaveBar(hide: boolean): void {
  const hideBar = useContext(SaveAllContext)?.hideBar;
  useEffect(() => (hide && hideBar ? hideBar() : undefined), [hide, hideBar]);
}
