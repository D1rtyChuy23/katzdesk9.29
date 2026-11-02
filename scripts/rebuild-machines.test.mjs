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
  // A word alone is a word (11/2 review): "bin", "rack" or "shelf" find the parts named so, not every part with a bin.
  const many = Array.from({ length: 20 }, (_, n) => it(`PARTS : TESTMANY${n}`, { rack: "A", shelf: String(n), bin: "1" }));
  const named = [it("PARTS : TESTGB", null, "Test grounds bin"), it("PARTS : TESTDR", null, "Test drip tray rack"), it("PARTS : TESTSH", null, "Test shelf liner")];
  const list = [...many, ...named];
  assert.deepEqual(found("bin", list), ["PARTS : TESTGB"]);
  assert.deepEqual(found("rack", list), ["PARTS : TESTDR"]);
  assert.deepEqual(found("shelf", list), ["PARTS : TESTSH"]);
  assert.deepEqual(found("ack", list), ["PARTS : TESTDR"]);
  assert.deepEqual(found("grounds bin", list), ["PARTS : TESTGB"]);
  // Rack A is rack A, not rack AB; one piece alone ("A", "03") isn't a bin.
  const ab = [it("PARTS : TESTAB", { rack: "AB", shelf: "1", bin: "1" }), it("PARTS : TESTRA", { rack: "A", shelf: "1", bin: "1" }), it("PARTS : TESTONE", { rack: "A", shelf: null, bin: null })];
  assert.deepEqual(found("rack a", ab), ["PARTS : TESTONE", "PARTS : TESTRA"]);
  assert.deepEqual(found("7", [it("PARTS : TESTSEVEN", { rack: "7", shelf: null, bin: null })]), [], "one piece alone isn't a bin");
  assert.deepEqual(found("rack a shelf 1", ab), ["PARTS : TESTRA"]);
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
    // With more binned parts than the server reads at once, "bin" still finds the parts named bin (and only those).
    await pg.query(
      `insert into billing_items (sku, parent, item, description, rate, kind, bin_rack, bin_shelf, bin_bin)
       select 'TESTMANY' || n, 'PARTS', 'PARTS : TESTMANY' || n, 'Test filler', 5, 'part', 'B', n::text, '1' from generate_series(1, 320) n`,
    );
    await pg.query("insert into billing_items (sku, parent, item, description, rate, kind) values ('TESTGB', 'PARTS', 'PARTS : TESTGB', 'Test grounds bin', 5, 'part')");
    assert.deepEqual(await skus("bin"), ["TESTBIN1", "TESTBIN2", "TESTBIN3", "TESTGB"]);
    assert.equal((await skus("Rack B")).length, 12, "a rack in words still finds its parts");
    // A shelf with more parts than the server reads at once never crowds out a part whose number is what was typed.
    await pg.query(
      `insert into billing_items (sku, parent, item, description, rate, kind, bin_rack, bin_shelf, bin_bin)
       select 'TESTSHELF' || n, 'PARTS', 'PARTS : TESTSHELF' || n, 'Test shelf filler', 5, 'part', 'D', '04', n::text from generate_series(1, 320) n`,
    );
    await pg.query("insert into billing_items (sku, parent, item, description, rate, kind) values ('D04', 'PARTS', 'PARTS : D04', 'Test exact number', 5, 'part')");
    assert.equal((await skus("D-04"))[0], "D04", "the part number first, then that shelf's parts");
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

    // Machine 1 takes another serial: its old unit goes back on its rack slot, free again. (Its own serial pulled again
    // first, as the box does when it loses focus, changes nothing about where the unit came from.)
    const [m1, m2, m3] = rb.machines;
    await R.pullRebuildMachineFor(sql, { id: sd, machineId: m1.id, serial: "TESTSN-A" }, "u-wh");
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
    // Still on Katz Coffee Service Dept., but put on one of its installs since: it stays on that install.
    const ours = Number((await pg.query("insert into installs (customer) values ($1) returning id", [SD])).rows[0].id);
    const kept = await R.pullRebuildMachineFor(sql, { id: sd, serial: "TESTSN-C" }, "u-wh");
    await pg.query("update assets set purpose = 'Install', install_id = $2 where id = $1", [c, ours]);
    assert.equal(
      (await R.removeRebuildMachineFor(sql, { id: sd, machineId: kept.machines.at(-1).id }, "u-wh")).message,
      "SN TESTSN-C was moved since it was pulled, so it stays where it is now.",
    );
    assert.deepEqual([(await unitRow(pg, c)).install_id, (await unitRow(pg, c)).purpose], [ours, "Install"]);
    await pg.query("update assets set status = 'ready', sold_to = null, purpose = null, install_id = null, locked_at = null, locked_by = null where id = $1", [c]);

    // A model changes; one unit on one open rebuild at a time.
    rb = await R.saveRebuildMachinesFor(sql, { id: sd, machines: [{ id: m3.id, model: "Test brewer XL" }] }, "u-wh");
    assert.equal(rb.machines.find((m) => m.id === m3.id).model, "Test brewer XL");
    await R.pullRebuildMachineFor(sql, { id: sd, machineId: m3.id, serial: "TESTSN-C" }, "u-wh");
    const shop = await rebuild(pg, "Test shop refurb", SHOP);
    await assert.rejects(
      () => R.pullRebuildMachineFor(sql, { id: shop, serial: "TESTSN-C", confirmReuse: true }, "u-wh"),
      /^Error: Serial TESTSN-C is on rebuild "Test grinder refurbs" already\. Take it off that rebuild's machines first\.$/,
    );
    // Once that rebuild is closed, the unit can go to another one, and what its pull knew of the unit's place goes with
    // it. The closed rebuild's machine isn't written to: it just doesn't hold the unit any more, and says where it is.
    await pg.query("update rebuilds set status = 'Cancelled' where id = $1", [sd]);
    const taken = await R.pullRebuildMachineFor(sql, { id: shop, serial: "TESTSN-C", confirmReuse: true }, "u-wh");
    assert.equal(taken.machines[0].assetId, c);
    const left = (await pg.query("select asset_id, notice from rebuild_machines where id = $1", [m3.id])).rows[0];
    assert.deepEqual(left, { asset_id: c, notice: "Serial TESTSN-C pulled from warehouse · Test grinder · B-L2" });
    const closedRow = (await R.listRebuildsFor(sql, "u-owner")).rows.find((r) => r.id === sd);
    assert.equal(closedRow.machines.find((m) => m.id === m3.id).moved, 'Its unit is on rebuild "Test shop refurb" now.');
    assert.equal(taken.machines[0].moved, null, "the rebuild that has it says nothing");
    await R.removeRebuildMachineFor(sql, { id: shop, machineId: taken.machines[0].id }, "u-wh");
    assert.deepEqual(await unitRow(pg, c), { status: "ready", site: "barn-back", pallet: "B", level: 2, sold_to: null, purpose: null, install_id: null, job_id: null, locked_by: null, shop_test: null }, "back on its rack slot");
    // The same for a machine that was already on the rebuild: it takes the unit, and where it came from.
    const old = await rebuild(pg, "Test old refurb", SD);
    await R.pullRebuildMachineFor(sql, { id: old, serial: "TESTSN-C" }, "u-wh");
    await pg.query("update rebuilds set status = 'Cancelled' where id = $1", [old]);
    const waiting = (await R.saveRebuildMachinesFor(sql, { id: shop, machines: [{ model: "Test grinder" }] }, "u-wh")).machines.at(-1);
    await R.pullRebuildMachineFor(sql, { id: shop, machineId: waiting.id, serial: "TESTSN-C", confirmReuse: true }, "u-wh");
    await R.removeRebuildMachineFor(sql, { id: shop, machineId: waiting.id }, "u-wh");
    assert.deepEqual([(await unitRow(pg, c)).status, (await unitRow(pg, c)).pallet], ["ready", "B"], "back on its rack slot again");

    // A cancelled rebuild's machines don't change, but they can come off; a completed one's can't. Its machine whose unit
    // went on to another rebuild and back to the rack comes off without moving the unit.
    await assert.rejects(() => R.pullRebuildMachineFor(sql, { id: sd, serial: "TESTSN-A" }, "u-wh"), /^Error: This rebuild is Cancelled, so its machines can't change\. Set it back to In progress first\.$/);
    await assert.rejects(() => R.saveRebuildMachinesFor(sql, { id: sd, machines: [{ model: "Test kettle" }] }, "u-wh"), /This rebuild is Cancelled/);
    const offClosed = await R.removeRebuildMachineFor(sql, { id: sd, machineId: m3.id }, "u-wh");
    assert.equal(offClosed.rebuild.machines.length, 1);
    assert.equal(offClosed.message, "SN TESTSN-C was moved since it was pulled, so it stays where it is now.");
    assert.deepEqual([(await unitRow(pg, c)).status, (await unitRow(pg, c)).pallet], ["ready", "B"], "still on its rack slot");
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

test("a new rebuild's equipment is its first machine, and a machine kept from before leaves its unit as it is", async () => {
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

/* ------------------------------------------------------------------ the review's cases (11/2) */

test("a machine holds its unit only while the unit is still on its rebuild: where it goes back to, and what never blocks a pull", async () => {
  const { pg, sql } = await fresh();
  try {
    const install = Number((await pg.query("insert into installs (customer) values ('Bean Test Cafe') returning id")).rows[0].id);
    // A tech's rebuild for a customer, completed: the unit stays the customer's.
    const bean = await rebuild(pg, "Test customer rebuild", "Bean Test Cafe");
    const u = await unit(pg, "TESTSN-U", { pallet: "B", level: 1 });
    const beanMachine = (await R.pullRebuildMachineFor(sql, { id: bean, serial: "TESTSN-U" }, "u-tech")).machines[0];
    await R.updateRebuildFor(sql, { id: bean, status: "Completed", owner: "tess", targetComplete: "2026-11-20" }, "u-tech");
    const beanBefore = (await pg.query("select asset_id, notice, origin, updated_at from rebuild_machines where id = $1", [beanMachine.id])).rows[0];
    // Warehouse reuses it on a refurb, then takes the machine off: it goes back to the customer, not to the rack.
    const sd = await rebuild(pg, "Test grinder refurbs", SD);
    await assert.rejects(() => R.pullRebuildMachineFor(sql, { id: sd, serial: "TESTSN-U" }, "u-wh"), /is already assigned to Bean Test Cafe/);
    const onSd = (await R.pullRebuildMachineFor(sql, { id: sd, serial: "TESTSN-U", confirmReuse: true }, "u-wh")).machines[0];
    assert.deepEqual(
      (await pg.query("select asset_id, notice, origin, updated_at from rebuild_machines where id = $1", [beanMachine.id])).rows[0],
      beanBefore,
      "the customer's rebuild isn't written to",
    );
    assert.equal((await R.removeRebuildMachineFor(sql, { id: sd, machineId: onSd.id }, "u-wh")).message, "SN TESTSN-U is back where it was before it was pulled.");
    assert.deepEqual(
      await unitRow(pg, u),
      { status: "assigned", site: "barn-back", pallet: "B", level: 1, sold_to: "Bean Test Cafe", purpose: "In-house rebuild", install_id: null, job_id: null, locked_by: "System (assigned)", shop_test: null },
      "back on the customer's rebuild, where it was",
    );

    // A refurb's unit goes to a customer's install by another pull (not through the machines), then the refurb is
    // cancelled. A tech pulls it onto a customer's rebuild and takes it off: it goes back on the install, with its lock.
    const v = await unit(pg, "TESTSN-V", { pallet: "B", level: 3 });
    const a = await rebuild(pg, "Test refurb A", SD);
    await R.pullRebuildMachineFor(sql, { id: a, serial: "TESTSN-V" }, "u-wh");
    await pg.query("update assets set sold_to = 'Bean Test Cafe', purpose = 'Install', install_id = $2, locked_by = 'System (assigned)', updated_at = now() where id = $1", [v, install]);
    await pg.query("update rebuilds set status = 'Cancelled' where id = $1", [a]);
    const bean2 = await rebuild(pg, "Test customer rebuild 2", "Bean Test Cafe");
    const onBean = (await R.pullRebuildMachineFor(sql, { id: bean2, serial: "TESTSN-V" }, "u-tech")).machines[0];
    await R.removeRebuildMachineFor(sql, { id: bean2, machineId: onBean.id }, "u-tech");
    assert.deepEqual(
      [(await unitRow(pg, v)).install_id, (await unitRow(pg, v)).purpose, (await unitRow(pg, v)).locked_by, (await unitRow(pg, v)).status],
      [install, "Install", "System (assigned)", "assigned"],
      "back on the install",
    );
    // The same for Warehouse: its unit goes back to the customer's install, not to the account with nobody's name.
    await pg.query("update assets set sold_to = 'Bean Test Cafe', updated_at = now() where id = $1", [v]);
    const b = await rebuild(pg, "Test refurb B", SD);
    const onB = (await R.pullRebuildMachineFor(sql, { id: b, serial: "TESTSN-V", confirmReuse: true }, "u-wh")).machines[0];
    await R.removeRebuildMachineFor(sql, { id: b, machineId: onB.id }, "u-wh");
    assert.deepEqual([(await unitRow(pg, v)).install_id, (await unitRow(pg, v)).sold_to], [install, "Bean Test Cafe"]);

    // Two open refurbs that both kept the same unit from before machines: the later pull has it. Completing that one
    // puts it in stock, and the other's old link never stops a pull of it after.
    const w = await unit(pg, "TESTSN-W", { status: "assigned", sold_to: SD, purpose: "In-house rebuild", pallet: "C", level: 1 });
    const oldA = await rebuild(pg, "Test old refurb A", SD);
    const oldB = await rebuild(pg, "Test old refurb B", SD);
    await pg.query(
      `insert into rebuild_machines (rebuild_id, model, serial, asset_id, pulled_at, migrated) values
         ($1, 'Test grinder', 'TESTSN-W', $3, '2026-10-01', true), ($2, 'Test grinder', 'TESTSN-W', $3, '2026-10-20', true)`,
      [oldA, oldB, w],
    );
    const list = async () => (await R.listRebuildsFor(sql, "u-owner")).rows;
    assert.equal((await list()).find((r) => r.id === oldA).machines[0].moved, 'Its unit is on rebuild "Test old refurb B" now.');
    assert.equal((await list()).find((r) => r.id === oldB).machines[0].moved, null);
    const doneB = await R.updateRebuildFor(sql, { id: oldB, status: "Completed", owner: "tess", targetComplete: "2026-11-20" }, "u-wh");
    assert.equal(doneB.stockNote, "1 machine went into stock at the Staging area, marked needs shop test.");
    assert.equal((await unitRow(pg, w)).site, "staging");
    const third = await rebuild(pg, "Test third refurb", SD);
    // Refurb A's old link doesn't stop it: the question is only the one any unit at the Staging area gets.
    await assert.rejects(() => R.pullRebuildMachineFor(sql, { id: third, serial: "TESTSN-W" }, "u-tech"), /^Error: Serial TESTSN-W is already assigned to Staging area\. Confirm reuse or cancel\.$/);
    const pulledW = await R.pullRebuildMachineFor(sql, { id: third, serial: "TESTSN-W", confirmReuse: true }, "u-tech");
    assert.equal(pulledW.machines[0].assetId, w);
    // And a refurb whose unit is on a customer's install now doesn't keep the unit from anyone: the question is the
    // install, not "on rebuild … already".
    const x = await unit(pg, "TESTSN-X", { pallet: "C", level: 2 });
    const c = await rebuild(pg, "Test refurb C", SD);
    await R.pullRebuildMachineFor(sql, { id: c, serial: "TESTSN-X" }, "u-wh");
    await pg.query("update assets set sold_to = 'Bean Test Cafe', purpose = 'Install', install_id = $2, updated_at = now() where id = $1", [x, install]);
    await assert.rejects(() => R.pullRebuildMachineFor(sql, { id: third, serial: "TESTSN-X" }, "u-tech"), /^Error: Serial TESTSN-X is already assigned to an install for Bean Test Cafe\. Confirm reuse or cancel\.$/);
    assert.equal((await list()).find((r) => r.id === c).machines[0].moved, "Its unit isn't on this rebuild now: it's on an install for Bean Test Cafe.");
    // A unit on another machine of the same rebuild says so.
    const y = await unit(pg, "TESTSN-Y", { pallet: "C", level: 3 });
    await R.pullRebuildMachineFor(sql, { id: third, serial: "TESTSN-Y" }, "u-tech");
    await assert.rejects(() => R.pullRebuildMachineFor(sql, { id: third, serial: "TESTSN-Y" }, "u-tech"), /^Error: Serial TESTSN-Y is on machine 2 of this rebuild already\.$/);
    assert.ok(y);
  } finally {
    await pg.close();
  }
});

test("the owner's lock keeps a unit where it is: taking the machine off, a new serial, and completing the refurb leave it", async () => {
  const { pg, sql } = await fresh();
  try {
    const sd = await rebuild(pg, "Test grinder refurbs", SD);
    const u = await unit(pg, "TESTSN-L1", { pallet: "B", level: 1 });
    const v = await unit(pg, "TESTSN-L2", { pallet: "B", level: 2 });
    const [m1] = (await R.pullRebuildMachineFor(sql, { id: sd, serial: "TESTSN-L1" }, "u-wh")).machines;
    const m2 = (await R.pullRebuildMachineFor(sql, { id: sd, serial: "TESTSN-L2" }, "u-wh")).machines[1];
    await pg.query("update assets set locked_at = now(), locked_by = 'boss' where id = any($1::int[])", [[u, v]]);
    const locked = { status: "assigned", sold_to: SD, purpose: "In-house rebuild", locked_by: "boss" };
    const lockOf = async (id) => {
      const r = await unitRow(pg, id);
      return { status: r.status, sold_to: r.sold_to, purpose: r.purpose, locked_by: r.locked_by };
    };
    assert.equal((await R.removeRebuildMachineFor(sql, { id: sd, machineId: m1.id }, "u-wh")).message, "SN TESTSN-L1 is locked by boss, so it stays where it is.");
    assert.deepEqual(await lockOf(u), locked);
    await R.pullRebuildMachineFor(sql, { id: sd, machineId: m2.id, serial: "TESTSN-NOTHERE" }, "u-wh");
    assert.deepEqual(await lockOf(v), locked, "a new serial on its machine leaves it too");
    const w = await unit(pg, "TESTSN-L3", { pallet: "B", level: 3 });
    await R.pullRebuildMachineFor(sql, { id: sd, serial: "TESTSN-L3" }, "u-wh");
    await pg.query("update assets set locked_at = now(), locked_by = 'boss' where id = $1", [w]);
    await R.saveRebuildMachinesFor(sql, { id: sd, machines: [{ id: m2.id, model: "Test brewer" }] }, "u-wh");
    // A serial typed before its unit was in the records; the unit turns up at Training since, and the owner locks that
    // serial on a customer's account.
    await R.pullRebuildMachineFor(sql, { id: sd, serial: "TESTSN-L4", model: "Test kettle" }, "u-wh");
    const z = await unit(pg, "TESTSN-L4", { site: "training", status: "deployed", purpose: "Training" });
    await pg.query(
      "insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key, locked_at, locked_by) values ('Bean Test Cafe', 'Test kettle', 'Test kettle', 'TESTSN-L4', 'testsn-l4', now(), 'boss')",
    );
    const done = await R.updateRebuildFor(sql, { id: sd, status: "Completed", owner: "tess", targetComplete: "2026-11-20" }, "u-wh");
    assert.equal(
      done.stockNote,
      "1 machine went into stock at the Staging area, marked needs shop test. Test grinder SN TESTSN-L3 wasn't put in stock: its unit is locked by boss. Test kettle SN TESTSN-L4 wasn't put in stock: its unit is locked by boss.",
    );
    assert.deepEqual(await lockOf(w), locked, "the locked unit stays on the refurb");
    assert.deepEqual([(await unitRow(pg, z)).site, (await unitRow(pg, z)).status], ["training", "deployed"], "the account-locked serial's unit stays at Training");
    // A unit whose serial is locked on an account while it is pulled stays put when its machine comes off.
    const sd2 = await rebuild(pg, "Test second refurb", SD);
    const q = await unit(pg, "TESTSN-L5", { pallet: "B", level: 4 });
    const onQ = (await R.pullRebuildMachineFor(sql, { id: sd2, serial: "TESTSN-L5" }, "u-wh")).machines[0];
    await pg.query(
      "insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key, locked_at, locked_by) values ('Bean Test Cafe', 'Test grinder', 'Test grinder', 'TESTSN-L5', 'testsn-l5', now(), 'boss')",
    );
    assert.equal((await R.removeRebuildMachineFor(sql, { id: sd2, machineId: onQ.id }, "u-wh")).message, "SN TESTSN-L5 is locked by boss, so it stays where it is.");
    assert.equal((await unitRow(pg, q)).status, "assigned");
  } finally {
    await pg.close();
  }
});

test("a unit put back on a rack line another unit took meanwhile gets a free line, or the Staging area when its section is full", async () => {
  const { pg, sql } = await fresh();
  try {
    const sd = await rebuild(pg, "Test grinder refurbs", SD);
    const lineOf = async (id) => (await pg.query("select status, site, pallet, level, line_no, purpose from assets where id = $1", [id])).rows[0];
    const u = await unit(pg, "TESTSN-R1", { pallet: "B", level: 1 });
    await pg.query("update assets set line_no = 1 where id = $1", [u]);
    const onU = (await R.pullRebuildMachineFor(sql, { id: sd, serial: "TESTSN-R1" }, "u-wh")).machines[0];
    // While it is pulled, another unit is parked on its line.
    const v = await unit(pg, "TESTSN-R2", { pallet: "B", level: 1 });
    await pg.query("update assets set line_no = 1 where id = $1", [v]);
    assert.equal((await R.removeRebuildMachineFor(sql, { id: sd, machineId: onU.id }, "u-wh")).message, "SN TESTSN-R1 is back where it was before it was pulled.");
    assert.deepEqual(await lineOf(u), { status: "ready", site: "barn-back", pallet: "B", level: 1, line_no: 2, purpose: null }, "the next free line");
    assert.equal((await lineOf(v)).line_no, 1, "the other unit keeps its line");
    // Its own line still free: it goes back on it.
    const onU2 = (await R.pullRebuildMachineFor(sql, { id: sd, serial: "TESTSN-R1" }, "u-wh")).machines[0];
    await R.removeRebuildMachineFor(sql, { id: sd, machineId: onU2.id }, "u-wh");
    assert.equal((await lineOf(u)).line_no, 2);
    // A full section: the Staging area.
    const w = await unit(pg, "TESTSN-R3", { pallet: "C", level: 2 });
    await pg.query("update assets set line_no = 5 where id = $1", [w]);
    const onW = (await R.pullRebuildMachineFor(sql, { id: sd, serial: "TESTSN-R3" }, "u-wh")).machines[0];
    for (let n = 1; n <= 12; n++) {
      const id = await unit(pg, `TESTSN-FILL${n}`, { pallet: "C", level: 2 });
      await pg.query("update assets set line_no = $2 where id = $1", [id, n]);
    }
    assert.equal(
      (await R.removeRebuildMachineFor(sql, { id: sd, machineId: onW.id }, "u-wh")).message,
      "SN TESTSN-R3 went to the Staging area: its rack section filled up while it was pulled.",
    );
    assert.deepEqual(await lineOf(w), { status: "deployed", site: "staging", pallet: null, level: null, line_no: null, purpose: "Staging area" });
    assert.equal(Number((await pg.query("select count(*) from assets where site = 'barn-back' and pallet = 'C' and level = 2 and status in ('ready', 'deployed')")).rows[0].count), 12, "the section still has twelve");
  } finally {
    await pg.close();
  }
});

test("a pull keeps the model the person has, a serial is on one open machine at a time, and every pull checks the unit didn't change", async () => {
  const { pg, sql } = await fresh();
  try {
    const sd = await rebuild(pg, "Test grinder refurbs", SD);
    const [m1] = (await R.saveRebuildMachinesFor(sql, { id: sd, machines: [{ model: "Test grinder" }] }, "u-wh")).machines;
    const u = await unit(pg, "TESTSN-M1", { model: "Test grinder (rack)", pallet: "B", level: 1 });
    // The model was changed and not saved when its serial was pulled: the change goes in with the pull.
    let rb = await R.pullRebuildMachineFor(sql, { id: sd, machineId: m1.id, serial: "TESTSN-M1", model: "Test grinder XL" }, "u-wh");
    assert.deepEqual([rb.machines[0].model, rb.machines[0].assetId], ["Test grinder XL", u]);
    // The same serial again, with another change: nothing to pull, and the model still goes in.
    rb = await R.pullRebuildMachineFor(sql, { id: sd, machineId: m1.id, serial: "TESTSN-M1", model: "Test grinder XXL" }, "u-wh");
    assert.equal(rb.machines[0].model, "Test grinder XXL");
    // A serial not in the warehouse: its model goes in too. A blank model leaves the one it has.
    rb = await R.pullRebuildMachineFor(sql, { id: sd, machineId: m1.id, serial: "TESTSN-NEW1", model: "Test brewer" }, "u-wh");
    assert.equal(rb.machines[0].model, "Test brewer");
    rb = await R.pullRebuildMachineFor(sql, { id: sd, machineId: m1.id, serial: "TESTSN-NEW2", model: "" }, "u-wh");
    assert.equal(rb.machines[0].model, "Test brewer");
    // One serial, one open machine: the same new serial on another machine, here or on another refurb, is refused.
    await assert.rejects(() => R.pullRebuildMachineFor(sql, { id: sd, serial: "TESTSN-NEW2", model: "Test brewer" }, "u-wh"), /^Error: Serial TESTSN-NEW2 is on machine 1 of this rebuild already\.$/);
    const other = await rebuild(pg, "Test other refurb", SD);
    await assert.rejects(
      () => R.pullRebuildMachineFor(sql, { id: other, serial: " testsn-new2 ", model: "Test brewer" }, "u-tech"),
      /^Error: Serial testsn-new2 is on rebuild "Test grinder refurbs" already\. Take it off that rebuild's machines first\.$/,
    );
    // Its own serial typed again is fine, and so is a serial a closed rebuild's machine had.
    await R.pullRebuildMachineFor(sql, { id: sd, machineId: m1.id, serial: "TESTSN-NEW2" }, "u-wh");
    await pg.query("update rebuilds set status = 'Cancelled' where id = $1", [sd]);
    assert.equal((await R.pullRebuildMachineFor(sql, { id: other, serial: "TESTSN-NEW2", model: "Test brewer" }, "u-tech")).machines[0].serial, "TESTSN-NEW2");
    await pg.query("update rebuilds set status = 'Queued' where id = $1", [sd]);

    // Two pulls at once can't both take a unit: a tech's pull goes through only while the unit is as it was read.
    const raceOn = (pattern, meanwhile) => {
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
    const v = await unit(pg, "TESTSN-M2", { pallet: "B", level: 2 });
    const third = await rebuild(pg, "Test third refurb", SD);
    const takeIt = () => pg.query("update assets set status = 'assigned', sold_to = $2, purpose = 'In-house rebuild', updated_at = now() + interval '1 second' where id = $1", [v, SD]);
    await assert.rejects(
      () => R.pullRebuildMachineFor(raceOn(/^\s*with refurb as \(/, takeIt), { id: third, serial: "TESTSN-M2" }, "u-tech"),
      /^Error: Serial TESTSN-M2 was just moved or taken by another rebuild, so it wasn't pulled\. Pull it again\.$/,
    );
    assert.deepEqual((await R.listRebuildsFor(sql, "u-tech")).rows.find((r) => r.id === third).machines, []);
  } finally {
    await pg.close();
  }
});

test("completing a refurb checks again as each machine goes in; a refurb made Completed stocks; one serial and old machines go in once", async () => {
  const { pg, sql } = await fresh();
  try {
    const assets = async () => Number((await pg.query("select count(*) from assets")).rows[0].count);
    // An Admin moves the refurb to a customer between Warehouse's completing save and its machines going in: nothing
    // goes into our stock.
    const sd = await rebuild(pg, "Test grinder refurbs", SD);
    await R.saveRebuildMachinesFor(sql, { id: sd, machines: [{ model: "Test kettle" }, { model: "Test grinder" }] }, "u-wh");
    const before = await assets();
    let done = false;
    const raced = Object.assign(async () => assert.fail("tagged query"), {
      query: async (text, params) => {
        if (!done && /^\s*with mine as \(select id from rebuild_machines/.test(text)) {
          done = true;
          await pg.query("update rebuilds set account = 'Bean Test Cafe' where id = $1", [sd]);
        }
        return sql.query(text, params);
      },
    });
    const out = await R.updateRebuildFor(raced, { id: sd, status: "Completed", owner: "tess", targetComplete: "2026-11-20" }, "u-wh");
    assert.equal(out.stockNote, "Nothing went into stock: this rebuild changed while its machines were going in.");
    assert.equal(await assets(), before, "no unit was added");
    assert.deepEqual((await pg.query("select count(*)::int as n from rebuild_machines where rebuild_id = $1 and stocked_at is not null", [sd])).rows[0].n, 0);

    // A machine that lost its model meanwhile, and one whose stock step fails, stay off with a note; the rest go in.
    const sd2 = await rebuild(pg, "Test second refurb", SD);
    const [k1, k2, k3] = (await R.saveRebuildMachinesFor(sql, { id: sd2, machines: [{ model: "Test kettle" }, { model: "Test mixer" }, { model: "Test brewer" }] }, "u-wh")).machines;
    let broke = false;
    const flaky = Object.assign(async () => assert.fail("tagged query"), {
      query: async (text, params) => {
        if (/^\s*update rebuilds set\s+title = \$2/.test(text)) {
          const res = await sql.query(text, params);
          await pg.query("update rebuild_machines set model = '' where id = $1", [k1.id]);
          return res;
        }
        if (!broke && /insert into assets/.test(text) && params?.[1] === "Test mixer") {
          broke = true;
          throw new Error("Test connection dropped");
        }
        return sql.query(text, params);
      },
    });
    const err = console.error;
    console.error = () => undefined;
    const out2 = await R.updateRebuildFor(flaky, { id: sd2, status: "Completed", owner: "tess", targetComplete: "2026-11-20" }, "u-wh").finally(() => {
      console.error = err;
    });
    assert.equal(
      out2.stockNote,
      "1 machine went into stock at the Staging area, marked needs shop test. Machine 1 wasn't put in stock: it has no model. Set the refurb back to In progress, pick its model, then complete it again. Test mixer wasn't put in stock: something went wrong. Set the refurb back to In progress, then complete it again.",
    );
    assert.deepEqual(out2.machines.map((m) => !!m.stockedAt), [false, false, true]);
    assert.equal(out2.machines.find((m) => m.id === k3.id).stockedAt != null, true);
    assert.ok(k2);

    // A refurb made as Completed puts its machine in stock straight away.
    const made = await R.createRebuildFor(sql, { title: "Test done refurb", account: SD, equipment: "Test grinder", status: "Completed", owner: "tess", targetComplete: "2026-11-20" }, "u-wh");
    assert.equal(made.stockNote, "1 machine went into stock at the Staging area, marked needs shop test.");
    assert.equal(!!made.machines[0].stockedAt, true);

    // Two machines with the same serial (from before the rule) put one unit in stock, not two; a machine kept from
    // before machines with nothing but its model isn't added (it may be on the stock list already); one with a serial is.
    const sd3 = await rebuild(pg, "Test third refurb", SD);
    await pg.query(
      `insert into rebuild_machines (rebuild_id, model, serial, migrated) values
         ($1, 'Test grinder', 'TESTSN-TWIN', false), ($1, 'Test grinder', 'testsn-twin', false),
         ($1, 'Test old kettle', null, true), ($1, 'Test old mixer', 'TESTSN-OLDM', true)`,
      [sd3],
    );
    const before3 = await assets();
    const out3 = await R.updateRebuildFor(sql, { id: sd3, status: "Completed", owner: "tess", targetComplete: "2026-11-20" }, "u-wh");
    assert.equal(
      out3.stockNote,
      "2 machines went into stock at the Staging area, marked needs shop test. Test grinder SN testsn-twin wasn't put in stock: its serial went into stock already with another machine on this refurb. Test old kettle wasn't added to stock: it was on this refurb before machines had serials, so it may be on the stock list already. Check the Warehouse page.",
    );
    assert.equal(await assets(), before3 + 2, "one for the twin serial, one for the old mixer");
    assert.deepEqual(out3.machines.map((m) => !!m.stockedAt), [true, false, false, true]);
    // A new machine the person adds, with only its model, goes in as before.
    const sd4 = await rebuild(pg, "Test fourth refurb", SD);
    await R.saveRebuildMachinesFor(sql, { id: sd4, machines: [{ model: "Test new kettle" }] }, "u-wh");
    assert.equal((await R.updateRebuildFor(sql, { id: sd4, status: "Completed", owner: "tess", targetComplete: "2026-11-20" }, "u-wh")).stockNote, "1 machine went into stock at the Staging area, marked needs shop test.");

    // A shop refurb moved to Katz Coffee Service Dept. takes its units only while it is still there: an Admin's move
    // to a customer in between stands, and the units stay as they were.
    const shop = await rebuild(pg, "Test shop refurb", SHOP);
    const s1 = await unit(pg, "TESTSN-SHOP1", { pallet: "D", level: 1 });
    await R.pullRebuildMachineFor(sql, { id: shop, serial: "TESTSN-SHOP1" }, "u-wh");
    let moved = false;
    const racedMove = Object.assign(async () => assert.fail("tagged query"), {
      query: async (text, params) => {
        if (!moved && /^\s*with moved as \(/.test(text)) {
          moved = true;
          await pg.query("update rebuilds set account = 'Bean Test Cafe' where id = $1", [shop]);
        }
        return sql.query(text, params);
      },
    });
    await R.updateRebuildFor(racedMove, { id: shop, account: SD }, "u-wh");
    assert.equal((await unitRow(pg, s1)).sold_to, SHOP, "the unit didn't follow a move that was undone");
  } finally {
    await pg.close();
  }
});

test("a customer rename carries its rebuilds and their machines' records, so a pulled unit goes back under the new name", async () => {
  const { pg, sql } = await fresh();
  try {
    const { retargetCustomer } = await import("../src/lib/ops/customer-identity.ts");
    const { countsText } = await import("../src/lib/ops/customer-rename.ts");
    const install = Number((await pg.query("insert into installs (customer) values ('Bean Test Cafe') returning id")).rows[0].id);
    const bean = await rebuild(pg, "Test customer rebuild", "Bean Test Cafe");
    const u = await unit(pg, "TESTSN-N1", { site: "field", status: "assigned", sold_to: "Bean Test Cafe", install_id: install });
    const m = (await R.pullRebuildMachineFor(sql, { id: bean, serial: "TESTSN-N1" }, "u-tech")).machines[0];
    // The rename window counts the rebuilds that would move.
    const { planCustomerRename } = await import("../src/lib/ops/customer-identity.ts");
    const beanId = Number((await pg.query("select id from directory_customers where name = 'Bean Test Cafe'")).rows[0].id);
    const plan = await planCustomerRename(sql, beanId, SD);
    assert.deepEqual([plan.kind, plan.moving?.rebuilds], ["merge", 1]);
    await retargetCustomer(sql, "Bean Test Cafe", "Bean Renamed Cafe");
    assert.equal((await pg.query("select account from rebuilds where id = $1", [bean])).rows[0].account, "Bean Renamed Cafe");
    const row = (await R.listRebuildsFor(sql, "u-tech")).rows.find((r) => r.id === bean);
    assert.equal(row.machines[0].moved, null, "the rebuild still has its unit");
    assert.equal((await R.removeRebuildMachineFor(sql, { id: bean, machineId: m.id }, "u-tech")).message, "SN TESTSN-N1 is back where it was before it was pulled.");
    assert.deepEqual([(await unitRow(pg, u)).sold_to, (await unitRow(pg, u)).install_id], ["Bean Renamed Cafe", install]);
    // And says so.
    assert.equal(countsText({ calls: 0, tlcs: 0, pms: 0, installs: 1, deals: 0, equipment: 0, woHistory: 0, rebuilds: 2 }), "1 install and 2 rebuilds");
  } finally {
    await pg.close();
  }
});

test("migration 0111 empties a rebuild's one-machine columns once its machine has them; what the old site writes later becomes a machine", async () => {
  const { pg } = await fresh("0111");
  try {
    await pg.query(
      `insert into rebuilds (title, account, equipment, serial, asset_id, serial_notice) values
         ('Test old refurb', $1, 'Test grinder', 'TESTSN-OLD', 7, 'Serial TESTSN-OLD pulled from warehouse · Test grinder · B-L1'),
         ('Test old serial only', $1, null, 'TESTSN-ONLY', null, null),
         ('Test old empty', $1, null, null, null, null),
         ('Test old unit only', $1, null, null, 9, null)`,
      [SD],
    );
    const first = Number((await pg.query("select id from rebuilds where title = 'Test old refurb'")).rows[0].id);
    await pg.query("insert into activity (entity_type, entity_id, action, detail, created_at) values ('rebuild', $1, 'assigned-asset', 'Test pull', '2026-10-30T15:00:00Z')", [first]);
    await pg.exec(readFileSync(new URL("0111_rebuild_machines.sql", MIGRATIONS), "utf8"));
    await pg.exec(readFileSync(new URL("0111_rebuild_machines.sql", MIGRATIONS), "utf8"));
    const kept = (await pg.query("select r.title, m.model, m.serial, m.asset_id, m.migrated, m.pulled_at is not null as pulled from rebuild_machines m join rebuilds r on r.id = m.rebuild_id order by m.id")).rows;
    assert.deepEqual(kept, [
      { title: "Test old refurb", model: "Test grinder", serial: "TESTSN-OLD", asset_id: 7, migrated: true, pulled: true },
      { title: "Test old serial only", model: "", serial: "TESTSN-ONLY", asset_id: null, migrated: true, pulled: false },
      { title: "Test old unit only", model: "", serial: null, asset_id: 9, migrated: true, pulled: true },
    ]);
    const pulledAt = (await pg.query("select pulled_at from rebuild_machines where rebuild_id = $1", [first])).rows[0].pulled_at;
    assert.equal(new Date(pulledAt).toISOString(), "2026-10-30T15:00:00.000Z", "its pull as the rebuild logged it");
    assert.deepEqual(
      (await pg.query("select count(*)::int as n from rebuilds where equipment is not null or serial is not null or asset_id is not null or serial_notice is not null")).rows[0].n,
      0,
      "the old columns are empty",
    );
  } finally {
    await pg.close();
  }

  const { pg: pg2, sql } = await fresh();
  try {
    // A rebuild made by the old site while the publish built, with its one machine in the old columns: the board has it.
    await pg2.query("insert into rebuilds (title, account, equipment) values ('Test window refurb', $1, 'Test brewer')", [SD]);
    const win = Number((await pg2.query("select id from rebuilds where title = 'Test window refurb'")).rows[0].id);
    const raw = (await pg2.query("select * from rebuilds where id = $1", [win])).rows[0];
    assert.equal(R.mapRebuild(raw, "2026-11-02").equipment, "Test brewer", "shown even before it is picked up");
    const listed = (await R.listRebuildsFor(sql, "u-wh")).rows.find((r) => r.id === win);
    assert.deepEqual(listed.machines.map((m) => [m.model, m.serial]), [["Test brewer", null]]);
    assert.equal((await pg2.query("select equipment from rebuilds where id = $1", [win])).rows[0].equipment, null);
    // The old site pulls a serial onto it: the machine takes it the next time it changes, once.
    const u = await unit(pg2, "TESTSN-WIN", { status: "assigned", sold_to: SD, purpose: "In-house rebuild", pallet: "B", level: 1 });
    await pg2.query("update rebuilds set serial = 'TESTSN-WIN', asset_id = $2, serial_notice = 'Serial TESTSN-WIN pulled from warehouse · Test grinder · B-L1' where id = $1", [win, u]);
    const after = await R.saveRebuildMachinesFor(sql, { id: win, machines: [] }, "u-wh");
    assert.deepEqual(after.machines.map((m) => [m.model, m.serial, m.assetId, m.moved]), [["Test brewer", "TESTSN-WIN", u, null]]);
    // The old sheet saving the same equipment back adds nothing.
    await pg2.query("update rebuilds set equipment = 'Test brewer' where id = $1", [win]);
    assert.equal((await R.listRebuildsFor(sql, "u-wh")).rows.find((r) => r.id === win).machines.length, 1);
    // A new rebuild writes its equipment only as its first machine.
    const made = await R.createRebuildFor(sql, { title: "Test new refurb", account: SD, equipment: "Test grinder" }, "u-wh");
    assert.equal((await pg2.query("select equipment from rebuilds where id = $1", [made.id])).rows[0].equipment, null);
    assert.deepEqual(made.machines.map((m) => m.model), ["Test grinder"]);
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
