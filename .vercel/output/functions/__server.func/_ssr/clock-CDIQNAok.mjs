import { i as CLOSED_PM, r as CLOSED_CALL } from "./lookups-sAI9gyB5.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/clock-CDIQNAok.js
function todayChicago() {
	return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(/* @__PURE__ */ new Date());
}
function addDays(iso, days) {
	const [y, m, d] = iso.split("-").map(Number);
	return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
function diffDays(fromIso, toIso) {
	const a = Date.parse(`${fromIso}T00:00:00Z`);
	const b = Date.parse(`${toIso}T00:00:00Z`);
	return Math.round((b - a) / 864e5);
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
function formatWeekLabel(start, end) {
	const a = /* @__PURE__ */ new Date(`${start}T00:00:00`);
	const b = /* @__PURE__ */ new Date(`${end}T00:00:00`);
	const fmt = (dt) => `${dt.getMonth() + 1}/${dt.getDate()}`;
	return `${fmt(a)} – ${fmt(b)}`;
}
function closedCall(status, done) {
	return done || CLOSED_CALL.has(status ?? "");
}
function serviceFlag(input, today) {
	if (closedCall(input.status, input.done)) return null;
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
	if (input.done || CLOSED_PM.has(input.status)) return null;
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
	if (input.complete || input.equipStatus === "Installed") return null;
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
export { formatWeekLabel as a, moneyExact as c, todayChicago as d, weekBounds as f, formatShortDate as i, pmFlag as l, diffDays as n, installFlag as o, formatLongDate as r, money as s, addDays as t, serviceFlag as u };
