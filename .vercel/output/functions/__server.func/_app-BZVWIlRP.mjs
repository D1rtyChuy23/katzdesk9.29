import { o as __toESM, r as __exportAll } from "./_runtime.mjs";
import { u as require_react } from "./_libs/@floating-ui/react-dom+[...].mjs";
import { b as useNavigate, d as useRouterState, m as Outlet, v as Link, y as Navigate } from "./_libs/@tanstack/react-router+[...].mjs";
import { n as require_jsx_runtime } from "./_libs/radix-ui__react-context+react.mjs";
import { i as signOut } from "./_ssr/client-sGid3STf.mjs";
import { r as getMyAccess } from "./_ssr/access-Cv44_4sH.mjs";
import { a as Truck, b as Bell, c as Search, d as MessageSquare, f as Menu, h as Coffee, i as Users, m as Handshake, n as Wrench, p as MapPin, r as Warehouse, s as Settings2, u as Package, v as CalendarClock, y as BookOpen } from "./_libs/lucide-react.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "./_libs/tanstack__react-query.mjs";
import { n as toast } from "./_libs/sonner.mjs";
import { d as Route$14 } from "./_ssr/router-BpVsA2Dc.mjs";
import { n as useCurrentUserState, t as useCurrentUser } from "./_ssr/use-current-user-DZ7NZd4-.mjs";
import { n as cn, t as Button } from "./_ssr/button-6ZsGYj3J.mjs";
import { N as searchAll, n as PopoverContent, r as PopoverTrigger, t as Popover } from "./_ssr/api-B23zb1CT.mjs";
import { n as SheetContent, t as Sheet } from "./_ssr/sheet-CqTk9YRH.mjs";
import { n as pathFor, t as OpenLink } from "./_ssr/open-link-CwtVBSba.mjs";
import { r as markNotificationRead, t as listNotifications } from "./_ssr/notify-1DhqhnYZ.mjs";
import { t as Skeleton } from "./_ssr/separator-CEGHwY7T.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_app-BZVWIlRP.js
var _app_BZVWIlRP_exports = /* @__PURE__ */ __exportAll({ component: () => DeskLayout });
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
			toast.message(`${newest?.fromName ?? "Teammate"} pinged you`, { description: newest?.body ?? "Open the bell for the reminder." });
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
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-medium",
								children: n.fromName ?? "Teammate"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-muted-foreground",
								children: " pinged you"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-0.5 line-clamp-2 text-xs text-muted-foreground",
							children: n.body
						})]
					})
				})
			}, n.id))
		})]
	})] });
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
			}
		]
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
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlobalSearch, {}),
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
					className: "flex-1 px-3 py-5 md:px-8 md:py-7",
					children
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
				open,
				onOpenChange: setOpen,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetContent, {
					side: "left",
					className: "flex w-64 flex-col bg-ink p-0 text-ink-foreground sm:max-w-64",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "px-2 py-5",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Brand, {})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "px-2",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavLinks, {
								onNavigate: () => setOpen(false),
								isAdmin
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-auto border-t border-cream/10 p-3",
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
			})
		]
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
	const { sessionUser } = Route$14.useRouteContext();
	const { user, isPending } = useCurrentUserState();
	const access = useQuery({
		queryKey: ["access", "me"],
		queryFn: () => getMyAccess(),
		enabled: !!user,
		refetchInterval: (q) => q.state.data && !q.state.data.approved ? 3e3 : false,
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
export { DeskLayout as component, _app_BZVWIlRP_exports as t };
