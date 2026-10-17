import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, History, Plus, Wrench } from "lucide-react";
import { toast } from "sonner";
import { listModules } from "@/lib/ops/api";
import { moduleAccount, moduleAvailability } from "@/lib/ops/eversys";
import { addModuleWork, getModuleRecord, swapModule } from "@/lib/ops/module-assign";
import { findModule, searchModules, stopLine, swapCandidates, workError, type ModuleStop, type WorkKind } from "@/lib/ops/module-history";
import type { ModuleRow } from "@/lib/ops/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ModuleRunbook } from "@/components/desk/module-runbook";

const when = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

function useRefresh(id: number) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["module-record"] });
    void qc.invalidateQueries({ queryKey: ["modules"] });
    void qc.invalidateQueries({ queryKey: ["eversys-units"] });
    void qc.invalidateQueries({ queryKey: ["activity"] });
    void qc.invalidateQueries({ queryKey: ["thread", "module", id] });
  };
}

function StopRow({ s, current }: { s: ModuleStop; current?: boolean }) {
  return (
    <li className={cn("relative pl-5", current ? "" : "text-muted-foreground")} data-testid="module-stop" data-kind={s.kind}>
      <span className={cn("absolute top-1.5 left-0 size-2.5 rounded-full border-2", current ? "border-primary bg-primary" : "border-border bg-card")} aria-hidden />
      <p className={cn("text-sm", current ? "font-medium text-foreground" : "")}>{stopLine(s)}</p>
      <p className="text-xs text-muted-foreground">
        {when(s.happenedAt)}
        {s.byName ? ` · ${s.byName}` : ""}
        {s.note ? ` · ${s.note}` : ""}
      </p>
    </li>
  );
}

/**
 * The module as an asset: current account and unit, every past stop, a Swap for one of the same type, and the
 * parts and labor logged on it. Nothing here is overwritten; each move and each line is added.
 */
export function ModuleRecord({ row }: { row: ModuleRow }) {
  const rec = useQuery({ queryKey: ["module-record", row.id], queryFn: () => getModuleRecord({ data: { id: row.id } }) });
  const [swapping, setSwapping] = useState(false);
  const account = moduleAccount(row);
  const onUnit = moduleAvailability(row) === "assigned" && row.assignedUnitId != null;
  const r = rec.data;
  const since = r?.current && (r.current.kind === "assigned" || r.current.kind === "swap_in") ? r.current.happenedAt : row.assignedAt;
  return (
    <section className="border-b border-border p-5" data-testid="module-record">
      <div className="grid gap-3 sm:grid-cols-2" data-testid="module-current">
        <div>
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Current Account</p>
          <p className="mt-0.5 text-sm font-medium" data-testid="module-current-account">
            {account ?? (moduleAvailability(row) === "hq" ? "At HQ" : row.status)}
          </p>
          {account && since ? <p className="text-xs text-muted-foreground">Since {when(since)}</p> : null}
        </div>
        <div>
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Current Unit</p>
          <p className="mt-0.5 text-sm font-medium" data-testid="module-current-unit">
            {row.assignedUnitLabel ?? (account ? "Unit not recorded" : "None")}
          </p>
          {onUnit ? (
            <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => setSwapping(true)} data-testid="module-swap">
              <ArrowLeftRight className="size-4" />
              Swap
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-5" data-testid="module-runbook-bench">
        <ModuleRunbook moduleId={row.id} context="bench" />
      </div>

      <div className="mt-5">
        <h3 className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          <History className="size-3.5" />
          Trail
          {r ? <span className="font-normal tracking-normal normal-case">· {r.past.length + (r.current ? 1 : 0)} stops</span> : null}
        </h3>
        {r?.current ? (
          <ol className="mt-2 space-y-2.5 border-l border-border pl-0" data-testid="module-trail">
            <StopRow s={r.current} current />
            {r.past.map((s) => (
              <StopRow key={s.id} s={s} />
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{rec.isLoading ? "Loading the trail…" : "No stops recorded yet. Assigning, swapping or returning this module starts the trail."}</p>
        )}
      </div>

      <WorkLog moduleId={row.id} work={r?.work ?? []} totals={r?.totals ?? { parts: 0, laborHours: 0 }} />

      {swapping ? <SwapDialog row={row} onClose={() => setSwapping(false)} /> : null}
    </section>
  );
}

function WorkLog({ moduleId, work, totals }: { moduleId: number; work: NonNullable<Awaited<ReturnType<typeof getModuleRecord>>>["work"]; totals: { parts: number; laborHours: number } }) {
  const refresh = useRefresh(moduleId);
  const qc = useQueryClient();
  const [kind, setKind] = useState<WorkKind>("part");
  const [item, setItem] = useState("");
  const [qty, setQty] = useState("1");
  const [day, setDay] = useState(today());
  const [wo, setWo] = useState("");
  const problem = workError({ kind, item, qty, workedOn: day });
  const add = useMutation({
    mutationFn: () => addModuleWork({ data: { id: moduleId, kind, item, qty, workedOn: day || null, wo: wo || null } }),
    onSuccess: (next) => {
      qc.setQueryData(["module-record", moduleId], next);
      refresh();
      toast.success(kind === "labor" ? "Labor logged on this module" : "Part logged on this module");
      setItem("");
      setQty("1");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not log it"),
  });
  return (
    <div className="mt-6" data-testid="module-work">
      <h3 className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        <Wrench className="size-3.5" />
        Parts And Labor
        <span className="font-normal tracking-normal normal-case" data-testid="module-work-totals">
          · {totals.parts} part{totals.parts === 1 ? "" : "s"} · {totals.laborHours} h labor
        </span>
      </h3>
      <div className="mt-2 rounded-lg border border-border p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex gap-1.5" role="group" aria-label="Part or labor">
            {(["part", "labor"] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
                className={cn("h-9 rounded-full px-3 text-sm font-medium", kind === k ? "bg-ink text-ink-foreground" : "bg-secondary text-foreground")}
                data-testid={`module-work-${k}`}
              >
                {k === "part" ? "Part" : "Labor"}
              </button>
            ))}
          </div>
          <div className="min-w-[12rem] flex-1">
            <Label htmlFor={`mw-item-${moduleId}`}>{kind === "part" ? "Part used" : "Labor done"}</Label>
            <Input
              id={`mw-item-${moduleId}`}
              value={item}
              maxLength={200}
              autoComplete="off"
              placeholder={kind === "part" ? "Part number or name" : "e.g. Rebuild, descale, leak test"}
              onChange={(e) => setItem(e.target.value)}
              className="mt-1"
              data-testid="module-work-item"
            />
          </div>
          <div className="w-20">
            <Label htmlFor={`mw-qty-${moduleId}`}>{kind === "part" ? "Qty" : "Hours"}</Label>
            <Input id={`mw-qty-${moduleId}`} inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className="mt-1" data-testid="module-work-qty" />
          </div>
          <div className="w-36">
            <Label htmlFor={`mw-day-${moduleId}`}>Date</Label>
            <Input id={`mw-day-${moduleId}`} type="date" value={day} onChange={(e) => setDay(e.target.value)} className="mt-1" />
          </div>
          <div className="w-28">
            <Label htmlFor={`mw-wo-${moduleId}`}>WO #</Label>
            <Input id={`mw-wo-${moduleId}`} value={wo} autoComplete="off" onChange={(e) => setWo(e.target.value)} className="mt-1" />
          </div>
          <Button type="button" size="sm" disabled={!!problem || add.isPending} onClick={() => add.mutate()} title={problem ?? undefined} data-testid="module-work-add">
            <Plus className="size-4" />
            Log It
          </Button>
        </div>
      </div>
      {work.length ? (
        <ul className="mt-2 divide-y divide-border rounded-lg border border-border" data-testid="module-work-list">
          {work.map((w) => (
            <li key={w.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3 py-2 text-sm" data-testid="module-work-line">
              <span className="w-24 shrink-0 tabular text-xs text-muted-foreground">{w.workedOn}</span>
              <Badge size="tight" variant={w.kind === "labor" ? "outline" : "primary"}>
                {w.kind === "labor" ? "Labor" : "Part"}
              </Badge>
              <span className="min-w-0 flex-1 font-medium">{w.item}</span>
              <span className="tabular text-xs text-muted-foreground">{w.kind === "labor" ? `${w.qty} h` : `× ${w.qty}`}</span>
              <span className="w-full pl-26 text-xs text-muted-foreground sm:w-auto sm:pl-0">
                {[w.wo ? `WO ${w.wo.replace(/^wo[-\s]*/i, "")}` : "", w.technician ?? "", w.byName ? `logged by ${w.byName}` : ""].filter(Boolean).join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Nothing logged on this module yet.</p>
      )}
    </div>
  );
}

function SwapDialog({ row, onClose }: { row: ModuleRow; onClose: () => void }) {
  const refresh = useRefresh(row.id);
  const list = useQuery({ queryKey: ["modules"], queryFn: () => listModules() });
  const [q, setQ] = useState("");
  const candidates = swapCandidates(
    { ...row, returnPending: row.returnPending },
    (list.data ?? []).map((m) => ({ ...m })),
    (m) => moduleAvailability(m) === "hq",
  );
  const shown = q.trim() ? candidates.filter((m) => searchModules(candidates, q, 50).includes(m)) : candidates;
  const typedOther = q.trim() ? findModule(list.data ?? [], q) : null;
  const swap = useMutation({
    mutationFn: (inId: number) => swapModule({ data: { outId: row.id, inId } }),
    onSuccess: (r) => {
      toast.success(`Swapped on ${r.customer}: ${r.out} out, ${r.in} in`);
      refresh();
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not swap"),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" data-testid="module-swap-dialog">
        <DialogTitle>Swap Module</DialogTitle>
        <DialogDescription>
          {row.moduleId} comes off {row.assignedCustomer} · {row.assignedUnitLabel}. Pick a {row.moduleType ?? "module"} at HQ to go on in its place. Both records keep the swap.
        </DialogDescription>
        <div className="mt-3">
          <Label htmlFor="swap-search">Search by serial</Label>
          <Input id="swap-search" className="mt-1" value={q} autoComplete="off" placeholder="Module serial" onChange={(e) => setQ(e.target.value)} />
        </div>
        {typedOther && !candidates.includes(typedOther) ? (
          <p className="mt-2 text-xs text-warning">
            {typedOther.moduleId} is {typedOther.moduleType ?? "not typed"}
            {moduleAccount(typedOther) ? ` on ${moduleAccount(typedOther)}` : ` · ${typedOther.status}`}. Only a {row.moduleType} at HQ can be swapped in.
          </p>
        ) : null}
        <ul className="mt-3 max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border" data-testid="module-swap-options">
          {shown.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                disabled={swap.isPending}
                onClick={() => swap.mutate(m.id)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted disabled:opacity-60"
                data-testid="module-swap-pick"
              >
                <span>
                  <span className="block text-sm font-medium">{m.moduleId}</span>
                  <span className="block text-xs text-muted-foreground">
                    {m.moduleType} · {m.platform ?? "Platform not set"}
                  </span>
                </span>
                <Badge size="tight" variant={m.status === "Ready" ? "success" : "outline"}>
                  {m.status}
                </Badge>
              </button>
            </li>
          ))}
          {!shown.length ? <li className="px-3 py-3 text-sm text-muted-foreground">No {row.moduleType ?? "module"} of this type is at HQ to swap in.</li> : null}
        </ul>
        <Button type="button" variant="ghost" className="mt-2 w-fit" onClick={onClose}>
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/**
 * New Module: the list is searched as the serial is typed. A serial already on the list opens that module instead
 * of adding a second record; otherwise it is added as new.
 */
export function NewModuleDialog({
  open,
  onOpenChange,
  modules,
  onOpenExisting,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  modules: ModuleRow[];
  onOpenExisting: (id: number) => void;
  onAdd: (serial: string) => Promise<void>;
}) {
  const [serial, setSerial] = useState("");
  const [busy, setBusy] = useState(false);
  const exact = findModule(modules, serial);
  const near = searchModules(modules, serial).filter((m) => m !== exact);
  const close = (o: boolean) => {
    if (!o) setSerial("");
    onOpenChange(o);
  };
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md" data-testid="new-module">
        <DialogTitle>New Module</DialogTitle>
        <DialogDescription>Type the serial or ID. The module list is searched first, so a module is never added twice.</DialogDescription>
        <form
          className="mt-3 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!serial.trim() || exact || busy) return;
            setBusy(true);
            try {
              await onAdd(serial);
              close(false);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not add it");
            } finally {
              setBusy(false);
            }
          }}
        >
          <div>
            <Label htmlFor="new-module-serial">Module Serial</Label>
            <Input id="new-module-serial" className="mt-1" value={serial} autoComplete="off" autoFocus onChange={(e) => setSerial(e.target.value)} data-testid="new-module-serial" />
          </div>
          {exact ? (
            <div className="rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm" data-testid="new-module-exists">
              <p className="font-medium">{exact.moduleId} is already on the list.</p>
              <p className="text-xs text-muted-foreground">
                {exact.moduleType ?? "Type not set"} · {moduleAccount(exact) ? `on ${moduleAccount(exact)}` : exact.status}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => {
                  onOpenExisting(exact.id);
                  close(false);
                }}
                data-testid="new-module-open"
              >
                Open It
              </Button>
            </div>
          ) : serial.trim() ? (
            <p className="text-xs text-muted-foreground" data-testid="new-module-new">
              Not on the list. It will be added as a new module.
            </p>
          ) : null}
          {near.length ? (
            <div>
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Close matches</p>
              <ul className="mt-1 divide-y divide-border rounded-lg border border-border">
                {near.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="flex w-full justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        onOpenExisting(m.id);
                        close(false);
                      }}
                    >
                      <span className="font-medium">{m.moduleId}</span>
                      <span className="text-xs text-muted-foreground">{moduleAccount(m) ?? m.status}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={!serial.trim() || !!exact || busy} data-testid="new-module-add">
              {busy ? "Adding…" : "Add As New"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
