//#region node_modules/.nitro/vite/services/ssr/assets/clock-CnyB9j5S.js
/** Terminal service / TLC statuses. */
var CLOSED_CALL = /* @__PURE__ */ new Set([
	"Completed",
	"Cancelled",
	"Phone Resolved"
]);
/** Terminal PM statuses. */
var CLOSED_PM = /* @__PURE__ */ new Set(["Completed", "Cancelled"]);
function isClosedCall(row) {
	return !!row.done || CLOSED_CALL.has(row.status ?? "");
}
function isOpenCall(row) {
	return !isClosedCall(row);
}
function isClosedPm(row) {
	return !!row.done || CLOSED_PM.has(row.status ?? "");
}
function isOpenPm(row) {
	return !isClosedPm(row);
}
/** YYYY-MM-DD from a date-like value. Empty string when missing or unparseable. */
function isoDay(v) {
	if (v == null || v === "") return "";
	if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
	const s = String(v).trim();
	const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
	if (m) return m[1];
	const t = Date.parse(s);
	if (Number.isFinite(t)) return new Date(t).toISOString().slice(0, 10);
	return "";
}
function isoDayOrNull(v) {
	return isoDay(v) || null;
}
function diffDays(fromIso, toIso) {
	const a = Date.parse(`${fromIso}T00:00:00Z`);
	const b = Date.parse(`${toIso}T00:00:00Z`);
	return Math.round((b - a) / 864e5);
}
/** Single source of truth for prep vs installed. */
function isInstalled(row) {
	return !!row.complete || row.equipStatus === "Installed";
}
function isOpenInstall(row) {
	return !isInstalled(row);
}
function installedPatch(row, today) {
	return {
		equipStatus: "Installed",
		complete: true,
		completedAt: today,
		installDate: row?.installDate || today
	};
}
function todayChicago() {
	return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(/* @__PURE__ */ new Date());
}
function addDays(iso, days) {
	const [y, m, d] = iso.split("-").map(Number);
	return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
function weekBounds(today) {
	const [y, m, d] = today.split("-").map(Number);
	const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
	const start = addDays(today, dow === 0 ? -6 : 1 - dow);
	const end = addDays(start, 6);
	const nextStart = addDays(start, 7);
	return {
		start,
		end,
		nextStart,
		nextEnd: addDays(nextStart, 6)
	};
}
function monthBounds(iso) {
	const [y, m] = iso.split("-").map(Number);
	const year = y || 1970;
	const month = m || 1;
	const start = `${year}-${String(month).padStart(2, "0")}-01`;
	const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
	return {
		start,
		end: `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`,
		year,
		month
	};
}
function addMonths(iso, delta) {
	const [y, m] = iso.split("-").map(Number);
	const dt = new Date(Date.UTC(y || 1970, (m || 1) - 1 + delta, 1));
	return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
function formatMonthLabel(iso) {
	const { year, month } = monthBounds(iso);
	return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
		month: "long",
		year: "numeric",
		timeZone: "UTC"
	});
}
function formatWeekLabel(start, end) {
	const a = /* @__PURE__ */ new Date(`${start}T00:00:00`);
	const b = /* @__PURE__ */ new Date(`${end}T00:00:00`);
	const fmt = (dt) => `${dt.getMonth() + 1}/${dt.getDate()}`;
	return `${fmt(a)} – ${fmt(b)}`;
}
var WEEKDAYS = [
	"Mon",
	"Tue",
	"Wed",
	"Thu",
	"Fri",
	"Sat",
	"Sun"
];
function serviceFlag(input, today) {
	if (isClosedCall(input)) return null;
	if (input.scheduled && input.scheduled < today) return {
		code: "past_due",
		label: "Past due — scheduled",
		level: "danger",
		rank: 10
	};
	if (input.received) {
		const days = diffDays(input.received, today);
		if (input.kind === "tlc") {
			if (days >= 14) return {
				code: "open_2w",
				label: "Open past 2 weeks",
				level: "danger",
				rank: 20
			};
			if (days >= 10) return {
				code: "open_10d",
				label: "Open 10–14 days",
				level: "warn",
				rank: 30
			};
		} else {
			if (days >= 2) return {
				code: "open_48",
				label: "Open past 48 hrs",
				level: "danger",
				rank: 20
			};
			if (days >= 1) return {
				code: "open_24",
				label: "Open 24–48 hrs",
				level: "warn",
				rank: 30
			};
		}
	}
	return null;
}
function pmFlag(input, today) {
	if (isClosedPm(input)) return null;
	if (!input.projected) return {
		code: "needs_date",
		label: "Needs PM date",
		level: "warn",
		rank: 15
	};
	const days = diffDays(today, input.projected);
	if (days < 0) {
		if (-days >= 14) return {
			code: "pm_late_2w",
			label: "2+ weeks past projected",
			level: "danger",
			rank: 5
		};
		return {
			code: "pm_overdue",
			label: "PM overdue",
			level: "danger",
			rank: 10
		};
	}
	if (days <= 14) return {
		code: "pm_due",
		label: "PM due within 14 days",
		level: "warn",
		rank: 25
	};
	return null;
}
function installFlag(input, today, week) {
	if (isInstalled(input)) return null;
	const date = input.installDate;
	const inWindow = !!date && date >= week.start && date <= week.nextEnd;
	const past = !!date && date < today;
	if (input.equipStatus === "Not Ready" && past) return {
		code: "past_not_ready",
		label: "Past due — not ready",
		level: "danger",
		rank: 8
	};
	if (input.equipStatus === "Not Ready" && inWindow) return {
		code: "equip_not_ready",
		label: "Equipment not ready",
		level: "danger",
		rank: 12
	};
	if (input.reqsReady === "Not Ready" && inWindow && input.equipStatus !== "Not Ready") return {
		code: "cust_not_ready",
		label: "Customer not ready",
		level: "warn",
		rank: 18
	};
	return null;
}
function formatPingTime(iso) {
	if (!iso) return "";
	const dt = new Date(iso);
	if (!Number.isFinite(dt.getTime())) return "";
	return dt.toLocaleString("en-US", {
		timeZone: "America/Chicago",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit"
	});
}
function formatShortDate(iso) {
	if (!iso) return "—";
	const [y, m, d] = iso.split("-").map(Number);
	if (!y || !m || !d) return iso;
	return `${m}/${d}`;
}
function formatLongDate(iso) {
	if (!iso) return "—";
	return (/* @__PURE__ */ new Date(`${iso}T12:00:00`)).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric"
	});
}
function formatNowChicago() {
	const date = todayChicago();
	const time = new Intl.DateTimeFormat("en-US", {
		timeZone: "America/Chicago",
		hour: "numeric",
		minute: "2-digit"
	}).format(/* @__PURE__ */ new Date());
	return {
		date,
		time,
		stamp: `${date} ${time} CT`
	};
}
function money(n) {
	if (n === null || n === void 0 || n === "") return "—";
	const v = typeof n === "number" ? n : Number(n);
	if (!Number.isFinite(v)) return "—";
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0
	}).format(v);
}
function moneyExact(n) {
	if (n === null || n === void 0 || n === "") return "—";
	const v = typeof n === "number" ? n : Number(n);
	if (!Number.isFinite(v)) return "—";
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD"
	}).format(v);
}
//#endregion
export { money as C, serviceFlag as D, pmFlag as E, todayChicago as O, isoDayOrNull as S, monthBounds as T, isInstalled as _, addMonths as a, isOpenPm as b, formatMonthLabel as c, formatShortDate as d, formatWeekLabel as f, isClosedPm as g, isClosedCall as h, addDays as i, weekBounds as k, formatNowChicago as l, installedPatch as m, CLOSED_PM as n, diffDays as o, installFlag as p, WEEKDAYS as r, formatLongDate as s, CLOSED_CALL as t, formatPingTime as u, isOpenCall as v, moneyExact as w, isoDay as x, isOpenInstall as y };
