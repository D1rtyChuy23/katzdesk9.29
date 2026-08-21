import { useEffect, useState } from "react";
import { SelectField } from "@/components/ui/select-field";
import type { DeskSortId, DeskSortOption } from "@/lib/ops/sort";
import { cn } from "@/lib/utils";

export function SortSelect({
  value,
  onChange,
  options,
  className,
}: {
  value: DeskSortId;
  onChange: (v: DeskSortId) => void;
  options: DeskSortOption[];
  className?: string;
}) {
  return (
    <label className={cn("flex max-w-full min-w-0 items-center gap-2", className)}>
      <span className="shrink-0 text-xs font-medium tracking-wide text-muted-foreground uppercase">Sort</span>
      <SelectField
        aria-label="Sort this list"
        value={value}
        onChange={(e) => onChange(e.target.value as DeskSortId)}
        className="h-9 min-w-0 flex-1 rounded-full pr-8"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </SelectField>
    </label>
  );
}

export function useDeskSort(pageKey: string, fallback: DeskSortId): [DeskSortId, (v: DeskSortId) => void] {
  const storageKey = `katz-sort-${pageKey}`;
  const [sort, setSort] = useState<DeskSortId>(fallback);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) setSort(saved as DeskSortId);
    } catch {
      /* private mode */
    }
    setHydrated(true);
  }, [storageKey]);
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(storageKey, sort);
    } catch {
      /* private mode */
    }
  }, [storageKey, sort, hydrated]);
  return [sort, setSort];
}
