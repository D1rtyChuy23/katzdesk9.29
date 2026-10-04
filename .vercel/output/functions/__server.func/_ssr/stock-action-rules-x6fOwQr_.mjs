//#region node_modules/.nitro/vite/services/ssr/assets/stock-action-rules-x6fOwQr_.js
var REMOVE_REASONS = [
	"Sold / left with customer",
	"Installed",
	"Sent to rebuild",
	"Scrap / beyond repair",
	"Returned to vendor",
	"Duplicate record",
	"Other"
];
var HOUSE_PLACES = /* @__PURE__ */ new Set([
	"barn-back",
	"barn-front",
	"staging",
	"training",
	"front-lobby"
]);
function isRemoveReason(value) {
	return REMOVE_REASONS.includes(value);
}
function removeReasonError(reason, note) {
	if (!isRemoveReason(reason)) return "Pick a reason.";
	if (reason === "Other" && !(note ?? "").trim()) return "Other needs a note.";
	return null;
}
/** Rack, staging, training, or lobby — not a customer site. */
function isWarehouseStockPlace(site) {
	return HOUSE_PLACES.has(site ?? "");
}
function customerLocationMessage(name) {
	return `This serial is still on ${name.trim() || "a customer account"}. Move it off the account first.`;
}
//#endregion
export { removeReasonError as i, customerLocationMessage as n, isWarehouseStockPlace as r, REMOVE_REASONS as t };
