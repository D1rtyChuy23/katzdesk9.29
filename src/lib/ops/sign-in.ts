/**
 * Password sign-in, done on the server (11/16 audit; Chuy 11/17).
 *
 * The sign-in screen used to ask the server for the email behind a username and then sign in with it from the
 * browser. That lookup needed no sign-in, so anyone could read a staff member's email. Now the browser sends the
 * username (or email) and the password; the server finds the email, checks the password, and answers with what
 * to do next. No answer or error here holds an email.
 *
 * Wrong passwords are counted per account: MAX_TRIES in WINDOW_MINUTES, then the account waits out the window.
 * Per account, not per address, because the site sits behind a proxy and every visitor shares one address. A try
 * is counted before the password is checked, so a burst sent at once can't get more than MAX_TRIES checked.
 * A good sign-in or a new password (a reset link) clears the count.
 *
 * Better Auth's own address for the same thing, POST /api/auth/sign-in/email, goes through the same count
 * (throttledEmailSignIn, used by routes/api/auth/$.ts). Otherwise someone who knows an email could guess there.
 *
 * Known and accepted: someone who knows a username can keep that account's password sign-in waiting by sending
 * wrong passwords. Signed-in sessions and Google or X sign-in are not affected, and a reset link clears it.
 */
import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { ensureAccessTables, resolveSignIn, SignInProblem } from "./access";
import { passwordSignInInput } from "./access-input";

export const MAX_TRIES = 8;
export const WINDOW_MINUTES = 15;

/** What the sign-in screen does next. Never an email. */
export type SignInOutcome = { next: "in"; waiting: boolean } | { next: "social"; methods: string[] };

/** Checks a password and, when it is right, signs the person in. True when it was right. */
export type PasswordCheck = (email: string, password: string) => Promise<boolean>;

const WRONG_PASSWORD = "That password didn't match. Check Caps Lock and try again, or tap Forgot password below.";

/** Whether this try may go ahead, and how long to wait when it may not. `tries` counts this one. */
export function tryVerdict(tries: number, windowStartMs: number, nowMs: number): { allowed: boolean; waitMinutes: number } {
  if (tries <= MAX_TRIES) return { allowed: true, waitMinutes: 0 };
  const left = windowStartMs + WINDOW_MINUTES * 60_000 - nowMs;
  return { allowed: false, waitMinutes: Math.min(WINDOW_MINUTES, Math.max(1, Math.ceil(left / 60_000))) };
}

/** Count one try against the account, in one statement, and say whether it may go ahead. */
export async function claimSignInTry(sql: Sql, userId: string): Promise<{ allowed: boolean; waitMinutes: number }> {
  const rows = await sql.query<{ tries: number; start_ms: number; now_ms: number }>(
    `insert into desk_sign_in_tries as t (user_id, tries, window_start)
     values ($1, 1, now())
     on conflict (user_id) do update set
       tries = case when t.window_start <= now() - make_interval(mins => $2::int) then 1 else t.tries + 1 end,
       window_start = case when t.window_start <= now() - make_interval(mins => $2::int) then now() else t.window_start end
     returning tries,
       (extract(epoch from window_start) * 1000)::float8 as start_ms,
       (extract(epoch from now()) * 1000)::float8 as now_ms`,
    [userId, WINDOW_MINUTES],
  );
  const row = rows[0]!;
  return tryVerdict(Number(row.tries), Number(row.start_ms), Number(row.now_ms));
}

function tooManyTries(waitMinutes: number): string {
  const wait = waitMinutes === 1 ? "1 minute" : `${waitMinutes} minutes`;
  return `Too many tries for this account. Wait ${wait} and try again, or ask a desk admin for a reset link.`;
}

export async function clearSignInTries(sql: Sql, userId: string): Promise<void> {
  await sql.query("delete from desk_sign_in_tries where user_id = $1", [userId]);
}

/**
 * The whole sign-in decision, with the password check passed in so it runs without Better Auth in tests.
 * Throws a plain sentence for an unknown username, a denied account, a wrong password or too many tries.
 */
export async function signInWithPassword(
  sql: Sql,
  input: { username: string; password: string },
  signIn: PasswordCheck,
): Promise<SignInOutcome> {
  const found = await resolveSignIn(sql, input.username);
  // A Google or X account with no password: send them to the right button instead of "wrong password".
  if (found.methods.length && !found.methods.includes("password")) return { next: "social", methods: found.methods };
  const verdict = await claimSignInTry(sql, found.userId);
  if (!verdict.allowed) throw new SignInProblem(tooManyTries(verdict.waitMinutes));
  if (!(await signIn(found.email, input.password))) throw new SignInProblem(WRONG_PASSWORD);
  if (await endIfPasswordGone(sql, found.userId)) throw new SignInProblem(WRONG_PASSWORD);
  await clearSignInTries(sql, found.userId);
  return { next: "in", waiting: found.waiting };
}

/**
 * After Better Auth has accepted a password: is that password still on the account? Sealing a shared account
 * (access.ts) removes its password and then ends its sessions. Better Auth reads the password, spends a moment
 * checking it, and only then makes the session, so a sign-in or a password change already under way could leave a
 * session behind the seal. With no password left on the account, that session and any other go, and the answer
 * is the one for a wrong password. True when it ended them.
 */
export async function endIfPasswordGone(sql: Sql, userId: string): Promise<boolean> {
  const left = await sql.query<{ id: string }>(`select "id" from "account" where "userId" = $1 and "providerId" = 'credential' limit 1`, [userId]);
  if (left[0]) return false;
  await sql.query(`delete from "session" where "userId" = $1`, [userId]);
  return true;
}

/**
 * Better Auth's answer to a wrong email or password, as opposed to something breaking. Other failures are also a
 * 401 there (a session that couldn't be made), so this goes by the code, not the status.
 */
export function isWrongPassword(err: unknown): boolean {
  const code = (err as { body?: { code?: unknown } } | null)?.body?.code;
  return code === "INVALID_EMAIL_OR_PASSWORD";
}

const DID_NOT_GO_THROUGH = "Sign-in didn't go through. Try again in a moment.";

/** What the browser is told: a sentence written for the person, or one generic line. Never a database error. */
export function plainSignInError(err: unknown): Error {
  if (err instanceof SignInProblem) return new Error(err.message);
  console.error("[sign-in] password sign-in failed:", err instanceof Error ? err.message : err);
  return new Error(DID_NOT_GO_THROUGH);
}

/**
 * True when a browser says the request came from a page on another site (or another app on the same parent
 * domain). The framework already refuses those for every server function; this keeps sign-in from depending on it.
 */
export function fromAnotherSite(headers: Headers): boolean {
  const site = headers.get("sec-fetch-site");
  return site !== null && site !== "same-origin";
}

const AUTH_BASE = "/api/auth";
const EMAIL_SIGN_IN = `${AUTH_BASE}/sign-in/email`;
const CHANGE_PASSWORD = `${AUTH_BASE}/change-password`;

/**
 * The Better Auth routes the desk calls. Nothing else is served (11/17).
 *
 * Better Auth registers some thirty more: listing and ending an account's sessions, adding and removing sign-in
 * methods, changing the name or email, reading the Google profile and broker tokens kept on an account. The desk
 * calls none of them, and two reviews each found one that undid the sealing of a shared account (access.ts):
 * /unlink-account hid that the account was shared, and /list-sessions handed the locked-out person the real
 * person's new session token. A route added by a later Better Auth version is refused until it is listed here;
 * scripts/auth-route.test.mjs checks this list against what Better Auth registers.
 */
const SERVED_AUTH_PATHS = new Set([
  `${AUTH_BASE}/get-session`, // who is signed in
  EMAIL_SIGN_IN, // password sign-in (counted per account, below)
  `${AUTH_BASE}/sign-up/email`, // new account with a password
  `${AUTH_BASE}/sign-in/oauth2`, // start a Google or X sign-in
  `${AUTH_BASE}/sign-out`,
  CHANGE_PASSWORD, // Settings
  `${AUTH_BASE}/error`, // Better Auth's page when a Google or X sign-in fails
  `${AUTH_BASE}/ok`,
]);
/** Where the broker sends someone back after Google or X. */
const OAUTH_CALLBACK = /^\/api\/auth\/oauth2\/callback\/[A-Za-z0-9_-]+$/;

/**
 * True for a route the desk serves, under its one exact spelling. Better Auth itself answers 404 to a trailing
 * slash, a doubled slash or a different case, so nothing is lost by not guessing what a spelling means.
 */
export function isServedAuthPath(pathname: string): boolean {
  return SERVED_AUTH_PATHS.has(pathname) || OAUTH_CALLBACK.test(pathname);
}

/**
 * The request without Better Auth's cookie copy of the session.
 *
 * Better Auth keeps a signed copy of the session in a cookie for five minutes and answers from it without asking
 * the database (auth/server.ts turns that on). A session ended in the database, by a seal, a reset link or a
 * sign-out elsewhere, would go on working at Better Auth's own routes until the copy ran out, and some routes
 * renew it. With the copy taken off, Better Auth looks the session up every time. The desk's own server code
 * already does (auth/fresh-session.server.ts).
 */
export async function withoutSessionCopy(request: Request): Promise<Request> {
  const cookie = request.headers.get("cookie");
  if (!cookie) return request;
  const parts = cookie.split(";");
  // Better Auth reads the copy from the cookie's own name and, when it has split a long one, from any name that
  // starts with it and a dot and ends in something it can read as a number (".0", but also ".0x" or ".a.0"). So
  // every cookie with session_data in its name goes; the desk has no other cookie like that.
  const kept = parts.filter((part) => !part.split("=")[0]!.toLowerCase().includes("session_data"));
  if (kept.length === parts.length) return request;
  const headers = new Headers(request.headers);
  if (kept.length) headers.set("cookie", kept.join(";").trim());
  else headers.delete("cookie");
  // Built from its parts, with the body read first: the server's request object is its own kind (srvx), and the
  // standard Request can't be made from one directly. Auth bodies are a few fields of JSON.
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  return new Request(request.url, { method: request.method, headers, body: hasBody ? await request.arrayBuffer() : undefined });
}

/**
 * Better Auth's password sign-in (POST /api/auth/sign-in/email), behind the same per-account count as the form.
 * `handle` is Better Auth's handler. An email nobody has, or a body that can't be read, is passed on uncounted.
 *
 * Only JSON is taken. Better Auth would read a form body too, and then the email counted here and the email it
 * signed in could differ: a form body was not counted at all, and a body written to be both named one account
 * here and another there. The desk's own pages send JSON.
 *
 * After a sign-in goes through, the account checked (endIfPasswordGone) and cleared is the one in Better Auth's
 * answer, whatever the body said.
 */
export async function throttledEmailSignIn(
  sql: Sql,
  request: Request,
  handle: (request: Request) => Promise<Response>,
): Promise<Response> {
  // Tested on the header as it came, not trimmed: JavaScript's trim() strips bytes the header rules keep, and a
  // value that only reads as JSON once trimmed is one Better Auth takes as a form. Whatever passes here starts
  // with application/json, which is what Better Auth's own JSON test asks for.
  if (!IS_JSON.test(request.headers.get("content-type") ?? "")) return Response.json({ code: "UNSUPPORTED_MEDIA_TYPE", message: "Send the sign-in as JSON." }, { status: 415 });
  let email: string | null = null;
  try {
    const body = (await request.clone().json()) as { email?: unknown } | null;
    if (typeof body?.email === "string") email = body.email.trim().toLowerCase() || null;
  } catch {
    /* not JSON: Better Auth will refuse it */
  }
  const user = email ? (await sql.query<{ id: string }>(`select "id" from "user" where lower("email") = $1 limit 1`, [email]))[0] : undefined;
  if (user) {
    const verdict = await claimSignInTry(sql, user.id);
    if (!verdict.allowed) return Response.json({ code: "TOO_MANY_TRIES", message: tooManyTries(verdict.waitMinutes) }, { status: 429 });
  }
  const response = await handle(request);
  if (!response.ok) return response;
  const signedIn = await answeredUserId(response);
  // Better Auth answers with the user. If it ever doesn't, there is no telling whose session this is: refuse it.
  if (!signedIn || (await endIfPasswordGone(sql, signedIn))) return wrongPassword();
  await clearSignInTries(sql, signedIn);
  return response;
}

const IS_JSON = /^application\/json[ \t]*(;|$)/i;

/** The id of the user in one of Better Auth's answers ({ user: { id } }), or null. */
async function answeredUserId(response: Response): Promise<string | null> {
  try {
    const id = ((await response.clone().json()) as { user?: { id?: unknown } } | null)?.user?.id;
    return typeof id === "string" && id ? id : null;
  } catch {
    return null;
  }
}

/** Better Auth's own answer to a wrong email or password. */
const wrongPassword = () => Response.json({ code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" }, { status: 401 });

/**
 * Better Auth's password change (POST /api/auth/change-password), which can also make a new session. When it went
 * through but the account has no password any more, a seal landed while it was under way: see endIfPasswordGone.
 */
export async function changedPassword(sql: Sql, response: Response): Promise<Response> {
  if (!response.ok) return response;
  const userId = await answeredUserId(response);
  // As for a sign-in: an answer with no user in it can't be checked, so it is refused.
  if (!userId) return wrongPassword();
  return (await endIfPasswordGone(sql, userId)) ? wrongPassword() : response;
}

const notServed = () => Response.json({ code: "NOT_FOUND", message: "Not found" }, { status: 404 });

/**
 * Everything routes/api/auth/$.ts does with a request. `handle` is Better Auth's handler.
 * Only the desk's routes are served, Better Auth never sees the cookie copy of a session, a password sign-in is
 * counted against its account, and neither a sign-in nor a password change leaves a session on a sealed account.
 */
export async function serveAuth(
  sqlFor: () => Promise<Sql>,
  request: Request,
  handle: (request: Request) => Promise<Response>,
): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (!isServedAuthPath(path)) return notServed();
  const asked = await withoutSessionCopy(request);
  if (request.method !== "POST") return handle(asked);
  if (path === EMAIL_SIGN_IN) return throttledEmailSignIn(await sqlFor(), asked, handle);
  if (path === CHANGE_PASSWORD) return changedPassword(await sqlFor(), await handle(asked));
  return handle(asked);
}

export const passwordSignIn = createServerFn({ method: "POST" })
  .validator(passwordSignInInput)
  .handler(async ({ data }): Promise<SignInOutcome> => {
    try {
      // Server-only modules, loaded here so they never reach the browser bundle.
      const [{ auth }, { getRequest }] = await Promise.all([import("@/lib/auth/server"), import("@tanstack/react-start/server")]);
      const request = getRequest();
      if (fromAnotherSite(request.headers)) throw new SignInProblem("Sign in from the Katz Desk sign-in page.");
      const sql = await getSql();
      await ensureAccessTables(sql);
      return await signInWithPassword(sql, data, async (email, password) => {
        try {
          // Sets the session cookie on this response (the tanstackStartCookies plugin in auth/server.ts).
          await auth.api.signInEmail({ body: { email, password }, headers: request.headers });
          return true;
        } catch (err) {
          if (isWrongPassword(err)) return false;
          throw err;
        }
      });
    } catch (err) {
      throw plainSignInError(err);
    }
  });
