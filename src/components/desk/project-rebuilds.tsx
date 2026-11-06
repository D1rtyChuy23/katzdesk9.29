import { useQuery } from "@tanstack/react-query";
import { listProjectRebuilds } from "@/lib/ops/rebuild-link-api";
import { lineCount, money } from "@/lib/ops/rebuild-link";
import { OpenLink } from "./open-link";

/**
 * On a ticket's or an install's billing tab: the rebuilds linked to it (11/6), which bill here, with their lines on its
 * bill. Nothing shows when none is linked, or for someone who doesn't read its billing.
 */
export function ProjectRebuilds({ type, id, inset = false }: { type: "service" | "tlc" | "install"; id: number; inset?: boolean }) {
  const q = useQuery({ queryKey: ["project-rebuilds", type, id], queryFn: () => listProjectRebuilds({ data: { type, id } }), retry: false });
  const rows = q.data ?? [];
  if (!rows.length) return null;
  const bill = type === "install" ? "this install's invoice" : "this ticket's charges";
  return (
    <section className={inset ? "mt-5" : "border-b border-border p-5"} data-testid="project-rebuilds">
      <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Rebuilds billed here</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Linked on the rebuild&apos;s Details. Their lines are on {bill}; unlinking the rebuild takes them back.
      </p>
      <ul className="mt-2 space-y-1.5">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm" data-testid="project-rebuild">
            <span>
              Rebuild #{r.id}
              {r.title ? ` · ${r.title}` : ""}
              <span className="text-xs text-muted-foreground">
                {" "}
                · {r.removed ? "off the board" : r.status} · {r.lines ? `${lineCount(r.lines)} (${money(r.total)}) on ${bill}` : "none of its lines here yet"}
                {/* Its own invoice's lines on a Sales Order in NetSuite (11/6): they bill there, not here. */}
                {r.onSalesOrder ? ` · its own invoice's ${lineCount(r.onSalesOrder)} ${r.onSalesOrder === 1 ? "is" : "are"} on a Sales Order` : ""}
              </span>
            </span>
            <OpenLink entityType="rebuild" id={r.id} className="text-xs text-primary hover:underline max-sm:inline-flex max-sm:min-h-10 max-sm:items-center">
              Open rebuild
            </OpenLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
