import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { closeComboOnEscape, preventIfCombo } from "@/components/ui/popover";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

let pageLocks = 0;
let pageOverflow = "";

/** Lock the page behind a bubble without blocking wheel events on portaled lists. */
export function PageScrollLock() {
  React.useEffect(() => {
    const root = document.documentElement;
    if (pageLocks === 0) pageOverflow = root.style.overflow;
    pageLocks += 1;
    root.style.overflow = "hidden";
    return () => {
      pageLocks -= 1;
      if (pageLocks === 0) root.style.overflow = pageOverflow;
    };
  }, []);
  return null;
}

export function DialogContent({
  className,
  children,
  style,
  onPointerDownOutside,
  onFocusOutside,
  onInteractOutside,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      {/* Plain overlay — not Dialog.Overlay — so react-remove-scroll does not cancel wheel events on lists portaled to the body. */}
      <div className="fixed inset-0 z-50 bg-ink/40" style={{ pointerEvents: "auto" }} />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-20 left-1/2 z-[70] flex w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className,
        )}
        style={{ pointerEvents: "auto", maxHeight: "calc(100dvh - 5.75rem)", overflow: "hidden", ...style }}
        onPointerDownOutside={(e) => {
          preventIfCombo(e);
          onPointerDownOutside?.(e);
        }}
        onFocusOutside={(e) => {
          preventIfCombo(e);
          onFocusOutside?.(e);
        }}
        onInteractOutside={(e) => {
          preventIfCombo(e);
          onInteractOutside?.(e);
        }}
        onEscapeKeyDown={(e) => {
          closeComboOnEscape(e);
        }}
        {...props}
      >
        <PageScrollLock />
        <div
          data-dialog-scroll
          className="min-h-0 overflow-y-auto overscroll-contain p-5"
          style={{ maxHeight: "calc(100dvh - 5.75rem)", touchAction: "pan-y" }}
        >
          {children}
        </div>
        <DialogPrimitive.Close className="absolute top-3 right-3 z-30 rounded-sm bg-card/80 p-1 text-muted-foreground hover:bg-muted">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("font-display text-xl font-medium tracking-tight", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("mt-1 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}
