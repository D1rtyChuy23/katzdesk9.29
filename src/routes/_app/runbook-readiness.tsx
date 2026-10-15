import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Check, ClipboardCopy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getRunbookReadiness } from "@/lib/ops/pm-runbook-readiness-api";
import { GAP_LABEL, readinessCsv, type ReadinessGap } from "@/lib/ops/pm-runbook-readiness";
import { useCopy } from "@/components/desk/spec-sheet";

export const Route = createFileRoute("/_app/runbook-readiness")({ component: Page });

function Page() {
  const q = useQuery({ queryKey: ["runbook-readiness"], queryFn: () => getRunbookReadiness() });
  const { copy, copied, dialog } = useCopy();
  const [only, setOnly] = useState<ReadinessGap | "gaps" | "all">("gaps");
  const data = q.data;
  const rows = useMemo(() => {
    const all = data?.rows ?? [];
    if (only === "all") return all;
    if (only === "gaps") return all.filter((r) => r.gaps.length);
    return all.filter((r) => r.gaps.includes(only));
  }, [data, only]);

  const chip = (id: typeof only, label: string, n: number) => (
    <button
      key={id}
      type="button"
      aria-pressed={only === id}
      onClick={() => setOnly(id)}
      className={cn(
        "rounded-md border px-3 py-1.5 text-sm",
        only === id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background",
      )}
    >
      {label} <b className="font-mono">{n}</b>
    </button>
  );

  return (
    <div>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Runbook Readiness</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Open PMs with a machine the runbook covers, and what each is missing: an account unit to attach to, a serial so
            options and history follow the unit, and an install date so the interval can be recommended. Read-only: nothing
            here changes data.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={!data}
          onClick={() => data && void copy("csv", readinessCsv(data.rows))}
        >
          {copied === "csv" ? <Check className="size-4" /> : <ClipboardCopy className="size-4" />}
          Copy gaps as CSV
        </Button>
      </header>

      {q.isLoading ? <p className="mt-6 text-sm text-muted-foreground">Checking open PMs…</p> : null}
      {q.error ? <p className="mt-6 text-sm text-red-600">Could not load the report.</p> : null}

      {data ? (
        <>
          <p className="mt-4 text-sm text-muted-foreground">
            {data.pmsChecked} open PM{data.pmsChecked === 1 ? "" : "s"} with a covered machine · {data.summary.units} unit
            {data.summary.units === 1 ? "" : "s"} · <b>{data.summary.ready}</b> fully ready
          </p>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter">
            {chip("gaps", "Needs work", data.summary.units - data.summary.ready)}
            {chip("no-account-unit", GAP_LABEL["no-account-unit"], data.summary.noAccountUnit)}
            {chip("no-serial", GAP_LABEL["no-serial"], data.summary.noSerial)}
            {chip("no-install-date", GAP_LABEL["no-install-date"], data.summary.noInstallDate)}
            {chip("all", "All", data.summary.units)}
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2">PM</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Equipment line</th>
                  <th className="px-3 py-2">Serial</th>
                  <th className="px-3 py-2">Installed</th>
                  <th className="px-3 py-2">Missing</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.pmId}-${i}`} className="border-t border-border align-top">
                    <td className="px-3 py-2 font-mono">#{r.pmId}</td>
                    <td className="px-3 py-2">
                      {r.customer}
                      <span className="block text-xs text-muted-foreground">{r.status}</span>
                    </td>
                    <td className="px-3 py-2">{r.piece}</td>
                    <td className="px-3 py-2 font-mono">{r.serial ?? "—"}</td>
                    <td className="px-3 py-2">{r.installDate ?? "—"}</td>
                    <td className="px-3 py-2">
                      {r.gaps.length ? (
                        <span className="flex flex-wrap gap-1">
                          {r.gaps.map((g) => (
                            <span key={g} className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">
                              {GAP_LABEL[g]}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-xs text-emerald-700">Ready</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                      Nothing to show for this filter.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      {dialog}
    </div>
  );
}
