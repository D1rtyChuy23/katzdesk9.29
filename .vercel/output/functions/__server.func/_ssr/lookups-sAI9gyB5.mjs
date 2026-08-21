//#region node_modules/.nitro/vite/services/ssr/assets/lookups-sAI9gyB5.js
var TECHNICIANS = [
	"Ryan",
	"Elias",
	"Oliver",
	"Josh",
	"Charles",
	"Bill",
	"Lance",
	"3rd Party"
];
var CALL_STATUSES = [
	"Open",
	"Dispatched",
	"In Progress",
	"Follow-up Needed",
	"Phone Resolved",
	"Completed",
	"Cancelled"
];
var CALL_TYPES = [
	"Field Service",
	"In-House Rebuild",
	"Installation"
];
var PM_STATUSES = [
	"Pending Scheduling",
	"Scheduled",
	"Awaiting Parts",
	"Ready to Dispatch",
	"In Progress",
	"Completed",
	"Cancelled"
];
var PM_STYLES = [
	"6 month PM",
	"12 month PM",
	"36 month PM",
	"Grinder PM"
];
var PARTS_STATUSES = [
	"Yes - All Available",
	"Partial",
	"No - Awaiting Parts",
	"On Order",
	"TBD / Check Inventory"
];
var EQUIP_STATUSES = [
	"Ready",
	"Not Ready",
	"Installed"
];
var REQS_READY = ["Ready", "Not Ready"];
var PRODUCERS = [
	"Bill",
	"Lance",
	"Sean",
	"Shannon",
	"Lizbeth",
	"Amanda",
	"Jesus"
];
var PRODUCER_INITIALS = {
	Bill: "BM",
	Lance: "LO",
	Sean: "SM",
	Shannon: "SC",
	Lizbeth: "LR",
	Amanda: "AL",
	Jesus: "JG"
};
var PAYMENT_TERMS = [
	"Payment Plan",
	"50% Down + 50% upon install/30 days after",
	"50% Down / 50% at Install or Net 30",
	"Lease",
	"Paid in Full",
	"No Purchased Equipment"
];
var MODULE_PLATFORMS = [
	"Cameo",
	"Enigma / e'Line",
	"Legacy"
];
var MODULE_TYPES = [
	"Brew Module",
	"Medium Brew Module",
	"Large Brew Module",
	"Steam S Module",
	"Steam M Module",
	"Hydraulic Module",
	"Grinder Module",
	"Milk Module",
	"Pump Module",
	"Powder Module"
];
var MODULE_STATUSES = [
	"Not Started",
	"In Progress",
	"Waiting on Parts",
	"Ready",
	"Ship to Eversys (Core Swap)",
	"At Eversys - Awaiting Return",
	"Installed at Account",
	"Retired / Scrapped"
];
var URGENCIES = [
	"Emergency",
	"High",
	"Normal",
	"Low"
];
var URGENCY_RANK = {
	Emergency: 0,
	High: 1,
	Normal: 2,
	Low: 3
};
var CLOSED_CALL = /* @__PURE__ */ new Set([
	"Completed",
	"Cancelled",
	"Phone Resolved"
]);
var CLOSED_PM = /* @__PURE__ */ new Set(["Completed", "Cancelled"]);
var PRODUCER_INITIAL_VALUES = new Set(Object.values(PRODUCER_INITIALS).map((s) => s.toLowerCase()));
function normalizeName(s) {
	return s.trim().toLowerCase().replace(/['’]/g, "");
}
function nameTokens(raw) {
	if (!raw) return [];
	const n = normalizeName(raw);
	if (!n) return [];
	return [n, ...n.split(/[\s@._+\-]+/).filter(Boolean)];
}
/** Keys used to decide whether a handoff item belongs to the signed-in person. */
function userMatchKeys(user) {
	const keys = /* @__PURE__ */ new Set();
	if (!user) return keys;
	const add = (raw) => {
		for (const t of nameTokens(raw)) if (t.length >= 3 || t.length === 2 && PRODUCER_INITIAL_VALUES.has(t)) keys.add(t);
	};
	add(user.displayName);
	add(user.primaryEmail);
	const parts = (user.displayName ?? "").trim().split(/\s+/).filter(Boolean);
	if (parts.length >= 2) {
		const initials = (parts[0][0] + parts[1][0]).toLowerCase();
		if (PRODUCER_INITIAL_VALUES.has(initials)) keys.add(initials);
	}
	for (const [name, initials] of Object.entries(PRODUCER_INITIALS)) if (keys.has(name.toLowerCase())) keys.add(initials.toLowerCase());
	return keys;
}
function namesMatchUser(user, ...names) {
	const keys = userMatchKeys(user);
	if (!keys.size) return false;
	for (const name of names) for (const t of nameTokens(name)) if (keys.has(t)) return true;
	return false;
}
//#endregion
export { URGENCIES as _, EQUIP_STATUSES as a, MODULE_TYPES as c, PM_STATUSES as d, PM_STYLES as f, TECHNICIANS as g, REQS_READY as h, CLOSED_PM as i, PARTS_STATUSES as l, PRODUCER_INITIALS as m, CALL_TYPES as n, MODULE_PLATFORMS as o, PRODUCERS as p, CLOSED_CALL as r, MODULE_STATUSES as s, CALL_STATUSES as t, PAYMENT_TERMS as u, URGENCY_RANK as v, namesMatchUser as y };
