export const PROVIDER_STATUSES = ["Active", "Pending Setup", "Prospect", "Inactive"] as const;
export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

export const PROVIDER_ROLES = ["primary", "secondary", "additional"] as const;
export type ProviderRole = (typeof PROVIDER_ROLES)[number];

export type NetworkProvider = {
  id: number;
  name: string;
  status: string | null;
  dispatchPhone: string | null;
  dispatchEmail: string | null;
  secondaryPhone: string | null;
  secondaryEmail: string | null;
  responseTime: string | null;
  standardRate: string | null;
  afterHoursRate: string | null;
  travelPolicy: string | null;
  equipmentServiced: string | null;
  coverage: string | null;
  contacts: string | null;
  pmPricing: string | null;
  partsStocking: string | null;
  notes: string | null;
  lastUpdated: string | null;
  primaryFor: number;
  secondaryFor: number;
  states: string[];
  locationCount: number;
  updatedAt: string;
};

export type ProviderLocation = {
  id: number;
  state: string;
  city: string | null;
  zip: string | null;
};

export type LocationDraft = {
  state: string;
  city: string | null;
  zip: string | null;
};

export type CustomerProviderLink = {
  linkId: number;
  customer: string;
  role: ProviderRole;
  provider: NetworkProvider;
};

export type NetworkAccount = {
  id: number;
  customer: string;
  email: string | null;
  contact: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  equipment: string | null;
  ownership: string | null;
  region: string | null;
  primary: NetworkProvider | null;
  secondary: NetworkProvider | null;
  extras: NetworkProvider[];
};

export type NetworkOverview = {
  providers: NetworkProvider[];
  accounts: NetworkAccount[];
  byState: { state: string; total: number; unassigned: number }[];
  unassigned: NetworkAccount[];
};

export type ProviderContact = {
  id: number;
  name: string | null;
  role: string | null;
  phone: string | null;
  email: string | null;
};

export type ContactDraft = {
  name: string | null;
  role: string | null;
  phone: string | null;
  email: string | null;
};

export type ProviderAddress = {
  id: number;
  label: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};

export type AddressDraft = {
  label: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};

export type ProviderDetail = NetworkProvider & {
  accounts: { customer: string; role: ProviderRole; linkId: number }[];
  locations: ProviderLocation[];
  people: ProviderContact[];
  addresses: ProviderAddress[];
};

export type ProviderDraft = {
  id?: number;
  name: string;
  status?: string | null;
  dispatchPhone?: string | null;
  dispatchEmail?: string | null;
  secondaryPhone?: string | null;
  secondaryEmail?: string | null;
  responseTime?: string | null;
  standardRate?: string | null;
  afterHoursRate?: string | null;
  travelPolicy?: string | null;
  equipmentServiced?: string | null;
  coverage?: string | null;
  contacts?: string | null;
  pmPricing?: string | null;
  partsStocking?: string | null;
  notes?: string | null;
  locations?: LocationDraft[];
  people?: ContactDraft[];
  addresses?: AddressDraft[];
};

export const US_STATE_OPTIONS: { code: string; name: string }[] = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DC", name: "District of Columbia" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "IA", name: "Iowa" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "MA", name: "Massachusetts" },
  { code: "MD", name: "Maryland" },
  { code: "ME", name: "Maine" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MO", name: "Missouri" },
  { code: "MS", name: "Mississippi" },
  { code: "MT", name: "Montana" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "NE", name: "Nebraska" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NV", name: "Nevada" },
  { code: "NY", name: "New York" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VA", name: "Virginia" },
  { code: "VT", name: "Vermont" },
  { code: "WA", name: "Washington" },
  { code: "WI", name: "Wisconsin" },
  { code: "WV", name: "West Virginia" },
  { code: "WY", name: "Wyoming" },
];

const STATE_CODES = new Set(US_STATE_OPTIONS.map((s) => s.code));

export function normalizeState(raw: string | null | undefined): string | null {
  const s = raw?.trim().toUpperCase() ?? "";
  return STATE_CODES.has(s) ? s : null;
}

export function normalizeCity(raw: string | null | undefined): string | null {
  const s = raw?.trim().replace(/\s+/g, " ") ?? "";
  if (!s) return null;
  return s.replace(/\b([a-z])/gi, (c) => c.toUpperCase());
}

export function normalizeZip(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length >= 9) return `${digits.slice(0, 5)}-${digits.slice(5, 9)}`;
  if (digits.length >= 5) return digits.slice(0, 5);
  return null;
}

export function splitZips(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(/[,\s]+/)) {
    const z = normalizeZip(part);
    if (z && !seen.has(z)) {
      seen.add(z);
      out.push(z);
    }
  }
  return out;
}

export function locationKey(state: string, city: string | null, zip: string | null): string {
  return `${state}|${(city ?? "").toLowerCase()}|${zip ?? ""}`;
}

export function formatLocation(loc: { state: string; city?: string | null; zip?: string | null }): string {
  const city = loc.city?.trim();
  const zip = loc.zip?.trim();
  if (city && zip) return `${city}, ${loc.state} ${zip}`;
  if (city) return `${city}, ${loc.state}`;
  if (zip) return `${loc.state} ${zip}`;
  return `${loc.state} (statewide)`;
}

export function groupLocations<T extends { state: string; city?: string | null; zip?: string | null }>(
  locs: T[],
): { state: string; rows: T[] }[] {
  const map = new Map<string, T[]>();
  for (const l of locs) {
    const list = map.get(l.state) ?? [];
    list.push(l);
    map.set(l.state, list);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([state, rows]) => ({
      state,
      rows: rows.sort(
        (a, b) =>
          (a.city ?? "").localeCompare(b.city ?? "") || (a.zip ?? "").localeCompare(b.zip ?? ""),
      ),
    }));
}

export function findDuplicateLocation<T extends { state: string; city?: string | null; zip?: string | null }>(
  existing: T[],
  next: { state: string; city: string | null; zip: string | null },
): T | null {
  if (next.zip) {
    const byZip = existing.find((e) => e.zip === next.zip);
    if (byZip) return byZip;
  }
  const exact = existing.find(
    (e) => locationKey(e.state, e.city ?? null, e.zip ?? null) === locationKey(next.state, next.city, next.zip),
  );
  if (exact) return exact;
  if (next.city) {
    const sameCity = existing.find(
      (e) => e.state === next.state && (e.city ?? "").toLowerCase() === next.city!.toLowerCase(),
    );
    if (sameCity) return sameCity;
  }
  if (!next.city && !next.zip) {
    return existing.find((e) => e.state === next.state && !e.city && !e.zip) ?? null;
  }
  return null;
}

export function duplicateNote(existing: { state: string; city?: string | null; zip?: string | null }): string {
  return `Already listed — ${formatLocation(existing)}.`;
}

export function parseCoverageLocations(raw: string | null | undefined): LocationDraft[] {
  if (!raw?.trim()) return [];
  const out: LocationDraft[] = [];
  const seen = new Set<string>();
  const add = (state: string | null, city: string | null, zip: string | null) => {
    const st = normalizeState(state);
    if (!st) return;
    const c = normalizeCity(city);
    const z = normalizeZip(zip);
    const k = locationKey(st, c, z);
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ state: st, city: c, zip: z });
  };
  let current: string | null = null;
  for (const line of raw.split(/\n|;/)) {
    const header = line.match(/\b([A-Z]{2})\s*ZIPs?:/i);
    if (header && STATE_CODES.has(header[1].toUpperCase())) current = header[1].toUpperCase();
    for (const m of line.matchAll(/([A-Za-z][A-Za-z .']{1,40}),\s*([A-Z]{2})\b/g)) {
      if (!STATE_CODES.has(m[2])) continue;
      const city = m[1].replace(/^[-–•\s]+/, "").replace(/\b(I-\d+\w*)\b/gi, "").trim();
      if (!city || city.length < 3 || STATE_CODES.has(city.toUpperCase())) {
        current = m[2];
        continue;
      }
      add(m[2], city, null);
      current = m[2];
    }
    const zips = line.match(/\b\d{5}(?:-\d{4})?\b/g) ?? [];
    for (const z of zips) add(current, null, z);
    for (const m of line.toUpperCase().matchAll(/\b([A-Z]{2})\b/g)) {
      if (!STATE_CODES.has(m[1])) continue;
      current = m[1];
      add(m[1], null, null);
    }
  }
  return out;
}

export function providerStates(p: { states?: string[]; coverage?: string | null }): string[] {
  if (p.states?.length) return p.states;
  return statesFromCoverage(p.coverage);
}

const US_STATES = STATE_CODES;

export function statesFromCoverage(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const found = new Set<string>();
  for (const m of raw.toUpperCase().matchAll(/\b([A-Z]{2})\b/g)) {
    if (US_STATES.has(m[1])) found.add(m[1]);
  }
  return [...found];
}

export function roleRank(role: string): number {
  if (role === "primary") return 0;
  if (role === "secondary") return 1;
  return 2;
}

export function roleLabel(role: string): string {
  if (role === "primary") return "Primary";
  if (role === "secondary") return "Secondary";
  return "Additional";
}

export function statusTone(status: string | null): "success" | "warn" | "outline" | "default" {
  if (status === "Active") return "success";
  if (status === "Pending Setup" || status === "Prospect" || !status) return "warn";
  return "outline";
}

export function digitsPhone(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  const s = raw?.trim().toLowerCase() ?? "";
  return s.includes("@") ? s : null;
}

export function formatContact(c: { name?: string | null; role?: string | null; phone?: string | null; email?: string | null }): string {
  return [c.name, c.role, c.phone, c.email].filter(Boolean).join(" · ");
}

export function formatAddress(a: {
  label?: string | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}): string {
  const street = [a.line1, a.line2].filter(Boolean).join(", ");
  const locality = [a.city, a.state].filter(Boolean).join(", ") + (a.zip ? ` ${a.zip}` : "");
  const body = [street, locality.trim()].filter(Boolean).join(" · ");
  return a.label ? `${a.label} — ${body}` : body;
}

export function findDuplicateContact<T extends ContactDraft>(existing: T[], next: ContactDraft): T | null {
  const email = normalizeEmail(next.email);
  const phone = digitsPhone(next.phone);
  const name = next.name?.trim().toLowerCase() ?? "";
  return (
    existing.find((e) => {
      if (email && normalizeEmail(e.email) === email) return true;
      if (phone.length >= 10 && digitsPhone(e.phone) === phone) return true;
      if (name && name === (e.name?.trim().toLowerCase() ?? "") && (email || phone.length >= 7)) return true;
      return false;
    }) ?? null
  );
}

export function findDuplicateAddress<T extends AddressDraft>(existing: T[], next: AddressDraft): T | null {
  const line = (next.line1 ?? "").trim().toLowerCase();
  const city = (next.city ?? "").trim().toLowerCase();
  const zip = normalizeZip(next.zip) ?? "";
  const state = normalizeState(next.state) ?? "";
  return (
    existing.find((e) => {
      const eline = (e.line1 ?? "").trim().toLowerCase();
      const ecity = (e.city ?? "").trim().toLowerCase();
      const ezip = normalizeZip(e.zip) ?? "";
      const estate = normalizeState(e.state) ?? "";
      if (zip && ezip && zip === ezip && (!line || !eline || line === eline)) return true;
      if (line && eline === line && (city === ecity || state === estate)) return true;
      if (!line && city && state && city === ecity && state === estate && zip === ezip) return true;
      return false;
    }) ?? null
  );
}

const STREET_HINT = /\b(st|street|ave|avenue|rd|road|ln|lane|dr|drive|blvd|way|pkwy|ct|pl|place|hwy|suite|ste|unit|pobox|p\.o\.|cir|circle)\b/i;

export function parseContactBlob(raw: string | null | undefined, company?: string | null): {
  people: ContactDraft[];
  addresses: AddressDraft[];
} {
  if (!raw?.trim()) return { people: [], addresses: [] };
  const companyNorm = company?.trim().toLowerCase() ?? "";
  const people: ContactDraft[] = [];
  const addresses: AddressDraft[] = [];
  const seenP = new Set<string>();
  const seenA = new Set<string>();

  const addPerson = (p: ContactDraft) => {
    const name = p.name?.replace(/\s+/g, " ").trim() || null;
    if (name && companyNorm && name.toLowerCase() === companyNorm) return;
    const row = {
      name,
      role: p.role?.trim() || null,
      phone: p.phone?.trim() || null,
      email: normalizeEmail(p.email),
    };
    if (!row.name && !row.phone && !row.email) return;
    const last = people[people.length - 1];
    if (last && !row.name) {
      if (row.email && !last.email) {
        last.email = row.email;
        return;
      }
      if (row.phone && !last.phone) {
        last.phone = row.phone;
        return;
      }
    }
    const key = `${(row.name ?? "").toLowerCase()}|${digitsPhone(row.phone)}|${row.email ?? ""}`;
    if (seenP.has(key) || findDuplicateContact(people, row)) return;
    seenP.add(key);
    people.push(row);
  };
  const addAddr = (a: AddressDraft) => {
    const row = {
      label: a.label?.trim() || null,
      line1: a.line1?.replace(/\s+/g, " ").trim() || null,
      line2: a.line2?.replace(/\s+/g, " ").trim() || null,
      city: normalizeCity(a.city),
      state: normalizeState(a.state),
      zip: normalizeZip(a.zip),
    };
    if (!row.line1 && !row.city) return;
    const key = `${(row.line1 ?? "").toLowerCase()}|${row.city ?? ""}|${row.state ?? ""}|${row.zip ?? ""}`;
    if (seenA.has(key) || findDuplicateAddress(addresses, row)) return;
    seenA.add(key);
    addresses.push(row);
  };

  const lines = raw
    .replace(/\r/g, "")
    .split(/\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  let pendingStreet: string | null = null;
  let current: ContactDraft = { name: null, role: null, phone: null, email: null };
  const flushPerson = () => {
    addPerson(current);
    current = { name: null, role: null, phone: null, email: null };
  };

  for (const line of lines) {
    if (/^https?:|^www\./i.test(line) || /^fax:/i.test(line) || /^note:/i.test(line)) continue;

    const labeledStreet = line.match(/^(shipping address|office|warehouse|address)\s*:?\s*(.*)$/i);
    if (labeledStreet) {
      flushPerson();
      const rest = labeledStreet[2]?.trim();
      pendingStreet = rest || pendingStreet;
      if (rest && STREET_HINT.test(rest) && /^\d/.test(rest)) pendingStreet = rest;
      continue;
    }

    const cityZip = line.match(/^([A-Za-z][A-Za-z .']+),\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)\b/);
    if (cityZip) {
      addAddr({
        label: null,
        line1: pendingStreet,
        line2: null,
        city: cityZip[1],
        state: cityZip[2].toUpperCase(),
        zip: cityZip[3],
      });
      pendingStreet = null;
      continue;
    }

    if (/^\d{1,6}\s+\S/.test(line) && STREET_HINT.test(line)) {
      const oneLine = line.match(/^(.*?)\s+([A-Za-z][A-Za-z .']+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\s*$/);
      if (oneLine) {
        addAddr({
          label: null,
          line1: oneLine[1].replace(/,$/, "").trim(),
          line2: null,
          city: oneLine[2],
          state: oneLine[3],
          zip: oneLine[4],
        });
        pendingStreet = null;
      } else {
        pendingStreet = line.replace(/,$/, "");
      }
      continue;
    }

    const emails = line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
    const phones = line.match(/(?:\+?1[-.\s])?(?:\(?\d{3}\)?[-.\s])\d{3}[-.\s]\d{4}(?:\s*(?:ext\.?|x)\s*\d+)?/gi) ?? [];

    const named = line.match(/^(?:contact|owner|name)\s*:\s*(.+)/i);
    if (named) {
      flushPerson();
      current.name = named[1].replace(/\b(phone|cell|email|mobile)\s*:.*$/i, "").trim();
      if (phones[0]) current.phone = phones[0];
      if (emails[0]) current.email = emails[0];
      continue;
    }

    const roleLine = line.match(/^(owner|president|service manager|service coordinator|director[^\d]{0,40}|cfo|manager|business development[^\d]{0,20})\s*:?\s*(.*)$/i);
    if (roleLine && !/^\d/.test(line)) {
      if (current.name && current.role) flushPerson();
      if (roleLine[2]?.trim() && !/phone|email/i.test(roleLine[2])) {
        if (!current.name) current.name = roleLine[2].trim();
        current.role = roleLine[1].trim();
      } else if (current.name) {
        current.role = roleLine[1].trim();
      }
      continue;
    }

    if (emails.length || phones.length) {
      if (phones[0] && !current.phone) current.phone = phones[0];
      if (emails[0] && !current.email) current.email = emails[0];
      const leftover = line
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "")
        .replace(/(?:\+?1[-.\s])?(?:\(?\d{3}\)?[-.\s])\d{3}[-.\s]\d{4}(?:\s*(?:ext\.?|x)\s*\d+)?/gi, "")
        .replace(/\b(phone|cell|mobile|email|office|ext\.?)\s*:?/gi, "")
        .replace(/[|]/g, " ")
        .trim();
      if (leftover && leftover.length > 2 && leftover.length < 48 && !current.name && !STREET_HINT.test(leftover)) {
        current.name = leftover.replace(/^[-–•]+/, "").trim();
      }
      if (current.name || current.email) flushPerson();
      continue;
    }

    if (
      line.length > 2 &&
      line.length < 48 &&
      !STREET_HINT.test(line) &&
      !/^\d/.test(line) &&
      !/phone|email|fax|www\.|http/i.test(line)
    ) {
      if (current.name && (current.phone || current.email)) flushPerson();
      if (!current.name) current.name = line;
      else if (!current.role) current.role = line;
    }
  }
  flushPerson();
  if (pendingStreet) addAddr({ label: null, line1: pendingStreet, line2: null, city: null, state: null, zip: null });
  return { people, addresses };
}

