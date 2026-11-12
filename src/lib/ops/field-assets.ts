/**
 * Assets → In the Field (Chuy, 11/12): every machine on a customer account, and where it is. The rows come from
 * account_equipment with the account each is on; these rules filter, count and export them, and group them by account
 * for the map. The page reads the account's pin and rep from the map's own account list.
 */

/** One machine at a customer, as the Assets list shows it. */
export type FieldAsset = {
  id: number;
  customer: string;
  /** The account on the customer list, by name; null when no account has the name. */
  customerId: number | null;
  /** The account was removed from the list: the machine shows with the flag, so nothing goes missing. */
  accountRemoved: boolean;
  address: string | null;
  catalogModel: string;
  equipmentName: string;
  brand: string;
  serial: string | null;
  partNumber: string | null;
  ownership: string | null;
  installDate: string | null;
  condition: string | null;
};

/** Brands whose name is two words; any other brand is the model's first word ("Bunn ITCB-DV" → Bunn). */
const TWO_WORD_BRANDS = ["la marzocco", "la cimbali", "la pavoni", "la spaziale", "nuova simonelli", "victoria arduino"];

/** The model's brand: its first word, or the first two for the brands written that way. */
export function brandOf(model: string | null | undefined): string {
  const words = String(model ?? "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const two = words.slice(0, 2).join(" ");
  if (TWO_WORD_BRANDS.includes(two.toLowerCase())) return two;
  return words[0]!;
}

/** The filters the page applies. Blank means any; rep "__none__" means accounts with no rep. */
export type FieldFilters = {
  q?: string;
  brand?: string;
  model?: string;
  ownership?: string;
  condition?: string;
  rep?: string;
};

export const NO_REP_FILTER = "__none__";
/** The ownership and condition filter's value for machines that have none. */
export const NOT_SET = "__unset__";

const same = (a: string | null | undefined, b: string) => String(a ?? "").trim().toLowerCase() === b.trim().toLowerCase();

/** The machines that pass every filter set. `repOf` gives an account's rep (null when it has none). */
export function filterFieldAssets(rows: readonly FieldAsset[], f: FieldFilters, repOf: (customer: string) => string | null): FieldAsset[] {
  const needle = (f.q ?? "").trim().toLowerCase();
  return rows.filter((r) => {
    if (f.brand && !same(r.brand, f.brand)) return false;
    if (f.model && !same(r.catalogModel, f.model)) return false;
    if (f.ownership && (f.ownership === NOT_SET ? !!r.ownership : !same(r.ownership, f.ownership))) return false;
    if (f.condition && (f.condition === NOT_SET ? !!r.condition : !same(r.condition, f.condition))) return false;
    if (f.rep) {
      const rep = repOf(r.customer);
      if (f.rep === NO_REP_FILTER ? !!rep : !same(rep, f.rep)) return false;
    }
    if (!needle) return true;
    return [r.customer, r.address, r.catalogModel, r.equipmentName, r.serial, r.partNumber]
      .some((v) => String(v ?? "").toLowerCase().includes(needle));
  });
}

/** Each value of a field and how many machines have it, most first; blanks are left out. */
export function countBy(rows: readonly FieldAsset[], pick: (r: FieldAsset) => string | null | undefined): [string, number][] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const v = String(pick(r) ?? "").trim();
    if (v) m.set(v, (m.get(v) ?? 0) + 1);
  }
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** The machines by account (lower-case name), for the map: one pin per account. */
export function byAccount(rows: readonly FieldAsset[]): Map<string, FieldAsset[]> {
  const m = new Map<string, FieldAsset[]>();
  for (const r of rows) {
    const k = r.customer.trim().toLowerCase();
    m.set(k, [...(m.get(k) ?? []), r]);
  }
  return m;
}

const CSV_HEADERS = ["Account", "Rep", "Address", "Brand", "Catalog Model", "Equipment Name", "Serial", "Part #", "Ownership", "Install Date", "Condition"];

/** A spreadsheet cell: quoted when it needs to be, and a leading = + - @ made plain text so it can't run as a formula. */
function csvCell(v: string | null | undefined): string {
  let s = String(v ?? "");
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The filtered machines as CSV, the columns the page shows plus the rep. */
export function fieldAssetsCsv(rows: readonly FieldAsset[], repOf: (customer: string) => string | null): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const r of rows) {
    lines.push(
      [r.customer, repOf(r.customer), r.address, r.brand, r.catalogModel, r.equipmentName, r.serial, r.partNumber, r.ownership, r.installDate, r.condition]
        .map(csvCell)
        .join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}
