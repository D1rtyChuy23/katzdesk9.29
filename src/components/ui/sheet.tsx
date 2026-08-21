import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { preventIfCombo } from "@/components/ui/popover";

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
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 flex h-full w-full flex-col overflow-y-auto border-border bg-card shadow-soft focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out sm:max-w-xl",
          side === "right"
            ? "top-0 right-0 border-l data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right"
            : "top-0 left-0 border-r data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
          className,
        )}
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
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute top-3 right-3 rounded-sm p-1 text-muted-foreground hover:bg-muted">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("border-b border-border px-5 py-4 pr-12", className)} {...props} />;
}

export function SheetTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("font-display text-xl font-medium tracking-tight", className)}
      {...props}
    />
  );
}
