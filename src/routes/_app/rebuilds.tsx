import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { createRebuild, listRebuilds, SHOP_ACCOUNT, type Rebuild } from "@/lib/ops/rebuilds";
import { REBUILD_STATUSES } from "@/lib/ops/rebuild-model";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { StatCard, StatRow, toggleChip } from "@/components/desk/desk-charts";
import { RebuildBoard } from "@/components/desk/rebuild-board";
import { RebuildPlanner } from "@/components/desk/rebuild-planner";
import { RebuildSheet } from "@/components/desk/rebuild-sheet";
import { CustomerCombo, EquipmentCombo } from "@/components/desk/directory-fields";
import { OwnerSelect } from "@/components/desk/owner-select";
import { ExportButton } from "@/components/desk/export-dialog";
import { useMyView } from "@/components/desk/my-view-bar";
import { parseOpenSearch, useOpenRecord } from "@/lib/ops/search-params";
import { Skeleton } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/rebuilds")({
  validateSearch: parseOpenSearch,
  component: Page,
});

const FILTERS = [
  { id: "all", label: "All" },
  { id: "overdue", label: "Overdue" },
  { id: "at-risk", label: "At risk" },
  { id: "waiting", label: "Waiting" },
  { id: "no-date", label: "No date" },
  { id: "mine", label: "My rebuilds" },
] as const;

function Page() {
  const { open } = Route.useSearch();
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ["rebuilds"], queryFn: () => listRebuilds() });
  const { filterMine, matchMine, role } = useMyView();
  const [q, setQ] = useState("");
  const [chip, setChip] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [view, setView] = useState<"board" | "timeline">(role !== "sales" ? "board" : "timeline");
  const [selected, setSelected] = useOpenRecord(open);
  const [create, setCreate] = useState(false);
  const rows = data.data?.rows ?? [];
  const canEdit = !!data.data?.canEdit;

  const filtered = useMemo(() => {
    let list = rows;
    if (filterMine && role === "sales") {
      list = list.filter((r) => matchMine(r.accountRep, r.owner) || r.aviKatz);
    }
    if (chip === "overdue") list = list.filter((r) => r.health === "overdue");
    if (chip === "at-risk") list = list.filter((r) => r.health === "at-risk");
    if (chip === "waiting") list = list.filter((r) => r.status === "Waiting");
    if (chip === "no-date") list = list.filter((r) => r.health === "no-date");
    if (chip === "mine") list = list.filter((r) => matchMine(r.owner));
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter((r) =>
        [r.title, r.account, r.equipment, r.serial, r.owner, r.status, r.reasonCode]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle)),
      );
    }
    return list;
  }, [rows, filterMine, role, matchMine, chip, q]);

  const selectedRow = rows.find((r) => r.id === selected) ?? null;
  const overdue = rows.filter((r) => r.health === "overdue").length;
  const atRisk = rows.filter((r) => r.health === "at-risk").length;
  const waiting = rows.filter((r) => r.status === "Waiting").length;
  const noDate = rows.filter((r) => r.health === "no-date").length;

  return (
    <div>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">In-House Rebuilds</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Shop projects, not field tickets. One owner, planned vs actual, a current blocker, and aging you cannot ignore.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButton defaultType="rebuilds" />
          {canEdit ? (
            <Button onClick={() => setCreate(true)}>
              <Plus className="size-4" />
              New rebuild
            </Button>
          ) : null}
        </div>
      </header>

      <StatRow>
        <StatCard
          label="Overdue"
          value={overdue}
          tone={overdue ? "danger" : "ok"}
          hint="Past target, still open"
          selected={chip === "overdue"}
          onClick={() => setChip((c) => toggleChip(c, "overdue", "all"))}
        />
        <StatCard
          label="At Risk"
          value={atRisk}
          tone={atRisk ? "warn" : "ok"}
          hint="Waiting, or target within 3 days"
          selected={chip === "at-risk"}
          onClick={() => setChip((c) => toggleChip(c, "at-risk", "all"))}
        />
        <StatCard
          label="Waiting"
          value={waiting}
          hint="Needs a reason delayed"
          selected={chip === "waiting"}
          onClick={() => setChip((c) => toggleChip(c, "waiting", "all"))}
        />
        <StatCard
          label="No Date"
          value={noDate}
          tone={noDate ? "warn" : "ok"}
          hint="In progress / waiting / testing with no target"
          selected={chip === "no-date"}
          onClick={() => setChip((c) => toggleChip(c, "no-date", "all"))}
        />
      </StatRow>

      <div className="mt-4 flex flex-wrap items-center gap-2" data-testid="list-toolbar">
        <Input className="h-9 w-64 shrink-0" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search project, account, serial…" aria-label="Search rebuilds" />
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setChip(f.id)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center rounded-full border px-3 text-sm",
              chip === f.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
        <div className="flex shrink-0 gap-1">
          <Button type="button" size="sm" variant={view === "board" ? "default" : "outline"} onClick={() => setView("board")}>
            Board
          </Button>
          <Button type="button" size="sm" variant={view === "timeline" ? "default" : "outline"} onClick={() => setView("timeline")}>
            Timeline
          </Button>
        </div>
      </div>

      <div className="mt-5">
        {data.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : view === "board" ? (
          <RebuildBoard rows={filtered} canEdit={canEdit} onOpen={setSelected} />
        ) : (
          <RebuildPlanner rows={filtered} canEdit={canEdit} onOpen={setSelected} />
        )}
      </div>

      <RebuildSheet row={selectedRow} canEdit={canEdit} onClose={() => setSelected(null)} />
      <CreateRebuildDialog
        open={create}
        onOpenChange={setCreate}
        onCreated={(row) => {
          void qc.invalidateQueries({ queryKey: ["rebuilds"] });
          void qc.invalidateQueries({ queryKey: ["dashboard"] });
          setSelected(row.id);
          setCreate(false);
        }}
      />
    </div>
  );
}

function CreateRebuildDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (row: Rebuild) => void;
}) {
  const [title, setTitle] = useState("");
  const [account, setAccount] = useState(SHOP_ACCOUNT);
  const [equipment, setEquipment] = useState("");
  const [owner, setOwner] = useState("");
  const [status, setStatus] = useState("Queued");
  const [reasonCode, setReasonCode] = useState("");
  const [reasonDetail, setReasonDetail] = useState("");
  const [targetComplete, setTargetComplete] = useState("");
  const [plannedStart, setPlannedStart] = useState("");
  const [notes, setNotes] = useState("");
  const create = useMutation({
    mutationFn: () =>
      createRebuild({
        data: {
          title,
          account: account || SHOP_ACCOUNT,
          equipment,
          owner,
          status,
          reasonCode,
          reasonDetail,
          targetComplete: targetComplete || null,
          plannedStart: plannedStart || null,
          notes,
        },
      }),
    onSuccess: (row) => {
      toast.success("Rebuild opened");
      setTitle("");
      setEquipment("");
      setNotes("");
      setStatus("Queued");
      setReasonCode("");
      onCreated(row);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogTitle>New Rebuild</DialogTitle>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div>
            <Label htmlFor="new-rb-title">Project name</Label>
            <Input id="new-rb-title" className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div>
            <CustomerCombo label="Account" value={account} onChange={setAccount} />
            <button type="button" className="mt-1 text-xs text-primary underline-offset-2 hover:underline" onClick={() => setAccount(SHOP_ACCOUNT)}>
              Katz shop / stock
            </button>
          </div>
          <EquipmentCombo label="Equipment" value={equipment} onChange={setEquipment} />
          <OwnerSelect value={owner} onChange={setOwner} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="new-rb-status">Status</Label>
              <SelectField id="new-rb-status" className="mt-1" value={status} onChange={(e) => setStatus(e.target.value)}>
                {REBUILD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </SelectField>
            </div>
            <div>
              <Label htmlFor="new-rb-target">Target complete</Label>
              <Input id="new-rb-target" type="date" className="mt-1" value={targetComplete} onChange={(e) => setTargetComplete(e.target.value)} />
            </div>
          </div>
          {status === "Waiting" ? (
            <div className="rounded-xl border border-warning/40 bg-warning/8 p-3">
              <Label>Reason delayed</Label>
              <SelectField className="mt-1" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} allowEmpty emptyLabel="Pick a reason">
                {["Parts on order", "Parts not available", "Waiting on decision", "Waiting on customer", "Tech / bench unavailable", "Scope changed", "Found additional failure", "Other"].map(
                  (r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ),
                )}
              </SelectField>
              <Input className="mt-2" value={reasonDetail} onChange={(e) => setReasonDetail(e.target.value)} placeholder="Detail (required if Other)" />
            </div>
          ) : null}
          <div>
            <Label htmlFor="new-rb-planned">Planned start</Label>
            <Input id="new-rb-planned" type="date" className="mt-1" value={plannedStart} onChange={(e) => setPlannedStart(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="new-rb-notes">Notes</Label>
            <Textarea id="new-rb-notes" className="mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Opening…" : "Open rebuild"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
