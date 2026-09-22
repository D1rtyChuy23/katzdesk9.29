import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { b as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { S as Pencil, _ as Search, b as Plus, u as Trash2 } from "../_libs/lucide-react.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { _ as cn, l as Route$10, x as useOpenRecord } from "./router-1NWxggZt.mjs";
import { t as SelectField } from "./select-field-BxGIjVBi.mjs";
import { d as sortDesk, l as SortSelect, p as useDeskSort, t as SORT_ALPHA } from "./sort-1yS_DCzE.mjs";
import { t as Badge } from "./badge-C8SL_nG4.mjs";
import { a as Textarea, i as Label, n as Button, r as Input } from "./input-COYCsX_T.mjs";
import { a as SheetTitle, i as SheetHeader, n as SheetBody, r as SheetContent, t as Sheet } from "./sheet-CdZCIXqJ.mjs";
import { a as RenameDialog } from "./directory-fields-BvcLee-k.mjs";
import { S as statusTone, a as findDuplicateContact, c as formatContact, d as locationKey, f as normalizeCity, i as findDuplicateAddress, l as formatLocation, n as US_STATE_OPTIONS, o as findDuplicateLocation, r as duplicateNote, s as formatAddress, t as PROVIDER_STATUSES, u as groupLocations, v as providerStates, x as splitZips } from "./network-feNzLxWy.mjs";
import { a as addProviderContact, c as getProvider, d as removeProviderContact, f as removeProviderLocation, i as addProviderAddress, l as listNetwork, m as upsertProvider, n as ProviderAccountList, o as addProviderLocation, p as renameProvider, s as archiveProvider, t as DispatchCard, u as removeProviderAddress } from "./provider-dispatch-CwfIUm28.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/network-CyYfzi0j.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function LocationsEditor({ providerId, locations, onDraftChange }) {
	const qc = useQueryClient();
	const [state, setState] = (0, import_react.useState)("");
	const [city, setCity] = (0, import_react.useState)("");
	const [zip, setZip] = (0, import_react.useState)("");
	const [note, setNote] = (0, import_react.useState)(null);
	const [highlight, setHighlight] = (0, import_react.useState)(null);
	const addMut = useMutation({
		mutationFn: () => addProviderLocation({ data: {
			providerId,
			state,
			city: city || null,
			zip: zip || null
		} }),
		onSuccess: (res) => {
			if (res.duplicates.length && !res.added.length) {
				const first = res.duplicates[0];
				setNote(first.message);
				setHighlight(locationKey(first.existing.state, first.existing.city, first.existing.zip));
			} else if (res.duplicates.length) {
				setNote(`Added ${res.added.length}. ${res.duplicates.map((d) => d.message.replace(/^Already listed — /, "")).join("; ")} already listed.`);
				setHighlight(locationKey(res.duplicates[0].existing.state, res.duplicates[0].existing.city, res.duplicates[0].existing.zip));
				setCity("");
				setZip("");
				qc.invalidateQueries({ queryKey: ["provider"] });
				qc.invalidateQueries({ queryKey: ["network"] });
			} else {
				setNote(null);
				setHighlight(null);
				setCity("");
				setZip("");
				qc.invalidateQueries({ queryKey: ["provider"] });
				qc.invalidateQueries({ queryKey: ["network"] });
			}
		}
	});
	const dropMut = useMutation({
		mutationFn: (id) => removeProviderLocation({ data: { id } }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["provider"] });
			qc.invalidateQueries({ queryKey: ["network"] });
		}
	});
	function addLocal() {
		if (!state) return;
		if (providerId) {
			addMut.mutate();
			return;
		}
		const nextCity = normalizeCity(city);
		const zips = splitZips(zip);
		const parts = zips.length ? zips : [null];
		let dup = null;
		const next = [...locations];
		let added = 0;
		for (const z of parts) {
			const draft = {
				state,
				city: nextCity,
				zip: z
			};
			const hit = findDuplicateLocation(next, draft);
			if (hit) {
				dup = hit;
				continue;
			}
			next.push({
				id: -Date.now() - added,
				...draft
			});
			added += 1;
		}
		onDraftChange?.(next);
		if (dup && !added) {
			setNote(duplicateNote(dup));
			setHighlight(locationKey(dup.state, dup.city ?? null, dup.zip ?? null));
		} else if (dup) {
			setNote(`Added ${added}. ${formatLocation(dup)} already listed.`);
			setHighlight(locationKey(dup.state, dup.city ?? null, dup.zip ?? null));
			setCity("");
			setZip("");
		} else {
			setNote(null);
			setHighlight(null);
			setCity("");
			setZip("");
		}
	}
	const groups = groupLocations(locations);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", {
			className: "mb-1 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase",
			children: "Coverage"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-xs text-muted-foreground",
			children: "Add every state, city, and ZIP this company covers. Duplicates stay off the list."
		}),
		groups.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-3 space-y-3",
			children: groups.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs font-medium tracking-wide text-muted-foreground",
				children: g.state
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-1 divide-y divide-border rounded-lg border border-border",
				children: g.rows.map((row) => {
					const key = locationKey(row.state, row.city ?? null, row.zip ?? null);
					const label = row.city || row.zip ? [row.city, row.zip].filter(Boolean).join(" · ") : "Statewide";
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: cn("flex items-center gap-2 px-3 py-1.5 text-sm", highlight === key && "bg-warning/15"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "min-w-0 flex-1",
							children: label
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "h-8 px-2 text-xs text-muted-foreground hover:text-foreground",
							"aria-label": `Remove ${formatLocation(row)}`,
							onClick: () => {
								if (providerId && row.id > 0) dropMut.mutate(row.id);
								else onDraftChange?.(locations.filter((l) => l.id !== row.id));
								if (highlight === key) {
									setHighlight(null);
									setNote(null);
								}
							},
							children: "Remove"
						})]
					}, row.id);
				})
			})] }, g.state))
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-3 text-sm text-muted-foreground",
			children: "No locations yet."
		}),
		note ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm",
			children: note
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-3 grid gap-2 sm:grid-cols-[7rem_1fr_6.5rem_auto]",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					htmlFor: "loc-state",
					className: "sr-only",
					children: "State"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
					id: "loc-state",
					value: state,
					onChange: (e) => setState(e.target.value),
					allowEmpty: true,
					emptyLabel: "State",
					children: US_STATE_OPTIONS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: s.code,
						children: s.code
					}, s.code))
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					htmlFor: "loc-city",
					className: "sr-only",
					children: "City"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					id: "loc-city",
					value: city,
					onChange: (e) => setCity(e.target.value),
					placeholder: "City",
					onKeyDown: (e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							addLocal();
						}
					}
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					htmlFor: "loc-zip",
					className: "sr-only",
					children: "ZIP"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					id: "loc-zip",
					value: zip,
					onChange: (e) => setZip(e.target.value),
					placeholder: "ZIP",
					inputMode: "numeric",
					onKeyDown: (e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							addLocal();
						}
					}
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					size: "sm",
					disabled: !state || addMut.isPending,
					onClick: () => addLocal(),
					children: "Add"
				})
			]
		})
	] });
}
function invalidate(qc) {
	qc.invalidateQueries({ queryKey: ["provider"] });
	qc.invalidateQueries({ queryKey: ["network"] });
}
function PeopleEditor({ providerId, people, onDraftChange }) {
	const qc = useQueryClient();
	const [name, setName] = (0, import_react.useState)("");
	const [phone, setPhone] = (0, import_react.useState)("");
	const [email, setEmail] = (0, import_react.useState)("");
	const [note, setNote] = (0, import_react.useState)(null);
	const [hit, setHit] = (0, import_react.useState)(null);
	const addMut = useMutation({
		mutationFn: () => addProviderContact({ data: {
			providerId,
			name: name || null,
			role: null,
			phone: phone || null,
			email: email || null
		} }),
		onSuccess: (res) => {
			if (!res.ok) {
				setNote(res.message);
				setHit(res.existing.id);
				return;
			}
			setNote(null);
			setHit(null);
			setName("");
			setPhone("");
			setEmail("");
			invalidate(qc);
		}
	});
	const dropMut = useMutation({
		mutationFn: (id) => removeProviderContact({ data: { id } }),
		onSuccess: () => invalidate(qc)
	});
	function add() {
		const draft = {
			name: name.trim() || null,
			role: null,
			phone: phone.trim() || null,
			email: email.trim() || null
		};
		if (!draft.name && !draft.phone && !draft.email) return;
		if (providerId) {
			addMut.mutate();
			return;
		}
		const dup = findDuplicateContact(people, draft);
		if (dup) {
			setNote(`Already listed — ${formatContact(dup)}.`);
			setHit(dup.id);
			return;
		}
		onDraftChange?.([...people, {
			id: -Date.now(),
			...draft
		}]);
		setNote(null);
		setHit(null);
		setName("");
		setPhone("");
		setEmail("");
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("legend", {
			className: "mb-1 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase",
			children: ["Contacts", people.length ? ` · ${people.length}` : ""]
		}),
		people.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "divide-y divide-border rounded-lg border border-border",
			children: people.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: cn("flex items-start gap-2 px-3 py-2 text-sm", hit === p.id && "bg-warning/15"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "min-w-0 flex-1",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium",
							children: p.name || "Unnamed"
						}),
						p.role ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-muted-foreground",
							children: [" · ", p.role]
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mt-0.5 block text-xs text-muted-foreground",
							children: [p.phone, p.email].filter(Boolean).join(" · ") || "No phone or email"
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "h-8 px-2 text-xs text-muted-foreground hover:text-foreground",
					onClick: () => {
						if (providerId && p.id > 0) dropMut.mutate(p.id);
						else onDraftChange?.(people.filter((x) => x.id !== p.id));
						if (hit === p.id) {
							setHit(null);
							setNote(null);
						}
					},
					children: "Remove"
				})]
			}, p.id))
		}) : null,
		note ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm",
			children: note
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-2 grid gap-2 sm:grid-cols-[1fr_8rem_1fr_auto]",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					htmlFor: "ppl-name",
					className: "sr-only",
					children: "Name"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					id: "ppl-name",
					value: name,
					onChange: (e) => setName(e.target.value),
					placeholder: "Name",
					onKeyDown: (e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							add();
						}
					}
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					htmlFor: "ppl-phone",
					className: "sr-only",
					children: "Phone"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					id: "ppl-phone",
					value: phone,
					onChange: (e) => setPhone(e.target.value),
					placeholder: "Phone",
					onKeyDown: (e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							add();
						}
					}
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					htmlFor: "ppl-email",
					className: "sr-only",
					children: "Email"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					id: "ppl-email",
					value: email,
					onChange: (e) => setEmail(e.target.value),
					placeholder: "Email",
					onKeyDown: (e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							add();
						}
					}
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					size: "sm",
					disabled: addMut.isPending || !name && !phone && !email,
					onClick: add,
					children: "Add"
				})
			]
		})
	] });
}
function AddressEditor({ providerId, addresses, onDraftChange }) {
	const qc = useQueryClient();
	const [line1, setLine1] = (0, import_react.useState)("");
	const [city, setCity] = (0, import_react.useState)("");
	const [state, setState] = (0, import_react.useState)("");
	const [zip, setZip] = (0, import_react.useState)("");
	const [note, setNote] = (0, import_react.useState)(null);
	const [hit, setHit] = (0, import_react.useState)(null);
	const addMut = useMutation({
		mutationFn: () => addProviderAddress({ data: {
			providerId,
			label: null,
			line1: line1 || null,
			line2: null,
			city: city || null,
			state: state || null,
			zip: zip || null
		} }),
		onSuccess: (res) => {
			if (!res.ok) {
				setNote(res.message);
				setHit(res.existing.id);
				return;
			}
			setNote(null);
			setHit(null);
			setLine1("");
			setCity("");
			setState("");
			setZip("");
			invalidate(qc);
		}
	});
	const dropMut = useMutation({
		mutationFn: (id) => removeProviderAddress({ data: { id } }),
		onSuccess: () => invalidate(qc)
	});
	function add() {
		const draft = {
			label: null,
			line1: line1.trim() || null,
			line2: null,
			city: city.trim() || null,
			state: state || null,
			zip: zip.trim() || null
		};
		if (!draft.line1 && !draft.city) return;
		if (providerId) {
			addMut.mutate();
			return;
		}
		const dup = findDuplicateAddress(addresses, draft);
		if (dup) {
			setNote(`Already listed — ${formatAddress(dup)}.`);
			setHit(dup.id);
			return;
		}
		onDraftChange?.([...addresses, {
			id: -Date.now(),
			...draft
		}]);
		setNote(null);
		setHit(null);
		setLine1("");
		setCity("");
		setState("");
		setZip("");
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("legend", {
			className: "mb-1 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase",
			children: ["Addresses", addresses.length ? ` · ${addresses.length}` : ""]
		}),
		addresses.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "divide-y divide-border rounded-lg border border-border",
			children: addresses.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: cn("flex items-start gap-2 px-3 py-2 text-sm", hit === a.id && "bg-warning/15"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "min-w-0 flex-1",
					children: formatAddress(a) || "Incomplete address"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "h-8 px-2 text-xs text-muted-foreground hover:text-foreground",
					onClick: () => {
						if (providerId && a.id > 0) dropMut.mutate(a.id);
						else onDraftChange?.(addresses.filter((x) => x.id !== a.id));
						if (hit === a.id) {
							setHit(null);
							setNote(null);
						}
					},
					children: "Remove"
				})]
			}, a.id))
		}) : null,
		note ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm",
			children: note
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-2 grid gap-2 sm:grid-cols-[1.4fr_1fr_5.5rem_6rem_auto]",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					htmlFor: "addr-line",
					className: "sr-only",
					children: "Street"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					id: "addr-line",
					value: line1,
					onChange: (e) => setLine1(e.target.value),
					placeholder: "Street",
					onKeyDown: (e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							add();
						}
					}
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					htmlFor: "addr-city",
					className: "sr-only",
					children: "City"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					id: "addr-city",
					value: city,
					onChange: (e) => setCity(e.target.value),
					placeholder: "City",
					onKeyDown: (e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							add();
						}
					}
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					htmlFor: "addr-state",
					className: "sr-only",
					children: "State"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
					id: "addr-state",
					value: state,
					onChange: (e) => setState(e.target.value),
					allowEmpty: true,
					emptyLabel: "ST",
					children: US_STATE_OPTIONS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: s.code,
						children: s.code
					}, s.code))
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					htmlFor: "addr-zip",
					className: "sr-only",
					children: "ZIP"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					id: "addr-zip",
					value: zip,
					onChange: (e) => setZip(e.target.value),
					placeholder: "ZIP",
					inputMode: "numeric",
					onKeyDown: (e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							add();
						}
					}
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					size: "sm",
					disabled: addMut.isPending || !line1 && !city,
					onClick: add,
					children: "Add"
				})
			]
		})
	] });
}
function ProviderSheet({ id, creating, onClose, onCreated }) {
	const open = creating || id != null;
	const qc = useQueryClient();
	const formRef = (0, import_react.useRef)(null);
	const skipToast = (0, import_react.useRef)(false);
	const row = useQuery({
		queryKey: ["provider", id],
		queryFn: () => getProvider({ data: { id } }),
		enabled: id != null
	});
	const p = creating ? null : row.data;
	const [draftLocs, setDraftLocs] = (0, import_react.useState)([]);
	const [draftPeople, setDraftPeople] = (0, import_react.useState)([]);
	const [draftAddresses, setDraftAddresses] = (0, import_react.useState)([]);
	const [editingName, setEditingName] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (creating && open) {
			setDraftLocs([]);
			setDraftPeople([]);
			setDraftAddresses([]);
		}
	}, [creating, open]);
	const save = useMutation({
		mutationFn: (d) => upsertProvider({ data: d }),
		onSuccess: (saved) => {
			if (!skipToast.current) toast.success(creating ? `Added ${saved.name}` : "Saved");
			skipToast.current = false;
			qc.invalidateQueries({ queryKey: ["network"] });
			qc.invalidateQueries({ queryKey: ["provider"] });
			qc.invalidateQueries({ queryKey: ["customer-providers"] });
			if (creating) {
				if (onCreated) onCreated(saved.id);
				else onClose();
			}
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save")
	});
	const rename = useMutation({
		mutationFn: (name) => renameProvider({ data: {
			id,
			name
		} }),
		onSuccess: (row) => {
			toast.success(row.merged ? `Merged into “${row.name}”` : `Renamed to “${row.name}”`);
			setEditingName(false);
			qc.invalidateQueries({ queryKey: ["network"] });
			qc.invalidateQueries({ queryKey: ["provider"] });
			qc.invalidateQueries({ queryKey: ["customer-providers"] });
			if (row.merged && onCreated) onCreated(row.id);
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not rename")
	});
	const remove = useMutation({
		mutationFn: () => archiveProvider({ data: { id } }),
		onSuccess: () => {
			toast.success("Provider removed from the list");
			qc.invalidateQueries({ queryKey: ["network"] });
			onClose();
		}
	});
	function onSubmit(e) {
		e.preventDefault();
		const fd = new FormData(e.currentTarget);
		const str = (k) => String(fd.get(k) || "") || null;
		save.mutate({
			id: p?.id,
			name: String(fd.get("name") || ""),
			status: str("status"),
			dispatchPhone: str("dispatchPhone"),
			dispatchEmail: str("dispatchEmail"),
			secondaryPhone: str("secondaryPhone"),
			secondaryEmail: str("secondaryEmail"),
			responseTime: str("responseTime"),
			standardRate: str("standardRate"),
			afterHoursRate: str("afterHoursRate"),
			travelPolicy: str("travelPolicy"),
			equipmentServiced: str("equipmentServiced"),
			pmPricing: str("pmPricing"),
			partsStocking: str("partsStocking"),
			notes: str("notes"),
			locations: creating ? draftLocs.map((l) => ({
				state: l.state,
				city: l.city,
				zip: l.zip
			})) : void 0,
			people: creating ? draftPeople.map((p) => ({
				name: p.name,
				role: p.role,
				phone: p.phone,
				email: p.email
			})) : void 0,
			addresses: creating ? draftAddresses.map((a) => ({
				label: a.label,
				line1: a.line1,
				line2: a.line2,
				city: a.city,
				state: a.state,
				zip: a.zip
			})) : void 0
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
		open,
		onOpenChange: (o) => {
			if (!o) {
				if (!creating) {
					skipToast.current = true;
					formRef.current?.requestSubmit();
				}
				onClose();
			}
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetContent, {
			className: "sm:max-w-lg",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs tracking-wide text-muted-foreground uppercase",
					children: "3rd-party provider"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-start justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, { children: creating ? "New provider" : p?.name ?? "Provider" }), !creating && p ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						type: "button",
						size: "sm",
						variant: "outline",
						onClick: () => setEditingName(true),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "size-3.5" }), "Edit"]
					}) : null]
				}),
				p?.status ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-2",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
						variant: statusTone(p.status),
						children: p.status
					})
				}) : !creating ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-warning",
					children: "Status not confirmed yet."
				}) : null
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetBody, { children: [id != null && row.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "p-5 text-sm text-muted-foreground",
				children: "Loading…"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				ref: formRef,
				className: "space-y-5 p-5",
				onSubmit,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", {
						className: "grid gap-3 sm:grid-cols-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", {
								className: "mb-1 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase",
								children: "Company"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "sm:col-span-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "name",
									children: "Provider name"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "name",
									name: "name",
									className: "mt-1",
									required: true,
									defaultValue: p?.name ?? ""
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "status",
								children: "Status"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
								id: "status",
								name: "status",
								className: "mt-1",
								defaultValue: p?.status ?? "",
								allowEmpty: true,
								emptyLabel: "Unconfirmed",
								children: PROVIDER_STATUSES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
							})] })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LocationsEditor, {
						providerId: p?.id ?? null,
						locations: creating ? draftLocs : p?.locations ?? [],
						onDraftChange: creating ? setDraftLocs : void 0
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", {
						className: "grid gap-3 sm:grid-cols-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", {
								className: "mb-1 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase",
								children: "Dispatch"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "dispatchPhone",
								children: "Primary phone"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "dispatchPhone",
								name: "dispatchPhone",
								className: "mt-1",
								defaultValue: p?.dispatchPhone ?? ""
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "dispatchEmail",
								children: "Primary email"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "dispatchEmail",
								name: "dispatchEmail",
								className: "mt-1",
								defaultValue: p?.dispatchEmail ?? ""
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "secondaryPhone",
								children: "Secondary phone"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "secondaryPhone",
								name: "secondaryPhone",
								className: "mt-1",
								defaultValue: p?.secondaryPhone ?? ""
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "secondaryEmail",
								children: "Secondary email"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "secondaryEmail",
								name: "secondaryEmail",
								className: "mt-1",
								defaultValue: p?.secondaryEmail ?? ""
							})] })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PeopleEditor, {
						providerId: p?.id ?? null,
						people: creating ? draftPeople : p?.people ?? [],
						onDraftChange: creating ? setDraftPeople : void 0
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AddressEditor, {
						providerId: p?.id ?? null,
						addresses: creating ? draftAddresses : p?.addresses ?? [],
						onDraftChange: creating ? setDraftAddresses : void 0
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", {
						className: "grid gap-3 sm:grid-cols-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", {
								className: "mb-1 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase",
								children: "Rates & response"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "standardRate",
								children: "Standard rate"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "standardRate",
								name: "standardRate",
								className: "mt-1",
								defaultValue: p?.standardRate ?? ""
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "afterHoursRate",
								children: "After hours"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "afterHoursRate",
								name: "afterHoursRate",
								className: "mt-1",
								defaultValue: p?.afterHoursRate ?? ""
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "sm:col-span-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "travelPolicy",
									children: "Travel policy"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
									id: "travelPolicy",
									name: "travelPolicy",
									className: "mt-1 min-h-16",
									defaultValue: p?.travelPolicy ?? ""
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "responseTime",
								children: "Response time"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "responseTime",
								name: "responseTime",
								className: "mt-1",
								defaultValue: p?.responseTime ?? ""
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "pmPricing",
								children: "PM pricing"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "pmPricing",
								name: "pmPricing",
								className: "mt-1",
								defaultValue: p?.pmPricing ?? ""
							})] })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", {
						className: "grid gap-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", {
								className: "mb-1 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase",
								children: "Coverage notes"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "equipmentServiced",
								children: "Equipment serviced"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
								id: "equipmentServiced",
								name: "equipmentServiced",
								className: "mt-1 min-h-16",
								defaultValue: p?.equipmentServiced ?? ""
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "partsStocking",
								children: "Parts stocking"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
								id: "partsStocking",
								name: "partsStocking",
								className: "mt-1 min-h-16",
								defaultValue: p?.partsStocking ?? ""
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "notes",
								children: "Key notes"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
								id: "notes",
								name: "notes",
								className: "mt-1 min-h-20",
								defaultValue: p?.notes ?? ""
							})] })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center justify-between gap-2",
						children: [p ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							type: "button",
							variant: "outline",
							disabled: remove.isPending,
							onClick: () => {
								if (window.confirm(`Remove “${p.name}” from Out of Network? Assigned accounts will drop this provider.`)) remove.mutate();
							},
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), "Remove"]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							disabled: save.isPending,
							children: creating ? "Add provider" : "Save"
						})]
					})
				]
			}, p?.id ?? "new"), p ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "border-t border-border p-5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProviderAccountList, {
					providerId: p.id,
					accounts: p.accounts
				})
			}) : null] })]
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RenameDialog, {
		open: editingName,
		title: "Rename provider",
		noun: "provider",
		current: p?.name ?? "",
		pending: rename.isPending,
		onClose: () => setEditingName(false),
		onSave: (n) => rename.mutate(n)
	})] });
}
function Page() {
	const navigate = useNavigate();
	const { open } = Route$10.useSearch();
	const [selected, setSelected] = useOpenRecord(open);
	const [creating, setCreating] = (0, import_react.useState)(false);
	const [tab, setTab] = (0, import_react.useState)("providers");
	const net = useQuery({
		queryKey: ["network"],
		queryFn: () => listNetwork()
	});
	const d = net.data;
	function openProvider(id) {
		setSelected(id);
		setCreating(false);
		navigate({
			to: "/network",
			search: { open: id },
			replace: true
		});
	}
	function close() {
		setSelected(null);
		setCreating(false);
		navigate({
			to: "/network",
			search: {},
			replace: true
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-medium tracking-tight",
				children: "Out of Network"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-2xl text-sm text-muted-foreground",
				children: "Third-party techs we dispatch for accounts outside the Katz floor. Add a company with rates and notes, then assign customers. Primary is who we call first."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				onClick: () => {
					setSelected(null);
					setCreating(true);
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "Add provider"]
			})]
		}),
		d?.unassigned.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-5 rounded-xl border border-warning/40 bg-warning/10 p-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-sm font-medium",
				children: [
					d.unassigned.length,
					" ",
					d.unassigned.length === 1 ? "account has" : "accounts have",
					" no primary provider"
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-2 flex flex-wrap gap-2",
				children: d.unassigned.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "rounded-full bg-background px-3 py-1 text-sm",
					children: [a.customer, a.state ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-muted-foreground",
						children: [" · ", a.state]
					}) : null]
				}, a.id))
			})]
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-5 flex h-10 w-fit items-center rounded-full bg-secondary p-1",
			children: [
				["providers", "Providers"],
				["accounts", "Accounts"],
				["coverage", "Coverage"]
			].map(([id, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => setTab(id),
				className: cn("h-8 rounded-full px-3.5 text-sm font-medium", tab === id ? "bg-ink text-ink-foreground" : "text-foreground hover:bg-background/70"),
				children: [
					label,
					id === "providers" && d ? ` (${d.providers.length})` : null,
					id === "accounts" && d ? ` (${d.accounts.length})` : null
				]
			}, id))
		}),
		net.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-6 text-sm text-muted-foreground",
			children: "Loading the network…"
		}) : net.isError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-6 text-sm text-destructive",
			children: net.error instanceof Error ? net.error.message : "Could not load providers."
		}) : d ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5",
			children: [
				tab === "providers" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProvidersPane, {
					providers: d.providers,
					onOpen: openProvider
				}) : null,
				tab === "accounts" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccountsPane, {
					accounts: d.accounts,
					onOpen: openProvider
				}) : null,
				tab === "coverage" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CoveragePane, {
					byState: d.byState,
					providers: d.providers
				}) : null
			]
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProviderSheet, {
			id: creating ? null : selected,
			creating,
			onClose: close,
			onCreated: (pid) => {
				setCreating(false);
				openProvider(pid);
			}
		})
	] });
}
function ProvidersPane({ providers, onOpen }) {
	const qc = useQueryClient();
	const remove = useMutation({
		mutationFn: (d) => archiveProvider({ data: { id: d.id } }),
		onSuccess: (_ok, d) => {
			toast.success(`Removed “${d.name}”`);
			qc.invalidateQueries({ queryKey: ["network"] });
			qc.invalidateQueries({ queryKey: ["customer-providers"] });
			qc.invalidateQueries({ queryKey: ["provider"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove")
	});
	const [q, setQ] = (0, import_react.useState)("");
	const [status, setStatus] = (0, import_react.useState)("");
	const [state, setState] = (0, import_react.useState)("");
	const [sort, setSort] = useDeskSort("network-providers", "alpha-asc");
	const [renaming, setRenaming] = (0, import_react.useState)(null);
	const rename = useMutation({
		mutationFn: (d) => renameProvider({ data: d }),
		onSuccess: (row) => {
			toast.success(row.merged ? `Merged into “${row.name}”` : `Renamed to “${row.name}”`);
			setRenaming(null);
			qc.invalidateQueries({ queryKey: ["network"] });
			qc.invalidateQueries({ queryKey: ["provider"] });
			qc.invalidateQueries({ queryKey: ["customer-providers"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not rename")
	});
	const states = (0, import_react.useMemo)(() => {
		const s = /* @__PURE__ */ new Set();
		for (const p of providers) for (const st of providerStates(p)) s.add(st);
		return [...s].sort();
	}, [providers]);
	const rows = (0, import_react.useMemo)(() => {
		const needle = q.trim().toLowerCase();
		let list = providers;
		if (status === "unconfirmed") list = list.filter((p) => !p.status);
		else if (status) list = list.filter((p) => p.status === status);
		if (state) list = list.filter((p) => providerStates(p).includes(state));
		if (needle) list = list.filter((p) => [
			p.name,
			p.dispatchPhone,
			p.dispatchEmail,
			p.coverage,
			p.contacts
		].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle)));
		return sortDesk(list, sort, {
			name: (p) => p.name,
			date: (p) => p.lastUpdated
		});
	}, [
		providers,
		q,
		status,
		state,
		sort
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-col gap-2 sm:flex-row sm:items-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative min-w-0 flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: q,
						onChange: (e) => setQ(e.target.value),
						placeholder: "Search providers…",
						className: "pl-9"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
					className: "sm:w-44",
					value: status,
					onChange: (e) => setStatus(e.target.value),
					allowEmpty: true,
					emptyLabel: "Any status",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "Active",
							children: "Active"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "Pending Setup",
							children: "Pending Setup"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "Prospect",
							children: "Prospect"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "Inactive",
							children: "Inactive"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "unconfirmed",
							children: "Unconfirmed"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
					className: "sm:w-28",
					value: state,
					onChange: (e) => setState(e.target.value),
					allowEmpty: true,
					emptyLabel: "State",
					children: states.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
					value: sort,
					onChange: setSort,
					options: [...SORT_ALPHA]
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-4 overflow-hidden rounded-xl border border-border bg-card",
			children: rows.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border px-2 py-1 last:border-b-0",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => onOpen(p.id),
					className: "grid min-w-0 gap-1 rounded-md px-2 py-2.5 text-left hover:bg-muted/60 md:grid-cols-[1fr_11rem_7rem] md:items-center",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "flex flex-wrap items-center gap-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-medium",
								children: p.name
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								variant: statusTone(p.status),
								children: p.status || "Unconfirmed"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mt-0.5 block text-xs text-muted-foreground",
							children: [p.dispatchPhone, p.dispatchEmail].filter(Boolean).join(" · ") || "No dispatch contact yet"
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-xs text-muted-foreground",
							children: providerStates(p).join(" · ") || "Coverage TBD"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-xs text-muted-foreground",
							children: [
								p.primaryFor,
								" primary",
								p.secondaryFor ? ` · ${p.secondaryFor} backup` : ""
							]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex shrink-0 items-center gap-1 pr-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						type: "button",
						size: "sm",
						variant: "outline",
						"aria-label": `Rename ${p.name}`,
						onClick: () => setRenaming({
							id: p.id,
							name: p.name
						}),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "size-3.5" }), "Edit"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						type: "button",
						size: "sm",
						variant: "outline",
						disabled: remove.isPending,
						"aria-label": `Remove ${p.name}`,
						onClick: () => {
							if (window.confirm(`Remove “${p.name}” from Out of Network? Assigned accounts will drop this provider.`)) remove.mutate({
								id: p.id,
								name: p.name
							});
						},
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), "Remove"]
					})]
				})]
			}, p.id))
		}),
		!rows.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-4 text-sm text-muted-foreground",
			children: "No providers match."
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RenameDialog, {
			open: !!renaming,
			title: "Rename provider",
			noun: "provider",
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
function AccountsPane({ accounts, onOpen }) {
	const [q, setQ] = (0, import_react.useState)("");
	const [state, setState] = (0, import_react.useState)("");
	const states = (0, import_react.useMemo)(() => [...new Set(accounts.map((a) => a.state).filter(Boolean))].sort(), [accounts]);
	const rows = (0, import_react.useMemo)(() => {
		const needle = q.trim().toLowerCase();
		return accounts.filter((a) => {
			if (state && a.state !== state) return false;
			if (!needle) return true;
			return [
				a.customer,
				a.city,
				a.primary?.name,
				a.secondary?.name,
				a.region
			].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle));
		});
	}, [
		accounts,
		q,
		state
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-col gap-2 sm:flex-row",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative min-w-0 flex-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: q,
					onChange: (e) => setQ(e.target.value),
					placeholder: "Search accounts…",
					className: "pl-9"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
				className: "sm:w-28",
				value: state,
				onChange: (e) => setState(e.target.value),
				allowEmpty: true,
				emptyLabel: "State",
				children: states.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-4 divide-y divide-border rounded-xl border border-border bg-card",
			children: rows.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "px-4 py-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-start justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-medium",
							children: a.customer
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted-foreground",
							children: [
								a.city,
								a.state,
								a.zip
							].filter(Boolean).join(", ") || a.region || "Location TBD"
						}),
						a.equipment ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-0.5 line-clamp-1 text-xs text-muted-foreground",
							children: a.equipment
						}) : null
					] }), !a.primary ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
						variant: "warn",
						children: "Needs primary"
					}) : null]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-2 grid gap-2 md:grid-cols-2",
					children: [a.primary ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "text-left",
						onClick: () => onOpen(a.primary.id),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DispatchCard, {
							role: "primary",
							name: a.primary.name,
							phone: a.primary.dispatchPhone,
							email: a.primary.dispatchEmail,
							status: a.primary.status
						})
					}) : null, a.secondary ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "text-left",
						onClick: () => onOpen(a.secondary.id),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DispatchCard, {
							role: "secondary",
							name: a.secondary.name,
							phone: a.secondary.dispatchPhone,
							email: a.secondary.dispatchEmail,
							status: a.secondary.status
						})
					}) : null]
				})]
			}, a.id))
		}),
		!rows.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-4 text-sm text-muted-foreground",
			children: "No accounts match."
		}) : null
	] });
}
function CoveragePane({ byState, providers }) {
	const ranked = [...providers].sort((a, b) => b.primaryFor - a.primaryFor || a.name.localeCompare(b.name));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-4 lg:grid-cols-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "rounded-xl border border-border bg-card p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-xl",
					children: "Coverage by state"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-0.5 text-xs text-muted-foreground",
					children: "From the Accounts tab. Yellow means no primary tech."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "mt-3 w-full text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "text-left text-xs tracking-wide text-muted-foreground uppercase",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "py-1 font-medium",
								children: "State"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "py-1 font-medium",
								children: "Accounts"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "py-1 font-medium",
								children: "Unassigned"
							})
						]
					}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: byState.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "border-t border-border",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-1.5 font-medium",
								children: s.state
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-1.5 tabular",
								children: s.total
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: cn("py-1.5 tabular", s.unassigned ? "text-warning" : "text-muted-foreground"),
								children: s.unassigned
							})
						]
					}, s.state)) })]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "rounded-xl border border-border bg-card p-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-xl",
				children: "Accounts by provider"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 divide-y divide-border",
				children: ranked.filter((p) => p.primaryFor + p.secondaryFor > 0).map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-start justify-between gap-3 py-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-medium",
							children: p.name
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted-foreground",
							children: [p.dispatchPhone, p.dispatchEmail].filter(Boolean).join(" · ") || "No dispatch contact"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "shrink-0 text-xs text-muted-foreground",
						children: [
							p.primaryFor,
							" primary",
							p.secondaryFor ? ` · ${p.secondaryFor} backup` : ""
						]
					})]
				}, p.id))
			})]
		})]
	});
}
//#endregion
export { Page as component };
