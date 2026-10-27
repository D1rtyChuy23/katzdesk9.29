import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CheckCircle2, FileText } from "lucide-react";
import { toast } from "sonner";
import { projectLabel, ticketLines, ticketOpen } from "@/lib/ops/deal-board";
import { findRecipeFor, recipeLabel } from "@/lib/ops/equipment";
import { previewSetting } from "@/lib/ops/recipe-fields";
import type { MachineSpec } from "@/lib/ops/machines";
import type { Install, Recipe } from "@/lib/ops/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSaveAll } from "./save-all";

/** The recipe a unit shows on its row: the one picked, else the one the account or the house already has for the model. */
function recipeFor(recipes: Recipe[], install: Install, m: MachineSpec): Recipe | null {
  const picked = m.recipeId ? recipes.find((r) => r.id === m.recipeId) : null;
  if (picked) return picked;
  const found = findRecipeFor(recipes, { customer: install.customer, model: m.equipment, installId: install.id });
  return found.linked ?? found.house ?? null;
}

function recipeText(r: Recipe | null): string {
  if (!r) return "";
  const first = previewSetting(r);
  return first ? `${recipeLabel(r)} · ${first}` : recipeLabel(r);
}

function meta(install: Install): [string, string][] {
  return [
    ["Install date", install.installDate ?? "Not set"],
    ["Tech", install.technician ?? "Not assigned"],
    ["WO #", install.workOrders?.length ? install.workOrders.map((w) => w.wo).join(", ") : install.wo ?? "Not set"],
    ["Account rep", install.accountRep ?? "Not set"],
  ];
}

/**
 * Opens the Equipment Request Form. In the install window it saves the window first (the same as Save: the Details,
 * a WO typed in Add WO, the Equipment tab's edits), so the form shows what was just typed. A save that fails keeps
 * the window open with its message.
 */
function PrintFormButton({ installId }: { installId: number }) {
  const navigate = useNavigate();
  const saveAll = useSaveAll();
  const [saving, setSaving] = useState(false);
  const open = () => void navigate({ to: "/installs/$installId/print", params: { installId: String(installId) } });
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="ml-auto"
      data-testid="install-ticket-print"
      disabled={saving}
      onClick={async () => {
        if (!saveAll) return open();
        setSaving(true);
        const saved = await saveAll.saveAndWait();
        setSaving(false);
        if (saved) open();
      }}
    >
      <FileText className="size-4" />
      {saving ? "Saving…" : "Equipment Form"}
    </Button>
  );
}

/**
 * The install ticket for a board project. It opens once the project is Ready (equipment Ready and the
 * pre-inspection passed) and is read from the project's own machine rows: Sold, Loan or Lease, recipe,
 * and configuration (volts, plug, water when the unit takes it). Nothing is typed here twice.
 */
export function InstallTicket({ install, machines, recipes }: { install: Install; machines: MachineSpec[]; recipes: Recipe[] }) {
  const ready = ticketOpen(install.equipStatus, install.inspection?.overall) && !install.complete;
  const box = useRef<HTMLElement>(null);
  const was = useRef<{ id: number; ready: boolean } | null>(null);
  useEffect(() => {
    // Ready just now, with this window open: bring the ticket into view.
    if (was.current && was.current.id === install.id && !was.current.ready && ready) {
      toast.success("Project Ready. The install ticket is open.");
      box.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
    was.current = { id: install.id, ready };
  }, [install.id, ready]);
  if (install.complete) return null;
  if (!ready) {
    return (
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3 text-xs text-muted-foreground" data-testid="install-ticket" data-state="waiting">
        <span className="font-medium text-foreground">Install ticket</span>
        <span>opens when this project is Ready: equipment status Ready and the pre-inspection passed.</span>
        <PrintFormButton installId={install.id} />
      </div>
    );
  }
  const lines = ticketLines(machines, (_id, m) => recipeText(recipeFor(recipes, install, m as MachineSpec)));
  const missing = lines.reduce((n, l) => n + l.missing.length, 0);
  const blank = (v: string, expected: boolean) => (v ? v : <span className={expected ? "font-medium text-warning" : "text-muted-foreground"}>Not set</span>);

  return (
    <section ref={box} className="border-b border-border bg-success/[0.06] px-5 py-4" aria-label="Install ticket" data-testid="install-ticket" data-state="open">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-lg font-medium">Install Ticket</h3>
        <Badge size="tight" variant="success">
          <CheckCircle2 className="mr-1 size-3.5" />
          Project Ready
        </Badge>
        {install.project && install.project.of > 1 ? <Badge size="tight" variant="outline">{projectLabel(install.project.n, install.project.of)}</Badge> : null}
        <PrintFormButton installId={install.id} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Filled from this project. {meta(install).map(([k, v]) => `${k}: ${v}`).join(" · ")}
      </p>
      <ul className="mt-3 grid gap-2">
        {lines.map((l, i) => (
          <li key={`${l.model}-${i}`} className="rounded-lg border border-border bg-card p-3" data-testid="ticket-machine">
            <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
              {l.model}
              {l.ownership ? (
                <Badge size="tight" variant={l.ownership === "Sold" ? "primary" : "outline"} data-testid="ticket-ownership">
                  {l.ownership}
                </Badge>
              ) : (
                <span className="text-xs font-medium text-warning">Sold, Loan or Lease not set</span>
              )}
              {l.serial ? <span className="text-xs font-normal text-muted-foreground">SN {l.serial}</span> : null}
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Volts</dt>
                <dd data-testid="ticket-volts">{blank(l.volts, true)}</dd>
              </div>
              <div>
                <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Plug</dt>
                <dd data-testid="ticket-plug">{blank(l.plug, true)}</dd>
              </div>
              {l.water == null ? null : (
              <div>
                <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Water</dt>
                <dd data-testid="ticket-water">{blank(l.water, l.waterNeed === "required")}</dd>
              </div>
              )}
              <div>
                <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Recipe</dt>
                <dd data-testid="ticket-recipe">{blank(l.recipe, l.missing.includes("Recipe"))}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
      {!lines.length ? <p className="mt-2 text-sm text-muted-foreground">No machines on this project yet.</p> : null}
      {missing ? (
        <p className="mt-2 text-xs text-muted-foreground" data-testid="ticket-missing">
          {missing} field{missing === 1 ? "" : "s"} not set. Set {missing === 1 ? "it" : "them"} on the machine rows below; the ticket reads from there.
        </p>
      ) : null}
    </section>
  );
}
