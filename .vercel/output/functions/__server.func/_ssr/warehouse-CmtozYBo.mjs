import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { l as Plus } from "../_libs/lucide-react.mjs";
import { i as useQueryClient, n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { f as useOpenRecord, n as Route$1 } from "./router-BpVsA2Dc.mjs";
import { n as cn, t as Button } from "./button-6ZsGYj3J.mjs";
import { l as createAsset, y as listAssets } from "./api-B23zb1CT.mjs";
import { f as sortDesk, i as SORT_EQUIP, l as SelectField, m as useDeskSort, n as SORT_DATE, s as SORT_STATUS, t as SORT_ALPHA, u as SortSelect } from "./sort-C5YlOVRH.mjs";
import { n as Label, t as Input } from "./input-D-eo25vp.mjs";
import { a as SimpleBars, c as StatusBadge, s as StatCard, t as ChartCard } from "./desk-charts-BV1SUC0s.mjs";
import { c as bayFor, f as slotId, i as LEVELS, n as BARN_EQUIP_CAPACITY, r as FRONT_PALLETS, t as BACK_PALLETS } from "./warehouse-D56k1KJf.mjs";
import { i as DialogTitle, n as DialogContent, t as Dialog } from "./thread-BhKV-CeC.mjs";
import { n as EquipmentCombo, t as CustomerCombo } from "./directory-fields-Bs08Xp2k.mjs";
import { t as AssetSheet } from "./asset-sheet-CtgCz4AL.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/warehouse-CmtozYBo.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Page() {
	const { open } = Route$1.useSearch();
	const qc = useQueryClient();
	const data = useQuery({
		queryKey: ["assets"],
		queryFn: () => listAssets()
	});
	const [rack, setRack] = (0, import_react.useState)("barn-back");
	const [q, setQ] = (0, import_react.useState)("");
	const [slot, setSlot] = (0, import_react.useState)(null);
	const [selected, setSelected] = useOpenRecord(open);
	const [create, setCreate] = (0, import_react.useState)(false);
	const [sort, setSort] = useDeskSort("warehouse", "alpha-asc");
	const all = data.data ?? [];
	const barn = (0, import_react.useMemo)(() => all.filter((a) => a.status === "ready" && (a.site === "barn-back" || a.site === "barn-front")), [all]);
	const onRack = barn.filter((a) => a.site === rack);
	const pallets = rack === "barn-front" ? FRONT_PALLETS : BACK_PALLETS;
	const fill = (0, import_react.useMemo)(() => {
		const map = /* @__PURE__ */ new Map();
		for (const a of onRack) {
			if (!a.pallet || !a.level) continue;
			const k = `${a.pallet}-${a.level}`;
			map.set(k, (map.get(k) ?? 0) + 1);
		}
		return map;
	}, [onRack]);
	const slotUnits = (0, import_react.useMemo)(() => {
		if (!slot) return [];
		return onRack.filter((a) => a.pallet === slot.pallet && a.level === slot.level).sort((a, b) => (a.lineNo ?? 99) - (b.lineNo ?? 99));
	}, [onRack, slot]);
	const needle = q.trim().toLowerCase();
	const list = (0, import_react.useMemo)(() => {
		let rows = slot ? slotUnits : onRack.filter((a) => a.kind === "equip" || a.kind === "dispenser");
		if (needle) rows = barn.filter((a) => [
			a.model,
			a.serial,
			a.slotLabel,
			a.customerOwned
		].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle)));
		return sortDesk(rows, sort, {
			name: (a) => a.model,
			equipment: (a) => a.qty ?? 1,
			status: (a) => a.status,
			date: (a) => a.updatedAt
		});
	}, [
		slot,
		slotUnits,
		onRack,
		barn,
		needle,
		sort
	]);
	const equipReady = barn.filter((a) => a.kind === "equip").reduce((n, a) => n + a.qty, 0);
	const equipLines = barn.filter((a) => a.kind === "equip").length;
	const dispQty = barn.filter((a) => a.kind === "dispenser").reduce((n, a) => n + a.qty, 0);
	const missing = barn.filter((a) => a.missingSerial).length;
	const owned = barn.filter((a) => a.customerOwned).length;
	const models = new Set(barn.filter((a) => a.kind === "equip").map((a) => a.model)).size;
	const catering = barn.filter((a) => a.bay === "catering" && a.kind === "equip").length;
	const selectedRow = all.find((a) => a.id === selected) ?? null;
	const capacity = rack === "barn-front" ? 384 : 672;
	const readyByModel = (0, import_react.useMemo)(() => {
		const map = /* @__PURE__ */ new Map();
		for (const a of barn) {
			if (a.kind !== "equip") continue;
			map.set(a.model, (map.get(a.model) ?? 0) + a.qty);
		}
		return [...map.entries()].map(([name, count]) => ({
			name,
			count
		})).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
	}, [barn]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-medium tracking-tight",
				children: "Barn warehouse"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-xl text-sm text-muted-foreground",
				children: "Ready-to-deploy units at HQ. Slot ID is pallet + level — B-L3 is pallet B, third shelf. Pull a unit onto an install and it leaves this board."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				onClick: () => setCreate(true),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "Add to rack"]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Ready",
					value: equipReady,
					hint: `${models} models · ${Math.max(0, BARN_EQUIP_CAPACITY - equipLines)} open slots`,
					breakdown: readyByModel
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Fill",
					value: `${Math.round(equipLines / BARN_EQUIP_CAPACITY * 100)}%`,
					hint: `${equipLines} lines on the rack`
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Dispensers",
					value: dispQty,
					hint: "Not counted in Ready"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Missing serial",
					value: missing,
					tone: missing ? "warn" : void 0,
					hint: `${owned} customer-owned · ${catering} catering`
				})
			]
		}),
		readyByModel.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
			className: "mt-5",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartCard, {
				title: "Ready by model",
				lede: "The Ready bubble, unpacked — qty on the rack, not line count.",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleBars, {
					data: readyByModel.slice(0, 10).map((r) => ({
						model: r.name,
						count: r.count
					})),
					xKey: "model",
					yKey: "count",
					yLabel: "Qty",
					horizontal: true
				})
			})
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 flex flex-wrap gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => {
						setRack("barn-back");
						setSlot(null);
					},
					className: cn("h-9 rounded-full px-3 text-sm font-medium", rack === "barn-back" ? "bg-ink text-ink-foreground" : "bg-secondary"),
					children: "Back rack"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => {
						setRack("barn-front");
						setSlot(null);
					},
					className: cn("h-9 rounded-full px-3 text-sm font-medium", rack === "barn-front" ? "bg-ink text-ink-foreground" : "bg-secondary"),
					children: "Front rack"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: q,
					onChange: (e) => setQ(e.target.value),
					placeholder: "Find model or serial…",
					className: "max-w-xs"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
					value: sort,
					onChange: setSort,
					options: [
						...SORT_ALPHA,
						...SORT_DATE,
						...SORT_EQUIP,
						...SORT_STATUS
					]
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mr-1 inline-block size-2 rounded-sm bg-catering" }), "Catering B–E"] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mr-1 inline-block size-2 rounded-sm bg-dispense" }), "Dispenser F–G"] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
					"Number in a cell is lines used of 12. Capacity this rack: ",
					capacity,
					"."
				] })
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-3 w-full max-w-full overflow-x-auto rounded-xl border border-border bg-card p-3",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
				className: "w-full min-w-[40rem] border-collapse text-center",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
					className: "pb-2 pr-2 text-left text-[11px] font-medium tracking-wide text-muted-foreground uppercase",
					children: "Level"
				}), pallets.map((p) => {
					const bay = bayFor(rack, p);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: cn("px-0.5 pb-2 text-[11px] font-medium", bay === "catering" && "text-catering", bay === "dispenser" && "text-dispense"),
						children: p
					}, p);
				})] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: LEVELS.map((level) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", {
					className: "py-1 pr-2 text-left text-xs font-medium text-muted-foreground",
					children: [
						"L",
						level,
						level === 4 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ml-1 font-normal",
							children: "top"
						}) : null,
						level === 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ml-1 font-normal",
							children: "floor"
						}) : null
					]
				}), pallets.map((p) => {
					const n = fill.get(`${p}-${level}`) ?? 0;
					const bay = bayFor(rack, p);
					const active = slot?.pallet === p && slot.level === level && slot.rack === rack;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "p-0.5",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setSlot(active ? null : {
								rack,
								pallet: p,
								level
							}),
							className: cn("flex h-9 w-full min-w-8 items-center justify-center rounded-sm text-xs tabular transition-colors", n === 0 && "bg-muted text-muted-foreground", n > 0 && n < 12 && "bg-primary/15 text-foreground", n >= 12 && "bg-primary text-primary-foreground", bay === "catering" && n === 0 && "bg-catering/15", bay === "dispenser" && n === 0 && "bg-dispense/15", active && "ring-2 ring-ring"),
							"aria-label": `${p}-L${level} ${n} of 12`,
							children: n
						})
					}, p);
				})] }, level)) })]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 flex items-baseline justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-xl",
				children: needle ? "Search" : slot ? slotId(slot.pallet, slot.level) : rack === "barn-back" ? "Back rack units" : "Front rack units"
			}), slot ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "text-xs text-muted-foreground hover:text-foreground",
				onClick: () => setSlot(null),
				children: "Clear slot"
			}) : null]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-3 overflow-hidden rounded-xl border border-border bg-card",
			children: [list.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => setSelected(a.id),
				className: "grid w-full gap-1 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/60 md:grid-cols-[7rem_1.4fr_8rem_7rem] md:items-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-mono text-xs",
						children: a.slotLabel
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-medium",
						children: a.model
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "mt-0.5 block text-xs text-muted-foreground",
						children: [
							a.serial ?? "No serial",
							a.qty > 1 ? ` · qty ${a.qty}` : "",
							a.customerOwned ? ` · ${a.customerOwned}` : ""
						]
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "flex flex-wrap gap-1",
						children: [
							a.missingSerial ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "Serial missing" }) : null,
							a.customerOwned ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "Customer-owned" }) : null,
							a.kind === "dispenser" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "Accessory" }) : null
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-sm text-muted-foreground",
						children: a.kind === "dispenser" ? `${a.qty} pcs` : "1 unit"
					})
				]
			}, a.id)), list.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-4 py-8 text-sm text-muted-foreground",
				children: slot ? "Empty slot — add a unit here." : "Nothing on this rack matches."
			}) : null]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AssetSheet, {
			asset: selectedRow,
			onClose: () => setSelected(null)
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AddDialog, {
			open: create,
			onOpenChange: setCreate,
			rack,
			slot,
			onCreated: async (row) => {
				qc.invalidateQueries({ queryKey: ["assets"] });
				qc.invalidateQueries({ queryKey: ["dashboard"] });
				toast.success("On the rack");
				setSelected(row.id);
			}
		})
	] });
}
function AddDialog({ open, onOpenChange, rack, slot, onCreated }) {
	const pallets = (slot?.rack ?? rack) === "barn-front" ? FRONT_PALLETS : BACK_PALLETS;
	const [pending, setPending] = (0, import_react.useState)(false);
	const [model, setModel] = (0, import_react.useState)("");
	const [owned, setOwned] = (0, import_react.useState)("");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange: (v) => {
			onOpenChange(v);
			if (!v) {
				setModel("");
				setOwned("");
			}
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Add to the barn" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "mt-4 space-y-3",
			onSubmit: async (e) => {
				e.preventDefault();
				const fd = new FormData(e.currentTarget);
				const site = String(fd.get("site"));
				const pallet = String(fd.get("pallet"));
				const level = Number(fd.get("level"));
				const qtyRaw = String(fd.get("qty") || "1");
				setPending(true);
				try {
					await onCreated(await createAsset({ data: {
						kind: String(fd.get("kind")) === "dispenser" ? "dispenser" : "equip",
						model,
						serial: String(fd.get("serial") || "") || null,
						qty: Number.isFinite(Number(qtyRaw)) ? Number(qtyRaw) : 1,
						customerOwned: owned || null,
						site,
						pallet,
						level
					} }));
					onOpenChange(false);
				} catch (err) {
					toast.error(err instanceof Error ? err.message : "Failed");
				} finally {
					setPending(false);
				}
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EquipmentCombo, {
					name: "model",
					label: "Model",
					value: model,
					onChange: setModel,
					required: true,
					placeholder: "Search equipment…"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-2 gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Serial" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						name: "serial",
						className: "mt-1"
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Qty" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						name: "qty",
						type: "number",
						min: 1,
						defaultValue: "1",
						className: "mt-1"
					})] })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Kind" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
					name: "kind",
					className: "mt-1",
					defaultValue: "equip",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "equip",
						children: "Equipment"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "dispenser",
						children: "Dispenser / accessory"
					})]
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-3 gap-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Rack" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
							name: "site",
							className: "mt-1",
							defaultValue: slot?.rack ?? rack,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "barn-back",
								children: "Back"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "barn-front",
								children: "Front"
							})]
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Pallet" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
							name: "pallet",
							className: "mt-1",
							defaultValue: slot?.pallet ?? pallets[0],
							children: pallets.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: p }, p))
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Level" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
							name: "level",
							className: "mt-1",
							defaultValue: String(slot?.level ?? 1),
							children: LEVELS.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
								value: l,
								children: ["L", l]
							}, l))
						})] })
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerCombo, {
					name: "customerOwned",
					label: "Customer-owned (optional)",
					value: owned,
					onChange: setOwned,
					placeholder: "Search customers…"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground",
					children: "Puts the unit on the next open line of that slot (1–12)."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex justify-end",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						disabled: pending,
						children: "Add"
					})
				})
			]
		})] })
	});
}
//#endregion
export { Page as component };
