import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";
import { createDeal } from "@/lib/ops/api";
import { OWNERSHIP_CHOICES } from "@/lib/ops/deal-board";
import { mergeMachineSpecs, type MachineSpec } from "@/lib/ops/machines";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { CustomerCombo, EquipmentMultiCombo } from "./directory-fields";
import { RepSelect } from "./rep-select";
import { SelectField } from "@/components/ui/select-field";

/**
 * Create A New Deal: one account, a rep, and as many machines as the deal has. Each machine is marked Sold, Loan or
 * Lease here; serial, configuration and Confirm are on the deal once it is open.
 */
export function NewDealDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (id: number) => void }) {
  const qc = useQueryClient();
  const [customer, setCustomer] = useState("");
  const [producer, setProducer] = useState("");
  const [specs, setSpecs] = useState<MachineSpec[]>([]);
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);

  const reset = () => {
    setCustomer("");
    setProducer("");
    setSpecs([]);
    setAmount("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-xl" data-testid="new-deal">
        <DialogTitle>Create A New Deal</DialogTitle>
        <DialogDescription>Add every machine on the deal and mark each one Sold, Loan or Lease.</DialogDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!customer.trim() || pending) return;
            const raw = amount.replace(/[$,]/g, "").trim();
            const value = raw ? Number(raw) : undefined;
            setPending(true);
            try {
              const row = await createDeal({
                data: {
                  customer: customer.trim(),
                  producer: producer || undefined,
                  machines: specs.length ? specs : undefined,
                  amount: value != null && Number.isFinite(value) ? value : undefined,
                },
              });
              void qc.invalidateQueries({ queryKey: ["deals"] });
              void qc.invalidateQueries({ queryKey: ["dashboard"] });
              toast.success("Deal added");
              onOpenChange(false);
              reset();
              onCreated(row.id);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not add the deal");
            } finally {
              setPending(false);
            }
          }}
        >
          <CustomerCombo name="customer" label="Customer" value={customer} onChange={setCustomer} required />
          <RepSelect name="producer" label="Rep" value={producer} onChange={setProducer} />
          <EquipmentMultiCombo
            label="Equipment"
            name="newDealModel"
            values={specs.map((s) => s.equipment)}
            hideChips
            placeholder={specs.length ? "Add another machine…" : "Pick a model…"}
            onChange={(next) => setSpecs(mergeMachineSpecs(next, specs))}
          />
          {specs.length ? (
            <ul className="divide-y divide-border rounded-lg border border-border" data-testid="new-deal-machines">
              {specs.map((s, index) => (
                <li key={`${s.equipment}-${index}`} className="flex flex-wrap items-center gap-2 px-3 py-2" data-testid="new-deal-machine">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium" title={s.equipment}>
                    {s.equipment}
                  </span>
                  <SelectField
                    aria-label={`Ownership for ${s.equipment}`}
                    data-testid="new-deal-ownership"
                    className="h-9 w-[7.5rem] normal-case"
                    value={s.ownership === "Sold" || s.ownership === "Loaned" || s.ownership === "Leased" ? s.ownership : ""}
                    allowEmpty
                    emptyLabel="Choose"
                    onChange={(e) => setSpecs(specs.map((x, i) => (i === index ? { ...x, ownership: e.target.value } : x)))}
                  >
                    {OWNERSHIP_CHOICES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </SelectField>
                  <button
                    type="button"
                    aria-label={`Remove ${s.equipment}`}
                    className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => setSpecs(specs.filter((_, i) => i !== index))}
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div>
            <Label htmlFor="new-deal-amount">Equipment Package Amount ($)</Label>
            <Input id="new-deal-amount" className="mt-1" inputMode="decimal" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending || !customer.trim()} data-testid="new-deal-create">
              {pending ? "Creating…" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
