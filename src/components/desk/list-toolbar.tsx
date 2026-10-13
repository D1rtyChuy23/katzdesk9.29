import type { ComponentProps, ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { cn } from "@/lib/utils";

/**
 * The one search-and-filter row, used on every list page: search on the left, filters in line with it.
 * Every control in the row is the same height (36px). Chips are FilterChip; pick-lists are ToolbarSelect; the
 * sort is SortSelect. A page does not build its own row.
 */
export function ListToolbar({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("mt-4 flex flex-wrap items-center gap-2", className)} data-testid="list-toolbar" {...props}>
      {children}
    </div>
  );
}

/** The search box that starts the row. Same width, height and icon on every page. */
export function ToolbarSearch({
  value,
  onChange,
  placeholder,
  label,
  testId,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** For screen readers; defaults to the placeholder without its trailing dots. */
  label?: string;
  testId?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative w-56 shrink-0", className)} data-toolbar-search="">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label ?? placeholder.replace(/[….]+$/, "")}
        className="h-9 pl-9"
        data-testid={testId}
      />
    </div>
  );
}

/** Shape of a pick-list in the row: the same pill as the chips and the sort. Pass it to filters that take a className. */
export const TOOLBAR_SELECT = "h-9 w-auto max-w-56 shrink-0 rounded-full pr-8";

/** A pick-list filter in the row. */
export function ToolbarSelect({ className, ...props }: ComponentProps<typeof SelectField>) {
  return <SelectField className={cn(TOOLBAR_SELECT, className)} {...props} />;
}

/** A small count or note at the end of the row ("12 shown"). */
export function ToolbarNote({ children, ...props }: { children: ReactNode } & ComponentProps<"span">) {
  return (
    <span className="text-xs text-muted-foreground" {...props}>
      {children}
    </span>
  );
}
