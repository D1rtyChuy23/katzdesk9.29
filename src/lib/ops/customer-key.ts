/** Alphanumeric compare key for a customer name. */
export function normalizeCustomerKey(name: string | null | undefined): string {
  return String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/** Corrigo walk-up / counter work — not a real KatzDesk account. */
export function isWalkIn(name: string | null | undefined): boolean {
  return normalizeCustomerKey(name) === "walkin";
}
