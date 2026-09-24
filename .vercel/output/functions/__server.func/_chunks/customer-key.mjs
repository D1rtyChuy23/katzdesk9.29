//#region src/lib/ops/customer-key.ts
/** Alphanumeric compare key for a customer name. */
function normalizeCustomerKey(name) {
	return String(name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}
/** Corrigo walk-up / counter work — not a real KatzDesk account. */
function isWalkIn(name) {
	return normalizeCustomerKey(name) === "walkin";
}
//#endregion
export { normalizeCustomerKey as n, isWalkIn as t };
