// An invite can only be taken by the person it was meant for (Chuy, 11/17: "go").
//
// Sign-up is open, and the server used to approve anyone whose username OR email matched a pending invite. The
// email it compared was the one the browser sent. So someone who guessed a pending invite's username or email got
// approved desk access. Now a match alone opens nothing. Access comes from:
//   - the invite link (its token), or
//   - a Google sign-in whose email is the invite's email (Google vouches for the address), or
//   - an admin approving the waiting account on the Access page.
// Made-up people throughout.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/unused";
const A = await import("../src/lib/ops/access.ts");
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

async function freshDb() {
  const pg = new PGlite({ parsers: { 20: Number, 1082: (v) => v } });
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  await A.ensureAccessTables(sql);
  /** A Better Auth user, the way sign-up leaves it. `how` lists [provider, minutes ago] pairs: "credential" is a password. */
  const signedUp = async (id, email, how = [["credential", 0]]) => {
    await query(`insert into "user" ("id", "name", "email", "emailVerified") values ($1, $1, $2, false)`, [id, email]);
    for (const [provider, minutesAgo] of how) {
      await query(
        `insert into "account" ("id", "accountId", "providerId", "userId", "createdAt", "updatedAt") values ($1, $2, $3, $2, now() - make_interval(mins => $4::int), now())`,
        [`${id}-${provider}`, id, provider, minutesAgo],
      );
    }
  };
  // The desk already has its admin, so the first-admin rule is out of the picture.
  await signedUp("u_boss", "boss.zz@example.com", [["grok-google", 600]]);
  await query("insert into desk_accounts (user_id, username, email, approved, is_admin, username_chosen) values ('u_boss', 'boss.zz', 'boss.zz@example.com', true, true, true)");
  const invite = async (fields) => (await A.createDeskInvite(sql, "u_boss", fields)).invite;
  const account = async (id) => (await query("select username, email, approved, can_add_customers, desk_role from desk_accounts where user_id = $1", [id]))[0];
  const inviteStatus = async (id) => (await query("select status, accepted_user_id from desk_invites where id = $1", [id]))[0];
  return { pg, sql, query, signedUp, invite, account, inviteStatus };
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

test("a password that was on the account before Google vouched for the email keeps it out", async () => {
  const { pg, sql, signedUp, invite } = await freshDb();
  try {
    await invite({ email: "pedro.zz@example.com" });
    // Someone signed up with Pedro's address and a password of their own; later Pedro's Google sign-in was joined
    // to that same account. Whoever set the password can still use it, so the match is not trusted.
    await signedUp("u_shared", "pedro.zz@example.com", [["credential", 120], ["grok-google", 5]]);
    assert.equal((await A.ensureDeskAccount(sql, "u_shared")).approved, false);
    // The other way round is fine: Google first, a password added later (a reset link does that).
    await invite({ email: "ana.zz@example.com" });
    await signedUp("u_ana", "ana.zz@example.com", [["grok-google", 120], ["credential", 5]]);
    assert.equal((await A.ensureDeskAccount(sql, "u_ana")).approved, true);
  } finally {
    await pg.close();
  }
});

test("an invite made for someone already waiting approves them only when Google vouches; otherwise the admin is told who is waiting", async () => {
  const { pg, sql, signedUp, account } = await freshDb();
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
    await A.applyPendingInvites(sql);
    assert.equal((await account("u_squat")).approved, false);
    assert.equal((await account("u_ana")).approved, true);
  } finally {
    await pg.close();
  }
});

test("an admin approving a waiting account uses up the invite that was meant for them", async () => {
  const { pg, sql, signedUp, invite, account, inviteStatus } = await freshDb();
  try {
    const inv = await invite({ email: "pedro.zz@example.com", username: "pedro.zz" });
    const other = await invite({ username: "sam.zz" });
    await signedUp("u_pedro", "pedro.zz@example.com");
    await A.registerDeskAccount(sql, "u_pedro", { username: "pedro.zz", email: "pedro.zz@example.com", token: null });
    assert.equal((await account("u_pedro")).approved, false);
    const access = await A.approveDeskAccount(sql, "u_pedro", true);
    assert.equal(access.approved, true);
    assert.deepEqual(await inviteStatus(inv.id), { status: "accepted", accepted_user_id: "u_pedro" });
    assert.equal((await inviteStatus(other.id)).status, "pending");
    // Taking access away again leaves invites alone.
    assert.equal((await A.approveDeskAccount(sql, "u_pedro", false)).approved, false);
  } finally {
    await pg.close();
  }
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
    // The Access page says so next to each person who is waiting.
    const page = src("src/routes/_app/access.tsx");
    assert.match(page, /emailConfirmed \? "Google confirmed this email" : "email not confirmed"/);
  } finally {
    await pg.close();
  }
});

test("no path matches an invite by a self-chosen name or a typed email any more", () => {
  const access = src("src/lib/ops/access.ts");
  // The only lookups by typed name or email left are the sign-in screen's hints and the admin's own duplicate check.
  const uses = [...access.matchAll(/findPendingInvite\(sql, ([^)]*)\)/g)].map((m) => m[1]);
  assert.deepEqual(uses.sort(), ["email, user", "emailNorm ?? raw, userNorm", "emailNorm ?? raw, userNorm", "emailNorm ?? raw, userNorm"].sort());
  assert.ok(!/applyInviteIfAny/.test(access), "applyInviteIfAny is gone");
  assert.ok(!/accountsForInvite/.test(access), "accountsForInvite is gone");
});
