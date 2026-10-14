/**
 * Map locations on customers, read from a Census-geocoded customer export (the NetSuite customer list with
 * Geocode Match, Match Type, Matched Address, Latitude and Longitude columns added).
 * Pure helpers shared by the server and the import preview.
 */
import { normalizeCustomerKey } from "./customer-key.ts";
import { accountNumberKey } from "./account-numbers.ts";

export type GeoRow = {
  line: number;
  account: string;
  internalId: string;
  name: string;
  /** Shipping address as it is in the file, for the review list. */
  address: string;
  /** Census result as written in the file: Match, Match (suite removed), Tie, No_Match, No address. */
  result: string;
  matchType: string;
  matchedAddress: string;
  latitude: number | null;
  longitude: number | null;
};

export type GeoAccount = {
  id: number;
  name: string;
  accountNumber?: string | null;
  netsuiteId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type GeoQuality = "exact" | "close" | "approx";

/** Match Type column → quality. */
export function qualityOf(matchType: string): GeoQuality {
  const t = matchType.trim();
  if (/^exact$/i.test(t)) return "exact";
  if (/^approx/i.test(t)) return "approx";
  return "close";
}

export type GeoStatus = "save" | "same" | "no_location" | "unmatched" | "conflict";

export type GeoPlanLine = {
  line: number;
  name: string;
  account: string;
  internalId: string;
  address: string;
  result: string;
  matchedAddress: string;
  latitude: number | null;
  longitude: number | null;
  /**
   * 'exact' or 'close' (Census Non_Exact) when the street address was found; 'approx' when only the ZIP code's
   * center is known (Match Type "Approximate"): good for grouping by area, never used for directions.
   */
  quality: GeoQuality | null;
  status: GeoStatus;
  accountId: number | null;
  accountName: string | null;
  matchedBy: "account number" | "internal ID" | "name" | "similar name" | null;
  reason: string;
  /** On the review list: no location, no account, a conflict, or only a close match. */
  review: boolean;
  reviewReason: string;
};

const num = (v: unknown): number | null => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** A row the geocoder placed: a Match result with coordinates that are real latitude / longitude. */
export function hasLocation(r: Pick<GeoRow, "result" | "latitude" | "longitude">): boolean {
  return (
    /^match\b/i.test(r.result.trim()) &&
    r.latitude !== null &&
    r.longitude !== null &&
    Math.abs(r.latitude) <= 90 &&
    Math.abs(r.longitude) <= 180 &&
    !(r.latitude === 0 && r.longitude === 0)
  );
}

/** Same point to about 10 cm, so re-reading the same file changes nothing. */
const samePoint = (a: number | null | undefined, b: number | null) =>
  a !== null && a !== undefined && b !== null && Math.abs(a - b) < 1e-6;

/** CSV / sheet cells → rows. Needs a header row with Name, Geocode Match, Latitude and Longitude columns. */
export function geoRowsFromMatrix(matrix: unknown[][]): GeoRow[] {
  const headerAt = matrix.findIndex(
    (r) => r.some((c) => /^latitude$/i.test(String(c ?? "").trim())) && r.some((c) => /^longitude$/i.test(String(c ?? "").trim())),
  );
  if (headerAt < 0) throw new Error("The file needs a header row with Latitude and Longitude columns (the geocoded customer list).");
  const head = matrix[headerAt]!.map((c) => String(c ?? "").trim().toLowerCase());
  const col = (re: RegExp) => head.findIndex((h) => re.test(h));
  const c = {
    name: col(/^(name|customer|customer name|company name)$/),
    account: col(/^(account|account number|account #|account_number)$/),
    internalId: col(/^internal id$/),
    result: col(/^geocode match$/),
    matchType: col(/^match type$/),
    matchedAddress: col(/^matched address$/),
    lat: col(/^latitude$/),
    lng: col(/^longitude$/),
    addr1: col(/^shipping address 1$/),
    addr2: col(/^shipping address 2$/),
    city: col(/^shipping city$/),
    state: col(/^shipping state/),
    zip: col(/^shipping zip$/),
  };
  if (c.name < 0) throw new Error("The file needs a Name column.");
  if (c.result < 0) throw new Error("The file needs a Geocode Match column.");
  const cell = (r: unknown[], i: number) => (i < 0 ? "" : String(r[i] ?? "").replace(/\s+/g, " ").trim());
  const out: GeoRow[] = [];
  matrix.slice(headerAt + 1).forEach((r, i) => {
    const name = cell(r, c.name);
    if (!name && !cell(r, c.account) && !cell(r, c.internalId)) return;
    const street = [cell(r, c.addr1), cell(r, c.addr2)].filter(Boolean).join(" ");
    const stateZip = [cell(r, c.state), cell(r, c.zip)].filter(Boolean).join(" ");
    out.push({
      line: headerAt + i + 2,
      account: cell(r, c.account),
      internalId: cell(r, c.internalId),
      name,
      address: [street, cell(r, c.city), stateZip].filter(Boolean).join(", "),
      result: cell(r, c.result),
      matchType: cell(r, c.matchType),
      matchedAddress: cell(r, c.matchedAddress),
      latitude: num(cell(r, c.lat)),
      longitude: num(cell(r, c.lng)),
    });
  });
  return out;
}

/** Why a row the geocoder did not place needs a person: the plain-English version of the Census result. */
function noLocationReason(r: GeoRow): string {
  const res = r.result.trim().toLowerCase();
  if (res === "no address" || !r.address) return "No shipping address in the file; add one in NetSuite";
  if (res === "tie") return "The geocoder found more than one place for this address; check the address";
  if (res === "no_match" || res === "no match") return "The geocoder could not find this address; check the spelling, suite and ZIP";
  if (/^match/.test(res)) return "Matched but the coordinates are missing or not valid";
  return `Geocoder result “${r.result || "blank"}”`;
}

/**
 * Preview for the import. Finds the account by account number, then the Internal ID (the clean-list NetSuite ID),
 * then the exact name (ignoring case), then the name ignoring punctuation when only one account has it.
 * Only rows with a location and exactly one account are saved. When two rows land on one account the surer link
 * wins and the other is listed as a likely duplicate; a tie is a conflict and neither is saved. Close (non-exact)
 * matches are saved and also put on the review list.
 */
export function planGeocodes(rows: GeoRow[], accounts: GeoAccount[]): GeoPlanLine[] {
  const byNumber = new Map<string, GeoAccount>();
  const byNetsuite = new Map<string, GeoAccount>();
  const byName = new Map<string, GeoAccount>();
  const byLoose = new Map<string, GeoAccount[]>();
  for (const a of accounts) {
    const n = accountNumberKey(a.accountNumber);
    if (n) byNumber.set(n, a);
    if (a.netsuiteId && String(a.netsuiteId).trim()) byNetsuite.set(String(a.netsuiteId).trim(), a);
    const nm = a.name.trim().toLowerCase();
    if (!byName.has(nm)) byName.set(nm, a);
    const k = normalizeCustomerKey(a.name);
    if (k) byLoose.set(k, [...(byLoose.get(k) ?? []), a]);
  }
  // When two rows land on one account, the surer link wins (account number, then Internal ID, then exact name,
  // then a similar name). Rows tied at the surest link are a conflict.
  const RANK: Record<NonNullable<GeoPlanLine["matchedBy"]>, number> = { "account number": 3, "internal ID": 2, name: 1, "similar name": 0 };
  const best = new Map<number, { rank: number; count: number }>();
  const found = rows.map((r) => {
    const loose = byLoose.get(normalizeCustomerKey(r.name)) ?? [];
    let acct: GeoAccount | undefined;
    let by: GeoPlanLine["matchedBy"] = null;
    if (r.account && (acct = byNumber.get(accountNumberKey(r.account)))) by = "account number";
    else if (r.internalId && (acct = byNetsuite.get(r.internalId.trim()))) by = "internal ID";
    else if (r.name && (acct = byName.get(r.name.trim().toLowerCase()))) by = "name";
    else if (loose.length === 1) [acct, by] = [loose[0], "similar name"];
    if (acct && by) {
      const cur = best.get(acct.id);
      const rank = RANK[by];
      if (!cur || rank > cur.rank) best.set(acct.id, { rank, count: 1 });
      else if (rank === cur.rank) cur.count += 1;
    }
    return { r, acct, by, ambiguous: !acct && loose.length > 1 };
  });
  return found.map(({ r, acct, by, ambiguous }) => {
    const located = hasLocation(r);
    const quality = located ? qualityOf(r.matchType) : null;
    const base = {
      line: r.line,
      name: r.name,
      account: r.account,
      internalId: r.internalId,
      address: r.address,
      result: r.result,
      matchedAddress: r.matchedAddress,
      latitude: located ? r.latitude : null,
      longitude: located ? r.longitude : null,
      quality,
      accountId: acct?.id ?? null,
      accountName: acct?.name ?? null,
      matchedBy: by,
    } as const;
    const closeNote =
      quality === "close"
        ? "Close (not exact) match; check the pin is the right building"
        : quality === "approx"
          ? "Street address not found; pinned at the ZIP code's center (approximate). Fix the address in NetSuite"
          : "";
    if (!acct) {
      const reason = ambiguous ? "More than one KatzDesk account has a name like this" : "No KatzDesk account with this account number, Internal ID or name";
      return { ...base, status: "unmatched" as const, reason, review: true, reviewReason: located ? reason : `${reason}. ${noLocationReason(r)}` };
    }
    const top = best.get(acct.id)!;
    if (by && RANK[by] < top.rank) {
      const reason = `Another row in the file is a surer match for “${acct.name}”; this row looks like a duplicate`;
      return { ...base, status: "unmatched" as const, reason, review: true, reviewReason: reason };
    }
    if (top.count > 1) {
      const reason = "This KatzDesk account is on more than one row in the file";
      return { ...base, status: "conflict" as const, reason, review: true, reviewReason: reason };
    }
    if (!located) {
      const reason = noLocationReason(r);
      return { ...base, status: "no_location" as const, reason, review: true, reviewReason: reason };
    }
    if (samePoint(acct.latitude, base.latitude) && samePoint(acct.longitude, base.longitude)) {
      return { ...base, status: "same" as const, reason: "Already saved; nothing changes", review: quality !== "exact", reviewReason: closeNote };
    }
    const reason = acct.latitude != null ? "Will replace the saved location" : "Will be saved";
    return { ...base, status: "save" as const, reason, review: quality !== "exact", reviewReason: closeNote };
  });
}

export type GeoCounts = Record<GeoStatus, number> & { review: number };

export function countGeocodes(lines: GeoPlanLine[]): GeoCounts {
  const c: GeoCounts = { save: 0, same: 0, no_location: 0, unmatched: 0, conflict: 0, review: 0 };
  for (const l of lines) {
    c[l.status] += 1;
    if (l.review) c.review += 1;
  }
  return c;
}

const REVIEW_ORDER: Record<GeoStatus, number> = { no_location: 0, unmatched: 1, conflict: 2, save: 3, same: 3 };

/** The review list as CSV: every row that needs a person, worst first. Opens in Excel (UTF-8 with BOM). */
export function reviewCsv(lines: GeoPlanLine[]): string {
  const head = ["Line", "Name", "Account", "Internal ID", "KatzDesk account", "Matched by", "Shipping address", "Geocoder result", "Matched address", "Latitude", "Longitude", "Saved", "What to check"];
  const q = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = lines
    .filter((l) => l.review)
    .sort((a, b) => REVIEW_ORDER[a.status] - REVIEW_ORDER[b.status] || a.line - b.line)
    .map((l) =>
      [
        l.line,
        l.name,
        l.account,
        l.internalId,
        l.accountName ?? "",
        l.matchedBy ?? "",
        l.address,
        l.result,
        l.matchedAddress,
        l.latitude ?? "",
        l.longitude ?? "",
        l.status === "save" || l.status === "same" ? "Yes" : "No",
        l.reviewReason,
      ]
        .map(q)
        .join(","),
    );
  return "﻿" + [head.join(","), ...rows].join("\r\n") + "\r\n";
}
