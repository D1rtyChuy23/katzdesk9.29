import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { h as URGENCIES, n as CALL_TYPES, t as CALL_STATUSES } from "./lookups-BkjR5sto.mjs";
import { r as formatLongDate } from "./clock-CSFAgASg.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { K as updateJob, P as mergeServiceTickets, S as listAssets, V as unassignAssetFromService, p as createJob, y as getJob } from "./api-CgwyWugK.mjs";
import { t as SelectField } from "./select-field-BxGIjVBi.mjs";
import { i as UrgencyBadge, n as FlagBadge, r as StatusBadge, t as DuplicateBadge } from "./flag-badge-jup2uYzS.mjs";
import { a as Textarea, i as Label, n as Button, r as Input, t as AutoGrowTextarea } from "./input-COYCsX_T.mjs";
import { a as listedEquipment } from "./equipment-BifqoJpR.mjs";
import { a as SheetTitle, i as SheetHeader, n as SheetBody, r as SheetContent, t as Sheet } from "./sheet-CdZCIXqJ.mjs";
import { i as DialogTitle, n as DialogContent, r as DialogDescription, t as Dialog } from "./dialog-zUw3eso-.mjs";
import { r as TechSelect } from "./tech-select-BqrrlfqA.mjs";
import { i as EquipmentMultiCombo, n as CustomerCombo, o as useDirectory } from "./directory-fields-BvcLee-k.mjs";
import { r as ProviderDispatchBlock } from "./provider-dispatch-CwfIUm28.mjs";
import { t as Thread } from "./thread-y3SErmOf.mjs";
import { n as SerialPullField, t as SerialNoticeBanner } from "./serial-notice-DcwWIrgz.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/job-sheet-YEm7ew2R.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function JobSheet({ id, onClose }) {
	const qc = useQueryClient();
	const formRef = (0, import_react.useRef)(null);
	const skipToast = (0, import_react.useRef)(false);
	const [viewId, setViewId] = (0, import_react.useState)(id);
	(0, import_react.useEffect)(() => {
		setViewId(id);
	}, [id]);
	const activeId = viewId ?? id;
	const job = useQuery({
		queryKey: ["job", activeId],
		queryFn: () => getJob({ data: { id: activeId } }),
		enabled: activeId != null
	});
	const save = useMutation({
		mutationFn: (patch) => updateJob({ data: patch }),
		onSuccess: () => {
			if (!skipToast.current) toast.success("Saved");
			skipToast.current = false;
			qc.invalidateQueries({ queryKey: ["jobs"] });
			qc.invalidateQueries({ queryKey: ["job"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["activity"] });
			qc.invalidateQueries({ queryKey: ["customer-history"] });
			qc.invalidateQueries({ queryKey: ["customers"] });
		},
		onError: (e) => toast.error(e.message)
	});
	const merge = useMutation({
		mutationFn: (pair) => mergeServiceTickets({ data: pair }),
		onSuccess: (row) => {
			toast.success("Tickets merged");
			qc.invalidateQueries({ queryKey: ["jobs"] });
			qc.invalidateQueries({ queryKey: ["job"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["activity"] });
			qc.invalidateQueries({ queryKey: ["comments"] });
			qc.invalidateQueries({ queryKey: ["customer-history"] });
			if (row?.id) setViewId(row.id);
		},
		onError: (e) => toast.error(e.message)
	});
	const j = job.data;
	const pulledSerial = (useQuery({
		queryKey: ["assets"],
		queryFn: () => listAssets()
	}).data ?? []).find((a) => a.jobId === activeId)?.serial ?? "";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
		open: id != null,
		onOpenChange: (o) => {
			if (!o) {
				skipToast.current = true;
				formRef.current?.requestSubmit();
				onClose();
			}
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetContent, { children: j ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: [
					j.kind === "tlc" ? "TLC + Factor" : "Service call",
					" · ",
					j.callId
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, { children: j.customer ?? "Untitled account" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 flex flex-wrap gap-1.5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(UrgencyBadge, { urgency: j.urgency }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: j.status }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlagBadge, { flag: j.flag }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DuplicateBadge, {
						duplicateOf: j.duplicateOf,
						siblingCount: j.siblings?.length ?? 0
					})
				]
			})
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetBody, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SerialNoticeBanner, { notice: j.serialNotice }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DuplicateBanner, {
				job: j,
				pending: merge.isPending,
				onOpen: (nextId) => setViewId(nextId),
				onMergeIntoThis: (extraId) => merge.mutate({
					keeperId: j.id,
					extraId
				}),
				onMergeThisInto: (keeperId) => merge.mutate({
					keeperId,
					extraId: j.id
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				ref: formRef,
				className: "grid gap-3 border-b border-border p-5 sm:grid-cols-2",
				onSubmit: (e) => {
					e.preventDefault();
					const fd = new FormData(e.currentTarget);
					save.mutate({
						id: j.id,
						customer: String(fd.get("customer") ?? ""),
						contact: String(fd.get("contact") || "") || null,
						phone: String(fd.get("phone") || "") || null,
						equipment: String(fd.get("equipment") || "") || null,
						issue: String(fd.get("issue") || "") || null,
						workDone: String(fd.get("workDone") || "") || null,
						callType: String(fd.get("callType") || "") || null,
						status: String(fd.get("status")),
						technician: String(fd.get("technician") || "") || null,
						wo: String(fd.get("wo") || "") || null,
						scheduled: String(fd.get("scheduled") || "") || null,
						received: String(fd.get("received") || "") || null,
						completedAt: String(fd.get("completedAt") || "") || null,
						notes: String(fd.get("notes") || "") || null,
						urgency: String(fd.get("urgency") || "") || "Normal"
					});
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BoundCustomer, {
						defaultValue: j.customer ?? "",
						recordKey: j.id
					}),
					j.customer ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "sm:col-span-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProviderDispatchBlock, { customer: j.customer })
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Contact",
						name: "contact",
						defaultValue: j.contact ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Phone",
						name: "phone",
						defaultValue: j.phone ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "sm:col-span-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BoundEquipment, {
							defaultValue: j.equipment ?? "",
							recordKey: j.id
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SerialPullField, {
							label: "Serial number",
							value: pulledSerial,
							jobId: j.id,
							onValue: () => {}
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-xs text-muted-foreground",
							children: "Type a warehouse serial to pull that unit onto this ticket without opening Warehouse."
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "issue",
							children: "Issue"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AutoGrowTextarea, {
							id: "issue",
							name: "issue",
							defaultValue: j.issue ?? "",
							className: "mt-1",
							placeholder: "What’s going on…"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "workDone",
							children: "Description of work"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AutoGrowTextarea, {
							id: "workDone",
							name: "workDone",
							defaultValue: j.workDone ?? "",
							className: "mt-1",
							placeholder: "What was done on site…"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "urgency",
						children: "Urgency"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						id: "urgency",
						name: "urgency",
						className: "mt-1",
						defaultValue: j.urgency || "Normal",
						children: URGENCIES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Status" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "status",
						className: "mt-1",
						defaultValue: j.status,
						children: CALL_STATUSES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Type" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "callType",
						className: "mt-1",
						defaultValue: j.callType ?? "",
						allowEmpty: true,
						children: CALL_TYPES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Technician" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TechSelect, {
						name: "technician",
						defaultValue: j.technician ?? ""
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "WO #",
						name: "wo",
						defaultValue: j.wo ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Received",
						name: "received",
						type: "date",
						defaultValue: j.received ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Scheduled",
						name: "scheduled",
						type: "date",
						defaultValue: j.scheduled ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Date completed",
						name: "completedAt",
						type: "date",
						defaultValue: j.completedAt ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "notes",
							children: "Notes"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							id: "notes",
							name: "notes",
							className: "mt-1",
							defaultValue: j.notes ?? ""
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-xs text-muted-foreground",
							children: [
								"Received ",
								formatLongDate(j.received),
								j.ageDays != null ? ` · ${j.ageDays}d open` : ""
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							size: "sm",
							disabled: save.isPending,
							children: "Save"
						})]
					})
				]
			}, j.id),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(JobPulledUnits, { jobId: j.id }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Thread, {
				entityType: j.kind,
				entityId: j.id
			})
		] })] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "p-8 text-sm text-muted-foreground",
			children: "Loading…"
		}) })
	});
}
function DuplicateBanner({ job, pending, onOpen, onMergeIntoThis, onMergeThisInto }) {
	if (job.duplicateOf) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "border-b border-warning/30 bg-warning/10 px-5 py-3 text-sm",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-medium",
				children: "This ticket was merged into another call with the same ST#."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-muted-foreground",
				children: "The original keeps the notes, work, and history. Open that ticket to keep working it."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-2 flex flex-wrap gap-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					size: "sm",
					variant: "outline",
					onClick: () => onOpen(job.duplicateOf),
					children: "Open original"
				})
			})
		]
	});
	if (!job.siblings?.length) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "border-b border-warning/30 bg-warning/10 px-5 py-3 text-sm",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-medium",
				children: "Same ST# is already on another ticket."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-muted-foreground",
				children: "Corrigo uses one work order. Merge if these are the same call, or leave both if they are different accounts that reused the number."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-2 space-y-2",
				children: job.siblings.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "rounded-lg border border-border bg-card px-3 py-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-medium",
							children: s.customer || "Untitled"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-xs text-muted-foreground",
							children: [
								s.callId,
								s.wo ? ` · ${s.wo}` : "",
								s.kind === "tlc" ? " · TLC / Factor" : "",
								` · ${s.status}`
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-2 flex flex-wrap gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									type: "button",
									size: "sm",
									variant: "outline",
									onClick: () => onOpen(s.id),
									children: "Open"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									type: "button",
									size: "sm",
									variant: "outline",
									disabled: pending,
									onClick: () => onMergeIntoThis(s.id),
									children: "Merge into this"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									type: "button",
									size: "sm",
									variant: "ghost",
									disabled: pending,
									onClick: () => onMergeThisInto(s.id),
									children: "Merge this into the other"
								})
							]
						})
					]
				}, s.id))
			})
		]
	});
}
function Field({ label, name, defaultValue, type = "text" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
		htmlFor: name,
		children: label
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
		id: name,
		name,
		type,
		defaultValue,
		autoComplete: "off",
		className: "mt-1"
	})] });
}
function JobPulledUnits({ jobId }) {
	const qc = useQueryClient();
	const pulled = (useQuery({
		queryKey: ["assets"],
		queryFn: () => listAssets()
	}).data ?? []).filter((a) => a.jobId === jobId);
	const release = useMutation({
		mutationFn: (assetId) => unassignAssetFromService({ data: { assetId } }),
		onSuccess: () => {
			toast.success("Returned to the barn");
			qc.invalidateQueries({ queryKey: ["assets"] });
			qc.invalidateQueries({ queryKey: ["jobs"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not return")
	});
	if (!pulled.length) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "border-b border-border bg-muted/40 p-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-xs tracking-wide text-muted-foreground uppercase",
			children: "Pulled from warehouse"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-2 space-y-1",
			children: pulled.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex items-center justify-between gap-2 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "min-w-0 truncate",
					children: [
						a.model,
						" · ",
						a.serial ?? "no serial"
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "inline-flex h-8 shrink-0 items-center rounded-md px-2 text-xs text-muted-foreground hover:bg-background hover:text-foreground",
					disabled: release.isPending,
					onClick: () => release.mutate(a.id),
					children: "Return to barn"
				})]
			}, a.id))
		})]
	});
}
function NewJobDialog({ kind, open, onOpenChange, onCreated }) {
	const qc = useQueryClient();
	const [customer, setCustomer] = (0, import_react.useState)("");
	const [issue, setIssue] = (0, import_react.useState)("");
	const [equipment, setEquipment] = (0, import_react.useState)([]);
	const [urgency, setUrgency] = (0, import_react.useState)("Normal");
	const create = useMutation({
		mutationFn: () => createJob({ data: {
			kind,
			customer,
			issue,
			urgency,
			equipment: equipment.length ? equipment.join("\n") : void 0,
			received: void 0
		} }),
		onSuccess: (job) => {
			toast.success("Call opened");
			qc.invalidateQueries({ queryKey: ["jobs"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			onOpenChange(false);
			setCustomer("");
			setIssue("");
			setEquipment([]);
			setUrgency("Normal");
			if (job?.id) onCreated(job.id);
		},
		onError: (e) => toast.error(e.message)
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogTitle, { children: [
				"New ",
				kind === "tlc" ? "TLC + Factor" : "service",
				" call"
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, { children: "Opens on today’s clock. Fill the rest in the drawer." }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-4 space-y-3",
				onSubmit: (e) => {
					e.preventDefault();
					if (customer.trim()) create.mutate();
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "new-cust",
						children: "Account / customer"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-1",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerCombo, {
							label: "",
							name: "new-cust",
							value: customer,
							onChange: setCustomer,
							required: true
						})
					})] }),
					customer.trim() ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProviderDispatchBlock, { customer }) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "new-issue",
						children: "Issue"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AutoGrowTextarea, {
						id: "new-issue",
						className: "mt-1",
						value: issue,
						onChange: (e) => setIssue(e.target.value),
						placeholder: "What’s going on…"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EquipmentMultiCombo, {
						label: "Equipment",
						values: equipment,
						onChange: setEquipment,
						placeholder: "Add one or more machines…"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "new-urgency",
						children: "Urgency"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						id: "new-urgency",
						className: "mt-1",
						value: urgency,
						onChange: (e) => setUrgency(e.target.value),
						children: URGENCIES.map((u) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: u }, u))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex justify-end",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							disabled: create.isPending || !customer.trim(),
							children: "Open call"
						})
					})
				]
			})
		] })
	});
}
function BoundCustomer({ recordKey, defaultValue }) {
	const [value, setValue] = (0, import_react.useState)(defaultValue);
	(0, import_react.useEffect)(() => {
		setValue(defaultValue);
	}, [recordKey, defaultValue]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerCombo, {
		name: "customer",
		value,
		onChange: setValue
	});
}
function BoundEquipment({ recordKey, defaultValue }) {
	const catalog = useDirectory("equipment").items.map((i) => i.name);
	const catalogKey = catalog.join("\n");
	const [values, setValues] = (0, import_react.useState)(() => catalog.length ? listedEquipment(defaultValue, catalog) : defaultValue.split(/\r?\n/).map((s) => s.trim()).filter(Boolean));
	(0, import_react.useEffect)(() => {
		setValues(catalog.length ? listedEquipment(defaultValue, catalog) : defaultValue.split(/\r?\n/).map((s) => s.trim()).filter(Boolean));
	}, [
		recordKey,
		defaultValue,
		catalogKey
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EquipmentMultiCombo, {
		name: "equipment",
		values,
		onChange: setValues,
		placeholder: "Add one or more machines…"
	});
}
//#endregion
export { NewJobDialog as n, JobSheet as t };
