import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ClipboardCopy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { completeModuleRunbook, getModuleRunbook, saveModuleRunbook } from "@/lib/ops/module-runbook-api";
import { getKitPrices } from "@/lib/ops/pm-runbook-api";
import { anyFound, kitPriceParts, priceKits, summarizePrices, uncountedNote, usd } from "@/lib/ops/pm-runbook-prices";
import { moduleKitListText } from "@/lib/ops/pm-runbook";
import { useCopy } from "./spec-sheet";

const stamp = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** The runbook for one module. Bench (on the module) and on site (from a PM) are the same sheet; the context is stored. */
export function ModuleRunbook({ moduleId, context, pmId }: { moduleId: number; context: "bench" | "pm"; pmId?: number }) {
  const qc = useQueryClient();
  const scope = { moduleId, context, pmId: pmId ?? null };
  const q = useQuery({
    queryKey: ["module-runbook", moduleId, context, pmId ?? null],
    queryFn: () => getModuleRunbook({ data: scope }),
  });
  const data = q.data;
  const evs = [...(data?.kits ?? []), ...(data?.optional ?? [])].map((k) => k.ev);
  const prices = useQuery({
    queryKey: ["pm-runbook-prices", evs.join(",")],
    queryFn: () => getKitPrices({ data: { evs } }),
    enabled: evs.length > 0,
  });
  const priced = data ? priceKits(data.kits, prices.data ?? {}) : [];
  const summary = priced.length ? summarizePrices(priced) : null;
  const { copy, copied, dialog } = useCopy();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["module-runbook", moduleId] });
    void qc.invalidateQueries({ queryKey: ["module-record", moduleId] });
    void qc.invalidateQueries({ queryKey: ["pm-runbook"] });
  };
  const save = useMutation({
    mutationFn: (extra: Partial<Parameters<typeof saveModuleRunbook>[0]["data"]>) => saveModuleRunbook({ data: { ...scope, ...extra } }),
    onSuccess: refresh,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });
  const done = useMutation({
    mutationFn: () => completeModuleRunbook({ data: scope }),
    onSuccess: () => {
      toast.success("Service completed. Checked kits are on this module's parts log.");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not complete"),
  });
  const [busy, setBusy] = useState(false);
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading the runbook…</p>;
  if (q.isError) return <p className="text-sm text-destructive">{q.error instanceof Error ? q.error.message : "Could not load the runbook."}</p>;
  if (!data?.covered) return <p className="text-sm text-muted-foreground">{data?.notice || "No runbook for this module type yet."}</p>;
  const locked = data.completed || data.pmCompleted || !data.canWrite || save.isPending || done.isPending || busy;
  const text = moduleKitListText(data.title ?? "Module", data.intervals.find((i) => i.id === data.interval)?.label ?? "", data.kits, priced);
  return (
    <div className="grid gap-4" data-testid="module-runbook" data-context={context}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{data.title}</h3>
        <span className="text-xs text-muted-foreground">{context === "pm" ? "On site" : "On the bench"}</span>
      </div>
      {data.completed ? (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">This service is completed. The checked kits are on the parts log.</p>
      ) : null}
      {context === "pm" ? (
        <p className="text-sm break-words">
          {data.intervals.find((i) => i.id === data.interval)?.label ?? "Interval from the PM"}
          {data.options.length
            ? ` · ${data.options.map((o) => `${o.label}: ${o.choices.find((c) => c.val === o.value)?.label ?? o.value}`).join(" · ")}`
            : ""}
          <span className="mt-1 block text-xs text-muted-foreground">Interval and options come from the PM.</span>
        </p>
      ) : (
        <>
          <div className="grid gap-1">
            <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Service interval</span>
            <div className="flex flex-wrap gap-1.5">
              {data.intervals.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  disabled={locked}
                  aria-pressed={data.interval === i.id}
                  onClick={() => save.mutate({ interval: i.id })}
                  className={cn(
                    "min-h-9 rounded-md border px-3 py-1 text-sm disabled:cursor-default",
                    data.interval === i.id ? "border-primary bg-primary font-semibold text-primary-foreground" : "border-border",
                  )}
                >
                  {i.label}
                </button>
              ))}
            </div>
          </div>
          {data.options.map((o) => (
            <div key={o.key} className="grid gap-1">
              <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{o.label}</span>
              <div className="flex flex-wrap gap-1.5">
                {o.choices.map((c) => (
                  <button
                    key={c.val}
                    type="button"
                    disabled={locked}
                    aria-pressed={o.value === c.val}
                    onClick={() => save.mutate({ optionKey: o.key, optionValue: c.val })}
                    className={cn(
                      "min-h-9 rounded-md border px-3 py-1 text-sm disabled:cursor-default",
                      o.value === c.val ? "border-primary bg-primary font-semibold text-primary-foreground" : "border-border",
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {summary && anyFound(summary) ? (
            <>
              Kit list at sell price <b className="font-mono text-foreground">{usd(summary.total)}</b>
              {uncountedNote(summary) ? ` (${uncountedNote(summary)})` : ""}
            </>
          ) : (
            "Kit prices come from the parts catalog."
          )}
        </p>
        <Button type="button" size="sm" variant="outline" onClick={() => void copy("kits", text)}>
          {copied === "kits" ? <Check className="size-4" /> : <ClipboardCopy className="size-4" />}
          Copy kit list
        </Button>
      </div>
      <div className="grid gap-2">
        {data.kits.map((k) => {
          const key = `kit:${k.ev}`;
          const on = !!data.checks[key];
          const p = priced.find((x) => x.ev === k.ev);
          return (
            <label key={k.ev} className={cn("flex items-start gap-3 rounded-md border border-border p-2", on && "bg-muted")}>
              <input
                type="checkbox"
                className="mt-1 size-5 accent-[var(--primary)]"
                checked={on}
                disabled={locked}
                onChange={(e) => {
                  setBusy(true);
                  save.mutate({ checkKey: key, checked: e.target.checked }, { onSettled: () => setBusy(false) });
                }}
              />
              <span className="min-w-0 flex-1 text-sm break-words">
                <span className="font-mono font-semibold">{k.ev}</span> {k.name}
                {k.added ? (
                  <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-sky-900 uppercase">Added</span>
                ) : null}
                {p ? <span className="block text-xs text-muted-foreground">{kitPriceParts(p).join(" · ")}</span> : null}
                {on && data.checks[key]?.at ? <span className="block text-xs text-muted-foreground">Checked in: {data.checks[key].who ?? ""} {stamp(data.checks[key].at)}</span> : null}
              </span>
              <span className="font-mono text-sm font-semibold whitespace-nowrap">
                x{k.q}
                {k.added && !locked ? (
                  <button
                    type="button"
                    className="mt-1 block text-right text-[11px] font-medium underline"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      save.mutate({ addEv: k.ev, addOn: false });
                    }}
                  >
                    Remove
                  </button>
                ) : null}
              </span>
            </label>
          );
        })}
        {!data.kits.length ? <p className="text-sm text-muted-foreground">No kits for this setup.</p> : null}
      </div>
      {data.optional.length ? (
        <div className="grid gap-2">
          <h4 className="text-sm font-semibold">Optional kits</h4>
          <p className="text-xs text-muted-foreground">
            From the 36-month list for this module. Adding one puts it on this list. It is not checked in until you tick it.
          </p>
          {data.optional.map((k) => {
            const p = priced.find((x) => x.ev === k.ev) ?? priceKits([k], prices.data ?? {})[0];
            const text = p ? kitPriceParts(p).join(" · ") : null;
            return (
              <div key={k.ev} className="flex items-start gap-3 rounded-md border border-dashed border-border p-2">
                <span className="min-w-0 flex-1 text-sm break-words">
                  <span className="font-mono font-semibold">{k.ev}</span> {k.name}
                  {text ? <span className="block text-xs text-muted-foreground">{text}</span> : null}
                </span>
                <span className="font-mono text-sm font-semibold whitespace-nowrap">x{k.q}</span>
                {!locked ? (
                  <Button type="button" size="sm" variant="outline" disabled={save.isPending} onClick={() => save.mutate({ addEv: k.ev, addOn: true })}>
                    Add
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
      <div className="grid gap-2">
        <h4 className="text-sm font-semibold">Service steps</h4>
        {data.steps.flatMap((g) => g.items).map((s) => {
          const key = `step:${s.id}`;
          const on = !!data.checks[key];
          return (
            <label key={s.id} className={cn("flex items-start gap-3 rounded-md border border-border p-2", on && "bg-muted")}>
              <input
                type="checkbox"
                className="mt-1 size-5 accent-[var(--primary)]"
                checked={on}
                disabled={locked}
                onChange={(e) => save.mutate({ checkKey: key, checked: e.target.checked })}
              />
              <span className="min-w-0 flex-1 text-sm break-words">
                {s.text}
                {on && data.checks[key]?.at ? <span className="block text-xs text-muted-foreground">{data.checks[key].who ?? ""} {stamp(data.checks[key].at)}</span> : null}
              </span>
            </label>
          );
        })}
        {!data.steps.length ? <p className="text-sm text-muted-foreground">No steps for this setup.</p> : null}
      </div>
      {data.canWrite ? (
        data.completed ? (
          <Button type="button" variant="outline" disabled={save.isPending} onClick={() => save.mutate({ again: true })}>
            Service again
          </Button>
        ) : (
          <Button type="button" disabled={done.isPending || !data.serviceId && save.isPending} onClick={() => done.mutate()}>
            {done.isPending ? "Completing…" : "Complete service"}
          </Button>
        )
      ) : null}
      {dialog}
    </div>
  );
}
