import { o as __toESM } from "./_runtime.mjs";
import { u as require_react } from "./_libs/@floating-ui/react-dom+[...].mjs";
import { v as Link } from "./_libs/@tanstack/react-router+[...].mjs";
import { n as require_jsx_runtime } from "./_libs/radix-ui__react-context+react.mjs";
import { n as useQuery } from "./_libs/tanstack__react-query.mjs";
import { h as getDashboard } from "./_ssr/api-B23zb1CT.mjs";
import { t as OpenLink } from "./_ssr/open-link-CwtVBSba.mjs";
import { t as Skeleton } from "./_ssr/separator-CEGHwY7T.mjs";
import { i as formatShortDate, r as formatLongDate } from "./_ssr/clock-CDIQNAok.mjs";
import { a as SORT_FLAG, f as sortDesk, m as useDeskSort, n as SORT_DATE, s as SORT_STATUS, t as SORT_ALPHA, u as SortSelect } from "./_ssr/sort-C5YlOVRH.mjs";
import { n as PingButton } from "./_ssr/ping-button-Bgio9qNk.mjs";
import { a as SimpleBars, c as StatusBadge, i as MiniStat, n as FlagBadge, r as GroupedBars, s as StatCard, t as ChartCard } from "./_ssr/desk-charts-BV1SUC0s.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_app-DaogGzz6.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function ClockHome() {
	const dash = useQuery({
		queryKey: ["dashboard"],
		queryFn: () => getDashboard()
	});
	const [dueSort, setDueSort] = useDeskSort("clock-due", "date-asc");
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
	const dueChart = groupDueWindows(d.comingDueBuckets ?? []);
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
							d.nextWeekLabel
						]
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/handoff",
					className: "text-sm font-medium text-primary underline-offset-4 hover:underline",
					children: "Open handoff feed"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid grid-cols-2 gap-2 sm:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniStat, {
						label: "Active calls",
						value: d.kpis.activeCalls,
						hint: "Service + TLC still open"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniStat, {
						label: "Coming due",
						value: d.kpis.comingDue,
						hint: "Next 14 days"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniStat, {
						label: "Install queue",
						value: d.kpis.installQueue,
						hint: `${d.kpis.installAtRisk} at risk`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniStat, {
						label: "PMs active",
						value: d.kpis.pmsActive
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
				className: "grid gap-3 md:grid-cols-3",
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
				className: "grid gap-4 lg:grid-cols-2",
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
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartCard, {
					title: "Coming due — 14 days",
					lede: "Dated service, TLC, PMs, and installs grouped so the week is readable.",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleBars, {
						data: dueChart,
						xKey: "window",
						yKey: "count",
						yLabel: "Jobs"
					})
				})]
			}),
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
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
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
				className: "grid gap-4 lg:grid-cols-3",
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
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid gap-4 lg:grid-cols-[1.4fr_1fr]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DueList, {
					rows: d.comingDue,
					sort: dueSort,
					onSort: setDueSort
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
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
									children: c.authorName
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
				})]
			})
		]
	});
}
function groupDueWindows(buckets) {
	let today = 0;
	let soon = 0;
	let week = 0;
	let next = 0;
	for (const b of buckets) if (b.day === 0) today += b.count;
	else if (b.day <= 3) soon += b.count;
	else if (b.day <= 7) week += b.count;
	else next += b.count;
	return [
		{
			window: "Today",
			count: today
		},
		{
			window: "1–3 days",
			count: soon
		},
		{
			window: "This week",
			count: week
		},
		{
			window: "Next week",
			count: next
		}
	];
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
		className: "rounded-xl border border-border bg-card p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-xl",
					children: title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: href,
					className: "text-xs text-muted-foreground hover:text-foreground",
					children: "Open"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
					value: sort,
					onChange: setSort,
					options: [
						...SORT_FLAG,
						...SORT_DATE,
						...SORT_ALPHA,
						...SORT_STATUS
					],
					className: "sm:w-full"
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
function DueList({ rows, sort, onSort }) {
	const shown = (0, import_react.useMemo)(() => sortDesk(rows, sort, {
		date: (r) => r.scheduled,
		name: (r) => r.customer,
		status: (r) => r.status,
		tech: (r) => r.technician,
		equipment: (r) => r.equipment ? 1 : 0
	}), [rows, sort]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl border border-border bg-card p-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-xl",
				children: "Coming due — 14 days"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted-foreground",
				children: "Every dated job in the window, sorted how you need it."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
				value: sort,
				onChange: onSort,
				options: [
					...SORT_DATE,
					...SORT_ALPHA,
					...SORT_STATUS
				]
			})]
		}), shown.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-4 text-sm text-muted-foreground",
			children: "Nothing scheduled in the next two weeks."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-3 divide-y divide-border",
			children: shown.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex items-start justify-between gap-3 py-2.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OpenLink, {
						entityType: row.entityType,
						id: row.id,
						className: "font-medium hover:underline",
						children: row.customer
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-xs text-muted-foreground",
						children: [
							row.source,
							" · ",
							row.equipment ?? "—",
							" · ",
							row.technician ?? "unassigned"
						]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-right",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "tabular text-sm font-medium",
						children: row.daysOut === 0 ? "Today" : `${row.daysOut}d`
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted-foreground",
						children: formatShortDate(row.scheduled)
					})]
				})]
			}, `${row.entityType}-${row.id}`))
		})]
	});
}
//#endregion
export { ClockHome as component };
