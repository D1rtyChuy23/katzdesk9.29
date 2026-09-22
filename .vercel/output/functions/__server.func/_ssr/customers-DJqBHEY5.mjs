import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { b as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { i as CLOSED_PM, r as CLOSED_CALL } from "./lookups-BkjR5sto.mjs";
import { l as money, o as formatShortDate } from "./clock-CSFAgASg.mjs";
import { o as getMyAccess } from "./access-3Tz151bB.mjs";
import { S as Pencil, V as ChevronRight, _ as Search, b as Plus, u as Trash2 } from "../_libs/lucide-react.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { _ as cn, g as useMyView, p as Route$15, x as useOpenRecord } from "./router-1NWxggZt.mjs";
import { D as listDirectory, F as renameCustomer, M as listRecipes, U as updateCustomerAccount, g as getCustomerHistory, i as archiveDirectoryEntry, l as copyRecipe, n as addDirectoryEntry, w as listCustomerRecords } from "./api-CgwyWugK.mjs";
import { t as Skeleton } from "./separator-AdNvdRLl.mjs";
import { d as sortDesk, l as SortSelect, p as useDeskSort, t as SORT_ALPHA } from "./sort-1yS_DCzE.mjs";
import { i as UrgencyBadge, n as FlagBadge, r as StatusBadge } from "./flag-badge-jup2uYzS.mjs";
import { n as Button, r as Input } from "./input-COYCsX_T.mjs";
import { n as NoRepFlag, t as AkBadge } from "./ak-badge-m29_U4_Z.mjs";
import { i as previewSetting } from "./recipe-fields-DqZtnvK8.mjs";
import { n as RepName, r as RepSelect } from "./rep-select-BQ75vNDf.mjs";
import { a as SheetTitle, i as SheetHeader, n as SheetBody, r as SheetContent, t as Sheet } from "./sheet-CdZCIXqJ.mjs";
import { a as RenameDialog } from "./directory-fields-BvcLee-k.mjs";
import { r as ProviderDispatchBlock } from "./provider-dispatch-CwfIUm28.mjs";
import { t as JobSheet } from "./job-sheet-YEm7ew2R.mjs";
import { a as PmSheet, n as InstallSheet, s as RecipeEditorSheet, t as DealSheet } from "./entity-sheets-ChIYwImr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/customers-DJqBHEY5.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var KIND_LABEL = {
	service: "Service",
	tlc: "TLC",
	pm: "PM",
	install: "Install",
	deal: "Pipeline",
	recipe: "Recipe"
};
var FILTERS = [
	{
		id: "all",
		label: "All"
	},
	{
		id: "service",
		label: "Service"
	},
	{
		id: "tlc",
		label: "TLC"
	},
	{
		id: "pm",
		label: "PMs"
	},
	{
		id: "install",
		label: "Installs"
	},
	{
		id: "deal",
		label: "Pipeline"
	}
];
function jobItem(j) {
	return {
		key: `${j.kind}-${j.id}`,
		kind: j.kind,
		id: j.id,
		title: j.callId,
		subtitle: [j.wo, j.issue].filter(Boolean).join(" · "),
		status: j.status,
		date: j.received ?? j.scheduled,
		technician: j.technician,
		equipment: j.equipment,
		flag: j.flag,
		urgency: j.urgency
	};
}
function pmItem(p) {
	return {
		key: `pm-${p.id}`,
		kind: "pm",
		id: p.id,
		title: p.style || "Preventative maintenance",
		subtitle: p.equipment ?? "",
		status: p.status,
		date: p.projected ?? p.received,
		technician: p.technician,
		equipment: p.equipment,
		flag: p.flag
	};
}
function installItem(i) {
	return {
		key: `install-${i.id}`,
		kind: "install",
		id: i.id,
		title: i.wo || "Install",
		subtitle: i.equipment ?? "",
		status: i.equipStatus,
		date: i.installDate ?? i.received,
		technician: i.technician,
		equipment: i.equipment,
		flag: i.flag
	};
}
function dealItem(d) {
	return {
		key: `deal-${d.id}`,
		kind: "deal",
		id: d.id,
		title: d.equipment || "Deal",
		subtitle: [d.producer, d.amount != null ? money(d.amount) : null].filter(Boolean).join(" · "),
		status: d.completion,
		date: d.dateOfDeal,
		technician: d.producer,
		equipment: d.equipment,
		flag: null
	};
}
function stamp(iso) {
	if (!iso) return 0;
	const t = Date.parse(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
	return Number.isFinite(t) ? t : 0;
}
function CustomerHistorySheet({ customerId, onClose }) {
	const navigate = useNavigate();
	const qc = useQueryClient();
	const history = useQuery({
		queryKey: ["customer-history", customerId],
		queryFn: () => getCustomerHistory({ data: { id: customerId } }),
		enabled: customerId != null
	});
	const directoryEquip = useQuery({
		queryKey: ["directory", "equipment"],
		queryFn: () => listDirectory({ data: { kind: "equipment" } }),
		enabled: customerId != null
	});
	const houseRecipes = useQuery({
		queryKey: ["recipes"],
		queryFn: () => listRecipes(),
		enabled: customerId != null
	});
	const [filter, setFilter] = (0, import_react.useState)("all");
	const [q, setQ] = (0, import_react.useState)("");
	const [selectedKey, setSelectedKey] = (0, import_react.useState)(null);
	const [reviewing, setReviewing] = (0, import_react.useState)(false);
	const [recipeDraft, setRecipeDraft] = (0, import_react.useState)(null);
	const [editing, setEditing] = (0, import_react.useState)(false);
	const me = useQuery({
		queryKey: ["access", "me"],
		queryFn: () => getMyAccess(),
		enabled: customerId != null
	});
	(0, import_react.useEffect)(() => {
		setSelectedKey(null);
		setReviewing(false);
		setRecipeDraft(null);
		setFilter("all");
		setQ("");
		setEditing(false);
	}, [customerId, history.data?.name]);
	const rename = useMutation({
		mutationFn: (n) => renameCustomer({ data: {
			id: customerId,
			name: n
		} }),
		onSuccess: (row) => {
			toast.success(row.merged ? `Merged into “${row.name}”` : `Renamed to “${row.name}”`);
			setEditing(false);
			qc.invalidateQueries({ queryKey: ["customers"] });
			qc.invalidateQueries({ queryKey: ["customer-history"] });
			qc.invalidateQueries({ queryKey: ["directory"] });
			qc.invalidateQueries({ queryKey: ["jobs"] });
			qc.invalidateQueries({ queryKey: ["pms"] });
			qc.invalidateQueries({ queryKey: ["installs"] });
			qc.invalidateQueries({ queryKey: ["deals"] });
			qc.invalidateQueries({ queryKey: ["recipes"] });
			qc.invalidateQueries({ queryKey: ["network"] });
			if (row.merged || row.id !== customerId) navigate({
				to: "/customers",
				search: { open: row.id },
				replace: true
			});
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save name")
	});
	const data = history.data;
	const items = (0, import_react.useMemo)(() => {
		if (!data) return [];
		const all = [
			...data.jobs.map(jobItem),
			...data.pms.map(pmItem),
			...data.installs.map(installItem),
			...data.deals.map(dealItem)
		];
		all.sort((a, b) => stamp(b.date) - stamp(a.date) || b.id - a.id);
		return all;
	}, [data]);
	const counts = (0, import_react.useMemo)(() => {
		const c = {
			all: items.length,
			service: 0,
			tlc: 0,
			pm: 0,
			install: 0,
			deal: 0
		};
		for (const it of items) {
			if (it.kind === "recipe") continue;
			c[it.kind] += 1;
		}
		return c;
	}, [items]);
	const visible = (0, import_react.useMemo)(() => {
		const needle = q.trim().toLowerCase();
		return items.filter((it) => {
			if (filter !== "all" && it.kind !== filter) return false;
			if (!needle) return true;
			return [
				it.title,
				it.subtitle,
				it.equipment,
				it.technician,
				it.status
			].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle));
		});
	}, [
		items,
		filter,
		q
	]);
	const selected = items.find((it) => it.key === selectedKey) ?? null;
	const selectedJob = selected?.kind === "service" || selected?.kind === "tlc" ? data?.jobs.find((j) => j.id === selected.id) ?? null : null;
	const selectedPm = selected?.kind === "pm" ? data?.pms.find((p) => p.id === selected.id) ?? null : null;
	const selectedInstall = selected?.kind === "install" ? data?.installs.find((i) => i.id === selected.id) ?? null : null;
	const selectedDeal = selected?.kind === "deal" ? data?.deals.find((d) => d.id === selected.id) ?? null : null;
	const canRename = !!me.data?.isAdmin;
	const pending = (0, import_react.useMemo)(() => items.filter((it) => {
		if (it.kind === "tlc" || it.kind === "service") {
			const j = data?.jobs.find((row) => row.id === it.id);
			return !!j && !j.done && !CLOSED_CALL.has(j.status);
		}
		if (it.kind === "pm") {
			const p = data?.pms.find((row) => row.id === it.id);
			return !!p && !p.done && !CLOSED_PM.has(p.status);
		}
		if (it.kind === "install") {
			const i = data?.installs.find((row) => row.id === it.id);
			return !!i && !i.complete && i.equipStatus !== "Installed";
		}
		return false;
	}), [items, data]);
	const pendingTlcs = pending.filter((it) => it.kind === "tlc");
	const pendingPms = pending.filter((it) => it.kind === "pm");
	const pendingFocus = [...pendingTlcs, ...pendingPms];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
			open: customerId != null,
			onOpenChange: (o) => !o && onClose(),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetContent, {
				className: "sm:max-w-lg",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs tracking-wide text-muted-foreground uppercase",
					children: "Customer"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-start justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetTitle, {
						className: "flex items-center gap-2",
						children: [data?.name ?? "Account", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AkBadge, { on: data?.aviKatz })]
					}), canRename && data ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						type: "button",
						size: "sm",
						variant: "outline",
						onClick: () => setEditing(true),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "size-3.5" }), "Edit"]
					}) : null]
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetBody, { children: history.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "p-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-8 w-2/3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "mt-3 h-24 w-full" })]
				}) : data ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted-foreground",
							children: canRename ? "Edit the name to move every call, install, PM, deal, recipe, and network link onto it." : "Ask an admin to rename this account — history follows the new name."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccountMarksForm, {
							id: data.id,
							aviKatz: data.aviKatz,
							accountRep: data.accountRep
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-4",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProviderDispatchBlock, {
								customer: data.name,
								assignable: true
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative mt-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								value: q,
								onChange: (e) => setQ(e.target.value),
								placeholder: "Search this account…",
								className: "pl-9",
								"aria-label": "Search history"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-3 flex flex-wrap gap-1.5",
							children: FILTERS.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => setFilter(f.id),
								className: cn("rounded-full px-3 py-1 text-xs", filter === f.id ? "bg-ink text-ink-foreground" : "bg-muted text-muted-foreground"),
								children: [f.label, counts[f.id] ? ` ${counts[f.id]}` : ""]
							}, f.id))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-4 text-xs text-muted-foreground",
							children: "Select a call or record to review."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: "mt-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase",
								children: "Pending TLC & PMs"
							}), pendingFocus.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border",
								children: pendingFocus.map((it) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HistoryRow, {
									item: it,
									onOpen: () => {
										setSelectedKey(it.key);
										setReviewing(true);
									}
								}, `pending-${it.key}`))
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-sm text-muted-foreground",
								children: "No open TLCs or PMs on this account."
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mt-5 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase",
							children: "Account history"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border",
							children: visible.map((it) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HistoryRow, {
								item: it,
								onOpen: () => {
									setSelectedKey(it.key);
									setReviewing(true);
								}
							}, it.key))
						}),
						!visible.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 text-sm text-muted-foreground",
							children: "Nothing on this account matches."
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerRecipes, {
							customer: data.name,
							recipes: data.recipes,
							house: houseRecipes.data ?? [],
							models: (directoryEquip.data ?? []).map((e) => e.name),
							onOpen: (d) => setRecipeDraft(d)
						})
					]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "p-5 text-sm text-muted-foreground",
					children: "Account not found."
				}) })]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(JobSheet, {
			id: reviewing && selectedJob ? selectedJob.id : null,
			onClose: () => setReviewing(false)
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PmSheet, {
			pm: reviewing ? selectedPm : null,
			onClose: () => setReviewing(false)
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InstallSheet, {
			row: reviewing ? selectedInstall : null,
			onClose: () => setReviewing(false)
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DealSheet, {
			deal: reviewing ? selectedDeal : null,
			onClose: () => setReviewing(false)
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecipeEditorSheet, {
			draft: recipeDraft,
			models: (directoryEquip.data ?? []).map((e) => e.name),
			customers: data ? [data.name] : [],
			onClose: () => setRecipeDraft(null)
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RenameDialog, {
			open: editing,
			title: "Rename customer",
			noun: "customer",
			current: data?.name ?? "",
			pending: rename.isPending,
			onClose: () => setEditing(false),
			onSave: (n) => rename.mutate(n)
		})
	] });
}
function HistoryRow({ item, onOpen }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick: onOpen,
		className: "flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-muted/60",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "mt-0.5 w-16 shrink-0 text-[11px] font-medium tracking-wide text-muted-foreground uppercase",
				children: KIND_LABEL[item.kind]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "min-w-0 flex-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "block font-medium",
					children: item.title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "block text-xs text-muted-foreground",
					children: [
						item.subtitle,
						formatShortDate(item.date),
						item.technician
					].filter(Boolean).join(" · ")
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "flex shrink-0 flex-col items-end gap-1",
				children: [
					item.urgency ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UrgencyBadge, { urgency: item.urgency }) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: item.status }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlagBadge, { flag: item.flag })
				]
			})
		]
	}) });
}
function CustomerRecipes({ customer, recipes, house, models, onOpen }) {
	const qc = useQueryClient();
	const copy = useMutation({
		mutationFn: (sourceId) => copyRecipe({ data: {
			sourceId,
			customer
		} }),
		onSuccess: () => {
			toast.success("Copied onto this account");
			qc.invalidateQueries({ queryKey: ["customer-history"] });
			qc.invalidateQueries({ queryKey: ["recipes"] });
			qc.invalidateQueries({ queryKey: ["customers"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not copy")
	});
	const templates = house.filter((r) => r.isTemplate || !r.customer);
	const others = house.filter((r) => r.customer && r.customer.toLowerCase() !== customer.toLowerCase());
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "mt-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase",
					children: "Recipes"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					type: "button",
					size: "sm",
					variant: "outline",
					onClick: () => onOpen({
						recipe: null,
						customer,
						equipmentModel: models[0] ?? "",
						installId: null,
						copiedFrom: null,
						lockCustomer: true
					}),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), "Add"]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border",
				children: recipes.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/60",
					onClick: () => onOpen({
						recipe: r,
						customer,
						equipmentModel: r.equipmentModel,
						installId: r.installId,
						copiedFrom: r.copiedFrom,
						lockCustomer: true
					}),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block font-medium",
						children: r.equipmentModel
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block text-xs text-muted-foreground",
						children: previewSetting(r) || r.notes || "No settings yet"
					})] })
				}) }, r.id))
			}),
			!recipes.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted-foreground",
				children: "No recipes on this account yet."
			}) : null,
			templates.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground",
					children: "Copy a house template"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-1 flex flex-wrap gap-1.5",
					children: templates.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "rounded-full border border-border px-2.5 py-1 text-xs hover:bg-muted",
						disabled: copy.isPending,
						onClick: () => copy.mutate(r.id),
						children: r.equipmentModel
					}) }, r.id))
				})]
			}) : null,
			others.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground",
					children: "Reuse from another account"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-1 flex flex-wrap gap-1.5",
					children: others.slice(0, 12).map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "rounded-full border border-border px-2.5 py-1 text-xs hover:bg-muted",
						disabled: copy.isPending,
						onClick: () => copy.mutate(r.id),
						children: [
							r.customer,
							" · ",
							r.equipmentModel
						]
					}) }, r.id))
				})]
			}) : null
		]
	});
}
function AccountMarksForm({ id, aviKatz, accountRep }) {
	const qc = useQueryClient();
	const save = useMutation({
		mutationFn: (d) => updateCustomerAccount({ data: {
			id,
			...d
		} }),
		onSuccess: () => {
			toast.success("Account updated");
			qc.invalidateQueries({ queryKey: ["customer-history"] });
			qc.invalidateQueries({ queryKey: ["customers"] });
			qc.invalidateQueries({ queryKey: ["installs"] });
			qc.invalidateQueries({ queryKey: ["deals"] });
			qc.invalidateQueries({ queryKey: ["jobs"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-4 grid gap-3 sm:grid-cols-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RepSelect, {
			label: "Rep",
			defaultValue: accountRep ?? "",
			onChange: (v) => save.mutate({ accountRep: v || null })
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
			className: "flex items-center gap-2 text-sm sm:mt-7",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "checkbox",
					className: "size-4 accent-primary",
					checked: aviKatz,
					onChange: (e) => save.mutate({ aviKatz: e.target.checked })
				}),
				"Avi Katz account (AK)",
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AkBadge, { on: aviKatz })
			]
		})]
	});
}
function Page() {
	const qc = useQueryClient();
	const navigate = useNavigate();
	const { open } = Route$15.useSearch();
	const [selected, setSelected] = useOpenRecord(open);
	const me = useQuery({
		queryKey: ["access", "me"],
		queryFn: () => getMyAccess()
	});
	const list = useQuery({
		queryKey: ["customers", "records"],
		queryFn: () => listCustomerRecords()
	});
	const [q, setQ] = (0, import_react.useState)("");
	const [name, setName] = (0, import_react.useState)("");
	const { filterMine, matchMine, role } = useMyView();
	const [sort, setSort] = useDeskSort("customers", "alpha-asc");
	const isAdmin = !!me.data?.isAdmin;
	const canAdd = isAdmin || me.data?.canAddCustomers !== false;
	const [renaming, setRenaming] = (0, import_react.useState)(null);
	const add = useMutation({
		mutationFn: (n) => addDirectoryEntry({ data: {
			kind: "customer",
			name: n
		} }),
		onSuccess: (row) => {
			toast.success(`Added ${row.name}`);
			setName("");
			qc.invalidateQueries({ queryKey: ["customers"] });
			qc.invalidateQueries({ queryKey: ["directory", "customer"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add")
	});
	const remove = useMutation({
		mutationFn: (d) => archiveDirectoryEntry({ data: {
			kind: "customer",
			id: d.id
		} }),
		onSuccess: (_ok, d) => {
			toast.success(`Removed “${d.name}”. Existing calls keep the name.`);
			qc.invalidateQueries({ queryKey: ["customers"] });
			qc.invalidateQueries({ queryKey: ["directory", "customer"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove")
	});
	const rename = useMutation({
		mutationFn: (d) => renameCustomer({ data: d }),
		onSuccess: (row) => {
			toast.success(row.merged ? `Merged into “${row.name}”` : `Renamed to “${row.name}”`);
			setRenaming(null);
			qc.invalidateQueries({ queryKey: ["customers"] });
			qc.invalidateQueries({ queryKey: ["directory"] });
			qc.invalidateQueries({ queryKey: ["jobs"] });
			qc.invalidateQueries({ queryKey: ["pms"] });
			qc.invalidateQueries({ queryKey: ["installs"] });
			qc.invalidateQueries({ queryKey: ["deals"] });
			qc.invalidateQueries({ queryKey: ["recipes"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["customer-history"] });
			qc.invalidateQueries({ queryKey: ["network"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not rename")
	});
	const needle = q.trim().toLowerCase();
	const rows = (0, import_react.useMemo)(() => {
		const raw = list.data ?? [];
		const filtered = needle ? raw.filter((c) => c.name.toLowerCase().includes(needle)) : raw;
		const scoped = filterMine && role === "sales" ? filtered.filter((c) => c.aviKatz || matchMine(c.accountRep)) : filtered;
		return sortDesk(scoped, sort, {
			name: (c) => c.name,
			date: () => ""
		});
	}, [
		list.data,
		needle,
		sort,
		filterMine,
		matchMine,
		role
	]);
	function onAdd(e) {
		e.preventDefault();
		const n = name.trim();
		if (!n) return;
		add.mutate(n);
	}
	function openCustomer(id) {
		setSelected(id);
		navigate({
			to: "/customers",
			search: { open: id },
			replace: true
		});
	}
	function closeCustomer() {
		setSelected(null);
		navigate({
			to: "/customers",
			search: {},
			replace: true
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "font-display text-3xl font-medium tracking-tight",
			children: "Customers"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-1 max-w-xl text-sm text-muted-foreground",
			children: ["Search the account list. Open a name to review every call, TLC, PM, install, and record on that account — then update the one you pick.", canAdd ? " Add a new name when the account isn’t on the list yet." : " Ask an admin if a name is missing."]
		})] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 flex flex-col gap-3 sm:flex-row sm:items-end",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative min-w-0 flex-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: q,
					onChange: (e) => setQ(e.target.value),
					placeholder: "Search customers…",
					className: "pl-9",
					"aria-label": "Search customers"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
				value: sort,
				onChange: setSort,
				options: [...SORT_ALPHA]
			})]
		}),
		canAdd ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			onSubmit: onAdd,
			className: "mt-4 flex flex-col gap-2 sm:flex-row",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				value: name,
				onChange: (e) => setName(e.target.value),
				placeholder: "Add a customer name",
				className: "min-w-0 flex-1",
				"aria-label": "New customer name"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				type: "submit",
				disabled: add.isPending || name.trim().length < 2,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "Add customer"]
			})]
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-4 text-xs text-muted-foreground",
			children: list.isLoading ? "Loading accounts…" : list.isError ? "Could not load accounts." : `${rows.length} ${rows.length === 1 ? "account" : "accounts"}${needle ? ` matching “${q.trim()}”` : ""}`
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
			className: "mt-2 overflow-hidden rounded-xl border border-border bg-card",
			children: [rows.map((c) => {
				const pending = pendingLine(c);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border px-2 py-1 last:border-b-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => openCustomer(c.id),
						className: "flex min-w-0 items-center gap-3 rounded-md px-2 py-2.5 text-left hover:bg-muted/60",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "truncate font-medium",
									children: [
										c.name,
										" ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AkBadge, {
											on: c.aviKatz,
											className: "ml-1 align-middle"
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "truncate text-xs text-muted-foreground",
									children: [
										c.accountRep ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RepName, { name: c.accountRep }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NoRepFlag, { show: true }),
										" · ",
										countLabel(c.calls, "call", "calls"),
										" · ",
										countLabel(c.tlcs, "TLC", "TLCs"),
										" · ",
										countLabel(c.pms, "PM", "PMs"),
										" · ",
										countLabel(c.installs, "install", "installs"),
										c.deals ? ` · ${countLabel(c.deals, "deal", "deals")}` : "",
										c.recipes ? ` · ${countLabel(c.recipes, "recipe", "recipes")}` : ""
									]
								}),
								pending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "truncate text-xs text-amber-800 dark:text-amber-300",
									children: pending
								}) : null
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4 shrink-0 text-muted-foreground" })]
					}), isAdmin ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex shrink-0 items-center gap-1 pr-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							type: "button",
							size: "sm",
							variant: "outline",
							"aria-label": `Rename ${c.name}`,
							onClick: () => setRenaming({
								id: c.id,
								name: c.name
							}),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "size-3.5" }), "Edit"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							type: "button",
							size: "sm",
							variant: "outline",
							disabled: remove.isPending,
							onClick: () => {
								if (window.confirm(`Remove “${c.name}” from the customer list?`)) remove.mutate({
									id: c.id,
									name: c.name
								});
							},
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), "Remove"]
						})]
					}) : null]
				}, c.id);
			}), list.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
				className: "px-4 py-8 text-sm text-muted-foreground",
				children: "Loading accounts…"
			}) : rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
				className: "px-4 py-8 text-sm text-muted-foreground",
				children: needle ? "No customers match that search." : "No customers in the list yet."
			}) : null]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerHistorySheet, {
			customerId: selected,
			onClose: closeCustomer
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RenameDialog, {
			open: !!renaming,
			title: "Rename customer",
			noun: "customer",
			current: renaming?.name ?? "",
			pending: rename.isPending,
			onClose: () => setRenaming(null),
			onSave: (n) => renaming && rename.mutate({
				id: renaming.id,
				name: n
			})
		})
	] });
}
function countLabel(n, one, many) {
	return `${n} ${n === 1 ? one : many}`;
}
function pendingLine(c) {
	const bits = [
		c.pendingCalls ? countLabel(c.pendingCalls, "call", "calls") : null,
		c.pendingTlcs ? countLabel(c.pendingTlcs, "TLC", "TLCs") : null,
		c.pendingPms ? countLabel(c.pendingPms, "PM", "PMs") : null,
		c.pendingInstalls ? countLabel(c.pendingInstalls, "install", "installs") : null
	].filter(Boolean);
	return bits.length ? `Pending: ${bits.join(" · ")}` : "";
}
//#endregion
export { Page as component };
