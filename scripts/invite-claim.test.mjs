// An invite can only be taken by the person it was meant for (Chuy, 11/17: "go").
//
// Sign-up is open, and the server used to approve anyone whose username OR email matched a pending invite. The
// email it compared was the one the browser sent. So someone who guessed a pending invite's username or email got
// approved desk access. Now a match alone opens nothing. Access comes from:
//   - the invite link (its token), or
//   - a Google sign-in whose email is the invite's email, on an account Google itself created, or
//   - an admin approving the waiting account on the Access page.
// An account that started with a password and had Google joined to it later is shared with whoever set that
// password. When such an account is let in, by the link or by an admin, the older password and every open
// session go first. Made-up people throughout.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/unused";
const A = await import("../src/lib/ops/access.ts");
const S = await import("../src/lib/ops/sign-in.ts");
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

async function freshDb() {
  const pg = new PGlite({ parsers: { 20: Number, 1082: (v) => v } });
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  await A.ensureAccessTables(sql);
  /**
   * A Better Auth user. `how` lists [provider, minutes ago] pairs, oldest first: "credential" is a password. The
   * user row is as old as its first sign-in method. `verified` is Better Auth's emailVerified: Google sets it,
   * both when it creates the user and when it is joined to one whose email matches; a password and X don't.
   */
  const signedUp = async (id, email, how = [["credential", 0]], { verified = how.some(([p]) => p === "grok-google") } = {}) => {
    const born = Math.max(...how.map(([, m]) => m));
    await query(`insert into "user" ("id", "name", "email", "emailVerified", "createdAt") values ($1, $1, $2, $3, now() - make_interval(secs => $4::float8 * 60))`, [id, email, verified, born]);
    for (const [provider, minutesAgo] of how) {
      await query(
        `insert into "account" ("id", "accountId", "providerId", "userId", "createdAt", "updatedAt") values ($1, $2, $3, $2, now() - make_interval(secs => $4::float8 * 60), now())`,
        [`${id}-${provider}`, id, provider, minutesAgo],
      );
    }
  };
  // The desk already has its admin, so the first-admin rule is out of the picture.
  await signedUp("u_boss", "boss.zz@example.com", [["grok-google", 600]]);
  await query("insert into desk_accounts (user_id, username, email, approved, is_admin, username_chosen) values ('u_boss', 'boss.zz', 'boss.zz@example.com', true, true, true)");
  const invite = async (fields) => (await A.createDeskInvite(sql, "u_boss", fields)).invite;
  const account = async (id) => (await query("select username, email, approved, can_add_customers, desk_role from desk_accounts where user_id = $1", [id]))[0];
  const signIns = async (id) => (await query(`select "providerId" from "account" where "userId" = $1 order by "providerId"`, [id])).map((r) => r.providerId);
  const session = async (id) => query(`insert into "session" ("id", "expiresAt", "token", "updatedAt", "userId") values ($1, now() + interval '7 days', $1, now(), $2)`, [`s-${id}-${Math.random()}`, id]);
  const sessions = async (id) => (await query(`select count(*)::int as n from "session" where "userId" = $1`, [id]))[0].n;
  const inviteStatus = async (id) => (await query("select status, accepted_user_id from desk_invites where id = $1", [id]))[0];
  return { pg, sql, query, signedUp, invite, account, inviteStatus, signIns, session, sessions };
}

test("an outsider who picks an invited username at sign-up is not approved", async () => {
  const { pg, sql, signedUp, invite, account, inviteStatus } = await freshDb();
  try {
    const inv = await invite({ username: "pedro.zz" });
    await signedUp("u_out", "outsider.zz@example.com");
    const access = await A.registerDeskAccount(sql, "u_out", { username: "pedro.zz", email: "outsider.zz@example.com", token: null });
    assert.equal(access.approved, false);
    assert.equal((await account("u_out")).approved, false);
    assert.equal((await inviteStatus(inv.id)).status, "pending");
  } finally {
    await pg.close();
  }
});

test("sending an invited email along with the sign-up form opens nothing, and is not stored as the account's email", async () => {
  const { pg, sql, signedUp, invite, account, inviteStatus } = await freshDb();
  try {
    const inv = await invite({ email: "pedro.zz@example.com" });
    await signedUp("u_out", "outsider.zz@example.com");
    const access = await A.registerDeskAccount(sql, "u_out", { username: "outsider.zz", email: "pedro.zz@example.com", token: null });
    assert.equal(access.approved, false);
    assert.equal((await account("u_out")).email, "outsider.zz@example.com");
    assert.equal((await inviteStatus(inv.id)).status, "pending");
  } finally {
    await pg.close();
  }
});

test("a password sign-up with the invited email itself waits for approval: nobody has shown the address is theirs", async () => {
  const { pg, sql, signedUp, invite, account, inviteStatus } = await freshDb();
  try {
    const inv = await invite({ email: "pedro.zz@example.com", username: "pedro.zz" });
    await signedUp("u_claim", "pedro.zz@example.com");
    assert.equal((await A.ensureDeskAccount(sql, "u_claim")).approved, false);
    assert.equal((await A.registerDeskAccount(sql, "u_claim", { username: "pedro.zz", email: "pedro.zz@example.com", token: null })).approved, false);
    // Looking at the desk again changes nothing.
    assert.equal((await A.ensureDeskAccount(sql, "u_claim")).approved, false);
    assert.equal((await account("u_claim")).approved, false);
    assert.equal((await inviteStatus(inv.id)).status, "pending");
  } finally {
    await pg.close();
  }
});

test("a Google sign-in with the invited email gets straight in, with what the invite grants", async () => {
  const { pg, sql, signedUp, invite, account, inviteStatus } = await freshDb();
  try {
    const inv = await invite({ email: "Pedro.ZZ@example.com", username: "pedro.zz", canAddCustomers: true });
    await signedUp("u_pedro", "pedro.zz@example.com", [["grok-google", 0]]);
    assert.equal((await A.ensureDeskAccount(sql, "u_pedro")).approved, true);
    const row = await account("u_pedro");
    assert.equal(row.approved, true);
    assert.equal(row.can_add_customers, true);
    assert.deepEqual(await inviteStatus(inv.id), { status: "accepted", accepted_user_id: "u_pedro" });
  } finally {
    await pg.close();
  }
});

test("Google with a different email does not take an invite by its username; X never does", async () => {
  const { pg, sql, signedUp, invite, inviteStatus } = await freshDb();
  try {
    const inv = await invite({ email: "pedro.zz@example.com", username: "pedro.zz" });
    await signedUp("u_other", "other.zz@example.com", [["grok-google", 0]]);
    assert.equal((await A.registerDeskAccount(sql, "u_other", { username: "pedro.zz", email: null, token: null })).approved, false);
    // X hands over a made-up address, so it proves nothing even when it matches.
    await signedUp("u_x", "pedro.zz@example.com", [["grok-x", 0]]);
    assert.equal((await A.ensureDeskAccount(sql, "u_x")).approved, false);
    assert.equal((await inviteStatus(inv.id)).status, "pending");
  } finally {
    await pg.close();
  }
});

test("the invite link gets its holder in, whatever email they signed up with", async () => {
  const { pg, sql, query, signedUp, invite, account, inviteStatus } = await freshDb();
  try {
    const inv = await invite({ email: "pedro.zz@example.com", username: "pedro.zz" });
    const token = (await query("select token from desk_invites where id = $1", [inv.id]))[0].token;
    await signedUp("u_link", "pedro.personal.zz@example.com");
    const access = await A.registerDeskAccount(sql, "u_link", { username: "pedro.zz", email: "pedro.personal.zz@example.com", token });
    assert.equal(access.approved, true);
    assert.deepEqual(await inviteStatus(inv.id), { status: "accepted", accepted_user_id: "u_link" });
    // The same link, claimed after signing in (the Google and X path).
    const inv2 = await invite({ username: "sam.zz" });
    const token2 = (await query("select token from desk_invites where id = $1", [inv2.id]))[0].token;
    await signedUp("u_sam", "made.up.zz@x.example.com", [["grok-x", 0]]);
    await A.ensureDeskAccount(sql, "u_sam");
    assert.equal(await A.claimInviteToken(sql, "u_sam", token2), true);
    assert.equal((await account("u_sam")).approved, true);
    // A used link opens nothing for the next person.
    await signedUp("u_late", "late.zz@example.com");
    await A.ensureDeskAccount(sql, "u_late");
    assert.equal(await A.claimInviteToken(sql, "u_late", token2), false);
    assert.equal((await account("u_late")).approved, false);
  } finally {
    await pg.close();
  }
});

test("an expired invite is not taken by a matching Google email", async () => {
  const { pg, sql, query, signedUp, invite, inviteStatus } = await freshDb();
  try {
    const inv = await invite({ email: "pedro.zz@example.com" });
    await query("update desk_invites set expires_at = now() - interval '1 day' where id = $1", [inv.id]);
    await signedUp("u_pedro", "pedro.zz@example.com", [["grok-google", 0]]);
    assert.equal((await A.ensureDeskAccount(sql, "u_pedro")).approved, false);
    assert.equal((await inviteStatus(inv.id)).status, "pending");
  } finally {
    await pg.close();
  }
});

test("Google joined onto an account that began with a password proves nothing, whatever happens to the password after", async () => {
  const { pg, sql, query, signedUp, invite } = await freshDb();
  try {
    await invite({ email: "pedro.zz@example.com" });
    // Someone signed up with Pedro's address and a password of their own; later Pedro's Google sign-in was joined
    // to that same account, and Better Auth marked the email verified.
    await signedUp("u_shared", "pedro.zz@example.com", [["credential", 120], ["grok-google", 5]], { verified: true });
    assert.equal((await A.ensureDeskAccount(sql, "u_shared")).approved, false);
    // Better Auth lets a signed-in person remove their own password. That must not turn the account into Pedro's.
    await query(`delete from "account" where "userId" = 'u_shared' and "providerId" = 'credential'`);
    assert.equal((await A.ensureDeskAccount(sql, "u_shared")).approved, false);
    assert.equal((await A.registerDeskAccount(sql, "u_shared", { username: "pedro.zz", email: null, token: null })).approved, false);
    // The other way round is fine: Google made the account, a password came later (a reset link does that).
    await invite({ email: "ana.zz@example.com" });
    await signedUp("u_ana", "ana.zz@example.com", [["grok-google", 120], ["credential", 5]]);
    assert.equal((await A.ensureDeskAccount(sql, "u_ana")).approved, true);
  } finally {
    await pg.close();
  }
});

test("a Google row is not enough: the email must be marked verified, and X then Google doesn't count", async () => {
  const { pg, sql, signedUp, invite } = await freshDb();
  try {
    await invite({ email: "pedro.zz@example.com" });
    await signedUp("u_unverified", "pedro.zz@example.com", [["grok-google", 0]], { verified: false });
    assert.equal((await A.ensureDeskAccount(sql, "u_unverified")).approved, false);
    await invite({ email: "sam.zz@example.com" });
    await signedUp("u_x_first", "sam.zz@example.com", [["grok-x", 60], ["grok-google", 5]], { verified: true });
    assert.equal((await A.ensureDeskAccount(sql, "u_x_first")).approved, false);
  } finally {
    await pg.close();
  }
});

test("Google landing a moment after a password sign-up is still a join, not Google's own account", async () => {
  const { pg, sql, signedUp, invite } = await freshDb();
  try {
    await invite({ email: "pedro.zz@example.com" });
    // One second apart: inside any sensible "same moment" window, but the password row is the older one.
    await signedUp("u_race", "pedro.zz@example.com", [["credential", 1 / 60], ["grok-google", 0]], { verified: true });
    assert.equal((await A.ensureDeskAccount(sql, "u_race")).approved, false);
    // And Google three seconds after the user row, with nothing older, is not "created by Google" either.
    await invite({ email: "sam.zz@example.com" });
    await signedUp("u_late", "sam.zz@example.com", [["grok-google", 0]], { verified: true });
    await sql.query(`update "user" set "createdAt" = now() - interval '3 seconds' where id = 'u_late'`);
    assert.equal((await A.ensureDeskAccount(sql, "u_late")).approved, false);
  } finally {
    await pg.close();
  }
});

test("letting a shared account in by the link removes the older password and signs everyone out", async () => {
  const { pg, sql, query, signedUp, invite, account, signIns, session, sessions } = await freshDb();
  try {
    const inv = await invite({ email: "pedro.zz@example.com", username: "pedro.zz" });
    const token = (await query("select token from desk_invites where id = $1", [inv.id]))[0].token;
    // The squat: a password on Pedro's address, then Pedro's Google joined to it when he opened his link.
    await signedUp("u_shared", "pedro.zz@example.com", [["credential", 120], ["grok-google", 1]], { verified: true });
    await A.ensureDeskAccount(sql, "u_shared");
    await session("u_shared");
    await session("u_shared");
    assert.equal(await A.claimInviteToken(sql, "u_shared", token), true);
    assert.equal((await account("u_shared")).approved, true);
    assert.deepEqual(await signIns("u_shared"), ["grok-google"]);
    assert.equal(await sessions("u_shared"), 0);
    // Same when the link is used while choosing a username, and when the password was already removed by its owner.
    const inv2 = await invite({ email: "ana.zz@example.com" });
    const token2 = (await query("select token from desk_invites where id = $1", [inv2.id]))[0].token;
    await signedUp("u_shared2", "ana.zz@example.com", [["credential", 120], ["grok-google", 1]], { verified: true });
    await query(`delete from "account" where "userId" = 'u_shared2' and "providerId" = 'credential'`);
    await session("u_shared2");
    assert.equal((await A.registerDeskAccount(sql, "u_shared2", { username: "ana.zz", email: null, token: token2 })).approved, true);
    assert.equal(await sessions("u_shared2"), 0);
  } finally {
    await pg.close();
  }
});

test("removing the Google sign-in again doesn't keep a shared account from being sealed", async () => {
  const { pg, sql, query, signedUp, invite, account, signIns, session, sessions } = await freshDb();
  try {
    // Joined, then whoever holds the password removed the Google row. Better Auth has marked the email verified,
    // and that mark stays: it is how the account is still known to be shared.
    const inv = await invite({ username: "pedro.zz" });
    const token = (await query("select token from desk_invites where id = $1", [inv.id]))[0].token;
    await signedUp("u_shared", "pedro.zz@example.com", [["credential", 120]], { verified: true });
    await A.ensureDeskAccount(sql, "u_shared");
    await session("u_shared");
    assert.equal(await A.claimInviteToken(sql, "u_shared", token), true);
    assert.deepEqual(await signIns("u_shared"), []);
    assert.equal(await sessions("u_shared"), 0);
    // The same through an admin's approval, which says the password went.
    await signedUp("u_shared2", "ana.zz@example.com", [["credential", 120]], { verified: true });
    await A.registerDeskAccount(sql, "u_shared2", { username: "ana.zz", email: null, token: null });
    await session("u_shared2");
    const access = await A.approveDeskAccount(sql, "u_shared2", true);
    assert.equal(access.approved, true);
    assert.equal(access.passwordRemoved, true);
    assert.deepEqual(await signIns("u_shared2"), []);
    assert.equal(await sessions("u_shared2"), 0);
    assert.equal((await account("u_shared2")).approved, true);
  } finally {
    await pg.close();
  }
});

test("sealing removes a password as old as the Google sign-in or older, and keeps one set after it", async () => {
  const { pg, sql, signedUp, signIns, session, sessions } = await freshDb();
  try {
    // Same instant: not newer, so it goes.
    await signedUp("u_same", "same.zz@example.com", [["grok-x", 60], ["credential", 30], ["grok-google", 30]], { verified: true });
    await A.registerDeskAccount(sql, "u_same", { username: "same.zz", email: null, token: null });
    assert.equal((await A.approveDeskAccount(sql, "u_same", true)).passwordRemoved, true);
    assert.deepEqual(await signIns("u_same"), ["grok-google", "grok-x"]);
    // Set after Google was joined (only an admin's reset link can do that): it stays, but everyone is signed out.
    await signedUp("u_newer", "newer.zz@example.com", [["grok-x", 60], ["grok-google", 30], ["credential", 5]], { verified: true });
    await A.registerDeskAccount(sql, "u_newer", { username: "newer.zz", email: null, token: null });
    await session("u_newer");
    assert.equal((await A.approveDeskAccount(sql, "u_newer", true)).passwordRemoved, false);
    assert.deepEqual(await signIns("u_newer"), ["credential", "grok-google", "grok-x"]);
    assert.equal(await sessions("u_newer"), 0);
  } finally {
    await pg.close();
  }
});

test("someone already let in is never sealed: not by a second approval, not by opening an old link", async () => {
  const { pg, sql, query, signedUp, signIns, session, sessions } = await freshDb();
  try {
    // A long-standing member who began with a password and added Google later.
    await signedUp("u_member", "member.zz@example.com", [["credential", 9000], ["grok-google", 600]], { verified: true });
    await query("insert into desk_accounts (user_id, username, email, approved, username_chosen) values ('u_member', 'member.zz', 'member.zz@example.com', true, true)");
    await session("u_member");
    assert.equal((await A.approveDeskAccount(sql, "u_member", true)).passwordRemoved, false);
    // An old link in their own name, as a row: the invite form won't make one for someone who already has access.
    await query("insert into desk_invites (username, invited_by, token, expires_at) values ('member.zz', 'u_boss', 'tok-own', now() + interval '7 days')");
    assert.equal(await A.claimInviteToken(sql, "u_member", "tok-own"), true);
    await A.registerDeskAccount(sql, "u_member", { username: "member.zz", email: null, token: null });
    assert.deepEqual(await signIns("u_member"), ["credential", "grok-google"]);
    assert.equal(await sessions("u_member"), 1);
  } finally {
    await pg.close();
  }
});

test("an account that is not shared keeps its password and its session when it is let in", async () => {
  const { pg, sql, query, signedUp, invite, signIns, session, sessions } = await freshDb();
  try {
    // The ordinary case: the invited person opens the link and makes a password.
    const inv = await invite({ username: "pedro.zz" });
    const token = (await query("select token from desk_invites where id = $1", [inv.id]))[0].token;
    await signedUp("u_pedro", "pedro.zz@example.com");
    await session("u_pedro");
    assert.equal((await A.registerDeskAccount(sql, "u_pedro", { username: "pedro.zz", email: null, token })).approved, true);
    assert.deepEqual(await signIns("u_pedro"), ["credential"]);
    assert.equal(await sessions("u_pedro"), 1);
    // Google made the account and a password came later: both stay.
    const inv2 = await invite({ username: "ana.zz" });
    const token2 = (await query("select token from desk_invites where id = $1", [inv2.id]))[0].token;
    await signedUp("u_ana", "ana.personal.zz@example.com", [["grok-google", 120], ["credential", 5]]);
    await A.ensureDeskAccount(sql, "u_ana");
    await session("u_ana");
    assert.equal(await A.claimInviteToken(sql, "u_ana", token2), true);
    assert.deepEqual(await signIns("u_ana"), ["credential", "grok-google"]);
    assert.equal(await sessions("u_ana"), 1);
  } finally {
    await pg.close();
  }
});

test("an invite made for someone already waiting approves them only when Google vouches; otherwise the admin is told who is waiting", async () => {
  const { pg, sql, query, signedUp, account } = await freshDb();
  try {
    // Waiting, signed up with a password under the name the admin is about to invite.
    await signedUp("u_squat", "squat.zz@example.com");
    await A.registerDeskAccount(sql, "u_squat", { username: "pedro.zz", email: "squat.zz@example.com", token: null });
    // Waiting, signed in with Google under the email the admin is about to invite.
    await signedUp("u_ana", "ana.zz@example.com", [["grok-google", 0]]);
    await A.ensureDeskAccount(sql, "u_ana");
    const byName = await A.createDeskInvite(sql, "u_boss", { username: "pedro.zz" });
    assert.deepEqual(byName.autoApproved, []);
    assert.deepEqual(byName.alreadyWaiting, ["pedro.zz"]);
    assert.equal(byName.invite.status, "pending");
    assert.equal((await account("u_squat")).approved, false);
    const byEmail = await A.createDeskInvite(sql, "u_boss", { email: "ana.zz@example.com" });
    assert.equal(byEmail.autoApproved.length, 1);
    assert.deepEqual(byEmail.alreadyWaiting, []);
    assert.equal((await account("u_ana")).approved, true);
    // Saving the same invite again still says who is waiting.
    assert.deepEqual((await A.createDeskInvite(sql, "u_boss", { username: "pedro.zz" })).alreadyWaiting, ["pedro.zz"]);
    // Someone the desk denied is not "waiting".
    await signedUp("u_den", "den.zz@example.com");
    await A.registerDeskAccount(sql, "u_den", { username: "den.zz", email: null, token: null });
    await query("update desk_accounts set denied = true where user_id = 'u_den'");
    assert.deepEqual((await A.createDeskInvite(sql, "u_boss", { username: "den.zz" })).alreadyWaiting, []);
  } finally {
    await pg.close();
  }
});

test("the Access page's sweep of pending invites follows the same rule", async () => {
  const { pg, sql, query, signedUp, account } = await freshDb();
  try {
    await signedUp("u_squat", "squat.zz@example.com");
    await A.registerDeskAccount(sql, "u_squat", { username: "pedro.zz", email: "squat.zz@example.com", token: null });
    await signedUp("u_ana", "ana.zz@example.com", [["grok-google", 0]]);
    await A.ensureDeskAccount(sql, "u_ana");
    // Invites as rows, the way an older build left them: matching accounts already exist.
    await query("insert into desk_invites (email, username, invited_by, token, expires_at) values (null, 'pedro.zz', 'u_boss', 'tok-a', now() + interval '7 days'), ('ana.zz@example.com', null, 'u_boss', 'tok-b', now() + interval '7 days')");
    // An expired invite to a Google-confirmed person who is waiting: the sweep leaves them waiting.
    await signedUp("u_exp", "exp.zz@example.com", [["grok-google", 0]]);
    await A.ensureDeskAccount(sql, "u_exp");
    await query("insert into desk_invites (email, invited_by, token, expires_at) values ('exp.zz@example.com', 'u_boss', 'tok-c', now() - interval '1 day')");
    await A.applyPendingInvites(sql);
    assert.equal((await account("u_squat")).approved, false);
    assert.equal((await account("u_ana")).approved, true);
    assert.equal((await account("u_exp")).approved, false);
  } finally {
    await pg.close();
  }
});

test("an admin approving a waiting account uses up the invite sent to their email, and only that one", async () => {
  const { pg, sql, query, signedUp, invite, account, inviteStatus } = await freshDb();
  try {
    const inv = await invite({ email: "pedro.zz@example.com", username: "pedro.zz" });
    const other = await invite({ username: "sam.zz" });
    // An expired invite to the same address, as an older build could leave behind.
    const old = (await query("insert into desk_invites (email, invited_by, token, expires_at) values ('pedro.zz@example.com', 'u_boss', 'tok-old', now() - interval '1 day') returning id"))[0];
    await signedUp("u_pedro", "pedro.zz@example.com");
    await A.registerDeskAccount(sql, "u_pedro", { username: "pedro.zz", email: null, token: null });
    assert.equal((await account("u_pedro")).approved, false);
    const access = await A.approveDeskAccount(sql, "u_pedro", true);
    assert.equal(access.approved, true);
    assert.equal(access.passwordRemoved, false);
    assert.deepEqual(await inviteStatus(inv.id), { status: "accepted", accepted_user_id: "u_pedro" });
    assert.equal((await inviteStatus(other.id)).status, "pending");
    assert.equal((await inviteStatus(old.id)).status, "pending", "an expired invite is not used up");
    // Taking access away again leaves invites alone.
    assert.equal((await A.approveDeskAccount(sql, "u_pedro", false)).approved, false);
    // A name is self-chosen. Approving someone who only took the invited name leaves the invite, and its link,
    // for the person it was sent to.
    await signedUp("u_squat", "squat.zz@example.com");
    await A.registerDeskAccount(sql, "u_squat", { username: "sam.zz", email: null, token: null });
    await A.approveDeskAccount(sql, "u_squat", true);
    assert.equal((await inviteStatus(other.id)).status, "pending");
  } finally {
    await pg.close();
  }
});

test("an admin approving a shared account removes the older password and signs everyone out", async () => {
  const { pg, sql, signedUp, account, signIns, session, sessions } = await freshDb();
  try {
    await signedUp("u_shared", "pedro.zz@example.com", [["credential", 120], ["grok-google", 1]], { verified: true });
    await A.registerDeskAccount(sql, "u_shared", { username: "pedro.zz", email: null, token: null });
    await session("u_shared");
    await A.approveDeskAccount(sql, "u_shared", true);
    assert.equal((await account("u_shared")).approved, true);
    assert.deepEqual(await signIns("u_shared"), ["grok-google"]);
    assert.equal(await sessions("u_shared"), 0);
  } finally {
    await pg.close();
  }
});

test("with no admin yet, the first person to reach the desk still becomes its admin", async () => {
  const { pg, sql, query, signedUp } = await freshDb();
  try {
    await query("delete from desk_accounts");
    await signedUp("u_first", "first.zz@example.com");
    const access = await A.registerDeskAccount(sql, "u_first", { username: "first.zz", email: null, token: null });
    assert.equal(access.approved, true);
    assert.equal(access.isAdmin, true);
  } finally {
    await pg.close();
  }
});

test("denying someone who only took an invited name or typed an invited email leaves the invite for its owner", async () => {
  const { pg, sql, query, signedUp, invite, account, inviteStatus } = await freshDb();
  try {
    const inv = await invite({ email: "pedro.zz@example.com", username: "pedro.zz" });
    await signedUp("u_fake", "pedro.zz@example.com");
    await A.registerDeskAccount(sql, "u_fake", { username: "pedro.zz", email: null, token: null });
    const denied = await A.denyDeskAccount(sql, "u_fake");
    assert.equal(denied.denied, true);
    assert.equal((await inviteStatus(inv.id)).status, "pending");
    // The link still lets the real person in, under another name.
    const token = (await query("select token from desk_invites where id = $1", [inv.id]))[0].token;
    await signedUp("u_real", "pedro.personal.zz@example.com");
    assert.equal((await A.registerDeskAccount(sql, "u_real", { username: "pedro.real.zz", email: null, token })).approved, true);
    // Denying a person Google vouches for does revoke the invite sent to their address.
    const inv2 = await invite({ email: "ana.zz@example.com" });
    await query("update desk_invites set expires_at = now() - interval '1 day' where id = $1", [inv2.id]);
    await signedUp("u_ana", "ana.zz@example.com", [["grok-google", 0]]);
    await A.ensureDeskAccount(sql, "u_ana");
    await query("update desk_invites set expires_at = now() + interval '7 days' where id = $1", [inv2.id]);
    await A.denyDeskAccount(sql, "u_ana");
    assert.equal((await inviteStatus(inv2.id)).status, "revoked");
    assert.equal((await account("u_ana")).approved, false);
  } finally {
    await pg.close();
  }
});

test("the account-joining and token routes Better Auth offers are refused; the ones the app uses are not", () => {
  for (const path of ["/api/auth/unlink-account", "/api/auth/link-social", "/api/auth/oauth2/link", "/api/auth/account-info", "/api/auth/get-access-token", "/api/auth/refresh-token", "/api/auth/Unlink-Account/", "/api/auth//unlink-account", "/api/auth/unlink%2Daccount"]) {
    assert.equal(S.isRefusedAuthPath(path), true, path);
  }
  for (const path of ["/api/auth/sign-in/email", "/api/auth/sign-up/email", "/api/auth/get-session", "/api/auth/sign-out", "/api/auth/sign-in/oauth2", "/api/auth/oauth2/callback/grok-google", "/api/auth/list-accounts-zz", "/api/auth/%"]) {
    assert.equal(S.isRefusedAuthPath(path), false, path);
  }
  const route = src("src/routes/api/auth/$.ts");
  assert.equal((route.match(/isRefusedAuthPath\(/g) ?? []).length >= 2, true, "checked for GET and for POST");
});

test("the server's own session check never trusts the five-minute cookie copy", () => {
  // Sealing an account, a password reset and a sign-out all end sessions in the database. The signed cookie copy
  // of a session stays readable for five minutes, so every server-side check asks the database.
  const files = ["src/lib/auth/verify.server.ts", "src/routes/api/admin/tickets-in-window.ts", "src/routes/api/admin/parts-export.ts", "src/routes/api/ticket-photo/$id.ts", "src/routes/api/part-photo-source/$id.ts"];
  for (const f of files) assert.ok(!/auth\.api\.getSession\(/.test(src(f)), `${f} goes through freshSession`);
  assert.match(src("src/lib/auth/fresh-session.server.ts"), /auth\.api\.getSession\(\{ headers, query: \{ disableCookieCache: true \} \}\)/);
});

test("the admin's list shows the email Better Auth holds, and whether Google confirmed it", async () => {
  const { pg, sql, query, signedUp } = await freshDb();
  try {
    // An account from before this fix: the desk row carries an email the person typed into the form.
    await signedUp("u_spoof", "outsider.zz@example.com");
    await query("insert into desk_accounts (user_id, username, email, approved, username_chosen) values ('u_spoof', 'pedro.zz', 'pedro.zz@example.com', false, true)");
    await signedUp("u_ana", "ana.zz@example.com", [["grok-google", 0]]);
    await A.ensureDeskAccount(sql, "u_ana");
    await signedUp("u_x", "made.up.zz@x.example.com", [["grok-x", 0]]);
    await A.ensureDeskAccount(sql, "u_x");
    const rows = Object.fromEntries((await A.listDeskAccountRows(sql)).map((r) => [r.userId, r]));
    assert.equal(rows.u_spoof.email, "outsider.zz@example.com");
    assert.equal(rows.u_spoof.emailConfirmed, false);
    assert.equal(rows.u_ana.email, "ana.zz@example.com");
    assert.equal(rows.u_ana.emailConfirmed, true);
    assert.equal(rows.u_x.emailConfirmed, false);
    assert.equal(rows.u_boss.emailConfirmed, true);
    // Someone waiting under an invited name or email who didn't come through the link is pointed out.
    assert.equal(rows.u_spoof.matchesInvite, null);
    await A.createDeskInvite(sql, "u_boss", { username: "pedro.zz" });
    await A.createDeskInvite(sql, "u_boss", { email: "outsider.zz@example.com" });
    const again = Object.fromEntries((await A.listDeskAccountRows(sql)).map((r) => [r.userId, r]));
    assert.equal(again.u_spoof.matchesInvite, "outsider.zz@example.com");
    assert.equal(again.u_spoof.matchesInviteBy, "email");
    assert.equal(again.u_boss.matchesInvite, null);
    // A Google-confirmed person waiting under an invited NAME: the impostor case, and the warning must still show.
    await signedUp("u_named", "named.zz@example.com", [["grok-google", 0]]);
    await A.registerDeskAccount(sql, "u_named", { username: "sam.zz", email: null, token: null });
    await A.createDeskInvite(sql, "u_boss", { username: "sam.zz" });
    const named = Object.fromEntries((await A.listDeskAccountRows(sql)).map((r) => [r.userId, r])).u_named;
    assert.equal(named.emailConfirmed, true);
    assert.equal(named.matchesInvite, "sam.zz");
    assert.equal(named.matchesInviteBy, "name");
    const pageNow = src("src/routes/_app/access.tsx");
    assert.match(pageNow, /a\.matchesInvite \? \(/);
    assert.ok(!/a\.matchesInvite && !a\.emailConfirmed/.test(pageNow), "the warning doesn't depend on the email being unconfirmed");
    // The Access page says so next to each person who is waiting.
    const page = src("src/routes/_app/access.tsx");
    assert.match(page, /emailConfirmed \? "Google confirmed this email" : "email not confirmed"/);
  } finally {
    await pg.close();
  }
});

test("nothing public says whether a name or an email has a pending invite", () => {
  const access = src("src/lib/ops/access.ts");
  assert.ok(!/peekInvite/.test(access), "peekInvite is gone");
  assert.ok(!/applyInviteIfAny/.test(access), "applyInviteIfAny is gone");
  assert.ok(!/accountsForInvite/.test(access), "accountsForInvite is gone");
  // The lookups by typed name or email left: a denied person's re-invite at sign-in, and the admin's duplicate check.
  const uses = [...access.matchAll(/findPendingInvite\(sql, ([^)]*)\)/g)].map((m) => m[1]);
  assert.deepEqual(uses.sort(), ["email, user", "emailNorm ?? raw, userNorm"]);
  const login = src("src/routes/login.tsx");
  assert.ok(!/peekInvite/.test(login), "the sign-in screen doesn't ask");
  assert.ok(!/next === "invited"/.test(login));
  assert.ok(!/"invited"/.test(src("src/lib/ops/sign-in.ts")), "sign-in has no invited answer");
});

test("an invited name that has no account reads as unknown, like any other", async () => {
  const { pg, sql, invite } = await freshDb();
  try {
    await invite({ email: "pedro.zz@example.com", username: "pedro.zz" });
    for (const typed of ["pedro.zz", "pedro.zz@example.com", "zz.nobody"]) {
      await assert.rejects(A.resolveSignIn(sql, typed), (e) => e instanceof A.SignInProblem && e.message === "Unknown username.");
    }
  } finally {
    await pg.close();
  }
});
