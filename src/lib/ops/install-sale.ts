/**
 * The sale an install came from (Chuy, 11/3): "A PO for an equipment sale is not for the install visit, but the sale the
 * install fee is added so it would be good to reference the sale in the install."
 *
 * So the deal's P.O. stays the deal's, and an install made from a deal shows that deal's Sale Invoice # or Sales Order #
 * and P.O., for reference: on its card, its Details and the account page. Search finds the install by them too. Nothing
 * is copied: a change on the deal shows on its installs the next time they're read.
 */
import type { Sql } from "@/lib/db";
import type { InstallSale } from "@/lib/ops/types";

const textOrNull = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  return s || null;
};

/** Each install's sale: its deal's Sale Invoice/SO # and P.O., or null when it came from no deal (or the deal is gone). */
export async function withSales<T extends { dealId: number | null; sale?: InstallSale | null }>(sql: Sql, installs: T[]): Promise<T[]> {
  const ids = [...new Set(installs.map((i) => i.dealId).filter((id): id is number => id != null).map(Number))];
  const rows = ids.length
    ? await sql.query<{ id: number; invoice: string | null; po: string | null }>("select id, invoice, po from deals where id = any($1::int[])", [ids])
    : [];
  const byId = new Map(rows.map((r) => [Number(r.id), r]));
  for (const i of installs) {
    const deal = i.dealId == null ? undefined : byId.get(Number(i.dealId));
    i.sale = deal ? { dealId: Number(deal.id), invoice: textOrNull(deal.invoice), po: textOrNull(deal.po) } : null;
  }
  return installs;
}
