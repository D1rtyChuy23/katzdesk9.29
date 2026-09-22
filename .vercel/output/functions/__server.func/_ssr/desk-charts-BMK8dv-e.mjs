import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { _ as cn } from "./router-1NWxggZt.mjs";
import { a as Tooltip, i as ResponsiveContainer, n as Pie, r as Cell, t as PieChart } from "../_libs/recharts+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/desk-charts-BMK8dv-e.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var ink = "#1A1612";
var primary = "#2F5D50";
var warning = "#9A5B12";
var muted = "#6F675E";
var cream = "#E7E0D4";
var card = "#FAF7F1";
var CHART_PALETTE = [
	primary,
	ink,
	warning,
	muted,
	cream
];
function useNarrow() {
	const [narrow, setNarrow] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		const mq = window.matchMedia("(max-width: 640px)");
		const sync = () => setNarrow(mq.matches);
		sync();
		mq.addEventListener("change", sync);
		return () => mq.removeEventListener("change", sync);
	}, []);
	return narrow;
}
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
function barWidth(n, max) {
	if (n <= 0 || max <= 0) return 0;
	return Math.min(100, Math.max(Math.round(n / max * 100), 6));
}
function BarTrack({ pct, color = primary, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("block h-2.5 min-w-0 overflow-hidden rounded-full bg-secondary", className),
		"aria-hidden": true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "block h-full max-w-full rounded-full",
			style: {
				width: `${Math.min(Math.max(pct, 0), 100)}%`,
				background: color
			}
		})
	});
}
function BarRow({ name, n, pct, color, label }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
		className: "min-w-0",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-baseline justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "min-w-0 truncate text-sm leading-snug",
					title: name,
					children: name
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "shrink-0 tabular text-sm font-medium",
					children: n
				})]
			}),
			label ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[11px] text-muted-foreground",
				children: label
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BarTrack, {
				pct,
				color,
				className: "mt-1"
			})
		]
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
	const max = Math.max(...data.flatMap((d) => [Number(d[aKey]) || 0, Number(d[bKey]) || 0]), 1);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartKey, { items: [{
			label: aLabel,
			color: primary
		}, {
			label: bLabel,
			color: ink
		}] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "space-y-4",
			children: data.map((row, i) => {
				const name = String(row[xKey] ?? "—");
				const a = Number(row[aKey]) || 0;
				const b = Number(row[bKey]) || 0;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "min-w-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-1.5 truncate text-sm font-medium",
						title: name,
						children: name
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GroupedTrack, {
							label: aLabel,
							n: a,
							pct: barWidth(a, max),
							color: primary
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GroupedTrack, {
							label: bLabel,
							n: b,
							pct: barWidth(b, max),
							color: ink
						})]
					})]
				}, `${name}-${i}`);
			})
		})]
	});
}
function GroupedTrack({ label, n, pct, color }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid min-w-0 grid-cols-[4.25rem_minmax(0,1fr)_1.75rem] items-center gap-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "truncate text-[11px] text-muted-foreground",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BarTrack, {
				pct,
				color,
				className: "h-2"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "tabular text-right text-xs font-medium",
				children: n
			})
		]
	});
}
function SimpleBars({ data, xKey, yKey, yLabel, color = primary, horizontal }) {
	const narrow = useNarrow();
	const max = Math.max(...data.map((d) => Number(d[yKey]) || 0), 1);
	const rows = /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "space-y-2.5",
		children: data.map((row, i) => {
			const name = String(row[xKey] ?? "—");
			const n = Number(row[yKey]) || 0;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BarRow, {
				name,
				n,
				pct: barWidth(n, max),
				color
			}, `${name}-${i}`);
		})
	});
	if (horizontal || narrow || data.length > 8) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0",
		children: [yLabel ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mb-2 text-right text-xs tracking-wide text-muted-foreground uppercase",
			children: yLabel
		}) : null, rows]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0",
		children: [yLabel ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mb-2 text-right text-xs tracking-wide text-muted-foreground uppercase",
			children: yLabel
		}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex h-48 min-w-0 items-end gap-1 sm:gap-2",
			children: data.map((row, i) => {
				const name = String(row[xKey] ?? "—");
				const n = Number(row[yKey]) || 0;
				const pct = barWidth(n, max);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex min-w-0 flex-1 flex-col items-center gap-1",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "tabular text-[11px] font-medium",
							children: n
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex h-36 w-full max-w-8 items-end justify-center",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block w-full max-w-5 overflow-hidden rounded-t-md",
								style: {
									height: `${pct}%`,
									background: color,
									minHeight: n ? "4px" : 0
								},
								title: `${name}: ${n}`
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "w-full truncate text-center text-[10px] leading-tight text-muted-foreground",
							title: name,
							children: name
						})
					]
				}, `${name}-${i}`);
			})
		})]
	});
}
function StackedMoneyBars({ data, xKey, openKey, doneKey }) {
	const max = Math.max(...data.map((d) => (Number(d[openKey]) || 0) + (Number(d[doneKey]) || 0)), 1);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartKey, { items: [{
			label: "Open $",
			color: primary
		}, {
			label: "Completed $",
			color: ink
		}] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "space-y-3",
			children: data.map((row, i) => {
				const name = String(row[xKey] ?? "—");
				const open = Number(row[openKey]) || 0;
				const done = Number(row[doneKey]) || 0;
				const total = open + done;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "min-w-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-baseline justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "min-w-0 truncate text-sm font-medium",
							title: name,
							children: name
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "shrink-0 tabular text-xs font-medium",
							children: usd(total)
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "mt-1 flex h-2.5 min-w-0 overflow-hidden rounded-full bg-secondary",
						"aria-hidden": true,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "h-full max-w-full shrink-0",
							style: {
								width: `${open / max * 100}%`,
								background: primary
							}
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "h-full max-w-full shrink-0",
							style: {
								width: `${done / max * 100}%`,
								background: ink
							}
						})]
					})]
				}, `${name}-${i}`);
			})
		})]
	});
}
function StatusDonut({ data, unit = "total" }) {
	const reduce = useMotion();
	const id = (0, import_react.useId)();
	const total = data.reduce((n, d) => n + d.count, 0);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-w-0 flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative size-36 shrink-0 sm:size-40",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
				width: "100%",
				height: "100%",
				minWidth: 0,
				minHeight: 0,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PieChart, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pie, {
					data,
					dataKey: "count",
					nameKey: "name",
					innerRadius: 40,
					outerRadius: 62,
					paddingAngle: 2,
					isAnimationActive: !reduce,
					label: false,
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
			className: "w-full min-w-0 space-y-1.5 sm:flex-1",
			children: data.map((row, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex min-w-0 items-center gap-2 text-sm",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "size-2 shrink-0 rounded-sm",
						style: { background: CHART_PALETTE[i % CHART_PALETTE.length] }
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "min-w-0 flex-1 truncate leading-snug",
						children: row.name
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "shrink-0 tabular text-xs text-muted-foreground",
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
		className: "mt-3 min-w-0 space-y-2",
		children: items.slice(0, 8).map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BarRow, {
			name: item.name,
			n: item.count,
			pct: barWidth(item.count, max)
		}, item.name))
	});
}
function StatCard({ label, value, hint, tone, breakdown }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "@container min-w-0 overflow-hidden rounded-xl border border-border bg-card px-3 py-3 sm:px-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "truncate text-xs tracking-wide text-muted-foreground uppercase",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: cn("mt-1 font-display text-3xl tabular leading-none", tone === "danger" && "text-destructive", tone === "warn" && "text-warning"),
				children: value
			}),
			hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 line-clamp-2 text-xs text-muted-foreground",
				children: hint
			}) : null,
			breakdown?.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-1 hidden min-w-0 overflow-hidden @[11rem]:block",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BreakdownList, { items: breakdown })
			}) : null
		]
	});
}
function ChartCard({ title, lede, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0 overflow-hidden rounded-xl border border-border bg-card p-4 sm:p-5",
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
				className: "mt-3 min-w-0 overflow-hidden",
				children
			})
		]
	});
}
function MiniStat({ label, value, hint }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0 overflow-hidden rounded-lg bg-muted/70 px-3 py-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "truncate text-[11px] tracking-wide text-muted-foreground uppercase",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-display text-xl tabular leading-tight",
				children: value
			}),
			hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "truncate text-[11px] text-muted-foreground",
				children: hint
			}) : null
		]
	});
}
//#endregion
export { StackedMoneyBars as a, SimpleBars as i, GroupedBars as n, StatCard as o, MiniStat as r, StatusDonut as s, ChartCard as t };
