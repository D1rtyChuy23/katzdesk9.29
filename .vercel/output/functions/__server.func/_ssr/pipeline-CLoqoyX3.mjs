import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { l as Plus } from "../_libs/lucide-react.mjs";
import { i as useQueryClient, n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { f as useOpenRecord, s as Route$6 } from "./router-BpVsA2Dc.mjs";
import { t as Button } from "./button-6ZsGYj3J.mjs";
import { S as listDeals, u as createDeal } from "./api-B23zb1CT.mjs";
import { p as PRODUCERS } from "./lookups-sAI9gyB5.mjs";
import { s as money } from "./clock-CDIQNAok.mjs";
import { d as equipmentCount, f as sortDesk, m as useDeskSort, r as SORT_DEALS, u as SortSelect } from "./sort-C5YlOVRH.mjs";
import { t as Input } from "./input-D-eo25vp.mjs";
import { a as SimpleBars, c as StatusBadge, o as StackedMoneyBars, s as StatCard, t as ChartCard } from "./desk-charts-BV1SUC0s.mjs";
import { c as SimpleCreateDialog, t as DealSheet } from "./entity-sheets-Cr2nNM9k.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/pipeline-CLoqoyX3.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function sum(rows) {
	return rows.reduce((n, d) => n + (d.amount ?? 0), 0);
}
function sizeBucket(amount) {
	if (amount == null || amount === 0) return "No amount";
	if (amount < 5e3) return "Under $5k";
	if (amount < 15e3) return "$5–15k";
	if (amount < 4e4) return "$15–40k";
	return "$40k+";
}
function completionLabel(d) {
	if (d.completion === "complete") return "Complete";
	if (d.completion === "fell") return "Fell through";
	return "Open";
}
function Page() {
	const { open } = Route$6.useSearch();
	const qc = useQueryClient();
	const data = useQuery({
		queryKey: ["deals"],
		queryFn: () => listDeals()
	});
	const [q, setQ] = (0, import_react.useState)("");
	const [view, setView] = (0, import_react.useState)("open");
	const [selected, setSelected] = useOpenRecord(open);
	const [create, setCreate] = (0, import_react.useState)(false);
	const [sort, setSort] = useDeskSort("pipeline", "value-desc");
	const all = data.data ?? [];
	const live = all.filter((d) => d.completion !== "fell");
	const active = live.filter((d) => d.completion !== "complete");
	const completed = live.filter((d) => d.completion === "complete");
	const fell = all.filter((d) => d.completion === "fell");
	const listed = new Set(PRODUCERS);
	const unlisted = live.filter((d) => !d.producer || !listed.has(d.producer));
	const producerChart = PRODUCERS.map((p) => {
		const mine = live.filter((d) => d.producer === p);
		return {
			producer: p,
			open: Math.round(sum(mine.filter((d) => d.completion !== "complete"))),
			done: Math.round(sum(mine.filter((d) => d.completion === "complete")))
		};
	}).filter((p) => p.open + p.done > 0);
	const funnel = [
		{
			stage: "Open",
			count: active.length
		},
		{
			stage: "Good to order",
			count: active.filter((d) => d.goodToOrder).length
		},
		{
			stage: "Ordered",
			count: active.filter((d) => d.ordered).length
		},
		{
			stage: "Complete",
			count: completed.length
		}
	];
	const sizeChart = [
		"No amount",
		"Under $5k",
		"$5–15k",
		"$15–40k",
		"$40k+"
	].map((size) => ({
		size,
		count: live.filter((d) => sizeBucket(d.amount) === size).length
	}));
	const rows = (0, import_react.useMemo)(() => {
		let list = all;
		if (view === "open") list = list.filter((d) => d.completion !== "complete" && d.completion !== "fell");
		if (view === "complete") list = list.filter((d) => d.completion === "complete");
		const needle = q.trim().toLowerCase();
		if (needle) list = list.filter((d) => [
			d.customer,
			d.producer,
			d.equipment,
			d.invoice,
			d.terms
		].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle)));
		return sortDesk(list, sort, {
			date: (d) => d.dateOfDeal ?? d.updatedAt,
			name: (d) => d.customer,
			equipment: (d) => equipmentCount(d.equipment),
			value: (d) => d.amount,
			status: (d) => completionLabel(d)
		});
	}, [
		all,
		q,
		view,
		sort
	]);
	const selectedRow = all.find((d) => d.id === selected) ?? null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-medium tracking-tight",
				children: "Sales pipeline"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-xl text-sm text-muted-foreground",
				children: "One row per equipment deal. Charts show who is carrying the book and how far deals have moved."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				onClick: () => setCreate(true),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "New deal"]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Active deals",
					value: active.length
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Active pipeline",
					value: money(sum(active))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Completed",
					value: completed.length,
					hint: money(sum(completed))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Total booked",
					value: money(sum(live))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Good to order",
					value: active.filter((d) => d.goodToOrder).length,
					hint: "Open deals cleared to order"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Fell through",
					value: fell.length,
					tone: fell.length ? "danger" : void 0
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartCard, {
					title: "By producer",
					lede: "Open dollars stacked under completed. Fell-through deals are left out.",
					children: producerChart.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StackedMoneyBars, {
						data: producerChart,
						xKey: "producer",
						openKey: "open",
						doneKey: "done"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted-foreground",
						children: "No live deals yet."
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartCard, {
					title: "How deals move",
					lede: "Same open book, four gates. A deal can sit in more than one bar.",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleBars, {
						data: funnel,
						xKey: "stage",
						yKey: "count",
						yLabel: "Deals",
						horizontal: true
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartCard, {
					title: "Deal size",
					lede: "Live book by amount, so a few large jobs don’t hide the rest.",
					children: sizeChart.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleBars, {
						data: sizeChart,
						xKey: "size",
						yKey: "count",
						yLabel: "Deals",
						horizontal: true
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted-foreground",
						children: "No live deals yet."
					})
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-6 overflow-hidden rounded-xl border border-border bg-card",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "border-b border-border px-4 py-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-xl",
					children: "By producer"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground",
					children: "Fell-through deals are excluded, matching the old dashboard."
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "overflow-x-auto px-4 py-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full min-w-[36rem] text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
						className: "text-left text-xs tracking-wide text-muted-foreground uppercase",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "pb-2 pr-4 font-medium",
								children: "Producer"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "pb-2 pr-4 font-medium",
								children: "Deals"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "pb-2 pr-4 font-medium",
								children: "Total"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "pb-2 pr-4 font-medium",
								children: "Completed"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "pb-2 font-medium",
								children: "Open $"
							})
						] })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [
						PRODUCERS.map((p) => {
							const mine = live.filter((d) => d.producer === p);
							const c = mine.filter((d) => d.completion === "complete");
							const o = mine.filter((d) => d.completion !== "complete");
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: "border-t border-border",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-2 pr-4",
										children: p
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "tabular py-2 pr-4",
										children: mine.length
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "tabular py-2 pr-4",
										children: money(sum(mine))
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
										className: "tabular py-2 pr-4",
										children: [
											c.length,
											" · ",
											money(sum(c))
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "tabular py-2",
										children: money(sum(o))
									})
								]
							}, p);
						}),
						unlisted.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-t border-border text-muted-foreground",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 pr-4",
									children: "(No producer / not on list)"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "tabular py-2 pr-4",
									children: unlisted.length
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "tabular py-2 pr-4",
									children: money(sum(unlisted))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									className: "tabular py-2 pr-4",
									children: [
										unlisted.filter((d) => d.completion === "complete").length,
										" ·",
										" ",
										money(sum(unlisted.filter((d) => d.completion === "complete")))
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "tabular py-2",
									children: money(sum(unlisted.filter((d) => d.completion !== "complete")))
								})
							]
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-t border-border font-medium",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 pr-4",
									children: "TOTAL"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "tabular py-2 pr-4",
									children: live.length
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "tabular py-2 pr-4",
									children: money(sum(live))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									className: "tabular py-2 pr-4",
									children: [
										completed.length,
										" · ",
										money(sum(completed))
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "tabular py-2",
									children: money(sum(active))
								})
							]
						})
					] })]
				})
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-6 flex flex-wrap gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => setView("open"),
					className: `h-9 rounded-full px-3 text-sm font-medium ${view === "open" ? "bg-ink text-ink-foreground" : "bg-secondary"}`,
					children: [
						"Open (",
						active.length,
						")"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => setView("complete"),
					className: `h-9 rounded-full px-3 text-sm font-medium ${view === "complete" ? "bg-ink text-ink-foreground" : "bg-secondary"}`,
					children: [
						"Complete (",
						completed.length,
						")"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setView("all"),
					className: `h-9 rounded-full px-3 text-sm font-medium ${view === "all" ? "bg-ink text-ink-foreground" : "bg-secondary"}`,
					children: "All deals"
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
					options: SORT_DEALS
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 overflow-hidden rounded-xl border border-border bg-card",
			children: [rows.map((d) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => setSelected(d.id),
				className: "grid w-full gap-1 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/60 md:grid-cols-[1.4fr_7rem_7rem_8rem] md:items-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-medium",
						children: d.customer
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "mt-0.5 block text-xs text-muted-foreground",
						children: [
							d.producer ?? "Unassigned",
							" · ",
							d.equipment || "No equipment listed"
						]
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "tabular text-sm font-medium",
						children: money(d.amount)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: completionLabel(d) }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-xs text-muted-foreground",
						children: [d.goodToOrder ? "Good to order" : "Needs approval", d.ordered ? " · Ordered" : ""]
					})
				]
			}, d.id)), rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-4 py-8 text-sm text-muted-foreground",
				children: "No deals in this view."
			}) : null]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DealSheet, {
			deal: selectedRow,
			onClose: () => setSelected(null)
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleCreateDialog, {
			title: "New deal",
			open: create,
			onOpenChange: setCreate,
			fields: [
				{
					name: "customer",
					label: "Customer",
					required: true,
					kind: "customer"
				},
				{
					name: "producer",
					label: "Producer"
				},
				{
					name: "equipment",
					label: "Equipment",
					kind: "equipment"
				},
				{
					name: "amount",
					label: "Deal amount ($)"
				}
			],
			onSubmit: async (v) => {
				const amountRaw = v.amount?.replace(/[$,]/g, "").trim();
				const amountNum = amountRaw ? Number(amountRaw) : void 0;
				const row = await createDeal({ data: {
					customer: v.customer,
					producer: v.producer || void 0,
					equipment: v.equipment || void 0,
					amount: amountNum != null && Number.isFinite(amountNum) ? amountNum : void 0
				} });
				qc.invalidateQueries({ queryKey: ["deals"] });
				qc.invalidateQueries({ queryKey: ["dashboard"] });
				toast.success("Deal added");
				setSelected(row.id);
			}
		})
	] });
}
//#endregion
export { Page as component };
