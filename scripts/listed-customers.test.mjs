// New PMs, installs and deals go on an account from the customer list (Chuy, 11/19; Data Flow Check bug 7). Tickets
// already did (#126). The name is matched in any capitals and saved as the list spells it; a name no account has, or a
// removed account's, is refused with what to do. Made-up names only.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/katzdesk-test-unused";

const { listedAccount } = await import("../src/lib/ops/api.ts");

test("listedAccount: the list's own spelling; a name no account has, a removed one and a blank are refused", async () => {
  const pg = new PGlite();
  try {
    const dir = new URL("../migrations/", import.meta.url);
    for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
    await pg.query("insert into directory_customers (name) values ('Zz Bean Cafe'), ('Zz Gone Diner')");
    await pg.query("update directory_customers set archived = true where name = 'Zz Gone Diner'");
    const sql = { query: async (t, p) => (await pg.query(t, p)).rows };
    assert.equal(await listedAccount(sql, "  zz BEAN cafe "), "Zz Bean Cafe");
    await assert.rejects(listedAccount(sql, "Zz Bean Café Typo"), /Zz Bean Café Typo isn't on the customer list\. Pick the account, or add it on Customers first\./);
    await assert.rejects(listedAccount(sql, "Zz Gone Diner"), /isn't on the customer list/);
    await assert.rejects(listedAccount(sql, "  "), /Pick an account/);
  } finally {
    await pg.close();
  }
});

test("new PMs, installs and deals take the listed account before anything is written", () => {
  const api = readFileSync(new URL("../src/lib/ops/api.ts", import.meta.url), "utf8");
  for (const fn of ["createPm", "createDeal", "createInstall"]) {
    const at = api.indexOf(`export const ${fn} =`);
    assert.ok(at >= 0, fn);
    const body = api.slice(at, at + 1500);
    assert.match(body, /data = \{ \.\.\.data, customer: await listedAccount\(sql, data\.customer\) \};/, fn);
    assert.ok(body.indexOf("listedAccount(") < body.search(/insert into|await sql`/), `${fn} checks the name first`);
  }
});
