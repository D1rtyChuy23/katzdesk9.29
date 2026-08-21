import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { n as cn } from "./button-6ZsGYj3J.mjs";
import { t as Badge } from "./ping-button-Bgio9qNk.mjs";
import { a as CartesianGrid, c as Cell, i as XAxis, l as ResponsiveContainer, n as BarChart, o as Bar, r as YAxis, s as Pie, t as PieChart, u as Tooltip } from "../_libs/recharts+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/desk-charts-BV1SUC0s.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function FlagBadge({ flag }) {
	if (!flag) return null;
	const variant = flag.level === "danger" ? "danger" : flag.level === "warn" ? "warn" : "default";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		variant,
		children: flag.label
	});
}
function UrgencyBadge({ urgency }) {
	if (!urgency) return null;
	const s = urgency.toLowerCase();
	if (s === "emergency") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		variant: "danger",
		children: urgency
	});
	if (s === "high") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		variant: "warn",
		children: urgency
	});
	if (s === "low") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		variant: "outline",
		children: urgency
	});
	if (s === "normal") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		variant: "outline",
		children: urgency
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: urgency });
}
function StatusBadge({ status }) {
	if (!status) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		variant: "outline",
		children: "Unset"
	});
	const s = status.toLowerCase();
	if (s.includes("complete") || s === "installed" || s === "ready" || s === "phone resolved") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		variant: "success",
		children: status
	});
	if (s.includes("cancel") || s.includes("fell") || s.includes("overdue") || s.includes("not ready")) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		variant: "danger",
		children: status
	});
	if (s.includes("progress") || s.includes("dispatch") || s.includes("await") || s.includes("follow")) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		variant: "warn",
		children: status
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: status });
}
var ink = "#1A1612";
var primary = "#2F5D50";
var warning = "#9A5B12";
var muted = "#6F675E";
var cream = "#E7E0D4";
var card = "#FAF7F1";
var border = "#DDD4C6";
var CHART_PALETTE = [
	primary,
	ink,
	warning,
	muted,
	cream
];
function useMotion() {
	if (typeof window === "undefined") return false;
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function usd(n) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0
	}).format(n);
}
function Tip({ active, payload, label, money }) {
	if (!active || !payload?.length) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-soft",
		children: [label ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mb-1 font-medium",
			children: label
		}) : null, payload.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "text-muted-foreground",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-foreground",
				children: p.name
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "ml-2 tabular",
				children: money ? usd(Number(p.value) || 0) : p.value
			})]
		}, p.name))]
	});
}
function ChartKey({ items }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "mb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground",
		children: items.map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
			className: "flex items-center gap-1.5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "size-2 shrink-0 rounded-sm",
				style: { background: i.color }
			}), i.label]
		}, i.label))
	});
}
function GroupedBars({ data, aKey, bKey, aLabel, bLabel, xKey }) {
	const reduce = useMotion();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartKey, { items: [{
		label: aLabel,
		color: primary
	}, {
		label: bLabel,
		color: ink
	}] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "h-56 w-full",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
			width: "100%",
			height: "100%",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(BarChart, {
				data,
				margin: {
					top: 8,
					right: 8,
					left: -12,
					bottom: 0
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
						stroke: border,
						vertical: false
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
						dataKey: xKey,
						tick: {
							fill: muted,
							fontSize: 11
						},
						axisLine: false,
						tickLine: false,
						interval: 0
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
						allowDecimals: false,
						tick: {
							fill: muted,
							fontSize: 11
						},
						axisLine: false,
						tickLine: false,
						width: 32
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, {
						content: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tip, {}),
						cursor: { fill: cream }
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
						dataKey: aKey,
						name: aLabel,
						fill: primary,
						radius: [
							4,
							4,
							0,
							0
						],
						maxBarSize: 18,
						isAnimationActive: !reduce
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
						dataKey: bKey,
						name: bLabel,
						fill: ink,
						radius: [
							4,
							4,
							0,
							0
						],
						maxBarSize: 18,
						isAnimationActive: !reduce
					})
				]
			})
		})
	})] });
}
function SimpleBars({ data, xKey, yKey, yLabel, color = primary, horizontal }) {
	const reduce = useMotion();
	if (horizontal) {
		const max = Math.max(...data.map((d) => Number(d[yKey]) || 0), 1);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [yLabel ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mb-2 text-right text-xs tracking-wide text-muted-foreground uppercase",
			children: yLabel
		}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "space-y-2.5",
			children: data.map((row, i) => {
				const name = String(row[xKey] ?? "—");
				const n = Number(row[yKey]) || 0;
				const pct = Math.round(n / max * 100);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_2.5rem] items-center gap-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "truncate text-sm",
							title: name,
							children: name
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-secondary",
							"aria-hidden": true,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block h-full rounded-full",
								style: {
									width: `${n === 0 ? 0 : Math.max(pct, 4)}%`,
									background: color
								}
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "tabular text-right text-sm font-medium",
							children: n
						})
					]
				}, `${name}-${i}`);
			})
		})] });
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "h-52 w-full",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
			width: "100%",
			height: "100%",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(BarChart, {
				data,
				margin: {
					top: 8,
					right: 12,
					left: 4,
					bottom: 4
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
						stroke: border,
						vertical: false
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
						dataKey: xKey,
						tick: {
							fill: muted,
							fontSize: 11
						},
						axisLine: false,
						tickLine: false,
						interval: 0
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
						allowDecimals: false,
						tick: {
							fill: muted,
							fontSize: 11
						},
						axisLine: false,
						tickLine: false,
						width: 32
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, {
						content: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tip, {}),
						cursor: { fill: cream }
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
						dataKey: yKey,
						name: yLabel ?? yKey,
						fill: color,
						radius: [
							4,
							4,
							0,
							0
						],
						maxBarSize: 22,
						isAnimationActive: !reduce
					})
				]
			})
		})
	});
}
function StackedMoneyBars({ data, xKey, openKey, doneKey }) {
	const reduce = useMotion();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartKey, { items: [{
		label: "Open $",
		color: primary
	}, {
		label: "Completed $",
		color: ink
	}] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "h-56 w-full",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
			width: "100%",
			height: "100%",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(BarChart, {
				data,
				margin: {
					top: 8,
					right: 8,
					left: 4,
					bottom: 0
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
						stroke: border,
						vertical: false
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
						dataKey: xKey,
						tick: {
							fill: muted,
							fontSize: 11
						},
						axisLine: false,
						tickLine: false
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
						tick: {
							fill: muted,
							fontSize: 11
						},
						axisLine: false,
						tickLine: false,
						width: 56
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, {
						content: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tip, { money: true }),
						cursor: { fill: cream }
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
						dataKey: openKey,
						name: "Open $",
						stackId: "a",
						fill: primary,
						radius: [
							0,
							0,
							0,
							0
						],
						maxBarSize: 28,
						isAnimationActive: !reduce
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
						dataKey: doneKey,
						name: "Completed $",
						stackId: "a",
						fill: ink,
						radius: [
							4,
							4,
							0,
							0
						],
						maxBarSize: 28,
						isAnimationActive: !reduce
					})
				]
			})
		})
	})] });
}
function StatusDonut({ data, unit = "total" }) {
	const reduce = useMotion();
	const id = (0, import_react.useId)();
	const total = data.reduce((n, d) => n + d.count, 0);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-3 sm:grid-cols-[9rem_1fr] sm:items-center",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative mx-auto h-44 w-44",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
				width: "100%",
				height: "100%",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PieChart, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pie, {
					data,
					dataKey: "count",
					nameKey: "name",
					innerRadius: 48,
					outerRadius: 70,
					paddingAngle: 2,
					isAnimationActive: !reduce,
					children: data.map((entry, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
						fill: CHART_PALETTE[i % CHART_PALETTE.length],
						stroke: card
					}, `${id}-${entry.name}`))
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, { content: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tip, {}) })] })
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "pointer-events-none absolute inset-0 flex flex-col items-center justify-center",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display text-2xl tabular leading-none",
					children: total
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground",
					children: unit
				})]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "space-y-1.5",
			children: data.map((row, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex items-center gap-2 text-sm",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "size-2 shrink-0 rounded-sm",
						style: { background: CHART_PALETTE[i % CHART_PALETTE.length] }
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "min-w-0 flex-1 truncate",
						children: row.name
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "tabular text-xs text-muted-foreground",
						children: row.count
					})
				]
			}, row.name))
		})]
	});
}
function BreakdownList({ items, empty = "None yet." }) {
	if (!items.length) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "mt-2 text-xs text-muted-foreground",
		children: empty
	});
	const max = Math.max(...items.map((i) => i.count), 1);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "mt-3 space-y-1.5",
		children: items.slice(0, 8).map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
			className: "grid grid-cols-[minmax(0,1fr)_2.5rem_4.5rem] items-center gap-2 text-sm",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "min-w-0 truncate",
					children: item.name
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "tabular text-right text-xs text-muted-foreground",
					children: item.count
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "h-1.5 overflow-hidden rounded-full bg-secondary",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block h-full rounded-full bg-primary",
						style: { width: `${Math.round(item.count / max * 100)}%` }
					})
				})
			]
		}, item.name))
	});
}
function StatCard({ label, value, hint, tone, breakdown }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl border border-border bg-card px-4 py-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: cn("mt-1 font-display text-3xl tabular leading-none", tone === "danger" && "text-destructive", tone === "warn" && "text-warning"),
				children: value
			}),
			hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-muted-foreground",
				children: hint
			}) : null,
			breakdown?.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BreakdownList, { items: breakdown }) : null
		]
	});
}
function ChartCard({ title, lede, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl border border-border bg-card p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-xl",
				children: title
			}),
			lede ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-0.5 text-xs text-muted-foreground",
				children: lede
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3",
				children
			})
		]
	});
}
function MiniStat({ label, value, hint }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg bg-muted/70 px-3 py-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[11px] tracking-wide text-muted-foreground uppercase",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-display text-xl tabular leading-tight",
				children: value
			}),
			hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[11px] text-muted-foreground",
				children: hint
			}) : null
		]
	});
}
//#endregion
export { SimpleBars as a, StatusBadge as c, MiniStat as i, StatusDonut as l, FlagBadge as n, StackedMoneyBars as o, GroupedBars as r, StatCard as s, ChartCard as t, UrgencyBadge as u };
