// Install Board chip copy, and the one shared Walk - In account (Corrigo, Billing Backfill, Export Billing,
// and the server refusing a PM, install, deal, TLC or equipment on it). Made-up rows only.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/unused";

const { installChip, installHiddenMessage, clearedInstallNarrow } = await import("../src/lib/ops/install-board.ts");
const { accountIndex, resolveRowAccount } = await import("../src/lib/ops/corrigo.ts");
const { parseCorrigoMatrix } = await import("../src/lib/ops/corrigo.ts");
const { previewCorrigoRecords, applyCorrigoRows } = await import("../src/lib/ops/corrigo-import.ts");
const { assertWalkInSite } = await import("../src/lib/ops/walk-in-account.ts");
const { openTicketFor, updatePmFor, updateInstallFor, updateDealFor } = await import("../src/lib/ops/api.ts");
const { addEquipmentUnit } = await import("../src/lib/ops/account-equip-edit.ts");
const api = await import("../src/lib/ops/billing-backfill-api.ts");
const charges = await import("../src/lib/ops/charges-api.ts");

const dir = new URL("../migrations/", import.meta.url);

async function fresh() {
  const pg = new PGlite();
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  await pg.query(
    `insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ('u-owner', 'chuy', true, true, 'admin')`,
  );
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  await sql.query("insert into directory_customers (name) values ('Zz Bean Cafe'), ('Zz Rock - Katy')");
  return { pg, sql };
}

const csv = (rows) => rows.map((r) => r.map((c) => String(c)).join(",")).join("\n") + "\n";
const file = (name, rows) => ({ name, base64: Buffer.from(csv(rows)).toString("base64") });
const CHARGES_HEAD = ["WO", "Source invoice #", "Source SO #", "PO", "NetSuite customer", "Location", "Item", "Item type", "Description", "Qty", "Rate", "Amount", "Discount Item", "Discount Amount", "Record total (after discount)"];
const INVOICES_HEAD = ["WO", "SO #", "SO status", "Invoice #", "Invoice date", "Invoice status", "Invoice total", "Amount remaining", "Charges source", "Corrigo net (reference)"];

test("Prep chip names the filter, and Show all brings the installs back", () => {
  const open = [
    { id: 1, mine: false },
    { id: 2, mine: false },
    { id: 3, mine: false },
  ];
  const mineOn = true;
  const shown = open.filter((i) => !mineOn || i.mine);
  assert.equal(installChip("Prep", shown.length, open.length, true, true), "Prep (0 of 3)");
  assert.equal(installChip("Installed", 4, 4, false, true), "Installed (4)");
  assert.match(installHiddenMessage("prep", { mine: true, rep: false, ak: false, search: false }), /My View \(you're not the rep or tech on any\)/);
  assert.match(installHiddenMessage("prep", { mine: false, rep: true, ak: false, search: false }), /this rep/);
  assert.match(installHiddenMessage("prep", { mine: false, rep: false, ak: true, search: true }), /AK \/ your search/);
  const cleared = clearedInstallNarrow();
  const after = open.filter((i) => !cleared.mine || i.mine);
  assert.equal(after.length, 3);
  assert.equal(installChip("Prep", after.length, open.length, cleared.mine, true), "Prep (3)");
});

test("Corrigo: no location uses Walk - In and is not held; a matching location uses that account; an unmatched location needs review; reassigning writes the picked account", async () => {
  const { pg, sql } = await fresh();
  try {
    await sql.query("insert into directory_customers (name, walk_in) values ('Walk - In', true)");
    const before = (await sql.query("select count(*)::int as n from directory_customers"))[0].n;
    const matrix = [
      ["ST#", "Operational Status", "Customer Name", "Service Location Name", "Type", "Contact", "Contact Phone"],
      ["0901", "Work Started", "Walk - In", "", "Request", "Ada Guest", "555-0101"],
      ["0902", "Work Started", "Walk - In", "Zz Rock - Katy", "Request", "", ""],
      ["0903", "Work Started", "Walk - In", "Zz Nowhere Shop", "Request", "", ""],
    ];
    const { records } = parseCorrigoMatrix(matrix);
    const preview = await previewCorrigoRecords(sql, records);
    const by = Object.fromEntries(preview.rows.map((r) => [r.wo, r]));
    assert.equal(by["WO-0901"].needsReview, false);
    assert.equal(by["WO-0901"].customer, "Walk - In");
    assert.equal(by["WO-0901"].account.status, "onetime");
    assert.equal(by["WO-0901"].account.note, "One-time · Walk - In");
    assert.deepEqual([by["WO-0902"].customer, by["WO-0902"].account.status, by["WO-0902"].needsReview], ["Zz Rock - Katy", "location", false]);
    assert.equal(by["WO-0903"].needsReview, true);
    assert.equal(by["WO-0903"].customer, null);
    assert.match(by["WO-0903"].account.note, /no account is named "Zz Nowhere Shop"/);

    const written = await applyCorrigoRows(sql, preview.rows, "chuy");
    assert.deepEqual(written.refused.map((r) => r.wo), ["WO-0903"]);
    assert.equal((await sql.query("select customer, contact, phone from service_jobs where wo = 'WO-0901'"))[0].customer, "Walk - In");
    assert.equal((await sql.query("select contact, phone from service_jobs where wo = 'WO-0901'"))[0].contact, "Ada Guest");
    assert.equal((await sql.query("select customer from service_jobs where wo = 'WO-0902'"))[0].customer, "Zz Rock - Katy");
    assert.equal((await sql.query("select count(*)::int as n from directory_customers"))[0].n, before, "no second walk-in account");

    const again = await previewCorrigoRecords(sql, parseCorrigoMatrix([
      ["ST#", "Operational Status", "Customer Name", "Service Location Name", "Type"],
      ["0904", "Work Started", "Walk-In", "", "Request"],
    ]).records);
    const moved = again.rows.map((r) => ({ ...r, customer: "Zz Bean Cafe" }));
    await applyCorrigoRows(sql, moved, "chuy");
    assert.equal((await sql.query("select customer from service_jobs where wo = 'WO-0904'"))[0].customer, "Zz Bean Cafe");
  } finally {
    await pg.close();
  }
});

test("a missing Walk - In account is refused and not created", async () => {
  const { pg, sql } = await fresh();
  try {
    const before = (await sql.query("select count(*)::int as n from directory_customers"))[0].n;
    const idx = accountIndex([{ name: "Zz Bean Cafe", archived: false, locked: false, walkIn: false }]);
    const none = resolveRowAccount({ customer: "Walk-In", serviceLocation: null }, null, idx);
    assert.equal(none.status, "walkin");
    assert.equal(none.name, null);
    assert.match(none.note, /isn't on the customer list/);
    const { records } = parseCorrigoMatrix([
      ["ST#", "Operational Status", "Customer Name", "Type"],
      ["0910", "Work Started", "Walk - In", "Request"],
    ]);
    const preview = await previewCorrigoRecords(sql, records);
    assert.equal(preview.rows[0].needsReview, true);
    const res = await applyCorrigoRows(sql, preview.rows.map((r) => ({ ...r, customer: "Walk - In" })), "chuy");
    assert.match(res.refused[0].reason, /isn't on the customer list/);
    assert.equal((await sql.query("select count(*)::int as n from service_jobs"))[0].n, 0);
    assert.equal((await sql.query("select count(*)::int as n from directory_customers"))[0].n, before);
  } finally {
    await pg.close();
  }
});

test("Billing Backfill writes a Walk - In ticket only when NetSuite's invoice is also to Walk - In", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = (await sql.query(
      `insert into service_jobs (kind, call_id, customer, wo, status, received, completed_at)
       values ('service', 'SC-W', 'Walk - In', 'WO-0990', 'Completed', '2026-09-01', '2026-09-10') returning id`,
    ))[0].id;
    const other = (await sql.query(
      `insert into service_jobs (kind, call_id, customer, wo, status, received, completed_at)
       values ('service', 'SC-X', 'Walk - In', 'WO-0991', 'Completed', '2026-09-01', '2026-09-10') returning id`,
    ))[0].id;
    const charge = (wo, who) => [wo, "INV" + wo, "SO" + wo, "", who, "", "Service : TRIPCHARGE", "Service", "Trip", "1", "40", "40", "", "", "40"];
    const invoice = (wo) => [wo, "SO" + wo, "Billed", "INV" + wo, "2026-10-02", "Open", "40", "40", "Yes", ""];
    const yes = [file("charges.csv", [CHARGES_HEAD, charge("WO-0990", "Walk - In")]), file("invoices.csv", [INVOICES_HEAD, invoice("WO-0990")])];
    const wrote = await api.previewBillingBackfillFor(sql, yes, "u-owner");
    assert.equal(wrote.plans[0].status, "write");
    assert.equal(wrote.plans[0].reason, null);
    await api.applyBillingBackfillFor(sql, yes, "u-owner", { hash: wrote.hash, skip: [] });
    assert.equal((await sql.query("select count(*)::int as n from ticket_invoices where job_id = $1", [id]))[0].n, 1);

    const no = [file("charges.csv", [CHARGES_HEAD, charge("WO-0991", "Zz Bean Cafe")]), file("invoices.csv", [INVOICES_HEAD, invoice("WO-0991")])];
    const skipped = await api.previewBillingBackfillFor(sql, no, "u-owner");
    assert.equal(skipped.plans[0].status, "skip");
    assert.match(skipped.plans[0].reason, /NetSuite bills Zz Bean Cafe, not Walk - In/);
    assert.equal((await sql.query("select count(*)::int as n from ticket_charges where job_id = $1", [other]))[0].n, 0);
  } finally {
    await pg.close();
  }
});

test("Export Billing includes Walk - In tickets and lists them", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = (await sql.query(
      `insert into service_jobs (kind, call_id, customer, wo, status, completed_at)
       values ('service', 'SC-E', 'Walk-In', 'WO-0888', 'Completed', '2026-10-04') returning id`,
    ))[0].id;
    await sql.query("insert into ticket_charges (job_id, item, qty, rate, sort) values ($1, 'Service : TRIPCHARGE', 1, 25, 1)", [id]);
    const out = await charges.exportBillingFor(sql, { from: "2026-10-01", to: "2026-10-31" });
    assert.equal(out.tickets, 1);
    assert.ok(out.csv.includes("Walk - In"));
    assert.ok(out.csv.includes("WO-0888"));
    assert.deepEqual(out.walkIn.map((t) => t.wo), ["WO-0888"]);
    assert.equal(out.noAccount.length, 0);
  } finally {
    await pg.close();
  }
});

test("a PM, install, deal, TLC schedule or equipment on Walk - In is refused", async () => {
  const { pg, sql } = await fresh();
  try {
    await sql.query("insert into directory_customers (name, walk_in) values ('Walk - In', true)");
    assert.throws(() => assertWalkInSite("pm", "Walk - In"), /doesn't take a PM/);
    assert.throws(() => assertWalkInSite("install", "Walk-In"), /doesn't take an install/);
    assert.throws(() => assertWalkInSite("deal", "Walk - In"), /doesn't take a deal/);
    assert.throws(() => assertWalkInSite("tlc", "Walk - In"), /doesn't take a TLC schedule/);
    assert.throws(() => assertWalkInSite("equipment", "Walk - In"), /no account to add equipment/);
    assert.equal(assertWalkInSite("pm", "Zz Bean Cafe"), undefined);

    await assert.rejects(() => openTicketFor(sql, { kind: "tlc", customer: "Walk - In", received: "2026-11-01" }), /TLC schedule/);
    const pm = (await sql.query("insert into pm_jobs (customer, status) values ('Zz Bean Cafe', 'Pending Scheduling') returning id"))[0].id;
    await assert.rejects(() => updatePmFor(sql, { id: pm, customer: "Walk - In" }, "u-owner"), /doesn't take a PM/);
    assert.equal((await sql.query("select customer from pm_jobs where id = $1", [pm]))[0].customer, "Zz Bean Cafe");
    const install = (await sql.query("insert into installs (customer, received) values ('Zz Bean Cafe', '2026-11-01') returning id"))[0].id;
    await assert.rejects(() => updateInstallFor(sql, { id: install, customer: "Walk - In" }, { userId: "u-owner" }), /doesn't take an install/);
    const deal = (await sql.query("insert into deals (customer) values ('Zz Bean Cafe') returning id"))[0].id;
    await assert.rejects(() => updateDealFor(sql, { id: deal, customer: "Walk - In" }, "u-owner"), /doesn't take a deal/);
    await assert.rejects(() => addEquipmentUnit(sql, "Walk - In", { model: "Test Grinder" }), /no account to add equipment/);
    assert.equal((await sql.query("select count(*)::int as n from account_equipment"))[0].n, 0);

    const { records } = parseCorrigoMatrix([
      ["ST#", "Operational Status", "Customer Name", "Type", "P.O. #"],
      ["0921", "Work Started", "Walk - In", "PM", ""],
      ["0922", "Work Started", "Walk - In", "Install", "Install"],
    ]);
    const preview = await previewCorrigoRecords(sql, records);
    assert.ok(preview.rows.every((r) => r.needsReview));
    const res = await applyCorrigoRows(sql, preview.rows, "chuy");
    assert.equal(res.created, 0);
    assert.equal(res.refused.length, 2);
    assert.ok(res.refused.every((r) => /doesn't take/.test(r.reason)));
    assert.equal((await sql.query("select count(*)::int as n from pm_jobs where customer = 'Walk - In'"))[0].n, 0);
    assert.equal((await sql.query("select count(*)::int as n from installs where customer = 'Walk - In'"))[0].n, 0);
  } finally {
    await pg.close();
  }
});
