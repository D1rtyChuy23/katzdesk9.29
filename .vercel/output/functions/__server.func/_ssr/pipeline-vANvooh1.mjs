import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { n as PRODUCERS, o as isNoRep, s as sameRep } from "./rep-match-DCVeb4ID.mjs";
import { l as money } from "./clock-CSFAgASg.mjs";
import { b as Plus, u as Trash2 } from "../_libs/lucide-react.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { c as Route$9, g as useMyView, h as MyViewBar, x as useOpenRecord } from "./router-1NWxggZt.mjs";
import { E as listDeals, d as createDeal, r as archiveDeal } from "./api-CgwyWugK.mjs";
import { d as sortDesk, l as SortSelect, p as useDeskSort, r as SORT_DEALS, u as equipmentCount } from "./sort-1yS_DCzE.mjs";
import { r as StatusBadge } from "./flag-badge-jup2uYzS.mjs";
import { n as Button, r as Input } from "./input-COYCsX_T.mjs";
import { n as NoRepFlag, t as AkBadge } from "./ak-badge-m29_U4_Z.mjs";
import { a as StackedMoneyBars, i as SimpleBars, o as StatCard, t as ChartCard } from "./desk-charts-BMK8dv-e.mjs";
import { n as RepName, t as RepFilter } from "./rep-select-BQ75vNDf.mjs";
import { c as SimpleCreateDialog, t as DealSheet } from "./entity-sheets-ChIYwImr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/pipeline-vANvooh1.js
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
function Chip({ active, onClick, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick,
		"aria-pressed": active,
		className: `h-9 shrink-0 rounded-full px-3 text-sm font-medium ${active ? "bg-ink text-ink-foreground" : "bg-secondary"}`,
		children
	});
}
function Page() {
	const { open } = Route$9.useSearch();
	const qc = useQueryClient();
	const data = useQuery({
		queryKey: ["deals"],
		queryFn: () => listDeals()
	});
	const [q, setQ] = (0, import_react.useState)("");
	const [view, setView] = (0, import_react.useState)("gto");
	const [selected, setSelected] = useOpenRecord(open);
	const [create, setCreate] = (0, import_react.useState)(false);
	const { filterMine, matchMine } = useMyView();
	const [repFilter, setRepFilter] = (0, import_react.useState)("");
	const [sort, setSort] = useDeskSort("pipeline", "date-desc");
	const all = data.data ?? [];
	const live = all.filter((d) => d.completion !== "fell");
	const active = live.filter((d) => d.completion !== "complete");
	const completed = live.filter((d) => d.completion === "complete");
	const unlisted = live.filter((d) => isNoRep(d.producer));
	const gtoN = active.filter((d) => d.goodToOrder && !d.ordered).length;
	const orderedN = active.filter((d) => d.ordered).length;
	const producerChart = PRODUCERS.map((p) => {
		const mine = live.filter((d) => sameRep(d.producer, p));
		return {
			producer: p,
			open: Math.round(sum(mine.filter((d) => d.completion !== "complete"))),
			done: Math.round(sum(mine.filter((d) => d.completion === "complete")))
		};
	}).filter((p) => p.open + p.done > 0);
	const funnel = [
		{
			stage: "Good to order",
			count: gtoN
		},
		{
			stage: "Ordered",
			count: orderedN
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
		if (view === "gto") list = list.filter((d) => d.completion !== "complete" && d.completion !== "fell" && d.goodToOrder && !d.ordered);
		if (view === "ordered") list = list.filter((d) => d.completion !== "complete" && d.completion !== "fell" && d.ordered);
		if (filterMine) list = list.filter((d) => matchMine(d.producer) || d.aviKatz);
		if (repFilter === "__none__") list = list.filter((d) => d.noRep);
		else if (repFilter) list = list.filter((d) => sameRep(d.producer, repFilter));
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
		sort,
		filterMine,
		matchMine,
		repFilter
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
				children: "One row per equipment deal. Step 1 is Good to order (rep). Step 2 is Ordered (you confirm it) — confirmed orders leave the Good to order list."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MyViewBar, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					onClick: () => setCreate(true),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "New deal"]
				})]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 grid min-w-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6",
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
					value: gtoN,
					hint: "Step 1 — waiting to be ordered"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Ordered",
					value: orderedN,
					hint: "Step 2 — confirmed ordered"
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-5 grid min-w-0 gap-4 lg:grid-cols-2 xl:grid-cols-3",
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
					lede: "Good to order first, then Ordered. Ordered deals drop off step 1.",
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
							const mine = live.filter((d) => sameRep(d.producer, p));
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
									children: "No rep assigned"
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
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Chip, {
					active: view === "gto",
					onClick: () => setView("gto"),
					children: [
						"Good to order (",
						gtoN,
						")"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Chip, {
					active: view === "ordered",
					onClick: () => setView("ordered"),
					children: [
						"Ordered (",
						orderedN,
						")"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Chip, {
					active: view === "open",
					onClick: () => setView("open"),
					children: [
						"Open (",
						active.length,
						")"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Chip, {
					active: view === "complete",
					onClick: () => setView("complete"),
					children: [
						"Complete (",
						completed.length,
						")"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
					active: view === "all",
					onClick: () => setView("all"),
					children: "All deals"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: q,
					onChange: (e) => setQ(e.target.value),
					placeholder: "Filter…",
					className: "w-full max-w-xs min-w-0"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RepFilter, {
					value: repFilter,
					onChange: setRepFilter,
					extraNames: all.map((d) => d.producer)
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
			children: [rows.map((d) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DealRow, {
				deal: d,
				onOpen: () => setSelected(d.id)
			}, d.id)), rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-4 py-8 text-sm text-muted-foreground",
				children: view === "gto" ? "No deals waiting on Good to order. Reps mark step 1; confirmed Ordered deals leave this list." : view === "ordered" ? "No open deals confirmed as Ordered." : "No deals in this view."
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
					label: "Rep",
					kind: "rep"
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
function DealRow({ deal: d, onOpen }) {
	const qc = useQueryClient();
	const remove = useMutation({
		mutationFn: () => archiveDeal({ data: { id: d.id } }),
		onSuccess: () => {
			toast.success(`Removed ${d.customer} from the list`);
			qc.invalidateQueries({ queryKey: ["deals"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["handoff"] });
		},
		onError: (e) => {
			console.error("archiveDeal failed", e);
			toast.error(e instanceof Error ? e.message : "Could not remove");
		}
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2 border-b border-border px-3 py-2 last:border-b-0 hover:bg-muted/60 md:px-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			onClick: onOpen,
			className: "grid min-w-0 flex-1 gap-1 py-1 text-left md:grid-cols-[1.4fr_7rem_7rem_8rem] md:items-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-medium",
						children: d.customer
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AkBadge, {
						on: d.aviKatz,
						className: "ml-1.5 align-middle"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "mt-0.5 block text-xs text-muted-foreground",
						children: [
							d.producer ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RepName, { name: d.producer }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NoRepFlag, { show: true }),
							" · ",
							d.equipment || "No equipment listed"
						]
					})
				] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "tabular text-sm font-medium",
					children: money(d.amount)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: completionLabel(d) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-xs text-muted-foreground",
					children: d.ordered ? "Step 2 · Ordered" : d.goodToOrder ? "Step 1 · Good to order" : "Needs good to order"
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
			type: "button",
			size: "sm",
			variant: "outline",
			className: "shrink-0",
			"aria-label": `Remove ${d.customer} from the list`,
			"data-testid": "archive-row",
			disabled: remove.isPending,
			onClick: () => {
				if (window.confirm(`Remove “${d.customer}” from the pipeline list?`)) remove.mutate();
			},
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "hidden sm:inline",
				children: "Remove"
			})]
		})]
	});
}
//#endregion
export { Page as component };
