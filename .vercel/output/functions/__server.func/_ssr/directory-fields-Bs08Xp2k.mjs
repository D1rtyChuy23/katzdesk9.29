import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { _ as Check, g as ChevronsUpDown, l as Plus, t as X } from "../_libs/lucide-react.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { n as cn } from "./button-6ZsGYj3J.mjs";
import { C as listDirectory, a as addDirectoryEntry, n as PopoverContent, o as archiveDirectoryEntry, r as PopoverTrigger, t as Popover } from "./api-B23zb1CT.mjs";
import { n as Label, t as Input } from "./input-D-eo25vp.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/directory-fields-Bs08Xp2k.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function rank(q, name) {
	const n = name.toLowerCase();
	const s = q.toLowerCase();
	if (!s) return 1;
	if (n === s) return 100;
	if (n.startsWith(s)) return 80;
	const idx = n.indexOf(s);
	if (idx >= 0) return 60 - Math.min(idx, 40);
	return -1;
}
var pillClass = "flex min-h-11 w-full items-center gap-2 rounded-full border border-input bg-background px-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
function ComboField({ label, name, value, onChange, items, placeholder = "Search…", required, disabled, allowCreate = true, onCreate, onRemoveItem, emptyHint = "No matches." }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	const [q, setQ] = (0, import_react.useState)("");
	const query = open ? q : "";
	const matches = (0, import_react.useMemo)(() => {
		return items.map((item) => ({
			item,
			score: rank(query, item.name)
		})).filter((x) => x.score >= 0).sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name)).slice(0, 400).map((x) => x.item);
	}, [items, query]);
	const exact = items.some((i) => i.name.toLowerCase() === query.trim().toLowerCase());
	const canCreate = allowCreate && query.trim().length >= 2 && !exact;
	function pick(name) {
		onChange(name);
		setQ("");
		setOpen(false);
	}
	async function create() {
		const next = query.trim();
		if (!next) return;
		await onCreate?.(next);
		pick(next);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		label ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: label }) : null,
		name ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			type: "hidden",
			name,
			value,
			required
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Popover, {
			modal: false,
			open,
			onOpenChange: (v) => {
				setOpen(v);
				if (!v) setQ("");
			},
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PopoverTrigger, {
				asChild: true,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					disabled,
					className: cn(pillClass, label ? "mt-1" : "mt-0", !value && "text-muted-foreground"),
					"aria-label": label,
					title: value || void 0,
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "min-w-0 flex-1 truncate",
							children: value || placeholder
						}),
						value ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							role: "button",
							tabIndex: -1,
							className: "flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground",
							"aria-label": "Clear",
							onClick: (e) => {
								e.preventDefault();
								e.stopPropagation();
								onChange("");
							},
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" })
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronsUpDown, { className: "size-4 shrink-0 text-muted-foreground" })
					]
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PopoverContent, {
				className: "p-1",
				onOpenAutoFocus: (e) => e.preventDefault(),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: q,
					onChange: (e) => setQ(e.target.value),
					placeholder,
					className: "h-9",
					autoComplete: "off",
					autoFocus: true,
					onKeyDown: (e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							if (canCreate && !matches[0]) create();
							else if (matches[0]) pick(matches[0].name);
							else if (canCreate) create();
						}
					}
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "mt-1 max-h-80 overflow-y-auto py-1",
					role: "listbox",
					children: [
						matches.map((item) => {
							const selected = item.name === value;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex items-center",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									role: "option",
									"aria-selected": selected,
									className: cn("flex min-w-0 flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted", selected && "bg-muted"),
									onClick: () => pick(item.name),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: cn("size-3.5 shrink-0", selected ? "opacity-100" : "opacity-0") }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "min-w-0 truncate",
										children: item.name
									})]
								}), onRemoveItem ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "flex size-9 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-destructive",
									"aria-label": `Remove ${item.name} from the list`,
									title: "Remove from the master list",
									onClick: (e) => {
										e.preventDefault();
										e.stopPropagation();
										onRemoveItem(item);
									},
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" })
								}) : null]
							}, item.id);
						}),
						canCreate ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted",
							onClick: () => void create(),
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5 shrink-0" }),
								"Add “",
								query.trim(),
								"”"
							]
						}) }) : null,
						!matches.length && !canCreate ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "px-2 py-2 text-xs text-muted-foreground",
							children: emptyHint
						}) : null
					]
				})]
			})]
		})
	] });
}
function MultiComboField({ label, name, values, onChange, items, placeholder = "Add…", allowCreate = true, onCreate, onRemoveItem }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	const [q, setQ] = (0, import_react.useState)("");
	const query = open ? q : "";
	const matches = (0, import_react.useMemo)(() => {
		return items.map((item) => ({
			item,
			score: rank(query, item.name)
		})).filter((x) => x.score >= 0).sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name)).slice(0, 400).map((x) => x.item);
	}, [items, query]);
	const exact = items.some((i) => i.name.toLowerCase() === query.trim().toLowerCase());
	const canCreate = allowCreate && query.trim().length >= 2 && !exact;
	function add(name) {
		const t = name.trim();
		if (!t) return;
		onChange([...values, t]);
		setQ("");
		setOpen(false);
	}
	async function create() {
		const next = query.trim();
		if (!next) return;
		await onCreate?.(next);
		add(next);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		label ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: label }) : null,
		name ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			type: "hidden",
			name,
			value: values.join("\n")
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Popover, {
			modal: false,
			open,
			onOpenChange: (v) => {
				setOpen(v);
				if (!v) setQ("");
			},
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PopoverTrigger, {
				asChild: true,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					role: "combobox",
					"aria-label": label,
					tabIndex: 0,
					className: cn(pillClass, "flex-wrap py-1", label ? "mt-1" : "mt-0"),
					onKeyDown: (e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							setOpen(true);
						}
					},
					children: [values.length ? values.map((v, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "inline-flex max-w-full items-center gap-0.5 rounded-full bg-secondary pl-2.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "max-w-[14rem] truncate py-0.5 text-sm text-foreground",
							children: v
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground",
							"aria-label": `Remove ${v}`,
							onClick: (e) => {
								e.preventDefault();
								e.stopPropagation();
								onChange(values.filter((_, j) => j !== i));
							},
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" })
						})]
					}, `${v}-${i}`)) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "min-w-0 flex-1 truncate px-1 text-muted-foreground",
						children: placeholder
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronsUpDown, { className: "ml-auto size-4 shrink-0 text-muted-foreground" })]
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PopoverContent, {
				className: "p-1",
				onOpenAutoFocus: (e) => e.preventDefault(),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: q,
					onChange: (e) => setQ(e.target.value),
					placeholder,
					className: "h-9",
					autoComplete: "off",
					autoFocus: true,
					onKeyDown: (e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							if (matches[0]) add(matches[0].name);
							else if (canCreate) create();
						}
					}
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "mt-1 max-h-80 overflow-y-auto py-1",
					role: "listbox",
					children: [
						matches.map((item) => {
							const already = values.filter((v) => v.toLowerCase() === item.name.toLowerCase()).length;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex items-center",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									role: "option",
									"aria-selected": already > 0,
									className: cn("flex min-w-0 flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted", already > 0 && "bg-muted"),
									onClick: () => add(item.name),
									children: [
										already > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5 shrink-0" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3.5 shrink-0 opacity-0" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "min-w-0 truncate",
											children: item.name
										}),
										already > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "ml-auto shrink-0 text-[11px] text-muted-foreground",
											children: "add another"
										}) : null
									]
								}), onRemoveItem ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "flex size-9 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-destructive",
									"aria-label": `Remove ${item.name} from the list`,
									title: "Remove from the master list",
									onClick: (e) => {
										e.preventDefault();
										e.stopPropagation();
										onRemoveItem(item);
									},
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" })
								}) : null]
							}, item.id);
						}),
						canCreate ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted",
							onClick: () => void create(),
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5 shrink-0" }),
								"Add “",
								query.trim(),
								"”"
							]
						}) }) : null,
						!matches.length && !canCreate ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "px-2 py-2 text-xs text-muted-foreground",
							children: "No matches — type a name to add one."
						}) : null
					]
				})]
			})]
		})
	] });
}
function useDirectory(kind) {
	const qc = useQueryClient();
	const list = useQuery({
		queryKey: ["directory", kind],
		queryFn: () => listDirectory({ data: { kind } })
	});
	const add = useMutation({
		mutationFn: (name) => addDirectoryEntry({ data: {
			kind,
			name
		} }),
		onSuccess: (row) => {
			qc.setQueryData(["directory", kind], (old) => {
				const list = old ?? [];
				if (list.some((i) => i.id === row.id || i.name.toLowerCase() === row.name.toLowerCase())) return list.map((i) => i.id === row.id ? row : i);
				return [...list, row].sort((a, b) => a.name.localeCompare(b.name));
			});
			qc.invalidateQueries({ queryKey: ["directory", kind] });
			qc.invalidateQueries({ queryKey: ["customers"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add")
	});
	const archive = useMutation({
		mutationFn: (id) => archiveDirectoryEntry({ data: {
			kind,
			id
		} }),
		onSuccess: (_ok, id) => {
			qc.setQueryData(["directory", kind], (old) => (old ?? []).filter((i) => i.id !== id));
			qc.invalidateQueries({ queryKey: ["directory", kind] });
			qc.invalidateQueries({ queryKey: ["customers"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove")
	});
	function removeItem(item) {
		const noun = kind === "customer" ? "customer" : "equipment";
		archive.mutate(item.id, { onSuccess: () => toast.success(`Removed “${item.name}” from the ${noun} list. Existing records keep the name.`) });
	}
	return {
		items: list.data ?? [],
		add: (name) => add.mutateAsync(name).then((row) => row.name),
		removeItem
	};
}
function CustomerCombo({ label = "Customer", name, value, onChange, required, placeholder = "Search customers…" }) {
	const dir = useDirectory("customer");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ComboField, {
		label,
		name,
		value,
		onChange,
		items: dir.items,
		placeholder,
		required,
		allowCreate: true,
		onCreate: dir.add,
		onRemoveItem: dir.removeItem,
		emptyHint: "No customer matches — type a name to add one."
	});
}
function EquipmentCombo({ label = "Equipment", name, value, onChange, required, placeholder = "Search equipment…" }) {
	const dir = useDirectory("equipment");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ComboField, {
		label,
		name,
		value,
		onChange,
		items: dir.items,
		placeholder,
		required,
		allowCreate: true,
		onCreate: dir.add,
		onRemoveItem: dir.removeItem,
		emptyHint: "No equipment matches — type a model to add one."
	});
}
function EquipmentMultiCombo({ label = "Equipment", name = "equipment", values, onChange, placeholder = "Search equipment…" }) {
	const dir = useDirectory("equipment");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MultiComboField, {
		label,
		name,
		values,
		onChange,
		items: dir.items,
		placeholder,
		allowCreate: true,
		onCreate: dir.add,
		onRemoveItem: dir.removeItem
	});
}
//#endregion
export { EquipmentCombo as n, EquipmentMultiCombo as r, CustomerCombo as t };
