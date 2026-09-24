import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { addDays, formatShortDate, todayChicago, weekBounds, WEEKDAYS, isOpenInstall } from "@/lib/ops/clock";
import { siteIsReady } from "@/lib/ops/pre-inspection";
import { InspectionBadge } from "./pre-inspection-panel";
import { updateInstall } from "@/lib/ops/api";
import { listedEquipment, findRecipeFor } from "@/lib/ops/equipment";
import { previewSetting, settingsFrom } from "@/lib/ops/recipe-fields";

import type { Install, Recipe } from "@/lib/ops/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OpenLink } from "./open-link";
import { AkBadge, NoRepFlag } from "./ak-badge";
import { StatusBadge } from "./flag-badge";
import { RepFilter, RepName } from "./rep-select";
import { sameRep } from "@/lib/ops/reps";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function mondayOf(iso: string): string {
  return weekBounds(iso).start;
}

function configPreview(i: Install, recipes: Recipe[]): string {
  const model = listedEquipment(i.equipment, [])[0] || i.equipment || "";
  const { linked, house } = findRecipeFor(recipes, { customer: i.customer, model, installId: i.id });
  const rec = linked ?? house;
  if (!rec) return "";
  return previewSetting(settingsFrom(rec))?.slice(0, 48) ?? "";
}

export function InstallPlanner({
  installs,
  recipes = [],
  myRep,
  catalog = [],
}: {
  installs: Install[];
  recipes?: Recipe[];
  myRep?: string | null;
  catalog?: string[];
}) {
  const today = todayChicago();
  const [anchor, setAnchor] = useState(mondayOf(today));
  const week = weekBounds(anchor);
  const days = WEEKDAYS.map((_, i) => addDays(week.start, i));
  const [rep, setRep] = useState("");
  const [ready, setReady] = useState<"all" | "ready" | "not">("all");
  const [akOnly, setAkOnly] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const qc = useQueryClient();
  const saveDate = useMutation({
    mutationFn: (d: { id: number; installDate: string | null }) => updateInstall({ data: d }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["installs"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not reschedule"),
  });

  const open = useMemo(
    () => installs.filter((i) => isOpenInstall(i)),
    [installs],
  );

  const rows = useMemo(() => {
    let list = open;
    if (rep === "__none__") list = list.filter((i) => i.noRep);
    else if (rep) list = list.filter((i) => sameRep(i.accountRep, rep));
    if (ready === "ready") list = list.filter((i) => siteIsReady(i.equipStatus, i.inspection?.overall));
    if (ready === "not") list = list.filter((i) => !siteIsReady(i.equipStatus, i.inspection?.overall));
    if (akOnly) list = list.filter((i) => i.aviKatz);
    if (from) list = list.filter((i) => (i.installDate ?? "") >= from);
    if (to) list = list.filter((i) => (i.installDate ?? "") <= to);
    return [...list].sort((a, b) => (a.installDate ?? "9999").localeCompare(b.installDate ?? "9999") || a.customer.localeCompare(b.customer));
  }, [open, rep, ready, akOnly, from, to]);

  const weekRows = rows.filter((i) => i.installDate && i.installDate >= week.start && i.installDate <= week.end);
  const dayCounts = new Map<string, number>();
  for (const i of weekRows) {
    if (i.installDate) dayCounts.set(i.installDate, (dayCounts.get(i.installDate) ?? 0) + 1);
  }
  const techWeek = new Map<string, number>();
  for (const i of weekRows) {
    const t = (i.technician || i.accountRep || "unassigned").toLowerCase();
    techWeek.set(t, (techWeek.get(t) ?? 0) + 1);
  }
  function conflict(i: Install): "day" | "week" | null {
    if (!i.installDate) return null;
    if ((dayCounts.get(i.installDate) ?? 0) > 1) return "day";
    const t = (i.technician || i.accountRep || "unassigned").toLowerCase();
    if ((techWeek.get(t) ?? 0) > 1) return "week";
    return null;
  }

  function jump(delta: number) {
    setAnchor(addDays(week.start, delta * 7));
  }

  function printWeek() {
    const w = window.open("", "_blank", "noopener,noreferrer,width=980,height=720");
    if (!w) {
      toast.error("Allow pop-ups to print the planner.");
      return;
    }
    const body = rows
      .map((i) => {
        const hit = i.installDate && i.installDate >= week.start && i.installDate <= week.end ? "this week" : "";
        return `<tr><td>${esc(i.customer)}</td><td>${esc(i.equipment ?? "")}</td><td>${esc(i.equipStatus ?? "")}</td><td>${esc(i.installDate ?? "")}</td><td>${esc(i.accountRep ?? "")}</td><td>${esc(i.technician ?? "")}</td><td>${hit}</td></tr>`;
      })
      .join("");
    w.document.write(`<!doctype html><html><head><title>Install planner</title>
      <style>
        body { font: 13px/1.4 system-ui, sans-serif; padding: 24px; color: #1a1612; }
        h1 { font-size: 20px; margin: 0 0 8px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #d7cfc4; padding: 6px 8px; text-align: left; }
        th { background: #f4efe8; }
      </style></head><body>
      <h1>Install planner · ${week.start} – ${week.end}</h1>
      <table><thead><tr><th>Account</th><th>Equipment</th><th>Ready</th><th>Install date</th><th>Rep</th><th>Tech</th><th>This week</th></tr></thead>
      <tbody>${body}</tbody></table></body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl leading-tight">Install planner</h2>
          <p className="text-[11px] text-muted-foreground">
            One bar per project. Overlaps in the same week light up. Changing a date here updates the install date used on exports.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => jump(-1)} aria-label="Previous week">
            <ChevronLeft className="size-4" />
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setAnchor(mondayOf(today))}>
            This week
          </Button>
          {myRep ? (
            <Button type="button" size="sm" variant={rep === myRep ? "ink" : "outline"} onClick={() => setRep(rep === myRep ? "" : myRep)}>
              My week
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="outline" onClick={() => jump(1)} aria-label="Next week">
            <ChevronRight className="size-4" />
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={printWeek}>
            <Printer className="size-4" />
            Print
          </Button>
        </div>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        {formatShortDate(week.start)} – {formatShortDate(week.end)} · {weekRows.length} on the timeline this week
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <RepFilter
          value={rep}
          onChange={setRep}
          extraNames={open.map((i) => i.accountRep)}
          className="w-44"
        />
        <select
          className="h-10 rounded-md border border-input bg-card px-3 text-sm"
          value={ready}
          onChange={(e) => setReady(e.target.value as "all" | "ready" | "not")}
          aria-label="Ready filter"
        >
          <option value="all">Ready + not ready</option>
          <option value="ready">Ready</option>
          <option value="not">Not ready</option>
        </select>
        <label className="flex h-10 items-center gap-2 rounded-md border border-input px-3 text-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={akOnly} onChange={(e) => setAkOnly(e.target.checked)} />
          AK
        </label>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" className="w-36" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" className="w-36" />
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[40rem]">
          <div className="grid grid-cols-[minmax(10rem,1.4fr)_repeat(7,minmax(2.4rem,1fr))] gap-1 text-[10px] tracking-wide text-muted-foreground uppercase">
            <span>Project</span>
            {days.map((d, i) => (
              <span key={d} className={cn("text-center", d === today && "font-semibold text-foreground")}>
                {WEEKDAYS[i]} {formatShortDate(d)}
              </span>
            ))}
          </div>
          <ul className="mt-1 space-y-1">
            {rows.map((i) => {
              const hit = i.installDate && i.installDate >= week.start && i.installDate <= week.end;
              const col = hit && i.installDate ? days.indexOf(i.installDate) : -1;
              const clash = conflict(i);
              const cfg = configPreview(i, recipes);
              const models = listedEquipment(i.equipment, catalog).join(" · ") || i.equipment || "—";
              return (
                <li
                  key={i.id}
                  className={cn(
                    "grid grid-cols-[minmax(10rem,1.4fr)_repeat(7,minmax(2.4rem,1fr))] items-stretch gap-1 rounded-md border border-transparent px-0.5 py-0.5",
                    clash === "day" && "border-destructive/40 bg-destructive/6",
                    clash === "week" && "border-warning/40 bg-warning/8",
                  )}
                >
                  <div className="min-w-0 py-1 pr-2">
                    <OpenLink entityType="install" id={i.id} className="flex min-w-0 items-center gap-1.5 hover:underline">
                      <span className="truncate font-medium">{i.customer}</span>
                      <AkBadge on={i.aviKatz} />
                    </OpenLink>
                    <p className="truncate text-[11px] text-muted-foreground">{models}</p>
                    {cfg ? <p className="truncate text-[11px] text-muted-foreground">{cfg}</p> : null}
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <StatusBadge tight status={i.equipStatus === "Ready" ? "Ready" : "Not Ready"} />
                      <InspectionBadge
                        overall={i.inspection?.overall}
                        passed={i.inspection?.passedCount}
                        total={i.inspection?.machineCount}
                      />
                      <RepName name={i.accountRep} />
                      <NoRepFlag show={i.noRep} />
                    </div>
                    <label className="mt-1 block text-[11px] text-muted-foreground">
                      Date
                      <input
                        type="date"
                        className="ml-1 rounded border border-input bg-card px-1 py-0.5 text-xs text-foreground"
                        value={i.installDate ?? ""}
                        onChange={(e) => saveDate.mutate({ id: i.id, installDate: e.target.value || null })}
                      />
                    </label>
                  </div>
                  {days.map((d, idx) => (
                    <div
                      key={d}
                      className={cn(
                        "relative min-h-10 rounded-sm bg-secondary/50",
                        d === today && "ring-1 ring-primary/40",
                      )}
                    >
                      {col === idx ? (
                        <span
                          className={cn(
                            "absolute inset-1 rounded-sm bg-primary/80",
                            clash === "day" && "bg-destructive",
                            clash === "week" && "bg-warning",
                          )}
                          title={`${i.customer} · ${formatShortDate(d)}`}
                        />
                      ) : null}
                    </div>
                  ))}
                </li>
              );
            })}
            {rows.length === 0 ? (
              <li className="px-1 py-6 text-sm text-muted-foreground">No installs match these filters.</li>
            ) : null}
          </ul>
        </div>
      </div>
    </div>
  );
}

function esc(s: string) {
  return s
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;");
}
