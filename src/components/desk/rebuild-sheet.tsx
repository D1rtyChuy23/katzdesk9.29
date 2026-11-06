import { useEffect, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { InvoiceButton } from "@/components/desk/invoice-window";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listComments } from "@/lib/ops/api";
import {
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
import { CustomerCombo } from "./directory-fields";
import { OwnerSelect } from "./owner-select";
import { StatusBadge } from "./flag-badge";
import { Thread } from "./thread";
import { PingButton } from "./ping-button";
import { RepairQuotePanel } from "./repair-quote-panel";
import { costGlance, money } from "@/lib/ops/repair-quote";
import { RebuildMachines } from "./rebuild-machines";
import { RebuildLinkField } from "./rebuild-link-field";
import { useRebuildLink } from "./rebuild-link-query";
import { billName, lineCount, projectLabel } from "@/lib/ops/rebuild-link";
import { normalizeCustomerKey } from "@/lib/ops/customer-key";
import { toast } from "sonner";
import { formatShortDate } from "@/lib/ops/clock";
import { isShopAccount, sentence, warehouseInvoiceRefusal, warehouseMayEdit } from "@/lib/ops/warehouse-invoice";
import { Trash2 } from "lucide-react";
import { holdSavedPo, useSyncedPo } from "./po-form";
import { PO_MAX } from "@/lib/ops/ticket-po";

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
  // The P.O.s (11/2) follow the rebuild on their own, so one set in the Invoice window never resets the rest of the form.
  const po = useSyncedPo(row?.po, row?.id ?? null);
  const vendorPo = useSyncedPo(row?.vendorPo, row?.id ?? null);

  // The form starts over only when the rebuild's own fields change on the server, not when the list refreshes for
  // something else on the row (its invoice or quote), so unsaved edits stay put.
  const formKey = row
    ? JSON.stringify([
        row.id,
        row.title,
        row.account,
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

  // What it is linked to (11/6): a ticket or an install it bills on, found by WO.
  const link = useRebuildLink(row?.id ?? 0, !!row);

  const save = useMutation({
    mutationFn: () =>
      updateRebuild({
        data: {
          id: row!.id,
          title,
          account,
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
          // Each P.O. only when it was changed here.
          ...(po.toSend() !== undefined ? { po: po.toSend() } : {}),
          ...(vendorPo.toSend() !== undefined ? { vendorPo: vendorPo.toSend() } : {}),
        },
      }),
    onSuccess: (next) => {
      // The P.O.s as saved, at once, so the boxes take them before the board reads again.
      holdSavedPo(qc, "rebuild", next);
      // A refurb completed: its machines went into stock at the Staging area.
      toast.success(next.stockNote ? `Rebuild saved. ${next.stockNote}` : "Rebuild saved");
      if (next.stockNote) void qc.invalidateQueries({ queryKey: ["assets"] });
      void qc.invalidateQueries({ queryKey: ["rebuilds"] });
      void qc.invalidateQueries({ queryKey: ["repair-quote"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["activity"] });
      // Its Customer P.O. shows on its invoice and the account's Invoices tab too.
      void qc.invalidateQueries({ queryKey: ["invoice"] });
      void qc.invalidateQueries({ queryKey: ["account-invoices"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  /**
   * The Invoice window: a P.O. changed here and not saved yet is saved first (only the P.O.s, 11/2), so the window opens
   * on the rebuild's own and a P.O. approved there isn't put back by this sheet's next Save.
   */
  const savePoBeforeInvoice = async (): Promise<boolean> => {
    if (!row || !canEdit) return true;
    const changed = {
      ...(po.toSend() !== undefined ? { po: po.toSend() } : {}),
      ...(vendorPo.toSend() !== undefined ? { vendorPo: vendorPo.toSend() } : {}),
    };
    if (!Object.keys(changed).length) return true;
    try {
      const saved = await updateRebuild({ data: { id: row.id, ...changed } });
      holdSavedPo(qc, "rebuild", saved);
      void qc.invalidateQueries({ queryKey: ["rebuilds"] });
      void qc.invalidateQueries({ queryKey: ["account-invoices"] });
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the P.O.");
      return false;
    }
  };

  /** Changes on Details not saved yet: Link and Unlink save them first, so the form starting over loses nothing. */
  const dirty =
    !!row &&
    (title !== row.title ||
      account !== row.account ||
      owner !== (row.owner ?? "") ||
      status !== row.status ||
      reasonCode !== (row.reasonCode ?? "") ||
      reasonDetail !== (row.reasonDetail ?? "") ||
      plannedStart !== (row.plannedStart ?? "") ||
      targetComplete !== (row.targetComplete ?? "") ||
      actualStart !== (row.actualStart ?? "") ||
      actualComplete !== (row.actualComplete ?? "") ||
      priority !== row.priority ||
      notes !== (row.notes ?? "") ||
      po.toSend() !== undefined ||
      vendorPo.toSend() !== undefined);
  const saveFirst = async (): Promise<boolean> => {
    try {
      await save.mutateAsync();
      return true;
    } catch {
      // The save's own error toast says why.
      return false;
    }
  };

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
  const linked = link.data?.id === row.id ? link.data.current : null;
  const linkedTo = row.installId != null || row.jobId != null ? (linked ? projectLabel(linked) : row.installId != null ? `install #${row.installId}` : "its ticket") : null;

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
              ) : linkedTo ? (
                // Linked to a ticket or an install (11/6), it bills there: its account is that project's.
                <div data-testid="rebuild-account-linked">
                  <Label>Account</Label>
                  <p className="mt-1 text-sm font-medium" data-testid="rebuild-account">
                    {account}
                  </p>
                  {/* The project's account changed since the link (its customer was edited): take it again. */}
                  {!locked && linked && normalizeCustomerKey(linked.customer) !== normalizeCustomerKey(account) && linked.customer ? (
                    <button
                      type="button"
                      className="mt-1 text-xs text-primary underline-offset-2 hover:underline max-sm:mt-2 max-sm:inline-flex max-sm:min-h-10 max-sm:items-center max-sm:text-sm"
                      onClick={() => setAccount(linked.customer)}
                      data-testid="rebuild-account-follow"
                    >
                      Use {linked.customer}
                    </button>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">Follows {linkedTo}. Unlink it below to change the account.</p>
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
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="rb-po">Customer P.O.</Label>
                  <Input id="rb-po" className="mt-1" value={po.value} maxLength={PO_MAX} autoComplete="off" onChange={(e) => po.set(e.target.value)} disabled={locked} data-testid="po-customer" />
                  <p className="mt-1 text-xs text-muted-foreground">Goes on the invoice.</p>
                </div>
                <div>
                  <Label htmlFor="rb-vendor-po">Vendor P.O.</Label>
                  <Input id="rb-vendor-po" className="mt-1" value={vendorPo.value} maxLength={PO_MAX} autoComplete="off" onChange={(e) => vendorPo.set(e.target.value)} disabled={locked} data-testid="po-vendor" />
                  <p className="mt-1 text-xs text-muted-foreground">A vendor&apos;s P.O. number, for reference only.</p>
                </div>
              </div>
              <RebuildLinkField row={row} canEdit={canEdit} dirty={dirty} saveFirst={saveFirst} key={`link-${row.id}`} />
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
              <RebuildMachines row={row} canEdit={!locked} warehouse={!!accountLock} key={`machines-${row.id}`} />
            </Tabs.Content>
            <Tabs.Content value="invoices" forceMount className={KEEP_MOUNTED} data-testid="rebuild-panel-invoices">
              <section className="border-b border-border p-5">
                <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Invoice</h3>
                <p className="mt-1 text-xs text-muted-foreground" data-testid="rebuild-invoice-note">
                  {linked
                    ? `It bills on ${projectLabel(linked)}: its parts and labor go on ${billName(linked)}${link.data?.refusal ? "." : linked.lines > 0 ? ` (${lineCount(linked.lines)}, ${money(linked.total)} now).` : "."}`
                    : accountLock && warehouseMayEdit(row.account)
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
                    <InvoiceButton type="rebuild" id={row.id} key={`invoice-rebuild-${row.id}`} beforeOpen={savePoBeforeInvoice} />
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
    </>
  );
}
