import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { requireAdmin } from "./access";

/** Links stay good for two days and work once. */
const RESET_HOURS = 48;
export const MIN_PASSWORD = 8;

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Only a hash of the token is stored, so a copied database can't be used to reset anyone. */
async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function passwordProblem(pw: string): string | null {
  if (pw.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (pw.length > 128) return "That password is too long.";
  return null;
}

/** Admin makes a one-time reset link for a teammate and sends it themselves. */
export const createPasswordResetLink = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { userId: string }) => d)
  .handler(async ({ context, data }): Promise<{ token: string; username: string; expiresAt: string }> => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId, "Only an admin can reset someone's password.");
    const who = await sql.query<{ username: string }>(
      "select username from desk_accounts where user_id = $1",
      [data.userId],
    );
    if (!who[0]) throw new Error("Account not found");
    // A new link replaces any older unused one.
    await sql.query("delete from desk_password_resets where user_id = $1 and used_at is null", [data.userId]);
    const token = randomToken();
    const rows = await sql.query<{ expires_at: string }>(
      `insert into desk_password_resets (user_id, token_hash, created_by, expires_at)
       values ($1, $2, $3, now() + ($4 || ' hours')::interval)
       returning expires_at`,
      [data.userId, await sha256(token), context.userId, String(RESET_HOURS)],
    );
    return { token, username: who[0].username, expiresAt: String(rows[0]?.expires_at ?? "") };
  });

/** Checks a link before showing the new-password form. No sign-in needed. */
export const peekPasswordReset = createServerFn({ method: "POST" })
  .validator((d: { token: string }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean; username: string | null }> => {
    const token = data.token?.trim();
    if (!token) return { ok: false, username: null };
    const sql = await getSql();
    const rows = await sql.query<{ username: string | null }>(
      `select a.username
       from desk_password_resets r
       left join desk_accounts a on a.user_id = r.user_id
       where r.token_hash = $1 and r.used_at is null and r.expires_at > now()`,
      [await sha256(token)],
    );
    return rows[0] ? { ok: true, username: rows[0].username ?? null } : { ok: false, username: null };
  });

/** Sets the new password from a reset link, then signs that person out everywhere. */
export const resetPasswordWithToken = createServerFn({ method: "POST" })
  .validator((d: { token: string; password: string }) => d)
  .handler(async ({ data }): Promise<{ username: string | null; email: string | null }> => {
    const problem = passwordProblem(data.password ?? "");
    if (problem) throw new Error(problem);
    const sql = await getSql();
    const tokenHash = await sha256((data.token ?? "").trim());
    const rows = await sql.query<{ id: number; user_id: string }>(
      `select id, user_id from desk_password_resets
       where token_hash = $1 and used_at is null and expires_at > now()`,
      [tokenHash],
    );
    const hit = rows[0];
    if (!hit) throw new Error("This reset link has expired or was already used. Ask an admin for a new one.");
    const { hashPassword } = await import("better-auth/crypto");
    const hashed = await hashPassword(data.password);
    const updated = await sql.query<{ id: string }>(
      `update "account" set "password" = $2, "updatedAt" = now()
       where "userId" = $1 and "providerId" = 'credential'
       returning "id"`,
      [hit.user_id, hashed],
    );
    if (!updated[0]) {
      // Google / X users get a password too, so they can also sign in with username + password.
      await sql.query(
        `insert into "account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
         values ($1, $2, 'credential', $2, $3, now(), now())`,
        [randomToken().slice(0, 32), hit.user_id, hashed],
      );
    }
    await sql.query("update desk_password_resets set used_at = now() where id = $1", [hit.id]);
    await sql.query(`delete from "session" where "userId" = $1`, [hit.user_id]);
    const who = await sql.query<{ username: string | null; email: string | null }>(
      `select d.username, u.email from "user" u left join desk_accounts d on d.user_id = u.id where u.id = $1`,
      [hit.user_id],
    );
    return { username: who[0]?.username ?? null, email: who[0]?.email ?? null };
  });
