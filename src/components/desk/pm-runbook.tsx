import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ClipboardCopy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  clearRunbookChecks,
  getKitPrices,
  getPmRunbook,
  logRunbookAsset,
  setRunbookCheck,
  setRunbookUnitConfig,
  setRunbookUnitOptions,
  type RunbookUnit,
} from "@/lib/ops/pm-runbook-api";
import { listModules } from "@/lib/ops/api";
import { moduleAvailability } from "@/lib/ops/eversys";
import { MODULE_PLATFORMS, MODULE_TYPES } from "@/lib/ops/lookups";
import { assignModule } from "@/lib/ops/module-assign";
import { banners, applicableModules, kitList, kitListText, moduleTypeFit, optionKeys, platformFit, stepIds, stepList, totalKits, visibleOptions } from "@/lib/ops/pm-runbook";
import { anyFound, kitPriceParts, priceKits, summarizePrices, uncountedNote, usd } from "@/lib/ops/pm-runbook-prices";
import { runbookById } from "@/lib/ops/runbooks";
import type { RunbookConfig, RunbookDefinition } from "@/lib/ops/pm-runbook-schema";
import type { ModuleRow } from "@/lib/ops/types";
import { useCopy } from "./spec-sheet";

function Seg({
  label,
  value,
  choices,
  disabled,
  onPick,
}: {
  label: string;
  value: string;
  choices: { val: string; label: string }[];
  disabled: boolean;
  onPick: (val: string) => void;
}) {
  return (
    <div className="grid gap-1">
      <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {choices.map((c) => (
          <button
            key={c.val}
            type="button"
            disabled={disabled}
            aria-pressed={value === c.val}
            onClick={() => onPick(c.val)}
            className={cn(
              "min-h-9 rounded-md border px-3 py-1 text-left text-sm disabled:cursor-default",
              value === c.val ? "border-primary bg-primary font-semibold text-primary-foreground" : "border-border bg-background",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function UnitModules({
  unit,
  def,
  config,
  canWrite,
  customer,
  platforms,
}: {
  unit: RunbookUnit;
  def: RunbookDefinition;
  config: RunbookConfig;
  canWrite: boolean;
  customer: string;
  platforms: readonly string[];
}) {
  const qc = useQueryClient();
  const mods = useQuery({
    queryKey: ["modules"],
    queryFn: () => listModules(),
    enabled: unit.accountId != null,
  });
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState(platforms[0] ?? "");
  const [type, setType] = useState("");
  const label = def.models.find((m) => m.id === config.model)?.label ?? unit.piece;
  const groups = applicableModules(def, config);
  const mine = (mods.data ?? []).filter((m) => unit.accountId != null && m.assignedUnitId === unit.accountId);
  const grouped = groups
    .map((name) => ({
      name,
      rows: mine.filter((m) => moduleTypeFit(def, config, m.moduleType ?? "").group === name),
    }))
    .filter((g) => g.rows.length);
  const typeOk = !!type && moduleTypeFit(def, config, type).ok;
  const platformOk = !!platform && platformFit(platforms, platform, label).ok;
  const spare = (mods.data ?? []).filter(
    (m) => typeOk && platformOk && m.moduleType === type && m.platform === platform && moduleAvailability(m) === "hq",
  );
  const attach = useMutation({
    mutationFn: (id: number) => assignModule({ data: { id, customer, unitId: unit.accountId! } }),
    onSuccess: (r) => {
      toast.success(`Attached to ${r.unit}`);
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["modules"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not assign"),
  });
  return (
    <div className="grid gap-2" data-testid="unit-modules">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Modules on this unit</h4>
        {canWrite && unit.accountId != null ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
            Assign module
          </Button>
        ) : null}
      </div>
      {unit.accountId == null ? (
        <p className="text-sm text-muted-foreground">Log the asset before modules can be assigned to this unit.</p>
      ) : mods.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading modules…</p>
      ) : grouped.length ? (
        <ul className="grid gap-2">
          {grouped.map((g) => (
            <li key={g.name}>
              <p className="text-sm font-medium">{g.name}</p>
              <ul className="mt-1 grid gap-1">
                {g.rows.map((m) => (
                  <li key={m.id} className="break-words text-sm text-muted-foreground">
                    SN {m.moduleId}
                    {m.moduleType ? ` · ${m.moduleType}` : ""}
                    {m.platform ? ` · ${m.platform}` : ""}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No modules assigned to this unit.</p>
      )}
      <Dialog open={open} onOpenChange={(o) => !o && !attach.isPending && setOpen(false)}>
        <DialogContent data-testid="assign-unit-module">
          <DialogTitle>Assign module</DialogTitle>
          <DialogDescription>
            {label}. Only the module types and platform for this machine can be chosen.
          </DialogDescription>
          <div className="mt-3 grid gap-3">
            <div className="grid gap-1">
              <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Platform</span>
              {MODULE_PLATFORMS.map((p) => {
                const fit = platformFit(platforms, p, label);
                return (
                  <button
                    key={p}
                    type="button"
                    disabled={!fit.ok}
                    aria-pressed={platform === p}
                    onClick={() => setPlatform(p)}
                    className={cn(
                      "rounded-md border px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-70",
                      platform === p && fit.ok ? "border-primary bg-primary text-primary-foreground" : "border-border",
                    )}
                  >
                    <span className="block">{p}</span>
                    {fit.reason ? <span className="block text-xs text-muted-foreground">{fit.reason}</span> : null}
                  </button>
                );
              })}
            </div>
            <div className="grid gap-1">
              <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Type</span>
              {MODULE_TYPES.map((t) => {
                const fit = moduleTypeFit(def, config, t);
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={!fit.ok}
                    aria-pressed={type === t}
                    onClick={() => setType(t)}
                    className={cn(
                      "rounded-md border px-3 py-2 text-left text-sm break-words disabled:cursor-not-allowed disabled:opacity-70",
                      type === t && fit.ok ? "border-primary bg-primary text-primary-foreground" : "border-border",
                    )}
                  >
                    <span className="block">{t}</span>
                    {fit.reason ? <span className="block text-xs text-muted-foreground">{fit.reason}</span> : null}
                  </button>
                );
              })}
            </div>
            {typeOk && platformOk ? (
              spare.length ? (
                <ul className="max-h-48 divide-y divide-border overflow-y-auto rounded-md border border-border">
                  {spare.map((m: ModuleRow) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm break-words hover:bg-muted"
                        disabled={attach.isPending}
                        onClick={() => attach.mutate(m.id)}
                      >
                        SN {m.moduleId}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No {type} for {platform} is at HQ.</p>
              )
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Runbook for one PM job: a tab per unit with kit list and service steps. Office roles see ticks read-only. */
export function PmRunbook({ pmId, customer }: { pmId: number; customer: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["pm-runbook", pmId], queryFn: () => getPmRunbook({ data: { pmId } }) });
  const [active, setActive] = useState<string | null>(null);
  const { copy, copied, dialog } = useCopy();
  const units = useMemo(() => q.data?.units ?? [], [q.data]);
  const canWrite = !!q.data?.canWrite;
  useEffect(() => {
    if (!units.length) return;
    if (!active || !units.some((u) => u.unitKey === active)) setActive(units[0].unitKey);
  }, [units, active]);
  const unit: RunbookUnit | undefined = units.find((u) => u.unitKey === active) ?? units[0];
  const rb = unit ? runbookById(unit.runbookId) : undefined;
  const refresh = () => qc.invalidateQueries({ queryKey: ["pm-runbook", pmId] });
  const onError = (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not save");

  const setConfig = useMutation({
    mutationFn: (d: Parameters<typeof setRunbookUnitConfig>[0]["data"]) => setRunbookUnitConfig({ data: d }),
    onSuccess: refresh,
    onError,
  });
  const setOptions = useMutation({
    mutationFn: (d: Parameters<typeof setRunbookUnitOptions>[0]["data"]) => setRunbookUnitOptions({ data: d }),
    onSuccess: refresh,
    onError,
  });
  const tick = useMutation({
    mutationFn: (d: Parameters<typeof setRunbookCheck>[0]["data"]) => setRunbookCheck({ data: d }),
    onSuccess: refresh,
    onError,
  });
  const clear = useMutation({
    mutationFn: (d: { pmId: number; unitKey: string }) => clearRunbookChecks({ data: d }),
    onSuccess: refresh,
    onError,
  });
  const [logging, setLogging] = useState(false);
  const [choice, setChoice] = useState("new");
  const [serial, setSerial] = useState("");
  const [installDate, setInstallDate] = useState("");
  const logAsset = useMutation({
    mutationFn: (d: Parameters<typeof logRunbookAsset>[0]["data"]) => logRunbookAsset({ data: d }),
    onSuccess: () => {
      setLogging(false);
      toast.success("Asset logged. Ticks on this line stay with the unit.");
      refresh();
    },
    onError,
  });
  const kitNumbers = useMemo(() => (unit && rb ? kitList(rb.def, unit.config).map((k) => k.ev) : []), [unit, rb]);
  const priceQ = useQuery({
    queryKey: ["pm-runbook-prices", kitNumbers.join(",")],
    queryFn: () => getKitPrices({ data: { evs: kitNumbers } }),
    enabled: kitNumbers.length > 0,
  });
  const [armed, setArmed] = useState(false);
  useEffect(() => setArmed(false), [active]);

  const view = useMemo(() => {
    if (!unit || !rb) return null;
    const kits = kitList(rb.def, unit.config);
    const steps = stepList(rb.def, unit.config);
    const modules: { module: string; kits: typeof kits }[] = [];
    for (const k of kits) {
      let m = modules.find((x) => x.module === k.module);
      if (!m) modules.push((m = { module: k.module, kits: [] }));
      m.kits.push(k);
    }
    const ids = stepIds(steps);
    const done = ids.filter((id) => unit.checks[id]).length;
    return { kits, steps, modules, stepTotal: ids.length, stepDone: done };
  }, [unit, rb]);
  const prices = useMemo(
    () => (priceQ.data && view ? priceKits(view.kits, priceQ.data) : null),
    [priceQ.data, view],
  );
  const priceSummary = prices ? summarizePrices(prices) : null;

  if (q.isLoading || !units.length || !unit || !rb || !view) return null;
  const def = rb.def;
  const c = unit.config;

  function pickOption(key: string, val: string) {
    if (!unit) return;
    const options: Record<string, string> = {};
    for (const k of optionKeys(def)) options[k] = k === key ? val : c[k];
    setOptions.mutate({ pmId, unitKey: unit.unitKey, runbookId: unit.runbookId, options, optionsKey: unit.optionsKey });
  }
  function pickJob(key: "model" | "pm", val: string) {
    if (!unit) return;
    setConfig.mutate({
      pmId,
      unitKey: unit.unitKey,
      runbookId: unit.runbookId,
      optionsKey: unit.optionsKey,
      model: key === "model" ? val : c.model,
      interval: key === "pm" ? val : c.pm,
    });
  }
  function toggle(key: string, done: boolean) {
    if (!unit) return;
    tick.mutate({ pmId, unitKey: unit.unitKey, optionsKey: unit.optionsKey, key, done });
  }
  const stamp = (key: string) => {
    const t = unit.checks[key];
    if (!t) return null;
    const when = new Date(t.at);
    const day = Number.isNaN(when.getTime()) ? "" : when.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    return [t.by, day].filter(Boolean).join(" · ");
  };
  const time = def.models.find((m) => m.id === c.model)?.time?.[c.pm];
  const header = `${customer}${unit.serial ? ` · SN ${unit.serial}` : ""}`;

  return (
    <section className="grid gap-4 border-b border-border p-5" aria-label="Runbook">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-heading text-base font-semibold">Runbook</h3>
        <span className="text-xs text-muted-foreground">
          {def.title}
          {canWrite ? "" : " · view only"}
        </span>
      </div>

      {units.length > 1 ? (
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Units on this PM">
          {units.map((u, i) => (
            <button
              key={u.unitKey}
              type="button"
              role="tab"
              aria-selected={u.unitKey === unit.unitKey}
              onClick={() => setActive(u.unitKey)}
              className={cn(
                "max-w-full truncate rounded-md border px-3 py-1.5 text-sm",
                u.unitKey === unit.unitKey ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background",
              )}
            >
              {i + 1}. {u.serial ? `SN ${u.serial}` : u.piece}
            </button>
          ))}
        </div>
      ) : null}

      <div className="text-sm text-muted-foreground">
        {unit.piece}
        {unit.serial
          ? ` · SN ${unit.serial}`
          : unit.awaitingSerial
            ? " · no serial on file: options are kept on this account unit and move to the serial once it is added"
            : " · not matched to an account unit, so options stay with this PM only"}
      </div>

      {!unit.logged ? (
        <div className="grid gap-2 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900">
          <span>This unit is not logged as an asset, so this PM cannot be marked completed.</span>
          {canWrite ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-fit"
              onClick={() => {
                setChoice(unit.accountId != null ? String(unit.accountId) : "new");
                setSerial(unit.serial ?? "");
                setInstallDate(unit.installDate ?? "");
                setLogging(true);
              }}
            >
              Log the asset
            </Button>
          ) : null}
        </div>
      ) : null}

      <UnitModules unit={unit} def={def} config={c} canWrite={canWrite} customer={customer} platforms={rb.platforms} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Seg label="Machine" value={c.model} disabled={!canWrite} choices={def.models.map((m) => ({ val: m.id, label: m.label }))} onPick={(v) => pickJob("model", v)} />
        <Seg label="Service interval" value={c.pm} disabled={!canWrite} choices={def.intervals.map((i) => ({ val: i.id, label: i.label }))} onPick={(v) => pickJob("pm", v)} />
        {visibleOptions(def, c).map((o) => (
          <Seg key={o.key} label={o.label} value={c[o.key]} disabled={!canWrite} choices={o.choices} onPick={(v) => pickOption(o.key, v)} />
        ))}
      </div>

      {unit.missingInstallDate ? (
        <div className="grid gap-2 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900">
          <span>
            <b>No install date on file for this unit</b>, so its PM interval cannot be worked out from its age. Add the
            install date on the account equipment.
          </span>
          {unit.fromHistory ? (
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span>
                Suggested from the last full PM ({unit.fromHistory.basedOn[unit.fromHistory.basedOn.length - 1]?.interval}-month, PM #
                {unit.fromHistory.basedOn[unit.fromHistory.basedOn.length - 1]?.pmId}
                {unit.fromHistory.basedOn[unit.fromHistory.basedOn.length - 1]?.completedAt
                  ? `, ${unit.fromHistory.basedOn[unit.fromHistory.basedOn.length - 1]?.completedAt}`
                  : ""}
                ): <b>{unit.fromHistory.label}</b>
                {unit.fromHistory.combined ? ", the 12 + 36 together visit" : ""}.
              </span>
              {canWrite && unit.fromHistory.id !== c.pm ? (
                <Button type="button" size="sm" variant="outline" onClick={() => pickJob("pm", unit.fromHistory!.id)}>
                  Use suggestion
                </Button>
              ) : null}
            </span>
          ) : (
            <span>No earlier full PM on record for this unit either, so choose the interval yourself.</span>
          )}
        </div>
      ) : null}

      {unit.recommended && unit.recommended.id !== c.pm ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-900">
          <span>
            Recommended: <b>{unit.recommended.label}</b>
            {unit.recommended.combined ? " (12 + 36 together)" : ""}. Installed {unit.installDate}, so this is year{" "}
            {unit.recommended.year} at this location. Choose otherwise if the customer wants a different service.
          </span>
          {canWrite ? (
            <Button type="button" size="sm" variant="outline" onClick={() => pickJob("pm", unit.recommended!.id)}>
              Use recommended
            </Button>
          ) : null}
        </div>
      ) : unit.recommended ? (
        <p className="text-xs text-muted-foreground">
          Matches the recommendation from the install date ({unit.installDate}, year {unit.recommended.year}).
        </p>
      ) : null}

      {banners(def, c).map((b, i) => (
        <p
          key={i}
          className={cn(
            "rounded-md px-3 py-2 text-sm",
            b.tone === "warn" ? "bg-amber-100 text-amber-900" : b.tone === "bad" ? "bg-red-100 text-red-900" : "bg-emerald-50 text-emerald-900",
          )}
        >
          {b.text}
        </p>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          Kit lines <b className="font-mono">{view.kits.length}</b> · Kits in total <b className="font-mono">{totalKits(view.kits)}</b>
          {time ? (
            <>
              {" "}
              · Time allowance <b className="font-mono">{time}</b>
            </>
          ) : null}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => void copy("kits", kitListText(def, c, header, prices ?? undefined))}>
          {copied === "kits" ? <Check className="size-4" /> : <ClipboardCopy className="size-4" />}
          Copy kit list
        </Button>
      </div>

      {priceSummary ? (
        <p className="text-sm text-muted-foreground">
          {anyFound(priceSummary) ? (
            <>
              Kit list at sell price <b className="font-mono text-foreground">{usd(priceSummary.total)}</b>
              {uncountedNote(priceSummary) ? ` (${uncountedNote(priceSummary)})` : ""}
            </>
          ) : (
            "No kit prices found in the parts catalog yet."
          )}
          {priceSummary.missing > 0 ? (
            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">
              {priceSummary.missing} kit{priceSummary.missing === 1 ? "" : "s"} not in parts catalog
            </span>
          ) : null}
        </p>
      ) : priceQ.isError ? (
        <p className="text-sm text-amber-900">
          Kit prices could not be loaded from the parts catalog, so the copied kit list has none.{" "}
          <button type="button" className="font-medium underline" onClick={() => void priceQ.refetch()}>
            Try again
          </button>
        </p>
      ) : priceQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Looking up kit prices in the parts catalog…</p>
      ) : null}

      <div className="grid gap-3">
        <h4 className="text-sm font-semibold">Kits to order and check in</h4>
        {view.modules.length ? (
          view.modules.map((m) => (
            <div key={m.module} className="grid gap-1.5">
              <div className="border-b-2 border-border pb-1 text-sm font-semibold">{m.module}</div>
              {m.kits.map((k) => {
                const key = `kit:${k.ev}`;
                const on = !!unit.checks[key];
                return (
                  <label key={k.ev} className={cn("flex items-start gap-3 rounded-md border border-border p-2", on && "bg-muted")}>
                    <input
                      type="checkbox"
                      className="mt-1 size-5 accent-[var(--primary)]"
                      checked={on}
                      disabled={!canWrite || tick.isPending}
                      onChange={(e) => toggle(key, e.target.checked)}
                    />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="font-mono font-semibold">{k.ev}</span> <span className={cn(on && "line-through opacity-70")}>{k.name}</span>
                      {k.parts.length > 1 ? (
                        <span className="block text-xs font-medium">Made up of: {k.parts.map((p) => `${p.q} x ${p.label}`).join(" + ")}</span>
                      ) : null}
                      {k.notes.length ? <span className="block text-xs text-muted-foreground">{k.notes.join(" ")}</span> : null}
                      {(() => {
                        const p = prices?.find((x) => x.ev === k.ev);
                        if (!p) return null;
                        const text = kitPriceParts(p).join(" · ");
                        return p.status === "priced" ? (
                          <span className="block text-xs text-muted-foreground">{text}</span>
                        ) : (
                          <span className="mt-0.5 block w-fit rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">{text}</span>
                        );
                      })()}
                      {on && stamp(key) ? <span className="block text-xs text-muted-foreground">Checked in: {stamp(key)}</span> : null}
                    </span>
                    <span className="font-mono text-base font-semibold whitespace-nowrap">
                      x{k.q}
                      <small className="block text-right text-[10px] font-normal text-muted-foreground">{k.interval} mo</small>
                    </span>
                  </label>
                );
              })}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No kits for this setup.</p>
        )}
      </div>

      <div className="grid gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-sm font-semibold">Service steps</h4>
          <span className="text-xs text-muted-foreground">
            {view.stepDone} of {view.stepTotal} steps done
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded bg-muted" aria-hidden="true">
          <div className="h-full bg-primary" style={{ width: `${view.stepTotal ? Math.round((view.stepDone / view.stepTotal) * 100) : 0}%` }} />
        </div>
        {view.steps.map((g) => (
          <div key={g.module} className="grid gap-1.5">
            <div className="border-b-2 border-border pb-1 text-sm font-semibold">{g.module}</div>
            {g.items.map((s) => {
              const key = `step:${s.id}`;
              const on = !!unit.checks[key];
              return (
                <label key={s.id} className={cn("flex items-start gap-3 rounded-md border border-border p-2", on && "bg-muted")}>
                  <input
                    type="checkbox"
                    className="mt-1 size-5 accent-[var(--primary)]"
                    checked={on}
                    disabled={!canWrite || tick.isPending}
                    onChange={(e) => toggle(key, e.target.checked)}
                  />
                  <span className="min-w-0 flex-1 text-sm">
                    <span className={cn(on && "line-through opacity-70")}>{s.text}</span>
                    {s.ref ? <span className="block font-mono text-xs text-muted-foreground">{s.ref}</span> : null}
                    {on && stamp(key) ? <span className="block text-xs text-muted-foreground">Done: {stamp(key)}</span> : null}
                  </span>
                </label>
              );
            })}
          </div>
        ))}
        {canWrite && Object.keys(unit.checks).length ? (
          <div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={armed ? "border-red-700 bg-red-100 text-red-900" : undefined}
              onClick={() => {
                if (armed) {
                  clear.mutate({ pmId, unitKey: unit.unitKey });
                  setArmed(false);
                } else setArmed(true);
              }}
            >
              {armed ? "Tap again to clear every tick" : "Clear all ticks"}
            </Button>
          </div>
        ) : null}
      </div>

      {unit.earlier.length ? (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold">Earlier PMs on this unit ({unit.earlier.length})</summary>
          <ul className="mt-2 grid gap-1 text-xs text-muted-foreground">
            {unit.earlier.map((e) => (
              <li key={e.pmId}>
                PM #{e.pmId} · {e.status}
                {e.completedAt ? ` · completed ${e.completedAt}` : ""} · {e.kits} kits checked in, {e.steps} steps done
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {unit.history.length ? (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold">History for this unit</summary>
          <ul className="mt-2 grid gap-2 text-xs text-muted-foreground">
            {unit.history.map((h, i) => (
              <li key={i} className="break-words whitespace-pre-wrap">
                {new Date(h.at).toLocaleDateString()} · {h.who ?? "Someone"}: {h.detail}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {def.changes?.supersessions?.length || def.changes?.stockNote ? (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold">Number changes: check your stock labels</summary>
          <div className="mt-2 grid gap-2">
            {def.changes?.stockNote ? (
              <p className="rounded-md bg-amber-100 px-3 py-2 text-amber-900">
                <b>{def.changes.stockNote.title}</b> {def.changes.stockNote.text}
              </p>
            ) : null}
            <ul className="grid gap-1 text-xs">
              {(def.changes?.supersessions ?? []).map((r) => (
                <li key={r[0] + r[1]}>
                  <span className="font-mono">{r[0]}</span> → <span className="font-mono">{r[1]}</span>: {r[2]}
                </li>
              ))}
            </ul>
          </div>
        </details>
      ) : null}
      {dialog}
      <Dialog open={logging} onOpenChange={(o) => !o && !logAsset.isPending && setLogging(false)}>
        <DialogContent data-testid="log-asset">
          <DialogTitle>Log the asset</DialogTitle>
          <DialogDescription>
            {def.models.find((m) => m.id === c.model)?.label ?? unit.piece}. Serial is required. Install date is optional. Ticks already on this line move to the unit.
          </DialogDescription>
          <form
            className="mt-3 grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              logAsset.mutate({
                pmId,
                pieceKey: unit.pieceKey,
                accountId: choice === "new" ? null : Number(choice),
                serial,
                installDate: installDate || null,
              });
            }}
          >
            <label className="grid gap-1 text-sm">
              <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Account unit</span>
              <select
                className="h-10 w-full rounded-md border border-border bg-background px-2"
                value={choice}
                onChange={(e) => setChoice(e.target.value)}
              >
                <option value="new">Add a new unit</option>
                {(q.data?.accountUnits ?? []).map((a) => {
                  const taken = units.some((u) => u.accountId === a.id && u.pieceKey !== unit.pieceKey);
                  return (
                    <option key={a.id} value={a.id} disabled={taken}>
                      {a.name}
                      {a.serial ? ` · SN ${a.serial}` : " · no serial"}
                      {taken ? " · already on this PM" : ""}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Serial</span>
              <Input value={serial} onChange={(e) => setSerial(e.target.value)} required={choice === "new" || !(q.data?.accountUnits ?? []).find((a) => String(a.id) === choice)?.serial} autoComplete="off" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Install date</span>
              <Input type="date" value={installDate} onChange={(e) => setInstallDate(e.target.value)} />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={logAsset.isPending}>
                {logAsset.isPending ? "Saving…" : "Log the asset"}
              </Button>
              <Button type="button" variant="outline" disabled={logAsset.isPending} onClick={() => setLogging(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
