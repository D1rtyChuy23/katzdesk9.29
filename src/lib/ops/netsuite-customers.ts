/**
 * NetSuite customer import: what a NetSuite customer export (CSV or sheet) does to the KatzDesk accounts.
 * Pure: no database and no file reading. The server reads the file and the accounts, shows the preview, and saves.
 *
 * Matching, in order and never fuzzy: the NetSuite Internal ID, then the exact account number, then the exact name
 * (ignoring case and extra spaces). Walk-In accounts are never matched. The import never renames an account: the name
 * is how calls, PMs and installs find their account, and names change on the Customer Names review.
 *
 * What a row writes: the NetSuite ID and account number when the account has none or a different one, the shipping
 * address as the site address, the billing address, the primary contact, phone and email, and the Inactive flag. A
 * blank cell never clears a value KatzDesk has. Each address is one unit: a new street replaces the whole old address,
 * so an old suite number can't stick to a new street.
 */
import { accountNumberKey, cleanAccountNumber } from "./account-numbers.ts";
import { isWalkInName, shipToAddress, tidy } from "./clean-names.ts";
import { normalizeCustomerKey } from "./customer-key.ts";

export type AddressParts = { line1: string; line2: string; city: string; state: string; zip: string; country: string };
export type StoredAddress = { [K in keyof AddressParts]: string | null };

/** One customer row of the file, every cell as text. */
export type NsRow = {
  /** The row's line in the file (the header row counts). */
  line: number;
  internalId: string;
  accountNumber: string;
  companyName: string;
  billing: AddressParts;
  shipping: AddressParts;
  primaryContact: string;
  phone: string;
  email: string;
  /** Null when the file has no Inactive column, or the cell is blank or not understood. */
  inactive: boolean | null;
  /** The Inactive cell as written, when it was not understood. */
  inactiveText?: string;
};

/** A KatzDesk account as the import reads it. */
export type NsAccount = {
  id: number;
  name: string;
  archived: boolean;
  /** updated_at as text, so a save can tell the account changed after it was read. */
  updatedAt: string;
  netsuiteId: string | null;
  accountNumber: string | null;
  address: string | null;
  billing: StoredAddress;
  primaryContact: string | null;
  phone: string | null;
  email: string | null;
  inactive: boolean;
};

export type NsField = "netsuiteId" | "accountNumber" | "address" | "billing" | "primaryContact" | "phone" | "email" | "inactive";
export type NsChange = { field: NsField; label: string; before: string | null; after: string | null };
export type NsStatus = "create" | "update" | "same" | "conflict" | "skipped";
export type NsMatch = "id" | "number" | "name";

/** Every column a save writes, as it will be after the save. */
export type NsWrite = {
  name: string;
  netsuiteId: string | null;
  accountNumber: string | null;
  address: string | null;
  billing: StoredAddress;
  primaryContact: string | null;
  phone: string | null;
  email: string | null;
  inactive: boolean;
};

export type NsPlanLine = {
  line: number;
  status: NsStatus;
  internalId: string;
  accountNumber: string;
  companyName: string;
  /** The row or the account it matched is a Walk-In. */
  walkIn: boolean;
  accountId: number | null;
  accountName: string | null;
  matchedBy: NsMatch | null;
  /** Field by field, before → after (for a new account, before is blank). */
  changes: NsChange[];
  reason: string;
  notes: string[];
  /** For a create or an update: the account as it will be saved. */
  write: NsWrite | null;
  /** For an update: the account's updated_at as read, so the save skips an account changed since. */
  seenUpdatedAt: string | null;
};

export type NsCounts = Record<NsStatus, number>;

export const NS_STATUSES: NsStatus[] = ["create", "update", "same", "conflict", "skipped"];
export const NS_STATUS_LABEL: Record<NsStatus, string> = {
  create: "Will Create",
  update: "Will Update",
  same: "No Change",
  conflict: "Conflict",
  skipped: "Skipped",
};
export const NS_FIELD_LABEL: Record<NsField, string> = {
  netsuiteId: "NetSuite ID",
  accountNumber: "Account Number",
  address: "Site address",
  billing: "Billing address",
  primaryContact: "Primary contact",
  phone: "Phone",
  email: "Email",
  inactive: "Inactive",
};
const MATCH_LABEL: Record<NsMatch, string> = { id: "NetSuite ID", number: "account number", name: "name" };

const EMPTY_ADDRESS: AddressParts = { line1: "", line2: "", city: "", state: "", zip: "", country: "" };

/** A cell as text: invisible characters and extra spaces removed, and NetSuite's "- None -" read as blank. */
export function cellText(v: unknown): string {
  const s = tidy(v == null ? "" : String(v));
  return /^-\s*none\s*-$/i.test(s) ? "" : s;
}

/** "1.23457E+11": Excel turned the ID into a rounded number, so its digits are gone. */
export const looksLikeExcelNumber = (s: string) => /^\d+(?:\.\d+)?e[+-]?\d+$/i.test(s.trim());

// ── Reading the file ────────────────────────────────────────────────────────────────────────────────────────────────

type Column =
  | "internalId"
  | "accountNumber"
  | "companyName"
  | `billing.${keyof AddressParts}`
  | `shipping.${keyof AddressParts}`
  | "primaryContact"
  | "phone"
  | "email"
  | "inactive";

const PART_ALIASES: Record<keyof AddressParts, string[]> = {
  line1: ["address1", "addressline1", "addr1"],
  line2: ["address2", "addressline2", "addr2"],
  city: ["city"],
  state: ["stateprovince", "state", "province"],
  zip: ["zip", "zipcode", "postalcode", "zippostalcode"],
  country: ["country"],
};
const prefixed = (prefixes: string[], part: keyof AddressParts) => prefixes.flatMap((p) => PART_ALIASES[part].map((a) => p + a));
const PARTS = Object.keys(PART_ALIASES) as (keyof AddressParts)[];

/** Header spellings, compared with case, spaces and punctuation ignored. Address columns come first. */
const ALIASES: [Column, string[]][] = [
  ...PARTS.map((p) => [`billing.${p}` as Column, prefixed(["billing", "billto", "bill"], p)] as [Column, string[]]),
  ...PARTS.map((p) => [`shipping.${p}` as Column, prefixed(["shipping", "shipto", "ship"], p)] as [Column, string[]]),
  ["internalId", ["internalid", "netsuiteinternalid", "netsuiteid", "nsinternalid"]],
  ["accountNumber", ["accountnumber", "accountno", "account#", "acctnumber", "acctno", "acct#"]],
  ["companyName", ["companyname", "customername", "company", "customer", "name"]],
  ["primaryContact", ["primarycontact", "primarycontactname", "contactname", "contact"]],
  ["phone", ["phone", "phonenumber", "primaryphone", "officephone", "mainphone", "phone#"]],
  ["email", ["email", "emailaddress", "primaryemail"]],
  ["inactive", ["inactive", "isinactive"]],
];
const headerKey = (h: unknown) => cellText(h).toLowerCase().replace(/[^a-z0-9#]/g, "");

/** The columns a header row has, by column. A header cell is used once, by the first column that names it. */
function columnsOf(head: unknown[]): Map<Column, number> {
  const keys = head.map(headerKey);
  const used = new Set<number>();
  const out = new Map<Column, number>();
  for (const [column, aliases] of ALIASES) {
    for (const alias of aliases) {
      const at = keys.findIndex((k, i) => k === alias && !used.has(i));
      if (at >= 0) {
        out.set(column, at);
        used.add(at);
        break;
      }
    }
  }
  return out;
}

const COLUMN_TITLE: Record<string, string> = {
  internalId: "Internal ID",
  accountNumber: "Account Number",
  companyName: "Company Name",
  primaryContact: "Primary Contact",
  phone: "Phone",
  email: "Email",
  inactive: "Inactive",
};
const PART_TITLE: Record<keyof AddressParts, string> = {
  line1: "Address 1",
  line2: "Address 2",
  city: "City",
  state: "State/Province",
  zip: "Zip",
  country: "Country",
};
const columnTitle = (c: Column) => {
  const [group, part] = c.split(".") as [string, keyof AddressParts | undefined];
  return part ? `${group === "billing" ? "Billing" : "Shipping"} ${PART_TITLE[part]}` : COLUMN_TITLE[c]!;
};

function inactiveOf(s: string): { value: boolean | null; text?: string } {
  if (!s) return { value: null };
  if (/^(yes|y|true|t|1|x|inactive)$/i.test(s)) return { value: true };
  if (/^(no|n|false|f|0|active)$/i.test(s)) return { value: false };
  return { value: null, text: s };
}

export type NsRead = {
  rows: NsRow[];
  /** Columns found and the ones the file doesn't have, by their NetSuite titles. */
  columns: { found: string[]; missing: string[] };
  warnings: string[];
};

/** Sheet cells (every cell as text) → customer rows. The header row is the first one that names a Company Name or Internal ID column. */
export function readNetsuiteMatrix(matrix: unknown[][]): NsRead {
  const headerAt = matrix.slice(0, 15).findIndex((r) => {
    const cols = columnsOf(r ?? []);
    return cols.has("companyName") || cols.has("internalId");
  });
  if (headerAt < 0) throw new Error("No header row: the file needs a Company Name column (and the Internal ID column NetSuite exports).");
  const cols = columnsOf(matrix[headerAt] ?? []);
  if (!cols.has("companyName")) throw new Error("The file needs a Company Name column.");
  const at = (r: unknown[], c: Column) => (cols.has(c) ? cellText(r[cols.get(c)!]) : "");
  const address = (r: unknown[], group: "billing" | "shipping"): AddressParts => {
    const out = { ...EMPTY_ADDRESS };
    for (const p of PARTS) out[p] = at(r, `${group}.${p}` as Column);
    return out;
  };
  const rows: NsRow[] = [];
  matrix.slice(headerAt + 1).forEach((r, i) => {
    const row = r ?? [];
    if (!row.some((v) => cellText(v))) return;
    const inactive = cols.has("inactive") ? inactiveOf(at(row, "inactive")) : { value: null };
    rows.push({
      line: headerAt + i + 2,
      internalId: at(row, "internalId"),
      accountNumber: at(row, "accountNumber"),
      companyName: at(row, "companyName"),
      billing: address(row, "billing"),
      shipping: address(row, "shipping"),
      primaryContact: at(row, "primaryContact"),
      phone: at(row, "phone"),
      email: at(row, "email"),
      inactive: inactive.value,
      ...(inactive.text ? { inactiveText: inactive.text } : {}),
    });
  });
  const all = ALIASES.map(([c]) => c);
  const found = all.filter((c) => cols.has(c)).map(columnTitle);
  const missing = all.filter((c) => !cols.has(c)).map(columnTitle);
  const warnings: string[] = [];
  if (!cols.has("internalId")) warnings.push("No Internal ID column. Rows match by account number and name only, and new accounts get no NetSuite ID.");
  if (!PARTS.some((p) => cols.has(`shipping.${p}` as Column))) warnings.push("No shipping address columns, so no site address changes.");
  return { rows, columns: { found, missing }, warnings };
}

// ── Comparing ───────────────────────────────────────────────────────────────────────────────────────────────────────

const nameKey = (s: string | null | undefined) => tidy(s ?? "").toLowerCase();
/** For spotting near-duplicates only (never for matching): case, spaces, punctuation and accents ignored. */
const looseKey = (s: string | null | undefined) => normalizeCustomerKey(String(s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, ""));
const textKey = (s: string | null | undefined) => tidy(s ?? "").toLowerCase();
const addressKey = (s: string | null | undefined) => tidy(s ?? "").toLowerCase().replace(/[.,#]/g, " ").replace(/\s+/g, " ").trim();
const phoneKey = (s: string | null | undefined) => {
  const digits = String(s ?? "").replace(/\D/g, "");
  return digits || textKey(s);
};
const isUS = (c: string) => /^(us|usa|united states|united states of america)$/i.test(c.replace(/\./g, "").trim());
/** An address is used only with a street and a city or ZIP; anything less leaves KatzDesk's address as it is. */
const usableAddress = (a: AddressParts) => !!a.line1 && !!(a.city || a.zip);

/** "5740 San Felipe, Unit 130, Houston, TX 77057", with the country when it isn't the US. */
export function formatAddress(a: Partial<Record<keyof AddressParts, string | null>>): string {
  const base = shipToAddress({ line1: a.line1, line2: a.line2, city: a.city, state: a.state, zip: a.zip });
  const country = tidy(a.country ?? "");
  return base && country && !isUS(country) ? `${base}, ${country}` : base;
}

const storedOf = (a: AddressParts): StoredAddress => ({
  line1: a.line1 || null,
  line2: a.line2 || null,
  city: a.city || null,
  state: a.state || null,
  zip: a.zip || null,
  country: a.country || null,
});
const storedKey = (a: StoredAddress) => addressKey(formatAddress(a)) + "|" + addressKey(a.country ?? "");

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const t of items) {
    const k = key(t);
    if (!k) continue;
    out.set(k, [...(out.get(k) ?? []), t]);
  }
  return out;
}

const quoteNames = (accounts: NsAccount[]) => accounts.map((a) => `“${a.name}”`).join(", ");

// ── Planning ────────────────────────────────────────────────────────────────────────────────────────────────────────

type Draft = NsPlanLine & { numberKey: string | null; createKey: string | null };

/**
 * The preview: one line per row, with what saving it would do. Saving re-runs this against the accounts as they are
 * then, so a preview never saves anything stale.
 */
export function planNetsuiteCustomers(rows: NsRow[], accounts: NsAccount[]): NsPlanLine[] {
  const active = accounts.filter((a) => !a.archived);
  const byId = groupBy(active, (a) => tidy(a.netsuiteId ?? ""));
  const byNumber = new Map<string, NsAccount>();
  for (const a of active) {
    const k = accountNumberKey(a.accountNumber);
    if (k) byNumber.set(k, a);
  }
  const byName = groupBy(active, (a) => nameKey(a.name));
  const byLoose = groupBy(active, (a) => looseKey(a.name));
  const archivedByName = groupBy(
    accounts.filter((a) => a.archived),
    (a) => nameKey(a.name),
  );

  const drafts = rows.map((r): Draft => {
    const id = tidy(r.internalId);
    const name = tidy(r.companyName);
    const notes: string[] = [];
    let num = cleanAccountNumber(r.accountNumber);
    if (num && name && nameKey(num) === nameKey(name)) {
      notes.push("The Account Number is the company name, so it's read as blank.");
      num = null;
    } else if (num && name && num.length >= 20 && nameKey(name).startsWith(nameKey(num))) {
      // NetSuite cuts a long name short in its Account Number column; a cut-off copy of the name isn't a number either.
      notes.push("The Account Number is the company name cut short, so it's read as blank.");
      num = null;
    }
    const base: Draft = {
      line: r.line,
      status: "skipped",
      internalId: id,
      accountNumber: num ?? "",
      companyName: name,
      walkIn: isWalkInName(name),
      accountId: null,
      accountName: null,
      matchedBy: null,
      changes: [],
      reason: "",
      notes,
      write: null,
      seenUpdatedAt: null,
      numberKey: num ? accountNumberKey(num) : null,
      createKey: null,
    };
    if (r.inactiveText) notes.push(`Inactive “${r.inactiveText}” isn't Yes or No, so it's left as is.`);
    if (!id && !name) return { ...base, reason: "No Internal ID and no company name." };
    if (id && looksLikeExcelNumber(id)) return { ...base, status: "conflict", reason: `The Internal ID ${id} looks rounded by Excel. Export the file again with IDs as text.` };
    if (num && looksLikeExcelNumber(num)) return { ...base, status: "conflict", reason: `The account number ${num} looks rounded by Excel. Export the file again with numbers as text.` };

    // Find the account: Internal ID, then account number, then exact name. Never close names.
    let acct: NsAccount | null = null;
    let by: NsMatch | null = null;
    const idHits = id ? (byId.get(id) ?? []) : [];
    if (idHits.length > 1) return { ...base, status: "conflict", reason: `NetSuite ID ${id} is on ${idHits.length} KatzDesk accounts: ${quoteNames(idHits)}.` };
    if (idHits.length === 1) [acct, by] = [idHits[0]!, "id"];
    if (!acct && num) {
      const holder = byNumber.get(accountNumberKey(num));
      if (holder) [acct, by] = [holder, "number"];
    }
    if (!acct && name) {
      const hits = byName.get(nameKey(name)) ?? [];
      if (hits.length > 1) return { ...base, status: "conflict", reason: `${hits.length} KatzDesk accounts are named this: ${quoteNames(hits)}.` };
      if (hits.length === 1) [acct, by] = [hits[0]!, "name"];
    }

    if (acct) {
      const matched = { ...base, accountId: acct.id, accountName: acct.name, matchedBy: by, walkIn: base.walkIn || isWalkInName(acct.name) };
      if (isWalkInName(acct.name)) return { ...matched, reason: `Matches the Walk-In account “${acct.name}”. Walk-In accounts are never updated by this import.` };
      if (by !== "id" && id && tidy(acct.netsuiteId ?? "") && tidy(acct.netsuiteId ?? "") !== id) {
        return { ...matched, status: "conflict", reason: `“${acct.name}” has NetSuite ID ${acct.netsuiteId}, and this row is ${id}.` };
      }
      if (num) {
        const holder = byNumber.get(accountNumberKey(num));
        if (holder && holder.id !== acct.id) return { ...matched, status: "conflict", reason: `Account number ${num} is on “${holder.name}”, not on “${acct.name}”.` };
      }
      if (by !== "name" && name && nameKey(name) !== nameKey(acct.name)) notes.push(`NetSuite calls it “${name}”. Names change on Customer Names, not here.`);
      const { changes, write } = updateOf(acct, r, id, num, notes);
      return {
        ...matched,
        status: changes.length ? "update" : "same",
        changes,
        write: changes.length ? write : null,
        seenUpdatedAt: changes.length ? acct.updatedAt : null,
        reason: changes.length
          ? `Matched by ${MATCH_LABEL[by!]}. ${changes.length} field${changes.length === 1 ? "" : "s"} change.`
          : `Matched by ${MATCH_LABEL[by!]}. Nothing changes.`,
      };
    }

    // No account: a new one, unless there's a reason not to.
    if (r.inactive === true) return { ...base, reason: "Inactive in NetSuite and not in KatzDesk, so it isn't added." };
    if (!name) return { ...base, reason: "No company name, so it can't be added." };
    const removed = archivedByName.get(nameKey(name)) ?? [];
    if (removed.length) return { ...base, status: "conflict", reason: `A removed account is named “${removed[0]!.name}”. Restore it on Customers first, or the names would clash.` };
    const close = byLoose.get(looseKey(name)) ?? [];
    if (close.length) {
      return {
        ...base,
        status: "conflict",
        reason: `Close to ${quoteNames(close)}, but only exact names match. Add the NetSuite ID or account number to that account, or fix the name, then read the file again.`,
      };
    }
    // "Eversys Service:Black Rifle Coffee" when KatzDesk has "Black Rifle Coffee": held, so it isn't added twice.
    const child = name.includes(":") ? tidy(name.slice(name.lastIndexOf(":") + 1)) : "";
    const parentless = child ? (byLoose.get(looseKey(child)) ?? []) : [];
    if (parentless.length) {
      return {
        ...base,
        status: "conflict",
        reason: `NetSuite lists ${quoteNames(parentless)} under “${tidy(name.slice(0, name.lastIndexOf(":")))}”, but only exact names match. If it's the same account, add the NetSuite ID to it, then read the file again.`,
      };
    }
    if (base.walkIn) notes.push("A Walk-In: it starts unticked. Tick it to add it.");
    const { changes, write } = createOf(r, id, num, name, notes);
    return {
      ...base,
      status: "create",
      changes,
      write,
      createKey: looseKey(name) || nameKey(name),
      reason: "Not in KatzDesk. It will be added.",
    };
  });

  // Rows that claim the same thing: one Internal ID, account, new name or account number on more than one row. Every
  // row but a skipped one counts, so a second row can't go ahead because the first is already a conflict.
  const live = drafts.filter((d) => d.status !== "skipped");
  const clash = new Map<number, string>();
  const flag = (groups: Map<string, Draft[]>, why: (k: string, n: number) => string) => {
    for (const [k, ds] of groups) if (ds.length > 1) for (const d of ds) if (!clash.has(d.line)) clash.set(d.line, why(k, ds.length));
  };
  flag(groupBy(live, (d) => d.internalId), (k, n) => `Internal ID ${k} is on ${n} rows in the file.`);
  flag(
    groupBy(
      live.filter((d) => d.accountId != null),
      (d) => String(d.accountId),
    ),
    (k, n) => `${n} rows in the file match “${live.find((d) => String(d.accountId) === k)?.accountName}”.`,
  );
  flag(
    groupBy(
      live.filter((d) => d.createKey),
      (d) => d.createKey!,
    ),
    (_k, n) => `${n} rows in the file would add this name (or names that differ only in punctuation).`,
  );
  flag(
    groupBy(
      live.filter((d) => d.numberKey),
      (d) => d.numberKey!,
    ),
    (_k, n) => `This account number is on ${n} rows in the file.`,
  );

  return drafts.map(({ numberKey: _n, createKey: _c, ...d }) => {
    const why = clash.get(d.line);
    if (!why) return d;
    // A row that is already a conflict keeps its own reason; the clash is added to its notes.
    if (d.status === "conflict") return { ...d, notes: [...d.notes, why] };
    return { ...d, status: "conflict" as const, reason: why, changes: [], write: null, seenUpdatedAt: null };
  });
}

function addressNotes(r: NsRow, notes: string[]) {
  const partial = (a: AddressParts) => !usableAddress(a) && Object.values(a).some(Boolean);
  if (partial(r.shipping)) notes.push("The shipping address has no street, or no city or ZIP, so the site address is left as is.");
  if (partial(r.billing)) notes.push("The billing address has no street, or no city or ZIP, so it's left as is.");
}

function updateOf(acct: NsAccount, r: NsRow, id: string, num: string | null, notes: string[]): { changes: NsChange[]; write: NsWrite } {
  const changes: NsChange[] = [];
  const write: NsWrite = {
    name: acct.name,
    netsuiteId: acct.netsuiteId,
    accountNumber: acct.accountNumber,
    address: acct.address,
    billing: { ...acct.billing },
    primaryContact: acct.primaryContact,
    phone: acct.phone,
    email: acct.email,
    inactive: acct.inactive,
  };
  const change = (field: NsField, before: string | null, after: string | null) => changes.push({ field, label: NS_FIELD_LABEL[field], before, after });

  if (id && !tidy(acct.netsuiteId ?? "")) {
    change("netsuiteId", null, id);
    write.netsuiteId = id;
  }
  if (num && accountNumberKey(acct.accountNumber) !== accountNumberKey(num)) {
    change("accountNumber", acct.accountNumber, num);
    write.accountNumber = num;
  }
  addressNotes(r, notes);
  if (usableAddress(r.shipping)) {
    const site = formatAddress(r.shipping);
    if (addressKey(site) !== addressKey(acct.address)) {
      change("address", acct.address, site);
      write.address = site;
    }
  }
  if (usableAddress(r.billing)) {
    const next = storedOf(r.billing);
    if (storedKey(next) !== storedKey(acct.billing)) {
      change("billing", formatAddress(acct.billing) || null, formatAddress(next));
      write.billing = next;
    }
  }
  const text = (field: "primaryContact" | "email", key: (s: string | null) => string) => {
    const v = r[field];
    if (v && key(v) !== key(acct[field])) {
      change(field, acct[field], v);
      write[field] = v;
    }
  };
  text("primaryContact", textKey);
  if (r.phone && phoneKey(r.phone) !== phoneKey(acct.phone)) {
    change("phone", acct.phone, r.phone);
    write.phone = r.phone;
  }
  text("email", textKey);
  if (r.inactive !== null && r.inactive !== acct.inactive) {
    change("inactive", acct.inactive ? "Inactive" : "Active", r.inactive ? "Inactive" : "Active");
    write.inactive = r.inactive;
  }
  return { changes, write };
}

function createOf(r: NsRow, id: string, num: string | null, name: string, notes: string[]): { changes: NsChange[]; write: NsWrite } {
  addressNotes(r, notes);
  const billing = usableAddress(r.billing) ? storedOf(r.billing) : storedOf(EMPTY_ADDRESS);
  const write: NsWrite = {
    name,
    netsuiteId: id || null,
    accountNumber: num,
    address: usableAddress(r.shipping) ? formatAddress(r.shipping) : null,
    billing,
    primaryContact: r.primaryContact || null,
    phone: r.phone || null,
    email: r.email || null,
    inactive: false,
  };
  const changes: NsChange[] = [];
  const set = (field: NsField, after: string | null) => {
    if (after) changes.push({ field, label: NS_FIELD_LABEL[field], before: null, after });
  };
  set("netsuiteId", write.netsuiteId);
  set("accountNumber", write.accountNumber);
  set("address", write.address);
  set("billing", formatAddress(billing) || null);
  set("primaryContact", write.primaryContact);
  set("phone", write.phone);
  set("email", write.email);
  return { changes, write };
}

export function countNetsuitePlan(lines: Pick<NsPlanLine, "status">[]): NsCounts {
  const out: NsCounts = { create: 0, update: 0, same: 0, conflict: 0, skipped: 0 };
  for (const l of lines) out[l.status] += 1;
  return out;
}

// ── The preview as a CSV download ───────────────────────────────────────────────────────────────────────────────────

/** A CSV cell: quoted when needed, and a leading = + @ or -word can't start a spreadsheet formula. */
function csvCell(v: unknown): string {
  let s = String(v ?? "");
  if (/^[=+@]/.test(s) || /^-[^\d]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const changeText = (c: NsChange) => `${c.label}: ${c.before ?? "—"} → ${c.after ?? "—"}`;

/** The preview, one row per line of the file, with whether each line is ticked to save. */
export function netsuitePreviewCsv(lines: NsPlanLine[], included: ReadonlySet<number>): string {
  const head = ["Status", "Line", "Included", "Internal ID", "Account Number", "Company Name", "KatzDesk Account", "Matched By", "Changes", "Reason", "Notes"];
  const body = lines.map((l) => [
    NS_STATUS_LABEL[l.status],
    l.line,
    l.status === "create" || l.status === "update" ? (included.has(l.line) ? "Yes" : "No") : "",
    l.internalId,
    l.accountNumber,
    l.companyName,
    l.accountName ?? "",
    l.matchedBy ? MATCH_LABEL[l.matchedBy] : "",
    l.changes.map(changeText).join("; "),
    l.reason,
    l.notes.join(" "),
  ]);
  return [head, ...body].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** One history line for an account the import saved. */
export function netsuiteHistoryText(line: NsPlanLine): string {
  const text =
    line.status === "create"
      ? `Added by the NetSuite import${line.internalId ? ` (NetSuite ID ${line.internalId})` : ""}`
      : `NetSuite import: ${line.changes.map(changeText).join("; ")}`;
  return text.length > 900 ? `${text.slice(0, 899)}…` : text;
}
