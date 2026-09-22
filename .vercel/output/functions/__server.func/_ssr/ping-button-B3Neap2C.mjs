import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { a as formatPingTime } from "./clock-CSFAgASg.mjs";
import { J as BellRing, q as Bell } from "../_libs/lucide-react.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { _ as cn } from "./router-1NWxggZt.mjs";
import { n as mentionFragment, r as parseMentions, t as applyMention } from "./mentions-Cvlq5S1G.mjs";
import { a as sendPing, r as listTeammates } from "./notify-CruvKMVL.mjs";
import { n as Button, r as Input, t as AutoGrowTextarea } from "./input-COYCsX_T.mjs";
import { n as PopoverContent, r as PopoverTrigger, t as Popover } from "./popover-BIqfguoF.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ping-button-B3Neap2C.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function MentionField({ value, onChange, teammates, multiline, placeholder, className, id }) {
	const fragment = mentionFragment(value);
	const suggestions = fragment != null ? teammates.filter((t) => t.username.toLowerCase().includes(fragment.toLowerCase())).slice(0, 8) : [];
	function pick(username) {
		onChange(applyMention(value, username));
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative",
		children: [multiline ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AutoGrowTextarea, {
			id,
			value,
			onChange: (e) => onChange(e.target.value),
			placeholder,
			className
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
			id,
			value,
			onChange: (e) => onChange(e.target.value),
			placeholder,
			className,
			autoComplete: "off"
		}), suggestions.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover py-1 shadow-soft",
			children: suggestions.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: cn("flex w-full items-center px-3 py-2 text-left text-sm hover:bg-muted"),
				onMouseDown: (e) => {
					e.preventDefault();
					pick(t.username);
				},
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "font-medium",
					children: ["@", t.username]
				})
			}) }, t.username))
		}) : null]
	});
}
function MentionBody({ text }) {
	const parts = text.split(/(@[a-zA-Z0-9._-]{2,32})/g);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "mt-1 text-sm leading-relaxed",
		children: parts.map((part, i) => part.startsWith("@") ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "font-medium text-primary",
			children: part
		}, i) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: part }, i))
	});
}
function PingButton({ entityType, entityId, commentId, pingedAt, contextLabel, defaultNote = "", size = "sm", className }) {
	const qc = useQueryClient();
	const [open, setOpen] = (0, import_react.useState)(false);
	const [note, setNote] = (0, import_react.useState)("");
	const [doneAt, setDoneAt] = (0, import_react.useState)(pingedAt ?? null);
	const locked = (0, import_react.useRef)(!!pingedAt);
	(0, import_react.useEffect)(() => {
		if (pingedAt) {
			setDoneAt(pingedAt);
			locked.current = true;
		}
	}, [pingedAt]);
	const people = useQuery({
		queryKey: ["teammates"],
		queryFn: () => listTeammates(),
		enabled: open
	});
	const ping = useMutation({
		mutationFn: (d) => {
			if (commentId && locked.current) return Promise.resolve({
				sent: [],
				already: true,
				pingedAt: doneAt
			});
			if (commentId) locked.current = true;
			const extra = (d.body ?? note).trim();
			const tagged = parseMentions(extra);
			return sendPing({ data: {
				toUserId: d.toUserId,
				usernames: d.usernames ?? (tagged.length ? tagged : void 0),
				body: extra || `Follow up: ${contextLabel}`,
				entityType: entityType ?? null,
				entityId: entityId ?? null,
				commentId: commentId ?? null
			} });
		},
		onSuccess: (res) => {
			const at = res.pingedAt ?? doneAt ?? (/* @__PURE__ */ new Date()).toISOString();
			setDoneAt(at);
			locked.current = true;
			if (res.already) toast.message("Already pinged this note", { description: at ? formatPingTime(at) : "Only one ping is sent per note." });
			else {
				const names = res.sent.map((n) => `@${n}`).join(", ");
				toast.success(`Pinged ${names} · ${formatPingTime(at)}`);
			}
			setNote("");
			qc.invalidateQueries({ queryKey: ["notifications"] });
			qc.invalidateQueries({ queryKey: ["comments"] });
			qc.invalidateQueries({ queryKey: ["handoff"] });
			setOpen(false);
		},
		onError: (e) => {
			if (commentId) locked.current = !!doneAt;
			toast.error(e instanceof Error ? e.message : "Could not ping");
		}
	});
	const stamped = commentId ? pingedAt ?? doneAt : null;
	if (stamped) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
		type: "button",
		size: "sm",
		variant: "outline",
		disabled: true,
		className: cn(size === "xs" && "h-8 px-2 text-xs", className),
		title: `Pinged ${formatPingTime(stamped)} — only one ping per note`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BellRing, { className: "size-3.5" }),
			"Pinged",
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("time", {
				className: "font-normal text-muted-foreground",
				dateTime: stamped,
				children: formatPingTime(stamped)
			})
		]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Popover, {
		open,
		onOpenChange: (v) => {
			if (v) {
				if (locked.current) return;
				const tagged = parseMentions(defaultNote);
				if (tagged.length) {
					ping.mutate({
						usernames: tagged,
						body: defaultNote
					});
					return;
				}
				setNote(defaultNote || note);
			} else setNote("");
			setOpen(v);
		},
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PopoverTrigger, {
			asChild: true,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				type: "button",
				size: "sm",
				variant: "outline",
				className: cn(size === "xs" && "h-8 px-2 text-xs", className),
				disabled: ping.isPending,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BellRing, { className: "size-3.5" }), "Ping"]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PopoverContent, {
			className: "w-80 p-2",
			align: "end",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "px-2 py-1 text-xs text-muted-foreground",
					children: "Tag someone — e.g. @josh see this and respond asap — then Ping. One ping per note."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MentionField, {
					value: note,
					onChange: setNote,
					teammates: people.data ?? [],
					placeholder: "@username + a short note",
					className: "mb-2 h-9"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					size: "sm",
					className: "mb-2 w-full",
					disabled: ping.isPending || !parseMentions(note).length && !note.trim(),
					onClick: () => ping.mutate({ usernames: parseMentions(note) }),
					children: "Ping tagged teammates"
				}),
				people.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "px-2 py-3 text-sm text-muted-foreground",
					children: "Loading teammates…"
				}) : (people.data ?? []).length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "px-2 py-3 text-sm text-muted-foreground",
					children: "No other approved accounts yet. Once a teammate is on the desk, tag them with @username."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: (people.data ?? []).map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted",
					disabled: ping.isPending,
					onClick: () => {
						if (!parseMentions(note).map((n) => n.toLowerCase()).includes(p.username.toLowerCase())) setNote(applyMention(note || "", p.username));
						ping.mutate({
							toUserId: p.userId,
							usernames: parseMentions(note).concat(p.username)
						});
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, { className: "size-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "min-w-0 truncate font-medium",
						children: ["@", p.username]
					})]
				}) }, p.userId)) })
			]
		})]
	});
}
//#endregion
export { MentionField as n, PingButton as r, MentionBody as t };
