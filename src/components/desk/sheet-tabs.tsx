import type { ReactNode } from "react";
import * as Tabs from "@radix-ui/react-tabs";

export type SheetTab<T extends string> = { id: T; label: string; count?: number | null };

/**
 * The tab chrome of a sheet window (the account window and the ticket window): one tab per category, a tab list
 * that stays on top while the panel scrolls and scrolls sideways on a phone, an underline on the open tab, and an
 * optional count after a label. Panels are Radix `Tabs.Content` children.
 */
export function SheetTabs<T extends string>({
  value,
  onValueChange,
  tabs,
  label,
  testId,
  children,
}: {
  value: T;
  onValueChange: (value: T) => void;
  tabs: SheetTab<T>[];
  /** Read out for the tab list. */
  label: string;
  /** Test ids: `<testId>-tabs`, `<testId>-tab-list`, `<testId>-tab-<id>`. */
  testId: string;
  children: ReactNode;
}) {
  return (
    <Tabs.Root value={value} onValueChange={(v) => onValueChange(v as T)} className="flex min-h-0 flex-col" data-testid={`${testId}-tabs`}>
      <Tabs.List
        aria-label={label}
        className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-border bg-card px-3 pt-2"
        data-testid={`${testId}-tab-list`}
      >
        {tabs.map((t) => (
          <Tabs.Trigger
            key={t.id}
            value={t.id}
            className="relative shrink-0 rounded-t-md px-3 pt-2 pb-2.5 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:text-foreground data-[state=active]:after:absolute data-[state=active]:after:inset-x-2 data-[state=active]:after:bottom-0 data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-primary"
            data-testid={`${testId}-tab-${t.id}`}
          >
            {t.label}
            {t.count != null ? <span className="ml-1 text-xs font-normal text-muted-foreground tabular">{t.count}</span> : null}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {children}
    </Tabs.Root>
  );
}
