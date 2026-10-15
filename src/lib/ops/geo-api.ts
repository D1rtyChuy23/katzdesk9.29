import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { deskMiddleware, salesRepScope } from "@/lib/ops/access";
import { todayChicago } from "@/lib/ops/clock";
import { flagOn } from "@/lib/ops/flag";
import { isoDayOrNull } from "@/lib/ops/iso";
import { canonicalRepName, isNoRep, DEFAULT_REPS } from "@/lib/ops/rep-match";
import { cityFromAddress, isPoint, type PinQuality } from "@/lib/ops/geo";

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
  /** True when work counts were limited to this sales rep's own accounts (same rule as Tickets and PMs). */
  scoped: boolean;
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
const quality = (v: string | null): PinQuality | null => (v === "exact" || v === "close" || v === "approx" ? v : null);

/**
 * Every active account with its pin, rep and open work, in one query. Open means the same as everywhere else:
 * tickets not done and not Completed / Cancelled / Phone Resolved (merged duplicates left out); PMs not done and not
 * Completed / Cancelled; installs not complete and not Installed. Jobs link to accounts by name (lower(name)), like
 * the Customers list. Out of network means the account is on the Out of Network page (a provider is assigned or one is
 * still needed): it is on the Out of Network accounts list (network_accounts), or a provider that is not archived is
 * assigned to it (customer_providers), both matched the same way by lower(customer). For a sales rep (not an admin),
 * work on accounts that are not theirs is counted as zero, the same scope the Tickets and PMs pages use; the accounts
 * themselves still show, as on the Customers list.
 */
export const listAccountGeo = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<AccountGeoData> => {
    const sql = await ready();
    const today = todayChicago();
    const rows = await sql.query<Row>(
      `with svc as (
         select lower(customer) as k,
                count(*) filter (where kind = 'service')::int as open_calls,
                count(*) filter (where kind = 'tlc')::int as open_tlcs,
                count(*) filter (where scheduled < $1::date)::int as past_due_calls
           from service_jobs
          where not done and status not in ('Completed', 'Cancelled', 'Phone Resolved')
            and duplicate_of is null and coalesce(customer, '') <> ''
          group by 1
       ), pm as (
         select lower(customer) as k,
                count(*)::int as open_pms,
                count(*) filter (where projected < $1::date)::int as pms_past_due,
                count(*) filter (where projected >= $1::date and projected <= $1::date + $2::int)::int as pms_due_soon,
                count(*) filter (where projected is null)::int as pms_no_date,
                min(projected) filter (where projected >= $1::date) as next_pm
           from pm_jobs
          where not done and status not in ('Completed', 'Cancelled') and coalesce(customer, '') <> ''
          group by 1
       ), inst as (
         select lower(customer) as k, count(*)::int as open_installs,
                min(install_date) filter (where install_date >= $1::date) as next_install
           from installs
          where archived = false and not complete and coalesce(equip_status, '') <> 'Installed'
            and coalesce(customer, '') <> ''
          group by 1
       ), oon as (
         select lower(cp.customer) as k
           from customer_providers cp
           join network_providers np on np.id = cp.provider_id
          where np.archived = false and coalesce(cp.customer, '') <> ''
         union
         select lower(customer)
           from network_accounts
          where coalesce(customer, '') <> ''
       )
       select d.id, d.name, d.account_rep, d.avi_katz, (oon.k is not null) as out_of_network, d.account_number, d.address,
              d.latitude, d.longitude, d.geocode_match, d.geocode_address,
              coalesce(svc.open_calls, 0) as open_calls, coalesce(svc.open_tlcs, 0) as open_tlcs,
              coalesce(svc.past_due_calls, 0) as past_due_calls,
              coalesce(pm.open_pms, 0) as open_pms, coalesce(pm.pms_past_due, 0) as pms_past_due,
              coalesce(pm.pms_due_soon, 0) as pms_due_soon, coalesce(pm.pms_no_date, 0) as pms_no_date, pm.next_pm,
              coalesce(inst.open_installs, 0) as open_installs, inst.next_install
         from directory_customers d
         left join svc on svc.k = lower(d.name)
         left join pm on pm.k = lower(d.name)
         left join inst on inst.k = lower(d.name)
         left join oon on oon.k = lower(d.name)
        where d.archived = false
        order by lower(d.name), d.id`,
      [today, PM_DUE_DAYS],
    );
    const scope = await salesRepScope(sql, context.userId);
    const seen = new Set<string>();
    const accounts: AccountGeo[] = [];
    for (const r of rows) {
      const key = String(r.name ?? "").trim().toLowerCase();
      // Two rows with the same lower-case name would double-count the same jobs; the first (by id) keeps them.
      const dup = seen.has(key);
      seen.add(key);
      const rep = canonicalRepName(r.account_rep);
      const inScope = !scope || scope(r.account_rep);
      const counts = !dup && inScope;
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
        address,
        geocodeAddress,
        city: cityFromAddress(address) ?? cityFromAddress(geocodeAddress),
        rep,
        noRep: isNoRep(r.account_rep),
        aviKatz: flagOn(r.avi_katz),
        outOfNetwork: flagOn(r.out_of_network),
        accountNumber: r.account_number ? String(r.account_number) : null,
        openCalls: counts ? Number(r.open_calls) : 0,
        openTlcs: counts ? Number(r.open_tlcs) : 0,
        pastDueCalls: counts ? Number(r.past_due_calls) : 0,
        openPms: counts ? Number(r.open_pms) : 0,
        pmsPastDue: counts ? Number(r.pms_past_due) : 0,
        pmsDueSoon: counts ? Number(r.pms_due_soon) : 0,
        pmsNoDate: counts ? Number(r.pms_no_date) : 0,
        nextPm: counts ? isoDayOrNull(r.next_pm) : null,
        openInstalls: counts ? Number(r.open_installs) : 0,
        nextInstall: counts ? isoDayOrNull(r.next_install) : null,
      });
    }
    const reps = [...new Set([...DEFAULT_REPS.map((r) => r.name), ...accounts.map((a) => a.rep).filter((r): r is string => !!r)])].sort((a, b) =>
      a.localeCompare(b),
    );
    return { today, dueDays: PM_DUE_DAYS, accounts, reps, scoped: !!scope };
  });
