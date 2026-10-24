/**
 * SheetContent's onOpenAutoFocus for a window whose first control is a text box: on phones, focusing it when the
 * window opens pops up the on-screen keyboard over half the window, so the window itself takes focus there instead.
 * sm and up keep Radix's default.
 */
export function phoneSheetFocus(e: Event) {
  if (!window.matchMedia("(width < 40rem)").matches) return;
  e.preventDefault();
  (e.currentTarget instanceof HTMLElement ? e.currentTarget : (e.target as HTMLElement | null))?.focus({ preventScroll: true });
}
