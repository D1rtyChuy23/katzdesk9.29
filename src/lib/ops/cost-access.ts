/**
 * Who sees our cost and margin (Chuy, 11/20: a toggle, "and keep everyone from seeing it"). An Admin always does. Any
 * other role sees it only when an Admin turns that role on in Settings; by default none is. The server leaves the
 * numbers out for everyone else, so they aren't in the page's data either.
 */
import type { Sql } from "@/lib/db";
import { isAdminAccount } from "@/lib/ops/admin-role";
import { flagOn } from "@/lib/ops/flag";

export type CostRole = "sales" | "service" | "warehouse" | "none";

export const COST_ROLES: { role: CostRole; label: string }[] = [
  { role: "sales", label: "Sales" },
  { role: "service", label: "Service" },
  { role: "warehouse", label: "Warehouse" },
  { role: "none", label: "No role set" },
];

export const COST_ROLES_KEY = "cost_visible_roles";

/** The known roles in `value`, once each, in COST_ROLES order. Anything else is dropped. */
export function cleanCostRoles(value: unknown): CostRole[] {
  const list = Array.isArray(value) ? value.map((v) => String(v)) : [];
  return COST_ROLES.map((r) => r.role).filter((r) => list.includes(r));
}

export async function loadCostRoles(sql: Sql): Promise<CostRole[]> {
  const row = (await sql.query<{ value: string | null }>("select value from desk_settings where key = $1", [COST_ROLES_KEY]))[0];
  if (!row?.value) return [];
  try {
    return cleanCostRoles(JSON.parse(row.value));
  } catch {
    return [];
  }
}

export async function saveCostRoles(sql: Sql, roles: CostRole[]): Promise<void> {
  await sql.query(
    `insert into desk_settings (key, value, updated_at) values ($1, $2, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [COST_ROLES_KEY, JSON.stringify(cleanCostRoles(roles))],
  );
}

/** True for an approved Admin, or an approved account whose role an Admin turned on. */
export async function canSeeCost(sql: Sql, userId: string): Promise<boolean> {
  const row = (await sql.query<{ is_admin: unknown; desk_role: string | null; approved: unknown }>(
    "select is_admin, desk_role, approved from desk_accounts where user_id = $1",
    [userId],
  ))[0];
  if (!row || !flagOn(row.approved)) return false;
  if (isAdminAccount(row)) return true;
  const role = String(row.desk_role ?? "").trim().toLowerCase() || "none";
  return (await loadCostRoles(sql)).includes(role as CostRole);
}

// Two more switches (Chuy, 11/20: "I want both to be toggle. I can decide later."), both off to start.
export const COST_OPTIONS_KEY = "cost_options";

export type CostOptions = {
  roles: CostRole[];
  /** Ticked roles see labor's cost too. Off: parts and the trip only, so the Labor Cost Rate can't be worked out. */
  showLabor: boolean;
  /** Warehouse, when ticked, sees cost on rebuild invoices too. Off: never there. */
  warehouseRebuilds: boolean;
};

export async function loadCostOptions(sql: Sql): Promise<CostOptions> {
  const row = (await sql.query<{ value: string | null }>("select value from desk_settings where key = $1", [COST_OPTIONS_KEY]))[0];
  let o: Record<string, unknown> = {};
  try {
    o = row?.value ? (JSON.parse(row.value) ?? {}) : {};
  } catch {
    o = {};
  }
  return { roles: await loadCostRoles(sql), showLabor: o.showLabor === true, warehouseRebuilds: o.warehouseRebuilds === true };
}

export async function saveCostOptions(sql: Sql, o: CostOptions): Promise<void> {
  await saveCostRoles(sql, o.roles);
  await sql.query(
    `insert into desk_settings (key, value, updated_at) values ($1, $2, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [COST_OPTIONS_KEY, JSON.stringify({ showLabor: o.showLabor === true, warehouseRebuilds: o.warehouseRebuilds === true })],
  );
}

/** What this person sees: cost at all, labor's cost (an Admin always), and whether they are an Admin. */
export async function costView(sql: Sql, userId: string): Promise<{ showCost: boolean; showLabor: boolean; admin: boolean; warehouseRebuilds: boolean }> {
  const row = (await sql.query<{ is_admin: unknown; desk_role: string | null; approved: unknown }>(
    "select is_admin, desk_role, approved from desk_accounts where user_id = $1",
    [userId],
  ))[0];
  const admin = !!row && flagOn(row.approved) && isAdminAccount(row);
  const showCost = await canSeeCost(sql, userId);
  const o = await loadCostOptions(sql);
  return { showCost, showLabor: admin || (showCost && o.showLabor), admin, warehouseRebuilds: o.warehouseRebuilds };
}
