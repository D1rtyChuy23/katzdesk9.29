import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getCostAccess, setCostAccess } from "@/lib/ops/part-pricing-api";
import { COST_ROLES, type CostRole } from "@/lib/ops/cost-access";
import { Button } from "@/components/ui/button";

/**
 * Who sees our cost and margin (Chuy, 11/20). An Admin always does; each other role only when it is ticked here. None is
 * ticked to start. The Labor Cost Rate stays Admin only whatever is ticked.
 */
export function CostAccessEditor() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["cost-access"], queryFn: () => getCostAccess() });
  const [roles, setRoles] = useState<CostRole[]>([]);
  useEffect(() => {
    if (q.data) setRoles(q.data.roles);
  }, [q.data]);
  const save = useMutation({
    mutationFn: () => setCostAccess({ data: { roles } }),
    onSuccess: (next) => {
      qc.setQueryData(["cost-access"], next);
      void qc.invalidateQueries({ queryKey: ["parts"] });
      toast.success(next.roles.length ? `Cost and margin shown to Admins and ${next.roles.length} more role(s)` : "Cost and margin shown to Admins only");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });
  if (!q.data?.canEdit) return null;
  const changed = [...roles].sort().join() !== [...q.data.roles].sort().join();
  return (
    <section className="rounded-xl border border-border bg-card p-5" data-testid="cost-access">
      <h2 className="font-display text-xl">Who Sees Cost and Margin</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Our cost, the Mfr List Price, Our Discount Rule and margins. Admins always see them; tick a role to show them to it too. An unticked role doesn't get
        the numbers at all. The Labor Cost Rate stays Admin only.
      </p>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        {COST_ROLES.map((r) => (
          <label key={r.role} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={roles.includes(r.role)}
              onChange={(e) => setRoles((cur) => (e.target.checked ? [...cur, r.role] : cur.filter((x) => x !== r.role)))}
              data-testid={`cost-access-${r.role}`}
            />
            {r.label}
          </label>
        ))}
      </div>
      <div className="mt-4">
        <Button type="button" disabled={save.isPending || !changed} onClick={() => save.mutate()} data-testid="cost-access-save">
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </section>
  );
}
