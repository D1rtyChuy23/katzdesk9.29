import { a as LOCATION_SITES, l as isBarn, m as slotId, o as SITE_LABEL, p as siteLabel } from "./warehouse-C-11YLmg.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/unit-place-rules-CwKl9-0X.js
var HOUSE_TRAINING = "training";
var HOUSE_LOBBY = "front-lobby";
var HOUSE_STAGING = "staging";
var HOUSE_OTHER = "other";
var CUSTOMER_SITES = LOCATION_SITES.filter((s) => s !== "training" && s !== "front-lobby");
var PLACE_CHOICES = [
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
	{
		value: "barn",
		label: "Barn"
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
function unitPlaceLabel(row) {
	const pallet = row.pallet?.trim().toUpperCase();
	const level = row.level == null || Number.isNaN(Number(row.level)) ? null : Number(row.level);
	if (isBarn(row.site) && pallet && level) return `Barn · ${slotId(pallet, level)}`;
	if (isBarn(row.site) && pallet) return `Barn · ${pallet}`;
	if (isBarn(row.site)) return "Barn";
	if (row.site === "training") return "Training";
	if (row.site === "front-lobby") return "Lobby";
	if (row.site === "staging") return "Staging area";
	if (row.site === "other") return (row.purpose ?? "").trim() || "Other";
	const site = siteLabel(row.site);
	if (row.soldTo?.trim() && (row.status === "assigned" || row.status === "sold")) return `${row.soldTo.trim()} / ${site}`;
	return site || SITE_LABEL[row.site] || row.site;
}
function lastMoveLine(notes) {
	const lines = (notes ?? "").split(/\n/).map((s) => s.trim()).filter((s) => /^Moved from /i.test(s));
	return lines.length ? lines[lines.length - 1] : null;
}
function placeMove(existing) {
	if (!existing) return "create";
	if (existing.status === "sold" || existing.status === "assigned") return "blocked";
	return "move";
}
function placeDraftError(draft) {
	if (!draft.site) return "Pick a location.";
	if (draft.site === "barn" && !(draft.pallet ?? "").trim()) return "Pick a bay A through P.";
	if (draft.site === "barn" && !draft.level) return "Pick a level.";
	if (draft.site === "other" && !(draft.otherLabel ?? "").trim()) return "Other needs a short label.";
	return null;
}
//#endregion
export { HOUSE_TRAINING as a, lastMoveLine as c, resolvePlaceSite as d, unitPlaceLabel as f, HOUSE_STAGING as i, placeDraftError as l, HOUSE_LOBBY as n, PLACE_CHOICES as o, HOUSE_OTHER as r, electricalFrom as s, CUSTOMER_SITES as t, placeMove as u };
