import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
// Keep this file off the preview database. db.ts boots PGLite on import when DATABASE_URL is unset.
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const {
  parseCsv,
  readWoHistory,
  planAccountRenames,
  planWoHistory,
  countWoPlan,
  remappedByTech,
  unmatchedNames,
  historyInvoice,
  totalsDiffer,
  saveBatches,
  srvOf,
  historyTech,
  historyDay,
  missingLines,
  lineKey,
  fillText,
  retireByAccount,
  isSaveable,
  startsTicked,
  WO_STATUS_LABEL,
} = await import("../src/lib/ops/wo-history.ts");
const api = await import("../src/lib/ops/wo-history-api.ts");
const { ensureRoster } = await import("../src/lib/ops/roster.ts");

// ── Made-up files, columns in a different order than the spec on purpose ────────────────────────────────────────────

const O_HEAD = [
  "History Ref", "WO #", "Completed", "Customer", "Service Location", "Location Source", "Tech", "Tech Status", "Call Category",
  "Service Type", "Equipment Lines", "Problem Description", "Work Done", "Parts Used", "Labor Hrs", "Trip Charges", "Parts $",
  "Item Lines $", "Invoice Total", "PO #", "Invoice Date", "Has Items", "Review Flags",
];
const L_HEAD = [
  "History Ref", "WO #", "Completed", "Customer", "Service Location", "Tech", "Line Type", "Item Code", "Item Description", "Item Class",
  "Item Group", "Qty", "Unit Price", "Amount", "Txn Type", "Invoice Date", "Invoice Customer", "Match Method",
];
const q = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ""));
const csv = (head, rows) => [head, ...rows.map((r) => head.map((h) => r[h] ?? ""))].map((r) => r.map(q).join(",")).join("\r\n") + "\r\n";

function order(o) {
  return {
    "History Ref": o.ref,
    "WO #": o.wo ?? o.ref.slice(0, 7),
    Completed: o.completed ?? "2025-03-10 10:15",
    Customer: o.customer ?? o.loc,
    "Service Location": o.loc ?? "",
    "Location Source": o.source ?? "Ticket customer",
    Tech: o.tech ?? "Ryan Gloria",
    "Tech Status": o.techStatus ?? "Active",
    "Call Category": o.category ?? "Repairs - Bunn Infusion Series",
    "Service Type": "OTHER",
    "Equipment Lines": "1",
    "Problem Description": o.problem ?? "Brewer leaking, check valve",
    "Work Done": o.work ?? "Replaced the valve.\nTested, no leaks.",
    "Parts Used": "1 x VALVE1",
    "Labor Hrs": o.labor ?? "1.5",
    "Trip Charges": "1",
    "Parts $": "40",
    "Item Lines $": "",
    "Invoice Total": o.total ?? "",
    "PO #": o.po ?? "",
    "Invoice Date": o.invDate ?? "2025-03-10",
    "Has Items": o.hasItems ?? "Yes",
    "Review Flags": o.flags ?? "",
  };
}
const line = (ref, type, code, qty, price, amount, extra = {}) => ({
  "History Ref": ref,
  "Line Type": type,
  "Item Code": code,
  "Item Description": extra.desc ?? `${code} desc`,
  "Item Class": type === "Discount" ? "Discounts" : "Inventory",
  "Item Group": "",
  Qty: qty,
  "Unit Price": price,
  Amount: amount,
  "Txn Type": "Invoice",
  "Invoice Date": extra.date ?? "2025-03-10",
  "Invoice Customer": "Test",
  "Match Method": "WO # + customer",
});

// ── Pure ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test("CSV: quotes, commas, line breaks, doubled quotes, BOM, blank lines", () => {
  const rows = parseCsv('﻿a,b,c\r\n"x, y","line1\nline2","say ""hi"""\r\n\r\n1,,3');
  assert.deepEqual(rows, [["a", "b", "c"], ["x, y", "line1\nline2", 'say "hi"'], ["1", "", "3"]]);
});

test("reading: columns by header name, numbers and dates checked, problems listed", () => {
  const oText = csv(O_HEAD.slice().reverse(), [order({ ref: "WO-1001", loc: "Alpha Cafe", total: "1,234.50" })]);
  const lText = csv(L_HEAD, [line("WO-1001", "Labor", "SERVICELABOR", "1.5", "150", "225")]);
  const r = readWoHistory(oText, lText);
  assert.deepEqual(r.problems, []);
  assert.equal(r.orders[0].invoiceTotal, 1234.5);
  assert.equal(r.orders[0].laborHours, 1.5);
  assert.equal(r.orders[0].workDone, "Replaced the valve.\nTested, no leaks.");
  assert.equal(r.lines[0].qty, 1.5);

  const bad = readWoHistory(
    csv(O_HEAD, [order({ ref: "WO-1", loc: "A" }), order({ ref: "wo-1", loc: "A" }), order({ ref: "WO-2", loc: "A", completed: "3/10/2025", labor: "lots" })]),
    csv(L_HEAD, [line("WO-9", "Part", "X", "1", "1", "1"), line("WO-2", "Widget", "X", "1", "1", "1")]),
  );
  assert.ok(bad.problems.some((p) => /line 3: History Ref wo-1 is also on line 2/.test(p)));
  assert.ok(bad.problems.some((p) => /Completed “3\/10\/2025” isn't a date/.test(p)));
  assert.ok(bad.problems.some((p) => /Labor Hrs “lots” isn't a number/.test(p)));
  assert.ok(bad.problems.some((p) => /History Ref WO-9 isn't in the Work Orders file/.test(p)));
  assert.ok(bad.problems.some((p) => /Line Type “Widget”/.test(p)));

  const missing = readWoHistory(csv(["WO #"], [{ "WO #": "x" }]), csv(L_HEAD, []));
  assert.match(missing.problems[0], /no “History Ref”, “Completed”/);
});

test("history dates always show the year", () => {
  assert.equal(historyDay("2025-04-01"), "Apr 1, 2025");
  assert.equal(historyDay("2026-07-24 08:04"), "Jul 24, 2026");
  assert.equal(historyDay(null), "—");
});

test("SRV: SRV and 4–5 digits", () => {
  assert.equal(srvOf("SRV1347"), "SRV1347");
  assert.equal(srvOf(" srv39266 "), "SRV39266");
  assert.equal(srvOf("SRV123"), null);
  assert.equal(srvOf("SRV123456"), null);
  assert.equal(srvOf("Classe 11 Service"), null);
});

test("renames: prefixes drop, punctuation matches the file, collisions are held", () => {
  const accounts = [
    { id: 1, name: "Walk - In:Water Oak Cafe and Bakery", archived: false, nameLocked: false },
    { id: 2, name: "Cimbali National Accounts:Olive Garden #1775", archived: false, nameLocked: true },
    { id: 3, name: "Walk - In:Taken Place", archived: false, nameLocked: false },
    { id: 4, name: "Taken Place", archived: false, nameLocked: false },
    { id: 5, name: "McIntyre's Richmond", archived: false, nameLocked: false },
    { id: 6, name: "Walk - In", archived: false, nameLocked: false },
    { id: 7, name: "Eversys Service:Black Rifle Coffee", archived: false, nameLocked: false },
    { id: 8, name: "Walk - In:Gone Cafe", archived: true, nameLocked: false },
  ];
  const plan = planAccountRenames(accounts, ["McIntyre's - Richmond", "Water Oak Cafe and Bakery", "Walk - In"]);
  const by = Object.fromEntries(plan.map((p) => [p.id, p]));
  assert.deepEqual(Object.keys(by).map(Number).sort(), [1, 2, 3, 5]);
  assert.deepEqual([by[1].to, by[1].parent, by[1].walkIn, by[1].status], ["Water Oak Cafe and Bakery", "Walk - In", true, "ok"]);
  assert.deepEqual([by[2].to, by[2].parent, by[2].walkIn, by[2].locked], ["Olive Garden #1775", "Cimbali National Accounts", false, true]);
  assert.equal(by[3].status, "collision");
  assert.match(by[3].reason, /“Taken Place” is already an account/);
  assert.deepEqual([by[5].kind, by[5].to], ["punctuation", "McIntyre's - Richmond"]);
});

test("techs: roster names kept, anyone else goes to Jesus Garcia with the real name kept", () => {
  const roster = ["Ryan Gloria", "Jesus Garcia", "Joshua Harper"];
  assert.deepEqual(historyTech("Ryan Gloria", roster), { technician: "Ryan Gloria", originalTech: null });
  assert.deepEqual(historyTech("Josh", roster), { technician: "Joshua Harper", originalTech: null });
  assert.deepEqual(historyTech("Elias Banda", roster), { technician: "Jesus Garcia", originalTech: "Elias Banda" });
  assert.deepEqual(historyTech("Nick Anderson", roster), { technician: "Jesus Garcia", originalTech: "Nick Anderson" });
  assert.deepEqual(historyTech("Elias Banda (deleted)", roster), { technician: "Jesus Garcia", originalTech: "Elias Banda" });
  assert.deepEqual(historyTech("Schelby Camp.", roster), { technician: "Jesus Garcia", originalTech: "Schelby Camp" });
});

const ctxBase = () => ({
  accounts: [
    { id: 1, name: "Alpha Cafe", archived: false },
    { id: 2, name: "Walk - In", archived: false },
    { id: 3, name: "Closed Diner", archived: true },
  ],
  activeTechs: ["Ryan Gloria", "Jesus Garcia"],
  savedRefs: new Set(["WO-0005"]),
  tickets: [
    { id: 50, wo: "WO-0211", customer: "alpha cafe", received: "2026-07-20", updatedAt: "t50", workDone: null, completedAt: null, duplicateOf: null },
    { id: 51, wo: "WO-0300", customer: "Alpha Cafe", received: "2026-08-01", updatedAt: "t51", workDone: null, completedAt: null, duplicateOf: null },
    { id: 52, wo: "WO-0300", customer: "Alpha Cafe", received: "2026-08-02", updatedAt: "t52", workDone: null, completedAt: null, duplicateOf: null },
  ],
  linkedJobs: new Set(),
});
const pin = (o) => ({ wo: o.ref.slice(0, 7), completed: "2026-07-24 08:04", customer: o.loc ?? "", serviceLocation: o.loc ?? "", locationSource: "Ticket customer", tech: "Ryan Gloria", ...o });

test("planning: create, attach in the window, ambiguous, retire-restore, unmatched, location needed, no change", () => {
  const plan = planWoHistory(
    [
      pin({ ref: "WO-0211 (2026-07-24)", wo: "WO-0211", loc: "Alpha Cafe" }),
      pin({ ref: "WO-0211 (2025-11-03)", wo: "WO-0211", loc: "Alpha Cafe", completed: "2025-11-03 14:24" }),
      pin({ ref: "WO-0300", loc: "Alpha Cafe", completed: "2026-08-10 09:00" }),
      pin({ ref: "WO-0400", loc: "Closed Diner" }),
      pin({ ref: "WO-0401", loc: "Nowhere Bistro" }),
      pin({ ref: "WO-0402", customer: "Walk - In", serviceLocation: "", locationSource: "Missing", tech: "Elias Banda" }),
      pin({ ref: "WO-0005", loc: "Alpha Cafe" }),
      pin({ ref: "WO-0211 (2026-04-01)", wo: "WO-0211", loc: "Alpha Cafe", completed: "2026-07-19 10:00" }),
    ],
    ctxBase(),
  );
  const s = plan.map((p) => p.status);
  assert.deepEqual(s, ["attach", "create", "ambiguous", "retire", "unmatched", "create", "same", "create"]);
  assert.deepEqual([plan[0].jobId, plan[0].seen, plan[0].account], [50, "t50", "Alpha Cafe"]);
  assert.equal(plan[1].jobId, null, "an older work order with the reused WO # is not the July ticket");
  assert.equal(plan[7].jobId, null, "completed before the ticket was received: not the same work");
  assert.match(plan[2].reason, /#51, #52/);
  assert.equal(plan[3].account, "Closed Diner");
  assert.deepEqual([plan[5].locationNeeded, plan[5].account, plan[5].technician, plan[5].originalTech], [true, "Walk - In", "Jesus Garcia", "Elias Banda"]);
  const c = countWoPlan(plan);
  assert.deepEqual(c, { create: 3, attach: 1, retire: 1, fill: 0, addLines: 0, removed: 0, unmatched: 1, ambiguous: 1, same: 1, locationNeeded: 1, remapped: 1 });
  assert.deepEqual(remappedByTech(plan), [{ tech: "Elias Banda", count: 1 }]);
  assert.deepEqual(unmatchedNames(plan), [{ name: "Nowhere Bistro", count: 1 }]);
});

test("planning: 90 days is the edge, and a ticket is only claimed once", () => {
  const ctx = ctxBase();
  ctx.tickets = [{ id: 60, wo: "WO-0700", customer: "Alpha Cafe", received: "2026-01-01", updatedAt: "x", workDone: null, completedAt: null, duplicateOf: null }];
  const at = (completed, ref = "WO-0700") => planWoHistory([pin({ ref, wo: "WO-0700", loc: "Alpha Cafe", completed })], ctx)[0];
  assert.equal(at("2026-04-01 12:00").status, "attach", "90 days after");
  assert.equal(at("2026-04-02 12:00").status, "create", "91 days after");
  assert.equal(at("2025-12-31 12:00").status, "create", "the day before it was received");
  const two = planWoHistory(
    [pin({ ref: "WO-0700 (a)", wo: "WO-0700", loc: "Alpha Cafe", completed: "2026-01-05 10:00" }), pin({ ref: "WO-0700 (b)", wo: "WO-0700", loc: "Alpha Cafe", completed: "2026-01-06 10:00" })],
    ctx,
  );
  assert.deepEqual(two.map((p) => p.status), ["attach", "ambiguous"]);
  ctx.linkedJobs = new Set([60]);
  assert.equal(at("2026-01-05 10:00").status, "ambiguous", "a ticket that already has a history row isn't attached again");
});

// ── Filling blanks on saved work orders, missing lines, retire-restore (Jesus, 11/19) ─────────────────────────────────

/** A file row with every field set, the way the Work Orders CSV gives it. */
const fullOrder = (o) => ({
  ref: o.ref,
  wo: o.wo ?? o.ref.slice(0, 7),
  completed: o.completed ?? "2026-07-24 08:04",
  customer: o.loc ?? "Test Cafe",
  serviceLocation: o.loc ?? "Test Cafe",
  locationSource: "Ticket customer",
  tech: o.tech ?? "Ryan Gloria",
  techStatus: "Active",
  callCategory: o.callCategory ?? "Repairs",
  serviceType: "OTHER",
  problem: o.problem ?? "Brewer leaking",
  workDone: o.workDone ?? "Replaced the valve.",
  partsUsed: "1 x VALVE1",
  laborHours: o.laborHours === undefined ? 1.5 : o.laborHours,
  tripCharges: o.tripCharges === undefined ? 1 : o.tripCharges,
  partsAmount: 40,
  invoiceTotal: 373.5,
  po: o.po ?? "",
  invoiceDate: o.invoiceDate === undefined ? "2026-07-25" : o.invoiceDate,
  hasItems: "Yes",
  reviewFlags: "",
});
/** A saved history row as KatzDesk has it: every field filled unless the test blanks it. */
const savedRow = (id, ref, values = {}, lines = [], jobId = null) => ({
  id,
  ref,
  jobId,
  values: {
    technician: "Ryan Gloria",
    original_tech: null,
    call_category: "Repairs",
    service_type: "OTHER",
    problem: "Brewer leaking",
    work_done: "Replaced the valve.",
    parts_used: "1 x VALVE1",
    labor_hours: 1.5,
    trip_charges: 1,
    parts_amount: 40,
    invoice_total: 373.5,
    po: "ABC",
    invoice_date: "2026-07-25",
    has_items: "Yes",
    review_flags: "Ok",
    ...values,
  },
  lines,
});
const wline = (ref, type, code, qty, price, amount, extra = {}) => ({
  ref,
  lineType: type,
  itemCode: code,
  description: extra.desc ?? `${code} desc`,
  itemClass: "",
  itemGroup: "",
  qty,
  unitPrice: price,
  amount,
  invoiceDate: extra.date ?? "2026-07-25",
  invoiceCustomer: "Test",
});
const fillCtx = (saved, extra = {}) => ({
  accounts: [{ id: 1, name: "Test Cafe", archived: false }],
  activeTechs: ["Ryan Gloria", "Jesus Garcia"],
  savedRefs: new Set(saved.map((s) => s.ref)),
  saved: new Map(saved.map((s) => [s.ref.toLowerCase(), s])),
  savedTickets: new Map(),
  tickets: [],
  linkedJobs: new Set(),
  ...extra,
});

test("fill-blank: a saved row with a blank PO #, Invoice Date and Tech plans Will Fill, (blank) → value", () => {
  const saved = savedRow(7, "WO-0900", { po: null, invoice_date: null, technician: "  " });
  const [p] = planWoHistory([fullOrder({ ref: "WO-0900", po: "SRV1347", invoiceDate: "2026-07-25", tech: "Ryan Gloria" })], fillCtx([saved]), []);
  assert.equal(p.status, "fill");
  assert.deepEqual(p.tags, ["fill"]);
  assert.equal(p.historyId, 7);
  assert.deepEqual(
    p.fills.map((f) => [f.target, f.field, f.value]),
    [
      ["history", "technician", "Ryan Gloria"],
      ["history", "po", "SRV1347"],
      ["history", "invoice_date", "2026-07-25"],
    ],
  );
  assert.equal(fillText(p.fills[1]), "PO #: (blank) → SRV1347");
  assert.match(p.reason, /Tech: \(blank\) → Ryan Gloria/);
  assert.equal(WO_STATUS_LABEL.fill, "Will Fill");
  assert.ok(startsTicked("fill") && isSaveable("fill"));
});

test("no-overwrite: a kept PO stays, and 0 is a value, not a blank", () => {
  const saved = savedRow(7, "WO-0901", { po: "ABC", labor_hours: 0, trip_charges: null });
  const [p] = planWoHistory([fullOrder({ ref: "WO-0901", po: "XYZ", laborHours: 2, tripCharges: 0 })], fillCtx([saved]), []);
  assert.deepEqual(p.fills.map((f) => [f.field, f.value]), [["trip_charges", 0]], "only the blank Trip Charges fills, with the file's 0");
  const [same] = planWoHistory([fullOrder({ ref: "WO-0901", po: "XYZ", laborHours: 2, tripCharges: null })], fillCtx([saved]), []);
  assert.equal(same.status, "same");
  assert.equal(same.reason, "Already saved; nothing blank to fill and no missing lines.");
  // A blank in the file never fills anything.
  const blankFile = planWoHistory([fullOrder({ ref: "WO-0901", po: "", tripCharges: null })], fillCtx([savedRow(7, "WO-0901", { po: null, trip_charges: null })]), []);
  assert.equal(blankFile[0].status, "same");
});

test("line dedupe: a multiset; an exact re-run adds 0; discount lines dedupe too and the invoice is recomputed", () => {
  const ref = "WO-0902";
  const filter = (n) => Array.from({ length: n }, () => wline(ref, "Filter", "7CB5S", 1, 10, 10));
  // KatzDesk has two identical filter lines; the file has three.
  assert.equal(missingLines(filter(2), filter(3)).length, 1);
  assert.equal(missingLines(filter(3), filter(3)).length, 0, "an exact re-run adds nothing");
  assert.equal(missingLines(filter(4), filter(3)).length, 0, "never more than the file has, and nothing is taken away");
  // Case and spaces in the code and description, and 2-dp numbers, are the same line; a different date is not.
  assert.equal(missingLines([wline(ref, "Part", " valve1 ", 2, 20, 40, { desc: "VALVE1 DESC" })], [wline(ref, "Part", "VALVE1", 2.001, 20, 40)]).length, 0);
  assert.equal(missingLines([wline(ref, "Part", "VALVE1", 2, 20, 40)], [wline(ref, "Part", "VALVE1", 2, 20, 40, { date: "2026-07-26" })]).length, 1);
  assert.equal(lineKey(wline(ref, "Part", "", null, null, 5, { desc: "" })), "Part|||||5|2026-07-25", "blank is its own value");

  const kd = [wline(ref, "Labor", "SERVICELABOR", 1.5, 150, 225), wline(ref, "Discount", "CLD", null, -20, -20)];
  const file = [...kd, wline(ref, "Discount", "CLD", null, -20, -20), wline(ref, "Part", "VALVE1", 2, 20, 40)];
  const [p] = planWoHistory([fullOrder({ ref })], fillCtx([savedRow(9, ref, {}, kd)]), file);
  assert.equal(p.status, "addLines");
  assert.deepEqual(p.addLines, { lines: 2, discount: 1, invoice: "Invoice WO-0902", discountTotal: 40, total: 225 });
  assert.equal(p.reason, "2 lines (1 discount) to Invoice WO-0902");
  assert.deepEqual(p.newLines.map((l) => l.itemCode), ["CLD", "VALVE1"]);
  const all = historyInvoice([...kd, ...p.newLines]);
  assert.deepEqual([all.subtotal, all.discount, all.total], [265, 40, 225]);
});

test("line keys round the way the database stores numeric(12,2): half away from zero, on the decimal digits", () => {
  const ref = "WO-0910";
  // 2.135 is 2.13499… as a double; Postgres stores 2.14. -0.125 is stored -0.13.
  assert.equal(missingLines([wline(ref, "Part", "V", 2, 2.14, 4.27)], [wline(ref, "Part", "V", 2, 2.135, 4.27)]).length, 0);
  assert.equal(missingLines([wline(ref, "Discount", "D", -0.13, 10, -1.25)], [wline(ref, "Discount", "D", -0.125, 10, -1.25)]).length, 0);
  assert.equal(missingLines([wline(ref, "Part", "V", 1, 4.02, 4.02)], [wline(ref, "Part", "V", 1, 4.015, 4.015)]).length, 0);
  assert.equal(missingLines([wline(ref, "Part", "V", 1, 4.01, 4.01)], [wline(ref, "Part", "V", 1, 4.015, 4.015)]).length, 1);
});

test("a row can be both Will Fill and Will Add Lines, counted in each", () => {
  const ref = "WO-0903";
  const [p] = planWoHistory([fullOrder({ ref, po: "P1" })], fillCtx([savedRow(3, ref, { po: "" }, [])]), [wline(ref, "Part", "VALVE1", 1, 20, 20)]);
  assert.deepEqual(p.tags, ["fill", "addLines"]);
  assert.match(p.reason, /PO #: \(blank\) → P1 · 1 line \(0 discount\) to Invoice WO-0903/);
  const c = countWoPlan([p]);
  assert.deepEqual([c.fill, c.addLines, c.same, c.create], [1, 1, 0, 0]);
});

test("a reused WO # on another date fills and adds lines only on its own row", () => {
  const a = savedRow(1, "WO-0211", { po: null }, []);
  const b = savedRow(2, "WO-0211 (2026-07-24)", { po: "KEEP" }, [wline("WO-0211 (2026-07-24)", "Part", "A", 1, 1, 1)]);
  const plan = planWoHistory(
    [fullOrder({ ref: "WO-0211", wo: "WO-0211", po: "NEW" }), fullOrder({ ref: "WO-0211 (2026-07-24)", wo: "WO-0211", po: "OTHER" })],
    fillCtx([a, b]),
    [wline("WO-0211", "Part", "A", 1, 1, 1), wline("WO-0211", "Part", "B", 1, 2, 2), wline("WO-0211 (2026-07-24)", "Part", "A", 1, 1, 1)],
  );
  assert.deepEqual(plan.map((p) => [p.ref, p.historyId, p.tags]), [
    ["WO-0211", 1, ["fill", "addLines"]],
    ["WO-0211 (2026-07-24)", 2, ["same"]],
  ]);
  assert.deepEqual(plan[0].fills.map((f) => f.value), ["NEW"]);
  assert.deepEqual(plan[0].newLines.map((l) => l.itemCode), ["A", "B"], "the other row's line A doesn't count for this one");
});

test("idempotent: plan, apply what it says, plan again → all No Change", () => {
  const ref = "WO-0904";
  const saved = savedRow(4, ref, { po: null, technician: null }, [wline(ref, "Labor", "L", 1, 100, 100)], 77);
  const ticket = { id: 77, updatedAt: "t1", technician: null, issue: "", workDone: null, completedAt: null };
  const ctx = fillCtx([saved], { savedTickets: new Map([[77, ticket]]) });
  const file = [wline(ref, "Labor", "L", 1, 100, 100), wline(ref, "Part", "P", 1, 5, 5)];
  const [first] = planWoHistory([fullOrder({ ref, po: "Q" })], ctx, file);
  assert.deepEqual(first.tags, ["fill", "addLines"]);
  // Apply it the way the save does.
  for (const f of first.fills) {
    if (f.target === "history") saved.values[f.field] = f.value;
    else ticket[{ technician: "technician", issue: "issue", work_done: "workDone", completed_at: "completedAt" }[f.field]] = f.value;
  }
  saved.lines.push(...first.newLines);
  const [again] = planWoHistory([fullOrder({ ref, po: "Q" })], ctx, file);
  assert.deepEqual([again.status, again.tags, again.fills.length, again.newLines.length], ["same", ["same"], 0, 0]);
  const c = countWoPlan([again]);
  assert.deepEqual([c.fill, c.addLines, c.retire, c.create, c.same], [0, 0, 0, 0, 1]);
});

test("retire-restore: removed-only name, an active twin wins, two removed are Ambiguous, unmatched stays unmatched", () => {
  const ctx = {
    accounts: [
      { id: 1, name: "Test Cafe", archived: false },
      { id: 2, name: "test cafe", archived: true },
      { id: 3, name: "Test Cafe - North", archived: true },
      { id: 4, name: "Twin Diner", archived: true },
      { id: 5, name: "twin diner", archived: true },
    ],
    activeTechs: ["Ryan Gloria"],
    savedRefs: new Set(),
    tickets: [],
    linkedJobs: new Set(),
  };
  const plan = planWoHistory(
    [
      fullOrder({ ref: "WO-1", loc: "Test Cafe - North" }),
      fullOrder({ ref: "WO-2", loc: "Test Cafe - North" }),
      fullOrder({ ref: "WO-3", loc: "Test Cafe" }),
      fullOrder({ ref: "WO-4", loc: "Twin Diner" }),
      fullOrder({ ref: "WO-5", loc: "Nowhere Bistro" }),
    ],
    ctx,
    [],
  );
  assert.deepEqual(plan.map((p) => p.status), ["retire", "retire", "create", "ambiguous", "unmatched"]);
  assert.deepEqual([plan[0].account, plan[0].accountId], ["Test Cafe - North", 3]);
  assert.match(plan[0].reason, /removed .*Retired/);
  assert.equal(plan[2].accountId, 1, "the active account, never the removed twin");
  assert.match(plan[3].reason, /2 removed accounts are named/);
  assert.equal(plan[4].account, null, "never created from an unmatched name");
  assert.deepEqual(retireByAccount(plan), [{ account: "Test Cafe - North", count: 2 }]);
  assert.ok(startsTicked("retire") && isSaveable("retire"));
  assert.equal(WO_STATUS_LABEL.retire, "Will Retire-Restore");
  const c = countWoPlan(plan);
  assert.deepEqual([c.retire, c.create, c.ambiguous, c.unmatched], [2, 1, 1, 1]);
});

test("ticket blanks: a blank technician or issue fills, a kept one stays", () => {
  const ref = "WO-0905";
  const saved = savedRow(5, ref, {}, [], 88);
  const ticket = { id: 88, updatedAt: "t88", technician: "Joshua Harper", issue: "  ", workDone: "Kept notes", completedAt: null };
  const [p] = planWoHistory([fullOrder({ ref, problem: "No water" })], fillCtx([saved], { savedTickets: new Map([[88, ticket]]) }), []);
  assert.equal(p.status, "fill");
  assert.equal(p.seen, "t88", "the save skips it if the ticket changed after the preview");
  assert.deepEqual(p.fills.map((f) => [f.target, f.jobId, f.field, f.value]), [
    ["ticket", 88, "issue", "No water"],
    ["ticket", 88, "completed_at", "2026-07-24"],
  ]);
  assert.equal(fillText(p.fills[0]), "Ticket #88 Issue: (blank) → No water");
  // A new attach fills the ticket's blank tech and issue too.
  const attach = planWoHistory(
    [fullOrder({ ref: "WO-0906", wo: "WO-0906", problem: "Grinder jam" })],
    {
      ...fillCtx([]),
      tickets: [{ id: 90, wo: "WO-0906", customer: "Test Cafe", received: "2026-07-20", updatedAt: "t90", workDone: null, completedAt: null, duplicateOf: null, technician: null, issue: "Kept issue" }],
    },
    [],
  )[0];
  assert.equal(attach.status, "attach");
  assert.deepEqual(attach.fills.map((f) => [f.field, f.value]), [["technician", "Ryan Gloria"]]);
});

test("invoice: labor 1.5 h + trip + 2 parts − one discount; Amount as billed; labels kept", () => {
  const inv = historyInvoice([
    { lineType: "Labor", itemCode: "SERVICELABOR", description: "Labor", qty: 1.5, unitPrice: 150, amount: 225, invoiceDate: "2025-03-11" },
    { lineType: "Trip Charge", itemCode: "TRIPCHARGE", description: "Trip", qty: 1, unitPrice: 150, amount: 150, invoiceDate: "2025-03-10" },
    { lineType: "Part", itemCode: "VALVE1", description: "Valve", qty: 2, unitPrice: 20, amount: 40, invoiceDate: "2025-03-10" },
    { lineType: "Equipment", itemCode: "ITCB", description: "Brewer", qty: 1, unitPrice: 0, amount: 0, invoiceDate: "2025-03-10" },
    { lineType: "Filter", itemCode: "7CB5S", description: "Filter", qty: 0, unitPrice: 59.95, amount: 0, invoiceDate: "2025-03-10" },
    { lineType: "Discount", itemCode: "CLDSERVICE", description: "Service Discount", qty: null, unitPrice: -41.5, amount: -41.5, invoiceDate: "2025-03-10" },
  ]);
  assert.deepEqual([inv.labor, inv.parts, inv.subtotal, inv.discount, inv.total], [375, 40, 415, 41.5, 373.5]);
  assert.equal(inv.invoiceDate, "2025-03-10");
  assert.deepEqual(inv.lines.map((l) => l.kind), ["labor", "trip", "part", "equipment", "filter"]);
  assert.equal(inv.lines.length, 5, "the discount is not a line");
  const two = historyInvoice([
    { lineType: "Part", itemCode: "A", description: "", qty: 1, unitPrice: 100, amount: 100, invoiceDate: null },
    { lineType: "Discount", itemCode: "D1", description: "", qty: null, unitPrice: -10, amount: -10, invoiceDate: null },
    { lineType: "Discount", itemCode: "D2", description: "", qty: null, unitPrice: -5.25, amount: -5.25, invoiceDate: null },
  ]);
  assert.deepEqual([two.discount, two.total], [15.25, 84.75]);
  assert.equal(totalsDiffer(84.75, 84.75), false);
  assert.equal(totalsDiffer(84.75, 91.53), true);
  assert.equal(totalsDiffer(84.75, null), false);
});

test("batches: up to 250 orders and under the byte limit; an order keeps its lines", () => {
  const orders = Array.from({ length: 600 }, (_, i) => ({ ref: `WO-${i}`, problem: "x".repeat(100) }));
  const lines = orders.flatMap((o) => [{ ref: o.ref, amount: 1 }, { ref: o.ref, amount: 2 }]);
  const b = saveBatches(orders, lines);
  assert.deepEqual(b.map((x) => x.orders.length), [250, 250, 100]);
  assert.equal(b[0].lines.length, 500);
  const small = saveBatches(orders.slice(0, 10), lines.slice(0, 20), 250, 600);
  assert.ok(small.length > 1);
  for (const part of small) for (const l of part.lines) assert.ok(part.orders.some((o) => o.ref === l.ref));
});

// ── Saving, against a fresh database ────────────────────────────────────────────────────────────────────────────────

async function fresh() {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  const sql = { query: async (text, params) => (await pg.query(text, params)).rows };
  await ensureRoster(sql);
  await pg.query("insert into directory_customers (name) values ('Alpha Cafe'), ('Walk - In'), ('Cimbali National Accounts'), ('Real Spot')");
  await pg.query("update directory_customers set archived = true where name = 'Real Spot'");
  await pg.query("insert into directory_customers (name) values ('Walk - In:Water Oak Cafe'), ('Beta Bar')");
  await pg.query("insert into billing_items (sku, item, kind) values ('VALVE1', 'PARTS : VALVE1', 'part') on conflict do nothing");
  return { pg, sql };
}

const FILE_ORDERS = [
  order({ ref: "WO-0211 (2026-07-24)", wo: "WO-0211", loc: "Alpha Cafe", completed: "2026-07-24 08:04", total: "373.50", work: "Fixed the steam boiler." }),
  order({ ref: "WO-1500", loc: "Alpha Cafe", completed: "2025-02-01 09:00", tech: "Nick Anderson", total: "400.00", flags: "Item lines $ differ from invoice total" }),
  order({ ref: "WO-1501", customer: "Walk - In", loc: "", source: "Missing", completed: "2025-02-02 09:00", total: "0", hasItems: "No (no charge)" }),
  order({ ref: "WO-1502", loc: "Real Spot", completed: "2025-02-03 09:00" }),
  order({ ref: "WO-1503", loc: "Nowhere Bistro", completed: "2025-02-04 09:00" }),
  order({ ref: "WO-1504", loc: "Water Oak Cafe", customer: "Walk - In", source: "Invoice job name", completed: "2025-02-05 09:00", po: "SRV1347" }),
];
const FILE_LINES = [
  line("WO-0211 (2026-07-24)", "Labor", "SERVICELABOR", "1.5", "150", "225"),
  line("WO-0211 (2026-07-24)", "Trip Charge", "TRIPCHARGE", "1", "150", "150"),
  line("WO-0211 (2026-07-24)", "Part", "VALVE1", "2", "20", "40"),
  line("WO-0211 (2026-07-24)", "Discount", "CLDSERVICE", "", "-41.5", "-41.5"),
  line("WO-1500", "Part", "NOTAPART", "0", "12.5", "0"),
  line("WO-1500", "Install Fee", "INSTALLATIONFEE", "1", "373.53", "373.53"),
];

function files(orders = FILE_ORDERS, lines = FILE_LINES) {
  const r = readWoHistory(csv(O_HEAD, orders), csv(L_HEAD, lines));
  assert.deepEqual(r.problems, []);
  return r;
}

async function runAll(sql, read, opts = {}) {
  const plan = await api.planOrders(sql, read.orders, read.lines);
  const include = plan.filter((p) => (opts.tickRemoved ? isSaveable(p.status) : startsTicked(p.status))).map((p) => p.ref);
  const seen = Object.fromEntries(plan.filter((p) => p.seen).map((p) => [p.ref, p.seen]));
  const runId = await api.startRun(sql, { filename: "test.csv", rowCount: read.orders.length, counts: countWoPlan(plan), who: "chuy" });
  const results = [];
  for (const b of saveBatches(read.orders, read.lines, opts.batch ?? 250)) {
    results.push(await api.saveBatch(sql, { runId, orders: b.orders, lines: b.lines, include: include.filter((r) => b.orders.some((o) => o.ref === r)), seen, who: "chuy" }));
  }
  await api.finishRun(sql, runId);
  return { plan, runId, results };
}

test("renames apply, keep the parent and Walk-In mark, move records, and hold a collision", async () => {
  const { pg, sql } = await fresh();
  await pg.query("insert into service_jobs (kind, call_id, customer, wo) values ('service', 'SC-1', 'Walk - In:Water Oak Cafe', 'WO-9')");
  await pg.query("insert into directory_customers (name) values ('Walk - In:Beta Bar')");
  const preview = await api.previewRenames(sql, ["Water Oak Cafe"]);
  assert.deepEqual(preview.map((p) => [p.from, p.to, p.status]), [
    ["Walk - In:Beta Bar", "Beta Bar", "collision"],
    ["Walk - In:Water Oak Cafe", "Water Oak Cafe", "ok"],
  ]);
  const res = await api.applyRenames(sql, { ids: preview.map((p) => p.id), locations: ["Water Oak Cafe"], who: "chuy" });
  assert.deepEqual(res.renamed.map((r) => r.to), ["Water Oak Cafe"]);
  assert.equal(res.held.length, 1);
  const acct = (await pg.query("select name, parent_account, walk_in from directory_customers where name = 'Water Oak Cafe'")).rows[0];
  assert.deepEqual(acct, { name: "Water Oak Cafe", parent_account: "Walk - In", walk_in: true });
  assert.equal((await pg.query("select customer from service_jobs where call_id = 'SC-1'")).rows[0].customer, "Water Oak Cafe");
  assert.equal((await pg.query("select count(*)::int as n from directory_customers where name = 'Beta Bar' and archived = false")).rows[0].n, 1, "no merge");
  const log = (await pg.query("select detail from activity where entity_type = 'customer'")).rows;
  assert.match(log[0].detail, /Renamed from “Walk - In:Water Oak Cafe” .*billed under Walk - In/);
});

test("saving: create, attach (blank fields only), location needed, retire-restore, unmatched skipped; rerun adds nothing; undo", async () => {
  const { pg, sql } = await fresh();
  await api.applyRenames(sql, { ids: (await api.previewRenames(sql, [])).map((p) => p.id), locations: [], who: "chuy" });
  // A live ticket with the July WO and a blank Work Done.
  await pg.query(
    "insert into service_jobs (kind, call_id, customer, wo, received, status, work_done) values ('service', 'SC-202607-1', 'Alpha Cafe', 'WO-0211', '2026-07-20', 'Completed', '')",
  );
  const job = (await pg.query("select id from service_jobs where call_id = 'SC-202607-1'")).rows[0].id;
  const read = files();
  const { plan, runId, results } = await runAll(sql, read, { batch: 2 });
  assert.deepEqual(
    plan.map((p) => [p.ref, p.status]),
    [
      ["WO-0211 (2026-07-24)", "attach"],
      ["WO-1500", "create"],
      ["WO-1501", "create"],
      ["WO-1502", "retire"],
      ["WO-1503", "unmatched"],
      ["WO-1504", "create"],
    ],
  );
  const sum = (k) => results.reduce((n, r) => n + r[k], 0);
  assert.deepEqual([sum("created"), sum("attached"), sum("filled"), sum("lines"), sum("partLines"), sum("partMatched"), sum("retired")], [4, 1, 1, 5, 3, 1, 1]);
  assert.equal(sum("discountLines"), 1, "the Discount line is stored too, but isn't an item line");
  // Past imports shows the same split as the Step 3 report; the run's counter is every line saved.
  const run1 = (await api.recentRuns(sql)).find((r) => r.id === runId);
  assert.deepEqual([run1.lines, run1.itemLines, run1.discountLines], [6, 5, 1]);
  assert.equal((await pg.query("select count(*)::int as n from wo_history_lines")).rows[0].n, 6);

  const h = (await pg.query("select * from wo_history order by history_ref")).rows;
  assert.deepEqual(h.map((r) => [r.history_ref, r.customer, r.location_needed]), [
    ["WO-0211 (2026-07-24)", "Alpha Cafe", false],
    ["WO-1500", "Alpha Cafe", false],
    ["WO-1501", "Walk - In", true],
    ["WO-1502", "Real Spot", false],
    ["WO-1504", "Water Oak Cafe", false],
  ]);
  const spot = (await pg.query("select archived, inactive, retired_at is not null as retired from directory_customers where name = 'Real Spot'")).rows[0];
  assert.deepEqual(spot, { archived: false, inactive: true, retired: true }, "the removed account comes back as Retired");
  const attached = h[0];
  assert.equal(attached.job_id, job);
  assert.equal(Number(attached.discount), 41.5);
  assert.equal(Number(attached.lines_total), 373.5);
  const nick = h[1];
  assert.deepEqual([nick.technician, nick.original_tech], ["Jesus Garcia", "Nick Anderson"]);
  const ticket = (await pg.query("select work_done, completed_at::text as completed_at, technician, issue from service_jobs where id = $1", [job])).rows[0];
  assert.deepEqual(ticket, { work_done: "Fixed the steam boiler.", completed_at: "2026-07-24", technician: "Ryan Gloria", issue: "Brewer leaking, check valve" });
  assert.equal((await pg.query("select count(*)::int as n from ticket_charges")).rows[0].n, 0, "history never writes ticket Charges");
  assert.equal((await pg.query("select count(*)::int as n from invoices")).rows[0].n, 0, "nor approved invoices");

  // The account's view, the ticket's view and the detail with its invoice.
  const alpha = await api.accountHistory(sql, "alpha cafe");
  assert.deepEqual(alpha.map((r) => r.ref), ["WO-0211 (2026-07-24)", "WO-1500"]);
  assert.equal((await api.jobHistory(sql, job))[0].ref, "WO-0211 (2026-07-24)");
  const d = await api.historyDetail(sql, alpha[0].id);
  assert.deepEqual(d.invoice, { parts: 40, labor: 375, subtotal: 415, discount: 41.5, total: 373.5, invoiceDate: "2025-03-10", differs: false });
  assert.equal(d.lines.find((l) => l.itemCode === "VALVE1").part.sku, "VALVE1");
  assert.equal(d.jobCallId, "SC-202607-1");
  const d2 = await api.historyDetail(sql, alpha[1].id);
  assert.equal(d2.invoice.differs, true, "373.53 of lines against a 400.00 QuickBooks total");
  assert.equal(d2.techNote, "Done by Nick Anderson");
  assert.deepEqual(d2.lines.map((l) => [l.lineType, l.qty]), [["Part", 0], ["Install Fee", 1]]);
  assert.equal(d2.lines[0].part, null, "an item code that isn't a part stays text");

  // The same files again: all No Change, and the save writes nothing.
  const again = await runAll(sql, read);
  assert.deepEqual(again.plan.map((p) => p.status), ["same", "same", "same", "same", "unmatched", "same"]);
  const c2 = countWoPlan(again.plan);
  assert.deepEqual([c2.fill, c2.addLines, c2.retire, c2.create], [0, 0, 0, 0]);
  for (const k of ["created", "attached", "filled", "lines", "historyFilled", "linesAdded", "retired"]) assert.equal(again.results.reduce((n, r) => n + r[k], 0), 0, `a second save writes no ${k}`);
  assert.equal((await pg.query("select count(*)::int as n from wo_history")).rows[0].n, 5);
  assert.equal((await pg.query("select count(*)::int as n from wo_history_fills")).rows[0].n, 2, "only the first run's ticket tech and issue");

  // Location Needed: put the Walk-In row on its real account.
  const need = await api.locationNeeded(sql);
  assert.deepEqual(need.map((r) => r.ref), ["WO-1501"]);
  await assert.rejects(api.setLocation(sql, { id: need[0].id, account: "Nowhere" }), /No account named/);
  assert.deepEqual(await api.setLocation(sql, { id: need[0].id, account: "beta bar" }), { account: "Beta Bar" });
  assert.equal((await api.locationNeeded(sql)).length, 0);

  // Undo the first run: its rows and lines go, the filled ticket fields are cleared, other runs stay.
  const undone = await api.undoRun(sql, { runId, who: "chuy" });
  assert.deepEqual(undone, { removed: 5, restored: 1, linesRemoved: 0, rowsCleared: 0, accountsBack: ["Real Spot"], accountsKept: [] });
  assert.deepEqual((await pg.query("select archived, inactive, retired_at from directory_customers where name = 'Real Spot'")).rows[0], { archived: true, inactive: false, retired_at: null });
  assert.equal((await pg.query("select count(*)::int as n from wo_history")).rows[0].n, 0);
  assert.equal((await pg.query("select count(*)::int as n from wo_history_lines")).rows[0].n, 0);
  const after = (await pg.query("select work_done, completed_at, technician, issue from service_jobs where id = $1", [job])).rows[0];
  assert.deepEqual(after, { work_done: null, completed_at: null, technician: null, issue: null });
  await assert.rejects(api.undoRun(sql, { runId, who: "chuy" }), /already undone/);
  const runs = await api.recentRuns(sql);
  assert.equal(runs.find((r) => r.id === runId).undoneBy, "chuy");
  assert.equal(runs.find((r) => r.id === runId).created, 4);
  assert.deepEqual(
    [runs.find((r) => r.id === runId).lines, runs.find((r) => r.id === runId).itemLines, runs.find((r) => r.id === runId).discountLines],
    [6, null, null],
    "an undone run keeps its counter; the split is gone with its lines",
  );
  await assert.rejects(
    api.saveBatch(sql, { runId, orders: read.orders, lines: read.lines, include: ["WO-1500"], seen: {}, who: "chuy" }),
    /was undone/,
  );
});

test("saving: a ticket edited after the preview is skipped, and a kept value is never overwritten", async () => {
  const { pg, sql } = await fresh();
  await pg.query(
    "insert into service_jobs (kind, call_id, customer, wo, received, status, work_done, completed_at) values ('service', 'SC-1', 'Alpha Cafe', 'WO-0211', '2026-07-20', 'Completed', 'Tech notes already here', '2026-07-23')",
  );
  const read = files([FILE_ORDERS[0], FILE_ORDERS[1]], FILE_LINES);
  const plan = await api.planOrders(sql, read.orders, read.lines);
  const seen = Object.fromEntries(plan.filter((p) => p.seen).map((p) => [p.ref, p.seen]));
  const runId = await api.startRun(sql, { filename: "t", rowCount: 2, counts: countWoPlan(plan), who: "chuy" });
  // Someone edits the ticket between the preview and the save.
  await pg.query("update service_jobs set notes = 'edited', updated_at = now() + interval '1 second' where call_id = 'SC-1'");
  const res = await api.saveBatch(sql, { runId, orders: read.orders, lines: read.lines, include: read.orders.map((o) => o.ref), seen, who: "chuy" });
  assert.deepEqual([res.created, res.attached], [1, 0]);
  assert.match(res.notSaved[0].why, /changed after the preview/);
  // Read again and save: it attaches, and the ticket's own Work Done and Completed date stay as they were.
  const plan2 = await api.planOrders(sql, read.orders, read.lines);
  const seen2 = Object.fromEntries(plan2.filter((p) => p.seen).map((p) => [p.ref, p.seen]));
  const res2 = await api.saveBatch(sql, { runId, orders: read.orders, lines: read.lines, include: [read.orders[0].ref], seen: seen2, who: "chuy" });
  assert.deepEqual([res2.attached, res2.filled], [1, 1], "only its blank tech and issue fill");
  const t = (await pg.query("select work_done, completed_at::text as c, technician, issue from service_jobs where call_id = 'SC-1'")).rows[0];
  assert.deepEqual(t, { work_done: "Tech notes already here", c: "2026-07-23", technician: "Ryan Gloria", issue: "Brewer leaking, check valve" });
  // Undo leaves a value the run didn't write, and clears the ones it did.
  await api.undoRun(sql, { runId, who: "chuy" });
  assert.deepEqual((await pg.query("select work_done, technician, issue from service_jobs where call_id = 'SC-1'")).rows[0], { work_done: "Tech notes already here", technician: null, issue: null });
});

test("a later run fills blanks and adds missing lines on saved work orders; a rerun is all No Change; undo takes back only that run", async () => {
  const { pg, sql } = await fresh();
  await pg.query(
    "insert into service_jobs (kind, call_id, customer, wo, received, status, technician, issue) values ('service', 'SC-202607-1', 'Alpha Cafe', 'WO-0211', '2026-07-20', 'Completed', 'Joshua Harper', 'Kept issue')",
  );
  const job = (await pg.query("select id from service_jobs where call_id = 'SC-202607-1'")).rows[0].id;
  // The first export: WO-1500 had no PO # or Call Category yet, and only one line.
  const first = files(
    [FILE_ORDERS[0], order({ ref: "WO-1500", loc: "Alpha Cafe", completed: "2025-02-01 09:00", po: "", category: "" })],
    [FILE_LINES[0], FILE_LINES[1], FILE_LINES[4]],
  );
  const run1 = await runAll(sql, first);
  assert.deepEqual(run1.plan.map((p) => p.status), ["attach", "create"]);
  // Someone clears the ticket's issue after the first run.
  await pg.query("update service_jobs set issue = '' where id = $1", [job]);

  // The fuller export: a PO # and Call Category, two more lines and a discount on WO-1500; WO-0211's Part and Discount lines.
  const full = files(
    [FILE_ORDERS[0], order({ ref: "WO-1500", loc: "Alpha Cafe", completed: "2025-02-01 09:00", po: "PO-9", category: "Repairs" })],
    [...FILE_LINES.slice(0, 4), FILE_LINES[4], FILE_LINES[4], line("WO-1500", "Discount", "CLD", "", "-5", "-5")],
  );
  const run2 = await runAll(sql, full);
  assert.deepEqual(run2.plan.map((p) => [p.ref, p.tags]), [
    ["WO-0211 (2026-07-24)", ["fill", "addLines"]],
    ["WO-1500", ["fill", "addLines"]],
  ]);
  assert.match(run2.plan[0].reason, /Ticket #\d+ Issue: \(blank\) → Brewer leaking, check valve · 2 lines \(1 discount\) to Invoice WO-0211/);
  assert.match(run2.plan[1].reason, /Call Category: \(blank\) → Repairs; PO #: \(blank\) → PO-9 · 2 lines \(1 discount\) to Invoice WO-1500/);
  const sum = (k) => run2.results.reduce((n, r) => n + r[k], 0);
  assert.deepEqual([sum("created"), sum("historyFilled"), sum("linesAdded"), sum("discountLinesAdded"), sum("filled")], [0, 1, 2, 2, 1]);
  const h1500 = (await pg.query("select po, call_category, discount::text, lines_total::text from wo_history where history_ref = 'WO-1500'")).rows[0];
  assert.deepEqual(h1500, { po: "PO-9", call_category: "Repairs", discount: "5.00", lines_total: "-5.00" }, "0 + 0 of lines − the 5 discount");
  const h0211 = (await pg.query("select discount::text, lines_total::text from wo_history where history_ref = 'WO-0211 (2026-07-24)'")).rows[0];
  assert.deepEqual(h0211, { discount: "41.50", lines_total: "373.50" });
  assert.equal((await pg.query("select count(*)::int as n from wo_history_lines l join wo_history h on h.id = l.history_id where h.history_ref = 'WO-1500'")).rows[0].n, 3);
  assert.equal((await pg.query("select issue from service_jobs where id = $1", [job])).rows[0].issue, "Brewer leaking, check valve");
  assert.equal((await pg.query("select technician from service_jobs where id = $1", [job])).rows[0].technician, "Joshua Harper", "a kept tech stays");
  assert.equal((await pg.query("select count(*)::int as n from ticket_charges")).rows[0].n, 0, "history never writes Charges");

  // The same files again: all No Change, and a save writes nothing.
  const run3 = await runAll(sql, full);
  assert.deepEqual(run3.plan.map((p) => p.status), ["same", "same"]);
  assert.equal((await pg.query("select count(*)::int as n from wo_history_lines")).rows[0].n, 7);

  // A ticket edited between the preview and the save is skipped.
  await pg.query("update service_jobs set issue = null where id = $1", [job]);
  const plan4 = await api.planOrders(sql, full.orders, full.lines);
  assert.equal(plan4[0].status, "fill");
  const seen4 = { [plan4[0].ref]: plan4[0].seen };
  await pg.query("update service_jobs set notes = 'edited', updated_at = now() + interval '1 second' where id = $1", [job]);
  const run4 = await api.startRun(sql, { filename: "t", rowCount: 1, counts: countWoPlan(plan4), who: "chuy" });
  const res4 = await api.saveBatch(sql, { runId: run4, orders: full.orders, lines: full.lines, include: [plan4[0].ref], seen: seen4, who: "chuy" });
  assert.match(res4.notSaved[0].why, /changed after the preview/);
  assert.equal((await pg.query("select issue from service_jobs where id = $1", [job])).rows[0].issue, null);

  // Undo the second run: its fills and lines go; the first run's work orders and lines stay.
  await pg.query("update service_jobs set issue = 'Brewer leaking, check valve' where id = $1", [job]);
  const undone = await api.undoRun(sql, { runId: run2.runId, who: "chuy" });
  assert.deepEqual([undone.removed, undone.linesRemoved, undone.rowsCleared, undone.restored], [0, 4, 2, 1]);
  assert.deepEqual((await pg.query("select po, call_category, discount::text, lines_total::text from wo_history where history_ref = 'WO-1500'")).rows[0], {
    po: null,
    call_category: null,
    discount: "0.00",
    lines_total: "0.00",
  });
  assert.equal((await pg.query("select count(*)::int as n from wo_history_lines")).rows[0].n, 3, "the first run's lines stay");
  assert.equal((await pg.query("select issue from service_jobs where id = $1", [job])).rows[0].issue, "", "back to what it was before the run");
  const runs = await api.recentRuns(sql);
  assert.equal(runs.find((r) => r.id === run1.runId).current, 2);
});

test("a 3-dp price saved once is never added again on a re-run", async () => {
  const { pg, sql } = await fresh();
  const f = files([FILE_ORDERS[1]], [line("WO-1500", "Part", "VALVE1", "2", "2.135", "4.27"), line("WO-1500", "Discount", "CLD", "-0.125", "10", "-1.25")]);
  await runAll(sql, f);
  const again = await runAll(sql, f);
  assert.deepEqual(again.plan.map((p) => p.status), ["same"]);
  assert.equal((await pg.query("select count(*)::int as n from wo_history_lines")).rows[0].n, 2);
});

test("undoing a middle run works the discount and line total out again from the lines left", async () => {
  const { pg, sql } = await fresh();
  const o = [FILE_ORDERS[1]];
  const a = line("WO-1500", "Part", "A", "1", "10", "10");
  const b = line("WO-1500", "Part", "B", "1", "20", "20");
  const c = line("WO-1500", "Part", "C", "1", "40", "40");
  await runAll(sql, files(o, [a]));
  const run2 = await runAll(sql, files(o, [a, b]));
  await runAll(sql, files(o, [a, b, c]));
  assert.equal((await pg.query("select lines_total::text from wo_history")).rows[0].lines_total, "70.00");
  await api.undoRun(sql, { runId: run2.runId, who: "chuy" });
  assert.equal((await pg.query("select count(*)::int as n from wo_history_lines")).rows[0].n, 2);
  assert.deepEqual((await pg.query("select discount::text, lines_total::text from wo_history")).rows[0], { discount: "0.00", lines_total: "50.00" });
});

test("a removed account a run restored and filled a ticket on goes back to removed on undo", async () => {
  const { pg, sql } = await fresh();
  await pg.query("update directory_customers set archived = false where name = 'Real Spot'");
  await pg.query("insert into service_jobs (kind, call_id, customer, wo, received, status, issue) values ('service', 'SC-9', 'Real Spot', 'WO-1502', '2025-01-20', 'Completed', 'Kept')");
  const job = (await pg.query("select id from service_jobs where call_id = 'SC-9'")).rows[0].id;
  await runAll(sql, files([FILE_ORDERS[3]], []));
  assert.equal((await pg.query("select job_id from wo_history")).rows[0].job_id, job);
  // The account is removed later, and the ticket's issue cleared.
  await pg.query("update directory_customers set archived = true where name = 'Real Spot'");
  await pg.query("update service_jobs set issue = null where id = $1", [job]);
  const run = await runAll(sql, files([FILE_ORDERS[3]], []));
  assert.deepEqual(run.plan[0].tags, ["retire", "fill"], "a saved row on a removed account restores it");
  assert.deepEqual((await pg.query("select archived, inactive from directory_customers where name = 'Real Spot'")).rows[0], { archived: false, inactive: true });
  const undone = await api.undoRun(sql, { runId: run.runId, who: "chuy" });
  assert.deepEqual([undone.accountsBack, undone.accountsKept], [["Real Spot"], []], "its own ticket fill isn't something added since");
  assert.equal((await pg.query("select archived from directory_customers where name = 'Real Spot'")).rows[0].archived, true);
  assert.equal((await pg.query("select issue from service_jobs where id = $1", [job])).rows[0].issue, null);
});

test("an added line with a blank invoice date saves", async () => {
  const { pg, sql } = await fresh();
  await runAll(sql, files([FILE_ORDERS[1]], [FILE_LINES[4]]));
  const read = files([FILE_ORDERS[1]], [FILE_LINES[4], FILE_LINES[5]]);
  const lines = read.lines.map((l) => (l.itemCode === "INSTALLATIONFEE" ? { ...l, invoiceDate: "" } : l));
  const runId = await api.startRun(sql, { filename: "t", rowCount: 1, counts: {}, who: "chuy" });
  const res = await api.saveBatch(sql, { runId, orders: read.orders, lines, include: ["WO-1500"], seen: {}, who: "chuy" });
  assert.equal(res.linesAdded, 1);
  assert.equal((await pg.query("select count(*)::int as n from wo_history_lines where invoice_date is null")).rows[0].n, 1);
});

test("undo leaves a retired account Retired once something was added to it", async () => {
  const { pg, sql } = await fresh();
  const { runId } = await runAll(sql, files([FILE_ORDERS[3]], []));
  assert.equal((await pg.query("select inactive from directory_customers where name = 'Real Spot'")).rows[0].inactive, true);
  await pg.query("insert into pm_jobs (customer, status, updated_at) values ('Real Spot', 'Pending Scheduling', now() + interval '1 second')");
  const undone = await api.undoRun(sql, { runId, who: "chuy" });
  assert.deepEqual([undone.removed, undone.accountsBack, undone.accountsKept], [1, [], ["Real Spot"]]);
  assert.deepEqual((await pg.query("select archived, inactive from directory_customers where name = 'Real Spot'")).rows[0], { archived: false, inactive: true });
});

test("a removed parent account holding Location Needed rows saves only when ticked, and is never restored", async () => {
  const { pg, sql } = await fresh();
  await pg.query("update directory_customers set archived = true where name = 'Walk - In'");
  const read = files([FILE_ORDERS[2]], []);
  const plan = await api.planOrders(sql, read.orders, read.lines);
  assert.equal(plan[0].status, "removed");
  assert.equal(startsTicked("removed"), false);
  await runAll(sql, read, { tickRemoved: true });
  assert.deepEqual((await pg.query("select customer from wo_history")).rows, [{ customer: "Walk - In" }]);
  assert.equal((await pg.query("select archived from directory_customers where name = 'Walk - In'")).rows[0].archived, true);
});

test("renaming an account later moves its history with it", async () => {
  const { pg, sql } = await fresh();
  await runAll(sql, files([FILE_ORDERS[1]], [FILE_LINES[4]]));
  const { renameOrMergeCustomer } = await import("../src/lib/ops/customer-identity.ts");
  const id = (await pg.query("select id from directory_customers where name = 'Alpha Cafe'")).rows[0].id;
  await renameOrMergeCustomer(sql, id, "Alpha Cafe - Main St");
  assert.deepEqual((await api.accountHistory(sql, "Alpha Cafe - Main St")).map((r) => r.ref), ["WO-1500"]);
});

test("the kept Walk-In mark: export says Yes, NetSuite import never updates it, Possible Duplicates never keeps it", async () => {
  const { customerExportRows, CUSTOMER_EXPORT_COLUMNS } = await import("../src/lib/ops/customer-export.ts");
  const col = CUSTOMER_EXPORT_COLUMNS.indexOf("Walk-In");
  const acct = { id: 1, name: "Water Oak Cafe", netsuiteId: null, accountNumber: null, address: null, billing: {}, phone: null, email: null, rep: null, archived: false, inactive: false, removalFlag: false, added: null };
  assert.equal(customerExportRows([{ ...acct, walkIn: true }])[0][col], "Yes");
  assert.equal(customerExportRows([acct])[0][col], "");

  const { readNetsuiteMatrix, planNetsuiteCustomers } = await import("../src/lib/ops/netsuite-customers.ts");
  const nsCsv = ["Internal ID,Company Name,Phone", "77,Water Oak Cafe,713-555-0100"].join("\r\n");
  const rows = readNetsuiteMatrix(parseCsv(nsCsv)).rows;
  const nsAcct = (walkIn) => ({
    id: 9, name: "Water Oak Cafe", archived: false, updatedAt: "x", netsuiteId: null, accountNumber: null, address: null,
    billing: { line1: null, line2: null, city: null, state: null, zip: null, country: null }, primaryContact: null, phone: null, email: null, inactive: false, walkIn,
  });
  const [kept] = planNetsuiteCustomers(rows, [nsAcct(true)]);
  assert.match(kept.reason ?? "", /Walk-In accounts are never updated/);
  const [plain] = planNetsuiteCustomers(rows, [nsAcct(false)]);
  assert.equal(plain.status, "update");

  const { findPossibleDuplicates } = await import("../src/lib/ops/customer-dupes.ts");
  const dupe = (id, name, walkIn) => ({ id, name, address: "1 Main St, Houston, TX 77002", phone: "713-555-0100", email: null, netsuiteId: null, accountNumber: null, inactive: false, history: id === 1 ? 9 : 0, walkIn });
  const [pair] = findPossibleDuplicates(new Set([2]), [dupe(1, "Water Oak Cafe", true), dupe(2, "Water Oak Bakery", false)]);
  assert.ok(pair, "same address and phone is a pair");
  assert.equal(pair.keep?.id, 2, "never the Walk-In, even with more history");
});

// ── Line costs (Jesus, 11/24) ────────────────────────────────────────────────────────────────────────────────────────

const C = await import("../src/lib/ops/wo-history.ts");
const C_HEAD = ["Cost Flag", "History Ref", "Line Sort", "Line Type", "Item Code", "Qty", "Unit Price", "Amount", "Unit Cost", "Line Cost", "Cost Basis", "Cost Date", "Cost Source"];
const costRow = (ref, sort, type, code, qty, price, amount, unit, lineCost, extra = {}) => ({
  "History Ref": ref,
  "Line Sort": String(sort),
  "Line Type": type,
  "Item Code": code,
  Qty: qty,
  "Unit Price": price,
  Amount: amount,
  "Unit Cost": unit,
  "Line Cost": lineCost,
  "Cost Basis": extra.basis ?? "last_on_or_before",
  "Cost Date": extra.date ?? "2025-01-15",
  "Cost Source": extra.source ?? "quickbooks",
  "Cost Flag": extra.flag ?? "",
});
const readCosts = (rows) => C.readHistoryLineCosts(csv(C_HEAD, rows));

test("line costs: reading by header name, with every check", () => {
  const ok = readCosts([
    costRow("WO-1", 2, "Part", "VALVE1", "2", "20", "40", "12.005", "24.01"),
    costRow("WO-1", 3, "Filter", "F 1", "", "9", "9", "3", "3", { basis: "wtd_avg", date: "" }),
    costRow("WO-2", 0, "Part", "X", "1", "5", "5", "1", "1", { basis: "first_after", flag: "Cost from later purchase" }),
  ]);
  assert.deepEqual(ok.problems, []);
  assert.equal(ok.rows.length, 3);
  assert.deepEqual(
    { sort: ok.rows[0].sort, unitCost: ok.rows[0].unitCost, lineCost: ok.rows[0].lineCost, basis: ok.rows[0].costBasis, date: ok.rows[0].costDate, flag: ok.rows[0].costFlag },
    { sort: 2, unitCost: 12.005, lineCost: 24.01, basis: "last_on_or_before", date: "2025-01-15", flag: null },
  );
  assert.equal(ok.rows[1].qty, null, "a blank Qty stays blank; the line-cost check counts it as 1");
  assert.equal(ok.rows[1].costDate, null);
  assert.equal(ok.rows[2].costFlag, "Cost from later purchase");

  const bad = readCosts([
    costRow("WO-1", 0, "Part", "A", "1", "5", "5", "-1", "-1"),
    costRow("WO-1", 1, "Part", "A", "2", "5", "10", "3", "6.02"),
    costRow("WO-1", 2, "Part", "A", "1", "5", "5", "1", "1", { basis: "fifo" }),
    costRow("WO-1", 3, "Part", "A", "1", "5", "5", "1", "1", { date: "01/15/2025" }),
    costRow("WO-1", 4, "Discount", "CLD", "", "-5", "-5", "0", "0"),
    costRow("WO-1", 5, "Labor", "SERVICELABOR", "1", "150", "150", "0", "0"),
    costRow("WO-1", 6, "Trip Charge", "TRIP", "1", "150", "150", "0", "0"),
    costRow("WO-1", 6, "Part", "A", "1", "5", "5", "1", "1"),
    costRow("WO-1", 7, "Part", "A", "1", "5", "5", "1", "1", { source: "netsuite" }),
  ]);
  assert.equal(bad.rows.length, 0);
  assert.match(bad.problems.join("\n"), /Line Sort 6 is also on line 8/);
  assert.match(bad.problems.join("\n"), /Unit Cost -1 is below zero/);
  assert.match(bad.problems.join("\n"), /Line Cost 6\.02 isn't Qty × Unit Cost \(2 × 3 = 6\)/);
  assert.match(bad.problems.join("\n"), /Cost Basis “fifo”/);
  assert.match(bad.problems.join("\n"), /Cost Date “01\/15\/2025” isn't YYYY-MM-DD/);
  assert.match(bad.problems.join("\n"), /a Discount line doesn't take a cost/);
  assert.match(bad.problems.join("\n"), /a Labor line doesn't take a cost/);
  assert.match(bad.problems.join("\n"), /a Trip Charge line doesn't take a cost/);
  assert.match(bad.problems.join("\n"), /Cost Source “netsuite”/);
  assert.ok(readCosts([costRow("WO-1", 1, "Part", "A", "2", "5", "10", "3", "6.01")]).problems.length === 0, "within a cent passes");
  assert.match(readCosts([costRow("WO-1", 1, "Part", "A", "1", "5", "5", "1", "1"), costRow("wo-1", 1, "Part", "A", "1", "5", "5", "1", "1")]).problems[0], /also on line 2/);
  assert.match(C.readHistoryLineCosts("History Ref,Line Sort\nWO-1,0\n").problems[0], /no “Line Type”/);
});

const savedLine = (id, sort, lineType, itemCode, qty, amount, cost = {}) => ({
  id, sort, lineType, itemCode, qty, amount,
  unitCost: cost.unitCost ?? null, lineCost: cost.lineCost ?? null, costBasis: cost.costBasis ?? null, costDate: cost.costDate ?? null, costSource: cost.costSource ?? null, costFlag: cost.costFlag ?? null,
});

test("line costs: the planner gives each status, and a wrong item at the right sort is a Mismatch", () => {
  const rows = readCosts([
    costRow("WO-1", 0, "Part", "VALVE 1", "2", "20", "40", "12", "24"), // fill (item matches with spaces and case)
    costRow("WO-1", 1, "Part", "GASKET", "1", "5", "5", "2", "2"), // same
    costRow("WO-1", 2, "Part", "PUMP", "1", "50", "50", "30", "30"), // different
    costRow("WO-1", 3, "Part", "WRONG", "1", "5", "5", "1", "1"), // mismatch: wrong item at the right sort
    costRow("WO-1", 9, "Part", "VALVE1", "1", "5", "5", "1", "1"), // mismatch: no such sort
    costRow("WO-1", 4, "Part", "SEAL", "1", "5", "6", "1", "1"), // mismatch: amount off
    costRow("WO-9", 0, "Part", "A", "1", "5", "5", "1", "1"), // noHistory
    costRow("WO-2", 0, "Part", "A", "1", "5", "5", "1", "1"), // removed
  ]).rows;
  const saved = new Map([
    ["wo-1", { historyId: 1, customer: "Alpha Cafe", removed: false, lines: [
      savedLine(10, 0, "Part", "valve1", 2, 40),
      savedLine(11, 1, "Part", "GASKET", 1, 5, { unitCost: 2, lineCost: 2, costBasis: "last_on_or_before", costDate: "2025-01-15", costSource: "quickbooks" }),
      savedLine(12, 2, "Part", "PUMP", 1, 50, { unitCost: 25, lineCost: 25, costBasis: "last_on_or_before", costDate: "2025-01-15", costSource: "quickbooks" }),
      savedLine(13, 3, "Part", "RIGHT", 1, 5),
      savedLine(14, 4, "Part", "SEAL", 1, 5),
    ] }],
    ["wo-2", { historyId: 2, customer: "Gone Place", removed: true, lines: [savedLine(20, 0, "Part", "A", 1, 5)] }],
  ]);
  const plan = C.planLineCosts(rows, saved);
  assert.deepEqual(plan.map((p) => p.status), ["fill", "same", "different", "mismatch", "mismatch", "mismatch", "noHistory", "removed"]);
  assert.equal(plan[0].lineId, 10);
  assert.equal(plan[3].lineId, null, "a Mismatch never carries a line to write");
  assert.match(plan[3].reason, /item is RIGHT, the file says WRONG/);
  assert.match(plan[4].reason, /No saved line has Line Sort 9/);
  assert.match(plan[5].reason, /amount is 5, the file says 6/);
  assert.equal(plan[2].saved.unitCost, 25, "Has Different Cost shows what's saved");
  assert.equal(plan.filter((p) => C.lineCostStartsTicked(p.status)).length, 1, "only Will Fill starts ticked");
  assert.ok(C.lineCostSaveable("removed") && !C.lineCostSaveable("different") && !C.lineCostSaveable("mismatch"));
  const n = C.countLineCostPlan(plan);
  assert.deepEqual([n.fill, n.same, n.different, n.mismatch, n.noHistory, n.removed, n.fillSell, n.fillCost, n.fillProfit], [1, 1, 1, 3, 1, 1, 40, 24, 16]);
});

/** Save the default ticked plan (or the lines given) under a new cost run, as the screen does. */
async function saveCosts(sql, rows, opts = {}) {
  const plan = await api.previewLineCosts(sql, rows);
  const ticked = plan.filter((p) => (opts.pick ? opts.pick(p) : C.lineCostStartsTicked(p.status)) && p.lineId != null);
  const runId = await api.startCostRun(sql, { filename: "costs.csv", rowCount: rows.length, counts: C.countLineCostPlan(plan), who: "chuy" });
  let filled = 0;
  let skipped = 0;
  for (const b of C.lineCostBatches(ticked, opts.batch ?? 1000)) {
    const r = await api.saveCostBatch(sql, { runId, rows: b.map((p) => ({ ...p.row, lineId: p.lineId })) });
    filled += r.filled;
    skipped += r.skipped;
  }
  await api.finishRun(sql, runId);
  return { plan, runId, filled, skipped };
}

const WO = "WO-0211 (2026-07-24)";
const costFile = () =>
  readCosts([
    costRow(WO, 2, "Part", "VALVE1", "2", "20", "40", "12", "24"),
    costRow("WO-1500", 0, "Part", "NOTAPART", "0", "12.5", "0", "4", "0"),
    costRow("WO-1500", 1, "Install Fee", "INSTALLATIONFEE", "1", "373.53", "373.53", "100", "100", { flag: "Non-parts QB category" }),
  ]).rows;

test("line costs: save fills blanks only, never overwrites, and a re-run fills nothing", async () => {
  const { pg, sql } = await fresh();
  await runAll(sql, files());
  // A line someone already costed by hand stays as it is.
  await pg.query("update wo_history_lines set unit_cost = 99, line_cost = 99, cost_source = 'hand' where item_code = 'INSTALLATIONFEE'");
  const first = await saveCosts(sql, costFile(), { batch: 1 });
  assert.deepEqual(first.plan.map((p) => p.status), ["fill", "fill", "different"]);
  assert.deepEqual([first.filled, first.skipped], [2, 0]);
  const rows = (await pg.query("select item_code, unit_cost::text, line_cost::text, cost_basis, cost_date::text, cost_source, cost_run_id from wo_history_lines where unit_cost is not null order by item_code")).rows;
  assert.deepEqual(rows, [
    { item_code: "INSTALLATIONFEE", unit_cost: "99.0000", line_cost: "99.00", cost_basis: null, cost_date: null, cost_source: "hand", cost_run_id: null },
    { item_code: "NOTAPART", unit_cost: "4.0000", line_cost: "0.00", cost_basis: "last_on_or_before", cost_date: "2025-01-15", cost_source: "quickbooks", cost_run_id: first.runId },
    { item_code: "VALVE1", unit_cost: "12.0000", line_cost: "24.00", cost_basis: "last_on_or_before", cost_date: "2025-01-15", cost_source: "quickbooks", cost_run_id: first.runId },
  ]);
  assert.equal((await pg.query("select kind, lines from wo_history_runs where id = $1", [first.runId])).rows[0].kind, "line_costs");

  // Forcing the different line through the save still doesn't overwrite it.
  const forced = await saveCosts(sql, costFile(), { pick: () => true });
  assert.deepEqual(forced.plan.map((p) => p.status), ["same", "same", "different"]);
  assert.deepEqual([forced.filled, forced.skipped], [0, 3]);
  assert.equal((await pg.query("select unit_cost::text from wo_history_lines where item_code = 'INSTALLATIONFEE'")).rows[0].unit_cost, "99.0000");

  // A line edited after the preview (here: its amount) is skipped by the save's own check.
  await pg.query("update wo_history_lines set unit_cost = null, line_cost = null, cost_basis = null, cost_date = null, cost_source = null, cost_run_id = null, cost_run_values = null where item_code = 'VALVE1'");
  const plan = await api.previewLineCosts(sql, costFile());
  await pg.query("update wo_history_lines set amount = 41 where item_code = 'VALVE1'");
  const runId = await api.startCostRun(sql, { filename: "x.csv", rowCount: 1, counts: C.countLineCostPlan(plan), who: "chuy" });
  const r = await api.saveCostBatch(sql, { runId, rows: [{ ...plan[0].row, lineId: plan[0].lineId }] });
  assert.deepEqual(r, { filled: 0, skipped: 1 });
});

test("line costs: Removed Account starts unticked; ticked, it saves", async () => {
  const { pg, sql } = await fresh();
  await runAll(sql, files());
  await pg.query("update wo_history set customer = 'Gone Place' where history_ref = 'WO-1500'");
  const { plan, filled } = await saveCosts(sql, costFile());
  assert.deepEqual(plan.map((p) => p.status), ["fill", "removed", "removed"]);
  assert.equal(filled, 1);
  const ticked = await saveCosts(sql, costFile(), { pick: (p) => C.lineCostSaveable(p.status) });
  assert.equal(ticked.filled, 2);
});

test("line costs: undo clears only what the run wrote and is unchanged; a hand edit stays; history undo is as before", async () => {
  const { pg, sql } = await fresh();
  const hist = await runAll(sql, files());
  const { runId } = await saveCosts(sql, costFile());
  await pg.query("update wo_history_lines set unit_cost = 13, line_cost = 26 where item_code = 'VALVE1'");
  const runs = await api.recentRuns(sql);
  const mine = runs.find((r) => r.id === runId);
  assert.deepEqual([mine.kind, mine.costLines], ["line_costs", 3]);
  assert.equal(runs.find((r) => r.id === hist.runId).kind, "history");

  await assert.rejects(() => api.undoRun(sql, { runId, who: "chuy" }), "the history undo never takes a cost run");
  const u = await api.undoAnyRun(sql, { runId, who: "chuy" });
  assert.deepEqual(u, { kind: "line_costs", cleared: 2, kept: 1 });
  const left = (await pg.query("select item_code, unit_cost::text, line_cost::text from wo_history_lines where unit_cost is not null")).rows;
  assert.deepEqual(left, [{ item_code: "VALVE1", unit_cost: "13.0000", line_cost: "26.00" }]);
  assert.equal((await pg.query("select count(*)::int as n from wo_history_lines")).rows[0].n, 6, "nothing is deleted");
  await assert.rejects(() => api.undoAnyRun(sql, { runId, who: "chuy" }), /already undone/);

  // Undoing the history run still removes its work orders (and their lines).
  const h = await api.undoAnyRun(sql, { runId: hist.runId, who: "chuy" });
  assert.equal(h.kind, "history");
  assert.equal(h.removed, 4);
  assert.equal((await pg.query("select count(*)::int as n from wo_history")).rows[0].n, 0);
});

test("history profit: after the discount on the invoice, nothing for a non-cost viewer, Service Dept never in profit", async () => {
  const { pg, sql } = await fresh();
  await runAll(sql, files());
  await saveCosts(sql, costFile());
  const id = (await pg.query("select id from wo_history where history_ref = $1", [WO])).rows[0].id;

  const d = await api.historyDetail(sql, id, { showCost: true });
  // 225 labor + 150 trip + 40 part − 41.50 discount; parts cost 24.
  assert.deepEqual(
    { subtotal: d.invoice.subtotal, discount: d.invoice.discount, cost: d.invoice.cost.cost, profit: d.invoice.cost.profit, margin: d.invoice.cost.margin, costed: d.invoice.cost.costedLines, of: d.invoice.cost.totalLines },
    { subtotal: 415, discount: 41.5, cost: 24, profit: 349.5, margin: 93.6, costed: 1, of: 1 },
  );
  assert.equal(d.invoice.cost.note, "Parts cost only; labor cost not included");
  const part = d.lines.find((l) => l.itemCode === "VALVE1");
  assert.equal(part.cost.discountShare, 4, "40 of 415 of the 41.50 discount");
  assert.equal(part.cost.profit, 12, "40 − 4 − 24");
  assert.equal(d.lines.find((l) => l.kind === "labor").cost.lineCost, null);

  const plain = await api.historyDetail(sql, id);
  assert.equal(plain.invoice.cost, undefined);
  assert.ok(plain.lines.every((l) => l.cost === undefined));
  assert.doesNotMatch(JSON.stringify(plain), /unitCost|lineCost|costBasis|"profit"/);
  const acct = await api.accountHistory(sql, "Alpha Cafe");
  assert.ok(acct.every((h) => h.cost === undefined));
  const acctCost = await api.accountHistory(sql, "Alpha Cafe", { showCost: true });
  const row = acctCost.find((h) => h.ref === WO);
  assert.deepEqual([row.cost.cost, row.cost.profit, row.cost.costedLines, row.cost.totalLines], [24, 349.5, 1, 1]);

  // Service Dept: cost shown, never a profit.
  await pg.query("insert into directory_customers (name) values ('Katz Coffee Service Dept.')");
  await pg.query("update wo_history set customer = 'Katz Coffee Service Dept.' where id = $1", [id]);
  const internal = await api.historyDetail(sql, id, { showCost: true });
  assert.deepEqual([internal.invoice.cost.cost, internal.invoice.cost.profit, internal.invoice.cost.internal], [24, null, true]);
  assert.equal(internal.lines.find((l) => l.itemCode === "VALVE1").cost.profit, null);
});

test("profit report: QuickBooks history by year and customer, apart; Service Dept and tickets already billed left out", async () => {
  const { pg, sql } = await fresh();
  await pg.query("insert into service_jobs (kind, call_id, customer, wo, received, status) values ('service', 'SC-202607-1', 'Alpha Cafe', 'WO-0211', '2026-07-20', 'Completed')");
  await runAll(sql, files());
  await saveCosts(sql, costFile());
  await pg.query("update wo_history set invoice_date = '2026-07-24' where history_ref = $1", [WO]);
  const R = await import("../src/lib/ops/profit-report-api.ts");
  const P = await import("../src/lib/ops/profit-report.ts");
  const all = await R.historyProfitSection(sql, {});
  // WO-0211 (2026): 415 sell, 41.50 off, 24 cost. WO-1500 (2025): 373.53 sell, cost 0 (NOTAPART) + 100 (install fee).
  // WO-1501 has no lines; WO-1504 (2025) has none either.
  assert.deepEqual(all.byYear.map((g) => [g.label, g.bills, g.sell, g.discount, g.cost, g.profit, g.uncostedSell]), [
    ["2025", 1, 373.53, 0, 100, 273.53, 0],
    ["2026", 1, 415, 41.5, 24, 349.5, 0],
  ]);
  assert.deepEqual([all.totals.bills, all.totals.sell, all.totals.profit], [2, 788.53, 623.03]);
  assert.deepEqual(all.byCustomer.map((g) => [g.label, g.bills]), [["Alpha Cafe", 2]]);
  assert.match(all.note, /^Parts cost only; labor cost not included$/);

  const job = (await pg.query("select job_id from wo_history where history_ref = $1", [WO])).rows[0].job_id;
  assert.ok(job != null, "WO-0211 is on its ticket");
  // Its ticket is billed (Sales Order, a charge), on a day after July.
  await pg.query("update service_jobs set ns_so = 'SO-1', billed_at = '2026-08-02' where id = $1", [job]);
  await pg.query("insert into ticket_charges (job_id, item, qty, rate) values ($1, 'VALVE1', 1, 20)", [job]);
  await pg.query("update wo_history set customer = 'Katz Coffee Service Dept.' where history_ref = 'WO-1500'");
  const left = await R.historyProfitSection(sql, { from: "2024-01-01", to: "2026-12-31" });
  assert.deepEqual(left.excluded, { serviceDept: 1, billedTicket: 1 });
  assert.match(left.note, /1 Service Dept left out/);
  // The exclusion doesn't depend on the range: a ticket billed after the range still keeps its history row out.
  {
    const july = await R.historyProfitSection(sql, { from: "2026-07-01", to: "2026-07-31" });
    assert.deepEqual([july.totals.bills, july.excluded.billedTicket], [0, 1]);
    await pg.query("update service_jobs set ns_so = null where id = $1", [job]);
    const unbilled = await R.historyProfitSection(sql, { from: "2026-07-01", to: "2026-07-31" });
    assert.deepEqual([unbilled.totals.bills, unbilled.excluded.billedTicket], [1, 0], "an unbilled ticket's history counts");
  }
  const only2025 = await R.historyProfitSection(sql, { from: "2025-01-01", to: "2025-12-31" });
  assert.deepEqual([only2025.totals.bills, only2025.excluded.serviceDept], [0, 1], "the range applies; Service Dept is left out");

  // The downloads carry the section as its own two tables, after the job-type and customer tables.
  const file = P.buildProfitReportFile({ byType: [], byCustomer: [], totals: P.groupTotals([]), history: all }, { generated: "now", scope: "All" });
  assert.deepEqual(file.extra.map((t) => [t.title, t.sheet, t.rows.length]), [
    ["QuickBooks history (2024–2026): By Year", "QB History By Year", 3],
    ["QuickBooks history (2024–2026): By Customer", "QB History By Customer", 1],
  ]);
  assert.deepEqual(file.extra[0].rows[2], ["Total", "2", "$788.53", "$41.50", "$124.00", "$623.03", "83.4%", "$0.00", "0"]);
  const { reportSheets } = await import("../src/lib/ops/analytics.ts");
  assert.deepEqual(reportSheets(file).map((s) => s.name), ["By Job Type", "By Customer", "QB History By Year", "QB History By Customer"]);
});

test("line costs: the server repeats the file checks, and never costs a labor, trip or discount line", async () => {
  const { pg, sql } = await fresh();
  await runAll(sql, files());
  assert.match(readCosts([costRow(WO, 2, "Part", "VALVE1", "2", "20", "40", "12", "24", { date: "2025-02-30" })]).problems[0], /Cost Date “2025-02-30”/);
  const plan = await api.previewLineCosts(sql, costFile());
  const runId = await api.startCostRun(sql, { filename: "x.csv", rowCount: 3, counts: C.countLineCostPlan(plan), who: "chuy" });
  const good = { ...plan[0].row, lineId: plan[0].lineId };
  const check = (rows) => api.checkCostSaveRows(rows);
  assert.equal(check([good]), null);
  assert.match(check([{ ...good, lineType: "Labor" }]), /doesn't take a cost/);
  assert.match(check([{ ...good, lineCost: 30 }]), /isn't Qty × Unit Cost/);
  assert.match(check([{ ...good, costDate: "2025-02-30" }]), /isn't a real day/);
  assert.match(check([good, good]), /twice/);
  // Even straight to the save, a labor line is never written.
  const labor = (await pg.query("select id, sort, qty::float8 as qty, amount::float8 as amount from wo_history_lines where line_type = 'Labor' limit 1")).rows[0];
  const r = await api.saveCostBatch(sql, { runId, rows: [{ ...good, lineId: labor.id, sort: labor.sort, lineType: "Labor", itemCode: "SERVICELABOR", qty: labor.qty, amount: labor.amount, unitCost: 1, lineCost: 1.5 }] });
  assert.deepEqual(r, { filled: 0, skipped: 1 });
});

test("Past imports keeps the latest of each kind: ten newer history runs never hide a cost run", async () => {
  const { sql } = await fresh();
  const cost = await api.startCostRun(sql, { filename: "c.csv", rowCount: 0, counts: {}, who: "chuy" });
  for (let i = 0; i < 11; i++) await api.startRun(sql, { filename: `h${i}.csv`, rowCount: 0, counts: {}, who: "chuy" });
  const runs = await api.recentRuns(sql);
  assert.deepEqual([runs.filter((r) => r.kind === "history").length, runs.some((r) => r.id === cost)], [10, true]);
});

test("costed lines (choice C): parts, filters and equipment always count; install, service and other only once costed", async () => {
  const pure = C.historyInvoiceCost(
    [
      { kind: "part", amount: 40, lineCost: 22.5 },
      { kind: "equipment", amount: 900, lineCost: null },
      { kind: "service", amount: 150, lineCost: null },
      { kind: "install", amount: 373.53, lineCost: 100 },
      { kind: "other", amount: 25, lineCost: null },
      { kind: "labor", amount: 225, lineCost: null },
      { kind: "discount", amount: -10, lineCost: null },
    ],
    10,
  );
  // Counted: the part, the equipment, and the costed install fee. The uncosted service and other charge never are.
  assert.deepEqual([pure.costedLines, pure.totalLines, pure.cost, pure.uncostedSell], [2, 3, 122.5, 900]);
  // The uncosted equipment line needs a cost, so the invoice is partial and has no profit (follow-up, 11/24).
  assert.deepEqual([pure.partial, pure.profit], [true, null]);

  // The account list counts the same way as the invoice panel.
  const { pg, sql } = await fresh();
  await runAll(sql, files());
  await saveCosts(sql, costFile());
  await pg.query("update wo_history_lines set line_type = 'Service', kind = 'service', unit_cost = null, line_cost = null, cost_basis = null, cost_date = null, cost_source = null, cost_run_id = null, cost_run_values = null where item_code = 'INSTALLATIONFEE'");
  const row = (await api.accountHistory(sql, "Alpha Cafe", { showCost: true })).find((h) => h.ref === "WO-1500");
  assert.deepEqual([row.cost.costedLines, row.cost.totalLines], [1, 1], "an uncosted Service line isn't waiting on a cost");
  const id = (await pg.query("select id from wo_history where history_ref = 'WO-1500'")).rows[0].id;
  const d = await api.historyDetail(sql, id, { showCost: true });
  assert.deepEqual([d.invoice.cost.costedLines, d.invoice.cost.totalLines], [1, 1]);
});

// ── History profit counts only fully costed invoices (Jesus, 11/24, follow-up to #195) ─────────────────────────────

test("history profit: an invoice is fully costed only when every line that needs a cost has one", () => {
  const full = C.historyInvoiceCost([{ kind: "part", amount: 40, lineCost: 22.5 }, { kind: "labor", amount: 225, lineCost: null }, { kind: "discount", amount: -10, lineCost: null }], 10);
  assert.deepEqual([full.partial, full.profit, full.uncostedSell], [false, 232.5, 0]);
  const part = C.historyInvoiceCost([{ kind: "part", amount: 40, lineCost: 22.5 }, { kind: "part", amount: 12, lineCost: null }], 0);
  assert.deepEqual([part.partial, part.profit, part.uncostedSell, part.cost, part.costedLines, part.totalLines], [true, null, 12, 22.5, 1, 2]);
  const laborOnly = C.historyInvoiceCost([{ kind: "labor", amount: 225, lineCost: null }, { kind: "trip", amount: 150, lineCost: null }], 0);
  assert.deepEqual([laborOnly.partial, laborOnly.cost, laborOnly.profit, laborOnly.totalLines], [false, 0, 375, 0]);
  // Choice C: an uncosted install fee or service line doesn't need a cost.
  const service = C.historyInvoiceCost([{ kind: "part", amount: 40, lineCost: 22.5 }, { kind: "service", amount: 150, lineCost: null }, { kind: "install", amount: 300, lineCost: null }], 0);
  assert.deepEqual([service.partial, service.profit], [false, 467.5]);
});

test("history profit: totals count cost and profit on fully costed bills only; partial bills go to Uncosted Sell", async () => {
  const P = await import("../src/lib/ops/profit-report.ts");
  const bill = (o) => ({ year: "2025", customer: "Alpha Cafe", customerKey: "alphacafe", ...o });
  const bills = [
    bill({ sell: 100, discount: 10, cost: 40, partial: false, profit: 50 }),
    bill({ sell: 200, discount: 20, cost: 30, partial: true, profit: null }),
  ];
  const t = P.historyTotals(bills);
  assert.deepEqual(t, { bills: 2, sell: 300, discount: 30, cost: 40, profit: 50, marginPct: 55.56, uncostedSell: 180, partialBills: 1 });
  assert.equal(P.historyTotals([bill({ sell: 50, discount: 0, cost: 0, partial: true, profit: null })]).marginPct, null, "no costed bill: no margin");
  const s = P.historySection(bills, { serviceDept: 0, billedTicket: 0 });
  assert.match(s.note, /1 partial bill: its sell is in Uncosted Sell/);
  const [byYear, byCustomer] = P.historyReportTables(s);
  const cols = ["Bills", "Sell", "Discount", "Cost (Parts and Equipment)", "Profit After Discount (costed bills)", "Margin %", "Uncosted Sell", "Partial Bills"];
  assert.deepEqual(byYear.columns, ["Year", ...cols]);
  assert.deepEqual(byCustomer.columns, ["Customer", ...cols]);
  assert.deepEqual(byYear.rows.at(-1), ["Total", "2", "$300.00", "$30.00", "$40.00", "$50.00", "55.56%", "$180.00", "1"]);
});

test("history profit: with labor hidden, labor's sell and its share of the discount come out; admins and labor-on are unchanged", async () => {
  const { pg, sql } = await fresh();
  await runAll(sql, files());
  await saveCosts(sql, costFile());
  await pg.query("update wo_history set invoice_date = '2026-07-24' where history_ref = $1", [WO]);
  const R = await import("../src/lib/ops/profit-report-api.ts");
  const y2026 = (s) => s.byYear.find((g) => g.key === "2026");
  // WO-0211: labor 225, trip 150, part 40 (cost 24), discount 41.50 spread 22.50 / 15.00 / 4.00.
  const on = await R.historyProfitSection(sql, {});
  assert.deepEqual([y2026(on).sell, y2026(on).discount, y2026(on).profit], [415, 41.5, 349.5]);
  assert.doesNotMatch(on.note, /labor not shown/);
  const off = await R.historyProfitSection(sql, {}, { laborHidden: true });
  assert.deepEqual([y2026(off).sell, y2026(off).discount, y2026(off).cost, y2026(off).profit], [190, 19, 24, 147], "trip stays, as billProfitTotals keeps it");
  assert.match(off.note, /labor not shown/);
});

test("history profit: the profit report and its download follow each person's labor switch", async () => {
  const { pg, sql } = await fresh();
  await runAll(sql, files());
  await saveCosts(sql, costFile());
  await pg.query("update wo_history set invoice_date = '2026-07-24' where history_ref = $1", [WO]);
  await pg.query("insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ('zz-admin', 'zzadmin', true, true, 'admin'), ('zz-svc', 'zzsvc', true, false, 'service')");
  // Service sees cost; the labor switch is off (the default).
  await pg.query(`insert into desk_settings (key, value, updated_at) values ('cost_visible_roles', '["service"]', now()), ('cost_options', '{"showLabor":false}', now())`);
  const R = await import("../src/lib/ops/profit-report-api.ts");
  const y2026 = (r) => r.history.byYear.find((g) => g.key === "2026");
  const svc = await R.profitReportFor(sql, {}, "zz-svc");
  assert.deepEqual([svc.laborHidden, y2026(svc).sell, y2026(svc).discount, y2026(svc).profit], [true, 190, 19, 147]);
  assert.match(svc.history.note, /labor not shown/);
  const admin = await R.profitReportFor(sql, {}, "zz-admin");
  assert.deepEqual([admin.laborHidden, y2026(admin).sell, y2026(admin).profit], [false, 415, 349.5]);
  const file = await R.profitReportFileFor(sql, { filters: {}, format: "xlsx" }, "zz-svc");
  assert.ok(file.base64.length > 0, "the download builds from the same report");
});

test("history profit: a partial invoice has no profit in the account list or the invoice panel", async () => {
  const { pg, sql } = await fresh();
  await runAll(sql, files());
  await saveCosts(sql, costFile());
  // WO-1500: NOTAPART (a part) loses its cost; the install fee keeps its own.
  await pg.query("update wo_history_lines set unit_cost = null, line_cost = null, cost_basis = null, cost_date = null, cost_source = null, cost_run_id = null, cost_run_values = null where item_code = 'NOTAPART'");
  const row = (await api.accountHistory(sql, "Alpha Cafe", { showCost: true })).find((h) => h.ref === "WO-1500");
  assert.deepEqual([row.cost.partial, row.cost.profit, row.cost.costedLines, row.cost.totalLines], [true, null, 1, 2]);
  const full = (await api.accountHistory(sql, "Alpha Cafe", { showCost: true })).find((h) => h.ref === WO);
  assert.deepEqual([full.cost.partial, full.cost.profit], [false, 349.5]);
  const id = (await pg.query("select id from wo_history where history_ref = 'WO-1500'")).rows[0].id;
  const d = await api.historyDetail(sql, id, { showCost: true });
  assert.deepEqual([d.invoice.cost.partial, d.invoice.cost.profit, d.invoice.cost.margin, d.invoice.cost.uncostedSell], [true, null, null, 0]);
  // Not costed at all: still partial, nothing costed.
  await pg.query("update wo_history_lines set unit_cost = null, line_cost = null, cost_basis = null, cost_date = null, cost_source = null, cost_run_id = null, cost_run_values = null where history_id = $1", [id]);
  const none = (await api.accountHistory(sql, "Alpha Cafe", { showCost: true })).find((h) => h.ref === "WO-1500");
  assert.deepEqual([none.cost.partial, none.cost.profit, none.cost.costedLines], [true, null, 0]);
  // Service Dept: internal, no profit; a non-cost viewer: no cost at all.
  await pg.query("update wo_history set customer = 'Katz Coffee Service Dept.' where history_ref = $1", [WO]);
  const wid = (await pg.query("select id from wo_history where history_ref = $1", [WO])).rows[0].id;
  const internal = await api.historyDetail(sql, wid, { showCost: true });
  assert.deepEqual([internal.invoice.cost.internal, internal.invoice.cost.profit], [true, null]);
  assert.equal((await api.historyDetail(sql, wid)).invoice.cost, undefined);
  const internalRow = (await api.accountHistory(sql, "Katz Coffee Service Dept.", { showCost: true })).find((h) => h.ref === WO);
  assert.deepEqual([internalRow.cost.internal, internalRow.cost.profit], [true, null]);
  assert.ok((await api.accountHistory(sql, "Alpha Cafe")).every((h) => h.cost === undefined), "no cost for a non-cost viewer");
});

test("cost save guard: a line on another History Ref is skipped; the right ref fills; a blank ref is refused", async () => {
  const { pg, sql } = await fresh();
  await runAll(sql, files());
  const plan = await api.previewLineCosts(sql, costFile());
  const runId = await api.startCostRun(sql, { filename: "x.csv", rowCount: 1, counts: C.countLineCostPlan(plan), who: "chuy" });
  const valve = { ...plan[0].row, lineId: plan[0].lineId };
  assert.equal(valve.ref, WO);
  const wrong = await api.saveCostBatch(sql, { runId, rows: [{ ...valve, ref: "WO-1500" }] });
  assert.deepEqual(wrong, { filled: 0, skipped: 1 });
  assert.equal((await pg.query("select unit_cost from wo_history_lines where id = $1", [valve.lineId])).rows[0].unit_cost, null);
  assert.deepEqual(await api.saveCostBatch(sql, { runId, rows: [{ ...valve, ref: ` ${WO.toLowerCase()} ` }] }), { filled: 1, skipped: 0 });
  assert.match(api.checkCostSaveRows([{ ...valve, ref: " " }]), /no History Ref/);
});
