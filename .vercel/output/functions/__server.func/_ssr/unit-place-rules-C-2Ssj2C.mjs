import { a as LOCATION_SITES, g as slotId, h as siteLabel, o as SITE_LABEL, p as rackBayError } from "./warehouse-DOAlNQ25.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/unit-place-rules-C-2Ssj2C.js
var HOUSE_TRAINING = "training";
var HOUSE_LOBBY = "front-lobby";
var HOUSE_STAGING = "staging";
var HOUSE_OTHER = "other";
var CUSTOMER_SITES = LOCATION_SITES.filter((s) => s !== "training" && s !== "front-lobby");
var PLACE_CHOICES = [
	{
		value: "barn-front",
		label: "Front rack"
	},
	{
		value: "barn-back",
		label: "Back rack"
	},
	{
		value: HOUSE_TRAINING,
		label: "Training"
	},
	{
		value: "lobby",
		label: "Lobby"
	},
	{
		value: HOUSE_STAGING,
		label: "Staging area"
	},
	{
		value: HOUSE_OTHER,
		label: "Other"
	},
	...CUSTOMER_SITES.map((s) => ({
		value: s,
		label: SITE_LABEL[s] ?? s
	}))
];
function electricalFrom(text) {
	if (!text) return null;
	const m = text.match(/\b(\d{2,3}\s*V(?:\s*\/\s*[^\s,;]+)?(?:\s*\/\s*\d{1,3}A)?)\b/i);
	return m ? m[1].replace(/\s+/g, " ") : null;
}
function resolvePlaceSite(value) {
	if (value === "lobby") return HOUSE_LOBBY;
	return value;
}
function isRackPlace(site) {
	return site === "barn-front" || site === "barn-back";
}
function unitPlaceLabel(row) {
	const pallet = row.pallet?.trim().toUpperCase();
	const level = row.level == null || Number.isNaN(Number(row.level)) ? null : Number(row.level);
	const rack = row.site === "barn-front" ? "Front" : row.site === "barn-back" ? "Back" : null;
	if (rack && pallet && level) return `${rack} · ${slotId(pallet, level)}`;
	if (rack && pallet) return `${rack} · ${pallet}`;
	if (rack) return rack === "Front" ? "Front rack" : "Back rack";
	if (row.site === "training") return "Training";
	if (row.site === "front-lobby") return "Lobby";
	if (row.site === "staging") return "Staging area";
	if (row.site === "other") return (row.purpose ?? "").trim() || "Other";
	if (row.site === "account") return row.soldTo?.trim() ? `On ${row.soldTo.trim()}` : "On the account";
	if (row.site === "removed" || row.status === "removed") return "Removed from stock";
	const site = siteLabel(row.site);
	if (row.soldTo?.trim() && (row.status === "assigned" || row.status === "sold")) return `${row.soldTo.trim()} / ${site}`;
	return site || SITE_LABEL[row.site] || row.site;
}
function lastMoveLine(notes) {
	const lines = (notes ?? "").split(/\n/).map((s) => s.trim()).filter((s) => /^Moved from /i.test(s));
	return lines.length ? lines[lines.length - 1] : null;
}
/**
* A unit assigned to an account, or sold, is locked: it is an asset at that site or customer.
* It can't be put on a rack, moved to another place, or given to another account until it is returned.
*/
function placeMove(existing) {
	if (!existing) return "create";
	if (existing.status === "sold" || existing.status === "assigned") return "blocked";
	return "move";
}
function placeDraftError(draft) {
	if (!draft.site || draft.site === "barn") return "Pick a rack.";
	if (isRackPlace(draft.site)) {
		const bay = rackBayError(draft.site, draft.pallet);
		if (bay) return bay.endsWith(".") ? bay : `${bay}.`;
	}
	if (isRackPlace(draft.site) && !draft.level) return "Pick a level.";
	if (draft.site === "other" && !(draft.otherLabel ?? "").trim()) return "Other needs a short label.";
	return null;
}
//#endregion
export { HOUSE_TRAINING as a, isRackPlace as c, placeMove as d, resolvePlaceSite as f, HOUSE_STAGING as i, lastMoveLine as l, HOUSE_LOBBY as n, PLACE_CHOICES as o, unitPlaceLabel as p, HOUSE_OTHER as r, electricalFrom as s, CUSTOMER_SITES as t, placeDraftError as u };
