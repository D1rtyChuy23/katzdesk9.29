import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLiftToasts } from "./toast-lift";

/**
 * The bar along the bottom of a window: Save on the right, anything else on the left. On a phone Save fills the bar and
 * is a 48px target. With `form`, Save is that form's submit button (Enter in its fields saves too) and `onClick` runs
 * first; without it, `onClick` is the save.
 */
export function SaveBar({
  onClick,
  form,
  pending,
  children,
  className,
  testId = "save-bar",
}: {
  onClick: () => void;
  form?: string;
  pending?: boolean;
  children?: ReactNode;
  className?: string;
  testId?: string;
}) {
  useLiftToasts();
  return (
    <div className={cn("flex shrink-0 items-center gap-2 border-t border-border bg-card px-4 py-3 max-sm:px-3", className)} data-testid={testId}>
      {children}
      <Button
        type={form ? "submit" : "button"}
        form={form}
        className="ml-auto min-w-28 max-sm:h-12 max-sm:flex-1 max-sm:text-base"
        onClick={onClick}
        disabled={pending}
        data-testid="save-all"
      >
        {pending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
