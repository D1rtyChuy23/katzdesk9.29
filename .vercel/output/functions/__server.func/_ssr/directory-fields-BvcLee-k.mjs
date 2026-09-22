import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { o as getMyAccess } from "./access-3Tz151bB.mjs";
import { B as ChevronsUpDown, S as Pencil, U as Check, b as Plus, t as X } from "../_libs/lucide-react.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { _ as cn } from "./router-1NWxggZt.mjs";
import { D as listDirectory, F as renameCustomer, I as renameEquipment, i as archiveDirectoryEntry, n as addDirectoryEntry } from "./api-CgwyWugK.mjs";
import { i as Label, n as Button, r as Input } from "./input-COYCsX_T.mjs";
import { i as DialogTitle, n as DialogContent, t as Dialog } from "./dialog-zUw3eso-.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/directory-fields-BvcLee-k.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function rank(q, name) {
	const n = String(name ?? "").toLowerCase();
	const s = q.toLowerCase().trim();
	if (!n) return -1;
	if (!s) return 1;
	if (n === s) return 100;
	if (n.startsWith(s)) return 80;
	const idx = n.indexOf(s);
	if (idx >= 0) return 60 - Math.min(idx, 40);
	const tokens = s.split(/[^a-z0-9]+/).filter(Boolean);
	if (tokens.length > 1 && tokens.every((t) => n.includes(t))) return 45;
	if (tokens.length === 1 && tokens[0].length >= 3 && n.includes(tokens[0])) return 30;
	return -1;
}
function createdName(result, fallback) {
	if (typeof result === "string" && result.trim()) return result.trim();
	if (result && typeof result === "object" && "name" in result) {
		const n = result.name;
		if (typeof n === "string" && n.trim()) return n.trim();
	}
	return fallback;
}
var fieldClass = "flex min-h-11 w-full items-center gap-2 rounded-full border border-input bg-background px-3 text-left text-sm focus-within:ring-2 focus-within:ring-ring";
function useDismiss(open, onClose) {
	const ref = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		if (!open) return;
		function onDoc(e) {
			if (!ref.current?.contains(e.target)) onClose();
		}
		document.addEventListener("mousedown", onDoc);
		return () => document.removeEventListener("mousedown", onDoc);
	}, [open, onClose]);
	return ref;
}
function Menu$1({ children, notFound, notFoundText }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		"data-combo-popover": "",
		className: "absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-soft",
		children: [notFound ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "px-2 py-1.5 text-xs text-muted-foreground",
			children: notFoundText
		}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "max-h-80 overflow-y-auto py-1",
			role: "listbox",
			children
		})]
	});
}
function ItemTools({ item, noun, onRenameItem, onRemoveItem }) {
	if (!onRenameItem && !onRemoveItem) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: "flex shrink-0 items-center",
		children: [onRenameItem ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: "flex size-9 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground",
			"aria-label": `Rename ${item.name}`,
			title: `Rename this ${noun}`,
			onMouseDown: (e) => {
				e.preventDefault();
				e.stopPropagation();
				onRenameItem(item);
			},
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "size-3.5" })
		}) : null, onRemoveItem ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: "flex size-9 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-destructive",
			"aria-label": `Remove ${item.name} from the list`,
			title: "Remove from the master list",
			onMouseDown: (e) => {
				e.preventDefault();
				e.stopPropagation();
				onRemoveItem(item);
			},
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" })
		}) : null]
	});
}
function ComboField({ label, name, value, onChange, items, placeholder = "Search…", required, disabled, allowCreate = true, onCreate, onRemoveItem, onRenameItem, noun = "name", emptyHint = "No matches." }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	const [q, setQ] = (0, import_react.useState)("");
	const inputRef = (0, import_react.useRef)(null);
	const rootRef = useDismiss(open, () => {
		setOpen(false);
		setQ("");
	});
	const query = open ? q : "";
	const matches = (0, import_react.useMemo)(() => {
		return items.map((item) => ({
			item,
			score: rank(query, item.name)
		})).filter((x) => x.score >= 0).sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name)).map((x) => x.item);
	}, [items, query]);
	const needle = query.trim();
	const exact = items.some((i) => String(i.name ?? "").toLowerCase() === needle.toLowerCase());
	const canCreate = allowCreate && needle.length >= 2 && !exact;
	const notFound = needle.length >= 2 && matches.length === 0;
	function pick(next) {
		onChange(next);
		setQ("");
		setOpen(false);
	}
	async function create() {
		const next = needle;
		if (!next) return;
		try {
			pick(createdName(await onCreate?.(next), next));
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Could not add that name");
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		label ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: label }) : null,
		name ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			type: "hidden",
			name,
			value,
			required
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			ref: rootRef,
			className: cn("relative", label ? "mt-1" : "mt-0"),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: cn(fieldClass, disabled && "opacity-50"),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						ref: inputRef,
						disabled,
						value: open ? q : value,
						placeholder,
						autoComplete: "off",
						"aria-label": label || `Search ${noun}`,
						"aria-expanded": open,
						"aria-autocomplete": "list",
						role: "combobox",
						className: "min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground",
						onChange: (e) => {
							setQ(e.target.value);
							if (!open) setOpen(true);
						},
						onFocus: () => {
							setOpen(true);
							setQ("");
						},
						onKeyDown: (e) => {
							if (e.key === "Escape") {
								setOpen(false);
								inputRef.current?.blur();
							}
							if (e.key === "Enter") {
								e.preventDefault();
								if (canCreate && !matches[0]) create();
								else if (matches[0]) pick(matches[0].name);
								else if (canCreate) create();
							}
						}
					}),
					value && !open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground",
						"aria-label": "Clear",
						onMouseDown: (e) => {
							e.preventDefault();
							onChange("");
							setQ("");
						},
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" })
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronsUpDown, { className: "size-4 shrink-0 text-muted-foreground" })
				]
			}), open ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Menu$1, {
				notFound,
				notFoundText: allowCreate ? `This ${noun} isn’t on the list. Use + to add it.` : emptyHint,
				children: [
					canCreate ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "flex min-h-10 w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm font-medium hover:bg-muted",
						onMouseDown: (e) => {
							e.preventDefault();
							create();
						},
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5 shrink-0" }), needle]
					}) }) : null,
					matches.map((item) => {
						const selected = item.name === value;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-center",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								role: "option",
								"aria-selected": selected,
								className: cn("flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted", selected && "bg-muted"),
								onMouseDown: (e) => {
									e.preventDefault();
									pick(item.name);
								},
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: cn("size-3.5 shrink-0", selected ? "opacity-100" : "opacity-0") }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "min-w-0 truncate",
									children: item.name
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ItemTools, {
								item,
								noun,
								onRenameItem,
								onRemoveItem
							})]
						}, `${item.id}-${item.name}`);
					}),
					!matches.length && !canCreate && !notFound ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "px-2 py-2 text-xs text-muted-foreground",
						children: emptyHint
					}) : null
				]
			}) : null]
		})
	] });
}
function MultiComboField({ label, name, values, onChange, items, placeholder = "Add…", allowCreate = true, onCreate, onRemoveItem, onRenameItem, noun = "name" }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	const [q, setQ] = (0, import_react.useState)("");
	const rootRef = useDismiss(open, () => {
		setOpen(false);
		setQ("");
	});
	const query = open ? q : "";
	const matches = (0, import_react.useMemo)(() => {
		return items.map((item) => ({
			item,
			score: rank(query, item.name)
		})).filter((x) => x.score >= 0).sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name)).map((x) => x.item);
	}, [items, query]);
	const needle = query.trim();
	const exact = items.some((i) => String(i.name ?? "").toLowerCase() === needle.toLowerCase());
	const canCreate = allowCreate && needle.length >= 2 && !exact;
	const notFound = needle.length >= 2 && matches.length === 0;
	function add(next) {
		const t = next.trim();
		if (!t) return;
		onChange([...values, t]);
		setQ("");
		setOpen(true);
	}
	async function create() {
		const next = needle;
		if (!next) return;
		const existing = matches[0];
		if (existing && rank(next, existing.name) >= 45) {
			add(existing.name);
			return;
		}
		try {
			add(createdName(await onCreate?.(next), next));
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Could not add that equipment");
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		label ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: label }) : null,
		name ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			type: "hidden",
			name,
			value: values.join("\n")
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			ref: rootRef,
			className: cn("relative", label ? "mt-1" : "mt-0"),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: cn(fieldClass, "flex-wrap py-1"),
				onClick: () => setOpen(true),
				children: [
					values.map((v, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "inline-flex max-w-full items-center gap-0.5 rounded-full bg-secondary pl-2.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "max-w-[28rem] py-0.5 text-sm leading-snug text-foreground",
							children: v
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground",
							"aria-label": `Remove ${v}`,
							onMouseDown: (e) => {
								e.preventDefault();
								e.stopPropagation();
								onChange(values.filter((_, j) => j !== i));
							},
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" })
						})]
					}, `${v}-${i}`)),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: open ? q : "",
						placeholder: values.length ? "Add another…" : placeholder,
						autoComplete: "off",
						"aria-label": label,
						"aria-expanded": open,
						"aria-autocomplete": "list",
						role: "combobox",
						className: "min-w-[7rem] flex-1 bg-transparent px-1 py-2 text-sm outline-none placeholder:text-muted-foreground",
						onChange: (e) => {
							setQ(e.target.value);
							if (!open) setOpen(true);
						},
						onFocus: () => setOpen(true),
						onKeyDown: (e) => {
							if (e.key === "Escape") setOpen(false);
							if (e.key === "Enter") {
								e.preventDefault();
								if (matches[0]) add(matches[0].name);
								else if (canCreate) create();
							}
							if (e.key === "Backspace" && !q && values.length) onChange(values.slice(0, -1));
						}
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronsUpDown, { className: "ml-auto size-4 shrink-0 text-muted-foreground" })
				]
			}), open ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Menu$1, {
				notFound,
				notFoundText: allowCreate ? `This ${noun} isn’t on the list. Use + to add it.` : "No matches.",
				children: [
					canCreate ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "flex min-h-10 w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm font-medium hover:bg-muted",
						onMouseDown: (e) => {
							e.preventDefault();
							create();
						},
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5 shrink-0" }), needle]
					}) }) : null,
					matches.map((item) => {
						const already = values.filter((v) => v.toLowerCase() === item.name.toLowerCase()).length;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-center",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								role: "option",
								"aria-selected": already > 0,
								className: cn("flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted", already > 0 && "bg-muted"),
								onMouseDown: (e) => {
									e.preventDefault();
									add(item.name);
								},
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
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ItemTools, {
								item,
								noun,
								onRenameItem,
								onRemoveItem
							})]
						}, `${item.id}-${item.name}`);
					}),
					!matches.length && !canCreate && !notFound ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "px-2 py-2 text-xs text-muted-foreground",
						children: "Type to search the full list."
					}) : null
				]
			}) : null]
		})
	] });
}
function RenameDialog({ open, title, noun, current, pending, onClose, onSave }) {
	const [name, setName] = (0, import_react.useState)(current);
	(0, import_react.useEffect)(() => {
		if (open) setName(current);
	}, [open, current]);
	function submit(e) {
		e.preventDefault();
		const next = name.trim();
		if (!next || next === current) return;
		onSave(next);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange: (o) => !o && onClose(),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "max-w-md",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: title }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 text-sm text-muted-foreground",
					children: [
						"Every ticket, install, recipe, and record using this ",
						noun,
						" will move with the new name."
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					className: "mt-4 space-y-3",
					onSubmit: submit,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: name,
						onChange: (e) => setName(e.target.value),
						"aria-label": `New ${noun} name`,
						autoFocus: true
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex justify-end gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "ghost",
							onClick: onClose,
							children: "Cancel"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							disabled: pending || !name.trim() || name.trim() === current,
							children: "Save name"
						})]
					})]
				})
			]
		})
	});
}
function useDirectory(kind) {
	const qc = useQueryClient();
	const me = useQuery({
		queryKey: ["access", "me"],
		queryFn: () => getMyAccess()
	});
	const isAdmin = !!me.data?.isAdmin;
	const canAdd = kind === "equipment" || isAdmin || me.data?.canAddCustomers !== false;
	const canManage = kind === "equipment" || isAdmin;
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
	const rename = useMutation({
		mutationFn: (d) => kind === "customer" ? renameCustomer({ data: d }) : renameEquipment({ data: d }),
		onSuccess: (row) => {
			toast.success(row.merged ? `Merged into “${row.name}”` : `Renamed to “${row.name}”`);
			qc.invalidateQueries({ queryKey: ["directory"] });
			qc.invalidateQueries({ queryKey: ["customers"] });
			qc.invalidateQueries({ queryKey: ["jobs"] });
			qc.invalidateQueries({ queryKey: ["pms"] });
			qc.invalidateQueries({ queryKey: ["installs"] });
			qc.invalidateQueries({ queryKey: ["deals"] });
			qc.invalidateQueries({ queryKey: ["recipes"] });
			qc.invalidateQueries({ queryKey: ["assets"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["customer-history"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not rename")
	});
	function removeItem(item) {
		const noun = kind === "customer" ? "customer" : "equipment";
		archive.mutate(item.id, { onSuccess: () => toast.success(`Removed “${item.name}” from the ${noun} list. Existing records keep the name.`) });
	}
	return {
		items: list.data ?? [],
		add: (name) => add.mutateAsync(name).then((row) => row.name),
		removeItem,
		rename: (item, name) => rename.mutateAsync({
			id: item.id,
			name
		}),
		renamePending: rename.isPending,
		canEdit: canAdd,
		canAdd,
		canManage,
		isAdmin
	};
}
function CustomerCombo({ label = "Customer", name, value, onChange, required, placeholder = "Search customers…", allowCreate: allowCreateProp }) {
	const dir = useDirectory("customer");
	const allowCreate = allowCreateProp ?? dir.canAdd;
	const renameUi = useRename(dir, "customer", (from, to) => {
		if (value.toLowerCase() === from.toLowerCase()) onChange(to);
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ComboField, {
		label,
		name,
		value,
		onChange,
		items: dir.items,
		placeholder,
		required,
		allowCreate,
		onCreate: allowCreate ? dir.add : void 0,
		onRemoveItem: dir.canManage ? dir.removeItem : void 0,
		onRenameItem: dir.canManage ? renameUi.open : void 0,
		noun: "customer",
		emptyHint: allowCreate ? "No customer matches — use + to add one." : "No customer matches. Pick an account already on the list."
	}), renameUi.dialog] });
}
function EquipmentCombo({ label = "Equipment", name, value, onChange, required, placeholder = "Search equipment…" }) {
	const dir = useDirectory("equipment");
	const renameUi = useRename(dir, "equipment", (from, to) => {
		if (value.toLowerCase() === from.toLowerCase()) onChange(to);
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ComboField, {
		label,
		name,
		value,
		onChange: (v) => {
			onChange(v);
		},
		items: dir.items,
		placeholder,
		required,
		allowCreate: true,
		onCreate: dir.add,
		onRemoveItem: dir.removeItem,
		onRenameItem: renameUi.open,
		noun: "equipment",
		emptyHint: "No equipment matches — use + to add a model."
	}), renameUi.dialog] });
}
function EquipmentMultiCombo({ label = "Equipment", name = "equipment", values, onChange, placeholder = "Search equipment…" }) {
	const dir = useDirectory("equipment");
	const renameUi = useRename(dir, "equipment", (from, to) => {
		onChange(values.map((v) => v.toLowerCase() === from.toLowerCase() ? to : v));
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MultiComboField, {
		label,
		name,
		values,
		onChange: (next) => {
			onChange(next);
		},
		items: dir.items,
		placeholder,
		allowCreate: true,
		onCreate: dir.add,
		onRemoveItem: dir.removeItem,
		onRenameItem: renameUi.open,
		noun: "equipment"
	}), renameUi.dialog] });
}
function useRename(dir, noun, onMapped) {
	const [item, setItem] = (0, import_react.useState)(null);
	return {
		open: (next) => setItem(next),
		dialog: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RenameDialog, {
			open: !!item,
			title: `Rename ${noun}`,
			noun,
			current: item?.name ?? "",
			pending: dir.renamePending,
			onClose: () => setItem(null),
			onSave: (name) => {
				if (!item) return;
				const from = item.name;
				dir.rename(item, name).then((row) => {
					onMapped?.(from, row.name);
					setItem(null);
				});
			}
		})
	};
}
//#endregion
export { RenameDialog as a, EquipmentMultiCombo as i, CustomerCombo as n, useDirectory as o, EquipmentCombo as r, ComboField as t };
