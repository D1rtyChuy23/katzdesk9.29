/**
 * Customers → Export: every account, removed ones too, one row each. Pure: the server reads the accounts and this turns
 * them into rows, a CSV, or the cells of an Excel sheet. IDs, account numbers, ZIP codes and phone numbers stay text,
 * exactly as stored: never a number, so never "1.2E+11" and never a lost leading zero.
 */
import { tidyAddress } from "./address-report.ts";
import { isWalkInName } from "./clean-names.ts";
import { formatAddress } from "./netsuite-customers.ts";

export type ExportAccount = {
  id: number;
  name: string;
  netsuiteId: string | null;
  accountNumber: string | null;
  /** The site address, one line ("5644 Navigation Blvd, Houston, TX 77011"). */
  address: string | null;
  billing: { line1: string | null; line2: string | null; city: string | null; state: string | null; zip: string | null; country: string | null };
  phone: string | null;
  email: string | null;
  rep: string | null;
  archived: boolean;
  inactive: boolean;
  removalFlag: boolean;
  /** Kept when a "Walk - In:" child account was renamed to its place (Work Order History import). */
  walkIn?: boolean;
  /** The account's "added" history line, when KatzDesk wrote one (the NetSuite import does). */
  added: { at: string; by: string | null; detail: string | null } | null;
};

export const CUSTOMER_EXPORT_COLUMNS = [
  "KatzDesk ID",
  "Name",
  "NetSuite Internal ID",
  "Account Number",
  "Site Address 1",
  "Site Address 2",
  "Site City",
  "Site State",
  "Site Zip",
  "Billing Address",
  "Phone",
  "Email",
  "Rep",
  "Created At",
  "Created By / Source",
  "Walk-In",
  "Inactive",
  "Removed",
  "Flagged For Review",
] as const;

/** Columns kept as text in Excel, so a long or zero-led number is never changed. */
export const TEXT_COLUMNS: ReadonlySet<string> = new Set(["NetSuite Internal ID", "Account Number", "Site Zip", "Phone"]);

export type SiteAddress = { line1: string; line2: string; city: string; state: string; zip: string };

const STATES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT",
  delaware: "DE", "district of columbia": "DC", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL",
  indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE",
  nevada: "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC",
  "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "puerto rico": "PR",
  "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT",
  vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};
/** "TX", "tx" or "Texas" → "TX". Blank when it isn't a US state. */
function stateCode(raw: string): string {
  const s = raw.trim().replace(/\.$/, "");
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  return STATES[s.toLowerCase().replace(/\s+/g, " ")] ?? "";
}
const ZIP = /^\d{5}(?:-\d{4})?$/;
const STATE_ZIP = /^(.+?)\s+(\d{5}(?:-\d{4})?)$/;
/** "Houston TX 77002": the city, state and ZIP with no comma between them. */
const CITY_STATE_ZIP = /^(.+?)\s+([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/;
const US = /^(?:us|usa|u\.s\.a?\.?|united states(?: of america)?)$/i;

/**
 * A one-line US address in its parts: "line 1[, line 2], City, ST 12345". Also reads the geocoder's
 * "…, City, ST, 12345", a state written out ("Texas 77002") and a trailing ", USA". Anything else (no state, another
 * country) stays whole in line 1, so nothing is put in the wrong column.
 */
export function splitSiteAddress(raw: string | null | undefined): SiteAddress {
  const none: SiteAddress = { line1: "", line2: "", city: "", state: "", zip: "" };
  const parts = tidyAddress(raw)
    .split(", ")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return none;
  if (parts.length > 1 && US.test(parts[parts.length - 1]!)) parts.pop();
  let state = "";
  let zip = "";
  const last = parts[parts.length - 1]!;
  const both = STATE_ZIP.exec(last);
  const all3 = CITY_STATE_ZIP.exec(last);
  if (all3 && parts.length > 1 && !stateCode(both?.[1] ?? "")) {
    // "…, Houston TX 77002": the city rides with the state.
    parts.pop();
    return { line1: parts[0] ?? "", line2: parts.slice(1).join(", "), city: all3[1]!, state: all3[2]!.toUpperCase(), zip: all3[3]! };
  }
  if (both && stateCode(both[1]!)) {
    state = stateCode(both[1]!);
    zip = both[2]!;
    parts.pop();
  } else if (ZIP.test(last) && parts.length > 1 && stateCode(parts[parts.length - 2]!)) {
    zip = last;
    state = stateCode(parts[parts.length - 2]!);
    parts.splice(-2, 2);
  } else if (stateCode(last) && parts.length > 1) {
    state = stateCode(last);
    parts.pop();
  } else {
    return { ...none, line1: parts.join(", ") };
  }
  // The part before the state is the city. Alone, it is the city unless it starts with a house number.
  const city = parts.length > 1 || (parts.length === 1 && !/^\d/.test(parts[0]!)) ? parts.pop()! : "";
  return { line1: parts[0] ?? "", line2: parts.slice(1).join(", "), city, state, zip };
}

/** "2026-10-23 09:44", Chicago time: sorts as text and reads the same in any spreadsheet. */
export function chicagoStamp(iso: string | null | undefined): string {
  const at = iso ? new Date(iso) : null;
  if (!at || Number.isNaN(at.getTime())) return "";
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/** Where the account came from: "NetSuite import 2026-10-23, by chuy". Blank history reads "Not recorded". */
export function sourceOf(added: ExportAccount["added"]): string {
  if (!added) return "Not recorded";
  const day = chicagoStamp(added.at).slice(0, 10);
  const by = added.by ? `, by ${added.by}` : "";
  if (/^added by the netsuite import/i.test(added.detail ?? "")) return `NetSuite import ${day}${by}`;
  return `Added in KatzDesk ${day}${by}`;
}

const yes = (on: boolean) => (on ? "Yes" : "");
const text = (v: string | null | undefined) => String(v ?? "").trim();

/** One row per account, in the export's columns. */
export function customerExportRows(accounts: ExportAccount[]): string[][] {
  return [...accounts]
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || a.id - b.id)
    .map((a) => {
      const site = splitSiteAddress(a.address);
      return [
        String(a.id),
        text(a.name),
        text(a.netsuiteId),
        text(a.accountNumber),
        site.line1,
        site.line2,
        site.city,
        site.state,
        site.zip,
        formatAddress({
          line1: a.billing.line1 ?? "",
          line2: a.billing.line2 ?? "",
          city: a.billing.city ?? "",
          state: a.billing.state ?? "",
          zip: a.billing.zip ?? "",
          country: a.billing.country ?? "",
        }),
        text(a.phone),
        text(a.email),
        text(a.rep),
        a.added ? chicagoStamp(a.added.at) : "",
        sourceOf(a.added),
        yes(isWalkInName(a.name) || a.walkIn === true),
        yes(a.inactive),
        yes(a.archived),
        yes(a.removalFlag),
      ];
    });
}

/** A CSV cell: quoted when needed, and a leading = + @ or -word can't start a spreadsheet formula. */
export function csvCell(v: unknown): string {
  let s = String(v ?? "");
  if (/^[=+@]/.test(s) || /^-[^\d]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Header and rows as CSV text (no byte-order mark: the download adds it, so Excel reads accents right). */
export function toCsv(columns: readonly string[], rows: string[][]): string {
  return [columns, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** "KatzDesk-Customers-2026-10-23.csv". */
export function customerExportName(day: string, format: "csv" | "xlsx"): string {
  return `KatzDesk-Customers-${day}.${format}`;
}
