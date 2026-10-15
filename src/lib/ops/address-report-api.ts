import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware } from "@/lib/ops/access";
import {
  buildSuggestions,
  likePattern,
  searchWords,
  DEFAULT_PAGE_SIZE,
  MAX_ACCOUNT_ID,
  MAX_PAGE_NUMBER,
  MAX_PAGE_SIZE,
  MAX_SEARCH_LENGTH,
  type AddressSource,
  type AddressSuggestion,
} from "@/lib/ops/address-report";

async function ready() {
  const { ensureSeeded } = await import("./seed.server");
  await ensureSeeded();
  return getSql();
}

/** Addresses are changed (and rows skipped) by an Admin: the Admin role or a desk admin, same as the Locations import. */
async function requireEditor(sql: Sql, userId: string) {
  if (!(await canReviewNames(sql, userId))) throw new Error("Only an Admin can approve or skip addresses on the address report.");
}

/** The name on activity rows, resolved the same way as everywhere else on the desk (username, else "Teammate"). */
async function actorName(sql: Sql, userId: string): Promise<string> {
  return (await sql.query<{ username: string | null }>("select username from desk_accounts where user_id = $1", [userId]))[0]?.username || "Teammate";
}

/** Typed address as shown: trimmed, null when blank. */
const shown = (v: string | null | undefined): string | null => {
  const s = String(v ?? "").trim();
  return s || null;
};

const iso = (v: unknown): string | null => {
  if (v === null || v === undefined || v === "") return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/** Same comparison key in SQL as normalizeAddress, without the abbreviations (only used to order the list). */
const norm = (x: string) => `btrim(regexp_replace(lower(coalesce(${x}, '')), '[^a-z0-9]+', ' ', 'g'))`;

export type AddressReportStatus = "open" | "skipped" | "approved";

export type AddressReportRow = {
  id: number;
  name: string;
  nameLocked: boolean;
  accountNumber: string | null;
  /** The account's typed address; null when it has none. */
  address: string | null;
  /** 'approx' when the only pin is the ZIP code's center; null when there is no pin. */
  pinQuality: "approx" | null;
  /** True when the account has a street pin after all (only when one account is asked for). */
  hasStreetPin: boolean;
  /** The address the geocoder matched, as stored. */
  geocodeAddress: string | null;
  suggestions: AddressSuggestion[];
  /** open: waiting. skipped: left off until brought back. approved: an approved address still stands. */
  status: AddressReportStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
};

export type AddressReport = {
  rows: AddressReportRow[];
  page: number;
  pageSize: number;
  /** Rows in this view (all pages). */
  total: number;
  counts: { open: number; skipped: number };
  /** May approve and skip (an Admin). Everyone else sees the report only. */
  canEdit: boolean;
};

type SourceRow = { customer_id: number; kind: string; address: string };

/**
 * The other addresses on file for these accounts, newest first: clean-list lines the account was matched to
 * (applied, approved or kept; a suggested match still waiting is not the account's yet), the latest clean list's rows
 * with the account's list ID or the same name (ignoring case and punctuation, as the clean-list review matches them),
 * and the bill-to address on the account's invoices.
 */
async function loadSources(sql: Sql, ids: number[]): Promise<Map<number, { cleanList: string[]; invoices: string[] }>> {
  const out = new Map<number, { cleanList: string[]; invoices: string[] }>();
  if (!ids.length) return out;
  const rows = await sql.query<SourceRow>(
    `with acct as (
       select id, name, netsuite_id from directory_customers where id = any($1::int[])
     ), latest as (
       select max(id) as run_id from customer_clean_runs
     )
     select customer_id, kind, address from (
       select i.customer_id, 'clean' as kind, i.address, 0 as tier, i.run_id as o1, i.id as o2
         from customer_clean_items i
         join acct a on a.id = i.customer_id
        where i.status in ('apply', 'locked', 'kept') and coalesce(btrim(i.address), '') <> ''
       union all
       select a.id, 'clean', r.address, 1, r.run_id, r.id
         from customer_clean_rows r
         join latest l on l.run_id = r.run_id
         join acct a on (coalesce(btrim(a.netsuite_id), '') <> '' and btrim(r.internal_id) = btrim(a.netsuite_id))
                     or regexp_replace(lower(r.name), '[^a-z0-9]+', '', 'g') = regexp_replace(lower(a.name), '[^a-z0-9]+', '', 'g')
        where coalesce(btrim(r.address), '') <> ''
       union all
       select a.id, 'invoice', v.bill_address, 2, v.id, 0
         from invoices v
         join acct a on lower(btrim(v.customer)) = lower(btrim(a.name))
        where coalesce(btrim(v.bill_address), '') <> ''
     ) s
     order by customer_id, tier, o1 desc, o2 desc
     limit 2000`,
    [ids],
  );
  for (const r of rows) {
    const id = Number(r.customer_id);
    const cur = out.get(id) ?? { cleanList: [], invoices: [] };
    (r.kind === "invoice" ? cur.invoices : cur.cleanList).push(String(r.address));
    out.set(id, cur);
  }
  return out;
}

const listInput = z.object({
  page: z.number().int().min(1).max(MAX_PAGE_NUMBER).default(1),
  pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  account: z.number().int().positive().max(MAX_ACCOUNT_ID).optional(),
  skipped: z.boolean().optional(),
  search: z.string().max(MAX_SEARCH_LENGTH).optional(),
});

type ListRow = {
  id: number;
  name: string;
  name_locked: unknown;
  account_number: string | null;
  address: string | null;
  geocode_address: string | null;
  geocode_match: string | null;
  street_pin: unknown;
  bucket: AddressReportStatus;
  decided_by: string | null;
  decided_at: unknown;
  open_n: number;
  skipped_n: number;
  total: number;
};

/**
 * Active accounts the map cannot place: no saved pin, or only a ZIP-area pin. Open rows (or Skipped rows), one page,
 * with the other addresses on file for the accounts on that page. Accounts with a likely suggestion come first, then
 * by name. `account` shows just that account, whatever its state. One query for the page, the total and the counts.
 */
export const listAddressReport = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof listInput>) => listInput.parse(d))
  .handler(async ({ data, context }): Promise<AddressReport> => {
    const sql = await ready();
    const words = data.account ? [] : searchWords(data.search);
    const params: unknown[] = [data.account ?? null, data.skipped ? "skipped" : "open", data.pageSize, (data.page - 1) * data.pageSize];
    const searchSql = words
      .map((w) => {
        params.push(likePattern(w));
        return ` and concat_ws(' ', c.name, c.address, c.account_number, c.geocode_address) ilike $${params.length}`;
      })
      .join("");
    const rows = await sql.query<ListRow>(
      `with base as (
         select d.id, d.name, d.name_locked, d.account_number, d.netsuite_id, d.address, d.geocode_address, d.geocode_match,
                (d.latitude is not null and d.longitude is not null and d.geocode_match is distinct from 'approx') as street_pin,
                r.status as review_status, r.address as review_address, r.decided_by, r.decided_at
           from directory_customers d
           left join address_report_reviews r on r.customer_id = d.id
          where d.archived = false
       ), classified as (
         -- An approval keeps the account off the report while its address is still the approved one; a skip, until
         -- it is brought back.
         select b.*,
                case when b.review_status = 'skipped' then 'skipped'
                     when b.review_status = 'approved' and coalesce(btrim(b.address), '') = coalesce(btrim(b.review_address), '') then 'approved'
                     else 'open' end as bucket
           from base b
       ), counts as (
         select count(*) filter (where not street_pin and bucket = 'open')::int as open_n,
                count(*) filter (where not street_pin and bucket = 'skipped')::int as skipped_n
           from classified
       ), picked as (
         select c.* from classified c
          where case when $1::int is not null then c.id = $1::int else not c.street_pin and c.bucket = $2::text end${searchSql}
       ), clean_items as (
         select customer_id, array_agg(distinct ${norm("address")}) as ks
           from customer_clean_items
          where status in ('apply', 'locked', 'kept') and coalesce(btrim(address), '') <> ''
          group by customer_id
       ), clean_rows as (
         select btrim(r.internal_id) as internal_id, regexp_replace(lower(r.name), '[^a-z0-9]+', '', 'g') as name_key, ${norm("r.address")} as k
           from customer_clean_rows r
          where r.run_id = (select max(id) from customer_clean_runs) and coalesce(btrim(r.address), '') <> ''
       ), bills as (
         select lower(btrim(customer)) as name_key, array_agg(distinct ${norm("bill_address")}) as ks
           from invoices
          where coalesce(btrim(bill_address), '') <> '' and coalesce(btrim(customer), '') <> ''
          group by 1
       ), page as (
         select p.*,
                -- Never null, so "desc" cannot put unknowns first.
                coalesce(
                  (p.geocode_address ~* '\\(zip area\\)' and coalesce(btrim(p.address), '') <> '' and btrim(p.address) !~ '[0-9]{5}(-[0-9]{4})?$')
                  or (p.geocode_address ~ '[0-9]' and p.geocode_address !~* '\\(zip area\\)' and ${norm("p.geocode_address")} <> ${norm("p.address")})
                  or exists (select 1 from unnest(ci.ks) k where k <> ${norm("p.address")})
                  or exists (select 1 from unnest(bl.ks) k where k <> ${norm("p.address")})
                  or exists (
                    select 1 from clean_rows cr
                     where cr.k <> ${norm("p.address")}
                       and ((coalesce(btrim(p.netsuite_id), '') <> '' and cr.internal_id = btrim(p.netsuite_id))
                            or cr.name_key = regexp_replace(lower(p.name), '[^a-z0-9]+', '', 'g'))
                  ),
                  false
                ) as has_lead
           from picked p
           left join clean_items ci on ci.customer_id = p.id
           left join bills bl on bl.name_key = lower(btrim(p.name))
          order by has_lead desc, lower(p.name), p.id
          limit $3::int offset $4::int
       )
       select pg.id, pg.name, pg.name_locked, pg.account_number, pg.address, pg.geocode_address, pg.geocode_match, pg.street_pin,
              pg.bucket, pg.decided_by, pg.decided_at, pg.has_lead,
              counts.open_n, counts.skipped_n, (select count(*) from picked)::int as total
         from counts
         left join page pg on true
        order by pg.has_lead desc nulls last, lower(pg.name), pg.id`,
      params,
    );
    const first = rows[0];
    const pageRows = rows.filter((r) => r.id !== null && r.id !== undefined);
    const sources = await loadSources(
      sql,
      pageRows.map((r) => Number(r.id)),
    );
    return {
      rows: pageRows.map((r): AddressReportRow => {
        const id = Number(r.id);
        const src = sources.get(id);
        const streetPin = r.street_pin === true || r.street_pin === "t" || r.street_pin === "true";
        return {
          id,
          name: String(r.name),
          nameLocked: r.name_locked === true || r.name_locked === "t" || r.name_locked === "true",
          accountNumber: shown(r.account_number),
          address: shown(r.address),
          pinQuality: !streetPin && r.geocode_match === "approx" ? "approx" : null,
          hasStreetPin: streetPin,
          geocodeAddress: shown(r.geocode_address),
          suggestions: buildSuggestions({ address: r.address, geocodeAddress: r.geocode_address, cleanList: src?.cleanList, invoices: src?.invoices }),
          status: r.bucket,
          reviewedBy: r.bucket === "open" ? null : (r.decided_by ?? null),
          reviewedAt: r.bucket === "open" ? null : iso(r.decided_at),
        };
      }),
      page: data.page,
      pageSize: data.pageSize,
      total: Number(first?.total ?? 0),
      counts: { open: Number(first?.open_n ?? 0), skipped: Number(first?.skipped_n ?? 0) },
      canEdit: await canReviewNames(sql, context.userId),
    };
  });

const approveInput = z.object({
  accountId: z.number().int().positive(),
  /** The address shown when the suggestion was made (null for "No address"). */
  expectedAddress: z.string().max(600).nullable(),
  newAddress: z.string().trim().min(1, "Pick an address to approve.").max(600),
});

export type ApproveAddressResult = {
  /** updated: the address was changed now. already: it already was this address; nothing was written. */
  status: "updated" | "already";
  account: { id: number; name: string; address: string | null };
};

type AccountRow = { id: number; name: string; address: string | null; geocode_address: string | null; archived: boolean };

async function readAccount(sql: Sql, id: number): Promise<AccountRow | null> {
  return (
    (await sql.query<AccountRow>("select id, name, address, geocode_address, archived from directory_customers where id = $1", [id]))[0] ?? null
  );
}

const changedError = (name: string) => new Error(`The address on “${name}” changed since this suggestion was made. Reload the report.`);

/**
 * Approve one suggested address: the account's address becomes it. Only the address column changes (never the name,
 * the lock or the pin). The suggestion must still be offered for the account as it is now; approving the address it
 * already has writes nothing (so a second click is safe). The change, its one activity row and the approval are one
 * statement: the activity and the approval are written from the update's own result, so no update means no activity.
 */
export const approveAddressSuggestion = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof approveInput>) => approveInput.parse(d))
  .handler(async ({ data, context }): Promise<ApproveAddressResult> => {
    const sql = await ready();
    await requireEditor(sql, context.userId);
    const cur = await readAccount(sql, data.accountId);
    if (!cur || cur.archived) throw new Error("That account is no longer on the customer list.");
    const summary = (address: string | null) => ({ id: cur.id, name: cur.name, address });
    if (shown(cur.address) === data.newAddress) return { status: "already", account: summary(data.newAddress) };
    if ((shown(cur.address) ?? "") !== (shown(data.expectedAddress) ?? "")) throw changedError(cur.name);
    const src = (await loadSources(sql, [cur.id])).get(cur.id);
    const offered = buildSuggestions({ address: cur.address, geocodeAddress: cur.geocode_address, cleanList: src?.cleanList, invoices: src?.invoices });
    const pick = offered.find((s) => s.address === data.newAddress);
    if (!pick) throw new Error("That suggestion is no longer offered for this account.");
    const who = await actorName(sql, context.userId);
    const source: AddressSource = pick.source;
    const res = await sql.query<{ updated: number; logged: number }>(
      `with cur as (
         select id, address from directory_customers
          where id = $1::int and archived = false and coalesce(btrim(address), '') = coalesce(btrim($2::text), '')
          for update
       ), upd as (
         update directory_customers d
            set address = $3::text, updated_at = now()
           from cur
          where d.id = cur.id and d.archived = false and coalesce(btrim(d.address), '') = coalesce(btrim($2::text), '')
         returning d.id, cur.address as old_address
       ), act as (
         insert into activity (entity_type, entity_id, actor_name, action, detail)
         select 'customer', upd.id, $4::text, 'updated',
                'Address approved from the address report: '
                  || case when coalesce(btrim(upd.old_address), '') = '' then 'no address' else '"' || btrim(upd.old_address) || '"' end
                  || ' → "' || $3::text || '" (' || $5::text || ')'
           from upd
         returning id
       ), rev as (
         insert into address_report_reviews (customer_id, status, address, suggested, source, decided_by, decided_at)
         select upd.id, 'approved', $3::text, $3::text, $5::text, $4::text, now() from upd
         on conflict (customer_id) do update
            set status = 'approved', address = excluded.address, suggested = excluded.suggested, source = excluded.source,
                decided_by = excluded.decided_by, decided_at = now()
         returning customer_id
       )
       select (select count(*) from upd)::int as updated, (select count(*) from act)::int as logged`,
      [cur.id, data.expectedAddress, data.newAddress, who, source],
    );
    if (Number(res[0]?.updated ?? 0) === 1) return { status: "updated", account: summary(data.newAddress) };
    // Nothing was updated: someone changed the address in the meantime (or approved this same one a moment ago).
    const now = await readAccount(sql, cur.id);
    if (!now || now.archived) throw new Error("That account is no longer on the customer list.");
    if (shown(now.address) === data.newAddress) return { status: "already", account: { id: now.id, name: now.name, address: data.newAddress } };
    throw changedError(now.name);
  });

const accountInput = z.object({ accountId: z.number().int().positive() });

/**
 * Leave an account off the report until it is brought back. Changes nothing on the account. Safe to repeat. An approval
 * that still stands (the address is still the approved one) is never replaced: the account is already off the report,
 * and Bring Back would otherwise put it back on Open with its approval gone. An approval whose address has changed
 * since (the account is back on Open) can be skipped.
 */
export const skipAddressReportRow = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof accountInput>) => accountInput.parse(d))
  .handler(async ({ data, context }): Promise<{ status: "skipped" | "already" }> => {
    const sql = await ready();
    await requireEditor(sql, context.userId);
    const who = await actorName(sql, context.userId);
    const rows = await sql.query<{ customer_id: number }>(
      `insert into address_report_reviews (customer_id, status, address, decided_by, decided_at)
       select id, 'skipped', nullif(btrim(address), ''), $2::text, now()
         from directory_customers where id = $1::int and archived = false
       on conflict (customer_id) do update
          set status = 'skipped', address = excluded.address, suggested = null, source = null,
              decided_by = excluded.decided_by, decided_at = now()
        where address_report_reviews.status <> 'skipped'
          and not (address_report_reviews.status = 'approved'
                   and coalesce(btrim(address_report_reviews.address), '') = coalesce(btrim(excluded.address), ''))
       returning customer_id`,
      [data.accountId, who],
    );
    if (rows[0]) return { status: "skipped" };
    const now = (
      await sql.query<{ name: string; archived: boolean; status: string | null }>(
        `select d.name, d.archived, r.status
           from directory_customers d
           left join address_report_reviews r on r.customer_id = d.id
          where d.id = $1::int`,
        [data.accountId],
      )
    )[0];
    if (!now || now.archived) throw new Error("That account is no longer on the customer list.");
    // Not skipped and not written: the only other reason is an approval that still stands.
    if (now.status === "approved") throw new Error(`“${now.name}” already has an approved address, so there is nothing to skip.`);
    return { status: "already" };
  });

/** Bring a skipped account back to the report (the skip is removed). Safe to repeat. */
export const restoreAddressReportRow = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof accountInput>) => accountInput.parse(d))
  .handler(async ({ data, context }): Promise<{ status: "restored" | "already" }> => {
    const sql = await ready();
    await requireEditor(sql, context.userId);
    const rows = await sql.query<{ customer_id: number }>(
      "delete from address_report_reviews where customer_id = $1::int and status = 'skipped' returning customer_id",
      [data.accountId],
    );
    return { status: rows[0] ? "restored" : "already" };
  });
