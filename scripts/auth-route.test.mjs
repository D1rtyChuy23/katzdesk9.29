// The desk's auth address (routes/api/auth/$.ts → serveAuth), against the real Better Auth (11/17, third review
// of the invite fix).
//
// Better Auth registers many more routes than the desk calls, and its own routes trust a five-minute cookie copy
// of the session. After a shared account was sealed (its older password and sessions removed), the person who
// was locked out could still ask /list-sessions with their old cookies and be handed the real person's new
// session token. So:
//   - only the routes the desk calls are served; everything else answers 404;
//   - the cookie copy is taken off every request before Better Auth sees it, so each one is checked against the
//     database;
//   - a password sign-in or a password change that finishes after the account's password was removed leaves no
//     session behind.
// Made-up people throughout.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { A, S, ORIGIN, authWorld } from "./auth-world.mjs";

const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

/** The routes the desk calls, as Better Auth names them. */
const SERVED = ["/get-session", "/sign-in/email", "/sign-up/email", "/sign-in/oauth2", "/oauth2/callback/:providerId", "/sign-out", "/change-password", "/error", "/ok"];

test("only the routes the desk calls are served; every other route Better Auth registers is refused", async () => {
  const w = await authWorld();
  try {
    const registered = [...new Set(Object.values(w.auth.api).map((e) => e?.path).filter((p) => typeof p === "string"))];
    assert.ok(registered.length > 20, `Better Auth registers its routes (${registered.length})`);
    for (const path of SERVED) assert.ok(registered.includes(path), `${path} is a route Better Auth has`);
    const refused = [];
    for (const path of registered) {
      const real = `/api/auth${path.replace(/:[a-zA-Z]+/g, "grok-google").replace(/\*+/g, "x")}`;
      assert.equal(S.isServedAuthPath(real), SERVED.includes(path), real);
      if (!SERVED.includes(path)) refused.push(real);
    }
    // The ones that mattered: they list, end or alter sessions and sign-in methods from a cookie copy.
    for (const must of ["/list-sessions", "/update-user", "/update-session", "/list-accounts", "/revoke-session", "/revoke-sessions", "/revoke-other-sessions", "/unlink-account", "/link-social", "/oauth2/link", "/account-info", "/get-access-token", "/refresh-token", "/delete-user", "/change-email"]) {
      assert.ok(refused.includes(`/api/auth${must}`), `${must} is refused`);
    }
    // Refused without Better Auth being asked, for GET and for POST.
    let asked = 0;
    w.world.handle = async (request) => {
      asked += 1;
      return w.auth.handler(request);
    };
    for (const method of ["GET", "POST"]) {
      for (const real of refused) {
        const res = await w.route(new Request(ORIGIN + real, { method, headers: { origin: ORIGIN } }));
        assert.equal(res.status, 404, `${method} ${real}`);
      }
    }
    assert.equal(asked, 0);
  } finally {
    await w.pg.close();
  }
});

test("a served route is served under its one exact spelling", () => {
  for (const path of ["/api/auth/get-session", "/api/auth/sign-in/email", "/api/auth/sign-up/email", "/api/auth/sign-in/oauth2", "/api/auth/oauth2/callback/grok-google", "/api/auth/oauth2/callback/grok-x", "/api/auth/sign-out", "/api/auth/change-password", "/api/auth/error", "/api/auth/ok"]) {
    assert.equal(S.isServedAuthPath(path), true, path);
  }
  for (const path of [
    "/api/auth/get-session/",
    "/api/auth//get-session",
    "/API/auth/get-session",
    "/api/auth/Get-Session",
    "/api/auth/get%2Dsession",
    "/api/auth/get-session/list-sessions",
    "/api/auth/oauth2/callback",
    "/api/auth/oauth2/callback/",
    "/api/auth/oauth2/callback/grok-google/x",
    "/api/auth/oauth2/callback/..",
    "/api/auth/oauth2/link",
    "/api/auth/list-sessions",
    "/api/auth/",
    "/api/auth",
    "/api/auth/%",
    "/get-session",
  ]) {
    assert.equal(S.isServedAuthPath(path), false, path);
  }
});

test("the cookie copy of a session is taken off a request; everything else on it is kept", async () => {
  const strip = async (cookie) => (await S.withoutSessionCopy(new Request(`${ORIGIN}/api/auth/get-session`, { headers: cookie === null ? {} : { cookie } }))).headers.get("cookie");
  assert.equal(await strip("__Host-grok-auth.session_token=tok.sig; __Host-grok-auth.session_data=abc"), "__Host-grok-auth.session_token=tok.sig");
  assert.equal(await strip("better-auth.session_data=abc; better-auth.session_token=tok.sig; other=1"), "better-auth.session_token=tok.sig; other=1");
  assert.equal(await strip("__Host-grok-auth.session_data.0=a; __Host-grok-auth.session_data.1=b; __Host-grok-auth.session_token=t"), "__Host-grok-auth.session_token=t");
  assert.equal(await strip("__Host-grok-auth.session_data=abc"), null);
  // Better Auth also reads the copy from any name that starts with the cookie's name and a dot and ends in
  // something it can read as a number. Whatever holds "session_data" goes.
  for (const tail of [".0x", ".a.0", ".0.", ".1e", ".-1", ".+0", ".00"]) {
    assert.equal(await strip(`__Host-grok-auth.session_data${tail}=abc; keep=1`), "keep=1", tail);
    assert.equal(await strip(`better-auth.session_data${tail}=abc; keep=1`), "keep=1", tail);
  }
  assert.equal(await strip("x.SESSION_DATA.0=abc; keep=1"), "keep=1");
  assert.equal(await strip("__Host-grok-auth.session_token=tok.sig"), "__Host-grok-auth.session_token=tok.sig");
  assert.equal(await strip(null), null);
  // A request with nothing to take off is passed on as it is; one with a body keeps its body and its method.
  const plain = new Request(`${ORIGIN}/api/auth/get-session`, { headers: { cookie: "a=1" } });
  assert.equal(await S.withoutSessionCopy(plain), plain);
  const post = await S.withoutSessionCopy(
    new Request(`${ORIGIN}/api/auth/sign-in/email?x=1`, { method: "POST", headers: { cookie: "better-auth.session_data=abc", "content-type": "application/json", origin: ORIGIN }, body: JSON.stringify({ email: "a.zz@example.com" }) }),
  );
  assert.equal(post.method, "POST");
  assert.equal(post.url, `${ORIGIN}/api/auth/sign-in/email?x=1`);
  assert.equal(post.headers.get("origin"), ORIGIN);
  assert.deepEqual(await post.json(), { email: "a.zz@example.com" });
  // The server hands routes its own kind of request, which the standard Request can't be copied from. One that
  // only looks like a request is rebuilt all the same.
  const lookalike = { url: `${ORIGIN}/api/auth/sign-out`, method: "POST", headers: new Headers({ cookie: "better-auth.session_data=abc; t=1", "content-type": "application/json" }), arrayBuffer: async () => new TextEncoder().encode("{}").buffer };
  const rebuilt = await S.withoutSessionCopy(lookalike);
  assert.ok(rebuilt instanceof Request);
  assert.equal(rebuilt.headers.get("cookie"), "t=1");
  assert.equal(await rebuilt.text(), "{}");
});

test("the route file hands every request to serveAuth and nothing else", () => {
  const route = src("src/routes/api/auth/$.ts");
  assert.match(route, /GET: \(\{ request \}\) => serveAuth\(getSql, request, \(r\) => auth\.handler\(r\)\)/);
  assert.match(route, /POST: \(\{ request \}\) => serveAuth\(getSql, request, \(r\) => auth\.handler\(r\)\)/);
  assert.equal((route.match(/auth\.handler\(/g) ?? []).length, 2, "Better Auth's handler is reached only through serveAuth");
  // This file's Better Auth is set up like the desk's in the ways these tests depend on.
  const server = src("src/lib/auth/server.ts");
  assert.match(server, /session: \{ cookieCache: \{ enabled: true, maxAge: 300 \} \}/);
  assert.match(server, /requireLocalEmailVerified: false/);
  assert.match(server, /trustedProviders: GROK_PROVIDERS\.map/);
  assert.match(server, /bearer\(\)/);
});

test("signing up, signing in with a password, changing it and signing out still work through the route", async () => {
  const w = await authWorld();
  try {
    const b = w.browser();
    const up = await b.signUp("ana.zz@example.com", "first-password-1", "Ana");
    assert.equal(up.status, 200);
    const uid = up.json.user.id;
    assert.equal(await b.me(), uid);
    assert.equal((await b.call("POST", "/sign-out", {})).status, 200);
    assert.equal(await b.me(), null);
    assert.equal((await b.signIn("ana.zz@example.com", "wrong-password")).status, 401);
    assert.equal((await b.signIn("ana.zz@example.com", "first-password-1")).status, 200);
    assert.equal(await b.me(), uid);
    const changed = await b.call("POST", "/change-password", { currentPassword: "first-password-1", newPassword: "second-password-2", revokeOtherSessions: true });
    assert.equal(changed.status, 200);
    assert.equal(await b.me(), uid, "still signed in after changing the password");
    assert.equal(await w.fresh({ cookie: b.cookie() }), uid);
    const again = w.browser();
    assert.equal((await again.signIn("ana.zz@example.com", "first-password-1")).status, 401);
    assert.equal((await again.signIn("ana.zz@example.com", "second-password-2")).status, 200);
    // A bearer token (the live preview) is still read.
    assert.equal((await w.browser().call("GET", "/get-session", null, { authorization: `Bearer ${again.token()}` })).json?.user?.id, uid);
  } finally {
    await w.pg.close();
  }
});

test("signing in with Google or X through the broker still works through the route", async () => {
  const w = await authWorld();
  try {
    w.people.gina = { id: "idp-gina", sub: "idp-gina", email: "gina.zz@example.com", emailVerified: true, name: "Gina" };
    w.people.xavi = { id: "idp-xavi", sub: "idp-xavi", email: "xavi.zz@x.invalid", emailVerified: false, name: "Xavi" };
    const g = w.browser();
    const back = await g.oauth("grok-google", "gina");
    assert.equal(back.status, 302);
    const gid = await g.me();
    assert.ok(gid);
    assert.deepEqual(await w.signIns(gid), ["grok-google"]);
    const x = w.browser();
    await x.oauth("grok-x", "xavi");
    const xid = await x.me();
    assert.ok(xid && xid !== gid);
    assert.deepEqual(await w.signIns(xid), ["grok-x"]);
    // Coming back a second time is the same person, not a new account.
    const g2 = w.browser();
    await g2.oauth("grok-google", "gina");
    assert.equal(await g2.me(), gid);
  } finally {
    await w.pg.close();
  }
});

for (const how of ["the invite link", "an admin's approval"]) {
  test(`after ${how} seals a shared account, the old cookies get nothing from the auth address`, async () => {
    const w = await authWorld();
    try {
      const { email, password, token, uid } = await w.sharedAccount();
      // The outsider signs in a moment before, so their cookie copy is as new as it can be.
      const o = w.browser();
      assert.equal((await o.signIn(email, password)).status, 200);
      assert.equal(await o.me(), uid);
      const copy = [...o.jar].find(([k]) => k.endsWith("session_data"));
      const tokenCookie = [...o.jar].find(([k]) => k.endsWith("session_token"));
      assert.ok(copy && tokenCookie, "the outsider holds a session cookie and its copy");

      if (how === "the invite link") assert.equal(await A.claimInviteToken(w.sql, uid, token), true);
      else assert.equal((await A.approveDeskAccount(w.sql, uid, true)).passwordRemoved, true);
      assert.equal((await w.desk(uid)).approved, true);
      assert.deepEqual(await w.signIns(uid), ["grok-google"]);
      assert.equal(await w.sessions(uid), 0);

      // Pedro was signed out with everyone else, so he signs in with Google again.
      const pedro = w.browser();
      await pedro.oauth("grok-google", "pedro");
      assert.equal(await pedro.me(), uid);
      assert.equal(await w.sessions(uid), 1);

      // The outsider, old cookies and all.
      assert.equal(await o.me(), null, "the session read asks the database, not the cookie copy");
      // The copy under the other names Better Auth would read it from.
      for (const tail of [".0x", ".a.0", ".+0"]) {
        const renamed = await o.call("GET", "/get-session", null, { cookie: `${tokenCookie[0]}=${tokenCookie[1]}; ${copy[0]}${tail}=${copy[1]}` });
        assert.equal(renamed.json, null, `the copy renamed ${copy[0]}${tail}`);
      }
      const listed = await o.call("GET", "/list-sessions");
      assert.equal(listed.status, 404);
      assert.ok(!listed.text.includes(pedro.token()), "Pedro's session token is not handed out");
      assert.equal((await o.call("POST", "/update-user", { name: "still here" })).status, 404);
      assert.equal((await o.call("POST", "/revoke-other-sessions", {})).status, 404);
      assert.equal((await o.call("POST", "/change-password", { currentPassword: password, newPassword: "outsider-password-2", revokeOtherSessions: true })).status, 401);
      assert.equal((await o.signIn(email, password)).status, 401);
      assert.equal(await w.fresh({ cookie: o.cookie() }), null);
      assert.equal(await w.sessions(uid), 1, "only Pedro's session is left");
      assert.equal(await pedro.me(), uid, "and Pedro is still in");
    } finally {
      await w.pg.close();
    }
  });
}

test("a password sign-in that finishes after the account was sealed leaves no session", async () => {
  const w = await authWorld();
  try {
    const { email, password, token, uid } = await w.sharedAccount();
    // Better Auth has read the password row and checked the password. The seal runs now, start to finish: the
    // password, the reset links and every session go. Then Better Auth writes its session.
    let sealed = 0;
    w.world.beforeQuery = async (text) => {
      if (sealed || !/^insert into "session"/i.test(text)) return;
      sealed += 1;
      assert.equal(await A.claimInviteToken(w.sql, uid, token), true);
      assert.equal(await w.sessions(uid), 0);
    };
    const o = w.browser();
    const res = await o.signIn(email, password);
    assert.equal(sealed, 1, "the seal ran in the middle of the sign-in");
    assert.equal(res.status, 401);
    assert.equal(res.json?.code, "INVALID_EMAIL_OR_PASSWORD");
    assert.ok(!res.text.includes("token"), "no session token in the answer");
    assert.equal(await w.sessions(uid), 0);
    assert.equal(await w.fresh({ cookie: o.cookie() }), null);
    assert.equal((await w.desk(uid)).approved, true);
  } finally {
    await w.pg.close();
  }
});

test("a password sign-in is taken as JSON only, so the account it is counted and checked against is the one signed in", async () => {
  const w = await authWorld();
  try {
    // Better Auth would also read a form body. The desk's count and its late check read JSON, so a form body went
    // past both; and a body that is JSON and a form at once named one account to the desk and another to Better
    // Auth, which let anyone with an account sign out a member who has no password.
    w.people.gina = { id: "idp-gina", sub: "idp-gina", email: "gina.zz@example.com", emailVerified: true, name: "Gina" };
    const gina = w.browser();
    await gina.oauth("grok-google", "gina");
    const gid = await gina.me();
    const mallory = w.browser();
    const mid = (await mallory.signUp("mallory.zz@example.com", "mallory-password-1", "Mallory")).json.user.id;
    await mallory.call("POST", "/sign-out", {});
    let asked = 0;
    w.world.handle = async (request) => {
      asked += 1;
      return w.auth.handler(request);
    };
    const plain = await w.browser().form("/sign-in/email", "email=mallory.zz%40example.com&password=mallory-password-1");
    assert.equal(plain.status, 415);
    const both = await w.browser().form("/sign-in/email", JSON.stringify({ email: "gina.zz@example.com", x: "&email=mallory.zz%40example.com&password=mallory-password-1&y=" }));
    assert.equal(both.status, 415);
    const none = await w.route(new Request(`${ORIGIN}/api/auth/sign-in/email`, { method: "POST", headers: { origin: ORIGIN }, body: JSON.stringify({ email: "mallory.zz@example.com", password: "mallory-password-1" }) }));
    assert.equal(none.status, 415, "no content type, or text/plain");
    // A content type that reads as JSON once trimmed but that Better Auth takes as a form: a leading byte that
    // JavaScript's trim() strips and the header rules don't, with a form type after a comma.
    for (const type of ["\u00a0application/json;, application/x-www-form-urlencoded", "application/json, application/x-www-form-urlencoded", "application/jsonx", "application/ld+json", "text/json"]) {
      const sly = await w.route(new Request(`${ORIGIN}/api/auth/sign-in/email`, { method: "POST", headers: { origin: ORIGIN, "content-type": type }, body: "email=mallory.zz%40example.com&password=mallory-password-1" }));
      assert.equal(sly.status, 415, JSON.stringify(type));
    }
    assert.equal(asked, 0, "Better Auth never saw them");
    assert.equal(await w.sessions(mid), 0);
    assert.equal(await w.sessions(gid), 1);
    assert.equal(await gina.me(), gid, "Gina is still signed in");
    // JSON, with or without a charset, is what the desk sends.
    const ok = await w.route(new Request(`${ORIGIN}/api/auth/sign-in/email`, { method: "POST", headers: { origin: ORIGIN, "content-type": "Application/JSON; charset=utf-8" }, body: JSON.stringify({ email: "mallory.zz@example.com", password: "mallory-password-1" }) }));
    assert.equal(ok.status, 200);
    // And guessing at Gina, who has no password, costs her nothing.
    assert.equal((await w.browser().signIn("gina.zz@example.com", "mallory-password-1")).status, 401);
    assert.equal(await gina.me(), gid);
  } finally {
    await w.pg.close();
  }
});

test("a password sign-in racing the seal for real leaves no session either way", async () => {
  for (const headStartMs of [0, 5, 20, 40]) {
    const w = await authWorld();
    try {
      const { email, password, token, uid } = await w.sharedAccount();
      const o = w.browser();
      const signingIn = o.signIn(email, password);
      await new Promise((r) => setTimeout(r, headStartMs));
      assert.equal(await A.claimInviteToken(w.sql, uid, token), true);
      await signingIn;
      assert.equal(await w.sessions(uid), 0, `sign-in started ${headStartMs} ms before the seal`);
      assert.equal(await w.fresh({ cookie: o.cookie() }), null);
    } finally {
      await w.pg.close();
    }
  }
});

test("a password change that finishes after the account was sealed leaves no session", async () => {
  const w = await authWorld();
  try {
    const { email, password, token, uid } = await w.sharedAccount();
    const o = w.browser();
    assert.equal((await o.signIn(email, password)).status, 200);
    w.world.handle = async (request) => {
      const res = await w.auth.handler(request);
      if (new URL(request.url).pathname.endsWith("/change-password")) {
        // The seal: the password row and every session go, then Better Auth's new session is written after it.
        await w.query(`delete from "account" where "userId" = $1 and "providerId" = 'credential'`, [uid]);
      }
      return res;
    };
    const res = await o.call("POST", "/change-password", { currentPassword: password, newPassword: "outsider-password-2", revokeOtherSessions: true });
    assert.equal(res.status, 401);
    assert.equal(await w.sessions(uid), 0);
    assert.equal(await w.fresh({ cookie: o.cookie() }), null);
    w.world.handle = (request) => w.auth.handler(request);
    assert.equal(await A.claimInviteToken(w.sql, uid, token), true);
    assert.equal((await o.signIn(email, "outsider-password-2")).status, 401);
  } finally {
    await w.pg.close();
  }
});
