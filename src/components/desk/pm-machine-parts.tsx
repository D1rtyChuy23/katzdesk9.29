import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addMachinePart, removeMachinePart, type PmMachinePart } from "@/lib/ops/pm-runbook-api";
import type { BillingItem } from "@/lib/ops/charges";
import { PartPicker } from "./charges-panel";

const when = (by: string | null, at: string) => {
  const d = new Date(at);
  const day = Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return [by, day].filter(Boolean).join(", ");
};

function Row({
  pmId,
  part,
  canChange,
}: {
  pmId: number;
  part: PmMachinePart;
  canChange: boolean;
}) {
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: () => removeMachinePart({ data: { pmId, partId: part.id } }),
    onSuccess: () => {
      toast.success("Part removed");
      void qc.invalidateQueries({ queryKey: ["pm-runbook", pmId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm" data-testid="machine-part">
      <span className="min-w-0 flex-1">
        <span className="font-medium">
          {Number(part.qty)} x {part.item}
        </span>
        {part.description ? <span> — {part.description}</span> : null}
        {!part.billable ? <span className="text-muted-foreground"> · No charge</span> : null}
        {part.note ? <span className="text-muted-foreground"> · {part.note}</span> : null}
        <span className="text-muted-foreground"> · {when(part.addedBy, part.addedAt)}</span>
      </span>
      {canChange ? (
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-40"
          disabled={remove.isPending}
          onClick={() => {
            if (window.confirm(`Remove ${part.item} from this machine?`)) remove.mutate();
          }}
        >
          Remove
        </button>
      ) : null}
    </li>
  );
}

/**
 * Extra parts replaced on one machine. Kits stay in the runbook. Parts added after the PM is completed
 * stay on this list: the service record is written once, when the PM is completed.
 */
export function OtherParts({
  pmId,
  pieceKey,
  parts,
  orphans,
  locked,
  canWrite,
  completed,
}: {
  pmId: number;
  pieceKey: string;
  parts: PmMachinePart[];
  orphans: PmMachinePart[];
  locked: string | null;
  canWrite: boolean;
  completed: boolean;
}) {
  const qc = useQueryClient();
  const [pick, setPick] = useState<BillingItem | null>(null);
  const [qty, setQty] = useState("1");
  const [billable, setBillable] = useState(true);
  const [note, setNote] = useState("");
  const canChange = canWrite && !locked;
  const add = useMutation({
    mutationFn: () => {
      const id = pick?.part?.id;
      if (!id) throw new Error("Pick a part from the Parts list.");
      return addMachinePart({ data: { pmId, pieceKey, billingItemId: id, qty, billable, note } });
    },
    onSuccess: () => {
      setPick(null);
      setQty("1");
      setBillable(true);
      setNote("");
      toast.success("Part added");
      void qc.invalidateQueries({ queryKey: ["pm-runbook", pmId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-2" data-testid="other-parts">
      <h4 className="text-sm font-semibold">Other parts replaced on this machine</h4>
      <p className="text-xs text-muted-foreground">
        Parts from the Parts list, not the kits above.
        {completed ? " Parts added after this PM is completed stay here. The service record was written once and is not updated." : ""}
      </p>
      {locked ? <p className="rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900">{locked}</p> : null}
      {parts.length ? (
        <ul className="grid gap-1.5">
          {parts.map((p) => (
            <Row key={p.id} pmId={pmId} part={p} canChange={canChange} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No extra parts on this machine.</p>
      )}
      {canChange ? (
        <form
          className="grid gap-2 rounded-md border border-border p-2"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <PartPicker id={`machine-part-${pmId}-${pieceKey}`} onPick={setPick} />
          {pick ? <p className="text-sm font-medium">{pick.item}</p> : null}
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-xs">
              Qty
              <Input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" className="h-8 w-20" />
            </label>
            <label className="flex items-center gap-2 pb-1 text-sm">
              <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} />
              Bill this part
            </label>
            <label className="grid min-w-40 flex-1 gap-1 text-xs">
              Note
              <Input value={note} onChange={(e) => setNote(e.target.value)} className="h-8" />
            </label>
            <Button type="submit" size="sm" disabled={!pick?.part?.id || add.isPending}>
              Add
            </Button>
          </div>
        </form>
      ) : null}
      {orphans.length ? (
        <div className="grid gap-1.5">
          <h4 className="text-sm font-semibold">Parts on a line no longer on this PM</h4>
          <ul className="grid gap-1.5">
            {orphans.map((p) => (
              <Row key={p.id} pmId={pmId} part={p} canChange={canChange} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
