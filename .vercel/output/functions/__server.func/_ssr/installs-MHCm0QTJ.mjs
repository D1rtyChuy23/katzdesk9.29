import { o as __toESM, r as __exportAll } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { s as sameRep } from "./rep-match-DCVeb4ID.mjs";
import { m as weekBounds, o as formatShortDate, p as todayChicago } from "./clock-CSFAgASg.mjs";
import { b as Plus, u as Trash2, z as Clock } from "../_libs/lucide-react.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { f as Route$13, g as useMyView, h as MyViewBar, x as useOpenRecord } from "./router-1NWxggZt.mjs";
import { D as listDirectory, G as updateInstall, M as listRecipes, O as listInstalls, S as listAssets, T as listCustomers, a as archiveInstall, f as createInstall } from "./api-CgwyWugK.mjs";
import { d as sortDesk, f as tally, l as SortSelect, o as SORT_LIST, p as useDeskSort, u as equipmentCount } from "./sort-1yS_DCzE.mjs";
import { t as Badge } from "./badge-C8SL_nG4.mjs";
import { n as FlagBadge, r as StatusBadge } from "./flag-badge-jup2uYzS.mjs";
import { n as Button, r as Input } from "./input-COYCsX_T.mjs";
import { n as NoRepFlag, t as AkBadge } from "./ak-badge-m29_U4_Z.mjs";
import { i as SimpleBars, o as StatCard, s as StatusDonut, t as ChartCard } from "./desk-charts-BMK8dv-e.mjs";
import { a as listedEquipment, n as dropEquipment, o as matchModel, s as piecesForInstall, t as catalogModels } from "./equipment-BifqoJpR.mjs";
import { n as RepName, t as RepFilter } from "./rep-select-BQ75vNDf.mjs";
import { i as DialogTitle, n as DialogContent, t as Dialog } from "./dialog-zUw3eso-.mjs";
import { n as TechName } from "./tech-select-BqrrlfqA.mjs";
import { t as ExportButton } from "./export-dialog-BGDRoctb.mjs";
import { n as parseMachinesJson, r as serializeMachines, t as mergeMachineSpecs } from "./machines-CQiZYEgz.mjs";
import { i as EquipmentMultiCombo, n as CustomerCombo } from "./directory-fields-BvcLee-k.mjs";
import { n as InstallSheet, o as RecipeChip, r as MachineFields, s as RecipeEditorSheet } from "./entity-sheets-ChIYwImr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/installs-MHCm0QTJ.js
var installs_MHCm0QTJ_exports = /* @__PURE__ */ __exportAll({ component: () => Page });
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Page() {
	const { open } = Route$13.useSearch();
	useQueryClient();
	const data = useQuery({
		queryKey: ["installs"],
		queryFn: () => listInstalls()
	});
	const recs = useQuery({
		queryKey: ["recipes"],
		queryFn: () => listRecipes()
	});
	const assets = useQuery({
		queryKey: ["assets"],
		queryFn: () => listAssets()
	});
	const customers = useQuery({
		queryKey: ["customers"],
		queryFn: () => listCustomers()
	});
	const directoryEquip = useQuery({
		queryKey: ["directory", "equipment"],
		queryFn: () => listDirectory({ data: { kind: "equipment" } })
	});
	const [q, setQ] = (0, import_react.useState)("");
	const { filterMine, matchMine, board } = useMyView();
	const [repFilter, setRepFilter] = (0, import_react.useState)("");
	const [akOnly, setAkOnly] = (0, import_react.useState)(false);
	const [view, setView] = (0, import_react.useState)(board ? "board" : "queue");
	const [selected, setSelected] = useOpenRecord(open);
	const [create, setCreate] = (0, import_react.useState)(false);
	const [recipeDraft, setRecipeDraft] = (0, import_react.useState)(null);
	const [sort, setSort] = useDeskSort("installs", "date-asc");
	const catalog = (0, import_react.useMemo)(() => catalogModels([
		...(directoryEquip.data ?? []).map((e) => e.name),
		...(assets.data ?? []).filter((a) => a.kind === "equip").map((a) => a.model),
		...(recs.data ?? []).map((r) => r.equipmentModel)
	]), [
		assets.data,
		recs.data,
		directoryEquip.data
	]);
	const rows = (0, import_react.useMemo)(() => {
		let list = data.data ?? [];
		if (view === "queue") list = list.filter((i) => !i.complete && i.equipStatus !== "Installed");
		if (filterMine) list = list.filter((i) => matchMine(i.accountRep, i.technician) || i.aviKatz);
		if (repFilter === "__none__") list = list.filter((i) => i.noRep);
		else if (repFilter) list = list.filter((i) => sameRep(i.accountRep, repFilter));
		if (akOnly) list = list.filter((i) => i.aviKatz);
		const needle = q.trim().toLowerCase();
		if (needle) list = list.filter((i) => [
			i.customer,
			i.equipment,
			i.wo,
			i.technician,
			i.serial,
			i.powerVoltage,
			...(i.machines ?? []).flatMap((m) => [
				m.equipment,
				m.serial,
				m.powerVoltage
			])
		].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle)));
		return sortDesk(list, sort, {
			date: (i) => i.installDate ?? i.received,
			name: (i) => i.customer,
			equipment: (i) => i.machines?.length || equipmentCount(i.equipment),
			status: (i) => i.equipStatus,
			flagRank: (i) => i.flag?.rank ?? 99,
			tech: (i) => i.technician
		});
	}, [
		data.data,
		q,
		view,
		sort,
		filterMine,
		matchMine,
		repFilter,
		akOnly
	]);
	const selectedRow = (data.data ?? []).find((i) => i.id === selected) ?? null;
	const allInstalls = data.data ?? [];
	const atRisk = allInstalls.filter((i) => i.flag).length;
	const recipes = recs.data ?? [];
	const readyN = allInstalls.filter((i) => !i.complete && i.equipStatus === "Ready").length;
	const notReadyN = allInstalls.filter((i) => !i.complete && i.equipStatus !== "Ready" && i.equipStatus !== "Installed").length;
	const installedN = allInstalls.filter((i) => i.complete || i.equipStatus === "Installed").length;
	const week = weekBounds(todayChicago());
	const openInstalls = allInstalls.filter((i) => !i.complete && i.equipStatus !== "Installed");
	const readyOpen = openInstalls.filter((i) => i.equipStatus === "Ready");
	const notReadyOpen = openInstalls.filter((i) => i.equipStatus !== "Ready");
	const datedThisWeek = (list) => list.filter((i) => i.installDate && i.installDate >= week.start && i.installDate <= week.end).length;
	const noDate = (list) => list.filter((i) => !i.installDate).length;
	const readyByEquip = tally(allInstalls.filter((i) => !i.complete && i.equipStatus === "Ready").flatMap((i) => {
		const listed = listedEquipment((i.machines ?? []).map((m) => m.equipment).join("\n") || i.equipment, catalog);
		return listed.length ? listed : [matchModel(i.equipment || "Unspecified", catalog)];
	}), (n) => n);
	const statusMix = [
		{
			name: "Not Ready",
			count: notReadyN
		},
		{
			name: "Ready",
			count: readyN
		},
		{
			name: "Installed",
			count: installedN
		}
	].filter((s) => s.count > 0);
	function openRecipe(d) {
		setSelected(null);
		setRecipeDraft(d);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-medium tracking-tight",
				children: "Install clock"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-xl text-sm text-muted-foreground",
				children: "Prep queue for every account not yet installed. Each machine on the row carries its own recipe — linked to that customer, shared with techs and sales."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MyViewBar, {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExportButton, {
						defaultType: "installs",
						label: "Export readiness"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						onClick: () => setCreate(true),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "New install"]
					})
				]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-4 rounded-xl border border-border bg-card px-4 py-3",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "flex items-start gap-2 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "mt-0.5 size-4 shrink-0 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-medium",
					children: "New install requests — "
				}), "There is a 2-week lead-time to allow time to prep equipment, including in-between service calls and PMs."] })]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-3 text-sm text-muted-foreground",
			children: [atRisk, " at risk this week or next."]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-1 text-sm",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-medium",
					children: notReadyN
				}),
				" not ready",
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "text-muted-foreground",
					children: [
						" ",
						"(",
						datedThisWeek(notReadyOpen),
						" this week · ",
						noDate(notReadyOpen),
						" no date)"
					]
				}),
				" · ",
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-medium",
					children: readyN
				}),
				" ready",
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "text-muted-foreground",
					children: [
						" ",
						"(",
						datedThisWeek(readyOpen),
						" this week · ",
						noDate(readyOpen),
						" no date)"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-muted-foreground",
					children: " — weekly team update"
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 grid min-w-0 grid-cols-3 gap-2 sm:gap-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Ready",
					value: readyN,
					hint: "Cleared to go on site",
					breakdown: readyByEquip
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Not ready",
					value: notReadyN,
					hint: "Still in prep"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Installed",
					value: installedN
				})
			]
		}),
		statusMix.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-4 grid min-w-0 gap-4 lg:grid-cols-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartCard, {
				title: "Board mix",
				lede: "Every install, including completed.",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusDonut, {
					data: statusMix,
					unit: "installs"
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartCard, {
				title: "Ready machines",
				lede: "What’s actually cleared — one bar per model.",
				children: readyByEquip.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleBars, {
					data: readyByEquip.slice(0, 8).map((r) => ({
						model: r.name,
						count: r.count
					})),
					xKey: "model",
					yKey: "count",
					yLabel: "Machines",
					horizontal: true
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "Nothing marked Ready."
				})
			})]
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 flex flex-wrap gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => setView("queue"),
					className: `h-9 rounded-full px-3 text-sm font-medium ${view === "queue" ? "bg-ink text-ink-foreground" : "bg-secondary"}`,
					children: [
						"Queue (",
						(data.data ?? []).filter((i) => !i.complete && i.equipStatus !== "Installed").length,
						")"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setView("board"),
					className: `h-9 rounded-full px-3 text-sm font-medium ${view === "board" ? "bg-ink text-ink-foreground" : "bg-secondary"}`,
					children: "Board"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setView("all"),
					className: `h-9 rounded-full px-3 text-sm font-medium ${view === "all" ? "bg-ink text-ink-foreground" : "bg-secondary"}`,
					children: "All installs"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: q,
					onChange: (e) => setQ(e.target.value),
					placeholder: "Filter…",
					className: "max-w-xs"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RepFilter, {
					value: repFilter,
					onChange: setRepFilter,
					extraNames: (data.data ?? []).map((i) => i.accountRep)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "flex h-9 items-center gap-2 rounded-full bg-secondary px-3 text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "checkbox",
						className: "size-4 accent-primary",
						checked: akOnly,
						onChange: (e) => setAkOnly(e.target.checked)
					}), "AK"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
					value: sort,
					onChange: setSort,
					options: SORT_LIST
				})
			]
		}),
		view === "board" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-4 grid gap-3 md:grid-cols-3",
			children: [
				"Not Ready",
				"Ready",
				"Installed"
			].map((col) => {
				const colRows = rows.filter((i) => col === "Installed" ? i.equipStatus === "Installed" || i.complete : (i.equipStatus ?? "Not Ready") === col && !i.complete);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-xl border border-border bg-card p-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "px-1 text-[11px] tracking-wide text-muted-foreground uppercase",
						children: [
							col,
							" · ",
							colRows.length
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
						className: "mt-2 space-y-2",
						children: [colRows.map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InstallCard, {
							install: i,
							catalog,
							recipes,
							onOpen: () => setSelected(i.id),
							onRecipe: openRecipe
						}) }, i.id)), colRows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "px-1 py-4 text-xs text-muted-foreground",
							children: "Empty"
						}) : null]
					})]
				}, col);
			})
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 overflow-hidden rounded-xl border border-border bg-card",
			children: [rows.map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InstallRow, {
				install: i,
				catalog,
				recipes,
				onOpen: () => setSelected(i.id),
				onRecipe: openRecipe
			}, i.id)), rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-4 py-8 text-sm text-muted-foreground",
				children: "Queue is empty."
			}) : null]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InstallSheet, {
			row: selectedRow,
			onClose: () => setSelected(null),
			onOpenRelated: (id) => setSelected(id)
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecipeEditorSheet, {
			draft: recipeDraft,
			models: catalog,
			customers: customers.data ?? [],
			onClose: () => setRecipeDraft(null)
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NewInstallDialog, {
			open: create,
			existing: allInstalls,
			onOpenChange: setCreate,
			onCreated: (id) => setSelected(id),
			onOpenExisting: (id) => {
				setCreate(false);
				setSelected(id);
			}
		})
	] });
}
function sameAccount(name, rows, exceptId) {
	const n = name.trim().toLowerCase();
	if (!n) return [];
	return rows.filter((i) => i.customer.trim().toLowerCase() === n && i.id !== exceptId);
}
function NewInstallDialog({ open, existing, onOpenChange, onCreated, onOpenExisting }) {
	const qc = useQueryClient();
	const [customer, setCustomer] = (0, import_react.useState)("");
	const [equipment, setEquipment] = (0, import_react.useState)([]);
	const [specs, setSpecs] = (0, import_react.useState)([]);
	const [pending, setPending] = (0, import_react.useState)(false);
	const matches = sameAccount(customer, existing);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange: (v) => {
			onOpenChange(v);
			if (!v) {
				setCustomer("");
				setEquipment([]);
				setSpecs([]);
			}
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "max-w-2xl",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "New install" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-3 rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "flex items-start gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "mt-0.5 size-4 shrink-0 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "There is a 2-week lead-time to allow time to prep equipment, including in-between service calls and PMs." })]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					className: "mt-4 space-y-3",
					onSubmit: async (e) => {
						e.preventDefault();
						if (!customer.trim()) return;
						setPending(true);
						try {
							const packed = serializeMachines(specs.length ? specs : mergeMachineSpecs(equipment, specs));
							const row = await createInstall({ data: {
								customer: customer.trim(),
								equipment: packed.equipment ?? void 0,
								serial: packed.serial ?? void 0,
								powerVoltage: packed.powerVoltage ?? void 0,
								machines: packed.machines
							} });
							qc.invalidateQueries({ queryKey: ["installs"] });
							qc.invalidateQueries({ queryKey: ["customers"] });
							if (row.duplicateOf) toast.success("Install added — flagged as a possible duplicate so you can compare.");
							else toast.success("Install added");
							onOpenChange(false);
							onCreated(row.id);
						} catch (err) {
							toast.error(err instanceof Error ? err.message : "Failed");
						} finally {
							setPending(false);
						}
					},
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-3 sm:grid-cols-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerCombo, {
								value: customer,
								onChange: (v) => {
									try {
										setCustomer(v);
									} catch (err) {
										toast.error(err instanceof Error ? err.message : "Could not set customer");
									}
								},
								required: true
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EquipmentMultiCombo, {
								values: equipment,
								onChange: (next) => {
									setEquipment(next);
									setSpecs(mergeMachineSpecs(next, specs));
								},
								placeholder: "Search the full equipment list…"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "-mt-1 text-xs text-muted-foreground",
							children: "Open the equipment field to scroll the full list, or type a model and add it if it isn’t there."
						}),
						matches.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "font-medium text-warning",
									children: [
										"This account already has ",
										matches.length === 1 ? "an install request" : `${matches.length} install requests`,
										"."
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-xs text-muted-foreground",
									children: "Open the existing one if this is a duplicate, or create a new request — we’ll flag it so you can compare."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
									className: "mt-2 space-y-1",
									children: matches.slice(0, 4).map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										className: "text-left text-sm hover:underline",
										onClick: () => onOpenExisting(i.id),
										children: [
											i.equipStatus ?? "Open",
											" · ",
											formatShortDate(i.installDate ?? i.received),
											" · ",
											i.equipment || "No equipment",
											i.complete ? " (installed)" : ""
										]
									}) }, i.id))
								}),
								matches.length > 4 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-1 text-xs text-muted-foreground",
									children: [
										"+",
										matches.length - 4,
										" more"
									]
								}) : null
							]
						}) : null,
						customer && specs.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MachineFields, {
							specs,
							onChange: setSpecs
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex justify-end",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "submit",
								disabled: pending || !customer.trim(),
								children: matches.length ? "Create new request" : "Create"
							})
						})
					]
				})
			]
		})
	});
}
function useRemoveEquip(install, catalog) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (label) => {
			const nextEquip = dropEquipment(install.equipment, label, catalog);
			const names = listedEquipment(nextEquip, catalog);
			const packed = serializeMachines(mergeMachineSpecs(names, install.machines ?? []));
			return updateInstall({ data: {
				id: install.id,
				equipment: packed.equipment,
				serial: packed.serial,
				powerVoltage: packed.powerVoltage,
				machines: packed.machines
			} });
		},
		onMutate: async (label) => {
			await qc.cancelQueries({ queryKey: ["installs"] });
			const prev = qc.getQueryData(["installs"]);
			const nextEquip = dropEquipment(install.equipment, label, catalog);
			const names = listedEquipment(nextEquip, catalog);
			const packed = serializeMachines(mergeMachineSpecs(names, install.machines ?? []));
			qc.setQueryData(["installs"], (old) => (old ?? []).map((r) => r.id === install.id ? {
				...r,
				equipment: packed.equipment,
				serial: packed.serial,
				powerVoltage: packed.powerVoltage,
				machines: packed.machines ? parseMachinesJson(packed.machines) : []
			} : r));
			return { prev };
		},
		onError: (e, _label, ctx) => {
			if (ctx?.prev) qc.setQueryData(["installs"], ctx.prev);
			toast.error(e instanceof Error ? e.message : "Could not remove");
		},
		onSettled: () => {
			qc.invalidateQueries({ queryKey: ["installs"] });
		}
	});
}
function useArchiveInstall(install) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => archiveInstall({ data: { id: install.id } }),
		onSuccess: () => {
			toast.success(`Removed ${install.customer} from the list`);
			qc.invalidateQueries({ queryKey: ["installs"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["customers"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove")
	});
}
function DuplicateBadge({ install }) {
	if (!install.duplicateOf) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		variant: "warn",
		children: "Possible duplicate"
	});
}
function RemoveInstallButton({ install }) {
	const remove = useArchiveInstall(install);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
		type: "button",
		size: "sm",
		variant: "outline",
		className: "shrink-0",
		"aria-label": `Remove ${install.customer} from the list`,
		"data-testid": "archive-row",
		disabled: remove.isPending,
		onClick: (e) => {
			e.stopPropagation();
			if (window.confirm(`Remove “${install.customer}” from the install list?`)) remove.mutate();
		},
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "hidden sm:inline",
			children: "Remove"
		})]
	});
}
function InstallRow({ install: i, catalog, recipes, onOpen, onRecipe }) {
	const pieces = piecesForInstall(i.equipment, i.customer, i.id, catalog, recipes);
	const remove = useRemoveEquip(i, catalog);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("article", {
		className: "border-b border-border px-3 py-3 last:border-b-0 md:px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-start gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-1 gap-1 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-center",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: onOpen,
								className: "text-left tabular text-sm font-medium hover:underline",
								children: i.daysOut == null ? "needs date" : i.daysOut < 0 ? `${i.daysOut}d` : i.daysOut === 0 ? "today" : `${i.daysOut}d`
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: onOpen,
								className: "min-w-0 truncate text-left font-medium hover:underline",
								children: [
									i.customer,
									" ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AkBadge, {
										on: i.aviKatz,
										className: "ml-1 align-middle"
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap gap-1",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlagBadge, { flag: i.flag }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: i.equipStatus }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DuplicateBadge, { install: i })
								]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: onOpen,
						className: "mt-0.5 text-left text-sm text-muted-foreground hover:text-foreground sm:pl-20",
						children: [
							formatShortDate(i.installDate),
							" · ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TechName, { name: i.technician }),
							" · ",
							i.accountRep ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RepName, { name: i.accountRep }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NoRepFlag, { show: true })
						]
					}),
					machineNotes(i),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-2 flex flex-wrap gap-1.5 sm:pl-20",
						children: pieces.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-xs text-muted-foreground",
							children: i.equipment || "No equipment listed"
						}) : pieces.map((p, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecipeChip, {
							piece: p,
							customer: i.customer,
							installId: i.id,
							recipes,
							onOpen: onRecipe,
							onRemove: () => remove.mutate(p.label)
						}, `${p.model}-${p.label}-${idx}`))
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RemoveInstallButton, { install: i })]
		})
	});
}
function InstallCard({ install: i, catalog, recipes, onOpen, onRecipe }) {
	const pieces = piecesForInstall(i.equipment, i.customer, i.id, catalog, recipes);
	const remove = useRemoveEquip(i, catalog);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg border border-border bg-background px-3 py-2.5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: onOpen,
					className: "min-w-0 flex-1 text-left hover:underline",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "font-medium",
						children: [
							i.customer,
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AkBadge, {
								on: i.aviKatz,
								className: "ml-1 align-middle"
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-0.5 text-xs text-muted-foreground",
						children: formatShortDate(i.installDate)
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RemoveInstallButton, { install: i })]
			}),
			machineNotes(i, false),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-1 flex flex-wrap gap-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlagBadge, { flag: i.flag }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DuplicateBadge, { install: i }),
					i.noRep ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NoRepFlag, { show: true }) : null
				]
			}),
			pieces.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-2 flex flex-wrap gap-1.5",
				children: pieces.map((p, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecipeChip, {
					piece: p,
					customer: i.customer,
					installId: i.id,
					recipes,
					onOpen: onRecipe,
					onRemove: () => remove.mutate(p.label)
				}, `${p.model}-${p.label}-${idx}`))
			}) : i.equipment ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-muted-foreground",
				children: i.equipment
			}) : null
		]
	});
}
function machineNotes(i, indent = true) {
	const rows = (i.machines ?? []).filter((m) => m.serial || m.powerVoltage);
	if (!rows.length && (i.serial || i.powerVoltage)) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: `mt-1 text-xs text-muted-foreground ${indent ? "md:pl-20" : ""}`,
		children: [i.serial ? `SN ${i.serial}` : null, i.powerVoltage].filter(Boolean).join(" · ")
	});
	if (!rows.length) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: `mt-1 space-y-0.5 text-xs text-muted-foreground ${indent ? "md:pl-20" : ""}`,
		children: rows.map((m, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-medium text-foreground/80",
				children: m.equipment
			}),
			m.serial ? ` · SN ${m.serial}` : "",
			m.powerVoltage ? ` · ${m.powerVoltage}` : ""
		] }, `${m.equipment}-${idx}`))
	});
}
//#endregion
export { Page as component, installs_MHCm0QTJ_exports as t };
