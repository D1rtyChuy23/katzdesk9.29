import { useEffect, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { InvoiceButton } from "@/components/desk/invoice-window";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listComments } from "@/lib/ops/api";
import {
  listRebuildLinks,
  pullRebuildSerial,
  SHOP_ACCOUNT,
  archiveRebuild,
  updateRebuild,
  type Rebuild,
} from "@/lib/ops/rebuilds";
import {
  HEALTH_LABEL,
  REBUILD_PRIORITIES,
  REBUILD_STATUSES,
  WAITING_REASONS,
  priorityLabel,
} from "@/lib/ops/rebuild-model";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SheetTabs } from "./sheet-tabs";
import { Badge } from "@/components/ui/badge";
import { CustomerCombo, EquipmentCombo } from "./directory-fields";
import { OwnerSelect } from "./owner-select";
import { SerialNoticeBanner } from "./serial-notice";
import { StatusBadge } from "./flag-badge";
import { Thread } from "./thread";
import { PingButton } from "./ping-button";
import { RepairQuotePanel } from "./repair-quote-panel";
import { costGlance, money } from "@/lib/ops/repair-quote";
import { OpenLink } from "./open-link";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatShortDate } from "@/lib/ops/clock";
import { isShopAccount, sentence, warehouseInvoiceRefusal, warehouseMayEdit } from "@/lib/ops/warehouse-invoice";
import { Trash2 } from "lucide-react";

function HealthBadge({ health }: { health: Rebuild["health"] }) {
  const variant =
    health === "overdue" ? "danger" : health === "at-risk" || health === "no-date" ? "warn" : health === "done" ? "outline" : "success";
  return <Badge variant={variant}>{HEALTH_LABEL[health]}</Badge>;
}

type RebuildTab = "details" | "equipment" | "invoices" | "ping";

/** One category per tab, same shape as a Board install. A rebuild opens on Details. */
const REBUILD_TABS: { id: RebuildTab; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "equipment", label: "Equipment" },
  { id: "invoices", label: "Invoices" },
  { id: "ping", label: "Ping" },
];

const KEEP_MOUNTED = "outline-none data-[state=inactive]:hidden";

export function RebuildSheet({
  row,
  canEdit,
  accountLock = null,
  onClose,
}: {
  row: Rebuild | null;
  canEdit: boolean;
  /** Warehouse: its refurbs are for this account (Katz Coffee Service Dept.), so the account can't be picked. */
  accountLock?: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [account, setAccount] = useState(SHOP_ACCOUNT);
  const [equipment, setEquipment] = useState("");
  const [serial, setSerial] = useState("");
  const [owner, setOwner] = useState("");
  const [status, setStatus] = useState("Queued");
  const [reasonCode, setReasonCode] = useState("");
  const [reasonDetail, setReasonDetail] = useState("");
  const [plannedStart, setPlannedStart] = useState("");
  const [targetComplete, setTargetComplete] = useState("");
  const [actualStart, setActualStart] = useState("");
  const [actualComplete, setActualComplete] = useState("");
  const [priority, setPriority] = useState("normal");
  const [notes, setNotes] = useState("");
  const [installId, setInstallId] = useState<number | null>(null);
  const [jobId, setJobId] = useState<number | null>(null);
  const [reuseNotice, setReuseNotice] = useState<string | null>(null);

  // The form starts over only when the rebuild's own fields change on the server, not when the list refreshes for
  // something else on the row (its invoice or quote), so unsaved edits stay put.
  const formKey = row
    ? JSON.stringify([
        row.id,
        row.title,
        row.account,
        row.equipment,
        row.serial,
        row.owner,
        row.status,
        row.reasonCode,
        row.reasonDetail,
        row.plannedStart,
        row.targetComplete,
        row.actualStart,
        row.actualComplete,
        row.priority,
        row.notes,
        row.installId,
        row.jobId,
      ])
    : "";
  useEffect(() => {
    if (!row) return;
    setTitle(row.title);
    setAccount(row.account);
    setEquipment(row.equipment ?? "");
    setSerial(row.serial ?? "");
    setOwner(row.owner ?? "");
    setStatus(row.status);
    setReasonCode(row.reasonCode ?? "");
    setReasonDetail(row.reasonDetail ?? "");
    setPlannedStart(row.plannedStart ?? "");
    setTargetComplete(row.targetComplete ?? "");
    setActualStart(row.actualStart ?? "");
    setActualComplete(row.actualComplete ?? "");
    setPriority(row.priority);
    setNotes(row.notes ?? "");
    setInstallId(row.installId);
    setJobId(row.jobId);
    // `row` is read through formKey, which holds every field set here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formKey]);

  const [tab, setTab] = useState<RebuildTab>("details");
  useEffect(() => setTab("details"), [row?.id]);
  const comments = useQuery({
    queryKey: ["comments", "rebuild", row?.id],
    queryFn: () => listComments({ data: { entityType: "rebuild", entityId: row!.id } }),
    enabled: !!row,
  });

  const links = useQuery({
    queryKey: ["rebuild-links", account],
    queryFn: () => listRebuildLinks({ data: { account } }),
    enabled: !!row,
  });

  const save = useMutation({
    mutationFn: () =>
      updateRebuild({
        data: {
          id: row!.id,
          title,
          account,
          equipment,
          serial,
          owner,
          status,
          reasonCode,
          reasonDetail,
          plannedStart: plannedStart || null,
          targetComplete: targetComplete || null,
          actualStart: actualStart || null,
          actualComplete: actualComplete || null,
          priority,
          notes,
          installId,
          jobId,
        },
      }),
    onSuccess: () => {
      toast.success("Rebuild saved");
      void qc.invalidateQueries({ queryKey: ["rebuilds"] });
      // Linking or unlinking a ticket changes which quote this project shares.
      void qc.invalidateQueries({ queryKey: ["repair-quote"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["activity"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const pull = useMutation({
    // A confirm sends the question it answers: the server asks again if the unit moved since.
    mutationFn: (opts: { confirmReuse?: boolean; asked?: string }) =>
      pullRebuildSerial({ data: { id: row!.id, serial, confirmReuse: opts.confirmReuse, asked: opts.asked } }),
    onSuccess: (next) => {
      setReuseNotice(null);
      setSerial(next.serial ?? "");
      setEquipment(next.equipment ?? equipment);
      toast.success(next.serialNotice || "Serial saved");
      void qc.invalidateQueries({ queryKey: ["rebuilds"] });
      void qc.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Could not check warehouse";
      if (/already assigned/i.test(msg)) setReuseNotice(msg);
      else {
        setReuseNotice(null);
        toast.error(msg);
      }
    },
  });

  const drop = useMutation({
    mutationFn: () => archiveRebuild({ data: { id: row!.id } }),
    onSuccess: () => {
      toast.success("Rebuild removed from the board");
      void qc.invalidateQueries({ queryKey: ["rebuilds"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["activity"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove"),
  });

  if (!row) return null;
  const waiting = status === "Waiting";
  const locked = !canEdit;

  return (
    <>
      <Sheet open onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="pr-8">{row.title}</SheetTitle>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusBadge status={row.status} />
              <HealthBadge health={row.health} />
              {row.priority !== "normal" ? <Badge variant="warn">{priorityLabel(row.priority)}</Badge> : null}
              <span title={row.quote ? `Parts ${money(row.quote.parts)} · Labor ${money(row.quote.labor)}` : "No repair quote on this project yet"}>
                <Badge variant="outline" data-testid="rebuild-sheet-cost">
                  {row.quote ? `Cost ${costGlance(row.quote)}` : "No quote"}
                </Badge>
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {row.daysOpen} days open
              {row.daysToTarget != null ? ` · ${row.daysToTarget} days to target` : ""}
              {row.daysInStatus != null ? ` · ${row.daysInStatus} days in ${row.status}` : ""}
              {row.daysLateEarly != null
                ? ` · ${row.daysLateEarly === 0 ? "on time" : row.daysLateEarly > 0 ? `${row.daysLateEarly} days late` : `${-row.daysLateEarly} days early`}`
                : ""}
            </p>
          </SheetHeader>
          <SheetBody>
            <SheetTabs
              value={tab}
              onValueChange={setTab}
              tabs={REBUILD_TABS.map((t) => ({ ...t, count: t.id === "ping" ? comments.data?.length || null : null }))}
              label="Rebuild sections"
              testId="rebuild"
            >
            <Tabs.Content value="details" forceMount className={KEEP_MOUNTED} data-testid="rebuild-panel-details">
            <form
              className="space-y-4 px-5 py-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (locked) return;
                save.mutate();
              }}
            >
              <div>
                <Label htmlFor="rb-title">Project name</Label>
                <Input id="rb-title" className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} disabled={locked} required />
              </div>
              {accountLock ? (
                // Warehouse: the account isn't picked. A Katz shop / stock refurb can move to Katz Coffee Service Dept.
                <div data-testid="rebuild-account-locked">
                  <Label>Account</Label>
                  <p className="mt-1 text-sm font-medium" data-testid="rebuild-account">
                    {account}
                  </p>
                  {!locked && isShopAccount(account) ? (
                    <button
                      type="button"
                      className="mt-1 text-xs text-primary underline-offset-2 hover:underline max-sm:mt-2 max-sm:inline-flex max-sm:min-h-10 max-sm:items-center max-sm:text-sm"
                      onClick={() => setAccount(accountLock)}
                      data-testid="rebuild-bill-service-dept"
                    >
                      Bill {accountLock}
                    </button>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {account !== row.account ? `Save to move this refurb to ${sentence(accountLock)}` : `Warehouse refurbs and their invoices are for ${sentence(accountLock)}`}
                  </p>
                </div>
              ) : (
                <div>
                  <CustomerCombo label="Account" value={account} onChange={setAccount} />
                  <button
                    type="button"
                    className="mt-1 text-xs text-primary underline-offset-2 hover:underline max-sm:mt-2 max-sm:inline-flex max-sm:min-h-10 max-sm:items-center max-sm:text-sm"
                    onClick={() => setAccount(SHOP_ACCOUNT)}
                    disabled={locked}
                  >
                    Katz shop / stock
                  </button>
                </div>
              )}
              <OwnerSelect value={owner} onChange={setOwner} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="rb-status">Status</Label>
                  <SelectField id="rb-status" className="mt-1" value={status} onChange={(e) => setStatus(e.target.value)} disabled={locked}>
                    {REBUILD_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </SelectField>
                </div>
                <div>
                  <Label htmlFor="rb-priority">Priority</Label>
                  <SelectField id="rb-priority" className="mt-1" value={priority} onChange={(e) => setPriority(e.target.value)} disabled={locked}>
                    {REBUILD_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {priorityLabel(p)}
                      </option>
                    ))}
                  </SelectField>
                </div>
              </div>
              {waiting ? (
                <div className="rounded-xl border border-warning/40 bg-warning/8 p-3">
                  <Label htmlFor="rb-reason">Reason delayed</Label>
                  <SelectField
                    id="rb-reason"
                    className="mt-1"
                    value={reasonCode}
                    onChange={(e) => setReasonCode(e.target.value)}
                    allowEmpty
                    emptyLabel="Pick a reason"
                    disabled={locked}
                  >
                    {WAITING_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </SelectField>
                  <Label htmlFor="rb-reason-detail" className="mt-3 block">
                    Detail
                  </Label>
                  <Input
                    id="rb-reason-detail"
                    className="mt-1"
                    value={reasonDetail}
                    onChange={(e) => setReasonDetail(e.target.value)}
                    placeholder="Optional, required if Other"
                    disabled={locked}
                  />
                </div>
              ) : row.reasonCode ? (
                <p className="text-xs text-muted-foreground">Last waiting reason (history): {row.reasonCode}</p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="rb-planned">Planned start</Label>
                  <Input id="rb-planned" type="date" className="mt-1" value={plannedStart} onChange={(e) => setPlannedStart(e.target.value)} disabled={locked} />
                </div>
                <div>
                  <Label htmlFor="rb-target">Target complete</Label>
                  <Input id="rb-target" type="date" className="mt-1" value={targetComplete} onChange={(e) => setTargetComplete(e.target.value)} disabled={locked} />
                </div>
                <div>
                  <Label htmlFor="rb-astart">Actual start</Label>
                  <Input id="rb-astart" type="date" className="mt-1" value={actualStart} onChange={(e) => setActualStart(e.target.value)} disabled={locked} />
                </div>
                <div>
                  <Label htmlFor="rb-adone">Actual complete</Label>
                  <Input id="rb-adone" type="date" className="mt-1" value={actualComplete} onChange={(e) => setActualComplete(e.target.value)} disabled={locked} />
                </div>
              </div>
              <div>
                <Label htmlFor="rb-link">Linked ticket / install</Label>
                <SelectField
                  id="rb-link"
                  className="mt-1"
                  value={installId ? `install:${installId}` : jobId ? `job:${jobId}` : ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v.startsWith("install:")) {
                      setInstallId(Number(v.slice(8)));
                      setJobId(null);
                    } else if (v.startsWith("job:")) {
                      setJobId(Number(v.slice(4)));
                      setInstallId(null);
                    } else {
                      setInstallId(null);
                      setJobId(null);
                    }
                  }}
                  allowEmpty
                  emptyLabel="Not linked — this is its own project"
                  disabled={locked}
                >
                  {(links.data ?? []).map((l) => (
                    <option key={`${l.kind}-${l.id}`} value={l.kind === "install" ? `install:${l.id}` : `job:${l.id}`}>
                      {l.label}
                    </option>
                  ))}
                </SelectField>
                {installId ? (
                  <OpenLink entityType="install" id={installId} className="mt-1 inline-block text-xs text-primary hover:underline">
                    Open linked install
                  </OpenLink>
                ) : null}
                {jobId ? (
                  <OpenLink entityType="service" id={jobId} className="mt-1 inline-block text-xs text-primary hover:underline">
                    Open linked ticket
                  </OpenLink>
                ) : null}
              </div>
              <div>
                <Label htmlFor="rb-notes">Notes</Label>
                <Textarea id="rb-notes" className="mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={locked} />
                <p className="mt-1 text-xs text-muted-foreground">Rebuild notes stay on this project. They do not overwrite Description of work on a service ticket.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canEdit ? (
                  <Button type="submit" disabled={save.isPending}>
                    {save.isPending ? "Saving…" : "Save"}
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground" data-testid="rebuild-read-only">
                    {accountLock
                      ? `Warehouse can view this rebuild. It changes refurbs for ${accountLock} and ${SHOP_ACCOUNT} only.`
                      : "Sales can view this rebuild. Bench status is service-owned."}
                  </p>
                )}
                {canEdit ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="ml-auto text-destructive hover:bg-destructive/10"
                    disabled={drop.isPending}
                    data-testid="rebuild-sheet-remove"
                    onClick={() => {
                      if (!window.confirm(`Remove “${row.title}” from rebuilds? It leaves the board. Notes stay in history.`)) {
                        return;
                      }
                      drop.mutate();
                    }}
                  >
                    <Trash2 className="size-3.5" />
                    Remove project
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">Updated {formatShortDate(row.updatedAt.slice(0, 10))}</p>
            </form>
            </Tabs.Content>
            <Tabs.Content value="equipment" forceMount className={`space-y-4 px-5 py-4 ${KEEP_MOUNTED}`} data-testid="rebuild-panel-equipment">
              <SerialNoticeBanner notice={row.serialNotice} />
              <EquipmentCombo label="Equipment" value={equipment} onChange={setEquipment} />
              <div>
                <Label htmlFor="rb-serial">Serial</Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    id="rb-serial"
                    value={serial}
                    onChange={(e) => setSerial(e.target.value)}
                    onBlur={() => {
                      if (locked || !serial.trim() || pull.isPending) return;
                      pull.mutate({});
                    }}
                    placeholder="Type a warehouse serial"
                    disabled={locked}
                  />
                  <Button type="button" variant="outline" disabled={locked || pull.isPending} onClick={() => pull.mutate({})}>
                    Pull
                  </Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Matching a warehouse serial attaches that unit. It does not create a second record.
                  {accountLock && !locked ? " Warehouse pulls a unit from the barn, one of our sites or a customer's account with no Admin's approval, and the Admins get a ping saying where it came from." : ""}
                </p>
              </div>
              {canEdit ? (
                <Button type="button" disabled={save.isPending} onClick={() => save.mutate()}>
                  {save.isPending ? "Saving…" : "Save"}
                </Button>
              ) : null}
            </Tabs.Content>
            <Tabs.Content value="invoices" forceMount className={KEEP_MOUNTED} data-testid="rebuild-panel-invoices">
              <section className="border-b border-border p-5">
                <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Invoice</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {accountLock && warehouseMayEdit(row.account)
                    ? `The parts this refurb used, billed to ${sentence(accountLock)} Save them for an Admin to approve.`
                    : "Billing info for this rebuild."}
                </p>
                {accountLock && !warehouseMayEdit(row.account) ? (
                  // A customer's rebuild: its invoice is an Admin's, and its billing stays closed to Warehouse.
                  <p className="mt-3 text-sm text-muted-foreground" data-testid="rebuild-invoice-closed">
                    {warehouseInvoiceRefusal(row.account)}
                  </p>
                ) : (
                  <div className="mt-3">
                    <InvoiceButton type="rebuild" id={row.id} key={`invoice-rebuild-${row.id}`} />
                  </div>
                )}
              </section>
              {/* Repair quotes are customers' estimates: not Warehouse's (the server refuses its saves too). */}
              {accountLock ? null : <RepairQuotePanel rebuildId={row.id} key={`quote-${row.id}`} />}
            </Tabs.Content>
            <Tabs.Content value="ping" forceMount className={KEEP_MOUNTED} data-testid="rebuild-panel-ping">
              <div className="border-b border-border px-5 py-3">
                <PingButton
                  entityType="rebuild"
                  entityId={row.id}
                  contextLabel={`${row.title} · ${row.account}`}
                  defaultNote={`${row.title} at ${row.account}`}
                />
              </div>
              <Thread entityType="rebuild" entityId={row.id} />
            </Tabs.Content>
            </SheetTabs>
          </SheetBody>
        </SheetContent>
      </Sheet>
      <Dialog open={!!reuseNotice} onOpenChange={(v) => !v && setReuseNotice(null)}>
        <DialogContent>
          <DialogTitle>Serial Already Assigned</DialogTitle>
          <DialogDescription>{reuseNotice}</DialogDescription>
          {accountLock ? (
            <p className="text-sm text-muted-foreground" data-testid="rebuild-pull-ping">
              Reusing it moves it onto this refurb now. The Admins get a ping saying where it came from.
            </p>
          ) : null}
          <div className="mt-4 flex gap-2">
            <Button
              type="button"
              disabled={pull.isPending}
              onClick={() => {
                pull.mutate({ confirmReuse: true, asked: reuseNotice ?? undefined });
              }}
            >
              Reuse on this rebuild
            </Button>
            <Button type="button" variant="outline" onClick={() => setReuseNotice(null)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
