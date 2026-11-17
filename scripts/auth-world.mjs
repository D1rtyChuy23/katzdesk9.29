// Test helper, not a test: the real Better Auth on an in-memory database, set up the way src/lib/auth/server.ts
// sets it up (password sign-up open, Google and X through a broker, sign-ins with the same email joined into one
// account, a five-minute cookie copy of the session, bearer tokens). The broker is faked: the "code" it hands
// back is a key into `people`. Every request goes through serveAuth, the function routes/api/auth/$.ts calls,
// so what a test sees is what the desk's auth address answers. Made-up people only.
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { PGlite } from "@electric-sql/pglite";
import { betterAuth } from "better-auth";
import { bearer, genericOAuth } from "better-auth/plugins";
import { CompiledQuery, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from "kysely";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/unused";
export const A = await import("../src/lib/ops/access.ts");
export const S = await import("../src/lib/ops/sign-in.ts");

/**
 * Better Auth's way into the in-memory database: one connection, handed out in turn. The same shape as
 * src/lib/auth/pglite-dialect.ts, which the test runner can't load (it only strips types).
 */
function pgliteDialect(pg) {
  let busy = false;
  const waiting = [];
  const connection = {
    async executeQuery(compiled) {
      const result = await pg.query(compiled.sql, [...compiled.parameters]);
      return result.affectedRows ? { numAffectedRows: BigInt(result.affectedRows), rows: result.rows } : { rows: result.rows };
    },
  };
  const driver = {
    init: async () => {},
    acquireConnection: () => {
      if (!busy) {
        busy = true;
        return Promise.resolve(connection);
      }
      return new Promise((resolve) => waiting.push(resolve));
    },
    releaseConnection: async () => {
      const next = waiting.shift();
      if (next) next(connection);
      else busy = false;
    },
    beginTransaction: (c) => c.executeQuery(CompiledQuery.raw("begin")),
    commitTransaction: (c) => c.executeQuery(CompiledQuery.raw("commit")),
    rollbackTransaction: (c) => c.executeQuery(CompiledQuery.raw("rollback")),
    destroy: async () => {},
  };
  return {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => driver,
    createQueryCompiler: () => new PostgresQueryCompiler(),
    createIntrospector: (db) => new PostgresIntrospector(db),
  };
}

export const ORIGIN = "http://localhost:8080";
export const PROVIDERS = ["grok-google", "grok-x"];

export async function authWorld() {
  const pg = new PGlite({ parsers: { 20: Number, 1082: (v) => v } });
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  await A.ensureAccessTables(sql);

  const people = {};
  const auth = betterAuth({
    baseURL: ORIGIN,
    secret: "made-up-test-secret-made-up-test-secret",
    database: { dialect: pgliteDialect(pg), type: "postgres" },
    trustedOrigins: [ORIGIN],
    account: { encryptOAuthTokens: true, accountLinking: { enabled: true, trustedProviders: PROVIDERS, requireLocalEmailVerified: false } },
    session: { cookieCache: { enabled: true, maxAge: 300 } },
    emailAndPassword: { enabled: true },
    plugins: [
      genericOAuth({
        config: PROVIDERS.map((providerId) => ({
          providerId,
          clientId: "c",
          clientSecret: "s",
          authorizationUrl: "http://broker.invalid/authorize",
          tokenUrl: "http://broker.invalid/token",
          userInfoUrl: "http://broker.invalid/userinfo",
          scopes: ["openid", "profile", "email"],
          getToken: async ({ code }) => ({ accessToken: code, tokenType: "bearer" }),
          getUserInfo: async (tokens) => people[tokens.accessToken],
        })),
      }),
      bearer(),
    ],
  });

  /** Better Auth's handler, unless a test swaps it to act in the middle of a request. */
  const world = { handle: (request) => auth.handler(request) };
  /** The desk's auth address: what routes/api/auth/$.ts does with a request. */
  const route = (request) => S.serveAuth(async () => sql, request, (r) => world.handle(r));

  /** A browser: keeps the cookies it is sent. */
  function browser() {
    const jar = new Map();
    const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    const call = async (method, path, body, extraHeaders = {}) => {
      const headers = { origin: ORIGIN, cookie: cookie(), ...extraHeaders };
      if (body) headers["content-type"] = "application/json";
      const res = await route(new Request(`${ORIGIN}/api/auth${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: "manual" }));
      for (const c of res.headers.getSetCookie()) {
        const [pair] = c.split(";");
        const i = pair.indexOf("=");
        const k = pair.slice(0, i);
        const v = pair.slice(i + 1);
        if (/max-age=0/i.test(c) || v === "") jar.delete(k);
        else jar.set(k, v);
      }
      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        /* a redirect, or nothing */
      }
      return { status: res.status, json, text, location: res.headers.get("location") };
    };
    return {
      jar,
      cookie,
      call,
      signUp: (email, password, name = "x") => call("POST", "/sign-up/email", { email, password, name }),
      signIn: (email, password) => call("POST", "/sign-in/email", { email, password }),
      /** A sign-in with Google or X: start it, then come back from the broker as `personKey`. */
      oauth: async (providerId, personKey) => {
        const start = await call("POST", "/sign-in/oauth2", { providerId, callbackURL: "/", disableRedirect: true });
        const state = new URL(start.json.url).searchParams.get("state");
        return call("GET", `/oauth2/callback/${providerId}?code=${encodeURIComponent(personKey)}&state=${encodeURIComponent(state)}`);
      },
      /** Who the desk's auth address says this browser is. */
      me: async () => (await call("GET", "/get-session")).json?.user?.id ?? null,
      /** The session token this browser holds, without its signature: what a bearer header carries. */
      token: () => decodeURIComponent(jar.get("better-auth.session_token") ?? "").split(".")[0],
    };
  }

  /** What src/lib/auth/fresh-session.server.ts does for a server function or an API route. */
  const fresh = async (headers) => (await auth.api.getSession({ headers: new Headers(headers), query: { disableCookieCache: true } }).catch(() => null))?.user?.id ?? null;

  await query(`insert into "user" ("id","name","email","emailVerified") values ('u_boss','boss','boss.zz@example.com',true)`);
  await query(`insert into "account" ("id","accountId","providerId","userId","createdAt","updatedAt") values ('a_boss','g-boss','grok-google','u_boss', now() - interval '10 hours', now())`);
  await query("insert into desk_accounts (user_id, username, email, approved, is_admin, username_chosen) values ('u_boss', 'boss.zz', 'boss.zz@example.com', true, true, true)");

  const desk = async (id) => (await query("select username, email, approved from desk_accounts where user_id = $1", [id]))[0];
  const signIns = async (id) => (await query(`select "providerId" from "account" where "userId" = $1 order by "providerId"`, [id])).map((r) => r.providerId);
  const sessions = async (id) => (await query(`select count(*)::int as n from "session" where "userId" = $1`, [id]))[0].n;

  /**
   * The setup every sealing test starts from. Pedro is invited by email. An outsider signs up first, with a
   * password, under Pedro's email and takes his username. An hour later Pedro signs in with `provider`, and
   * Better Auth joins him onto the outsider's account. Returns both browsers, the account's id and the invite's
   * token.
   */
  async function sharedAccount({ provider = "grok-google", verified = provider === "grok-google" } = {}) {
    const email = "pedro.zz@example.com";
    const inv = (await A.createDeskInvite(sql, "u_boss", { email, username: "pedro.zz" })).invite;
    const token = (await query("select token from desk_invites where id = $1", [inv.id]))[0].token;
    const outsider = browser();
    const uid = (await outsider.signUp(email, "outsider-password-1", "Outsider")).json.user.id;
    await A.ensureDeskAccount(sql, uid);
    await A.registerDeskAccount(sql, uid, { username: "pedro.zz", email, token: null });
    await query(`update "user" set "createdAt" = "createdAt" - interval '1 hour' where id = $1`, [uid]);
    await query(`update "account" set "createdAt" = "createdAt" - interval '1 hour' where "userId" = $1`, [uid]);
    people.pedro = { id: "idp-pedro", sub: "idp-pedro", email, emailVerified: verified, name: "Pedro" };
    const pedro = browser();
    await pedro.oauth(provider, "pedro");
    return { email, password: "outsider-password-1", inviteId: inv.id, token, outsider, pedro, uid };
  }

  return { pg, sql, query, auth, world, route, people, browser, fresh, desk, signIns, sessions, sharedAccount };
}
