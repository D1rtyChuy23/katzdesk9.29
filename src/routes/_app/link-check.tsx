import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { getLinkCheck, type NameLinkReport, type NameSample } from "@/lib/ops/link-check";
import { notLoadedText } from "@/lib/ops/load-problem";

export const Route = createFileRoute("/_app/link-check")({ component: Page });

const fmt = (n: number) => n.toLocaleString("en-US");

/**
 * Link Check (Phase 0 of "One Record Per Machine Plan", 11/24): how records point at customers and machines today.
 * Read-only, admins only. Its counts decide what the next phases backfill and what needs a person first.
 */
function Page() {
  const q = useQuery({ queryKey: ["link-check"], queryFn: () => getLinkCheck(), staleTime: 60_000 });
  const r = q.data;
  return (
    <div>
      <header>
        <h1 className="font-display text-3xl font-medium tracking-tight">Link Check</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          How records point at customers and machines today. Nothing here changes anything. Names that find no account, or more
          than one, are the ones a person decides before records are linked by account id. See also{" "}
          <Link to="/unit-mismatches" className="underline underline-offset-2">
            Equipment Mismatches
          </Link>
          .
        </p>
      </header>

      {q.isLoading ? <p className="mt-6 text-sm text-muted-foreground">Reading every table…</p> : null}
      {q.isError ? <p className="mt-6 text-sm text-destructive">{notLoadedText(q, "link check")}</p> : null}

      {r ? (
        <>
          <section className="mt-6" data-testid="link-check-accounts">
            <h2 className="text-lg font-medium">Accounts</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {fmt(r.accounts.listed)} on the list ({fmt(r.accounts.inactive)} Inactive, {fmt(r.accounts.retired)} Retired) · {fmt(r.accounts.archived)} removed ·{" "}
              {fmt(r.accounts.merged)} merged away · {fmt(r.accounts.withNetsuiteId)} with a NetSuite id
              {r.accounts.sameNameOtherCase ? ` · ${fmt(r.accounts.sameNameOtherCase)} listed accounts share a name in other capitals` : ""}
            </p>
          </section>

          <section className="mt-8" data-testid="link-check-names">
            <h2 className="text-lg font-medium">Records that name a customer</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Rows by how their customer name finds an account on the list. <b>Exact</b> and <b>Capitals</b> link on their own.{" "}
              <b>Spaces</b> (only with spaces at the ends dropped) link too, but rename and the lists don't find them today. <b>Several</b>,{" "}
              <b>Punctuation</b>, <b>Removed only</b> (just a removed or merged-away account has the name) and <b>No account</b> need a person.
              <b>Inactive</b>: rows that link to an Inactive or Retired account. A table marked "not renamed" keeps the old name after a rename.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Records</th>
                    <th className="py-1 pr-3 text-right font-medium">Rows</th>
                    <th className="py-1 pr-3 text-right font-medium">Exact</th>
                    <th className="py-1 pr-3 text-right font-medium">Capitals</th>
                    <th className="py-1 pr-3 text-right font-medium">Spaces</th>
                    <th className="py-1 pr-3 text-right font-medium">Several</th>
                    <th className="py-1 pr-3 text-right font-medium">Punctuation</th>
                    <th className="py-1 pr-3 text-right font-medium">Removed only</th>
                    <th className="py-1 pr-3 text-right font-medium">No account</th>
                    <th className="py-1 pr-3 text-right font-medium">Walk-in / blank</th>
                    <th className="py-1 text-right font-medium">Inactive</th>
                  </tr>
                </thead>
                <tbody>
                  {r.nameLinks.map((l) => (
                    <tr key={`${l.table}.${l.column}`} className="border-t border-border" data-testid={`link-row-${l.table}-${l.column}`}>
                      <td className="py-1.5 pr-3">
                        {l.label}
                        {!l.rewritten ? (
                          <Badge size="tight" variant="outline" className="ml-2">
                            not renamed
                          </Badge>
                        ) : null}
                        {!l.present ? <span className="ml-2 text-xs text-muted-foreground">(not on this database)</span> : null}
                        {l.ids ? (
                          <span className="mt-0.5 block text-xs text-muted-foreground" data-testid={`link-ids-${l.table}`}>
                            By id: {fmt(l.ids.linked)} linked · {fmt(l.ids.unlinked)} not
                            {l.ids.disagree ? <span className="font-medium text-amber-700 dark:text-amber-400"> · {fmt(l.ids.disagree)} with another name</span> : null}
                            {l.ids.onRemoved ? <span className="font-medium text-amber-700 dark:text-amber-400"> · {fmt(l.ids.onRemoved)} on a removed account</span> : null}
                            {l.ids.offRule ? <span className="font-medium text-amber-700 dark:text-amber-400"> · {fmt(l.ids.offRule)} not what the name gives now</span> : null}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{fmt(l.rows)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{fmt(l.byMatch.exact)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{fmt(l.byMatch.case)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{fmt(l.byMatch.trimmed)}</td>
                      <Need n={l.byMatch.several} />
                      <Need n={l.byMatch.loose} />
                      <Need n={l.byMatch.archivedOnly} />
                      <Need n={l.byMatch.none} />
                      <td className="py-1.5 pr-3 text-right tabular-nums">{fmt(l.byMatch.walkin + l.byMatch.blank)}</td>
                      <td className="py-1.5 text-right tabular-nums">{fmt(l.inactiveRows)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 grid gap-2">
              {r.nameLinks.filter(hasSamples).map((l) => (
                <Samples key={`${l.table}.${l.column}`} link={l} />
              ))}
            </div>
          </section>

          <section className="mt-8" data-testid="link-check-machines">
            <h2 className="text-lg font-medium">Machines</h2>
            <ul className="mt-2 grid gap-1 text-sm">
              <li>
                Account equipment: {fmt(r.machines.accountUnits.total)} units · {fmt(r.machines.accountUnits.withSerial)} with a serial ·{" "}
                {fmt(r.machines.accountUnits.noSerial)} without · {fmt(r.machines.accountUnits.locked)} locked
                {r.machines.accountUnits.staleKey ? ` · ${fmt(r.machines.accountUnits.staleKey)} with a stored serial key that doesn't match its serial` : ""}
              </li>
              <li>Retired equipment: {fmt(r.machines.retiredUnits)}</li>
              <li>
                Warehouse records: {fmt(r.machines.warehouse.total)} · {fmt(r.machines.warehouse.withSerial)} with a serial ·{" "}
                {fmt(r.machines.warehouse.noSerial)} without · {fmt(r.machines.warehouse.bulk)} with a quantity over 1 (
                {r.machines.warehouse.byStatus.map((s) => `${s.status} ${fmt(s.n)}`).join(", ")}; {r.machines.warehouse.byKind.map((k) => `${k.kind} ${fmt(k.n)}`).join(", ")})
              </li>
              <li data-testid="link-check-serials">
                Serials: {fmt(r.machines.serials.distinct)} distinct · {fmt(r.machines.serials.accountOnly)} only on an account ·{" "}
                {fmt(r.machines.serials.warehouseOnly)} only in the warehouse · {fmt(r.machines.serials.bothActive)} on an account and an unsold
                warehouse record
                {r.machines.serials.bothNotDeployed ? ` (${fmt(r.machines.serials.bothNotDeployed)} of them ready or held in the warehouse, not deployed)` : ""} ·{" "}
                {fmt(r.machines.serials.bothSold)} on an account with only sold warehouse records
                {r.machines.serials.accountTwice ? ` · ${fmt(r.machines.serials.accountTwice)} on more than one account unit` : ""}
                {r.machines.serials.warehouseTwice ? ` · ${fmt(r.machines.serials.warehouseTwice)} on more than one unsold warehouse record` : ""}
              </li>
              {r.machines.machines ? (
                <li data-testid="link-check-machines">
                  {/* Phase M1: the check is machines with a record = distinct serials + units with no serial. */}
                  Machine records: {fmt(r.machines.machines.total)} · {fmt(r.machines.machines.withSerial)} by serial · {fmt(r.machines.machines.noSerial)} with no
                  serial · expected {fmt(r.machines.machines.expected)} (distinct serials + units with no serial)
                  {(() => {
                    const m = r.machines.machines!;
                    const live = m.total - m.empty - m.merged;
                    return live === m.expected ? (
                      " ✓"
                    ) : (
                      <span className="font-medium text-amber-700 dark:text-amber-400">
                        {" "}
                        · {fmt(live)} in use, off by {fmt(live - m.expected)}
                      </span>
                    );
                  })()}
                  {r.machines.machines.merged ? ` · ${fmt(r.machines.machines.merged)} merged into another` : null}
                  {r.machines.machines.empty ? (
                    <span className="text-muted-foreground"> · {fmt(r.machines.machines.empty)} left with no record (a serial cleared off its only record)</span>
                  ) : null}
                  {r.machines.machines.unlinked.account + r.machines.machines.unlinked.retired + r.machines.machines.unlinked.warehouse ? (
                    <span className="font-medium text-amber-700 dark:text-amber-400">
                      {" "}
                      · without a machine: {fmt(r.machines.machines.unlinked.account)} account, {fmt(r.machines.machines.unlinked.retired)} retired,{" "}
                      {fmt(r.machines.machines.unlinked.warehouse)} warehouse
                    </span>
                  ) : null}
                  {r.machines.machines.offSerial ? (
                    <span className="font-medium text-amber-700 dark:text-amber-400"> · {fmt(r.machines.machines.offSerial)} on a machine with another serial</span>
                  ) : null}
                </li>
              ) : null}
              <li>
                Install lists: {fmt(r.machines.installLists.rows)} machine rows on {fmt(r.machines.installLists.installs)} installs ·{" "}
                {fmt(r.machines.installLists.rowsWithoutUnit)} without a unit link
                {r.machines.installLists.rowsDangling ? ` · ${fmt(r.machines.installLists.rowsDangling)} linked to a unit that's gone` : ""}
              </li>
              <li>
                Links: {fmt(r.machines.links.inspectionUnits)} pre-inspection units · {fmt(r.machines.links.ticketUnits)} ticket links ·{" "}
                {fmt(r.machines.links.rebuildMachinesNoAsset)} rebuild machines with no warehouse record
                {r.machines.links.rebuildMachinesMissingAsset ? ` · ${fmt(r.machines.links.rebuildMachinesMissingAsset)} pointing at a missing one` : ""}
                {r.machines.links.modulesMissingUnit ? ` · ${fmt(r.machines.links.modulesMissingUnit)} modules on a unit that's gone` : ""}
              </li>
            </ul>
          </section>

          <section className="mt-8" data-testid="link-check-sizes">
            <h2 className="text-lg font-medium">Table sizes</h2>
            <p className="mt-1 text-sm text-muted-foreground">{r.tableRows.map((t) => `${t.table} ${fmt(t.rows)}`).join(" · ")}</p>
          </section>
          <p className="mt-6 text-xs text-muted-foreground">Read {new Date(r.at).toLocaleString()}.</p>
        </>
      ) : null}
    </div>
  );
}

function Need({ n, last }: { n: number; last?: boolean }) {
  return <td className={`py-1.5 ${last ? "" : "pr-3"} text-right tabular-nums ${n ? "font-medium text-amber-700 dark:text-amber-400" : ""}`}>{fmt(n)}</td>;
}

const hasSamples = (l: NameLinkReport) => Object.values(l.samples).some((list) => list.length > 0);

function Samples({ link }: { link: NameLinkReport }) {
  const groups: [string, NameSample[]][] = [
    ["No account", link.samples.none],
    ["Several accounts", link.samples.several],
    ["Only by punctuation or spacing", link.samples.loose],
    ["Only a removed or merged-away account", link.samples.archived],
    ["Only with spaces at the ends dropped", link.samples.trimmed],
  ];
  return (
    <details className="rounded-lg border border-border bg-card p-3" data-testid={`link-samples-${link.table}-${link.column}`}>
      <summary className="cursor-pointer text-sm font-medium">{link.label}: names to look at</summary>
      {groups
        .filter(([, list]) => list.length)
        .map(([title, list]) => (
          <div key={title} className="mt-2">
            <div className="text-xs text-muted-foreground">{title}</div>
            <ul className="mt-1 grid gap-0.5 text-sm">
              {list.map((s) => (
                <li key={s.name}>
                  <span className="font-medium">{s.name}</span> <span className="text-muted-foreground">· {fmt(s.rows)} rows</span>
                  {s.accounts.length ? (
                    <span className="text-muted-foreground"> → {s.accounts.map((a) => `${a.name}${a.archived ? " (removed)" : a.inactive ? " (inactive)" : ""}`).join("; ")}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
    </details>
  );
}
