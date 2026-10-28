/**
 * Import WO Part Lines: Parts → Import → Import WO Part Lines (CSV). Admin only (the Admin role or a desk admin),
 * checked here. With apply false nothing is written: that is the preview. Save sends the file again, plans it again
 * against what is stored then, and adds the lines in one statement. A line already saved is never changed (on conflict
 * do nothing). Charges, invoices and Pull aren't touched, and nothing goes to Corrigo or NetSuite.
 */
import { createServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware } from "@/lib/ops/access";
import { PART_USES_CTE } from "@/lib/ops/part-usage-api";
import { INSTALL_WOS_SQL } from "@/lib/ops/wo-search";
import {
  WO_LINES_MAX_ROWS,
  planWoLines,
  woLineCounts,
  woRowsFromSheets,
  type LinePart,
  type WoLineCounts,
  type WoLineFacts,
  type WoLinePlanLine,
  type WoLineRow,
  type WoTicket,
} from "@/lib/ops/wo-part-lines";
import { woMatchKey } from "@/lib/ops/corrigo";

type Query = Pick<Sql, "query">;

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}

function readSheets(base64: string) {
  if (base64.length > 4_000_000) throw new Error("That file is too large.");
  const wb = XLSX.read(base64, { type: "base64", raw: true, cellText: true });
  const sheets = wb.SheetNames.map((name) => ({
    name,
    matrix: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name] ?? {}, { header: 1, defval: "", blankrows: false, raw: false }),
  }));
  if (!sheets.length) throw new Error("The file is empty.");
  return sheets;
}

/** A stored WO's digits with leading zeros dropped: the same as woMatchKey for WO-#### (wo-search.ts reads them so). */
const WO_DIGITS = (col: string) => `ltrim(regexp_replace(coalesce(${col}, ''), '[^0-9]', '', 'g'), '0')`;

/** The day a ticket came in, else its first activity entry, else when it was completed (as the Corrigo import dates it). */
const CAME_IN = (alias: string, entityType: string) => `coalesce(${alias}.received,
  (select (min(a.created_at) at time zone 'America/Chicago')::date from activity a where a.entity_type = ${entityType} and a.entity_id = ${alias}.id),
  ${alias}.completed_at)`;

const text = (v: unknown) => (v == null || v === "" ? null : String(v));

/** Every ticket carrying one of these WOs, on any board: service and TLC tickets (not merged duplicates), PMs, installs. */
async function ticketsFor(sql: Query, keys: string[]): Promise<WoTicket[]> {
  const digits = [...new Set(keys.map((k) => k.replace(/\D/g, "").replace(/^0+/, "")).filter(Boolean))];
  if (!digits.length) return [];
  const jobs = await sql.query<Record<string, unknown>>(
    `select j.id, j.kind, j.call_id, j.wo, j.status, j.customer,
            to_char(${CAME_IN("j", "j.kind")}, 'YYYY-MM-DD') as received, to_char(j.completed_at, 'YYYY-MM-DD') as completed_at
       from service_jobs j
      where j.duplicate_of is null and ${WO_DIGITS("j.wo")} = any($1::text[])`,
    [digits],
  );
  const pms = await sql.query<Record<string, unknown>>(
    `select p.id, p.wo, p.status, p.customer, sj.id as sj_id, sj.kind as sj_kind,
            to_char(${CAME_IN("p", "'pm'")}, 'YYYY-MM-DD') as received, to_char(p.completed_at, 'YYYY-MM-DD') as completed_at
       from pm_jobs p left join service_jobs sj on sj.id = p.stacked_job_id
      where ${WO_DIGITS("p.wo")} = any($1::text[])`,
    [digits],
  );
  // An install is found by any of its work orders, each dated by its own row, else by the install.
  const installs = await sql.query<Record<string, unknown>>(
    `select i.id, w.wo, i.customer, i.equip_status, i.complete,
            to_char(coalesce((select x.received from install_work_orders x where x.install_id = i.id and x.wo = w.wo limit 1),
                             ${CAME_IN("i", "'install'")}), 'YYYY-MM-DD') as received,
            to_char(i.completed_at, 'YYYY-MM-DD') as completed_at
       from installs i join ${INSTALL_WOS_SQL} w on w.install_id = i.id
      where not i.archived and i.duplicate_of is null and ${WO_DIGITS("w.wo")} = any($1::text[])`,
    [digits],
  );
  const wanted = new Set(keys);
  const out: WoTicket[] = [
    ...jobs.map((r) => {
      const board = r.kind === "tlc" ? ("tlc" as const) : ("service" as const);
      return {
        board,
        id: Number(r.id),
        wo: String(r.wo ?? ""),
        label: [text(r.call_id), text(r.wo)].filter(Boolean).join(" · ") || `#${r.id}`,
        customer: text(r.customer),
        status: text(r.status),
        received: text(r.received),
        completedAt: text(r.completed_at),
        countsOn: `${board}:${r.id}`,
      };
    }),
    ...pms.map((r) => ({
      board: "pm" as const,
      id: Number(r.id),
      wo: String(r.wo ?? ""),
      label: `PM ${text(r.wo) ?? `#${r.id}`}`,
      customer: text(r.customer),
      status: text(r.status),
      received: text(r.received),
      completedAt: text(r.completed_at),
      // A PM billed on a ticket counts its parts on that ticket, as Parts usage does.
      countsOn: r.sj_id != null ? `${r.sj_kind === "tlc" ? "tlc" : "service"}:${r.sj_id}` : `pm:${r.id}`,
    })),
    ...installs.map((r) => ({
      board: "install" as const,
      id: Number(r.id),
      wo: String(r.wo ?? ""),
      label: `Install ${text(r.wo) ?? `#${r.id}`}`,
      customer: text(r.customer),
      status: r.complete ? "Installed" : (text(r.equip_status) ?? "Not Ready"),
      received: text(r.received),
      completedAt: text(r.completed_at),
      countsOn: `install:${r.id}`,
    })),
  ];
  return out.filter((t) => wanted.has(woMatchKey(t.wo)));
}

/** What the plan needs from the database for these rows. */
async function factsFor(sql: Query, rows: WoLineRow[]): Promise<WoLineFacts> {
  const skus = [...new Set(rows.map((r) => r.sku).filter(Boolean))];
  const keys = [...new Set(rows.map((r) => r.woKey).filter(Boolean))];
  const wos = [...new Set(rows.map((r) => r.wo).filter(Boolean))];

  // The same part keys Parts usage counts the lines by.
  const partRows = skus.length
    ? await sql.query<Record<string, unknown>>(
        `with ${PART_USES_CTE}
         select tk.k, b.id, b.sku, b.item, b.description from tail_keys tk join billing_items b on b.id = tk.part_id where tk.k = any($1::text[])`,
        [skus],
      )
    : [];
  const partBySku = new Map<string, LinePart>(
    partRows.map((r) => [String(r.k), { id: Number(r.id), sku: String(r.sku ?? ""), item: String(r.item ?? ""), description: text(r.description) }]),
  );

  const tickets = await ticketsFor(sql, keys);
  const ticketKeys = [...new Set(tickets.map((t) => t.countsOn))];
  // What each of those tickets already counts, from Charges, an invoice, a PM's logged parts or QuickBooks on it.
  const uses = ticketKeys.length
    ? await sql.query<{ ticket_key: string; part_id: number }>(
        `with ${PART_USES_CTE}
         select distinct ticket_key, part_id from uses_all where rank <= 3 and ticket_key = any($1::text[])`,
        [ticketKeys],
      )
    : [];
  const ticketUses = new Set(uses.map((u) => `${u.ticket_key}|${u.part_id}`));

  const digits = [...new Set(keys.map((k) => k.replace(/\D/g, "").replace(/^0+/, "")).filter(Boolean))];
  const history = digits.length
    ? await sql.query<Record<string, unknown>>(
        `with ${PART_USES_CTE}
         select h.id, h.wo, to_char(coalesce(h.completed::date, h.invoice_date), 'YYYY-MM-DD') as day, array_agg(distinct sk.part_id) as part_ids
           from wo_history h
           join wo_history_lines l on l.history_id = h.id
           join sku_keys sk on sk.k = lower(btrim(l.item_code))
          where l.kind not in ('labor', 'trip', 'discount') and ${WO_DIGITS("h.wo")} = any($1::text[])
          group by h.id, h.wo, h.completed, h.invoice_date`,
        [digits],
      )
    : [];

  const saved = wos.length
    ? await sql.query<{ wo: string; sku: string; source: string }>("select wo, sku, source from ticket_part_lines where wo = any($1::text[])", [wos])
    : [];

  return {
    partBySku,
    tickets,
    saved: new Set(saved.map((s) => `${s.wo}|${s.sku}|${s.source}`)),
    ticketUses,
    history: history
      .map((h) => ({
        woKey: woMatchKey(String(h.wo ?? "")),
        wo: String(h.wo ?? ""),
        day: text(h.day),
        partIds: (Array.isArray(h.part_ids) ? h.part_ids : []).map(Number),
      }))
      .filter((h) => keys.includes(h.woKey)),
  };
}

export type WoLinesPreview = WoLineCounts & {
  filename: string;
  rowCount: number;
  lines: WoLinePlanLine[];
  /** Saved: the counts are what was written. */
  applied: boolean;
};

const input = z.object({ filename: z.string().max(300), base64: z.string().min(4), apply: z.boolean() });

/** The body of importWoPartLines, for one signed-in person. */
export async function importWoPartLinesFor(sql: Query, data: z.infer<typeof input>, userId: string): Promise<WoLinesPreview> {
  if (!(await canReviewNames(sql as Sql, userId))) throw new Error("Only an Admin can import WO part lines.");
  const { rows } = woRowsFromSheets(readSheets(data.base64));
  if (!rows.length) throw new Error("No rows under the header.");
  if (rows.length > WO_LINES_MAX_ROWS) {
    throw new Error(`Up to ${WO_LINES_MAX_ROWS.toLocaleString("en-US")} rows at a time; this file has ${rows.length.toLocaleString("en-US")}.`);
  }
  const plan = planWoLines(rows, await factsFor(sql, rows));
  const preview: WoLinesPreview = { filename: data.filename, rowCount: rows.length, ...woLineCounts(plan), lines: plan, applied: false };
  if (!data.apply) return preview;

  const add = plan.filter((l) => l.status === "add");
  if (!add.length) return { ...preview, applied: true };
  const who = (await sql.query<{ username: string | null }>("select username from desk_accounts where user_id = $1", [userId]))[0]?.username || "Admin";
  const on = (board: WoTicket["board"][]) => add.map((l) => (l.ticket && board.includes(l.ticket.board) ? l.ticket.id : null));
  const inserted = await sql.query<{ id: number }>(
    `insert into ticket_part_lines (job_id, pm_id, install_id, wo, item, sku, qty, qty_blank, used_on, source, source_ref, imported_by)
     select j, p, i, w, it, s, q, b, d, src, ref, $12
       from unnest($1::int[], $2::int[], $3::int[], $4::text[], $5::text[], $6::text[], $7::numeric[], $8::boolean[], $9::date[], $10::text[], $11::text[])
            as u(j, p, i, w, it, s, q, b, d, src, ref)
     on conflict do nothing
     returning id`,
    [
      on(["service", "tlc"]),
      on(["pm"]),
      on(["install"]),
      add.map((l) => l.wo),
      add.map((l) => l.item),
      add.map((l) => l.sku),
      add.map((l) => l.total),
      add.map((l) => l.totalBlank),
      add.map((l) => l.usedOn),
      add.map((l) => l.source),
      add.map((l) => (l.refs.length ? l.refs.join(", ").slice(0, 500) : null)),
      who,
    ],
  );
  // A line saved by someone else between the preview and Save counts as a duplicate, untouched.
  const lost = add.length - inserted.length;
  return { ...preview, add: inserted.length, duplicate: preview.duplicate + lost, applied: true };
}

export const importWoPartLines = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof input>) => input.parse(d))
  .handler(async ({ data, context }): Promise<WoLinesPreview> => importWoPartLinesFor(await ready(), data, context.userId));
