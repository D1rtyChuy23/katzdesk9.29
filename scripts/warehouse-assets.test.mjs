// Assets → Warehouse (Chuy, 11/12): what the barn has to put out, what waits in staging after a refurb, and the refurbs
// still open. Read only; each unit opens on the Warehouse page. Made-up units and accounts only.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const W = await import("../src/lib/ops/warehouse-assets.ts");
const { readWarehouseAssets } = await import("../src/lib/ops/warehouse-assets-api.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const unit = (id, model, extra = {}) => ({ id, kind: "equip", model, serial: null, qty: 1, site: "barn-back", pallet: "C", level: 3, lineNo: 4, shopTest: null, stockHold: null, stockHoldCustomer: null, customerOwned: null, ...extra });

test("a unit's place reads as rack, bay, level and line, or the location's name", () => {
  assert.match(W.placeLabel(unit(1, "Test Brewer")), /· C · L3 · #4$/);
  assert.doesNotMatch(W.placeLabel({ site: "staging", pallet: null, level: null, lineNo: null }), /·/);
});

test("available units by model: free ones and spoken-for ones counted apart, most free first", () => {
  const units = [
    unit(1, "Test Brewer"),
    unit(2, "Test Brewer", { qty: 2 }),
    unit(3, "Test Brewer", { stockHold: "assign", stockHoldCustomer: "Test Diner" }),
    unit(4, "Test Grinder"),
  ];
  assert.deepEqual(W.byModel(units), [
    { model: "Test Brewer", free: 3, held: 1 },
    { model: "Test Grinder", free: 1, held: 0 },
  ]);
  assert.deepEqual(W.filterStock(units, "grind", "").map((u) => u.id), [4]);
  assert.deepEqual(W.filterStock(units, "test diner", "").map((u) => u.id), [3], "the request's account");
  assert.deepEqual(W.filterStock(units, "", "module").map((u) => u.id), []);
});

test("the barn's stock: free on a rack and on no install; staging; open refurbs with their machines", async () => {
  const pg = new PGlite({ parsers: { 20: Number, 1082: (v) => v } });
  try {
    for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
    const query = async (text, params) => (await pg.query(text, params)).rows;
    const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
    const asset = (model, site, status, extra = "") =>
      query(`insert into assets (kind, model, serial, qty, site, pallet, level, line_no, status${extra ? ", install_id" : ""}) values ('equip', $1, 'S', 1, $2, 'C', 3, 1, $3${extra ? ", 1" : ""}) returning id`, [model, site, status]);
    await asset("Test Ready Brewer", "barn-back", "ready");
    await asset("Test Front Grinder", "barn-front", "ready");
    await asset("Test On An Install", "barn-back", "ready", "install");
    await asset("Test Deployed", "test-location", "deployed");
    await asset("Test Sold", "sold", "sold");
    await query("insert into assets (kind, model, serial, qty, site, status, shop_test) values ('equip', 'Test Refurbed', 'R-1', 1, 'staging', 'deployed', 'needs-test')");
    const open = Number((await query("insert into rebuilds (title, account, status) values ('Test refurb', 'Katz shop / stock', 'In progress') returning id"))[0].id);
    await query("insert into rebuilds (title, account, status) values ('Test done', 'Katz shop / stock', 'Completed'), ('Test gone', 'Katz shop / stock', 'Cancelled')");
    await query("insert into rebuilds (title, account, status, archived) values ('Test archived', 'Katz shop / stock', 'Queued', true)");
    await query("insert into rebuild_machines (rebuild_id, model, serial) values ($1, 'Test Espresso', 'E-1'), ($1, 'Test Grinder', null)", [open]);
    const w = await readWarehouseAssets(sql);
    assert.deepEqual(w.available.map((u) => u.model).sort(), ["Test Front Grinder", "Test Ready Brewer"]);
    assert.deepEqual(w.staging.map((u) => [u.model, u.shopTest]), [["Test Refurbed", "needs-test"]]);
    assert.deepEqual(w.rebuilds.map((r) => [r.title, r.status, r.machines]), [["Test refurb", "In progress", [{ model: "Test Espresso", serial: "E-1" }, { model: "Test Grinder", serial: null }]]]);
  } finally {
    await pg.close();
  }
});

test("the page: a Warehouse section, the Warehouse role kept to it, and units opening on the Warehouse page", () => {
  const page = src("src/routes/_app/assets.tsx");
  assert.ok(page.includes('const section: Section = warehouseOnly ? "warehouse" : (search.section ?? "field");'));
  assert.ok(page.includes("{warehouseOnly ? null : ("), "no In the Field chip for Warehouse");
  assert.ok(page.includes('<Link to="/warehouse" search={{ open: u.id, from }}'), "a unit opens at its rack slot");
  assert.ok(page.includes('<Link to="/rebuilds" search={{ open: r.id }}'));
  assert.ok(src("src/lib/ops/field-assets-api.ts").includes("if (await isWarehouseOnly(sql, context.userId)) throw new Error("), "the field list refuses Warehouse");
});

// Grok's live test of #141 (11/13): the search and kind filter narrow the open refurbs too.
test("the open refurbs narrow by search (title, account, machine model or serial) and show under All kinds and Equipment only", () => {
  const r = (id, title, machines) => ({ id, title, account: "Katz shop / stock", status: "Waiting", targetComplete: null, machines });
  const list = [r(1, "Test KB90 Rebuild", [{ model: "Test KB90", serial: "KB-1" }]), r(2, "Test Cameo Rebuild", [{ model: "Test Cameo", serial: "C-9" }])];
  const ids = (xs) => xs.map((x) => x.id);
  assert.deepEqual(ids(W.filterRebuilds(list, "", "")), [1, 2]);
  assert.deepEqual(ids(W.filterRebuilds(list, "kb90", "")), [1]);
  assert.deepEqual(ids(W.filterRebuilds(list, "c-9", "")), [2], "a machine's serial");
  assert.deepEqual(ids(W.filterRebuilds(list, "zzzz-no-match", "")), []);
  assert.deepEqual(ids(W.filterRebuilds(list, "", "equip")), [1, 2]);
  assert.deepEqual(ids(W.filterRebuilds(list, "", "module")), []);
  assert.deepEqual(ids(W.filterRebuilds(list, "", "dispenser")), []);
  assert.ok(src("src/routes/_app/assets.tsx").includes("filterRebuilds(q.data?.rebuilds ?? [], text, kind)"));
});
