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
  await clearSignInTries(sql, found.userId);
  return { next: "in", waiting: found.waiting };
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

/** An auth path as Better Auth would read it: decoded, single slashes, no trailing slash, lower case. */
function authPath(pathname: string): string | null {
  try {
    return decodeURIComponent(pathname).replace(/\/{2,}/g, "/").replace(/\/$/, "").toLowerCase();
  } catch {
    return null;
  }
}

/** Better Auth's own password sign-in address, however the path is spelled. */
export function isEmailSignInPath(pathname: string): boolean {
  return authPath(pathname) === "/api/auth/sign-in/email";
}

/**
 * Better Auth routes KatzDesk never calls and doesn't serve (11/17). The first three let a signed-in person add
 * or remove sign-in methods on an account; taking a Google sign-in off an account someone else also holds is
 * how a shared account could be made to look like one person's. The last three hand out the Google name, picture
 * and broker tokens stored on an account.
 */
const REFUSED_AUTH_PATHS = new Set([
  "/api/auth/unlink-account",
  "/api/auth/link-social",
  "/api/auth/oauth2/link",
  "/api/auth/account-info",
  "/api/auth/get-access-token",
  "/api/auth/refresh-token",
]);

export function isRefusedAuthPath(pathname: string): boolean {
  const path = authPath(pathname);
  return path !== null && REFUSED_AUTH_PATHS.has(path);
}

/**
 * Better Auth's password sign-in (POST /api/auth/sign-in/email), behind the same per-account count as the form.
 * `handle` is Better Auth's handler. An email nobody has, or a body that can't be read, is passed on uncounted.
 */
export async function throttledEmailSignIn(
  sql: Sql,
  request: Request,
  handle: (request: Request) => Promise<Response>,
): Promise<Response> {
  let email: string | null = null;
  try {
    const body = (await request.clone().json()) as { email?: unknown } | null;
    if (typeof body?.email === "string") email = body.email.trim().toLowerCase() || null;
  } catch {
    /* not JSON: Better Auth will refuse it */
  }
  const user = email ? (await sql.query<{ id: string }>(`select "id" from "user" where lower("email") = $1 limit 1`, [email]))[0] : undefined;
  if (!user) return handle(request);
  const verdict = await claimSignInTry(sql, user.id);
  if (!verdict.allowed) return Response.json({ code: "TOO_MANY_TRIES", message: tooManyTries(verdict.waitMinutes) }, { status: 429 });
  const response = await handle(request);
  if (response.ok) await clearSignInTries(sql, user.id);
  return response;
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
