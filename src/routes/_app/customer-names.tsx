import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, FileUp, ListFilter, Lock, LockOpen, Search } from "lucide-react";
import { toast } from "sonner";
import {
  continueCleanList,
  decideCleanItem,
  getCleanReport,
  searchCleanRows,
  startCleanList,
  type CleanReport,
  type CleanReportItem,
  type CleanSection,
} from "@/lib/ops/clean-names-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterChip } from "@/components/desk/desk-charts";
import { ShowMoreButton, useShowMore } from "@/components/desk/show-more";
import { formatPingTime } from "@/lib/ops/clock";

export const Route = createFileRoute("/_app/customer-names")({ component: Page });

const SECTIONS: { id: CleanSection; label: string; hint: string }[] = [
  { id: "locked", label: "Approved And Locked", hint: "Exact matches applied from the clean list, and names you approved. Locked: Corrigo import and typing over the name do not change them. Unlock here to change one." },
  { id: "similar", label: "Needs Approval", hint: "Close but not exact: same words with Inc / LLC, a NetSuite parent, extra words such as a location, or a spelling difference. Nothing changes until you approve." },
  { id: "no_match", label: "No Match", hint: "KatzDesk accounts with nothing like them on the clean list. Keep locks the KatzDesk name; Mark Removal only flags it." },
  { id: "walk_in", label: "Walk-In", hint: "Every Walk-In account, matched or not. Not locked until you approve." },
  { id: "cimbali", label: "Cimbali", hint: "Every Cimbali account, matched or not. Not locked until you approve." },
];

const STATUS: Record<string, { label: string; variant: "default" | "primary" | "danger" | "warn" | "success" | "outline" }> = {
  pending: { label: "Waiting", variant: "warn" },
  apply: { label: "Applying", variant: "outline" },
  locked: { label: "Locked", variant: "success" },
  kept: { label: "Kept · Locked", variant: "success" },
  skipped: { label: "Skipped", variant: "outline" },
  removal: { label: "Flagged For Removal", variant: "danger" },
  unlocked: { label: "Unlocked", variant: "outline" },
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

function Page() {
  const qc = useQueryClient();
  const report = useQuery({ queryKey: ["clean-names"], queryFn: () => getCleanReport() });
  const [section, setSection] = useState<CleanSection>("similar");
  const [q, setQ] = useState("");
  const [waitingOnly, setWaitingOnly] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const data = report.data;

  function settle(next: CleanReport) {
    qc.setQueryData(["clean-names"], next);
    void qc.invalidateQueries({ queryKey: ["customers"] });
    void qc.invalidateQueries({ queryKey: ["directory", "customer"] });
    void qc.invalidateQueries({ queryKey: ["customer-history"] });
  }

  const start = useMutation({
    mutationFn: async (file: File) => startCleanList({ data: { filename: file.name, base64: await fileToBase64(file) } }),
    onSuccess: (next) => {
      settle(next);
      toast.success(`Read ${next.run?.rowCount ?? 0} names from the clean list`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not read that list"),
  });
  const step = useMutation({
    mutationFn: () => continueCleanList(),
    onSuccess: settle,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not apply names"),
  });
  // Exact matches that change a name are applied in batches; keep going until none are left.
  useEffect(() => {
    if (data?.canEdit && data.pendingApply > 0 && !step.isPending && !step.isError) step.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.pendingApply, data?.canEdit, step.isPending]);

  const decide = useMutation({
    mutationFn: (d: { id: number; action: "approve" | "skip" | "removal" | "unlock" | "lock"; rowId?: number; keepName?: boolean }) =>
      decideCleanItem({ data: d }),
    onSuccess: (next, d) => {
      settle(next);
      const done = { approve: "Approved and locked", skip: "Skipped", removal: "Flagged for removal", unlock: "Unlocked", lock: "Locked" }[d.action];
      toast.success(done);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const counts = useMemo(() => {
    const c: Record<CleanSection, { all: number; waiting: number }> = {
      locked: { all: 0, waiting: 0 },
      similar: { all: 0, waiting: 0 },
      no_match: { all: 0, waiting: 0 },
      walk_in: { all: 0, waiting: 0 },
      cimbali: { all: 0, waiting: 0 },
    };
    for (const it of data?.items ?? []) {
      c[it.section].all += 1;
      if (it.status === "pending") c[it.section].waiting += 1;
    }
    return c;
  }, [data]);

  const needle = q.trim().toLowerCase();
  const rows = useMemo(
    () =>
      (data?.items ?? []).filter(
        (it) =>
          it.section === section &&
          (!waitingOnly || it.status === "pending") &&
          (!needle || `${it.katzName ?? ""} ${it.cleanName ?? ""}`.toLowerCase().includes(needle)),
      ),
    [data, section, needle, waitingOnly],
  );
  const paged = useShowMore(rows, `${section}|${needle}|${waitingOnly}`);
  const current = SECTIONS.find((s) => s.id === section)!;

  return (
    <div>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Clean Names</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Apply the clean customer list. Exact names are applied and locked; everything else waits here for you to
            approve, skip, or mark for removal. Nothing is merged on its own and nothing is deleted.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/customers">Customers</Link>
          </Button>
          {data?.canEdit ? (
            <>
              <Button type="button" onClick={() => fileRef.current?.click()} disabled={start.isPending} data-testid="clean-upload">
                <FileUp className="size-4" />
                {start.isPending ? "Reading…" : "Read Clean List"}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                data-testid="clean-file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) start.mutate(f);
                }}
              />
            </>
          ) : null}
        </div>
      </header>

      {report.isLoading ? <p className="mt-6 text-sm text-muted-foreground">Loading the report…</p> : null}
      {data?.forbidden ? (
        <p className="mt-6 rounded-xl border border-dashed border-border bg-card/60 px-5 py-6 text-center text-sm text-muted-foreground" data-testid="clean-forbidden">
          Only an Admin can open the clean customer list review. Ask the desk owner to give you the Admin role.
        </p>
      ) : null}
      {data && !data.run && !data.forbidden ? (
        <p className="mt-6 rounded-xl border border-dashed border-border bg-card/60 px-5 py-6 text-center text-sm text-muted-foreground">
          {data.canEdit ? "Read the clean customer list (the NetSuite export) to build the report." : "No clean list has been read yet. An admin reads it here."}
        </p>
      ) : null}

      {data?.run ? (
        <>
          <p className="mt-4 text-xs text-muted-foreground" data-testid="clean-run">
            {data.run.filename ?? "Clean list"} · {data.run.rowCount} names · read by {data.run.createdBy ?? "an admin"} {formatPingTime(data.run.createdAt)}
            {data.pendingApply ? ` · applying exact matches, ${data.pendingApply} left` : ""}
            {!data.canEdit ? " · only an admin can approve" : ""}
          </p>
          {data.needsReRead || data.missingDetails > 0 ? (
            <div className="mt-3 flex flex-col gap-2 rounded-xl border border-warning/50 bg-warning/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between" data-testid="clean-reread">
              <p>
                <span className="font-medium">
                  {data.needsReRead
                    ? "ID, address and rep are not on the approved accounts yet."
                    : `${data.missingDetails} approved account${data.missingDetails === 1 ? " is" : "s are"} missing the list's ID and address.`}
                </span>{" "}
                They come from the clean list file. Read the clean list again to fill them. Locked names stay locked and
                your approvals, skips and removal flags are kept.
              </p>
              {data.canEdit ? (
                <Button type="button" size="sm" onClick={() => fileRef.current?.click()} disabled={start.isPending}>
                  <FileUp className="size-4" />
                  Read Clean List Again
                </Button>
              ) : null}
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Report sections" data-testid="clean-sections">
            {SECTIONS.map((s) => (
              <FilterChip key={s.id} selected={section === s.id} onClick={() => setSection(s.id)} data-testid={`clean-section-${s.id}`}>
                {s.label} {counts[s.id].all}
                {counts[s.id].waiting && s.id !== "locked" ? <span className="ml-1 opacity-70">· {counts[s.id].waiting} waiting</span> : null}
              </FilterChip>
            ))}
          </div>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground">{current.hint}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search either name…" className="pl-9" aria-label="Search the report" />
            </div>
            {section !== "locked" ? (
              <FilterChip selected={waitingOnly} onClick={() => setWaitingOnly(!waitingOnly)}>
                Waiting only
              </FilterChip>
            ) : null}
            <span className="text-xs text-muted-foreground">{rows.length} shown</span>
          </div>
          <ul className="mt-3 overflow-hidden rounded-xl border border-border bg-card" data-testid="clean-rows">
            {paged.visible.map((it) => (
              <ReportRow
                key={it.id}
                item={it}
                canEdit={!!data.canEdit}
                busy={decide.isPending}
                onAct={(action) => decide.mutate({ id: it.id, action })}
                siblings={it.customerId ? (data.items ?? []).filter((x) => x.customerId === it.customerId && x.id !== it.id && !!x.cleanName) : []}
                canSearchList={data.canSearchList}
                onChoose={(c) =>
                  decide.mutate(
                    c.kind === "item"
                      ? { id: c.itemId, action: "approve" }
                      : c.kind === "keep"
                        ? { id: it.id, action: "approve", keepName: true }
                        : { id: it.id, action: "approve", rowId: c.rowId },
                  )
                }
              />
            ))}
            {!rows.length ? <li className="px-4 py-6 text-sm text-muted-foreground">Nothing in this section.</li> : null}
            <ShowMoreButton remaining={paged.remaining} onClick={paged.showMore} label="names" as="li" />
          </ul>
        </>
      ) : null}
    </div>
  );
}

type Choice = { kind: "item"; itemId: number } | { kind: "keep" } | { kind: "row"; rowId: number };

function ReportRow({
  item: it,
  canEdit,
  busy,
  onAct,
  siblings,
  canSearchList,
  onChoose,
}: {
  item: CleanReportItem;
  canEdit: boolean;
  busy: boolean;
  onAct: (a: "approve" | "skip" | "removal" | "unlock" | "lock") => void;
  siblings: CleanReportItem[];
  canSearchList: boolean;
  onChoose: (c: Choice) => void;
}) {
  const [choosing, setChoosing] = useState(false);
  const st = STATUS[it.status] ?? STATUS.pending!;
  const open = it.status === "pending" || it.status === "skipped" || it.status === "removal";
  const done = it.status === "locked" || it.status === "kept";
  const approveLabel = it.kind === "no_match" ? "Keep" : !it.customerId ? "Add And Lock" : it.cleanName ? "Approve" : "Lock Name";
  return (
    <li className="grid gap-2 border-b border-border px-3 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center md:px-4" data-testid="clean-row" data-status={it.status}>
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 font-medium" data-testid="clean-katz">
            {it.katzName ?? <span className="text-muted-foreground">No KatzDesk account</span>}
          </span>
          {it.cleanName && it.cleanName !== it.katzName ? (
            <>
              <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-label="clean-list name" />
              <span className="min-w-0 font-medium text-primary" data-testid="clean-name">{it.cleanName}</span>
            </>
          ) : null}
          {it.currentName ? <span className="text-xs text-muted-foreground">now “{it.currentName}”</span> : null}
          {it.locked ? <Lock className="size-3.5 shrink-0 text-primary" aria-label="Name locked" /> : null}
          <Badge variant={st.variant} size="tight" data-testid="clean-status">{st.label}</Badge>
        </div>
        {it.approved ? (
          <dl className="mt-1 grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-[auto_minmax(0,1fr)]" data-testid="clean-details">
            <dt className="text-muted-foreground">ID</dt>
            <dd className="font-medium tabular" data-testid="clean-id">{it.netsuiteId ?? "—"}</dd>
            <dt className="text-muted-foreground">Address</dt>
            <dd data-testid="clean-address">{it.address || <span className="text-warning">No address on the clean list</span>}</dd>
            <dt className="text-muted-foreground">Rep</dt>
            <dd data-testid="clean-rep">
              {it.accountRep ? it.accountRep : <span className="font-medium text-warning">Blank · {it.repFlag ?? "No sales rep on the clean list"}</span>}
            </dd>
          </dl>
        ) : null}
        <p className="mt-0.5 text-xs text-muted-foreground">
          {it.reason}
          {it.note ? ` · ${it.note}` : ""}
          {it.mergesInto ? <span className="font-medium text-warning"> · Approving merges into “{it.mergesInto}”</span> : null}
          {it.decidedBy && it.status !== "pending" ? ` · ${it.decidedBy}` : ""}
        </p>
      </div>
      {canEdit ? (
        <div className="flex flex-wrap gap-1.5 sm:justify-end">
          {open ? (
            <>
              <Button type="button" size="sm" disabled={busy} onClick={() => onAct("approve")} data-testid="clean-approve">
                {approveLabel}
              </Button>
              {it.status !== "skipped" ? (
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onAct("skip")} data-testid="clean-skip">
                  Skip
                </Button>
              ) : null}
              {it.customerId && it.kind !== "similar" && it.status !== "removal" ? (
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onAct("removal")} data-testid="clean-removal">
                  Mark Removal
                </Button>
              ) : null}
            </>
          ) : null}
          {done && it.customerId ? (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onAct("unlock")} data-testid="clean-unlock">
              <LockOpen className="size-3.5" />
              Unlock
            </Button>
          ) : null}
          {it.status === "unlocked" ? (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onAct("lock")} data-testid="clean-lock">
              <Lock className="size-3.5" />
              Lock Again
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant={choosing ? "secondary" : "outline"}
            aria-expanded={choosing}
            onClick={() => setChoosing(!choosing)}
            data-testid="clean-choose"
          >
            <ListFilter className="size-3.5" />
            Choose Name
          </Button>
        </div>
      ) : null}
      {canEdit && choosing ? (
        <ChooseName
          item={it}
          siblings={siblings}
          canSearchList={canSearchList}
          busy={busy}
          onCancel={() => setChoosing(false)}
          onChoose={(c) => {
            onChoose(c);
            setChoosing(false);
          }}
        />
      ) : null}
    </li>
  );
}

/**
 * Pick the name for this account: one of the suggested clean-list names, the KatzDesk name as it is, or any name
 * on the clean list (searched). The chosen list row brings its own ID, address and sales rep. Locks on use.
 */
function ChooseName({
  item: it,
  siblings,
  canSearchList,
  busy,
  onCancel,
  onChoose,
}: {
  item: CleanReportItem;
  siblings: CleanReportItem[];
  canSearchList: boolean;
  busy: boolean;
  onCancel: () => void;
  onChoose: (c: Choice) => void;
}) {
  const suggested = [it, ...siblings].filter(
    (x, i, all) => !!x.cleanName && all.findIndex((y) => y.cleanName === x.cleanName) === i,
  );
  const [pick, setPick] = useState<string>(suggested[0] ? `item:${suggested[0].id}` : it.customerId ? "keep" : "");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const found = useQuery({
    queryKey: ["clean-rows", term],
    queryFn: () => searchCleanRows({ data: { q: term } }),
    enabled: canSearchList && term.length >= 2,
  });
  const choice = (): Choice | null => {
    if (pick === "keep") return { kind: "keep" };
    const [k, v] = pick.split(":");
    if (k === "item") return { kind: "item", itemId: Number(v) };
    if (k === "row") return { kind: "row", rowId: Number(v) };
    return null;
  };
  const Option = ({ value, children }: { value: string; children: React.ReactNode }) => (
    <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/60">
      <input type="radio" name={`choose-${it.id}`} className="mt-1 size-4 accent-primary" checked={pick === value} onChange={() => setPick(value)} />
      <span className="min-w-0 text-sm">{children}</span>
    </label>
  );
  return (
    <div className="rounded-xl border border-border bg-background p-3 sm:col-span-2" data-testid="choose-name">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Choose the name for {it.katzName ?? "this account"}</p>
      <div className="mt-2 grid gap-0.5">
        {suggested.map((x) => (
          <Option key={`s${x.id}`} value={`item:${x.id}`}>
            <span className="font-medium text-primary">{x.cleanName}</span>
            <span className="block text-xs text-muted-foreground">
              Suggested · {x.reason}
              {x.mergesInto ? <span className="font-medium text-warning"> · merges into “{x.mergesInto}”</span> : null}
            </span>
          </Option>
        ))}
        {it.customerId && it.katzName ? (
          <Option value="keep">
            <span className="font-medium">{it.katzName}</span>
            <span className="block text-xs text-muted-foreground">Keep the KatzDesk name as it is · locked, no list ID or address</span>
          </Option>
        ) : null}
      </div>
      <div className="mt-2 border-t border-border pt-2">
        {canSearchList ? (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the whole clean list…" className="pl-9" aria-label="Search the clean list" data-testid="choose-search" />
            </div>
            <div className="mt-1 grid max-h-64 gap-0.5 overflow-y-auto" data-testid="choose-results">
              {term.length >= 2 && found.data?.length === 0 ? <p className="px-2 py-1.5 text-xs text-muted-foreground">No name on the clean list matches.</p> : null}
              {(found.data ?? []).map((r) => (
                <Option key={`r${r.id}`} value={`row:${r.id}`}>
                  <span className="font-medium">{r.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {[r.internalId ? `ID ${r.internalId}` : null, r.address, r.salesRep ? `Rep ${r.salesRep}` : null].filter(Boolean).join(" · ")}
                    {r.heldBy && r.heldBy !== it.katzName ? <span className="font-medium text-warning"> · merges into “{r.heldBy}”</span> : null}
                  </span>
                </Option>
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs text-warning">To pick any name on the clean list, read the clean list again first.</p>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy || !choice()} onClick={() => { const c = choice(); if (c) onChoose(c); }} data-testid="choose-use">
          Use This Name And Lock
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
