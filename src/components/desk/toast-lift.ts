import { useEffect, useSyncExternalStore } from "react";

/**
 * Toasts show at the bottom of the screen. While a bar of buttons sits there (a window's Save bar, a pre-inspection
 * machine's Save / Next machine), they show just above it instead, so "Saved" never covers the buttons.
 */
let bars = 0;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

/** This bar is on screen along the bottom edge while `on`. */
export function useLiftToasts(on = true): void {
  useEffect(() => {
    if (!on) return;
    bars += 1;
    changed();
    return () => {
      bars -= 1;
      changed();
    };
  }, [on]);
}

/** True while any bottom bar is on screen. */
export function useToastsLifted(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => bars > 0,
    () => false,
  );
}
