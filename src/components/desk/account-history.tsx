import { useQuery } from "@tanstack/react-query";
import { listAccountEquipment } from "@/lib/ops/account-equip-import";
import { detectBoard } from "@/lib/ops/corrigo";
import { isOpenCall, isOpenPm } from "@/lib/ops/ticket-status";
import { formatShortDate, money } from "@/lib/ops/clock";
import type { ClockFlag } from "@/lib/ops/clock";
import type { Deal, Install, PmJob, ServiceJob } from "@/lib/ops/types";
import { FlagBadge, StatusBadge, UrgencyBadge } from "./flag-badge";
import { UnitPlaceField } from "./unit-place-field";

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
    subtitle: [j.wo, j.issue].filter(Boolean).join(" · "),
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
    subtitle: p.equipment ?? "",
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
    subtitle: i.equipment ?? "",
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
    subtitle: [d.producer, d.amount != null ? money(d.amount) : null].filter(Boolean).join(" · "),
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

/** The account's imported equipment (one query, shared by the account window and the ticket window). */
export function useAccountEquipment(customer: string | null | undefined) {
  return useQuery({
    queryKey: ["account-equipment", customer],
    queryFn: () => listAccountEquipment({ data: { customer: customer! } }),
    enabled: !!customer,
  });
}

export function AccountEquipmentList({
  rows,
  loading,
  className = "mt-4",
}: {
  rows: {
    catalogModel: string;
    equipmentName: string;
    serial: string | null;
    installDate: string | null;
    ownership: string | null;
  }[];
  loading: boolean;
  className?: string;
}) {
  // The Equipment tab is the category, so the list shows as soon as the tab opens.
  return (
    <section className={className} data-testid="account-equipment" data-open="true">
      <p className="flex items-center gap-2 px-1">
        <span className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Equipment On This Account</span>
        <span className="text-sm font-medium" data-testid="account-equipment-count">
          {loading ? "…" : `${rows.length} unit${rows.length === 1 ? "" : "s"}`}
        </span>
      </p>
      {loading ? (
        <p className="mt-2 text-sm text-muted-foreground">Loading equipment…</p>
      ) : rows.length ? (
        <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border">
          {rows.map((row, i) => (
            <li key={`${row.catalogModel}-${row.serial ?? "none"}-${i}`} className="px-3 py-2.5">
              <p className="font-medium">{row.equipmentName || row.catalogModel}</p>
              <p className="text-xs text-muted-foreground">
                {[
                  row.catalogModel && row.catalogModel !== row.equipmentName ? row.catalogModel : null,
                  row.serial ? `SN ${row.serial}` : null,
                  row.ownership,
                  row.installDate ? `Installed ${formatShortDate(row.installDate)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {row.serial ? (
                <div className="mt-2">
                  <UnitPlaceField serial={row.serial} model={row.equipmentName || row.catalogModel} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No imported equipment on this account yet.</p>
      )}
    </section>
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
          <span className="block text-xs text-muted-foreground">
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
