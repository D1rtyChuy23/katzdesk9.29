import { CustomerAddress } from "./customer-address";
import { InvoiceButton } from "@/components/desk/invoice-window";
import { JobWoHistory } from "@/components/desk/wo-history-account";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { ChevronDown } from "lucide-react";
import {
  createJob,
  getCustomerHistory,
  getJob,
  getPm,
  listAssets,
  listComments,
  listDirectory,
  listModules,
  mergeServiceTickets,
  unassignAssetFromService,
  updateJob,
} from "@/lib/ops/api";
import { moduleAccount } from "@/lib/ops/eversys";
import { cn } from "@/lib/utils";
import { CALL_STATUSES, CALL_TYPES, URGENCIES } from "@/lib/ops/lookups";
import { formatLongDate } from "@/lib/ops/clock";
import { Button } from "@/components/ui/button";
import { AutoGrowTextarea, Input, Label, Textarea } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/separator";
import { DuplicateBadge, FlagBadge, StatusBadge, UrgencyBadge } from "./flag-badge";
import { Thread } from "./thread";
import { ChargesPanel } from "./charges-panel";
import { RepairQuotePanel } from "./repair-quote-panel";
import { CustomerCombo, EquipmentMultiCombo, LockedCustomer, useDirectory } from "./directory-fields";
import { ProviderDispatchBlock } from "./provider-dispatch";
import { listedEquipment } from "@/lib/ops/equipment";
import type { ServiceJob } from "@/lib/ops/types";
import { toast } from "sonner";
import { TechSelect } from "./tech-select";
import { SerialNoticeBanner, SerialPullField } from "./serial-notice";
import { UnitPlaceField } from "./unit-place-field";
import { SheetTabs } from "./sheet-tabs";
import { AccountEquipmentList, HistoryRow, pendingSchedules, useAccountEquipment } from "./account-history";
import { ModuleRecord } from "./module-record";
import { PmSheet } from "./entity-sheets";
import { TicketPmStack } from "./pm-stack-panel";
import { isJobStack, jobStackQuery, openPmReminders } from "./pm-stack-shared";

/** The ticket's categories, one per tab, in this order. Only a ticket with a customer has tabs. */
export type TicketTab = "ticket" | "equipment" | "invoicing" | "schedules" | "ping";

const TICKET_TABS: { id: TicketTab; label: string }[] = [
  { id: "ticket", label: "Ticket" },
  { id: "equipment", label: "Equipment" },
  { id: "invoicing", label: "Invoicing" },
  { id: "schedules", label: "Schedules" },
  { id: "ping", label: "Ping" },
];

/** A panel that stays mounted while another tab is open: unsaved edits stay, and closing from any tab still saves. */
const KEEP_MOUNTED = "outline-none data-[state=inactive]:hidden";

export function JobSheet({
  id,
  onClose,
  lockCustomer = false,
  initialTab,
}: {
  id: number | null;
  onClose: () => void;
  lockCustomer?: boolean;
  /** Open this ticket on that tab (a ping or note notification opens it on Ping). */
  initialTab?: TicketTab;
}) {
  const qc = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const skipToast = useRef(false);
  const [viewId, setViewId] = useState<number | null>(id);
  // Tab picked and PM opened on this ticket; both start over each time the window opens a ticket.
  const [tabPick, setTabPick] = useState<{ key: string; tab: TicketTab } | null>(null);
  const [pmPick, setPmPick] = useState<{ forId: number | null; pmId: number } | null>(null);
  useEffect(() => {
    setViewId(id);
    setTabPick(null);
    setPmPick(null);
  }, [id]);
  const activeId = viewId ?? id;
  // A picked tab belongs to one ticket (and the tab it was opened on). Only the ticket the window was opened with
  // starts on `initialTab`, and only the first time.
  const tabKeyOf = (ticketId: number | null) => `${ticketId ?? ""}:${ticketId === id ? (initialTab ?? "") : ""}`;
  /** Switch this window to another ticket, on its Ticket tab (also when coming back to the ticket a ping opened). */
  function showTicket(nextId: number) {
    setTabPick({ key: tabKeyOf(nextId), tab: "ticket" });
    setViewId(nextId);
  }
  const job = useQuery({
    queryKey: ["job", activeId],
    queryFn: () => getJob({ data: { id: activeId! } }),
    enabled: activeId != null,
  });
  const pmStack = useQuery({
    ...jobStackQuery(activeId ?? 0),
    enabled: activeId != null,
  });
  const stackedPms = isJobStack(pmStack.data) ? pmStack.data.stacked : [];
  const stackCandidates = isJobStack(pmStack.data) ? pmStack.data.candidates : [];
  const stackCustomersDiffer = stackedPms.some((p) => !p.customerMatches);
  const lockTicketCustomer = lockCustomer || (!stackCustomersDiffer && stackedPms.length > 0 && stackedPms.every((p) => p.customerMatches));
  const canStackWrite = isJobStack(pmStack.data) && pmStack.data.canWrite;
  const save = useMutation({
    mutationFn: (patch: Parameters<typeof updateJob>[0]["data"]) => updateJob({ data: patch }),
    onSuccess: (row) => {
      if (!skipToast.current) toast.success("Saved");
      skipToast.current = false;
      // Keep the saved ticket in the cache, so reopening it right after closing shows (and re-saves) the new values.
      if (row) qc.setQueryData(["job", row.id], row);
      void qc.invalidateQueries({ queryKey: ["jobs"] });
      void qc.invalidateQueries({ queryKey: ["job"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["activity"] });
      void qc.invalidateQueries({ queryKey: ["customer-history"] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const merge = useMutation({
    mutationFn: (pair: { keeperId: number; extraId: number }) => mergeServiceTickets({ data: pair }),
    onSuccess: (row) => {
      toast.success("Tickets merged");
      void qc.invalidateQueries({ queryKey: ["jobs"] });
      void qc.invalidateQueries({ queryKey: ["job"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["activity"] });
      void qc.invalidateQueries({ queryKey: ["comments"] });
      void qc.invalidateQueries({ queryKey: ["charges"] });
      void qc.invalidateQueries({ queryKey: ["invoice"] });
      void qc.invalidateQueries({ queryKey: ["account-invoices"] });
      void qc.invalidateQueries({ queryKey: ["repair-quote"] });
      void qc.invalidateQueries({ queryKey: ["customer-history"] });
      if (row?.id && row.id !== activeId) showTicket(row.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const j = job.data;
  const assets = useQuery({ queryKey: ["assets"], queryFn: () => listAssets() });
  const pulledSerial =
    (assets.data ?? []).find((a) => a.jobId === activeId)?.serial ?? "";

  // With a customer the ticket is split into tabs. Another ticket opens on Ticket, unless a ping opened it.
  const customer = j?.customer?.trim() ?? "";
  const tabbed = customer !== "";
  const tabKey = tabKeyOf(activeId);
  const tab: TicketTab = tabPick?.key === tabKey ? tabPick.tab : activeId === id && initialTab ? initialTab : "ticket";
  const pickTab = (next: TicketTab) => setTabPick({ key: tabKey, tab: next });
  // Equipment mounts the first time it is opened on this ticket and then stays (its account queries only run once it
  // is opened), so a half-picked location is still there after looking at another tab.
  const [equipSeen, setEquipSeen] = useState<string | null>(null);
  useEffect(() => {
    if (tab === "equipment") setEquipSeen(tabKey);
  }, [tab, tabKey]);
  const keepEquipment = tab === "equipment" || equipSeen === tabKey;
  // The account's equipment and schedules: the same queries the account window reads.
  const accountEquip = useAccountEquipment(tabbed ? customer : null);
  const directory = useQuery({
    queryKey: ["directory", "customer"],
    queryFn: () => listDirectory({ data: { kind: "customer" } }),
    enabled: tabbed,
  });
  const accountId = tabbed
    ? ((directory.data ?? []).find((c) => c.name.trim().toLowerCase() === customer.toLowerCase())?.id ?? null)
    : null;
  const history = useQuery({
    queryKey: ["customer-history", accountId],
    queryFn: () => getCustomerHistory({ data: { id: accountId! } }),
    enabled: accountId != null,
  });
  const schedules = useMemo(() => pendingSchedules(history.data, { factorTickets: true }), [history.data]);
  const comments = useQuery({
    queryKey: ["comments", j?.kind, j?.id],
    queryFn: () => listComments({ data: { entityType: j!.kind, entityId: j!.id } }),
    enabled: tabbed,
  });
  const openPmFromHistory =
    id != null && pmPick && pmPick.forId === activeId ? (history.data?.pms.find((p) => p.id === pmPick.pmId) ?? null) : null;
  const openPmFetch = useQuery({
    queryKey: ["pm", pmPick?.pmId],
    queryFn: () => getPm({ data: { id: pmPick!.pmId } }),
    enabled: pmPick != null && pmPick.forId === activeId && !openPmFromHistory && (accountId == null || history.isFetched),
  });
  const openPm = openPmFromHistory ?? openPmFetch.data ?? null;
  const tabCount = (t: TicketTab): number | null => {
    if (t === "equipment") return accountEquip.data?.length ?? null;
    if (t === "schedules") return schedules.length || null;
    if (t === "ping") return comments.data?.length || null;
    return null;
  };
  /** A TLC or Factor visit from Schedules: keep what was typed here, then switch this window to it. */
  function openTicket(nextId: number) {
    if (nextId === activeId) {
      pickTab("ticket");
      return;
    }
    skipToast.current = true;
    formRef.current?.requestSubmit();
    showTicket(nextId);
  }

  const pullBlock = j ? (
    <>
      <SerialPullField
        label="Serial number"
        value={pulledSerial}
        jobId={j.id}
        onValue={() => {}}
      />
      <p className="mt-1 text-xs text-muted-foreground">
        Type a warehouse serial to pull that unit onto this ticket without opening Warehouse.
      </p>
      <div className="mt-3">
        <UnitPlaceField serial={pulledSerial} model={j.equipment} />
      </div>
    </>
  ) : null;

  const form = j ? (
    <form
      ref={formRef}
      key={j.id}
      className="grid gap-3 border-b border-border p-5 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        save.mutate({
          id: j.id,
          customer: String(fd.get("customer") ?? ""),
          contact: String(fd.get("contact") || "") || null,
          phone: String(fd.get("phone") || "") || null,
          equipment: String(fd.get("equipment") || "") || null,
          issue: String(fd.get("issue") || "") || null,
          workDone: String(fd.get("workDone") || "") || null,
          callType: String(fd.get("callType") || "") || null,
          status: String(fd.get("status")),
          technician: String(fd.get("technician") || "") || null,
          secondaryTech: String(fd.get("secondaryTech") || "") || null,
          wo: String(fd.get("wo") || "") || null,
          scheduled: String(fd.get("scheduled") || "") || null,
          received: String(fd.get("received") || "") || null,
          completedAt: String(fd.get("completedAt") || "") || null,
          notes: String(fd.get("notes") || "") || null,
          urgency: String(fd.get("urgency") || "") || "Normal",
        });
      }}
    >
      <BoundCustomer defaultValue={j.customer ?? ""} recordKey={j.id} locked={lockTicketCustomer} />
      {stackedPms.filter((p) => !p.customerMatches).map((p) => (
        <p key={p.pmId} className="text-xs text-warning sm:col-span-2">Customer differs from PM #{p.pmId}</p>
      ))}
      {j.customer ? (
        <div className="sm:col-span-2">
          <ProviderDispatchBlock customer={j.customer} />
        </div>
      ) : null}
      <div className="sm:col-span-2">
        <BoundEquipment defaultValue={j.equipment ?? ""} recordKey={j.id} />
      </div>
      {/* With tabs, pulling a serial from the barn is on the Equipment tab. */}
      {tabbed ? null : <div className="sm:col-span-2">{pullBlock}</div>}
      <div className="sm:col-span-2">
        <Label htmlFor="issue">Issue</Label>
        <AutoGrowTextarea
          id="issue"
          name="issue"
          defaultValue={j.issue ?? ""}
          className="mt-1"
          placeholder="What’s going on…"
        />
      </div>
      <div>
        <Label htmlFor="urgency">Urgency</Label>
        <SelectField id="urgency" name="urgency" className="mt-1" defaultValue={j.urgency || "Normal"}>
          {URGENCIES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </SelectField>
      </div>
      <div className="sm:col-span-2">
        <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Assignment</p>
      </div>
      <div>
        <Label>Technician</Label>
        <TechSelect name="technician" defaultValue={j.technician ?? ""} />
      </div>
      <div>
        <Label htmlFor="job-secondary-tech">Secondary Tech</Label>
        <TechSelect id="job-secondary-tech" name="secondaryTech" defaultValue={j.secondaryTech ?? ""} />
      </div>
      <div>
        <Label>Status</Label>
        <SelectField name="status" className="mt-1" defaultValue={j.status}>
          {CALL_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </SelectField>
      </div>
      <Field label="Scheduled" name="scheduled" type="date" defaultValue={j.scheduled ?? ""} />
      <div>
        <Label>Type</Label>
        <SelectField name="callType" className="mt-1" defaultValue={j.callType ?? ""} allowEmpty>
          {CALL_TYPES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </SelectField>
      </div>
      <Field label="WO #" name="wo" defaultValue={j.wo ?? ""} />
      <Field label="Received" name="received" type="date" defaultValue={j.received ?? ""} />
      <Field label="Contact" name="contact" defaultValue={j.contact ?? ""} />
      <Field label="Phone" name="phone" defaultValue={j.phone ?? ""} />
      <div className="sm:col-span-2">
        <Label htmlFor="workDone">Description of work</Label>
        <AutoGrowTextarea
          id="workDone"
          name="workDone"
          defaultValue={j.workDone ?? ""}
          className="mt-1"
          placeholder="What was done on site…"
        />
      </div>
      <Field
        label="Date completed"
        name="completedAt"
        type="date"
        defaultValue={j.completedAt ?? ""}
      />
      <div className="sm:col-span-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" className="mt-1" defaultValue={j.notes ?? ""} />
      </div>
      <div className="flex items-center justify-between sm:col-span-2">
        <p className="text-xs text-muted-foreground">
          Received {formatLongDate(j.received)}
          {j.ageDays != null ? ` · ${j.ageDays}d open` : ""}
        </p>
        <Button type="submit" size="sm" disabled={save.isPending}>
          Save
        </Button>
      </div>
    </form>
  ) : null;

  return (
    <>
      <Sheet
        open={id != null}
        onOpenChange={(o) => {
          if (!o) {
            skipToast.current = true;
            formRef.current?.requestSubmit();
            onClose();
          }
        }}
      >
        <SheetContent>
          {j ? (
            <>
              {/* Phones: a tighter header so more of the ticket shows under it. */}
              <SheetHeader className="max-sm:py-3">
                <p className="text-xs tracking-wide text-muted-foreground uppercase">
                  {j.kind === "tlc" ? "TLC + Factor" : "Service call"} · {j.callId}
                </p>
                {/* A blank customer reads "Untitled Account" on phones only; sm and up keep the blank title they had. */}
                <SheetTitle>
                  {j.customer?.trim() ? j.customer : j.customer == null ? "Untitled Account" : <span className="sm:hidden">Untitled Account</span>}
                </SheetTitle>
                <div className="mt-2 flex min-h-8 flex-wrap items-center gap-1.5 max-sm:mt-1">
                  <UrgencyBadge urgency={j.urgency} />
                  <StatusBadge status={j.status} />
                  <FlagBadge flag={j.flag} />
                  <DuplicateBadge duplicateOf={j.duplicateOf} siblingCount={j.siblings?.length ?? 0} />
                </div>
                {/* With tabs, the invoice is on the Invoicing tab. */}
                {tabbed ? null : (
                  <div className="mt-2">
                    <InvoiceButton type={j.kind === "tlc" ? "tlc" : "service"} id={j.id} key={`invoice-${j.id}`} />
                    <JobWoHistory jobId={j.id} key={`wo-history-${j.id}`} />
                  </div>
                )}
              </SheetHeader>
              <SheetBody>
                {openPmReminders(j.status, stackedPms).map((p) => (
                  <p key={p.pmId} className="border-b border-border bg-warning/10 px-5 py-2 text-sm" data-testid="pm-still-open">
                    PM #{p.pmId} on this ticket is still open. Complete it on its own sheet.
                  </p>
                ))}
                <SerialNoticeBanner notice={j.serialNotice} />
                <DuplicateBanner
                  job={j}
                  pending={merge.isPending}
                  onOpen={(nextId) => showTicket(nextId)}
                  onMergeIntoThis={(extraId) => merge.mutate({ keeperId: j.id, extraId })}
                  onMergeThisInto={(keeperId) => merge.mutate({ keeperId, extraId: j.id })}
                />
                {tabbed ? (
                  <SheetTabs
                    value={tab}
                    onValueChange={pickTab}
                    tabs={TICKET_TABS.map((t) => ({ ...t, count: tabCount(t.id) }))}
                    label="Ticket sections"
                    testId="ticket"
                  >
                    <Tabs.Content value="ticket" forceMount className={KEEP_MOUNTED} data-testid="ticket-panel-ticket">
                      {form}
                    </Tabs.Content>

                    <Tabs.Content
                      value="equipment"
                      forceMount={keepEquipment || undefined}
                      className={KEEP_MOUNTED}
                      data-testid="ticket-panel-equipment"
                    >
                      <div className="border-b border-border p-5">
                        <AccountEquipmentList rows={accountEquip.data ?? []} loading={accountEquip.isLoading} className="mt-0" />
                      </div>
                      <section className="border-b border-border p-5" data-testid="ticket-pull-from-barn">
                        <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Pull From Barn</h3>
                        <div className="mt-3">{pullBlock}</div>
                      </section>
                      <JobPulledUnits jobId={j.id} />
                      <AccountModules customer={customer} />
                    </Tabs.Content>

                    <Tabs.Content value="invoicing" forceMount className={KEEP_MOUNTED} data-testid="ticket-panel-invoicing">
                      <section className="border-b border-border p-5" data-testid="ticket-invoice">
                        <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Invoice</h3>
                        <p className="mt-1 text-xs text-muted-foreground">Parts, labor, discount, total and billing info for this ticket.</p>
                        <div className="mt-3">
                          <InvoiceButton type={j.kind === "tlc" ? "tlc" : "service"} id={j.id} key={`invoice-${j.id}`} />
                        </div>
                        <JobWoHistory jobId={j.id} key={`wo-history-${j.id}`} />
                      </section>
                      <ChargesPanel jobId={j.id} key={`charges-${j.id}`} />
                      <RepairQuotePanel jobId={j.id} key={`quote-${j.id}`} />
                    </Tabs.Content>

                    <Tabs.Content value="schedules" className="p-5 outline-none" data-testid="ticket-panel-schedules">
                      <TicketPmStack
                        jobId={j.id}
                        stacked={stackedPms}
                        candidates={stackCandidates}
                        canWrite={canStackWrite}
                        onOpenPm={(pmId) => setPmPick({ forId: activeId, pmId })}
                      />
                      <section data-testid="ticket-schedules">
                        <h2 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Pending TLC, Factor & PMs</h2>
                        {directory.isLoading || history.isLoading ? (
                          <Skeleton className="mt-2 h-24 w-full" />
                        ) : accountId == null ? (
                          <p className="mt-2 text-sm text-muted-foreground">{customer} is not on the customer list, so its schedules can’t be shown.</p>
                        ) : schedules.length ? (
                          <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border">
                            {schedules.map((it) => (
                              <HistoryRow
                                key={`schedule-${it.key}`}
                                item={it}
                                onOpen={() => (it.kind === "pm" ? setPmPick({ forId: activeId, pmId: it.id }) : openTicket(it.id))}
                              />
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-sm text-muted-foreground">No open TLCs, Factor visits or PMs on this account.</p>
                        )}
                        <p className="mt-3 text-xs text-muted-foreground">
                          A TLC or Factor visit opens in this window; a PM opens on top.
                        </p>
                      </section>
                    </Tabs.Content>

                    <Tabs.Content value="ping" forceMount className={KEEP_MOUNTED} data-testid="ticket-panel-ping">
                      <Thread entityType={j.kind} entityId={j.id} />
                    </Tabs.Content>
                  </SheetTabs>
                ) : (
                  <>
                    {form}
                    <ChargesPanel jobId={j.id} key={`charges-${j.id}`} />
                    <RepairQuotePanel jobId={j.id} key={`quote-${j.id}`} />
                    <JobPulledUnits jobId={j.id} />
                    <Thread entityType={j.kind} entityId={j.id} />
                  </>
                )}
              </SheetBody>
            </>
          ) : (
            <div className="p-8 text-sm text-muted-foreground">Loading…</div>
          )}
        </SheetContent>
      </Sheet>
      <PmSheet
        pm={openPm}
        onClose={() => setPmPick(null)}
        lockCustomer={!!stackedPms.find((p) => p.pmId === openPm?.id && p.customerMatches)}
      />
    </>
  );
}

/** Eversys modules on the account; each opens its trail, swaps and work log (the module record from Modules). */
function AccountModules({ customer }: { customer: string }) {
  const modules = useQuery({ queryKey: ["modules"], queryFn: () => listModules() });
  const [openId, setOpenId] = useState<number | null>(null);
  const key = customer.trim().toLowerCase();
  const rows = (modules.data ?? []).filter((m) => moduleAccount(m)?.toLowerCase() === key);
  return (
    <section className="p-5" data-testid="ticket-asset-history">
      <p className="flex items-center gap-2 px-1">
        <span className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Asset History</span>
        <span className="text-sm font-medium" data-testid="ticket-module-count">
          {modules.isLoading ? "…" : `${rows.length} module${rows.length === 1 ? "" : "s"}`}
        </span>
      </p>
      {modules.isLoading ? (
        <p className="mt-2 text-sm text-muted-foreground">Loading modules…</p>
      ) : rows.length ? (
        <ul className="mt-2 space-y-2">
          {rows.map((m) => (
            <li key={m.id} className="overflow-hidden rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setOpenId((cur) => (cur === m.id ? null : m.id))}
                aria-expanded={openId === m.id}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/60"
                data-testid="ticket-module-row"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{m.moduleId}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[m.platform, m.moduleType, m.assignedUnitLabel].filter(Boolean).join(" · ") || m.status}
                  </span>
                </span>
                <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", openId === m.id && "rotate-180")} />
              </button>
              {openId === m.id ? (
                <div className="border-t border-border [&>section]:border-b-0">
                  <ModuleRecord row={m} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No modules on this account. Units pulled onto this ticket show above.</p>
      )}
    </section>
  );
}

function DuplicateBanner({
  job,
  pending,
  onOpen,
  onMergeIntoThis,
  onMergeThisInto,
}: {
  job: ServiceJob;
  pending: boolean;
  onOpen: (id: number) => void;
  onMergeIntoThis: (extraId: number) => void;
  onMergeThisInto: (keeperId: number) => void;
}) {
  if (job.duplicateOf) {
    return (
      <div className="border-b border-warning/30 bg-warning/10 px-5 py-3 text-sm">
        <p className="font-medium">This ticket was merged into another call with the same ST#.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          The original keeps the notes, work, and history. Open that ticket to keep working it.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => onOpen(job.duplicateOf!)}>
            Open original
          </Button>
        </div>
      </div>
    );
  }
  if (!job.siblings?.length) return null;
  return (
    <div className="border-b border-warning/30 bg-warning/10 px-5 py-3 text-sm">
      <p className="font-medium">Same ST# is already on another ticket.</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Corrigo uses one work order. Merge if these are the same call, or leave both if they are
        different accounts that reused the number.
      </p>
      <ul className="mt-2 space-y-2">
        {job.siblings.map((s) => (
          <li key={s.id} className="rounded-lg border border-border bg-card px-3 py-2">
            <p className="font-medium">{s.customer || "Untitled"}</p>
            <p className="text-xs text-muted-foreground">
              {s.callId}
              {s.wo ? ` · ${s.wo}` : ""}
              {s.kind === "tlc" ? " · TLC / Factor" : ""}
              {` · ${s.status}`}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => onOpen(s.id)}>
                Open
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => onMergeIntoThis(s.id)}
              >
                Merge into this
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => onMergeThisInto(s.id)}
              >
                Merge this into the other
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
}) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        autoComplete="off"
        className="mt-1"
      />
    </div>
  );
}

function JobPulledUnits({ jobId }: { jobId: number }) {
  const qc = useQueryClient();
  const assets = useQuery({ queryKey: ["assets"], queryFn: () => listAssets() });
  const pulled = (assets.data ?? []).filter((a) => a.jobId === jobId);
  const release = useMutation({
    mutationFn: (assetId: number) => unassignAssetFromService({ data: { assetId } }),
    onSuccess: () => {
      toast.success("Returned to the barn");
      void qc.invalidateQueries({ queryKey: ["assets"] });
      void qc.invalidateQueries({ queryKey: ["jobs"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not return"),
  });
  if (!pulled.length) return null;
  return (
    <div className="border-b border-border bg-muted/40 p-5">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">Pulled from warehouse</p>
      <ul className="mt-2 space-y-1">
        {pulled.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">
              {a.model} · {a.serial ?? "no serial"}
            </span>
            <button
              type="button"
              className="inline-flex h-8 shrink-0 items-center rounded-md px-2 text-xs text-muted-foreground hover:bg-background hover:text-foreground"
              disabled={release.isPending}
              onClick={() => release.mutate(a.id)}
            >
              Return to barn
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NewJobDialog({
  kind,
  open,
  onOpenChange,
  onCreated,
  lockedCustomer,
}: {
  kind: "service" | "tlc";
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: number) => void;
  lockedCustomer?: string | null;
}) {
  const qc = useQueryClient();
  const [customer, setCustomer] = useState(lockedCustomer ?? "");
  const [issue, setIssue] = useState("");
  const [equipment, setEquipment] = useState<string[]>([]);
  const [urgency, setUrgency] = useState("Normal");
  const [technician, setTechnician] = useState("");
  const account = lockedCustomer || customer;
  useEffect(() => {
    if (open && lockedCustomer) setCustomer(lockedCustomer);
  }, [open, lockedCustomer]);
  const create = useMutation({
    mutationFn: () =>
      createJob({
        data: {
          kind,
          customer: account,
          issue,
          urgency,
          technician: technician || undefined,
          equipment: equipment.length ? equipment.join("\n") : undefined,
          received: undefined,
        },
      }),
    onSuccess: (job) => {
      toast.success("Call opened");
      void qc.invalidateQueries({ queryKey: ["jobs"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      onOpenChange(false);
      setCustomer(lockedCustomer ?? "");
      setIssue("");
      setEquipment([]);
      setUrgency("Normal");
      setTechnician("");
      if (job?.id) onCreated(job.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogTitle>New {kind === "tlc" ? "TLC + Factor" : "Service"} Call</DialogTitle>
        <DialogDescription>Opens on today’s clock. Fill the rest in the drawer.</DialogDescription>
        <form
          className="mt-4 space-y-4"
          data-testid="new-call-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (account.trim()) create.mutate();
          }}
        >
          <div className="min-w-0">
            <Label htmlFor="new-cust">Account / customer</Label>
            <div className="mt-1 min-w-0">
              {lockedCustomer ? (
                <LockedCustomer name={lockedCustomer} label="" inputName="" />
              ) : (
                <CustomerCombo
                  label=""
                  name="new-cust"
                  value={customer}
                  onChange={setCustomer}
                  required
                  menuInFlow
                />
              )}
            </div>
          </div>
          {account.trim() ? <ProviderDispatchBlock customer={account} /> : null}
          <div className="min-w-0">
            <EquipmentMultiCombo
              label="Equipment"
              values={equipment}
              onChange={setEquipment}
              placeholder="Search or add a machine…"
              menuInFlow
            />
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Each machine is its own chip above the search.
            </p>
          </div>
          <div>
            <Label htmlFor="new-issue">Issue</Label>
            <AutoGrowTextarea
              id="new-issue"
              className="mt-1"
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              placeholder="What’s going on…"
            />
          </div>
          <div>
            <Label htmlFor="new-urgency">Urgency</Label>
            <SelectField
              id="new-urgency"
              className="mt-1"
              value={urgency}
              onChange={(e) => setUrgency(e.target.value)}
            >
              {URGENCIES.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </SelectField>
          </div>
          <div>
            <Label htmlFor="new-tech">Technician</Label>
            <TechSelect
              id="new-tech"
              value={technician}
              onChange={(e) => setTechnician(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={create.isPending || !account.trim()}>
              Open call
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BoundCustomer({
  recordKey,
  defaultValue,
  locked,
}: {
  recordKey: number;
  defaultValue: string;
  locked?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  useEffect(() => {
    setValue(defaultValue);
  }, [recordKey, defaultValue]);
  return (
    <div>
      {locked ? <LockedCustomer name={defaultValue || "—"} /> : <CustomerCombo name="customer" value={value} onChange={setValue} menuInFlow />}
      <CustomerAddress customer={locked ? defaultValue : value} />
    </div>
  );
}

function BoundEquipment({
  recordKey,
  defaultValue,
}: {
  recordKey: number;
  defaultValue: string;
}) {
  const dir = useDirectory("equipment");
  const catalog = dir.items.map((i) => i.name);
  const catalogKey = catalog.join("\n");
  const [values, setValues] = useState(() =>
    catalog.length ? listedEquipment(defaultValue, catalog) : defaultValue.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
  );
  useEffect(() => {
    setValues(
      catalog.length
        ? listedEquipment(defaultValue, catalog)
        : defaultValue.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
    );
  }, [recordKey, defaultValue, catalogKey]);
  return (
    <EquipmentMultiCombo
      name="equipment"
      values={values}
      onChange={setValues}
      placeholder="Add one or more machines…"
      menuInFlow
    />
  );
}
