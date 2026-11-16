// Quick fixes from the 11/16 pass (Chuy: "Go"): the public sign-in lookups are limited per address, an open tab hears
// about a new version, a wrong address gets a real page, three silent saves say when they fail, and fields and icon
// buttons carry names a screen reader can say. Made-up data only.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/unused";
const limit = await import("../src/lib/ops/lookup-limit.ts");
const { newerBuildLive } = await import("../src/lib/ops/version-notice.ts");
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

async function freshDb() {
  const pg = new PGlite({ parsers: { 20: Number } });
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  const query = async (text, params) => (await pg.query(text, params)).rows;
  return { pg, sql: { query }, query };
}

test("the sign-in lookups allow a normal number of tries from one address, then refuse until the window passes", async () => {
  const { pg, sql, query } = await freshDb();
  try {
    assert.deepEqual([limit.LOOKUP_LIMIT, limit.LOOKUP_WINDOW_MINUTES], [60, 10]);
    for (let i = 0; i < limit.LOOKUP_LIMIT; i += 1) assert.equal(await limit.lookupAllowed(sql, "hash-a"), true, `try ${i + 1}`);
    assert.equal(await limit.lookupAllowed(sql, "hash-a"), false, "one past the limit");
    assert.equal(await limit.lookupAllowed(sql, "hash-a"), false, "a refused try isn't counted, and stays refused");
    assert.equal((await query("select count(*)::int as n from sign_in_lookups where ip_hash = 'hash-a'"))[0].n, limit.LOOKUP_LIMIT);
    // Another address has its own count.
    assert.equal(await limit.lookupAllowed(sql, "hash-b"), true);
    // Tries older than the window don't count, and day-old rows are cleared.
    await query("update sign_in_lookups set at = now() - interval '11 minutes' where ip_hash = 'hash-a'");
    assert.equal(await limit.lookupAllowed(sql, "hash-a"), true);
    await query("update sign_in_lookups set at = now() - interval '2 days' where ip_hash = 'hash-b'");
    await limit.lookupAllowed(sql, "hash-a");
    assert.equal((await query("select count(*)::int as n from sign_in_lookups where ip_hash = 'hash-b'"))[0].n, 0);
  } finally {
    await pg.close();
  }
});

test("the limiter never blocks sign-in by failing: no address, or a database error, lets the lookup through", async () => {
  assert.equal(await limit.lookupAllowed({ query: async () => [] }, null), true, "no address to count");
  assert.equal(
    await limit.lookupAllowed({ query: async () => { throw new Error("relation sign_in_lookups does not exist"); } }, "hash-a"),
    true,
  );
  assert.equal(limit.clientAddress(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" })), "203.0.113.9");
  assert.equal(limit.clientAddress(new Headers({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1" })), "203.0.113.7");
  assert.equal(limit.clientAddress(new Headers({})), null);
  assert.match(await limit.addressHash("203.0.113.9"), /^[0-9a-f]{64}$/);
  assert.equal(limit.TOO_MANY_LOOKUPS, "Too many tries. Wait a few minutes, then try again.");
});

test("each public lookup checks the limit before it reads an account", () => {
  const access = src("src/lib/ops/access.ts");
  for (const name of ["checkUsername", "lookupSignIn", "peekInvite"]) {
    const body = access.slice(access.indexOf(`export const ${name} = createServerFn`));
    const handler = body.slice(0, body.indexOf("export const ", 10));
    assert.match(handler, /await assertLookupAllowed\(sql\);/, name);
    assert.ok(handler.indexOf("await assertLookupAllowed(sql);") < handler.search(/sql\.query|findPendingInvite\(/), `${name}: the limit comes first`);
  }
  assert.match(src("migrations/0128_sign_in_lookups.sql"), /create table if not exists sign_in_lookups/);
});

test("a new version is announced only when both builds are real commits and they differ", () => {
  const a = "a8114b208ed78cc0df55e73f14f75d31cf13309e";
  const b = "27f43b86fbb3401f459158e0688466237a7250dd";
  assert.equal(newerBuildLive(a, b), true);
  assert.equal(newerBuildLive(a, a), false);
  assert.equal(newerBuildLive(a, a.slice(0, 7)), false, "a short and a full sha of one commit");
  for (const [mine, live] of [["dev", b], [a, "dev"], [a, "unknown"], ["unknown", b], [a, ""], [a, null], [a, undefined]]) assert.equal(newerBuildLive(mine, live), false, `${mine} / ${live}`);
  const notice = src("src/components/desk/version-notice.tsx");
  assert.match(notice, /A new version of KatzDesk is live\./);
  assert.match(notice, /onClick=\{\(\) => window\.location\.reload\(\)\}/);
  assert.match(notice, /meta: \{ quietErrors: true \}/);
  assert.match(src("src/routes/_app.tsx"), /<VersionNotice \/>/);
});

test("a wrong address gets a page with a way back", () => {
  assert.match(src("src/router.tsx"), /defaultNotFoundComponent: AppNotFoundComponent/);
  const page = src("src/lib/error-component.tsx");
  assert.match(page, /export function AppNotFoundComponent\(\)/);
  assert.match(page, /Page Not Found/);
  assert.match(page, /href="\/"/);
});

test("fields and icon buttons carry a name a screen reader can say", () => {
  const planner = src("src/components/desk/rebuild-planner.tsx");
  assert.match(planner, /aria-label="Previous week"/);
  assert.match(planner, /aria-label="Next week"/);
  assert.match(planner, /aria-label="Health"/);
  assert.match(planner, /aria-label=\{`Target date for \$\{r\.title\}`\}/);
  const charges = src("src/components/desk/charges-panel.tsx");
  assert.match(charges, /aria-label=\{`Quantity, line \$\{i \+ 1\}`\}/);
  assert.match(charges, /aria-label=\{`Rate, line \$\{i \+ 1\}`\}/);
  assert.match(src("src/components/desk/reps-editor.tsx"), /aria-label="Rep's full name"/);
});

test("the three saves that failed silently now say so", () => {
  const admin = src("src/components/desk/library-admin.tsx");
  assert.match(admin, /onError: \(e\) => fail\(e, "Could not save that as done"\)/);
  assert.match(admin, /onError: \(e\) => fail\(e, "Could not save the section's open state"\)/);
  assert.match(src("src/components/desk/notify-bell.tsx"), /onError: \(e\) => toast\.error\(e instanceof Error \? e\.message : "Could not mark that as read"\)/);
});
