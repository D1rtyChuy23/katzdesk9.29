import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import * as XLSX from "xlsx";

await register("./node-resolve-hook.mjs", import.meta.url);
// Keep this file off the preview database. db.ts boots PGLite on import when DATABASE_URL is unset.
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const { readNetsuiteMatrix, planNetsuiteCustomers, countNetsuitePlan, netsuitePreviewCsv, formatAddress } = await import("../src/lib/ops/netsuite-customers.ts");
const { matrixFromBase64 } = await import("../src/lib/ops/netsuite-customers-sheet.ts");
const { applyNetsuitePlan, previewNetsuitePlan, loadNetsuiteAccounts, recentNetsuiteRuns } = await import("../src/lib/ops/netsuite-customers-api.ts");

// The NetSuite export's columns, in its order.
const HEAD = [
  "Internal ID", "Account Number", "Company Name",
  "Billing Address 1", "Billing Address 2", "Billing City", "Billing State/Province", "Billing Zip", "Billing Country",
  "Shipping Address 1", "Shipping Address 2", "Shipping City", "Shipping State/Province", "Shipping Zip", "Shipping Country",
  "Primary Contact", "Phone", "Email", "Inactive",
];
const KEYS = ["id", "num", "name", "b1", "b2", "bcity", "bstate", "bzip", "bcountry", "s1", "s2", "scity", "sstate", "szip", "scountry", "contact", "phone", "email", "inactive"];
const row = (o) => KEYS.map((k) => o[k] ?? "");
const csvCell = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const csvBase64 = (rows, head = HEAD) => Buffer.from([head, ...rows].map((r) => r.map((c) => csvCell(String(c))).join(",")).join("\r\n"), "utf8").toString("base64");
const read = (rows, head = HEAD) => readNetsuiteMatrix(matrixFromBase64(csvBase64(rows, head))).rows;

/** A KatzDesk account as the planner reads it. */
const acct = (o) => ({
  id: o.id,
  name: o.name,
  archived: !!o.archived,
  updatedAt: "2026-10-01 00:00:00+00",
  netsuiteId: o.netsuiteId ?? null,
  accountNumber: o.accountNumber ?? null,
  address: o.address ?? null,
  billing: { line1: null, line2: null, city: null, state: null, zip: null, country: null, ...(o.billing ?? {}) },
  primaryContact: o.primaryContact ?? null,
  phone: o.phone ?? null,
  email: o.email ?? null,
  inactive: !!o.inactive,
});
const lineOf = (lines, n) => lines.find((l) => l.line === n);

// ── Reading ──────────────────────────────────────────────────────────────────────────────────────────────────────────

test("reads the NetSuite columns; IDs stay text and \"- None -\" is blank", () => {
  const [r] = read([row({ id: "1234", num: "00123", name: "Bar By The Wayside", s1: "5644 Navigation Blvd", s2: "- None -", scity: "Houston", sstate: "TX", szip: "77011", phone: "(713) 555-0100", inactive: "No" })]);
  assert.equal(r.line, 2);
  assert.equal(r.internalId, "1234");
  assert.equal(r.accountNumber, "00123");
  assert.equal(r.shipping.line2, "");
  assert.equal(r.inactive, false);
  assert.equal(formatAddress(r.shipping), "5644 Navigation Blvd, Houston, TX 77011");
});

test("a CSV is read as UTF-8 and the header can sit under a title row", () => {
  const b64 = Buffer.from(["Customer export,,", ...[["Internal ID", "Company Name", "Phone"], ["7", "Café Olé", "555"]].map((r) => r.join(","))].join("\n"), "utf8").toString("base64");
  const res = readNetsuiteMatrix(matrixFromBase64(b64));
  assert.equal(res.rows[0].companyName, "Café Olé");
  assert.equal(res.rows[0].line, 3);
  assert.ok(res.columns.missing.includes("Inactive"));
});

test("a sheet's number cells come back as the digits shown, never as 1.2E+11", () => {
  const ws = XLSX.utils.aoa_to_sheet([["Internal ID", "Account Number", "Company Name"], [123456789012345, 123, "Acme"]]);
  ws.B2.z = "00000"; // zero-padded account number
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Customers");
  const b64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
  const [r] = readNetsuiteMatrix(matrixFromBase64(b64)).rows;
  assert.equal(r.internalId, "123456789012345");
  assert.equal(r.accountNumber, "00123");
});

test("the file needs a Company Name column; no Internal ID column is a warning", () => {
  assert.throws(() => readNetsuiteMatrix([["Internal ID", "Phone"], ["1", "2"]]), /Company Name/);
  const res = readNetsuiteMatrix([["Company Name"], ["Acme"]]);
  assert.match(res.warnings.join(" "), /No Internal ID column/);
});

// ── Matching ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test("Internal ID first, then the exact account number, then the exact name; never a close name", () => {
  const accounts = [
    acct({ id: 1, name: "Alpha Coffee", netsuiteId: "100" }),
    acct({ id: 2, name: "Beta Coffee", accountNumber: "B-2" }),
    acct({ id: 3, name: "Gamma Coffee" }),
    acct({ id: 4, name: "Joe's Coffee" }),
  ];
  const lines = planNetsuiteCustomers(
    read([
      row({ id: "100", num: "B-2", name: "Alpha Coffee" }), // ID → Alpha; but B-2 is Beta's number
      row({ id: "100", name: "Somebody Else" }), // second row on ID 100
      row({ id: "200", num: "b-2 ", name: "Beta Coffee LLC" }), // number (case and spaces ignored) → Beta
      row({ id: "300", name: "  gamma   coffee " }), // exact name, case and spaces ignored → Gamma
      row({ id: "400", name: "Joes Coffee" }), // only punctuation differs: never merged, held as a conflict
      row({ id: "500", name: "Delta Coffee" }), // new
    ]),
    accounts,
  );
  // Row 2 has Beta's number. Rows 2 and 3 share Internal ID 100, so neither saves: row 3 can't go ahead because row 2
  // is already held, and row 2 keeps its own reason with the clash as a note.
  assert.equal(lineOf(lines, 2).status, "conflict");
  assert.match(lineOf(lines, 2).reason, /Account number B-2 is on “Beta Coffee”/);
  assert.match(lineOf(lines, 2).notes.join(" "), /Internal ID 100 is on 2 rows/);
  assert.equal(lineOf(lines, 3).status, "conflict");
  assert.match(lineOf(lines, 3).reason, /Internal ID 100 is on 2 rows/);
  assert.equal(lineOf(lines, 4).matchedBy, "number");
  assert.equal(lineOf(lines, 4).accountId, 2);
  assert.match(lineOf(lines, 4).notes.join(" "), /NetSuite calls it “Beta Coffee LLC”/);
  assert.equal(lineOf(lines, 5).matchedBy, "name");
  assert.equal(lineOf(lines, 5).accountId, 3);
  assert.equal(lineOf(lines, 6).status, "conflict");
  assert.match(lineOf(lines, 6).reason, /only exact names match/);
  assert.equal(lineOf(lines, 7).status, "create");
});

test("an account number on another account, or a different NetSuite ID, is a conflict", () => {
  const accounts = [acct({ id: 1, name: "Alpha", netsuiteId: "100" }), acct({ id: 2, name: "Beta", accountNumber: "B-2", netsuiteId: "999" })];
  const lines = planNetsuiteCustomers(read([row({ id: "100", num: "B-2", name: "Alpha" }), row({ id: "200", num: "B-2", name: "Beta" })]), accounts);
  // Row 2: ID → Alpha, number → Beta. Row 3: number → Beta, but Beta is NetSuite 999.
  assert.equal(lineOf(lines, 2).status, "conflict");
  assert.equal(lineOf(lines, 3).status, "conflict");
  assert.ok(lines.some((l) => /on “Beta”, not on “Alpha”/.test(l.reason)));
  assert.ok(lines.some((l) => /has NetSuite ID 999, and this row is 200/.test(l.reason)));
});

test("an Account Number that is the company name is read as blank", () => {
  const accounts = [acct({ id: 1, name: "Alpha", accountNumber: "A-1" })];
  const [l] = planNetsuiteCustomers(read([row({ id: "100", num: "alpha", name: "Alpha" })]), accounts);
  assert.equal(l.matchedBy, "name");
  assert.equal(l.accountNumber, "");
  assert.ok(!l.changes.some((c) => c.field === "accountNumber"));
  assert.match(l.notes.join(" "), /is the company name/);
});

test("an Account Number that is the company name cut short is read as blank too", () => {
  const long = "Equipment Lease Customers:Sugar Frk Location Two";
  const [l] = planNetsuiteCustomers(read([row({ id: "9", num: long.slice(0, -2), name: long })]), []);
  assert.equal(l.status, "create");
  assert.equal(l.accountNumber, "");
  assert.equal(l.write.accountNumber, null);
  assert.match(l.notes.join(" "), /cut short/);
});

test("a NetSuite child name whose own part is already an account is held, not added again", () => {
  const accounts = [acct({ id: 1, name: "Black Rifle Coffee" })];
  const lines = planNetsuiteCustomers(read([row({ id: "1", name: "Eversys Service:Black Rifle Coffee" }), row({ id: "2", name: "Eversys Service:Green Bean" })]), accounts);
  assert.equal(lineOf(lines, 2).status, "conflict");
  assert.match(lineOf(lines, 2).reason, /NetSuite lists “Black Rifle Coffee” under “Eversys Service”/);
  assert.equal(lineOf(lines, 3).status, "create");
  assert.equal(lineOf(lines, 3).write.name, "Eversys Service:Green Bean");
});

test("Walk-In accounts are never matched, by ID, number or name", () => {
  const accounts = [acct({ id: 1, name: "Walk - In: Houston", netsuiteId: "100", accountNumber: "W-1" })];
  const lines = planNetsuiteCustomers(
    read([row({ id: "100", name: "Somebody" }), row({ num: "W-1", name: "Other" }), row({ id: "300", name: "walk - in: houston" })]),
    accounts,
  );
  for (const l of lines) {
    assert.equal(l.status, "skipped");
    assert.match(l.reason, /Walk-In accounts are never updated/);
  }
});

// ── What a row writes ────────────────────────────────────────────────────────────────────────────────────────────────

test("a blank never clears a value; each address is replaced whole; equal-looking values don't count as changes", () => {
  const accounts = [
    acct({
      id: 1,
      name: "Alpha",
      netsuiteId: "100",
      address: "5644 Navigation Blvd., Houston, TX 77011",
      billing: { line1: "50 Oak Ave", line2: "Suite 5", city: "Houston", state: "TX", zip: "77002" },
      primaryContact: "Pat",
      phone: "713-555-0100",
      email: "old@alpha.test",
    }),
  ];
  const [l] = planNetsuiteCustomers(
    read([
      row({
        id: "100",
        name: "Alpha",
        b1: "100 Main St", bcity: "Houston", bstate: "TX", bzip: "77003",
        s1: "5644 navigation blvd", scity: "Houston", sstate: "TX", szip: "77011",
        contact: "", phone: "(713) 555-0100", email: "new@alpha.test",
      }),
    ]),
    accounts,
  );
  assert.equal(l.status, "update");
  assert.deepEqual(
    l.changes.map((c) => [c.field, c.before, c.after]),
    [
      ["billing", "50 Oak Ave, Suite 5, Houston, TX 77002", "100 Main St, Houston, TX 77003"],
      ["email", "old@alpha.test", "new@alpha.test"],
    ],
  );
  // The old suite number goes with the old street.
  assert.equal(l.write.billing.line2, null);
  assert.equal(l.write.primaryContact, "Pat");
});

test("an address with no street, or no city or ZIP, leaves KatzDesk's as it is", () => {
  const accounts = [acct({ id: 1, name: "Alpha", address: "1 Old Rd, Houston, TX 77001" })];
  const [l] = planNetsuiteCustomers(read([row({ name: "Alpha", scity: "Dallas", sstate: "TX" })]), accounts);
  assert.equal(l.status, "same");
  assert.match(l.notes.join(" "), /site address is left as is/);
});

test("Inactive: a matched account takes the flag; an inactive row with no account isn't added; blank changes nothing", () => {
  const accounts = [acct({ id: 1, name: "Alpha" }), acct({ id: 2, name: "Beta", inactive: true })];
  const lines = planNetsuiteCustomers(
    read([row({ name: "Alpha", inactive: "Yes" }), row({ name: "Beta", inactive: "" }), row({ name: "Gamma", inactive: "T" }), row({ name: "Delta", inactive: "maybe" })]),
    accounts,
  );
  assert.deepEqual(lineOf(lines, 2).changes.map((c) => [c.field, c.before, c.after]), [["inactive", "Active", "Inactive"]]);
  assert.equal(lineOf(lines, 3).status, "same");
  assert.equal(lineOf(lines, 4).status, "skipped");
  assert.match(lineOf(lines, 4).reason, /Inactive in NetSuite and not in KatzDesk/);
  assert.equal(lineOf(lines, 5).status, "create");
  assert.match(lineOf(lines, 5).notes.join(" "), /isn't Yes or No/);
});

test("conflicts: an ID on two accounts, a removed account's name, an Excel-rounded ID, two rows adding one name", () => {
  const accounts = [acct({ id: 1, name: "Alpha", netsuiteId: "100" }), acct({ id: 2, name: "Alpha West", netsuiteId: "100" }), acct({ id: 3, name: "Old Shop", archived: true })];
  const lines = planNetsuiteCustomers(
    read([row({ id: "100", name: "Alpha" }), row({ name: "Old Shop" }), row({ id: "1.23457E+11", name: "Zeta" }), row({ name: "New Cafe" }), row({ name: "New Café" })]),
    accounts,
  );
  assert.match(lineOf(lines, 2).reason, /NetSuite ID 100 is on 2 KatzDesk accounts/);
  assert.match(lineOf(lines, 3).reason, /removed account is named “Old Shop”/);
  assert.match(lineOf(lines, 4).reason, /rounded by Excel/);
  // "New Cafe" and "New Café" differ only in an accent the key drops: held, not added twice.
  assert.equal(lineOf(lines, 5).status, "conflict");
  assert.equal(lineOf(lines, 6).status, "conflict");
});

test("a removed account found by its NetSuite ID or Account Number isn't added back under a new name (10/26)", () => {
  const accounts = [
    acct({ id: 1, name: "Old Shop", netsuiteId: "700", archived: true }),
    acct({ id: 2, name: "Gone Grill", accountNumber: "00042", archived: true }),
    acct({ id: 3, name: "Still Here", netsuiteId: "900" }),
  ];
  const lines = planNetsuiteCustomers(
    read([
      row({ id: "700", name: "Old Shop, LLC" }),
      row({ id: "701", num: "00042", name: "Gone Grill & Bar" }),
      row({ id: "900", name: "Still Here" }),
      row({ id: "702", name: "Brand New Cafe" }),
    ]),
    accounts,
  );
  assert.equal(lineOf(lines, 2).status, "conflict");
  assert.match(lineOf(lines, 2).reason, /“Old Shop”, removed from Customers, has NetSuite ID 700, so it isn't added back/);
  assert.equal(lineOf(lines, 3).status, "conflict");
  assert.match(lineOf(lines, 3).reason, /“Gone Grill”, removed from Customers, has account number 00042/);
  assert.equal(lineOf(lines, 4).accountId, 3, "an account on the list still matches as before");
  assert.equal(lineOf(lines, 5).status, "create", "a new account is still added");
});

test("the preview downloads as a CSV with the tick state, and a formula-like cell can't run", () => {
  const lines = planNetsuiteCustomers(read([row({ id: "1", name: "=HYPERLINK(\"x\")" }), row({ id: "2", name: "Plain, Inc." })]), []);
  const csv = netsuitePreviewCsv(lines, new Set([2]));
  const [head, first, second] = csv.trim().split("\r\n");
  assert.equal(head, "Status,Line,Included,Internal ID,Account Number,Company Name,KatzDesk Account,Matched By,Changes,Reason,Notes");
  assert.match(first, /^Will Create,2,Yes,1,,"'=HYPERLINK\(""x""\)"/);
  assert.match(second, /^Will Create,3,No,2,,"Plain, Inc\."/);
});

// ── Saving ───────────────────────────────────────────────────────────────────────────────────────────────────────────

async function fresh() {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  const sql = { query: async (text, params) => (await pg.query(text, params)).rows };
  return { pg, sql };
}

const SAMPLE = [
  row({ id: "100", num: "00042", name: "Alpha Coffee", s1: "1 Main St", scity: "Houston", sstate: "TX", szip: "77002", b1: "PO Box 9", bcity: "Houston", bstate: "TX", bzip: "77001", contact: "Pat Lee", phone: "713-555-0100", email: "pat@alpha.test" }),
  row({ id: "200", num: "Beta Bar", name: "Beta Bar", s1: "2 Elm St", scity: "Dallas", sstate: "TX", szip: "75201" }),
  row({ id: "300", name: "Gamma Grind", inactive: "Yes" }),
  row({ id: "400", name: "Delta Drip", s1: "4 Pine St", scity: "Austin", sstate: "TX", szip: "78701", phone: "512-555-0199" }),
  row({ id: "500", name: "Walk - In: Houston" }),
];

test("saving: only ticked rows are written, with a history line each and one run log; a re-run adds nothing", async () => {
  const { pg, sql } = await fresh();
  await pg.query("insert into directory_customers (name, account_number, address) values ('Alpha Coffee', '00042', '1 Main Street, Houston, TX 77002'), ('Gamma Grind', null, null), ('Walk - In: Houston', null, null)");
  const rows = read(SAMPLE);
  const preview = await previewNetsuitePlan(sql, { filename: "customers.csv", base64: csvBase64(SAMPLE) });
  assert.deepEqual(preview.counts, { create: 2, update: 2, same: 0, conflict: 0, skipped: 1 });
  // Tick everything except Delta Drip (line 5).
  const include = preview.lines.filter((l) => l.status === "create" || l.status === "update").map((l) => l.line).filter((n) => n !== 5);
  const res = await applyNetsuitePlan(sql, { rows, include, filename: "customers.csv", who: "chuy" });
  assert.deepEqual([res.created, res.updated, res.notSaved], [1, 2, 0]);

  const alpha = (await pg.query("select * from directory_customers where name = 'Alpha Coffee'")).rows[0];
  assert.equal(alpha.netsuite_id, "100");
  assert.equal(alpha.account_number, "00042");
  assert.equal(alpha.address, "1 Main St, Houston, TX 77002");
  assert.equal(alpha.billing_address1, "PO Box 9");
  assert.equal(alpha.primary_contact, "Pat Lee");
  const beta = (await pg.query("select * from directory_customers where name = 'Beta Bar'")).rows[0];
  assert.equal(beta.account_number, null, "an account number that is the company name stays blank");
  assert.equal(beta.netsuite_id, "200");
  assert.equal((await pg.query("select inactive from directory_customers where name = 'Gamma Grind'")).rows[0].inactive, true);
  assert.equal((await pg.query("select count(*)::int as n from directory_customers where name = 'Delta Drip'")).rows[0].n, 0, "unticked rows aren't saved");
  const walkIn = (await pg.query("select netsuite_id from directory_customers where name = 'Walk - In: Houston'")).rows[0];
  assert.equal(walkIn.netsuite_id, null, "the Walk-In account is untouched");

  const history = (await pg.query("select action, detail, actor_name from activity where entity_type = 'customer' order by id")).rows;
  assert.equal(history.length, 3);
  assert.ok(history.some((h) => h.action === "added" && /Added by the NetSuite import \(NetSuite ID 200\)/.test(h.detail)));
  assert.ok(history.every((h) => h.actor_name === "chuy"));
  const [run] = await recentNetsuiteRuns(sql);
  assert.deepEqual(
    [run.filename, run.rowCount, run.willCreate, run.willUpdate, run.skipped, run.excluded, run.created, run.updated, run.createdBy],
    ["customers.csv", 5, 2, 2, 1, 1, 1, 2, "chuy"],
  );

  // The same file again: only Delta Drip (never ticked) is left to add; nothing else changes and nothing is added twice.
  const again = await previewNetsuitePlan(sql, { filename: "customers.csv", base64: csvBase64(SAMPLE) });
  assert.deepEqual(again.counts, { create: 1, update: 0, same: 3, conflict: 0, skipped: 1 });
  const all = again.lines.filter((l) => l.status === "create").map((l) => l.line);
  await applyNetsuitePlan(sql, { rows, include: all, filename: "customers.csv", who: "chuy" });
  const third = await previewNetsuitePlan(sql, { filename: "customers.csv", base64: csvBase64(SAMPLE) });
  assert.deepEqual(third.counts, { create: 0, update: 0, same: 4, conflict: 0, skipped: 1 });
  const names = (await pg.query("select lower(name) as n, count(*)::int as c from directory_customers group by 1 having count(*) > 1")).rows;
  assert.deepEqual(names, [], "no account added twice");
  await assert.rejects(applyNetsuitePlan(sql, { rows, include: [2, 3, 4, 5], filename: "customers.csv", who: "chuy" }), /Nothing to save/);
});

test("saving: a matched account keeps its name, and one changed after the plan is skipped", async () => {
  const { pg, sql } = await fresh();
  await pg.query("insert into directory_customers (name, netsuite_id) values ('Alpha Coffee', '100'), ('Beta Bar', '200')");
  const rows = read([row({ id: "100", name: "Alpha Coffee Co.", phone: "713-555-0100" }), row({ id: "200", name: "Beta Bar", phone: "214-555-0100" })]);
  // Someone edits Beta between the plan and the save.
  const racing = {
    query: async (text, params) => {
      if (/with input as/.test(text)) await pg.query("update directory_customers set updated_at = now() + interval '1 second' where name = 'Beta Bar'");
      return sql.query(text, params);
    },
  };
  const res = await applyNetsuitePlan(racing, { rows, include: [2, 3], filename: "f.csv", who: "chuy" });
  assert.deepEqual([res.updated, res.notSaved], [1, 1]);
  const got = (await pg.query("select name, phone from directory_customers order by id")).rows;
  assert.deepEqual(got, [
    { name: "Alpha Coffee", phone: "713-555-0100" },
    { name: "Beta Bar", phone: null },
  ]);
});

test("saving: a new name another account took meanwhile is skipped, and the rest still saves", async () => {
  const { pg, sql } = await fresh();
  const rows = read([row({ id: "1", name: "Alpha Coffee" }), row({ id: "2", name: "Beta Bar" })]);
  const racing = {
    query: async (text, params) => {
      if (/with input as/.test(text)) await pg.query("insert into directory_customers (name) values ('Beta Bar')");
      return sql.query(text, params);
    },
  };
  const res = await applyNetsuitePlan(racing, { rows, include: [2, 3], filename: "f.csv", who: "chuy" });
  assert.deepEqual([res.created, res.notSaved], [1, 1]);
  assert.equal((await pg.query("select count(*)::int as n from directory_customers where name = 'Beta Bar'")).rows[0].n, 1);
  assert.equal((await loadNetsuiteAccounts(sql)).length, 2);
});

test("counts add up to the rows", () => {
  const lines = planNetsuiteCustomers(read(SAMPLE), []);
  const c = countNetsuitePlan(lines);
  assert.equal(c.create + c.update + c.same + c.conflict + c.skipped, SAMPLE.length);
});
