import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { poCardLine, saleRefLine } from "@/lib/ops/ticket-po";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { canAddEquipmentTo, canMergeUnits } from "@/lib/ops/account-equip";
import {
  getUnitLinkCounts,
  listAccountEquipment,
  listRetiredEquipment,
  mergeAccountEquipment,
  removeAccountEquipment,
  restoreAccountEquipment,
} from "@/lib/ops/account-equip-import";
import { MachineLink } from "./machine-link";
import type { RetiredUnit } from "@/lib/ops/account-equip-retire";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { detectBoard } from "@/lib/ops/corrigo";
import { isOpenCall, isOpenPm } from "@/lib/ops/ticket-status";
import { formatLongDate, formatShortDate, money } from "@/lib/ops/clock";
import type { ClockFlag } from "@/lib/ops/clock";
import type { Deal, Install, PmJob, ServiceJob } from "@/lib/ops/types";
import { FlagBadge, StatusBadge, UrgencyBadge } from "./flag-badge";
import { LockBadge, LockToggle } from "./lock-badge";
import { AccountUnitForm } from "./account-unit-form";
import { getMyAccess } from "@/lib/ops/access";
import { isDeskAdmin } from "@/lib/ops/admin-role";

/**
 * Pieces of the account window that the ticket window shows too: the account's equipment list, one history row,
 * and the account's open TLC / Factor visits and PMs. One version, used by both windows.
 */

export type HistoryKind = "service" | "tlc" | "pm" | "install" | "deal" | "recipe";

export type HistoryItem = {
  key: string;
  kind: HistoryKind;
  id: number;
  title: string;
  subtitle: string;
  status: string | null;
  date: string | null;
  technician: string | null;
  equipment: string | null;
  flag: ClockFlag | null;
  urgency?: string;
};

const KIND_LABEL: Record<HistoryKind, string> = {
  service: "Service",
  tlc: "TLC",
  pm: "PM",
  install: "Install",
  deal: "Pipeline",
  recipe: "Recipe",
};

export function jobItem(j: ServiceJob): HistoryItem {
  return {
    key: `${j.kind}-${j.id}`,
    kind: j.kind,
    id: j.id,
    title: j.callId,
    // Its P.O.s too (11/2), so an account's tickets, PMs, installs and deals can be matched up by them.
    subtitle: [j.wo, j.issue, poCardLine(j)].filter(Boolean).join(" · "),
    status: j.status,
    date: j.received ?? j.scheduled,
    technician: j.technician,
    equipment: j.equipment,
    flag: j.flag,
    urgency: j.urgency,
  };
}

export function pmItem(p: PmJob): HistoryItem {
  return {
    key: `pm-${p.id}`,
    kind: "pm",
    id: p.id,
    title: p.style || "Preventative maintenance",
    subtitle: [p.equipment, poCardLine(p)].filter(Boolean).join(" · "),
    status: p.status,
    date: p.projected ?? p.received,
    technician: p.technician,
    equipment: p.equipment,
    flag: p.flag,
  };
}

export function installItem(i: Install): HistoryItem {
  return {
    key: `install-${i.id}`,
    kind: "install",
    id: i.id,
    title: i.wo || "Install",
    // Its sale too, from the deal it came from (11/3), so it matches up with the deal's row.
    subtitle: [i.equipment, poCardLine(i), saleRefLine(i.sale)].filter(Boolean).join(" · "),
    status: i.equipStatus,
    date: i.installDate ?? i.received,
    technician: i.technician,
    equipment: i.equipment,
    flag: i.flag,
  };
}

export function dealItem(d: Deal): HistoryItem {
  return {
    key: `deal-${d.id}`,
    kind: "deal",
    id: d.id,
    title: d.equipment || "Deal",
    subtitle: [d.producer, d.amount != null ? money(d.amount) : null, poCardLine(d)].filter(Boolean).join(" · "),
    status: d.completion,
    date: d.dateOfDeal,
    technician: d.producer,
    equipment: d.equipment,
    flag: null,
  };
}

export function stamp(iso: string | null): number {
  if (!iso) return 0;
  const t = Date.parse(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
  return Number.isFinite(t) ? t : 0;
}

const newestFirst = (a: HistoryItem, b: HistoryItem) => stamp(b.date) - stamp(a.date) || b.id - a.id;

/**
 * The account's open TLCs, then its open PMs, newest first — the account window's "Pending TLC & PMs".
 * With `factorTickets`, open service tickets that read as TLC or Factor work (the same words the TLC & Factors
 * export and the Corrigo import go by) join the TLC list, so a Factor visit logged as a service call still shows.
 */
export function pendingSchedules(
  data: { jobs: ServiceJob[]; pms: PmJob[] } | null | undefined,
  opts: { factorTickets?: boolean } = {},
): HistoryItem[] {
  if (!data) return [];
  const visits = data.jobs
    .filter(
      (j) =>
        isOpenCall(j) &&
        (j.kind === "tlc" ||
          (!!opts.factorTickets && detectBoard({ issue: j.issue, callType: j.callType }) === "tlc")),
    )
    .map(jobItem)
    .sort(newestFirst);
  const pms = data.pms.filter((p) => isOpenPm(p)).map(pmItem).sort(newestFirst);
  return [...visits, ...pms];
}

/**
 * The account's imported equipment (one query, shared by the account window and the ticket window). The account window
 * sends its id too, so its list reads by id once the Accounts switch is on (phase C5, Link Check).
 */
export function useAccountEquipment(customer: string | null | undefined, customerId?: number | null) {
  return useQuery({
    queryKey: ["account-equipment", customer, customerId ?? null],
    queryFn: () => listAccountEquipment({ data: { customer: customer!, ...(customerId != null ? { customerId } : {}) } }),
    enabled: !!customer,
  });
}

/**
 * Equipment On This Account, in the account window and the ticket window. These units are at the account, or are
 * assigned to go there, so no location is picked here: a unit only moves when it comes back to the Katz HQ barn
 * (Chuy, 10/27). Add equipment puts a machine on it, and Edit changes a unit's Part #, ownership and install date
 * (Chuy, 11/9).
 */
export function AccountEquipmentList({
  customer,
  customerId,
  rows,
  loading,
  className = "mt-4",
}: {
  /** The account's name. Without one there's nothing to add equipment to. */
  customer?: string | null;
  /** The account's id, from the account window: its retired list reads by id once the Accounts switch is on. */
  customerId?: number | null;
  rows: {
    id?: number;
    catalogModel: string;
    equipmentName: string;
    serial: string | null;
    installDate: string | null;
    ownership: string | null;
    /** Typed from the data plate or NetSuite, to tell variants of one model apart. */
    partNumber?: string | null;
    /** Excellent, Good, Fair or Poor, from the verified units list (11/12). */
    condition?: string | null;
    /** What Edit sends back, so a window opened before another save can't save over it. */
    seen?: string;
    /** Locked by the owner: Remove and Merge are off until it is unlocked. */
    lockedBy?: string | null;
    /** Its machine (M1): a link to the Machine page. */
    machineId?: number | null;
  }[];
  loading: boolean;
  className?: string;
}) {
  const qc = useQueryClient();
  // The form open: "add", or the id of the unit being edited.
  const [open, setOpen] = useState<"add" | number | null>(null);
  // Removing a unit is an Admin's (11/19); the server refuses anyone else too.
  const me = useQuery({ queryKey: ["access", "me"], queryFn: () => getMyAccess() });
  const canRemove = isDeskAdmin(me.data);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["account-equipment"] });
    void qc.invalidateQueries({ queryKey: ["account-equipment-retired"] });
    // Remove, Put back and Merge move a unit's ticket links (11/21).
    void qc.invalidateQueries({ queryKey: ["ticket-units"] });
    void qc.invalidateQueries({ queryKey: ["unit-service-history"] });
    void qc.invalidateQueries({ queryKey: ["inspection"] });
    void qc.invalidateQueries({ queryKey: ["installs"] });
  };
  const remove = useMutation({
    mutationFn: (id: number) => removeAccountEquipment({ data: { id } }),
    onSuccess: () => {
      toast.success("Moved to this account's Retired list");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove"),
  });
  // The pair the Merge dialog is asking about: `keep` stays, `drop` goes to Retired.
  const [asking, setAsking] = useState<{ keep: UnitRow; drop: UnitRow } | null>(null);
  const merge = useMutation({
    mutationFn: (d: { keepId: number; dropId: number }) => mergeAccountEquipment({ data: d }),
    onSuccess: () => {
      toast.success("Merged into one unit");
      setAsking(null);
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not merge"),
  });
  // Merge is only for a true duplicate (11/19): the same rule the server checks.
  const asMerge = (r: UnitRow) => ({ customer: customer ?? "", catalogModel: r.catalogModel, equipmentName: r.equipmentName, serial: r.serial, lockedBy: r.lockedBy });
  return (
    <section className={className} data-testid="account-equipment" data-open="true">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="flex items-center gap-2">
          <span className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Equipment On This Account</span>
          <span className="text-sm font-medium" data-testid="account-equipment-count">
            {loading ? "…" : `${rows.length} unit${rows.length === 1 ? "" : "s"}`}
          </span>
        </p>
        {canAddEquipmentTo(customer) ? (
          <Button type="button" size="sm" variant="outline" className="max-sm:h-10" disabled={open === "add"} data-testid="account-equipment-add" onClick={() => setOpen("add")}>
            Add equipment
          </Button>
        ) : null}
      </div>
      {customer && canAddEquipmentTo(customer) && open === "add" ? (
        <div className="mt-2">
          <AccountUnitForm customer={customer} onDone={() => setOpen(null)} />
        </div>
      ) : null}
      {loading ? (
        <p className="mt-2 text-sm text-muted-foreground">Loading equipment…</p>
      ) : rows.length ? (
        <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border">
          {rows.map((row, i) => {
            // Merge is offered to an Admin, only where the two rows are one machine (same model, serials that match or
            // where one is blank or a short leftover, neither locked). Two different full serials never get the button.
            const twins = rows.filter((other, j) => j !== i && other.id && row.id && canRemove && canMergeUnits(asMerge(other), asMerge(row)));
            return (
              // Keyed by the unit, not its place on the list: a row removed above an open Edit must not rebuild it.
              <li key={row.id ? `unit-${row.id}` : `${row.catalogModel}-${row.serial ?? "none"}-${i}`} className="px-3 py-2.5">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {row.equipmentName || row.catalogModel}
                  <LockBadge lockedBy={row.lockedBy} />
                </p>
                <p className="text-xs text-muted-foreground">
                  {[
                    row.catalogModel && row.catalogModel !== row.equipmentName ? row.catalogModel : null,
                    row.partNumber ? `Part # ${row.partNumber}` : null,
                    row.serial ? `SN ${row.serial}` : "No serial",
                    row.ownership,
                    row.installDate ? `Installed ${formatLongDate(row.installDate)}` : null,
                    row.condition ? `Condition ${row.condition}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  {row.machineId ? (
                    <>
                      {" · "}
                      <MachineLink machineId={row.machineId} />
                    </>
                  ) : null}
                </p>
                {row.id ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {twins.map((twin) => (
                      <Button
                        key={twin.id}
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={merge.isPending}
                        title={`Merge this into ${twin.serial ? `SN ${twin.serial}` : "the unit with no serial"}`}
                        data-testid="merge-account-unit"
                        onClick={() => setAsking({ keep: twin, drop: row })}
                      >
                        Merge duplicate
                      </Button>
                    ))}
                    {canRemove ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={remove.isPending || !!row.lockedBy}
                      title={row.lockedBy ? `Locked by ${row.lockedBy}` : undefined}
                      data-testid="remove-account-unit"
                      onClick={() => {
                        const what = `${row.equipmentName || row.catalogModel}${row.serial ? ` SN ${row.serial}` : ""}`;
                        if (window.confirm(`Remove ${what} from this account?\n\nIt moves to this account's Retired list, with its record, and can be put back.`)) {
                          remove.mutate(row.id!);
                        }
                      }}
                    >
                      Remove
                    </Button>
                    ) : null}
                    {customer ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={!!row.lockedBy}
                        title={row.lockedBy ? `Locked by ${row.lockedBy}` : undefined}
                        data-testid="edit-account-unit"
                        onClick={() => setOpen(open === row.id ? null : row.id!)}
                      >
                        Edit
                      </Button>
                    ) : null}
                    <LockToggle kind="unit" id={row.id} locked={!!row.lockedBy} onDone={refresh} />
                  </div>
                ) : null}
                {customer && row.id && open === row.id && !row.lockedBy ? (
                  <div className="mt-2">
                    <AccountUnitForm customer={customer} unit={{ ...row, id: row.id }} onDone={() => setOpen(null)} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No imported equipment on this account yet.</p>
      )}
      {customer ? <RetiredUnits customer={customer} customerId={customerId ?? null} onChanged={refresh} /> : null}
      {asking ? (
        <MergeDialog
          keep={asking.keep}
          drop={asking.drop}
          busy={merge.isPending}
          onCancel={() => setAsking(null)}
          onMerge={() => merge.mutate({ keepId: asking.keep.id!, dropId: asking.drop.id! })}
        />
      ) : null}
    </section>
  );
}

export type UnitRow = {
  id?: number;
  catalogModel: string;
  equipmentName: string;
  serial: string | null;
  installDate: string | null;
  ownership: string | null;
  partNumber?: string | null;
  condition?: string | null;
  lockedBy?: string | null;
};

/** Merge, asked in the app's dialog (11/19): both units side by side, and which one stays. */
export function MergeDialog({
  keep,
  drop,
  busy,
  onCancel,
  onMerge,
  onSwap,
}: {
  keep: UnitRow;
  drop: UnitRow;
  busy: boolean;
  onCancel: () => void;
  onMerge: () => void;
  /** Offer "Keep the other one" (the duplicate list, 11/23). */
  onSwap?: () => void;
}) {
  const counts = useQuery({
    queryKey: ["unit-link-counts", keep.id, drop.id],
    queryFn: () => getUnitLinkCounts({ data: { ids: [keep.id!, drop.id!] } }),
  });
  const side = (r: UnitRow, label: string, stays: boolean) => {
    const c = counts.data?.[r.id!];
    const lines: [string, string][] = [
      ["Model", r.catalogModel],
      ["Serial", r.serial || "None"],
      ["Part #", r.partNumber || "—"],
      ["Condition", r.condition || "—"],
      ["Install date", r.installDate ? formatLongDate(r.installDate) : "—"],
      ["Tickets", c ? String(c.tickets) : "…"],
      ["Installs", c ? String(c.installs) : "…"],
      ["PMs", c ? String(c.pms) : "…"],
    ];
    return (
      <div className={`min-w-0 rounded-lg border p-2.5 ${stays ? "border-primary/50" : "border-border"}`} data-testid={stays ? "merge-keep" : "merge-drop"}>
        <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
        <p className="mt-1 font-medium break-words">{r.equipmentName || r.catalogModel}</p>
        <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-xs">
          {lines.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="break-words">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  };
  return (
    <Dialog open onOpenChange={(o) => (o ? null : onCancel())}>
      <DialogContent className="p-4 sm:max-w-xl" data-testid="merge-confirm">
        <DialogTitle>Merge duplicate?</DialogTitle>
        <DialogDescription className="mt-1 text-sm">
          These read as one machine. The unit on the left stays; the one on the right goes to this account's Retired list, where Put back can return it.
        </DialogDescription>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {side(keep, "Stays", true)}
          {side(drop, "Goes to Retired", false)}
        </div>
        {(keep.serial ?? "").replace(/[\s#]/g, "").length <= 2 && (drop.serial ?? "").replace(/[\s#]/g, "").length > (keep.serial ?? "").replace(/[\s#]/g, "").length ? (
          <p className="mt-2 text-xs font-medium" data-testid="merge-takes-serial">
            The unit that stays takes SN {drop.serial}, the full serial.
          </p>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">
          Its installs, pre-inspection checks and PM links move to the unit that stays. Tickets count the ones on this account that name the serial.
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          {onSwap ? (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onSwap} data-testid="merge-swap">
              Keep the other one
            </Button>
          ) : null}
          <Button type="button" size="sm" disabled={busy} onClick={onMerge} data-testid="merge-confirm-yes">
            {busy ? "Merging…" : "Merge duplicate"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Put back, asked in the app's dialog first (11/19). A merged unit's says what the merge moved stays where it went. */
function PutBackDialog({ unit, busy, onCancel, onPutBack }: { unit: RetiredUnit; busy: boolean; onCancel: () => void; onPutBack: () => void }) {
  const what = `${unit.equipmentName || unit.catalogModel}${unit.serial ? ` SN ${unit.serial}` : ""}`;
  return (
    <Dialog open onOpenChange={(o) => (o ? null : onCancel())}>
      <DialogContent className="p-4" data-testid="put-back-confirm">
        <DialogTitle>Put back {what}?</DialogTitle>
        <DialogDescription className="mt-2 text-sm">
          {unit.mergedInto
            ? `It was merged into ${unit.mergedSerial ? `SN ${unit.mergedSerial}` : "the unit with no serial"}. It comes back on this account as its own unit; the installs, checks and PM links the merge moved stay on the kept unit.`
            : "It comes back on this account with its record, and on the open installs it was taken off."}
        </DialogDescription>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={busy} onClick={onPutBack} data-testid="put-back-confirm-yes">
            {busy ? "Putting back…" : "Put back"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Machines taken off this account (11/9): each keeps its record and can be put back. Shown only when there are any.
 */
function RetiredUnits({ customer, customerId, onChanged }: { customer: string; customerId: number | null; onChanged: () => void }) {
  const retired = useQuery({
    queryKey: ["account-equipment-retired", customer.toLowerCase(), customerId],
    queryFn: () => listRetiredEquipment({ data: { customer, ...(customerId != null ? { customerId } : {}) } }),
  });
  const [asking, setAsking] = useState<RetiredUnit | null>(null);
  const putBack = useMutation({
    mutationFn: (id: number) => restoreAccountEquipment({ data: { id } }),
    onSuccess: () => {
      toast.success("Back on this account");
      setAsking(null);
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not put it back"),
  });
  const rows = retired.data ?? [];
  if (!rows.length) return null;
  return (
    <details className="mt-3 rounded-xl border border-border bg-card" data-testid="account-equipment-retired">
      <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium max-sm:py-3">
        Retired <span className="text-muted-foreground">· {rows.length}</span>
      </summary>
      <ul className="divide-y divide-border border-t border-border">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5" data-testid="retired-unit">
            <span className="min-w-0">
              <span className="block font-medium">{r.equipmentName || r.catalogModel}</span>
              <span className="block text-xs text-muted-foreground [overflow-wrap:anywhere]">
                {[
                  r.partNumber ? `Part # ${r.partNumber}` : null,
                  r.serial ? `SN ${r.serial}` : "No serial",
                  r.movedNote ?? `${r.reason ?? "Removed"} ${formatShortDate(r.retiredAt)}${r.retiredName ? ` by ${r.retiredName}` : ""}`,
                  r.records ? `${r.records} inspection or PM record${r.records === 1 ? "" : "s"} kept` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                {r.machineId ? (
                  <>
                    {" · "}
                    <MachineLink machineId={r.machineId} />
                  </>
                ) : null}
              </span>
            </span>
            <Button type="button" size="sm" variant="outline" className="max-sm:h-10" disabled={putBack.isPending} data-testid="put-back-unit" onClick={() => setAsking(r)}>
              Put back
            </Button>
          </li>
        ))}
      </ul>
      {asking ? <PutBackDialog unit={asking} busy={putBack.isPending} onCancel={() => setAsking(null)} onPutBack={() => putBack.mutate(asking.id)} /> : null}
    </details>
  );
}

/**
 * One history row. From sm up: kind | title + subtitle | badges. On a phone the kind label and the badges share the
 * top line and the title and subtitle get the full width under them, so ticket numbers do not break mid-ID.
 */
export function HistoryRow({ item, onOpen }: { item: HistoryItem; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="desk-flat flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-muted/60 max-sm:flex-wrap max-sm:items-center max-sm:gap-x-2 max-sm:gap-y-1"
      >
        <span className="mt-0.5 w-16 shrink-0 text-[11px] font-medium tracking-wide text-muted-foreground uppercase max-sm:mt-0 max-sm:w-auto max-sm:flex-1">
          {KIND_LABEL[item.kind]}
        </span>
        <span className="min-w-0 flex-1 max-sm:order-last max-sm:basis-full">
          <span className="block font-medium">{item.title}</span>
          {/* A long P.O. with no spaces wraps instead of pushing the row wider than a phone. */}
          <span className="block text-xs text-muted-foreground [overflow-wrap:anywhere]">
            {[item.subtitle, formatShortDate(item.date), item.technician].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1 max-sm:min-w-0 max-sm:shrink max-sm:flex-row max-sm:flex-wrap max-sm:items-center max-sm:justify-end">
          {item.urgency ? <UrgencyBadge urgency={item.urgency} /> : null}
          <StatusBadge status={item.status} />
          <FlagBadge flag={item.flag} />
        </span>
      </button>
    </li>
  );
}
