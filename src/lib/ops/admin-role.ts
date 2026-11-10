/**
 * Who counts as an admin (Chuy, 11/9): the admin flag, or the Admin desk role. One rule for every check that
 * isn't about managing accounts; those stay with the flag (access.ts). Pure: safe on the server and in a screen.
 */
import { flagOn } from "./flag.ts";

/** A desk_accounts row. */
export function isAdminAccount(row: { is_admin?: unknown; desk_role?: string | null } | null | undefined): boolean {
  return !!row && (flagOn(row.is_admin) || String(row.desk_role ?? "").trim().toLowerCase() === "admin");
}

/** What getMyAccess gives a screen. */
export function isDeskAdmin(me: { isAdmin?: boolean | null; role?: string | null } | null | undefined): boolean {
  return !!me && (!!me.isAdmin || me.role === "admin");
}
