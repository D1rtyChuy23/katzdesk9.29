/**
 * NetSuite's billing on installs and PMs (Grok's request through Chuy, 11/5): what Billing Backfill (NetSuite) brought
 * back onto them, read-only. Their Invoices tab and the Invoices page read it; only the Backfill writes it.
 *
 * - What KatzDesk bills an install or a PM stays in its own invoice (the Invoice window). Its "charges" for the checks
 *   are that invoice's lines after its discount when it has any; otherwise NetSuite's lines the Backfill brought back
 *   (after NetSuite's header discount). No tax on either.
 * - Live invoices (not Voided) are what NetSuite billed. A mismatch is live invoices ≠ charges; a possible double bill
 *   is two or more live invoices over the charges, as on tickets. A record with neither kind of lines has nothing to
 *   check against: no mismatch, no double bill.
 * - A PM stacked on a ticket bills on that ticket: its billing is the ticket's, so it isn't listed here.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware, salesRepScope } from "@/lib/ops/access";
import { loadKatzDeskInvoiceNets, loadRecordNsBilling, type RecordNsInvoice } from "@/lib/ops/billing-backfill-api";
import { locationWarning } from "@/lib/ops/billing-rules";
import type { TicketBillingRow } from "@/lib/ops/billing-report";
import { summarizeBilling, type BillingSummary } from "@/lib/ops/ticket-billing-api";
import { isInstalled } from "@/lib/ops/install-status";
import { accountRepOf } from "@/lib/ops/reps";
import type { Discount } from "@/lib/ops/discount";

type Q = Pick<Sql, "query">;

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}

export type RecordType = "install" | "pm";

/** One WO's NetSuite billing on the record, as the panel shows it. */
export type RecordNsGroup = {
  wo: string;
  /** woMatchKey of the WO. */
  woKey: string;
  so: string | null;
  billedOn: string | null;
  discount: Discount | null;
  lines: { item: string; description: string; qty: number; rate: number }[];
  subtotal: number;
  off: number;
  net: number;
};

/** An install's or a PM's billing: NetSuite's (from the Backfill) beside its own invoice in KatzDesk. */
export type RecordBilling = BillingSummary & {
  /** NetSuite's lines and Sales Order per WO. */
  groups: RecordNsGroup[];
  invoiceRows: (Omit<RecordNsInvoice, "record"> & { wo: string | null })[];
  /** Its own invoice in KatzDesk (the Invoice window), when it has lines. */
  katzdesk: { lines: number; net: number } | null;
  /** Where the charges the checks use come from. */
  chargeSource: "katzdesk" | "netsuite" | "none";
};

/** Each record's billing, by "install:12" / "pm:7". */
export async function loadRecordBillings(sql: Q, installIds: number[], pmIds: number[]): Promise<Map<string, RecordBilling>> {
  const [ns, own] = await Promise.all([loadRecordNsBilling(sql, installIds, pmIds), loadKatzDeskInvoiceNets(sql, installIds, pmIds)]);
  const out = new Map<string, RecordBilling>();
  const keys = [...installIds.map((id) => `install:${id}`), ...pmIds.map((id) => `pm:${id}`)];
  // Grouped once: the Invoices page reads every install and PM.
  const group = <T extends { record: string }>(rows: T[]) => {
    const by = new Map<string, T[]>();
    for (const r of rows) {
      const list = by.get(r.record);
      if (list) list.push(r);
      else by.set(r.record, [r]);
    }
    return by;
  };
  const headersBy = group(ns.headers);
  const invoicesBy = group(ns.invoices);
  for (const key of keys) {
    const headers = headersBy.get(key) ?? [];
    const invoices = invoicesBy.get(key) ?? [];
    const katzdesk = own.get(key) ?? null;
    const nsLines = headers.reduce((s, h) => s + h.lines.length, 0);
    const nsNet = Math.round(headers.reduce((s, h) => s + h.net, 0) * 100) / 100;
    const chargeSource: RecordBilling["chargeSource"] = katzdesk ? "katzdesk" : nsLines || headers.some((h) => h.discount) ? "netsuite" : "none";
    const lines = katzdesk ? katzdesk.lines : nsLines;
    const net = katzdesk ? katzdesk.net : nsNet;
    const so = [...new Set(headers.map((h) => h.so).filter((s): s is string => !!s))].join(", ") || null;
    const billed = headers.map((h) => h.billedOn).filter((d): d is string => !!d).sort()[0] ?? null;
    const sum = summarizeBilling({ ns_so: so, billed_at: billed }, { lines, subtotal: net, off: 0, net, discount: null }, invoices);
    out.set(key, {
      ...sum,
      // No lines in KatzDesk and none from NetSuite: nothing to check the invoices against (11/5 review).
      ...(chargeSource === "none" ? { doubleBill: false, mismatch: false } : {}),
      groups: headers.map((h) => ({ wo: h.wo, woKey: h.woKey, so: h.so, billedOn: h.billedOn, discount: h.discount, lines: h.lines, subtotal: h.subtotal, off: h.off, net: h.net })),
      invoiceRows: invoices.map(({ record: _r, ...i }) => ({ ...i, wo: headers.find((h) => h.woKey === i.woKey)?.wo ?? null })),
      katzdesk,
      chargeSource,
    });
  }
  return out;
}

/** The warehouse rule (Lance: San Antonio WH, Bill: Dallas WH) on a record's invoices, under its tech. */
const locationWarningsOf = (technician: string | null, invoices: { location: string | null }[]) => [
  ...new Set(invoices.map((i) => locationWarning(technician, i.location)).filter((w): w is string => !!w)),
];

type InstallRow = {
  id: number;
  wo: string | null;
  wos: string | null;
  customer: string | null;
  technician: string | null;
  complete: boolean | null;
  equip_status: string | null;
  received: string | null;
  completed: string | null;
  po: string | null;
  vendor_po: string | null;
};

type PmRow = {
  id: number;
  wo: string | null;
  customer: string | null;
  technician: string | null;
  status: string | null;
  received: string | null;
  completed: string | null;
  po: string | null;
  vendor_po: string | null;
  service_location: string | null;
};

/**
 * Installs on the board and PMs not stacked on a ticket, with their billing, as rows of the Invoices page (11/5). An
 * install that is installed counts as Completed there, so "Completed, No SO" means what it means for tickets.
 */
export async function loadRecordBillingRows(sql: Q): Promise<TicketBillingRow[]> {
  const [installs, pms] = await Promise.all([
    sql.query<InstallRow>(
      `select i.id, i.wo, (select string_agg(w.wo, ', ' order by w.id) from install_work_orders w where w.install_id = i.id) as wos,
              i.customer, i.technician, i.complete, i.equip_status,
              to_char(i.received, 'YYYY-MM-DD') as received,
              to_char(coalesce(i.completed_at, case when i.complete or i.equip_status = 'Installed' then i.install_date end), 'YYYY-MM-DD') as completed,
              i.po, i.vendor_po
         from installs i
        where i.archived = false and i.duplicate_of is null`,
    ),
    sql.query<PmRow>(
      `select p.id, p.wo, p.customer, p.technician, p.status, to_char(p.received, 'YYYY-MM-DD') as received,
              to_char(p.completed_at, 'YYYY-MM-DD') as completed, p.po, p.vendor_po, p.service_location
         from pm_jobs p
        where p.stacked_job_id is null`,
    ),
  ]);
  const billings = await loadRecordBillings(
    sql,
    installs.map((i) => Number(i.id)),
    pms.map((p) => Number(p.id)),
  );
  const row = (
    board: "install" | "pm",
    r: { id: number; customer: string | null; technician: string | null; received: string | null; completed: string | null; po: string | null; vendor_po: string | null },
    wo: string | null,
    status: string,
    serviceLocation: string | null,
  ): TicketBillingRow => {
    const id = Number(r.id);
    const b = billings.get(`${board}:${id}`)!;
    return {
      id,
      board,
      wo,
      callId: `${board === "install" ? "Install" : "PM"} #${id}`,
      customer: r.customer,
      technician: r.technician,
      secondaryTech: null,
      status,
      received: r.received,
      completed: r.completed,
      so: b.so,
      billedAt: b.billedAt,
      invoices: b.invoiceRows.map((i) => ({ invoice: i.invoice, so: i.so, status: i.status, date: i.date, total: i.total, remaining: i.remaining, location: i.location })),
      chargeLines: b.chargeLines,
      chargeNet: b.chargeNet,
      liveTotal: b.liveTotal,
      corrigoNet: null,
      doubleBill: b.doubleBill,
      mismatch: b.mismatch,
      serviceLocation,
      locationWarnings: locationWarningsOf(r.technician, b.invoiceRows),
      invoicedDates: b.invoicedDates,
      po: String(r.po ?? "").trim() || null,
      vendorPo: String(r.vendor_po ?? "").trim() || null,
      ...(b.chargeSource === "none" ? {} : { chargesFrom: b.chargeSource }),
    };
  };
  return [
    ...installs.map((i) =>
      row(
        "install",
        i,
        String(i.wos ?? "").trim() || String(i.wo ?? "").trim() || null,
        isInstalled({ complete: !!i.complete, equipStatus: i.equip_status }) ? "Completed" : i.equip_status || "Not Ready",
        null,
      ),
    ),
    ...pms.map((p) => row("pm", p, String(p.wo ?? "").trim() || null, p.status ?? "", p.service_location)),
  ];
}

export type RecordBillingView = {
  type: RecordType;
  id: number;
  /** A PM stacked on a ticket bills on that ticket. */
  stackedOn: number | null;
  groups: RecordNsGroup[];
  invoices: RecordBilling["invoiceRows"];
  katzdesk: { lines: number; net: number } | null;
  chargeSource: RecordBilling["chargeSource"];
  chargeNet: number;
  liveTotal: number;
  doubleBill: boolean;
  mismatch: boolean;
  locationWarnings: string[];
};

/** One install's or PM's NetSuite billing, for its Invoices tab. A sales rep sees a PM's only on their own accounts. */
export async function loadRecordBillingFor(sql: Q, userId: string, data: { type: RecordType; id: number }): Promise<RecordBillingView> {
  let technician: string | null;
  let stackedOn: number | null = null;
  if (data.type === "install") {
    const r = (await sql.query<{ technician: string | null }>("select technician from installs where id = $1 and archived = false", [data.id]))[0];
    if (!r) throw new Error("That install is no longer on the list.");
    technician = r.technician;
  } else {
    const r = (await sql.query<{ technician: string | null; customer: string | null; stacked_job_id: number | null }>("select technician, customer, stacked_job_id from pm_jobs where id = $1", [data.id]))[0];
    if (!r) throw new Error("That PM is no longer on the list.");
    const scope = await salesRepScope(sql as Sql, userId);
    if (scope && !scope(await accountRepOf(sql as Sql, r.customer))) throw new Error("That PM is no longer on the list.");
    technician = r.technician;
    stackedOn = r.stacked_job_id == null ? null : Number(r.stacked_job_id);
  }
  const b = (await loadRecordBillings(sql, data.type === "install" ? [data.id] : [], data.type === "pm" ? [data.id] : [])).get(`${data.type}:${data.id}`)!;
  return {
    type: data.type,
    id: data.id,
    stackedOn,
    groups: b.groups,
    invoices: b.invoiceRows,
    katzdesk: b.katzdesk,
    chargeSource: b.chargeSource,
    chargeNet: b.chargeNet,
    liveTotal: b.liveTotal,
    doubleBill: b.doubleBill,
    mismatch: b.mismatch,
    locationWarnings: locationWarningsOf(technician, b.invoiceRows),
  };
}

export const getRecordBilling = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { type: RecordType; id: number }) => z.object({ type: z.enum(["install", "pm"]), id: z.number().int().positive().max(2147483647) }).parse(d))
  .handler(async ({ data, context }): Promise<RecordBillingView> => loadRecordBillingFor(await ready(), context.userId, data));
