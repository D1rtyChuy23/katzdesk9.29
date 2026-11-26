import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getMachinePage, MACHINE_NOT_FOUND, type MachineEvent, type MachineRecord } from "@/lib/ops/machine-page";
import { notLoadedText } from "@/lib/ops/load-problem";
import { OpenLink } from "@/components/desk/open-link";

export const Route = createFileRoute("/_app/machines/$machineId")({ component: Page });

const KIND_LABEL: Record<MachineEvent["kind"], string> = {
  history: "Equipment",
  ticket: "Ticket",
  pm: "PM",
  install: "Install",
  part: "Part",
  module: "Module",
  rebuild: "Rebuild",
  move: "Move",
  stock: "Warehouse",
  warehouse: "Warehouse",
  retired: "Retired",
};

/**
 * The Machine page (One Record Per Machine, phase M3): one machine, where it is now and everything that names it, newest
 * first. Read-only.
 */
function Page() {
  const { machineId } = Route.useParams();
  const id = Number(machineId);
  const valid = Number.isInteger(id) && id > 0;
  const q = useQuery({ queryKey: ["machine-page", id], queryFn: () => getMachinePage({ data: { id } }), enabled: valid });
  const m = q.data;
  const notFound = !valid || (q.isError && String((q.error as Error)?.message ?? "").includes(MACHINE_NOT_FOUND));
  return (
    <div>
      <header>
        <p className="text-xs tracking-wide text-muted-foreground uppercase">Machine</p>
        <h1 className="font-display text-3xl font-medium tracking-tight" data-testid="machine-title">
          {m ? (m.serial ? `SN ${m.serial}` : "No serial") : q.isLoading ? "…" : "Machine"}
        </h1>
        {m?.model ? <p className="mt-1 text-sm text-muted-foreground">{m.model}</p> : null}
      </header>

      {q.isLoading ? <p className="mt-6 text-sm text-muted-foreground">Reading its records…</p> : null}
      {notFound ? (
        <p className="mt-6 text-sm text-muted-foreground" data-testid="machine-not-found">
          {MACHINE_NOT_FOUND}
        </p>
      ) : q.isError ? (
        <p className="mt-6 text-sm text-destructive">{notLoadedText(q, "machine page")}</p>
      ) : null}

      {m ? (
        <>
          {m.mergedInto ? (
            <p className="mt-4 text-sm" data-testid="machine-merged">
              Its records and history went to{" "}
              <Link to="/machines/$machineId" params={{ machineId: String(m.mergedInto) }} className="underline underline-offset-2">
                another machine
              </Link>{" "}
              (the same serial, fixed).
            </p>
          ) : null}

          <section className="mt-6" data-testid="machine-records">
            <h2 className="text-lg font-medium">Where it is</h2>
            {m.records.length ? (
              <ul className="mt-2 space-y-1 text-sm">
                {m.records.map((r) => (
                  <li key={`${r.where}-${r.id}`}>
                    <RecordLine r={r} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No record has it now.</p>
            )}
            {m.modules.length ? (
              <p className="mt-2 text-sm">
                Modules on it:{" "}
                {m.modules.map((x, i) => (
                  <span key={x.id}>
                    {i ? ", " : ""}
                    <OpenLink entityType="module" id={x.id} className="underline underline-offset-2">
                      {x.moduleId}
                    </OpenLink>
                  </span>
                ))}
              </p>
            ) : null}
          </section>

          <section className="mt-6" data-testid="machine-timeline">
            <h2 className="text-lg font-medium">History</h2>
            {m.events.length ? (
              <ol className="mt-2 divide-y divide-border border-t border-border">
                {m.events.map((e, i) => (
                  <li key={i} className="py-2 text-sm sm:flex sm:items-baseline sm:gap-3" data-testid="machine-event">
                    {/* On a phone the day and kind sit above the line, so the line keeps the full width. */}
                    <span className="flex gap-3 text-xs text-muted-foreground sm:w-60 sm:shrink-0">
                      <span className="tabular-nums sm:w-36">{e.at || "No date"}</span>
                      <span>{KIND_LABEL[e.kind]}</span>
                    </span>
                    <span className="mt-0.5 block min-w-0 flex-1 [overflow-wrap:anywhere] sm:mt-0">
                      {e.link ? (
                        <OpenLink entityType={e.link.kind} id={e.link.id} className="underline-offset-2 hover:underline">
                          {e.text}
                        </OpenLink>
                      ) : (
                        e.text
                      )}
                      {e.who ? <span className="text-muted-foreground"> · {e.who}</span> : null}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Nothing names this machine yet.</p>
            )}
            {m.capped ? <p className="mt-2 text-xs text-muted-foreground">Older equipment and warehouse lines aren't shown.</p> : null}
          </section>
        </>
      ) : null}
    </div>
  );
}

function RecordLine({ r }: { r: MachineRecord }) {
  if (r.where === "account") {
    return (
      <>
        On{" "}
        {r.customerId ? (
          <OpenLink entityType="customer" id={r.customerId} className="underline underline-offset-2">
            {r.customer}
          </OpenLink>
        ) : (
          r.customer
        )}{" "}
        · {r.model}
        {r.serial ? ` · SN ${r.serial}` : ""}
      </>
    );
  }
  if (r.where === "warehouse") {
    return (
      <>
        <OpenLink entityType="asset" id={r.id} className="underline underline-offset-2">
          Warehouse record
        </OpenLink>{" "}
        · {r.model}
        {r.serial ? ` · SN ${r.serial}` : ""}
        {r.status ? ` · ${r.status}` : ""}
        {r.soldTo ? ` · sold to ${r.soldTo}` : ""}
      </>
    );
  }
  return (
    <span className="text-muted-foreground">
      {r.why} {r.retiredAt} · {r.model}
      {r.serial ? ` · SN ${r.serial}` : ""}
    </span>
  );
}
