import { o as __toESM, r as __exportAll } from "./_runtime.mjs";
import { u as require_react } from "./_libs/@floating-ui/react-dom+[...].mjs";
import { b as useNavigate, d as useRouterState, m as Outlet, v as Link, x as useRouter, y as Navigate } from "./_libs/@tanstack/react-router+[...].mjs";
import { n as require_jsx_runtime } from "./_libs/radix-ui__react-context+react.mjs";
import { a as formatPingTime } from "./_ssr/clock-CSFAgASg.mjs";
import { i as signOut } from "./_ssr/client-sGid3STf.mjs";
import { o as getMyAccess, p as registerAccount, t as checkUsername } from "./_ssr/access-3Tz151bB.mjs";
import { C as Package, D as Menu, E as MessageSquare, F as Globe, G as CalendarClock, K as BookOpen, N as Handshake, O as MapPin, P as Hammer, R as Coffee, W as CalendarRange, _ as Search, a as Users, c as Truck, g as Settings2, h as SlidersHorizontal, m as Store, n as Wrench, q as Bell, r as Warehouse } from "./_libs/lucide-react.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "./_libs/tanstack__react-query.mjs";
import { n as toast } from "./_libs/sonner.mjs";
import { C as RESUMED_KEY, S as LAST_PATH_KEY, _ as cn, h as MyViewBar, m as Route$19, v as useCurrentUser, w as readPrefs, y as useCurrentUserState } from "./_ssr/router-1NWxggZt.mjs";
import { z as searchAll } from "./_ssr/api-CgwyWugK.mjs";
import { n as pathFor, t as OpenLink } from "./_ssr/open-link-oQ0V2s2m.mjs";
import { t as Skeleton } from "./_ssr/separator-AdNvdRLl.mjs";
import { i as markNotificationRead, n as listNotifications } from "./_ssr/notify-CruvKMVL.mjs";
import { i as Label, n as Button, r as Input } from "./_ssr/input-COYCsX_T.mjs";
import { n as PopoverContent, r as PopoverTrigger, t as Popover } from "./_ssr/popover-BIqfguoF.mjs";
import { r as SheetContent, t as Sheet } from "./_ssr/sheet-CdZCIXqJ.mjs";
import { n as ThemeToggle } from "./_ssr/theme-toggle-BZhMzRtl.mjs";
import { i as DialogTitle, n as DialogContent, t as Dialog } from "./_ssr/dialog-zUw3eso-.mjs";
import { t as ExportButton } from "./_ssr/export-dialog-BGDRoctb.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_app-BrqJEDqL.js
var _app_BrqJEDqL_exports = /* @__PURE__ */ __exportAll({ component: () => DeskLayout });
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* Auth state components — plain wrappers around `useCurrentUserState()`.
*
* Auth is ON by default (including the sandbox live preview, which does real
* sign-in). Visitors are signed out until they authenticate. The shared dev
* user only appears when auth is explicitly disabled (`VITE_AUTH_ENABLED=false`).
* While the session is still resolving, gates that care about signed-out state
* render nothing so there's no signed-out flash on hard reload.
*/
/** Where `RedirectToSignIn` sends signed-out visitors. Create this route. */
var SIGN_IN_PATH = "/login";
/** Render children only when a user is present (real session, or the disabled-auth dev user). */
function SignedIn({ children }) {
	const { user } = useCurrentUserState();
	return user ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children }) : null;
}
/**
* Render children only once we KNOW the visitor is signed out (`isPending` has
* cleared and there is no user). Hidden while the session is still loading.
*/
function SignedOut({ children }) {
	const { user, isPending } = useCurrentUserState();
	if (isPending || user) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
/**
* Client-side redirect to the sign-in route (TanStack `<Navigate>` — NOT a full
* `window.location` reload). A hard navigation re-bootstraps the SPA and re-runs
* session loading, which feels like a second "Loading…" on /login.
*
* Guard routes by waiting out `isPending` first (see `use-current-user`), then
* render this.
*/
function RedirectToSignIn({ to = SIGN_IN_PATH }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigate, { to });
}
/**
* Minimal signed-in identity chip + sign-out. Restyle freely (see the
* `design-ui` skill). Sign-out is only shown when auth is enabled (the
* disabled-auth dev user has nothing to sign out of).
*/
function UserButton() {
	const user = useCurrentUser();
	if (!user) return null;
	const label = user.displayName ?? user.primaryEmail ?? "Account";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2",
		children: [
			user.profileImageUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: user.profileImageUrl,
				alt: "",
				className: "h-8 w-8 rounded-full object-cover"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "grid h-8 w-8 place-items-center rounded-full bg-black/10 text-sm font-medium dark:bg-white/20",
				children: label.charAt(0).toUpperCase()
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-sm font-medium",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => void signOut(),
				className: "cursor-pointer text-sm underline-offset-4 opacity-70 hover:underline",
				children: "Sign out"
			})
		]
	});
}
function GlobalSearch() {
	const [q, setQ] = (0, import_react.useState)("");
	const [open, setOpen] = (0, import_react.useState)(false);
	const navigate = useNavigate();
	const delayed = useDebounced(q, 180);
	const results = useQuery({
		queryKey: ["search", delayed],
		queryFn: () => searchAll({ data: { q: delayed } }),
		enabled: delayed.trim().length >= 2
	});
	(0, import_react.useEffect)(() => {
		function onKey(e) {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				setOpen(true);
				document.getElementById("desk-search")?.focus();
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);
	const hits = results.data ?? [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative w-full max-w-md",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				id: "desk-search",
				value: q,
				onChange: (e) => {
					setQ(e.target.value);
					setOpen(true);
				},
				onFocus: () => setOpen(true),
				onBlur: () => setTimeout(() => setOpen(false), 180),
				placeholder: "Search accounts, serials, WO…",
				className: "h-10 w-full rounded-md border border-border bg-background pr-12 pl-9 text-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", {
				className: "pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded-sm border border-border px-1.5 text-[10px] text-muted-foreground sm:block",
				children: "⌘K"
			}),
			open && delayed.trim().length >= 2 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute top-[calc(100%+6px)] z-40 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-soft",
				children: hits.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "px-3 py-3 text-sm text-muted-foreground",
					children: "No matches"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: hits.map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted",
					onMouseDown: (e) => e.preventDefault(),
					onClick: () => {
						const to = pathFor(h.entityType);
						if (to === "/") navigate({ to: "/" });
						else navigate({
							to,
							search: { open: h.id }
						});
						setOpen(false);
						setQ("");
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block font-medium",
						children: h.title
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-xs text-muted-foreground",
						children: h.subtitle
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "shrink-0 text-[11px] text-muted-foreground uppercase",
						children: h.entityType
					})]
				}) }, `${h.entityType}-${h.id}`)) })
			}) : null
		]
	});
}
function useDebounced(value, ms) {
	const [v, setV] = (0, import_react.useState)(value);
	(0, import_react.useEffect)(() => {
		const t = setTimeout(() => setV(value), ms);
		return () => clearTimeout(t);
	}, [value, ms]);
	return v;
}
function NotifyBell({ ink }) {
	const qc = useQueryClient();
	const inbox = useQuery({
		queryKey: ["notifications"],
		queryFn: () => listNotifications(),
		refetchInterval: 8e3
	});
	const mark = useMutation({
		mutationFn: (d) => markNotificationRead({ data: d }),
		onSuccess: () => void qc.invalidateQueries({ queryKey: ["notifications"] })
	});
	const rows = inbox.data ?? [];
	const unread = rows.filter((n) => !n.read).length;
	const primed = (0, import_react.useRef)(false);
	const prevUnread = (0, import_react.useRef)(0);
	(0, import_react.useEffect)(() => {
		if (!primed.current) {
			primed.current = true;
			prevUnread.current = unread;
			return;
		}
		if (unread > prevUnread.current) {
			const newest = rows.find((n) => !n.read);
			toast.message(`${newest?.fromName ?? "Teammate"} pinged you`, { description: [
				newest?.customer,
				newest?.body,
				newest?.createdAt ? formatPingTime(newest.createdAt) : null
			].filter(Boolean).join(" · ") });
		}
		prevUnread.current = unread;
	}, [unread, rows]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Popover, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PopoverTrigger, {
		asChild: true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
			type: "button",
			variant: "ghost",
			size: "icon",
			className: cn("relative", ink && "text-cream hover:bg-cream/10 hover:text-cream"),
			"aria-label": unread ? `${unread} notifications` : "Notifications",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, { className: "size-5" }), unread ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground",
				children: unread > 9 ? "9+" : unread
			}) : null]
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PopoverContent, {
		className: "w-80 p-0",
		align: "end",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between border-b border-border px-3 py-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm font-medium",
				children: "Pings"
			}), unread ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "text-xs text-muted-foreground underline-offset-2 hover:underline",
				onClick: () => mark.mutate({ all: true }),
				children: "Mark all read"
			}) : null]
		}), rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "px-3 py-6 text-sm text-muted-foreground",
			children: "No pings yet. Teammates can remind you from Handoff or any job note."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "max-h-80 overflow-y-auto",
			children: rows.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
				className: cn("border-b border-border last:border-b-0", !n.read && "bg-primary/6"),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OpenLink, {
					entityType: n.entityType ?? "handoff",
					id: n.entityId ?? 0,
					className: "block px-3 py-2.5 text-left hover:bg-muted/60",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						role: "presentation",
						onClick: () => {
							if (!n.read) mark.mutate({ id: n.id });
						},
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-medium",
									children: n.fromName ?? "Teammate"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-muted-foreground",
									children: " pinged you"
								})]
							}),
							n.customer ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-0.5 truncate text-xs font-medium",
								children: n.customer
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-0.5 line-clamp-2 text-xs text-muted-foreground",
								children: n.body
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("time", {
								className: "mt-1 block text-[11px] text-muted-foreground",
								dateTime: n.createdAt,
								children: formatPingTime(n.createdAt)
							})
						]
					})
				})
			}, n.id))
		})]
	})] });
}
var ROWS = [
	{
		keys: "⌘K",
		action: "Search accounts, serials, and WOs"
	},
	{
		keys: "?",
		action: "Open these shortcuts"
	},
	{
		keys: "Esc",
		action: "Close a sheet or dialog"
	}
];
function ShortcutsDialog() {
	const [open, setOpen] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		function onKey(e) {
			if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
			const t = e.target;
			if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
			if (e.key === "?" || e.shiftKey && e.key === "/") {
				e.preventDefault();
				setOpen((v) => !v);
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange: setOpen,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "max-w-md",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Keyboard" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted-foreground",
					children: "Works anywhere on the desk except while typing."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-4 divide-y divide-border",
					children: ROWS.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-center justify-between gap-4 py-2.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-sm",
							children: r.action
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", {
							className: "rounded-md border border-border bg-muted px-2 py-1 font-mono text-xs",
							children: r.keys
						})]
					}, r.keys))
				})
			]
		})
	});
}
var NAV = [
	{
		label: "Floor",
		items: [
			{
				to: "/",
				label: "Clock",
				icon: CalendarClock,
				exact: true
			},
			{
				to: "/planner",
				label: "Planner",
				icon: CalendarRange
			},
			{
				to: "/service",
				label: "Service",
				icon: Wrench
			},
			{
				to: "/tlc",
				label: "TLC + Factor",
				icon: Coffee
			},
			{
				to: "/pms",
				label: "PMs",
				icon: Settings2
			},
			{
				to: "/rebuilds",
				label: "Rebuilds",
				icon: Hammer
			}
		]
	},
	{
		label: "Sales → service",
		items: [
			{
				to: "/pipeline",
				label: "Pipeline",
				icon: Handshake
			},
			{
				to: "/installs",
				label: "Installs",
				icon: Truck
			},
			{
				to: "/handoff",
				label: "Handoff",
				icon: MessageSquare
			}
		]
	},
	{
		label: "Shop",
		items: [
			{
				to: "/warehouse",
				label: "Warehouse",
				icon: Warehouse
			},
			{
				to: "/locations",
				label: "Locations",
				icon: MapPin
			},
			{
				to: "/modules",
				label: "Modules",
				icon: Package
			},
			{
				to: "/recipes",
				label: "Recipes",
				icon: BookOpen
			},
			{
				to: "/customers",
				label: "Customers",
				icon: Store
			},
			{
				to: "/network",
				label: "Out of Network",
				icon: Globe
			}
		]
	},
	{
		label: "Team",
		items: [{
			to: "/settings",
			label: "Settings",
			icon: SlidersHorizontal
		}]
	}
];
function NavLinks({ onNavigate, isAdmin }) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
		className: "flex flex-col gap-6",
		children: [NAV.map((group) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "px-3 text-[11px] font-medium tracking-[0.16em] text-cream/50 uppercase",
			children: group.label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-2 space-y-0.5",
			children: group.items.map((item) => {
				const active = "exact" in item && item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
				const Icon = item.icon;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: item.to,
					onClick: onNavigate,
					className: cn("flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors", active ? "bg-cream/12 text-cream" : "text-cream/70 hover:bg-cream/8 hover:text-cream"),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-4" }), item.label]
				}) }, item.to);
			})
		})] }, group.label)), isAdmin ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "px-3 text-[11px] font-medium tracking-[0.16em] text-cream/50 uppercase",
			children: "Admin"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-2 space-y-0.5",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to: "/access",
				onClick: onNavigate,
				className: cn("flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors", pathname === "/access" || pathname.startsWith("/access/") ? "bg-cream/12 text-cream" : "text-cream/70 hover:bg-cream/8 hover:text-cream"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "size-4" }), "Access"]
			}) })
		})] }) : null]
	});
}
function Brand() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
		to: "/",
		className: "flex items-baseline gap-2 px-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "font-display text-2xl font-medium tracking-tight text-cream",
			children: "Katz"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "font-display text-2xl font-medium tracking-tight text-cream/60 italic",
			children: "Desk"
		})]
	});
}
function AppShell({ children, isAdmin }) {
	const { user, isPending } = useCurrentUserState();
	const [open, setOpen] = (0, import_react.useState)(false);
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		if (!user) return;
		if (sessionStorage.getItem("katz-desk-resumed")) return;
		sessionStorage.setItem(RESUMED_KEY, "1");
		if (!readPrefs().resumeLast) return;
		const last = window.localStorage.getItem(LAST_PATH_KEY);
		if (last && last !== pathname && last !== "/login") router.history.push(last);
	}, [
		user,
		pathname,
		router
	]);
	(0, import_react.useEffect)(() => {
		if (!user) return;
		if (pathname === "/login") return;
		window.localStorage.setItem(LAST_PATH_KEY, pathname);
	}, [user, pathname]);
	if (isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-svh",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("aside", { className: "hidden w-60 shrink-0 bg-ink md:block" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex-1 p-6",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-8 w-48" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "mt-6 h-32 w-full" })]
		})]
	});
	if (!user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-svh bg-background",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
				href: "#desk-main",
				className: "sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground",
				children: "Skip to content"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "hidden w-60 shrink-0 flex-col bg-ink text-ink-foreground md:flex",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "px-2 py-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Brand, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 px-3 text-xs text-cream/45",
							children: "Service and sales, one clock."
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex-1 overflow-y-auto px-2 pb-4",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavLinks, { isAdmin })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "border-t border-cream/10 p-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "px-1 text-[11px] text-cream/40",
							children: "Signed in"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-1 text-cream [&_button]:text-cream/70 [&_span]:text-cream",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserButton, {})
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-w-0 flex-1 flex-col",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "flex items-center gap-2 border-b border-border bg-card/70 px-3 py-2 backdrop-blur md:px-6",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							size: "icon",
							className: "md:hidden",
							onClick: () => setOpen(true),
							"aria-label": "Open menu",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Menu, { className: "size-5" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "md:hidden",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-display text-lg",
								children: "Katz Desk"
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 md:ml-0",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "hidden lg:block",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MyViewBar, {})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlobalSearch, {}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExportButton, {}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThemeToggle, {}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NotifyBell, {}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "hidden sm:block md:hidden",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SignedIn, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserButton, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SignedOut, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
										to: "/login",
										className: "text-sm",
										children: "Sign in"
									}) })]
								})
							]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
					id: "desk-main",
					className: "min-w-0 flex-1 overflow-x-hidden px-3 py-5 md:px-8 md:py-7",
					children
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
				open,
				onOpenChange: setOpen,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetContent, {
					side: "left",
					className: "flex w-64 flex-col overflow-hidden bg-ink p-0 text-ink-foreground sm:max-w-64",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "shrink-0 px-2 py-5",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Brand, {})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "sheet-scroll min-h-0 flex-1 overflow-y-auto px-2",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavLinks, {
								onNavigate: () => setOpen(false),
								isAdmin
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "shrink-0 border-t border-cream/10 p-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "px-1 text-[11px] text-cream/40",
								children: "Signed in"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-1 text-cream [&_button]:text-cream/70 [&_span]:text-cream",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserButton, {})
							})]
						})
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShortcutsDialog, {})
		]
	});
}
var USERNAME_RE = /^[a-zA-Z0-9._-]{3,32}$/;
function UsernameSetup({ email, onDone }) {
	const [username, setUsername] = (0, import_react.useState)("");
	const [hint, setHint] = (0, import_react.useState)(null);
	const save = useMutation({
		mutationFn: (name) => registerAccount({ data: {
			username: name,
			email
		} }),
		onSuccess: (row) => {
			toast.success(row.approved ? `Welcome, ${row.username}` : `Username saved as ${row.username}`);
			onDone();
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save username")
	});
	(0, import_react.useEffect)(() => {
		const name = username.trim();
		if (!name) {
			setHint(null);
			return;
		}
		if (!USERNAME_RE.test(name)) {
			setHint("3–32 letters, numbers, dots, hyphens, or underscores.");
			return;
		}
		const t = window.setTimeout(() => {
			checkUsername({ data: { username: name } }).then((r) => setHint(r.available ? "Available" : "That username is already taken.")).catch(() => setHint(null));
		}, 280);
		return () => window.clearTimeout(t);
	}, [username]);
	function onSubmit(e) {
		e.preventDefault();
		const name = username.trim();
		if (!USERNAME_RE.test(name)) {
			toast.error("Username must be 3–32 letters, numbers, dots, hyphens, or underscores.");
			return;
		}
		save.mutate(name);
	}
	const taken = hint === "That username is already taken.";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "flex min-h-svh items-center justify-center bg-ink px-6 text-ink-foreground",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full max-w-md rounded-xl border border-cream/12 bg-cream/6 p-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs tracking-[0.18em] text-cream/50 uppercase",
					children: "Katz Desk"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-3 font-display text-3xl",
					children: "Choose a username"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm leading-relaxed text-cream/70",
					children: "Use the same sign-in you just used — Google, X, or your existing password. You only need a username for the desk. No new password."
				}),
				email ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-3 truncate text-xs text-cream/45",
					children: ["Signed in as ", email]
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					onSubmit,
					className: "mt-5 space-y-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "setup-username",
							className: "text-cream/60",
							children: "Username"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "setup-username",
							required: true,
							autoComplete: "username",
							autoFocus: true,
							className: "mt-1 border-cream/15 bg-ink text-cream",
							value: username,
							onChange: (e) => setUsername(e.target.value),
							placeholder: "e.g. amanda.s"
						}),
						hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: `mt-1.5 text-xs ${taken ? "text-destructive" : "text-cream/50"}`,
							children: hint
						}) : null
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						className: "w-full",
						disabled: save.isPending || taken,
						children: save.isPending ? "Saving…" : "Continue"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					className: "mt-2 w-full",
					variant: "secondary",
					onClick: () => void signOut(),
					children: "Sign out"
				})
			]
		})
	});
}
function LoadingClock() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-svh bg-ink text-cream",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "m-auto px-6 text-center",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-display text-3xl",
				children: "Katz Desk"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-cream/60",
				children: "Loading the operations clock…"
			})]
		})
	});
}
function DeskLayout() {
	const { sessionUser } = Route$19.useRouteContext();
	const { user, isPending } = useCurrentUserState();
	const access = useQuery({
		queryKey: ["access", "me"],
		queryFn: () => getMyAccess(),
		enabled: !!user,
		refetchInterval: (q) => {
			const d = q.state.data;
			if (d && !d.approved && d.usernameChosen) return 3e3;
			if (d?.approved) return 12e3;
			return false;
		},
		retry: 1
	});
	if (isPending && !sessionUser) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoadingClock, {});
	if (!user && !sessionUser) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RedirectToSignIn, {});
	if (!user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoadingClock, {});
	if (access.isPending && !access.data) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoadingClock, {});
	if (access.isError) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "flex min-h-svh items-center justify-center bg-ink px-6 text-ink-foreground",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-md rounded-xl border border-cream/12 bg-cream/6 p-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs tracking-[0.18em] text-cream/50 uppercase",
					children: "Katz Desk"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-3 font-display text-3xl",
					children: "Couldn’t load your account"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-cream/70",
					children: access.error instanceof Error ? access.error.message : "Try again in a moment."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 flex flex-col gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						className: "w-full",
						onClick: () => void access.refetch(),
						children: "Try again"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						className: "w-full",
						variant: "secondary",
						onClick: () => void signOut(),
						children: "Sign out"
					})]
				})
			]
		})
	});
	if (access.data?.needsUsername) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UsernameSetup, {
		email: access.data.email ?? user.primaryEmail,
		onDone: () => void access.refetch()
	});
	if (access.data?.denied) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "flex min-h-svh items-center justify-center bg-ink px-6 text-ink-foreground",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-md rounded-xl border border-cream/12 bg-cream/6 p-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs tracking-[0.18em] text-cream/50 uppercase",
					children: "Katz Desk"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-3 font-display text-3xl",
					children: "Access denied"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-2 text-sm text-cream/70",
					children: [
						"Signed in as ",
						access.data.username,
						". An admin declined this account. Ask them to invite you again if you should be on the desk."
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 flex flex-col gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						className: "w-full",
						onClick: () => void access.refetch(),
						children: "Check again"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						className: "w-full",
						variant: "secondary",
						onClick: () => void signOut(),
						children: "Sign out"
					})]
				})
			]
		})
	});
	if (!access.data?.approved) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "flex min-h-svh items-center justify-center bg-ink px-6 text-ink-foreground",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-md rounded-xl border border-cream/12 bg-cream/6 p-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs tracking-[0.18em] text-cream/50 uppercase",
					children: "Katz Desk"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-3 font-display text-3xl",
					children: "Waiting for approval"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-2 text-sm text-cream/70",
					children: [
						"Signed in as ",
						access.data?.username ?? "this account",
						". An admin still needs to approve this account before you can open the desk."
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 flex flex-col gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						className: "w-full",
						onClick: () => void access.refetch(),
						children: "Check again"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						className: "w-full",
						variant: "secondary",
						onClick: () => void signOut(),
						children: "Sign out"
					})]
				})
			]
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		isAdmin: access.data.isAdmin,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {})
	});
}
//#endregion
export { DeskLayout as component, _app_BrqJEDqL_exports as t };
