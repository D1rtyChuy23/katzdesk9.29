// Corrigo net on an update (Grok for Chuy, 11/15): the preview shows "Corrigo net $old → $new" when the file's Total
// Invoice differs from the stored net, and Confirm writes it. A blank total leaves the stored net alone, and nothing
// else billing-related moves. Made-up accounts and amounts; the shapes copy WO-0557 ($300.00 stored, $465.00 now).
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/unused";
const C = await import("../src/lib/ops/corrigo.ts");
const { applyCorrigoRows, previewCorrigoRecords } = await import("../src/lib/ops/corrigo-import.ts");
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

async function freshDb() {
  const pg = new PGlite({ parsers: { 20: Number, 1082: (v) => v } });
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  await query("insert into directory_customers (name) values ('ZZ Test Diner')");
  const ticket = async (wo, net, extra = {}) =>
    Number(
      (
        await query(
          "insert into service_jobs (kind, call_id, customer, wo, status, received, corrigo_net, ns_so) values ('service', $1, 'ZZ Test Diner', $1, 'Completed', '2026-10-01', $2, $3) returning id",
          [wo, net, extra.so ?? null],
        )
      )[0].id,
    );
  return { pg, sql, query, ticket };
}
const file = (rows) => C.parseCorrigoMatrix([["ST#", "Operational Status", "Customer Name", "Type", "Problem Description", "Total Invoice"], ...rows]).records;
const one = (preview, wo) => preview.rows.find((r) => r.canonicalWo === wo);

test("an update shows the stored net and the file's, and Confirm writes the file's", async () => {
  const { pg, sql, query, ticket } = await freshDb();
  try {
    const a = await ticket("WO-0557", 300);
    const b = await ticket("WO-0852", 364.83, { so: "SO1234" });
    const same = await ticket("WO-0901", 120);
    const blank = await ticket("WO-0902", 250);
    const preview = await previewCorrigoRecords(
      sql,
      file([
        ["0557", "Completed", "ZZ Test Diner", "Request", "Leak", "$465.00"],
        ["0852", "Completed", "ZZ Test Diner", "Request", "Leak", "185.90"],
        ["0901", "Completed", "ZZ Test Diner", "Request", "Leak", "120.00"],
        ["0902", "Completed", "ZZ Test Diner", "Request", "Leak", ""],
      ]),
    );
    assert.deepEqual(one(preview, "WO-0557").corrigoNetChange, { from: 300, to: 465 });
    assert.deepEqual(one(preview, "WO-0852").corrigoNetChange, { from: 364.83, to: 185.9 });
    assert.equal(one(preview, "WO-0901").corrigoNetChange, null);
    assert.equal(one(preview, "WO-0902").corrigoNetChange, null);
    assert.equal(one(preview, "WO-0902").corrigoNet, null);

    const charges = await query("select count(*)::int as n from ticket_charges");
    await applyCorrigoRows(sql, preview.rows, "boss");
    const net = async (id) => Number((await query("select corrigo_net from service_jobs where id = $1", [id]))[0].corrigo_net);
    assert.deepEqual([await net(a), await net(b), await net(same), await net(blank)], [465, 185.9, 120, 250]);
    // A billed ticket's Sales Order and charges stay as they were.
    assert.equal((await query("select ns_so from service_jobs where id = $1", [b]))[0].ns_so, "SO1234");
    assert.deepEqual(await query("select count(*)::int as n from ticket_charges"), charges);
  } finally {
    await pg.close();
  }
});

test("a ticket merged into an install takes the new net too, since its billing is still its own", async () => {
  const { pg, sql, query, ticket } = await freshDb();
  try {
    const t = await ticket("WO-0559", 300);
    const install = Number((await query("insert into installs (customer, equip_status) values ('ZZ Test Diner', 'Ready') returning id"))[0].id);
    await query("update service_jobs set merged_install_id = $2, duplicate_of = id where id = $1", [t, install]);
    await query("insert into install_work_orders (install_id, wo, match_key, source) values ($1, 'WO-0559', '0559', 'merge')", [install]);
    // An older WO-0559 merged into another install (WO numbers started over in July 2026) is left alone.
    const old = await ticket("WO-0559 (old)", 99);
    const other = Number((await query("insert into installs (customer, equip_status) values ('ZZ Test Diner', 'Installed') returning id"))[0].id);
    await query("update service_jobs set merged_install_id = $2, duplicate_of = id, wo = 'WO-0559' where id = $1", [old, other]);
    const preview = await previewCorrigoRecords(sql, file([["0559", "Completed", "ZZ Test Diner", "Request", "Install", "540.00"]]));
    assert.equal(one(preview, "WO-0559").jobId, install);
    assert.deepEqual(one(preview, "WO-0559").corrigoNetChange, { from: 300, to: 540 });
    await applyCorrigoRows(sql, preview.rows, "boss");
    assert.equal(Number((await query("select corrigo_net from service_jobs where id = $1", [t]))[0].corrigo_net), 540);
    assert.equal(Number((await query("select corrigo_net from service_jobs where id = $1", [old]))[0].corrigo_net), 99);
  } finally {
    await pg.close();
  }
});

test("an install that isn't a merged ticket shows no net change", async () => {
  const { pg, sql, query } = await freshDb();
  try {
    const id = Number((await query("insert into installs (customer, equip_status, wo) values ('ZZ Test Diner', 'Ready', 'WO-0700') returning id"))[0].id);
    await query("insert into install_work_orders (install_id, wo, match_key, source) values ($1, 'WO-0700', '0700', 'corrigo')", [id]);
    const preview = await previewCorrigoRecords(sql, file([["0700", "Open", "ZZ Test Diner", "Request", "Install", "900.00"]]));
    assert.deepEqual([one(preview, "WO-0700").board, one(preview, "WO-0700").corrigoNetChange], ["install", null]);
  } finally {
    await pg.close();
  }
});

test("the preview line reads old → new, else the net as today", () => {
  const screen = src("src/components/desk/corrigo-import.tsx");
  assert.match(screen, /if \(r\.corrigoNetChange\) items\.push\(\{ text: `Corrigo net \$\{netText\(r\.corrigoNetChange\.from\)\} → \$\{netText\(r\.corrigoNetChange\.to\)\}` \}\);/);
  assert.match(screen, /const netText = \(n: number \| null\) => \(n == null \? "none" : `\$\$\{n\.toFixed\(2\)\}`\);/);
  assert.match(screen, /else if \(r\.corrigoNet != null\) items\.push\(\{ text: `Corrigo net \$\$\{r\.corrigoNet\.toFixed\(2\)\}` \}\);/);
});
