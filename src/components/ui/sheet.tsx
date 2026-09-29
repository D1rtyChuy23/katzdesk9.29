import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { closeComboOnEscape, preventIfCombo } from "@/components/ui/popover";
import { PageScrollLock } from "@/components/ui/dialog";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({
  className,
  children,
  side = "right",
  onPointerDownOutside,
  onFocusOutside,
  onInteractOutside,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { side?: "right" | "left" }) {
  return (
    <DialogPrimitive.Portal>
      <div className="fixed inset-0 z-50 bg-ink/40" style={{ pointerEvents: "auto" }} />
      <DialogPrimitive.Content
        className={cn(
          "sheet-panel fixed inset-y-0 top-0 z-[70] flex h-dvh max-h-dvh w-full flex-col overflow-hidden overscroll-none border-border bg-card shadow-soft focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out sm:max-w-xl",
          side === "right"
            ? "right-0 border-l data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right"
            : "left-0 border-r data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
          className,
        )}
        style={{ pointerEvents: "auto" }}
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
        {children}
        <DialogPrimitive.Close className="absolute top-3 right-3 z-10 rounded-sm p-1 text-muted-foreground hover:bg-muted">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("shrink-0 border-b border-border px-5 py-4 pr-12", className)} {...props} />;
}

export function SheetBody({ className, style, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "sheet-scroll min-h-0 flex-1 overflow-y-scroll overscroll-contain",
        className,
      )}
      style={{ touchAction: "pan-y", ...style }}
      {...props}
    />
  );
}

export function SheetTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("font-display text-xl font-medium tracking-tight", className)}
      {...props}
    />
  );
}
