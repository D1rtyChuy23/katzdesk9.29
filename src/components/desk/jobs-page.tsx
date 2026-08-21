import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listJobs } from "@/lib/ops/api";
import { CLOSED_CALL, TECHNICIANS, URGENCIES, URGENCY_RANK } from "@/lib/ops/lookups";
import { formatShortDate } from "@/lib/ops/clock";
import type { ServiceJob } from "@/lib/ops/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { FlagBadge, StatusBadge, UrgencyBadge } from "./flag-badge";
import { JobSheet, NewJobDialog } from "./job-sheet";
import { SortSelect, useDeskSort } from "./sort-bar";
import { ChartCard, SimpleBars, StatCard, StatusDonut } from "./desk-charts";
import { SORT_LIST, equipmentCount, sortDesk, tally } from "@/lib/ops/sort";
import { Plus } from "lucide-react";

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
  const [q, setQ] = useState("");
  const [tech, setTech] = useState("");
  const [urgency, setUrgency] = useState("");
  const [view, setView] = useState<"active" | "flagged" | "all">("active");
  const [openId, setOpenId] = useState<number | null>(initialOpen ?? null);
  useEffect(() => {
    if (initialOpen != null) setOpenId(initialOpen);
  }, [initialOpen]);
  const [create, setCreate] = useState(false);
  const [sort, setSort] = useDeskSort(`jobs-${kind}`, "flag");

  const rows = useMemo(() => {
    let list = jobs.data ?? [];
    if (view === "active") list = list.filter((j) => !CLOSED_CALL.has(j.status) && !j.done);
    if (view === "flagged") list = list.filter((j) => j.flag);
    if (tech) list = list.filter((j) => j.technician === tech);
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
  }, [jobs.data, q, tech, urgency, view, sort]);

  const activeCount = (jobs.data ?? []).filter((j) => !CLOSED_CALL.has(j.status) && !j.done).length;
  const flagCount = (jobs.data ?? []).filter((j) => j.flag).length;
  const allJobs = jobs.data ?? [];
  const activeJobs = allJobs.filter((j) => !CLOSED_CALL.has(j.status) && !j.done);
  const statusMix = tally(activeJobs, (j) => j.status);
  const techMix = tally(
    activeJobs.filter((j) => j.technician),
    (j) => j.technician,
  );

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">{title}</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{lede}</p>
        </div>
        <Button onClick={() => setCreate(true)}>
          <Plus className="size-4" />
          New call
        </Button>
      </header>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <StatCard label="Active" value={activeCount} hint={`${allJobs.length} in history`} />
        <StatCard
          label="Flagged"
          value={flagCount}
          tone={flagCount ? "danger" : undefined}
          hint={kind === "service" ? "48-hour clock" : "2-week clock"}
        />
        <StatCard
          label="Unassigned"
          value={activeJobs.filter((j) => !j.technician).length}
          hint="Active calls with no tech"
        />
      </div>
      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Active by status" lede="Where this board sits right now.">
          {statusMix.length ? <StatusDonut data={statusMix} unit="active" /> : <p className="text-sm text-muted-foreground">No active calls.</p>}
        </ChartCard>
        <ChartCard title="On the truck" lede="Active calls per technician.">
          {techMix.length ? (
            <SimpleBars
              data={techMix.map((t) => ({ tech: t.name, count: t.count }))}
              xKey="tech"
              yKey="count"
              yLabel="Calls"
              horizontal
            />
          ) : (
            <p className="text-sm text-muted-foreground">Nobody assigned yet.</p>
          )}
        </ChartCard>
      </section>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {(["active", "flagged", "all"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`h-9 rounded-full px-3 text-sm font-medium ${
              view === v ? "bg-ink text-ink-foreground" : "bg-secondary text-foreground"
            }`}
          >
            {v === "active" ? `Active (${activeCount})` : v === "flagged" ? `Flagged (${flagCount})` : "All history"}
          </button>
        ))}
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter this list…"
          className="max-w-xs"
        />
        <SelectField
          value={tech}
          onChange={(e) => setTech(e.target.value)}
          allowEmpty
          emptyLabel="All techs"
          className="w-40"
        >
          {TECHNICIANS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </SelectField>
        <SelectField
          value={urgency}
          onChange={(e) => setUrgency(e.target.value)}
          allowEmpty
          emptyLabel="All urgency"
          className="w-40"
          aria-label="Filter by urgency"
        >
          {URGENCIES.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </SelectField>
        <SortSelect value={sort} onChange={setSort} options={SORT_LIST} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <div className="min-w-0 md:min-w-[52rem]">
        <div className="hidden grid-cols-[1.4fr_1fr_6rem_7rem_7rem_7rem_6rem] gap-3 border-b border-border px-4 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase md:grid">
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
          <p className="px-4 py-8 text-sm text-muted-foreground">Nothing in this view.</p>
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
        className="grid w-full gap-1 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/60 md:grid-cols-[1.4fr_1fr_6rem_7rem_7rem_7rem_6rem] md:items-center md:gap-3"
      >
        <span>
          <span className="block font-medium">{job.customer ?? "Untitled"}</span>
          <span className="text-xs text-muted-foreground">
            {job.callId}
            {job.wo ? ` · ${job.wo}` : ""}
            {job.issue ? ` · ${job.issue}` : ""}
          </span>
        </span>
        <span className="flex flex-wrap gap-1">
          <FlagBadge flag={job.flag} />
          <span className="md:hidden">
            <UrgencyBadge urgency={job.urgency} />
          </span>
        </span>
        <span className="hidden md:block">
          <UrgencyBadge urgency={job.urgency} />
        </span>
        <StatusBadge status={job.status} />
        <span className="tabular text-sm text-muted-foreground">{formatShortDate(job.received)}</span>
        <span className="tabular text-sm text-muted-foreground">{formatShortDate(job.scheduled)}</span>
        <span className="text-sm">{job.technician ?? "—"}</span>
      </button>
    </li>
  );
}
