// Part usage (10/28, Chuy): how many tickets used each part on the Parts list, how many pieces, and when, from
// KatzDesk tickets, PM / install invoices, parts logged on PMs and the QuickBooks history. One use per ticket and part;
// a ticket written up twice counts once. All data is made up.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import * as XLSX from "xlsx";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const usage = await import("../src/lib/ops/part-usage.ts");
const api = await import("../src/lib/ops/part-usage-api.ts");
const { listPartsFor } = await import("../src/lib/ops/parts-api.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();

async function fresh() {
  const pg = new PGlite();
  for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  await pg.query("insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ('u-owner', 'chuy', true, true, 'admin')");
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  return { pg, sql };
}

/* ------------------------------------------------------------------ the plain pieces */

test("periods: last 30 / 90 days, this month and the 11 before it, this year, last year, all time", () => {
  const today = "2026-10-28";
  assert.deepEqual(usage.usageRange("30d", today), { from: "2026-09-29", to: today });
  assert.deepEqual(usage.usageRange("90d", today), { from: "2026-07-31", to: today });
  assert.deepEqual(usage.usageRange("12m", today), { from: "2025-11-01", to: today });
  assert.deepEqual(usage.usageRange("ytd", today), { from: "2026-01-01", to: today });
  assert.deepEqual(usage.usageRange("last-year", today), { from: "2025-01-01", to: "2025-12-31" });
  assert.deepEqual(usage.usageRange("all", today), { from: null, to: null });
  assert.deepEqual(usage.usageRange("12m", "2026-01-15"), { from: "2025-02-01", to: "2026-01-15" });
});

test("buckets: month, quarter and year keys, labels and runs across a new year", () => {
  assert.equal(usage.bucketKey("2026-10-28", "month"), "2026-10");
  assert.equal(usage.bucketKey("2026-10-28", "quarter"), "2026-Q4");
  assert.equal(usage.bucketKey("2026-02-01", "quarter"), "2026-Q1");
  assert.equal(usage.bucketKey("2026-10-28", "year"), "2026");
  assert.equal(usage.bucketLabel("2026-10", "month"), "Oct 2026");
  assert.equal(usage.bucketLabel("2026-Q4", "quarter"), "Q4 2026");
  assert.equal(usage.bucketLabel("2026", "year"), "2026");
  assert.deepEqual(usage.bucketKeys("2025-11-01", "2026-02-10", "month"), ["2025-11", "2025-12", "2026-01", "2026-02"]);
  assert.deepEqual(usage.bucketKeys("2025-08-20", "2026-02-10", "quarter"), ["2025-Q3", "2025-Q4", "2026-Q1"]);
  assert.deepEqual(usage.bucketKeys("2024-03-01", "2026-10-28", "year"), ["2024", "2025", "2026"]);
  assert.deepEqual(usage.bucketKeys("2026-10-28", "2026-10-01", "month"), []);
  assert.equal(usage.bucketKeys("2025-11-01", "2026-10-28", "month").length, 12);
});

const use = (partId, ticketKey, usedOn, pieces = 1, type = "service") => ({ partId, ticketKey, usedOn, pieces, type, refId: 1, historyId: null, customer: "Cafe", label: null });

test("the report ranks parts by tickets, counts each period, and counts a ticket with two parts once", () => {
  const uses = [
    use(1, "service:1", "2026-09-03", 2),
    use(1, "service:2", "2026-10-02", 1),
    use(1, "qb:9", "2025-11-15", 3, "quickbooks"),
    use(2, "service:1", "2026-09-03", 1),
    use(2, "pm:4", "2026-10-20", 5, "pm"),
    use(3, "service:5", null, 1),
  ];
  const range = usage.usageRange("12m", "2026-10-28");
  const r = usage.usageReport(uses.filter((u) => u.usedOn), "month", range);
  assert.equal(r.buckets.length, 12);
  assert.deepEqual(r.rows.map((x) => [x.partId, x.tickets, x.pieces]), [[1, 3, 6], [2, 2, 6]]);
  const oct = r.buckets.findIndex((b) => b.key === "2026-10");
  const sep = r.buckets.findIndex((b) => b.key === "2026-09");
  assert.equal(r.rows[0].byBucket[oct], 1);
  assert.equal(r.rows[0].piecesByBucket[sep], 2);
  assert.equal(r.buckets[sep].tickets, 1, "ticket 1 used two parts in September: one ticket");
  assert.equal(r.buckets[sep].pieces, 3);
  assert.deepEqual(r.stats, { parts: 2, tickets: 4, pieces: 12 });
  // Most pieces: part 2 ties part 1 on pieces and has fewer tickets, so part 1 stays first; most recent puts part 2 first.
  assert.deepEqual(usage.usageReport(uses.filter((u) => u.usedOn), "month", range, "pieces").rows.map((x) => x.partId), [1, 2]);
  assert.deepEqual(usage.usageReport(uses.filter((u) => u.usedOn), "month", range, "recent").rows.map((x) => x.partId), [2, 1]);
  // All time with no range: buckets run from the first use to the last.
  const all = usage.usageReport(uses, "year", { from: null, to: null });
  assert.deepEqual(all.buckets.map((b) => b.key), ["2025", "2026"]);
  assert.equal(all.rows.find((x) => x.partId === 3).tickets, 1, "a use with no date still counts in All time");
});

test("the line on a part reads tickets, pieces and the last day", () => {
  assert.equal(usage.usageLine({ tickets: 14, pieces: 22, firstUsed: "2024-03-03", lastUsed: "2026-10-12" }), "Used on 14 tickets · 22 pcs · last Oct 12, 2026");
  assert.equal(usage.usageLine({ tickets: 1, pieces: 1, firstUsed: "2026-10-12", lastUsed: "2026-10-12" }), "Used on 1 ticket · 1 pc · last Oct 12, 2026");
  assert.equal(usage.usageLine({ tickets: 2, pieces: 1.5, firstUsed: null, lastUsed: null }), "Used on 2 tickets · 1.5 pcs");
  assert.equal(usage.usageLine({ tickets: 0, pieces: 0, firstUsed: null, lastUsed: null }), null);
  assert.equal(usage.piecesText(1234), "1,234");
});

/* ------------------------------------------------------------------ the database */

async function seed(pg) {
  const part = async (sku, kind = "part", extra = {}) =>
    (
      await pg.query(
        "insert into billing_items (sku, item, description, kind, item_class, hidden_at, mfr_part) values ($1, $2, $3, $4, $5, $6, $7) returning id",
        [sku, `${kind === "equipment" ? "EQUIPMENT" : "PARTS"} : ${sku}`, extra.description ?? `${sku} part`, kind, extra.itemClass ?? "Parts", extra.hidden ? new Date() : null, extra.mpn ?? null],
      )
    ).rows[0].id;
  const ids = {
    filter: await part("FLT1", "part", { itemClass: "Water Filters", description: "Water filter cartridge", mpn: "WF-100" }),
    valve: await part("VALVE1"),
    gasket: await part("GSK2", "part", { hidden: true }),
    brewer: await part("BUNNITCB", "equipment", { itemClass: "Equipment" }),
    never: await part("NEVER1"),
  };
  const job = async (kind, callId, extra = {}) =>
    (
      await pg.query(
        "insert into service_jobs (kind, call_id, customer, status, wo, completed_at, scheduled, received, duplicate_of) values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id",
        [kind, callId, extra.customer ?? "Alpha Cafe", extra.status ?? "Completed", extra.wo ?? null, extra.completed ?? null, extra.scheduled ?? null, extra.received ?? "2026-01-02", extra.duplicateOf ?? null],
      )
    ).rows[0].id;
  const charge = (jobId, item, qty = 1, kind = "part") => pg.query("insert into ticket_charges (job_id, item, qty, rate, kind) values ($1, $2, $3, 10, $4)", [jobId, item, qty, kind]);
  const t = {
    a: await job("service", "SC-1", { wo: "WO-0101", completed: "2026-10-12" }),
    b: await job("tlc", "TLC-1", { completed: "2026-09-01", customer: "Beta Bar" }),
    dup: null,
    cancelled: await job("service", "SC-3", { status: "Cancelled", completed: "2026-10-01" }),
    open: await job("service", "SC-4", { status: "Open", scheduled: "2026-10-30" }),
  };
  t.dup = await job("service", "SC-2", { completed: "2026-10-05", duplicateOf: t.a });
  await charge(t.a, "PARTS : FLT1", 2); // matched by item
  await charge(t.a, "flt1 ", 1); // the same part by SKU, another line: one ticket, 3 pieces
  await charge(t.a, "PARTS : VALVE1", 1);
  await charge(t.a, "TRIPCHARGE", 1, "trip"); // not a part
  await charge(t.a, "Some typed thing", 1); // not on the list
  await charge(t.b, "VALVE1", 4);
  await charge(t.dup, "PARTS : FLT1", 9); // duplicate ticket: not counted
  await charge(t.cancelled, "PARTS : FLT1", 9); // cancelled: not counted
  await charge(t.open, "PARTS : GSK2", 1); // a hidden part still has its uses
  // A PM with an approved invoice, and the same filter logged on its machine: counted once, from the invoice.
  const pm = (await pg.query("insert into pm_jobs (customer, status, wo, completed_at) values ('Alpha Cafe', 'Completed', 'WO-0200', '2026-08-15') returning id")).rows[0].id;
  const inv = async (type, id, customer, approved = true) =>
    (await pg.query("insert into invoices (entity_type, entity_id, customer, approved_at) values ($1, $2, $3, $4) returning id", [type, id, customer, approved ? "2026-08-20T15:00:00Z" : null])).rows[0].id;
  const pmInv = await inv("pm", pm, "Alpha Cafe");
  await pg.query("insert into invoice_lines (invoice_id, item, qty, rate, kind) values ($1, 'PARTS : FLT1', 2, 30, 'part'), ($1, 'SERVICELABOR', 1, 150, 'labor')", [pmInv]);
  const logged = (pmId, item, qty, billingItemId = null) =>
    pg.query("insert into machine_parts (pm_job_id, piece_key, machine_label, item, qty, billing_item_id) values ($1, 'm1', 'Brewer', $2, $3, $4)", [pmId, item, qty, billingItemId]);
  await logged(pm, "PARTS : FLT1", 5);
  // A PM with no invoice: its logged part counts on the PM.
  const pm2 = (await pg.query("insert into pm_jobs (customer, status, completed_at) values ('Beta Bar', 'Completed', '2026-07-10') returning id")).rows[0].id;
  await logged(pm2, "unused name", 1, ids.valve);
  // A PM billed on ticket A: its logged filter counts on ticket A, which already has the filter: once, from the charge.
  const pm3 = (await pg.query("insert into pm_jobs (customer, status, stacked_job_id) values ('Alpha Cafe', 'Completed', $1) returning id", [t.a])).rows[0].id;
  await logged(pm3, "PARTS : FLT1", 7);
  // An install's approved invoice with the brewer; a removed install's doesn't count; an unapproved invoice doesn't.
  const install = async (archived = false) =>
    (await pg.query("insert into installs (customer, completed_at, wo, archived) values ('Gamma Grill', '2026-06-01', 'WO-0300', $1) returning id", [archived])).rows[0].id;
  const i1 = await install();
  await pg.query("insert into invoice_lines (invoice_id, item, qty, rate, kind) values ($1, 'EQUIPMENT : BUNNITCB', 1, 900, 'equipment')", [await inv("install", i1, "Gamma Grill")]);
  const i2 = await install(true);
  await pg.query("insert into invoice_lines (invoice_id, item, qty, rate, kind) values ($1, 'EQUIPMENT : BUNNITCB', 1, 900, 'equipment')", [await inv("install", i2, "Gamma Grill")]);
  const i3 = await install();
  await pg.query("insert into invoice_lines (invoice_id, item, qty, rate, kind) values ($1, 'EQUIPMENT : BUNNITCB', 1, 900, 'equipment')", [await inv("install", i3, "Gamma Grill", false)]);
  // QuickBooks history: one on its own (blank qty = 1 piece, a return line), one attached to ticket B.
  const run = (await pg.query("insert into wo_history_runs (filename) values ('made-up.csv') returning id")).rows[0].id;
  const hist = async (ref, customer, completed, jobId = null) =>
    (await pg.query("insert into wo_history (run_id, history_ref, wo, customer, completed, job_id) values ($1, $2, $3, $4, $5, $6) returning id", [run, ref, ref, customer, completed, jobId])).rows[0].id;
  const line = (h, code, qty, kind = "part") => pg.query("insert into wo_history_lines (history_id, line_type, kind, item_code, qty) values ($1, 'Item', $2, $3, $4)", [h, kind, code, qty]);
  const h1 = await hist("WO-1500", "Delta Diner", "2025-03-10 10:00");
  await line(h1, "FLT1", null); // 1 piece
  await line(h1, "VALVE1", 2);
  await line(h1, "SERVICELABOR", 1, "labor");
  const h2 = await hist("WO-1501", "Delta Diner", "2025-04-02 09:00");
  await line(h2, "VALVE1", 1);
  await line(h2, "VALVE1", -1); // returned on the same work order: no use left
  const h3 = await hist("WO-1502", "Beta Bar", "2026-09-01 09:00", t.b);
  await line(h3, "VALVE1", 9); // ticket B already bills the valve in KatzDesk: once, from KatzDesk
  await line(h3, "FLT1", 1); // ticket B didn't bill a filter in KatzDesk: this one counts on ticket B
  return { ids, t, pm, pm2, i1, h1 };
}

test("each ticket counts once per part, from KatzDesk before a logged part before QuickBooks", async () => {
  const { pg, sql } = await fresh();
  try {
    const { ids, t, pm, pm2, i1, h1 } = await seed(pg);
    const uses = await api.loadPartUses(sql);
    const of = (id) => uses.filter((u) => u.partId === id).map((u) => `${u.ticketKey}=${u.pieces}`).sort();
    assert.deepEqual(of(ids.filter), [`pm:${pm}=2`, `qb:${h1}=1`, `service:${t.a}=3`, `tlc:${t.b}=1`].sort());
    assert.deepEqual(of(ids.valve), [`pm:${pm2}=1`, `qb:${h1}=2`, `service:${t.a}=1`, `tlc:${t.b}=4`].sort());
    assert.deepEqual(of(ids.gasket), [`service:${t.open}=1`]);
    assert.deepEqual(of(ids.brewer), [`install:${i1}=1`]);
    assert.deepEqual(of(ids.never), []);
    const a = uses.find((u) => u.ticketKey === `service:${t.a}` && u.partId === ids.filter);
    assert.equal(a.type, "service");
    assert.equal(a.refId, t.a);
    assert.equal(a.usedOn, "2026-10-12");
    assert.equal(a.label, "SC-1 · WO-0101");
    assert.equal(a.customer, "Alpha Cafe");
    const q = uses.find((u) => u.ticketKey === `qb:${h1}` && u.partId === ids.filter);
    assert.equal(q.type, "quickbooks");
    assert.equal(q.historyId, h1);
    assert.equal(q.usedOn, "2025-03-10");
    assert.equal(q.label, "WO-1500");
    const attached = uses.find((u) => u.ticketKey === `tlc:${t.b}` && u.partId === ids.filter);
    assert.equal(attached.type, "tlc", "QuickBooks history on a KatzDesk ticket counts on that ticket");
    const pmUse = uses.find((u) => u.ticketKey === `pm:${pm}`);
    assert.equal(pmUse.usedOn, "2026-08-15", "a PM's day is the day it was completed");
    assert.equal(pmUse.label, "WO-0200");
    // Newest first.
    assert.deepEqual(uses.map((u) => u.usedOn), [...uses.map((u) => u.usedOn)].sort((x, y) => (y ?? "").localeCompare(x ?? "")));
  } finally {
    await pg.close();
  }
});

test("filters: dates, ticket types, and only the parts on the list (class, search, not hidden)", async () => {
  const { pg, sql } = await fresh();
  try {
    const { ids } = await seed(pg);
    const keys = (list) => list.map((u) => `${u.partId}:${u.ticketKey}`).sort();
    const sept = await api.loadPartUses(sql, { from: "2026-09-01", to: "2026-09-30" });
    assert.deepEqual([...new Set(sept.map((u) => u.usedOn))], ["2026-09-01"]);
    const qb = await api.loadPartUses(sql, { types: ["quickbooks"] });
    assert.ok(qb.length > 0 && qb.every((u) => u.type === "quickbooks"));
    const pmInstall = await api.loadPartUses(sql, { types: ["pm", "install"] });
    assert.deepEqual([...new Set(pmInstall.map((u) => u.type))].sort(), ["install", "pm"]);
    const listed = await api.loadPartUses(sql, { listed: {} });
    assert.ok(!listed.some((u) => u.partId === ids.gasket), "a hidden part isn't in the report");
    assert.deepEqual([...new Set((await api.loadPartUses(sql, { listed: { itemClass: "Water Filters" } })).map((u) => u.partId))], [ids.filter]);
    assert.deepEqual([...new Set((await api.loadPartUses(sql, { listed: { q: "wf-100" } })).map((u) => u.partId))], [ids.filter], "search finds the MPN");
    assert.deepEqual(keys(await api.loadPartUses(sql, { partIds: [ids.brewer] })).length, 1);
    // An open ticket with no completed day counts on its scheduled day.
    assert.equal((await api.loadPartUses(sql, { partIds: [ids.gasket] }))[0].usedOn, "2026-10-30");
  } finally {
    await pg.close();
  }
});

test("all-time totals per part for the list, and the Most used sort", async () => {
  const { pg, sql } = await fresh();
  try {
    const { ids } = await seed(pg);
    const counts = await api.partUsageCounts(sql, [ids.filter, ids.valve, ids.never]);
    assert.deepEqual(counts[ids.filter], { tickets: 4, pieces: 7, firstUsed: "2025-03-10", lastUsed: "2026-10-12" });
    assert.deepEqual(counts[ids.valve], { tickets: 4, pieces: 8, firstUsed: "2025-03-10", lastUsed: "2026-10-12" });
    assert.deepEqual(counts[ids.never], { tickets: 0, pieces: 0, firstUsed: null, lastUsed: null }, "a part never used reads 0");
    assert.deepEqual(await api.partUsageCounts(sql, []), {});
    const bySku = await listPartsFor(sql, {}, "u-owner");
    const byUse = await listPartsFor(sql, { sort: "used" }, "u-owner");
    assert.deepEqual(byUse.rows.slice(0, 3).map((r) => r.sku), ["VALVE1", "FLT1", "BUNNITCB"], "most tickets, then most pieces");
    assert.equal(byUse.rows[byUse.rows.length - 1].sku, "NEVER1");
    assert.equal(byUse.total, bySku.total);
    assert.deepEqual(new Set(byUse.rows.map((r) => r.id)), new Set(bySku.rows.map((r) => r.id)));
  } finally {
    await pg.close();
  }
});

test("one part's history and the report page", async () => {
  const { pg, sql } = await fresh();
  try {
    const { ids } = await seed(pg);
    const detail = await api.partUsageFor(sql, ids.filter);
    assert.equal(detail.totals.tickets, 4);
    assert.equal(detail.uses[0].usedOn, "2026-10-12");
    const page = await api.partUsageReportFor(sql, { period: "all", group: "year" }, "2026-10-28");
    assert.deepEqual(page.buckets.map((b) => b.key), ["2025", "2026"]);
    assert.deepEqual(page.rows.map((r) => r.part?.sku), ["VALVE1", "FLT1", "BUNNITCB"]);
    assert.equal(page.total, 3);
    assert.deepEqual(page.rows[0].byBucket, [1, 3]);
    assert.equal(page.rows[1].part.mpn, "WF-100");
    assert.equal(page.stats.parts, 3);
    const recent = await api.partUsageReportFor(sql, { period: "12m", group: "month", types: ["service", "tlc"] }, "2026-10-28");
    assert.equal(recent.buckets.length, 12);
    // Both on tickets A and B; the valve has more pieces (1 + 4 against 3 + 1).
    assert.deepEqual(recent.rows.map((r) => [r.part.sku, r.tickets, r.pieces]), [["VALVE1", 2, 5], ["FLT1", 2, 4]]);
    await assert.rejects(() => api.partUsageReportFor(sql, { period: "forever", group: "month" }, "2026-10-28"));
  } finally {
    await pg.close();
  }
});

test("the Excel download: a Parts sheet with each period, a Tickets sheet with every use, part numbers as text", async () => {
  const { pg, sql } = await fresh();
  try {
    await seed(pg);
    await pg.query("update billing_items set mfr_part = '00123' where sku = 'VALVE1'");
    const file = await api.partUsageWorkbook(sql, { period: "all", group: "year" }, "2026-10-28");
    assert.equal(file.filename, "KatzDesk_Parts_Usage_all-time_2026-10-28.xlsx");
    assert.equal(file.rows, 3);
    const book = XLSX.read(Buffer.from(file.base64, "base64"), { type: "buffer" });
    assert.deepEqual(book.SheetNames, ["Parts", "Tickets"]);
    const parts = XLSX.utils.sheet_to_json(book.Sheets.Parts, { header: 1, raw: true });
    assert.deepEqual(parts[0].slice(0, 9), ["Rank", "Part Name", "Part # (MPN)", "SKU", "Class", "Tickets", "Pieces", "First Used", "Last Used"]);
    assert.deepEqual(parts[0].slice(9), ["Tickets 2025", "Tickets 2026", "Pieces 2025", "Pieces 2026"]);
    assert.deepEqual(parts[1].slice(0, 7), [1, "VALVE1 part", "00123", "VALVE1", "Parts", 4, 8]);
    assert.equal(book.Sheets.Parts.C2.t, "s", "a part number keeps its leading zeros");
    const tickets = XLSX.utils.sheet_to_json(book.Sheets.Tickets, { header: 1, raw: true });
    assert.deepEqual(tickets[0], ["Date", "Part Name", "Part # (MPN)", "SKU", "Type", "Ticket", "Account", "Pieces"]);
    assert.equal(tickets.length - 1, 9, "every use in the report: the hidden gasket's isn't");
    assert.ok(tickets.some((r) => r[4] === "QuickBooks" && r[5] === "WO-1500"));
  } finally {
    await pg.close();
  }
});
