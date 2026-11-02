// Rebuild machines (Chuy, 11/2): a rebuild holds several machines, each with its serial, or just one. A serial pulls
// its warehouse unit onto the rebuild; taking the machine off puts the unit back. When a refurb is completed, each
// machine goes into stock at the Staging area, marked needs shop test, with no Admin review. Part search in every
// picker finds a part by its bin. All data is made up.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const M = await import("../src/lib/ops/rebuild-model.ts");
const { searchItems } = await import("../src/lib/ops/charges.ts");
const R = await import("../src/lib/ops/rebuilds.ts");
const { searchBillingItemsFor } = await import("../src/lib/ops/charges-api.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();
const SD = "Katz Coffee Service Dept.";
const SHOP = "Katz shop / stock";

async function fresh(upTo = null) {
  const pg = new PGlite();
  for (const name of files.filter((n) => !upTo || n < upTo)) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  if (upTo) return { pg };
  await pg.query(
    `insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values
       ('u-owner', 'boss', true, true, 'admin'),
       ('u-tech', 'tess', true, false, 'service'),
       ('u-sales', 'sam', true, false, 'sales'),
       ('u-wh', 'wade', true, false, 'warehouse')`,
  );
  // The rebuild list seeds sample projects into an empty table; mark it seeded so only these made-up rows exist.
  await pg.query("insert into seed_meta (k, v) values ('rebuilds', 'v1') on conflict (k) do update set v = 'v1'");
  await pg.query("insert into directory_customers (name, account_number, address) values ($1, 'TEST-SD-1', '100 Test Way'), ('Bean Test Cafe', 'TEST-C-9', '9 Fake St')", [SD]);
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async () => assert.fail("tagged query"), { query });
  return { pg, sql };
}

const rebuild = async (pg, title, account) => Number((await pg.query("insert into rebuilds (title, account) values ($1, $2) returning id", [title, account])).rows[0].id);
const unit = async (pg, serial, f = {}) => {
  const v = { model: "Test grinder", site: "barn-back", pallet: null, level: null, status: "ready", sold_to: null, job_id: null, install_id: null, purpose: null, shop_test: null, ...f };
  const row = await pg.query(
    "insert into assets (kind, model, serial, site, pallet, level, status, sold_to, job_id, install_id, purpose, shop_test) values ('equip', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id",
    [v.model, serial, v.site, v.pallet, v.level, v.status, v.sold_to, v.job_id, v.install_id, v.purpose, v.shop_test],
  );
  return Number(row.rows[0].id);
};
const unitRow = async (pg, id) =>
  (await pg.query("select status, site, pallet, level, sold_to, purpose, install_id, job_id, locked_by, shop_test from assets where id = $1", [id])).rows[0];

/* ------------------------------------------------------------------ the plain rules */

test("a rebuild's machines: their models and serials in one line, and what a refurb needs before it is completed", () => {
  const m = (model, serial = null, extra = {}) => ({ model, serial, assetId: null, stockedAt: null, ...extra });
  assert.equal(M.machinesLabel([m("Mazzer Super Jolly"), m("Bunn ITCB-DV"), m("mazzer super jolly"), m("")]), "Mazzer Super Jolly ×2, Bunn ITCB-DV");
  assert.equal(M.machinesLabel([]), null);
  assert.equal(M.machineSerials([m("A", " SJ-1 "), m("B"), m("C", "SJ-2")]), "SJ-1, SJ-2");
  assert.equal(M.machineSerials([m("A")]), null);
  // Every machine with no unit and not in stock needs the model it goes into stock as.
  assert.equal(M.refurbCompleteRefusal([m("Mazzer"), m("", "SJ-9"), m("")]), "Machine 2 (SN SJ-9) needs its model before this refurb is completed: it goes into stock as that model.");
  assert.equal(M.refurbCompleteRefusal([m("", null, { assetId: 4 }), m("", "SJ-8", { stockedAt: "2026-11-02" })]), null);
  assert.equal(M.refurbCompleteRefusal([m("")]), "Machine 1 needs its model before this refurb is completed: it goes into stock as that model.");
  assert.equal(M.stockedLine(2, []), "2 machines went into stock at the Staging area, marked needs shop test.");
  assert.equal(M.stockedLine(1, ["Bunn SN X wasn't put in stock: its unit is on an install for Bean Test Cafe now."]), "1 machine went into stock at the Staging area, marked needs shop test. Bunn SN X wasn't put in stock: its unit is on an install for Bean Test Cafe now.");
  assert.equal(M.stockedLine(0, []), null);
});

test("part search finds a part by its bin, the way Parts does; part numbers still come first", () => {
  const it = (item, bin, description = "Test part") => ({ item, description, mfrPart: null, previousNumbers: [], bin });
  const items = [
    it("PARTS : TESTA1", { rack: "A", shelf: "03", bin: "12" }),
    it("PARTS : TESTA2", { rack: "A", shelf: "03", bin: "7" }),
    it("PARTS : TESTB1", { rack: "B", shelf: "1", bin: "2" }),
    it("PARTS : A0312", null, "Test look-alike number"),
    it("PARTS : TESTE4", { rack: null, shelf: null, bin: "E4-2" }),
  ];
  const found = (q, list = items.slice(0, 3).concat(items[4])) => searchItems(q, list).map((i) => i.item);
  for (const q of ["A-03-12", "a 03 12", "A/03/12"]) assert.deepEqual(found(q), ["PARTS : TESTA1"], q);
  // A rack and shelf: that shelf's parts.
  assert.deepEqual(found("A-03"), ["PARTS : TESTA1", "PARTS : TESTA2"]);
  // Rack A, in words; a bin stored whole.
  assert.deepEqual(found("rack a"), ["PARTS : TESTA1", "PARTS : TESTA2"]);
  assert.deepEqual(found("E4 2"), ["PARTS : TESTE4"]);
  // A part whose number reads the same comes first: an exact part number always does.
  assert.deepEqual(found("A-03-12", items), ["PARTS : A0312", "PARTS : TESTA1"]);
  assert.deepEqual(found("C-9-9"), []);
});

test("every part picker searches bins on the server too, and each result carries its bin", async () => {
  const { pg, sql } = await fresh();
  try {
    await pg.query(
      `insert into billing_items (sku, parent, item, description, rate, kind, bin_rack, bin_shelf, bin_bin) values
         ('TESTBIN1', 'PARTS', 'PARTS : TESTBIN1', 'Test gasket', 5, 'part', 'A', '03', '12'),
         ('TESTBIN2', 'PARTS', 'PARTS : TESTBIN2', 'Test valve', 5, 'part', 'A', '03', '7'),
         ('TESTBIN3', 'PARTS', 'PARTS : TESTBIN3', 'Test pump', 5, 'part', null, null, null)`,
    );
    const skus = async (q) => (await searchBillingItemsFor(sql, q)).map((i) => i.part.sku);
    assert.deepEqual(await skus("A-03-12"), ["TESTBIN1"]);
    assert.deepEqual(await skus("a/03/12"), ["TESTBIN1"]);
    assert.deepEqual(await skus("A 03"), ["TESTBIN1", "TESTBIN2"]);
    assert.deepEqual(await skus("Rack A"), ["TESTBIN1", "TESTBIN2"]);
    assert.deepEqual((await searchBillingItemsFor(sql, "TESTBIN1"))[0].bin, { rack: "A", shelf: "03", bin: "12" });
    assert.equal((await searchBillingItemsFor(sql, "TESTBIN3"))[0].bin, null);
    const picker = readFileSync(new URL("../src/components/desk/charges-panel.tsx", import.meta.url), "utf8");
    assert.match(picker, /\{binText\(it\.bin\) \? <span data-testid="part-result-bin">\{binText\(it\.bin\)\}<\/span> : null\}/, "the picker shows the bin");
  } finally {
    await pg.close();
  }
});

/* ------------------------------------------------------------------ the machines */

test("a refurb holds several machines; a new serial or taking one off puts its unit back where it was", async () => {
  const { pg, sql } = await fresh();
  try {
    const sd = await rebuild(pg, "Test grinder refurbs", SD);
    const install = Number((await pg.query("insert into installs (customer) values ('Bean Test Cafe') returning id")).rows[0].id);
    const a = await unit(pg, "TESTSN-A", { pallet: "B", level: 1 });
    const b = await unit(pg, "TESTSN-B", { site: "field", status: "assigned", sold_to: "Bean Test Cafe", install_id: install });
    await pg.query("update assets set locked_at = now(), locked_by = 'System (assigned)' where id = $1", [b]);
    const c = await unit(pg, "TESTSN-C", { pallet: "B", level: 2 });

    // Two serials, one model with no serial, and a serial the warehouse doesn't have with its model.
    let rb = await R.pullRebuildMachineFor(sql, { id: sd, serial: "TESTSN-A" }, "u-wh");
    await assert.rejects(() => R.pullRebuildMachineFor(sql, { id: sd, serial: "TESTSN-B" }, "u-wh"), /^Error: Serial TESTSN-B is already assigned to an install for Bean Test Cafe\. Confirm reuse or cancel\.$/);
    rb = await R.pullRebuildMachineFor(sql, { id: sd, serial: "TESTSN-B", confirmReuse: true }, "u-wh");
    rb = await R.saveRebuildMachinesFor(sql, { id: sd, machines: [{ model: "Test brewer" }, { model: "  " }] }, "u-wh");
    rb = await R.pullRebuildMachineFor(sql, { id: sd, serial: "TESTSN-NEW", model: "Test espresso machine" }, "u-wh");
    assert.deepEqual(
      rb.machines.map((m) => [m.model, m.serial, m.assetId, m.notice]),
      [
        ["Test grinder", "TESTSN-A", a, "Serial TESTSN-A pulled from warehouse · Test grinder · B-L1"],
        ["Test grinder", "TESTSN-B", b, "Serial TESTSN-B pulled from warehouse · Test grinder · Pulled from the barn (was Bean Test Cafe)"],
        ["Test brewer", null, null, null],
        ["Test espresso machine", "TESTSN-NEW", null, "Serial TESTSN-NEW isn't in the warehouse yet: it goes into stock when this refurb is completed."],
      ],
    );
    assert.deepEqual([rb.equipment, rb.serial], ["Test grinder ×2, Test brewer, Test espresso machine", "TESTSN-A, TESTSN-B, TESTSN-NEW"]);
    assert.deepEqual((await R.listRebuildsFor(sql, "u-wh")).rows.find((r) => r.id === sd).machines.length, 4, "the board has them too");
    assert.deepEqual(await unitRow(pg, b), { status: "assigned", site: "field", pallet: null, level: null, sold_to: SD, purpose: "In-house rebuild", install_id: null, job_id: null, locked_by: "System (assigned)", shop_test: null });

    // Machine 1 takes another serial: its old unit goes back on its rack slot, free again.
    const [m1, m2, m3] = rb.machines;
    rb = await R.pullRebuildMachineFor(sql, { id: sd, machineId: m1.id, serial: "TESTSN-C" }, "u-wh");
    assert.equal(rb.machines[0].assetId, c);
    assert.deepEqual(await unitRow(pg, a), { status: "ready", site: "barn-back", pallet: "B", level: 1, sold_to: null, purpose: null, install_id: null, job_id: null, locked_by: null, shop_test: null });
    // Machine 2 comes off: its unit goes back on the customer's install, with the install's lock.
    const off = await R.removeRebuildMachineFor(sql, { id: sd, machineId: m2.id }, "u-wh");
    assert.equal(off.message, "SN TESTSN-B is back where it was before it was pulled.");
    assert.deepEqual(await unitRow(pg, b), { status: "assigned", site: "field", pallet: null, level: null, sold_to: "Bean Test Cafe", purpose: null, install_id: install, job_id: null, locked_by: "System (assigned)", shop_test: null });
    assert.equal(off.rebuild.machines.length, 3);
    // A blank serial on machine 1: its unit goes back too.
    rb = await R.pullRebuildMachineFor(sql, { id: sd, machineId: m1.id, serial: "" }, "u-wh");
    assert.deepEqual([rb.machines[0].serial, rb.machines[0].assetId], [null, null]);
    assert.equal((await unitRow(pg, c)).status, "ready");
    // A unit moved since it was pulled stays where it is now when its machine comes off.
    rb = await R.pullRebuildMachineFor(sql, { id: sd, machineId: m1.id, serial: "TESTSN-C" }, "u-wh");
    await pg.query("update assets set sold_to = 'Bean Test Cafe', updated_at = now() where id = $1", [c]);
    assert.equal((await R.removeRebuildMachineFor(sql, { id: sd, machineId: m1.id }, "u-wh")).message, "SN TESTSN-C was moved since it was pulled, so it stays where it is now.");
    assert.equal((await unitRow(pg, c)).sold_to, "Bean Test Cafe");
    await pg.query("update assets set status = 'ready', sold_to = null, purpose = null, locked_at = null, locked_by = null where id = $1", [c]);

    // A model changes; one unit on one open rebuild at a time.
    rb = await R.saveRebuildMachinesFor(sql, { id: sd, machines: [{ id: m3.id, model: "Test brewer XL" }] }, "u-wh");
    assert.equal(rb.machines.find((m) => m.id === m3.id).model, "Test brewer XL");
    await R.pullRebuildMachineFor(sql, { id: sd, machineId: m3.id, serial: "TESTSN-C" }, "u-wh");
    const shop = await rebuild(pg, "Test shop refurb", SHOP);
    await assert.rejects(
      () => R.pullRebuildMachineFor(sql, { id: shop, serial: "TESTSN-C", confirmReuse: true }, "u-wh"),
      /^Error: Serial TESTSN-C is on rebuild "Test grinder refurbs" already\. Take it off that rebuild's machines first\.$/,
    );
    // Once that rebuild is closed, its machine lets the unit go, and what it knew of the unit's place goes with it.
    await pg.query("update rebuilds set status = 'Cancelled' where id = $1", [sd]);
    const taken = await R.pullRebuildMachineFor(sql, { id: shop, serial: "TESTSN-C", confirmReuse: true }, "u-wh");
    assert.equal(taken.machines[0].assetId, c);
    const left = (await pg.query("select asset_id, notice from rebuild_machines where id = $1", [m3.id])).rows[0];
    assert.deepEqual(left, { asset_id: null, notice: `Serial TESTSN-C moved to rebuild "Test shop refurb".` });
    await R.removeRebuildMachineFor(sql, { id: shop, machineId: taken.machines[0].id }, "u-wh");
    assert.deepEqual(await unitRow(pg, c), { status: "ready", site: "barn-back", pallet: "B", level: 2, sold_to: null, purpose: null, install_id: null, job_id: null, locked_by: null, shop_test: null }, "back on its rack slot");

    // A cancelled rebuild's machines don't change, but they can come off; a completed one's can't.
    await assert.rejects(() => R.pullRebuildMachineFor(sql, { id: sd, serial: "TESTSN-A" }, "u-wh"), /^Error: This rebuild is Cancelled, so its machines can't change\. Set it back to In progress first\.$/);
    await assert.rejects(() => R.saveRebuildMachinesFor(sql, { id: sd, machines: [{ model: "Test kettle" }] }, "u-wh"), /This rebuild is Cancelled/);
    assert.equal((await R.removeRebuildMachineFor(sql, { id: sd, machineId: m3.id }, "u-wh")).rebuild.machines.length, 1);
    await pg.query("update rebuilds set status = 'Completed' where id = $1", [sd]);
    const last = (await pg.query("select id from rebuild_machines where rebuild_id = $1", [sd])).rows[0].id;
    await assert.rejects(() => R.removeRebuildMachineFor(sql, { id: sd, machineId: Number(last) }, "u-wh"), /This rebuild is Completed/);

    // Warehouse doesn't change a customer's rebuild's machines; Sales changes none.
    const cust = await rebuild(pg, "Test customer rebuild", "Bean Test Cafe");
    const refusal = /^Error: Warehouse changes refurbs for Katz Coffee Service Dept\. and Katz shop \/ stock only\./;
    await assert.rejects(() => R.saveRebuildMachinesFor(sql, { id: cust, machines: [{ model: "Test brewer" }] }, "u-wh"), refusal);
    await assert.rejects(() => R.pullRebuildMachineFor(sql, { id: cust, serial: "TESTSN-A" }, "u-wh"), refusal);
    await assert.rejects(() => R.saveRebuildMachinesFor(sql, { id: shop, machines: [{ model: "Test brewer" }] }, "u-sales"), /^Error: Sales can view rebuilds/);
    const techs = await R.saveRebuildMachinesFor(sql, { id: cust, machines: [{ model: "Test brewer" }] }, "u-tech");
    assert.deepEqual(techs.machines.map((m) => m.model), ["Test brewer"]);
    // A machine of another rebuild isn't this one's.
    await assert.rejects(() => R.pullRebuildMachineFor(sql, { id: shop, machineId: techs.machines[0].id, serial: "TESTSN-A" }, "u-tech"), /^Error: That machine isn't on this rebuild any more/);
  } finally {
    await pg.close();
  }
});

test("completing a refurb puts each machine in stock at the Staging area, needs shop test, with no Admin review", async () => {
  const { pg, sql } = await fresh();
  try {
    const sd = await rebuild(pg, "Test grinder refurbs", SD);
    const install = Number((await pg.query("insert into installs (customer) values ('Bean Test Cafe') returning id")).rows[0].id);
    const pulled = await unit(pg, "TESTSN-P", { pallet: "C", level: 3, shop_test: "tested" });
    const moving = await unit(pg, "TESTSN-M", { pallet: "C", level: 4 });
    await R.pullRebuildMachineFor(sql, { id: sd, serial: "TESTSN-P" }, "u-wh");
    await R.pullRebuildMachineFor(sql, { id: sd, serial: "TESTSN-M" }, "u-wh");
    await R.pullRebuildMachineFor(sql, { id: sd, serial: "TESTSN-NEW", model: "Test brewer" }, "u-wh");
    await R.saveRebuildMachinesFor(sql, { id: sd, machines: [{ model: "Test kettle" }] }, "u-wh");
    // A serial not in the warehouse when it was typed, added to the stock list since, with nobody's name on it.
    await R.pullRebuildMachineFor(sql, { id: sd, serial: "TESTSN-LATE", model: "Test grinder" }, "u-wh");
    const late = await unit(pg, "TESTSN-LATE", { site: "front-lobby", status: "deployed", purpose: "Lobby" });
    // And one whose serial turned up since on a unit sold to a customer: that one isn't ours to move.
    await R.pullRebuildMachineFor(sql, { id: sd, serial: "TESTSN-SOLDX", model: "Test grinder" }, "u-wh");
    const soldX = await unit(pg, "TESTSN-SOLDX", { site: "sold", status: "sold", sold_to: "Bean Test Cafe" });
    // One machine's unit goes to a customer's install meanwhile: it isn't put in stock.
    await pg.query("update assets set sold_to = 'Bean Test Cafe', install_id = $2, purpose = 'Install', updated_at = now() where id = $1", [moving, install]);
    // A machine with no model and no unit stops the completion until it has one.
    const blank = (await R.pullRebuildMachineFor(sql, { id: sd, serial: "TESTSN-NOMODEL" }, "u-wh")).machines.at(-1);
    const complete = (userId = "u-wh") => R.updateRebuildFor(sql, { id: sd, status: "Completed", owner: "tess", targetComplete: "2026-11-20" }, userId);
    await assert.rejects(() => complete(), /^Error: Machine 7 \(SN TESTSN-NOMODEL\) needs its model before this refurb is completed: it goes into stock as that model\.$/);
    assert.equal((await pg.query("select status from rebuilds where id = $1", [sd])).rows[0].status, "Queued", "not completed");
    await R.saveRebuildMachinesFor(sql, { id: sd, machines: [{ id: blank.id, model: "Test mixer" }] }, "u-wh");
    const assetsBefore = Number((await pg.query("select count(*) from assets")).rows[0].count);
    const pingsBefore = Number((await pg.query("select count(*) from desk_notifications")).rows[0].count);

    const done = await complete();
    assert.equal(done.status, "Completed");
    assert.equal(
      done.stockNote,
      "5 machines went into stock at the Staging area, marked needs shop test. Test grinder SN TESTSN-M wasn't put in stock: its unit is on an install for Bean Test Cafe now. Test grinder SN TESTSN-SOLDX wasn't put in stock: its unit is on Bean Test Cafe (sold) now.",
    );
    const staged = (await pg.query("select model, serial, status, site, pallet, level, sold_to, purpose, locked_by, shop_test, shop_test_by, review_status, notes from assets where site = 'staging' order by id")).rows;
    assert.deepEqual(
      staged.map((u) => [u.model, u.serial, u.status, u.sold_to, u.purpose, u.locked_by, u.shop_test, u.shop_test_by, u.review_status]),
      [
        ["Test grinder", "TESTSN-P", "deployed", null, "Staging area", null, "needs-test", "wade", null],
        ["Test grinder", "TESTSN-LATE", "deployed", null, "Staging area", null, "needs-test", "wade", null],
        ["Test brewer", "TESTSN-NEW", "deployed", null, "Staging area", null, "needs-test", "wade", null],
        ["Test kettle", null, "deployed", null, "Staging area", null, "needs-test", "wade", null],
        ["Test mixer", "TESTSN-NOMODEL", "deployed", null, "Staging area", null, "needs-test", "wade", null],
      ],
    );
    assert.ok(staged.every((u) => u.pallet == null && u.level == null));
    assert.match(staged[0].notes, /^Moved from rebuild "Test grinder refurbs" to Staging area · wade · /);
    assert.match(staged[2].notes, /^Added to stock from rebuild "Test grinder refurbs" at the Staging area · wade · /);
    assert.equal(Number((await pg.query("select count(*) from assets")).rows[0].count), assetsBefore + 3, "three new on the stock list; the others were already there");
    assert.equal((await unitRow(pg, late)).site, "staging");
    assert.deepEqual(
      [(await unitRow(pg, pulled)).site, (await unitRow(pg, pulled)).shop_test],
      ["staging", "needs-test"],
      "a unit marked tested before its rebuild needs a shop test again",
    );
    assert.deepEqual((await unitRow(pg, moving)).install_id, install, "the unit on the install stays there");
    const machines = done.machines;
    assert.deepEqual(machines.map((m) => !!m.stockedAt), [true, false, true, true, true, false, true]);
    assert.deepEqual((await unitRow(pg, soldX)).status, "sold", "the sold unit stays sold");
    assert.match(machines[0].notice, /^In stock at the Staging area since [A-Z][a-z]{2} \d{1,2}, \d{4}, needs shop test\.$/);
    assert.equal(machines[1].notice, "Test grinder SN TESTSN-M wasn't put in stock: its unit is on an install for Bean Test Cafe now.");
    assert.equal(machines.find((m) => m.serial === "TESTSN-LATE").assetId, late, "the machine is linked to the unit that went in for it");
    // Nobody reviews it, and nobody is pinged (only Warehouse's pulls before pinged the Admins).
    assert.equal(Number((await pg.query("select count(*) from desk_notifications")).rows[0].count), pingsBefore);
    const logged = (await pg.query("select action, detail from activity where entity_type = 'rebuild' and entity_id = $1 and action = 'stocked'", [sd])).rows;
    assert.equal(logged.length, 1);
    assert.match(logged[0].detail, /^Into stock at the Staging area: Test grinder SN TESTSN-P, /);
    assert.equal(Number((await pg.query("select count(*) from activity where entity_type = 'asset' and action in ('moved', 'added')")).rows[0].count), 5, "each unit's history says so");

    // Saving it again, or completing it again after reopening, adds nothing twice.
    assert.equal((await R.updateRebuildFor(sql, { id: sd, notes: "Done" }, "u-wh")).stockNote, null);
    await R.updateRebuildFor(sql, { id: sd, status: "In progress" }, "u-wh");
    await pg.query("update assets set sold_to = $2, purpose = 'In-house rebuild', install_id = null where id = $1", [moving, SD]);
    const again = await complete();
    assert.equal(again.stockNote, "1 machine went into stock at the Staging area, marked needs shop test. Test grinder SN TESTSN-SOLDX wasn't put in stock: its unit is on Bean Test Cafe (sold) now.");
    assert.equal(Number((await pg.query("select count(*) from assets")).rows[0].count), assetsBefore + 3);
    assert.deepEqual(again.machines.map((m) => !!m.stockedAt), [true, true, true, true, true, false, true]);
    await assert.rejects(() => R.pullRebuildMachineFor(sql, { id: sd, serial: "TESTSN-X" }, "u-wh"), /This rebuild is Completed/);

    // A customer's rebuild completed: its machine goes back to the customer, not into our stock.
    const cust = await rebuild(pg, "Test customer rebuild", "Bean Test Cafe");
    await R.saveRebuildMachinesFor(sql, { id: cust, machines: [{ model: "Test brewer" }] }, "u-tech");
    const theirs = await R.updateRebuildFor(sql, { id: cust, status: "Completed", owner: "tess", targetComplete: "2026-11-20" }, "u-tech");
    assert.deepEqual([theirs.stockNote, theirs.machines[0].stockedAt], [null, null]);
    assert.equal(Number((await pg.query("select count(*) from assets")).rows[0].count), assetsBefore + 3);
    // An Admin completing a shop refurb puts it in stock the same way.
    const shop = await rebuild(pg, "Test shop refurb", SHOP);
    await R.saveRebuildMachinesFor(sql, { id: shop, machines: [{ model: "Test grinder" }] }, "u-owner");
    assert.equal((await R.updateRebuildFor(sql, { id: shop, status: "Completed", owner: "tess", targetComplete: "2026-11-20" }, "u-owner")).stockNote, "1 machine went into stock at the Staging area, marked needs shop test.");
  } finally {
    await pg.close();
  }
});

test("a new rebuild's equipment is its first machine, and each rebuild's machine from before is kept", async () => {
  // The database as it was before machines: two rebuilds with their one machine, and one with none.
  const { pg } = await fresh("0111");
  try {
    await pg.query(
      `insert into rebuilds (title, account, equipment, serial, asset_id, serial_notice) values
         ('Test old refurb', $1, 'Test grinder', 'TESTSN-OLD', 7, 'Serial TESTSN-OLD pulled from warehouse · Test grinder · B-L1'),
         ('Test old serial only', $1, null, 'TESTSN-ONLY', null, null),
         ('Test old empty', $1, null, null, null, null)`,
      [SD],
    );
    await pg.exec(readFileSync(new URL("0111_rebuild_machines.sql", MIGRATIONS), "utf8"));
    // Run twice, it adds nothing twice.
    await pg.exec(readFileSync(new URL("0111_rebuild_machines.sql", MIGRATIONS), "utf8"));
    const kept = (await pg.query("select r.title, m.model, m.serial, m.asset_id, m.notice, m.origin from rebuild_machines m join rebuilds r on r.id = m.rebuild_id order by m.id")).rows;
    assert.deepEqual(kept, [
      { title: "Test old refurb", model: "Test grinder", serial: "TESTSN-OLD", asset_id: 7, notice: "Serial TESTSN-OLD pulled from warehouse · Test grinder · B-L1", origin: null },
      { title: "Test old serial only", model: "", serial: "TESTSN-ONLY", asset_id: null, notice: null, origin: null },
    ]);
  } finally {
    await pg.close();
  }
  const { pg: pg2, sql } = await fresh();
  try {
    const made = await R.createRebuildFor(sql, { title: "Test new refurb", account: SD, equipment: "Test grinder" }, "u-wh");
    assert.deepEqual(made.machines.map((m) => [m.model, m.serial]), [["Test grinder", null]]);
    assert.deepEqual((await R.createRebuildFor(sql, { title: "Test no equipment", account: SD }, "u-wh")).machines, []);
    // A machine kept from before has no record of where its unit was, so taking it off leaves the unit as it is.
    const old = await unit(pg2, "TESTSN-OLD2", { status: "assigned", sold_to: SD, purpose: "In-house rebuild", pallet: "B", level: 1 });
    await pg2.query("insert into rebuild_machines (rebuild_id, model, serial, asset_id) values ($1, 'Test grinder', 'TESTSN-OLD2', $2)", [made.id, old]);
    const m = (await pg2.query("select id from rebuild_machines where serial = 'TESTSN-OLD2'")).rows[0].id;
    assert.equal(
      (await R.removeRebuildMachineFor(sql, { id: made.id, machineId: Number(m) }, "u-wh")).message,
      "SN TESTSN-OLD2 stays as it is (pulled before machines were kept); move it from the Warehouse page if it isn't on this refurb.",
    );
    assert.equal((await unitRow(pg2, old)).status, "assigned");
  } finally {
    await pg2.close();
  }
});

test("the screens: the Equipment tab lists the machines, and the board and the sheet say what went into stock", () => {
  const sheet = readFileSync(new URL("../src/components/desk/rebuild-sheet.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(sheet, /equipment,\s*serial,/, "the details save no longer sends the old one-machine fields");
  assert.match(sheet, /toast\.success\(next\.stockNote \? `Rebuild saved\. \$\{next\.stockNote\}` : "Rebuild saved"\);/);
  const board = readFileSync(new URL("../src/components/desk/rebuild-board.tsx", import.meta.url), "utf8");
  assert.match(board, /if \(next\.stockNote\) toast\.success\(next\.stockNote\);/);
  const ui = readFileSync(new URL("../src/components/desk/rebuild-machines.tsx", import.meta.url), "utf8");
  assert.match(ui, /const editable = canEdit && !closed;/, "a closed rebuild's machines are read only");
  assert.match(ui, /if \(fixed \|\| serial\.trim\(\) === \(m\.serial \?\? ""\) \|\| \(pull\.isPending && lastPull\.current\[String\(m\.id\)\] === serial\.trim\(\)\)\) return;/, "only a changed serial pulls on blur");
});
