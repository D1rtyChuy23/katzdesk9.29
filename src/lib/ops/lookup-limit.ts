/**
 * The sign-in screen's public lookups, counted per address (11/16). Before you sign in, the screen asks the server
 * whether a username is free, which email signs a username in, and whether someone is invited. Those answers are
 * needed to sign in, so they stay; what stops is running through names to collect staff emails: one address gets
 * LOOKUP_LIMIT tries every LOOKUP_WINDOW_MINUTES.
 *
 * It must never be the reason someone can't sign in: with no address to count, or if the count itself fails (the
 * table isn't there yet), the lookup goes through.
 */
type Sql = { query: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]> };

export const LOOKUP_LIMIT = 60;
export const LOOKUP_WINDOW_MINUTES = 10;
export const TOO_MANY_LOOKUPS = "Too many tries. Wait a few minutes, then try again.";

/** The caller's address as the host reports it: x-real-ip, else the first x-forwarded-for entry. */
export function clientAddress(headers: Headers): string | null {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const first = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first || null;
}

/** Only a hash of the address is kept. */
export async function addressHash(address: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(address));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Count this try and say whether it may go on. One statement: clears day-old rows, counts the address's tries in the
 * window, and records this one only when it is under the limit (a refused try isn't counted).
 */
export async function lookupAllowed(sql: Sql, ipHash: string | null): Promise<boolean> {
  if (!ipHash) return true;
  try {
    const rows = await sql.query<{ added: number }>(
      `with gone as (delete from sign_in_lookups where at < now() - interval '1 day'),
            recent as (
              select count(*)::int as n from sign_in_lookups
               where ip_hash = $1 and at > now() - ($2::text || ' minutes')::interval
            ),
            ins as (insert into sign_in_lookups (ip_hash) select $1 from recent where recent.n < $3::int returning 1)
       select (select count(*) from ins)::int as added`,
      [ipHash, String(LOOKUP_WINDOW_MINUTES), LOOKUP_LIMIT],
    );
    return !rows[0] || Number(rows[0].added) > 0;
  } catch {
    return true;
  }
}
