/**
 * Draft the exact text for each Teams chat, and record an admin's approval of that text.
 * KatzDesk does not post. Group chats and DMs are sent by the Teams login, and only after this OK.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { loadAnalyticsRows } from "@/lib/ops/analytics-api";
import { filterRows, scopeLine, summarize, type AnalyticsFilters } from "@/lib/ops/analytics";
import { invoicedPartLines } from "@/lib/ops/charges-api";
import { formatNowChicago, moneyExact, monthBounds, pmFlag, serviceFlag, todayChicago } from "@/lib/ops/clock";
import { woMatchKey } from "@/lib/ops/corrigo";
import { flagOn } from "@/lib/ops/flag";
import { profitByMpn, profitTotals } from "@/lib/ops/part-pricing";
import { accountRepFor, loadAccountMarks } from "@/lib/ops/reps";
import {
  TEAMS_CHATS,
  TEAMS_FEEDS,
  collapseDuplicateWorkOrders,
  draftAll,
  draftTeamsChat,
  serviceRegion,
  type AttentionLine,
  type OpenCall,
  type OrderLine,
  type TeamsChat,
  type TeamsDraft,
  type TeamsFeed,
  type TeamsSnapshot,
} from "@/lib/ops/teams-message";

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("./seed.server");
  await ensureSeeded();
  return getSql();
}

async function ensureDrafts(sql: Sql) {
  await sql.query(`
    create table if not exists teams_drafts (
      id serial primary key,
      chat text not null,
      body text not null,
      approved_by text not null,
      approved_at timestamptz not null default now()
    )`);
}

async function requireTeamsAdmin(sql: Sql, userId: string, what = "approve a Teams note"): Promise<string> {
  const rows = await sql.query<{ is_admin: unknown; desk_role: string | null; username: string | null }>(
    "select is_admin, desk_role, username from desk_accounts where user_id = $1",
    [userId],
  );
  const isAdmin = flagOn(rows[0]?.is_admin) || rows[0]?.desk_role === "admin";
  if (!isAdmin) throw new Error(`Only an admin can ${what}.`);
  return rows[0]?.username?.trim() || "Admin";
}

/** The chats from teams_chats. The built-in list stands in only while that table is empty. */
export async function loadTeamsChats(sql: Sql): Promise<TeamsChat[]> {
  const rows = await sql.query<{ id: string; name: string; grp: string; kind: "group" | "dm"; about: string; feed: TeamsFeed; target: string | null }>(
    "select id, name, grp, kind, about, feed, target from teams_chats order by sort, name, id",
  );
  if (!rows.length) return TEAMS_CHATS;
  return rows.map((r) => ({ id: r.id, name: r.name, group: r.grp, kind: r.kind, about: r.about, feed: r.feed, target: r.target }));
}

function thisMonth(): AnalyticsFilters {
  const bounds = monthBounds(todayChicago());
  return { from: bounds.start, to: bounds.end, types: null, rep: null, q: null };
}

async function loadSnapshot(sql: Sql): Promise<TeamsSnapshot> {
  const today = todayChicago();
  const marks = await loadAccountMarks(sql);
  const addresses = await sql.query<{ name: string; address: string | null; pin: string | null }>(
    "select name, address, geocode_address as pin from directory_customers where archived = false",
  );
  const where = new Map<string, string>();
  for (const row of addresses) {
    const key = row.name.trim().toLowerCase();
    if (!key || where.has(key)) continue;
    where.set(key, [row.address, row.pin].filter(Boolean).join(" "));
  }

  const jobs = await sql.query<{
    id: number;
    kind: string;
    call_id: string | null;
    customer: string | null;
    status: string | null;
    technician: string | null;
    technician2: string | null;
    wo: string | null;
    issue: string | null;
    scheduled: string | null;
    received: string | null;
    done: boolean;
  }>(
    `select id, kind, call_id, customer, status, technician, technician2, wo, issue, scheduled::text, received::text, done
       from service_jobs
      where duplicate_of is null and done = false`,
  );
  const pms = await sql.query<{
    id: number;
    customer: string | null;
    status: string | null;
    technician: string | null;
    wo: string | null;
    projected: string | null;
    done: boolean;
  }>(
    `select id, customer, status, technician, wo, projected::text, done from pm_jobs where done = false`,
  );

  const attention: AttentionLine[] = [];
  for (const job of jobs) {
    const flag = serviceFlag(
      { kind: job.kind === "tlc" ? "tlc" : "service", status: job.status || "Open", done: !!job.done, received: job.received, scheduled: job.scheduled },
      today,
    );
    if (!flag) continue;
    attention.push({
      label: flag.label,
      board: job.kind === "tlc" ? "TLC" : "Service",
      customer: job.customer?.trim() || "",
      tech: job.technician?.trim() || "",
      ref: job.wo?.trim() || job.call_id?.trim() || "",
    });
  }
  for (const pm of pms) {
    const flag = pmFlag({ status: pm.status || "", done: !!pm.done, projected: pm.projected }, today);
    if (!flag) continue;
    attention.push({
      label: flag.label,
      board: "PM",
      customer: pm.customer?.trim() || "",
      tech: pm.technician?.trim() || "",
      ref: pm.wo?.trim() || "",
    });
  }
  attention.sort((a, b) => a.label.localeCompare(b.label) || a.customer.localeCompare(b.customer));

  const dupRows = [
    ...jobs.filter((j) => j.wo?.trim() && j.kind !== "tlc").map((j) => ({ board: "Service", id: j.id, wo: j.wo || "", customer: j.customer })),
    ...jobs.filter((j) => j.wo?.trim() && j.kind === "tlc").map((j) => ({ board: "TLC", id: j.id, wo: j.wo || "", customer: j.customer })),
    ...pms.filter((p) => p.wo?.trim()).map((p) => ({ board: "PM", id: p.id, wo: p.wo || "", customer: p.customer })),
  ];
  const installs = await sql.query<{ id: number; customer: string | null; wo: string | null }>(
    `select id, customer, wo from installs where archived = false and complete = false and coalesce(btrim(wo), '') <> ''`,
  );
  const duplicateWo = collapseDuplicateWorkOrders(
    [...dupRows, ...installs.map((r) => ({ board: "Install", id: r.id, wo: r.wo || "", customer: r.customer }))].map((row) => ({
      key: woMatchKey(row.wo),
      wo: row.wo,
      where: `${row.board} #${Number(row.id)}${row.customer?.trim() ? ` ${row.customer.trim()}` : ""}`,
    })),
  );

  const deliveryRows = await sql.query<{ date: string | null; customer: string | null; equipment: string | null; equip_status: string | null }>(
    `select install_date::text as date, customer, equipment, equip_status
       from installs
      where archived = false and complete = false and coalesce(equip_status, '') <> 'Installed'
      order by install_date nulls last, lower(customer), id`,
  );

  const orderRows = await sql.query<{ call_id: string | null; customer: string | null; item: string; qty: string | null; kind: string; item_class: string | null }>(
    `select j.call_id, j.customer, c.item, c.qty::text, c.kind, p.item_class
       from ticket_charges c
       join service_jobs j on j.id = c.job_id
       left join lateral (
         select b.item_class from billing_items b
          where lower(btrim(b.item)) = lower(btrim(c.item)) or lower(btrim(b.sku)) = lower(btrim(c.item))
          order by (lower(btrim(b.item)) = lower(btrim(c.item))) desc
          limit 1
       ) p on true
      where j.duplicate_of is null
        and j.done = false
        and coalesce(btrim(j.po), '') = ''
        and c.kind not in ('trip', 'labor')
      order by j.id desc, c.id
      limit 80`,
  );
  const orders: OrderLine[] = orderRows.map((r) => ({
    callId: r.call_id?.trim() || "",
    customer: r.customer?.trim() || "",
    item: r.item.trim(),
    qty: r.qty != null && Number.isFinite(Number(r.qty)) ? String(Number(r.qty)) : "1",
    water: r.item_class === "Water Filters" || /water filter/i.test(r.item),
  }));

  const calls: OpenCall[] = jobs
    .filter((j) => j.kind !== "tlc")
    .map((j) => {
      const customer = j.customer?.trim() || "";
      return {
        customer,
        rep: accountRepFor(marks, customer) || "",
        tech: j.technician?.trim() || "",
        tech2: j.technician2?.trim() || "",
        region: serviceRegion(where.get(customer.toLowerCase()) || ""),
        status: j.status?.trim() || "Open",
        when: j.scheduled || "",
        issue: (j.issue || "").replace(/\s+/g, " ").trim(),
        ref: j.wo?.trim() || j.call_id?.trim() || "",
      };
    });

  const filters = thisMonth();
  const rows = filterRows(await loadAnalyticsRows(sql), filters);
  const { lines } = await invoicedPartLines(sql, { from: filters.from ?? null, to: filters.to ?? null });
  const totals = profitTotals(profitByMpn(lines), lines.length);
  return {
    when: formatNowChicago().stamp,
    attention,
    duplicateWo,
    orders,
    calls,
    deliveries: deliveryRows.map((r) => ({
      date: r.date || "",
      customer: r.customer?.trim() || "",
      equipment: r.equipment || "",
      status: r.equip_status?.trim() || "",
    })),
    kpiScope: scopeLine(filters, rows.length),
    kpi: summarize(rows).map((s) => ({
      label: s.label,
      total: s.total,
      top: s.statuses.slice(0, 3).map((x) => `${x.status} ${x.count}`).join(", "),
    })),
    finance: {
      scope: "This month, invoiced part lines.",
      sell: moneyExact(totals.sell),
      cost: moneyExact(totals.cost),
      margin: moneyExact(totals.margin),
    },
  };
}

export type TeamsChatCard = TeamsDraft & { approved: boolean; approvedAt: string | null; approvedBy: string | null };

export async function chatCards(sql: Sql): Promise<TeamsChatCard[]> {
  await ensureDrafts(sql);
  const drafts = draftAll(await loadSnapshot(sql), await loadTeamsChats(sql));
  const approvals = await sql.query<{ chat: string; body: string; approved_by: string; approved_at: string }>(
    `select distinct on (chat) chat, body, approved_by, approved_at::text
       from teams_drafts
      order by chat, id desc`,
  );
  const latest = new Map(approvals.map((r) => [r.chat, r]));
  return drafts.map((draft) => {
    const hit = latest.get(draft.id);
    const approved = !!hit && hit.body === draft.text;
    return { ...draft, approved, approvedAt: approved ? hit!.approved_at : null, approvedBy: approved ? hit!.approved_by : null };
  });
}

export async function approveChat(sql: Sql, userId: string, chatId: string, text: string): Promise<{ name: string; approvedAt: string }> {
  const who = await requireTeamsAdmin(sql, userId);
  const chat = (await loadTeamsChats(sql)).find((c) => c.id === chatId);
  if (!chat) throw new Error("That chat is not on the list.");
  await ensureDrafts(sql);
  const draft = draftTeamsChat(chat, await loadSnapshot(sql));
  if (draft.text !== text) throw new Error("The desk changed. Read the new text and approve that.");
  const saved = await sql.query<{ approved_at: string }>(
    `insert into teams_drafts (chat, body, approved_by) values ($1, $2, $3) returning approved_at::text`,
    [chat.id, draft.text, who],
  );
  return { name: chat.name, approvedAt: saved[0]?.approved_at || "" };
}

export type NewTeamsChat = { name: string; group: string; kind: string; about?: string; feed: string; target?: string | null };

function oneLine(raw: string | null | undefined, max: number): string {
  return String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export async function addChat(sql: Sql, userId: string, input: NewTeamsChat): Promise<{ id: string; name: string }> {
  const who = await requireTeamsAdmin(sql, userId, "add or remove a Teams chat");
  const name = oneLine(input.name, 80);
  if (!name) throw new Error("Give the chat a name.");
  const group = oneLine(input.group, 40);
  if (!group) throw new Error("Pick a group for the chat.");
  if (input.kind !== "group" && input.kind !== "dm") throw new Error("Pick group chat or DM.");
  const feed = TEAMS_FEEDS.find((f) => f === input.feed);
  if (!feed) throw new Error("Pick what the chat shows.");
  let target: string | null = null;
  if (feed === "rep" || feed === "tech") {
    target = oneLine(input.target, 80);
    if (!target) throw new Error(feed === "rep" ? "Type the rep's name." : "Type the tech's name.");
  } else if (feed === "region") {
    target = oneLine(input.target, 10).toLowerCase();
    if (target !== "dfw" && target !== "sa-atx" && target !== "other") throw new Error("Pick DFW, SA/ATX or Other.");
  }
  await ensureDrafts(sql);
  // A removed chat's approvals stay in teams_drafts, so a new chat never reuses its id.
  const base = name.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").slice(0, 40).replace(/^-+|-+$/g, "") || "chat";
  let id = base;
  for (let n = 2; ; n += 1) {
    const taken = await sql.query("select 1 from teams_chats where id = $1 union all select 1 from teams_drafts where chat = $1 limit 1", [id]);
    if (!taken.length) break;
    id = `${base}-${n}`;
  }
  const saved = await sql.query<{ id: string }>(
    `insert into teams_chats (id, name, grp, kind, about, feed, target, sort, created_by)
     select $1, $2, $3, $4, $5, $6, $7, coalesce(max(sort), 0) + 10, $8 from teams_chats
     on conflict (id) do nothing
     returning id`,
    [id, name, group, input.kind, oneLine(input.about, 200), feed, target, who],
  );
  if (!saved.length) throw new Error("Someone just added a chat with that name. Try again.");
  return { id, name };
}

export async function removeChat(sql: Sql, userId: string, id: string): Promise<{ name: string }> {
  await requireTeamsAdmin(sql, userId, "add or remove a Teams chat");
  const hit = (
    await sql.query<{ name: string; total: number }>("select name, (select count(*)::int from teams_chats) as total from teams_chats where id = $1", [id])
  )[0];
  if (!hit) throw new Error("That chat is not on the list.");
  if (hit.total <= 1) throw new Error("This is the last chat. Add another before you remove it.");
  // Only the chat goes. Its approved notes stay in teams_drafts.
  await sql.query("delete from teams_chats where id = $1", [id]);
  return { name: hit.name };
}

export const teamsChatBoard = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<TeamsChatCard[]> => {
    const sql = await ready();
    await requireTeamsAdmin(sql, context.userId);
    return chatCards(sql);
  });

export const approveTeamsChat = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { chat: string; text: string }) => z.object({ chat: z.string(), text: z.string().max(20_000) }).parse(d))
  .handler(async ({ data, context }): Promise<{ name: string; approvedAt: string }> => approveChat(await ready(), context.userId, data.chat, data.text));

export const addTeamsChat = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: NewTeamsChat) =>
    z
      .object({
        name: z.string().max(500),
        group: z.string().max(500),
        kind: z.string().max(20),
        about: z.string().max(1000).optional(),
        feed: z.string().max(40),
        target: z.string().max(500).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ id: string; name: string }> => addChat(await ready(), context.userId, data));

export const removeTeamsChat = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: string }) => z.object({ id: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }): Promise<{ name: string }> => removeChat(await ready(), context.userId, data.id));
