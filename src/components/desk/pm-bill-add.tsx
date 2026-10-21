import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { getBillSuggestions } from "@/lib/ops/pm-bill-api";
import { sourceKeyTaken, type BillSuggestLine } from "@/lib/ops/pm-bill";
import type { PartRef } from "@/lib/ops/charges";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export type AddedPmLine = {
  item: string;
  description: string;
  qty: number;
  rate: number;
  part: PartRef | null;
  sourceKey: string;
};

/** Checklist of kits and extra parts from the PMs stacked on this ticket. Hidden when nothing is stacked. */
export function AddPmParts({
  jobId,
  draftKeys,
  draftCount,
  onAdd,
}: {
  jobId: number;
  draftKeys: string[];
  draftCount: number;
  onAdd: (lines: AddedPmLine[]) => void;
}) {
  const q = useQuery({
    queryKey: ["pm-bill", jobId],
    queryFn: () => getBillSuggestions({ data: { jobId } }),
  });
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState<string | null>(null);
  const data = q.data;
  const draftKey = draftKeys.join("\n");
  const lines = useMemo(() => data?.groups.flatMap((g) => g.lines) ?? [], [data]);
  const blocked = (line: BillSuggestLine) => !!line.reason || sourceKeyTaken(draftKeys, line.sourceKey) || line.alreadyOn;

  useEffect(() => {
    if (!open) return;
    const keys = draftKey ? draftKey.split("\n") : [];
    const next: Record<string, boolean> = {};
    for (const line of lines) next[line.sourceKey] = !line.reason && !sourceKeyTaken(keys, line.sourceKey) && !line.alreadyOn;
    setPicked(next);
  }, [open, lines, draftKey]);

  if (!data?.stacked) return null;
  const add = () => {
    const chosen = lines.filter((line) => picked[line.sourceKey] && !blocked(line));
    const room = Math.max(0, 200 - draftCount);
    const take = chosen.slice(0, room);
    if (chosen.length > take.length) setNote(`This bill can hold 200 lines. Only the first ${take.length} were added.`);
    else setNote(null);
    if (take.length) {
      onAdd(take.map((line) => ({ item: line.item, description: line.description, qty: line.qty, rate: line.rate, part: line.part, sourceKey: line.sourceKey })));
    }
    if (chosen.length <= take.length) setOpen(false);
  };
  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => { setNote(null); setOpen(true); }} data-testid="add-pm-parts">
        <Plus className="size-4" />
        Add parts from stacked PMs
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogTitle>Add parts from stacked PMs</DialogTitle>
          <DialogDescription>Kits that were checked in, and extra parts marked to bill.</DialogDescription>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto">
            {data.groups.length ? data.groups.map((g) => (
              <section key={`${g.pmId}-${g.machine ?? "pm"}`}>
                <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  PM #{g.pmId}{g.machine ? ` · ${g.machine}` : ""}
                </p>
                {g.note ? <p className="mt-1 text-sm text-muted-foreground">{g.note}</p> : null}
                <ul className="mt-1 space-y-1">
                  {g.lines.map((line) => {
                    const off = blocked(line);
                    return (
                      <li key={line.sourceKey}>
                        <label className={`flex items-start gap-2 text-sm ${off ? "text-muted-foreground opacity-60" : ""}`}>
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={!off && !!picked[line.sourceKey]}
                            disabled={off}
                            onChange={(e) => setPicked((cur) => ({ ...cur, [line.sourceKey]: e.target.checked }))}
                          />
                          <span>
                            {line.qty} × {line.item}
                            <span className="block text-xs text-muted-foreground">{line.description}</span>
                            {line.reason ? <span className="block text-xs">{line.reason}</span> : null}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )) : (
              <p className="text-sm text-muted-foreground">Nothing to add from the stacked PMs.</p>
            )}
          </div>
          {note ? <p className="text-xs text-warning" data-testid="bill-cap">{note}</p> : null}
          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={add}>Add selected</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
