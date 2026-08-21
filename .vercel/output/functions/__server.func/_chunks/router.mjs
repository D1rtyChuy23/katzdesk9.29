import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { _ as createRootRoute, b as useNavigate, d as useRouterState, g as createFileRoute, l as Scripts, m as Outlet, p as createRouter, u as HeadContent, v as Link, x as useRouter, y as Navigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { L as string, N as number, P as object, R as union, j as literal, k as boolean } from "../_libs/@better-auth/core+[...].mjs";
import { _ as Check, a as Truck, b as Bell, c as Search, d as MessageSquare, f as Menu, g as ChevronsUpDown, h as Coffee, i as Users, l as Plus, m as Handshake, n as Wrench, o as TriangleAlert, p as MapPin, r as Warehouse, s as Settings2, t as X, u as Package, v as CalendarClock, x as BellRing, y as BookOpen } from "../_libs/lucide-react.mjs";
import { t as QueryClient } from "../_libs/tanstack__query-core.mjs";
import { i as useQueryClient, n as useQuery, r as QueryClientProvider, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast, t as Toaster } from "../_libs/sonner.mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { a as DialogOverlay, b as Slot, i as DialogDescription$1, n as DialogClose, o as DialogPortal, r as DialogContent$1, s as DialogTitle$1, t as Dialog$1 } from "../_libs/@radix-ui/react-dialog+[...].mjs";
import { i as Trigger, n as Portal, r as Root2, t as Content2 } from "../_libs/@radix-ui/react-popover+[...].mjs";
import { a as CartesianGrid, c as Cell, i as XAxis, l as ResponsiveContainer, n as BarChart, o as Bar, r as YAxis, s as Pie, t as PieChart, u as Tooltip } from "../_libs/recharts+[...].mjs";
import { n as createServerFn, t as createMiddleware } from "../_libs/@tanstack/start-client-core+[...].mjs";
import { i as signOut, r as signIn, t as authClient } from "./client.mjs";
import { i as GROK_PROVIDERS, r as getSql, t as auth } from "./popup.server.mjs";
//#region src/lib/error-component.tsx
var import_jsx_runtime = require_jsx_runtime();
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center text-foreground",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-destructive",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-lg font-medium",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-muted-foreground",
				children: error.message || "An unexpected error occurred. Try reloading the page."
			})
		]
	});
}
//#endregion
//#region src/lib/preview-embedder-origin.ts
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
function isGrokEmbedderOrigin(origin) {
	try {
		const url = new URL(origin);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		if (host === "grok.com" || host.endsWith(".grok.com")) return true;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
		return false;
	} catch {
		return false;
	}
}
function isSandboxPreviewGuestHost(hostname) {
	const host = hostname.toLowerCase();
	return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}
function isRemintPreviewPair(guestHost, parentHost) {
	const guest = guestHost.toLowerCase();
	const parent = parentHost.toLowerCase();
	const i = guest.indexOf(".preview.");
	if (i <= 0) return false;
	const label = guest.slice(0, i);
	const rest = guest.slice(i + 9);
	if (label.includes(".") || !rest.includes(".")) return false;
	return parent === rest || parent === `grok.${rest}`;
}
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
	if (parentIsSelf) return null;
	for (const candidate of [referrer, ancestorOrigin ?? ""].filter(Boolean)) try {
		const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
		if (url.protocol !== "https:" && url.protocol !== "http:") continue;
		if (isGrokEmbedderOrigin(url.origin)) return url.origin;
		if (isSandboxPreviewGuestHost(guestHostname) || isRemintPreviewPair(guestHostname, url.hostname)) return url.origin;
	} catch {}
	return null;
}
//#endregion
//#region src/lib/preview-host-bridge.ts
/**
* Guest side of the grok-web ↔ sandbox preview postMessage bridge.
*
* Activates only when this page is framed by an allowlisted Grok embedder.
* Top-level runs (download/export, local `npm run dev`, deployed sites) noop.
*/
var PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge";
var EnvelopeSchema = object({
	channel: literal(PREVIEW_BRIDGE_CHANNEL),
	version: number().int().positive(),
	type: string().min(1)
});
var HelloSchema = EnvelopeSchema.extend({ type: literal("hello") });
var NavigateSchema = EnvelopeSchema.extend({
	type: literal("navigate"),
	path: string().min(1)
});
var HistorySchema = EnvelopeSchema.extend({
	type: literal("history"),
	delta: union([literal(-1), literal(1)])
});
function isSafeBridgePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
	try {
		return new URL(path, "https://preview.invalid").origin === "https://preview.invalid";
	} catch {
		return false;
	}
}
/**
* Install host↔guest messaging. Returns a dispose function.
* Noops (returns a no-op dispose) when not embedded under a Grok parent.
*/
function installPreviewHostBridge(options = {}) {
	if (typeof window === "undefined") return () => {};
	const ancestorOrigin = typeof location.ancestorOrigins !== "undefined" && location.ancestorOrigins.length > 0 ? location.ancestorOrigins[0] : null;
	const parentOrigin = resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname);
	if (parentOrigin === null) return () => {};
	const ROOT_STATE_KEY = "__grokPreviewBridgeRoot";
	const originalPushState = window.history.pushState.bind(window.history);
	const originalReplaceState = window.history.replaceState.bind(window.history);
	const isAtHistoryRoot = () => {
		const state = window.history.state;
		return Boolean(state && typeof state === "object" && state[ROOT_STATE_KEY] === true);
	};
	try {
		const current = window.history.state;
		if (!(current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, ROOT_STATE_KEY))) {
			const isRoot = window.history.length <= 1;
			originalReplaceState(current && typeof current === "object" ? {
				...current,
				[ROOT_STATE_KEY]: isRoot
			} : { [ROOT_STATE_KEY]: isRoot }, "", window.location.href);
		}
	} catch {}
	const post = (message) => {
		window.parent.postMessage(message, parentOrigin);
	};
	const reportLocation = () => {
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "location",
			path: window.location.pathname || "/",
			search: window.location.search,
			hash: window.location.hash
		});
	};
	const reportRoutes = () => {
		const paths = options.getRoutePaths?.() ?? [];
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "routes",
			paths
		});
	};
	const defaultNavigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		try {
			const url = new URL(path, window.location.origin);
			if (url.origin !== window.location.origin) return;
			const next = `${url.pathname}${url.search}${url.hash}`;
			window.history.pushState(window.history.state, "", next);
			window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
		} catch {}
	};
	const navigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		if (options.navigate) {
			options.navigate(path);
			return;
		}
		defaultNavigate(path);
	};
	const announce = () => {
		reportLocation();
		reportRoutes();
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "ready"
		});
	};
	const onMessage = (event) => {
		if (event.source !== window.parent) return;
		if (event.origin !== parentOrigin) return;
		const envelope = EnvelopeSchema.safeParse(event.data);
		if (!envelope.success || envelope.data.version !== 1) return;
		if (envelope.data.type === "hello") {
			if (!HelloSchema.safeParse(event.data).success) return;
			announce();
			return;
		}
		if (envelope.data.type === "navigate") {
			const parsed = NavigateSchema.safeParse(event.data);
			if (!parsed.success) return;
			navigate(parsed.data.path);
			queueMicrotask(reportLocation);
			return;
		}
		if (envelope.data.type === "history") {
			const parsed = HistorySchema.safeParse(event.data);
			if (!parsed.success) return;
			if (parsed.data.delta === -1 && isAtHistoryRoot()) return;
			window.history.go(parsed.data.delta);
		}
	};
	const onPopState = () => {
		reportLocation();
	};
	const onHashChange = () => {
		reportLocation();
	};
	window.history.pushState = (data, unused, url) => {
		const next = data && typeof data === "object" ? {
			...data,
			[ROOT_STATE_KEY]: false
		} : data;
		originalPushState(next, unused, url);
		reportLocation();
	};
	window.history.replaceState = (data, unused, url) => {
		const next = isAtHistoryRoot() ? {
			...data && typeof data === "object" ? data : {},
			[ROOT_STATE_KEY]: true
		} : data;
		originalReplaceState(next, unused, url);
		reportLocation();
	};
	window.addEventListener("message", onMessage);
	window.addEventListener("popstate", onPopState);
	window.addEventListener("hashchange", onHashChange);
	announce();
	return () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("popstate", onPopState);
		window.removeEventListener("hashchange", onHashChange);
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
	};
}
/** Collect static path patterns from a TanStack route tree (best-effort). */
function collectRoutePathsFromTree(routeTree) {
	const paths = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		const full = typeof record.fullPath === "string" ? record.fullPath : typeof record.path === "string" ? record.path : null;
		if (full !== null && full !== "") paths.add(full.startsWith("/") ? full : `/${full}`);
		else if (full === "") paths.add("/");
		const children = record.children;
		if (Array.isArray(children)) for (const child of children) walk(child);
		else if (children && typeof children === "object") for (const child of Object.values(children)) walk(child);
	};
	walk(routeTree);
	return [...paths];
}
//#endregion
//#region src/components/preview-host-bridge.tsx
/**
* Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
* (and later receive registered routes). Noops when the app is not embedded.
*/
function PreviewHostBridge() {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		return installPreviewHostBridge({
			navigate: (path) => {
				router.history.push(path);
			},
			getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)
		});
	}, [router]);
	return null;
}
//#endregion
//#region src/lib/auth/provider.tsx
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
//#endregion
//#region src/components/providers.tsx
function Providers({ children }) {
	const [client] = (0, import_react.useState)(() => new QueryClient({ defaultOptions: { queries: {
		staleTime: 8e3,
		retry: 1,
		refetchOnWindowFocus: false
	} } }));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(QueryClientProvider, {
		client,
		children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster, {
			position: "bottom-right",
			richColors: true
		})]
	}) });
}
//#endregion
//#region src/styles.css?url
var styles_default = "/assets/styles--aTGfylT.css";
//#endregion
//#region src/routes/__root.tsx
var APP_NAME = "Katz Desk";
var fetchSessionUser = createServerFn({ method: "GET" }).handler(async () => {
	const { getSessionUser } = await import("./verify.server.mjs");
	const u = await getSessionUser();
	return u ? {
		id: u.id,
		email: u.email
	} : null;
});
/** Same guard the injector uses for og:image — only emit on a public app host. */
function publicShareHost() {
	const host = String("").trim().split(",")[0]?.trim().split(":")[0]?.toLowerCase() ?? "";
	if (!host || !/^[a-z0-9.-]+$/.test(host) || !host.includes(".")) return "";
	if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return "";
	if (host === "vercel.app" || host.endsWith(".vercel.app") || host === "vercel.com" || host.endsWith(".vercel.com")) return "";
	return host;
}
var Route$15 = createRootRoute({
	beforeLoad: async () => ({ sessionUser: await fetchSessionUser() }),
	head: () => {
		const host = publicShareHost();
		const xBanner = host ? `https://${host}/x-banner.jpg` : "";
		return {
			meta: [
				{ charSet: "utf-8" },
				{
					name: "viewport",
					content: "width=device-width, initial-scale=1"
				},
				{ title: APP_NAME },
				{
					name: "theme-color",
					content: "#1A1612"
				},
				{
					name: "description",
					content: "Katz Coffee operations desk — service, installs, and sales on one clock."
				},
				...xBanner ? [{
					property: "x:game:image",
					content: xBanner
				}] : []
			],
			links: [
				{
					rel: "icon",
					type: "image/svg+xml",
					href: "/favicon.svg"
				},
				{
					rel: "stylesheet",
					href: styles_default
				},
				{
					rel: "manifest",
					href: "/__grok/manifest.webmanifest"
				},
				{
					rel: "apple-touch-icon",
					href: "/__grok/icon-180.png"
				},
				{
					rel: "stylesheet",
					href: "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500&display=swap"
				}
			]
		};
	},
	component: () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewHostBridge, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Providers, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})
		] })]
	})
});
/**
* Current user + loading state. Same behavior in live preview and when deployed:
*   - Auth enabled (default) -> the real signed-in user; `user` is `null` while
*                            the session resolves (`isPending: true`) and when
*                            signed out (`isPending: false`). Session comes from
*                            Better Auth `useSession()` → `/api/auth/get-session`
*                            (cookie when deployed; bearer in live preview).
*   - Auth disabled (`VITE_AUTH_ENABLED=false`) -> `DEV_USER`, never pending.
*
* Protect a route by waiting out `isPending` before acting on `user` —
* redirecting on `user: null` alone bounces signed-in visitors to sign-in on
* every hard reload:
*
*   import { RedirectToSignIn } from "@/lib/auth/gates";
*   const { user, isPending } = useCurrentUserState();
*   if (isPending) return null;              // still resolving — don't redirect yet
*   if (!user) return <RedirectToSignIn />;  // definitely signed out
*
* `authEnabled` is a module-level constant fixed at load, so the guarded hook
* call keeps a stable hook order across every render of a given component.
*/
function useCurrentUserState() {
	const { data, isPending } = authClient.useSession();
	const user = data?.user;
	return {
		user: user ? {
			id: user.id,
			displayName: user.name ?? null,
			primaryEmail: user.email ?? null,
			profileImageUrl: user.image ?? null,
			isDevFallback: false
		} : null,
		isPending
	};
}
/**
* Convenience view of `useCurrentUserState().user` for display (e.g.
* `user?.displayName ?? "Guest"`). NOTE: `null` means *loading OR signed out* —
* for redirects/guards use `useCurrentUserState()` and check `isPending`.
*/
function useCurrentUser() {
	return useCurrentUserState().user;
}
//#endregion
//#region src/lib/auth/gates.tsx
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
//#endregion
//#region src/lib/auth/middleware.ts
/**
* Auth middleware for server functions — the standard way to get the caller's
* verified user id. When deployed the session cookie is same-origin and rides
* along automatically. In the live preview the client also forwards the bearer
* token (partitioned cookies) via the `.client` hook below — call sites do not
* thread it themselves.
*
*   import { createServerFn } from "@tanstack/react-start";
*   import { getSql } from "@/lib/db";
*   import { authMiddleware } from "@/lib/auth/middleware";
*
*   export const listTodos = createServerFn({ method: "GET" })
*     .middleware([authMiddleware])
*     .handler(async ({ context }) => {
*       const sql = await getSql();
*       return sql`select * from todos where user_id = ${context.userId}`;
*     });
*
* Signed out (auth on — the default, including live preview) -> throws
* `UnauthorizedError` (see `verify.server.ts`). Only when auth is explicitly
* disabled (`VITE_AUTH_ENABLED=false`) does it resolve the shared dev user and
* never throw. Use it on every server function that touches per-user data, and
* scope every query by `context.userId`.
*/
var authMiddleware = createMiddleware({ type: "function" }).client(async ({ next }) => {
	const { getBearerToken } = await import("./client.mjs").then((n) => n.n);
	return next({ sendContext: { bearerToken: getBearerToken() ?? void 0 } });
}).server(async ({ next, context }) => {
	const { assertSameSiteRequest } = await import("./isolation.server.mjs");
	const { requireUserId } = await import("./verify.server.mjs");
	assertSameSiteRequest();
	return next({ context: { userId: await requireUserId(context.bearerToken) } });
});
//#endregion
//#region src/lib/ops/access.ts
var ACCESS_COLS = "user_id, username, email, approved, is_admin";
function cleanUsername(raw) {
	return raw.trim().replace(/\s+/g, "");
}
function slugUsername(raw) {
	const s = raw.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "").slice(0, 24);
	return s.length >= 3 ? s : `user${s}`.slice(0, 24) || "user";
}
function validUsername(raw) {
	return /^[a-zA-Z0-9._-]{3,32}$/.test(raw);
}
/** Playwright / sandbox probe accounts — they must not steal the live owner's admin seat. */
function isSandboxQa(username) {
	return /^qa[._-]/i.test(username);
}
/** Live desk owner (Chuy). Always an admin, even if a qa.* account claimed first. */
function isDeskOwner(username, name, email) {
	const blob = [
		username,
		name ?? "",
		email ?? ""
	].join(" ").toLowerCase();
	return /\bchuy\b/.test(blob) || blob.includes("d1rtychuy");
}
async function ensureTable$1(sql) {
	await sql.query(`
    create table if not exists desk_accounts (
      user_id    text primary key,
      username   text not null,
      email      text,
      approved   boolean not null default false,
      is_admin   boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`);
	await sql.query("create unique index if not exists desk_accounts_username_uidx on desk_accounts (lower(username))");
}
async function adminCount(sql) {
	const rows = await sql.query("select count(*)::int as n from desk_accounts where approved = true and is_admin = true");
	return Number(rows[0]?.n ?? 0);
}
async function realAdminCount(sql) {
	return (await sql.query("select username from desk_accounts where approved = true and is_admin = true")).filter((r) => !isSandboxQa(r.username)).length;
}
async function shouldBootstrapAdmin(sql, username, name, email) {
	if (isDeskOwner(username, name, email)) return true;
	if (isSandboxQa(username)) return await adminCount(sql) === 0;
	return await realAdminCount(sql) === 0;
}
async function uniqueUsername(sql, base, exceptUserId) {
	const root = slugUsername(cleanUsername(base)) || "user";
	let candidate = root;
	let n = 1;
	for (;;) {
		const rows = await sql.query("select user_id from desk_accounts where lower(username) = $1 limit 1", [candidate.toLowerCase()]);
		if (!rows[0] || rows[0].user_id === exceptUserId) return candidate;
		n += 1;
		if (n > 99) return `${root.slice(0, 16)}${Date.now().toString(36).slice(-6)}`;
		candidate = `${root.slice(0, 20)}${n}`;
	}
}
async function loadUser(sql, userId) {
	const rows = await sql.query(`select name, email from "user" where id = $1 limit 1`, [userId]);
	return {
		name: rows[0]?.name ?? "user",
		email: rows[0]?.email ?? null
	};
}
function mapAccess(row) {
	return {
		userId: row.user_id,
		username: row.username,
		email: row.email,
		approved: !!row.approved,
		isAdmin: !!row.is_admin
	};
}
function isUniqueUsernameError(e) {
	const msg = e instanceof Error ? e.message : String(e);
	return /unique|duplicate key/i.test(msg);
}
async function loadAccess(sql, userId) {
	return (await sql.query(`select ${ACCESS_COLS} from desk_accounts where user_id = $1`, [userId]))[0];
}
async function promoteAdmin(sql, userId, email) {
	const rows = await sql.query(`update desk_accounts
     set approved = true,
         is_admin = true,
         email = coalesce($2, email),
         updated_at = now()
     where user_id = $1
     returning ${ACCESS_COLS}`, [userId, email ?? null]);
	if (!rows[0]) throw new Error("Account not found");
	return mapAccess(rows[0]);
}
/** Reject unapproved sessions before any ops query. Used by deskMiddleware. */
async function assertApproved(userId) {
	const sql = await getSql();
	await ensureTable$1(sql);
	if (!(await loadAccess(sql, userId))?.approved) throw new Error("This account is waiting for approval.");
}
/** Auth + approved desk account. Use on every ops/notify server function. */
var deskMiddleware = createMiddleware({ type: "function" }).middleware([authMiddleware]).server(async ({ next, context }) => {
	await assertApproved(context.userId);
	return next();
});
var checkUsername = createServerFn({ method: "POST" }).validator((d) => d).handler(async ({ data }) => {
	const username = cleanUsername(data.username);
	if (!validUsername(username)) return { available: false };
	const sql = await getSql();
	await ensureTable$1(sql);
	return { available: !(await sql.query("select user_id from desk_accounts where lower(username) = $1 limit 1", [username.toLowerCase()]))[0] };
});
var lookupSignIn = createServerFn({ method: "POST" }).validator((d) => d).handler(async ({ data }) => {
	const username = cleanUsername(data.username);
	if (!username) throw new Error("Enter your username");
	const sql = await getSql();
	await ensureTable$1(sql);
	const row = (await sql.query("select email, approved from desk_accounts where lower(username) = $1 limit 1", [username.toLowerCase()]))[0];
	if (!row?.email) throw new Error("Unknown username");
	if (!row.approved) throw new Error("This account is waiting for approval.");
	return { email: row.email };
});
var getMyAccess = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async ({ context }) => {
	const sql = await getSql();
	await ensureTable$1(sql);
	const existing = await loadAccess(sql, context.userId);
	const profile = await loadUser(sql, context.userId);
	if (existing) {
		if (await shouldBootstrapAdmin(sql, existing.username, profile.name, profile.email ?? existing.email) && (!existing.approved || !existing.is_admin)) return promoteAdmin(sql, context.userId, profile.email);
		return mapAccess(existing);
	}
	const username = await uniqueUsername(sql, profile.name || profile.email?.split("@")[0] || "user");
	const first = await shouldBootstrapAdmin(sql, username, profile.name, profile.email);
	try {
		return mapAccess((await sql.query(`insert into desk_accounts (user_id, username, email, approved, is_admin)
         values ($1, $2, $3, $4, $5)
         on conflict (user_id) do update
           set email = coalesce(excluded.email, desk_accounts.email),
               approved = desk_accounts.approved or excluded.approved,
               is_admin = desk_accounts.is_admin or excluded.is_admin,
               updated_at = now()
         returning ${ACCESS_COLS}`, [
			context.userId,
			username,
			profile.email,
			first,
			first
		]))[0]);
	} catch (e) {
		if (isUniqueUsernameError(e)) {
			const retryName = await uniqueUsername(sql, username, context.userId);
			return mapAccess((await sql.query(`insert into desk_accounts (user_id, username, email, approved, is_admin)
           values ($1, $2, $3, $4, $5)
           on conflict (user_id) do update
             set email = coalesce(excluded.email, desk_accounts.email),
                 approved = desk_accounts.approved or excluded.approved,
                 is_admin = desk_accounts.is_admin or excluded.is_admin,
                 updated_at = now()
           returning ${ACCESS_COLS}`, [
				context.userId,
				retryName,
				profile.email,
				first,
				first
			]))[0]);
		}
		throw e;
	}
});
var registerAccount = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(async ({ context, data }) => {
	const username = cleanUsername(data.username);
	if (!validUsername(username)) throw new Error("Username must be 3–32 letters, numbers, dots, hyphens, or underscores.");
	const sql = await getSql();
	await ensureTable$1(sql);
	const taken = await sql.query("select user_id from desk_accounts where lower(username) = $1 limit 1", [username.toLowerCase()]);
	if (taken[0] && taken[0].user_id !== context.userId) throw new Error("That username is already taken.");
	const profile = await loadUser(sql, context.userId);
	const email = data.email?.trim() || profile.email;
	const first = await shouldBootstrapAdmin(sql, username, profile.name, email);
	const existing = await loadAccess(sql, context.userId);
	try {
		if (existing) return mapAccess((await sql.query(`update desk_accounts
           set username = $2,
               email = coalesce($3, email),
               approved = approved or $4,
               is_admin = is_admin or $4,
               updated_at = now()
           where user_id = $1
           returning ${ACCESS_COLS}`, [
			context.userId,
			username,
			email,
			first
		]))[0] ?? {
			...existing,
			username,
			email: email ?? existing.email
		});
		return mapAccess((await sql.query(`insert into desk_accounts (user_id, username, email, approved, is_admin)
         values ($1, $2, $3, $4, $5)
         on conflict (user_id) do update
           set username = excluded.username,
               email = coalesce(excluded.email, desk_accounts.email),
               approved = desk_accounts.approved or excluded.approved,
               is_admin = desk_accounts.is_admin or excluded.is_admin,
               updated_at = now()
         returning ${ACCESS_COLS}`, [
			context.userId,
			username,
			email,
			first,
			first
		]))[0]);
	} catch (e) {
		if (isUniqueUsernameError(e)) throw new Error("That username is already taken.");
		throw e;
	}
});
var listDeskAccounts = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async ({ context }) => {
	const sql = await getSql();
	await ensureTable$1(sql);
	if (!(await sql.query("select is_admin from desk_accounts where user_id = $1", [context.userId]))[0]?.is_admin) throw new Error("Only an admin can review accounts.");
	return (await sql.query("select user_id, username, email, approved, is_admin, created_at from desk_accounts order by created_at desc")).map((r) => ({
		...mapAccess(r),
		createdAt: String(r.created_at)
	}));
});
var setAccountApproved = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(async ({ context, data }) => {
	const sql = await getSql();
	await ensureTable$1(sql);
	if (!(await sql.query("select is_admin from desk_accounts where user_id = $1", [context.userId]))[0]?.is_admin) throw new Error("Only an admin can review accounts.");
	if (data.userId === context.userId && !data.approved) throw new Error("You cannot revoke your own access.");
	await sql.query("update desk_accounts set approved = $2, updated_at = now() where user_id = $1", [data.userId, data.approved]);
	const rows = await sql.query(`select ${ACCESS_COLS} from desk_accounts where user_id = $1`, [data.userId]);
	if (!rows[0]) throw new Error("Account not found");
	return mapAccess(rows[0]);
});
//#endregion
//#region src/lib/utils.ts
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
//#endregion
//#region src/components/ui/button.tsx
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors transition-transform duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]", {
	variants: {
		variant: {
			default: "bg-primary text-primary-foreground hover:bg-primary/90",
			destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
			outline: "border border-border bg-card hover:bg-muted",
			secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
			ghost: "hover:bg-muted",
			ink: "bg-ink text-ink-foreground hover:bg-ink/90",
			link: "text-primary underline-offset-4 hover:underline"
		},
		size: {
			default: "h-10 px-4",
			sm: "h-8 rounded-sm px-3 text-xs",
			lg: "h-11 rounded-lg px-5",
			icon: "h-10 w-10"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "default"
	}
});
function Button({ className, variant, size, asChild = false, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size,
			className
		})),
		...props
	});
}
//#endregion
//#region src/components/ui/popover.tsx
var Popover = Root2;
var PopoverTrigger = Trigger;
function isInsideCombo(target) {
	return !!target?.closest?.("[data-combo-popover]");
}
function preventIfCombo(event) {
	if (isInsideCombo(event.target)) event.preventDefault();
}
function PopoverContent({ className, align = "start", sideOffset = 4, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Portal, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Content2, {
		align,
		sideOffset,
		"data-combo-popover": "",
		className: cn("z-[80] w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-soft outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95", className),
		...props
	}) });
}
//#endregion
//#region src/components/ui/sheet.tsx
var Sheet = Dialog$1;
function SheetContent({ className, children, side = "right", onPointerDownOutside, onFocusOutside, onInteractOutside, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay, { className: "fixed inset-0 z-50 bg-ink/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent$1, {
		className: cn("fixed z-50 flex h-full w-full flex-col overflow-y-auto border-border bg-card shadow-soft focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out sm:max-w-xl", side === "right" ? "top-0 right-0 border-l data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right" : "top-0 left-0 border-r data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left", className),
		onPointerDownOutside: (e) => {
			preventIfCombo(e);
			onPointerDownOutside?.(e);
		},
		onFocusOutside: (e) => {
			preventIfCombo(e);
			onFocusOutside?.(e);
		},
		onInteractOutside: (e) => {
			preventIfCombo(e);
			onInteractOutside?.(e);
		},
		...props,
		children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogClose, {
			className: "absolute top-3 right-3 rounded-sm p-1 text-muted-foreground hover:bg-muted",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "sr-only",
				children: "Close"
			})]
		})]
	})] });
}
function SheetHeader({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("border-b border-border px-5 py-4 pr-12", className),
		...props
	});
}
function SheetTitle({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle$1, {
		className: cn("font-display text-xl font-medium tracking-tight", className),
		...props
	});
}
//#endregion
//#region src/lib/ops/lookups.ts
var TECHNICIANS = [
	"Ryan",
	"Elias",
	"Oliver",
	"Josh",
	"Charles",
	"Bill",
	"Lance",
	"3rd Party"
];
var CALL_STATUSES = [
	"Open",
	"Dispatched",
	"In Progress",
	"Follow-up Needed",
	"Phone Resolved",
	"Completed",
	"Cancelled"
];
var CALL_TYPES = [
	"Field Service",
	"In-House Rebuild",
	"Installation"
];
var PM_STATUSES = [
	"Pending Scheduling",
	"Scheduled",
	"Awaiting Parts",
	"Ready to Dispatch",
	"In Progress",
	"Completed",
	"Cancelled"
];
var PM_STYLES = [
	"6 month PM",
	"12 month PM",
	"36 month PM",
	"Grinder PM"
];
var PARTS_STATUSES = [
	"Yes - All Available",
	"Partial",
	"No - Awaiting Parts",
	"On Order",
	"TBD / Check Inventory"
];
var EQUIP_STATUSES = [
	"Ready",
	"Not Ready",
	"Installed"
];
var REQS_READY = ["Ready", "Not Ready"];
var PRODUCERS = [
	"Bill",
	"Lance",
	"Sean",
	"Shannon",
	"Lizbeth",
	"Amanda",
	"Jesus"
];
var PRODUCER_INITIALS = {
	Bill: "BM",
	Lance: "LO",
	Sean: "SM",
	Shannon: "SC",
	Lizbeth: "LR",
	Amanda: "AL",
	Jesus: "JG"
};
var PAYMENT_TERMS = [
	"Payment Plan",
	"50% Down + 50% upon install/30 days after",
	"50% Down / 50% at Install or Net 30",
	"Lease",
	"Paid in Full",
	"No Purchased Equipment"
];
var MODULE_PLATFORMS = [
	"Cameo",
	"Enigma / e'Line",
	"Legacy"
];
var MODULE_TYPES = [
	"Brew Module",
	"Medium Brew Module",
	"Large Brew Module",
	"Steam S Module",
	"Steam M Module",
	"Hydraulic Module",
	"Grinder Module",
	"Milk Module",
	"Pump Module",
	"Powder Module"
];
var MODULE_STATUSES = [
	"Not Started",
	"In Progress",
	"Waiting on Parts",
	"Ready",
	"Ship to Eversys (Core Swap)",
	"At Eversys - Awaiting Return",
	"Installed at Account",
	"Retired / Scrapped"
];
var URGENCIES = [
	"Emergency",
	"High",
	"Normal",
	"Low"
];
var URGENCY_RANK = {
	Emergency: 0,
	High: 1,
	Normal: 2,
	Low: 3
};
var CLOSED_CALL = /* @__PURE__ */ new Set([
	"Completed",
	"Cancelled",
	"Phone Resolved"
]);
var CLOSED_PM = /* @__PURE__ */ new Set(["Completed", "Cancelled"]);
var PRODUCER_INITIAL_VALUES = new Set(Object.values(PRODUCER_INITIALS).map((s) => s.toLowerCase()));
function normalizeName(s) {
	return s.trim().toLowerCase().replace(/['’]/g, "");
}
function nameTokens(raw) {
	if (!raw) return [];
	const n = normalizeName(raw);
	if (!n) return [];
	return [n, ...n.split(/[\s@._+\-]+/).filter(Boolean)];
}
/** Keys used to decide whether a handoff item belongs to the signed-in person. */
function userMatchKeys(user) {
	const keys = /* @__PURE__ */ new Set();
	if (!user) return keys;
	const add = (raw) => {
		for (const t of nameTokens(raw)) if (t.length >= 3 || t.length === 2 && PRODUCER_INITIAL_VALUES.has(t)) keys.add(t);
	};
	add(user.displayName);
	add(user.primaryEmail);
	const parts = (user.displayName ?? "").trim().split(/\s+/).filter(Boolean);
	if (parts.length >= 2) {
		const initials = (parts[0][0] + parts[1][0]).toLowerCase();
		if (PRODUCER_INITIAL_VALUES.has(initials)) keys.add(initials);
	}
	for (const [name, initials] of Object.entries(PRODUCER_INITIALS)) if (keys.has(name.toLowerCase())) keys.add(initials.toLowerCase());
	return keys;
}
function namesMatchUser(user, ...names) {
	const keys = userMatchKeys(user);
	if (!keys.size) return false;
	for (const name of names) for (const t of nameTokens(name)) if (keys.has(t)) return true;
	return false;
}
//#endregion
//#region src/lib/ops/clock.ts
function todayChicago() {
	return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(/* @__PURE__ */ new Date());
}
function addDays(iso, days) {
	const [y, m, d] = iso.split("-").map(Number);
	return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
function diffDays(fromIso, toIso) {
	const a = Date.parse(`${fromIso}T00:00:00Z`);
	const b = Date.parse(`${toIso}T00:00:00Z`);
	return Math.round((b - a) / 864e5);
}
function weekBounds(today) {
	const [y, m, d] = today.split("-").map(Number);
	const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
	const start = addDays(today, dow === 0 ? -6 : 1 - dow);
	const end = addDays(start, 6);
	const nextStart = addDays(start, 7);
	return {
		start,
		end,
		nextStart,
		nextEnd: addDays(nextStart, 6)
	};
}
function formatWeekLabel(start, end) {
	const a = /* @__PURE__ */ new Date(`${start}T00:00:00`);
	const b = /* @__PURE__ */ new Date(`${end}T00:00:00`);
	const fmt = (dt) => `${dt.getMonth() + 1}/${dt.getDate()}`;
	return `${fmt(a)} – ${fmt(b)}`;
}
function closedCall(status, done) {
	return done || CLOSED_CALL.has(status ?? "");
}
function serviceFlag(input, today) {
	if (closedCall(input.status, input.done)) return null;
	if (input.scheduled && input.scheduled < today) return {
		code: "past_due",
		label: "Past due — scheduled",
		level: "danger",
		rank: 10
	};
	if (input.received) {
		const days = diffDays(input.received, today);
		if (input.kind === "tlc") {
			if (days >= 14) return {
				code: "open_2w",
				label: "Open past 2 weeks",
				level: "danger",
				rank: 20
			};
			if (days >= 10) return {
				code: "open_10d",
				label: "Open 10–14 days",
				level: "warn",
				rank: 30
			};
		} else {
			if (days >= 2) return {
				code: "open_48",
				label: "Open past 48 hrs",
				level: "danger",
				rank: 20
			};
			if (days >= 1) return {
				code: "open_24",
				label: "Open 24–48 hrs",
				level: "warn",
				rank: 30
			};
		}
	}
	return null;
}
function pmFlag(input, today) {
	if (input.done || CLOSED_PM.has(input.status)) return null;
	if (!input.projected) return {
		code: "needs_date",
		label: "Needs PM date",
		level: "warn",
		rank: 15
	};
	const days = diffDays(today, input.projected);
	if (days < 0) {
		if (-days >= 14) return {
			code: "pm_late_2w",
			label: "2+ weeks past projected",
			level: "danger",
			rank: 5
		};
		return {
			code: "pm_overdue",
			label: "PM overdue",
			level: "danger",
			rank: 10
		};
	}
	if (days <= 14) return {
		code: "pm_due",
		label: "PM due within 14 days",
		level: "warn",
		rank: 25
	};
	return null;
}
function installFlag(input, today, week) {
	if (input.complete || input.equipStatus === "Installed") return null;
	const date = input.installDate;
	const inWindow = !!date && date >= week.start && date <= week.nextEnd;
	const past = !!date && date < today;
	if (input.equipStatus === "Not Ready" && past) return {
		code: "past_not_ready",
		label: "Past due — not ready",
		level: "danger",
		rank: 8
	};
	if (input.equipStatus === "Not Ready" && inWindow) return {
		code: "equip_not_ready",
		label: "Equipment not ready",
		level: "danger",
		rank: 12
	};
	if (input.reqsReady === "Not Ready" && inWindow && input.equipStatus !== "Not Ready") return {
		code: "cust_not_ready",
		label: "Customer not ready",
		level: "warn",
		rank: 18
	};
	return null;
}
function formatShortDate(iso) {
	if (!iso) return "—";
	const [y, m, d] = iso.split("-").map(Number);
	if (!y || !m || !d) return iso;
	return `${m}/${d}`;
}
function formatLongDate(iso) {
	if (!iso) return "—";
	return (/* @__PURE__ */ new Date(`${iso}T12:00:00`)).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric"
	});
}
function money(n) {
	if (n === null || n === void 0 || n === "") return "—";
	const v = typeof n === "number" ? n : Number(n);
	if (!Number.isFinite(v)) return "—";
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0
	}).format(v);
}
function moneyExact(n) {
	if (n === null || n === void 0 || n === "") return "—";
	const v = typeof n === "number" ? n : Number(n);
	if (!Number.isFinite(v)) return "—";
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD"
	}).format(v);
}
//#endregion
//#region src/lib/ops/equipment.ts
var ALIASES = [
	{
		test: /c['’]?2m|\bc2m\b|cameo.{0,12}2m/i,
		model: "Eversys Cameo c'2m"
	},
	{
		test: /c['’]?2s|\bc2s\b|cameo.{0,16}2\s*step/i,
		model: "Eversys Cameo c'2s"
	},
	{
		test: /cameo/i,
		model: "Eversys Cameo c'2s"
	},
	{
		test: /e['’]?4m|\be4m\b/i,
		model: "Eversys e'4m"
	},
	{
		test: /e['’]?4s?|\be4\b|enigma/i,
		model: "Eversys e'4s"
	},
	{
		test: /\bitcb\b/i,
		model: "Bunn ITCB"
	},
	{
		test: /\btb3\b/i,
		model: "Bunn TB3"
	},
	{
		test: /axiom/i,
		model: "Bunn Axiom-APS"
	},
	{
		test: /cwtf/i,
		model: "Bunn CWTF-APS"
	},
	{
		test: /\bicb\b/i,
		model: "Bunn ICB Tall"
	},
	{
		test: /\bitb\b/i,
		model: "Bunn ITB-DD"
	},
	{
		test: /2051/i,
		model: "Fetco 2051e"
	},
	{
		test: /\b52h\b/i,
		model: "Fetco 52H"
	},
	{
		test: /sego/i,
		model: "Bravilor Sego 12"
	},
	{
		test: /classe\s*9/i,
		model: "Rancilio Classe 9"
	},
	{
		test: /classe\s*5/i,
		model: "Rancilio Classe 5 Compact"
	},
	{
		test: /strada/i,
		model: "La Marzocco Strada XT"
	},
	{
		test: /linea/i,
		model: "La Marzocco Linea S"
	},
	{
		test: /legacy/i,
		model: "Eversys Legacy"
	},
	{
		test: /\bg9[- ]?2t\b/i,
		model: "Bunn G9-2T"
	},
	{
		test: /\bg9\b/i,
		model: "Bunn G9"
	}
];
function normalize(s) {
	return s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function samePiece(a, b) {
	const na = normalize(a);
	const nb = normalize(b);
	return !!na && !!nb && na === nb;
}
function cleanPiece(raw) {
	let t = raw.replace(/\s+/g, " ").trim();
	t = t.replace(/^\(+/, "").replace(/\)+$/, "").trim();
	t = t.replace(/^(qty\s*)?\d+\s*[x×]\s*/i, "");
	t = t.replace(/\s*[x×]\s*\d+\s*$/i, "");
	t = t.replace(/\bwith\s+[\d.]+\s*wands?\b/i, "");
	t = t.replace(/\b\d+\s*v(olts?)?\b/i, "");
	t = t.replace(/\s+/g, " ").trim();
	if (!t || t.length < 2) return null;
	if (/^\d+$/.test(t)) return null;
	if (/^(need a |not here|new in barn|from cafeteria|for the time|po\b|loaner|sn\b)/i.test(t)) return null;
	return t;
}
/** Split a messy install equipment blob into one piece per machine. */
function splitEquipment(raw) {
	if (!raw?.trim()) return [];
	const pieces = [];
	for (const line of raw.split(/\r?\n/)) {
		const stripped = line.replace(/\bSN\s*:?\s*[A-Z0-9\-]+/gi, " ");
		for (const part of stripped.split(/\s*(?:&|\/|,|\band\b|\+)\s*/i)) {
			const cleaned = cleanPiece(part);
			if (!cleaned) continue;
			pieces.push(cleaned);
		}
	}
	return pieces;
}
/** Reassemble equipment chips for storage. Empty list → null (never invented). */
function joinEquipment(pieces) {
	const next = pieces.map((p) => p.trim()).filter(Boolean);
	return next.length ? next.join("\n") : null;
}
/**
* Read equipment as listed on an install. Newline-separated catalog names
* stay intact (commas in model names are not split). Two of the same model
* stay two machines. Single-line legacy blobs still split on & / , and +.
*/
function listedEquipment(raw, catalog = []) {
	if (!raw?.trim()) return [];
	const catalogKey = new Map(catalog.map((c) => [normalize(c), c]));
	const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
	const out = [];
	const push = (name) => {
		const mapped = catalogKey.get(normalize(name)) ?? name;
		if (mapped.trim()) out.push(mapped);
	};
	if (lines.length > 1) {
		for (const line of lines) push(line);
		return out;
	}
	const only = lines[0];
	if (catalogKey.has(normalize(only))) {
		push(only);
		return out;
	}
	if (catalog.length) {
		const nOnly = normalize(only);
		const contained = catalog.filter((c) => {
			const n = normalize(c);
			return n && (nOnly === n || nOnly.includes(n) || n.includes(nOnly));
		}).sort((a, b) => normalize(b).length - normalize(a).length);
		if (contained[0] && (nOnly === normalize(contained[0]) || nOnly.includes(normalize(contained[0])))) {
			push(contained[0]);
			if (!nOnly.replace(normalize(contained[0]), " ").trim()) return out;
		}
	}
	for (const piece of splitEquipment(only)) push(piece);
	return out;
}
function matchModel(piece, catalog) {
	for (const a of ALIASES) if (a.test.test(piece)) return a.model;
	const n = normalize(piece);
	if (!n) return piece;
	let best = null;
	for (const model of catalog) {
		const m = normalize(model);
		if (!m) continue;
		if (m === n) return model;
		if (n.includes(m) || m.includes(n)) {
			const score = Math.min(m.length, n.length);
			if (!best || score > best.score) best = {
				model,
				score
			};
		}
	}
	return best?.model ?? piece;
}
function parseInstallEquipment(raw, catalog = []) {
	return listedEquipment(raw, catalog).map((label) => ({
		label,
		model: matchModel(label, catalog)
	}));
}
/** Drop one machine from an install. Empty list becomes null. */
function dropEquipment(raw, label, catalog = []) {
	const pieces = listedEquipment(raw, catalog);
	const model = matchModel(label, catalog);
	const idx = pieces.findIndex((p) => samePiece(p, label) || samePiece(p, model) || samePiece(matchModel(p, catalog), label) || samePiece(matchModel(p, catalog), model));
	if (idx >= 0) {
		const next = pieces.slice();
		next.splice(idx, 1);
		return joinEquipment(next);
	}
	const n = normalize(label);
	const fallbackIdx = pieces.findIndex((p) => {
		const pn = normalize(p);
		return pn === n || pn.includes(n) || n.includes(pn);
	});
	if (fallbackIdx >= 0) {
		const next = pieces.slice();
		next.splice(fallbackIdx, 1);
		return joinEquipment(next);
	}
	return joinEquipment(pieces.filter((p) => p !== label));
}
function catalogModels(models) {
	const set = /* @__PURE__ */ new Set();
	for (const m of models) {
		const t = m.trim();
		if (t) set.add(t);
	}
	return [...set].sort((a, b) => a.localeCompare(b));
}
function findRecipeFor(recipes, opts) {
	const modelKey = opts.model.toLowerCase();
	const custKey = opts.customer.trim().toLowerCase();
	const house = recipes.find((r) => !r.customer && r.equipmentModel.toLowerCase() === modelKey) ?? null;
	return {
		linked: (opts.installId ? recipes.find((r) => r.installId === opts.installId && r.equipmentModel.toLowerCase() === modelKey) : void 0) ?? recipes.find((r) => !!r.customer && r.customer.toLowerCase() === custKey && r.equipmentModel.toLowerCase() === modelKey) ?? null,
		house
	};
}
function piecesForInstall(equipment, _customer, _installId, catalog, _recipes) {
	return parseInstallEquipment(equipment, catalog);
}
function shortEquipLabel(label, max = 22) {
	const t = label.trim();
	if (t.length <= max) return t;
	return `${t.slice(0, max - 1)}…`;
}
//#endregion
//#region src/lib/ops/machines.ts
function parseMachinesJson(raw) {
	if (!raw?.trim()) return [];
	try {
		const v = JSON.parse(raw);
		if (!Array.isArray(v)) return [];
		const out = [];
		for (const row of v) {
			if (!row || typeof row !== "object") continue;
			const rec = row;
			const equipment = String(rec.equipment ?? "").trim();
			if (!equipment) continue;
			out.push({
				equipment,
				serial: String(rec.serial ?? "").trim(),
				powerVoltage: String(rec.powerVoltage ?? "").trim()
			});
		}
		return out;
	} catch {
		return [];
	}
}
function takeSpec(pool, equipment) {
	const key = equipment.toLowerCase();
	const idx = pool.findIndex((s) => s.equipment.toLowerCase() === key);
	if (idx < 0) return void 0;
	return pool.splice(idx, 1)[0];
}
function mergeMachineSpecs(names, previous = [], legacy) {
	const fromJson = parseMachinesJson(legacy?.machines);
	const prev = [...previous];
	const json = [...fromJson];
	const specs = names.map((equipment) => {
		const hit = takeSpec(prev, equipment) ?? takeSpec(json, equipment);
		return {
			equipment,
			serial: hit?.serial ?? "",
			powerVoltage: hit?.powerVoltage ?? ""
		};
	});
	if (!(fromJson.length > 0) && specs.length === 1) {
		const only = specs[0];
		if (!only.serial && legacy?.serial && !legacy.serial.trim().startsWith("[")) only.serial = legacy.serial.trim();
		if (!only.powerVoltage && legacy?.powerVoltage && !legacy.powerVoltage.trim().startsWith("[")) only.powerVoltage = legacy.powerVoltage.trim();
	}
	return specs;
}
function serializeMachines(specs) {
	const clean = specs.map((s) => ({
		equipment: s.equipment.trim(),
		serial: s.serial.trim(),
		powerVoltage: s.powerVoltage.trim()
	})).filter((s) => s.equipment);
	if (!clean.length) return {
		equipment: null,
		machines: null,
		serial: null,
		powerVoltage: null
	};
	const serials = clean.map((s) => s.serial).filter(Boolean);
	const powers = clean.map((s) => s.powerVoltage).filter(Boolean);
	return {
		equipment: joinEquipment(clean.map((s) => s.equipment)),
		machines: JSON.stringify(clean),
		serial: serials.length ? serials.join(" · ") : null,
		powerVoltage: powers.length ? powers.join(" · ") : null
	};
}
function specsFromInstall(equipment, serial, powerVoltage, machines, catalog = []) {
	const fromJson = parseMachinesJson(machines);
	if (fromJson.length) return fromJson;
	return mergeMachineSpecs(listedEquipment(equipment, catalog), [], {
		serial,
		powerVoltage
	});
}
//#endregion
//#region src/lib/ops/warehouse.ts
var BACK_PALLETS = [
	"B",
	"C",
	"D",
	"E",
	"F",
	"G",
	"H",
	"I",
	"J",
	"K",
	"L",
	"M",
	"N",
	"O",
	"P",
	"Q"
];
var FRONT_PALLETS = [
	"J",
	"K",
	"L",
	"M",
	"N",
	"O",
	"P",
	"Q"
];
var LEVELS = [
	4,
	3,
	2,
	1
];
var LOCATION_SITES = [
	"front-lobby",
	"service-room",
	"production",
	"training",
	"out-of-state",
	"san-antonio",
	"dallas"
];
var SITE_LABEL = {
	"barn-back": "Barn · back rack",
	"barn-front": "Barn · front rack",
	"front-lobby": "Front Lobby",
	"service-room": "Service Room",
	"production": "Production",
	"training": "Training Room",
	"out-of-state": "Out of State",
	"san-antonio": "San Antonio",
	dallas: "Dallas",
	field: "Assigned to install",
	sold: "Sold"
};
var SITE_PURPOSE = {
	"front-lobby": "Front Lobby",
	"service-room": "Service bench",
	production: "Production",
	training: "Training",
	"out-of-state": "Out of state",
	"san-antonio": "SA warehouse",
	dallas: "Dallas warehouse"
};
var BARN_EQUIP_CAPACITY = 1056;
function bayFor(site, pallet) {
	if (site === "barn-back" && pallet) {
		if ("BCDE".includes(pallet)) return "catering";
		if ("FG".includes(pallet)) return "dispenser";
	}
	return "general";
}
function palletsFor(site) {
	return site === "barn-front" ? FRONT_PALLETS : BACK_PALLETS;
}
function slotId(pallet, level, line) {
	return line ? `${pallet}-L${level} · ${line}` : `${pallet}-L${level}`;
}
function siteLabel(site) {
	return SITE_LABEL[site] ?? site;
}
function isBarn(site) {
	return site === "barn-back" || site === "barn-front";
}
//#endregion
//#region src/lib/ops/api.ts
async function ready() {
	const { ensureSeeded } = await import("./seed.server.mjs");
	await ensureSeeded();
	return getSql();
}
function num(v) {
	if (v === null || v === void 0 || v === "") return null;
	const n = typeof v === "number" ? v : Number(v);
	return Number.isFinite(n) ? n : null;
}
function isoDate(v) {
	if (v === null || v === void 0 || v === "") return null;
	if (typeof v === "string") return v.slice(0, 10);
	return String(v).slice(0, 10);
}
function mapJob(r, today) {
	const received = isoDate(r.received);
	const scheduled = isoDate(r.scheduled);
	return {
		id: r.id,
		kind: r.kind,
		callId: r.call_id,
		contact: r.contact,
		phone: r.phone,
		received,
		customer: r.customer,
		equipment: r.equipment,
		issue: r.issue,
		callType: r.call_type,
		phoneResolved: !!r.phone_resolved,
		status: r.status,
		technician: r.technician,
		wo: r.wo,
		scheduled,
		notes: r.notes,
		done: !!r.done,
		updatedAt: String(r.updated_at),
		urgency: r.urgency || "Normal",
		flag: serviceFlag({
			kind: r.kind,
			status: r.status,
			done: !!r.done,
			received,
			scheduled
		}, today),
		ageDays: received ? diffDays(received, today) : null
	};
}
function mapPm(r, today) {
	const projected = isoDate(r.projected);
	return {
		id: r.id,
		customer: r.customer,
		received: isoDate(r.received),
		equipment: r.equipment,
		style: r.style,
		projected,
		partsStatus: r.parts_status,
		status: r.status,
		technician: r.technician,
		notes: r.notes,
		done: !!r.done,
		updatedAt: String(r.updated_at),
		flag: pmFlag({
			status: r.status,
			done: !!r.done,
			projected
		}, today)
	};
}
function mapInstall(r, today, week) {
	const installDate = isoDate(r.install_date);
	return {
		id: r.id,
		received: isoDate(r.received),
		customer: r.customer,
		equipment: r.equipment,
		equipStatus: r.equip_status,
		installDate,
		technician: r.technician,
		wo: r.wo,
		reqsReady: r.reqs_ready,
		notes: r.notes,
		accountRep: r.account_rep,
		paymentStatus: r.payment_status,
		serial: r.serial ?? null,
		powerVoltage: r.power_voltage ?? null,
		machines: specsFromInstall(r.equipment, r.serial, r.power_voltage, r.machines),
		complete: !!r.complete,
		dealId: r.deal_id,
		updatedAt: String(r.updated_at),
		flag: installFlag({
			equipStatus: r.equip_status,
			installDate,
			reqsReady: r.reqs_ready,
			complete: !!r.complete
		}, today, week),
		daysOut: installDate ? diffDays(today, installDate) : null
	};
}
function mapDeal(r) {
	return {
		id: r.id,
		customer: String(r.customer),
		producer: r.producer ?? null,
		accountType: r.account_type ?? null,
		dateOfDeal: isoDate(r.date_of_deal),
		equipment: r.equipment ?? null,
		amount: num(r.amount),
		goodToOrder: !!r.good_to_order,
		ordered: !!r.ordered,
		eta: r.eta ?? null,
		terms: r.terms ?? null,
		invoice: r.invoice ?? null,
		completion: r.completion ?? null,
		notes: r.notes ?? null,
		updatedAt: String(r.updated_at)
	};
}
function mapModule(r) {
	return {
		id: r.id,
		moduleId: String(r.module_id),
		platform: r.platform ?? null,
		moduleType: r.module_type ?? null,
		status: String(r.status),
		wo: r.wo ?? null,
		location: r.location ?? null,
		dateIn: isoDate(r.date_in),
		dateReady: isoDate(r.date_ready),
		technician: r.technician ?? null,
		notes: r.notes ?? null,
		updatedAt: String(r.updated_at)
	};
}
function mapComment(r) {
	return {
		id: r.id,
		entityType: String(r.entity_type),
		entityId: r.entity_id,
		authorId: r.author_id ?? null,
		authorName: r.author_name ?? null,
		body: String(r.body),
		askTeam: r.ask_team ?? null,
		resolved: !!r.resolved,
		createdAt: String(r.created_at)
	};
}
function mapAsset(r) {
	const pallet = r.pallet;
	const level = num(r.level);
	const lineNo = num(r.line_no);
	return {
		id: r.id,
		kind: r.kind,
		model: r.model,
		serial: r.serial,
		qty: num(r.qty) ?? 1,
		customerOwned: r.customer_owned,
		site: r.site,
		pallet,
		level,
		lineNo,
		purpose: r.purpose,
		status: r.status,
		soldTo: r.sold_to,
		soldAt: isoDate(r.sold_at),
		installId: r.install_id,
		notes: r.notes,
		updatedAt: String(r.updated_at),
		bay: bayFor(r.site, pallet),
		slotLabel: pallet && level ? slotId(pallet, level, lineNo) : siteLabel(r.site),
		missingSerial: r.kind === "equip" && !r.serial
	};
}
function mapRecipe(r) {
	return {
		id: r.id,
		equipmentModel: String(r.equipment_model),
		customer: r.customer ?? null,
		installId: num(r.install_id),
		copiedFrom: num(r.copied_from),
		isTemplate: Boolean(r.is_template),
		coffee1: r.coffee_1 ?? null,
		coffee2: r.coffee_2 ?? null,
		coffee3: r.coffee_3 ?? null,
		powder1: r.powder_1 ?? null,
		powder2: r.powder_2 ?? null,
		powder3: r.powder_3 ?? null,
		americano1: r.americano_1 ?? null,
		americano2: r.americano_2 ?? null,
		americano3: r.americano_3 ?? null,
		tea1: r.tea_1 ?? null,
		tea2: r.tea_2 ?? null,
		milk: r.milk ?? null,
		notes: r.notes ?? null,
		updatedAt: String(r.updated_at)
	};
}
var getDashboard = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async () => {
	const sql = await ready();
	const today = todayChicago();
	const week = weekBounds(today);
	const jobs = (await sql`select * from service_jobs`).map((r) => mapJob(r, today));
	const pms = (await sql`select * from pm_jobs`).map((r) => mapPm(r, today));
	const installs = (await sql`select * from installs`).map((r) => mapInstall(r, today, week));
	const deals = (await sql`select * from deals`).map(mapDeal);
	const svc = jobs.filter((j) => j.kind === "service");
	const tlc = jobs.filter((j) => j.kind === "tlc");
	const svcActive = svc.filter((j) => !CLOSED_CALL.has(j.status) && !j.done);
	const tlcActive = tlc.filter((j) => !CLOSED_CALL.has(j.status) && !j.done);
	const pmActive = pms.filter((p) => !CLOSED_PM.has(p.status) && !p.done);
	const flaggedSvc = svc.filter((j) => j.flag).sort((a, b) => a.flag.rank - b.flag.rank || (a.ageDays ?? 0) - (b.ageDays ?? 0) || a.id - b.id);
	const flaggedTlc = tlc.filter((j) => j.flag).sort((a, b) => (a.received ?? "").localeCompare(b.received ?? ""));
	const flaggedPm = pms.filter((p) => p.flag);
	const toFlag = (j, type) => ({
		id: j.id,
		entityType: type,
		customer: j.customer ?? "Untitled",
		flag: j.flag,
		status: j.status,
		received: j.received,
		scheduled: j.scheduled,
		technician: j.technician,
		detail: j.wo,
		kind: j.kind
	});
	const comingDue = [];
	const horizon = addDays(today, 14);
	for (const j of jobs) {
		if (CLOSED_CALL.has(j.status) || j.done || !j.scheduled) continue;
		if (j.scheduled >= today && j.scheduled <= horizon) comingDue.push({
			daysOut: diffDays(today, j.scheduled),
			source: j.kind === "tlc" ? "TLC + Factor" : "Service Tracker",
			customer: j.customer ?? "Untitled",
			equipment: j.equipment,
			status: j.status,
			scheduled: j.scheduled,
			technician: j.technician,
			detail: j.wo,
			entityType: j.kind,
			id: j.id
		});
	}
	for (const p of pms) {
		if (CLOSED_PM.has(p.status) || p.done || !p.projected) continue;
		if (p.projected >= today && p.projected <= horizon) comingDue.push({
			daysOut: diffDays(today, p.projected),
			source: "PM Tracker",
			customer: p.customer,
			equipment: p.equipment,
			status: p.status,
			scheduled: p.projected,
			technician: p.technician,
			detail: p.style,
			entityType: "pm",
			id: p.id
		});
	}
	for (const i of installs) {
		if (i.complete || i.equipStatus === "Installed" || !i.installDate) continue;
		if (i.installDate >= today && i.installDate <= horizon) comingDue.push({
			daysOut: diffDays(today, i.installDate),
			source: "Installs",
			customer: i.customer,
			equipment: i.equipment,
			status: i.equipStatus ?? "",
			scheduled: i.installDate,
			technician: i.technician,
			detail: i.wo,
			entityType: "install",
			id: i.id
		});
	}
	comingDue.sort((a, b) => a.daysOut - b.daysOut || a.customer.localeCompare(b.customer));
	const statusBreakdown = [
		"Open",
		"Dispatched",
		"In Progress",
		"Follow-up Needed",
		"Phone Resolved",
		"Completed",
		"Cancelled"
	].map((status) => ({
		status,
		service: svc.filter((j) => j.status === status).length,
		tlc: tlc.filter((j) => j.status === status).length
	}));
	const techLoad = TECHNICIANS.map((tech) => {
		const all = jobs.filter((j) => j.technician === tech);
		return {
			tech,
			active: all.filter((j) => !CLOSED_CALL.has(j.status) && !j.done).length,
			completed: all.filter((j) => j.status === "Completed" || j.done).length
		};
	});
	const comments = await sql`
      select * from comments order by created_at desc limit 12`;
	const recentHandoff = [];
	for (const c of comments) {
		const mapped = mapComment(c);
		recentHandoff.push({
			...mapped,
			customer: await customerFor(sql, mapped.entityType, mapped.entityId)
		});
	}
	const openAsks = await sql`
      select count(*)::int as c from comments where ask_team is not null and resolved = false`;
	const installNames = new Set(installs.map((i) => i.customer.trim().toLowerCase()));
	const pendingHandoffs = deals.filter((d) => d.completion === "complete").filter((d) => !installNames.has(d.customer.trim().toLowerCase())).map((d) => ({
		dealId: d.id,
		customer: d.customer,
		equipment: d.equipment,
		producer: d.producer
	}));
	const installQueue = installs.filter((i) => !i.complete && i.equipStatus !== "Installed");
	const installAtRisk = installQueue.filter((i) => i.flag).length;
	const installReadyRows = installQueue.filter((i) => i.equipStatus === "Ready");
	const installReadyByEquip = (() => {
		const map = /* @__PURE__ */ new Map();
		for (const i of installReadyRows) {
			const names = listedEquipment(i.equipment);
			const keys = names.length ? names : ["Unspecified"];
			for (const name of keys) map.set(name, (map.get(name) ?? 0) + 1);
		}
		return [...map.entries()].map(([name, count]) => ({
			name,
			count
		})).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 12);
	})();
	const barnReady = await sql`
      select coalesce(sum(qty), 0)::int as c from assets
      where status = 'ready' and site in ('barn-back', 'barn-front') and kind = 'equip'`;
	const barnLines = await sql`
      select count(*)::int as c from assets
      where status = 'ready' and site in ('barn-back', 'barn-front') and kind = 'equip'`;
	const barnReadyByModel = await sql`
      select model as name, coalesce(sum(qty), 0)::int as count
      from assets
      where status = 'ready' and site in ('barn-back', 'barn-front') and kind = 'equip'
      group by model
      order by count desc, name
      limit 12`;
	const modulesReadyByType = await sql`
      select coalesce(nullif(trim(module_type), ''), 'Unspecified') as name, count(*)::int as count
      from modules
      where status = 'Ready'
      group by 1
      order by count desc, name`;
	const modulesReady = modulesReadyByType.reduce((n, r) => n + Number(r.count), 0);
	const liveDeals = deals.filter((d) => d.completion !== "fell");
	const openDeals = liveDeals.filter((d) => d.completion !== "complete");
	const doneDeals = liveDeals.filter((d) => d.completion === "complete");
	const comingDueBuckets = Array.from({ length: 15 }, (_, day) => ({
		label: day === 0 ? "Today" : `${day}d`,
		day,
		count: comingDue.filter((r) => r.daysOut === day).length
	}));
	return {
		today,
		weekLabel: formatWeekLabel(week.start, week.end),
		nextWeekLabel: formatWeekLabel(week.nextStart, week.nextEnd),
		kpis: {
			svcFlags: flaggedSvc.length,
			tlcFlags: flaggedTlc.length,
			pmFlags: flaggedPm.length,
			activeCalls: svcActive.length + tlcActive.length,
			pmsActive: pmActive.length,
			comingDue: comingDue.length,
			installQueue: installQueue.length,
			installAtRisk,
			openAsks: openAsks[0]?.c ?? 0,
			barnReady: barnReady[0]?.c ?? 0,
			barnOpen: Math.max(0, BARN_EQUIP_CAPACITY - (barnLines[0]?.c ?? 0)),
			modulesReady,
			installReady: installReadyRows.length
		},
		statusBreakdown,
		techLoad,
		flagged: {
			service: flaggedSvc.slice(0, 12).map((j) => toFlag(j, "service")),
			tlc: flaggedTlc.slice(0, 12).map((j) => toFlag(j, "tlc")),
			pm: flaggedPm.slice(0, 12).map((p) => ({
				id: p.id,
				entityType: "pm",
				customer: p.customer,
				flag: p.flag,
				status: p.status,
				received: p.received,
				scheduled: p.projected,
				technician: p.technician,
				detail: p.style
			}))
		},
		comingDue: comingDue.slice(0, 16),
		comingDueBuckets,
		recentHandoff,
		pendingHandoffs,
		barnReadyByModel,
		modulesReadyByType,
		installReadyByEquip,
		installStatus: [
			{
				name: "Ready",
				count: installReadyRows.length
			},
			{
				name: "Not ready",
				count: installQueue.filter((i) => i.equipStatus !== "Ready").length
			},
			{
				name: "Installed",
				count: installs.filter((i) => i.complete || i.equipStatus === "Installed").length
			}
		],
		pipelineSnap: {
			openCount: openDeals.length,
			openValue: openDeals.reduce((n, d) => n + (d.amount ?? 0), 0),
			goodToOrder: openDeals.filter((d) => d.goodToOrder).length,
			ordered: openDeals.filter((d) => d.ordered).length,
			completeCount: doneDeals.length,
			completeValue: doneDeals.reduce((n, d) => n + (d.amount ?? 0), 0)
		}
	};
});
async function customerFor(sql, type, id) {
	return (await entityContext(sql, type, id)).customer;
}
async function entityContext(sql, type, id) {
	const empty = {
		customer: null,
		technician: null,
		producer: null,
		accountRep: null
	};
	if (type === "service" || type === "tlc") {
		const r = await sql`
      select customer, technician from service_jobs where id = ${id}`;
		return {
			...empty,
			customer: r[0]?.customer ?? null,
			technician: r[0]?.technician ?? null
		};
	}
	if (type === "pm") {
		const r = await sql`
      select customer, technician from pm_jobs where id = ${id}`;
		return {
			...empty,
			customer: r[0]?.customer ?? null,
			technician: r[0]?.technician ?? null
		};
	}
	if (type === "install") {
		const r = await sql`
      select customer, technician, account_rep from installs where id = ${id}`;
		return {
			...empty,
			customer: r[0]?.customer ?? null,
			technician: r[0]?.technician ?? null,
			accountRep: r[0]?.account_rep ?? null
		};
	}
	if (type === "deal") {
		const r = await sql`
      select customer, producer from deals where id = ${id}`;
		return {
			...empty,
			customer: r[0]?.customer ?? null,
			producer: r[0]?.producer ?? null
		};
	}
	if (type === "module") {
		const r = await sql`
      select location, module_id, technician from modules where id = ${id}`;
		return {
			...empty,
			customer: r[0]?.location ?? r[0]?.module_id ?? null,
			technician: r[0]?.technician ?? null
		};
	}
	return empty;
}
var listJobs = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready();
	const today = todayChicago();
	return (await sql`
      select * from service_jobs where kind = ${data.kind} order by received desc nulls last, id desc`).map((r) => mapJob(r, today));
});
var getJob = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const rows = await (await ready())`select * from service_jobs where id = ${data.id}`;
	return rows[0] ? mapJob(rows[0], todayChicago()) : null;
});
var jobPatch = object({
	id: number(),
	contact: string().nullable().optional(),
	phone: string().nullable().optional(),
	received: string().nullable().optional(),
	customer: string().nullable().optional(),
	equipment: string().nullable().optional(),
	issue: string().nullable().optional(),
	callType: string().nullable().optional(),
	phoneResolved: boolean().optional(),
	status: string().optional(),
	technician: string().nullable().optional(),
	wo: string().nullable().optional(),
	scheduled: string().nullable().optional(),
	notes: string().nullable().optional(),
	done: boolean().optional(),
	urgency: string().optional()
});
var updateJob = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => jobPatch.parse(d)).handler(async ({ data, context }) => {
	const sql = await ready();
	const cur = await sql`select * from service_jobs where id = ${data.id}`;
	if (!cur[0]) throw new Error("Job not found");
	const next = {
		contact: data.contact ?? cur[0].contact,
		phone: data.phone ?? cur[0].phone,
		received: data.received === void 0 ? cur[0].received : data.received,
		customer: data.customer ?? cur[0].customer,
		equipment: data.equipment ?? cur[0].equipment,
		issue: data.issue ?? cur[0].issue,
		call_type: data.callType === void 0 ? cur[0].call_type : data.callType,
		phone_resolved: data.phoneResolved === void 0 ? cur[0].phone_resolved : data.phoneResolved,
		status: data.status ?? cur[0].status,
		technician: data.technician === void 0 ? cur[0].technician : data.technician,
		wo: data.wo === void 0 ? cur[0].wo : data.wo,
		scheduled: data.scheduled === void 0 ? cur[0].scheduled : data.scheduled,
		notes: data.notes === void 0 ? cur[0].notes : data.notes,
		done: data.done === void 0 ? cur[0].done : data.done,
		urgency: data.urgency ?? cur[0].urgency ?? "Normal"
	};
	if (CLOSED_CALL.has(next.status)) next.done = true;
	else if (data.status) next.done = false;
	if (next.status === "Phone Resolved") next.phone_resolved = true;
	else if (data.status && next.status !== "Phone Resolved") next.phone_resolved = false;
	await sql`
      update service_jobs set
        contact = ${next.contact},
        phone = ${next.phone},
        received = ${next.received},
        customer = ${next.customer},
        equipment = ${next.equipment},
        issue = ${next.issue},
        call_type = ${next.call_type},
        phone_resolved = ${next.phone_resolved},
        status = ${next.status},
        technician = ${next.technician},
        wo = ${next.wo},
        scheduled = ${next.scheduled},
        notes = ${next.notes},
        done = ${next.done},
        urgency = ${next.urgency},
        updated_at = now()
      where id = ${data.id}`;
	if (data.status && data.status !== cur[0].status) await sql`
        insert into activity (entity_type, entity_id, actor_name, action, detail)
        values (${cur[0].kind}, ${data.id}, ${context.userId}, ${"status"}, ${`${cur[0].status} → ${data.status}`})`;
	return getJob({ data: { id: data.id } });
});
var createJob = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready();
	const received = data.received || todayChicago();
	const prefix = `SC-${received.replace(/-/g, "").slice(0, 6)}-`;
	const last = await sql`
      select call_id from service_jobs
      where call_id like ${prefix + "%"}
      order by call_id desc limit 1`;
	let seq = 1;
	if (last[0]) {
		const n = Number(last[0].call_id.slice(-3));
		if (Number.isFinite(n)) seq = n + 1;
	}
	const callId = `${prefix}${String(seq).padStart(3, "0")}`;
	const urgency = data.urgency || "Normal";
	return getJob({ data: { id: (await sql`
      insert into service_jobs (kind, call_id, customer, issue, equipment, contact, phone, received, call_type, technician, status, urgency)
      values (${data.kind}, ${callId}, ${data.customer}, ${data.issue ?? null}, ${data.equipment ?? null}, ${data.contact ?? null}, ${data.phone ?? null}, ${received}, ${data.callType ?? "Field Service"}, ${data.technician ?? null}, ${"Open"}, ${urgency})
      returning id`)[0].id } });
});
var listPms = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async () => {
	return (await (await ready())`select * from pm_jobs order by received desc nulls last, id desc`).map((r) => mapPm(r, todayChicago()));
});
var updatePm = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready();
	const cur = await sql`select * from pm_jobs where id = ${data.id}`;
	if (!cur[0]) throw new Error("PM not found");
	const c = cur[0];
	const status = data.status ?? c.status;
	const done = data.done === void 0 ? data.status === void 0 ? c.done : CLOSED_PM.has(status) : data.done;
	await sql`
      update pm_jobs set
        customer = ${data.customer ?? c.customer},
        equipment = ${data.equipment === void 0 ? c.equipment : data.equipment},
        style = ${data.style === void 0 ? c.style : data.style},
        projected = ${data.projected === void 0 ? c.projected : data.projected},
        parts_status = ${data.partsStatus === void 0 ? c.parts_status : data.partsStatus},
        status = ${status},
        technician = ${data.technician === void 0 ? c.technician : data.technician},
        notes = ${data.notes === void 0 ? c.notes : data.notes},
        done = ${done},
        updated_at = now()
      where id = ${data.id}`;
	return mapPm((await sql`select * from pm_jobs where id = ${data.id}`)[0], todayChicago());
});
var createPm = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready();
	return mapPm((await sql`select * from pm_jobs where id = ${(await sql`
      insert into pm_jobs (customer, equipment, style, received, status)
      values (${data.customer}, ${data.equipment ?? null}, ${data.style ?? "12 month PM"}, ${todayChicago()}, ${"Pending Scheduling"})
      returning id`)[0].id}`)[0], todayChicago());
});
var listModules = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async () => {
	return (await (await ready())`select * from modules order by module_id`).map(mapModule);
});
var updateModule = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready();
	const cur = await sql`select * from modules where id = ${data.id}`;
	if (!cur[0]) throw new Error("Module not found");
	const c = cur[0];
	await sql`
      update modules set
        status = ${data.status ?? c.status},
        wo = ${data.wo === void 0 ? c.wo : data.wo},
        location = ${data.location === void 0 ? c.location : data.location},
        date_in = ${data.dateIn === void 0 ? c.date_in : data.dateIn},
        date_ready = ${data.dateReady === void 0 ? c.date_ready : data.dateReady},
        technician = ${data.technician === void 0 ? c.technician : data.technician},
        notes = ${data.notes === void 0 ? c.notes : data.notes},
        platform = ${data.platform === void 0 ? c.platform : data.platform},
        module_type = ${data.moduleType === void 0 ? c.module_type : data.moduleType},
        updated_at = now()
      where id = ${data.id}`;
	return mapModule((await sql`select * from modules where id = ${data.id}`)[0]);
});
var createModule = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	return mapModule((await (await ready())`
      insert into modules (module_id, platform, module_type, status, location)
      values (${data.moduleId}, ${data.platform ?? "Cameo"}, ${data.moduleType ?? "Brew Module"}, ${"Not Started"}, ${"SHELF"})
      returning *`)[0]);
});
var listDeals = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async () => {
	return (await (await ready())`select * from deals order by id`).map(mapDeal);
});
var updateDeal = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready();
	const cur = await sql`select * from deals where id = ${data.id}`;
	if (!cur[0]) throw new Error("Deal not found");
	const c = cur[0];
	const completion = data.completion === void 0 ? c.completion : data.completion;
	await sql`
      update deals set
        customer = ${data.customer ?? c.customer},
        producer = ${data.producer === void 0 ? c.producer : data.producer},
        account_type = ${data.accountType === void 0 ? c.account_type : data.accountType},
        equipment = ${data.equipment === void 0 ? c.equipment : data.equipment},
        amount = ${data.amount === void 0 ? c.amount : data.amount},
        good_to_order = ${data.goodToOrder === void 0 ? c.good_to_order : data.goodToOrder},
        ordered = ${data.ordered === void 0 ? c.ordered : data.ordered},
        eta = ${data.eta === void 0 ? c.eta : data.eta},
        terms = ${data.terms === void 0 ? c.terms : data.terms},
        invoice = ${data.invoice === void 0 ? c.invoice : data.invoice},
        completion = ${completion},
        notes = ${data.notes === void 0 ? c.notes : data.notes},
        updated_at = now()
      where id = ${data.id}`;
	if (completion === "complete") await maybeHandoffInstall(sql, data.id);
	return mapDeal((await sql`select * from deals where id = ${data.id}`)[0]);
});
var createDeal = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	return mapDeal((await (await ready())`
      insert into deals (customer, producer, equipment, amount, date_of_deal)
      values (${data.customer}, ${data.producer ?? null}, ${data.equipment ?? null}, ${data.amount ?? null}, ${todayChicago()})
      returning *`)[0]);
});
async function maybeHandoffInstall(sql, dealId) {
	const deal = (await sql`select * from deals where id = ${dealId}`)[0];
	if (!deal) return;
	if ((await sql`
    select id from installs where lower(customer) = ${String(deal.customer).trim().toLowerCase()} limit 1`)[0]) return;
	const initials = PRODUCER_INITIALS[String(deal.producer ?? "")] ?? null;
	await sql`
    insert into installs (received, customer, equipment, account_rep, payment_status, deal_id)
    values (${todayChicago()}, ${deal.customer}, ${deal.equipment ?? null}, ${initials}, ${deal.terms ?? null}, ${dealId})`;
}
var listInstalls = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async () => {
	const sql = await ready();
	const today = todayChicago();
	const week = weekBounds(today);
	return (await sql`select * from installs order by id`).map((r) => mapInstall(r, today, week));
});
var updateInstall = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready();
	const cur = await sql`select * from installs where id = ${data.id}`;
	if (!cur[0]) throw new Error("Install not found");
	const c = cur[0];
	const equipStatus = data.equipStatus === void 0 ? c.equip_status : data.equipStatus;
	const complete = data.complete === void 0 ? data.equipStatus === void 0 ? c.complete : equipStatus === "Installed" : data.complete;
	const machinesJson = data.machines === void 0 ? c.machines : data.machines == null ? null : typeof data.machines === "string" ? data.machines : JSON.stringify(data.machines);
	await sql`
      update installs set
        customer = ${data.customer ?? c.customer},
        equipment = ${data.equipment === void 0 ? c.equipment : data.equipment},
        equip_status = ${equipStatus},
        install_date = ${data.installDate === void 0 ? c.install_date : data.installDate},
        technician = ${data.technician === void 0 ? c.technician : data.technician},
        wo = ${data.wo === void 0 ? c.wo : data.wo},
        reqs_ready = ${data.reqsReady === void 0 ? c.reqs_ready : data.reqsReady},
        notes = ${data.notes === void 0 ? c.notes : data.notes},
        account_rep = ${data.accountRep === void 0 ? c.account_rep : data.accountRep},
        payment_status = ${data.paymentStatus === void 0 ? c.payment_status : data.paymentStatus},
        serial = ${data.serial === void 0 ? c.serial : data.serial},
        power_voltage = ${data.powerVoltage === void 0 ? c.power_voltage : data.powerVoltage},
        machines = ${machinesJson},
        complete = ${complete},
        updated_at = now()
      where id = ${data.id}`;
	const today = todayChicago();
	const week = weekBounds(today);
	return mapInstall((await sql`select * from installs where id = ${data.id}`)[0], today, week);
});
var createInstall = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready();
	const machinesJson = data.machines == null ? null : typeof data.machines === "string" ? data.machines : JSON.stringify(data.machines);
	return mapInstall((await sql`
      insert into installs (received, customer, equipment, technician, equip_status, serial, power_voltage, machines)
      values (
        ${todayChicago()},
        ${data.customer},
        ${data.equipment ?? null},
        ${data.technician ?? null},
        ${"Not Ready"},
        ${data.serial?.trim() || null},
        ${data.powerVoltage?.trim() || null},
        ${machinesJson}
      )
      returning *`)[0], todayChicago(), weekBounds(todayChicago()));
});
var listComments = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	return (await (await ready())`
      select * from comments
      where entity_type = ${data.entityType} and entity_id = ${data.entityId}
      order by created_at asc`).map(mapComment);
});
var addComment = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data, context }) => {
	const sql = await ready();
	const body = data.body.trim();
	if (!body) throw new Error("Message is empty");
	const authorName = (await sql.query("select username from desk_accounts where user_id = $1", [context.userId]))[0]?.username || data.authorName || "Teammate";
	return mapComment((await sql`
      insert into comments (entity_type, entity_id, author_id, author_name, body, ask_team)
      values (${data.entityType}, ${data.entityId}, ${context.userId}, ${authorName}, ${body}, ${data.askTeam ?? null})
      returning *`)[0]);
});
var resolveComment = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	await (await ready())`update comments set resolved = ${data.resolved} where id = ${data.id}`;
	return { ok: true };
});
var getHandoff = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async () => {
	const sql = await ready();
	const askRows = await sql`
      select * from comments
      where ask_team is not null and resolved = false
      order by created_at desc`;
	const recentRows = await sql`
      select * from comments order by created_at desc limit 30`;
	const asks = [];
	for (const r of askRows) {
		const c = mapComment(r);
		const ctx = await entityContext(sql, c.entityType, c.entityId);
		asks.push({
			...c,
			customer: ctx.customer,
			status: c.askTeam,
			technician: ctx.technician,
			producer: ctx.producer,
			accountRep: ctx.accountRep
		});
	}
	const recent = [];
	for (const r of recentRows) {
		const c = mapComment(r);
		const ctx = await entityContext(sql, c.entityType, c.entityId);
		recent.push({
			...c,
			customer: ctx.customer,
			technician: ctx.technician,
			producer: ctx.producer,
			accountRep: ctx.accountRep
		});
	}
	const deals = (await sql`select * from deals`).map(mapDeal);
	const installs = await sql`select customer from installs`;
	const names = new Set(installs.map((i) => i.customer.trim().toLowerCase()));
	return {
		asks,
		recent,
		pendingHandoffs: deals.filter((d) => d.completion === "complete" && !names.has(d.customer.trim().toLowerCase())).map((d) => ({
			dealId: d.id,
			customer: d.customer,
			equipment: d.equipment,
			producer: d.producer
		}))
	};
});
var searchAll = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready();
	const q = data.q.trim();
	if (q.length < 2) return [];
	const like = `%${q.replace(/%/g, "")}%`;
	const hits = [];
	const jobs = await sql`
      select id, kind, customer, call_id, status, wo from service_jobs
      where customer ilike ${like} or call_id ilike ${like} or coalesce(wo,'') ilike ${like} or coalesce(issue,'') ilike ${like}
      order by received desc nulls last limit 8`;
	for (const j of jobs) hits.push({
		entityType: j.kind,
		id: j.id,
		title: j.customer ?? j.call_id,
		subtitle: `${j.call_id}${j.wo ? " · " + j.wo : ""}`,
		status: j.status
	});
	const pms = await sql`
      select id, customer, status, equipment from pm_jobs where customer ilike ${like} limit 5`;
	for (const p of pms) hits.push({
		entityType: "pm",
		id: p.id,
		title: p.customer,
		subtitle: p.equipment ?? "PM",
		status: p.status
	});
	const ins = await sql`
      select id, customer, equip_status, wo from installs where customer ilike ${like} or coalesce(wo,'') ilike ${like} limit 5`;
	for (const i of ins) hits.push({
		entityType: "install",
		id: i.id,
		title: i.customer,
		subtitle: i.wo ?? "Install",
		status: i.equip_status
	});
	const deals = await sql`
      select id, customer, producer, completion from deals where customer ilike ${like} limit 5`;
	for (const d of deals) hits.push({
		entityType: "deal",
		id: d.id,
		title: d.customer,
		subtitle: d.producer ?? "Deal",
		status: d.completion === "complete" ? "Complete" : d.completion === "fell" ? "Fell through" : "Open"
	});
	const mods = await sql`
      select id, module_id, status, location from modules
      where module_id ilike ${like} or coalesce(location,'') ilike ${like} limit 5`;
	for (const m of mods) hits.push({
		entityType: "module",
		id: m.id,
		title: m.module_id,
		subtitle: m.location ?? "Module",
		status: m.status
	});
	const assets = await sql`
      select id, model, serial, site, status from assets
      where model ilike ${like} or coalesce(serial,'') ilike ${like} or coalesce(sold_to,'') ilike ${like}
      limit 8`;
	for (const a of assets) hits.push({
		entityType: a.status === "deployed" || a.site === "field" ? "location" : "asset",
		id: a.id,
		title: a.model,
		subtitle: [a.serial, siteLabel(a.site)].filter(Boolean).join(" · "),
		status: a.status
	});
	const recs = await sql`
      select id, equipment_model, customer, is_template from recipes
      where equipment_model ilike ${like} or coalesce(customer, '') ilike ${like}
      limit 8`;
	for (const r of recs) hits.push({
		entityType: "recipe",
		id: r.id,
		title: r.equipment_model,
		subtitle: r.customer ?? (r.is_template ? "House template" : "Recipe"),
		status: r.customer ? "Account" : "House"
	});
	return hits.slice(0, 24);
});
var handoffDeal = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	await maybeHandoffInstall(await ready(), data.dealId);
	return { ok: true };
});
async function nextLine(sql, site, pallet, level) {
	const taken = await sql`
    select line_no from assets
    where site = ${site} and pallet = ${pallet} and level = ${level}
      and status in ('ready', 'deployed') and line_no is not null`;
	const used = new Set(taken.map((t) => t.line_no));
	for (let n = 1; n <= 12; n++) if (!used.has(n)) return n;
	return null;
}
async function findOpenBarnSlot(sql, preferred) {
	const taken = await sql`
    select site, pallet, level, line_no from assets
    where status in ('ready', 'deployed')
      and pallet is not null and level is not null and line_no is not null`;
	const used = new Set(taken.map((t) => `${t.site}|${t.pallet}|${t.level}|${t.line_no}`));
	const firstLine = (site, pallet, level) => {
		for (let n = 1; n <= 12; n++) if (!used.has(`${site}|${pallet}|${level}|${n}`)) return n;
		return null;
	};
	const tries = [];
	const push = (site, pallet, level) => {
		if (site !== "barn-back" && site !== "barn-front") return;
		tries.push({
			site,
			pallet,
			level
		});
	};
	if (preferred?.site && preferred.pallet && preferred.level != null) push(preferred.site, preferred.pallet, preferred.level);
	const siteOrder = [];
	if (preferred?.site === "barn-front") siteOrder.push("barn-front", "barn-back");
	else siteOrder.push("barn-back", "barn-front");
	for (const site of siteOrder) {
		const pallets = site === "barn-front" ? FRONT_PALLETS : BACK_PALLETS;
		const palletOrder = preferred?.pallet && pallets.includes(preferred.pallet) ? [preferred.pallet, ...pallets.filter((p) => p !== preferred.pallet)] : [...pallets];
		for (const pallet of palletOrder) for (const level of LEVELS) {
			if (preferred?.site === site && preferred.pallet === pallet && preferred.level === level) continue;
			push(site, pallet, level);
		}
	}
	for (const t of tries) {
		const line = firstLine(t.site, t.pallet, t.level);
		if (line != null) return {
			...t,
			line
		};
	}
	throw new Error("Barn is full — return this unit from the warehouse page");
}
var listAssets = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async () => {
	return (await (await ready())`select * from assets order by id`).map(mapAsset);
});
var createAsset = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready();
	const kind = data.kind ?? "equip";
	const site = data.site;
	let pallet = data.pallet ?? null;
	let level = data.level ?? null;
	let line = null;
	const barn = isBarn(site);
	if (barn) {
		if (!pallet || !level) throw new Error("Pick a pallet and level");
		if (!palletsFor(site).includes(pallet)) throw new Error("That pallet is not on this rack");
		line = await nextLine(sql, site, pallet, level);
		if (line == null) throw new Error("That slot is full (12 lines)");
	}
	const status = barn ? "ready" : "deployed";
	return mapAsset((await sql`
      insert into assets (kind, model, serial, qty, customer_owned, site, pallet, level, line_no, purpose, status, notes)
      values (
        ${kind}, ${data.model}, ${data.serial || null}, ${data.qty ?? 1},
        ${data.customerOwned || null}, ${site}, ${pallet}, ${level}, ${line},
        ${data.purpose || null}, ${status}, ${data.notes || null}
      )
      returning *`)[0]);
});
var updateAsset = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready();
	const cur = await sql`select * from assets where id = ${data.id}`;
	if (!cur[0]) throw new Error("Asset not found");
	const c = cur[0];
	let pallet = data.pallet === void 0 ? c.pallet : data.pallet;
	let level = data.level === void 0 ? c.level : data.level;
	let line = c.line_no;
	const site = data.site === void 0 ? c.site : data.site;
	if (isBarn(site) && (pallet !== c.pallet || level !== c.level || site !== c.site) && pallet && level) {
		line = await nextLine(sql, site, pallet, level);
		if (line == null) throw new Error("That slot is full");
	}
	await sql`
      update assets set
        model = ${data.model ?? c.model},
        serial = ${data.serial === void 0 ? c.serial : data.serial},
        qty = ${data.qty === void 0 ? c.qty : data.qty},
        customer_owned = ${data.customerOwned === void 0 ? c.customer_owned : data.customerOwned},
        purpose = ${data.purpose === void 0 ? c.purpose : data.purpose},
        notes = ${data.notes === void 0 ? c.notes : data.notes},
        site = ${site},
        pallet = ${pallet},
        level = ${level},
        line_no = ${line},
        updated_at = now()
      where id = ${data.id}`;
	return mapAsset((await sql`select * from assets where id = ${data.id}`)[0]);
});
var assignAssetToInstall = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data, context }) => {
	const sql = await ready();
	const asset = (await sql`select * from assets where id = ${data.assetId}`)[0];
	if (!asset) throw new Error("Asset not found");
	if (asset.status === "sold") throw new Error("Already sold");
	const inst = (await sql`
      select id, customer from installs where id = ${data.installId}`)[0];
	if (!inst) throw new Error("Install not found");
	const originSite = asset.origin_site ?? asset.site;
	const originPallet = asset.origin_pallet ?? asset.pallet;
	const originLevel = asset.origin_level ?? asset.level;
	await sql`
      update assets set
        status = 'assigned',
        site = 'field',
        pallet = null,
        level = null,
        line_no = null,
        install_id = ${inst.id},
        sold_to = ${inst.customer},
        origin_site = ${originSite},
        origin_pallet = ${originPallet},
        origin_level = ${originLevel},
        purpose = ${asset.customer_owned ? "Customer-owned / loaner" : "Install"},
        updated_at = now()
      where id = ${data.assetId}`;
	const detail = `Pulled ${asset.model}${asset.serial ? " · " + asset.serial : ""} from ${asset.pallet ? slotId(asset.pallet, asset.level ?? 0, asset.line_no) : siteLabel(asset.site)}.`;
	await sql`
      insert into activity (entity_type, entity_id, actor_name, action, detail)
      values ('install', ${inst.id}, ${context.userId}, 'assigned-asset', ${detail})`;
	return mapAsset((await sql`select * from assets where id = ${data.assetId}`)[0]);
});
var unassignAssetFromInstall = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data, context }) => {
	const sql = await ready();
	const asset = (await sql`select * from assets where id = ${data.assetId}`)[0];
	if (!asset) throw new Error("Asset not found");
	if (asset.install_id !== data.installId) throw new Error("That unit is not on this install");
	const slot = await findOpenBarnSlot(sql, {
		site: asset.origin_site ?? null,
		pallet: asset.origin_pallet ?? null,
		level: num(asset.origin_level)
	});
	await sql`
      update assets set
        status = 'ready',
        site = ${slot.site},
        pallet = ${slot.pallet},
        level = ${slot.level},
        line_no = ${slot.line},
        install_id = null,
        sold_to = null,
        sold_at = null,
        purpose = null,
        updated_at = now()
      where id = ${data.assetId}`;
	await sql`
      insert into activity (entity_type, entity_id, actor_name, action, detail)
      values ('install', ${data.installId}, ${context.userId}, 'unassigned-asset', ${asset.model})`;
	return mapAsset((await sql`select * from assets where id = ${data.assetId}`)[0]);
});
var returnAssetToWarehouse = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data, context }) => {
	const sql = await ready();
	if (!(await sql`select * from assets where id = ${data.id}`)[0]) throw new Error("Asset not found");
	if (!palletsFor(data.site).includes(data.pallet)) throw new Error("Pallet not on that rack");
	const line = await nextLine(sql, data.site, data.pallet, data.level);
	if (line == null) throw new Error("That slot is full");
	await sql`
      update assets set
        status = 'ready',
        site = ${data.site},
        pallet = ${data.pallet},
        level = ${data.level},
        line_no = ${line},
        install_id = null,
        sold_to = null,
        sold_at = null,
        purpose = null,
        updated_at = now()
      where id = ${data.id}`;
	await sql`
      insert into activity (entity_type, entity_id, actor_name, action, detail)
      values ('asset', ${data.id}, ${context.userId}, 'returned', ${`${data.pallet}-L${data.level}`})`;
	return mapAsset((await sql`select * from assets where id = ${data.id}`)[0]);
});
var markAssetSold = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data, context }) => {
	const sql = await ready();
	const cur = (await sql`select * from assets where id = ${data.id}`)[0];
	if (!cur) throw new Error("Asset not found");
	if (cur.customer_owned) throw new Error("Customer-owned unit — return it, don’t sell it");
	await sql`
      update assets set
        status = 'sold',
        site = 'sold',
        pallet = null,
        level = null,
        line_no = null,
        sold_to = ${data.soldTo},
        sold_at = ${todayChicago()},
        updated_at = now()
      where id = ${data.id}`;
	await sql`
      insert into activity (entity_type, entity_id, actor_name, action, detail)
      values ('asset', ${data.id}, ${context.userId}, 'sold', ${data.soldTo})`;
	return mapAsset((await sql`select * from assets where id = ${data.id}`)[0]);
});
var listRecipes = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async () => {
	return (await (await ready())`
      select * from recipes
      order by (customer is null) desc, customer, equipment_model`).map(mapRecipe);
});
var listCustomers = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async () => {
	return (await (await ready())`
      select distinct customer from (
        select name as customer from directory_customers
          where archived = false and coalesce(name, '') <> ''
        union
        select customer from installs where coalesce(customer, '') <> ''
        union
        select customer from deals where coalesce(customer, '') <> ''
        union
        select customer from service_jobs where coalesce(customer, '') <> ''
        union
        select customer from pm_jobs where coalesce(customer, '') <> ''
        union
        select customer from recipes where coalesce(customer, '') <> ''
      ) t
      order by customer`).map((r) => r.customer);
});
function directoryTable(kind) {
	if (kind === "customer") return "directory_customers";
	if (kind === "equipment") return "directory_equipment";
	throw new Error("Unknown directory");
}
var listDirectory = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready();
	const table = directoryTable(data.kind);
	return await sql.query(`select id, name from ${table} where archived = false order by lower(name)`);
});
var addDirectoryEntry = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready();
	const name = data.name.trim();
	if (!name) throw new Error("Name is empty");
	const table = directoryTable(data.kind);
	const existing = await sql.query(`select id, name, archived from ${table} where lower(name) = $1 limit 1`, [name.toLowerCase()]);
	if (existing[0]) {
		if (existing[0].archived) await sql.query(`update ${table} set archived = false, updated_at = now() where id = $1`, [existing[0].id]);
		return {
			id: existing[0].id,
			name: existing[0].name
		};
	}
	return (await sql.query(`insert into ${table} (name) values ($1) returning id, name`, [name]))[0];
});
var archiveDirectoryEntry = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready();
	const table = directoryTable(data.kind);
	await sql.query(`update ${table} set archived = true, updated_at = now() where id = $1`, [data.id]);
	return { ok: true };
});
async function findRecipeDup(sql, model, customer, exceptId) {
	const hit = (customer ? await sql`
        select id from recipes
        where lower(equipment_model) = ${model.toLowerCase()}
          and lower(customer) = ${customer.toLowerCase()}` : await sql`
        select id from recipes
        where lower(equipment_model) = ${model.toLowerCase()}
          and customer is null`)[0];
	if (hit && hit.id !== exceptId) return hit;
	return null;
}
var upsertRecipe = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready();
	const model = data.equipmentModel.trim();
	if (!model) throw new Error("Pick an equipment model");
	const customer = data.customer?.trim() || null;
	const isTemplate = !customer;
	let installId = data.installId ?? null;
	if (customer && installId == null) {
		const ins = await sql`
        select id from installs where lower(customer) = ${customer.toLowerCase()} limit 2`;
		if (ins.length === 1) installId = ins[0].id;
	}
	if (await findRecipeDup(sql, model, customer, data.id)) throw new Error(customer ? `A recipe for ${model} already exists on ${customer}` : "A house recipe for that model already exists — open it from the list");
	if (data.id) {
		await sql`
        update recipes set
          equipment_model = ${model},
          customer = ${customer},
          install_id = ${installId},
          copied_from = ${data.copiedFrom ?? null},
          is_template = ${isTemplate},
          coffee_1 = ${data.coffee1 ?? null},
          coffee_2 = ${data.coffee2 ?? null},
          coffee_3 = ${data.coffee3 ?? null},
          powder_1 = ${data.powder1 ?? null},
          powder_2 = ${data.powder2 ?? null},
          powder_3 = ${data.powder3 ?? null},
          americano_1 = ${data.americano1 ?? null},
          americano_2 = ${data.americano2 ?? null},
          americano_3 = ${data.americano3 ?? null},
          tea_1 = ${data.tea1 ?? null},
          tea_2 = ${data.tea2 ?? null},
          milk = ${data.milk ?? null},
          notes = ${data.notes ?? null},
          updated_at = now()
        where id = ${data.id}`;
		return mapRecipe((await sql`select * from recipes where id = ${data.id}`)[0]);
	}
	return mapRecipe((await sql`
      insert into recipes (
        equipment_model, customer, install_id, copied_from, is_template,
        coffee_1, coffee_2, coffee_3,
        powder_1, powder_2, powder_3, americano_1, americano_2, americano_3,
        tea_1, tea_2, milk, notes
      ) values (
        ${model}, ${customer}, ${installId}, ${data.copiedFrom ?? null}, ${isTemplate},
        ${data.coffee1 ?? null}, ${data.coffee2 ?? null}, ${data.coffee3 ?? null},
        ${data.powder1 ?? null}, ${data.powder2 ?? null}, ${data.powder3 ?? null},
        ${data.americano1 ?? null}, ${data.americano2 ?? null}, ${data.americano3 ?? null},
        ${data.tea1 ?? null}, ${data.tea2 ?? null},
        ${data.milk ?? null}, ${data.notes ?? null}
      )
      returning *`)[0]);
});
var copyRecipe = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready();
	const customer = data.customer.trim();
	if (!customer) throw new Error("Pick a customer to copy onto");
	const src = (await sql`select * from recipes where id = ${data.sourceId}`)[0];
	if (!src) throw new Error("Recipe not found");
	const model = String(src.equipment_model);
	if (await findRecipeDup(sql, model, customer)) throw new Error(`${customer} already has a ${model} recipe — open it instead`);
	let installId = data.installId ?? null;
	if (installId == null) {
		const ins = await sql`
        select id from installs where lower(customer) = ${customer.toLowerCase()} limit 2`;
		if (ins.length === 1) installId = ins[0].id;
	}
	return mapRecipe((await sql`
      insert into recipes (
        equipment_model, customer, install_id, copied_from, is_template,
        coffee_1, coffee_2, coffee_3,
        powder_1, powder_2, powder_3, americano_1, americano_2, americano_3,
        tea_1, tea_2, milk, notes
      ) values (
        ${model}, ${customer}, ${installId}, ${data.sourceId}, false,
        ${src.coffee_1 ?? null}, ${src.coffee_2 ?? null}, ${src.coffee_3 ?? null},
        ${src.powder_1 ?? null}, ${src.powder_2 ?? null}, ${src.powder_3 ?? null},
        ${src.americano_1 ?? null}, ${src.americano_2 ?? null}, ${src.americano_3 ?? null},
        ${src.tea_1 ?? null}, ${src.tea_2 ?? null},
        ${src.milk ?? null}, ${src.notes ?? null}
      )
      returning *`)[0]);
});
//#endregion
//#region src/components/desk/open-link.tsx
var ROUTES = {
	service: "/service",
	tlc: "/tlc",
	pm: "/pms",
	install: "/installs",
	deal: "/pipeline",
	module: "/modules",
	asset: "/warehouse",
	location: "/locations",
	recipe: "/recipes",
	handoff: "/handoff"
};
function isKind(v) {
	return v in ROUTES;
}
function OpenLink({ entityType, id, className, children }) {
	if (!isKind(entityType)) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
		to: "/",
		className,
		children
	});
	const to = ROUTES[entityType];
	if (!id || entityType === "handoff") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
		to,
		className,
		children
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
		to,
		search: { open: id },
		className,
		children
	});
}
function pathFor(entityType) {
	return isKind(entityType) ? ROUTES[entityType] : "/";
}
//#endregion
//#region src/components/desk/search.tsx
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
//#endregion
//#region src/lib/ops/notify.ts
async function ensureTable(sql) {
	await sql.query(`
    create table if not exists desk_notifications (
      id            serial primary key,
      user_id       text not null,
      from_user_id  text,
      from_name     text,
      body          text not null,
      entity_type   text,
      entity_id     int,
      read          boolean not null default false,
      created_at    timestamptz not null default now()
    )`);
	await sql.query("create index if not exists desk_notifications_inbox_idx on desk_notifications (user_id, read, created_at desc)");
}
var listTeammates = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async ({ context }) => {
	const sql = await getSql();
	await ensureTable(sql);
	return (await sql.query(`select user_id, username, email from desk_accounts
       where approved = true and user_id <> $1
       order by lower(username)`, [context.userId])).map((r) => ({
		userId: r.user_id,
		username: r.username,
		email: r.email
	}));
});
var listNotifications = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async ({ context }) => {
	const sql = await getSql();
	await ensureTable(sql);
	return (await sql.query(`select id, from_name, body, entity_type, entity_id, read, created_at
       from desk_notifications
       where user_id = $1
       order by created_at desc
       limit 40`, [context.userId])).map((r) => ({
		id: r.id,
		fromName: r.from_name,
		body: r.body,
		entityType: r.entity_type,
		entityId: r.entity_id,
		read: !!r.read,
		createdAt: String(r.created_at)
	}));
});
var sendPing = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ context, data }) => {
	const body = data.body.trim();
	if (!body) throw new Error("Write a short reminder.");
	if (data.toUserId === context.userId) throw new Error("You can’t ping yourself.");
	const sql = await getSql();
	await ensureTable(sql);
	if (!(await sql.query("select user_id, username from desk_accounts where user_id = $1 and approved = true", [data.toUserId]))[0]) throw new Error("That teammate isn’t on the desk yet.");
	const me = await sql.query(`select a.username, u.name
       from desk_accounts a
       left join "user" u on u.id = a.user_id
       where a.user_id = $1`, [context.userId]);
	const fromName = me[0]?.username || me[0]?.name || "Teammate";
	await sql.query(`insert into desk_notifications (user_id, from_user_id, from_name, body, entity_type, entity_id)
       values ($1, $2, $3, $4, $5, $6)`, [
		data.toUserId,
		context.userId,
		fromName,
		body.slice(0, 400),
		data.entityType ?? null,
		data.entityId ?? null
	]);
	return { ok: true };
});
var markNotificationRead = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ context, data }) => {
	const sql = await getSql();
	await ensureTable(sql);
	if (data.all) await sql.query("update desk_notifications set read = true where user_id = $1 and read = false", [context.userId]);
	else if (data.id != null) await sql.query("update desk_notifications set read = true where id = $1 and user_id = $2", [data.id, context.userId]);
	return { ok: true };
});
//#endregion
//#region src/components/desk/notify-bell.tsx
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
//#endregion
//#region src/components/ui/separator.tsx
function Skeleton({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("animate-pulse rounded-md bg-muted", className),
		...props
	});
}
//#endregion
//#region src/components/desk/shell.tsx
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
//#endregion
//#region src/routes/_app.tsx
var Route$14 = createFileRoute("/_app")({ component: DeskLayout });
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
//#region src/components/ui/input.tsx
function Input({ className, type, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		type,
		suppressHydrationWarning: type === "email" || type === "password",
		className: cn("flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground shadow-none transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50", className),
		...props
	});
}
function Textarea({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
		className: cn("flex min-h-24 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50", className),
		...props
	});
}
function Label({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
		className: cn("text-xs font-medium text-muted-foreground", className),
		...props
	});
}
//#endregion
//#region src/routes/login.tsx
var Route$13 = createFileRoute("/login")({ component: Login });
var PENDING_KEY = "katz-desk-pending";
function readPending() {
	if (typeof window === "undefined") return false;
	try {
		return window.sessionStorage.getItem(PENDING_KEY) === "1";
	} catch {
		return false;
	}
}
function writePending(on) {
	if (typeof window === "undefined") return;
	try {
		if (on) window.sessionStorage.setItem(PENDING_KEY, "1");
		else window.sessionStorage.removeItem(PENDING_KEY);
	} catch {}
}
function Login() {
	const { user, isPending } = useCurrentUserState();
	const navigate = useNavigate();
	const router = useRouter();
	const [mode, setMode] = (0, import_react.useState)("in");
	const [email, setEmail] = (0, import_react.useState)("");
	const [username, setUsername] = (0, import_react.useState)("");
	const [password, setPassword] = (0, import_react.useState)("");
	const [error, setError] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (readPending()) setMode("pending");
	}, []);
	(0, import_react.useEffect)(() => {
		if (isPending || !user || mode === "pending" || mode === "up") return;
		(async () => {
			try {
				if (!(await getMyAccess()).approved) {
					writePending(true);
					setMode("pending");
					return;
				}
				writePending(false);
				navigate({ to: "/" });
			} catch {}
		})();
	}, [
		isPending,
		user,
		navigate,
		mode
	]);
	async function dropSession() {
		try {
			await authClient.signOut();
		} catch {}
	}
	async function onSubmit(e) {
		e.preventDefault();
		setBusy(true);
		setError(null);
		try {
			if (mode === "up") {
				const name = username.trim();
				if (!/^[a-zA-Z0-9._-]{3,32}$/.test(name)) throw new Error("Username must be 3–32 letters, numbers, dots, hyphens, or underscores.");
				if (!(await checkUsername({ data: { username: name } })).available) throw new Error("That username is already taken.");
				const res = await authClient.signUp.email({
					email: email.trim(),
					password,
					name
				});
				if (res.error) throw new Error(res.error.message);
				await authClient.getSession();
				const access = await registerAccount({ data: {
					username: name,
					email: email.trim()
				} });
				await router.invalidate();
				if (!access.approved) {
					writePending(true);
					await dropSession();
					setMode("pending");
					return;
				}
				writePending(false);
				navigate({ to: "/" });
			} else {
				const looked = await lookupSignIn({ data: { username: username.trim() } });
				const res = await authClient.signIn.email({
					email: looked.email,
					password
				});
				if (res.error) throw new Error(res.error.message);
				await authClient.getSession();
				await router.invalidate();
				writePending(false);
				navigate({ to: "/" });
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Sign-in failed";
			if (/waiting for approval/i.test(msg)) {
				writePending(true);
				setMode("pending");
				return;
			}
			setError(msg);
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "min-h-svh bg-ink text-ink-foreground",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto grid min-h-svh max-w-5xl items-center gap-10 px-6 py-12 lg:grid-cols-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs tracking-[0.22em] text-cream/50 uppercase",
					children: "Katz Coffee · Houston"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
					className: "mt-4 font-display text-5xl leading-[1.05] font-medium tracking-tight",
					children: ["Katz ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "italic text-cream/70",
						children: "Desk"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-4 max-w-md text-base leading-relaxed text-cream/70",
					children: "One desk for sales and service. Past due, coming due, recipes, and the handoff between the two teams — without the spreadsheet pile-up."
				})
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "rounded-xl border border-cream/12 bg-cream/6 p-6",
				children: mode === "pending" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-2xl",
						children: "Waiting for approval"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-cream/60",
						children: "Your account was created. A desk admin will review it before you can open Katz Desk. Sign in with your username after you’re approved."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-6 flex flex-col gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							className: "w-full",
							onClick: () => {
								(async () => {
									try {
										await authClient.getSession();
										if ((await getMyAccess()).approved) {
											writePending(false);
											navigate({ to: "/" });
										}
									} catch {}
								})();
							},
							children: "Check again"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							className: "w-full",
							variant: "secondary",
							onClick: () => {
								writePending(false);
								setMode("in");
								setPassword("");
							},
							children: "Back to sign in"
						})]
					})
				] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-2xl",
						children: mode === "up" ? "Create an account" : "Sign in"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-cream/60",
						children: mode === "up" ? "Pick a username and any email. New accounts wait for an admin to approve them." : "Sign in with your username. New accounts need approval before they can open the desk."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						onSubmit,
						className: "mt-5 space-y-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "username",
								className: "text-cream/60",
								children: "Username"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "username",
								required: true,
								autoComplete: "username",
								className: "mt-1 border-cream/15 bg-ink text-cream",
								value: username,
								onChange: (e) => setUsername(e.target.value),
								placeholder: "e.g. amanda.s"
							})] }),
							mode === "up" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "email",
								className: "text-cream/60",
								children: "Email"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "email",
								type: "email",
								required: true,
								autoComplete: "email",
								className: "mt-1 border-cream/15 bg-ink text-cream",
								value: email,
								onChange: (e) => setEmail(e.target.value),
								placeholder: "Any email you use"
							})] }) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "password",
								className: "text-cream/60",
								children: "Password"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "password",
								type: "password",
								required: true,
								minLength: 8,
								autoComplete: mode === "up" ? "new-password" : "current-password",
								className: "mt-1 border-cream/15 bg-ink text-cream",
								value: password,
								onChange: (e) => setPassword(e.target.value)
							})] }),
							error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-destructive",
								children: error
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "submit",
								className: "w-full",
								disabled: busy,
								children: mode === "up" ? "Create account" : "Sign in"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "mt-4 text-sm text-cream/60 underline-offset-2 hover:underline",
						onClick: () => {
							setMode(mode === "in" ? "up" : "in");
							setError(null);
						},
						children: mode === "in" ? "Need an account? Create one" : "Already have an account? Sign in"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "my-5 flex items-center gap-3 text-xs text-cream/40",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-px flex-1 bg-cream/15" }),
							"or",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-px flex-1 bg-cream/15" })
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "space-y-2",
						children: GROK_PROVIDERS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							type: "button",
							variant: "secondary",
							className: "w-full",
							onClick: () => void signIn(p.providerId, {
								callbackURL: "/",
								errorCallbackURL: "/login"
							}).catch((err) => setError(err instanceof Error ? err.message : "Sign-in failed")),
							children: ["Continue with ", p.label]
						}, p.providerId))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-5 text-xs leading-relaxed text-cream/40",
						children: "Google and X still work if you already use them. New username accounts wait for approval."
					})
				] })
			})]
		})
	});
}
//#endregion
//#region src/components/ui/badge.tsx
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
//#endregion
//#region src/components/desk/flag-badge.tsx
function FlagBadge({ flag }) {
	if (!flag) return null;
	const variant = flag.level === "danger" ? "danger" : flag.level === "warn" ? "warn" : "default";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		variant,
		children: flag.label
	});
}
function UrgencyBadge({ urgency }) {
	if (!urgency) return null;
	const s = urgency.toLowerCase();
	if (s === "emergency") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		variant: "danger",
		children: urgency
	});
	if (s === "high") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		variant: "warn",
		children: urgency
	});
	if (s === "low") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		variant: "outline",
		children: urgency
	});
	if (s === "normal") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		variant: "outline",
		children: urgency
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: urgency });
}
function StatusBadge({ status }) {
	if (!status) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		variant: "outline",
		children: "Unset"
	});
	const s = status.toLowerCase();
	if (s.includes("complete") || s === "installed" || s === "ready" || s === "phone resolved") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		variant: "success",
		children: status
	});
	if (s.includes("cancel") || s.includes("fell") || s.includes("overdue") || s.includes("not ready")) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		variant: "danger",
		children: status
	});
	if (s.includes("progress") || s.includes("dispatch") || s.includes("await") || s.includes("follow")) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		variant: "warn",
		children: status
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: status });
}
//#endregion
//#region src/components/desk/desk-charts.tsx
var ink = "#1A1612";
var primary = "#2F5D50";
var warning = "#9A5B12";
var muted = "#6F675E";
var cream = "#E7E0D4";
var card = "#FAF7F1";
var border = "#DDD4C6";
var CHART_PALETTE = [
	primary,
	ink,
	warning,
	muted,
	cream
];
function useMotion() {
	if (typeof window === "undefined") return false;
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function usd(n) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0
	}).format(n);
}
function Tip({ active, payload, label, money }) {
	if (!active || !payload?.length) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-soft",
		children: [label ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mb-1 font-medium",
			children: label
		}) : null, payload.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "text-muted-foreground",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-foreground",
				children: p.name
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "ml-2 tabular",
				children: money ? usd(Number(p.value) || 0) : p.value
			})]
		}, p.name))]
	});
}
function ChartKey({ items }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "mb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground",
		children: items.map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
			className: "flex items-center gap-1.5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "size-2 shrink-0 rounded-sm",
				style: { background: i.color }
			}), i.label]
		}, i.label))
	});
}
function GroupedBars({ data, aKey, bKey, aLabel, bLabel, xKey }) {
	const reduce = useMotion();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartKey, { items: [{
		label: aLabel,
		color: primary
	}, {
		label: bLabel,
		color: ink
	}] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "h-56 w-full",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
			width: "100%",
			height: "100%",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(BarChart, {
				data,
				margin: {
					top: 8,
					right: 8,
					left: -12,
					bottom: 0
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
						stroke: border,
						vertical: false
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
						dataKey: xKey,
						tick: {
							fill: muted,
							fontSize: 11
						},
						axisLine: false,
						tickLine: false,
						interval: 0
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
						allowDecimals: false,
						tick: {
							fill: muted,
							fontSize: 11
						},
						axisLine: false,
						tickLine: false,
						width: 32
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, {
						content: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tip, {}),
						cursor: { fill: cream }
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
						dataKey: aKey,
						name: aLabel,
						fill: primary,
						radius: [
							4,
							4,
							0,
							0
						],
						maxBarSize: 18,
						isAnimationActive: !reduce
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
						dataKey: bKey,
						name: bLabel,
						fill: ink,
						radius: [
							4,
							4,
							0,
							0
						],
						maxBarSize: 18,
						isAnimationActive: !reduce
					})
				]
			})
		})
	})] });
}
function SimpleBars({ data, xKey, yKey, yLabel, color = primary, horizontal }) {
	const reduce = useMotion();
	if (horizontal) {
		const max = Math.max(...data.map((d) => Number(d[yKey]) || 0), 1);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [yLabel ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mb-2 text-right text-xs tracking-wide text-muted-foreground uppercase",
			children: yLabel
		}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "space-y-2.5",
			children: data.map((row, i) => {
				const name = String(row[xKey] ?? "—");
				const n = Number(row[yKey]) || 0;
				const pct = Math.round(n / max * 100);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_2.5rem] items-center gap-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "truncate text-sm",
							title: name,
							children: name
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-secondary",
							"aria-hidden": true,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block h-full rounded-full",
								style: {
									width: `${n === 0 ? 0 : Math.max(pct, 4)}%`,
									background: color
								}
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "tabular text-right text-sm font-medium",
							children: n
						})
					]
				}, `${name}-${i}`);
			})
		})] });
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "h-52 w-full",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
			width: "100%",
			height: "100%",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(BarChart, {
				data,
				margin: {
					top: 8,
					right: 12,
					left: 4,
					bottom: 4
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
						stroke: border,
						vertical: false
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
						dataKey: xKey,
						tick: {
							fill: muted,
							fontSize: 11
						},
						axisLine: false,
						tickLine: false,
						interval: 0
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
						allowDecimals: false,
						tick: {
							fill: muted,
							fontSize: 11
						},
						axisLine: false,
						tickLine: false,
						width: 32
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, {
						content: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tip, {}),
						cursor: { fill: cream }
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
						dataKey: yKey,
						name: yLabel ?? yKey,
						fill: color,
						radius: [
							4,
							4,
							0,
							0
						],
						maxBarSize: 22,
						isAnimationActive: !reduce
					})
				]
			})
		})
	});
}
function StackedMoneyBars({ data, xKey, openKey, doneKey }) {
	const reduce = useMotion();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartKey, { items: [{
		label: "Open $",
		color: primary
	}, {
		label: "Completed $",
		color: ink
	}] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "h-56 w-full",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
			width: "100%",
			height: "100%",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(BarChart, {
				data,
				margin: {
					top: 8,
					right: 8,
					left: 4,
					bottom: 0
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
						stroke: border,
						vertical: false
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
						dataKey: xKey,
						tick: {
							fill: muted,
							fontSize: 11
						},
						axisLine: false,
						tickLine: false
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
						tick: {
							fill: muted,
							fontSize: 11
						},
						axisLine: false,
						tickLine: false,
						width: 56
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, {
						content: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tip, { money: true }),
						cursor: { fill: cream }
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
						dataKey: openKey,
						name: "Open $",
						stackId: "a",
						fill: primary,
						radius: [
							0,
							0,
							0,
							0
						],
						maxBarSize: 28,
						isAnimationActive: !reduce
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
						dataKey: doneKey,
						name: "Completed $",
						stackId: "a",
						fill: ink,
						radius: [
							4,
							4,
							0,
							0
						],
						maxBarSize: 28,
						isAnimationActive: !reduce
					})
				]
			})
		})
	})] });
}
function StatusDonut({ data, unit = "total" }) {
	const reduce = useMotion();
	const id = (0, import_react.useId)();
	const total = data.reduce((n, d) => n + d.count, 0);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-3 sm:grid-cols-[9rem_1fr] sm:items-center",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative mx-auto h-44 w-44",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
				width: "100%",
				height: "100%",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PieChart, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pie, {
					data,
					dataKey: "count",
					nameKey: "name",
					innerRadius: 48,
					outerRadius: 70,
					paddingAngle: 2,
					isAnimationActive: !reduce,
					children: data.map((entry, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
						fill: CHART_PALETTE[i % CHART_PALETTE.length],
						stroke: card
					}, `${id}-${entry.name}`))
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, { content: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tip, {}) })] })
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "pointer-events-none absolute inset-0 flex flex-col items-center justify-center",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display text-2xl tabular leading-none",
					children: total
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground",
					children: unit
				})]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "space-y-1.5",
			children: data.map((row, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex items-center gap-2 text-sm",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "size-2 shrink-0 rounded-sm",
						style: { background: CHART_PALETTE[i % CHART_PALETTE.length] }
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "min-w-0 flex-1 truncate",
						children: row.name
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "tabular text-xs text-muted-foreground",
						children: row.count
					})
				]
			}, row.name))
		})]
	});
}
function BreakdownList({ items, empty = "None yet." }) {
	if (!items.length) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "mt-2 text-xs text-muted-foreground",
		children: empty
	});
	const max = Math.max(...items.map((i) => i.count), 1);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "mt-3 space-y-1.5",
		children: items.slice(0, 8).map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
			className: "grid grid-cols-[minmax(0,1fr)_2.5rem_4.5rem] items-center gap-2 text-sm",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "min-w-0 truncate",
					children: item.name
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "tabular text-right text-xs text-muted-foreground",
					children: item.count
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "h-1.5 overflow-hidden rounded-full bg-secondary",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block h-full rounded-full bg-primary",
						style: { width: `${Math.round(item.count / max * 100)}%` }
					})
				})
			]
		}, item.name))
	});
}
function StatCard({ label, value, hint, tone, breakdown }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl border border-border bg-card px-4 py-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: cn("mt-1 font-display text-3xl tabular leading-none", tone === "danger" && "text-destructive", tone === "warn" && "text-warning"),
				children: value
			}),
			hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-muted-foreground",
				children: hint
			}) : null,
			breakdown?.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BreakdownList, { items: breakdown }) : null
		]
	});
}
function ChartCard({ title, lede, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl border border-border bg-card p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-xl",
				children: title
			}),
			lede ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-0.5 text-xs text-muted-foreground",
				children: lede
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3",
				children
			})
		]
	});
}
function MiniStat({ label, value, hint }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg bg-muted/70 px-3 py-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[11px] tracking-wide text-muted-foreground uppercase",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-display text-xl tabular leading-tight",
				children: value
			}),
			hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[11px] text-muted-foreground",
				children: hint
			}) : null
		]
	});
}
//#endregion
//#region src/components/ui/select-field.tsx
function SelectField({ className, children, allowEmpty, emptyLabel = "—", ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
		className: cn("h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className),
		...props,
		children: [allowEmpty ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
			value: "",
			children: emptyLabel
		}) : null, children]
	});
}
//#endregion
//#region src/components/desk/sort-bar.tsx
function SortSelect({ value, onChange, options, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: cn("flex min-w-0 items-center gap-2", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "shrink-0 text-xs font-medium tracking-wide text-muted-foreground uppercase",
			children: "Sort"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
			"aria-label": "Sort this list",
			value,
			onChange: (e) => onChange(e.target.value),
			className: "h-9 min-w-0 flex-1 sm:w-56 sm:flex-none",
			children: options.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
				value: o.id,
				children: o.label
			}, o.id))
		})]
	});
}
function useDeskSort(pageKey, fallback) {
	const storageKey = `katz-sort-${pageKey}`;
	const [sort, setSort] = (0, import_react.useState)(fallback);
	const [hydrated, setHydrated] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		try {
			const saved = window.localStorage.getItem(storageKey);
			if (saved) setSort(saved);
		} catch {}
		setHydrated(true);
	}, [storageKey]);
	(0, import_react.useEffect)(() => {
		if (!hydrated) return;
		try {
			window.localStorage.setItem(storageKey, sort);
		} catch {}
	}, [
		storageKey,
		sort,
		hydrated
	]);
	return [sort, setSort];
}
//#endregion
//#region src/lib/ops/sort.ts
var SORT_DATE = [{
	id: "date-desc",
	label: "Date · Latest → Oldest"
}, {
	id: "date-asc",
	label: "Date · Oldest → Latest"
}];
var SORT_ALPHA = [{
	id: "alpha-asc",
	label: "Name · A → Z"
}, {
	id: "alpha-desc",
	label: "Name · Z → A"
}];
var SORT_EQUIP = [{
	id: "equip-desc",
	label: "Equipment · Most → Least"
}, {
	id: "equip-asc",
	label: "Equipment · Least → Most"
}];
var SORT_VALUE = [{
	id: "value-desc",
	label: "Deal value · Highest → Lowest"
}, {
	id: "value-asc",
	label: "Deal value · Lowest → Highest"
}];
var SORT_STATUS = [{
	id: "status",
	label: "Status"
}];
var SORT_FLAG = [{
	id: "flag",
	label: "Urgency · Flags first"
}];
var SORT_TECH = [{
	id: "tech",
	label: "Technician"
}];
var SORT_LIST = [
	...SORT_DATE,
	...SORT_ALPHA,
	...SORT_EQUIP,
	...SORT_STATUS,
	...SORT_FLAG,
	...SORT_TECH
];
var SORT_DEALS = [
	...SORT_DATE,
	...SORT_ALPHA,
	...SORT_EQUIP,
	...SORT_VALUE,
	...SORT_STATUS
];
function equipmentCount(raw, extra = 0) {
	if (extra > 0) return extra;
	if (!raw?.trim()) return 0;
	const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
	if (lines.length > 1) return lines.length;
	const bits = lines[0].split(/\s*(?:,|&|\+|\/)\s*/).map((s) => s.trim()).filter(Boolean);
	return Math.max(bits.length, 1);
}
function str(v) {
	return (v ?? "").trim().toLowerCase();
}
function compareEquip(a, b, desc) {
	if (typeof a === "string" || typeof b === "string") {
		const n = str(typeof a === "string" ? a : "").localeCompare(str(typeof b === "string" ? b : ""));
		return desc ? -n : n;
	}
	const na = typeof a === "number" ? a : 0;
	const nb = typeof b === "number" ? b : 0;
	return desc ? nb - na : na - nb;
}
function compareDesk(a, b, sort, get) {
	const dateA = str(get.date?.(a));
	const dateB = str(get.date?.(b));
	const nameA = str(get.name?.(a));
	const nameB = str(get.name?.(b));
	const eqRawA = get.equipment?.(a);
	const eqRawB = get.equipment?.(b);
	const nameASafe = nameA;
	const nameBSafe = nameB;
	const valA = get.value?.(a) ?? 0;
	const valB = get.value?.(b) ?? 0;
	const stA = str(get.status?.(a));
	const stB = str(get.status?.(b));
	const flA = get.flagRank?.(a) ?? 99;
	const flB = get.flagRank?.(b) ?? 99;
	const techA = str(get.tech?.(a));
	const techB = str(get.tech?.(b));
	let n = 0;
	switch (sort) {
		case "date-desc":
			n = (dateB || "0000").localeCompare(dateA || "0000") || nameASafe.localeCompare(nameBSafe);
			break;
		case "date-asc":
			n = (dateA || "9999").localeCompare(dateB || "9999") || nameASafe.localeCompare(nameBSafe);
			break;
		case "alpha-asc":
			n = nameASafe.localeCompare(nameBSafe);
			break;
		case "alpha-desc":
			n = nameBSafe.localeCompare(nameASafe);
			break;
		case "equip-desc":
			n = compareEquip(eqRawA, eqRawB, true) || nameASafe.localeCompare(nameBSafe);
			break;
		case "equip-asc":
			n = compareEquip(eqRawA, eqRawB, false) || nameASafe.localeCompare(nameBSafe);
			break;
		case "value-desc":
			n = valB - valA || nameASafe.localeCompare(nameBSafe);
			break;
		case "value-asc":
			n = valA - valB || nameASafe.localeCompare(nameBSafe);
			break;
		case "status":
			n = stA.localeCompare(stB) || nameASafe.localeCompare(nameBSafe);
			break;
		case "flag":
			n = flA - flB || dateA.localeCompare(dateB) || nameA.localeCompare(nameB);
			break;
		case "tech":
			n = techA.localeCompare(techB) || nameA.localeCompare(nameB);
			break;
		default: n = nameA.localeCompare(nameB);
	}
	return n;
}
function sortDesk(rows, sort, get) {
	return [...rows].sort((a, b) => compareDesk(a, b, sort, get));
}
function tally(rows, key) {
	const map = /* @__PURE__ */ new Map();
	for (const row of rows) {
		const name = (key(row) ?? "").trim() || "Unspecified";
		map.set(name, (map.get(name) ?? 0) + 1);
	}
	return [...map.entries()].map(([name, count]) => ({
		name,
		count
	})).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
//#endregion
//#region src/components/desk/ping-button.tsx
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
//#region src/routes/_app/index.tsx
var Route$12 = createFileRoute("/_app/")({ component: ClockHome });
function ClockHome() {
	const dash = useQuery({
		queryKey: ["dashboard"],
		queryFn: () => getDashboard()
	});
	const [dueSort, setDueSort] = useDeskSort("clock-due", "date-asc");
	const d = dash.data;
	if (dash.isError) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl border border-border bg-card p-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-2xl",
				children: "Couldn’t load the clock"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted-foreground",
				children: dash.error instanceof Error ? dash.error.message : "Try again in a moment."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "mt-4 text-sm font-medium text-primary underline-offset-4 hover:underline",
				onClick: () => void dash.refetch(),
				children: "Try again"
			})
		]
	});
	if (dash.isLoading || !d) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-10 w-64" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-28 w-full" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-64 w-full" })
		]
	});
	const statusChart = d.statusBreakdown.filter((s) => s.service + s.tlc > 0).map((s) => ({
		status: s.status.replace("Follow-up Needed", "Follow-up"),
		service: s.service,
		tlc: s.tlc
	}));
	const techChart = d.techLoad.filter((t) => t.active + t.completed > 0).map((t) => ({
		tech: t.tech,
		active: t.active
	}));
	const dueChart = groupDueWindows(d.comingDueBuckets ?? []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs tracking-[0.18em] text-muted-foreground uppercase",
						children: "Operations clock"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
						className: "font-display text-4xl font-medium tracking-tight",
						children: ["Today, ", formatLongDate(d.today)]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-sm text-muted-foreground",
						children: [
							"Week ",
							d.weekLabel,
							" · Next ",
							d.nextWeekLabel
						]
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/handoff",
					className: "text-sm font-medium text-primary underline-offset-4 hover:underline",
					children: "Open handoff feed"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid grid-cols-2 gap-2 sm:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniStat, {
						label: "Active calls",
						value: d.kpis.activeCalls,
						hint: "Service + TLC still open"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniStat, {
						label: "Coming due",
						value: d.kpis.comingDue,
						hint: "Next 14 days"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniStat, {
						label: "Install queue",
						value: d.kpis.installQueue,
						hint: `${d.kpis.installAtRisk} at risk`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniStat, {
						label: "PMs active",
						value: d.kpis.pmsActive
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid grid-cols-2 gap-3 md:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
						label: "Service flags",
						value: d.kpis.svcFlags,
						tone: d.kpis.svcFlags ? "danger" : "ok",
						hint: "48-hour clock"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
						label: "TLC flags",
						value: d.kpis.tlcFlags,
						tone: d.kpis.tlcFlags ? "danger" : "ok",
						hint: "2-week clock"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
						label: "PM flags",
						value: d.kpis.pmFlags,
						tone: d.kpis.pmFlags ? "warn" : "ok",
						hint: `${d.kpis.pmsActive} active PMs`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
						label: "Open asks",
						value: d.kpis.openAsks,
						tone: d.kpis.openAsks ? "warn" : "ok",
						hint: "Handoff waiting on an answer"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid gap-3 md:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
						label: "Ready in the barn",
						value: d.kpis.barnReady,
						hint: `${d.kpis.barnOpen} open slots`,
						breakdown: d.barnReadyByModel
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
						label: "Ready to install",
						value: d.kpis.installReady,
						hint: `${d.kpis.installQueue} in the queue · ${d.kpis.installAtRisk} at risk`,
						breakdown: d.installReadyByEquip
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
						label: "Ready modules",
						value: d.kpis.modulesReady,
						hint: "Shop modules marked Ready",
						breakdown: d.modulesReadyByType
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid gap-4 lg:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartCard, {
					title: "Call mix",
					lede: "Service vs TLC + Factor by status — closed work stays visible so volume is honest.",
					children: statusChart.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GroupedBars, {
						data: statusChart,
						xKey: "status",
						aKey: "service",
						bKey: "tlc",
						aLabel: "Service",
						bLabel: "TLC"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted-foreground",
						children: "No calls loaded."
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartCard, {
					title: "Coming due — 14 days",
					lede: "Dated service, TLC, PMs, and installs grouped so the week is readable.",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleBars, {
						data: dueChart,
						xKey: "window",
						yKey: "count",
						yLabel: "Jobs"
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid gap-4 lg:grid-cols-[1.1fr_1fr]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartCard, {
					title: "On the truck",
					lede: "Active calls per technician.",
					children: techChart.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleBars, {
						data: techChart,
						xKey: "tech",
						yKey: "active",
						horizontal: true
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted-foreground",
						children: "No techs on active calls."
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-xl border border-border bg-card p-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-baseline justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-xl",
							children: "Pipeline snapshot"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/pipeline",
							className: "text-xs text-muted-foreground hover:text-foreground",
							children: "Open pipeline"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
						className: "mt-4 grid grid-cols-2 gap-3 text-sm",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Snap, {
								label: "Open deals",
								value: String(d.pipelineSnap?.openCount ?? 0)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Snap, {
								label: "Open $",
								value: moneyish(d.pipelineSnap?.openValue)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Snap, {
								label: "Good to order",
								value: String(d.pipelineSnap?.goodToOrder ?? 0)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Snap, {
								label: "Ordered",
								value: String(d.pipelineSnap?.ordered ?? 0)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Snap, {
								label: "Completed",
								value: String(d.pipelineSnap?.completeCount ?? 0)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Snap, {
								label: "Completed $",
								value: moneyish(d.pipelineSnap?.completeValue)
							})
						]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid gap-4 lg:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlagList, {
						title: "Service — 48-hour clock",
						href: "/service",
						rows: d.flagged.service,
						empty: "No service flags. The 48-hour clock is clear."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlagList, {
						title: "TLC + Factor — 2-week clock",
						href: "/tlc",
						rows: d.flagged.tlc,
						empty: "No TLC flags."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlagList, {
						title: "PM tracker",
						href: "/pms",
						rows: d.flagged.pm,
						empty: "No PM flags."
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid gap-4 lg:grid-cols-[1.4fr_1fr]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DueList, {
					rows: d.comingDue,
					sort: dueSort,
					onSort: setDueSort
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-xl border border-border bg-card p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-baseline justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "font-display text-xl",
								children: "Latest handoff"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/handoff",
								className: "text-xs text-muted-foreground hover:text-foreground",
								children: "All notes"
							})]
						}),
						d.recentHandoff.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 text-sm text-muted-foreground",
							children: "No notes yet."
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-3 space-y-3",
							children: d.recentHandoff.slice(0, 5).map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-medium",
									children: c.authorName
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-muted-foreground",
									children: [" on ", c.customer ?? c.entityType]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "line-clamp-2 text-sm text-muted-foreground",
								children: c.body
							})] }, c.id))
						}),
						d.pendingHandoffs.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-3 text-xs text-warning",
							children: [
								d.pendingHandoffs.length,
								" completed deal",
								d.pendingHandoffs.length === 1 ? "" : "s",
								" waiting on an install row."
							]
						}) : null
					]
				})]
			})
		]
	});
}
function groupDueWindows(buckets) {
	let today = 0;
	let soon = 0;
	let week = 0;
	let next = 0;
	for (const b of buckets) if (b.day === 0) today += b.count;
	else if (b.day <= 3) soon += b.count;
	else if (b.day <= 7) week += b.count;
	else next += b.count;
	return [
		{
			window: "Today",
			count: today
		},
		{
			window: "1–3 days",
			count: soon
		},
		{
			window: "This week",
			count: week
		},
		{
			window: "Next week",
			count: next
		}
	];
}
function moneyish(n) {
	if (n == null) return "—";
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0
	}).format(n);
}
function Snap({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg bg-muted/60 px-3 py-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
			className: "text-xs text-muted-foreground",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
			className: "font-display text-lg tabular",
			children: value
		})]
	});
}
function FlagList({ title, href, rows, empty }) {
	const [sort, setSort] = useDeskSort(`clock-flag-${href}`, "flag");
	const shown = (0, import_react.useMemo)(() => sortDesk(rows, sort, {
		date: (r) => r.scheduled ?? r.received,
		name: (r) => r.customer,
		status: (r) => r.status,
		flagRank: (r) => r.flag?.rank ?? 99,
		tech: (r) => r.technician,
		equipment: (r) => r.detail ? 1 : 0
	}), [rows, sort]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl border border-border bg-card p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-xl",
					children: title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: href,
					className: "text-xs text-muted-foreground hover:text-foreground",
					children: "Open"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
					value: sort,
					onChange: setSort,
					options: [
						...SORT_FLAG,
						...SORT_DATE,
						...SORT_ALPHA,
						...SORT_STATUS
					],
					className: "sm:w-full"
				})
			}),
			shown.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-sm text-muted-foreground",
				children: empty
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 divide-y divide-border",
				children: shown.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "py-2.5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OpenLink, {
								entityType: r.entityType,
								id: r.id,
								className: "min-w-0 font-medium hover:underline",
								children: r.customer
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PingButton, {
								size: "xs",
								entityType: r.entityType,
								entityId: r.id,
								contextLabel: `${r.customer} · ${title}`
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-1 flex flex-wrap items-center gap-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlagBadge, { flag: r.flag }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: r.status })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-xs text-muted-foreground",
							children: [
								"Rec ",
								formatShortDate(r.received),
								r.scheduled ? ` · Sch ${formatShortDate(r.scheduled)}` : "",
								r.technician ? ` · ${r.technician}` : "",
								r.detail ? ` · ${r.detail}` : ""
							]
						})
					]
				}, `${r.entityType}-${r.id}`))
			})
		]
	});
}
function DueList({ rows, sort, onSort }) {
	const shown = (0, import_react.useMemo)(() => sortDesk(rows, sort, {
		date: (r) => r.scheduled,
		name: (r) => r.customer,
		status: (r) => r.status,
		tech: (r) => r.technician,
		equipment: (r) => r.equipment ? 1 : 0
	}), [rows, sort]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl border border-border bg-card p-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-xl",
				children: "Coming due — 14 days"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted-foreground",
				children: "Every dated job in the window, sorted how you need it."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
				value: sort,
				onChange: onSort,
				options: [
					...SORT_DATE,
					...SORT_ALPHA,
					...SORT_STATUS
				]
			})]
		}), shown.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-4 text-sm text-muted-foreground",
			children: "Nothing scheduled in the next two weeks."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-3 divide-y divide-border",
			children: shown.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex items-start justify-between gap-3 py-2.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OpenLink, {
						entityType: row.entityType,
						id: row.id,
						className: "font-medium hover:underline",
						children: row.customer
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-xs text-muted-foreground",
						children: [
							row.source,
							" · ",
							row.equipment ?? "—",
							" · ",
							row.technician ?? "unassigned"
						]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-right",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "tabular text-sm font-medium",
						children: row.daysOut === 0 ? "Today" : `${row.daysOut}d`
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted-foreground",
						children: formatShortDate(row.scheduled)
					})]
				})]
			}, `${row.entityType}-${row.id}`))
		})]
	});
}
//#endregion
//#region src/routes/_app/access.tsx
var Route$11 = createFileRoute("/_app/access")({ component: Page$10 });
function Page$10() {
	const qc = useQueryClient();
	const me = useQuery({
		queryKey: ["access", "me"],
		queryFn: () => getMyAccess()
	});
	const list = useQuery({
		queryKey: ["access", "list"],
		queryFn: () => listDeskAccounts(),
		enabled: !!me.data?.isAdmin
	});
	const setApproved = useMutation({
		mutationFn: (d) => setAccountApproved({ data: d }),
		onSuccess: (row) => {
			toast.success(row.approved ? `Approved ${row.username}` : `Revoked ${row.username}`);
			qc.invalidateQueries({ queryKey: ["access"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Failed")
	});
	const [sort, setSort] = useDeskSort("access", "date-desc");
	const pending = (list.data ?? []).filter((a) => !a.approved);
	const active = (0, import_react.useMemo)(() => sortDesk(list.data ?? [], sort, {
		date: (a) => a.createdAt,
		name: (a) => a.username
	}).filter((a) => a.approved), [list.data, sort]);
	if (me.data && !me.data.isAdmin) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
		className: "font-display text-3xl font-medium tracking-tight",
		children: "Access"
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "mt-2 text-sm text-muted-foreground",
		children: "Only an admin can review new accounts."
	})] });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-medium tracking-tight",
				children: "Access"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-xl text-sm text-muted-foreground",
				children: "New username accounts wait here until you approve them. They cannot open the desk until then."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
					value: sort,
					onChange: setSort,
					options: [...SORT_DATE, ...SORT_ALPHA]
				})
			})
		] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-6",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: [
					"Waiting (",
					pending.length,
					")"
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
				className: "mt-2 overflow-hidden rounded-xl border border-border bg-card",
				children: [pending.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-medium",
							children: a.username
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "truncate text-sm text-muted-foreground",
							children: a.email ?? "No email"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						disabled: setApproved.isPending,
						onClick: () => setApproved.mutate({
							userId: a.userId,
							approved: true
						}),
						children: "Approve"
					})]
				}, a.userId)), pending.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "px-4 py-6 text-sm text-muted-foreground",
					children: "No one is waiting."
				}) : null]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-8",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: [
					"Approved (",
					active.length,
					")"
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-2 overflow-hidden rounded-xl border border-border bg-card",
				children: active.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "font-medium",
							children: [a.username, a.isAdmin ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ml-2 text-xs text-muted-foreground",
								children: "admin"
							}) : null]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "truncate text-sm text-muted-foreground",
							children: a.email ?? "No email"
						})]
					}), !a.isAdmin ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "outline",
						disabled: setApproved.isPending,
						onClick: () => setApproved.mutate({
							userId: a.userId,
							approved: false
						}),
						children: "Revoke"
					}) : null]
				}, a.userId))
			})]
		})
	] });
}
//#endregion
//#region src/routes/_app/handoff.tsx
var Route$10 = createFileRoute("/_app/handoff")({ component: Page$9 });
function Page$9() {
	const qc = useQueryClient();
	const user = useCurrentUser();
	const access = useQuery({
		queryKey: ["access", "me"],
		queryFn: () => getMyAccess()
	});
	const feed = useQuery({
		queryKey: ["handoff"],
		queryFn: () => getHandoff()
	});
	const [scope, setScope] = (0, import_react.useState)("mine");
	(0, import_react.useEffect)(() => {
		try {
			if (window.localStorage.getItem("katz-handoff-view") === "all") setScope("all");
		} catch {}
	}, []);
	const [sort, setSort] = useDeskSort("handoff", "date-desc");
	const resolve = useMutation({
		mutationFn: (id) => resolveComment({ data: {
			id,
			resolved: true
		} }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["handoff"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		}
	});
	const promote = useMutation({
		mutationFn: (dealId) => handoffDeal({ data: { dealId } }),
		onSuccess: () => {
			toast.success("Install row created");
			qc.invalidateQueries({ queryKey: ["handoff"] });
			qc.invalidateQueries({ queryKey: ["installs"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		}
	});
	const d = feed.data;
	const filtered = (0, import_react.useMemo)(() => filterHandoff(d, user, access.data?.username ?? null, scope), [
		d,
		user,
		access.data?.username,
		scope
	]);
	const sortedAsks = (0, import_react.useMemo)(() => sortDesk(filtered.asks, sort, {
		date: (c) => c.createdAt,
		name: (c) => c.customer ?? c.authorName
	}), [filtered.asks, sort]);
	const sortedRecent = (0, import_react.useMemo)(() => sortDesk(filtered.recent, sort, {
		date: (c) => c.createdAt,
		name: (c) => c.customer ?? c.authorName
	}), [filtered.recent, sort]);
	const mineCount = (0, import_react.useMemo)(() => {
		const mine = filterHandoff(d, user, access.data?.username ?? null, "mine");
		const askIds = new Set(mine.asks.map((c) => c.id));
		return mine.pendingHandoffs.length + mine.asks.length + mine.recent.filter((c) => !askIds.has(c.id)).length;
	}, [
		d,
		user,
		access.data?.username
	]);
	function setView(next) {
		setScope(next);
		try {
			window.localStorage.setItem("katz-handoff-view", next);
		} catch {}
	}
	const emptyMine = scope === "mine" && !!d && !filtered.pendingHandoffs.length && !filtered.asks.length && !filtered.recent.length;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-medium tracking-tight",
				children: "Handoff"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-2xl text-sm text-muted-foreground",
				children: "The conversation between sales and service. Mine shows asks, notes, and completed deals that belong to you."
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-3 border-y border-border py-3 sm:flex-row sm:items-center sm:justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex h-10 w-fit items-center rounded-full bg-secondary p-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setView("mine"),
						className: `h-8 rounded-full px-3.5 text-sm font-medium ${scope === "mine" ? "bg-ink text-ink-foreground" : "text-foreground hover:bg-background/70"}`,
						children: [
							"Mine (",
							mineCount,
							")"
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setView("all"),
						className: `h-8 rounded-full px-3.5 text-sm font-medium ${scope === "all" ? "bg-ink text-ink-foreground" : "text-foreground hover:bg-background/70"}`,
						children: "All"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
						value: sort,
						onChange: setSort,
						options: [...SORT_DATE, ...SORT_ALPHA]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PingButton, {
						contextLabel: "Check the handoff board",
						entityType: "handoff"
					})]
				})]
			}),
			feed.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: "Loading the desk…"
			}) : emptyMine ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-xl border border-border bg-card p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-medium",
					children: "Nothing of yours is waiting."
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted-foreground",
					children: "Mine shows notes you wrote, jobs assigned to you, and deals you produced. Switch to All to see the rest of the desk."
				})]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [filtered.pendingHandoffs.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-xl border border-border bg-card p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-xl",
					children: "Completed deals not yet on the install board"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-3 divide-y divide-border",
					children: filtered.pendingHandoffs.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex flex-wrap items-center justify-between gap-3 py-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-medium",
							children: p.customer
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-xs text-muted-foreground",
							children: [
								p.producer ?? "—",
								" · ",
								p.equipment
							]
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PingButton, {
								size: "xs",
								entityType: "deal",
								entityId: p.dealId,
								contextLabel: `${p.customer} deal is complete but not on the install board`
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								onClick: () => promote.mutate(p.dealId),
								disabled: promote.isPending,
								children: "Send to installs"
							})]
						})]
					}, p.dealId))
				})]
			}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid gap-4 lg:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-xl border border-border bg-card p-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-xl",
						children: "Open asks"
					}), !filtered.asks.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-sm text-muted-foreground",
						children: scope === "mine" ? "No open asks on your work." : "No unanswered asks. Nice."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-3 space-y-4",
						children: sortedAsks.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "rounded-lg border border-border bg-background p-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
										variant: "warn",
										children: ["Ask ", c.askTeam]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OpenLink, {
										entityType: c.entityType,
										id: c.entityId,
										className: "text-sm font-medium underline-offset-2 hover:underline",
										children: c.customer ?? c.entityType
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-sm leading-relaxed",
									children: c.body
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-2 flex flex-wrap items-center justify-between gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-muted-foreground",
										children: c.authorName
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PingButton, {
											size: "xs",
											entityType: c.entityType,
											entityId: c.entityId,
											contextLabel: `${c.customer ?? c.entityType} · ${c.body.slice(0, 80)}`
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: "text-xs text-muted-foreground underline-offset-2 hover:underline",
											onClick: () => resolve.mutate(c.id),
											children: "Mark answered"
										})]
									})]
								})
							]
						}, c.id))
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-xl border border-border bg-card p-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-xl",
						children: "Recent notes"
					}), !filtered.recent.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-sm text-muted-foreground",
						children: scope === "mine" ? "No recent notes on your work." : "No notes yet."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-3 space-y-4",
						children: sortedRecent.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-medium",
									children: c.authorName
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-muted-foreground",
									children: [" · ", c.customer ?? c.entityType]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PingButton, {
								size: "xs",
								entityType: c.entityType,
								entityId: c.entityId,
								contextLabel: `${c.customer ?? c.entityType} · ${c.body.slice(0, 80)}`
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-sm leading-relaxed text-muted-foreground",
							children: c.body
						})] }, c.id))
					})]
				})]
			})] })
		]
	});
}
function filterHandoff(d, user, username, scope) {
	const empty = {
		asks: [],
		recent: [],
		pendingHandoffs: []
	};
	if (!d) return empty;
	if (scope === "all") return d;
	const asUser = {
		displayName: [user?.displayName, username].filter(Boolean).join(" ") || user?.displayName || null,
		primaryEmail: user?.primaryEmail ?? null
	};
	const mine = (c) => !!user?.id && c.authorId === user.id || namesMatchUser(asUser, c.authorName, c.technician, c.producer, c.accountRep);
	return {
		pendingHandoffs: d.pendingHandoffs.filter((p) => namesMatchUser(asUser, p.producer)),
		asks: d.asks.filter((c) => mine(c)),
		recent: d.recent.filter((c) => mine(c))
	};
}
//#endregion
//#region src/components/ui/dialog.tsx
var Dialog = Dialog$1;
function DialogContent({ className, children, onPointerDownOutside, onFocusOutside, onInteractOutside, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay, { className: "fixed inset-0 z-50 bg-ink/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent$1, {
		className: cn("fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-5 shadow-soft focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95", className),
		onPointerDownOutside: (e) => {
			preventIfCombo(e);
			onPointerDownOutside?.(e);
		},
		onFocusOutside: (e) => {
			preventIfCombo(e);
			onFocusOutside?.(e);
		},
		onInteractOutside: (e) => {
			preventIfCombo(e);
			onInteractOutside?.(e);
		},
		...props,
		children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogClose, {
			className: "absolute top-3 right-3 rounded-sm p-1 text-muted-foreground hover:bg-muted",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "sr-only",
				children: "Close"
			})]
		})]
	})] });
}
function DialogTitle({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle$1, {
		className: cn("font-display text-xl font-medium tracking-tight", className),
		...props
	});
}
function DialogDescription({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription$1, {
		className: cn("mt-1 text-sm text-muted-foreground", className),
		...props
	});
}
//#endregion
//#region src/components/desk/thread.tsx
function Thread({ entityType, entityId }) {
	const user = useCurrentUser();
	const qc = useQueryClient();
	const [body, setBody] = (0, import_react.useState)("");
	const [ask, setAsk] = (0, import_react.useState)("");
	const comments = useQuery({
		queryKey: [
			"comments",
			entityType,
			entityId
		],
		queryFn: () => listComments({ data: {
			entityType,
			entityId
		} })
	});
	const add = useMutation({
		mutationFn: () => addComment({ data: {
			entityType,
			entityId,
			body,
			askTeam: ask || null,
			authorName: user?.displayName ?? user?.primaryEmail ?? "Teammate"
		} }),
		onSuccess: () => {
			setBody("");
			setAsk("");
			qc.invalidateQueries({ queryKey: [
				"comments",
				entityType,
				entityId
			] });
			qc.invalidateQueries({ queryKey: ["handoff"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		},
		onError: (e) => toast.error(e.message)
	});
	const resolve = useMutation({
		mutationFn: (id) => resolveComment({ data: {
			id,
			resolved: true
		} }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: [
				"comments",
				entityType,
				entityId
			] });
			qc.invalidateQueries({ queryKey: ["handoff"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		}
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-0 flex-1 flex-col",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "px-5 pt-4 font-display text-lg font-medium",
				children: "Handoff notes"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-5 text-xs text-muted-foreground",
				children: "Sales and service talk here — no more buried spreadsheet comments."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex-1 space-y-3 overflow-y-auto px-5 py-4",
				children: (comments.data ?? []).length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "No notes yet. Leave the first one."
				}) : comments.data.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "rounded-lg border border-border bg-background p-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm font-medium",
								children: c.authorName ?? "Teammate"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("time", {
								className: "text-xs text-muted-foreground",
								children: new Date(c.createdAt).toLocaleString("en-US", {
									month: "short",
									day: "numeric",
									hour: "numeric",
									minute: "2-digit"
								})
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-sm leading-relaxed",
							children: c.body
						}),
						c.askTeam && !c.resolved ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-2 flex flex-wrap items-center gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
									variant: "warn",
									children: ["Ask ", c.askTeam]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PingButton, {
									size: "xs",
									entityType,
									entityId,
									contextLabel: `${entityType} #${entityId} · ${c.body.slice(0, 80)}`
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "text-xs text-muted-foreground underline-offset-2 hover:underline",
									onClick: () => resolve.mutate(c.id),
									children: "Mark answered"
								})
							]
						}) : null
					]
				}, c.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "border-t border-border p-4",
				onSubmit: (e) => {
					e.preventDefault();
					if (body.trim()) add.mutate();
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
					value: body,
					onChange: (e) => setBody(e.target.value),
					placeholder: "Write a note for the other team…",
					rows: 3
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-2 flex flex-wrap items-center justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex gap-1",
						children: [
							"",
							"sales",
							"service"
						].map((v) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setAsk(v),
							className: `h-8 rounded-full px-3 text-xs font-medium ${ask === v ? "bg-ink text-ink-foreground" : "bg-muted text-foreground"}`,
							children: v === "" ? "Note" : v === "sales" ? "Ask sales" : "Ask service"
						}, v || "none"))
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PingButton, {
							size: "xs",
							entityType,
							entityId,
							contextLabel: `Follow up on this ${entityType}`
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							size: "sm",
							disabled: add.isPending || !body.trim(),
							children: "Post"
						})]
					})]
				})]
			})
		]
	});
}
//#endregion
//#region src/lib/ops/recipe-fields.ts
var SETTING_FIELDS = [
	{
		name: "coffee1",
		label: "Coffee 1"
	},
	{
		name: "coffee2",
		label: "Coffee 2"
	},
	{
		name: "coffee3",
		label: "Coffee 3"
	},
	{
		name: "powder1",
		label: "Powder 1"
	},
	{
		name: "powder2",
		label: "Powder 2"
	},
	{
		name: "powder3",
		label: "Powder 3"
	},
	{
		name: "americano1",
		label: "Americano 1"
	},
	{
		name: "americano2",
		label: "Americano 2"
	},
	{
		name: "americano3",
		label: "Americano 3"
	},
	{
		name: "tea1",
		label: "Tea 1"
	},
	{
		name: "tea2",
		label: "Tea 2"
	},
	{
		name: "milk",
		label: "Milk settings"
	}
];
/** New recipes start with the first listing in each category. */
var DEFAULT_SETTING_NAMES = [
	"coffee1",
	"powder1",
	"americano1",
	"tea1",
	"milk"
];
function filledSettingNames(row) {
	if (!row) return [...DEFAULT_SETTING_NAMES];
	const filled = SETTING_FIELDS.filter((f) => (row[f.name] ?? "").trim()).map((f) => f.name);
	return filled.length ? filled : [...DEFAULT_SETTING_NAMES];
}
function previewSetting(row) {
	if (!row) return null;
	for (const f of SETTING_FIELDS) {
		const v = (row[f.name] ?? "").trim();
		if (v) return v.split("\n")[0].slice(0, 72);
	}
	return null;
}
//#endregion
//#region src/components/ui/combo-field.tsx
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
//#endregion
//#region src/components/desk/directory-fields.tsx
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
//#region src/components/desk/recipe-form.tsx
function RecipeForm({ draft, models: _models, customers: _customers, pending, copyPending, onSave, onCopy }) {
	const recipe = draft.recipe;
	const settingsSrc = recipe ?? null;
	const [modelPick, setModelPick] = (0, import_react.useState)(recipe?.equipmentModel || draft.equipmentModel || "");
	const [customerPick, setCustomerPick] = (0, import_react.useState)(recipe ? recipe.customer ?? "" : draft.customer ? draft.customer : "");
	const [visible, setVisible] = (0, import_react.useState)(() => new Set(recipe ? filledSettingNames(recipe) : DEFAULT_SETTING_NAMES));
	const [copyTo, setCopyTo] = (0, import_react.useState)("");
	const isHouse = !!recipe && !recipe.customer;
	const hidden = SETTING_FIELDS.filter((f) => !visible.has(f.name));
	const shown = SETTING_FIELDS.filter((f) => visible.has(f.name));
	const sourceName = draft.source ? draft.source.customer ? `${draft.source.customer} · ${draft.source.equipmentModel}` : `House · ${draft.source.equipmentModel}` : recipe?.copiedFrom ? "another recipe" : null;
	function hide(name) {
		setVisible((prev) => {
			const next = new Set(prev);
			next.delete(name);
			return next;
		});
	}
	function show(name) {
		setVisible((prev) => new Set(prev).add(name));
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
		className: "space-y-4",
		onSubmit: (e) => {
			e.preventDefault();
			const fd = new FormData(e.currentTarget);
			const model = String(fd.get("equipmentModel") || "").trim();
			if (!model) return;
			const customerRaw = isHouse ? "" : String(fd.get("customer") || "").trim();
			const customer = customerRaw ? customerRaw : null;
			const val = (name) => visible.has(name) ? String(fd.get(name) || "") || null : null;
			onSave({
				id: recipe?.id,
				equipmentModel: model,
				customer,
				installId: draft.installId,
				copiedFrom: draft.copiedFrom || recipe?.copiedFrom || null,
				coffee1: val("coffee1"),
				coffee2: val("coffee2"),
				coffee3: val("coffee3"),
				powder1: val("powder1"),
				powder2: val("powder2"),
				powder3: val("powder3"),
				americano1: val("americano1"),
				americano2: val("americano2"),
				americano3: val("americano3"),
				tea1: val("tea1"),
				tea2: val("tea2"),
				milk: val("milk"),
				notes: String(fd.get("notes") || "") || null
			});
		},
		children: [
			sourceName && !recipe ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground",
				children: "Settings start blank. Fill them in for this account — nothing is copied automatically."
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 sm:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: isHouse ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Customer" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm",
						children: "House template"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-muted-foreground",
						children: "Saving updates this shared template. Assign it to a customer below — that creates a copy and leaves the template in place."
					})
				] }) : draft.lockCustomer ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Customer" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm",
						children: draft.customer || "House template"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "hidden",
						name: "customer",
						value: draft.customer ?? ""
					})
				] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerCombo, {
					name: "customer",
					value: customerPick,
					onChange: setCustomerPick,
					placeholder: "Search customers — blank is a house template"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-muted-foreground",
					children: "Leave blank for a house template shared by every account."
				})] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EquipmentCombo, {
					name: "equipmentModel",
					value: modelPick,
					onChange: setModelPick,
					required: true,
					placeholder: "Search the full equipment list…"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-muted-foreground",
					children: "Scroll the list or type a model to add it."
				})] })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-3 sm:grid-cols-2",
				children: shown.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: cn("relative rounded-lg border border-border p-3 pt-2", f.name === "milk" && "sm:col-span-2"),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex items-center justify-between gap-2 pr-10",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: f.name,
								children: f.label
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => hide(f.name),
							className: "absolute top-1 right-1 flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
							"aria-label": `Remove ${f.label}`,
							title: `Remove ${f.label}`,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							id: f.name,
							name: f.name,
							className: "mt-1 min-h-20",
							defaultValue: settingsSrc?.[f.name] ?? "",
							placeholder: "Dose, yield, time, temp…"
						})
					]
				}, f.name))
			}),
			hidden.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: "Add a setting"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-2 flex flex-wrap gap-2",
				children: hidden.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => show(f.name),
					className: "inline-flex h-9 items-center gap-1 rounded-full border border-border bg-card px-3 text-sm hover:bg-muted",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), f.label]
				}, f.name))
			})] }) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
				htmlFor: "notes",
				children: "Notes"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
				id: "notes",
				name: "notes",
				className: "mt-1",
				defaultValue: settingsSrc?.notes ?? ""
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex justify-end",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "submit",
					disabled: pending || !modelPick,
					children: recipe ? "Save recipe" : draft.customer ? `Save for ${draft.customer}` : "Create recipe"
				})
			}),
			recipe && onCopy ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-lg border border-border p-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm font-medium",
						children: isHouse ? "Assign to a customer" : "Reuse for another customer"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-0.5 text-xs text-muted-foreground",
						children: isHouse ? "Keeps this house template. Creates a customer recipe with the same settings — fill those in here first." : "Copies these settings onto a new account. Shared with techs and sales."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2 flex flex-col gap-2 sm:flex-row",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex-1",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerCombo, {
								label: "",
								value: copyTo,
								onChange: setCopyTo,
								placeholder: "Pick a customer…"
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "secondary",
							disabled: !copyTo || copyPending,
							onClick: () => onCopy({
								sourceId: recipe.id,
								customer: copyTo
							}),
							children: isHouse ? "Assign" : "Copy recipe"
						})]
					})
				]
			}) : null
		]
	});
}
//#endregion
//#region src/components/desk/recipe-sheet.tsx
function RecipeEditorSheet({ draft, models, customers, onClose }) {
	const qc = useQueryClient();
	const save = useMutation({
		mutationFn: (d) => upsertRecipe({ data: d }),
		onSuccess: (row) => {
			toast.success(row.customer ? `Saved for ${row.customer}` : "House recipe saved");
			qc.invalidateQueries({ queryKey: ["recipes"] });
			qc.invalidateQueries({ queryKey: ["customers"] });
			onClose();
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Failed")
	});
	const copy = useMutation({
		mutationFn: (d) => copyRecipe({ data: d }),
		onSuccess: (row) => {
			toast.success(`Copied onto ${row.customer}`);
			qc.invalidateQueries({ queryKey: ["recipes"] });
			qc.invalidateQueries({ queryKey: ["customers"] });
			onClose();
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Failed")
	});
	const title = draft?.recipe ? draft.recipe.customer ? `${draft.recipe.customer}` : "House template" : draft?.customer ? draft.customer : "New recipe";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
		open: !!draft,
		onOpenChange: (o) => !o && onClose(),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetContent, { children: draft ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: "Recipe"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, { children: title }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-muted-foreground",
				children: draft.equipmentModel || draft.recipe?.equipmentModel || "Pick equipment"
			})
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "p-5",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecipeForm, {
				draft,
				models,
				customers,
				pending: save.isPending,
				copyPending: copy.isPending,
				onSave: (d) => save.mutate(d),
				onCopy: draft.recipe ? (d) => copy.mutate(d) : void 0
			}, `${draft.recipe?.id ?? "new"}-${draft.equipmentModel}-${draft.customer}`)
		})] }) : null })
	});
}
function RecipeChip({ piece, customer, installId, recipes, onOpen, onRemove }) {
	const { linked, house } = findRecipeFor(recipes, {
		customer,
		model: piece.model,
		installId
	});
	const preview = previewSetting(linked ?? void 0);
	let tone = "empty";
	let status = "Add recipe";
	if (linked) {
		tone = "saved";
		status = "Recipe";
	} else if (house) {
		tone = "house";
		status = "House";
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("inline-flex h-9 max-w-[16rem] items-center rounded-md border", tone === "saved" && "border-primary/30 bg-primary/8", tone === "house" && "border-border bg-card", tone === "empty" && "border-dashed border-border bg-background text-muted-foreground"),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			onClick: (e) => {
				e.stopPropagation();
				onOpen({
					recipe: linked,
					customer,
					equipmentModel: piece.model,
					installId,
					copiedFrom: linked?.copiedFrom ?? house?.id ?? null,
					lockCustomer: true,
					lockEquipment: false,
					source: null
				});
			},
			className: "inline-flex min-w-0 flex-1 items-center gap-1.5 px-2 text-left",
			title: preview ?? `${piece.model} recipe`,
			children: [
				tone === "empty" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5 shrink-0" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookOpen, { className: "size-3.5 shrink-0" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "min-w-0 truncate text-xs font-medium text-foreground",
					children: shortEquipLabel(piece.label)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "shrink-0 text-[11px] text-muted-foreground",
					children: status
				})
			]
		}), onRemove ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: "flex size-10 shrink-0 items-center justify-center rounded-r-md border-l border-border/70 text-muted-foreground hover:bg-muted hover:text-foreground",
			"aria-label": `Remove ${piece.label}`,
			title: "Remove this equipment from the install",
			onClick: (e) => {
				e.preventDefault();
				e.stopPropagation();
				onRemove();
			},
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" })
		}) : null]
	});
}
function InstallRecipeList({ customer, installId, pieces, recipes, onOpen }) {
	if (pieces.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "border-b border-border px-5 py-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: "Recipes"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted-foreground",
				children: "Add equipment on this install and a recipe slot will show up for each machine."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				type: "button",
				size: "sm",
				variant: "outline",
				className: "mt-3",
				onClick: () => onOpen({
					recipe: null,
					customer,
					equipmentModel: "",
					installId,
					copiedFrom: null,
					lockCustomer: true
				}),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }),
					"Add recipe for ",
					customer
				]
			})
		]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "border-b border-border px-5 py-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: "Recipes by machine"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 text-xs text-muted-foreground",
				children: [
					"Linked to ",
					customer,
					". Shared with techs and sales. Use a house recipe or start a new one."
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 space-y-2",
				children: pieces.map((p, idx) => {
					const { linked, house } = findRecipeFor(recipes, {
						customer,
						model: p.model,
						installId
					});
					const preview = previewSetting(linked ?? house ?? void 0);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex flex-col gap-2 rounded-lg border border-border bg-background px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "truncate text-sm font-medium",
								children: p.model
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "truncate text-xs text-muted-foreground",
								children: [linked ? "Saved for this account" : house ? "House recipe available" : "No recipe yet", preview ? ` · ${preview}` : ""]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							size: "sm",
							variant: linked ? "secondary" : "outline",
							onClick: () => onOpen({
								recipe: linked,
								customer,
								equipmentModel: p.model,
								installId,
								copiedFrom: linked?.copiedFrom ?? house?.id ?? null,
								lockCustomer: true,
								lockEquipment: false,
								source: null
							}),
							children: linked ? "Edit" : "Add recipe"
						})]
					}, `${p.model}-${idx}`);
				})
			})
		]
	});
}
//#endregion
//#region src/components/desk/machine-fields.tsx
function MachineFields({ specs, onChange }) {
	if (!specs.length) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "space-y-3",
		children: specs.map((spec, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", {
			className: "rounded-xl border border-border bg-background px-3 py-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", {
					className: "px-1 text-sm font-medium",
					children: spec.equipment
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground",
					children: "Serial and power for this machine only — not shared with the others on this install."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-2 grid gap-3 sm:grid-cols-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Label, {
						htmlFor: `sn-${index}`,
						children: ["Serial number — ", spec.equipment]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: `sn-${index}`,
						className: "mt-1",
						value: spec.serial,
						autoComplete: "off",
						placeholder: "Type the serial",
						onChange: (e) => {
							onChange(specs.map((s, i) => i === index ? {
								...s,
								serial: e.target.value
							} : s));
						}
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Label, {
						htmlFor: `pwr-${index}`,
						children: ["Power / voltage — ", spec.equipment]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: `pwr-${index}`,
						className: "mt-1",
						value: spec.powerVoltage,
						autoComplete: "off",
						placeholder: "e.g. 208V / 1-phase / 30A",
						onChange: (e) => {
							onChange(specs.map((s, i) => i === index ? {
								...s,
								powerVoltage: e.target.value
							} : s));
						}
					})] })]
				})
			]
		}, `${spec.equipment}-${index}`))
	});
}
//#endregion
//#region src/components/desk/entity-sheets.tsx
function Field$1({ label, name, defaultValue, type = "text", placeholder }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
		htmlFor: name,
		children: label
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
		id: name,
		name,
		type,
		defaultValue,
		placeholder,
		autoComplete: "off",
		className: "mt-1"
	})] });
}
function BoundCustomer$1({ recordKey, defaultValue, name = "customer", required }) {
	const [value, setValue] = (0, import_react.useState)(defaultValue);
	(0, import_react.useEffect)(() => {
		setValue(defaultValue);
	}, [recordKey, defaultValue]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerCombo, {
		name,
		value,
		onChange: setValue,
		required
	});
}
function BoundEquipment$1({ recordKey, defaultValue, name = "equipment" }) {
	const [value, setValue] = (0, import_react.useState)(defaultValue);
	(0, import_react.useEffect)(() => {
		setValue(defaultValue);
	}, [recordKey, defaultValue]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EquipmentCombo, {
		name,
		value,
		onChange: setValue
	});
}
function PmSheet({ pm, onClose }) {
	const qc = useQueryClient();
	const save = useMutation({
		mutationFn: (d) => updatePm({ data: d }),
		onSuccess: () => {
			toast.success("Saved");
			qc.invalidateQueries({ queryKey: ["pms"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
		open: !!pm,
		onOpenChange: (o) => !o && onClose(),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetContent, { children: pm ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs tracking-wide text-muted-foreground uppercase",
					children: "Preventative maintenance"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, { children: pm.customer }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-2 flex flex-wrap gap-1.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: pm.status }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlagBadge, { flag: pm.flag })]
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "grid gap-3 border-b border-border p-5 sm:grid-cols-2",
				onSubmit: (e) => {
					e.preventDefault();
					const fd = new FormData(e.currentTarget);
					save.mutate({
						id: pm.id,
						customer: String(fd.get("customer")),
						equipment: String(fd.get("equipment") || "") || null,
						style: String(fd.get("style") || "") || null,
						projected: String(fd.get("projected") || "") || null,
						partsStatus: String(fd.get("partsStatus") || "") || null,
						status: String(fd.get("status")),
						technician: String(fd.get("technician") || "") || null,
						notes: String(fd.get("notes") || "") || null
					});
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BoundCustomer$1, {
						recordKey: pm.id,
						defaultValue: pm.customer,
						required: true
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BoundEquipment$1, {
						recordKey: pm.id,
						defaultValue: pm.equipment ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "PM style" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "style",
						className: "mt-1",
						defaultValue: pm.style ?? "",
						allowEmpty: true,
						children: PM_STYLES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Status" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "status",
						className: "mt-1",
						defaultValue: pm.status,
						children: PM_STATUSES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
						label: "Projected date",
						name: "projected",
						type: "date",
						defaultValue: pm.projected ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Parts" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "partsStatus",
						className: "mt-1",
						defaultValue: pm.partsStatus ?? "",
						allowEmpty: true,
						children: PARTS_STATUSES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Tech" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "technician",
						className: "mt-1",
						defaultValue: pm.technician ?? "",
						allowEmpty: true,
						children: TECHNICIANS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Notes" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							name: "notes",
							className: "mt-1",
							defaultValue: pm.notes ?? ""
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex justify-end sm:col-span-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							size: "sm",
							disabled: save.isPending,
							children: "Save"
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Thread, {
				entityType: "pm",
				entityId: pm.id
			})
		] }) : null })
	});
}
function InstallSheet({ row, onClose }) {
	const qc = useQueryClient();
	const recs = useQuery({
		queryKey: ["recipes"],
		queryFn: () => listRecipes()
	});
	const assets = useQuery({
		queryKey: ["assets"],
		queryFn: () => listAssets()
	});
	const customers = useQuery({
		queryKey: ["customers"],
		queryFn: () => listCustomers()
	});
	const directoryEquip = useQuery({
		queryKey: ["directory", "equipment"],
		queryFn: () => listDirectory({ data: { kind: "equipment" } })
	});
	const [recipeDraft, setRecipeDraft] = (0, import_react.useState)(null);
	const [customer, setCustomer] = (0, import_react.useState)(row?.customer ?? "");
	const [equipPieces, setEquipPieces] = (0, import_react.useState)([]);
	const [specs, setSpecs] = (0, import_react.useState)([]);
	const [hydratedId, setHydratedId] = (0, import_react.useState)(null);
	const catalog = catalogModels([
		...(directoryEquip.data ?? []).map((e) => e.name),
		...(assets.data ?? []).filter((a) => a.kind === "equip").map((a) => a.model),
		...(recs.data ?? []).map((r) => r.equipmentModel)
	]);
	(0, import_react.useEffect)(() => {
		setRecipeDraft(null);
		setCustomer(row?.customer ?? "");
		const saved = row?.machines ?? [];
		const names = saved.length ? saved.map((s) => s.equipment) : listedEquipment(row?.equipment, catalog);
		setEquipPieces(names);
		setSpecs(saved.length ? saved : mergeMachineSpecs(names, [], {
			serial: row?.serial,
			powerVoltage: row?.powerVoltage
		}));
		setHydratedId(row?.id ?? null);
	}, [row?.id]);
	const save = useMutation({
		mutationFn: (d) => updateInstall({ data: d }),
		onSuccess: (_row, vars) => {
			if (!Object.keys(vars).filter((k) => k !== "id").every((k) => [
				"equipment",
				"serial",
				"powerVoltage",
				"machines"
			].includes(k))) toast.success("Saved");
			qc.invalidateQueries({ queryKey: ["installs"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save")
	});
	const saveRecipe = useMutation({
		mutationFn: (d) => upsertRecipe({ data: d }),
		onSuccess: (saved) => {
			toast.success(saved.customer ? `Recipe saved for ${saved.customer}` : "House recipe saved");
			qc.invalidateQueries({ queryKey: ["recipes"] });
			qc.invalidateQueries({ queryKey: ["customers"] });
			setRecipeDraft(null);
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Failed")
	});
	const copy = useMutation({
		mutationFn: (d) => copyRecipe({ data: d }),
		onSuccess: (saved) => {
			toast.success(`Copied onto ${saved.customer}`);
			qc.invalidateQueries({ queryKey: ["recipes"] });
			qc.invalidateQueries({ queryKey: ["customers"] });
			setRecipeDraft(null);
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Failed")
	});
	const pieces = row ? piecesForInstall(row.equipment, row.customer, row.id, catalog, recs.data ?? []) : [];
	const models = catalog;
	function persistMachines(next) {
		setSpecs(next);
		setEquipPieces(next.map((s) => s.equipment));
		if (!row) return;
		const packed = serializeMachines(next);
		save.mutate({
			id: row.id,
			equipment: packed.equipment,
			serial: packed.serial,
			powerVoltage: packed.powerVoltage,
			machines: packed.machines
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
		open: !!row,
		onOpenChange: (o) => {
			if (!o) {
				if (row && hydratedId === row.id) {
					const packed = serializeMachines(specs);
					save.mutate({
						id: row.id,
						equipment: packed.equipment,
						serial: packed.serial,
						powerVoltage: packed.powerVoltage,
						machines: packed.machines
					});
				}
				setRecipeDraft(null);
				onClose();
			}
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetContent, { children: row ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs tracking-wide text-muted-foreground uppercase",
					children: "Install"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, { children: row.customer }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-2 flex flex-wrap gap-1.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: row.equipStatus }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlagBadge, { flag: row.flag })]
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InstallAssets, { installId: row.id }),
			recipeDraft ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "border-b border-border p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-3 flex items-center justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs tracking-wide text-muted-foreground uppercase",
						children: "Recipe"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						size: "sm",
						variant: "ghost",
						onClick: () => setRecipeDraft(null),
						children: "Back to machines"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecipeForm, {
					draft: recipeDraft,
					models,
					customers: customers.data ?? [],
					pending: saveRecipe.isPending,
					copyPending: copy.isPending,
					onSave: (d) => saveRecipe.mutate(d),
					onCopy: recipeDraft.recipe ? (d) => copy.mutate(d) : void 0
				}, `${recipeDraft.recipe?.id ?? "new"}-${recipeDraft.equipmentModel}`)]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InstallRecipeList, {
				customer: row.customer,
				installId: row.id,
				pieces,
				recipes: recs.data ?? [],
				onOpen: setRecipeDraft
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "grid gap-3 border-b border-border p-5 sm:grid-cols-2",
				onSubmit: (e) => {
					e.preventDefault();
					const fd = new FormData(e.currentTarget);
					const packed = serializeMachines(specs);
					save.mutate({
						id: row.id,
						customer: String(fd.get("customer")),
						equipment: packed.equipment,
						equipStatus: String(fd.get("equipStatus") || "") || null,
						installDate: String(fd.get("installDate") || "") || null,
						technician: String(fd.get("technician") || "") || null,
						wo: String(fd.get("wo") || "") || null,
						reqsReady: String(fd.get("reqsReady") || "") || null,
						notes: String(fd.get("notes") || "") || null,
						accountRep: String(fd.get("accountRep") || "") || null,
						paymentStatus: String(fd.get("paymentStatus") || "") || null,
						serial: packed.serial,
						powerVoltage: packed.powerVoltage,
						machines: packed.machines
					});
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerCombo, {
						name: "customer",
						value: customer,
						onChange: setCustomer,
						required: true
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EquipmentMultiCombo, {
							values: equipPieces,
							placeholder: "Search the full equipment list…",
							onChange: (next) => persistMachines(mergeMachineSpecs(next, specs))
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-xs text-muted-foreground",
							children: "Scroll the full list, pick a model, or type a new one to add it."
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "sm:col-span-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MachineFields, {
							specs,
							onChange: setSpecs
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Equipment status" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "equipStatus",
						className: "mt-1",
						defaultValue: row.equipStatus ?? "",
						allowEmpty: true,
						children: EQUIP_STATUSES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
						label: "Install date",
						name: "installDate",
						type: "date",
						defaultValue: row.installDate ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Tech" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "technician",
						className: "mt-1",
						defaultValue: row.technician ?? "",
						allowEmpty: true,
						children: TECHNICIANS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
						label: "WO #",
						name: "wo",
						defaultValue: row.wo ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Site ready?" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "reqsReady",
						className: "mt-1",
						defaultValue: row.reqsReady ?? "",
						allowEmpty: true,
						children: REQS_READY.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
						label: "Account rep",
						name: "accountRep",
						defaultValue: row.accountRep ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Payment" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "paymentStatus",
						className: "mt-1",
						defaultValue: row.paymentStatus ?? "",
						allowEmpty: true,
						children: PAYMENT_TERMS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Notes" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							name: "notes",
							className: "mt-1",
							defaultValue: row.notes ?? ""
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex justify-end sm:col-span-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							size: "sm",
							disabled: save.isPending,
							children: "Save"
						})
					})
				]
			}, row.id),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Thread, {
				entityType: "install",
				entityId: row.id
			})
		] }) : null })
	});
}
function DealSheet({ deal, onClose }) {
	const qc = useQueryClient();
	const save = useMutation({
		mutationFn: (d) => updateDeal({ data: d }),
		onSuccess: () => {
			toast.success("Saved");
			qc.invalidateQueries({ queryKey: ["deals"] });
			qc.invalidateQueries({ queryKey: ["installs"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["handoff"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
		open: !!deal,
		onOpenChange: (o) => !o && onClose(),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetContent, { children: deal ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs tracking-wide text-muted-foreground uppercase",
					children: ["Pipeline · ", moneyExact(deal.amount)]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, { children: deal.customer }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-2 flex flex-wrap gap-1.5",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: deal.completion === "complete" ? "Complete" : deal.completion === "fell" ? "Fell through" : "Open" })
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "grid gap-3 border-b border-border p-5 sm:grid-cols-2",
				onSubmit: (e) => {
					e.preventDefault();
					const fd = new FormData(e.currentTarget);
					const amountRaw = String(fd.get("amount") || "").replace(/[$,]/g, "").trim();
					const amountNum = amountRaw ? Number(amountRaw) : NaN;
					save.mutate({
						id: deal.id,
						customer: String(fd.get("customer")),
						producer: String(fd.get("producer") || "") || null,
						equipment: String(fd.get("equipment") || "") || null,
						amount: Number.isFinite(amountNum) ? amountNum : null,
						goodToOrder: fd.get("goodToOrder") === "on",
						ordered: fd.get("ordered") === "on",
						eta: String(fd.get("eta") || "") || null,
						terms: String(fd.get("terms") || "") || null,
						invoice: String(fd.get("invoice") || "") || null,
						completion: String(fd.get("completion") || "") || null,
						notes: String(fd.get("notes") || "") || null
					});
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BoundCustomer$1, {
						recordKey: deal.id,
						defaultValue: deal.customer,
						required: true
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Producer" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
						name: "producer",
						className: "mt-1",
						defaultValue: deal.producer ?? "",
						allowEmpty: true,
						children: [deal.producer && !PRODUCERS.includes(deal.producer) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: deal.producer }, deal.producer) : null, PRODUCERS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))]
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "sm:col-span-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BoundEquipment$1, {
							recordKey: deal.id,
							defaultValue: deal.equipment ?? ""
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
						label: "Amount",
						name: "amount",
						defaultValue: deal.amount != null ? String(deal.amount) : ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Payment terms" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "terms",
						className: "mt-1",
						defaultValue: deal.terms ?? "",
						allowEmpty: true,
						children: PAYMENT_TERMS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
						label: "ETA",
						name: "eta",
						defaultValue: deal.eta ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
						label: "Invoice #",
						name: "invoice",
						defaultValue: deal.invoice ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Deal completion" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
						name: "completion",
						className: "mt-1",
						defaultValue: deal.completion ?? "",
						allowEmpty: true,
						emptyLabel: "Still open",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "complete",
							children: "Complete — hand off to service"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "fell",
							children: "Fell through"
						})]
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "flex items-center gap-2 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "checkbox",
							name: "goodToOrder",
							defaultChecked: deal.goodToOrder
						}), "Good to order"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "flex items-center gap-2 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "checkbox",
							name: "ordered",
							defaultChecked: deal.ordered
						}), "Equipment ordered"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Notes" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							name: "notes",
							className: "mt-1",
							defaultValue: deal.notes ?? ""
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex justify-end sm:col-span-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							size: "sm",
							disabled: save.isPending,
							children: "Save"
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Thread, {
				entityType: "deal",
				entityId: deal.id
			})
		] }) : null })
	});
}
function ModuleSheet({ row, onClose }) {
	const qc = useQueryClient();
	const save = useMutation({
		mutationFn: (d) => updateModule({ data: d }),
		onSuccess: () => {
			toast.success("Saved");
			qc.invalidateQueries({ queryKey: ["modules"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
		open: !!row,
		onOpenChange: (o) => !o && onClose(),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetContent, { children: row ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs tracking-wide text-muted-foreground uppercase",
					children: "Eversys module"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, { children: row.moduleId }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-2",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: row.status })
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "grid gap-3 border-b border-border p-5 sm:grid-cols-2",
				onSubmit: (e) => {
					e.preventDefault();
					const fd = new FormData(e.currentTarget);
					save.mutate({
						id: row.id,
						platform: String(fd.get("platform") || "") || null,
						moduleType: String(fd.get("moduleType") || "") || null,
						status: String(fd.get("status")),
						wo: String(fd.get("wo") || "") || null,
						location: String(fd.get("location") || "") || null,
						dateIn: String(fd.get("dateIn") || "") || null,
						dateReady: String(fd.get("dateReady") || "") || null,
						technician: String(fd.get("technician") || "") || null,
						notes: String(fd.get("notes") || "") || null
					});
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Platform" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "platform",
						className: "mt-1",
						defaultValue: row.platform ?? "",
						children: MODULE_PLATFORMS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Type" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "moduleType",
						className: "mt-1",
						defaultValue: row.moduleType ?? "",
						children: MODULE_TYPES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Status" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "status",
						className: "mt-1",
						defaultValue: row.status,
						children: MODULE_STATUSES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
						label: "Location / account",
						name: "location",
						defaultValue: row.location ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
						label: "WO #",
						name: "wo",
						defaultValue: row.wo ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Tech" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "technician",
						className: "mt-1",
						defaultValue: row.technician ?? "",
						allowEmpty: true,
						children: TECHNICIANS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
						label: "Date in",
						name: "dateIn",
						type: "date",
						defaultValue: row.dateIn ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
						label: "Date ready",
						name: "dateReady",
						type: "date",
						defaultValue: row.dateReady ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Notes" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							name: "notes",
							className: "mt-1",
							defaultValue: row.notes ?? ""
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex justify-end sm:col-span-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							size: "sm",
							disabled: save.isPending,
							children: "Save"
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Thread, {
				entityType: "module",
				entityId: row.id
			})
		] }) : null })
	});
}
function InstallAssets({ installId }) {
	const qc = useQueryClient();
	const assets = useQuery({
		queryKey: ["assets"],
		queryFn: () => listAssets()
	});
	const [pick, setPick] = (0, import_react.useState)("");
	const [q, setQ] = (0, import_react.useState)("");
	const assigned = (assets.data ?? []).filter((a) => a.installId === installId);
	const pool = filterReadyUnits((assets.data ?? []).filter((a) => a.status === "ready" && a.site.startsWith("barn")), q);
	const assign = useMutation({
		mutationFn: (assetId) => assignAssetToInstall({ data: {
			assetId,
			installId
		} }),
		onSuccess: () => {
			toast.success("Pulled from the barn — off the warehouse board");
			setPick("");
			qc.invalidateQueries({ queryKey: ["assets"] });
			qc.invalidateQueries({ queryKey: ["installs"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Failed")
	});
	const unassign = useMutation({
		mutationFn: (assetId) => unassignAssetFromInstall({ data: {
			assetId,
			installId
		} }),
		onSuccess: () => {
			toast.success("Removed — back on the barn rack");
			qc.invalidateQueries({ queryKey: ["assets"] });
			qc.invalidateQueries({ queryKey: ["installs"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Failed")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		id: "warehouse-units",
		className: "border-b border-border bg-muted/40 p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: "Warehouse units"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-0.5 text-xs text-muted-foreground",
				children: "Assigning a unit takes it off the rack. Serial and voltage on this install stay blank until you type them."
			}),
			assets.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted-foreground",
				children: "Loading the barn…"
			}) : assigned.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-2 space-y-1",
				children: assigned.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-center justify-between gap-2 text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "min-w-0 truncate",
						children: [
							a.model,
							" · ",
							a.serial ?? "no serial",
							a.customerOwned ? ` · ${a.customerOwned}` : ""
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-background hover:text-foreground",
						"aria-label": `Remove ${a.model}`,
						disabled: unassign.isPending,
						onClick: () => unassign.mutate(a.id),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" }), "Remove"]
					})]
				}, a.id))
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted-foreground",
				children: "None pulled yet. Assigning a unit removes it from the barn rack."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				value: q,
				onChange: (e) => setQ(e.target.value),
				placeholder: "Filter by model or serial…",
				className: "mt-3",
				"aria-label": "Filter warehouse units"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1.5 text-xs text-muted-foreground",
				children: [pool.length, " ready on the rack"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 flex flex-col gap-2 sm:flex-row",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
					className: "flex-1",
					value: pick,
					onChange: (e) => setPick(e.target.value),
					allowEmpty: true,
					emptyLabel: "Ready unit on the rack…",
					"aria-label": "Ready unit on the rack",
					children: pool.slice(0, 120).map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
						value: a.id,
						children: [
							a.model,
							" · ",
							a.slotLabel,
							a.serial ? ` · ${a.serial}` : ""
						]
					}, a.id))
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					type: "button",
					disabled: !pick || assign.isPending,
					onClick: () => assign.mutate(Number(pick)),
					children: "Assign from barn"
				})]
			})
		]
	});
}
function filterReadyUnits(ready, filter) {
	const q = filter.trim().toLowerCase();
	return [...q ? ready.filter((a) => `${a.model} ${a.serial ?? ""} ${a.slotLabel}`.toLowerCase().includes(q)) : ready].sort((a, b) => a.model.localeCompare(b.model) || a.slotLabel.localeCompare(b.slotLabel));
}
function SimpleCreateDialog({ title, open, onOpenChange, fields, onSubmit }) {
	const [pending, setPending] = (0, import_react.useState)(false);
	const [values, setValues] = (0, import_react.useState)({});
	(0, import_react.useEffect)(() => {
		if (open) setValues({});
	}, [open]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: title }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "mt-4 space-y-3",
			onSubmit: async (e) => {
				e.preventDefault();
				const fd = new FormData(e.currentTarget);
				const next = { ...values };
				for (const [k, v] of fd.entries()) next[k] = String(v);
				setPending(true);
				try {
					await onSubmit(next);
					onOpenChange(false);
				} catch (err) {
					toast.error(err instanceof Error ? err.message : "Failed");
				} finally {
					setPending(false);
				}
			},
			children: [fields.map((f) => {
				const val = values[f.name] ?? "";
				if (f.kind === "customer") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerCombo, {
					name: f.name,
					label: f.label,
					value: val,
					onChange: (v) => setValues((cur) => ({
						...cur,
						[f.name]: v
					})),
					required: f.required
				}, f.name);
				if (f.kind === "equipment") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EquipmentCombo, {
					name: f.name,
					label: f.label,
					value: val,
					onChange: (v) => setValues((cur) => ({
						...cur,
						[f.name]: v
					}))
				}, f.name);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					htmlFor: f.name,
					children: f.label
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					id: f.name,
					name: f.name,
					className: "mt-1",
					required: f.required
				})] }, f.name);
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex justify-end",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "submit",
					disabled: pending,
					children: "Create"
				})
			})]
		})] })
	});
}
//#endregion
//#region src/lib/ops/search-params.ts
function parseOpenSearch(s) {
	const raw = s.open;
	if (typeof raw === "number" && Number.isFinite(raw)) return { open: raw };
	if (typeof raw === "string" && raw && !Number.isNaN(Number(raw))) return { open: Number(raw) };
	return {};
}
/** Keep the open sheet in sync when search / pings / deep links change `?open=`. */
function useOpenRecord(open) {
	const [selected, setSelected] = (0, import_react.useState)(open ?? null);
	(0, import_react.useEffect)(() => {
		if (open != null && Number.isFinite(open)) setSelected(open);
	}, [open]);
	return [selected, setSelected];
}
//#endregion
//#region src/routes/_app/installs.tsx
var Route$9 = createFileRoute("/_app/installs")({
	validateSearch: parseOpenSearch,
	component: Page$8
});
function Page$8() {
	const { open } = Route$9.useSearch();
	useQueryClient();
	const data = useQuery({
		queryKey: ["installs"],
		queryFn: () => listInstalls()
	});
	const recs = useQuery({
		queryKey: ["recipes"],
		queryFn: () => listRecipes()
	});
	const assets = useQuery({
		queryKey: ["assets"],
		queryFn: () => listAssets()
	});
	const customers = useQuery({
		queryKey: ["customers"],
		queryFn: () => listCustomers()
	});
	const directoryEquip = useQuery({
		queryKey: ["directory", "equipment"],
		queryFn: () => listDirectory({ data: { kind: "equipment" } })
	});
	const [q, setQ] = (0, import_react.useState)("");
	const [view, setView] = (0, import_react.useState)("queue");
	const [selected, setSelected] = useOpenRecord(open);
	const [create, setCreate] = (0, import_react.useState)(false);
	const [recipeDraft, setRecipeDraft] = (0, import_react.useState)(null);
	const [sort, setSort] = useDeskSort("installs", "date-asc");
	const catalog = (0, import_react.useMemo)(() => catalogModels([
		...(directoryEquip.data ?? []).map((e) => e.name),
		...(assets.data ?? []).filter((a) => a.kind === "equip").map((a) => a.model),
		...(recs.data ?? []).map((r) => r.equipmentModel)
	]), [
		assets.data,
		recs.data,
		directoryEquip.data
	]);
	const rows = (0, import_react.useMemo)(() => {
		let list = data.data ?? [];
		if (view === "queue") list = list.filter((i) => !i.complete && i.equipStatus !== "Installed");
		const needle = q.trim().toLowerCase();
		if (needle) list = list.filter((i) => [
			i.customer,
			i.equipment,
			i.wo,
			i.technician,
			i.serial,
			i.powerVoltage,
			...(i.machines ?? []).flatMap((m) => [
				m.equipment,
				m.serial,
				m.powerVoltage
			])
		].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle)));
		return sortDesk(list, sort, {
			date: (i) => i.installDate ?? i.received,
			name: (i) => i.customer,
			equipment: (i) => i.machines?.length || equipmentCount(i.equipment),
			status: (i) => i.equipStatus,
			flagRank: (i) => i.flag?.rank ?? 99,
			tech: (i) => i.technician
		});
	}, [
		data.data,
		q,
		view,
		sort
	]);
	const selectedRow = (data.data ?? []).find((i) => i.id === selected) ?? null;
	const allInstalls = data.data ?? [];
	const atRisk = allInstalls.filter((i) => i.flag).length;
	const recipes = recs.data ?? [];
	const readyN = allInstalls.filter((i) => !i.complete && i.equipStatus === "Ready").length;
	const notReadyN = allInstalls.filter((i) => !i.complete && i.equipStatus !== "Ready" && i.equipStatus !== "Installed").length;
	const installedN = allInstalls.filter((i) => i.complete || i.equipStatus === "Installed").length;
	const readyByEquip = tally(allInstalls.filter((i) => !i.complete && i.equipStatus === "Ready").flatMap((i) => {
		const names = (i.machines ?? []).map((m) => m.equipment).filter(Boolean);
		if (names.length) return names;
		const listed = listedEquipment(i.equipment, catalog);
		return listed.length ? listed : [i.equipment || "Unspecified"];
	}), (n) => n);
	const statusMix = [
		{
			name: "Not Ready",
			count: notReadyN
		},
		{
			name: "Ready",
			count: readyN
		},
		{
			name: "Installed",
			count: installedN
		}
	].filter((s) => s.count > 0);
	function openRecipe(d) {
		setSelected(null);
		setRecipeDraft(d);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-medium tracking-tight",
				children: "Install clock"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-xl text-sm text-muted-foreground",
				children: "Prep queue for every account not yet installed. Each machine on the row carries its own recipe — linked to that customer, shared with techs and sales."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				onClick: () => setCreate(true),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "New install"]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-3 text-sm text-muted-foreground",
			children: [atRisk, " at risk this week or next."]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 grid grid-cols-3 gap-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Ready",
					value: readyN,
					hint: "Cleared to go on site",
					breakdown: readyByEquip
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Not ready",
					value: notReadyN,
					hint: "Still in prep"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Installed",
					value: installedN
				})
			]
		}),
		statusMix.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-4 grid gap-4 lg:grid-cols-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartCard, {
				title: "Board mix",
				lede: "Every install, including completed.",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusDonut, {
					data: statusMix,
					unit: "installs"
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartCard, {
				title: "Ready machines",
				lede: "What’s actually cleared — one bar per model.",
				children: readyByEquip.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleBars, {
					data: readyByEquip.slice(0, 8).map((r) => ({
						model: r.name,
						count: r.count
					})),
					xKey: "model",
					yKey: "count",
					yLabel: "Machines",
					horizontal: true
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "Nothing marked Ready."
				})
			})]
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 flex flex-wrap gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => setView("queue"),
					className: `h-9 rounded-full px-3 text-sm font-medium ${view === "queue" ? "bg-ink text-ink-foreground" : "bg-secondary"}`,
					children: [
						"Queue (",
						(data.data ?? []).filter((i) => !i.complete && i.equipStatus !== "Installed").length,
						")"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setView("board"),
					className: `h-9 rounded-full px-3 text-sm font-medium ${view === "board" ? "bg-ink text-ink-foreground" : "bg-secondary"}`,
					children: "Board"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setView("all"),
					className: `h-9 rounded-full px-3 text-sm font-medium ${view === "all" ? "bg-ink text-ink-foreground" : "bg-secondary"}`,
					children: "All installs"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: q,
					onChange: (e) => setQ(e.target.value),
					placeholder: "Filter…",
					className: "max-w-xs"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
					value: sort,
					onChange: setSort,
					options: SORT_LIST
				})
			]
		}),
		view === "board" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-4 grid gap-3 md:grid-cols-3",
			children: [
				"Not Ready",
				"Ready",
				"Installed"
			].map((col) => {
				const colRows = rows.filter((i) => col === "Installed" ? i.equipStatus === "Installed" || i.complete : (i.equipStatus ?? "Not Ready") === col && !i.complete);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-xl border border-border bg-card p-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "px-1 text-[11px] tracking-wide text-muted-foreground uppercase",
						children: [
							col,
							" · ",
							colRows.length
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
						className: "mt-2 space-y-2",
						children: [colRows.map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InstallCard, {
							install: i,
							catalog,
							recipes,
							onOpen: () => setSelected(i.id),
							onRecipe: openRecipe
						}) }, i.id)), colRows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "px-1 py-4 text-xs text-muted-foreground",
							children: "Empty"
						}) : null]
					})]
				}, col);
			})
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 overflow-hidden rounded-xl border border-border bg-card",
			children: [rows.map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InstallRow, {
				install: i,
				catalog,
				recipes,
				onOpen: () => setSelected(i.id),
				onRecipe: openRecipe
			}, i.id)), rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-4 py-8 text-sm text-muted-foreground",
				children: "Queue is empty."
			}) : null]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InstallSheet, {
			row: selectedRow,
			onClose: () => setSelected(null)
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecipeEditorSheet, {
			draft: recipeDraft,
			models: catalog,
			customers: customers.data ?? [],
			onClose: () => setRecipeDraft(null)
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NewInstallDialog, {
			open: create,
			onOpenChange: setCreate,
			onCreated: (id) => setSelected(id)
		})
	] });
}
function NewInstallDialog({ open, onOpenChange, onCreated }) {
	const qc = useQueryClient();
	const [customer, setCustomer] = (0, import_react.useState)("");
	const [equipment, setEquipment] = (0, import_react.useState)([]);
	const [specs, setSpecs] = (0, import_react.useState)([]);
	const [pending, setPending] = (0, import_react.useState)(false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange: (v) => {
			onOpenChange(v);
			if (!v) {
				setCustomer("");
				setEquipment([]);
				setSpecs([]);
			}
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "max-w-2xl",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "New install" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-4 space-y-3",
				onSubmit: async (e) => {
					e.preventDefault();
					if (!customer.trim()) return;
					setPending(true);
					try {
						const packed = serializeMachines(specs.length ? specs : mergeMachineSpecs(equipment, specs));
						const row = await createInstall({ data: {
							customer: customer.trim(),
							equipment: packed.equipment ?? void 0,
							serial: packed.serial ?? void 0,
							powerVoltage: packed.powerVoltage ?? void 0,
							machines: packed.machines
						} });
						qc.invalidateQueries({ queryKey: ["installs"] });
						qc.invalidateQueries({ queryKey: ["customers"] });
						toast.success("Install added");
						onOpenChange(false);
						onCreated(row.id);
					} catch (err) {
						toast.error(err instanceof Error ? err.message : "Failed");
					} finally {
						setPending(false);
					}
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-3 sm:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerCombo, {
							value: customer,
							onChange: setCustomer,
							required: true
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EquipmentMultiCombo, {
							values: equipment,
							onChange: (next) => {
								setEquipment(next);
								setSpecs(mergeMachineSpecs(next, specs));
							},
							placeholder: "Search the full equipment list…"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "-mt-1 text-xs text-muted-foreground",
						children: "Open the equipment field to scroll the full list, or type a model and add it if it isn’t there."
					}),
					customer && specs.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MachineFields, {
						specs,
						onChange: setSpecs
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex justify-end",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							disabled: pending || !customer.trim(),
							children: "Create"
						})
					})
				]
			})]
		})
	});
}
function useRemoveEquip(install, catalog) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (label) => {
			const packed = serializeMachines(mergeMachineSpecs(listedEquipment(dropEquipment(install.equipment, label, catalog), catalog), install.machines ?? []));
			return updateInstall({ data: {
				id: install.id,
				equipment: packed.equipment,
				serial: packed.serial,
				powerVoltage: packed.powerVoltage,
				machines: packed.machines
			} });
		},
		onMutate: async (label) => {
			await qc.cancelQueries({ queryKey: ["installs"] });
			const prev = qc.getQueryData(["installs"]);
			const packed = serializeMachines(mergeMachineSpecs(listedEquipment(dropEquipment(install.equipment, label, catalog), catalog), install.machines ?? []));
			qc.setQueryData(["installs"], (old) => (old ?? []).map((r) => r.id === install.id ? {
				...r,
				equipment: packed.equipment,
				serial: packed.serial,
				powerVoltage: packed.powerVoltage,
				machines: packed.machines ? JSON.parse(packed.machines) : []
			} : r));
			return { prev };
		},
		onError: (e, _label, ctx) => {
			if (ctx?.prev) qc.setQueryData(["installs"], ctx.prev);
			toast.error(e instanceof Error ? e.message : "Could not remove");
		},
		onSettled: () => {
			qc.invalidateQueries({ queryKey: ["installs"] });
		}
	});
}
function InstallRow({ install: i, catalog, recipes, onOpen, onRecipe }) {
	const pieces = piecesForInstall(i.equipment, i.customer, i.id, catalog, recipes);
	const remove = useRemoveEquip(i, catalog);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "border-b border-border px-4 py-3 last:border-b-0",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-1 gap-1 md:grid-cols-[5rem_minmax(0,1fr)_7rem_8rem] md:items-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: onOpen,
						className: "text-left tabular text-sm font-medium hover:underline",
						children: i.daysOut == null ? "needs date" : i.daysOut < 0 ? `${i.daysOut}d` : i.daysOut === 0 ? "today" : `${i.daysOut}d`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: onOpen,
						className: "min-w-0 truncate text-left font-medium hover:underline",
						children: i.customer
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlagBadge, { flag: i.flag }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: i.equipStatus })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: onOpen,
						className: "text-left text-sm text-muted-foreground hover:text-foreground",
						children: [
							formatShortDate(i.installDate),
							" · ",
							i.technician ?? "—"
						]
					})
				]
			}),
			machineNotes(i),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-2 flex flex-wrap gap-1.5 md:pl-20",
				children: pieces.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-xs text-muted-foreground",
					children: i.equipment || "No equipment listed"
				}) : pieces.map((p, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecipeChip, {
					piece: p,
					customer: i.customer,
					installId: i.id,
					recipes,
					onOpen: onRecipe,
					onRemove: () => remove.mutate(p.label)
				}, `${p.model}-${p.label}-${idx}`))
			})
		]
	});
}
function InstallCard({ install: i, catalog, recipes, onOpen, onRecipe }) {
	const pieces = piecesForInstall(i.equipment, i.customer, i.id, catalog, recipes);
	const remove = useRemoveEquip(i, catalog);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg border border-border bg-background px-3 py-2.5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: onOpen,
				className: "w-full text-left hover:underline",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-medium",
					children: i.customer
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-0.5 text-xs text-muted-foreground",
					children: formatShortDate(i.installDate)
				})]
			}),
			machineNotes(i, false),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-1",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlagBadge, { flag: i.flag })
			}),
			pieces.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-2 flex flex-wrap gap-1.5",
				children: pieces.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecipeChip, {
					piece: p,
					customer: i.customer,
					installId: i.id,
					recipes,
					onOpen: onRecipe,
					onRemove: () => remove.mutate(p.label)
				}, `${p.model}-${p.label}`))
			}) : i.equipment ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-muted-foreground",
				children: i.equipment
			}) : null
		]
	});
}
function machineNotes(i, indent = true) {
	const rows = (i.machines ?? []).filter((m) => m.serial || m.powerVoltage);
	if (!rows.length && (i.serial || i.powerVoltage)) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: `mt-1 text-xs text-muted-foreground ${indent ? "md:pl-20" : ""}`,
		children: [i.serial ? `SN ${i.serial}` : null, i.powerVoltage].filter(Boolean).join(" · ")
	});
	if (!rows.length) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: `mt-1 space-y-0.5 text-xs text-muted-foreground ${indent ? "md:pl-20" : ""}`,
		children: rows.map((m, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-medium text-foreground/80",
				children: m.equipment
			}),
			m.serial ? ` · SN ${m.serial}` : "",
			m.powerVoltage ? ` · ${m.powerVoltage}` : ""
		] }, `${m.equipment}-${idx}`))
	});
}
//#endregion
//#region src/components/desk/asset-sheet.tsx
function AssetSheet({ asset, onClose }) {
	const qc = useQueryClient();
	const installs = useQuery({
		queryKey: ["installs"],
		queryFn: () => listInstalls(),
		enabled: !!asset
	});
	const [soldTo, setSoldTo] = (0, import_react.useState)("");
	const [model, setModel] = (0, import_react.useState)(asset?.model ?? "");
	const [owned, setOwned] = (0, import_react.useState)(asset?.customerOwned ?? "");
	const [retSite, setRetSite] = (0, import_react.useState)("barn-back");
	const [retPallet, setRetPallet] = (0, import_react.useState)("H");
	const [retLevel, setRetLevel] = (0, import_react.useState)(1);
	const [installId, setInstallId] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		setModel(asset?.model ?? "");
		setOwned(asset?.customerOwned ?? "");
		setSoldTo(asset?.soldTo ?? "");
	}, [asset?.id]);
	const save = useMutation({
		mutationFn: (d) => updateAsset({ data: d }),
		onSuccess: () => {
			toast.success("Saved");
			qc.invalidateQueries({ queryKey: ["assets"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		}
	});
	const ret = useMutation({
		mutationFn: () => returnAssetToWarehouse({ data: {
			id: asset.id,
			site: retSite,
			pallet: retPallet,
			level: retLevel
		} }),
		onSuccess: () => {
			toast.success("Back on the rack");
			qc.invalidateQueries({ queryKey: ["assets"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["installs"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not return")
	});
	const sold = useMutation({
		mutationFn: () => markAssetSold({ data: {
			id: asset.id,
			soldTo
		} }),
		onSuccess: () => {
			toast.success("Marked sold");
			qc.invalidateQueries({ queryKey: ["assets"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not sell")
	});
	const assign = useMutation({
		mutationFn: () => assignAssetToInstall({ data: {
			assetId: asset.id,
			installId: Number(installId)
		} }),
		onSuccess: () => {
			toast.success("Pulled for install — off the warehouse board");
			qc.invalidateQueries({ queryKey: ["assets"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["installs"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not assign")
	});
	const queue = (installs.data ?? []).filter((i) => !i.complete && i.equipStatus !== "Installed");
	const pallets = retSite === "barn-front" ? FRONT_PALLETS : BACK_PALLETS;
	const bay = asset ? bayFor(asset.site, asset.pallet) : "general";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
		open: !!asset,
		onOpenChange: (o) => !o && onClose(),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetContent, { children: asset ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs tracking-wide text-muted-foreground uppercase",
					children: [asset.slotLabel, asset.customerOwned ? ` · owned by ${asset.customerOwned}` : ""]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, { children: asset.model }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-2 flex flex-wrap gap-1.5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: statusLabel(asset.status) }),
						bay === "catering" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "Catering" }) : null,
						bay === "dispenser" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "Dispenser" }) : null,
						asset.missingSerial ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "Serial missing" }) : null
					]
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "grid gap-3 border-b border-border p-5 sm:grid-cols-2",
				onSubmit: (e) => {
					e.preventDefault();
					const fd = new FormData(e.currentTarget);
					save.mutate({
						id: asset.id,
						model,
						serial: String(fd.get("serial") || "") || null,
						qty: Number(fd.get("qty") || 1),
						customerOwned: owned || null,
						purpose: String(fd.get("purpose") || "") || null,
						notes: String(fd.get("notes") || "") || null
					});
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "sm:col-span-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EquipmentCombo, {
							name: "model",
							label: "Model",
							value: model,
							onChange: setModel,
							required: true
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "serial",
						children: "Serial"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "serial",
						name: "serial",
						className: "mt-1",
						defaultValue: asset.serial ?? ""
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "qty",
						children: "Qty"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "qty",
						name: "qty",
						type: "number",
						min: 1,
						className: "mt-1",
						defaultValue: String(asset.qty)
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "sm:col-span-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerCombo, {
							name: "customerOwned",
							label: "Customer-owned (if any)",
							value: owned,
							onChange: setOwned,
							placeholder: "Search customers…"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "purpose",
						children: "Purpose"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "purpose",
						name: "purpose",
						className: "mt-1",
						defaultValue: asset.purpose ?? ""
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "notes",
							children: "Notes"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							id: "notes",
							name: "notes",
							className: "mt-1",
							defaultValue: asset.notes ?? ""
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex justify-end sm:col-span-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							size: "sm",
							disabled: save.isPending,
							children: "Save"
						})
					})
				]
			}, asset.id),
			asset.status === "ready" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-3 border-b border-border p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs tracking-wide text-muted-foreground uppercase",
						children: "Pull for an install"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-2 sm:flex-row",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
							className: "flex-1",
							value: installId,
							onChange: (e) => setInstallId(e.target.value),
							allowEmpty: true,
							emptyLabel: "Choose account",
							children: queue.map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
								value: i.id,
								children: [
									i.customer,
									" · ",
									i.equipment ?? "no model"
								]
							}, i.id))
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							disabled: !installId || assign.isPending,
							onClick: () => assign.mutate(),
							children: "Assign & remove from barn"
						})]
					}),
					!asset.customerOwned ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-2 sm:flex-row sm:items-end",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex-1",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerCombo, {
								label: "",
								value: soldTo,
								onChange: setSoldTo,
								placeholder: "Sold to…"
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "outline",
							disabled: !soldTo.trim() || sold.isPending,
							onClick: () => sold.mutate(),
							children: "Mark sold"
						})]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-warning",
						children: "Customer-owned — return, don’t sell."
					})
				]
			}) : asset.status !== "sold" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-3 border-b border-border p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs tracking-wide text-muted-foreground uppercase",
						children: "Return to barn"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted-foreground",
						children: asset.status === "assigned" ? `Out on ${asset.soldTo ?? "an install"}. Put it back on a slot to free the account.` : `Currently at ${SITE_LABEL[asset.site] ?? asset.site}.`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-3 gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
								value: retSite,
								onChange: (e) => {
									const s = e.target.value;
									setRetSite(s);
									setRetPallet(s === "barn-front" ? "J" : "H");
								},
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "barn-back",
									children: "Back rack"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "barn-front",
									children: "Front rack"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
								value: retPallet,
								onChange: (e) => setRetPallet(e.target.value),
								children: pallets.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: p }, p))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
								value: String(retLevel),
								onChange: (e) => setRetLevel(Number(e.target.value)),
								children: LEVELS.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
									value: l,
									children: ["L", l]
								}, l))
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							onClick: () => ret.mutate(),
							disabled: ret.isPending,
							children: "Return to warehouse"
						}), !asset.customerOwned ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "outline",
							disabled: !soldTo.trim() || sold.isPending,
							onClick: () => sold.mutate(),
							children: "Mark sold"
						}) : null]
					}),
					!asset.customerOwned ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						placeholder: "Sold to…",
						value: soldTo,
						onChange: (e) => setSoldTo(e.target.value)
					}) : null
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "border-b border-border px-5 py-4 text-sm text-muted-foreground",
				children: [
					"Sold to ",
					asset.soldTo ?? "—",
					" ",
					asset.soldAt ? `on ${asset.soldAt}` : "",
					"."
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Thread, {
				entityType: "asset",
				entityId: asset.id
			})
		] }) : null })
	});
}
function statusLabel(s) {
	if (s === "ready") return "Ready";
	if (s === "deployed") return "In use";
	if (s === "assigned") return "On an install";
	if (s === "sold") return "Sold";
	return s;
}
//#endregion
//#region src/routes/_app/locations.tsx
var Route$8 = createFileRoute("/_app/locations")({
	validateSearch: parseOpenSearch,
	component: Page$7
});
function Page$7() {
	const { open } = Route$8.useSearch();
	const qc = useQueryClient();
	const data = useQuery({
		queryKey: ["assets"],
		queryFn: () => listAssets()
	});
	const [tab, setTab] = (0, import_react.useState)("deployed");
	const [q, setQ] = (0, import_react.useState)("");
	const [selected, setSelected] = useOpenRecord(open);
	const [create, setCreate] = (0, import_react.useState)(false);
	const [sort, setSort] = useDeskSort("locations", "alpha-asc");
	const all = data.data ?? [];
	const needle = q.trim().toLowerCase();
	const groups = (0, import_react.useMemo)(() => {
		const match = (a) => {
			if (!needle) return true;
			return [
				a.model,
				a.serial,
				a.purpose,
				a.soldTo,
				SITE_LABEL[a.site]
			].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle));
		};
		const sortRows = (rows) => sortDesk(rows, sort, {
			name: (a) => a.model,
			equipment: (a) => a.qty ?? 1,
			status: (a) => a.status,
			date: (a) => a.soldAt ?? a.updatedAt
		});
		if (tab === "sold") return [{
			site: "sold",
			rows: sortRows(all.filter((a) => a.status === "sold" && match(a)))
		}];
		if (tab === "field") return [{
			site: "field",
			rows: sortRows(all.filter((a) => a.status === "assigned" && match(a)))
		}];
		return LOCATION_SITES.map((site) => ({
			site,
			rows: sortRows(all.filter((a) => a.site === site && a.status === "deployed" && match(a)))
		}));
	}, [
		all,
		tab,
		needle,
		sort
	]);
	const selectedRow = all.find((a) => a.id === selected) ?? null;
	const deployedCount = all.filter((a) => a.status === "deployed").length;
	const fieldCount = all.filter((a) => a.status === "assigned").length;
	const soldCount = all.filter((a) => a.status === "sold").length;
	const bySite = LOCATION_SITES.map((site) => ({
		name: SITE_LABEL[site] ?? site,
		count: all.filter((a) => a.status === "deployed" && a.site === site).length
	}));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-medium tracking-tight",
				children: "Equipment by location"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-xl text-sm text-muted-foreground",
				children: "Units not on the barn racks — lobby, service room, training, SATX, and anything currently pulled for an install. Return a unit to free the slot for the next job."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				onClick: () => setCreate(true),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "Log at a location"]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 grid grid-cols-3 gap-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "On site",
					value: deployedCount
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "On an install",
					value: fieldCount
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Sold",
					value: soldCount
				})
			]
		}),
		bySite.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
			className: "mt-5",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartCard, {
				title: "Deployed by location",
				lede: "Units sitting at HQ rooms and SATX — not the barn racks.",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleBars, {
					data: bySite.map((s) => ({
						site: s.name,
						count: s.count
					})),
					xKey: "site",
					yKey: "count",
					yLabel: "Units",
					horizontal: true
				})
			})
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 flex flex-wrap gap-2",
			children: [
				[
					["deployed", `On site (${deployedCount})`],
					["field", `On an install (${fieldCount})`],
					["sold", `Sold (${soldCount})`]
				].map(([id, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setTab(id),
					className: cn("h-9 rounded-full px-3 text-sm font-medium", tab === id ? "bg-ink text-ink-foreground" : "bg-secondary"),
					children: label
				}, id)),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: q,
					onChange: (e) => setQ(e.target.value),
					placeholder: "Filter…",
					className: "max-w-xs"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
					value: sort,
					onChange: setSort,
					options: [
						...SORT_ALPHA,
						...SORT_DATE,
						...SORT_EQUIP,
						...SORT_STATUS
					]
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-5 space-y-6",
			children: groups.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-2 flex items-baseline justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-xl",
					children: SITE_LABEL[g.site] ?? g.site
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs text-muted-foreground",
					children: [g.rows.reduce((n, a) => n + a.qty, 0), " units"]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "overflow-hidden rounded-xl border border-border bg-card",
				children: [g.rows.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => setSelected(a.id),
					className: "grid w-full gap-1 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/60 md:grid-cols-[1.4fr_1fr_8rem] md:items-center",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium",
							children: a.model
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "mt-0.5 block text-xs text-muted-foreground",
							children: [a.serial ?? "No serial", a.qty > 1 ? ` · qty ${a.qty}` : ""]
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-sm text-muted-foreground",
							children: [a.purpose ?? a.soldTo ?? "—", a.soldAt ? ` · ${a.soldAt}` : ""]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: a.status === "sold" ? "Sold" : a.status === "assigned" ? "On an install" : "In use" })
					]
				}, a.id)), g.rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "px-4 py-6 text-sm text-muted-foreground",
					children: "Nothing logged here."
				}) : null]
			})] }, g.site))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AssetSheet, {
			asset: selectedRow,
			onClose: () => setSelected(null)
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
			open: create,
			onOpenChange: setCreate,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Log equipment at a location" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-4 space-y-3",
				onSubmit: async (e) => {
					e.preventDefault();
					const fd = new FormData(e.currentTarget);
					try {
						const row = await createAsset({ data: {
							model: String(fd.get("model")),
							serial: String(fd.get("serial") || "") || null,
							site: String(fd.get("site")),
							purpose: String(fd.get("purpose") || "") || SITE_PURPOSE[String(fd.get("site"))] || null
						} });
						qc.invalidateQueries({ queryKey: ["assets"] });
						toast.success("Logged");
						setCreate(false);
						setSelected(row.id);
					} catch (err) {
						toast.error(err instanceof Error ? err.message : "Failed");
					}
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Location" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "site",
						className: "mt-1",
						defaultValue: "front-lobby",
						children: LOCATION_SITES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: s,
							children: SITE_LABEL[s]
						}, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Model" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						name: "model",
						className: "mt-1",
						required: true
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Serial" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						name: "serial",
						className: "mt-1"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Purpose" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						name: "purpose",
						className: "mt-1",
						placeholder: "Showroom, training, loaner…"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex justify-end",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							children: "Add"
						})
					})
				]
			})] })
		})
	] });
}
//#endregion
//#region src/routes/_app/modules.tsx
var Route$7 = createFileRoute("/_app/modules")({
	validateSearch: parseOpenSearch,
	component: Page$6
});
function Page$6() {
	const { open } = Route$7.useSearch();
	const qc = useQueryClient();
	const data = useQuery({
		queryKey: ["modules"],
		queryFn: () => listModules()
	});
	const [q, setQ] = (0, import_react.useState)("");
	const [selected, setSelected] = useOpenRecord(open);
	const [create, setCreate] = (0, import_react.useState)(false);
	const [sort, setSort] = useDeskSort("modules", "status");
	const all = data.data ?? [];
	const readyRows = all.filter((m) => m.status === "Ready");
	const notReady = all.filter((m) => m.status !== "Ready" && m.status !== "Installed at Account" && m.status !== "Retired / Scrapped");
	const readyByTypeAll = MODULE_TYPES.map((type) => ({
		name: type,
		count: readyRows.filter((m) => m.moduleType === type).length
	}));
	const extraTypes = tally(readyRows, (m) => m.moduleType).filter((r) => !MODULE_TYPES.includes(r.name));
	const readyByTypeChart = [...readyByTypeAll, ...extraTypes];
	const readyByType = readyByTypeChart.filter((r) => r.count > 0);
	const readyByPlatform = tally(readyRows, (m) => m.platform);
	const statusMix = tally(all, (m) => m.status);
	const rows = (0, import_react.useMemo)(() => {
		const needle = q.trim().toLowerCase();
		let list = all;
		if (needle) list = list.filter((m) => [
			m.moduleId,
			m.location,
			m.moduleType,
			m.status,
			m.wo
		].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle)));
		return sortDesk(list, sort, {
			date: (m) => m.dateReady ?? m.dateIn ?? m.updatedAt,
			name: (m) => m.moduleId,
			equipment: (m) => equipmentCount(m.moduleType),
			status: (m) => m.status,
			tech: (m) => m.technician
		});
	}, [
		all,
		q,
		sort
	]);
	const selectedRow = all.find((m) => m.id === selected) ?? null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-medium tracking-tight",
				children: "Eversys modules"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-xl text-sm text-muted-foreground",
				children: "One row per physical module. The Ready count splits by type so you can see what can actually ship."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				onClick: () => setCreate(true),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "New module"]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 grid gap-3 md:grid-cols-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Tracked",
					value: all.length,
					hint: "Every module on the board"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Ready",
					value: readyRows.length,
					hint: readyByPlatform.map((p) => `${p.count} ${p.name}`).join(" · ") || "Nothing ready",
					breakdown: readyByType
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "In shop",
					value: notReady.length,
					hint: "Not ready, not installed, not retired"
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-5 grid gap-4 lg:grid-cols-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartCard, {
				title: "By status",
				lede: "Where the shop floor actually sits.",
				children: statusMix.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusDonut, {
					data: statusMix,
					unit: "modules"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "No modules yet."
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartCard, {
				title: "Ready by type",
				lede: "The Ready bubble, unpacked.",
				children: readyRows.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleBars, {
					data: readyByTypeChart.map((r) => ({
						type: r.name.replace(" Module", ""),
						count: r.count
					})),
					xKey: "type",
					yKey: "count",
					yLabel: "Ready",
					horizontal: true
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "Nothing marked Ready."
				})
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 flex flex-wrap items-center gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				value: q,
				onChange: (e) => setQ(e.target.value),
				placeholder: "Filter modules…",
				className: "max-w-xs"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
				value: sort,
				onChange: setSort,
				options: [
					...SORT_STATUS,
					...SORT_ALPHA,
					...SORT_DATE,
					...SORT_EQUIP,
					...SORT_TECH
				]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-3 overflow-hidden rounded-xl border border-border bg-card",
			children: [rows.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => setSelected(m.id),
				className: "grid w-full gap-1 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/60 md:grid-cols-[8rem_1fr_8rem_8rem] md:items-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-mono text-xs",
						children: m.moduleId
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-medium",
						children: m.moduleType
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "mt-0.5 block text-xs text-muted-foreground",
						children: [
							m.platform,
							" · ",
							m.location ?? "—"
						]
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: m.status }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-sm text-muted-foreground",
						children: m.technician ?? "—"
					})
				]
			}, m.id)), rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-4 py-8 text-sm text-muted-foreground",
				children: "No modules in this view."
			}) : null]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModuleSheet, {
			row: selectedRow,
			onClose: () => setSelected(null)
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleCreateDialog, {
			title: "New module",
			open: create,
			onOpenChange: setCreate,
			fields: [{
				name: "moduleId",
				label: "Module ID",
				required: true
			}],
			onSubmit: async (v) => {
				const row = await createModule({ data: { moduleId: v.moduleId } });
				qc.invalidateQueries({ queryKey: ["modules"] });
				toast.success("Module added");
				setSelected(row.id);
			}
		})
	] });
}
//#endregion
//#region src/routes/_app/pipeline.tsx
var Route$6 = createFileRoute("/_app/pipeline")({
	validateSearch: parseOpenSearch,
	component: Page$5
});
function sum(rows) {
	return rows.reduce((n, d) => n + (d.amount ?? 0), 0);
}
function sizeBucket(amount) {
	if (amount == null || amount === 0) return "No amount";
	if (amount < 5e3) return "Under $5k";
	if (amount < 15e3) return "$5–15k";
	if (amount < 4e4) return "$15–40k";
	return "$40k+";
}
function completionLabel(d) {
	if (d.completion === "complete") return "Complete";
	if (d.completion === "fell") return "Fell through";
	return "Open";
}
function Page$5() {
	const { open } = Route$6.useSearch();
	const qc = useQueryClient();
	const data = useQuery({
		queryKey: ["deals"],
		queryFn: () => listDeals()
	});
	const [q, setQ] = (0, import_react.useState)("");
	const [view, setView] = (0, import_react.useState)("open");
	const [selected, setSelected] = useOpenRecord(open);
	const [create, setCreate] = (0, import_react.useState)(false);
	const [sort, setSort] = useDeskSort("pipeline", "value-desc");
	const all = data.data ?? [];
	const live = all.filter((d) => d.completion !== "fell");
	const active = live.filter((d) => d.completion !== "complete");
	const completed = live.filter((d) => d.completion === "complete");
	const fell = all.filter((d) => d.completion === "fell");
	const listed = new Set(PRODUCERS);
	const unlisted = live.filter((d) => !d.producer || !listed.has(d.producer));
	const producerChart = PRODUCERS.map((p) => {
		const mine = live.filter((d) => d.producer === p);
		return {
			producer: p,
			open: Math.round(sum(mine.filter((d) => d.completion !== "complete"))),
			done: Math.round(sum(mine.filter((d) => d.completion === "complete")))
		};
	}).filter((p) => p.open + p.done > 0);
	const funnel = [
		{
			stage: "Open",
			count: active.length
		},
		{
			stage: "Good to order",
			count: active.filter((d) => d.goodToOrder).length
		},
		{
			stage: "Ordered",
			count: active.filter((d) => d.ordered).length
		},
		{
			stage: "Complete",
			count: completed.length
		}
	];
	const sizeChart = [
		"No amount",
		"Under $5k",
		"$5–15k",
		"$15–40k",
		"$40k+"
	].map((size) => ({
		size,
		count: live.filter((d) => sizeBucket(d.amount) === size).length
	}));
	const rows = (0, import_react.useMemo)(() => {
		let list = all;
		if (view === "open") list = list.filter((d) => d.completion !== "complete" && d.completion !== "fell");
		if (view === "complete") list = list.filter((d) => d.completion === "complete");
		const needle = q.trim().toLowerCase();
		if (needle) list = list.filter((d) => [
			d.customer,
			d.producer,
			d.equipment,
			d.invoice,
			d.terms
		].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle)));
		return sortDesk(list, sort, {
			date: (d) => d.dateOfDeal ?? d.updatedAt,
			name: (d) => d.customer,
			equipment: (d) => equipmentCount(d.equipment),
			value: (d) => d.amount,
			status: (d) => completionLabel(d)
		});
	}, [
		all,
		q,
		view,
		sort
	]);
	const selectedRow = all.find((d) => d.id === selected) ?? null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-medium tracking-tight",
				children: "Sales pipeline"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-xl text-sm text-muted-foreground",
				children: "One row per equipment deal. Charts show who is carrying the book and how far deals have moved."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				onClick: () => setCreate(true),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "New deal"]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Active deals",
					value: active.length
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Active pipeline",
					value: money(sum(active))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Completed",
					value: completed.length,
					hint: money(sum(completed))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Total booked",
					value: money(sum(live))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Good to order",
					value: active.filter((d) => d.goodToOrder).length,
					hint: "Open deals cleared to order"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Fell through",
					value: fell.length,
					tone: fell.length ? "danger" : void 0
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartCard, {
					title: "By producer",
					lede: "Open dollars stacked under completed. Fell-through deals are left out.",
					children: producerChart.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StackedMoneyBars, {
						data: producerChart,
						xKey: "producer",
						openKey: "open",
						doneKey: "done"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted-foreground",
						children: "No live deals yet."
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartCard, {
					title: "How deals move",
					lede: "Same open book, four gates. A deal can sit in more than one bar.",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleBars, {
						data: funnel,
						xKey: "stage",
						yKey: "count",
						yLabel: "Deals",
						horizontal: true
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartCard, {
					title: "Deal size",
					lede: "Live book by amount, so a few large jobs don’t hide the rest.",
					children: sizeChart.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleBars, {
						data: sizeChart,
						xKey: "size",
						yKey: "count",
						yLabel: "Deals",
						horizontal: true
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted-foreground",
						children: "No live deals yet."
					})
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-6 overflow-hidden rounded-xl border border-border bg-card",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "border-b border-border px-4 py-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-xl",
					children: "By producer"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground",
					children: "Fell-through deals are excluded, matching the old dashboard."
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "overflow-x-auto px-4 py-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full min-w-[36rem] text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
						className: "text-left text-xs tracking-wide text-muted-foreground uppercase",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "pb-2 pr-4 font-medium",
								children: "Producer"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "pb-2 pr-4 font-medium",
								children: "Deals"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "pb-2 pr-4 font-medium",
								children: "Total"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "pb-2 pr-4 font-medium",
								children: "Completed"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "pb-2 font-medium",
								children: "Open $"
							})
						] })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [
						PRODUCERS.map((p) => {
							const mine = live.filter((d) => d.producer === p);
							const c = mine.filter((d) => d.completion === "complete");
							const o = mine.filter((d) => d.completion !== "complete");
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: "border-t border-border",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-2 pr-4",
										children: p
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "tabular py-2 pr-4",
										children: mine.length
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "tabular py-2 pr-4",
										children: money(sum(mine))
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
										className: "tabular py-2 pr-4",
										children: [
											c.length,
											" · ",
											money(sum(c))
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "tabular py-2",
										children: money(sum(o))
									})
								]
							}, p);
						}),
						unlisted.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-t border-border text-muted-foreground",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 pr-4",
									children: "(No producer / not on list)"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "tabular py-2 pr-4",
									children: unlisted.length
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "tabular py-2 pr-4",
									children: money(sum(unlisted))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									className: "tabular py-2 pr-4",
									children: [
										unlisted.filter((d) => d.completion === "complete").length,
										" ·",
										" ",
										money(sum(unlisted.filter((d) => d.completion === "complete")))
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "tabular py-2",
									children: money(sum(unlisted.filter((d) => d.completion !== "complete")))
								})
							]
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-t border-border font-medium",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 pr-4",
									children: "TOTAL"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "tabular py-2 pr-4",
									children: live.length
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "tabular py-2 pr-4",
									children: money(sum(live))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									className: "tabular py-2 pr-4",
									children: [
										completed.length,
										" · ",
										money(sum(completed))
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "tabular py-2",
									children: money(sum(active))
								})
							]
						})
					] })]
				})
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-6 flex flex-wrap gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => setView("open"),
					className: `h-9 rounded-full px-3 text-sm font-medium ${view === "open" ? "bg-ink text-ink-foreground" : "bg-secondary"}`,
					children: [
						"Open (",
						active.length,
						")"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => setView("complete"),
					className: `h-9 rounded-full px-3 text-sm font-medium ${view === "complete" ? "bg-ink text-ink-foreground" : "bg-secondary"}`,
					children: [
						"Complete (",
						completed.length,
						")"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setView("all"),
					className: `h-9 rounded-full px-3 text-sm font-medium ${view === "all" ? "bg-ink text-ink-foreground" : "bg-secondary"}`,
					children: "All deals"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: q,
					onChange: (e) => setQ(e.target.value),
					placeholder: "Filter…",
					className: "max-w-xs"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
					value: sort,
					onChange: setSort,
					options: SORT_DEALS
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 overflow-hidden rounded-xl border border-border bg-card",
			children: [rows.map((d) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => setSelected(d.id),
				className: "grid w-full gap-1 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/60 md:grid-cols-[1.4fr_7rem_7rem_8rem] md:items-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-medium",
						children: d.customer
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "mt-0.5 block text-xs text-muted-foreground",
						children: [
							d.producer ?? "Unassigned",
							" · ",
							d.equipment || "No equipment listed"
						]
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "tabular text-sm font-medium",
						children: money(d.amount)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: completionLabel(d) }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-xs text-muted-foreground",
						children: [d.goodToOrder ? "Good to order" : "Needs approval", d.ordered ? " · Ordered" : ""]
					})
				]
			}, d.id)), rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-4 py-8 text-sm text-muted-foreground",
				children: "No deals in this view."
			}) : null]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DealSheet, {
			deal: selectedRow,
			onClose: () => setSelected(null)
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleCreateDialog, {
			title: "New deal",
			open: create,
			onOpenChange: setCreate,
			fields: [
				{
					name: "customer",
					label: "Customer",
					required: true,
					kind: "customer"
				},
				{
					name: "producer",
					label: "Producer"
				},
				{
					name: "equipment",
					label: "Equipment",
					kind: "equipment"
				},
				{
					name: "amount",
					label: "Deal amount ($)"
				}
			],
			onSubmit: async (v) => {
				const amountRaw = v.amount?.replace(/[$,]/g, "").trim();
				const amountNum = amountRaw ? Number(amountRaw) : void 0;
				const row = await createDeal({ data: {
					customer: v.customer,
					producer: v.producer || void 0,
					equipment: v.equipment || void 0,
					amount: amountNum != null && Number.isFinite(amountNum) ? amountNum : void 0
				} });
				qc.invalidateQueries({ queryKey: ["deals"] });
				qc.invalidateQueries({ queryKey: ["dashboard"] });
				toast.success("Deal added");
				setSelected(row.id);
			}
		})
	] });
}
//#endregion
//#region src/routes/_app/pms.tsx
var Route$5 = createFileRoute("/_app/pms")({
	validateSearch: parseOpenSearch,
	component: Page$4
});
function Page$4() {
	const { open } = Route$5.useSearch();
	const qc = useQueryClient();
	const pms = useQuery({
		queryKey: ["pms"],
		queryFn: () => listPms()
	});
	const [q, setQ] = (0, import_react.useState)("");
	const [view, setView] = (0, import_react.useState)("active");
	const [selected, setSelected] = useOpenRecord(open);
	const [create, setCreate] = (0, import_react.useState)(false);
	const [sort, setSort] = useDeskSort("pms", "date-asc");
	const rows = (0, import_react.useMemo)(() => {
		let list = pms.data ?? [];
		if (view === "active") list = list.filter((p) => !CLOSED_PM.has(p.status) && !p.done);
		const needle = q.trim().toLowerCase();
		if (needle) list = list.filter((p) => [
			p.customer,
			p.equipment,
			p.style,
			p.technician
		].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle)));
		return sortDesk(list, sort, {
			date: (p) => p.projected ?? p.received,
			name: (p) => p.customer,
			equipment: (p) => equipmentCount(p.equipment),
			status: (p) => p.status,
			flagRank: (p) => p.flag?.rank ?? 99,
			tech: (p) => p.technician
		});
	}, [
		pms.data,
		q,
		view,
		sort
	]);
	const selectedRow = (pms.data ?? []).find((p) => p.id === selected) ?? null;
	const all = pms.data ?? [];
	const active = all.filter((p) => !CLOSED_PM.has(p.status) && !p.done);
	const flagged = all.filter((p) => p.flag);
	const statusMix = tally(active, (p) => p.status);
	const styleMix = tally(active, (p) => p.style);
	const needDate = active.filter((p) => !p.projected).length;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-medium tracking-tight",
				children: "Preventative maintenance"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-xl text-sm text-muted-foreground",
				children: "Projected dates go amber inside 14 days and red once they slip. Need-a-date PMs sit at the top."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				onClick: () => setCreate(true),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "New PM"]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 grid gap-3 md:grid-cols-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Active",
					value: active.length,
					hint: `${all.length} in history`
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Flagged",
					value: flagged.length,
					tone: flagged.length ? "warn" : void 0,
					hint: "Inside 14 days or slipped"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Need a date",
					value: needDate,
					tone: needDate ? "warn" : void 0,
					hint: "Active PMs with no projected date"
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-5 grid gap-4 lg:grid-cols-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartCard, {
				title: "Active by status",
				children: statusMix.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusDonut, {
					data: statusMix,
					unit: "active"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "No active PMs."
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartCard, {
				title: "By style",
				lede: "How the remaining book is split.",
				children: styleMix.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleBars, {
					data: styleMix.map((s) => ({
						label: s.name,
						count: s.count
					})),
					xKey: "label",
					yKey: "count",
					yLabel: "PMs",
					horizontal: true
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "No styles on active PMs."
				})
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 flex flex-wrap gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setView("active"),
					className: `h-9 rounded-full px-3 text-sm font-medium ${view === "active" ? "bg-ink text-ink-foreground" : "bg-secondary"}`,
					children: "Active"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setView("all"),
					className: `h-9 rounded-full px-3 text-sm font-medium ${view === "all" ? "bg-ink text-ink-foreground" : "bg-secondary"}`,
					children: "All"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: q,
					onChange: (e) => setQ(e.target.value),
					placeholder: "Filter…",
					className: "max-w-xs"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
					value: sort,
					onChange: setSort,
					options: SORT_LIST
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 overflow-hidden rounded-xl border border-border bg-card",
			children: [rows.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => setSelected(p.id),
				className: "grid w-full gap-1 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/60 md:grid-cols-[1.3fr_1fr_8rem_8rem_7rem] md:items-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-medium",
						children: p.customer
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mt-0.5 block text-xs text-muted-foreground",
						children: p.equipment
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "flex flex-wrap gap-1",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlagBadge, { flag: p.flag })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: p.status }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "tabular text-sm text-muted-foreground",
						children: formatShortDate(p.projected)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-sm",
						children: p.technician ?? "—"
					})
				]
			}, p.id)), rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-4 py-8 text-sm text-muted-foreground",
				children: "No PMs in this view."
			}) : null]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PmSheet, {
			pm: selectedRow,
			onClose: () => setSelected(null)
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleCreateDialog, {
			title: "New PM",
			open: create,
			onOpenChange: setCreate,
			fields: [{
				name: "customer",
				label: "Customer",
				required: true,
				kind: "customer"
			}, {
				name: "equipment",
				label: "Equipment",
				kind: "equipment"
			}],
			onSubmit: async (v) => {
				const row = await createPm({ data: {
					customer: v.customer,
					equipment: v.equipment
				} });
				qc.invalidateQueries({ queryKey: ["pms"] });
				toast.success("PM added");
				setSelected(row.id);
			}
		})
	] });
}
//#endregion
//#region src/routes/_app/recipes.tsx
var Route$4 = createFileRoute("/_app/recipes")({
	validateSearch: parseOpenSearch,
	component: Page$3
});
function Page$3() {
	const { open } = Route$4.useSearch();
	const qc = useQueryClient();
	const recs = useQuery({
		queryKey: ["recipes"],
		queryFn: () => listRecipes()
	});
	const directoryEquip = useQuery({
		queryKey: ["directory", "equipment"],
		queryFn: () => listDirectory({ data: { kind: "equipment" } })
	});
	const customers = useQuery({
		queryKey: ["customers"],
		queryFn: () => listCustomers()
	});
	const [selected, setSelected] = (0, import_react.useState)(open ?? null);
	(0, import_react.useEffect)(() => {
		if (open != null) setSelected(open);
	}, [open]);
	const [filter, setFilter] = (0, import_react.useState)("");
	const [sort, setSort] = useDeskSort("recipes", "alpha-asc");
	const rows = recs.data ?? [];
	const needle = filter.trim().toLowerCase();
	const shown = (0, import_react.useMemo)(() => {
		return sortDesk(needle ? rows.filter((r) => [
			r.equipmentModel,
			r.customer ?? "house",
			r.notes ?? ""
		].some((v) => v.toLowerCase().includes(needle))) : rows, sort, {
			date: (r) => r.updatedAt,
			name: (r) => r.customer ?? r.equipmentModel,
			equipment: (r) => r.equipmentModel
		});
	}, [
		rows,
		needle,
		sort
	]);
	const current = typeof selected === "number" ? rows.find((r) => r.id === selected) ?? null : null;
	const models = (0, import_react.useMemo)(() => catalogModels([...(directoryEquip.data ?? []).map((e) => e.name), ...rows.map((r) => r.equipmentModel)]), [directoryEquip.data, rows]);
	const grouped = (0, import_react.useMemo)(() => groupRecipes(shown), [shown]);
	const save = useMutation({
		mutationFn: (d) => upsertRecipe({ data: d }),
		onSuccess: (row) => {
			toast.success(row.customer ? `Saved for ${row.customer}` : "House recipe saved");
			qc.invalidateQueries({ queryKey: ["recipes"] });
			qc.invalidateQueries({ queryKey: ["customers"] });
			setSelected(row.id);
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Failed")
	});
	const copy = useMutation({
		mutationFn: (d) => copyRecipe({ data: d }),
		onSuccess: (row) => {
			toast.success(`Copied onto ${row.customer}`);
			qc.invalidateQueries({ queryKey: ["recipes"] });
			qc.invalidateQueries({ queryKey: ["customers"] });
			setSelected(row.id);
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Failed")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
		className: "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "font-display text-3xl font-medium tracking-tight",
			children: "Recipes"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 max-w-xl text-sm text-muted-foreground",
			children: "Settings live on a customer + machine. House templates can be edited and assigned to a customer. Fields start blank — nothing is filled in automatically."
		})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
			onClick: () => setSelected("new"),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "New recipe"]
		})]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-6 grid gap-6 lg:grid-cols-[20rem_1fr]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
			className: cn("rounded-xl border border-border bg-card", selected != null && "hidden lg:block"),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "border-b border-border p-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: filter,
					onChange: (e) => setFilter(e.target.value),
					placeholder: "Filter customers or models…"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-2",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
						value: sort,
						onChange: setSort,
						options: [
							...SORT_ALPHA,
							...SORT_DATE,
							...SORT_EQUIP
						],
						className: "w-full max-w-none sm:w-full"
					})
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
				className: "max-h-[60vh] overflow-y-auto",
				children: [
					grouped.house.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "px-4 pt-3 pb-1 text-[11px] tracking-wide text-muted-foreground uppercase",
						children: "House templates"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: grouped.house.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecipeNavItem, {
						recipe: r,
						active: current?.id === r.id,
						onClick: () => setSelected(r.id)
					}, r.id)) })] }) : null,
					grouped.customers.map(([name, list]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "px-4 pt-3 pb-1 text-[11px] tracking-wide text-muted-foreground uppercase",
						children: name
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: list.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecipeNavItem, {
						recipe: r,
						active: current?.id === r.id,
						onClick: () => setSelected(r.id),
						hideCustomer: true
					}, r.id)) })] }, name)),
					shown.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "px-4 py-6 text-sm text-muted-foreground",
						children: "No recipes yet."
					}) : null
				]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: cn("rounded-xl border border-border bg-card p-5", selected == null && "hidden lg:block"),
			children: [selected != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "mb-4 text-sm text-muted-foreground hover:text-foreground lg:hidden",
				onClick: () => setSelected(null),
				children: "← All recipes"
			}) : null, selected == null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: "Select a customer recipe, a house template, or add a new one. New cards start empty — pick the fields you need. House templates can be edited and assigned to a customer from here."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecipeForm, {
				draft: {
					recipe: current,
					customer: current?.customer ?? null,
					equipmentModel: current?.equipmentModel ?? "",
					installId: current?.installId ?? null,
					copiedFrom: current?.copiedFrom ?? null
				},
				models,
				customers: customers.data ?? [],
				pending: save.isPending,
				copyPending: copy.isPending,
				onSave: (d) => save.mutate(d),
				onCopy: (d) => copy.mutate(d)
			}, current?.id ?? "new")]
		})]
	})] });
}
function RecipeNavItem({ recipe: r, active, onClick, hideCustomer }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick,
		className: cn("w-full px-4 py-2.5 text-left text-sm hover:bg-muted/60", active && "bg-muted"),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "block font-medium",
			children: r.equipmentModel
		}), hideCustomer ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "block text-xs text-muted-foreground",
			children: r.customer ?? "Shared house recipe"
		})]
	}) });
}
function groupRecipes(rows) {
	const house = rows.filter((r) => !r.customer);
	const byCust = /* @__PURE__ */ new Map();
	for (const r of rows) {
		if (!r.customer) continue;
		const list = byCust.get(r.customer) ?? [];
		list.push(r);
		byCust.set(r.customer, list);
	}
	return {
		house,
		customers: [...byCust.entries()].sort((a, b) => a[0].localeCompare(b[0]))
	};
}
//#endregion
//#region src/components/desk/job-sheet.tsx
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
//#endregion
//#region src/components/desk/jobs-page.tsx
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
//#region src/routes/_app/service.tsx
var Route$3 = createFileRoute("/_app/service")({
	validateSearch: parseOpenSearch,
	component: Page$2
});
function Page$2() {
	const { open } = Route$3.useSearch();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(JobsPage, {
		kind: "service",
		title: "Service tracker",
		lede: "Field calls on a 48-hour clock. Active work stays on top; completed history is one toggle away.",
		initialOpen: open
	});
}
//#endregion
//#region src/routes/_app/tlc.tsx
var Route$2 = createFileRoute("/_app/tlc")({
	validateSearch: parseOpenSearch,
	component: Page$1
});
function Page$1() {
	const { open } = Route$2.useSearch();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(JobsPage, {
		kind: "tlc",
		title: "TLC + Factor",
		lede: "Contract TLC and Factor visits. Anything still open past two weeks is flagged automatically.",
		initialOpen: open
	});
}
//#endregion
//#region src/routes/_app/warehouse.tsx
var Route$1 = createFileRoute("/_app/warehouse")({
	validateSearch: parseOpenSearch,
	component: Page
});
function Page() {
	const { open } = Route$1.useSearch();
	const qc = useQueryClient();
	const data = useQuery({
		queryKey: ["assets"],
		queryFn: () => listAssets()
	});
	const [rack, setRack] = (0, import_react.useState)("barn-back");
	const [q, setQ] = (0, import_react.useState)("");
	const [slot, setSlot] = (0, import_react.useState)(null);
	const [selected, setSelected] = useOpenRecord(open);
	const [create, setCreate] = (0, import_react.useState)(false);
	const [sort, setSort] = useDeskSort("warehouse", "alpha-asc");
	const all = data.data ?? [];
	const barn = (0, import_react.useMemo)(() => all.filter((a) => a.status === "ready" && (a.site === "barn-back" || a.site === "barn-front")), [all]);
	const onRack = barn.filter((a) => a.site === rack);
	const pallets = rack === "barn-front" ? FRONT_PALLETS : BACK_PALLETS;
	const fill = (0, import_react.useMemo)(() => {
		const map = /* @__PURE__ */ new Map();
		for (const a of onRack) {
			if (!a.pallet || !a.level) continue;
			const k = `${a.pallet}-${a.level}`;
			map.set(k, (map.get(k) ?? 0) + 1);
		}
		return map;
	}, [onRack]);
	const slotUnits = (0, import_react.useMemo)(() => {
		if (!slot) return [];
		return onRack.filter((a) => a.pallet === slot.pallet && a.level === slot.level).sort((a, b) => (a.lineNo ?? 99) - (b.lineNo ?? 99));
	}, [onRack, slot]);
	const needle = q.trim().toLowerCase();
	const list = (0, import_react.useMemo)(() => {
		let rows = slot ? slotUnits : onRack.filter((a) => a.kind === "equip" || a.kind === "dispenser");
		if (needle) rows = barn.filter((a) => [
			a.model,
			a.serial,
			a.slotLabel,
			a.customerOwned
		].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle)));
		return sortDesk(rows, sort, {
			name: (a) => a.model,
			equipment: (a) => a.qty ?? 1,
			status: (a) => a.status,
			date: (a) => a.updatedAt
		});
	}, [
		slot,
		slotUnits,
		onRack,
		barn,
		needle,
		sort
	]);
	const equipReady = barn.filter((a) => a.kind === "equip").reduce((n, a) => n + a.qty, 0);
	const equipLines = barn.filter((a) => a.kind === "equip").length;
	const dispQty = barn.filter((a) => a.kind === "dispenser").reduce((n, a) => n + a.qty, 0);
	const missing = barn.filter((a) => a.missingSerial).length;
	const owned = barn.filter((a) => a.customerOwned).length;
	const models = new Set(barn.filter((a) => a.kind === "equip").map((a) => a.model)).size;
	const catering = barn.filter((a) => a.bay === "catering" && a.kind === "equip").length;
	const selectedRow = all.find((a) => a.id === selected) ?? null;
	const capacity = rack === "barn-front" ? 384 : 672;
	const readyByModel = (0, import_react.useMemo)(() => {
		const map = /* @__PURE__ */ new Map();
		for (const a of barn) {
			if (a.kind !== "equip") continue;
			map.set(a.model, (map.get(a.model) ?? 0) + a.qty);
		}
		return [...map.entries()].map(([name, count]) => ({
			name,
			count
		})).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
	}, [barn]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-medium tracking-tight",
				children: "Barn warehouse"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-xl text-sm text-muted-foreground",
				children: "Ready-to-deploy units at HQ. Slot ID is pallet + level — B-L3 is pallet B, third shelf. Pull a unit onto an install and it leaves this board."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				onClick: () => setCreate(true),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "Add to rack"]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Ready",
					value: equipReady,
					hint: `${models} models · ${Math.max(0, BARN_EQUIP_CAPACITY - equipLines)} open slots`,
					breakdown: readyByModel
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Fill",
					value: `${Math.round(equipLines / BARN_EQUIP_CAPACITY * 100)}%`,
					hint: `${equipLines} lines on the rack`
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Dispensers",
					value: dispQty,
					hint: "Not counted in Ready"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Missing serial",
					value: missing,
					tone: missing ? "warn" : void 0,
					hint: `${owned} customer-owned · ${catering} catering`
				})
			]
		}),
		readyByModel.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
			className: "mt-5",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartCard, {
				title: "Ready by model",
				lede: "The Ready bubble, unpacked — qty on the rack, not line count.",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleBars, {
					data: readyByModel.slice(0, 10).map((r) => ({
						model: r.name,
						count: r.count
					})),
					xKey: "model",
					yKey: "count",
					yLabel: "Qty",
					horizontal: true
				})
			})
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 flex flex-wrap gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => {
						setRack("barn-back");
						setSlot(null);
					},
					className: cn("h-9 rounded-full px-3 text-sm font-medium", rack === "barn-back" ? "bg-ink text-ink-foreground" : "bg-secondary"),
					children: "Back rack"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => {
						setRack("barn-front");
						setSlot(null);
					},
					className: cn("h-9 rounded-full px-3 text-sm font-medium", rack === "barn-front" ? "bg-ink text-ink-foreground" : "bg-secondary"),
					children: "Front rack"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: q,
					onChange: (e) => setQ(e.target.value),
					placeholder: "Find model or serial…",
					className: "max-w-xs"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
					value: sort,
					onChange: setSort,
					options: [
						...SORT_ALPHA,
						...SORT_DATE,
						...SORT_EQUIP,
						...SORT_STATUS
					]
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mr-1 inline-block size-2 rounded-sm bg-catering" }), "Catering B–E"] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mr-1 inline-block size-2 rounded-sm bg-dispense" }), "Dispenser F–G"] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
					"Number in a cell is lines used of 12. Capacity this rack: ",
					capacity,
					"."
				] })
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-3 w-full max-w-full overflow-x-auto rounded-xl border border-border bg-card p-3",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
				className: "w-full min-w-[40rem] border-collapse text-center",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
					className: "pb-2 pr-2 text-left text-[11px] font-medium tracking-wide text-muted-foreground uppercase",
					children: "Level"
				}), pallets.map((p) => {
					const bay = bayFor(rack, p);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: cn("px-0.5 pb-2 text-[11px] font-medium", bay === "catering" && "text-catering", bay === "dispenser" && "text-dispense"),
						children: p
					}, p);
				})] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: LEVELS.map((level) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", {
					className: "py-1 pr-2 text-left text-xs font-medium text-muted-foreground",
					children: [
						"L",
						level,
						level === 4 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ml-1 font-normal",
							children: "top"
						}) : null,
						level === 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ml-1 font-normal",
							children: "floor"
						}) : null
					]
				}), pallets.map((p) => {
					const n = fill.get(`${p}-${level}`) ?? 0;
					const bay = bayFor(rack, p);
					const active = slot?.pallet === p && slot.level === level && slot.rack === rack;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "p-0.5",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setSlot(active ? null : {
								rack,
								pallet: p,
								level
							}),
							className: cn("flex h-9 w-full min-w-8 items-center justify-center rounded-sm text-xs tabular transition-colors", n === 0 && "bg-muted text-muted-foreground", n > 0 && n < 12 && "bg-primary/15 text-foreground", n >= 12 && "bg-primary text-primary-foreground", bay === "catering" && n === 0 && "bg-catering/15", bay === "dispenser" && n === 0 && "bg-dispense/15", active && "ring-2 ring-ring"),
							"aria-label": `${p}-L${level} ${n} of 12`,
							children: n
						})
					}, p);
				})] }, level)) })]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 flex items-baseline justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-xl",
				children: needle ? "Search" : slot ? slotId(slot.pallet, slot.level) : rack === "barn-back" ? "Back rack units" : "Front rack units"
			}), slot ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "text-xs text-muted-foreground hover:text-foreground",
				onClick: () => setSlot(null),
				children: "Clear slot"
			}) : null]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-3 overflow-hidden rounded-xl border border-border bg-card",
			children: [list.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => setSelected(a.id),
				className: "grid w-full gap-1 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/60 md:grid-cols-[7rem_1.4fr_8rem_7rem] md:items-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-mono text-xs",
						children: a.slotLabel
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-medium",
						children: a.model
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "mt-0.5 block text-xs text-muted-foreground",
						children: [
							a.serial ?? "No serial",
							a.qty > 1 ? ` · qty ${a.qty}` : "",
							a.customerOwned ? ` · ${a.customerOwned}` : ""
						]
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "flex flex-wrap gap-1",
						children: [
							a.missingSerial ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "Serial missing" }) : null,
							a.customerOwned ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "Customer-owned" }) : null,
							a.kind === "dispenser" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "Accessory" }) : null
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-sm text-muted-foreground",
						children: a.kind === "dispenser" ? `${a.qty} pcs` : "1 unit"
					})
				]
			}, a.id)), list.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-4 py-8 text-sm text-muted-foreground",
				children: slot ? "Empty slot — add a unit here." : "Nothing on this rack matches."
			}) : null]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AssetSheet, {
			asset: selectedRow,
			onClose: () => setSelected(null)
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AddDialog, {
			open: create,
			onOpenChange: setCreate,
			rack,
			slot,
			onCreated: async (row) => {
				qc.invalidateQueries({ queryKey: ["assets"] });
				qc.invalidateQueries({ queryKey: ["dashboard"] });
				toast.success("On the rack");
				setSelected(row.id);
			}
		})
	] });
}
function AddDialog({ open, onOpenChange, rack, slot, onCreated }) {
	const pallets = (slot?.rack ?? rack) === "barn-front" ? FRONT_PALLETS : BACK_PALLETS;
	const [pending, setPending] = (0, import_react.useState)(false);
	const [model, setModel] = (0, import_react.useState)("");
	const [owned, setOwned] = (0, import_react.useState)("");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange: (v) => {
			onOpenChange(v);
			if (!v) {
				setModel("");
				setOwned("");
			}
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Add to the barn" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "mt-4 space-y-3",
			onSubmit: async (e) => {
				e.preventDefault();
				const fd = new FormData(e.currentTarget);
				const site = String(fd.get("site"));
				const pallet = String(fd.get("pallet"));
				const level = Number(fd.get("level"));
				const qtyRaw = String(fd.get("qty") || "1");
				setPending(true);
				try {
					await onCreated(await createAsset({ data: {
						kind: String(fd.get("kind")) === "dispenser" ? "dispenser" : "equip",
						model,
						serial: String(fd.get("serial") || "") || null,
						qty: Number.isFinite(Number(qtyRaw)) ? Number(qtyRaw) : 1,
						customerOwned: owned || null,
						site,
						pallet,
						level
					} }));
					onOpenChange(false);
				} catch (err) {
					toast.error(err instanceof Error ? err.message : "Failed");
				} finally {
					setPending(false);
				}
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EquipmentCombo, {
					name: "model",
					label: "Model",
					value: model,
					onChange: setModel,
					required: true,
					placeholder: "Search equipment…"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-2 gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Serial" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						name: "serial",
						className: "mt-1"
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Qty" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						name: "qty",
						type: "number",
						min: 1,
						defaultValue: "1",
						className: "mt-1"
					})] })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Kind" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
					name: "kind",
					className: "mt-1",
					defaultValue: "equip",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "equip",
						children: "Equipment"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "dispenser",
						children: "Dispenser / accessory"
					})]
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-3 gap-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Rack" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
							name: "site",
							className: "mt-1",
							defaultValue: slot?.rack ?? rack,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "barn-back",
								children: "Back"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "barn-front",
								children: "Front"
							})]
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Pallet" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
							name: "pallet",
							className: "mt-1",
							defaultValue: slot?.pallet ?? pallets[0],
							children: pallets.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: p }, p))
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Level" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
							name: "level",
							className: "mt-1",
							defaultValue: String(slot?.level ?? 1),
							children: LEVELS.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
								value: l,
								children: ["L", l]
							}, l))
						})] })
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerCombo, {
					name: "customerOwned",
					label: "Customer-owned (optional)",
					value: owned,
					onChange: setOwned,
					placeholder: "Search customers…"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground",
					children: "Puts the unit on the next open line of that slot (1–12)."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex justify-end",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						disabled: pending,
						children: "Add"
					})
				})
			]
		})] })
	});
}
//#endregion
//#region src/routes/api/auth/$.ts
var Route = createFileRoute("/api/auth/$")({ server: { handlers: {
	GET: ({ request }) => auth.handler(request),
	POST: ({ request }) => auth.handler(request)
} } });
//#endregion
//#region src/routeTree.gen.ts
var AppRoute = Route$14.update({
	id: "/_app",
	getParentRoute: () => Route$15
});
var LoginRoute = Route$13.update({
	id: "/login",
	path: "/login",
	getParentRoute: () => Route$15
});
var AppIndexRoute = Route$12.update({
	id: "/",
	path: "/",
	getParentRoute: () => AppRoute
});
var AppAccessRoute = Route$11.update({
	id: "/access",
	path: "/access",
	getParentRoute: () => AppRoute
});
var AppHandoffRoute = Route$10.update({
	id: "/handoff",
	path: "/handoff",
	getParentRoute: () => AppRoute
});
var AppInstallsRoute = Route$9.update({
	id: "/installs",
	path: "/installs",
	getParentRoute: () => AppRoute
});
var AppLocationsRoute = Route$8.update({
	id: "/locations",
	path: "/locations",
	getParentRoute: () => AppRoute
});
var AppModulesRoute = Route$7.update({
	id: "/modules",
	path: "/modules",
	getParentRoute: () => AppRoute
});
var AppPipelineRoute = Route$6.update({
	id: "/pipeline",
	path: "/pipeline",
	getParentRoute: () => AppRoute
});
var AppPmsRoute = Route$5.update({
	id: "/pms",
	path: "/pms",
	getParentRoute: () => AppRoute
});
var AppRecipesRoute = Route$4.update({
	id: "/recipes",
	path: "/recipes",
	getParentRoute: () => AppRoute
});
var AppServiceRoute = Route$3.update({
	id: "/service",
	path: "/service",
	getParentRoute: () => AppRoute
});
var AppTlcRoute = Route$2.update({
	id: "/tlc",
	path: "/tlc",
	getParentRoute: () => AppRoute
});
var AppWarehouseRoute = Route$1.update({
	id: "/warehouse",
	path: "/warehouse",
	getParentRoute: () => AppRoute
});
var ApiAuthSplatRoute = Route.update({
	id: "/api/auth/$",
	path: "/api/auth/$",
	getParentRoute: () => Route$15
});
var AppRouteChildren = {
	AppAccessRoute,
	AppHandoffRoute,
	AppInstallsRoute,
	AppLocationsRoute,
	AppModulesRoute,
	AppPipelineRoute,
	AppPmsRoute,
	AppRecipesRoute,
	AppServiceRoute,
	AppTlcRoute,
	AppWarehouseRoute,
	AppIndexRoute
};
var rootRouteChildren = {
	AppRoute: AppRoute._addFileChildren(AppRouteChildren),
	LoginRoute,
	ApiAuthSplatRoute
};
var routeTree = Route$15._addFileChildren(rootRouteChildren)._addFileTypes();
//#endregion
//#region src/router.tsx
function getRouter() {
	return createRouter({
		routeTree,
		defaultErrorComponent: AppErrorComponent
	});
}
//#endregion
export { getRouter };
