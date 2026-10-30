import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { cleanQty, cleanRate, kindForItem, type ChargeKind, type PartRef } from "@/lib/ops/charges";
import { loadTicketCharges, writeTicketCharges } from "@/lib/ops/charges-api";
import { cleanDiscount, isDiscountKind, type Discount } from "@/lib/ops/discount";
import { flagOn } from "@/lib/ops/flag";
import { INVOICE_TARGETS, carriesPo, cleanPo, invoiceError, invoiceTotals, stackedPmLock, targetTitle, usesTicketCharges, type BillTo, type InvoiceTarget, type InvoiceTotals } from "@/lib/ops/invoice";
import { notifyAdminsInvoiceWaiting } from "@/lib/ops/notify";
import { accountRepFor, loadAccountMarks } from "@/lib/ops/reps";
import { canonicalRepName } from "@/lib/ops/rep-match";
import { pinQuality } from "@/lib/ops/account-pin";
import {
  SERVICE_DEPT_KEYS,
  invoicePowers,
  invoiceState,
  partsOnlyError,
  waitingNotice,
  warehouseMayEdit,
  type InvoicePowers,
  type InvoiceState,
  type InvoiceViewer,
} from "@/lib/ops/warehouse-invoice";

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}

export type InvoiceLine = {
  id?: number;
  item: string;
  description: string;
  qty: number;
  rate: number;
  kind: ChargeKind;
  /** The part on the item list, for its photo and MPN. Null for labor and for an item that is not on the list. */
  part: PartRef | null;
  /** Copied from a stacked PM. Ticket invoices only; a PM's own invoice lines do not carry one. */
  sourceKey?: string | null;
};

export type InvoiceView = InvoiceTotals &
  InvoicePowers & {
    type: InvoiceTarget;
    id: number;
    /** "Service Ticket WO-123", "Install #45". */
    title: string;
    billTo: BillTo;
    lines: InvoiceLine[];
    discount: Discount | null;
    approvedAt: string | null;
    approvedBy: string | null;
    /** The total when it was approved. A ticket's Charges can change after that; the window says so. */
    approvedTotal: number | null;
    /** Why the lines cannot change (a billed ticket), or null. */
    locked: string | null;
    /** Tickets: the lines are the ticket's Charges, so the Charges panel and this window show the same thing. */
    sharedWithCharges: boolean;
    /** none, waiting (Warehouse saved it for an Admin to approve) or approved. */
    state: InvoiceState;
    /** Who saved it for approval and when (Warehouse); kept after it is approved. */
    submittedAt: string | null;
    submittedBy: string | null;
    /**
     * The invoice the window opened ("id:approved:saved"; null when there is none). Approve sends it back, so nothing
     * newer is written over: another approval, a Warehouse save, or an invoice a merge put on the record.
     */
    version: string | null;
    /** Install invoices carry the customer's P.O. for NetSuite (10/30); null on others (a ticket's is on the ticket). */
    hasPo: boolean;
    po: string | null;
  };

/** Who is looking: an Admin (the desk owner flag or the Admin role), Warehouse (that role, not an Admin), or anyone else. */
export async function invoiceViewer(sql: Sql, userId: string): Promise<InvoiceViewer & { name: string }> {
  const r = (await sql.query<{ is_admin: unknown; desk_role: string | null; username: string | null }>("select is_admin, desk_role, username from desk_accounts where user_id = $1", [userId]))[0];
  const role = String(r?.desk_role ?? "").trim().toLowerCase();
  const admin = flagOn(r?.is_admin) || role === "admin";
  return { admin, warehouse: !admin && role === "warehouse", name: r?.username || "Desk" };
}

type Ref = { type: InvoiceTarget; id: number; customer: string; title: string; recordRep: string | null; locked: string | null };

/** The record the invoice is for: its customer comes from the record itself, never asked for again. */
async function resolveRecord(sql: Sql, type: InvoiceTarget, id: number): Promise<Ref> {
  if (type === "service" || type === "tlc") {
    const r = (await sql.query<{ customer: string | null; wo: string | null; call_id: string | null; kind: string; ns_so: string | null; duplicate_of: number | null; merged_install_id: number | null; ns_invoice: string | null; ns_status: string | null }>(
      `select j.customer, j.wo, j.call_id, j.kind, j.ns_so, j.duplicate_of, j.merged_install_id, i.ns_invoice, i.status as ns_status
         from service_jobs j
         left join lateral (
           select ns_invoice, status from ticket_invoices ti
            where ti.job_id = j.id and lower(regexp_replace(ti.status, '[^A-Za-z]+', '', 'g')) not in ('voided', 'void')
            order by ti.invoice_date desc nulls last, ti.id desc
            limit 1
         ) i on true
        where j.id = $1`,
      [id],
    ))[0];
    if (!r) throw new Error("That ticket is no longer on the list.");
    const kind: InvoiceTarget = r.kind === "tlc" ? "tlc" : "service";
    const locked = r.merged_install_id
      ? `This ticket was merged into install #${r.merged_install_id}. Its charges are on the install's invoice.`
      : r.duplicate_of
      ? `This ticket was merged into #${r.duplicate_of}. Open that ticket to change its invoice.`
      : r.ns_invoice
        ? `This ticket is invoiced in NetSuite on ${r.ns_invoice} (${r.ns_status}). Its charges are locked; an Admin can unlock them in the ticket's Charges.`
        : r.ns_so
          ? `This ticket is billed on ${r.ns_so}. Clear the Sales Order number on the ticket to change its invoice.`
          : null;
    return {
      type: kind,
      id,
      customer: (r.customer ?? "").trim(),
      title: targetTitle(kind, { id, wo: r.wo, callId: r.call_id }),
      recordRep: null,
      locked,
    };
  }
  if (type === "pm") {
    const r = (await sql.query<{ customer: string | null; wo: string | null; stacked_job_id: number | null; job_wo: string | null; call_id: string | null }>(
      `select p.customer, p.wo, p.stacked_job_id, j.wo as job_wo, j.call_id
         from pm_jobs p
         left join service_jobs j on j.id = p.stacked_job_id
        where p.id = $1`,
      [id],
    ))[0];
    if (!r) throw new Error("That PM is no longer on the list.");
    const locked = r.stacked_job_id == null ? null : stackedPmLock({ jobId: Number(r.stacked_job_id), wo: r.job_wo, callId: r.call_id });
    return { type, id, customer: (r.customer ?? "").trim(), title: targetTitle(type, { id, wo: r.wo }), recordRep: null, locked };
  }
  if (type === "install") {
    const r = (await sql.query<{ customer: string | null; account_rep: string | null }>("select customer, account_rep from installs where id = $1 and archived = false", [id]))[0];
    if (!r) throw new Error("That install is no longer on the list.");
    return { type, id, customer: (r.customer ?? "").trim(), title: targetTitle(type, { id }), recordRep: r.account_rep, locked: null };
  }
  if (type === "rebuild") {
    const r = (await sql.query<{ account: string | null; title: string | null }>("select account, title from rebuilds where id = $1", [id]))[0];
    if (!r) throw new Error("That rebuild is no longer on the list.");
    return { type, id, customer: (r.account ?? "").trim(), title: targetTitle(type, { id, title: r.title }), recordRep: null, locked: null };
  }
  const r = (await sql.query<{ customer: string | null; producer: string | null }>("select customer, producer from deals where id = $1 and archived = false", [id]))[0];
  if (!r) throw new Error("That deal is no longer on the list.");
  return { type, id, customer: (r.customer ?? "").trim(), title: targetTitle(type, { id }), recordRep: r.producer, locked: null };
}

/** The lock sentence resolveRecord returns for a PM, or null when the PM bills on its own invoice. */
export async function pmInvoiceLock(sql: Sql, pmId: number): Promise<string | null> {
  return (await resolveRecord(sql, "pm", pmId)).locked;
}

/** Billing info from the account: name, account number, address, rep (the account's rep, else the record's). */
async function billTo(sql: Sql, ref: Ref): Promise<BillTo> {
  const acct = ref.customer
    ? (await sql.query<{
        name: string;
        account_number: string | null;
        address: string | null;
        netsuite_id: string | null;
        latitude: number | string | null;
        longitude: number | string | null;
        geocode_match: string | null;
      }>(
        "select name, account_number, address, netsuite_id, latitude, longitude, geocode_match from directory_customers where archived = false and lower(btrim(name)) = lower(btrim($1)) order by name_locked desc, id limit 1",
        [ref.customer],
      ))[0]
    : undefined;
  const marks = await loadAccountMarks(sql);
  const rep = accountRepFor(marks, acct?.name ?? ref.customer) ?? canonicalRepName(ref.recordRep) ?? (ref.recordRep?.trim() || null);
  const coord = (v: number | string | null | undefined): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const latitude = coord(acct?.latitude);
  const longitude = coord(acct?.longitude);
  const pinned = latitude !== null && longitude !== null;
  const match = acct?.geocode_match;
  return {
    name: acct?.name ?? (ref.customer || "No customer on this record"),
    accountNumber: acct?.account_number?.trim() || null,
    address: acct?.address?.trim() || null,
    rep: rep && rep.trim() ? rep : null,
    netsuiteId: acct?.netsuite_id?.trim() || null,
    onList: !!acct,
    latitude: pinned ? latitude : null,
    longitude: pinned ? longitude : null,
    geocodeMatch: pinned ? pinQuality(match) : null,
  };
}

type HeadRow = {
  id: number;
  discount_kind: string | null;
  discount_value: string | null;
  total: string | null;
  approved_at: string | Date | null;
  approved_by: string | null;
  submitted_at: string | Date | null;
  submitted_by: string | null;
  version: string | null;
  po: string | null;
};

/** A stamp as text, to the microsecond, so the window can send back exactly what it opened. */
const STAMP_OF = (col: string) => `(extract(epoch from ${col}) * 1000000)::bigint::text`;

/**
 * The invoice a window opened, as text: its row, when it was approved and when it was saved for approval ("id:approved:
 * saved"; null when there was no invoice). Approve writes only over that same invoice: a window opened on no invoice
 * never writes over one put on the record since (Merge installs moves one onto the install kept, 10/30), and a window
 * opened before another approval or a Warehouse save never writes over it.
 */
const VERSION_OF = (t: string) =>
  `(${t}.id::text || ':' || coalesce(${STAMP_OF(`${t}.approved_at`)}, '') || ':' || coalesce(${STAMP_OF(`${t}.submitted_at`)}, ''))`;

/** The saved-for-approval part of a version; an older window's version was only that stamp. */
const savedPart = (version: string | null): string => (version == null ? "" : version.includes(":") ? (version.split(":")[2] ?? "") : version);

async function head(sql: Sql, type: InvoiceTarget, id: number): Promise<HeadRow | undefined> {
  return (
    await sql.query<HeadRow>(
      `select id, discount_kind, discount_value, total, approved_at, approved_by, submitted_at, submitted_by, ${VERSION_OF("invoices")} as version, po
         from invoices where entity_type = $1 and entity_id = $2`,
      [type, id],
    )
  )[0];
}

const headState = (h: HeadRow | undefined): InvoiceState => invoiceState(h ? { approvedAt: h.approved_at, submittedAt: h.submitted_at } : null);

const toDiscount = (kind: string | null, value: string | number | null): Discount | null =>
  isDiscountKind(kind) && Number(value) > 0 ? { kind, value: Number(value) } : null;

async function projectLines(sql: Sql, invoiceId: number): Promise<InvoiceLine[]> {
  const rows = await sql.query<{
    id: number;
    item: string;
    description: string | null;
    qty: string;
    rate: string;
    kind: ChargeKind;
    pid: number | null;
    sku: string | null;
    mfr_part: string | null;
    has_image: boolean | null;
    image_version: string | null;
  }>(
    `select l.id, l.item, l.description, l.qty, l.rate, l.kind,
            p.id as pid, p.sku, p.mfr_part, (p.image is not null) as has_image,
            case when p.image is null then null else extract(epoch from p.image_updated_at)::bigint::text end as image_version
       from invoice_lines l
       left join lateral (
         select * from billing_items b
          where lower(btrim(b.item)) = lower(btrim(l.item)) or lower(btrim(b.sku)) = lower(btrim(l.item))
          order by (lower(btrim(b.item)) = lower(btrim(l.item))) desc
          limit 1
       ) p on true
      where l.invoice_id = $1
      order by l.sort, l.id`,
    [invoiceId],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    item: r.item,
    description: r.description ?? "",
    qty: Number(r.qty),
    rate: Number(r.rate),
    kind: r.kind,
    part: r.pid == null ? null : { id: Number(r.pid), sku: r.sku ?? "", mpn: r.mfr_part, hasImage: !!r.has_image, imageVersion: r.image_version },
  }));
}

const WAREHOUSE_REBUILDS_ONLY = "Warehouse opens rebuild invoices only.";

async function readInvoice(sql: Sql, type: InvoiceTarget, id: number, viewer: InvoiceViewer): Promise<InvoiceView> {
  if (viewer.warehouse && type !== "rebuild") throw new Error(WAREHOUSE_REBUILDS_ONLY);
  const ref = await resolveRecord(sql, type, id);
  const h = await head(sql, ref.type, id);
  const state = headState(h);
  // Warehouse reads its refurbs' invoices only, never a customer's billing.
  if (viewer.warehouse && !warehouseMayEdit(ref.customer)) throw new Error(invoicePowers(viewer, { type: ref.type, customer: ref.customer, state }).blocked ?? WAREHOUSE_REBUILDS_ONLY);
  let lines: InvoiceLine[];
  let discount: Discount | null;
  if (usesTicketCharges(ref.type)) {
    const c = await loadTicketCharges(sql, id);
    lines = c.lines.map((l) => ({ id: l.id, item: l.item, description: l.description, qty: l.qty, rate: l.rate, kind: l.kind, part: l.part, sourceKey: l.sourceKey ?? null }));
    discount = c.discount;
  } else {
    lines = h ? await projectLines(sql, h.id) : [];
    discount = h ? toDiscount(h.discount_kind, h.discount_value) : null;
  }
  return {
    type: ref.type,
    id,
    title: ref.title,
    billTo: await billTo(sql, ref),
    lines,
    discount,
    ...invoiceTotals(lines, discount),
    approvedAt: h?.approved_at ? new Date(h.approved_at).toISOString() : null,
    approvedBy: h?.approved_by ?? null,
    approvedTotal: h?.approved_at && h.total != null ? Number(h.total) : null,
    locked: ref.locked,
    sharedWithCharges: usesTicketCharges(ref.type),
    state,
    submittedAt: h?.submitted_at ? new Date(h.submitted_at).toISOString() : null,
    submittedBy: h?.submitted_by ?? null,
    version: h?.version ?? null,
    hasPo: carriesPo(ref.type),
    po: carriesPo(ref.type) ? (h?.po?.trim() || null) : null,
    ...invoicePowers(viewer, { type: ref.type, customer: ref.customer, state }),
  };
}


const targetInput = z.object({ type: z.enum(INVOICE_TARGETS), id: z.number().int().positive() });

/**
 * The invoice for one record: its billing info from the account, its lines, discount and total, and what this person
 * may do with it (approve, or save it for approval). Reading writes nothing.
 */
export const getInvoice = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { type: InvoiceTarget; id: number }) => targetInput.parse(d))
  .handler(async ({ data, context }): Promise<InvoiceView> => getInvoiceFor(await ready(), data, context.userId));

/** The body of getInvoice. Warehouse reads rebuild invoices only. */
export async function getInvoiceFor(sql: Sql, data: { type: InvoiceTarget; id: number }, userId: string): Promise<InvoiceView> {
  return readInvoice(sql, data.type, data.id, await invoiceViewer(sql, userId));
}

const lineInput = z.object({
  item: z.string().max(200),
  description: z.string().max(500),
  qty: z.union([z.number(), z.string().max(20)]),
  rate: z.union([z.number(), z.string().max(20)]),
  sourceKey: z.string().max(400).regex(/^(pmkit|mp):/).nullable().optional(),
});

const discountInput = z.object({ kind: z.string().max(20), value: z.union([z.number(), z.string().max(40)]) }).nullable();

const approveInput = targetInput.extend({
  lines: z.array(lineInput).max(200),
  lineIds: z.array(z.number().int().positive()).max(200),
  discount: discountInput,
  /** The invoice the window opened (InvoiceView.version); null when there was none. */
  seen: z.string().max(80).nullable().optional(),
  /** An install invoice's P.O. (10/30). Left out keeps the stored one; blank clears it. */
  po: z.string().max(400).nullable().optional(),
});

const saveInput = targetInput.extend({
  lines: z.array(lineInput).max(200),
  discount: discountInput,
});

const WAREHOUSE_SAVES = "An Admin approves warehouse invoices. Use Save for Approval.";
const WAITING_FOR_ADMIN = "This invoice is waiting for an Admin to approve it.";
const SAVED_SINCE_OPENED = "Warehouse saved changes to this invoice after you opened it, so nothing was approved. Look over the new lines, then approve.";
/**
 * An install's invoice gets lines saved for approval when a ticket is merged into the install, or when Merge installs
 * moves the invoice of an install a ticket was merged into (10/30).
 */
const LINES_ADDED_SINCE_OPENED = "Lines were saved for approval on this invoice after you opened it (a ticket or another install was merged into this one), so nothing was approved. Look over the new lines, then approve.";
/** Approved again, or put on the record, after the window opened (Merge installs moves an install's invoice, 10/30). */
const CHANGED_SINCE_OPENED = "This invoice was changed after you opened it, so nothing was approved. Look over it as it is now, then approve.";

/** Why an Approve wrote nothing: the record left the board meanwhile, or its invoice isn't the one the window opened. */
async function changedSinceOpened(sql: Sql, type: InvoiceTarget, id: number, seen: string | null): Promise<string> {
  // Archived meanwhile (Merge installs archives the install it drops): say so.
  const gone = await resolveRecord(sql, type, id).then(
    () => null,
    (e: unknown) => (e instanceof Error ? e.message : String(e)),
  );
  if (gone) return gone;
  const now = await head(sql, type, id);
  if (now?.submitted_at && savedPart(now.version) !== savedPart(seen)) return type === "install" ? LINES_ADDED_SINCE_OPENED : SAVED_SINCE_OPENED;
  return CHANGED_SINCE_OPENED;
}

/**
 * Approve a PM's own invoice only while it is not stacked. One statement: lock the PM, insert the header
 * and replace the lines only when stacked_job_id is null. Zero rows means it was stacked first.
 * The stacked check sits on the locked row itself: in READ COMMITTED a `for update` that waited re-reads only the
 * row it locks, while a separate subquery would still see the snapshot from before a stack committed.
 */
export function approvePmInvoiceSql(): string {
  return `with locked as (
       select p.id from pm_jobs p where p.id = $2::int and p.stacked_job_id is null for update
     ),
     open_pm as (
       select locked.id from locked
     ),
     inv as (
       insert into invoices (
         entity_type, entity_id, customer, discount_kind, discount_value,
         bill_name, bill_account, bill_address, bill_rep, total, approved_by, approved_at, updated_at
       )
       select $1, $2::int, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now()
         from open_pm
       on conflict (entity_type, entity_id) do update set
         customer = excluded.customer, discount_kind = excluded.discount_kind, discount_value = excluded.discount_value,
         bill_name = excluded.bill_name, bill_account = excluded.bill_account, bill_address = excluded.bill_address,
         bill_rep = excluded.bill_rep, total = excluded.total, approved_by = excluded.approved_by,
         approved_at = now(), updated_at = now()
       returning id
     ),
     cleared as (
       delete from invoice_lines where invoice_id in (select id from inv) returning id
     ),
     lined as (
       insert into invoice_lines (invoice_id, item, description, qty, rate, kind, sort)
       select inv.id, t.item, nullif(t.description, ''), t.qty, t.rate, t.kind, t.ord
         from inv
         join unnest($12::text[], $13::text[], $14::numeric[], $15::numeric[], $16::text[]) with ordinality
              as t(item, description, qty, rate, kind, ord) on true
        where (select count(*) from cleared) >= 0
       returning id
     )
     select inv.id, (select count(*) from lined)::int as lined from inv`;
}

/**
 * Approve the invoice of an install, rebuild or deal: the header and its lines in one statement, so they change
 * together or not at all. $12 is the invoice the window opened (its version; null when there was none): when that
 * invoice was approved or saved for approval again since, or an invoice was put on the record, or it left the record,
 * nothing is written and no row comes back, so the approver sees it as it is first. An install's invoice is written only
 * when its row reads not archived; the row is locked against Merge installs and ticket merges (not against Remove), so
 * an Approve that meets a Merge installs mid-way waits for it, then writes nothing on the install it archived. $18 is an
 * install invoice's P.O., written when $19 is true.
 */
export function approveRecordInvoiceSql(): string {
  return `with rec as (
       select i.id from installs i where $1::text = 'install' and i.id = $2::int and i.archived = false for key share
     ), inv as (
       insert into invoices (
         entity_type, entity_id, customer, discount_kind, discount_value,
         bill_name, bill_account, bill_address, bill_rep, total, approved_by, approved_at, updated_at, po
       )
       select $1, $2::int, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now(), case when $19::boolean then $18::text end
        where ($1::text <> 'install' or exists (select 1 from rec))
          -- A window that opened an invoice writes nothing once it is gone from the record (it went to the install kept).
          and ($12::text is null or exists (select 1 from invoices x where x.entity_type = $1 and x.entity_id = $2::int))
       on conflict (entity_type, entity_id) do update set
         customer = excluded.customer, discount_kind = excluded.discount_kind, discount_value = excluded.discount_value,
         bill_name = excluded.bill_name, bill_account = excluded.bill_account, bill_address = excluded.bill_address,
         bill_rep = excluded.bill_rep, total = excluded.total, approved_by = excluded.approved_by,
         approved_at = now(), updated_at = now(),
         -- The P.O. the window sent ($19); one that sent none (another record type) leaves it.
         po = case when $19::boolean then $18::text else invoices.po end
        where ${VERSION_OF("invoices")} is not distinct from $12::text
       returning id
     ),
     cleared as (
       delete from invoice_lines where invoice_id in (select id from inv) returning id
     ),
     lined as (
       insert into invoice_lines (invoice_id, item, description, qty, rate, kind, sort)
       select inv.id, t.item, nullif(t.description, ''), t.qty, t.rate, t.kind, t.ord
         from inv
         join unnest($13::text[], $14::text[], $15::numeric[], $16::numeric[], $17::text[]) with ordinality
              as t(item, description, qty, rate, kind, ord) on true
        where (select count(*) from cleared) >= 0
       returning id
     )
     select inv.id, (select count(*) from lined)::int as lined from inv`;
}

/**
 * Warehouse's Save for Approval on a rebuild: the header (not approved, with who saved it and when) and its lines in one
 * statement. It writes only while the rebuild is on the board and for Katz Coffee Service Dept. ($16, the account's
 * letters and digits), and the invoice isn't approved, all read when it runs; otherwise no row comes back and nothing
 * changes.
 */
export function saveForApprovalSql(): string {
  return `with inv as (
       insert into invoices (
         entity_type, entity_id, customer, discount_kind, discount_value,
         bill_name, bill_account, bill_address, bill_rep, total, submitted_by, submitted_at, updated_at
       )
       select 'rebuild', r.id, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now()
         from rebuilds r
        where r.id = $1::int and coalesce(r.archived, false) = false
          and regexp_replace(lower(coalesce(r.account, '')), '[^a-z0-9]+', '', 'g') = any($16::text[])
       on conflict (entity_type, entity_id) do update set
         customer = excluded.customer, discount_kind = excluded.discount_kind, discount_value = excluded.discount_value,
         bill_name = excluded.bill_name, bill_account = excluded.bill_account, bill_address = excluded.bill_address,
         bill_rep = excluded.bill_rep, total = excluded.total, submitted_by = excluded.submitted_by,
         submitted_at = now(), updated_at = now()
        where invoices.approved_at is null
       returning id
     ),
     cleared as (
       delete from invoice_lines where invoice_id in (select id from inv) returning id
     ),
     lined as (
       insert into invoice_lines (invoice_id, item, description, qty, rate, kind, sort)
       select inv.id, t.item, nullif(t.description, ''), t.qty, t.rate, t.kind, t.ord
         from inv
         join unnest($11::text[], $12::text[], $13::numeric[], $14::numeric[], $15::text[]) with ordinality
              as t(item, description, qty, rate, kind, ord) on true
        where (select count(*) from cleared) >= 0
       returning id
     )
     select inv.id, (select count(*) from lined)::int as lined from inv`;
}

const ACTIVITY_TYPE: Record<InvoiceTarget, string> = { service: "service", tlc: "tlc", pm: "pm", install: "install", rebuild: "rebuild", deal: "deal" };

type CleanLine = { item: string; description: string; qty: number; rate: number; kind: ChargeKind };

/** The lines of a PM, install, rebuild or deal invoice as saved: each one's kind from the item list, else from its name. */
async function recordLines(sql: Sql, raw: z.output<typeof lineInput>[]): Promise<CleanLine[]> {
  const items = raw.map((l) => l.item.trim());
  const kinds = new Map<string, ChargeKind>();
  if (items.length) {
    for (const k of await sql.query<{ item: string; kind: ChargeKind }>("select item, kind from billing_items where lower(btrim(item)) = any($1::text[])", [items.map((i) => i.toLowerCase())])) {
      kinds.set(k.item.trim().toLowerCase(), k.kind);
    }
  }
  return raw.map((l, i) => ({
    item: items[i]!,
    description: l.description.trim(),
    qty: cleanQty(l.qty)!,
    rate: cleanRate(l.rate)!,
    kind: kinds.get(items[i]!.toLowerCase()) ?? kindForItem(items[i]!),
  }));
}

const lineArrays = (lines: CleanLine[]) => [lines.map((l) => l.item), lines.map((l) => l.description), lines.map((l) => l.qty), lines.map((l) => l.rate), lines.map((l) => l.kind)];

const lineCount = (n: number) => `${n} line${n === 1 ? "" : "s"}`;

/**
 * Approve: the lines, discount and total in the window are saved as this record's invoice, with the billing info as
 * it reads now. Ticket invoices are the ticket's Charges (same lines, same discount, same billing export).
 * Nothing is saved before this; Cancel in the window never calls it. Warehouse never approves (it saves for approval),
 * and an invoice Warehouse saved for approval is approved by an Admin.
 */
export const approveInvoice = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof approveInput>) => approveInput.parse(d))
  .handler(async ({ data, context }): Promise<InvoiceView> => approveInvoiceFor(await ready(), data, context.userId));

/** The body of approveInvoice. */
export async function approveInvoiceFor(sql: Sql, data: z.output<typeof approveInput>, userId: string): Promise<InvoiceView> {
  const viewer = await invoiceViewer(sql, userId);
  if (viewer.warehouse) throw new Error(WAREHOUSE_SAVES);
  const ref = await resolveRecord(sql, data.type, data.id);
  if (ref.locked) throw new Error(ref.locked);
  if (!viewer.admin && headState(await head(sql, ref.type, data.id)) === "waiting") throw new Error(WAITING_FOR_ADMIN);
  const problem = invoiceError(data.lines);
  if (problem) throw new Error(problem);
  const typed = data.discount ? cleanDiscount(data.discount.kind, data.discount.value) : { discount: null };
  if ("error" in typed) throw new Error(typed.error);
  // An install invoice's P.O.: sent, it is saved (blank clears it); left out, the stored one stays.
  const poSent = carriesPo(ref.type) && data.po !== undefined;
  const typedPo = poSent ? cleanPo(data.po) : { po: null };
  if ("error" in typedPo) throw new Error(typedPo.error);
  const who = viewer.name;
  const bill = await billTo(sql, ref);

  let lines: CleanLine[];
  if (usesTicketCharges(ref.type)) {
    // The ticket's own Charges: same write as the Charges panel, P.O. kept as it is.
    await writeTicketCharges(sql, data.id, userId, { lines: data.lines, lineIds: data.lineIds, discount: typed.discount ? { kind: typed.discount.kind, value: typed.discount.value } : null });
    lines = (await loadTicketCharges(sql, data.id)).lines;
  } else {
    lines = await recordLines(sql, data.lines);
  }
  const totals = invoiceTotals(lines, typed.discount);
  const billing = [bill.name, bill.accountNumber, bill.address, bill.rep, totals.total, who];
  if (ref.type === "pm") {
    const savedPm = await sql.query<{ id: number }>(approvePmInvoiceSql(), [
      ref.type,
      data.id,
      ref.customer || null,
      typed.discount?.kind ?? null,
      typed.discount?.value ?? null,
      ...billing,
      ...lineArrays(lines),
    ]);
    if (!savedPm[0]) throw new Error((await pmInvoiceLock(sql, data.id)) ?? "This PM is billed on a ticket. Open the ticket's Invoicing tab.");
  } else if (usesTicketCharges(ref.type)) {
    // A ticket keeps its lines and discount on the ticket, so they are never stored twice.
    await sql.query(
      `insert into invoices (entity_type, entity_id, customer, discount_kind, discount_value, bill_name, bill_account, bill_address, bill_rep, total, approved_by, approved_at, updated_at)
       values ($1, $2, $3, null, null, $4, $5, $6, $7, $8, $9, now(), now())
       on conflict (entity_type, entity_id) do update set
         customer = excluded.customer, discount_kind = excluded.discount_kind, discount_value = excluded.discount_value,
         bill_name = excluded.bill_name, bill_account = excluded.bill_account, bill_address = excluded.bill_address, bill_rep = excluded.bill_rep,
         total = excluded.total, approved_by = excluded.approved_by, approved_at = now(), updated_at = now()`,
      [ref.type, data.id, ref.customer || null, ...billing],
    );
  } else {
    const saved = await sql.query<{ id: number }>(approveRecordInvoiceSql(), [
      ref.type,
      data.id,
      ref.customer || null,
      typed.discount?.kind ?? null,
      typed.discount?.value ?? null,
      ...billing,
      data.seen ?? null,
      ...lineArrays(lines),
      typedPo.po,
      poSent,
    ]);
    if (!saved[0]) throw new Error(await changedSinceOpened(sql, ref.type, data.id, data.seen ?? null));
  }
  await sql
    .query("insert into activity (entity_type, entity_id, actor_name, action, detail) values ($1, $2, $3, 'updated', $4)", [
      ACTIVITY_TYPE[ref.type],
      data.id,
      who,
      `invoice approved: ${lineCount(lines.length)}, total $${totals.total.toFixed(2)}${poSent && typedPo.po ? ` · P.O. ${typedPo.po}` : ""}`,
    ])
    .catch(() => undefined);
  return readInvoice(sql, ref.type, data.id, viewer);
}

/**
 * Save for Approval (Warehouse, Chuy 10/29): the parts a refurb used, on a rebuild for Katz Coffee Service Dept., saved
 * as its invoice waiting for an Admin to approve. Parts only. Saving again replaces the lines until an Admin approves;
 * after that it is the Admin's. The first save pings every Admin.
 */
export const saveInvoiceForApproval = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof saveInput>) => saveInput.parse(d))
  .handler(async ({ data, context }): Promise<InvoiceView> => saveInvoiceForApprovalFor(await ready(), data, context.userId));

/** The body of saveInvoiceForApproval. */
export async function saveInvoiceForApprovalFor(sql: Sql, data: z.output<typeof saveInput>, userId: string): Promise<InvoiceView> {
  const viewer = await invoiceViewer(sql, userId);
  if (!viewer.warehouse) throw new Error("Save for Approval is the Warehouse step. Approve the invoice instead.");
  if (data.type !== "rebuild") throw new Error("Warehouse invoices are for rebuilds.");
  const ref = await resolveRecord(sql, "rebuild", data.id);
  const before = headState(await head(sql, "rebuild", data.id));
  const powers = invoicePowers(viewer, { type: ref.type, customer: ref.customer, state: before });
  if (!powers.canSave) throw new Error(powers.blocked ?? "This invoice can't be saved for approval.");
  if (!data.lines.length) throw new Error("Add the parts the refurb used, then save.");
  const problem = invoiceError(data.lines);
  if (problem) throw new Error(problem);
  // The parts used, at their prices; an Admin adds any discount when approving.
  if (data.discount) throw new Error("Warehouse invoices have no discount. An Admin can add one when approving.");
  const lines = await recordLines(sql, data.lines);
  const partsProblem = partsOnlyError(lines);
  if (partsProblem) throw new Error(partsProblem);
  // Every line is a part on the part list (shown, not hidden), never a typed name.
  const listed = new Set(
    (
      await sql.query<{ item: string }>("select item from billing_items where lower(btrim(item)) = any($1::text[]) and kind = 'part' and active and hidden_at is null", [
        lines.map((l) => l.item.toLowerCase()),
      ])
    ).map((r) => r.item.trim().toLowerCase()),
  );
  const offList = lines.findIndex((l) => !listed.has(l.item.toLowerCase()));
  if (offList >= 0) throw new Error(`Line ${offList + 1}: Warehouse invoices take parts from the part list. Add it with Add a part.`);
  const totals = invoiceTotals(lines, null);
  const bill = await billTo(sql, ref);
  const saved = await sql.query<{ id: number }>(saveForApprovalSql(), [
    data.id,
    ref.customer || null,
    null,
    null,
    bill.name,
    bill.accountNumber,
    bill.address,
    bill.rep,
    totals.total,
    viewer.name,
    ...lineArrays(lines),
    [...SERVICE_DEPT_KEYS],
  ]);
  if (!saved[0]) {
    // The checks above passed but the write found something else: say which.
    if (headState(await head(sql, "rebuild", data.id)) === "approved") {
      throw new Error("This invoice was approved while you had it open, so nothing was saved. Ask an Admin to change it.");
    }
    const removed = (await sql.query<{ archived: boolean }>("select coalesce(archived, false) as archived from rebuilds where id = $1", [data.id]))[0]?.archived;
    if (removed) throw new Error("This rebuild was removed from the board, so nothing was saved.");
    throw new Error("This rebuild was moved off Katz Coffee Service Dept. while you had it open, so nothing was saved.");
  }
  await sql
    .query("insert into activity (entity_type, entity_id, actor_name, action, detail) values ('rebuild', $1, $2, 'updated', $3)", [
      data.id,
      viewer.name,
      `invoice saved for approval: ${lineCount(lines.length)}, total $${totals.total.toFixed(2)}`,
    ])
    .catch(() => undefined);
  if (before === "none") {
    await notifyAdminsInvoiceWaiting(sql, userId, {
      rebuildId: data.id,
      account: bill.name,
      body: waitingNotice(viewer.name, ref.title, bill.name, lines.length, totals.total),
    }).catch(() => undefined);
  }
  return readInvoice(sql, "rebuild", data.id, viewer);
}

export type AccountInvoice = {
  type: InvoiceTarget;
  id: number;
  title: string;
  total: number;
  approvedAt: string | null;
  approvedBy: string | null;
  /** Saved for approval by Warehouse: who and when. */
  submittedAt: string | null;
  submittedBy: string | null;
  /** "Approved", "Billed SO4401", "Waiting for approval" (Warehouse saved it), or "Not approved" (a ticket with charges no one approved yet). */
  status: string;
  /** The customer's P.O.: a ticket's own, or an install invoice's (10/30). */
  po: string | null;
};

/**
 * Every invoice on one account: approved invoices on any record, invoices Warehouse saved for an Admin to approve, and
 * tickets that have charges but no approval yet. Read for the account's Invoices tab; each row opens the same Invoice
 * window.
 */
export const listAccountInvoices = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { customer: string }) => z.object({ customer: z.string().max(300) }).parse(d))
  .handler(async ({ data, context }): Promise<AccountInvoice[]> => listAccountInvoicesFor(await ready(), data.customer, context.userId));

/** The body of listAccountInvoices. Warehouse doesn't read accounts' invoices. */
export async function listAccountInvoicesFor(sql: Sql, customer: string, userId: string): Promise<AccountInvoice[]> {
  if ((await invoiceViewer(sql, userId)).warehouse) throw new Error(WAREHOUSE_REBUILDS_ONLY);
  const name = customer.trim();
  if (!name) return [];
  const approved = await sql.query<{
    entity_type: InvoiceTarget;
    entity_id: number;
    total: string | null;
    approved_at: string | Date | null;
    approved_by: string | null;
    submitted_at: string | Date | null;
    submitted_by: string | null;
    po: string | null;
  }>(
    // A merged ticket's own invoice is left out: its charges are on the ticket or install it was merged into (10/30).
    `select entity_type, entity_id, total, approved_at, approved_by, submitted_at, submitted_by, po
       from invoices v
      where lower(btrim(v.customer)) = lower($1) and (v.approved_at is not null or v.submitted_at is not null)
        and not (v.entity_type in ('service', 'tlc')
                 and exists (select 1 from service_jobs j where j.id = v.entity_id and j.duplicate_of is not null))
      order by coalesce(v.approved_at, v.submitted_at) desc`,
    [name],
  );
  const tickets = await sql.query<{ id: number; kind: string; wo: string | null; call_id: string | null; ns_so: string | null; po: string | null; discount_kind: string | null; discount_value: string | null; amount: string }>(
    `select j.id, j.kind, j.wo, j.call_id, j.ns_so, j.po, j.discount_kind, j.discount_value, sum(round(c.qty * c.rate, 2))::text as amount
       from service_jobs j join ticket_charges c on c.job_id = j.id
      where lower(btrim(j.customer)) = lower($1) and j.duplicate_of is null
      group by j.id
      order by j.id desc`,
    [name],
  );
  const out: AccountInvoice[] = [];
  const seen = new Set<string>();
  for (const t of tickets) {
    const type: InvoiceTarget = t.kind === "tlc" ? "tlc" : "service";
    const head = approved.find((a) => a.entity_type === type && Number(a.entity_id) === Number(t.id) && a.approved_at);
    const total = invoiceTotals([{ qty: 1, rate: Number(t.amount), kind: "part" }], toDiscount(t.discount_kind, t.discount_value)).total;
    seen.add(`${type}-${t.id}`);
    out.push({
      type,
      id: Number(t.id),
      title: targetTitle(type, { id: Number(t.id), wo: t.wo, callId: t.call_id }),
      total,
      approvedAt: head?.approved_at ? new Date(head.approved_at).toISOString() : null,
      approvedBy: head?.approved_by ?? null,
      submittedAt: null,
      submittedBy: null,
      status: t.ns_so ? `Billed ${t.ns_so}` : head ? "Approved" : "Not approved",
      po: t.po?.trim() || null,
    });
  }
  for (const a of approved) {
    const key = `${a.entity_type}-${a.entity_id}`;
    if (seen.has(key)) continue;
    const ref = await resolveRecord(sql, a.entity_type, Number(a.entity_id)).catch(() => null);
    if (!ref) continue;
    out.push({
      type: ref.type,
      id: Number(a.entity_id),
      title: ref.title,
      total: Number(a.total ?? 0),
      approvedAt: a.approved_at ? new Date(a.approved_at).toISOString() : null,
      approvedBy: a.approved_by,
      submittedAt: a.submitted_at ? new Date(a.submitted_at).toISOString() : null,
      submittedBy: a.submitted_by,
      status: a.approved_at ? "Approved" : "Waiting for approval",
      po: carriesPo(ref.type) ? (a.po?.trim() || null) : null,
    });
  }
  return out;
}
