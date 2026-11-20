import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

// Chuy, 11/20: the Admin desk role also manages accounts (sign-ups, access, invites, password resets) and gets
// Warehouse's alerts. Only an owner-flag admin can take away another owner-flag admin's access.

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const { requireAdmin, requireCanChangeAccount } = await import("../src/lib/ops/access.ts");
const { notifyAdminsRackReview } = await import("../src/lib/ops/notify.ts");
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

async function db() {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  const people = [
    ["u-owner", "zz.owner", true, true, null],
    ["u-role", "zz.roleadmin", true, false, "admin"],
    ["u-wait", "zz.waiting", false, false, "admin"],
    ["u-svc", "zz.service", true, false, "service"],
    ["u-wh", "zz.warehouse", true, false, "warehouse"],
  ];
  for (const [id, name, approved, flag, role] of people) {
    await pg.query("insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ($1, $2, $3, $4, $5)", [id, name, approved, flag, role]);
  }
  return { pg, sql: { query: async (t, p) => (await pg.query(t, p)).rows } };
}

test("requireAdmin: the owner flag or an approved Admin role; not a waiting Admin or another role", async () => {
  const { pg, sql } = await db();
  try {
    await requireAdmin(sql, "u-owner");
    await requireAdmin(sql, "u-role");
    await assert.rejects(requireAdmin(sql, "u-wait"), /Only an admin can review accounts\./);
    await assert.rejects(requireAdmin(sql, "u-svc"), /Only an admin can review accounts\./);
    await assert.rejects(requireAdmin(sql, "u-wh", "custom no"), /custom no/);
    await assert.rejects(requireAdmin(sql, "u-nobody"), /Only an admin/);
  } finally {
    await pg.close();
  }
});

test("an Admin-role person can't change an owner-flag admin's access; the owner flag can", async () => {
  const { pg, sql } = await db();
  try {
    await requireCanChangeAccount(sql, "u-role", "u-svc");
    await requireCanChangeAccount(sql, "u-owner", "u-role");
    await requireCanChangeAccount(sql, "u-owner", "u-owner");
    await assert.rejects(requireCanChangeAccount(sql, "u-role", "u-owner"), /Only the desk owner can change an owner admin's access\./);
  } finally {
    await pg.close();
  }
});

test("Warehouse's rack alert reaches the Admin role as well as the owner flag", async () => {
  const { pg, sql } = await db();
  try {
    await notifyAdminsRackReview(sql, "u-wh", { id: 7, model: "Zz Grinder", serial: "ZZ1", slot: "Barn A1" });
    const got = (await pg.query("select user_id from desk_notifications order by user_id")).rows.map((r) => r.user_id);
    assert.deepEqual(got, ["u-owner", "u-role"]);
  } finally {
    await pg.close();
  }
});

test("every Warehouse alert uses the one admin rule, and the account calls check the target", () => {
  const notify = src("src/lib/ops/notify.ts");
  assert.doesNotMatch(notify, /if \(!flagOn\(admin\.is_admin\) \|\| !flagOn\(admin\.approved\)\) continue;/);
  assert.equal((notify.match(/if \(!isAdminAccount\(admin\) \|\| !flagOn\(admin\.approved\)\) continue;/g) ?? []).length, 4);
  const access = src("src/lib/ops/access.ts");
  for (const fn of ["setAccountApproved", "denyAccount"]) {
    const body = access.slice(access.indexOf(`export const ${fn} `), access.indexOf("});", access.indexOf(`export const ${fn} `)));
    assert.match(body, /await requireCanChangeAccount\(sql, context\.userId, data\.userId\);/, fn);
  }
  assert.match(src("src/lib/ops/password-reset.ts"), /await requireCanChangeAccount\(sql, context\.userId, data\.userId\);/);
  // Roles stay with the desk owner.
  assert.match(access, /Only the desk owner can set a user’s role\./);
});

test("the Access page and its menu item show for the Admin role", () => {
  const page = src("src/routes/_app/access.tsx");
  assert.doesNotMatch(page, /me\.data\?\.isAdmin/);
  assert.doesNotMatch(page, /!me\.data\.isAdmin/);
  assert.match(page, /isDeskAdmin\(me\.data\)/);
  assert.match(src("src/lib/ops/side-menu.ts"), /\{ to: "\/access", label: "Access", admin: true \}/);
});
