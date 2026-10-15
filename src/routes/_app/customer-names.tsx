import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ExternalLink, FileUp, ListFilter, Lock, LockOpen, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  continueCleanList,
  decideCleanItem,
  getCleanReport,
  historyForNames,
  startCleanList,
  type CleanReport,
  type CleanReportItem,
  type CleanSection,
  type NameHistory,
} from "@/lib/ops/clean-names-api";
import { listCustomerRecords } from "@/lib/ops/api";
import { wordsOf } from "@/lib/ops/clean-names";
import type { CustomerRecord } from "@/lib/ops/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterChip } from "@/components/desk/desk-charts";
import { ListToolbar, ToolbarNote, ToolbarSearch } from "@/components/desk/list-toolbar";
import { ShowMoreButton, useShowMore } from "@/components/desk/show-more";
import { formatPingTime } from "@/lib/ops/clock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/customer-names")({ component: Page });

/** Shown on the page so it is clear whether the live site has the latest Clean Names. */
const CLEAN_NAMES_VERSION = "Oct 12 (4) · Search and sections in one row";

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
  removal: { label: "Flagged For Review", variant: "danger" },
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
    // Names changed: addresses, pins and the map are keyed by name, so read them again.
    void qc.invalidateQueries({ queryKey: ["account-addresses"] });
    void qc.invalidateQueries({ queryKey: ["customer-address"] });
    void qc.invalidateQueries({ queryKey: ["account-geo"] });
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
    mutationFn: (d: { id: number; action: "approve" | "skip" | "removal" | "unlock" | "lock" | "drop"; rowId?: number; keepName?: boolean; accountId?: number }) =>
      decideCleanItem({ data: d }),
    onSuccess: (next, d) => {
      settle(next);
      const done = { approve: "Approved and locked", skip: "Skipped", removal: "Flagged for removal", unlock: "Unlocked", lock: "Locked", drop: "Removed from the review" }[d.action];
      const flagged = d.action === "drop" && next?.items?.some((i) => i.id === d.id && i.status === "removal");
      toast.success(flagged ? "No Account Number: flagged for review, not removed" : done);
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
  // History under each unlocked row, for the rows on screen.
  const historyNames = useMemo(
    () => [...new Set(paged.visible.filter((it) => !isLocked(it)).map(nameInQuestion).filter((n): n is string => !!n))].sort(),
    [paged.visible],
  );
  const history = useQuery({
    queryKey: ["clean-history", historyNames],
    queryFn: () => historyForNames({ data: { names: historyNames } }),
    enabled: !!data?.canEdit && historyNames.length > 0,
    staleTime: 30_000,
  });
  // The full KatzDesk customer list for Choose Name.
  const accounts = useQuery({ queryKey: ["customers", "records"], queryFn: () => listCustomerRecords(), enabled: !!data?.canEdit });
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
          <Button asChild variant="outline">
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

      <p className="mt-2 text-[11px] text-muted-foreground" data-testid="clean-version">
        Page version {CLEAN_NAMES_VERSION}. If this is older, the live site has not been updated yet.
      </p>
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
          <ListToolbar data-testid="clean-toolbar">
            <ToolbarSearch value={q} onChange={setQ} placeholder="Search either name…" label="Search the report" />
            {/* The sections sit in the same row as the search; the wrapper only groups them for screen readers. */}
            <div className="contents" role="group" aria-label="Report sections" data-testid="clean-sections">
              {SECTIONS.map((s) => (
                <FilterChip key={s.id} selected={section === s.id} onClick={() => setSection(s.id)} data-testid={`clean-section-${s.id}`}>
                  {s.label} {counts[s.id].all}
                  {counts[s.id].waiting && s.id !== "locked" ? (
                    // On a phone the waiting count only shows when it differs from the total.
                    <span className={cn("ml-1 opacity-70", counts[s.id].waiting === counts[s.id].all && "max-sm:hidden")}>· {counts[s.id].waiting} waiting</span>
                  ) : null}
                </FilterChip>
              ))}
            </div>
            {section !== "locked" ? (
              <FilterChip selected={waitingOnly} onClick={() => setWaitingOnly(!waitingOnly)} data-testid="clean-waiting-only">
                Waiting Only
              </FilterChip>
            ) : null}
            <ToolbarNote>{rows.length} shown</ToolbarNote>
          </ListToolbar>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground">{current.hint}</p>
          <ul className="mt-3 overflow-hidden rounded-xl border border-border bg-card" data-testid="clean-rows">
            {paged.visible.map((it) => (
              <ReportRow
                key={it.id}
                item={it}
                canEdit={!!data.canEdit}
                busy={decide.isPending}
                onAct={(action) => decide.mutate({ id: it.id, action })}
                accounts={accounts.data ?? []}
                accountsLoading={accounts.isLoading}
                history={history.data?.[(nameInQuestion(it) ?? "").toLowerCase()] ?? null}
                historyLoading={history.isLoading}
                onChoose={(accountId) => decide.mutate({ id: it.id, action: "approve", accountId })}
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

/** Where each history line opens. */
const RECORD_PATH = { service: "/service", tlc: "/tlc", pm: "/pms", install: "/installs" } as const;

const isLocked = (it: CleanReportItem) => it.status === "locked" || it.status === "kept" || it.status === "apply";
/** The name the row is about: the KatzDesk account on it, else the clean-list name. */
const nameInQuestion = (it: CleanReportItem) => it.currentName ?? it.katzName ?? it.cleanName;

function ReportRow({
  item: it,
  canEdit,
  busy,
  onAct,
  accounts,
  accountsLoading,
  history,
  historyLoading,
  onChoose,
}: {
  item: CleanReportItem;
  canEdit: boolean;
  busy: boolean;
  onAct: (a: "approve" | "skip" | "removal" | "unlock" | "lock" | "drop") => void;
  accounts: CustomerRecord[];
  accountsLoading: boolean;
  history: NameHistory | null;
  historyLoading: boolean;
  onChoose: (accountId: number) => void;
}) {
  const [choosing, setChoosing] = useState(false);
  const st = STATUS[it.status] ?? STATUS.pending!;
  const open = it.status === "pending" || it.status === "skipped" || it.status === "removal";
  // No Account Number: Remove Name only flags the account for review.
  const flagOnly = Boolean(it.customerId) && !it.accountNumber;
  const done = it.status === "locked" || it.status === "kept";
  const unlocked = !isLocked(it);
  const approveLabel = it.kind === "no_match" ? "Keep" : !it.customerId ? "Add And Lock" : it.cleanName ? "Approve" : "Lock Name";
  return (
    <li className="grid grid-cols-[minmax(0,1fr)] gap-2 border-b border-border px-3 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start md:px-4" data-testid="clean-row" data-status={it.status}>
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
          {it.accountNumber ? (
            <span className="rounded-full border border-border px-2 text-[11px] text-muted-foreground tabular" data-testid="clean-account-number" title="Account Number (read-only here)">
              Account # {it.accountNumber}
            </span>
          ) : null}
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
        {canEdit && unlocked ? <HistoryBlock name={nameInQuestion(it)} history={history} loading={historyLoading} /> : null}
      </div>
      {canEdit ? (
        <div className="flex flex-wrap gap-1.5 sm:justify-end">
          {unlocked ? (
            <Button
              type="button"
              size="sm"
              variant={choosing ? "secondary" : "default"}
              aria-expanded={choosing}
              onClick={() => setChoosing(!choosing)}
              data-testid="clean-choose"
            >
              <ListFilter className="size-3.5" />
              Choose Name
            </Button>
          ) : null}
          {unlocked && history && history.total === 0 && !(flagOnly && it.status === "removal") ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-destructive/50 text-destructive"
              disabled={busy}
              onClick={() => onAct("drop")}
              title={
                flagOnly
                  ? "No Account Number: the account is flagged for review, not removed."
                  : "Takes this name off the review list. The account is not deleted."
              }
              data-testid="clean-remove-name"
            >
              <Trash2 className="size-3.5" />
              {flagOnly ? "Flag For Review" : "Remove Name"}
            </Button>
          ) : null}
          {open ? (
            <>
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onAct("approve")} data-testid="clean-approve">
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
        </div>
      ) : null}
      {canEdit && unlocked && choosing ? (
        <ChooseName
          item={it}
          accounts={accounts}
          loading={accountsLoading}
          busy={busy}
          onCancel={() => setChoosing(false)}
          onChoose={(id) => {
            onChoose(id);
            setChoosing(false);
          }}
        />
      ) : null}
    </li>
  );
}

/** Work already tied to the name on this row: tickets, PMs, installs. Never blank. */
function HistoryBlock({ name, history, loading }: { name: string | null; history: NameHistory | null; loading: boolean }) {
  return (
    <div className="mt-2 rounded-lg border border-border bg-background/60 px-3 py-2" data-testid="clean-history">
      <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
        History on “{name ?? "this name"}”{history?.total ? ` · ${history.total}` : ""}
      </p>
      {loading && !history ? (
        <p className="mt-1 text-xs text-muted-foreground">Loading history…</p>
      ) : !history || history.total === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground" data-testid="clean-history-empty">No history on this name.</p>
      ) : (
        <ul className="mt-1 divide-y divide-border/60" data-testid="clean-history-items">
          {history.items.map((h, i) => (
            <li key={i}>
              <a
                href={`${RECORD_PATH[h.entityType]}?open=${h.id}`}
                target="_blank"
                rel="noreferrer"
                className="grid gap-x-3 rounded-md py-1 text-xs hover:bg-muted/60 hover:underline sm:grid-cols-[3.5rem_minmax(0,13rem)_5.5rem_minmax(0,7rem)_minmax(0,1fr)_1rem]"
                title={`Open this ${h.type === "Install" ? "install" : h.type === "PM" ? "PM" : "ticket"} in a new tab`}
                data-testid="clean-history-link"
              >
              <span className="font-medium text-primary">{h.type}</span>
              <span className="truncate tabular" title={[h.wo ? `WO ${h.wo}` : null, h.ref].filter(Boolean).join(" · ")}>
                {[h.wo ? `WO ${h.wo}` : null, h.ref].filter(Boolean).join(" · ") || "No WO / ST #"}
              </span>
              <span className="tabular text-muted-foreground">{h.date ?? "No date"}</span>
              <span className="truncate">{h.status ?? "—"}</span>
              <span className="truncate text-muted-foreground" title={h.notes ?? ""}>{h.notes || "No notes"}</span>
              <ExternalLink className="hidden size-3 self-center text-muted-foreground sm:block" aria-hidden />
              </a>
            </li>
          ))}
          {history.total > history.items.length ? (
            <li className="py-1 text-xs text-muted-foreground">{history.total - history.items.length} older on this account</li>
          ) : null}
        </ul>
      )}
    </div>
  );
}

function score(target: string[], name: string): number {
  const w = new Set(wordsOf(name));
  return target.filter((t) => t.length >= 3 && w.has(t)).length;
}

/**
 * The full KatzDesk customer list, searchable. Names like this row's are pinned at the top, then every account
 * A–Z. Picking one ties this row to that account: it takes the clean-list name on Use; on a row with no list
 * name, this account becomes the one picked (merged into it).
 */
function ChooseName({
  item: it,
  accounts,
  loading,
  busy,
  onCancel,
  onChoose,
}: {
  item: CleanReportItem;
  accounts: CustomerRecord[];
  loading: boolean;
  busy: boolean;
  onCancel: () => void;
  onChoose: (accountId: number) => void;
}) {
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<number | null>(it.customerId);
  const target = useMemo(() => [...new Set([...wordsOf(it.cleanName ?? ""), ...wordsOf(it.katzName ?? "")])], [it.cleanName, it.katzName]);
  const needle = q.trim().toLowerCase();
  const { pinned, rest } = useMemo(() => {
    const list = needle ? accounts.filter((a) => a.name.toLowerCase().includes(needle)) : accounts;
    const scored = list.map((a) => ({ a, s: score(target, a.name) }));
    const pinned = scored
      .filter((x) => x.s > 0)
      .sort((x, y) => y.s - x.s || x.a.name.localeCompare(y.a.name))
      .slice(0, 8)
      .map((x) => x.a);
    const pinnedIds = new Set(pinned.map((a) => a.id));
    const rest = list.filter((a) => !pinnedIds.has(a.id)).sort((x, y) => x.name.localeCompare(y.name, undefined, { sensitivity: "base" }));
    return { pinned, rest };
  }, [accounts, needle, target]);
  const chosen = accounts.find((a) => a.id === pick) ?? null;
  const Row = ({ a }: { a: CustomerRecord }) => (
    <label
      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60"
      data-testid="choose-account"
    >
      <input type="radio" name={`choose-${it.id}`} className="size-4 shrink-0 accent-primary" checked={pick === a.id} onChange={() => setPick(a.id)} />
      <span className="min-w-0 flex-1 text-sm max-sm:break-words sm:truncate">{a.name}</span>
      {a.nameLocked ? <Lock className="size-3.5 shrink-0 text-primary" aria-label="Locked" /> : null}
      {a.id === it.customerId ? <span className="shrink-0 text-[11px] text-muted-foreground">on this row now</span> : null}
      <span className="shrink-0 text-[11px] text-muted-foreground tabular">
        {a.calls + a.tlcs + a.pms + a.installs} records
      </span>
    </label>
  );
  return (
    <div className="rounded-xl border border-border bg-background p-3 max-sm:min-w-0 sm:col-span-2" data-testid="choose-name">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Choose the KatzDesk account for {it.cleanName ? `“${it.cleanName}”` : `“${it.katzName ?? "this row"}”`}
      </p>
      <div className="relative mt-2">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search every KatzDesk customer…" className="pl-9" aria-label="Search KatzDesk customers" data-testid="choose-search" autoFocus />
      </div>
      <div className="mt-2 max-h-80 overflow-y-auto rounded-lg border border-border" data-testid="choose-list">
        {loading ? <p className="px-3 py-2 text-xs text-muted-foreground">Loading every KatzDesk customer…</p> : null}
        {pinned.length ? (
          <>
            <p className="sticky top-0 z-10 bg-card px-3 py-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Similar names</p>
            {pinned.map((a) => <Row key={`p${a.id}`} a={a} />)}
          </>
        ) : null}
        <p className="sticky top-0 z-10 bg-card px-3 py-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase" data-testid="choose-all-label">
          All KatzDesk customers · {rest.length + pinned.length}
        </p>
        {rest.map((a) => <Row key={a.id} a={a} />)}
        {!loading && !rest.length && !pinned.length ? <p className="px-3 py-2 text-xs text-muted-foreground">No KatzDesk customer matches.</p> : null}
      </div>
      <p className="mt-2 text-xs text-muted-foreground" data-testid="choose-effect">
        {!chosen
          ? "Pick an account."
          : it.cleanName
            ? `“${chosen.name}” takes the clean-list name “${it.cleanName}” and is locked, with the list's ID and address.`
            : chosen.id === it.customerId
              ? `Keeps “${chosen.name}” and locks it.`
              : `“${it.katzName}” becomes “${chosen.name}” (merged into it) and is locked.`}
        {chosen?.nameLocked && it.cleanName && chosen.name !== it.cleanName ? (
          <span className="font-medium text-warning"> That account is locked; unlock it on its own row first.</span>
        ) : null}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy || !chosen} onClick={() => chosen && onChoose(chosen.id)} data-testid="choose-use">
          Use This Account
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
