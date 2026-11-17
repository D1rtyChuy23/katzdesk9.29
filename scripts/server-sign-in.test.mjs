// Sign-in happens on the server (11/16 audit, #2; Chuy 11/17: "do 2"). The sign-in screen used to ask the server for
// the email behind a username, with no sign-in needed, and then sign in with that email from the browser. Anyone
// could read a staff member's email that way. Now the browser sends the username and the password, and the server
// finds the email and checks the password itself. Nothing that comes back holds an email.
//
// Wrong passwords are counted per account, not per address (the site sits behind a proxy, so everyone shares one
// address): 8 tries in 15 minutes, then that account waits for the window to end. Made-up people throughout.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/unused";
const S = await import("../src/lib/ops/sign-in.ts");
const A = await import("../src/lib/ops/access.ts");
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

async function freshDb() {
  const pg = new PGlite({ parsers: { 20: Number, 1082: (v) => v } });
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  // What the server function runs first: the invite columns added after the first migration come from here.
  await A.ensureAccessTables(sql);
  /** A made-up person. `methods` are the ways they can sign in: "credential" is a password. */
  const person = async (id, username, email, { methods = ["credential"], approved = true, denied = false } = {}) => {
    await query(`insert into "user" ("id", "name", "email", "emailVerified") values ($1, $2, $3, false)`, [id, username, email]);
    for (const m of methods) {
      await query(`insert into "account" ("id", "accountId", "providerId", "userId", "updatedAt") values ($1, $2, $3, $2, now())`, [`${id}-${m}`, id, m]);
    }
    await query("insert into desk_accounts (user_id, username, email, approved, denied) values ($1, $2, $3, $4, $5)", [id, username, email, approved, denied]);
  };
  await person("u_sam", "sam.zz", "sam.zz@example.com");
  await person("u_pat", "pat.zz", "pat.zz@example.com");
  const tries = async (id) => (await query("select tries from desk_sign_in_tries where user_id = $1", [id]))[0]?.tries ?? 0;
  return { pg, sql, query, person, tries };
}
/** The password check, standing in for Better Auth: sam's password is "right one". It records what it was asked. */
function checker() {
  const asked = [];
  const signIn = async (email, password) => {
    asked.push(email);
    return password === "right one";
  };
  return { asked, signIn };
}
const noEmail = (value) => assert.ok(!JSON.stringify(value).includes("@"), `no email in ${JSON.stringify(value)}`);

test("the right password signs in, by username or by email, and the answer holds no email", async () => {
  const { pg, sql } = await freshDb();
  try {
    const { asked, signIn } = checker();
    const byName = await S.signInWithPassword(sql, { username: " Sam.ZZ ", password: "right one" }, signIn);
    assert.deepEqual(byName, { next: "in", waiting: false });
    const byEmail = await S.signInWithPassword(sql, { username: "SAM.zz@Example.com", password: "right one" }, signIn);
    assert.deepEqual(byEmail, { next: "in", waiting: false });
    // The password is checked against the email Better Auth holds, which the browser never sees.
    assert.deepEqual(asked, ["sam.zz@example.com", "sam.zz@example.com"]);
    noEmail(byName);
    noEmail(byEmail);
  } finally {
    await pg.close();
  }
});

test("an account still waiting for approval signs in and is told it is waiting", async () => {
  const { pg, sql, person } = await freshDb();
  try {
    await person("u_new", "new.zz", "new.zz@example.com", { approved: false });
    assert.deepEqual(await S.signInWithPassword(sql, { username: "new.zz", password: "right one" }, checker().signIn), { next: "in", waiting: true });
  } finally {
    await pg.close();
  }
});

test("a wrong password is refused in plain words and counted against that account only", async () => {
  const { pg, sql, tries } = await freshDb();
  try {
    const { signIn } = checker();
    await assert.rejects(S.signInWithPassword(sql, { username: "sam.zz", password: "nope" }, signIn), (e) => /password didn.t match/i.test(e.message) && !e.message.includes("@"));
    assert.equal(await tries("u_sam"), 1);
    assert.equal(await tries("u_pat"), 0);
  } finally {
    await pg.close();
  }
});

test("after 8 tries in 15 minutes the account waits, and even the right password isn't checked", async () => {
  const { pg, sql, query, tries } = await freshDb();
  try {
    const { asked, signIn } = checker();
    for (let i = 0; i < S.MAX_TRIES; i++) await assert.rejects(S.signInWithPassword(sql, { username: "sam.zz", password: `guess ${i}` }, signIn), /didn.t match/i);
    assert.equal(asked.length, 8);
    await assert.rejects(
      S.signInWithPassword(sql, { username: "sam.zz", password: "right one" }, signIn),
      (e) => /too many tries/i.test(e.message) && /\b1[45] minutes\b/.test(e.message) && /reset link/i.test(e.message),
    );
    assert.equal(asked.length, 8, "the password was not checked while waiting");
    // Someone else's account is untouched.
    assert.deepEqual(await S.signInWithPassword(sql, { username: "pat.zz", password: "right one" }, signIn), { next: "in", waiting: false });
    // More tries while waiting don't push the wait out: it ends 15 minutes after the first try.
    const before = (await query("select window_start from desk_sign_in_tries where user_id = 'u_sam'"))[0].window_start;
    await assert.rejects(S.signInWithPassword(sql, { username: "sam.zz", password: "again" }, signIn), /too many tries/i);
    const after = (await query("select window_start from desk_sign_in_tries where user_id = 'u_sam'"))[0].window_start;
    assert.equal(String(after), String(before));
    // When the 15 minutes are up, the count starts over.
    await query("update desk_sign_in_tries set window_start = now() - interval '16 minutes' where user_id = 'u_sam'");
    assert.deepEqual(await S.signInWithPassword(sql, { username: "sam.zz", password: "right one" }, signIn), { next: "in", waiting: false });
    assert.equal(await tries("u_sam"), 0);
  } finally {
    await pg.close();
  }
});

test("a burst of guesses at once gets no more than 8 checked", async () => {
  const { pg, sql } = await freshDb();
  try {
    const { asked, signIn } = checker();
    const results = await Promise.allSettled(Array.from({ length: 30 }, (_, i) => S.signInWithPassword(sql, { username: "sam.zz", password: `guess ${i}` }, signIn)));
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 0);
    assert.equal(asked.length, S.MAX_TRIES);
  } finally {
    await pg.close();
  }
});

test("signing in clears the count", async () => {
  const { pg, sql, tries } = await freshDb();
  try {
    const { signIn } = checker();
    for (let i = 0; i < 3; i++) await assert.rejects(S.signInWithPassword(sql, { username: "sam.zz", password: "nope" }, signIn));
    assert.equal(await tries("u_sam"), 3);
    await S.signInWithPassword(sql, { username: "sam.zz", password: "right one" }, signIn);
    assert.equal(await tries("u_sam"), 0);
  } finally {
    await pg.close();
  }
});

test("a Google or X account with no password is pointed to its button, without a password check or a count", async () => {
  const { pg, sql, person, tries } = await freshDb();
  try {
    await person("u_goo", "goo.zz", "goo.zz@example.com", { methods: ["google"] });
    const { asked, signIn } = checker();
    const out = await S.signInWithPassword(sql, { username: "goo.zz", password: "whatever" }, signIn);
    assert.deepEqual(out, { next: "social", methods: ["google"] });
    assert.equal(asked.length, 0);
    assert.equal(await tries("u_goo"), 0);
    noEmail(out);
  } finally {
    await pg.close();
  }
});

test("an unknown username, an invited one and a denied one keep their words, with no email", async () => {
  const { pg, sql, query, person } = await freshDb();
  try {
    const { asked, signIn } = checker();
    await assert.rejects(S.signInWithPassword(sql, { username: "zz.nobody", password: "x" }, signIn), /^Error: Unknown username/);
    await assert.rejects(S.signInWithPassword(sql, { username: "  ", password: "x" }, signIn), /Enter your username or email/);
    await query("insert into desk_invites (email, username, invited_by) values ('inv.zz@example.com', 'inv.zz', 'u_sam')");
    const invited = await S.signInWithPassword(sql, { username: "inv.zz", password: "x" }, signIn);
    assert.deepEqual(invited, { next: "invited" });
    noEmail(invited);
    await person("u_den", "den.zz", "den.zz@example.com", { denied: true });
    await assert.rejects(S.signInWithPassword(sql, { username: "den.zz", password: "right one" }, signIn), (e) => /denied access/i.test(e.message) && !e.message.includes("@"));
    assert.equal(asked.length, 0, "no password was checked for any of these");
  } finally {
    await pg.close();
  }
});

test("the invite peek gives back the email only to someone who typed it", async () => {
  const { pg, sql, query } = await freshDb();
  try {
    await query("insert into desk_invites (email, username, invited_by) values ('inv.zz@example.com', 'inv.zz', 'u_sam')");
    assert.deepEqual(await A.peekInviteFor(sql, "inv.zz"), { invited: true, email: null, username: "inv.zz" });
    assert.deepEqual(await A.peekInviteFor(sql, " INV.zz@example.com "), { invited: true, email: "inv.zz@example.com", username: "inv.zz" });
    assert.deepEqual(await A.peekInviteFor(sql, "zz.nobody"), { invited: false, email: null, username: null });
  } finally {
    await pg.close();
  }
});

test("a new password clears the count, so a reset link gets a locked-out person back in", async () => {
  const { pg, sql, tries } = await freshDb();
  try {
    const { signIn } = checker();
    for (let i = 0; i < S.MAX_TRIES + 1; i++) await assert.rejects(S.signInWithPassword(sql, { username: "sam.zz", password: "nope" }, signIn));
    await S.clearSignInTries(sql, "u_sam");
    assert.equal(await tries("u_sam"), 0);
    assert.match(src("src/lib/ops/password-reset.ts"), /clearSignInTries\(sql, hit\.user_id\)/);
  } finally {
    await pg.close();
  }
});

test("tryVerdict: 8 are allowed, the 9th waits out what is left of the 15 minutes", () => {
  const start = Date.UTC(2026, 10, 17, 14, 0, 0);
  assert.deepEqual(S.tryVerdict(1, start, start), { allowed: true, waitMinutes: 0 });
  assert.deepEqual(S.tryVerdict(8, start, start + 60_000), { allowed: true, waitMinutes: 0 });
  assert.deepEqual(S.tryVerdict(9, start, start), { allowed: false, waitMinutes: 15 });
  assert.deepEqual(S.tryVerdict(9, start, start + 10 * 60_000 + 1), { allowed: false, waitMinutes: 5 });
  assert.deepEqual(S.tryVerdict(40, start, start + 14 * 60_000 + 59_000), { allowed: false, waitMinutes: 1 });
});

test("only Better Auth's wrong-password answer counts as a wrong password", () => {
  assert.equal(S.isWrongPassword({ status: "UNAUTHORIZED", statusCode: 401, message: "Invalid email or password" }), true);
  assert.equal(S.isWrongPassword({ statusCode: 401 }), true);
  // Anything else is a fault, not a wrong guess: it must not read as "that password didn't match".
  assert.equal(S.isWrongPassword({ status: "INTERNAL_SERVER_ERROR", statusCode: 500 }), false);
  assert.equal(S.isWrongPassword(new Error("connection refused")), false);
  assert.equal(S.isWrongPassword(null), false);
});

test("the sign-in screen no longer asks for, or is given, anyone's email", () => {
  const access = src("src/lib/ops/access.ts");
  assert.ok(!/lookupSignIn/.test(access), "lookupSignIn is gone from access.ts");
  const login = src("src/routes/login.tsx");
  assert.ok(!/lookupSignIn/.test(login), "the login screen doesn't call lookupSignIn");
  assert.match(login, /passwordSignIn\(\{ data: \{ username: identity, password \} \}\)/);
  // The auth client only re-reads the session after its own sign-in call, so the screen has to ask it to.
  assert.match(login, /authClient\.\$store\.notify\("\$sessionSignal"\)/);
  // The only browser-side password sign-in left is on sign-up, with the email the person typed themselves.
  assert.equal((login.match(/authClient\.signIn\.email\(/g) ?? []).length, 1);
  assert.match(login, /authClient\.signIn\.email\(\{ email: mail, password \}\)/);
  // The server function's answer has no email field.
  const signIn = src("src/lib/ops/sign-in.ts");
  const outcome = signIn.slice(signIn.indexOf("export type SignInOutcome"), signIn.indexOf(";", signIn.indexOf("export type SignInOutcome")));
  assert.ok(outcome.length > 20 && !/email/i.test(outcome), "SignInOutcome has no email");
});

test("the tries table comes from a migration", () => {
  const m = src("migrations/0128_sign_in_tries.sql");
  assert.match(m, /create table if not exists desk_sign_in_tries/);
  assert.match(m, /references "user" \("id"\) on delete cascade/);
});
