import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { i as CLOSED_PM } from "./lookups-BkjR5sto.mjs";
import { o as formatShortDate } from "./clock-CSFAgASg.mjs";
import { b as Plus } from "../_libs/lucide-react.mjs";
import { i as useQueryClient, n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { g as useMyView, h as MyViewBar, s as Route$7, x as useOpenRecord } from "./router-1NWxggZt.mjs";
import { h as createPm, j as listPms } from "./api-CgwyWugK.mjs";
import { d as sortDesk, f as tally, l as SortSelect, o as SORT_LIST, p as useDeskSort, u as equipmentCount } from "./sort-1yS_DCzE.mjs";
import { n as FlagBadge, r as StatusBadge } from "./flag-badge-jup2uYzS.mjs";
import { n as Button, r as Input } from "./input-COYCsX_T.mjs";
import { t as AkBadge } from "./ak-badge-m29_U4_Z.mjs";
import { i as SimpleBars, o as StatCard, s as StatusDonut, t as ChartCard } from "./desk-charts-BMK8dv-e.mjs";
import { n as TechName } from "./tech-select-BqrrlfqA.mjs";
import { t as ExportButton } from "./export-dialog-BGDRoctb.mjs";
import { a as PmSheet, c as SimpleCreateDialog } from "./entity-sheets-ChIYwImr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/pms-BwIIUmHh.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Page() {
	const { open } = Route$7.useSearch();
	const qc = useQueryClient();
	const pms = useQuery({
		queryKey: ["pms"],
		queryFn: () => listPms()
	});
	const [q, setQ] = (0, import_react.useState)("");
	const [view, setView] = (0, import_react.useState)("active");
	const [selected, setSelected] = useOpenRecord(open);
	const [create, setCreate] = (0, import_react.useState)(false);
	const [sort, setSort] = useDeskSort("pms", "date-asc");
	const { filterMine, matchMine, role } = useMyView();
	const rows = (0, import_react.useMemo)(() => {
		let list = pms.data ?? [];
		if (view === "active") list = list.filter((p) => !CLOSED_PM.has(p.status) && !p.done);
		if (filterMine && role === "service") list = list.filter((p) => matchMine(p.technician) || !p.technician);
		const needle = q.trim().toLowerCase();
		if (needle) list = list.filter((p) => [
			p.customer,
			p.equipment,
			p.style,
			p.technician
		].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle)));
		return sortDesk(list, sort, {
			date: (p) => p.projected ?? p.received,
			name: (p) => p.customer,
			equipment: (p) => equipmentCount(p.equipment),
			status: (p) => p.status,
			flagRank: (p) => p.flag?.rank ?? 99,
			tech: (p) => p.technician
		});
	}, [
		pms.data,
		q,
		view,
		sort,
		filterMine,
		matchMine,
		role
	]);
	const selectedRow = (pms.data ?? []).find((p) => p.id === selected) ?? null;
	const all = pms.data ?? [];
	const active = all.filter((p) => !CLOSED_PM.has(p.status) && !p.done);
	const flagged = all.filter((p) => p.flag);
	const statusMix = tally(active, (p) => p.status);
	const styleMix = tally(active, (p) => p.style);
	const needDate = active.filter((p) => !p.projected).length;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-medium tracking-tight",
				children: "Preventative maintenance"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-xl text-sm text-muted-foreground",
				children: "Projected dates go amber inside 14 days and red once they slip. Need-a-date PMs sit at the top."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MyViewBar, {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExportButton, { defaultType: "pms" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						onClick: () => setCreate(true),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "New PM"]
					})
				]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 grid min-w-0 gap-3 md:grid-cols-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Active",
					value: active.length,
					hint: `${all.length} in history`
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Flagged",
					value: flagged.length,
					tone: flagged.length ? "warn" : void 0,
					hint: "Inside 14 days or slipped"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Need a date",
					value: needDate,
					tone: needDate ? "warn" : void 0,
					hint: "Active PMs with no projected date"
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-5 grid min-w-0 gap-4 lg:grid-cols-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartCard, {
				title: "Active by status",
				children: statusMix.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusDonut, {
					data: statusMix,
					unit: "active"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "No active PMs."
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartCard, {
				title: "By style",
				lede: "How the remaining book is split.",
				children: styleMix.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleBars, {
					data: styleMix.map((s) => ({
						label: s.name,
						count: s.count
					})),
					xKey: "label",
					yKey: "count",
					yLabel: "PMs",
					horizontal: true
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "No styles on active PMs."
				})
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 flex flex-wrap gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setView("active"),
					className: `h-9 rounded-full px-3 text-sm font-medium ${view === "active" ? "bg-ink text-ink-foreground" : "bg-secondary"}`,
					children: "Active"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setView("all"),
					className: `h-9 rounded-full px-3 text-sm font-medium ${view === "all" ? "bg-ink text-ink-foreground" : "bg-secondary"}`,
					children: "All"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: q,
					onChange: (e) => setQ(e.target.value),
					placeholder: "Filter…",
					className: "max-w-xs"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
					value: sort,
					onChange: setSort,
					options: SORT_LIST
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 overflow-hidden rounded-xl border border-border bg-card",
			children: [rows.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => setSelected(p.id),
				className: "grid w-full gap-1 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/60 md:grid-cols-[1.3fr_1fr_8rem_8rem_7rem] md:items-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium",
							children: p.customer
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AkBadge, {
							on: p.aviKatz,
							className: "ml-1 align-middle"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mt-0.5 block text-xs text-muted-foreground",
							children: p.equipment
						})
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "flex flex-wrap gap-1",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlagBadge, { flag: p.flag })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: p.status }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "tabular text-sm text-muted-foreground",
						children: formatShortDate(p.projected)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-sm",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TechName, { name: p.technician })
					})
				]
			}, p.id)), rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-4 py-8 text-sm text-muted-foreground",
				children: "No PMs in this view."
			}) : null]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PmSheet, {
			pm: selectedRow,
			onClose: () => setSelected(null)
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleCreateDialog, {
			title: "New PM",
			open: create,
			onOpenChange: setCreate,
			fields: [{
				name: "customer",
				label: "Customer",
				required: true,
				kind: "customer"
			}, {
				name: "equipment",
				label: "Equipment",
				kind: "equipment"
			}],
			onSubmit: async (v) => {
				const row = await createPm({ data: {
					customer: v.customer,
					equipment: v.equipment
				} });
				qc.invalidateQueries({ queryKey: ["pms"] });
				toast.success("PM added");
				setSelected(row.id);
			}
		})
	] });
}
//#endregion
export { Page as component };
