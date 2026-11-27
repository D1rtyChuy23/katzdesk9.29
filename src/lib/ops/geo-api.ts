import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { todayChicago } from "@/lib/ops/clock";
import { flagOn } from "@/lib/ops/flag";
import { isoDayOrNull } from "@/lib/ops/iso";
import { canonicalRepName, isNoRep, DEFAULT_REPS } from "@/lib/ops/rep-match";
import { cityFromAddress, isPoint, type PinQuality } from "@/lib/ops/geo";
import { MANUAL_PIN_MATCH, pinQuality } from "@/lib/ops/account-pin";
import { isWalkIn } from "@/lib/ops/customer-key";
import { perAccountJoin, readsById } from "@/lib/ops/read-by-id";
import { openPmSql } from "@/lib/ops/ticket-status";

async function ready() {
  const { ensureSeeded } = await import("./seed.server");
  await ensureSeeded();
  return getSql();
}

/** PMs projected within this many days count as "coming due" (same window as the PM flags on the PMs page). */
export const PM_DUE_DAYS = 14;

/** One account on the map: its pin (when it has one), rep, and open work. Work counts match the Customers list. */
export type AccountGeo = {
  id: number;
  name: string;
  /** Saved map pin; null when the account has not been geocoded. */
  lat: number | null;
  lng: number | null;
  /** exact / close: the street address was found. approx: only the ZIP code's center. */
  quality: PinQuality | null;
  /** The pin was entered by hand on Account Details (it counts as exact). */
  manual: boolean;
  /** The account's own address (typed), and the address the geocoder matched. */
  address: string | null;
  geocodeAddress: string | null;
  /** City for grouping into areas: from the typed address, else the geocoder's. */
  city: string | null;
  /** Canonical rep name, or null when the account has no rep (or one not on the rep list). */
  rep: string | null;
  noRep: boolean;
  aviKatz: boolean;
  /**
   * The account is on the Out of Network page (a provider is assigned or one is still needed): a network_accounts row,
   * or a customer_providers row to a provider that is not archived (any role), matched by lower-case name.
   */
  outOfNetwork: boolean;
  accountNumber: string | null;
  openCalls: number;
  openTlcs: number;
  /** Open tickets and TLCs whose scheduled date has passed (same rule as the past-due flag). */
  pastDueCalls: number;
  openPms: number;
  pmsPastDue: number;
  /** Open PMs projected from today through today + PM_DUE_DAYS. */
  pmsDueSoon: number;
  pmsNoDate: number;
  nextPm: string | null;
  openInstalls: number;
  nextInstall: string | null;
};

export type AccountGeoData = {
  today: string;
  dueDays: number;
  accounts: AccountGeo[];
  /** Every rep that appears on an account, plus the rep list, sorted: the legend and the color order. */
  reps: string[];
};

type Row = {
  id: number;
  name: string;
  account_rep: string | null;
  avi_katz: unknown;
  out_of_network: unknown;
  account_number: string | null;
  address: string | null;
  latitude: unknown;
  longitude: unknown;
  geocode_match: string | null;
  geocode_address: string | null;
  open_calls: number;
  open_tlcs: number;
  past_due_calls: number;
  past_due_service: number;
  open_pms: number;
  pms_past_due: number;
  pms_due_soon: number;
  pms_no_date: number;
  next_pm: unknown;
  open_installs: number;
  next_install: unknown;
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const quality = (v: string | null): PinQuality | null => pinQuality(v);

/**
 * Every active account with its pin, rep and open work, in one query. Open means the same as everywhere else:
 * tickets not done and not Completed / Cancelled / Phone Resolved (merged duplicates left out); PMs not done and not
 * Completed / Cancelled; installs not complete and not Installed. Jobs link to accounts by name (lower(name)), like
 * the Customers list. Out of network means the account is on the Out of Network page (a provider is assigned or one is
 * still needed): it is on the Out of Network accounts list (network_accounts), or a provider that is not archived is
 * assigned to it (customer_providers), both matched the same way by lower(customer). Every viewer, a sales rep
 * included, gets the work counts on every account, so each Rep filter on the Map shows that rep's real numbers (the
 * Tickets and PMs pages keep their own sales-rep scope).
 */
/**
 * The Map's accounts with their open work, as one query ($1 today, $2 the PM due-soon days). By id, a record counts
 * under the listed account its id names, or else the one its name finds in any capitals; otherwise by name, as before.
 */
export function accountGeoSql(byId: boolean): string {
  const join = (table: string, alias: string, where: string, counts: string) => perAccountJoin({ table, alias, where, counts, byId });
  // Out of Network: on the Out of Network accounts list, or a provider that is not archived is assigned.
  const oon = `(select cp.customer, cp.customer_id from customer_providers cp join network_providers np on np.id = cp.provider_id
                 where np.archived = false
                union all
                select na.customer, na.customer_id from network_accounts na)`;
  return `select d.id, d.name, d.account_rep, d.avi_katz, (coalesce(oon.n, 0) > 0) as out_of_network, d.account_number, d.address,
              d.latitude, d.longitude, d.geocode_match, d.geocode_address,
              coalesce(svc.open_calls, 0) as open_calls, coalesce(svc.open_tlcs, 0) as open_tlcs,
              coalesce(svc.past_due_calls, 0) as past_due_calls, coalesce(svc.past_due_service, 0) as past_due_service,
              coalesce(pm.open_pms, 0) as open_pms, coalesce(pm.pms_past_due, 0) as pms_past_due,
              coalesce(pm.pms_due_soon, 0) as pms_due_soon, coalesce(pm.pms_no_date, 0) as pms_no_date, pm.next_pm,
              coalesce(inst.open_installs, 0) as open_installs, inst.next_install
         from directory_customers d
         ${join(
           "service_jobs",
           "svc",
           "not t.done and t.status not in ('Completed', 'Cancelled', 'Phone Resolved') and t.duplicate_of is null and coalesce(t.customer, '') <> ''",
           `count(*) filter (where t.kind = 'service')::int as open_calls,
            count(*) filter (where t.kind = 'tlc')::int as open_tlcs,
            count(*) filter (where t.scheduled < $1::date)::int as past_due_calls,
            count(*) filter (where t.kind = 'service' and t.scheduled < $1::date)::int as past_due_service`,
         )}
         ${join(
           "pm_jobs",
           "pm",
           `${openPmSql("t")} and coalesce(t.customer, '') <> ''`,
           `count(*)::int as open_pms,
            count(*) filter (where t.projected < $1::date)::int as pms_past_due,
            count(*) filter (where t.projected >= $1::date and t.projected <= $1::date + $2::int)::int as pms_due_soon,
            count(*) filter (where t.projected is null)::int as pms_no_date,
            min(t.projected) filter (where t.projected >= $1::date) as next_pm`,
         )}
         ${join(
           "installs",
           "inst",
           "t.archived = false and not t.complete and coalesce(t.equip_status, '') <> 'Installed' and coalesce(t.customer, '') <> ''",
           `count(*)::int as open_installs, min(t.install_date) filter (where t.install_date >= $1::date) as next_install`,
         )}
         ${join(oon, "oon", "coalesce(t.customer, '') <> ''", "count(*)::int as n")}
        where d.archived = false
        order by lower(d.name), d.id`;
}

export const listAccountGeo = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async (): Promise<AccountGeoData> => {
    const sql = await ready();
    const today = todayChicago();
    // By each account's id once the Map reads by id (phase C5, Link Check → Reading by id); by its name until then.
    const rows = await sql.query<Row>(accountGeoSql(await readsById(sql, "map")), [today, PM_DUE_DAYS]);
    const seen = new Set<string>();
    const accounts: AccountGeo[] = [];
    for (const r of rows) {
      const key = String(r.name ?? "").trim().toLowerCase();
      // Two rows with the same lower-case name would double-count the same jobs; the first (by id) keeps them.
      const walkIn = isWalkIn(r.name);
      const dup = seen.has(key);
      seen.add(key);
      const rep = canonicalRepName(r.account_rep);
      const counts = !dup;
      const lat = num(r.latitude);
      const lng = num(r.longitude);
      const point = isPoint({ lat, lng });
      const address = r.address ? String(r.address).trim() || null : null;
      const geocodeAddress = r.geocode_address ? String(r.geocode_address).trim() || null : null;
      accounts.push({
        id: Number(r.id),
        name: String(r.name),
        lat: point ? lat : null,
        lng: point ? lng : null,
        quality: point ? quality(r.geocode_match) : null,
        manual: point && r.geocode_match === MANUAL_PIN_MATCH,
        address,
        geocodeAddress,
        city: cityFromAddress(address) ?? cityFromAddress(geocodeAddress),
        rep,
        noRep: walkIn ? false : isNoRep(r.account_rep),
        aviKatz: flagOn(r.avi_katz),
        outOfNetwork: flagOn(r.out_of_network),
        accountNumber: r.account_number ? String(r.account_number) : null,
        openCalls: counts ? Number(r.open_calls) : 0,
        openTlcs: counts && !walkIn ? Number(r.open_tlcs) : 0,
        pastDueCalls: counts ? Number(walkIn ? r.past_due_service : r.past_due_calls) : 0,
        openPms: counts && !walkIn ? Number(r.open_pms) : 0,
        pmsPastDue: counts && !walkIn ? Number(r.pms_past_due) : 0,
        pmsDueSoon: counts && !walkIn ? Number(r.pms_due_soon) : 0,
        pmsNoDate: counts && !walkIn ? Number(r.pms_no_date) : 0,
        nextPm: counts && !walkIn ? isoDayOrNull(r.next_pm) : null,
        openInstalls: counts && !walkIn ? Number(r.open_installs) : 0,
        nextInstall: counts && !walkIn ? isoDayOrNull(r.next_install) : null,
      });
    }
    const reps = [...new Set([...DEFAULT_REPS.map((r) => r.name), ...accounts.map((a) => a.rep).filter((r): r is string => !!r)])].sort((a, b) =>
      a.localeCompare(b),
    );
    return { today, dueDays: PM_DUE_DAYS, accounts, reps };
  });
