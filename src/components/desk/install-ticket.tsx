import { useEffect, useRef } from "react";
import { CheckCircle2, Printer } from "lucide-react";
import { toast } from "sonner";
import { NO_WATER_NOTE, projectLabel, ticketLines, ticketOpen, type TicketLine } from "@/lib/ops/deal-board";
import { findRecipeFor, recipeLabel } from "@/lib/ops/equipment";
import { previewSetting } from "@/lib/ops/recipe-fields";
import type { MachineSpec } from "@/lib/ops/machines";
import type { Install, Recipe } from "@/lib/ops/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const esc = (s: string) => s.replace(/&/g, "&" + "amp;").replace(/</g, "&" + "lt;").replace(/>/g, "&" + "gt;").replace(/"/g, "&" + "quot;");

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
    ["WO #", install.wo ?? "Not set"],
    ["Account rep", install.accountRep ?? "Not set"],
  ];
}

function printTicket(install: Install, lines: TicketLine[]) {
  const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!w) {
    toast.error("Allow pop-ups to print the install ticket.");
    return;
  }
  const cell = (v: string | null) => (v == null ? NO_WATER_NOTE : v || "Not set");
  const rows = lines
    .map(
      (l) =>
        `<tr><td>${esc(l.model)}</td><td>${esc(cell(l.ownership))}</td><td>${esc(cell(l.serial))}</td><td>${esc(cell(l.volts))}</td><td>${esc(cell(l.plug))}</td><td>${esc(cell(l.water))}</td><td>${esc(cell(l.recipe))}</td><td>${esc(cell(l.coffee))}</td></tr>`,
    )
    .join("");
  w.document.write(`<!doctype html><html><head><title>Install Ticket · ${esc(install.customer)}</title>
    <style>
      body { font: 13px/1.4 system-ui, sans-serif; padding: 24px; color: #1a1612; }
      h1 { font-size: 22px; margin: 0 0 4px; }
      p { color: #5c5348; margin: 0 0 16px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #d7cfc4; padding: 6px 8px; text-align: left; vertical-align: top; }
      th { background: #f4efe8; }
    </style></head><body>
    <h1>Install Ticket · ${esc(install.customer)}</h1>
    <p>${meta(install).map(([k, v]) => `${esc(k)}: ${esc(v)}`).join(" · ")}</p>
    <table><thead><tr><th>Model</th><th>Sold / Loaned</th><th>Serial</th><th>Volts</th><th>Plug</th><th>Water</th><th>Recipe</th><th>Coffee</th></tr></thead><tbody>${rows}</tbody></table>
    </body></html>`);
  w.document.close();
  w.focus();
  w.print();
}

/**
 * The install ticket for a board project. It opens once the project is Ready (equipment Ready and the
 * pre-inspection passed) and is read from the project's own machine rows: Sold or Loaned, recipe,
 * configuration (volts, plug, water when the unit takes it) and coffee. Nothing is typed here twice.
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
      <div className="border-b border-border px-5 py-3 text-xs text-muted-foreground" data-testid="install-ticket" data-state="waiting">
        <span className="font-medium text-foreground">Install ticket</span> opens when this project is Ready: equipment status Ready and the pre-inspection passed.
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
        <Button type="button" size="sm" variant="outline" className="ml-auto" onClick={() => printTicket(install, lines)} data-testid="install-ticket-print">
          <Printer className="size-4" />
          Print
        </Button>
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
                <span className="text-xs font-medium text-warning">Sold or Loaned not set</span>
              )}
              {l.serial ? <span className="text-xs font-normal text-muted-foreground">SN {l.serial}</span> : null}
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-5">
              <div>
                <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Volts</dt>
                <dd data-testid="ticket-volts">{blank(l.volts, true)}</dd>
              </div>
              <div>
                <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Plug</dt>
                <dd data-testid="ticket-plug">{blank(l.plug, true)}</dd>
              </div>
              <div>
                <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Water</dt>
                <dd data-testid="ticket-water">{l.water == null ? <span className="text-muted-foreground">{NO_WATER_NOTE}</span> : blank(l.water, l.waterNeed === "required")}</dd>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Recipe</dt>
                <dd data-testid="ticket-recipe">{blank(l.recipe, l.missing.includes("Recipe"))}</dd>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Coffee</dt>
                <dd data-testid="ticket-coffee">{blank(l.coffee, l.missing.includes("Coffee"))}</dd>
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
