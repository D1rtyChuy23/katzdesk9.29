import { o as __toESM } from "./_runtime.mjs";
import { u as require_react } from "./_libs/@floating-ui/react-dom+[...].mjs";
import { v as Link } from "./_libs/@tanstack/react-router+[...].mjs";
import { n as require_jsx_runtime } from "./_libs/radix-ui__react-context+react.mjs";
import { m as weekBounds, o as formatShortDate, r as formatLongDate } from "./_ssr/clock-CSFAgASg.mjs";
import { n as useQuery } from "./_libs/tanstack__react-query.mjs";
import { _ as cn, g as useMyView, h as MyViewBar } from "./_ssr/router-1NWxggZt.mjs";
import { M as listRecipes, O as listInstalls, _ as getDashboard } from "./_ssr/api-CgwyWugK.mjs";
import { t as OpenLink } from "./_ssr/open-link-oQ0V2s2m.mjs";
import { t as Skeleton } from "./_ssr/separator-AdNvdRLl.mjs";
import { a as SORT_FLAG, d as sortDesk, l as SortSelect, n as SORT_DATE, p as useDeskSort, s as SORT_STATUS, t as SORT_ALPHA } from "./_ssr/sort-1yS_DCzE.mjs";
import { t as Badge } from "./_ssr/badge-C8SL_nG4.mjs";
import { n as FlagBadge, r as StatusBadge } from "./_ssr/flag-badge-jup2uYzS.mjs";
import { r as PingButton } from "./_ssr/ping-button-B3Neap2C.mjs";
import { n as NoRepFlag, t as AkBadge } from "./_ssr/ak-badge-m29_U4_Z.mjs";
import { i as SimpleBars, n as GroupedBars, o as StatCard, r as MiniStat, t as ChartCard } from "./_ssr/desk-charts-BMK8dv-e.mjs";
import { t as InstallPlanner } from "./_ssr/install-planner-7gySm_ON.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_app-Bn7ep12X.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var BUCKETS = [
	{
		id: "overdue",
		label: "Overdue"
	},
	{
		id: "today",
		label: "Today"
	},
	{
		id: "week",
		label: "This week"
	},
	{
		id: "later",
		label: "Later"
	}
];
function bucketOf(row, weekEnd) {
	if (row.daysOut < 0) return "overdue";
	if (row.daysOut === 0) return "today";
	if (row.scheduled <= weekEnd) return "week";
	return "later";
}
function kindLabel(row) {
	if (row.kind === "tlc") return "TLC";
	if (row.kind === "pm") return "PM";
	if (row.kind === "install") return "Install";
	return "Service";
}
function ComingDuePanel({ rows, counts, weekEnd, compact }) {
	const grouped = (0, import_react.useMemo)(() => {
		const map = {
			overdue: [],
			today: [],
			week: [],
			later: []
		};
		for (const r of rows) map[bucketOf(r, weekEnd)].push(r);
		return map;
	}, [rows, weekEnd]);
	const [open, setOpen] = (0, import_react.useState)(null);
	const overdue = counts?.overdue ?? grouped.overdue.length;
	const today = counts?.today ?? grouped.today.length;
	const week = counts?.thisWeek ?? grouped.week.length;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0 rounded-xl border border-border bg-card p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-baseline justify-between gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-xl leading-tight",
				children: "Coming due"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[11px] text-muted-foreground",
				children: "Click a row to open the ticket or install."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
				className: "flex flex-wrap gap-1.5 text-[11px]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CountChip, {
						label: "Overdue",
						n: overdue,
						tone: "danger"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CountChip, {
						label: "Today",
						n: today,
						tone: "warn"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CountChip, {
						label: "This week",
						n: week
					})
				]
			})]
		}), rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-3 text-sm text-muted-foreground",
			children: "Nothing overdue or coming due."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: cn("mt-3 space-y-2", compact && "space-y-1.5"),
			children: BUCKETS.map((b) => {
				const list = grouped[b.id];
				if (!list.length) return null;
				const expanded = open === b.id || b.id !== "later" || list.length <= 6;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "flex w-full items-baseline justify-between gap-2 text-left",
					onClick: () => setOpen(open === b.id ? null : b.id),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[11px] font-medium tracking-wide text-muted-foreground uppercase",
						children: b.label
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "tabular text-[11px] text-muted-foreground",
						children: list.length
					})]
				}), expanded ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-1 divide-y divide-border rounded-md border border-border/70",
					children: list.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(OpenLink, {
						entityType: row.entityType,
						id: row.id,
						title: `${row.customer} · ${kindLabel(row)} · ${formatShortDate(row.scheduled)} · ${row.status}${row.wo ? ` · ${row.wo}` : ""}${row.technician || row.accountRep ? ` · ${row.technician || row.accountRep}` : ""}`,
						className: "grid gap-0.5 px-2.5 py-1.5 hover:bg-muted/60 sm:grid-cols-[minmax(0,1.4fr)_5.5rem_4.5rem_auto] sm:items-center sm:gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "flex min-w-0 items-center gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "truncate font-medium",
										children: row.customer
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AkBadge, { on: row.aviKatz })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "block truncate text-[11px] text-muted-foreground",
									children: row.wo || row.detail || row.equipment || "—"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-[11px] text-muted-foreground",
								children: [kindLabel(row), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "mt-0.5 block tabular",
									children: formatShortDate(row.scheduled)
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: row.status }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-[11px] text-muted-foreground",
								children: [row.technician || (row.accountRep ? row.accountRep.split(" ")[0] : "unassigned"), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NoRepFlag, {
									show: row.noRep,
									className: "ml-1"
								})]
							})
						]
					}) }, `${row.entityType}-${row.id}`))
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 text-[11px] text-muted-foreground",
					children: [
						"Tap to show ",
						list.length,
						" later jobs."
					]
				})] }, b.id);
			})
		})]
	});
}
function CountChip({ label, n, tone }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
		className: cn("rounded-full bg-secondary px-2 py-0.5 tabular", tone === "danger" && n > 0 && "bg-destructive/12 text-destructive", tone === "warn" && n > 0 && "bg-warning/12 text-warning"),
		children: [
			label,
			" ",
			n
		]
	});
}
function RebuildAlerts({ rows }) {
	if (!rows.length) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0 rounded-xl border border-destructive/30 bg-card p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-baseline justify-between gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-xl leading-tight",
				children: "Rebuild"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[11px] text-muted-foreground",
				children: "Overdue or waiting more than 5 days. Field Coming due is unchanged."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/rebuilds",
				className: "text-xs text-muted-foreground hover:text-foreground",
				children: "Open rebuilds"
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-3 divide-y divide-border",
			children: rows.slice(0, 8).map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "py-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-start justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OpenLink, {
						entityType: "rebuild",
						id: r.id,
						className: "min-w-0 font-medium hover:underline",
						children: r.detail || r.customer
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
						variant: r.flag.level === "danger" ? "danger" : "warn",
						children: r.flag.label
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-0.5 text-xs text-muted-foreground",
					children: [
						r.customer,
						" · ",
						r.technician || "No owner",
						r.scheduled ? ` · target ${formatShortDate(r.scheduled)}` : "",
						" · ",
						r.status
					]
				})]
			}, r.id))
		})]
	});
}
function ClockHome() {
	const dash = useQuery({
		queryKey: ["dashboard"],
		queryFn: () => getDashboard()
	});
	const installs = useQuery({
		queryKey: ["installs"],
		queryFn: () => listInstalls()
	});
	const recs = useQuery({
		queryKey: ["recipes"],
		queryFn: () => listRecipes()
	});
	const { role, filterMine, matchMine, compact } = useMyView();
	const d = dash.data;
	if (dash.isError) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl border border-border bg-card p-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-2xl",
				children: "Couldn’t load the clock"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted-foreground",
				children: dash.error instanceof Error ? dash.error.message : "Try again in a moment."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "mt-4 text-sm font-medium text-primary underline-offset-4 hover:underline",
				onClick: () => void dash.refetch(),
				children: "Try again"
			})
		]
	});
	if (dash.isLoading || !d) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-10 w-64" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-28 w-full" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-64 w-full" })
		]
	});
	const statusChart = d.statusBreakdown.filter((s) => s.service + s.tlc > 0).map((s) => ({
		status: s.status.replace("Follow-up Needed", "Follow-up"),
		service: s.service,
		tlc: s.tlc
	}));
	const techChart = d.techLoad.filter((t) => t.active + t.completed > 0).map((t) => ({
		tech: t.tech,
		active: t.active
	}));
	const dueRows = filterMine ? d.comingDue.filter((r) => role === "sales" ? matchMine(r.accountRep) || r.aviKatz : matchMine(r.technician) || !r.technician) : d.comingDue;
	const salesPrimary = role === "sales";
	const weekEnd = weekBounds(d.today).end;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs tracking-[0.18em] text-muted-foreground uppercase",
						children: "Operations clock"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
						className: "font-display text-4xl font-medium tracking-tight",
						children: ["Today, ", formatLongDate(d.today)]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-sm text-muted-foreground",
						children: [
							"Week ",
							d.weekLabel,
							" · Next ",
							d.nextWeekLabel,
							role ? ` · ${role === "sales" ? "Sales" : "Service"} view` : ""
						]
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MyViewBar, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/handoff",
						className: "text-sm font-medium text-primary underline-offset-4 hover:underline",
						children: "Open handoff feed"
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniStat, {
						label: "Active calls",
						value: d.kpis.activeCalls,
						hint: "Service + TLC still open"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniStat, {
						label: "Coming due",
						value: d.kpis.comingDue,
						hint: "Overdue + today + this week"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniStat, {
						label: "Install queue",
						value: d.kpis.installQueue,
						hint: `${d.kpis.installAtRisk} at risk`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniStat, {
						label: "PMs active",
						value: d.kpis.pmsActive
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniStat, {
						label: "Rebuilds",
						value: (d.kpis.rebuildOverdue ?? 0) + (d.kpis.rebuildWaiting ?? 0),
						hint: `${d.kpis.rebuildOverdue ?? 0} overdue · ${d.kpis.rebuildWaiting ?? 0} waiting`
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid grid-cols-2 gap-3 md:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
						label: "Service flags",
						value: d.kpis.svcFlags,
						tone: d.kpis.svcFlags ? "danger" : "ok",
						hint: "48-hour clock"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
						label: "TLC flags",
						value: d.kpis.tlcFlags,
						tone: d.kpis.tlcFlags ? "danger" : "ok",
						hint: "2-week clock"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
						label: "PM flags",
						value: d.kpis.pmFlags,
						tone: d.kpis.pmFlags ? "warn" : "ok",
						hint: `${d.kpis.pmsActive} active PMs`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
						label: "Open asks",
						value: d.kpis.openAsks,
						tone: d.kpis.openAsks ? "warn" : "ok",
						hint: "Handoff waiting on an answer"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid min-w-0 gap-3 md:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
						label: "Ready in the barn",
						value: d.kpis.barnReady,
						hint: `${d.kpis.barnOpen} open slots`,
						breakdown: d.barnReadyByModel
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
						label: "Ready to install",
						value: d.kpis.installReady,
						hint: `${d.kpis.installQueue} in the queue · ${d.kpis.installAtRisk} at risk`,
						breakdown: d.installReadyByEquip
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
						label: "Ready modules",
						value: d.kpis.modulesReady,
						hint: "Shop modules marked Ready",
						breakdown: d.modulesReadyByType
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid min-w-0 gap-4 lg:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartCard, {
					title: "Call mix",
					lede: "Service vs TLC + Factor by status — closed work stays visible so volume is honest.",
					children: statusChart.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GroupedBars, {
						data: statusChart,
						xKey: "status",
						aKey: "service",
						bKey: "tlc",
						aLabel: "Service",
						bLabel: "TLC"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted-foreground",
						children: "No calls loaded."
					})
				}), salesPrimary ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-xl border border-border bg-card p-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-baseline justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-xl",
							children: "Pipeline snapshot"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/pipeline",
							className: "text-xs text-muted-foreground hover:text-foreground",
							children: "Open pipeline"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
						className: "mt-4 grid grid-cols-2 gap-3 text-sm",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Snap, {
								label: "Open deals",
								value: String(d.pipelineSnap?.openCount ?? 0)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Snap, {
								label: "Open $",
								value: moneyish(d.pipelineSnap?.openValue)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Snap, {
								label: "Good to order",
								value: String(d.pipelineSnap?.goodToOrder ?? 0)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Snap, {
								label: "Ordered",
								value: String(d.pipelineSnap?.ordered ?? 0)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Snap, {
								label: "Completed",
								value: String(d.pipelineSnap?.completeCount ?? 0)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Snap, {
								label: "Completed $",
								value: moneyish(d.pipelineSnap?.completeValue)
							})
						]
					})]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ComingDuePanel, {
					rows: dueRows,
					counts: d.comingDueCounts,
					weekEnd,
					compact
				})]
			}),
			salesPrimary ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ComingDuePanel, {
				rows: dueRows,
				counts: d.comingDueCounts,
				weekEnd,
				compact
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InstallPlanner, {
				installs: installs.data ?? [],
				recipes: recs.data ?? [],
				myRep: null
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RebuildAlerts, { rows: d.rebuildAlerts ?? [] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid gap-4 lg:grid-cols-[1.1fr_1fr]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartCard, {
					title: "On the truck",
					lede: "Active calls per technician.",
					children: techChart.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleBars, {
						data: techChart,
						xKey: "tech",
						yKey: "active",
						horizontal: true
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted-foreground",
						children: "No techs on active calls."
					})
				}), salesPrimary ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-xl border border-border bg-card p-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-baseline justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-xl",
							children: "Latest handoff"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/handoff",
							className: "text-xs text-muted-foreground hover:text-foreground",
							children: "All notes"
						})]
					}), d.recentHandoff.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-sm text-muted-foreground",
						children: "No notes yet."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-3 space-y-3",
						children: d.recentHandoff.slice(0, 5).map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-medium",
								children: c.ownerLabel
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-muted-foreground",
								children: [" on ", c.customer ?? c.entityType]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "line-clamp-2 text-sm text-muted-foreground",
							children: c.body
						})] }, c.id))
					})]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-xl border border-border bg-card p-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-baseline justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-xl",
							children: "Pipeline snapshot"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/pipeline",
							className: "text-xs text-muted-foreground hover:text-foreground",
							children: "Open pipeline"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
						className: "mt-4 grid grid-cols-2 gap-3 text-sm",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Snap, {
								label: "Open deals",
								value: String(d.pipelineSnap?.openCount ?? 0)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Snap, {
								label: "Open $",
								value: moneyish(d.pipelineSnap?.openValue)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Snap, {
								label: "Good to order",
								value: String(d.pipelineSnap?.goodToOrder ?? 0)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Snap, {
								label: "Ordered",
								value: String(d.pipelineSnap?.ordered ?? 0)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Snap, {
								label: "Completed",
								value: String(d.pipelineSnap?.completeCount ?? 0)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Snap, {
								label: "Completed $",
								value: moneyish(d.pipelineSnap?.completeValue)
							})
						]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid min-w-0 gap-4 lg:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlagList, {
						title: "Service — 48-hour clock",
						href: "/service",
						rows: d.flagged.service,
						empty: "No service flags. The 48-hour clock is clear."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlagList, {
						title: "TLC + Factor — 2-week clock",
						href: "/tlc",
						rows: d.flagged.tlc,
						empty: "No TLC flags."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlagList, {
						title: "PM tracker",
						href: "/pms",
						rows: d.flagged.pm,
						empty: "No PM flags."
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
				className: "grid gap-4 lg:grid-cols-[1.4fr_1fr]",
				children: salesPrimary ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-xl border border-border bg-card p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-baseline justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "font-display text-xl",
								children: "Install readiness"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/installs",
								className: "text-xs text-muted-foreground hover:text-foreground",
								children: "Open installs"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-2 text-sm text-muted-foreground",
							children: [
								d.kpis.installReady,
								" ready · ",
								d.kpis.installQueue,
								" in queue · ",
								d.kpis.installAtRisk,
								" at risk"
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InstallPlanner, {
							installs: (installs.data ?? []).filter((i) => !filterMine || matchMine(i.accountRep) || i.aviKatz),
							recipes: recs.data ?? [],
							myRep: null
						})
					]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-xl border border-border bg-card p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-baseline justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "font-display text-xl",
								children: "Latest handoff"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/handoff",
								className: "text-xs text-muted-foreground hover:text-foreground",
								children: "All notes"
							})]
						}),
						d.recentHandoff.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 text-sm text-muted-foreground",
							children: "No notes yet."
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-3 space-y-3",
							children: d.recentHandoff.slice(0, 5).map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-medium",
									children: c.ownerLabel
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-muted-foreground",
									children: [" on ", c.customer ?? c.entityType]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "line-clamp-2 text-sm text-muted-foreground",
								children: c.body
							})] }, c.id))
						}),
						d.pendingHandoffs.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-3 text-xs text-warning",
							children: [
								d.pendingHandoffs.length,
								" completed deal",
								d.pendingHandoffs.length === 1 ? "" : "s",
								" waiting on an install row."
							]
						}) : null
					]
				})
			})
		]
	});
}
function moneyish(n) {
	if (n == null) return "—";
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0
	}).format(n);
}
function Snap({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg bg-muted/60 px-3 py-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
			className: "text-xs text-muted-foreground",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
			className: "font-display text-lg tabular",
			children: value
		})]
	});
}
function FlagList({ title, href, rows, empty }) {
	const [sort, setSort] = useDeskSort(`clock-flag-${href}`, "flag");
	const shown = (0, import_react.useMemo)(() => sortDesk(rows, sort, {
		date: (r) => r.scheduled ?? r.received,
		name: (r) => r.customer,
		status: (r) => r.status,
		flagRank: (r) => r.flag?.rank ?? 99,
		tech: (r) => r.technician,
		equipment: (r) => r.detail ? 1 : 0
	}), [rows, sort]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0 rounded-xl border border-border bg-card p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "min-w-0 text-balance font-display text-xl leading-snug",
					children: title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: href,
					className: "mt-1 shrink-0 text-xs text-muted-foreground hover:text-foreground",
					children: "Open"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 min-w-0",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
					value: sort,
					onChange: setSort,
					options: [
						...SORT_FLAG,
						...SORT_DATE,
						...SORT_ALPHA,
						...SORT_STATUS
					],
					className: "w-full"
				})
			}),
			shown.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-sm text-muted-foreground",
				children: empty
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 divide-y divide-border",
				children: shown.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "py-2.5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OpenLink, {
								entityType: r.entityType,
								id: r.id,
								className: "min-w-0 font-medium hover:underline",
								children: r.customer
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PingButton, {
								size: "xs",
								entityType: r.entityType,
								entityId: r.id,
								contextLabel: `${r.customer} · ${title}`
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-1 flex flex-wrap items-center gap-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlagBadge, { flag: r.flag }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: r.status })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-xs text-muted-foreground",
							children: [
								"Rec ",
								formatShortDate(r.received),
								r.scheduled ? ` · Sch ${formatShortDate(r.scheduled)}` : "",
								r.technician ? ` · ${r.technician}` : "",
								r.detail ? ` · ${r.detail}` : ""
							]
						})
					]
				}, `${r.entityType}-${r.id}`))
			})
		]
	});
}
//#endregion
export { ClockHome as component };
