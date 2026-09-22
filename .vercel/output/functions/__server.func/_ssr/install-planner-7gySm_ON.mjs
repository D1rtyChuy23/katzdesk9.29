import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { s as sameRep } from "./rep-match-DCVeb4ID.mjs";
import { m as weekBounds, o as formatShortDate, p as todayChicago, t as addDays } from "./clock-CSFAgASg.mjs";
import { H as ChevronLeft, V as ChevronRight, y as Printer } from "../_libs/lucide-react.mjs";
import { i as useQueryClient, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { _ as cn } from "./router-1NWxggZt.mjs";
import { G as updateInstall } from "./api-CgwyWugK.mjs";
import { t as OpenLink } from "./open-link-oQ0V2s2m.mjs";
import { r as StatusBadge } from "./flag-badge-jup2uYzS.mjs";
import { n as Button, r as Input } from "./input-COYCsX_T.mjs";
import { n as NoRepFlag, t as AkBadge } from "./ak-badge-m29_U4_Z.mjs";
import { a as listedEquipment, r as findRecipeFor } from "./equipment-BifqoJpR.mjs";
import { a as settingsFrom, i as previewSetting } from "./recipe-fields-DqZtnvK8.mjs";
import { n as RepName, t as RepFilter } from "./rep-select-BQ75vNDf.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/install-planner-7gySm_ON.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var DAYS = [
	"Mon",
	"Tue",
	"Wed",
	"Thu",
	"Fri",
	"Sat",
	"Sun"
];
function mondayOf(iso) {
	return weekBounds(iso).start;
}
function configPreview(i, recipes) {
	const model = listedEquipment(i.equipment, [])[0] || i.equipment || "";
	const { linked, house } = findRecipeFor(recipes, {
		customer: i.customer,
		model,
		installId: i.id
	});
	const rec = linked ?? house;
	if (!rec) return "";
	return previewSetting(settingsFrom(rec))?.slice(0, 48) ?? "";
}
function InstallPlanner({ installs, recipes = [], myRep, catalog = [] }) {
	const today = todayChicago();
	const [anchor, setAnchor] = (0, import_react.useState)(mondayOf(today));
	const week = weekBounds(anchor);
	const days = DAYS.map((_, i) => addDays(week.start, i));
	const [rep, setRep] = (0, import_react.useState)("");
	const [ready, setReady] = (0, import_react.useState)("all");
	const [akOnly, setAkOnly] = (0, import_react.useState)(false);
	const [from, setFrom] = (0, import_react.useState)("");
	const [to, setTo] = (0, import_react.useState)("");
	const qc = useQueryClient();
	const saveDate = useMutation({
		mutationFn: (d) => updateInstall({ data: d }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["installs"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not reschedule")
	});
	const open = (0, import_react.useMemo)(() => installs.filter((i) => !i.complete && i.equipStatus !== "Installed"), [installs]);
	const rows = (0, import_react.useMemo)(() => {
		let list = open;
		if (rep === "__none__") list = list.filter((i) => i.noRep);
		else if (rep) list = list.filter((i) => sameRep(i.accountRep, rep));
		if (ready === "ready") list = list.filter((i) => i.equipStatus === "Ready");
		if (ready === "not") list = list.filter((i) => i.equipStatus !== "Ready");
		if (akOnly) list = list.filter((i) => i.aviKatz);
		if (from) list = list.filter((i) => (i.installDate ?? "") >= from);
		if (to) list = list.filter((i) => (i.installDate ?? "") <= to);
		return [...list].sort((a, b) => (a.installDate ?? "9999").localeCompare(b.installDate ?? "9999") || a.customer.localeCompare(b.customer));
	}, [
		open,
		rep,
		ready,
		akOnly,
		from,
		to
	]);
	const weekRows = rows.filter((i) => i.installDate && i.installDate >= week.start && i.installDate <= week.end);
	const dayCounts = /* @__PURE__ */ new Map();
	for (const i of weekRows) if (i.installDate) dayCounts.set(i.installDate, (dayCounts.get(i.installDate) ?? 0) + 1);
	const techWeek = /* @__PURE__ */ new Map();
	for (const i of weekRows) {
		const t = (i.technician || i.accountRep || "unassigned").toLowerCase();
		techWeek.set(t, (techWeek.get(t) ?? 0) + 1);
	}
	function conflict(i) {
		if (!i.installDate) return null;
		if ((dayCounts.get(i.installDate) ?? 0) > 1) return "day";
		const t = (i.technician || i.accountRep || "unassigned").toLowerCase();
		if ((techWeek.get(t) ?? 0) > 1) return "week";
		return null;
	}
	function jump(delta) {
		setAnchor(addDays(week.start, delta * 7));
	}
	function printWeek() {
		const w = window.open("", "_blank", "noopener,noreferrer,width=980,height=720");
		if (!w) {
			toast.error("Allow pop-ups to print the planner.");
			return;
		}
		const body = rows.map((i) => {
			const hit = i.installDate && i.installDate >= week.start && i.installDate <= week.end ? "this week" : "";
			return `<tr><td>${esc(i.customer)}</td><td>${esc(i.equipment ?? "")}</td><td>${esc(i.equipStatus ?? "")}</td><td>${esc(i.installDate ?? "")}</td><td>${esc(i.accountRep ?? "")}</td><td>${esc(i.technician ?? "")}</td><td>${hit}</td></tr>`;
		}).join("");
		w.document.write(`<!doctype html><html><head><title>Install planner</title>
      <style>
        body { font: 13px/1.4 system-ui, sans-serif; padding: 24px; color: #1a1612; }
        h1 { font-size: 20px; margin: 0 0 8px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #d7cfc4; padding: 6px 8px; text-align: left; }
        th { background: #f4efe8; }
      </style></head><body>
      <h1>Install planner · ${week.start} – ${week.end}</h1>
      <table><thead><tr><th>Account</th><th>Equipment</th><th>Ready</th><th>Install date</th><th>Rep</th><th>Tech</th><th>This week</th></tr></thead>
      <tbody>${body}</tbody></table></body></html>`);
		w.document.close();
		w.focus();
		w.print();
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0 rounded-xl border border-border bg-card p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-start justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-xl leading-tight",
					children: "Install planner"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[11px] text-muted-foreground",
					children: "One bar per project. Overlaps in the same week light up. Changing a date here updates the install date used on exports."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							size: "sm",
							variant: "outline",
							onClick: () => jump(-1),
							"aria-label": "Previous week",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "size-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							size: "sm",
							variant: "outline",
							onClick: () => setAnchor(mondayOf(today)),
							children: "This week"
						}),
						myRep ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							size: "sm",
							variant: rep === myRep ? "ink" : "outline",
							onClick: () => setRep(rep === myRep ? "" : myRep),
							children: "My week"
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							size: "sm",
							variant: "outline",
							onClick: () => jump(1),
							"aria-label": "Next week",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							type: "button",
							size: "sm",
							variant: "outline",
							onClick: printWeek,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Printer, { className: "size-4" }), "Print"]
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-2 text-sm text-muted-foreground",
				children: [
					formatShortDate(week.start),
					" – ",
					formatShortDate(week.end),
					" · ",
					weekRows.length,
					" on the timeline this week"
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex flex-wrap items-end gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RepFilter, {
						value: rep,
						onChange: setRep,
						extraNames: open.map((i) => i.accountRep),
						className: "w-44"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
						className: "h-10 rounded-md border border-input bg-card px-3 text-sm",
						value: ready,
						onChange: (e) => setReady(e.target.value),
						"aria-label": "Ready filter",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "all",
								children: "Ready + not ready"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "ready",
								children: "Ready"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "not",
								children: "Not ready"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "flex h-10 items-center gap-2 rounded-md border border-input px-3 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "checkbox",
							className: "size-4 accent-primary",
							checked: akOnly,
							onChange: (e) => setAkOnly(e.target.checked)
						}), "AK"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						type: "date",
						value: from,
						onChange: (e) => setFrom(e.target.value),
						"aria-label": "From date",
						className: "w-36"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						type: "date",
						value: to,
						onChange: (e) => setTo(e.target.value),
						"aria-label": "To date",
						className: "w-36"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4 overflow-x-auto",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-[40rem]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-[minmax(10rem,1.4fr)_repeat(7,minmax(2.4rem,1fr))] gap-1 text-[10px] tracking-wide text-muted-foreground uppercase",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Project" }), days.map((d, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: cn("text-center", d === today && "font-semibold text-foreground"),
							children: [
								DAYS[i],
								" ",
								formatShortDate(d)
							]
						}, d))]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
						className: "mt-1 space-y-1",
						children: [rows.map((i) => {
							const col = i.installDate && i.installDate >= week.start && i.installDate <= week.end && i.installDate ? days.indexOf(i.installDate) : -1;
							const clash = conflict(i);
							const cfg = configPreview(i, recipes);
							const models = listedEquipment(i.equipment, catalog).join(" · ") || i.equipment || "—";
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: cn("grid grid-cols-[minmax(10rem,1.4fr)_repeat(7,minmax(2.4rem,1fr))] items-stretch gap-1 rounded-md border border-transparent px-0.5 py-0.5", clash === "day" && "border-destructive/40 bg-destructive/6", clash === "week" && "border-warning/40 bg-warning/8"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0 py-1 pr-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(OpenLink, {
											entityType: "install",
											id: i.id,
											className: "flex min-w-0 items-center gap-1.5 hover:underline",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "truncate font-medium",
												children: i.customer
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AkBadge, { on: i.aviKatz })]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "truncate text-[11px] text-muted-foreground",
											children: models
										}),
										cfg ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "truncate text-[11px] text-muted-foreground",
											children: cfg
										}) : null,
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "mt-0.5 flex flex-wrap items-center gap-1.5",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: i.equipStatus === "Ready" ? "Ready" : "Not Ready" }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RepName, { name: i.accountRep }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NoRepFlag, { show: i.noRep })
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: "mt-1 block text-[11px] text-muted-foreground",
											children: ["Date", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "date",
												className: "ml-1 rounded border border-input bg-card px-1 py-0.5 text-xs text-foreground",
												value: i.installDate ?? "",
												onChange: (e) => saveDate.mutate({
													id: i.id,
													installDate: e.target.value || null
												})
											})]
										})
									]
								}), days.map((d, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: cn("relative min-h-10 rounded-sm bg-secondary/50", d === today && "ring-1 ring-primary/40"),
									children: col === idx ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: cn("absolute inset-1 rounded-sm bg-primary/80", clash === "day" && "bg-destructive", clash === "week" && "bg-warning"),
										title: `${i.customer} · ${formatShortDate(d)}`
									}) : null
								}, d))]
							}, i.id);
						}), rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "px-1 py-6 text-sm text-muted-foreground",
							children: "No installs match these filters."
						}) : null]
					})]
				})
			})
		]
	});
}
function esc(s) {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
//#endregion
export { InstallPlanner as t };
