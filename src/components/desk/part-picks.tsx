import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MapPin, Tags } from "lucide-react";
import { toast } from "sonner";
import { movePartBins, setPartsClass, type PartRow } from "@/lib/ops/parts-api";
import { BIN_LABEL, BIN_MAX, BIN_PIECES, binText, binsAfterMove, cleanBinValue, sameBins, type BinValues } from "@/lib/ops/part-bins";
import { PART_CLASSES } from "@/lib/ops/part-pricing";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { cn } from "@/lib/utils";

/*
 * What an Admin does to several parts picked on Parts at once (10/28): Move Bin and Set Class. Admin only for now,
 * like the same edits on one part.
 */

const count = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
const blankTyped = { rack: "", shelf: "", bin: "" };

/**
 * Move Bin: type where the picked parts go. Each piece typed goes on every part and a blank box keeps each part's
 * own, so a Rack alone moves a whole shelf to another rack and keeps each part's shelf and bin. Every part shown on
 * the list lists its bin now and after before anything is saved.
 */
export function MoveBinsDialog({
  open,
  ids,
  parts,
  onClose,
  onMoved,
}: {
  open: boolean;
  /** Every picked part. */
  ids: number[];
  /** The picked parts the list shows now (a filter change keeps the picks; it may not show them all). */
  parts: PartRow[];
  onClose: () => void;
  onMoved: () => void;
}) {
  const [typed, setTyped] = useState(blankTyped);
  const clean: BinValues = { rack: cleanBinValue(typed.rack), shelf: cleanBinValue(typed.shelf), bin: cleanBinValue(typed.bin) };
  const any = !!(clean.rack || clean.shelf || clean.bin);
  const lines = parts.map((p) => {
    const old: BinValues = { rack: p.binRack, shelf: p.binShelf, bin: p.binBin };
    const next = binsAfterMove(old, clean);
    return { p, old, next, moves: any && !sameBins(old, next) };
  });
  const moving = lines.filter((l) => l.moves).length;
  const unseen = Math.max(0, ids.length - parts.length);
  const close = () => {
    setTyped(blankTyped);
    onClose();
  };
  const save = useMutation({
    mutationFn: () => movePartBins({ data: { ids, rack: typed.rack, shelf: typed.shelf, bin: typed.bin } }),
    onSuccess: (r) => {
      const where = binText(clean);
      toast.success(
        [
          `${count(r.moved, "part")} moved${where ? ` to ${where}` : ""}`,
          r.same ? `${count(r.same, "part was", "parts were")} already there` : null,
          r.missing ? `${count(r.missing, "part is", "parts are")} no longer on the list` : null,
        ]
          .filter(Boolean)
          .join("; "),
      );
      close();
      onMoved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not move those parts"),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-xl" data-testid="parts-move-bins">
        <DialogTitle>Move {count(ids.length, "Part")}</DialogTitle>
        <DialogDescription>
          Type where these parts go. A blank box keeps each part's own Rack, Shelf or Bin, so a Rack alone moves a whole shelf and keeps each part's bin.
        </DialogDescription>
        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (any && !save.isPending) save.mutate();
          }}
        >
          <div className="grid grid-cols-3 gap-2">
            {BIN_PIECES.map((k, i) => (
              <label key={k} className="min-w-0 text-xs font-medium text-muted-foreground">
                New {BIN_LABEL[k]}
                <Input
                  value={typed[k]}
                  onChange={(e) => setTyped((t) => ({ ...t, [k]: e.target.value }))}
                  maxLength={BIN_MAX}
                  placeholder="Keep"
                  autoComplete="off"
                  autoFocus={i === 0}
                  className="mt-1 h-9 font-normal"
                  data-testid={`parts-move-${k}`}
                />
              </label>
            ))}
          </div>
          {lines.length ? (
            <ul className="mt-3 max-h-72 divide-y divide-border overflow-auto rounded-lg border border-border text-sm" data-testid="parts-move-lines">
              {lines.map(({ p, old, next, moves }) => (
                <li key={p.id} className="px-3 py-2" data-testid="parts-move-line" data-moves={moves ? "1" : "0"}>
                  <span className="block font-medium break-words">{p.description || p.item}</span>
                  <span className="block text-xs break-all text-muted-foreground">Part # {p.mpn ?? p.sku}</span>
                  <span className="mt-0.5 block text-xs">
                    <span className="text-muted-foreground" data-testid="parts-move-old">
                      {binText(old) ?? "No bin"}
                    </span>
                    {any ? (
                      <>
                        {" → "}
                        <span className={cn(moves ? "font-medium" : "text-muted-foreground")} data-testid="parts-move-new">
                          {moves ? (binText(next) ?? "No bin") : "already there"}
                        </span>
                      </>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {unseen ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {count(unseen, "more picked part is", "more picked parts are")} not on the list right now (a filter hides {unseen === 1 ? "it" : "them"}); {unseen === 1 ? "it moves" : "they move"} the same way.
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={!any || save.isPending} data-testid="parts-move-save">
              <MapPin className="size-4" />
              {save.isPending ? "Moving…" : `Move ${count(ids.length, "Part")}`}
            </Button>
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            {any && lines.length ? (
              <span className="text-xs text-muted-foreground" data-testid="parts-move-summary">
                {moving === lines.length ? `All ${count(lines.length, "part")} shown change` : `${moving} of ${count(lines.length, "part")} shown change`}
              </span>
            ) : null}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Set Class: pick one of the five, then Set Class. Two steps, so a slip of the list doesn't change many parts. */
export function SetClassPicker({ ids, onDone }: { ids: number[]; onDone: () => void }) {
  const [cls, setCls] = useState("");
  const save = useMutation({
    mutationFn: () => setPartsClass({ data: { ids, itemClass: cls } }),
    onSuccess: (r) => {
      toast.success(
        [
          `${count(r.changed, "part")} set to ${cls}`,
          r.same ? `${count(r.same, "part was", "parts were")} already in ${cls}` : null,
          r.missing ? `${count(r.missing, "part is", "parts are")} no longer on the list` : null,
        ]
          .filter(Boolean)
          .join("; "),
      );
      setCls("");
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not change the class"),
  });
  return (
    <span className="flex items-center gap-2">
      <SelectField value={cls} onChange={(e) => setCls(e.target.value)} className="h-9 w-44" aria-label="Class for the selected parts" data-testid="parts-bulk-class">
        <option value="">Class…</option>
        {PART_CLASSES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </SelectField>
      <Button type="button" size="sm" variant="outline" disabled={!cls || save.isPending} onClick={() => save.mutate()} data-testid="parts-bulk-class-save">
        <Tags className="size-4" />
        {save.isPending ? "Setting…" : "Set Class"}
      </Button>
    </span>
  );
}
