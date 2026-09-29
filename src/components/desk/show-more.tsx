import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Render long lists in pages instead of all at once (Customers had 2,600+ rows in one pass).
 * The window resets to the first page whenever `resetKey` changes (new search, filter, or sort).
 */
export function useShowMore<T>(list: T[], resetKey: unknown, step = 60) {
  const [limit, setLimit] = useState(step);
  useEffect(() => {
    setLimit(step);
  }, [resetKey, step]);
  return {
    visible: list.length > limit ? list.slice(0, limit) : list,
    remaining: Math.max(0, list.length - limit),
    showMore: () => setLimit((n) => n + step * 2),
    step,
  };
}

export function ShowMoreButton({
  remaining,
  onClick,
  label = "rows",
  as: Tag = "div",
}: {
  remaining: number;
  onClick: () => void;
  label?: string;
  as?: "div" | "li";
}) {
  if (remaining <= 0) return null;
  return (
    <Tag className="flex justify-center border-t border-border px-4 py-3">
      <Button type="button" variant="outline" size="sm" onClick={onClick}>
        Show {remaining} more {label}
      </Button>
    </Tag>
  );
}
