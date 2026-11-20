// Billing Backfill's customer check (Grok for Chuy, 11/15): when NetSuite bills another account than the card's (by
// its exact name or its linked NetSuite ID), the row starts unticked, flagged "NetSuite bills X, card is Y", and is
// written only when it is ticked again. Each Central Market store has two accounts (the Coffee Bar and the rest), so
// it matches the exact account, never the store name. Files without a NetSuite customer column work as before.
// Made-up accounts and numbers; the shapes copy INV9516 (WO-1040, Walk-In) and WO-0564 (a Coffee Bar invoice).
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";
const bf = await import("../src/lib/ops/billing-backfill.ts");
const api = await import("../src/lib/ops/billing-backfill-api.ts");
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const MIGRATIONS = new URL("../migrations/", import.meta.url);

async function fresh() {
  const pg = new PGlite();
  for (const name of readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  await pg.query("insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ('u-owner', 'chuy', true, true, 'admin')");
  await pg.query(`insert into directory_customers (name, netsuite_id) values
    ('Zz Bean Cafe', '1010'), ('Zz Rock Coffee Webster', '1020'), ('Zz Market Westgate', '1030'), ('Zz Market Westgate Coffee Bar', '1031')`);
  await pg.query("update directory_customers set account_number = 'C' || netsuite_id");
  return { pg, query: async (text, params) => (await pg.query(text, params)).rows };
}
let n = 0;
async function ticket(sql, customer, wo) {
  n += 1;
  return (
    await sql.query(
      "insert into service_jobs (kind, call_id, customer, wo, status, technician, received, completed_at) values ('service', $1, $2, $3, 'Completed', 'Ryan Gloria', '2026-10-01', '2026-10-10') returning id",
      [`SC-CC-${n}`, customer, wo],
    )
  )[0].id;
}
const csv = (rows) => rows.map((r) => r.map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : String(c))).join(",")).join("\n") + "\n";
const file = (name, rows) => ({ name, base64: Buffer.from(csv(rows)).toString("base64") });
const HEAD = ["WO", "SO #", "SO status", "Invoice #", "Invoice date", "Invoice status", "Invoice total", "Amount remaining", "NetSuite customer"];
const row = (wo, inv, customer) => [wo, `SO${inv}`, "Billed", `INV${inv}`, "2026-10-12", "Open", "150", "150", customer];
const invoicesOf = async (sql, id) => (await sql.query("select ns_invoice from ticket_invoices where job_id = $1", [id])).map((r) => r.ns_invoice);

test("the account check: the exact name, NetSuite's Parent : Child leaf, or the account's NetSuite number; never the store alone", () => {
  const ids = new Map([["zz market westgate", ["4830", "C1030"]], ["zz market westgate coffee bar", ["4831"]]]);
  const m = (ns, card) => bf.nsCustomerMatches(ns, card, ids);
  assert.equal(m("Zz Bean Cafe", "Zz Bean Cafe"), true);
  assert.equal(m("Zz Parent : Zz Bean Cafe", "Zz Bean Cafe"), true);
  assert.equal(m("Zz Parent : Zz Bean Cafe", "Zz Parent : Zz Bean Cafe"), true);
  assert.equal(m("Zz Bean Cafe", "Zz Parent : Zz Bean Cafe"), true, "a card stored as Parent : Child, a leaf in the file");
  // Spelling NetSuite and KatzDesk differ on: punctuation, accents, a trailing LLC.
  assert.equal(m("Zz Bean Café, LLC", "Zz Bean Cafe"), true);
  assert.equal(m("Zz Market - Westgate", "Zz Market Westgate"), true);
  assert.equal(m("4821 Zz Bean Cafe", "Zz Bean Cafe"), true, "a leading NetSuite number before the exact name");
  assert.equal(m("7 Leaves Cafe", "Leaves Cafe"), false, "a short leading number is part of the name");
  // The account's own NetSuite number (or internal ID), whatever the name.
  assert.equal(m("4830 Zz Market (Westgate store)", "Zz Market Westgate"), true);
  assert.equal(m("4830", "Zz Market Westgate"), true);
  assert.equal(m("C1030", "Zz Market Westgate"), true);
  assert.equal(m("48300 Zz Other", "Zz Market Westgate"), false, "a number only matches whole");
  // The Coffee Bar's own account is another account.
  assert.equal(m("4831 Zz Market Westgate Coffee Bar", "Zz Market Westgate"), false);
  assert.equal(m("Zz Market Westgate Coffee Bar", "Zz Market Westgate"), false);
  assert.equal(m("Zz Market Westgate", "Zz Market Westgate Coffee Bar"), false);
  // Walk-In: alone, or as the parent NetSuite bills under the account's name.
  assert.equal(m("Walk-In", "Zz Rock Coffee Webster"), false);
  assert.equal(m("Walk-In : Zz Rock Coffee Webster", "Zz Rock Coffee Webster"), false);
  assert.equal(m("", "Zz Bean Cafe"), true, "no NetSuite customer: nothing to check");
});

test("a match stays ticked; Walk-In on another card and a Coffee Bar invoice on the regular card start unticked and flagged", async () => {
  const sql = await fresh();
  try {
    const ok = await ticket(sql, "Zz Bean Cafe", "WO-1001");
    const walk = await ticket(sql, "Zz Rock Coffee Webster", "WO-1040");
    const cm = await ticket(sql, "Zz Market Westgate", "WO-0564");
    const cmById = await ticket(sql, "Zz Market Westgate", "WO-0567");
    const f = [file("invoices.csv", [HEAD, row("WO-1001", "9001", "Zz Bean Cafe"), row("WO-1040", "9516", "Walk-In"), row("WO-0564", "9564", "C1031 Zz Market Westgate Coffee Bar"), row("WO-0567", "9567", "C1030 Zz Market (Westgate)")])];
    const p = await api.previewBillingBackfillFor(sql, f, "u-owner");
    const by = Object.fromEntries(p.plans.map((x) => [x.wo, x]));
    assert.deepEqual([by["WO-1001"].hold, by["WO-0567"].hold], [null, null]);
    assert.equal(by["WO-1040"].hold, "NetSuite bills Walk-In, card is Zz Rock Coffee Webster");
    assert.equal(by["WO-0564"].hold, "NetSuite bills C1031 Zz Market Westgate Coffee Bar, card is Zz Market Westgate");
    assert.ok(by["WO-1040"].warnings.includes("NetSuite bills Walk-In, card is Zz Rock Coffee Webster"));
    assert.equal(p.counts.held, 2);

    // Confirm as the screen sends it: nothing ticked again.
    const done = await api.applyBillingBackfillFor(sql, f, "u-owner", { hash: p.hash, skip: [], approve: [] });
    assert.deepEqual([await invoicesOf(sql, ok), await invoicesOf(sql, walk), await invoicesOf(sql, cm), await invoicesOf(sql, cmById)], [["INV9001"], [], [], ["INV9567"]]);
    // Ticked again: written.
    const again = await api.previewBillingBackfillFor(sql, f, "u-owner");
    const key = again.plans.find((x) => x.wo === "WO-1040").key;
    await api.applyBillingBackfillFor(sql, f, "u-owner", { hash: again.hash, skip: [], approve: [key] });
    assert.deepEqual(await invoicesOf(sql, walk), ["INV9516"]);
    assert.deepEqual(await invoicesOf(sql, cm), [], "the other held row stays out");
    assert.ok(done.plans);
  } finally {
    await sql.pg.close();
  }
});

test("every NetSuite customer on a WO is checked, charges and invoices alike", async () => {
  const sql = await fresh();
  try {
    await ticket(sql, "Zz Bean Cafe", "WO-1050");
    const f = [file("invoices.csv", [HEAD, row("WO-1050", "9050", "Zz Bean Cafe"), row("WO-1050", "9051", "Walk-In")])];
    const p = await api.previewBillingBackfillFor(sql, f, "u-owner");
    assert.equal(p.plans[0].hold, "NetSuite bills Walk-In, card is Zz Bean Cafe");
  } finally {
    await sql.pg.close();
  }
});

test("a file with no NetSuite customer column imports as it does today", async () => {
  const sql = await fresh();
  try {
    const t = await ticket(sql, "Zz Rock Coffee Webster", "WO-1041");
    const f = [file("invoices.csv", [HEAD.slice(0, 8), row("WO-1041", "9517", "").slice(0, 8)])];
    const p = await api.previewBillingBackfillFor(sql, f, "u-owner");
    assert.equal(p.plans[0].hold, null);
    await api.applyBillingBackfillFor(sql, f, "u-owner", { hash: p.hash, skip: [] });
    assert.deepEqual(await invoicesOf(sql, t), ["INV9517"]);
  } finally {
    await sql.pg.close();
  }
});

test("the screen starts held rows unticked, says why, and sends the ones ticked again", () => {
  const screen = src("src/components/desk/billing-backfill.tsx");
  assert.match(screen, /setSkip\(heldKeys\(p\)\);/);
  assert.match(screen, /const heldKeys = \(p: BackfillPreview\) => new Set\(p\.plans\.filter\(\(x\) => x\.hold\)\.map\(\(x\) => x\.key\)\);/);
  assert.match(screen, /approve: plans\.filter\(\(p\) => p\.hold && !skip\.has\(p\.key\)\)\.map\(\(p\) => p\.key\)/);
  assert.match(screen, /data-testid="backfill-hold"/);
});

// NetSuite bills Walk-In one-time customers as sub-customers, "Walk - In:<name>" (Chuy, 11/19, WO-1130). On a ticket
// on the Walk - In account, NetSuite's "Walk - In" or "Walk - In:<anything>" is Walk - In. Nowhere else.
test("a Walk - In ticket matches NetSuite's Walk - In and its Walk - In:<name> sub-customers; nothing else does", async () => {
  const sql = await fresh();
  try {
    await sql.query("insert into directory_customers (name, walk_in) values ('Walk - In', true)");
    const sub = await ticket(sql, "Walk - In", "WO-1130");
    const plain = await ticket(sql, "Walk - In", "WO-1131");
    const hines = await ticket(sql, "Walk - In", "WO-1132");
    const normal = await ticket(sql, "Zz Bean Cafe", "WO-1133");
    const f = [
      file("invoices.csv", [
        HEAD,
        row("WO-1130", "9130", "Walk - In:Zz Frittella Cafe"),
        row("WO-1131", "9131", "Walk - In"),
        row("WO-1132", "9132", "Zz Hines"),
        row("WO-1133", "9133", "Walk - In:Zz Bean Cafe"),
      ]),
    ];
    const p = await api.previewBillingBackfillFor(sql, f, "u-owner");
    const by = Object.fromEntries(p.plans.map((x) => [x.wo, x]));
    assert.deepEqual([by["WO-1130"].status === "skip", by["WO-1130"].reason, by["WO-1130"].hold], [false, null, null]);
    assert.equal(by["WO-1130"].walkInName, "Zz Frittella Cafe", "the sub-customer shows on the row");
    assert.deepEqual([by["WO-1131"].status === "skip", by["WO-1131"].reason, by["WO-1131"].hold, by["WO-1131"].walkInName], [false, null, null, null]);
    assert.equal(by["WO-1132"].status, "skip");
    assert.match(by["WO-1132"].reason, /NetSuite bills Zz Hines, not Walk - In/);
    assert.ok(by["WO-1133"].hold, "a normal account billed as Walk - In:<name> is still held");
    await api.applyBillingBackfillFor(sql, f, "u-owner", { hash: p.hash, skip: [], approve: [] });
    assert.deepEqual(
      [await invoicesOf(sql, sub), await invoicesOf(sql, plain), await invoicesOf(sql, hines), await invoicesOf(sql, normal)],
      [["INV9130"], ["INV9131"], [], []],
    );
  } finally {
    await sql.pg.close();
  }
});

test("nsWalkIn: Walk - In, and Walk - In:<name> with the name", () => {
  assert.deepEqual(bf.nsWalkIn("Walk - In:Zz Frittella Cafe"), { name: "Zz Frittella Cafe" });
  assert.deepEqual(bf.nsWalkIn("walk-in : Zz Frittella Cafe"), { name: "Zz Frittella Cafe" });
  assert.deepEqual(bf.nsWalkIn("Walk - In"), { name: null });
  assert.equal(bf.nsWalkIn("Zz Hines"), null);
  assert.equal(bf.nsWalkIn("Walking Cafe:Zz"), null);
  assert.equal(bf.nsWalkIn("Cimbali National Accounts:Zz"), null);
});
