/**
 * Cost and margin on the lines of PM, install, rebuild and deal invoices (invoice_lines) and of NetSuite's lines on an
 * install or PM (record_ns_charges), Chuy 11/20. Stored when the invoice is approved or the lines come in through
 * Billing Backfill; worked out live before that. Ticket lines are ticket_charges (charges-api), priced the same way.
 */
import type { Sql } from "@/lib/db";
import { billTotals, takesDiscount, type Discount } from "./discount";
import { billProfitTotals, discountShares, priceLine, storedLineProfit, type BillProfitTotals, type LineProfit } from "./part-pricing";
import { round2 } from "./charges";
import { loadDiscountRule } from "./discount-rule";
import { loadLaborRate } from "./labor-cost";

export type LineCostTable = "invoice_lines" | "record_ns_charges";
export type StoredLineProfit = LineProfit & { stored: boolean };
export type BillProfit = { profit: (StoredLineProfit | null)[]; totals: BillProfitTotals };

type Row = {
  id: number;
  qty: string;
  rate: string;
  kind: string;
  chosen: boolean | null;
  pid: number | null;
  p_list: string | null;
  p_cost: string | null;
  unit_cost: string | null;
  cost_source: string | null;
  line_discount: string | null;
  margin: string | null;
  priced_at: unknown;
};

const PARENT: Record<LineCostTable, string> = { invoice_lines: "invoice_id", record_ns_charges: "billing_id" };
const num = (v: string | null) => (v == null ? null : Number(v));

async function lineRows(sql: Sql, table: LineCostTable, parentId: number): Promise<Row[]> {
  // NetSuite's record lines have no Chosen ticks: their discount is on the whole bill.
  const chosen = table === "invoice_lines" ? "l.discount_chosen" : "false";
  return sql.query<Row>(
    `select l.id, l.qty, l.rate, l.kind, ${chosen} as chosen, p.id as pid, p.list_price as p_list, p.cost as p_cost,
            l.unit_cost, l.cost_source, l.line_discount, l.margin, l.priced_at
       from ${table} l
       left join lateral (
         select * from billing_items b
          where lower(btrim(b.item)) = lower(btrim(l.item)) or lower(btrim(b.sku)) = lower(btrim(l.item))
          order by (lower(btrim(b.item)) = lower(btrim(l.item))) desc
          limit 1
       ) p on true
      where l.${PARENT[table]} = $1
      order by l.sort, l.id`,
    [parentId],
  );
}

async function livePrices(sql: Sql, rows: Row[], discount: Discount | null) {
  const lines = rows.map((r) => ({ qty: Number(r.qty), rate: Number(r.rate), discountChosen: r.chosen === true }));
  const off = billTotals(lines, discount).off;
  const shares = discountShares(
    lines.map((l) => round2(l.qty * l.rate)),
    off,
    lines.map((l) => takesDiscount(l, discount)),
  );
  const rule = await loadDiscountRule(sql);
  const laborRate = await loadLaborRate(sql);
  const live = rows.map((r, i) =>
    priceLine({ qty: lines[i].qty, rate: lines[i].rate, kind: r.kind }, r.pid == null ? null : { listPrice: num(r.p_list), cost: num(r.p_cost) }, rule, laborRate, shares[i] ?? 0),
  );
  return { lines, off, live };
}

/** Store each line's cost and margin as of now. Labor with no Labor Cost Rate yet stays live, to price once it's set. */
export async function storeLineCosts(sql: Sql, table: LineCostTable, parentId: number, discount: Discount | null): Promise<void> {
  const rows = await lineRows(sql, table, parentId);
  const { live } = await livePrices(sql, rows, discount);
  for (let i = 0; i < rows.length; i++) {
    const p = live[i];
    if (!p || (rows[i].kind === "labor" && p.cost == null)) continue;
    await sql.query(`update ${table} set unit_cost = $2, cost_source = $3, line_discount = $4, margin = $5, priced_at = now() where id = $1`, [
      rows[i].id,
      p.unitCost,
      p.source,
      p.ticketDiscount,
      p.margin,
    ]);
  }
}

/** Each line's cost and margin (stored, else live) and the bill's totals. The labor rate goes only to an Admin. */
export async function billProfit(sql: Sql, table: LineCostTable, parentId: number, discount: Discount | null, admin: boolean): Promise<BillProfit> {
  const rows = await lineRows(sql, table, parentId);
  const { lines, off, live } = await livePrices(sql, rows, discount);
  const profit: (StoredLineProfit | null)[] = rows.map((r, i) => {
    const p: StoredLineProfit | null = r.priced_at
      ? { ...storedLineProfit(lines[i], { unitCost: num(r.unit_cost), source: r.cost_source, discount: num(r.line_discount), margin: num(r.margin) }), stored: true }
      : live[i]
        ? { ...live[i]!, stored: false }
        : null;
    return p && !admin && r.kind === "labor" ? { ...p, unitCost: null } : p;
  });
  return { profit, totals: billProfitTotals(lines, off, profit) };
}
