/**
 * Repair Quote on a service ticket or a rebuild project: parts and labor, with a status. A rebuild linked to a
 * ticket shares that ticket's quote, so the cost is on the project and there is one sheet for the job.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { cleanQty, cleanRate, type ChargeKind, type PartRef } from "@/lib/ops/charges";
import { QUOTE_STATUSES, lineKind, quoteError, quoteForJob, quoteForRebuild, quoteLocked, quoteTotals, type QuoteCost, type QuoteLine, type QuoteStatus } from "@/lib/ops/repair-quote";

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("./seed.server");
  await ensureSeeded();
  return getSql();
}

export type RepairQuote = {
  /** null until the first save. */
  id: number | null;
  jobId: number | null;
  rebuildId: number | null;
  status: QuoteStatus;
  note: string;
  lines: (QuoteLine & { part: PartRef | null })[];
  parts: number;
  labor: number;
  total: number;
  /** The other record this same quote is on, when the rebuild and the ticket are linked. */
  shared: { kind: "rebuild" | "ticket"; id: number; label: string } | null;
  updatedBy: string | null;
  updatedAt: string | null;
};

type QuoteRow = { id: number; job_id: number | null; rebuild_id: number | null; status: string; note: string | null; updated_by: string | null; updated_at: string | Date };

type Target = { jobId: number | null; rebuildId: number | null };

/** The ticket and rebuild a quote opened from either one belongs to: a linked pair counts as one job. */
async function resolve(sql: Sql, from: { jobId?: number | null; rebuildId?: number | null }): Promise<Target & { quote: QuoteRow | null; jobLabel: string | null; rebuildLabel: string | null }> {
  let jobId = from.jobId ?? null;
  let rebuildId = from.rebuildId ?? null;
  if (rebuildId != null) {
    const rb = (await sql.query<{ id: number; job_id: number | null }>("select id, job_id from rebuilds where id = $1", [rebuildId]))[0];
    if (!rb) throw new Error("That rebuild is no longer on the list.");
    jobId = rb.job_id == null ? null : Number(rb.job_id);
  } else if (jobId != null) {
    const job = (await sql.query<{ id: number }>("select id from service_jobs where id = $1", [jobId]))[0];
    if (!job) throw new Error("That ticket is no longer on the list.");
    const rb = (await sql.query<{ id: number }>("select id from rebuilds where job_id = $1 and coalesce(archived, false) = false order by id desc limit 1", [jobId]))[0];
    rebuildId = rb ? Number(rb.id) : null;
  } else {
    throw new Error("A repair quote belongs to a ticket or a rebuild.");
  }
  const rows = (
    await sql.query<QuoteRow>("select id, job_id, rebuild_id, status, note, updated_by, updated_at from repair_quotes where ($1::int is not null and job_id = $1) or ($2::int is not null and rebuild_id = $2) order by id", [jobId, rebuildId])
  ).map((q) => ({ ...q, id: Number(q.id), jobId: q.job_id == null ? null : Number(q.job_id), rebuildId: q.rebuild_id == null ? null : Number(q.rebuild_id) }));
  // Opened from the rebuild, its own quote wins; opened from the ticket, the ticket's does. Either falls back to the other.
  const quote = from.rebuildId != null ? quoteForRebuild({ id: rebuildId!, jobId }, rows) : quoteForJob(jobId!, rebuildId, rows);
  const job = jobId == null ? null : (await sql.query<{ wo: string | null; call_id: string; customer: string | null }>("select wo, call_id, customer from service_jobs where id = $1", [jobId]))[0];
  const rb = rebuildId == null ? null : (await sql.query<{ title: string }>("select title from rebuilds where id = $1", [rebuildId]))[0];
  return {
    jobId,
    rebuildId,
    quote: quote ?? null,
    jobLabel: job ? `${job.wo?.trim() ? (/^wo/i.test(job.wo.trim()) ? job.wo.trim() : `WO ${job.wo.trim()}`) : job.call_id}${job.customer ? ` · ${job.customer}` : ""}` : null,
    rebuildLabel: rb?.title ?? null,
  };
}

async function load(sql: Sql, from: { jobId?: number | null; rebuildId?: number | null }): Promise<RepairQuote> {
  const t = await resolve(sql, from);
  const fromRebuild = from.rebuildId != null;
  const shared: RepairQuote["shared"] = fromRebuild
    ? t.jobId != null && t.jobLabel
      ? { kind: "ticket", id: t.jobId, label: t.jobLabel }
      : null
    : t.rebuildId != null && t.rebuildLabel
      ? { kind: "rebuild", id: t.rebuildId, label: t.rebuildLabel }
      : null;
  if (!t.quote) {
    return { id: null, jobId: t.jobId, rebuildId: t.rebuildId, status: "Draft", note: "", lines: [], parts: 0, labor: 0, total: 0, shared, updatedBy: null, updatedAt: null };
  }
  const rows = await sql.query<{
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
    `select l.item, l.description, l.qty, l.rate, l.kind,
            p.id as pid, p.sku, p.mfr_part, (p.image is not null) as has_image,
            case when p.image is null then null else extract(epoch from p.image_updated_at)::bigint::text end as image_version
       from repair_quote_lines l
       left join lateral (
         select * from billing_items b
          where lower(btrim(b.item)) = lower(btrim(l.item)) or lower(btrim(b.sku)) = lower(btrim(l.item))
          order by (lower(btrim(b.item)) = lower(btrim(l.item))) desc
          limit 1
       ) p on true
      where l.quote_id = $1
      order by l.sort, l.id`,
    [t.quote.id],
  );
  const lines = rows.map((r) => ({
    item: r.item,
    description: r.description ?? "",
    qty: Number(r.qty),
    rate: Number(r.rate),
    kind: r.kind,
    part: r.pid == null ? null : { id: Number(r.pid), sku: r.sku ?? "", mpn: r.mfr_part, hasImage: !!r.has_image, imageVersion: r.image_version },
  }));
  return {
    id: t.quote.id,
    jobId: t.jobId,
    rebuildId: t.rebuildId,
    status: (QUOTE_STATUSES as readonly string[]).includes(t.quote.status) ? (t.quote.status as QuoteStatus) : "Draft",
    note: t.quote.note ?? "",
    lines,
    ...quoteTotals(lines),
    shared,
    updatedBy: t.quote.updated_by,
    updatedAt: new Date(t.quote.updated_at).toISOString(),
  };
}

const target = { jobId: z.number().int().positive().nullable().optional(), rebuildId: z.number().int().positive().nullable().optional() };

export const getRepairQuote = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { jobId?: number | null; rebuildId?: number | null }) => z.object(target).parse(d))
  .handler(async ({ data }): Promise<RepairQuote> => load(await ready(), data));

const lineSchema = z.object({
  item: z.string().max(200),
  description: z.string().max(500),
  qty: z.union([z.number(), z.string()]),
  rate: z.union([z.number(), z.string()]),
});

/**
 * Save the quote's status, note and lines. The first save makes the quote and puts it on the ticket and on the
 * rebuild linked to it. A quote that is Approved or Declined keeps its lines until it is set back to Draft or Sent.
 */
export const saveRepairQuote = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { jobId?: number | null; rebuildId?: number | null; status: QuoteStatus; note: string; lines: z.input<typeof lineSchema>[] }) =>
    z.object({ ...target, status: z.enum(QUOTE_STATUSES), note: z.string().max(2000), lines: z.array(lineSchema).max(200) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<RepairQuote> => {
    const sql = await ready();
    const t = await resolve(sql, data);
    const who = (await sql.query<{ username: string }>("select username from desk_accounts where user_id = $1", [context.userId]))[0]?.username || "Desk";
    const wasLocked = quoteLocked(t.quote?.status);
    const staysLocked = wasLocked && quoteLocked(data.status);
    // Checked before anything is written, so a bad line never leaves a half-saved quote.
    const problem = staysLocked ? null : quoteError(data.lines);
    if (problem) throw new Error(problem);

    let quoteId = t.quote?.id ?? null;
    if (quoteId == null) {
      const made = await sql.query<{ id: number }>("insert into repair_quotes (job_id, rebuild_id, status, note, updated_by) values ($1, $2, $3, $4, $5) returning id", [
        t.jobId,
        t.rebuildId,
        data.status,
        data.note.trim() || null,
        who,
      ]);
      quoteId = Number(made[0]!.id);
    } else {
      // A quote started on one side picks up the other once the two are linked, unless that side has its own.
      await sql.query(
        `update repair_quotes q set status = $2, note = $3, updated_by = $4, updated_at = now(),
                job_id = coalesce(q.job_id, case when $5::int is not null and not exists (select 1 from repair_quotes o where o.job_id = $5 and o.id <> q.id) then $5 end),
                rebuild_id = coalesce(q.rebuild_id, case when $6::int is not null and not exists (select 1 from repair_quotes o where o.rebuild_id = $6 and o.id <> q.id) then $6 end)
          where q.id = $1`,
        [quoteId, data.status, data.note.trim() || null, who, t.jobId, t.rebuildId],
      );
    }

    if (!staysLocked) {
      const lines = data.lines.map((l) => ({ item: l.item.trim(), description: l.description.trim(), qty: cleanQty(l.qty)!, rate: cleanRate(l.rate)!, kind: lineKind(l.item.trim()) }));
      const known = lines.length
        ? await sql.query<{ item: string; kind: ChargeKind }>("select item, kind from billing_items where lower(btrim(item)) = any($1::text[])", [lines.map((l) => l.item.toLowerCase())])
        : [];
      const kinds = new Map(known.map((k) => [k.item.trim().toLowerCase(), k.kind]));
      // One statement: the old lines and the new ones change together or not at all.
      await sql.query(
        `with d as (delete from repair_quote_lines where quote_id = $1)
         insert into repair_quote_lines (quote_id, item, description, qty, rate, kind, sort)
         select $1, t.item, nullif(t.description, ''), t.qty, t.rate, t.kind, t.ord
           from unnest($2::text[], $3::text[], $4::numeric[], $5::numeric[], $6::text[]) with ordinality
                as t(item, description, qty, rate, kind, ord)`,
        [quoteId, lines.map((l) => l.item), lines.map((l) => l.description), lines.map((l) => l.qty), lines.map((l) => l.rate), lines.map((l) => kinds.get(l.item.toLowerCase()) ?? l.kind)],
      );
    }

    const saved = await load(sql, data);
    const detail = `repair quote: ${saved.status}, ${saved.lines.length} line${saved.lines.length === 1 ? "" : "s"}, $${saved.total.toFixed(2)}`;
    const log = (type: string, id: number) =>
      sql.query("insert into activity (entity_type, entity_id, actor_name, action, detail) values ($1, $2, $3, 'updated', $4)", [type, id, who, detail]).catch(() => undefined);
    if (saved.jobId != null) {
      const kind = (await sql.query<{ kind: string }>("select kind from service_jobs where id = $1", [saved.jobId]))[0]?.kind ?? "service";
      await log(kind, saved.jobId);
    }
    if (saved.rebuildId != null) await log("rebuild", saved.rebuildId);
    return saved;
  });

/** Cost per rebuild, for the rebuild rows: parts, labor, total and status of the one quote each project uses. */
export async function loadRebuildCosts(sql: Sql, rebuilds: { id: number; jobId: number | null }[]): Promise<Map<number, QuoteCost>> {
  const out = new Map<number, QuoteCost>();
  if (!rebuilds.length) return out;
  const quotes = (await sql.query<{ id: number; job_id: number | null; rebuild_id: number | null; status: string }>("select id, job_id, rebuild_id, status from repair_quotes")).map((q) => ({
    id: Number(q.id),
    jobId: q.job_id == null ? null : Number(q.job_id),
    rebuildId: q.rebuild_id == null ? null : Number(q.rebuild_id),
    status: q.status,
  }));
  if (!quotes.length) return out;
  const lines = await sql.query<{ quote_id: number; qty: string; rate: string; kind: ChargeKind }>("select quote_id, qty, rate, kind from repair_quote_lines");
  const byQuote = new Map<number, { qty: number; rate: number; kind: ChargeKind }[]>();
  for (const l of lines) {
    const list = byQuote.get(Number(l.quote_id)) ?? [];
    list.push({ qty: Number(l.qty), rate: Number(l.rate), kind: l.kind });
    byQuote.set(Number(l.quote_id), list);
  }
  for (const r of rebuilds) {
    const q = quoteForRebuild(r, quotes);
    if (!q) continue;
    const mine = byQuote.get(q.id) ?? [];
    out.set(r.id, { ...quoteTotals(mine), status: (QUOTE_STATUSES as readonly string[]).includes(q.status) ? (q.status as QuoteStatus) : "Draft", lines: mine.length });
  }
  return out;
}
