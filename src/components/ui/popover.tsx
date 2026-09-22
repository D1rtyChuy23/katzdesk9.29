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

export function PopoverContent({
  className,
  align = "start",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  const [container, setContainer] = React.useState<HTMLElement | undefined>(undefined);
  React.useLayoutEffect(() => {
    const sheet = document.querySelector(".sheet-panel") as HTMLElement | null;
    setContainer(sheet ?? undefined);
  }, []);
  return (
    <PopoverPrimitive.Portal container={container}>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        data-combo-popover=""
        className={cn(
          "z-[80] w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-soft outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
