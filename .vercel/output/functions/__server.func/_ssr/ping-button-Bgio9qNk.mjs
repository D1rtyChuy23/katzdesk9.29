import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { b as Bell, x as BellRing } from "../_libs/lucide-react.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { n as cn, t as Button } from "./button-6ZsGYj3J.mjs";
import { n as PopoverContent, r as PopoverTrigger, t as Popover } from "./api-B23zb1CT.mjs";
import { i as sendPing, n as listTeammates } from "./notify-1DhqhnYZ.mjs";
import { t as Input } from "./input-D-eo25vp.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ping-button-Bgio9qNk.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var badgeVariants = cva("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tracking-tight", {
	variants: { variant: {
		default: "bg-secondary text-secondary-foreground",
		primary: "bg-primary/12 text-primary",
		danger: "bg-destructive/12 text-destructive",
		warn: "bg-warning/12 text-warning",
		success: "bg-primary/12 text-primary",
		outline: "border border-border text-foreground",
		ink: "bg-ink text-ink-foreground"
	} },
	defaultVariants: { variant: "default" }
});
function Badge({ className, variant, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn(badgeVariants({ variant }), className),
		...props
	});
}
function PingButton({ entityType, entityId, contextLabel, size = "sm", className }) {
	const qc = useQueryClient();
	const [open, setOpen] = (0, import_react.useState)(false);
	const [note, setNote] = (0, import_react.useState)("");
	const people = useQuery({
		queryKey: ["teammates"],
		queryFn: () => listTeammates(),
		enabled: open
	});
	const ping = useMutation({
		mutationFn: (toUserId) => {
			const extra = note.trim();
			return sendPing({ data: {
				toUserId,
				body: extra ? `${extra} — ${contextLabel}` : `Follow up: ${contextLabel}`,
				entityType: entityType ?? null,
				entityId: entityId ?? null
			} });
		},
		onSuccess: () => {
			toast.success("Ping sent — they’ll see it in the bell");
			setNote("");
			qc.invalidateQueries({ queryKey: ["notifications"] });
			setOpen(false);
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not ping")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Popover, {
		open,
		onOpenChange: (v) => {
			setOpen(v);
			if (!v) setNote("");
		},
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PopoverTrigger, {
			asChild: true,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				type: "button",
				size: "sm",
				variant: "outline",
				className: cn(size === "xs" && "h-8 px-2 text-xs", className),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BellRing, { className: "size-3.5" }), "Ping"]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PopoverContent, {
			className: "w-72 p-2",
			align: "end",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "px-2 py-1 text-xs text-muted-foreground",
					children: "Send a reminder to…"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: note,
					onChange: (e) => setNote(e.target.value),
					placeholder: "Optional note (e.g. need an ETA)",
					className: "mb-2 h-9"
				}),
				people.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "px-2 py-3 text-sm text-muted-foreground",
					children: "Loading teammates…"
				}) : (people.data ?? []).length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "px-2 py-3 text-sm text-muted-foreground",
					children: "No other approved accounts yet. Once a teammate is on the desk, you can ping them here."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: (people.data ?? []).map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted",
					disabled: ping.isPending,
					onClick: () => ping.mutate(p.userId),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, { className: "size-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "min-w-0 truncate font-medium",
						children: p.username
					})]
				}) }, p.userId)) })
			]
		})]
	});
}
//#endregion
export { PingButton as n, Badge as t };
