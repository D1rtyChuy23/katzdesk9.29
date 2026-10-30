// Warehouse refurb invoices (Chuy, 2026-10-29): the Warehouse role records the parts a refurb used on the rebuild's
// invoice, billed to Katz Coffee Service Dept. only, and saves it for an Admin to approve; an Admin approves it.
// Warehouse changes only its refurbs (Katz Coffee Service Dept. or Katz shop / stock) and gets Rebuilds and Parts.
// Later the same day: Warehouse pulls a unit onto its refurb from wherever it is, with no approval, and every Admin
// hears where it came from; and Warehouse doesn't change part photos.
// All data is made up; "Katz Coffee Service Dept." is Katz's own internal account, the one the feature bills.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const W = await import("../src/lib/ops/warehouse-invoice.ts");
const P = await import("../src/lib/ops/warehouse-pull.ts");
const { approveInvoiceFor, getInvoiceFor, listAccountInvoicesFor, saveForApprovalSql, saveInvoiceForApprovalFor } = await import("../src/lib/ops/invoice-api.ts");
const { archiveRebuildFor, createRebuildFor, listRebuildsFor, pullRebuildSerialFor, updateRebuildFor } = await import("../src/lib/ops/rebuilds.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();

const SD = "Katz Coffee Service Dept.";
const SHOP = "Katz shop / stock";

async function fresh() {
  const pg = new PGlite();
  for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  await pg.query(
    `insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values
       ('u-owner', 'boss', true, true, 'admin'),
       ('u-role', 'ana', true, false, 'admin'),
       ('u-tech', 'tess', true, false, 'service'),
       ('u-sales', 'sam', true, false, 'sales'),
       ('u-wh', 'wade', true, false, 'warehouse'),
       ('u-wh-owner', 'hank', true, true, 'warehouse'),
       ('u-unapproved', 'nora', false, true, 'admin')`,
  );
  // The rebuild list seeds sample projects into an empty table; mark it seeded so only these made-up rows exist.
  await pg.query("insert into seed_meta (k, v) values ('rebuilds', 'v1') on conflict (k) do update set v = 'v1'");
  await pg.query("insert into directory_customers (name, account_number, address) values ($1, 'TEST-SD-1', '100 Test Way'), ('Bean Test Cafe', 'TEST-C-9', '9 Fake St')", [SD]);
  await pg.query(
    `insert into billing_items (sku, parent, item, description, rate, kind) values
       ('TESTGASKET1', 'PARTS', 'PARTS : TESTGASKET1', 'Test group gasket', 12.50, 'part'),
       ('TESTVALVE2', 'PARTS', 'PARTS : TESTVALVE2', 'Test steam valve', 80.00, 'part'),
       ('TESTPUMP3', 'PARTS', 'PARTS : TESTPUMP3', 'Test pump', 210.00, 'part')`,
  );
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async () => assert.fail("tagged query"), { query });
  return { pg, sql };
}

const rebuild = async (pg, title, account) => Number((await pg.query("insert into rebuilds (title, account) values ($1, $2) returning id", [title, account])).rows[0].id);
const head = async (pg, id, type = "rebuild") => (await pg.query("select * from invoices where entity_type = $1 and entity_id = $2", [type, id])).rows[0];
const savedLines = async (pg, invoiceId) =>
  (await pg.query("select item, qty::text as qty, rate::text as rate, kind from invoice_lines where invoice_id = $1 order by sort, id", [invoiceId])).rows;
const pings = async (pg) => (await pg.query("select user_id, from_name, body, customer, entity_type, entity_id from desk_notifications order by id")).rows;
const tick = () => new Promise((r) => setTimeout(r, 5));

const GASKETS = { item: "PARTS : TESTGASKET1", description: "Test group gasket", qty: "2", rate: "12.50" };
const VALVE = { item: "PARTS : TESTVALVE2", description: "Test steam valve", qty: 1, rate: 80 };
const PUMP = { item: "PARTS : TESTPUMP3", description: "Test pump", qty: 1, rate: "210.00" };
const LABOR = { item: "Service : SERVICELABOR", description: "Service Labor Hour", qty: 1, rate: 150 };
const TRIP = { item: "Service : TRIPCHARGE", description: "Trip Charge for Service Call", qty: 1, rate: 150 };

const save = (sql, id, lines, userId = "u-wh", discount = null) => saveInvoiceForApprovalFor(sql, { type: "rebuild", id, lines, discount }, userId);
const approve = (sql, type, id, lines, userId, seen = null) => approveInvoiceFor(sql, { type, id, lines, lineIds: [], discount: null, seen }, userId);
const view = (sql, id, userId, type = "rebuild") => getInvoiceFor(sql, { type, id }, userId);

test("Katz Coffee Service Dept., however it is typed; Warehouse changes only its refurbs", () => {
  for (const name of [SD, "katz coffee service dept", "KATZ COFFEE SERVICE DEPARTMENT", "  Katz Coffee  Service Dept "]) assert.ok(W.isServiceDeptAccount(name), name);
  for (const name of ["Katz Coffee", "Katz Coffee Service", SHOP, "Bean Test Cafe", "", null]) assert.ok(!W.isServiceDeptAccount(name), String(name));
  assert.deepEqual([W.warehouseMayEdit(SD), W.warehouseMayEdit(SHOP), W.warehouseMayEdit("katz shop/stock"), W.warehouseMayEdit("Bean Test Cafe")], [true, true, true, false]);
  assert.deepEqual(W.warehouseAccountChange(SHOP, SD), { ok: true, serviceDept: true });
  assert.deepEqual(W.warehouseAccountChange(SHOP, undefined), { ok: true, serviceDept: false });
  assert.deepEqual(W.warehouseAccountChange(SHOP, SHOP), { ok: true, serviceDept: false });
  assert.deepEqual(W.warehouseAccountChange(SD, null), { ok: true, serviceDept: true });
  assert.match(W.warehouseAccountChange(SD, SHOP).error, /^Warehouse refurbs bill Katz Coffee Service Dept\. Ask an Admin/);
  assert.match(W.warehouseAccountChange(SD, "Bean Test Cafe").error, /^Warehouse refurbs bill Katz Coffee Service Dept\./);
  assert.equal(W.warehouseAccountChange("Bean Test Cafe", SD).error, "Warehouse changes refurbs for Katz Coffee Service Dept. and Katz shop / stock only. This rebuild is for Bean Test Cafe; ask an Admin.");
});

test("who may approve or save: Admins approve, Warehouse saves its refurbs' parts for approval, the rest approve unless it waits for an Admin", () => {
  const admin = { admin: true, warehouse: false };
  const wh = { admin: false, warehouse: true };
  const tech = { admin: false, warehouse: false };
  const rec = (state, customer = SD, type = "rebuild") => ({ type, customer, state });
  assert.deepEqual([W.invoiceState(null), W.invoiceState({ submittedAt: "x" }), W.invoiceState({ submittedAt: "x", approvedAt: "y" }), W.invoiceState({})], ["none", "waiting", "approved", "none"]);
  for (const state of ["none", "waiting", "approved"]) {
    assert.deepEqual(W.invoicePowers(admin, rec(state)), { canApprove: true, canSave: false, partsOnly: false, blocked: null });
  }
  assert.deepEqual(W.invoicePowers(wh, rec("none")), { canApprove: false, canSave: true, partsOnly: true, blocked: null });
  assert.deepEqual(W.invoicePowers(wh, rec("waiting")), { canApprove: false, canSave: true, partsOnly: true, blocked: null });
  assert.equal(W.invoicePowers(wh, rec("approved")).blocked, "This invoice is approved. Ask an Admin to change it.");
  assert.match(W.invoicePowers(wh, rec("none", SHOP)).blocked, /on Katz shop \/ stock: on Details, choose Bill Katz Coffee Service Dept\. and Save/);
  assert.match(W.invoicePowers(wh, rec("none", "Bean Test Cafe")).blocked, /bill Katz Coffee Service Dept\. only\. This rebuild is for Bean Test Cafe; an Admin invoices it/);
  assert.equal(W.invoicePowers(wh, rec("none", SD, "service")).blocked, "Warehouse invoices are for rebuilds.");
  for (const state of ["none", "approved"]) assert.deepEqual(W.invoicePowers(tech, rec(state, "Bean Test Cafe")), { canApprove: true, canSave: false, partsOnly: false, blocked: null });
  assert.deepEqual(W.invoicePowers(tech, rec("waiting")), { canApprove: false, canSave: false, partsOnly: false, blocked: "This invoice is waiting for an Admin to approve it." });
  assert.equal(W.partsOnlyError([{ kind: "part" }, { kind: "part" }]), null);
  assert.equal(W.partsOnlyError([{ kind: "part" }, { kind: "equipment" }]), "Line 2: Warehouse invoices are for parts, and this item is equipment. Take it off; an Admin can add it when approving.");
  assert.match(W.partsOnlyError([{ kind: "other" }]), /^Line 1: Warehouse invoices are for parts, and this item is not a part\./);
  assert.match(W.partsOnlyError([{ kind: "part" }, { kind: "labor" }]), /^Line 2: Warehouse invoices are for parts\. Take the labor off/);
  assert.match(W.partsOnlyError([{ kind: "trip" }]), /^Line 1: .*Take the trip charge off/);
  const notice = W.waitingNotice("wade", "Rebuild: Test Linea refurb", SD, 2, 105);
  assert.equal(notice, "Invoice waiting for approval. wade saved 2 part lines on Rebuild: Test Linea refurb (Katz Coffee Service Dept.), $105.00. Open its Invoices tab to approve it.");
  assert.ok(W.isWaitingNotice(notice) && !W.isWaitingNotice("Pending removal. wade asked to remove a unit."));
});

test("Warehouse saves a refurb's parts for approval: billed to Katz Coffee Service Dept., not approved, and every Admin is pinged once", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await rebuild(pg, "Test Linea refurb", SD);
    const before = await view(sql, id, "u-wh");
    assert.deepEqual([before.state, before.canSave, before.canApprove, before.partsOnly, before.blocked], ["none", true, false, true, null]);
    assert.deepEqual([before.billTo.name, before.billTo.accountNumber, before.billTo.address], [SD, "TEST-SD-1", "100 Test Way"]);

    const saved = await save(sql, id, [GASKETS, VALVE]);
    assert.deepEqual([saved.state, saved.submittedBy, saved.approvedAt, saved.approvedBy, saved.total, saved.lines.length], ["waiting", "wade", null, null, 105, 2]);
    assert.ok(saved.version && saved.submittedAt);
    const h = await head(pg, id);
    assert.deepEqual([h.customer, h.bill_name, h.bill_account, h.bill_address, h.total, h.approved_at, h.approved_by, h.submitted_by], [SD, SD, "TEST-SD-1", "100 Test Way", "105.00", null, null, "wade"]);
    assert.deepEqual(await savedLines(pg, h.id), [
      { item: "PARTS : TESTGASKET1", qty: "2.00", rate: "12.50", kind: "part" },
      { item: "PARTS : TESTVALVE2", qty: "1.00", rate: "80.00", kind: "part" },
    ]);

    // Every Admin who can approve (the owner flag or the Admin role, approved) gets one ping that opens the rebuild.
    const sent = await pings(pg);
    assert.deepEqual(sent.map((p) => p.user_id).sort(), ["u-owner", "u-role", "u-wh-owner"]);
    for (const p of sent) {
      assert.deepEqual([p.from_name, p.customer, p.entity_type, Number(p.entity_id)], ["wade", SD, "rebuild", id]);
      assert.equal(p.body, "Invoice waiting for approval. wade saved 2 part lines on Rebuild: Test Linea refurb (Katz Coffee Service Dept.), $105.00. Open its Invoices tab to approve it.");
    }
    const logged = (await pg.query("select actor_name, detail from activity where entity_type = 'rebuild' and entity_id = $1", [id])).rows;
    assert.deepEqual(logged, [{ actor_name: "wade", detail: "invoice saved for approval: 2 lines, total $105.00" }]);

    // Saving again (still waiting) replaces the lines and the stamp; no second ping.
    await tick();
    const again = await save(sql, id, [GASKETS, VALVE, PUMP]);
    assert.deepEqual([again.state, again.total, again.lines.length], ["waiting", 315, 3]);
    assert.notEqual(again.version, saved.version);
    assert.equal((await savedLines(pg, h.id)).length, 3);
    assert.equal((await pings(pg)).length, 3);

    // Where an Admin finds it: the account's Invoices tab and the rebuild board.
    const listed = await listAccountInvoicesFor(sql, SD, "u-owner");
    assert.deepEqual(
      listed.map((r) => [r.type, r.id, r.title, r.total, r.status, r.submittedBy, r.approvedAt]),
      [["rebuild", id, "Rebuild: Test Linea refurb", 315, "Waiting for approval", "wade", null]],
    );
    assert.equal((await listRebuildsFor(sql, "u-owner")).rows.find((r) => r.id === id).invoice, "waiting");
  } finally {
    await pg.close();
  }
});

test("Warehouse never approves, and an invoice waiting for approval is approved by an Admin only; then it's the Admin's", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await rebuild(pg, "Test Strada refurb", SD);
    await save(sql, id, [GASKETS, VALVE]);
    const seen = (await view(sql, id, "u-owner")).version;
    await assert.rejects(() => approve(sql, "rebuild", id, [GASKETS], "u-wh", seen), /^Error: An Admin approves warehouse invoices\. Use Save for Approval\.$/);
    for (const userId of ["u-tech", "u-sales"]) {
      await assert.rejects(() => approve(sql, "rebuild", id, [GASKETS], userId, seen), /^Error: This invoice is waiting for an Admin to approve it\.$/, userId);
      const v = await view(sql, id, userId);
      assert.deepEqual([v.canApprove, v.canSave, v.blocked], [false, false, "This invoice is waiting for an Admin to approve it."], userId);
    }
    assert.equal((await head(pg, id)).approved_at, null);

    // The Admin role (not only the owner flag) approves, and may change the lines first.
    const done = await approve(sql, "rebuild", id, [GASKETS, VALVE, PUMP], "u-role", seen);
    assert.deepEqual([done.state, done.approvedBy, done.submittedBy, done.total, done.canApprove], ["approved", "ana", "wade", 315, true]);
    const h = await head(pg, id);
    assert.ok(h.approved_at);
    assert.deepEqual([h.approved_by, h.submitted_by, h.total], ["ana", "wade", "315.00"]);
    assert.equal((await savedLines(pg, h.id)).length, 3);

    // After the approval, Warehouse reads it but can't change it.
    const wh = await view(sql, id, "u-wh");
    assert.deepEqual([wh.state, wh.canSave, wh.canApprove, wh.blocked], ["approved", false, false, "This invoice is approved. Ask an Admin to change it."]);
    await assert.rejects(() => save(sql, id, [GASKETS]), /^Error: This invoice is approved\. Ask an Admin to change it\.$/);
    assert.equal((await savedLines(pg, h.id)).length, 3);
    assert.equal((await listAccountInvoicesFor(sql, SD, "u-owner"))[0].status, "Approved");
    assert.equal((await listRebuildsFor(sql, "u-wh")).rows.find((r) => r.id === id).invoice, "approved");
    // The desk owner flag is an Admin even with the Warehouse role.
    assert.deepEqual([(await view(sql, id, "u-wh-owner")).canApprove, (await view(sql, id, "u-wh-owner")).canSave], [true, false]);
  } finally {
    await pg.close();
  }
});

test("an Admin's approval never overwrites parts Warehouse saved after the window opened", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await rebuild(pg, "Test Cameo refurb", SD);
    await save(sql, id, [GASKETS, VALVE]);
    const opened = await view(sql, id, "u-owner");
    await tick();
    await save(sql, id, [GASKETS, VALVE, PUMP]);
    await assert.rejects(
      () => approve(sql, "rebuild", id, [GASKETS, VALVE], "u-owner", opened.version),
      /^Error: Warehouse saved changes to this invoice after you opened it, so nothing was approved\./,
    );
    const h = await head(pg, id);
    assert.deepEqual([h.approved_at, (await savedLines(pg, h.id)).length], [null, 3]);
    // Opened again: approved.
    const reopened = await view(sql, id, "u-owner");
    assert.equal((await approve(sql, "rebuild", id, reopened.lines, "u-owner", reopened.version)).state, "approved");
    assert.equal((await savedLines(pg, h.id)).length, 3);

    // A window opened before Warehouse's first save (no stamp) can't approve over it either.
    const other = await rebuild(pg, "Test KB90 refurb", SD);
    const early = await view(sql, other, "u-owner");
    assert.equal(early.version, null);
    await save(sql, other, [PUMP]);
    await assert.rejects(() => approve(sql, "rebuild", other, [GASKETS], "u-owner", early.version), /saved changes to this invoice after you opened it/);
    assert.equal((await head(pg, other)).approved_at, null);
  } finally {
    await pg.close();
  }
});

test("Warehouse invoices only Katz Coffee Service Dept. refurbs, parts only, and opens rebuild invoices only", async () => {
  const { pg, sql } = await fresh();
  try {
    const sd = await rebuild(pg, "Test Faema refurb", SD);
    const shop = await rebuild(pg, "Test shop refurb", SHOP);
    const cust = await rebuild(pg, "Test customer rebuild", "Bean Test Cafe");
    await assert.rejects(() => save(sql, shop, [GASKETS]), /^Error: Warehouse invoices bill Katz Coffee Service Dept\. This rebuild is on Katz shop \/ stock: on Details, choose Bill Katz Coffee Service Dept\. and Save, then invoice it\.$/);
    await assert.rejects(() => save(sql, cust, [GASKETS]), /^Error: Warehouse invoices bill Katz Coffee Service Dept\. only\. This rebuild is for Bean Test Cafe; an Admin invoices it\.$/);
    await assert.rejects(() => save(sql, sd, [GASKETS, LABOR]), /^Error: Line 2: Warehouse invoices are for parts\. Take the labor off; an Admin can add it when approving\.$/);
    await assert.rejects(() => save(sql, sd, [TRIP]), /^Error: Line 1: Warehouse invoices are for parts\. Take the trip charge off/);
    await assert.rejects(() => save(sql, sd, []), /^Error: Add the parts the refurb used, then save\.$/);
    await assert.rejects(() => save(sql, sd, [{ ...GASKETS, qty: "0" }]), /^Error: Line 1: Quantity must be more than zero\.$/);
    // Parts from the part list only (never a typed name, equipment or a hidden part), with no discount, on the board.
    const offList = /^Error: Line (\d): Warehouse invoices take parts from the part list\. Add it with Add a part\.$/;
    await assert.rejects(() => save(sql, sd, [GASKETS, { item: "Bench labor 3 hrs", description: "", qty: 3, rate: 150 }]), offList);
    await assert.rejects(() => save(sql, sd, [{ item: "EQUIPMENT : TEST GRINDER", description: "", qty: 1, rate: 4000 }]), /^Error: Line 1: Warehouse invoices are for parts, and this item is equipment\./);
    await pg.query("update billing_items set hidden_at = now() where sku = 'TESTPUMP3'");
    await assert.rejects(() => save(sql, sd, [PUMP]), offList);
    await pg.query("update billing_items set hidden_at = null where sku = 'TESTPUMP3'");
    await assert.rejects(() => save(sql, sd, [GASKETS], "u-wh", { kind: "percent", value: "10" }), /^Error: Warehouse invoices have no discount\. An Admin can add one when approving\.$/);
    const removed = await rebuild(pg, "Test removed refurb", SD);
    await pg.query("update rebuilds set archived = true where id = $1", [removed]);
    await assert.rejects(() => save(sql, removed, [GASKETS]), /^Error: This rebuild was removed from the board, so nothing was saved\.$/);
    await assert.rejects(() => save(sql, sd, [GASKETS], "u-tech"), /^Error: Save for Approval is the Warehouse step\. Approve the invoice instead\.$/);
    await assert.rejects(() => save(sql, sd, [GASKETS], "u-owner"), /Save for Approval is the Warehouse step/);
    assert.equal((await pg.query("select count(*)::int as n from invoices")).rows[0].n, 0, "nothing was written");
    assert.equal((await pings(pg)).length, 0);

    // Other records' invoices stay closed to Warehouse.
    const job = Number((await pg.query("insert into service_jobs (kind, call_id, customer) values ('service', 'SC-TEST-1', 'Bean Test Cafe') returning id")).rows[0].id);
    await assert.rejects(() => view(sql, job, "u-wh", "service"), /^Error: Warehouse opens rebuild invoices only\.$/);
    await assert.rejects(() => saveInvoiceForApprovalFor(sql, { type: "service", id: job, lines: [GASKETS], discount: null }, "u-wh"), /^Error: Warehouse invoices are for rebuilds\.$/);
    // A customer's rebuild invoice stays closed to Warehouse (no customer billing); its shop refurb's says what to do.
    await assert.rejects(() => view(sql, cust, "u-wh"), /^Error: Warehouse invoices bill Katz Coffee Service Dept\. only\. This rebuild is for Bean Test Cafe; an Admin invoices it\.$/);
    const shopView = await view(sql, shop, "u-wh");
    assert.deepEqual([shopView.canSave, shopView.canApprove, shopView.partsOnly], [false, false, true]);
    assert.match(shopView.blocked, /choose Bill Katz Coffee Service Dept\. and Save/);

    // At the write itself: nothing is saved once the rebuild is off Katz Coffee Service Dept., or once it's approved.
    const params = (id) => [id, SD, null, null, SD, "TEST-SD-1", "100 Test Way", null, 25, "wade", ["PARTS : TESTGASKET1"], [""], [2], [12.5], ["part"], [...W.SERVICE_DEPT_KEYS]];
    await pg.query("update rebuilds set account = 'Bean Test Cafe' where id = $1", [sd]);
    assert.deepEqual(await sql.query(saveForApprovalSql(), params(sd)), []);
    await pg.query("update rebuilds set account = $2 where id = $1", [sd, SD]);
    assert.equal((await sql.query(saveForApprovalSql(), params(sd))).length, 1);
    await pg.query("update invoices set approved_at = now(), approved_by = 'boss' where entity_type = 'rebuild' and entity_id = $1", [sd]);
    assert.deepEqual(await sql.query(saveForApprovalSql(), params(sd)), []);
  } finally {
    await pg.close();
  }
});

test("everyone else invoices as before: tickets, installs, PMs, deals and customers' rebuilds approve straight away", async () => {
  const { pg, sql } = await fresh();
  try {
    const job = Number((await pg.query("insert into service_jobs (kind, call_id, customer) values ('service', 'SC-TEST-2', 'Bean Test Cafe') returning id")).rows[0].id);
    const ticket = await approve(sql, "service", job, [GASKETS, LABOR], "u-tech");
    assert.deepEqual([ticket.state, ticket.approvedBy, ticket.total], ["approved", "tess", 175]);
    assert.equal((await pg.query("select count(*)::int as n from ticket_charges where job_id = $1", [job])).rows[0].n, 2, "a ticket's lines are its Charges");
    const th = await head(pg, job, "service");
    assert.deepEqual([th.discount_kind, th.discount_value, th.submitted_at, th.total], [null, null, null, "175.00"]);

    const install = Number((await pg.query("insert into installs (customer) values ('Bean Test Cafe') returning id")).rows[0].id);
    const inst = await approve(sql, "install", install, [VALVE, TRIP], "u-tech");
    assert.deepEqual([inst.state, inst.total, inst.lines.map((l) => l.kind)], ["approved", 230, ["part", "trip"]]);
    // Approving again replaces the lines.
    const inst2 = await approveInvoiceFor(sql, { type: "install", id: install, lines: [VALVE], lineIds: [], discount: { kind: "percent", value: "10" }, seen: null }, "u-tech");
    assert.deepEqual([inst2.total, inst2.lines.length, inst2.discount], [72, 1, { kind: "percent", value: 10 }]);

    const pm = Number((await pg.query("insert into pm_jobs (customer, equipment, status) values ('Bean Test Cafe', 'Test Brewer', 'Scheduled') returning id")).rows[0].id);
    const pmInv = await approve(sql, "pm", pm, [GASKETS], "u-tech");
    assert.deepEqual([pmInv.state, pmInv.total, pmInv.lines.length], ["approved", 25, 1]);

    const deal = Number((await pg.query("insert into deals (customer) values ('Bean Test Cafe') returning id")).rows[0].id);
    const dealInv = await approve(sql, "deal", deal, [PUMP], "u-sales");
    assert.deepEqual([dealInv.state, dealInv.approvedBy, dealInv.total], ["approved", "sam", 210]);

    const cust = await rebuild(pg, "Test customer rebuild", "Bean Test Cafe");
    const rb = await approve(sql, "rebuild", cust, [GASKETS, LABOR], "u-tech");
    assert.deepEqual([rb.state, rb.approvedBy, rb.total, rb.submittedBy], ["approved", "tess", 175, null]);
    assert.equal((await pings(pg)).length, 0, "only Warehouse's save pings");
  } finally {
    await pg.close();
  }
});

test("Warehouse's rebuilds: new ones are for Katz Coffee Service Dept., a shop refurb can move there, customer rebuilds stay read only", async () => {
  const { pg, sql } = await fresh();
  try {
    const sd = await rebuild(pg, "Test Faema refurb", SD);
    const shop = await rebuild(pg, "Test shop refurb", SHOP);
    const cust = await rebuild(pg, "Test customer rebuild", "Bean Test Cafe");
    const editable = (list) => Object.fromEntries(list.rows.map((r) => [r.title, r.editable]));
    const wh = await listRebuildsFor(sql, "u-wh");
    assert.deepEqual([wh.canEdit, wh.accountLock], [true, SD]);
    assert.deepEqual(editable(wh), { "Test Faema refurb": true, "Test shop refurb": true, "Test customer rebuild": false });
    const tech = await listRebuildsFor(sql, "u-tech");
    assert.deepEqual([tech.accountLock, Object.values(editable(tech))], [null, [true, true, true]]);
    const sales = await listRebuildsFor(sql, "u-sales");
    assert.deepEqual([sales.canEdit, sales.accountLock, Object.values(editable(sales))], [false, null, [false, false, false]]);
    assert.equal((await listRebuildsFor(sql, "u-wh-owner")).accountLock, null, "the desk owner flag is an Admin");

    // New: always Katz Coffee Service Dept., as the customer list spells it.
    const made = await createRebuildFor(sql, { title: "Test new refurb", account: "Bean Test Cafe" }, "u-wh");
    assert.equal(made.account, SD);
    await pg.query("update directory_customers set name = 'Katz Coffee Service Dept' where name = $1", [SD]);
    assert.equal((await createRebuildFor(sql, { title: "Test second refurb", account: "" }, "u-wh")).account, "Katz Coffee Service Dept");
    await pg.query("update directory_customers set name = $1 where name = 'Katz Coffee Service Dept'", [SD]);
    assert.equal((await createRebuildFor(sql, { title: "Test tech rebuild", account: "Bean Test Cafe" }, "u-tech")).account, "Bean Test Cafe", "everyone else picks the account");

    // A Katz shop / stock refurb moves to Katz Coffee Service Dept.; nothing moves anywhere else.
    const moved = await updateRebuildFor(sql, { id: shop, account: "katz coffee service dept" }, "u-wh");
    assert.equal(moved.account, SD);
    const log = (await pg.query("select detail from activity where entity_type = 'rebuild' and entity_id = $1", [shop])).rows.map((r) => r.detail);
    assert.ok(log.includes(`account: ${SD}`), log.join(" | "));
    await assert.rejects(() => updateRebuildFor(sql, { id: sd, account: "Bean Test Cafe" }, "u-wh"), /^Error: Warehouse refurbs bill Katz Coffee Service Dept\. Ask an Admin to put this rebuild on another account\.$/);
    await assert.rejects(() => updateRebuildFor(sql, { id: sd, account: SHOP }, "u-wh"), /Warehouse refurbs bill Katz Coffee Service Dept\./);
    assert.equal((await updateRebuildFor(sql, { id: sd, account: SD, notes: "Test note" }, "u-wh")).notes, "Test note");

    // A customer's rebuild: read only for Warehouse, the same as before for a tech.
    const refusal = /^Error: Warehouse changes refurbs for Katz Coffee Service Dept\. and Katz shop \/ stock only\. This rebuild is for Bean Test Cafe; ask an Admin\.$/;
    await assert.rejects(() => updateRebuildFor(sql, { id: cust, notes: "Overwritten" }, "u-wh"), refusal);
    await assert.rejects(() => updateRebuildFor(sql, { id: cust, status: "Cancelled" }, "u-wh"), refusal);
    await assert.rejects(() => archiveRebuildFor(sql, { id: cust }, "u-wh"), refusal);
    await assert.rejects(() => pullRebuildSerialFor(sql, { id: cust, serial: "TESTSN1" }, "u-wh"), refusal);
    const untouched = (await pg.query("select account, notes, status, archived, serial from rebuilds where id = $1", [cust])).rows[0];
    assert.deepEqual(untouched, { account: "Bean Test Cafe", notes: null, status: "Queued", archived: false, serial: null });
    assert.equal((await updateRebuildFor(sql, { id: cust, notes: "Tech note" }, "u-tech")).notes, "Tech note");

    // Its own refurbs: Warehouse removes them and pulls serials onto them (the pulls have their own test below).
    assert.equal((await pullRebuildSerialFor(sql, { id: sd, serial: "TESTSN1" }, "u-wh")).serial, "TESTSN1");
    assert.equal((await pg.query("select serial_notice from rebuilds where id = $1", [sd])).rows[0].serial_notice, "Serial TESTSN1 not found in warehouse.");
    assert.deepEqual(await archiveRebuildFor(sql, { id: made.id }, "u-wh"), { ok: true });
  } finally {
    await pg.close();
  }
});

test("where a pulled unit was, in the words of the confirm question and the Admins' ping", () => {
  const u = (f) => ({ site: "barn-back", pallet: null, level: null, status: "ready", soldTo: null, purpose: null, installId: null, jobId: null, ...f });
  assert.equal(P.unitWhere(u({ pallet: "B", level: 2 })), "Back · B-L2");
  assert.equal(P.unitWhere(u({ site: "barn-front", pallet: "J", level: 4 })), "Front · J-L4");
  assert.equal(P.unitWhere(u({ site: "san-antonio", status: "deployed" })), "San Antonio");
  assert.equal(P.unitWhere(u({ site: "dallas", status: "deployed" })), "Dallas");
  assert.equal(P.unitWhere(u({ site: "out-of-state", status: "deployed" })), "Out of State");
  assert.equal(P.unitWhere(u({ site: "service-room", status: "deployed" })), "Service Room");
  assert.equal(P.unitWhere(u({ site: "front-lobby", status: "deployed" })), "Lobby");
  assert.equal(P.unitWhere(u({ site: "training", status: "deployed" })), "Training");
  assert.equal(P.unitWhere(u({ site: "staging", status: "deployed" })), "Staging area");
  assert.equal(P.unitWhere(u({ site: "other", status: "deployed", purpose: "Test show booth" })), "Test show booth");
  assert.equal(P.unitWhere(u({ site: "dallas", status: "deployed", soldTo: "Bean Test Cafe" })), "Bean Test Cafe at Dallas");
  assert.equal(P.unitWhere(u({ site: "account", status: "at-account", soldTo: "Bean Test Cafe" })), "Bean Test Cafe");
  assert.equal(P.unitWhere(u({ site: "field", status: "assigned", soldTo: "Bean Test Cafe" })), "Bean Test Cafe");
  assert.equal(P.unitWhere(u({ site: "field", status: "assigned", soldTo: "Bean Test Cafe", jobId: 7 })), "a ticket for Bean Test Cafe");
  assert.equal(P.unitWhere(u({ site: "field", status: "assigned", soldTo: "Bean Test Cafe", installId: 3 })), "an install for Bean Test Cafe");
  assert.equal(P.unitWhere(u({ site: "sold", status: "sold", soldTo: "Bean Test Cafe" })), "Bean Test Cafe (sold)");
  assert.equal(P.unitWhere(u({ site: "removed", status: "removed" })), "removed stock");
  const body = P.pullNotice("wade", { model: "Test brewer", serial: "TESTSN-9" }, "San Antonio", "Test refurb");
  assert.equal(body, "Unit pulled for a refurb. wade pulled Test brewer SN TESTSN-9 from San Antonio onto Test refurb.");
  assert.ok(P.isPullNotice(body));
  assert.equal(
    P.pullNotice("wade", { model: "Test brewer", serial: "TESTSN-9" }, "Bean Test Cafe", "Test refurb", "Bean Test Cafe"),
    "Unit pulled for a refurb. wade pulled Test brewer SN TESTSN-9 from Bean Test Cafe onto Test refurb. Customers → Bean Test Cafe still lists it under Equipment.",
  );
  assert.ok(!P.isPullNotice(W.waitingNotice("wade", "Test refurb", SD, 1, 10)) && !W.isWaitingNotice(body), "the bell tells the two pings apart");
  assert.ok(!P.isPullNotice("Test tech pulled the old gasket; please reorder."), "a teammate's own ping that says pulled is just a ping");
});

test("Warehouse pulls a unit onto its refurb from wherever it is, with no approval, and every Admin hears where it came from", async () => {
  const { pg, sql } = await fresh();
  try {
    const sd = await rebuild(pg, "Test Faema refurb", SD);
    const shop = await rebuild(pg, "Test shop refurb", SHOP);
    const cust = await rebuild(pg, "Test customer rebuild", "Bean Test Cafe");
    const job = Number((await pg.query("insert into service_jobs (kind, call_id, customer) values ('service', 'SC-TEST-7', 'Bean Test Cafe') returning id")).rows[0].id);
    const install = Number((await pg.query("insert into installs (customer) values ('Bean Test Cafe') returning id")).rows[0].id);
    const unit = async (serial, f = {}) => {
      const v = { site: "barn-back", pallet: null, level: null, status: "ready", sold_to: null, job_id: null, install_id: null, purpose: null, ...f };
      const row = await pg.query(
        "insert into assets (kind, model, serial, site, pallet, level, status, sold_to, job_id, install_id, purpose) values ('equip', 'Test espresso machine', $1, $2, $3, $4, $5, $6, $7, $8, $9) returning id",
        [serial, v.site, v.pallet, v.level, v.status, v.sold_to, v.job_id, v.install_id, v.purpose],
      );
      return Number(row.rows[0].id);
    };
    const unitRow = async (id) => (await pg.query("select status, sold_to, purpose, site from assets where id = $1", [id])).rows[0];
    const links = async (id) => (await pg.query("select install_id, job_id from assets where id = $1", [id])).rows[0];
    const pull = (id, serial, userId = "u-wh", confirmReuse = undefined) => pullRebuildSerialFor(sql, { id, serial, confirmReuse }, userId);
    const pinged = async () => (await pings(pg)).sort((a, b) => a.user_id.localeCompare(b.user_id));
    const bodiesFor = async (userId) => (await pings(pg)).filter((p) => p.user_id === userId).map((p) => p.body);
    const ping = (serial, from, refurb = "Test Faema refurb") => `Unit pulled for a refurb. wade pulled Test espresso machine SN ${serial} from ${from} onto ${refurb}.`;

    // A free unit on a rack goes straight onto the refurb, and the Admins hear where it came from.
    const rack = await unit("TESTSN-RACK", { pallet: "B", level: 2 });
    const pulled = await pull(sd, "TESTSN-RACK");
    assert.deepEqual([pulled.assetId, pulled.serial, pulled.equipment], [rack, "TESTSN-RACK", "Test espresso machine"]);
    assert.equal(pulled.serialNotice, "Serial TESTSN-RACK pulled from warehouse · Test espresso machine · B-L2");
    assert.deepEqual(await unitRow(rack), { status: "assigned", sold_to: SD, purpose: "In-house rebuild", site: "barn-back" });
    const first = { from_name: "wade", body: ping("TESTSN-RACK", "Back · B-L2"), customer: SD, entity_type: "rebuild", entity_id: sd };
    assert.deepEqual(await pinged(), [{ user_id: "u-owner", ...first }, { user_id: "u-wh-owner", ...first }], "the owner flag, approved: not the Admin role, not an unapproved account");
    // The serial box pulls again when it loses focus: the same unit on the same refurb pings no one again.
    await pull(sd, "TESTSN-RACK");
    assert.equal((await pings(pg)).length, 2);

    // On a customer's account: the same confirm a tech gets, then onto the refurb. Nothing waits for an Admin.
    const theirs = await unit("TESTSN-CUST", { site: "account", status: "at-account", sold_to: "Bean Test Cafe" });
    await pg.query("insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ('Bean Test Cafe', 'Test espresso machine', 'Test espresso machine', 'TESTSN-CUST', 'testsn-cust')");
    await assert.rejects(() => pull(sd, "TESTSN-CUST"), /^Error: Serial TESTSN-CUST is already assigned to Bean Test Cafe\. Confirm reuse or cancel\.$/);
    assert.deepEqual(await unitRow(theirs), { status: "at-account", sold_to: "Bean Test Cafe", purpose: null, site: "account" }, "nothing moves before the confirm");
    assert.equal((await pg.query("select serial_notice from rebuilds where id = $1", [sd])).rows[0].serial_notice, "Serial TESTSN-CUST is already assigned to Bean Test Cafe.");
    assert.equal((await pings(pg)).length, 2, "no ping for a question");
    const reused = await pull(sd, "TESTSN-CUST", "u-wh", true);
    assert.equal(reused.serialNotice, "Serial TESTSN-CUST pulled from warehouse · Test espresso machine · On the account (was Bean Test Cafe)");
    assert.deepEqual(await unitRow(theirs), { status: "assigned", sold_to: SD, purpose: "In-house rebuild", site: "account" });

    // A shop refurb moved to Katz Coffee Service Dept. keeps its unit: its two accounts are one house for Warehouse.
    const shopUnit = await unit("TESTSN-SHOPUNIT", { pallet: "D", level: 3 });
    const shop2 = await rebuild(pg, "Test second shop refurb", SHOP);
    assert.equal((await pull(shop2, "TESTSN-SHOPUNIT")).assetId, shopUnit);
    assert.equal((await unitRow(shopUnit)).sold_to, SHOP);
    assert.equal((await updateRebuildFor(sql, { id: shop2, account: SD }, "u-wh")).account, SD);
    const pingsBeforeMove = (await pings(pg)).length;
    assert.equal((await pull(shop2, "TESTSN-SHOPUNIT")).assetId, shopUnit, "no confirm for its own unit");
    assert.deepEqual(await unitRow(shopUnit), { status: "assigned", sold_to: SD, purpose: "In-house rebuild", site: "barn-back" });
    assert.equal((await pings(pg)).length, pingsBeforeMove, "and no ping");
    await pg.query("delete from desk_notifications where entity_id = $1", [shop2]);

    // At one of our sites, on a ticket, or with a customer at another warehouse: the confirm and the ping say where.
    const sa = await unit("TESTSN-SA", { site: "san-antonio", status: "deployed" });
    await assert.rejects(() => pull(shop, "TESTSN-SA"), /^Error: Serial TESTSN-SA is already assigned to San Antonio\. Confirm reuse or cancel\.$/);
    assert.equal((await pull(shop, "TESTSN-SA", "u-wh", true)).assetId, sa);
    assert.deepEqual(await unitRow(sa), { status: "assigned", sold_to: SHOP, purpose: "In-house rebuild", site: "san-antonio" });
    const onTicket = await unit("TESTSN-TICKET", { site: "field", status: "assigned", sold_to: "Bean Test Cafe", job_id: job });
    await pg.query("update assets set locked_at = now(), locked_by = 'System (assigned)' where id = $1", [onTicket]);
    await assert.rejects(() => pull(sd, "TESTSN-TICKET"), /^Error: Serial TESTSN-TICKET is already assigned to a ticket for Bean Test Cafe\. Confirm reuse or cancel\.$/);
    assert.equal((await pull(sd, "TESTSN-TICKET", "u-wh", true)).assetId, onTicket, "an assignment's own lock moves with the unit");
    assert.deepEqual(await links(onTicket), { install_id: null, job_id: null }, "the ticket no longer lists it, so it can't be returned from there");
    const onInstall = await unit("TESTSN-INSTALL", { site: "field", status: "assigned", sold_to: "Bean Test Cafe", install_id: install });
    await assert.rejects(() => pull(sd, "TESTSN-INSTALL"), /^Error: Serial TESTSN-INSTALL is already assigned to an install for Bean Test Cafe\. Confirm reuse or cancel\.$/);
    assert.equal((await pull(sd, "TESTSN-INSTALL", "u-wh", true)).assetId, onInstall);
    assert.deepEqual(await links(onInstall), { install_id: null, job_id: null });
    const dfw = await unit("TESTSN-DFW", { site: "dallas", status: "deployed", sold_to: "Bean Test Cafe", purpose: "Dallas warehouse" });
    assert.equal((await pull(sd, "TESTSN-DFW", "u-wh", true)).assetId, dfw);
    assert.deepEqual(await bodiesFor("u-owner"), [
      ping("TESTSN-RACK", "Back · B-L2"),
      `${ping("TESTSN-CUST", "Bean Test Cafe")} Customers → Bean Test Cafe still lists it under Equipment.`,
      ping("TESTSN-SA", "San Antonio", "Test shop refurb"),
      ping("TESTSN-TICKET", "a ticket for Bean Test Cafe"),
      ping("TESTSN-INSTALL", "an install for Bean Test Cafe"),
      ping("TESTSN-DFW", "Bean Test Cafe at Dallas"),
    ]);
    const subjects = async (id) => [...new Set((await pings(pg)).filter((p) => p.entity_id === id).map((p) => p.customer))];
    assert.deepEqual([await subjects(sd), await subjects(shop)], [[SD], [SHOP]], "the ping names the refurb's account, not the unit's old one");

    // The same unit again after it went somewhere else: asked again, and pinged again. After a serial that wasn't found,
    // the unit still on this refurb's account comes back with no ping.
    await pg.query("update assets set sold_to = 'Bean Test Cafe', job_id = $2, site = 'field', updated_at = now() + interval '1 second' where id = $1", [rack, job]);
    await assert.rejects(() => pull(sd, "TESTSN-RACK"), /^Error: Serial TESTSN-RACK is already assigned to a ticket for Bean Test Cafe\. Confirm reuse or cancel\.$/);
    await pull(sd, "TESTSN-RACK", "u-wh", true);
    assert.equal((await bodiesFor("u-owner")).at(-1), ping("TESTSN-RACK", "a ticket for Bean Test Cafe"));
    await pull(sd, "TESTSN-NOWHERE");
    const before = (await pings(pg)).length;
    assert.equal((await pull(sd, "TESTSN-RACK")).assetId, rack);
    assert.equal((await pings(pg)).length, before, "a unit already on Katz Coffee Service Dept. came from no one");

    // The confirm was for one place, and the unit moved before the answer: asked again about where it is now.
    const mover = await unit("TESTSN-MOVE", { site: "san-antonio", status: "deployed" });
    const askedSa = "Serial TESTSN-MOVE is already assigned to San Antonio. Confirm reuse or cancel.";
    await assert.rejects(() => pull(sd, "TESTSN-MOVE"), (e) => e.message === askedSa);
    await pg.query("update assets set site = 'account', status = 'at-account', sold_to = 'Bean Test Cafe', updated_at = now() + interval '1 second' where id = $1", [mover]);
    const askedBean = "Serial TESTSN-MOVE is already assigned to Bean Test Cafe. Confirm reuse or cancel.";
    await assert.rejects(() => pullRebuildSerialFor(sql, { id: sd, serial: "TESTSN-MOVE", confirmReuse: true, asked: askedSa }, "u-wh"), (e) => e.message === askedBean);
    assert.equal((await unitRow(mover)).sold_to, "Bean Test Cafe", "not pulled on the old answer");
    assert.equal((await pullRebuildSerialFor(sql, { id: sd, serial: "TESTSN-MOVE", confirmReuse: true, asked: askedBean }, "u-wh")).assetId, mover);

    // Still put: a unit waiting for an Admin's decision on a Warehouse request, a sold unit, and one a person locked.
    const held = await unit("TESTSN-HELD");
    await pg.query("update assets set stock_hold = 'assign', stock_hold_customer = 'Bean Test Cafe' where id = $1", [held]);
    await assert.rejects(() => pull(sd, "TESTSN-HELD", "u-wh", true), /^Error: Serial TESTSN-HELD is waiting for an Admin to approve its assign to a customer, so it stays where it is\.$/);
    const sold = await unit("TESTSN-SOLD", { site: "sold", status: "sold", sold_to: "Bean Test Cafe" });
    await pg.query("update assets set locked_at = now(), locked_by = 'System (sold)' where id = $1", [sold]);
    const noticeNow = async () => (await pg.query("select serial_notice from rebuilds where id = $1", [sd])).rows[0].serial_notice;
    const noticeBefore = await noticeNow();
    await assert.rejects(() => pull(sd, "TESTSN-SOLD"), /^Error: Locked by System \(sold\)\. Only .+ can unlock it\.$/, "refused before any confirm");
    await assert.rejects(() => pull(sd, "TESTSN-SOLD", "u-wh", true), /^Error: Locked by System \(sold\)\. Only .+ can unlock it\.$/);
    assert.equal(await noticeNow(), noticeBefore, "no question was left on the refurb");
    const locked = await unit("TESTSN-LOCKED", { site: "training", status: "deployed" });
    await pg.query("update assets set locked_at = now(), locked_by = 'boss' where id = $1", [locked]);
    await assert.rejects(() => pull(sd, "TESTSN-LOCKED", "u-wh", true), /^Error: Locked by boss\./);
    // The owner locked it on the customer's account (Customers → Equipment): it stays, as on the Warehouse page.
    const onLockedAccount = await unit("TESTSN-ACCTLOCK", { site: "account", status: "at-account", sold_to: "Bean Test Cafe" });
    await pg.query(
      "insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key, locked_at, locked_by) values ('Bean Test Cafe', 'Test espresso machine', 'Test espresso machine', 'TESTSN-ACCTLOCK', 'testsn-acctlock', now(), 'boss')",
    );
    await assert.rejects(() => pull(sd, "TESTSN-ACCTLOCK"), /^Error: Locked by boss\./, "refused before any confirm");
    await assert.rejects(() => pull(sd, "TESTSN-ACCTLOCK", "u-wh", true), /^Error: Locked by boss\./);
    assert.deepEqual(await unitRow(held), { status: "ready", sold_to: null, purpose: null, site: "barn-back" });
    assert.deepEqual(await unitRow(sold), { status: "sold", sold_to: "Bean Test Cafe", purpose: null, site: "sold" });
    assert.deepEqual(await unitRow(locked), { status: "deployed", sold_to: null, purpose: null, site: "training" });
    assert.deepEqual(await unitRow(onLockedAccount), { status: "at-account", sold_to: "Bean Test Cafe", purpose: null, site: "account" });
    assert.equal((await pg.query("select serial from rebuilds where id = $1", [sd])).rows[0].serial, "TESTSN-MOVE", "the refurb keeps the unit it had");

    // A customer's rebuild is still not Warehouse's to pull onto.
    await assert.rejects(() => pull(cust, "TESTSN-HELD", "u-wh", true), /^Error: Warehouse changes refurbs for Katz Coffee Service Dept\. and Katz shop \/ stock only\./);

    // Everyone else as before: a tech confirms a reuse, an Admin pulls, and neither pings anyone.
    const pings0 = (await pings(pg)).length;
    const other = await unit("TESTSN-TECH", { site: "account", status: "at-account", sold_to: "Other Test Cafe" });
    await assert.rejects(() => pull(cust, "TESTSN-TECH", "u-tech"), /^Error: Serial TESTSN-TECH is already assigned to Other Test Cafe\. Confirm reuse or cancel\.$/);
    assert.equal((await pull(cust, "TESTSN-TECH", "u-tech", true)).assetId, other);
    assert.deepEqual(await unitRow(other), { status: "assigned", sold_to: "Bean Test Cafe", purpose: "In-house rebuild", site: "account" });
    const beansOwn = await unit("TESTSN-BEAN", { site: "field", status: "assigned", sold_to: "Bean Test Cafe", job_id: job });
    assert.equal((await pull(cust, "TESTSN-BEAN", "u-tech")).assetId, beansOwn, "the rebuild's own customer: no confirm");
    assert.deepEqual(await links(beansOwn), { install_id: null, job_id: job }, "and it stays on that customer's ticket");
    const shopStock = await unit("TESTSN-SHOPSTOCK", { pallet: "E", level: 1, status: "assigned", sold_to: SHOP });
    await assert.rejects(() => pull(sd, "TESTSN-SHOPSTOCK", "u-tech"), /^Error: Serial TESTSN-SHOPSTOCK is already assigned to Katz shop \/ stock at Back · E-L1\. Confirm reuse or cancel\.$/, "a tech still confirms a shop unit");
    assert.equal((await pull(sd, "TESTSN-SHOPSTOCK", "u-tech", true)).assetId, shopStock);
    const adminUnit = await unit("TESTSN-ADMIN", { pallet: "C", level: 1 });
    assert.equal((await pull(sd, "TESTSN-ADMIN", "u-owner")).assetId, adminUnit);
    assert.equal((await pings(pg)).length, pings0, "only Warehouse's pulls ping");
  } finally {
    await pg.close();
  }
});

test("Warehouse stays off tickets' billing, accounts' invoice lists and repair quotes; everyone else as before", async () => {
  const { getTicketChargesFor, recordTicketSalesOrder, writeTicketCharges } = await import("../src/lib/ops/charges-api.ts");
  const { saveRepairQuoteFor } = await import("../src/lib/ops/repair-quote-api.ts");
  const { pg, sql } = await fresh();
  try {
    const job = Number((await pg.query("insert into service_jobs (kind, call_id, customer) values ('service', 'SC-TEST-3', 'Bean Test Cafe') returning id")).rows[0].id);
    const sd = await rebuild(pg, "Test Faema refurb", SD);
    const refusal = /^Error: Warehouse invoices its refurbs only, on Rebuilds, billed to Katz Coffee Service Dept\.$/;
    await assert.rejects(() => getTicketChargesFor(sql, job, "u-wh"), refusal);
    await assert.rejects(() => writeTicketCharges(sql, job, "u-wh", { po: "", lines: [GASKETS], lineIds: [] }), refusal);
    await assert.rejects(() => recordTicketSalesOrder(sql, job, "u-wh", "SO-TEST-1"), refusal);
    await assert.rejects(() => listAccountInvoicesFor(sql, "Bean Test Cafe", "u-wh"), /^Error: Warehouse opens rebuild invoices only\.$/);
    await assert.rejects(
      () => saveRepairQuoteFor(sql, { rebuildId: sd, status: "Draft", note: "", lines: [GASKETS] }, "u-wh"),
      /^Error: Warehouse doesn't change repair quotes\. Ask an Admin or a tech\.$/,
    );
    const counts = async () => (await pg.query("select (select count(*)::int from ticket_charges) as charges, (select count(*)::int from repair_quotes) as quotes, (select ns_so from service_jobs where id = $1) as so", [job])).rows[0];
    assert.deepEqual(await counts(), { charges: 0, quotes: 0, so: null });

    assert.equal((await getTicketChargesFor(sql, job, "u-tech")).jobId, job);
    await writeTicketCharges(sql, job, "u-tech", { po: "", lines: [GASKETS], lineIds: [] });
    await recordTicketSalesOrder(sql, job, "u-tech", "SO-TEST-1");
    assert.equal((await saveRepairQuoteFor(sql, { rebuildId: sd, status: "Draft", note: "", lines: [GASKETS] }, "u-tech")).lines.length, 1);
    assert.deepEqual(await counts(), { charges: 1, quotes: 1, so: "SO-TEST-1" });
    assert.equal((await listAccountInvoicesFor(sql, "Bean Test Cafe", "u-tech")).length, 1);
    // The desk owner flag with the Warehouse role is an Admin.
    assert.equal((await getTicketChargesFor(sql, job, "u-wh-owner")).jobId, job);
  } finally {
    await pg.close();
  }
});

test("Warehouse's change never lands on a rebuild an Admin moved to a customer between its read and its write", async () => {
  const { pg, sql } = await fresh();
  try {
    const sd = await rebuild(pg, "Test Faema refurb", SD);
    // Runs someone else's change just before the first statement that matches, as if it landed in between.
    const moveToCustomer = () => pg.query("update rebuilds set account = 'Bean Test Cafe' where id = $1", [sd]);
    const raceOn = (pattern, meanwhile = moveToCustomer) => {
      let done = false;
      return Object.assign(async () => assert.fail("tagged query"), {
        query: async (text, params) => {
          if (!done && pattern.test(text)) {
            done = true;
            await meanwhile();
          }
          return sql.query(text, params);
        },
      });
    };
    const back = () => pg.query("update rebuilds set account = $2 where id = $1", [sd, SD]);
    const refusal = /^Error: Warehouse changes refurbs for Katz Coffee Service Dept\. and Katz shop \/ stock only\. This rebuild is for Bean Test Cafe; ask an Admin\.$/;
    const row = async () => (await pg.query("select account, notes, archived, serial from rebuilds where id = $1", [sd])).rows[0];

    await assert.rejects(() => updateRebuildFor(raceOn(/^\s*update rebuilds set\s+title = \$2/), { id: sd, notes: "Warehouse note" }, "u-wh"), refusal);
    assert.deepEqual(await row(), { account: "Bean Test Cafe", notes: null, archived: false, serial: null }, "the Admin's move stands");
    await back();
    await assert.rejects(() => archiveRebuildFor(raceOn(/update rebuilds set archived = true/), { id: sd }, "u-wh"), refusal);
    assert.equal((await row()).archived, false);
    await back();
    const free = Number((await pg.query("insert into assets (kind, model, serial, site, status) values ('equip', 'Test espresso machine', 'TESTSN-RACE', 'barn-back', 'ready') returning id")).rows[0].id);
    const PULL = /^\s*with refurb as \(/;
    await assert.rejects(() => pullRebuildSerialFor(raceOn(PULL), { id: sd, serial: "TESTSN-RACE" }, "u-wh"), refusal);
    assert.deepEqual((await pg.query("select status, sold_to from assets where id = $1", [free])).rows[0], { status: "ready", sold_to: null }, "the unit stays on the rack");
    await back();
    // The same for the serial notes Warehouse writes without pulling: a serial not found, and the confirm question.
    await assert.rejects(() => pullRebuildSerialFor(raceOn(/update rebuilds set serial = \$2, asset_id = null, serial_notice = \$3/), { id: sd, serial: "TESTSN-NOWHERE" }, "u-wh"), refusal);
    assert.equal((await row()).serial, null, "the customer's rebuild didn't take Warehouse's serial");
    await back();
    const out = Number((await pg.query("insert into assets (kind, model, serial, site, status) values ('equip', 'Test grinder', 'TESTSN-OUT', 'dallas', 'deployed') returning id")).rows[0].id);
    await assert.rejects(() => pullRebuildSerialFor(raceOn(/update rebuilds set serial_notice = \$2/), { id: sd, serial: "TESTSN-OUT" }, "u-wh"), refusal);
    assert.equal((await pg.query("select serial_notice from rebuilds where id = $1", [sd])).rows[0].serial_notice, null);
    assert.deepEqual((await pg.query("select status, site, sold_to from assets where id = $1", [out])).rows[0], { status: "deployed", site: "dallas", sold_to: null });
    await back();
    // The unit is moved to a customer between Warehouse's read and its write (every move stamps the unit): it isn't pulled.
    // (The stamp is a second later: the test database's clock counts milliseconds only.)
    const taken = Number((await pg.query("insert into assets (kind, model, serial, site, status) values ('equip', 'Test brewer', 'TESTSN-TAKEN', 'barn-back', 'ready') returning id")).rows[0].id);
    const assignIt = () => pg.query("update assets set status = 'at-account', site = 'account', sold_to = 'Bean Test Cafe', updated_at = now() + interval '1 second' where id = $1", [taken]);
    const missed = /^Error: Serial TESTSN-TAKEN was just moved, locked or put on hold by someone else, so it wasn't pulled\. Pull it again\.$/;
    await assert.rejects(() => pullRebuildSerialFor(raceOn(PULL, assignIt), { id: sd, serial: "TESTSN-TAKEN" }, "u-wh"), missed);
    assert.deepEqual((await pg.query("select status, sold_to, purpose from assets where id = $1", [taken])).rows[0], { status: "at-account", sold_to: "Bean Test Cafe", purpose: null });
    assert.equal((await row()).serial, null, "the refurb didn't take its serial");
    // Or a hold is put on it meanwhile, even by a write that doesn't stamp it.
    const holdIt = () => pg.query("update assets set stock_hold = 'remove' where id = $1", [free]);
    const raced = /^Error: Serial TESTSN-RACE was just moved, locked or put on hold by someone else/;
    await assert.rejects(() => pullRebuildSerialFor(raceOn(PULL, holdIt), { id: sd, serial: "TESTSN-RACE" }, "u-wh"), raced);
    assert.deepEqual((await pg.query("select status, sold_to from assets where id = $1", [free])).rows[0], { status: "ready", sold_to: null });
    await pg.query("update assets set stock_hold = null where id = $1", [free]);
    // Or the owner locks it on a customer's account meanwhile.
    const lockOnAccount = () =>
      pg.query("insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key, locked_at, locked_by) values ('Bean Test Cafe', 'Test espresso machine', 'Test espresso machine', 'TESTSN-RACE', 'testsn-race', now(), 'boss')");
    await assert.rejects(() => pullRebuildSerialFor(raceOn(PULL, lockOnAccount), { id: sd, serial: "TESTSN-RACE" }, "u-wh"), raced);
    assert.deepEqual((await pg.query("select status, sold_to from assets where id = $1", [free])).rows[0], { status: "ready", sold_to: null });
    await pg.query("delete from account_equipment where serial_key = 'testsn-race'");
    // A tech's pull whose unit is gone from the records by the time it writes: nothing is pulled.
    const gone = Number((await pg.query("insert into assets (kind, model, serial, site, status) values ('equip', 'Test brewer', 'TESTSN-GONE', 'barn-back', 'ready') returning id")).rows[0].id);
    await assert.rejects(
      () => pullRebuildSerialFor(raceOn(PULL, () => pg.query("delete from assets where id = $1", [gone])), { id: sd, serial: "TESTSN-GONE" }, "u-tech"),
      /^Error: Serial TESTSN-GONE is no longer in the warehouse records, so it wasn't pulled\.$/,
    );
    assert.equal((await row()).serial, null, "the refurb didn't take the serial of a unit that isn't there");
    assert.equal((await pings(pg)).length, 0, "a pull that didn't happen pings no one");
    // Without anything in between, the same changes go through.
    assert.equal((await updateRebuildFor(sql, { id: sd, notes: "Warehouse note" }, "u-wh")).notes, "Warehouse note");
    assert.equal((await pullRebuildSerialFor(sql, { id: sd, serial: "TESTSN-RACE" }, "u-wh")).assetId, free);
    assert.equal((await pullRebuildSerialFor(sql, { id: sd, serial: "TESTSN-TAKEN", confirmReuse: true }, "u-wh")).assetId, taken);
    assert.equal((await pings(pg)).length, 4, "two pulls, two Admins");
  } finally {
    await pg.close();
  }
});

test("Parts: Warehouse looks parts up and uses Get Later like a tech, but doesn't change photos; the Admin and Sales edits stay theirs", async () => {
  const { clearPartImageFor, listPartsFor, setPartImageFor } = await import("../src/lib/ops/parts-api.ts");
  const { pg, sql } = await fresh();
  try {
    const flags = async (userId) => {
      const page = await listPartsFor(sql, {}, userId);
      const { canHide, canEditMpn, canEditBins, canEditClass, canEditNote, canEditPhoto } = page;
      return { rows: page.rows.length, canHide, canEditMpn, canEditBins, canEditClass, canEditNote, canEditPhoto };
    };
    const tech = await flags("u-tech");
    assert.deepEqual(tech, { rows: 3, canHide: false, canEditMpn: false, canEditBins: false, canEditClass: false, canEditNote: false, canEditPhoto: true });
    assert.deepEqual(await flags("u-wh"), { ...tech, canEditPhoto: false });
    assert.equal((await flags("u-sales")).canEditPhoto, true);
    assert.equal((await flags("u-wh-owner")).canEditPhoto, true, "the desk owner flag with the Warehouse role is an Admin");

    // The server refuses Warehouse's photo changes: add, replace, pull a researched photo, remove.
    const part = Number((await pg.query("select id from billing_items where sku = 'TESTGASKET1'")).rows[0].id);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]).toString("base64");
    const photo = async () => (await pg.query("select image is not null as has, photo_confirmed_by as by from billing_items where id = $1", [part])).rows[0];
    const refusal = /^Error: Warehouse doesn't change part photos\. Ask an Admin or a tech\.$/;
    await assert.rejects(() => setPartImageFor(sql, { id: part, base64: png }, "u-wh"), refusal);
    await assert.rejects(() => setPartImageFor(sql, { id: part, base64: png, sourceUrl: "https://example.com/test-gasket.jpg" }, "u-wh"), refusal);
    assert.deepEqual(await photo(), { has: false, by: null });
    assert.equal((await setPartImageFor(sql, { id: part, base64: png }, "u-tech")).hasImage, true);
    assert.deepEqual(await photo(), { has: true, by: "tess" });
    await assert.rejects(() => setPartImageFor(sql, { id: part, base64: png }, "u-wh"), refusal);
    await assert.rejects(() => clearPartImageFor(sql, { id: part }, "u-wh"), refusal);
    assert.deepEqual(await photo(), { has: true, by: "tess" }, "Warehouse's Replace and Remove changed nothing");
    assert.equal((await clearPartImageFor(sql, { id: part }, "u-wh-owner")).hasImage, false);
  } finally {
    await pg.close();
  }
  // Get Later stays anyone's on the Desk: its server call checks no role.
  const api = readFileSync(new URL("../src/lib/ops/parts-api.ts", import.meta.url), "utf8");
  const start = api.indexOf("export const setPartGetLater = createServerFn");
  assert.ok(start >= 0, "setPartGetLater");
  const body = api.slice(start, api.indexOf("\nexport ", start + 1));
  assert.doesNotMatch(body, /\.(canHide|canRemove|canEditMpn|canEditBins|canEditClass|canEditNote|canEditPhoto)\b/);
  for (const fn of ["setPartImage", "clearPartImage"]) {
    assert.match(api, new RegExp(`export const ${fn} = createServerFn\\(\\{ method: "POST" \\}\\)\\s+\\.middleware\\(\\[deskMiddleware\\]\\)[\\s\\S]{0,160}\\.handler\\(async \\(\\{ data, context \\}\\): Promise<PartRow> => ${fn}For\\(await ready\\(\\), data, context\\.userId\\)\\);`), fn);
  }
});

test("the screens: Warehouse's menu adds Rebuilds and Parts, not Invoices; the window saves for approval and approves with its stamp", () => {
  const shell = readFileSync(new URL("../src/components/desk/shell.tsx", import.meta.url), "utf8");
  const ok = shell.match(/const WAREHOUSE_OK: DeskTo\[\] = \[([^\]]*)\]/);
  assert.ok(ok, "WAREHOUSE_OK");
  assert.deepEqual(ok[1].split(",").map((s) => s.trim().replace(/"/g, "")), ["/warehouse", "/rebuilds", "/modules", "/library", "/parts", "/locations"]);
  assert.match(shell, /const allowed = WAREHOUSE_OK\.some\(\(p\) => pathname === p \|\| pathname\.startsWith\(`\$\{p\}\/`\)\);/, "the redirect uses the same list");

  const win = readFileSync(new URL("../src/components/desk/invoice-window.tsx", import.meta.url), "utf8");
  assert.match(win, /saveInvoiceForApproval\(\{ data: \{ type, id, lines: sentLines\(\), discount: sentDiscount\(\) \} \}\)/);
  // An install invoice's P.O. goes with it (10/30).
  assert.match(win, /seen: seen\?\.version \?\? null, \.\.\.\(v\?\.hasPo \? \{ po \} : \{\}\) \}/);
  assert.match(win, /if \(!v \|\| lines \|\| q\.isFetching\) return;[\s\S]*?setSeen\(\{ version: v\.version, state: v\.state \}\);/, "the stamp is the one the lines started from, read fresh");
  assert.match(win, /if \(seen && \(fresh\.version !== seen\.version \|\| fresh\.state !== seen\.state\)\) \{\s*setLines\(null\);/, "a refusal over a changed invoice reloads the lines");
  assert.match(win, /if \(res\.isError \|\| !res\.data\) \{\s*onClose\(\);\s*return;\s*\}/, "the window closes when the invoice can't be read any more");
  assert.match(win, /onError: \(e\) => void refused\(e, "Could not approve the invoice"\)/);
  assert.match(win, /onError: \(e\) => void refused\(e, "Could not save the invoice"\)/);
  assert.match(win, /\{v\.partsOnly \? \([\s\S]{0,200}data-testid="invoice-no-discount"/, "no discount controls for Warehouse");
  assert.match(win, /\{locked \? null : v\.canSave \? \(/);
  assert.match(win, /\{v\.partsOnly \? null : \(/, "no labor or trip buttons for Warehouse");
  assert.match(win, /const locked = !!v\?\.locked \|\| \(!!v && !v\.canApprove && !v\.canSave\);/);

  const page = readFileSync(new URL("../src/routes/_app/rebuilds.tsx", import.meta.url), "utf8");
  assert.match(page, /\{role === "warehouse" \? null : <ExportButton defaultType="rebuilds" \/>\}/);
  assert.match(page, /account: accountLock \?\? \(account \|\| SHOP_ACCOUNT\)/);
  assert.match(page, /canEdit=\{canEdit && !!selectedRow\?\.editable\}/);
  const sheet = readFileSync(new URL("../src/components/desk/rebuild-sheet.tsx", import.meta.url), "utf8");
  assert.match(sheet, /\{accountLock \? null : <RepairQuotePanel rebuildId=\{row\.id\} key=\{`quote-\$\{row\.id\}`\} \/>\}/, "no repair quotes for Warehouse");
  assert.match(sheet, /\}, \[formKey\]\);/, "the form starts over only when the rebuild's own fields change");

  const api = readFileSync(new URL("../src/lib/ops/invoice-api.ts", import.meta.url), "utf8");
  assert.match(api, /export const saveInvoiceForApproval = createServerFn\(\{ method: "POST" \}\)\s+\.middleware\(\[deskMiddleware\]\)/);
  assert.match(api, /export const approveInvoice = createServerFn\(\{ method: "POST" \}\)\s+\.middleware\(\[deskMiddleware\]\)/);
  const bell = readFileSync(new URL("../src/components/desk/notify-bell.tsx", import.meta.url), "utf8");
  assert.match(bell, /if \(isWaitingNotice\(n\.body\)\) return "Invoice to approve";/);
  assert.match(bell, /if \(isPullNotice\(n\.body\)\) return "Unit pulled";/);
  assert.match(sheet, /\{accountLock \? \(\s*<p className="text-sm text-muted-foreground" data-testid="rebuild-pull-ping">/, "Warehouse's confirm says the Admins get a ping");
  assert.match(sheet, /if \(\/already assigned\/i\.test\(msg\)\) setReuseNotice\(msg\);/, "every place a unit can be still opens the confirm");
  assert.match(sheet, /disabled=\{pull\.isPending\}\s+onClick=\{\(\) => \{\s+startPull\(\{ confirmReuse: true, asked: reuseNotice \?\? undefined \}\);/, "Reuse sends the question it answers, once");
  assert.match(sheet, /pullRebuildSerial\(\{ data: \{ id: row!\.id, serial: opts\.serial, confirmReuse: opts\.confirmReuse, asked: opts\.asked \} \}\)/);
  assert.match(sheet, /if \(opts\.serial !== lastPull\.current\) return;\s+setReuseNotice\(null\);\s+setSerial\(next\.serial \?\? ""\);/, "an older pull's answer leaves a changed box alone");

  // No photo changes for Warehouse on Parts: the row, the part's window, and the researched-photo buttons.
  const parts = readFileSync(new URL("../src/routes/_app/parts.tsx", import.meta.url), "utf8");
  assert.match(parts, /const canEditPhoto = page\.data\?\.canEditPhoto \?\? \(!!me\.data && !\(me\.data\.role === "warehouse" && !me\.data\.isAdmin\)\);/, "the same rule while the list loads");
  assert.match(parts, /<PartPhotoStatus row=\{row\} photo=\{photo\} canEdit=\{canEditPhoto\} \/>/);
  assert.match(parts, /\{canEditPhoto \? <PartPhotoReview row=\{row\} photo=\{photo\} onChanged=\{onChanged\} \/> : null\}/);
  assert.match(parts, /\{canEditPhoto \? <PartPhotoButtons row=\{row\} photo=\{photo\} \/> : null\}/);
  assert.match(parts, /\{canEditPhoto \? <PartPhotoFile photo=\{photo\} \/> : null\}/);
  assert.match(parts, /canEditPhoto=\{canEditPhoto\}\s+onClose=\{closePart\}/, "the part's window gets it too");
  assert.match(parts, /\{isAdmin && page\.data\?\.readyToPull \? \(/, "Pull Confirmed Photos stays Admin only");
  const win2 = readFileSync(new URL("../src/components/desk/part-window.tsx", import.meta.url), "utf8");
  assert.match(win2, /<PartPhotoStatus row=\{row\} photo=\{photo\} tid=\{T\} canEdit=\{canEditPhoto\} \/>/);
  assert.match(win2, /\{canEditPhoto \? \(\s*<div className="mt-3 flex flex-wrap items-center gap-2">\s*<PartPhotoButtons row=\{row\} photo=\{photo\} tid=\{T\} \/>\s*<PartPhotoFile photo=\{photo\} tid=\{T\} \/>/);
  assert.match(win2, /\{canEditPhoto \? <PartPhotoReview row=\{row\} photo=\{photo\} onChanged=\{onChanged\} \/> : null\}/);
  const controls = readFileSync(new URL("../src/components/desk/part-controls.tsx", import.meta.url), "utf8");
  assert.match(controls, /\{canEdit && !row\.hasImage && row\.research\?\.verdict === "confirmed" && row\.research\.imageUrl \? \(/);
  assert.match(controls, /\{canEdit && !row\.hasImage && row\.research\?\.verdict === "review" && row\.research\.candidates\.length \? \(/);
});
