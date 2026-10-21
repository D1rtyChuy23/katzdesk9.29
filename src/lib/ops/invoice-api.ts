import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { cleanQty, cleanRate, kindForItem, type ChargeKind, type PartRef } from "@/lib/ops/charges";
import { loadTicketCharges, writeTicketCharges } from "@/lib/ops/charges-api";
import { cleanDiscount, isDiscountKind, type Discount } from "@/lib/ops/discount";
import { INVOICE_TARGETS, invoiceError, invoiceTotals, stackedPmLock, targetTitle, usesTicketCharges, type BillTo, type InvoiceTarget, type InvoiceTotals } from "@/lib/ops/invoice";
import { accountRepFor, loadAccountMarks } from "@/lib/ops/reps";
import { canonicalRepName } from "@/lib/ops/rep-match";

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

export type InvoiceView = InvoiceTotals & {
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
};

type Ref = { type: InvoiceTarget; id: number; customer: string; title: string; recordRep: string | null; locked: string | null };

/** The record the invoice is for: its customer comes from the record itself, never asked for again. */
async function resolveRecord(sql: Sql, type: InvoiceTarget, id: number): Promise<Ref> {
  if (type === "service" || type === "tlc") {
    const r = (await sql.query<{ customer: string | null; wo: string | null; call_id: string | null; kind: string; ns_so: string | null; duplicate_of: number | null }>(
      "select customer, wo, call_id, kind, ns_so, duplicate_of from service_jobs where id = $1",
      [id],
    ))[0];
    if (!r) throw new Error("That ticket is no longer on the list.");
    const kind: InvoiceTarget = r.kind === "tlc" ? "tlc" : "service";
    const locked = r.duplicate_of
      ? `This ticket was merged into #${r.duplicate_of}. Open that ticket to change its invoice.`
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
    geocodeMatch: pinned && (match === "exact" || match === "close" || match === "approx") ? match : null,
  };
}

type HeadRow = { id: number; discount_kind: string | null; discount_value: string | null; total: string | null; approved_at: string | Date | null; approved_by: string | null };

async function head(sql: Sql, type: InvoiceTarget, id: number): Promise<HeadRow | undefined> {
  return (await sql.query<HeadRow>("select id, discount_kind, discount_value, total, approved_at, approved_by from invoices where entity_type = $1 and entity_id = $2", [type, id]))[0];
}

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

async function readInvoice(sql: Sql, type: InvoiceTarget, id: number): Promise<InvoiceView> {
  const ref = await resolveRecord(sql, type, id);
  const h = await head(sql, ref.type, id);
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
  };
}

const targetInput = z.object({ type: z.enum(INVOICE_TARGETS), id: z.number().int().positive() });

/** The invoice for one record: its billing info from the account, its lines, discount and total. Reading writes nothing. */
export const getInvoice = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { type: InvoiceTarget; id: number }) => targetInput.parse(d))
  .handler(async ({ data }): Promise<InvoiceView> => readInvoice(await ready(), data.type, data.id));

const lineInput = z.object({
  item: z.string().max(200),
  description: z.string().max(500),
  qty: z.union([z.number(), z.string().max(20)]),
  rate: z.union([z.number(), z.string().max(20)]),
  sourceKey: z.string().max(400).regex(/^(pmkit|mp):/).nullable().optional(),
});

const approveInput = targetInput.extend({
  lines: z.array(lineInput).max(200),
  lineIds: z.array(z.number().int().positive()).max(200),
  discount: z.object({ kind: z.string().max(20), value: z.union([z.number(), z.string().max(40)]) }).nullable(),
});

const ACTIVITY_TYPE: Record<InvoiceTarget, string> = { service: "service", tlc: "tlc", pm: "pm", install: "install", rebuild: "rebuild", deal: "deal" };

/**
 * Approve: the lines, discount and total in the window are saved as this record's invoice, with the billing info as
 * it reads now. Ticket invoices are the ticket's Charges (same lines, same discount, same billing export).
 * Nothing is saved before this; Cancel in the window never calls it.
 */
export const approveInvoice = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof approveInput>) => approveInput.parse(d))
  .handler(async ({ data, context }): Promise<InvoiceView> => {
    const sql = await ready();
    const ref = await resolveRecord(sql, data.type, data.id);
    if (ref.locked) throw new Error(ref.locked);
    const problem = invoiceError(data.lines);
    if (problem) throw new Error(problem);
    const typed = data.discount ? cleanDiscount(data.discount.kind, data.discount.value) : { discount: null };
    if ("error" in typed) throw new Error(typed.error);
    const who = (await sql.query<{ username: string | null }>("select username from desk_accounts where user_id = $1", [context.userId]))[0]?.username || "Desk";
    const bill = await billTo(sql, ref);

    let lines: { item: string; description: string; qty: number; rate: number; kind: ChargeKind }[];
    if (usesTicketCharges(ref.type)) {
      // The ticket's own Charges: same write as the Charges panel, P.O. kept as it is.
      await writeTicketCharges(sql, data.id, context.userId, { lines: data.lines, lineIds: data.lineIds, discount: typed.discount ? { kind: typed.discount.kind, value: typed.discount.value } : null });
      lines = (await loadTicketCharges(sql, data.id)).lines;
    } else {
      const items = data.lines.map((l) => l.item.trim());
      const kinds = new Map<string, ChargeKind>();
      if (items.length) {
        for (const k of await sql.query<{ item: string; kind: ChargeKind }>("select item, kind from billing_items where lower(btrim(item)) = any($1::text[])", [items.map((i) => i.toLowerCase())])) {
          kinds.set(k.item.trim().toLowerCase(), k.kind);
        }
      }
      lines = data.lines.map((l, i) => ({
        item: items[i]!,
        description: l.description.trim(),
        qty: cleanQty(l.qty)!,
        rate: cleanRate(l.rate)!,
        kind: kinds.get(items[i]!.toLowerCase()) ?? kindForItem(items[i]!),
      }));
    }
    const totals = invoiceTotals(lines, typed.discount);
    const saved = await sql.query<{ id: number }>(
      `insert into invoices (entity_type, entity_id, customer, discount_kind, discount_value, bill_name, bill_account, bill_address, bill_rep, total, approved_by, approved_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now())
       on conflict (entity_type, entity_id) do update set
         customer = excluded.customer, discount_kind = excluded.discount_kind, discount_value = excluded.discount_value,
         bill_name = excluded.bill_name, bill_account = excluded.bill_account, bill_address = excluded.bill_address, bill_rep = excluded.bill_rep,
         total = excluded.total, approved_by = excluded.approved_by, approved_at = now(), updated_at = now()
       returning id`,
      [
        ref.type,
        data.id,
        ref.customer || null,
        // A ticket keeps its discount on the ticket, so it is never stored twice.
        usesTicketCharges(ref.type) ? null : (typed.discount?.kind ?? null),
        usesTicketCharges(ref.type) ? null : (typed.discount?.value ?? null),
        bill.name,
        bill.accountNumber,
        bill.address,
        bill.rep,
        totals.total,
        who,
      ],
    );
    if (!usesTicketCharges(ref.type)) {
      // One statement: the old lines and the new ones change together or not at all.
      await sql.query(
        `with d as (delete from invoice_lines where invoice_id = $1)
         insert into invoice_lines (invoice_id, item, description, qty, rate, kind, sort)
         select $1, t.item, nullif(t.description, ''), t.qty, t.rate, t.kind, t.ord
           from unnest($2::text[], $3::text[], $4::numeric[], $5::numeric[], $6::text[]) with ordinality
                as t(item, description, qty, rate, kind, ord)`,
        [saved[0]!.id, lines.map((l) => l.item), lines.map((l) => l.description), lines.map((l) => l.qty), lines.map((l) => l.rate), lines.map((l) => l.kind)],
      );
    }
    await sql
      .query("insert into activity (entity_type, entity_id, actor_name, action, detail) values ($1, $2, $3, 'updated', $4)", [
        ACTIVITY_TYPE[ref.type],
        data.id,
        who,
        `invoice approved: ${lines.length} line${lines.length === 1 ? "" : "s"}, total $${totals.total.toFixed(2)}`,
      ])
      .catch(() => undefined);
    return readInvoice(sql, ref.type, data.id);
  });

export type AccountInvoice = {
  type: InvoiceTarget;
  id: number;
  title: string;
  total: number;
  approvedAt: string | null;
  approvedBy: string | null;
  /** "Approved", "Billed SO4401", or "Not approved" (a ticket with charges no one approved yet). */
  status: string;
};

/**
 * Every invoice on one account: approved invoices on any record, and tickets that have charges but no approval yet.
 * Read for the account's Invoices tab; each row opens the same Invoice window.
 */
export const listAccountInvoices = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { customer: string }) => z.object({ customer: z.string().max(300) }).parse(d))
  .handler(async ({ data }): Promise<AccountInvoice[]> => {
    const sql = await ready();
    const name = data.customer.trim();
    if (!name) return [];
    const approved = await sql.query<{ entity_type: InvoiceTarget; entity_id: number; total: string | null; approved_at: string | Date | null; approved_by: string | null }>(
      "select entity_type, entity_id, total, approved_at, approved_by from invoices where lower(btrim(customer)) = lower($1) and approved_at is not null order by approved_at desc",
      [name],
    );
    const tickets = await sql.query<{ id: number; kind: string; wo: string | null; call_id: string | null; ns_so: string | null; discount_kind: string | null; discount_value: string | null; amount: string }>(
      `select j.id, j.kind, j.wo, j.call_id, j.ns_so, j.discount_kind, j.discount_value, sum(round(c.qty * c.rate, 2))::text as amount
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
      const head = approved.find((a) => a.entity_type === type && Number(a.entity_id) === Number(t.id));
      const total = invoiceTotals([{ qty: 1, rate: Number(t.amount), kind: "part" }], toDiscount(t.discount_kind, t.discount_value)).total;
      seen.add(`${type}-${t.id}`);
      out.push({
        type,
        id: Number(t.id),
        title: targetTitle(type, { id: Number(t.id), wo: t.wo, callId: t.call_id }),
        total,
        approvedAt: head?.approved_at ? new Date(head.approved_at).toISOString() : null,
        approvedBy: head?.approved_by ?? null,
        status: t.ns_so ? `Billed ${t.ns_so}` : head ? "Approved" : "Not approved",
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
        status: "Approved",
      });
    }
    return out;
  });
