import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export function isInsideCombo(target: EventTarget | null): boolean {
  const node = target as Node | null;
  const el = node instanceof Element ? node : node?.parentElement;
  if (!el || typeof el.closest !== "function") return false;
  return !!el.closest("[data-combo-popover]");
}

export function preventIfCombo(event: { target: EventTarget | null; preventDefault: () => void }) {
  if (isInsideCombo(event.target)) event.preventDefault();
}

/** Escape closes the open picker first. The dialog or sheet stays up. */
export function closeComboOnEscape(event: { preventDefault: () => void }) {
  if (typeof document === "undefined") return;
  if (!document.querySelector("[data-combo-popover]")) return;
  event.preventDefault();
  document.dispatchEvent(new Event("desk-close-combo"));
}

export function PopoverContent({
  className,
  align = "start",
  sideOffset = 4,
  style,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        data-combo-popover=""
        style={{ pointerEvents: "auto", zIndex: 500, ...style }}
        className={cn(
          "z-[500] max-h-[70vh] w-[var(--radix-popover-trigger-width)] overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-soft outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
