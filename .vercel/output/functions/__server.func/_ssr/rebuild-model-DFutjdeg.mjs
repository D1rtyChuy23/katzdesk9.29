import { o as diffDays, x as isoDay } from "./clock-CnyB9j5S.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/rebuild-model-DFutjdeg.js
/** Pure rebuild project rules — no server imports. */
var REBUILD_STATUSES = [
	"Queued",
	"In progress",
	"Waiting",
	"Testing",
	"Ready",
	"Completed",
	"Cancelled"
];
var WAITING_REASONS = [
	"Parts on order",
	"Parts not available",
	"Waiting on decision",
	"Waiting on customer",
	"Tech / bench unavailable",
	"Scope changed",
	"Found additional failure",
	"Other"
];
var REBUILD_PRIORITIES = [
	"normal",
	"high",
	"committed-to-customer"
];
var SHOP_ACCOUNT = "Katz shop / stock";
var HEALTH_RANK = {
	overdue: 0,
	"at-risk": 1,
	"no-date": 2,
	"on-track": 3,
	done: 4
};
var HEALTH_LABEL = {
	overdue: "Overdue",
	"at-risk": "At risk",
	"no-date": "No date",
	"on-track": "On track",
	done: "Done"
};
var CLOSED_REBUILD = /* @__PURE__ */ new Set(["Completed", "Cancelled"]);
var NEEDS_TARGET = /* @__PURE__ */ new Set([
	"In progress",
	"Waiting",
	"Testing"
]);
function isRebuildStatus(v) {
	return !!v && REBUILD_STATUSES.includes(v);
}
function isWaitingReason(v) {
	return !!v && WAITING_REASONS.includes(v);
}
function isRebuildPriority(v) {
	return !!v && REBUILD_PRIORITIES.includes(v);
}
function computeRebuildMetrics(row, today) {
	const status = isRebuildStatus(row.status) ? row.status : "Queued";
	const created = isoDay(row.createdAt) || today;
	const started = isoDay(row.actualStart) || created;
	const target = isoDay(row.targetComplete);
	const doneOn = isoDay(row.actualComplete);
	const changed = isoDay(row.statusChangedAt) || created;
	const daysOpen = diffDays(started, today);
	const daysToTarget = target ? diffDays(today, target) : null;
	const daysInStatus = diffDays(changed, today);
	const daysLateEarly = doneOn && target ? diffDays(target, doneOn) : null;
	let health = "on-track";
	if (CLOSED_REBUILD.has(status)) health = "done";
	else if (NEEDS_TARGET.has(status) && !target) health = "no-date";
	else if (target && target < today) health = "overdue";
	else if (status === "Waiting") health = "at-risk";
	else if (target && daysToTarget != null && daysToTarget <= 3) health = "at-risk";
	else if (target) health = "on-track";
	else health = "on-track";
	let clockFlag = null;
	if (!CLOSED_REBUILD.has(status)) {
		if (health === "overdue") clockFlag = "overdue";
		else if (status === "Waiting" && daysInStatus > 5) clockFlag = "waiting-long";
	}
	return {
		health,
		daysOpen,
		daysToTarget,
		daysInStatus,
		daysLateEarly,
		clockFlag
	};
}
function validateRebuild(draft) {
	if (!draft.title.trim()) return "Give the rebuild a project name.";
	if (!draft.account.trim()) return "Pick an account, or Katz shop / stock.";
	if (!isRebuildStatus(draft.status)) return "Pick a status.";
	const status = draft.status;
	if (status === "Waiting") {
		if (!isWaitingReason(draft.reasonCode)) return "Waiting needs a reason delayed before save.";
		if (draft.reasonCode === "Other" && !draft.reasonDetail?.trim()) return "Spell out the other reason.";
	}
	if ((draft.prevStatus ?? "Queued") === "Queued" && status !== "Queued") {
		if (!draft.owner?.trim()) return "Assign an owner before leaving Queued.";
		if (!isoDay(draft.targetComplete)) return "Set a target complete date before leaving Queued.";
	}
	if (NEEDS_TARGET.has(status) && !isoDay(draft.targetComplete)) return "In progress, Waiting, and Testing need a target complete date.";
	if (NEEDS_TARGET.has(status) && !draft.owner?.trim() && status === "In progress") return "In progress needs an owner and a target date.";
	return null;
}
function priorityLabel(p) {
	if (p === "high") return "High";
	if (p === "committed-to-customer") return "Committed to customer";
	return "Normal";
}
//#endregion
export { REBUILD_STATUSES as a, computeRebuildMetrics as c, priorityLabel as d, validateRebuild as f, REBUILD_PRIORITIES as i, isRebuildPriority as l, HEALTH_LABEL as n, SHOP_ACCOUNT as o, HEALTH_RANK as r, WAITING_REASONS as s, CLOSED_REBUILD as t, isRebuildStatus as u };
