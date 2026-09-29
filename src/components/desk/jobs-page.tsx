import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listJobs } from "@/lib/ops/api";
import { URGENCIES, URGENCY_RANK } from "@/lib/ops/lookups";
import { isClosedCall, isOpenCall } from "@/lib/ops/ticket-status";
import { formatShortDate } from "@/lib/ops/clock";
import type { ServiceJob } from "@/lib/ops/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { DuplicateBadge, FlagBadge, StatusBadge, UrgencyBadge } from "./flag-badge";
import { JobSheet, NewJobDialog } from "./job-sheet";
import { CorrigoImportButton, CorrigoReviewList, type CorrigoReviewItem } from "./corrigo-import";
import { SortSelect, useDeskSort } from "./sort-bar";
import { ActionMenu, StatCard, StatRow, toggleChip } from "./desk-charts";
import { SORT_LIST, equipmentCount, sortDesk } from "@/lib/ops/sort";
import { Plus } from "lucide-react";
import { ExportButton } from "./export-dialog";
import { TechFilter, TechName } from "./tech-select";
import { sameTech } from "@/lib/ops/tech-match";
import { mineByTechnician } from "@/lib/ops/my-view";
import { AkBadge } from "./ak-badge";
import { useMyView } from "./my-view-bar";


export function JobsPage({
  kind,
  title,
  lede,
  initialOpen,
}: {
  kind: "service" | "tlc";
  title: string;
  lede: string;
  initialOpen?: number;
}) {
  const jobs = useQuery({
    queryKey: ["jobs", kind],
    queryFn: () => listJobs({ data: { kind } }),
  });
  const { filterMine, matchMine, role } = useMyView();
  const [q, setQ] = useState("");

  const [tech, setTech] = useState("");
  const [urgency, setUrgency] = useState("");
  const [view, setView] = useState<"active" | "flagged" | "unassigned" | "complete" | "all">("active");
  const [openId, setOpenId] = useState<number | null>(initialOpen ?? null);
  useEffect(() => {
    if (initialOpen != null) setOpenId(initialOpen);
  }, [initialOpen]);
  const [create, setCreate] = useState(false);
  const [review, setReview] = useState<CorrigoReviewItem[]>([]);
  const [sort, setSort] = useDeskSort(`jobs-${kind}`, "flag");

  const rows = useMemo(() => {
    let list = jobs.data ?? [];
    if (view === "active") {
      list = list.filter((j) => !j.duplicateOf && isOpenCall(j));
    }
    if (view === "flagged") {
      list = list.filter((j) => j.flag || j.duplicateOf || (j.siblings?.length ?? 0) > 0);
    }
    if (view === "unassigned") {
      list = list.filter((j) => !j.duplicateOf && isOpenCall(j) && !j.technician);
    }
    if (view === "complete") {
      list = list.filter((j) => !j.duplicateOf && isClosedCall(j));
    }
    if (tech) list = list.filter((j) => sameTech(j.technician, tech));
    list = mineByTechnician(list, { filterMine, role, matchMine });
    if (urgency) list = list.filter((j) => j.urgency === urgency);

    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter((j) =>
        [j.customer, j.callId, j.wo, j.issue, j.equipment, j.technician]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle)),
      );
    }
    return sortDesk(list, sort, {
      date: (j) => j.received ?? j.scheduled,
      name: (j) => j.customer,
      equipment: (j) => equipmentCount(j.equipment),
      status: (j) => j.status,
      flagRank: (j) => (j.flag ? j.flag.rank : 50) + (URGENCY_RANK[j.urgency] ?? 2) / 10,
      tech: (j) => j.technician,
    });
  }, [jobs.data, q, tech, urgency, view, sort, filterMine, matchMine, role]);

  const liveJobs = (jobs.data ?? []).filter((j) => !j.duplicateOf);
  const activeCount = liveJobs.filter((j) => isOpenCall(j)).length;
  const flagCount = (jobs.data ?? []).filter(
    (j) => j.flag || j.duplicateOf || (j.siblings?.length ?? 0) > 0,
  ).length;
  const allJobs = liveJobs;
  const activeJobs = allJobs.filter((j) => isOpenCall(j));
  const unassignedCount = activeJobs.filter((j) => !j.technician).length;
  const completeCount = liveJobs.filter((j) => isClosedCall(j)).length;

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">{title}</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{lede}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionMenu label="Import / Export">
            {kind === "service" ? <CorrigoImportButton onImported={setReview} /> : null}
            <ExportButton defaultType={kind === "tlc" ? "tlc" : "pending"} />
          </ActionMenu>
          <Button onClick={() => setCreate(true)}>
            <Plus className="size-4" />
            New call
          </Button>
        </div>
      </header>

      <StatRow>
        <StatCard
          label="Active"
          value={activeCount}
          hint={`${allJobs.length} in history`}
          selected={view === "active"}
          onClick={() => setView((v) => toggleChip(v, "active", "all"))}
        />
        <StatCard
          label="Flagged"
          value={flagCount}
          tone={flagCount ? "danger" : undefined}
          hint={kind === "service" ? "48-hour clock" : "2-week clock"}
          selected={view === "flagged"}
          onClick={() => setView((v) => toggleChip(v, "flagged", "all"))}
        />
        <StatCard
          label="Unassigned"
          value={unassignedCount}
          hint="Active calls with no tech"
          selected={view === "unassigned"}
          onClick={() => setView((v) => toggleChip(v, "unassigned", "all"))}
        />
        <StatCard
          label="Complete"
          value={completeCount}
          hint="Closed tickets"
          selected={view === "complete"}
          onClick={() => setView((v) => toggleChip(v, "complete", "all"))}
        />
      </StatRow>

      {kind === "service" ? (
        <CorrigoReviewList
          items={review}
          onDismiss={() => setReview([])}
        />
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2" data-testid="list-toolbar">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tickets…"
          className="h-9 w-56 shrink-0"
          aria-label="Search tickets"
        />
        <TechFilter
          value={tech}
          onChange={setTech}
          extraNames={(jobs.data ?? []).map((j) => j.technician)}
          className="h-9 w-40 shrink-0"
        />
        <SelectField
          value={urgency}
          onChange={(e) => setUrgency(e.target.value)}
          allowEmpty
          emptyLabel="All urgency"
          aria-label="Filter by urgency"
          className="h-9 w-40 shrink-0"
        >
          {URGENCIES.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </SelectField>
        <SortSelect value={sort} onChange={setSort} options={SORT_LIST} className="shrink-0" />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <div className="min-w-0">
        <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_5.5rem_8.5rem_4.5rem_4.5rem_7rem] gap-3 border-b border-border px-4 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase xl:grid">
          <span>Account</span>
          <span>Why it matters</span>
          <span>Urgency</span>
          <span>Status</span>
          <span>Received</span>
          <span>Scheduled</span>
          <span>Tech</span>
        </div>
        {jobs.isLoading ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">Loading calls…</p>
        ) : rows.length === 0 ? (
          <div className="px-4 py-8">
            <p className="text-sm text-muted-foreground">
              {q.trim() || tech || urgency
                ? "Nothing matches this search."
                : view === "active"
                  ? "No open tickets."
                  : "Nothing in this view."}
            </p>
            {!q.trim() && !tech && !urgency && view === "active" ? (
              <Button type="button" size="sm" className="mt-3" onClick={() => setCreate(true)}>
                <Plus className="size-4" />
                New call
              </Button>
            ) : null}
          </div>
        ) : (
          <ul>
            {rows.map((j) => (
              <JobRow key={j.id} job={j} onOpen={() => setOpenId(j.id)} />
            ))}
          </ul>
        )}
        </div>
      </div>

      <JobSheet id={openId} onClose={() => setOpenId(null)} />
      <NewJobDialog
        kind={kind}
        open={create}
        onOpenChange={setCreate}
        onCreated={(id) => setOpenId(id)}
      />
    </div>
  );
}

function JobRow({ job, onOpen }: { job: ServiceJob; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="desk-lift grid w-full gap-1 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/60 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_5.5rem_8.5rem_4.5rem_4.5rem_7rem] xl:items-center xl:gap-3"
      >
        <span>
          <span className="block font-medium">
            {job.customer ?? "Untitled"} <AkBadge on={job.aviKatz} className="ml-1 align-middle" />
          </span>

          <span className="text-xs text-muted-foreground">
            {job.callId}
            {job.wo ? ` · ${job.wo}` : ""}
            {job.issue ? ` · ${job.issue}` : ""}
          </span>
          {job.equipment ? (
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {job.equipment.replace(/\r?\n/g, " · ")}
            </span>
          ) : null}
        </span>
        <span className="flex flex-wrap gap-1">
          <DuplicateBadge duplicateOf={job.duplicateOf} siblingCount={job.siblings?.length ?? 0} />
          <FlagBadge flag={job.flag} />
          <span className="xl:hidden">
            <UrgencyBadge urgency={job.urgency} />
          </span>
        </span>
        <span className="hidden xl:block">
          <UrgencyBadge urgency={job.urgency} />
        </span>
        <StatusBadge status={job.status} />
        {/* Below xl the columns stack, so the bare dates need their labels. */}
        <span className="tabular text-sm text-muted-foreground">
          <span className="xl:hidden">Received </span>
          {formatShortDate(job.received)}
        </span>
        <span className="tabular text-sm text-muted-foreground">
          <span className="xl:hidden">Scheduled </span>
          {formatShortDate(job.scheduled)}
        </span>
        <span className="min-w-0 truncate text-sm">
          <span className="text-muted-foreground xl:hidden">Tech </span>
          <TechName name={job.technician} />
        </span>
      </button>
    </li>
  );
}
