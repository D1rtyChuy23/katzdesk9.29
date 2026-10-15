import type { ReactNode } from "react";
import * as Tabs from "@radix-ui/react-tabs";

export type SheetTab<T extends string> = {
  id: T;
  label: string;
  count?: number | null;
  /** A shorter label shown on phones under 375px wide; the full label is still what a screen reader reads. */
  short?: string;
};

/**
 * Phones: a soft shadow at the edge of the tab list while more tabs are off that side (a scroll cue). The shadows are
 * fixed to the visible edges; card-coloured covers ride with the content and hide them once the end is reached, so a
 * list that fits shows none. Backgrounds only, so tab text is never faded.
 */
const PHONE_SCROLL_CUE =
  "max-sm:[background:linear-gradient(to_right,var(--color-card)_50%,transparent)_left_center/2rem_100%_no-repeat_local,linear-gradient(to_left,var(--color-card)_50%,transparent)_right_center/2rem_100%_no-repeat_local,linear-gradient(to_right,color-mix(in_oklab,var(--color-foreground)_20%,transparent),transparent)_left_center/1rem_100%_no-repeat_scroll,linear-gradient(to_left,color-mix(in_oklab,var(--color-foreground)_20%,transparent),transparent)_right_center/1rem_100%_no-repeat_scroll,var(--color-card)]";

/**
 * The tab chrome of a sheet window (the account window and the ticket window): one tab per category, a tab list
 * that stays on top while the panel scrolls and scrolls sideways on a phone, an underline on the open tab, and an
 * optional count after a label. Panels are Radix `Tabs.Content` children. On a phone the tabs are tight (small padding,
 * a small gap before a count, 13px labels and 12px below 375px) so five tabs with counts fit across without scrolling.
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
        className={`sticky top-0 z-10 flex gap-0 overflow-x-auto border-b border-border bg-card px-0.5 pt-2 sm:gap-1 sm:px-3 ${PHONE_SCROLL_CUE}`}
        data-testid={`${testId}-tab-list`}
      >
        {tabs.map((t) => (
          <Tabs.Trigger
            key={t.id}
            value={t.id}
            className="relative shrink-0 rounded-t-md px-1.5 pt-2 pb-2.5 text-sm font-medium max-[375px]:text-xs min-[375px]:max-sm:text-[13px] max-sm:data-[state=active]:after:inset-x-1.5 sm:px-3 text-muted-foreground hover:text-foreground data-[state=active]:text-foreground data-[state=active]:after:absolute data-[state=active]:after:inset-x-2 data-[state=active]:after:bottom-0 data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-primary"
            data-testid={`${testId}-tab-${t.id}`}
          >
            {t.short ? (
              <>
                <span aria-hidden className="min-[375px]:hidden">
                  {t.short}
                </span>
                <span className="max-[375px]:sr-only">{t.label}</span>
              </>
            ) : (
              t.label
            )}
            {t.count != null ? <span className="ml-1 text-xs font-normal text-muted-foreground tabular max-sm:ml-0.5">{t.count}</span> : null}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {children}
    </Tabs.Root>
  );
}
