/**
 * A Customer P.O. and a Vendor P.O. on every ticket: service and TLC tickets, PMs, installs, rebuilds and deals (Chuy,
 * 11/2). The Customer P.O. goes on the record's invoice (a ticket's is also on the NetSuite billing export); the Vendor
 * P.O. is the number a vendor gave, for reference only. Both are typed on the record's Details, shown on its card and
 * found by search.
 * Pure: no server imports, safe for node --test.
 */
import { PO_MAX } from "./invoice.ts";

export { PO_MAX };

export type PoBox = "Customer P.O." | "Vendor P.O.";

/** One P.O. box as saved: trimmed, blank as none, PO_MAX characters at most. */
export function cleanPoBox(raw: unknown, box: PoBox): { value: string | null } | { error: string } {
  const value = String(raw ?? "").trim();
  if (value.length > PO_MAX) return { error: `The ${box} is too long: ${PO_MAX} characters at most.` };
  return { value: value || null };
}

/**
 * A P.O. box as a save sent it: undefined when it wasn't sent (the stored one stays), else its value (null clears it).
 * Too long is refused, before anything is written.
 */
export function sentPo(raw: unknown, box: PoBox): string | null | undefined {
  if (raw === undefined) return undefined;
  const typed = cleanPoBox(raw, box);
  if ("error" in typed) throw new Error(typed.error);
  return typed.value;
}

/**
 * What a Details form sends for one P.O. box: what the box reads now, when it was changed since the form opened (or
 * since this form last saved it); otherwise nothing, so a form left open, or one that saves as it closes, never writes
 * an older P.O. back over one changed elsewhere meanwhile (the Invoice window, a merge, an import).
 */
export function poToSend(now: unknown, base: unknown): string | undefined {
  const typed = String(now ?? "").trim();
  return typed === String(base ?? "").trim() ? undefined : typed;
}

/** One P.O. box on a Details tab: the record it is for, what it shows, and the record's P.O. as the box last took it. */
export type PoBoxState = { key: string | number | null; value: string; base: string };

/**
 * A P.O. box as the record's P.O. (`now`) comes in from the server (11/2). Not changed here: it shows the record's.
 * Changed here, and the record now has what was typed (this sheet's own save): nothing is left to send. Changed here to
 * something else: what was typed stays, and a save sends it. Another record, or a box locked (a ticket billed or
 * invoiced meanwhile), starts it over from the record's, so nothing refused is shown or sent later. The same state comes
 * back when nothing changed.
 */
export function syncPoBox(cur: PoBoxState, key: string | number | null, now: string, locked = false): PoBoxState {
  if (locked) return cur.key === key && cur.value === now && cur.base === now ? cur : { key, value: now, base: now };
  if (cur.key !== key) return { key, value: now, base: now };
  if (cur.value.trim() === cur.base.trim()) return cur.value === now && cur.base === now ? cur : { key, value: now, base: now };
  if (cur.value.trim() === now.trim()) return cur.base === now ? cur : { key, value: cur.value, base: now };
  return cur;
}

/** The P.O.s for a card: "P.O. 4455 · Vendor P.O. TLC-889", one of them, or null when there are none. */
export function poCardLine(r: { po?: string | null; vendorPo?: string | null }): string | null {
  const po = String(r.po ?? "").trim();
  const vendor = String(r.vendorPo ?? "").trim();
  const parts = [po ? `P.O. ${po}` : null, vendor ? `Vendor P.O. ${vendor}` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** Whether what was typed in a board's search box is in either P.O. */
export function poMatches(q: string, r: { po?: string | null; vendorPo?: string | null }): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return false;
  return [r.po, r.vendorPo].some((v) => String(v ?? "").toLowerCase().includes(needle));
}

/**
 * A board's rows for a search: rows whose Customer or Vendor P.O. is exactly what was typed come first, whatever the
 * view, status or filters (as a WO number does), then the rows the view already shows. `more` adds a row's other
 * numbers that work the same way (an install's sale: its deal's P.O. and Sale Invoice/SO #, 11/3). Under 2 characters,
 * or no exact match, `shown` is returned as is.
 */
export function withPoMatches<T extends { id: number; po?: string | null; vendorPo?: string | null }>(
  shown: T[],
  all: T[],
  q: string,
  more?: (row: T) => (string | null | undefined)[],
): T[] {
  const key = q.trim().toLowerCase();
  if (key.length < 2) return shown;
  const hits = all.filter((row) => [row.po, row.vendorPo, ...(more?.(row) ?? [])].some((v) => String(v ?? "").trim().toLowerCase() === key));
  if (!hits.length) return shown;
  const ids = new Set(hits.map((row) => row.id));
  return [...hits, ...shown.filter((row) => !ids.has(row.id))];
}

/**
 * The top search's note on a record found by its P.O. (" · P.O. 4455" or " · Vendor P.O. TLC-9"), so the result says
 * why it was found; "" when the text matched something else.
 */
export function poSearchNote(q: string, r: { po?: string | null; vendor_po?: string | null }): string {
  const needle = q.trim().toLowerCase();
  if (!needle) return "";
  const po = String(r.po ?? "").trim();
  if (po && po.toLowerCase().includes(needle)) return ` · P.O. ${po}`;
  const vendor = String(r.vendor_po ?? "").trim();
  if (vendor && vendor.toLowerCase().includes(needle)) return ` · Vendor P.O. ${vendor}`;
  return "";
}

/**
 * An install's sale, from the deal it came from (Chuy, 11/3): "Sale Invoice/SO 12345 · Sale P.O. 4455", one of them,
 * or null when the deal has neither. For reference only: the sale's P.O. is for the equipment sale, not the install
 * visit, so it never becomes the install's Customer P.O.
 */
export function saleRefLine(sale: { invoice?: string | null; po?: string | null } | null | undefined): string | null {
  if (!sale) return null;
  const invoice = String(sale.invoice ?? "").trim();
  const po = String(sale.po ?? "").trim();
  const parts = [invoice ? `Sale Invoice/SO ${invoice}` : null, po ? `Sale P.O. ${po}` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** The top search's note on an install found by its sale's P.O. (" · Sale P.O. 4455"), or "" (11/3). */
export function salePoNote(q: string, salePo: string | null | undefined): string {
  const needle = q.trim().toLowerCase();
  const po = String(salePo ?? "").trim();
  return needle && po && po.toLowerCase().includes(needle) ? ` · Sale P.O. ${po}` : "";
}

/**
 * Why a ticket's Customer P.O. can't change on its Ticket tab, or null when it can. It went to NetSuite with the ticket's
 * billing: billed on a Sales Order (clear the SO to change it), or invoiced in NetSuite (an Admin's unlock of the
 * ticket's Charges changes it there, with the rest of the billing).
 */
export function ticketPoLock(t: { nsSo: string | null | undefined; invoice: { invoice: string; status: string } | null | undefined }): string | null {
  const so = String(t.nsSo ?? "").trim();
  if (so) return `Billed on ${so}, so its Customer P.O. stays as billed. Clear the Sales Order number in the ticket's Charges to change it.`;
  if (t.invoice) {
    return `Invoiced in NetSuite on ${t.invoice.invoice} (${t.invoice.status}), so its Customer P.O. is locked. An Admin can unlock the ticket's Charges and change it there.`;
  }
  return null;
}
