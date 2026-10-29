/**
 * Warehouse refurb invoices (Chuy, 2026-10-29). A warehouse user records the parts a refurb used on the rebuild's
 * invoice, billed to Katz Coffee Service Dept. only, and saves it for an Admin to approve; an Admin approves it.
 * Warehouse changes only its own refurbs: rebuilds for Katz Coffee Service Dept., or Katz shop / stock.
 * Pure: no server imports, safe for node --test.
 */
import type { ChargeKind } from "./charges.ts";
import { isLaborKind, type InvoiceTarget } from "./invoice.ts";
import { SHOP_ACCOUNT } from "./rebuild-model.ts";

/** The account warehouse invoices bill, as the customer list has it. */
export const SERVICE_DEPT_ACCOUNT = "Katz Coffee Service Dept.";

/** A name that ends a sentence: "Katz Coffee Service Dept." already carries its period. */
export const sentence = (name: string) => (name.trim().endsWith(".") ? name.trim() : `${name.trim()}.`);

const nameKey = (name: string | null | undefined) =>
  String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

/**
 * The account's name with letters and digits only, the way the server matches it (the same as
 * `regexp_replace(lower(name), '[^a-z0-9]+', '', 'g')`): "Dept." or "Department" spelled out.
 */
export const SERVICE_DEPT_KEYS: readonly string[] = [nameKey(SERVICE_DEPT_ACCOUNT), "katzcoffeeservicedepartment"];

/** Katz Coffee Service Dept., however it is typed: case, spaces, the period, or "Department" spelled out. */
export function isServiceDeptAccount(name: string | null | undefined): boolean {
  return SERVICE_DEPT_KEYS.includes(nameKey(name));
}

export function isShopAccount(name: string | null | undefined): boolean {
  return nameKey(name) === nameKey(SHOP_ACCOUNT);
}

/** The rebuilds a warehouse user may change: its refurbs for Katz Coffee Service Dept., or Katz shop / stock. */
export function warehouseMayEdit(account: string | null | undefined): boolean {
  return isServiceDeptAccount(account) || isShopAccount(account);
}

/** The same accounts as warehouseMayEdit, as the server's letters-and-digits keys, for checks inside a write. */
export const WAREHOUSE_ACCOUNT_KEYS: readonly string[] = [...SERVICE_DEPT_KEYS, nameKey(SHOP_ACCOUNT)];

/** Why a warehouse user can't change this rebuild, or null when they can. */
export function warehouseEditRefusal(account: string | null | undefined): string | null {
  if (warehouseMayEdit(account)) return null;
  return `Warehouse changes refurbs for ${SERVICE_DEPT_ACCOUNT} and ${SHOP_ACCOUNT} only. This rebuild is for ${String(account ?? "").trim() || "no account"}; ask an Admin.`;
}

/**
 * The account a warehouse user's save gives a rebuild, or the reason it is refused. They keep the account it has
 * (on a rebuild they may change), or move a Katz shop / stock rebuild to Katz Coffee Service Dept.; nothing else.
 * serviceDept: the save puts it on Katz Coffee Service Dept. (the server writes the name as the customer list has it).
 */
export function warehouseAccountChange(current: string, next: string | null | undefined): { ok: true; serviceDept: boolean } | { ok: false; error: string } {
  const refusal = warehouseEditRefusal(current);
  if (refusal) return { ok: false, error: refusal };
  const want = next == null ? current : next;
  if (isServiceDeptAccount(want)) return { ok: true, serviceDept: true };
  if (nameKey(want) === nameKey(current)) return { ok: true, serviceDept: false };
  return { ok: false, error: `Warehouse refurbs bill ${sentence(SERVICE_DEPT_ACCOUNT)} Ask an Admin to put this rebuild on another account.` };
}

/** none: nothing saved yet. waiting: Warehouse saved it for an Admin to approve. approved: an approved invoice. */
export type InvoiceState = "none" | "waiting" | "approved";

export function invoiceState(head: { approvedAt?: unknown; submittedAt?: unknown } | null | undefined): InvoiceState {
  if (!head) return "none";
  if (head.approvedAt) return "approved";
  return head.submittedAt ? "waiting" : "none";
}

/** Admin: the desk owner flag or the Admin role. Warehouse: the Warehouse role, when not an Admin. */
export type InvoiceViewer = { admin: boolean; warehouse: boolean };

export type InvoicePowers = {
  /** Approve: saves the lines as the record's invoice. Admins always; Warehouse never; anyone else unless it waits for an Admin. */
  canApprove: boolean;
  /** Save for Approval: Warehouse, on a rebuild for Katz Coffee Service Dept. that isn't approved yet. */
  canSave: boolean;
  /** No labor or trip lines (Warehouse). */
  partsOnly: boolean;
  /** Why this person can neither approve nor save, as a sentence; null when one of them is open. */
  blocked: string | null;
};

/** Why Warehouse can't invoice a rebuild on this account, as a sentence, or null for Katz Coffee Service Dept. */
export function warehouseInvoiceRefusal(account: string | null | undefined): string | null {
  const name = String(account ?? "").trim();
  if (isServiceDeptAccount(name)) return null;
  return isShopAccount(name)
    ? `Warehouse invoices bill ${sentence(SERVICE_DEPT_ACCOUNT)} This rebuild is on ${SHOP_ACCOUNT}: on Details, choose Bill ${SERVICE_DEPT_ACCOUNT} and Save, then invoice it.`
    : `Warehouse invoices bill ${SERVICE_DEPT_ACCOUNT} only. This rebuild is for ${name || "no account"}; an Admin invoices it.`;
}

export function invoicePowers(viewer: InvoiceViewer, record: { type: InvoiceTarget; customer: string; state: InvoiceState }): InvoicePowers {
  if (viewer.admin) return { canApprove: true, canSave: false, partsOnly: false, blocked: null };
  if (viewer.warehouse) {
    const blocked =
      record.type !== "rebuild"
        ? "Warehouse invoices are for rebuilds."
        : (warehouseInvoiceRefusal(record.customer) ?? (record.state === "approved" ? "This invoice is approved. Ask an Admin to change it." : null));
    return { canApprove: false, canSave: !blocked, partsOnly: true, blocked };
  }
  if (record.state === "waiting") return { canApprove: false, canSave: false, partsOnly: false, blocked: "This invoice is waiting for an Admin to approve it." };
  return { canApprove: true, canSave: false, partsOnly: false, blocked: null };
}

/** The first line that isn't a part, as a sentence, or null: warehouse invoices are for the parts a refurb used. */
export function partsOnlyError(lines: { kind: ChargeKind }[]): string | null {
  const i = lines.findIndex((l) => l.kind !== "part");
  if (i < 0) return null;
  const kind = lines[i]!.kind;
  if (isLaborKind(kind)) return `Line ${i + 1}: Warehouse invoices are for parts. Take the ${kind === "trip" ? "trip charge" : "labor"} off; an Admin can add it when approving.`;
  return `Line ${i + 1}: Warehouse invoices are for parts, and this item is ${kind === "equipment" ? "equipment" : "not a part"}. Take it off; an Admin can add it when approving.`;
}

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** The ping every Admin gets when Warehouse first saves an invoice for approval. The bell matches its first words. */
export function waitingNotice(who: string, recordTitle: string, account: string, lineCount: number, total: number): string {
  return `Invoice waiting for approval. ${who} saved ${lineCount} part line${lineCount === 1 ? "" : "s"} on ${recordTitle} (${account}), ${money(total)}. Open its Invoices tab to approve it.`;
}

/** True for the ping above. */
export const isWaitingNotice = (body: string) => body.startsWith("Invoice waiting for approval.");
