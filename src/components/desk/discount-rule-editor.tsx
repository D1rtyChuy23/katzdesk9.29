import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getDiscountRule, setDiscountRule } from "@/lib/ops/part-pricing-api";
import { cleanRule, ruleLabel } from "@/lib/ops/part-pricing";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Our Discount Rule: what we pay a manufacturer, as percent off its price or a fixed amount off per unit. It sets the
 * cost on every ticket part line, and that cost, sell, discount and margin are stored when the ticket is invoiced.
 */
export function DiscountRuleEditor() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["discount-rule"], queryFn: () => getDiscountRule() });
  const [mode, setMode] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => {
    if (!q.data) return;
    setMode(q.data.rule?.mode ?? "percent");
    setValue(q.data.rule ? String(q.data.rule.value) : "");
    setNote(q.data.rule?.note ?? "");
  }, [q.data]);
  const typed = cleanRule({ mode, value, note });
  const save = useMutation({
    mutationFn: () => setDiscountRule({ data: { mode, value, note } }),
    onSuccess: (next) => {
      qc.setQueryData(["discount-rule"], next);
      void qc.invalidateQueries({ queryKey: ["charges"] });
      void qc.invalidateQueries({ queryKey: ["parts-profit"] });
      toast.success(next.rule ? `Our Discount Rule: ${next.label}` : "Our Discount Rule cleared");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });
  if (!q.data) return null;
  const canEdit = q.data.canEdit;
  return (
    <section className="rounded-xl border border-border bg-card p-5" data-testid="discount-rule">
      <h2 className="font-display text-xl">Our Discount Rule</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        What we pay the manufacturer: percent off the manufacturer price, or a fixed amount off it per unit. It sets the cost on ticket part lines; when a
        ticket is invoiced, its cost, sell, discount and margin are stored. A part with no manufacturer price uses its NetSuite Purchase Price.
      </p>
      <p className="mt-3 text-sm">
        Now: <span className="font-medium" data-testid="discount-rule-now">{q.data.label}</span>
      </p>
      {canEdit ? (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Rule</p>
            <div className="mt-1 flex gap-1.5" role="group" aria-label="Rule type">
              {(["percent", "fixed"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  className={cn("h-9 rounded-full px-3 text-sm font-medium", mode === m ? "bg-ink text-ink-foreground" : "bg-secondary text-foreground")}
                  data-testid={`discount-rule-${m}`}
                >
                  {m === "percent" ? "Percent Off" : "Fixed Amount Off"}
                </button>
              ))}
            </div>
          </div>
          <div className="w-32">
            <Label htmlFor="discount-rule-value">{mode === "percent" ? "Percent (%)" : "Amount ($)"}</Label>
            <Input id="discount-rule-value" className="mt-1" inputMode="decimal" value={value} placeholder="None" onChange={(e) => setValue(e.target.value)} data-testid="discount-rule-value" />
          </div>
          <div className="min-w-[14rem] flex-1">
            <Label htmlFor="discount-rule-note">Note</Label>
            <Input id="discount-rule-note" className="mt-1" value={note} maxLength={300} placeholder="e.g. Eversys dealer agreement 2027" onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button type="button" disabled={save.isPending || "error" in typed} onClick={() => save.mutate()} data-testid="discount-rule-save">
            {save.isPending ? "Saving…" : "Save Rule"}
          </Button>
          <p className="w-full text-xs text-muted-foreground">
            {"error" in typed ? <span className="text-destructive">{typed.error}</span> : `Saves as: ${ruleLabel(typed.rule)}`}
          </p>
        </div>
      ) : null}
    </section>
  );
}
