import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { r as createServerFn } from "./ssr.mjs";
import { g as URGENCY_RANK, h as URGENCIES, r as CLOSED_CALL } from "./lookups-BkjR5sto.mjs";
import { o as formatShortDate } from "./clock-CSFAgASg.mjs";
import { A as boolean, D as _enum, F as object, P as number, R as string, k as array } from "../_libs/@better-auth/core+[...].mjs";
import { a as deskMiddleware, r as createSsrRpc } from "./access-3Tz151bB.mjs";
import { b as Plus, o as Upload } from "../_libs/lucide-react.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { g as useMyView, h as MyViewBar } from "./router-1NWxggZt.mjs";
import { k as listJobs } from "./api-CgwyWugK.mjs";
import { t as OpenLink } from "./open-link-oQ0V2s2m.mjs";
import { t as SelectField } from "./select-field-BxGIjVBi.mjs";
import { d as sortDesk, f as tally, l as SortSelect, o as SORT_LIST, p as useDeskSort, u as equipmentCount } from "./sort-1yS_DCzE.mjs";
import { i as UrgencyBadge, n as FlagBadge, r as StatusBadge, t as DuplicateBadge } from "./flag-badge-jup2uYzS.mjs";
import { n as Button, r as Input } from "./input-COYCsX_T.mjs";
import { t as AkBadge } from "./ak-badge-m29_U4_Z.mjs";
import { i as SimpleBars, o as StatCard, s as StatusDonut, t as ChartCard } from "./desk-charts-BMK8dv-e.mjs";
import { i as DialogTitle, n as DialogContent, r as DialogDescription, t as Dialog } from "./dialog-zUw3eso-.mjs";
import { n as TechName, t as TechFilter } from "./tech-select-BqrrlfqA.mjs";
import { t as ExportButton } from "./export-dialog-BGDRoctb.mjs";
import { i as isWalkIn } from "./corrigo-BiVK0F9F.mjs";
import { o as useDirectory, t as ComboField } from "./directory-fields-BvcLee-k.mjs";
import { n as NewJobDialog, t as JobSheet } from "./job-sheet-YEm7ew2R.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/jobs-page-B7dKK7Eh.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var fileInput = object({
	filename: string(),
	base64: string().min(8)
});
var previewCorrigoImport = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => fileInput.parse(d)).handler(createSsrRpc("cb407fb7ef362f72a49afa1c56076478d9a7ed1b36aa226ad00fcb269aa999af"));
var applyRow = object({
	wo: string(),
	rawWo: string().optional(),
	matchKey: string().optional(),
	canonicalWo: string().optional(),
	matchNote: string().nullable().optional(),
	customer: string().nullable(),
	fileCustomer: string().nullable().optional(),
	existingCustomer: string().nullable().optional(),
	fileWalkIn: boolean().optional(),
	action: _enum([
		"update",
		"create",
		"skip"
	]),
	board: _enum([
		"service",
		"tlc",
		"pm",
		"install"
	]).optional(),
	boardLabel: string().nullable().optional(),
	jobId: number().nullable(),
	oldStatus: string().nullable(),
	newStatus: string(),
	statusUnmapped: string().nullable(),
	technician: string().nullable(),
	completedAt: string().nullable(),
	workDone: string().nullable(),
	issue: string().nullable(),
	wrapRepeat: boolean().optional(),
	conflictIds: array(object({
		board: _enum([
			"service",
			"tlc",
			"pm",
			"install"
		]),
		id: number()
	})).nullable().optional()
});
var applyInput = object({ rows: array(applyRow) });
var applyCorrigoImport = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => applyInput.parse(d)).handler(createSsrRpc("83cefe8461678b9a0f02a18d7b2aafb95f7e5ee20ca52438886169976cc838f8"));
function fileToBase64(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(/* @__PURE__ */ new Error("Could not read that file."));
		reader.onload = () => {
			const result = String(reader.result ?? "");
			const comma = result.indexOf(",");
			resolve(comma >= 0 ? result.slice(comma + 1) : result);
		};
		reader.readAsDataURL(file);
	});
}
function CorrigoImportButton({ onImported }) {
	const qc = useQueryClient();
	const inputRef = (0, import_react.useRef)(null);
	const [open, setOpen] = (0, import_react.useState)(false);
	const [fileName, setFileName] = (0, import_react.useState)("");
	const [preview, setPreview] = (0, import_react.useState)(null);
	const load = useMutation({
		mutationFn: async (file) => {
			const base64 = await fileToBase64(file);
			return previewCorrigoImport({ data: {
				filename: file.name,
				base64
			} });
		},
		onSuccess: (data, file) => {
			setFileName(file.name);
			setPreview(data);
			setOpen(true);
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not read the report")
	});
	const apply = useMutation({
		mutationFn: (rows) => applyCorrigoImport({ data: { rows } }),
		onSuccess: (res) => {
			toast.success(`Corrigo import saved · ${res.updated} updated · ${res.created} created`);
			setOpen(false);
			setPreview(null);
			onImported(res.review);
			qc.invalidateQueries({ queryKey: ["jobs"] });
			qc.invalidateQueries({ queryKey: ["job"] });
			qc.invalidateQueries({ queryKey: ["pms"] });
			qc.invalidateQueries({ queryKey: ["installs"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["customers"] });
			qc.invalidateQueries({ queryKey: ["customer-history"] });
			qc.invalidateQueries({ queryKey: ["activity"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not import")
	});
	function cancel() {
		setOpen(false);
		setPreview(null);
		setFileName("");
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			ref: inputRef,
			type: "file",
			accept: ".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv",
			className: "sr-only",
			onChange: (e) => {
				const file = e.target.files?.[0];
				e.target.value = "";
				if (file) load.mutate(file);
			}
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
			type: "button",
			variant: "outline",
			disabled: load.isPending,
			onClick: () => inputRef.current?.click(),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-4" }), load.isPending ? "Reading…" : "Import Corrigo report"]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
			open,
			onOpenChange: (v) => v ? setOpen(true) : cancel(),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
				className: "max-h-[90vh] max-w-5xl overflow-y-auto",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Corrigo import" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogDescription, { children: [fileName ? `${fileName} · ` : "", "Corrigo is the source of truth for service. Confirm before anything is written. Notes and sales fields stay as they are. Unchecked rows are skipped."] }),
					preview ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewBody, {
						preview,
						pending: apply.isPending,
						onCancel: cancel,
						onConfirm: (rows) => apply.mutate(rows)
					}) : null
				]
			})
		})
	] });
}
function rowKey(row) {
	return row.matchKey || row.canonicalWo || row.wo;
}
function draftFor(row) {
	return {
		selected: row.action === "update" || row.action === "create",
		customer: row.customer ?? "",
		keepWalkIn: false
	};
}
function PreviewBody({ preview, pending, onCancel, onConfirm }) {
	const [drafts, setDrafts] = (0, import_react.useState)(() => {
		const next = {};
		for (const row of preview.rows) next[rowKey(row)] = draftFor(row);
		return next;
	});
	const selectAllRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const next = {};
		for (const row of preview.rows) next[rowKey(row)] = draftFor(row);
		setDrafts(next);
	}, [preview]);
	const applicable = preview.rows.filter((r) => r.action === "update" || r.action === "create");
	const selectedUpdates = applicable.filter((r) => drafts[rowKey(r)]?.selected && r.action === "update").length;
	const selectedCreates = applicable.filter((r) => drafts[rowKey(r)]?.selected && r.action === "create").length;
	const unchecked = applicable.filter((r) => !drafts[rowKey(r)]?.selected).length;
	const selectedCount = selectedUpdates + selectedCreates;
	const allSelected = applicable.length > 0 && selectedCount === applicable.length;
	const someSelected = selectedCount > 0 && !allSelected;
	(0, import_react.useEffect)(() => {
		if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
	}, [someSelected]);
	const walkInBlocked = applicable.filter((r) => {
		const d = drafts[rowKey(r)];
		if (!d?.selected) return false;
		if (!r.fileWalkIn) return false;
		if (d.keepWalkIn) return false;
		const name = d.customer.trim();
		return !name || isWalkIn(name);
	});
	function patch(key, next) {
		setDrafts((cur) => {
			const prev = cur[key] ?? {
				selected: false,
				customer: "",
				keepWalkIn: false
			};
			return {
				...cur,
				[key]: {
					...prev,
					...next
				}
			};
		});
	}
	function setAll(selected) {
		setDrafts((cur) => {
			const next = { ...cur };
			for (const row of applicable) {
				const key = rowKey(row);
				next[key] = {
					...next[key] ?? draftFor(row),
					selected
				};
			}
			return next;
		});
	}
	function confirm() {
		if (walkInBlocked.length || selectedCount === 0) return;
		onConfirm(preview.rows.map((row) => {
			const d = drafts[rowKey(row)];
			if (!(row.action === "update" || row.action === "create") || !d?.selected) return {
				...row,
				action: "skip"
			};
			const customer = d.keepWalkIn ? "Walk-In" : d.customer.trim() || row.customer;
			return {
				...row,
				customer
			};
		}));
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
				className: "grid gap-2 text-sm sm:grid-cols-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "rounded-lg border border-border bg-muted/40 px-3 py-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium",
							children: selectedUpdates
						}), " selected to update"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "rounded-lg border border-border bg-muted/40 px-3 py-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium",
							children: selectedCreates
						}), " selected to create"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "rounded-lg border border-border bg-muted/40 px-3 py-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium",
							children: unchecked
						}), " unchecked (will skip)"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "rounded-lg border border-border bg-muted/40 px-3 py-2",
						children: preview.unmapped.length ? `${preview.unmapped.length} unmapped status${preview.unmapped.length === 1 ? "" : "es"}` : "No unmapped statuses"
					})
				]
			}),
			preview.wrapCount ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-3 text-xs text-muted-foreground",
				children: [
					preview.wrapCount,
					" ST#",
					preview.wrapCount === 1 ? "" : "s",
					" reused a number after WO-9999 — those stay on For review so nobody merges two different jobs",
					preview.conflictCount ? ` · ${preview.conflictCount} already on more than one ticket` : "",
					preview.skipped ? ` · ${preview.skipped} row${preview.skipped === 1 ? "" : "s"} with no ST#` : "",
					"."
				]
			}) : preview.conflictCount ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-3 text-xs text-muted-foreground",
				children: [
					preview.conflictCount,
					" WO conflict",
					preview.conflictCount === 1 ? "" : "s",
					" already on more than one ticket — import updates the original and flags the rest to merge",
					preview.skipped ? ` · ${preview.skipped} row${preview.skipped === 1 ? "" : "s"} with no ST#` : "",
					"."
				]
			}) : preview.skipped ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-3 text-xs text-muted-foreground",
				children: [
					preview.skipped,
					" row",
					preview.skipped === 1 ? "" : "s",
					" with no ST#."
				]
			}) : null,
			preview.unmapped.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-3 text-xs text-muted-foreground",
				children: [
					"Unmapped: ",
					preview.unmapped.join(", "),
					". Existing tickets keep their KatzDesk status; new tickets open as Open."
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex flex-wrap items-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						size: "sm",
						variant: "outline",
						onClick: () => setAll(true),
						children: "Select all"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						size: "sm",
						variant: "outline",
						onClick: () => setAll(false),
						children: "Deselect all"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted-foreground",
						children: "Uncheck any ticket you do not want to change. Walk-In rows need a real customer, or Keep as Walk-In."
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 overflow-visible rounded-xl border border-border",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full min-w-[52rem] text-left text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
						className: "sticky top-0 bg-card text-[11px] font-medium tracking-wide text-muted-foreground uppercase",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "w-10 px-3 py-2",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									ref: selectAllRef,
									type: "checkbox",
									className: "size-4 accent-primary",
									checked: allSelected,
									disabled: !applicable.length,
									"aria-label": "Select all",
									onChange: (e) => setAll(e.target.checked)
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-3 py-2",
								children: "ST#"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-3 py-2",
								children: "Customer"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-3 py-2",
								children: "Status"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-3 py-2",
								children: "Tech"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-3 py-2",
								children: "Completed"
							})
						] })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [preview.rows.map((r) => {
						const key = rowKey(r);
						const d = drafts[key] ?? draftFor(r);
						const locked = r.action === "skip";
						const walkIn = r.fileWalkIn;
						const needsCustomer = !locked && d.selected && walkIn && !d.keepWalkIn && (!d.customer.trim() || isWalkIn(d.customer));
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: `border-t border-border ${walkIn ? "bg-warning/10" : ""} ${locked ? "opacity-70" : ""}`,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-3 py-2 align-top",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "checkbox",
										className: "mt-1 size-4 accent-primary",
										checked: !!d.selected && !locked,
										disabled: locked || pending,
										"aria-label": `Import ${r.canonicalWo || r.wo}`,
										onChange: (e) => patch(key, { selected: e.target.checked })
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									className: "px-3 py-2 align-top font-medium",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "whitespace-nowrap",
											children: r.canonicalWo || r.wo
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "mt-0.5 block text-[11px] font-normal tracking-wide text-muted-foreground uppercase",
											children: [r.action, r.boardLabel ? ` · ${r.boardLabel}` : ""]
										}),
										r.matchNote ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "mt-0.5 block text-[11px] font-normal normal-case tracking-normal text-muted-foreground",
											children: r.matchNote
										}) : null,
										r.wrapRepeat ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "mt-0.5 block text-[11px] font-normal tracking-wide text-warning uppercase",
											children: "Repeated after 9999"
										}) : null,
										r.conflictIds?.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "mt-0.5 block text-[11px] font-normal normal-case tracking-normal text-muted-foreground",
											children: [
												"also on ",
												r.conflictIds.map((c) => `${c.board} #${c.id}`).join(", "),
												" (conflict — will flag)"
											]
										}) : null,
										walkIn ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "mt-0.5 block text-[11px] font-normal tracking-wide text-warning uppercase",
											children: "Walk-In"
										}) : null
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "min-w-[16rem] px-3 py-2 align-top",
									children: locked ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: d.customer || r.customer || "—" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImportCustomerPicker, {
										value: d.keepWalkIn ? "Walk-In" : d.customer,
										walkIn,
										keepWalkIn: d.keepWalkIn,
										needsCustomer,
										existingCustomer: r.existingCustomer,
										disabled: pending,
										onChange: (customer) => patch(key, {
											customer,
											keepWalkIn: isWalkIn(customer) ? d.keepWalkIn : false
										}),
										onKeepWalkIn: () => patch(key, {
											keepWalkIn: true,
											customer: "Walk-In"
										}),
										onClearKeep: () => patch(key, {
											keepWalkIn: false,
											customer: ""
										})
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									className: "px-3 py-2 align-top",
									children: [r.oldStatus ? `${r.oldStatus} → ${r.newStatus}` : r.newStatus, r.statusUnmapped ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "mt-0.5 block text-[11px] text-muted-foreground",
										children: ["unmapped: ", r.statusUnmapped]
									}) : null]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-3 py-2 align-top",
									children: r.technician || "—"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-3 py-2 align-top whitespace-nowrap",
									children: r.completedAt || "—"
								})
							]
						}, key);
					}), preview.rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						colSpan: 6,
						className: "px-3 py-6 text-muted-foreground",
						children: "Nothing to import."
					}) }) : null] })]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex flex-wrap items-center justify-end gap-2",
				children: [
					walkInBlocked.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mr-auto max-w-md text-xs text-warning",
						children: [
							walkInBlocked.length,
							" Walk-In row",
							walkInBlocked.length === 1 ? "" : "s",
							" still need a KatzDesk customer, or Keep as Walk-In."
						]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						variant: "outline",
						disabled: pending,
						onClick: onCancel,
						children: "Cancel"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						disabled: pending || selectedCount === 0 || walkInBlocked.length > 0,
						onClick: confirm,
						children: pending ? "Saving…" : "Confirm import"
					})
				]
			})
		]
	});
}
function ImportCustomerPicker({ value, walkIn, keepWalkIn, needsCustomer, existingCustomer, disabled, onChange, onKeepWalkIn, onClearKeep }) {
	const dir = useDirectory("customer");
	const items = (0, import_react.useMemo)(() => dir.items.filter((i) => !isWalkIn(i.name)), [dir.items]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ComboField, {
			value: keepWalkIn ? "Walk-In" : value,
			onChange,
			items,
			placeholder: walkIn && !keepWalkIn ? "Pick a customer…" : "Search customers…",
			allowCreate: false,
			disabled: disabled || keepWalkIn,
			noun: "customer",
			emptyHint: "No customer matches. Type to search the list."
		}), walkIn ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-1 flex flex-wrap items-center gap-2",
			children: [keepWalkIn ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "text-xs text-muted-foreground underline-offset-2 hover:underline",
				onClick: onClearKeep,
				children: "Choose a customer instead"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "text-xs text-muted-foreground underline-offset-2 hover:underline",
				onClick: onKeepWalkIn,
				children: "Keep as Walk-In"
			}), existingCustomer && !isWalkIn(existingCustomer) ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "text-xs text-muted-foreground",
				children: ["Now: ", existingCustomer]
			}) : needsCustomer ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-xs text-warning",
				children: "Pick an account"
			}) : null]
		}) : null]
	});
}
function CorrigoReviewList({ items, onDismiss }) {
	if (!items.length) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "mt-5 rounded-xl border border-border bg-card p-4 sm:p-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-start justify-between gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: "For review"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-muted-foreground",
				children: "Open work from the last Corrigo file, plus ST#s that reused a number after WO-9999."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				type: "button",
				size: "sm",
				variant: "outline",
				onClick: onDismiss,
				children: "Clear"
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border",
			children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(OpenLink, {
				entityType: item.entityType,
				id: item.id,
				className: "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted/60",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "min-w-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block truncate font-medium",
						children: item.customer || "Untitled"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "block truncate text-xs text-muted-foreground",
						children: [
							item.wo,
							item.entityType && item.entityType !== "service" ? ` · ${item.entityType}` : "",
							item.technician ? ` · ${item.technician}` : "",
							item.reason === "wrap" ? " · repeated after 9999" : ""
						]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "shrink-0 text-xs text-muted-foreground",
					children: item.reason === "wrap" && !/open|dispatch|progress|follow/i.test(item.status) ? "Review" : item.status
				})]
			}) }, `${item.entityType}-${item.id}`))
		})]
	});
}
function JobsPage({ kind, title, lede, initialOpen }) {
	const jobs = useQuery({
		queryKey: ["jobs", kind],
		queryFn: () => listJobs({ data: { kind } })
	});
	const { filterMine, matchMine, role } = useMyView();
	const [q, setQ] = (0, import_react.useState)("");
	const [tech, setTech] = (0, import_react.useState)("");
	const [urgency, setUrgency] = (0, import_react.useState)("");
	const [view, setView] = (0, import_react.useState)("active");
	const [openId, setOpenId] = (0, import_react.useState)(initialOpen ?? null);
	(0, import_react.useEffect)(() => {
		if (initialOpen != null) setOpenId(initialOpen);
	}, [initialOpen]);
	const [create, setCreate] = (0, import_react.useState)(false);
	const [review, setReview] = (0, import_react.useState)([]);
	const [sort, setSort] = useDeskSort(`jobs-${kind}`, "flag");
	const rows = (0, import_react.useMemo)(() => {
		let list = jobs.data ?? [];
		if (view === "active") list = list.filter((j) => !j.duplicateOf && !CLOSED_CALL.has(j.status) && !j.done);
		if (view === "flagged") list = list.filter((j) => j.flag || j.duplicateOf || (j.siblings?.length ?? 0) > 0);
		if (tech) list = list.filter((j) => j.technician === tech);
		if (filterMine && role === "service") list = list.filter((j) => matchMine(j.technician) || !j.technician);
		if (urgency) list = list.filter((j) => j.urgency === urgency);
		const needle = q.trim().toLowerCase();
		if (needle) list = list.filter((j) => [
			j.customer,
			j.callId,
			j.wo,
			j.issue,
			j.equipment,
			j.technician
		].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle)));
		return sortDesk(list, sort, {
			date: (j) => j.received ?? j.scheduled,
			name: (j) => j.customer,
			equipment: (j) => equipmentCount(j.equipment),
			status: (j) => j.status,
			flagRank: (j) => (j.flag ? j.flag.rank : 50) + (URGENCY_RANK[j.urgency] ?? 2) / 10,
			tech: (j) => j.technician
		});
	}, [
		jobs.data,
		q,
		tech,
		urgency,
		view,
		sort,
		filterMine,
		matchMine,
		role
	]);
	const liveJobs = (jobs.data ?? []).filter((j) => !j.duplicateOf);
	const activeCount = liveJobs.filter((j) => !CLOSED_CALL.has(j.status) && !j.done).length;
	const flagCount = (jobs.data ?? []).filter((j) => j.flag || j.duplicateOf || (j.siblings?.length ?? 0) > 0).length;
	const allJobs = liveJobs;
	const activeJobs = allJobs.filter((j) => !CLOSED_CALL.has(j.status) && !j.done);
	const statusMix = tally(activeJobs, (j) => j.status);
	const techMix = tally(activeJobs.filter((j) => j.technician), (j) => j.technician);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-medium tracking-tight",
				children: title
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-xl text-sm text-muted-foreground",
				children: lede
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MyViewBar, {}),
					kind === "service" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CorrigoImportButton, { onImported: setReview }) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExportButton, { defaultType: kind === "tlc" ? "tlc" : "pending" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						onClick: () => setCreate(true),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "New call"]
					})
				]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 grid min-w-0 gap-3 md:grid-cols-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Active",
					value: activeCount,
					hint: `${allJobs.length} in history`
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Flagged",
					value: flagCount,
					tone: flagCount ? "danger" : void 0,
					hint: kind === "service" ? "48-hour clock" : "2-week clock"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Unassigned",
					value: activeJobs.filter((j) => !j.technician).length,
					hint: "Active calls with no tech"
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-5 grid min-w-0 gap-4 lg:grid-cols-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartCard, {
				title: "Active by status",
				lede: "Where this board sits right now.",
				children: statusMix.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusDonut, {
					data: statusMix,
					unit: "active"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "No active calls."
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartCard, {
				title: "On the truck",
				lede: "Active calls per technician.",
				children: techMix.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleBars, {
					data: techMix.map((t) => ({
						tech: t.name,
						count: t.count
					})),
					xKey: "tech",
					yKey: "count",
					yLabel: "Calls",
					horizontal: true
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "Nobody assigned yet."
				})
			})]
		}),
		kind === "service" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CorrigoReviewList, {
			items: review,
			onDismiss: () => setReview([])
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 flex flex-wrap items-center gap-2",
			children: [
				[
					"active",
					"flagged",
					"all"
				].map((v) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setView(v),
					className: `h-9 rounded-full px-3 text-sm font-medium ${view === v ? "bg-ink text-ink-foreground" : "bg-secondary text-foreground"}`,
					children: v === "active" ? `Active (${activeCount})` : v === "flagged" ? `Flagged (${flagCount})` : "All history"
				}, v)),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: q,
					onChange: (e) => setQ(e.target.value),
					placeholder: "Filter this list…",
					className: "max-w-xs"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TechFilter, {
					value: tech,
					onChange: setTech,
					extraNames: (jobs.data ?? []).map((j) => j.technician)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
					value: urgency,
					onChange: (e) => setUrgency(e.target.value),
					allowEmpty: true,
					emptyLabel: "All urgency",
					className: "w-40",
					"aria-label": "Filter by urgency",
					children: URGENCIES.map((u) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: u }, u))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
					value: sort,
					onChange: setSort,
					options: SORT_LIST
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-4 overflow-x-auto rounded-xl border border-border bg-card",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 md:min-w-[52rem]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "hidden grid-cols-[1.4fr_1fr_6rem_7rem_7rem_7rem_6rem] gap-3 border-b border-border px-4 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase md:grid",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Account" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Why it matters" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Urgency" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Status" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Received" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Scheduled" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Tech" })
					]
				}), jobs.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "px-4 py-8 text-sm text-muted-foreground",
					children: "Loading calls…"
				}) : rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "px-4 py-8 text-sm text-muted-foreground",
					children: "Nothing in this view."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: rows.map((j) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(JobRow, {
					job: j,
					onOpen: () => setOpenId(j.id)
				}, j.id)) })]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(JobSheet, {
			id: openId,
			onClose: () => setOpenId(null)
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NewJobDialog, {
			kind,
			open: create,
			onOpenChange: setCreate,
			onCreated: (id) => setOpenId(id)
		})
	] });
}
function JobRow({ job, onOpen }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick: onOpen,
		className: "grid w-full gap-1 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/60 md:grid-cols-[1.4fr_1fr_6rem_7rem_7rem_7rem_6rem] md:items-center md:gap-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "block font-medium",
					children: [
						job.customer ?? "Untitled",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AkBadge, {
							on: job.aviKatz,
							className: "ml-1 align-middle"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "text-xs text-muted-foreground",
					children: [
						job.callId,
						job.wo ? ` · ${job.wo}` : "",
						job.issue ? ` · ${job.issue}` : ""
					]
				}),
				job.equipment ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "mt-0.5 block text-xs text-muted-foreground",
					children: job.equipment.replace(/\r?\n/g, " · ")
				}) : null
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "flex flex-wrap gap-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DuplicateBadge, {
						duplicateOf: job.duplicateOf,
						siblingCount: job.siblings?.length ?? 0
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlagBadge, { flag: job.flag }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "md:hidden",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UrgencyBadge, { urgency: job.urgency })
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "hidden md:block",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UrgencyBadge, { urgency: job.urgency })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: job.status }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "tabular text-sm text-muted-foreground",
				children: formatShortDate(job.received)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "tabular text-sm text-muted-foreground",
				children: formatShortDate(job.scheduled)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-sm",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TechName, { name: job.technician })
			})
		]
	}) });
}
//#endregion
export { JobsPage as t };
