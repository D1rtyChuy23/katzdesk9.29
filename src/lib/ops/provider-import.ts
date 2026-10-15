/**
 * Out Of Network → Import Providers: the cleaned provider list (CSV or Excel, one row per provider location) with
 * cleaned names, merges of duplicates, contact fields, web site and the Census-geocoded shop address (the map pin).
 * Pure planning shared by the server and the preview: no I/O, no DOM.
 *
 * Rules: a blank cell never clears what KatzDesk has. A row finds its provider by Provider ID, then Current Name, then
 * Name (ignoring case and spaces at the ends). Merge Into names the cleaned Name of another row kept in the file; the
 * duplicate's customers, contacts, addresses and coverage move to that provider and the duplicate is archived (never
 * deleted). Rows that are not in KatzDesk are added only when they have a Name and "Add new providers" is ticked.
 */
import {
  formatAddress,
  normalizeCity,
  normalizeState,
  normalizeZip,
  PROVIDER_STATUSES,
  US_STATE_OPTIONS,
  websiteHref,
  type ProviderRole,
} from "./network.ts";
import { isPoint, type PinQuality } from "./geo.ts";

/** Header row of the import file, in order (the file contract). */
export const PROVIDER_IMPORT_HEADER = [
  "Provider ID",
  "Current Name",
  "Name",
  "Merge Into",
  "Status",
  "Address",
  "City",
  "State",
  "ZIP",
  "Dispatch Phone",
  "Dispatch Email",
  "Website",
  "Coverage",
  "Latitude",
  "Longitude",
  "Match Type",
  "Matched Address",
  "Verified",
  "Notes",
] as const;

/** Up to this many rows in one file. */
export const MAX_PROVIDER_ROWS = 2000;

export type ProviderImportRow = {
  /** Spreadsheet line (the header is line 1 when it is the first row). */
  line: number;
  providerId: number | null;
  currentName: string;
  name: string;
  mergeInto: string;
  status: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  dispatchPhone: string;
  dispatchEmail: string;
  website: string;
  coverage: string;
  latitude: number | null;
  longitude: number | null;
  matchType: string;
  matchedAddress: string;
  verified: string;
  notes: string;
};

/** A provider's address as the planner needs it. */
export type ImportAddress = {
  id: number;
  label: string | null;
  line1: string | null;
  line2?: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
  quality: PinQuality | null;
  geocodeAddress?: string | null;
};

/** A provider in KatzDesk as the planner needs it (archived ones too, so a merge already done is recognised). */
export type ImportProvider = {
  id: number;
  name: string;
  archived: boolean;
  mergedInto: number | null;
  status: string | null;
  dispatchPhone: string | null;
  dispatchEmail: string | null;
  website: string | null;
  coverage: string | null;
  addresses: ImportAddress[];
  /** Customer assignments (lower-case customer name and role), for the merge counts. */
  assignments: { customer: string; role: ProviderRole }[];
  contacts: number;
  coverageRows: number;
  /** The structured contacts, so a merge can drop the duplicate's copies of contacts the keeper already has. */
  people?: ImportContact[];
  /** The provider's other text fields (column → value), so a merge can fill the keeper's blank ones. */
  texts?: Partial<Record<MergeFillColumn, string | null>>;
};

/** A provider's contact as the merge needs it. */
export type ImportContact = { id: number; name: string | null; role: string | null; phone: string | null; email: string | null };

/**
 * Text fields a merge copies from the duplicate onto the keeper when the keeper's is blank (never over a value), in
 * the words the import uses. Column names are fixed here (they go into the SQL as written).
 */
export const MERGE_FILL_FIELDS = [
  ["dispatch_phone", "Dispatch Phone"],
  ["dispatch_email", "Dispatch Email"],
  ["website", "Website"],
  ["coverage", "Coverage"],
  ["secondary_phone", "Secondary Phone"],
  ["secondary_email", "Secondary Email"],
  ["response_time", "Response Time"],
  ["standard_rate", "Standard Rate"],
  ["after_hours_rate", "After Hours Rate"],
  ["travel_policy", "Travel Policy"],
  ["equipment_serviced", "Equipment Serviced"],
  ["pm_pricing", "PM Pricing"],
  ["parts_stocking", "Parts Stocking"],
  ["contacts", "Contacts"],
  ["notes", "Notes"],
] as const;

export type MergeFillColumn = (typeof MERGE_FILL_FIELDS)[number][0];

export type FieldKey = "name" | "status" | "dispatchPhone" | "dispatchEmail" | "website" | "coverage";

export const FIELD_LABEL: Record<FieldKey, string> = {
  name: "Name",
  status: "Status",
  dispatchPhone: "Dispatch Phone",
  dispatchEmail: "Dispatch Email",
  website: "Website",
  coverage: "Coverage",
};

const FIELD_ORDER: FieldKey[] = ["name", "status", "dispatchPhone", "dispatchEmail", "website", "coverage"];

export type FieldChange = { field: FieldKey; label: string; from: string | null; to: string };

export type ProviderPlanStatus = "update" | "merge" | "new" | "same" | "unmatched" | "conflict";

export type PinPlan = {
  /** The address from the file, as one line. */
  address: string;
  line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  /** exact / close (Census Non_Exact) / approx (ZIP area: approximate, never a driving target); null = no pin. */
  quality: PinQuality | null;
  matchType: string;
  matchedAddress: string;
  latitude: number | null;
  longitude: number | null;
  /** main: the provider's shop (labelled Main). extra: another location on a second row for the same provider. */
  role: "main" | "extra";
  /** The address row this updates; null = a new address row. */
  targetId: number | null;
  action: "add" | "update" | "same";
  /** The address changed and the file has no pin for it: the old pin is removed so it never points at the old place. */
  clearPin: boolean;
  /**
   * The row was taken over only because it is the Main address with no street yet: the file's address replaces it
   * whole (street, suite, city, state and ZIP, blanks included), so no part of the old address is left behind.
   */
  replace: boolean;
  /** The street changes: the old suite / unit line (line 2) is cleared so it is not attached to the new street. */
  clearLine2: boolean;
};

export type MergePlan = {
  keeperId: number;
  keeperName: string;
  keeperLine: number;
  /** Customer assignments on the duplicate, and how many of those customers the keeper already has. */
  assignments: number;
  overlapping: number;
  contacts: number;
  /** The duplicate's contacts and addresses the keeper already has: those copies are dropped, not moved. */
  contactDupes: number;
  addresses: number;
  addressDupes: number;
  coverage: number;
  /** The keeper's blank text fields that take the duplicate's value (labels, e.g. "Coverage"). */
  fills: string[];
  /** [duplicate's row id, keeper's row id] for each contact / address the keeper already has. */
  contactPairs: [number, number][];
  addressPairs: [number, number][];
};

export type ProviderPlanLine = {
  line: number;
  /** Name in the file (Name, else Current Name). */
  fileName: string;
  providerId: number | null;
  providerName: string | null;
  matchedBy: "provider ID" | "current name" | "name" | null;
  status: ProviderPlanStatus;
  changes: FieldChange[];
  pin: PinPlan | null;
  merge: MergePlan | null;
  verified: string;
  notes: string;
  reason: string;
  /** Cells that were not used (an unknown status, a web site that is not a web address, …). */
  warnings: string[];
  /** Not in KatzDesk but has a Name: becomes New when "Add new providers" is ticked. */
  canAdd: boolean;
};

export type ProviderPlanCounts = Record<ProviderPlanStatus, number>;

// ---------------------------------------------------------------------------------------------------------------
// Reading the file

const num = (v: string): number | null => {
  const s = v.trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const COLUMNS: Record<Exclude<keyof ProviderImportRow, "line">, RegExp> = {
  providerId: /^(provider id|provider_id|providerid|id)$/,
  currentName: /^(current name|current_name|name in katzdesk|app name)$/,
  name: /^(name|clean name|cleaned name|provider name|provider)$/,
  mergeInto: /^(merge into|merge_into|merge)$/,
  status: /^status$/,
  address: /^(address|street|street address|address 1|address line 1)$/,
  city: /^city$/,
  state: /^(state|st)$/,
  zip: /^(zip|zip code|zipcode|postal code)$/,
  dispatchPhone: /^(dispatch phone|phone)$/,
  dispatchEmail: /^(dispatch email|email)$/,
  website: /^(website|web site|url|web)$/,
  coverage: /^coverage$/,
  latitude: /^(latitude|lat)$/,
  longitude: /^(longitude|lng|lon|long)$/,
  matchType: /^match type$/,
  matchedAddress: /^matched address$/,
  verified: /^verified$/,
  notes: /^notes?$/,
};

/** CSV / sheet cells → rows. Needs a header row with a Name or Current Name column (the contract header). */
export function providerRowsFromMatrix(matrix: unknown[][]): ProviderImportRow[] {
  const norm = (c: unknown) => String(c ?? "").replace(/^\uFEFF/, "").replace(/\s+/g, " ").trim().toLowerCase();
  const headerAt = matrix.findIndex((r) => r.some((c) => COLUMNS.name.test(norm(c)) || COLUMNS.currentName.test(norm(c))));
  if (headerAt < 0) throw new Error("The file needs a header row with a Name or Current Name column (the provider import layout).");
  const head = matrix[headerAt]!.map(norm);
  const col = {} as Record<keyof typeof COLUMNS, number>;
  for (const k of Object.keys(COLUMNS) as (keyof typeof COLUMNS)[]) col[k] = head.findIndex((h) => COLUMNS[k].test(h));
  // Cells are trimmed and capped (a short field at 300 characters, Coverage and Notes at 4,000).
  const cell = (r: unknown[], i: number, max = 300) => (i < 0 ? "" : String(r[i] ?? "").replace(/\s+/g, " ").trim().slice(0, max));
  // Coverage and Notes keep their line breaks (some providers list ZIPs per state on separate lines).
  const longCell = (r: unknown[], i: number) =>
    i < 0 ? "" : String(r[i] ?? "").replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 4000);
  const out: ProviderImportRow[] = [];
  matrix.slice(headerAt + 1).forEach((r, i) => {
    const idRaw = cell(r, col.providerId);
    const id = /^\d+$/.test(idRaw) ? Number(idRaw) : null;
    const currentName = cell(r, col.currentName);
    const name = cell(r, col.name);
    if (!idRaw && !currentName && !name) return;
    out.push({
      line: headerAt + i + 2,
      providerId: id && id > 0 && id < 2_147_483_647 ? id : null,
      currentName,
      name,
      mergeInto: cell(r, col.mergeInto),
      status: cell(r, col.status, 60),
      address: cell(r, col.address),
      city: cell(r, col.city, 120),
      state: cell(r, col.state, 60),
      zip: cell(r, col.zip, 20),
      dispatchPhone: cell(r, col.dispatchPhone),
      dispatchEmail: cell(r, col.dispatchEmail),
      website: cell(r, col.website, 500),
      coverage: longCell(r, col.coverage),
      latitude: num(cell(r, col.latitude)),
      longitude: num(cell(r, col.longitude)),
      matchType: cell(r, col.matchType, 60),
      matchedAddress: cell(r, col.matchedAddress),
      verified: cell(r, col.verified, 60),
      notes: longCell(r, col.notes),
    });
  });
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Values

/**
 * Match Type → pin quality, in the words the customer Locations import understands: Exact → exact, Non_Exact → close,
 * ZIP area (or Approximate) → approx. No_Match, a blank type without coordinates, or coordinates that are not a real
 * place → no pin. Coordinates with a blank or unknown type count as a close match (check the pin).
 */
export function pinQualityOf(matchType: string, latitude: number | null, longitude: number | null): PinQuality | null {
  const t = matchType.trim().toLowerCase().replace(/[\s_-]+/g, " ");
  if (/^no ?match$/.test(t) || t === "tie" || t === "no address") return null;
  if (!isPoint({ lat: latitude, lng: longitude })) return null;
  if (t === "exact") return "exact";
  if (t === "non exact" || t === "nonexact" || t === "close") return "close";
  if (/^zip( code)? ?area$/.test(t) || /^approx/.test(t) || t === "zip") return "approx";
  return "close";
}

/** Same point to about 10 cm. */
const samePoint = (a: number | null | undefined, b: number | null | undefined) =>
  a != null && b != null && Math.abs(a - b) < 1e-6;

const STATE_BY_NAME = new Map(US_STATE_OPTIONS.map((s) => [s.name.toLowerCase(), s.code]));

/** "TX", "tx" or "Texas" → "TX". */
export function stateCode(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").trim();
  return normalizeState(s) ?? STATE_BY_NAME.get(s.toLowerCase()) ?? null;
}

const STREET_WORDS: Record<string, string> = {
  street: "st", avenue: "ave", av: "ave", road: "rd", drive: "dr", lane: "ln", boulevard: "blvd", parkway: "pkwy",
  highway: "hwy", court: "ct", place: "pl", circle: "cir", suite: "ste", unit: "ste", north: "n", south: "s",
  east: "e", west: "w", northeast: "ne", northwest: "nw", southeast: "se", southwest: "sw", freeway: "fwy",
  expressway: "expy", terrace: "ter", trail: "trl", square: "sq", building: "bldg", business: "bus",
};

/** Street line compare key: lower case, no punctuation, common words shortened ("Suite" = "Ste", "Road" = "Rd"). */
export function streetKey(line: string | null | undefined): string {
  return String(line ?? "")
    .toLowerCase()
    .replace(/#/g, " ste ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((w) => STREET_WORDS[w] ?? w)
    .join(" ");
}

const zip5 = (z: string | null | undefined) => (normalizeZip(z) ?? "").slice(0, 5);

const DIRECTIONS = new Set(["n", "s", "e", "w", "ne", "nw", "se", "sw"]);
/** Words that start the unit part of a street line (after streetKey: "Suite", "Unit" and "#" are all "ste"). */
const UNIT_WORDS = new Set(["ste", "apt", "bldg", "fl", "floor", "rm", "room", "pmb", "lot", "spc", "space", "dept", "box"]);
const STREET_TYPES = new Set([
  "st", "ave", "rd", "dr", "ln", "blvd", "pkwy", "hwy", "ct", "pl", "cir", "fwy", "expy", "ter", "trl", "sq", "way", "loop", "pike", "row",
]);

/**
 * A street key split into its house number, direction words and street name ("100 N Main St Ste 4" → 100, [n],
 * [main]). The unit part is dropped, and so is the street type at the end ("St", "Pkwy"), which listings often disagree on.
 */
function streetParts(key: string): { house: string | null; dirs: string; name: string } {
  const words = key.split(" ").filter(Boolean);
  const house = /^\d+[a-z]?$/.test(words[0] ?? "") ? words.shift()! : null;
  // "Ste 4", and a unit written as one word ("PMB358", "Ste10").
  const cut = words.findIndex((w) => UNIT_WORDS.has(w) || /^(ste|apt|pmb|bldg|rm|lot|spc)\d+[a-z]?$/.test(w));
  const body = cut >= 0 ? words.slice(0, cut) : words;
  const dirs = body.filter((w) => DIRECTIONS.has(w)).sort().join(" ");
  const name = body.filter((w) => !DIRECTIONS.has(w));
  if (name.length > 1 && STREET_TYPES.has(name[name.length - 1]!)) name.pop();
  // A plural "s" is a common spelling slip ("Meadowlands Dr" for Meadowland Dr) and is not counted.
  return { house, dirs, name: name.map((w) => (w.length > 3 ? w.replace(/s$/, "") : w)).join(" ") };
}

/** The same place: same ZIP and the same street (or the same house number), else the same street in the same city. */
export function sameAddress(
  a: { line1?: string | null; city?: string | null; zip?: string | null },
  b: { line1?: string | null; city?: string | null; zip?: string | null },
): boolean {
  const ka = streetKey(a.line1);
  const kb = streetKey(b.line1);
  const za = zip5(a.zip);
  const zb = zip5(b.zip);
  const ca = String(a.city ?? "").trim().toLowerCase();
  const cb = String(b.city ?? "").trim().toLowerCase();
  if (za && zb) {
    if (za !== zb) return false;
    if (ka && kb) {
      if (ka === kb) return true;
      // Same house number and the same street name words (a suite, the street type and a missing direction aside):
      // "100 Main St Ste 4" = "100 Main Street", but "100 N Main St" ≠ "100 N Lamar Blvd" and "100 E 5th" ≠ "100 W 5th".
      const pa = streetParts(ka);
      const pb = streetParts(kb);
      if (!pa.house || pa.house !== pb.house || !pa.name || pa.name !== pb.name) return false;
      return !pa.dirs || !pb.dirs || pa.dirs === pb.dirs;
    }
    // Same ZIP and only one side has a street (e.g. "Combes, TX 78535" read from the contacts): the same place, less
    // complete. The street fills in.
    return !ka || !kb ? !ca || !cb || ca === cb : true;
  }
  return !!ka && ka === kb && (!ca || !cb || ca === cb);
}

/** The address text is the same (street, city, state, ZIP), so only the pin could change. */
function sameAddressText(
  a: { line1?: string | null; city?: string | null; state?: string | null; zip?: string | null },
  b: { line1?: string | null; city?: string | null; state?: string | null; zip?: string | null },
): boolean {
  return (
    streetKey(a.line1) === streetKey(b.line1) &&
    String(a.city ?? "").trim().toLowerCase() === String(b.city ?? "").trim().toLowerCase() &&
    (stateCode(a.state) ?? "") === (stateCode(b.state) ?? "") &&
    (normalizeZip(a.zip) ?? "") === (normalizeZip(b.zip) ?? "")
  );
}

/**
 * A merge's "the keeper already has this address": the same street line (punctuation and common words aside) and no
 * disagreement on city, state or ZIP (a blank one is not a disagreement). Two street-less addresses must share a city
 * or ZIP.
 */
export function sameMergeAddress(
  a: { line1?: string | null; city?: string | null; state?: string | null; zip?: string | null },
  b: { line1?: string | null; city?: string | null; state?: string | null; zip?: string | null },
): boolean {
  const ka = streetKey(a.line1);
  if (ka !== streetKey(b.line1)) return false;
  const za = zip5(a.zip);
  const zb = zip5(b.zip);
  const ca = String(a.city ?? "").trim().toLowerCase();
  const cb = String(b.city ?? "").trim().toLowerCase();
  const sa = stateCode(a.state);
  const sb = stateCode(b.state);
  if ((za && zb && za !== zb) || (ca && cb && ca !== cb) || (sa && sb && sa !== sb)) return false;
  return !!ka || (!!ca && ca === cb) || (!!za && za === zb);
}

/** A merge's "the keeper already has this contact": the same name, phone digits and email (case and spacing aside). */
const contactKey = (c: { name: string | null; phone: string | null; email: string | null }) =>
  [String(c.name ?? "").trim().replace(/\s+/g, " ").toLowerCase(), String(c.phone ?? "").replace(/\D/g, ""), String(c.email ?? "").trim().toLowerCase()].join("|");

const nameKey = (s: string | null | undefined) => String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
const collapse = (s: string | null | undefined) => String(s ?? "").replace(/\s+/g, " ").trim();
const websiteKey = (s: string | null | undefined) =>
  String(s ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");

/** Canonical status ("active" → "Active"), or null when it is not one of the four. */
export function statusOf(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  return PROVIDER_STATUSES.find((x) => x.toLowerCase() === s) ?? null;
}

/** Same value for this field, ignoring what does not matter (case in emails, "https://www." on web sites, spacing). */
function sameValue(field: FieldKey, a: string | null | undefined, b: string | null | undefined): boolean {
  if (field === "dispatchEmail") return collapse(a).toLowerCase() === collapse(b).toLowerCase();
  if (field === "website") return websiteKey(a) === websiteKey(b);
  if (field === "status") return collapse(a).toLowerCase() === collapse(b).toLowerCase();
  return collapse(a) === collapse(b);
}

/** The file's value for a field, cleaned; null when the cell is blank or cannot be used (with a warning). */
function fileValue(row: ProviderImportRow, field: FieldKey, warnings: string[]): string | null {
  switch (field) {
    case "name":
      return collapse(row.name) || null;
    case "status": {
      if (!row.status.trim()) return null;
      const s = statusOf(row.status);
      if (!s) warnings.push(`Status “${row.status}” is not one of ${PROVIDER_STATUSES.join(", ")}; left as is`);
      return s;
    }
    case "dispatchPhone":
      return collapse(row.dispatchPhone) || null;
    case "dispatchEmail": {
      const e = collapse(row.dispatchEmail);
      if (!e) return null;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
        warnings.push(`Dispatch Email “${e}” is not an email address; left as is`);
        return null;
      }
      return e;
    }
    case "website": {
      const w = row.website.trim();
      if (!w) return null;
      if (!websiteHref(w)) {
        warnings.push(`Website “${w}” is not a web address; left as is`);
        return null;
      }
      return w.replace(/\/+$/, "");
    }
    case "coverage":
      return row.coverage.trim() || null;
  }
}

/** A text field the merge fills (the planner's own fields first, then the extra texts loaded for merges). */
function fillText(p: ImportProvider, col: MergeFillColumn): string | null {
  if (col === "dispatch_phone") return p.dispatchPhone;
  if (col === "dispatch_email") return p.dispatchEmail;
  if (col === "website") return p.website;
  if (col === "coverage") return p.coverage;
  return p.texts?.[col] ?? null;
}

const providerValue = (p: ImportProvider, field: FieldKey): string | null =>
  field === "name" ? p.name : field === "status" ? p.status : field === "dispatchPhone" ? p.dispatchPhone : field === "dispatchEmail" ? p.dispatchEmail : field === "website" ? p.website : p.coverage;

/** The file's address and pin, or null when the row has no street or city. */
function filePin(row: ProviderImportRow): Omit<PinPlan, "role" | "targetId" | "action" | "clearPin" | "replace" | "clearLine2"> | null {
  const line1 = collapse(row.address) || null;
  const city = normalizeCity(row.city);
  const state = stateCode(row.state);
  const zip = normalizeZip(row.zip);
  if (!line1 && !city) return null;
  const quality = pinQualityOf(row.matchType, row.latitude, row.longitude);
  return {
    address: formatAddress({ line1, city, state, zip }),
    line1,
    city,
    state,
    zip,
    quality,
    matchType: row.matchType,
    matchedAddress: row.matchedAddress,
    latitude: quality ? row.latitude : null,
    longitude: quality ? row.longitude : null,
  };
}

const isMain = (a: { label: string | null }) => (a.label ?? "").trim().toLowerCase() === "main";

// ---------------------------------------------------------------------------------------------------------------
// Planning

type Resolved = {
  row: ProviderImportRow;
  target: ImportProvider | null;
  matchedBy: ProviderPlanLine["matchedBy"];
  idMissing: boolean;
  /** The Provider ID points at a provider whose name is neither the Current Name nor the Name: a Conflict, never saved. */
  idClash: string | null;
};

/**
 * The preview. Every row gets one status: Will Update, Will Merge, New, No Change, Unmatched or Conflict.
 * Rows that land on the same provider are one group: the first row's address is the provider's main address (the pin),
 * a later row with another address adds that location, a later row with the same address is a repeat (No Change), and
 * two rows that set different values for the same field are a conflict (neither is saved).
 */
export function planProviderImport(rows: ProviderImportRow[], providers: ImportProvider[], opts: { addNew?: boolean } = {}): ProviderPlanLine[] {
  const addNew = !!opts.addNew;
  const byId = new Map(providers.map((p) => [p.id, p]));
  const activeByName = new Map<string, ImportProvider>();
  const archivedByName = new Map<string, ImportProvider>();
  for (const p of providers) {
    const k = nameKey(p.name);
    if (!k) continue;
    if (!p.archived) {
      if (!activeByName.has(k)) activeByName.set(k, p);
    } else {
      // A merged duplicate is preferred, then the newest (highest id).
      const cur = archivedByName.get(k);
      if (!cur || (p.mergedInto != null && cur.mergedInto == null) || ((p.mergedInto != null) === (cur.mergedInto != null) && p.id > cur.id)) archivedByName.set(k, p);
    }
  }

  const resolved: Resolved[] = rows.map((row) => {
    let target: ImportProvider | null = null;
    let matchedBy: ProviderPlanLine["matchedBy"] = null;
    let idMissing = false;
    let idClash: string | null = null;
    if (row.providerId != null) {
      target = byId.get(row.providerId) ?? null;
      if (target) {
        matchedBy = "provider ID";
        // An ID from another database or a stale export can point at a different provider than the name says. The
        // cleaned Name also counts (the provider was already renamed by an earlier Save of this file).
        const cur = nameKey(row.currentName);
        if (cur && cur !== nameKey(target.name) && nameKey(row.name) !== nameKey(target.name)) {
          idClash = `Provider ID ${row.providerId} is “${target.name}”, not “${collapse(row.currentName)}”; fix the ID or the Current Name`;
        }
      } else idMissing = true;
    }
    if (!target && row.currentName && (target = activeByName.get(nameKey(row.currentName)) ?? null)) matchedBy = "current name";
    // A merge row's Current Name may be a duplicate this import already archived: find it before the Name (which is
    // usually the keeper's name), so the merge reads as done instead of as a merge into itself.
    const merging = !!row.mergeInto.trim();
    if (!target && merging && row.currentName && (target = archivedByName.get(nameKey(row.currentName)) ?? null)) matchedBy = "current name";
    if (!target && row.name && (target = activeByName.get(nameKey(row.name)) ?? null)) matchedBy = "name";
    if (!target && row.currentName && (target = archivedByName.get(nameKey(row.currentName)) ?? null)) matchedBy = "current name";
    // A Name that was merged into another provider: the row is about that duplicate (never added again as new).
    if (!target && !merging && row.name) {
      const gone = archivedByName.get(nameKey(row.name));
      if (gone && gone.mergedInto != null) {
        target = gone;
        matchedBy = "name";
      }
    }
    return { row, target, matchedBy, idMissing, idClash };
  });

  const out = new Map<number, ProviderPlanLine>();
  const base = (r: Resolved, warnings: string[] = []): ProviderPlanLine => ({
    line: r.row.line,
    // A merge row's Name is usually the keeper's; the row is about the duplicate, so show its current name.
    fileName: r.row.mergeInto.trim() ? collapse(r.row.currentName) || collapse(r.row.name) : collapse(r.row.name) || collapse(r.row.currentName),
    providerId: r.target?.id ?? null,
    providerName: r.target?.name ?? null,
    matchedBy: r.matchedBy,
    status: "same",
    changes: [],
    pin: null,
    merge: null,
    verified: r.row.verified,
    notes: r.row.notes,
    reason: "",
    warnings: r.idMissing ? [`Provider ID ${r.row.providerId} is not in KatzDesk${r.target ? `; matched by ${r.matchedBy}` : ""}`, ...warnings] : warnings,
    canAdd: false,
  });
  const set = (r: Resolved, patch: Partial<ProviderPlanLine>) => out.set(r.row.line, { ...(out.get(r.row.line) ?? base(r)), ...patch });

  for (const r of resolved) if (r.idClash) set(r, { ...base(r), status: "conflict", reason: r.idClash });
  const merges = resolved.filter((r) => !r.idClash && r.row.mergeInto.trim());
  const kept = resolved.filter((r) => !r.idClash && !r.row.mergeInto.trim());
  const effName = (r: Resolved) => nameKey(r.row.name || r.row.currentName);
  const keptByName = new Map<string, Resolved[]>();
  for (const r of kept) {
    const k = effName(r);
    if (k) keptByName.set(k, [...(keptByName.get(k) ?? []), r]);
  }
  const mergeNames = new Set(merges.map(effName).filter(Boolean));
  const keptTargetIds = new Set(kept.filter((r) => r.target && !r.target.archived).map((r) => r.target!.id));

  // ---- Merges: duplicate → keeper.
  type Cand = { r: Resolved; dup: ImportProvider; keeper: ImportProvider; keeperRow: Resolved };
  const cands: Cand[] = [];
  for (const r of merges) {
    const into = nameKey(r.row.mergeInto);
    const extra = FIELD_ORDER.some((f) => f !== "name" && fileValue(r.row, f, []) != null) || !!filePin(r.row);
    const warnings = extra ? ["Only the merge is done on this row; its other columns are not used (put them on the row it merges into)"] : [];
    if (!r.target) {
      set(r, { ...base(r, warnings), status: "unmatched", reason: "No provider in KatzDesk with this ID or name to merge" });
      continue;
    }
    let keepers = (keptByName.get(into) ?? []).filter((k) => k.target);
    // Also accept the keeper's current name (the row may rename it), when only one kept row has it.
    if (!keepers.length && !(keptByName.get(into) ?? []).length) {
      keepers = kept.filter((k) => k.target && (nameKey(k.row.currentName) === into || nameKey(k.target.name) === into));
    }
    const keeperIds = new Set(keepers.map((k) => k.target!.id));
    if (!keepers.length) {
      const reason = (keptByName.get(into) ?? []).length
        ? `“${r.row.mergeInto}” is not in KatzDesk yet; add it first, then merge into it`
        : mergeNames.has(into)
          ? `“${r.row.mergeInto}” is itself merged into another provider; merge into that one instead (no chains)`
          : `Merge Into “${r.row.mergeInto}” does not match the Name of a provider kept in this file`;
      set(r, { ...base(r, warnings), status: "conflict", reason });
      continue;
    }
    if (keeperIds.size > 1) {
      set(r, { ...base(r, warnings), status: "conflict", reason: `More than one row in the file is named “${r.row.mergeInto}”` });
      continue;
    }
    const keeperRow = keepers[0]!;
    const keeper = keeperRow.target!;
    if (keeper.id === r.target.id) {
      // An earlier Save of this file may have renamed the keeper to this duplicate's name: the duplicate is archived and
      // points at the keeper, so the merge is done.
      const done = r.row.currentName ? archivedByName.get(nameKey(r.row.currentName)) : undefined;
      if (done && done.mergedInto === keeper.id) {
        set(r, { ...base({ ...r, target: done, matchedBy: "current name" }, warnings), status: "same", reason: `Already merged into “${keeper.name}”` });
      } else {
        set(r, { ...base(r, warnings), status: "conflict", reason: "A provider cannot be merged into itself" });
      }
      continue;
    }
    if (r.target.archived) {
      if (r.target.mergedInto === keeper.id) set(r, { ...base(r, warnings), status: "same", reason: `Already merged into “${keeper.name}”` });
      else set(r, { ...base(r, warnings), status: "unmatched", reason: "This provider was already removed from Out of Network" });
      continue;
    }
    if (keeper.archived) {
      set(r, { ...base(r, warnings), status: "conflict", reason: `“${keeper.name}” was removed from Out of Network; it cannot take a merge` });
      continue;
    }
    set(r, base(r, warnings));
    cands.push({ r, dup: r.target, keeper, keeperRow });
  }
  // A duplicate merged into two different providers, a provider both kept and merged, or a chain (the keeper is itself
  // merged away): conflicts. The same merge twice: the later row is a repeat.
  const byDup = new Map<number, Cand[]>();
  for (const c of cands) byDup.set(c.dup.id, [...(byDup.get(c.dup.id) ?? []), c]);
  const dupIds = new Set(cands.map((c) => c.dup.id));
  const keptConflicts = new Map<number, string>();
  for (const [dupId, list] of byDup) {
    const keeperSet = new Set(list.map((c) => c.keeper.id));
    if (keeperSet.size > 1) {
      for (const c of list) set(c.r, { status: "conflict", reason: `Lines ${list.map((x) => x.r.row.line).join(" and ")} merge this provider into different providers` });
      continue;
    }
    if (keptTargetIds.has(dupId)) {
      const keepLines = kept.filter((k) => k.target?.id === dupId).map((k) => k.row.line);
      for (const c of list) set(c.r, { status: "conflict", reason: `Line ${keepLines.join(", ")} keeps this provider; it cannot also be merged` });
      keptConflicts.set(dupId, `Line ${list.map((c) => c.r.row.line).join(", ")} merges this provider into another; it cannot also be kept`);
      continue;
    }
    list.forEach((c, i) => {
      if (dupIds.has(c.keeper.id)) {
        set(c.r, { status: "conflict", reason: `“${c.keeper.name}” is itself merged into another provider on this file; merge into that one instead (no chains)` });
        return;
      }
      if (i > 0) {
        set(c.r, { status: "same", reason: `Same merge as line ${list[0]!.r.row.line}` });
        return;
      }
      const keeperCustomers = new Set(c.keeper.assignments.map((a) => a.customer.toLowerCase()));
      // The duplicate's copies of contacts and addresses the keeper already has are dropped, not moved.
      const keeperPeople = new Map((c.keeper.people ?? []).map((p) => [contactKey(p), p.id]));
      const contactPairs: [number, number][] = [];
      for (const p of c.dup.people ?? []) {
        const k = keeperPeople.get(contactKey(p));
        if (k != null) contactPairs.push([p.id, k]);
      }
      const addressPairs: [number, number][] = [];
      for (const a of c.dup.addresses) {
        const k = c.keeper.addresses.find((x) => sameMergeAddress(x, a));
        if (k) addressPairs.push([a.id, k.id]);
      }
      set(c.r, {
        status: "merge",
        reason: `Merge into “${c.keeper.name}” and archive this duplicate`,
        merge: {
          keeperId: c.keeper.id,
          keeperName: c.keeper.name,
          keeperLine: c.keeperRow.row.line,
          assignments: c.dup.assignments.length,
          overlapping: c.dup.assignments.filter((a) => keeperCustomers.has(a.customer.toLowerCase())).length,
          contacts: c.dup.contacts,
          contactDupes: contactPairs.length,
          addresses: c.dup.addresses.length,
          addressDupes: addressPairs.length,
          coverage: c.dup.coverageRows,
          fills: MERGE_FILL_FIELDS.filter(([col]) => !collapse(fillText(c.keeper, col)) && collapse(fillText(c.dup, col))).map(([, label]) => label),
          contactPairs,
          addressPairs,
        },
      });
    });
  }
  // Providers this file merges away (or already merged): their names are free for a rename.
  const mergedAway = new Set<number>();
  for (const r of merges) {
    const l = out.get(r.row.line);
    if (l && r.target && (l.status === "merge" || (l.status === "same" && r.target.archived))) mergedAway.add(r.target.id);
  }

  // ---- Kept rows, grouped by the provider they land on.
  const groups = new Map<string, Resolved[]>();
  for (const r of kept) {
    const key = r.target ? `p:${r.target.id}` : nameKey(r.row.name) ? `n:${nameKey(r.row.name)}` : `l:${r.row.line}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  // Names each group ends up with, to catch two providers renamed to the same name.
  const finalName = new Map<string, string>();
  for (const [key, list] of groups) {
    if (list[0]!.target?.archived) continue;
    const first = list.find((r) => collapse(r.row.name));
    const nm = first ? collapse(first.row.name) : list[0]!.target?.name;
    if (nm && (key.startsWith("p:") || key.startsWith("n:"))) finalName.set(key, nameKey(nm));
  }
  const nameOwners = new Map<string, string[]>();
  for (const [key, nm] of finalName) nameOwners.set(nm, [...(nameOwners.get(nm) ?? []), key]);

  for (const [key, list] of groups) {
    const target = list[0]!.target;
    const lines = list.map((r) => r.row.line);
    const lineList = (ls: number[]) => (ls.length === 2 ? `${ls[0]} and ${ls[1]}` : ls.join(", "));

    // Archived target and no merge: nothing to update.
    if (target?.archived) {
      for (const r of list) {
        const into = target.mergedInto != null ? byId.get(target.mergedInto) : null;
        set(r, {
          ...base(r),
          status: "unmatched",
          reason: into ? `This provider was merged into “${into.name}”; update that provider's row instead` : "This provider was removed from Out of Network",
        });
      }
      continue;
    }
    if (target && keptConflicts.has(target.id)) {
      for (const r of list) set(r, { ...base(r), status: "conflict", reason: keptConflicts.get(target.id)! });
      continue;
    }

    // One value per field for the provider: the first non-blank cell; a different non-blank cell later is a conflict.
    const warningsBy = new Map<number, string[]>();
    const desired = new Map<FieldKey, { value: string; line: number }>();
    const clashes: string[] = [];
    for (const r of list) {
      const w: string[] = [];
      for (const f of FIELD_ORDER) {
        const v = fileValue(r.row, f, w);
        if (v == null) continue;
        const cur = desired.get(f);
        if (!cur) desired.set(f, { value: v, line: r.row.line });
        else if (!sameValue(f, cur.value, v) && !clashes.includes(FIELD_LABEL[f])) clashes.push(FIELD_LABEL[f]);
      }
      warningsBy.set(r.row.line, w);
    }
    if (clashes.length) {
      for (const r of list)
        set(r, { ...base(r, warningsBy.get(r.row.line)), status: "conflict", reason: `Lines ${lineList(lines)} are the same provider with a different ${clashes.join(", ")}; fix the file` });
      continue;
    }

    // A rename onto a name another provider keeps (not merged away by this file), or two rows renamed alike.
    const newName = desired.get("name")?.value ?? null;
    if (newName && (!target || nameKey(newName) !== nameKey(target.name))) {
      const other = activeByName.get(nameKey(newName));
      if (other && other.id !== target?.id && !mergedAway.has(other.id)) {
        for (const r of list)
          set(r, { ...base(r, warningsBy.get(r.row.line)), status: "conflict", reason: `Another provider is already named “${other.name}”; set Merge Into on one of the two rows to merge them` });
        continue;
      }
    }
    const nm = finalName.get(key);
    const owners = nm ? nameOwners.get(nm) ?? [] : [];
    if (owners.length > 1) {
      const otherLines = owners.filter((k) => k !== key).flatMap((k) => (groups.get(k) ?? []).map((r) => r.row.line));
      for (const r of list)
        set(r, { ...base(r, warningsBy.get(r.row.line)), status: "conflict", reason: `Line ${lineList(otherLines)} ends up with the same name; set Merge Into to merge them` });
      continue;
    }

    // Field changes against KatzDesk (blank cells keep what is there).
    const changes: FieldChange[] = [];
    for (const f of FIELD_ORDER) {
      const d = desired.get(f);
      if (!d) continue;
      const from = target ? providerValue(target, f) : null;
      if (target && from != null && sameValue(f, from, d.value)) continue;
      changes.push({ field: f, label: FIELD_LABEL[f], from: from ?? null, to: d.value });
    }

    // Pins: the first row with an address is the main address; later rows add other locations; repeats change nothing.
    const used = new Set<number>();
    const seen: { line: number; pin: NonNullable<ReturnType<typeof filePin>> }[] = [];
    const pins = new Map<number, PinPlan | null>();
    const repeatOf = new Map<number, number>();
    const addresses = target?.addresses ?? [];
    for (const r of list) {
      const fp = filePin(r.row);
      if (!fp) {
        pins.set(r.row.line, null);
        continue;
      }
      const earlier = seen.find((s) => sameAddress(s.pin, fp));
      if (earlier) {
        repeatOf.set(r.row.line, earlier.line);
        pins.set(r.row.line, null);
        continue;
      }
      const role: PinPlan["role"] = seen.length === 0 ? "main" : "extra";
      seen.push({ line: r.row.line, pin: fp });
      const free = addresses.filter((a) => !used.has(a.id));
      const matches = free.filter((a) => sameAddress(a, fp));
      let found: ImportAddress | null = role === "main" ? matches.find(isMain) ?? matches[0] ?? null : matches.find((a) => !isMain(a)) ?? matches[0] ?? null;
      // A Main row that is another place is only taken over when it has no street yet ("Combes, TX" read from the
      // contacts): the file's address replaces it whole. A Main row with a street is kept as it is, and a new row
      // becomes Main (Save clears the old row's label).
      let replace = false;
      if (!found && role === "main") {
        found = free.find((a) => isMain(a) && !collapse(a.line1)) ?? null;
        replace = !!found;
      }
      if (found) used.add(found.id);
      let action: PinPlan["action"] = "add";
      let clearPin = false;
      const clearLine2 = !!found && !!collapse(found.line2) && (replace || (!!fp.line1 && streetKey(fp.line1) !== streetKey(found.line1)));
      if (found) {
        const textSame = sameAddressText(found, fp);
        const pinSame = fp.quality
          ? samePoint(found.latitude, fp.latitude) && samePoint(found.longitude, fp.longitude) && found.quality === fp.quality
          : textSame || found.latitude == null;
        clearPin = !fp.quality && !textSame && found.latitude != null;
        action = textSame && pinSame && (role === "extra" || isMain(found)) ? "same" : "update";
      }
      pins.set(r.row.line, { ...fp, role, targetId: found?.id ?? null, action, clearPin, replace, clearLine2 });
    }

    const pinWord = (p: PinPlan) =>
      p.quality === "exact" ? "exact pin" : p.quality === "close" ? "close-match pin" : p.quality === "approx" ? "ZIP area pin (approximate)" : "no pin";

    if (!target) {
      const named = !!nameKey(list[0]!.row.name);
      for (const r of list) {
        const pin = pins.get(r.row.line) ?? null;
        const isFirst = r === list[0];
        const w = warningsBy.get(r.row.line);
        if (!named) {
          set(r, { ...base(r, w), status: "unmatched", reason: "No provider in KatzDesk with this ID or name; give the row a Name to add it as a new provider", pin });
        } else if (!addNew) {
          set(r, { ...base(r, w), status: "unmatched", canAdd: true, pin, changes: isFirst ? changes : [], reason: "Not in KatzDesk. Tick “Add new providers” to add it" });
        } else if (repeatOf.has(r.row.line)) {
          set(r, { ...base(r, w), status: "same", canAdd: true, reason: `Same new provider and address as line ${repeatOf.get(r.row.line)}` });
        } else {
          set(r, {
            ...base(r, w),
            status: "new",
            canAdd: true,
            pin,
            changes: isFirst ? changes : [],
            reason: isFirst ? `Will be added${pin ? ` with its address (${pinWord(pin)})` : ""}` : `Another location for the new provider on line ${list[0]!.row.line}`,
          });
        }
      }
      continue;
    }

    list.forEach((r, i) => {
      const pin = pins.get(r.row.line) ?? null;
      const w = warningsBy.get(r.row.line);
      const myChanges = i === 0 ? changes : [];
      const pinChange = !!pin && pin.action !== "same";
      const bits: string[] = [];
      if (myChanges.length) bits.push(`${myChanges.length} field${myChanges.length === 1 ? "" : "s"} change`);
      if (pin && pinChange) {
        if (pin.action === "add") bits.push(`${pin.role === "main" ? "main address" : "another location"} added (${pinWord(pin)})`);
        else if (pin.clearPin) bits.push(`${pin.role === "main" ? "main address" : "location"} changed; the old pin is removed`);
        else bits.push(`${pin.role === "main" ? "main address" : "location"} ${pin.quality ? `pinned (${pinWord(pin)})` : "updated"}`);
      }
      if (myChanges.length || pinChange) {
        set(r, { ...base(r, w), status: "update", changes: myChanges, pin, reason: `Will update: ${bits.join("; ")}` });
      } else {
        const why = repeatOf.has(r.row.line)
          ? `Same provider and address as line ${repeatOf.get(r.row.line)}`
          : i > 0 && changes.length
            ? `The changes are on line ${list[0]!.row.line}`
            : "Already up to date";
        set(r, { ...base(r, w), status: "same", changes: [], pin, reason: why });
      }
    });
  }

  return rows.map((r) => out.get(r.line)!).filter(Boolean);
}

export function countProviderPlan(lines: readonly ProviderPlanLine[]): ProviderPlanCounts {
  const c: ProviderPlanCounts = { update: 0, merge: 0, new: 0, same: 0, unmatched: 0, conflict: 0 };
  for (const l of lines) c[l.status] += 1;
  return c;
}

// ---------------------------------------------------------------------------------------------------------------
// Writes: what Save does, per provider (one statement each)

export type AddressWrite = {
  /** The address row to change; null = insert a new one. */
  targetId: number | null;
  /** 'Main' for the provider's shop; null leaves an existing label (and inserts with no label). */
  label: string | null;
  line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
  quality: PinQuality | null;
  matchedAddress: string | null;
  /** Save the pin (lat/lng/match), or remove the old one; neither = leave the pin as it is. */
  setPin: boolean;
  clearPin: boolean;
  /** Write every address part as given, blanks included (the row was a street-less Main address taken over). */
  replace: boolean;
  /** Clear line 2 (the old suite / unit) because the street changes. */
  clearLine2: boolean;
};

export type ProviderUpdateWrite = {
  providerId: number;
  name: string;
  /** New values; a field that is not here is left as it is. */
  fields: Partial<Record<FieldKey, string>>;
  addresses: AddressWrite[];
  /** Another address row was labelled Main: its label is cleared so the provider has one main address. */
  mainTargetId: number | null;
  lines: number[];
  detail: string;
};

export type ProviderCreateWrite = {
  name: string;
  fields: Partial<Record<FieldKey, string>>;
  addresses: AddressWrite[];
  lines: number[];
  detail: string;
};

export type ProviderMergeWrite = {
  duplicateId: number;
  duplicateName: string;
  keeperId: number;
  keeperName: string;
  line: number;
  detail: string;
  /** [duplicate's row, keeper's row]: the duplicate's copy is dropped (an address's pin is kept when the keeper's has none). */
  contactPairs: [number, number][];
  addressPairs: [number, number][];
};

const short = (s: string | null | undefined, n = 80) => {
  const t = collapse(s);
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

function addressWrite(pin: PinPlan): AddressWrite {
  return {
    targetId: pin.targetId,
    label: pin.role === "main" ? "Main" : null,
    line1: pin.line1,
    city: pin.city,
    state: pin.state,
    zip: pin.zip,
    latitude: pin.quality ? pin.latitude : null,
    longitude: pin.quality ? pin.longitude : null,
    quality: pin.quality,
    matchedAddress: collapse(pin.matchedAddress) || null,
    setPin: !!pin.quality,
    clearPin: pin.clearPin,
    replace: pin.replace,
    clearLine2: pin.clearLine2,
  };
}

function sourceNote(lines: ProviderPlanLine[]): string {
  const verified = lines.map((l) => collapse(l.verified)).find(Boolean);
  const notes = [...new Set(lines.map((l) => collapse(l.notes)).filter(Boolean))];
  // Up to 400 characters of each row's note, so a provider with two location rows keeps both notes (and their sources).
  const parts = [verified ? `Verified: ${verified}` : "", notes.length ? `Notes: ${notes.map((n) => short(n, 400)).join(" / ")}` : ""].filter(Boolean);
  return parts.length ? ` ${parts.join(". ")}.` : "";
}

function changeText(c: FieldChange): string {
  return c.from ? `${c.label} “${short(c.from)}” → “${short(c.to)}”` : `${c.label} → “${short(c.to)}”`;
}

/** Turn the plan into the writes Save makes. Only Will Update, Will Merge and New rows write anything. */
export function providerWrites(lines: readonly ProviderPlanLine[]): {
  updates: ProviderUpdateWrite[];
  merges: ProviderMergeWrite[];
  creates: ProviderCreateWrite[];
} {
  const updates = new Map<number, ProviderUpdateWrite & { plan: ProviderPlanLine[] }>();
  const creates = new Map<string, ProviderCreateWrite & { plan: ProviderPlanLine[] }>();
  const merges: ProviderMergeWrite[] = [];
  for (const l of lines) {
    if (l.status === "merge" && l.merge && l.providerId != null) {
      const m = l.merge;
      const already = (n: number) => (n ? ` (${n} already on “${m.keeperName}”, the copy dropped)` : "");
      const moved = [
        `${m.assignments} customer assignment${m.assignments === 1 ? "" : "s"}${m.overlapping ? ` (${m.overlapping} already on “${m.keeperName}”, the stronger role kept)` : ""}`,
        `${m.contacts} contact${m.contacts === 1 ? "" : "s"}${already(m.contactDupes)}`,
        `${m.addresses} address${m.addresses === 1 ? "" : "es"}${already(m.addressDupes)}`,
        `${m.coverage} coverage row${m.coverage === 1 ? "" : "s"}`,
      ].join(", ");
      const filled = m.fills.length ? `; filled the blank ${m.fills.join(", ")} on “${m.keeperName}” from the duplicate` : "";
      merges.push({
        duplicateId: l.providerId,
        duplicateName: l.providerName ?? l.fileName,
        keeperId: m.keeperId,
        keeperName: m.keeperName,
        line: l.line,
        detail: `Merged “${l.providerName ?? l.fileName}” into “${m.keeperName}” (provider import, line ${l.line}): moved ${moved}${filled}; this duplicate is archived.${sourceNote([l])}`.slice(0, 2000),
        contactPairs: m.contactPairs,
        addressPairs: m.addressPairs,
      });
      continue;
    }
    if (l.status === "update" && l.providerId != null) {
      const cur =
        updates.get(l.providerId) ??
        ({ providerId: l.providerId, name: l.providerName ?? l.fileName, fields: {}, addresses: [], mainTargetId: null, lines: [], detail: "", plan: [] } as ProviderUpdateWrite & { plan: ProviderPlanLine[] });
      for (const c of l.changes) cur.fields[c.field] = c.to;
      if (l.pin && l.pin.action !== "same") cur.addresses.push(addressWrite(l.pin));
      if (l.pin?.role === "main" && l.pin.action !== "same") cur.mainTargetId = l.pin.targetId ?? -1;
      cur.lines.push(l.line);
      cur.plan.push(l);
      updates.set(l.providerId, cur);
      continue;
    }
    if (l.status === "new") {
      const key = nameKey(l.fileName);
      const cur = creates.get(key) ?? ({ name: l.fileName, fields: {}, addresses: [], lines: [], detail: "", plan: [] } as ProviderCreateWrite & { plan: ProviderPlanLine[] });
      for (const c of l.changes) cur.fields[c.field] = c.to;
      if (l.changes.some((c) => c.field === "name")) cur.name = l.changes.find((c) => c.field === "name")!.to;
      if (l.pin) cur.addresses.push(addressWrite(l.pin));
      cur.lines.push(l.line);
      cur.plan.push(l);
      creates.set(key, cur);
    }
  }
  const pinText = (a: AddressWrite) =>
    `${a.label === "Main" ? "Main address" : "Location"} ${formatAddress({ ...a, label: null }) || "(no street)"}${
      a.setPin ? ` pinned (${a.quality === "exact" ? "exact" : a.quality === "close" ? "close match" : "ZIP area, approximate"})` : a.clearPin ? " (old pin removed)" : " (no pin)"
    }`;
  return {
    updates: [...updates.values()].map(({ plan, ...u }) => {
      const bits = [...plan.flatMap((p) => p.changes.map(changeText)), ...u.addresses.map(pinText)];
      return { ...u, detail: `Updated from the provider import (line ${u.lines.join(", ")}): ${bits.join("; ")}.${sourceNote(plan)}`.slice(0, 2000) };
    }),
    merges,
    creates: [...creates.values()].map(({ plan, ...c }) => {
      const bits = [...plan.flatMap((p) => p.changes.filter((x) => x.field !== "name").map(changeText)), ...c.addresses.map(pinText)];
      return { ...c, detail: `Added from the provider import (line ${c.lines.join(", ")})${bits.length ? `: ${bits.join("; ")}` : ""}.${sourceNote(plan)}`.slice(0, 2000) };
    }),
  };
}
