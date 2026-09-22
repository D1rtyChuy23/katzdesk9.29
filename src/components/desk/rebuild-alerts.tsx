import { Link } from "@tanstack/react-router";
import type { FlaggedRow } from "@/lib/ops/types";
import { OpenLink } from "./open-link";
import { Badge } from "@/components/ui/badge";
import { formatShortDate } from "@/lib/ops/clock";

export function RebuildAlerts({ rows }: { rows: FlaggedRow[] }) {
  if (!rows.length) return null;
  return (
    <div className="min-w-0 rounded-xl border border-destructive/30 bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h2 className="font-display text-xl leading-tight">Rebuild</h2>
          <p className="text-[11px] text-muted-foreground">
            Overdue or waiting more than 5 days. Field Coming due is unchanged.
          </p>
        </div>
        <Link to="/rebuilds" className="text-xs text-muted-foreground hover:text-foreground">
          Open rebuilds
        </Link>
      </div>
      <ul className="mt-3 divide-y divide-border">
        {rows.slice(0, 8).map((r) => (
          <li key={r.id} className="py-2">
            <div className="flex items-start justify-between gap-2">
              <OpenLink entityType="rebuild" id={r.id} className="min-w-0 font-medium hover:underline">
                {r.detail || r.customer}
              </OpenLink>
              <Badge variant={r.flag.level === "danger" ? "danger" : "warn"}>{r.flag.label}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {r.customer} · {r.technician || "No owner"}
              {r.scheduled ? ` · target ${formatShortDate(r.scheduled)}` : ""} · {r.status}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
