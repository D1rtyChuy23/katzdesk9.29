/**
 * The machines on a rebuild (Chuy, 11/2): Warehouse works on several machines at once, so a rebuild lists each one
 * with its serial, or just one. A serial pulls its warehouse unit onto the rebuild, as the rebuild's one serial did.
 * When a refurb is completed, each machine goes into stock at the Staging area, marked needs shop test.
 */
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { pullRebuildMachine, removeRebuildMachine, saveRebuildMachines, type Rebuild, type RebuildMachine } from "@/lib/ops/rebuilds";
import { REFURB_STOCK_PLACE } from "@/lib/ops/rebuild-model";
import { warehouseMayEdit } from "@/lib/ops/warehouse-invoice";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { EquipmentCombo } from "./directory-fields";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

/** A pull waiting for the person's answer: which machine (none for a new one), and the question asked. */
type Reuse = { machineId: number | null; serial: string; model: string; question: string };

/** What the server said for a machine's serial, colored as the serial notice banner is, and where its unit is now. */
function MachineNotice({ machine }: { machine: RebuildMachine }) {
  if (machine.stockedAt) {
    return (
      <p className="mt-1 text-xs text-success" data-testid="rebuild-machine-stocked">
        {machine.notice || `In stock at the ${REFURB_STOCK_PLACE}, needs shop test.`}
      </p>
    );
  }
  const warn = /already assigned|isn't in the warehouse|not found|wasn't (put|added)|moved to rebuild/i.test(machine.notice ?? "");
  return (
    <>
      {machine.notice ? (
        <p className={`mt-1 text-xs ${warn ? "text-warning" : "text-muted-foreground"}`} data-testid="rebuild-machine-notice">
          {machine.notice}
        </p>
      ) : null}
      {machine.moved ? (
        <p className="mt-1 text-xs text-warning" data-testid="rebuild-machine-moved">
          {machine.moved}
        </p>
      ) : null}
    </>
  );
}

export function RebuildMachines({ row, canEdit, warehouse }: { row: Rebuild; canEdit: boolean; warehouse: boolean }) {
  const qc = useQueryClient();
  // Only what the person changed is kept here; everything else shows as the server has it.
  const [models, setModels] = useState<Record<number, string>>({});
  const [serials, setSerials] = useState<Record<number, string>>({});
  const [draft, setDraft] = useState<{ model: string; serial: string } | null>(null);
  const [reuse, setReuse] = useState<Reuse | null>(null);
  // The serial each machine's last pull asked for: an answer for an older one (the box changed meanwhile) is ignored.
  const lastPull = useRef<Record<string, string>>({});
  const closed = row.status === "Completed" || row.status === "Cancelled";
  const editable = canEdit && !closed;
  const refurb = warehouseMayEdit(row.account);

  // The list is read again before an edit is let go, so the old serial or model never shows in between.
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["rebuilds"] }),
      qc.invalidateQueries({ queryKey: ["assets"] }),
      qc.invalidateQueries({ queryKey: ["activity"] }),
    ]).catch(() => undefined);
  /** Lets go of a machine's edits that went to the server, or of all its edits when `sent` is left out; one typed since stays. */
  const forget = (id: number, sent?: { model?: string; serial?: string }) => {
    const keep = (cur: string | undefined, was: string | undefined): cur is string => cur !== undefined && !!sent && (was === undefined || cur.trim() !== was);
    setModels(({ [id]: m, ...rest }) => (keep(m, sent?.model) ? { ...rest, [id]: m } : rest));
    setSerials(({ [id]: v, ...rest }) => (keep(v, sent?.serial) ? { ...rest, [id]: v } : rest));
  };
  /** Closes the confirm only when it is this machine's (another machine's answer leaves it open). */
  const closeReuse = (machineId: number | null) => setReuse((r) => (r && r.machineId === machineId ? null : r));

  const pull = useMutation({
    // A confirm sends the question it answers: the server asks again if the unit moved since. The model goes along,
    // so a model changed and not saved yet isn't lost.
    mutationFn: (o: { machineId: number | null; serial: string; model: string; confirmReuse?: boolean; asked?: string }) =>
      pullRebuildMachine({ data: { id: row.id, machineId: o.machineId, serial: o.serial, model: o.model || null, confirmReuse: o.confirmReuse, asked: o.asked } }),
    onSuccess: async (next, o) => {
      await refresh();
      const key = String(o.machineId ?? "new");
      if (lastPull.current[key] !== o.serial) return;
      closeReuse(o.machineId);
      if (o.machineId == null) setDraft(null);
      else forget(o.machineId, { model: o.model, serial: o.serial });
      const m = o.machineId == null ? next.machines[next.machines.length - 1] : next.machines.find((x) => x.id === o.machineId);
      toast.success(m?.notice || "Serial saved");
    },
    onError: (e, o) => {
      void refresh();
      if (lastPull.current[String(o.machineId ?? "new")] !== o.serial) return;
      const msg = e instanceof Error ? e.message : "Could not check the warehouse";
      if (/already assigned/i.test(msg)) setReuse({ machineId: o.machineId, serial: o.serial, model: o.model, question: msg });
      else {
        closeReuse(o.machineId);
        toast.error(msg);
      }
    },
  });
  const startPull = (machineId: number | null, serial: string, model: string, opts: { confirmReuse?: boolean; asked?: string } = {}) => {
    lastPull.current[String(machineId ?? "new")] = serial.trim();
    pull.mutate({ machineId, serial: serial.trim(), model: model.trim(), ...opts });
  };

  const save = useMutation({
    mutationFn: (sent: { models: Record<number, string>; draft: string | null }) =>
      saveRebuildMachines({
        data: {
          id: row.id,
          machines: [...Object.entries(sent.models).map(([id, model]) => ({ id: Number(id), model })), ...(sent.draft ? [{ id: null, model: sent.draft }] : [])],
        },
      }),
    onSuccess: async (_next, sent) => {
      await refresh();
      for (const [id, model] of Object.entries(sent.models)) forget(Number(id), { model: model.trim() });
      if (sent.draft) setDraft((d) => (d && d.model === sent.draft && !d.serial.trim() ? null : d));
      toast.success("Machines saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save the machines"),
  });

  const remove = useMutation({
    mutationFn: (machineId: number) => removeRebuildMachine({ data: { id: row.id, machineId } }),
    onSuccess: async (out, machineId) => {
      await refresh();
      // The machine is gone, so its edits go too.
      forget(machineId);
      closeReuse(machineId);
      toast.success(out.message ? `Machine taken off. ${out.message}` : "Machine taken off");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not take the machine off"),
  });

  const dirty = Object.keys(models).length > 0 || !!(draft?.model.trim() && !draft.serial.trim());

  return (
    <div className="space-y-3" data-testid="rebuild-machines">
      <div>
        <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Machines</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {refurb
            ? `Each machine on this refurb, with its serial. When it is completed, each one goes into stock at the ${REFURB_STOCK_PLACE}, marked needs shop test.`
            : "Each machine on this rebuild, with its serial."}
        </p>
      </div>
      {!row.machines.length && !draft ? <p className="text-sm text-muted-foreground">No machines yet.</p> : null}
      <ol className="space-y-3">
        {row.machines.map((m, i) => {
          const model = models[m.id] ?? m.model;
          const serial = serials[m.id] ?? m.serial ?? "";
          const fixed = !editable || !!m.stockedAt;
          return (
            <li key={m.id} className="rounded-xl border border-border p-3" data-testid="rebuild-machine">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Machine {i + 1}</span>
                {m.stockedAt ? <Badge variant="success">In stock</Badge> : null}
                {canEdit && !m.stockedAt && row.status !== "Completed" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="ml-auto text-destructive hover:bg-destructive/10"
                    disabled={remove.isPending}
                    data-testid="rebuild-machine-remove"
                    onClick={() => {
                      const what = `${m.model || "this machine"}${m.serial ? ` (SN ${m.serial})` : ""}`;
                      if (!window.confirm(`Take ${what} off this rebuild?${m.assetId ? " Its unit goes back where it was before it was pulled." : ""}`)) return;
                      remove.mutate(m.id);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                    Take off
                  </Button>
                ) : null}
              </div>
              <div className="mt-2 space-y-2">
                {fixed ? (
                  <p className="text-sm" data-testid="rebuild-machine-model">
                    {m.model || "No model"}
                  </p>
                ) : (
                  <EquipmentCombo label="Model" value={model} onChange={(v) => setModels((x) => ({ ...x, [m.id]: v }))} />
                )}
                <div>
                  <Label htmlFor={`rb-machine-serial-${m.id}`}>Serial</Label>
                  <div className="mt-1 flex gap-2">
                    <Input
                      id={`rb-machine-serial-${m.id}`}
                      value={serial}
                      onChange={(e) => setSerials((x) => ({ ...x, [m.id]: e.target.value }))}
                      onBlur={() => {
                        // Only a changed serial pulls, and not again while that one is being pulled.
                        if (fixed || serial.trim() === (m.serial ?? "") || (pull.isPending && lastPull.current[String(m.id)] === serial.trim())) return;
                        startPull(m.id, serial, model);
                      }}
                      placeholder="Type the machine's serial"
                      disabled={fixed}
                    />
                    {fixed ? null : (
                      <Button type="button" variant="outline" disabled={pull.isPending} onClick={() => startPull(m.id, serial, model)}>
                        Pull
                      </Button>
                    )}
                  </div>
                  <MachineNotice machine={m} />
                </div>
              </div>
            </li>
          );
        })}
        {draft ? (
          <li className="rounded-xl border border-dashed border-border p-3" data-testid="rebuild-machine-new">
            <span className="text-sm font-medium">Machine {row.machines.length + 1}</span>
            <div className="mt-2 space-y-2">
              <EquipmentCombo label="Model" value={draft.model} onChange={(v) => setDraft((d) => ({ model: v, serial: d?.serial ?? "" }))} />
              <div>
                <Label htmlFor="rb-machine-serial-new">Serial</Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    id="rb-machine-serial-new"
                    value={draft.serial}
                    onChange={(e) => setDraft((d) => ({ model: d?.model ?? "", serial: e.target.value }))}
                    placeholder="Type the machine's serial"
                  />
                  <Button type="button" variant="outline" disabled={pull.isPending || !draft.serial.trim()} onClick={() => startPull(null, draft.serial, draft.model)}>
                    Pull
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
                    Cancel
                  </Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Pull adds it with its serial. With no serial, pick its model and Save.</p>
              </div>
            </div>
          </li>
        ) : null}
      </ol>
      {editable ? (
        <div className="flex flex-wrap items-center gap-2">
          {draft ? null : (
            <Button type="button" variant="outline" onClick={() => setDraft({ model: "", serial: "" })} data-testid="rebuild-machine-add">
              <Plus className="size-3.5" />
              Add machine
            </Button>
          )}
          <Button
            type="button"
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate({ models: { ...models }, draft: draft?.model.trim() && !draft.serial.trim() ? draft.model : null })}
            data-testid="rebuild-machines-save"
          >
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      ) : closed && canEdit ? (
        <p className="text-xs text-muted-foreground" data-testid="rebuild-machines-closed">
          This rebuild is {row.status}, so its machines don't change. Set it back to In progress to change them.
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Matching a warehouse serial attaches that unit. It does not create a second record.
        {warehouse && editable
          ? " Warehouse pulls a unit from the barn, one of our sites or a customer's account with no Admin's approval, and the Admins get a ping saying where it came from."
          : ""}
      </p>
      <Dialog open={!!reuse} onOpenChange={(v) => !v && setReuse(null)}>
        <DialogContent>
          <DialogTitle>Serial Already Assigned</DialogTitle>
          <DialogDescription>{reuse?.question}</DialogDescription>
          {warehouse ? (
            <p className="text-sm text-muted-foreground" data-testid="rebuild-pull-ping">
              Reusing it moves it onto this refurb now. The Admins get a ping saying where it came from.
            </p>
          ) : null}
          <div className="mt-4 flex gap-2">
            <Button
              type="button"
              disabled={pull.isPending}
              onClick={() => {
                if (reuse) startPull(reuse.machineId, reuse.serial, reuse.model, { confirmReuse: true, asked: reuse.question });
              }}
            >
              Reuse on this rebuild
            </Button>
            <Button type="button" variant="outline" onClick={() => setReuse(null)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
