import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getLaborRate, setLaborRate } from "@/lib/ops/part-pricing-api";
import { cleanLaborRate } from "@/lib/ops/labor-cost";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

/**
 * The blended labor cost rate (Chuy, 11/20): what an hour of a tech's time costs us, one rate for every tech. Labor
 * cost on a job is its billed labor hours × this rate. Only an Admin sees or changes the number.
 */
export function LaborRateEditor() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["labor-rate"], queryFn: () => getLaborRate() });
  const [value, setValue] = useState("");
  useEffect(() => {
    if (q.data) setValue(q.data.rate != null ? String(q.data.rate) : "");
  }, [q.data]);
  const typed = cleanLaborRate(value);
  const save = useMutation({
    mutationFn: () => setLaborRate({ data: { rate: value } }),
    onSuccess: (next) => {
      qc.setQueryData(["labor-rate"], next);
      void qc.invalidateQueries({ queryKey: ["charges"] });
      void qc.invalidateQueries({ queryKey: ["parts-profit"] });
      toast.success(next.rate != null ? `Labor cost rate: $${next.rate.toFixed(2)} an hour` : "Labor cost rate cleared");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });
  if (!q.data?.canEdit) return null;
  return (
    <section className="rounded-xl border border-border bg-card p-5" data-testid="labor-rate">
      <h2 className="font-display text-xl">Labor Cost Rate</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        What an hour of labor costs us, one blended rate for every tech. Labor cost on a job is its billed labor hours × this rate. Only an Admin sees this
        number; everyone else sees the cost and margin it gives. With no rate, labor cost shows as not set.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="w-36">
          <Label htmlFor="labor-rate-value">Dollars per hour</Label>
          <Input id="labor-rate-value" className="mt-1" inputMode="decimal" value={value} placeholder="Not set" onChange={(e) => setValue(e.target.value)} data-testid="labor-rate-value" />
        </div>
        <Button type="button" disabled={save.isPending || "error" in typed} onClick={() => save.mutate()} data-testid="labor-rate-save">
          {save.isPending ? "Saving…" : "Save Rate"}
        </Button>
        <p className="w-full text-xs text-muted-foreground">
          {"error" in typed ? <span className="text-destructive">{typed.error}</span> : typed.rate != null ? `Saves as: $${typed.rate.toFixed(2)} an hour` : "Saves as: not set"}
        </p>
      </div>
    </section>
  );
}
