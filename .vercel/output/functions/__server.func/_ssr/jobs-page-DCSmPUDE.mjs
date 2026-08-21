import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { l as Plus } from "../_libs/lucide-react.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Button } from "./button-6ZsGYj3J.mjs";
import { R as updateJob, T as listJobs, _ as getJob, f as createJob } from "./api-B23zb1CT.mjs";
import { i as SheetTitle, n as SheetContent, r as SheetHeader, t as Sheet } from "./sheet-CqTk9YRH.mjs";
import { _ as URGENCIES, g as TECHNICIANS, n as CALL_TYPES, r as CLOSED_CALL, t as CALL_STATUSES, v as URGENCY_RANK } from "./lookups-sAI9gyB5.mjs";
import { i as formatShortDate, r as formatLongDate } from "./clock-CDIQNAok.mjs";
import { d as equipmentCount, f as sortDesk, l as SelectField, m as useDeskSort, o as SORT_LIST, p as tally, u as SortSelect } from "./sort-C5YlOVRH.mjs";
import { n as Label, r as Textarea, t as Input } from "./input-D-eo25vp.mjs";
import { a as SimpleBars, c as StatusBadge, l as StatusDonut, n as FlagBadge, s as StatCard, t as ChartCard, u as UrgencyBadge } from "./desk-charts-BV1SUC0s.mjs";
import { a as Thread, i as DialogTitle, n as DialogContent, r as DialogDescription, t as Dialog } from "./thread-BhKV-CeC.mjs";
import { n as EquipmentCombo, t as CustomerCombo } from "./directory-fields-Bs08Xp2k.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/jobs-page-DCSmPUDE.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function JobSheet({ id, onClose }) {
	const qc = useQueryClient();
	const job = useQuery({
		queryKey: ["job", id],
		queryFn: () => getJob({ data: { id } }),
		enabled: id != null
	});
	const save = useMutation({
		mutationFn: (patch) => updateJob({ data: patch }),
		onSuccess: () => {
			toast.success("Saved");
			qc.invalidateQueries({ queryKey: ["jobs"] });
			qc.invalidateQueries({ queryKey: ["job", id] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		},
		onError: (e) => toast.error(e.message)
	});
	const j = job.data;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
		open: id != null,
		onOpenChange: (o) => !o && onClose(),
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
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlagBadge, { flag: j.flag })
				]
			})
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid min-h-0 flex-1 grid-rows-[auto_1fr] overflow-hidden",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
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
						callType: String(fd.get("callType") || "") || null,
						status: String(fd.get("status")),
						technician: String(fd.get("technician") || "") || null,
						wo: String(fd.get("wo") || "") || null,
						scheduled: String(fd.get("scheduled") || "") || null,
						received: String(fd.get("received") || "") || null,
						notes: String(fd.get("notes") || "") || null,
						urgency: String(fd.get("urgency") || "") || "Normal"
					});
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BoundCustomer, {
						defaultValue: j.customer ?? "",
						recordKey: j.id
					}),
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
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BoundEquipment, {
						defaultValue: j.equipment ?? "",
						recordKey: j.id
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "issue",
							children: "Issue"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "issue",
							name: "issue",
							defaultValue: j.issue ?? "",
							className: "mt-1"
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
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Technician" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "technician",
						className: "mt-1",
						defaultValue: j.technician ?? "",
						allowEmpty: true,
						children: TECHNICIANS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
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
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Thread, {
				entityType: j.kind,
				entityId: j.id
			})]
		})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "p-8 text-sm text-muted-foreground",
			children: "Loading…"
		}) })
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
function NewJobDialog({ kind, open, onOpenChange, onCreated }) {
	const qc = useQueryClient();
	const [customer, setCustomer] = (0, import_react.useState)("");
	const [issue, setIssue] = (0, import_react.useState)("");
	const [urgency, setUrgency] = (0, import_react.useState)("Normal");
	const create = useMutation({
		mutationFn: () => createJob({ data: {
			kind,
			customer,
			issue,
			urgency,
			received: void 0
		} }),
		onSuccess: (job) => {
			toast.success("Call opened");
			qc.invalidateQueries({ queryKey: ["jobs"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			onOpenChange(false);
			setCustomer("");
			setIssue("");
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
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "new-issue",
						children: "Issue"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "new-issue",
						className: "mt-1",
						value: issue,
						onChange: (e) => setIssue(e.target.value)
					})] }),
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
	const [value, setValue] = (0, import_react.useState)(defaultValue);
	(0, import_react.useEffect)(() => {
		setValue(defaultValue);
	}, [recordKey, defaultValue]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EquipmentCombo, {
		name: "equipment",
		value,
		onChange: setValue
	});
}
function JobsPage({ kind, title, lede, initialOpen }) {
	const jobs = useQuery({
		queryKey: ["jobs", kind],
		queryFn: () => listJobs({ data: { kind } })
	});
	const [q, setQ] = (0, import_react.useState)("");
	const [tech, setTech] = (0, import_react.useState)("");
	const [urgency, setUrgency] = (0, import_react.useState)("");
	const [view, setView] = (0, import_react.useState)("active");
	const [openId, setOpenId] = (0, import_react.useState)(initialOpen ?? null);
	(0, import_react.useEffect)(() => {
		if (initialOpen != null) setOpenId(initialOpen);
	}, [initialOpen]);
	const [create, setCreate] = (0, import_react.useState)(false);
	const [sort, setSort] = useDeskSort(`jobs-${kind}`, "flag");
	const rows = (0, import_react.useMemo)(() => {
		let list = jobs.data ?? [];
		if (view === "active") list = list.filter((j) => !CLOSED_CALL.has(j.status) && !j.done);
		if (view === "flagged") list = list.filter((j) => j.flag);
		if (tech) list = list.filter((j) => j.technician === tech);
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
		sort
	]);
	const activeCount = (jobs.data ?? []).filter((j) => !CLOSED_CALL.has(j.status) && !j.done).length;
	const flagCount = (jobs.data ?? []).filter((j) => j.flag).length;
	const allJobs = jobs.data ?? [];
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
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				onClick: () => setCreate(true),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "New call"]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 grid gap-3 md:grid-cols-3",
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
			className: "mt-5 grid gap-4 lg:grid-cols-2",
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
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
					value: tech,
					onChange: (e) => setTech(e.target.value),
					allowEmpty: true,
					emptyLabel: "All techs",
					className: "w-40",
					children: TECHNICIANS.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: t }, t))
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
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "block font-medium",
				children: job.customer ?? "Untitled"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "text-xs text-muted-foreground",
				children: [
					job.callId,
					job.wo ? ` · ${job.wo}` : "",
					job.issue ? ` · ${job.issue}` : ""
				]
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "flex flex-wrap gap-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlagBadge, { flag: job.flag }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "md:hidden",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UrgencyBadge, { urgency: job.urgency })
				})]
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
				children: job.technician ?? "—"
			})
		]
	}) });
}
//#endregion
export { JobsPage as t };
