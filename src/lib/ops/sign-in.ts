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
 */
import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { ensureAccessTables, resolveSignIn } from "./access";
import { passwordSignInInput } from "./access-input";

export const MAX_TRIES = 8;
export const WINDOW_MINUTES = 15;

/** What the sign-in screen does next. Never an email. */
export type SignInOutcome = { next: "in"; waiting: boolean } | { next: "invited" } | { next: "social"; methods: string[] };

/** Checks a password and, when it is right, signs the person in. True when it was right. */
export type PasswordCheck = (email: string, password: string) => Promise<boolean>;

const WRONG_PASSWORD = "That password didn't match. Check Caps Lock and try again, or tap Forgot password below.";

/** Whether this try may go ahead, and how long to wait when it may not. `tries` counts this one. */
export function tryVerdict(tries: number, windowStartMs: number, nowMs: number): { allowed: boolean; waitMinutes: number } {
  if (tries <= MAX_TRIES) return { allowed: true, waitMinutes: 0 };
  const left = windowStartMs + WINDOW_MINUTES * 60_000 - nowMs;
  return { allowed: false, waitMinutes: Math.max(1, Math.ceil(left / 60_000)) };
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
  if (found.kind === "invited") return { next: "invited" };
  // A Google or X account with no password: send them to the right button instead of "wrong password".
  if (found.methods.length && !found.methods.includes("password")) return { next: "social", methods: found.methods };
  const verdict = await claimSignInTry(sql, found.userId);
  if (!verdict.allowed) {
    const wait = verdict.waitMinutes === 1 ? "1 minute" : `${verdict.waitMinutes} minutes`;
    throw new Error(`Too many tries for this account. Wait ${wait} and try again, or ask a desk admin for a reset link.`);
  }
  if (!(await signIn(found.email, input.password))) throw new Error(WRONG_PASSWORD);
  await clearSignInTries(sql, found.userId);
  return { next: "in", waiting: found.waiting };
}

/** Better Auth's answer to a wrong email or password (401), as opposed to something breaking. */
export function isWrongPassword(err: unknown): boolean {
  const e = err as { status?: unknown; statusCode?: unknown } | null;
  return !!e && (e.status === "UNAUTHORIZED" || e.statusCode === 401);
}

export const passwordSignIn = createServerFn({ method: "POST" })
  .validator(passwordSignInInput)
  .handler(async ({ data }): Promise<SignInOutcome> => {
    const sql = await getSql();
    await ensureAccessTables(sql);
    return signInWithPassword(sql, data, async (email, password) => {
      // Server-only modules, loaded here so they never reach the browser bundle.
      const [{ auth }, { getRequest }] = await Promise.all([import("@/lib/auth/server"), import("@tanstack/react-start/server")]);
      try {
        // Sets the session cookie on this response (the tanstackStartCookies plugin in auth/server.ts).
        await auth.api.signInEmail({ body: { email, password }, headers: getRequest().headers });
        return true;
      } catch (err) {
        if (isWrongPassword(err)) return false;
        console.error("[sign-in] password sign-in failed:", err instanceof Error ? err.message : err);
        throw new Error("Sign-in didn't go through. Try again in a moment.");
      }
    });
  });
