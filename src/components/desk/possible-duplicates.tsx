import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CopyCheck, Download } from "lucide-react";
import { possibleDuplicates, type DupeRun } from "@/lib/ops/customer-review-api";
import { DUPE_CSV_COLUMNS, DUPE_LEVELS, DUPE_LEVEL_LABEL, dupeCsvRows, type DupeAccount, type DupeLevel, type DupePair } from "@/lib/ops/customer-dupes";
import { toCsv } from "@/lib/ops/customer-export";
import { isWalkInName } from "@/lib/ops/clean-names";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SelectField } from "@/components/ui/select-field";
import { FilterChip } from "./desk-charts";
import { ShowMoreButton, useShowMore } from "./show-more";

const LEVEL_VARIANT: Record<DupeLevel, "danger" | "warn" | "outline"> = { high: "danger", medium: "warn", low: "outline" };
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });
const records = (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? "record" : "records"}`;
const runLabel = (r: DupeRun) => `NetSuite import ${when(r.createdAt)} · ${r.created.toLocaleString("en-US")} added${r.createdBy ? ` by ${r.createdBy}` : ""}`;

function saveCsv(name: string, text: string) {
  // The byte-order mark makes Excel read the file as UTF-8, so accented names stay right.
  const blob = new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Admin-only and read-only: Customers → Possible Duplicates. For each account a NetSuite import added, the accounts
 * that may be the same place, with the reasons, a High / Medium / Low rating and which one to keep (never a Walk-In).
 * There is no merge button here: Chuy merges by renaming the account he drops to the one he keeps.
 */
export function PossibleDuplicatesButton({ onOpenAccount }: { onOpenAccount: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const [runId, setRunId] = useState<number | null>(null);
  const [level, setLevel] = useState<DupeLevel | "all">("all");
  const q = useQuery({
    queryKey: ["possible-duplicates", runId],
    queryFn: () => possibleDuplicates({ data: { runId } }),
    // Read again each time it opens: an account merged or renamed meanwhile drops out.
    enabled: open,
  });
  const report = q.data;
  const shown = useMemo(() => (report?.pairs ?? []).filter((p) => level === "all" || p.level === level), [report, level]);
  const paged = useShowMore(shown, `${report?.run?.id}|${level}`, 50);

  function download() {
    if (!report?.run) return;
    const day = report.run.createdAt.slice(0, 10);
    saveCsv(`KatzDesk-Possible-Duplicates-${day}.csv`, toCsv(DUPE_CSV_COLUMNS, dupeCsvRows(shown)));
  }

  return (
    <>
      <Button type="button" variant="outline" className="h-10" onClick={() => setOpen(true)} data-testid="dupes-open">
        <CopyCheck className="size-4" />
        Possible Duplicates
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-4xl" data-testid="dupes">
          <div className="flex flex-col gap-3">
            <DialogTitle>Possible Duplicates</DialogTitle>
            <DialogDescription>
              Each account a NetSuite import added, next to the accounts that may be the same place. Nothing here changes an
              account. To merge two, open the one you don’t keep and rename it to the one you keep: its calls, PMs and
              installs move with it.
            </DialogDescription>
            {q.isLoading ? <p className="text-sm text-muted-foreground">Comparing the accounts…</p> : null}
            {q.isError ? <p className="text-sm text-destructive">{q.error instanceof Error ? q.error.message : "Could not compare the accounts."}</p> : null}
            {report && !report.run ? <p className="text-sm text-muted-foreground" data-testid="dupes-none">No NetSuite import has added accounts yet.</p> : null}
            {report?.run ? (
              <>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                  {report.runs.length > 1 ? (
                    <SelectField
                      aria-label="Which import"
                      className="h-9 w-auto max-w-full"
                      value={String(report.run.id)}
                      onChange={(e) => setRunId(Number(e.target.value))}
                      data-testid="dupes-run"
                    >
                      {report.runs.map((r) => (
                        <option key={r.id} value={r.id}>
                          {runLabel(r)}
                        </option>
                      ))}
                    </SelectField>
                  ) : (
                    <span className="font-medium" data-testid="dupes-run">
                      {runLabel(report.run)}
                    </span>
                  )}
                  <span className="text-muted-foreground" data-testid="dupes-summary">
                    {report.added.toLocaleString("en-US")} still on the list · {report.pairs.length.toLocaleString("en-US")}{" "}
                    {report.pairs.length === 1 ? "possible duplicate" : "possible duplicates"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2" data-testid="dupes-levels">
                  <FilterChip selected={level === "all"} onClick={() => setLevel("all")}>
                    All {report.pairs.length.toLocaleString("en-US")}
                  </FilterChip>
                  {DUPE_LEVELS.map((l) => (
                    <FilterChip key={l} selected={level === l} onClick={() => setLevel(l)} data-testid={`dupes-level-${l}`}>
                      {DUPE_LEVEL_LABEL[l]} {report.counts[l].toLocaleString("en-US")}
                    </FilterChip>
                  ))}
                </div>
                <ul className="space-y-2" data-testid="dupes-list">
                  {paged.visible.map((p) => (
                    <PairCard
                      key={`${p.added.id}-${p.other.id}`}
                      pair={p}
                      onOpen={(id) => {
                        setOpen(false);
                        onOpenAccount(id);
                      }}
                    />
                  ))}
                  <ShowMoreButton as="li" remaining={paged.remaining} onClick={paged.showMore} label="pairs" />
                  {!shown.length ? <li className="px-1 py-6 text-sm text-muted-foreground">Nothing here.</li> : null}
                </ul>
                <p className="text-xs text-muted-foreground">
                  High: the same site address and one more sign. Medium: the same site address alone; a matching phone or
                  email with a similar name; or the same name with the same email domain or street. Low: one sign by itself.
                  A phone, email, domain or street on more than five accounts isn’t counted.
                </p>
              </>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
              {report?.run ? (
                <Button type="button" variant="outline" onClick={download} disabled={!shown.length} data-testid="dupes-download">
                  <Download className="size-4" />
                  Download Report
                </Button>
              ) : null}
              <Button type="button" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AccountSide({ a, label, keep, onOpen }: { a: DupeAccount; label: string; keep: boolean; onOpen: (id: number) => void }) {
  const ids = [a.netsuiteId ? `NetSuite ID ${a.netsuiteId}` : null, a.accountNumber ? `Account # ${a.accountNumber}` : null, records(a.history)].filter(Boolean);
  return (
    <div className="min-w-0 flex-1 basis-60" data-testid="dupes-side">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-0.5 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          className="min-w-0 text-left font-medium break-words text-primary underline-offset-4 hover:underline"
          onClick={() => onOpen(a.id)}
          title="Open this account"
        >
          {a.name}
        </button>
        {keep ? <Badge size="tight" variant="success">Keep</Badge> : null}
        {isWalkInName(a.name) ? <Badge size="tight" variant="warn">Walk-In</Badge> : null}
        {a.inactive ? <Badge size="tight" variant="warn">Inactive</Badge> : null}
      </p>
      <p className="text-sm break-words">{a.address || <span className="text-muted-foreground">No site address</span>}</p>
      <p className="text-xs text-muted-foreground">{ids.join(" · ")}</p>
    </div>
  );
}

function PairCard({ pair, onOpen }: { pair: DupePair; onOpen: (id: number) => void }) {
  const keepName = pair.keep ? (pair.keep.id === pair.added.id ? pair.added.name : pair.other.name) : null;
  return (
    <li className="rounded-lg border border-border bg-card p-3" data-testid="dupes-pair" data-level={pair.level}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={LEVEL_VARIANT[pair.level]} data-testid="dupes-pair-level">
          {DUPE_LEVEL_LABEL[pair.level]}
        </Badge>
        {pair.reasons.map((r) => (
          <span key={r.sign} className="rounded-full bg-secondary px-2 py-0.5 text-xs" data-testid="dupes-reason">
            {r.text}
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-3">
        <AccountSide a={pair.added} label="Added by the import" keep={pair.keep?.id === pair.added.id} onOpen={onOpen} />
        <AccountSide
          a={pair.other}
          label={pair.otherAdded ? "Also added by the import" : "Already in KatzDesk"}
          keep={pair.keep?.id === pair.other.id}
          onOpen={onOpen}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground" data-testid="dupes-keep">
        {keepName ? (
          <>
            If they are one place, keep <span className="font-medium text-foreground">{keepName}</span>: {pair.keep!.why}.
          </>
        ) : (
          "Both are Walk-In accounts: neither is suggested to keep."
        )}
      </p>
    </li>
  );
}
