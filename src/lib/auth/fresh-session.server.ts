/**
 * The signed-in session for a request, read from the database every time (server-only).
 *
 * Better Auth keeps a signed copy of the session in a cookie for five minutes (`cookieCache` in `server.ts`), so
 * the browser's own session check is fast. That copy stays readable after the session row is gone. Ending someone's
 * sessions (sealing a shared account, a password reset, a sign-out elsewhere) must take effect at once, so
 * nothing on the server trusts the cookie copy: every server-side check comes through here.
 */
import { auth } from "./server";

export function freshSession(headers: Headers) {
  return auth.api.getSession({ headers, query: { disableCookieCache: true } });
}
