import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { getDuplicateSerials } from "@/lib/ops/account-equip-import";
import { listUnitMismatches } from "@/lib/ops/inspection-api";
import { formatShortDate } from "@/lib/ops/clock";
import { notLoadedText } from "@/lib/ops/load-problem";

export const Route = createFileRoute("/_app/unit-mismatches")({ component: Page });

/**
 * Installs whose Equipment list and Pre-inspection disagree. Read-only: each one is fixed in its install window, where
 * someone chooses to add the machine to the list or take it off the pre-inspection.
 */
function Page() {
  const q = useQuery({ queryKey: ["unit-mismatches"], queryFn: () => listUnitMismatches() });
  const rows = q.data ?? [];
  // Serials on more than one account unit (11/9): a read-only list to clear before a rule can refuse them.
  const dupes = useQuery({ queryKey: ["duplicate-serials"], queryFn: () => getDuplicateSerials() });
  const doubled = dupes.data ?? [];
  return (
    <div>
      <header>
        <h1 className="font-display text-3xl font-medium tracking-tight">Equipment Mismatches</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Installs whose Equipment list and Pre-inspection don't list the same machines, and machines with no serial or a short one
          ("L") that a unit already on the account likely is. Nothing here changes on its own: open the install, and on its
          Equipment tab add each machine to the list, take it off the pre-inspection, or link it to the unit it is.
        </p>
      </header>

      {q.isLoading ? <p className="mt-6 text-sm text-muted-foreground">Checking every install…</p> : null}
      {q.data ? (
        <p className="mt-4 text-sm text-muted-foreground" data-testid="mismatch-count">
          {rows.length ? `${rows.length} install${rows.length === 1 ? "" : "s"} to review` : "Every install's Equipment list and Pre-inspection match."}
        </p>
      ) : null}
      {q.isError ? <p className="mt-6 text-sm text-destructive">{notLoadedText(q, "equipment mismatch")}</p> : null}

      <ul className="mt-4 grid gap-3" data-testid="mismatch-list">
        {rows.map((r) => (
          <li key={r.installId} className="rounded-lg border border-border bg-card p-4" data-testid={`mismatch-${r.installId}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">#{r.installId}</span>
              <span className="font-medium">{r.customer}</span>
              {r.installed ? (
                <Badge size="tight" variant="outline">
                  Installed
                </Badge>
              ) : r.equipStatus ? (
                <Badge size="tight" variant="outline">
                  {r.equipStatus}
                </Badge>
              ) : null}
              <Link
                to="/installs"
                search={{ open: r.installId }}
                className="ml-auto text-sm text-primary underline-offset-4 hover:underline"
                data-testid={`mismatch-open-${r.installId}`}
              >
                Open the install
              </Link>
            </div>
            {r.onlyOnPreInspection.length ? (
              <div className="mt-2">
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">On the Pre-inspection only</p>
                <ul className="mt-1 grid gap-1 text-sm">
                  {r.onlyOnPreInspection.map((u) => (
                    <li key={u.equipmentId}>
                      {u.name}
                      <span className="text-muted-foreground">
                        {" · "}
                        {u.serial ? `SN ${u.serial}` : "No serial"} · Pre-inspection {u.overall.toLowerCase()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {r.onlyOnList.length ? (
              <div className="mt-2">
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">On the Equipment list only</p>
                <ul className="mt-1 grid gap-1 text-sm">
                  {r.onlyOnList.map((m, i) => (
                    <li key={`${m.equipment}-${i}`}>
                      {m.equipment}
                      <span className="text-muted-foreground">{m.serial ? ` · SN ${m.serial}` : " · No serial"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {r.onAccount.length ? (
              <div className="mt-2">
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">On the account, likely a machine here</p>
                <ul className="mt-1 grid gap-1 text-sm">
                  {r.onAccount.map((a) => (
                    <li key={`${a.name}-${a.serial}`}>
                      {a.name}
                      <span className="text-muted-foreground">
                        {` · SN ${a.serial}`}
                        {a.records > 1 ? ` · ${a.records} records on the account` : ""}
                        {` · may be the ${a.machines.join(" or the ")}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <section className="mt-10" data-testid="duplicate-serials">
        <h2 className="font-display text-xl font-medium tracking-tight">Serials On More Than One Unit</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          A serial should be on one machine. Open each account and, on its Equipment tab, Merge the two units when they're the same
          machine on one account, or Remove the one that's wrong. Nothing here changes on its own.
        </p>
        {dupes.isLoading ? <p className="mt-4 text-sm text-muted-foreground">Checking every account's equipment…</p> : null}
        {dupes.isError ? <p className="mt-4 text-sm text-destructive">{notLoadedText(dupes, "duplicate serial")}</p> : null}
        {dupes.data ? (
          <p className="mt-4 text-sm text-muted-foreground" data-testid="duplicate-serial-count">
            {doubled.length ? `${doubled.length} serial${doubled.length === 1 ? "" : "s"} to review` : "No serial is on more than one unit."}
          </p>
        ) : null}
        <ul className="mt-4 grid gap-3">
          {doubled.map((d) => (
            <li key={d.serialKey} className="rounded-lg border border-border bg-card p-4" data-testid="duplicate-serial">
              <p className="font-medium">SN {d.units[0]?.serial ?? d.serialKey}</p>
              <ul className="mt-2 grid gap-1.5 text-sm">
                {d.units.map((u) => (
                  <li key={u.id} className="flex flex-wrap items-baseline gap-x-2">
                    {u.customerId ? (
                      <Link to="/customers" search={{ open: u.customerId }} className="text-primary underline-offset-4 hover:underline">
                        {u.customer}
                      </Link>
                    ) : (
                      <span>{u.customer}</span>
                    )}
                    <span className="text-muted-foreground">
                      {[u.equipmentName, u.installDate ? `Installed ${formatShortDate(u.installDate)}` : null, u.locked ? "Locked" : null].filter(Boolean).join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
