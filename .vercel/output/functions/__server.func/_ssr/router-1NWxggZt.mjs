import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { _ as createRootRoute, g as createFileRoute, h as lazyRouteComponent, l as Scripts, m as Outlet, p as createRouter, u as HeadContent, x as useRouter } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { r as createServerFn, s as __exportAll } from "./ssr.mjs";
import { _ as namesMatchUser } from "./lookups-BkjR5sto.mjs";
import { F as object, M as literal, P as number, R as string, z as union } from "../_libs/@better-auth/core+[...].mjs";
import { t as authClient } from "./client-sGid3STf.mjs";
import { n as auth } from "./server-CvZF0iR0.mjs";
import { o as getMyAccess, r as createSsrRpc } from "./access-3Tz151bB.mjs";
import { A as List, j as LayoutGrid, l as TriangleAlert, v as Rows3 } from "../_libs/lucide-react.mjs";
import { t as QueryClient } from "../_libs/tanstack__query-core.mjs";
import { n as useQuery, r as QueryClientProvider } from "../_libs/tanstack__react-query.mjs";
import { n as clsx } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { t as Toaster } from "../_libs/sonner.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/prefs-njskks8s.js
var PREFS_KEY = "katz-desk-prefs";
var PREFS_EVENT = "katz-desk-prefs";
var LAST_PATH_KEY = "katz-desk-last";
var RESUMED_KEY = "katz-desk-resumed";
var DEFAULT_PREFS = {
	appearance: "system",
	text: "default",
	density: "comfortable",
	contrast: "standard",
	motion: "full",
	resumeLast: false
};
function readPrefs() {
	if (typeof window === "undefined") return DEFAULT_PREFS;
	try {
		const raw = window.localStorage.getItem(PREFS_KEY);
		if (!raw) return DEFAULT_PREFS;
		const parsed = JSON.parse(raw);
		return {
			appearance: parsed.appearance === "light" || parsed.appearance === "dark" ? parsed.appearance : "system",
			text: parsed.text === "large" ? "large" : "default",
			density: parsed.density === "compact" ? "compact" : "comfortable",
			contrast: parsed.contrast === "high" ? "high" : "standard",
			motion: parsed.motion === "reduced" ? "reduced" : "full",
			resumeLast: parsed.resumeLast === true
		};
	} catch {
		return DEFAULT_PREFS;
	}
}
function writePrefs(patch) {
	const next = {
		...readPrefs(),
		...patch
	};
	window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
	window.dispatchEvent(new Event(PREFS_EVENT));
	return next;
}
function resolvedDark(appearance) {
	if (appearance === "dark") return true;
	if (appearance === "light") return false;
	return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}
function applyPrefs(prefs) {
	if (typeof document === "undefined") return;
	const dark = resolvedDark(prefs.appearance);
	const h = document.documentElement;
	h.classList.toggle("dark", dark);
	h.dataset.appearance = prefs.appearance;
	h.dataset.text = prefs.text;
	h.dataset.density = prefs.density;
	h.dataset.contrast = prefs.contrast;
	h.dataset.motion = prefs.motion;
	h.style.colorScheme = dark ? "dark" : "light";
	const meta = document.querySelector("meta[name=\"theme-color\"]");
	if (meta) meta.setAttribute("content", dark ? "#120F0C" : "#1A1612");
}
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/search-params-DzFQBykv.js
var import_react = /* @__PURE__ */ __toESM(require_react());
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
//#region node_modules/.nitro/vite/services/ssr/assets/router-1NWxggZt.js
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
var Ctx = (0, import_react.createContext)({
	prefs: DEFAULT_PREFS,
	update: () => void 0
});
function PrefsProvider({ children }) {
	const [prefs, setPrefs] = (0, import_react.useState)(DEFAULT_PREFS);
	(0, import_react.useEffect)(() => {
		const next = readPrefs();
		setPrefs(next);
		applyPrefs(next);
		function sync() {
			const p = readPrefs();
			setPrefs(p);
			applyPrefs(p);
		}
		window.addEventListener(PREFS_EVENT, sync);
		window.addEventListener("storage", sync);
		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		mq.addEventListener("change", sync);
		return () => {
			window.removeEventListener(PREFS_EVENT, sync);
			window.removeEventListener("storage", sync);
			mq.removeEventListener("change", sync);
		};
	}, []);
	const update = (0, import_react.useCallback)((patch) => {
		const next = writePrefs(patch);
		applyPrefs(next);
		setPrefs(next);
	}, []);
	const value = (0, import_react.useMemo)(() => ({
		prefs,
		update
	}), [prefs, update]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ctx.Provider, {
		value,
		children
	});
}
function usePrefs() {
	return (0, import_react.useContext)(Ctx);
}
var MY_VIEW_KEY = "katz-desk-my-view";
var MY_VIEW_EVENT = "katz-desk-my-view";
var DEFAULT_MY_VIEW = {
	on: true,
	layout: "list"
};
function readMyView() {
	if (typeof window === "undefined") return DEFAULT_MY_VIEW;
	try {
		const raw = window.localStorage.getItem(MY_VIEW_KEY);
		if (!raw) return DEFAULT_MY_VIEW;
		const parsed = JSON.parse(raw);
		const layout = parsed.layout === "board" || parsed.layout === "compact" || parsed.layout === "list" ? parsed.layout : "list";
		return {
			on: parsed.on !== false,
			layout
		};
	} catch {
		return DEFAULT_MY_VIEW;
	}
}
function writeMyView(patch) {
	const next = {
		...readMyView(),
		...patch
	};
	window.localStorage.setItem(MY_VIEW_KEY, JSON.stringify(next));
	window.dispatchEvent(new Event(MY_VIEW_EVENT));
	return next;
}
function defaultLayoutFor(role) {
	if (role === "service") return "board";
	return "list";
}
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
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
var MyViewCtx = (0, import_react.createContext)({
	role: null,
	on: true,
	layout: "list",
	setOn: () => void 0,
	setLayout: () => void 0,
	matchMine: () => false,
	filterMine: false,
	compact: false,
	board: false
});
function MyViewProvider({ children }) {
	const user = useCurrentUser();
	const access = useQuery({
		queryKey: ["access", "me"],
		queryFn: () => getMyAccess(),
		enabled: !!user
	});
	const [prefs, setPrefs] = (0, import_react.useState)(readMyView);
	const role = access.data?.role ?? null;
	(0, import_react.useEffect)(() => {
		function sync() {
			setPrefs(readMyView());
		}
		window.addEventListener(MY_VIEW_EVENT, sync);
		window.addEventListener("storage", sync);
		return () => {
			window.removeEventListener(MY_VIEW_EVENT, sync);
			window.removeEventListener("storage", sync);
		};
	}, []);
	(0, import_react.useEffect)(() => {
		if (typeof window === "undefined") return;
		if (window.localStorage.getItem("katz-desk-my-view-init")) return;
		if (!role) return;
		window.localStorage.setItem("katz-desk-my-view-init", "1");
		setPrefs(writeMyView({
			on: true,
			layout: defaultLayoutFor(role)
		}));
	}, [role]);
	const setOn = (0, import_react.useCallback)((on) => setPrefs(writeMyView({ on })), []);
	const setLayout = (0, import_react.useCallback)((layout) => {
		setPrefs(writeMyView({ layout }));
		if (layout === "compact" && readPrefs().density !== "compact") writePrefs({ density: "compact" });
		if (layout !== "compact" && readPrefs().density === "compact") writePrefs({ density: "comfortable" });
	}, []);
	const matchUser = (0, import_react.useMemo)(() => ({
		displayName: user?.displayName ?? null,
		primaryEmail: user?.primaryEmail ?? null,
		username: access.data?.username ?? null
	}), [user, access.data?.username]);
	const matchMine = (0, import_react.useCallback)((...names) => namesMatchUser(matchUser, ...names), [matchUser]);
	const value = (0, import_react.useMemo)(() => ({
		role,
		on: prefs.on,
		layout: prefs.layout,
		setOn,
		setLayout,
		matchMine,
		filterMine: prefs.on && !!role,
		compact: prefs.layout === "compact",
		board: prefs.layout === "board"
	}), [
		role,
		prefs,
		setOn,
		setLayout,
		matchMine
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MyViewCtx.Provider, {
		value,
		children
	});
}
function useMyView() {
	return (0, import_react.useContext)(MyViewCtx);
}
function MyViewBar({ className }) {
	const { role, on, layout, setOn, setLayout } = useMyView();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("flex flex-wrap items-center gap-2", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			"aria-pressed": on,
			onClick: () => setOn(!on),
			className: cn("h-9 rounded-full px-3 text-sm font-medium", on ? "bg-ink text-ink-foreground" : "bg-secondary text-foreground"),
			children: ["My View", role ? ` · ${role === "sales" ? "Sales" : "Service"}` : ""]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex overflow-hidden rounded-full border border-border",
			children: [
				{
					id: "list",
					label: "List",
					icon: List
				},
				{
					id: "board",
					label: "Board",
					icon: LayoutGrid
				},
				{
					id: "compact",
					label: "Compact",
					icon: Rows3
				}
			].map((opt) => {
				const Icon = opt.icon;
				const active = layout === opt.id;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					"aria-pressed": active,
					title: opt.label,
					onClick: () => setLayout(opt.id),
					className: cn("inline-flex h-9 items-center gap-1.5 px-2.5 text-xs font-medium", active ? "bg-ink text-ink-foreground" : "bg-card text-muted-foreground hover:text-foreground"),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "hidden sm:inline",
						children: opt.label
					})]
				}, opt.id);
			})
		})]
	});
}
function Providers({ children }) {
	const [client] = (0, import_react.useState)(() => new QueryClient({ defaultOptions: { queries: {
		staleTime: 8e3,
		retry: 1,
		refetchOnWindowFocus: false
	} } }));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryClientProvider, {
		client,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrefsProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(MyViewProvider, { children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThemedToaster, {})] }) })
	}) });
}
function ThemedToaster() {
	const { prefs } = usePrefs();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster, {
		position: "bottom-right",
		richColors: true,
		theme: resolvedDark(prefs.appearance) ? "dark" : "light"
	});
}
var styles_default = "/assets/styles-EBnmQ8fa.css";
var APP_NAME = "Katz Desk";
var fetchSessionUser = createServerFn({ method: "GET" }).handler(createSsrRpc("2c4985e96c199268f7f639534cb5e8e31d6b19d43286bf77416413db60ffde26"));
/** Same guard the injector uses for og:image — only emit on a public app host. */
function publicShareHost() {
	const host = String("").trim().split(",")[0]?.trim().split(":")[0]?.toLowerCase() ?? "";
	if (!host || !/^[a-z0-9.-]+$/.test(host) || !host.includes(".")) return "";
	if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return "";
	if (host === "vercel.app" || host.endsWith(".vercel.app") || host === "vercel.com" || host.endsWith(".vercel.com")) return "";
	return host;
}
var Route$20 = createRootRoute({
	beforeLoad: async () => ({ sessionUser: await fetchSessionUser() }),
	head: () => {
		const host = publicShareHost();
		const ogImage = host ? `https://${host}/og.jpg` : "";
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
				...ogImage ? [{
					property: "og:image",
					content: ogImage
				}] : [],
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
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("head", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("script", { dangerouslySetInnerHTML: { __html: `(function(){try{var p=JSON.parse(localStorage.getItem("katz-desk-prefs")||"{}");var a=p.appearance||"system";var dark=a==="dark"||(a!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var h=document.documentElement;h.classList.toggle("dark",dark);h.dataset.appearance=a;h.dataset.text=p.text==="large"?"large":"default";h.dataset.density=p.density==="compact"?"compact":"comfortable";h.dataset.contrast=p.contrast==="high"?"high":"standard";h.dataset.motion=p.motion==="reduced"?"reduced":"full";h.style.colorScheme=dark?"dark":"light";}catch(e){}})();` } })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewHostBridge, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Providers, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})
		] })]
	})
});
var $$splitComponentImporter$18 = () => import("../_app-BrqJEDqL.mjs").then((n) => n.t);
var Route$19 = createFileRoute("/_app")({ component: lazyRouteComponent($$splitComponentImporter$18, "component") });
var $$splitComponentImporter$17 = () => import("./login-C2rTWF4J.mjs");
var Route$18 = createFileRoute("/login")({ component: lazyRouteComponent($$splitComponentImporter$17, "component") });
var $$splitComponentImporter$16 = () => import("../_app-Bn7ep12X.mjs");
var Route$17 = createFileRoute("/_app/")({ component: lazyRouteComponent($$splitComponentImporter$16, "component") });
var $$splitComponentImporter$15 = () => import("./access-BLD8lC96.mjs");
var Route$16 = createFileRoute("/_app/access")({ component: lazyRouteComponent($$splitComponentImporter$15, "component") });
var $$splitComponentImporter$14 = () => import("./customers-DJqBHEY5.mjs");
var Route$15 = createFileRoute("/_app/customers")({
	validateSearch: parseOpenSearch,
	component: lazyRouteComponent($$splitComponentImporter$14, "component")
});
var $$splitComponentImporter$13 = () => import("./handoff-BMWIvJ8y.mjs");
var Route$14 = createFileRoute("/_app/handoff")({ component: lazyRouteComponent($$splitComponentImporter$13, "component") });
var $$splitComponentImporter$12 = () => import("./installs-MHCm0QTJ.mjs").then((n) => n.t);
var Route$13 = createFileRoute("/_app/installs")({
	validateSearch: parseOpenSearch,
	component: lazyRouteComponent($$splitComponentImporter$12, "component")
});
var $$splitComponentImporter$11 = () => import("./locations-DmTyClr0.mjs");
var Route$12 = createFileRoute("/_app/locations")({
	validateSearch: parseOpenSearch,
	component: lazyRouteComponent($$splitComponentImporter$11, "component")
});
var $$splitComponentImporter$10 = () => import("./modules-CGL_l6HW.mjs");
var Route$11 = createFileRoute("/_app/modules")({
	validateSearch: parseOpenSearch,
	component: lazyRouteComponent($$splitComponentImporter$10, "component")
});
var $$splitComponentImporter$9 = () => import("./network-CyYfzi0j.mjs");
var Route$10 = createFileRoute("/_app/network")({
	validateSearch: parseOpenSearch,
	component: lazyRouteComponent($$splitComponentImporter$9, "component")
});
var $$splitComponentImporter$8 = () => import("./pipeline-vANvooh1.mjs");
var Route$9 = createFileRoute("/_app/pipeline")({
	validateSearch: parseOpenSearch,
	component: lazyRouteComponent($$splitComponentImporter$8, "component")
});
var $$splitComponentImporter$7 = () => import("./planner-CGlkwCsR.mjs");
var Route$8 = createFileRoute("/_app/planner")({ component: lazyRouteComponent($$splitComponentImporter$7, "component") });
var $$splitComponentImporter$6 = () => import("./pms-BwIIUmHh.mjs");
var Route$7 = createFileRoute("/_app/pms")({
	validateSearch: parseOpenSearch,
	component: lazyRouteComponent($$splitComponentImporter$6, "component")
});
var $$splitComponentImporter$5 = () => import("./rebuilds-n4q2nq-p.mjs");
var Route$6 = createFileRoute("/_app/rebuilds")({
	validateSearch: parseOpenSearch,
	component: lazyRouteComponent($$splitComponentImporter$5, "component")
});
var $$splitComponentImporter$4 = () => import("./recipes-CZTJHnjW.mjs");
var Route$5 = createFileRoute("/_app/recipes")({
	validateSearch: parseOpenSearch,
	component: lazyRouteComponent($$splitComponentImporter$4, "component")
});
var $$splitComponentImporter$3 = () => import("./service-drg0MwBK.mjs");
var Route$4 = createFileRoute("/_app/service")({
	validateSearch: parseOpenSearch,
	component: lazyRouteComponent($$splitComponentImporter$3, "component")
});
var $$splitComponentImporter$2 = () => import("./settings-C78HyyvP.mjs").then((n) => n.t);
var Route$3 = createFileRoute("/_app/settings")({ component: lazyRouteComponent($$splitComponentImporter$2, "component") });
var $$splitComponentImporter$1 = () => import("./tlc-JzCX0I_q.mjs");
var Route$2 = createFileRoute("/_app/tlc")({
	validateSearch: parseOpenSearch,
	component: lazyRouteComponent($$splitComponentImporter$1, "component")
});
var $$splitComponentImporter = () => import("./warehouse-Cy9ML1Mg.mjs");
var Route$1 = createFileRoute("/_app/warehouse")({
	validateSearch: parseOpenSearch,
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
var Route = createFileRoute("/api/auth/$")({ server: { handlers: {
	GET: ({ request }) => auth.handler(request),
	POST: ({ request }) => auth.handler(request)
} } });
var AppRoute = Route$19.update({
	id: "/_app",
	getParentRoute: () => Route$20
});
var LoginRoute = Route$18.update({
	id: "/login",
	path: "/login",
	getParentRoute: () => Route$20
});
var AppIndexRoute = Route$17.update({
	id: "/",
	path: "/",
	getParentRoute: () => AppRoute
});
var AppAccessRoute = Route$16.update({
	id: "/access",
	path: "/access",
	getParentRoute: () => AppRoute
});
var AppCustomersRoute = Route$15.update({
	id: "/customers",
	path: "/customers",
	getParentRoute: () => AppRoute
});
var AppHandoffRoute = Route$14.update({
	id: "/handoff",
	path: "/handoff",
	getParentRoute: () => AppRoute
});
var AppInstallsRoute = Route$13.update({
	id: "/installs",
	path: "/installs",
	getParentRoute: () => AppRoute
});
var AppLocationsRoute = Route$12.update({
	id: "/locations",
	path: "/locations",
	getParentRoute: () => AppRoute
});
var AppModulesRoute = Route$11.update({
	id: "/modules",
	path: "/modules",
	getParentRoute: () => AppRoute
});
var AppNetworkRoute = Route$10.update({
	id: "/network",
	path: "/network",
	getParentRoute: () => AppRoute
});
var AppPipelineRoute = Route$9.update({
	id: "/pipeline",
	path: "/pipeline",
	getParentRoute: () => AppRoute
});
var AppPlannerRoute = Route$8.update({
	id: "/planner",
	path: "/planner",
	getParentRoute: () => AppRoute
});
var AppPmsRoute = Route$7.update({
	id: "/pms",
	path: "/pms",
	getParentRoute: () => AppRoute
});
var AppRebuildsRoute = Route$6.update({
	id: "/rebuilds",
	path: "/rebuilds",
	getParentRoute: () => AppRoute
});
var AppRecipesRoute = Route$5.update({
	id: "/recipes",
	path: "/recipes",
	getParentRoute: () => AppRoute
});
var AppServiceRoute = Route$4.update({
	id: "/service",
	path: "/service",
	getParentRoute: () => AppRoute
});
var AppSettingsRoute = Route$3.update({
	id: "/settings",
	path: "/settings",
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
	getParentRoute: () => Route$20
});
var AppRouteChildren = {
	AppAccessRoute,
	AppCustomersRoute,
	AppHandoffRoute,
	AppInstallsRoute,
	AppLocationsRoute,
	AppModulesRoute,
	AppNetworkRoute,
	AppPipelineRoute,
	AppPlannerRoute,
	AppPmsRoute,
	AppRebuildsRoute,
	AppRecipesRoute,
	AppServiceRoute,
	AppSettingsRoute,
	AppTlcRoute,
	AppWarehouseRoute,
	AppIndexRoute
};
var rootRouteChildren = {
	AppRoute: AppRoute._addFileChildren(AppRouteChildren),
	LoginRoute,
	ApiAuthSplatRoute
};
var routeTree = Route$20._addFileChildren(rootRouteChildren)._addFileTypes();
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
	return createRouter({
		routeTree,
		defaultErrorComponent: AppErrorComponent
	});
}
//#endregion
export { RESUMED_KEY as C, LAST_PATH_KEY as S, resolvedDark as T, cn as _, Route$5 as a, usePrefs as b, Route$9 as c, Route$12 as d, Route$13 as f, useMyView as g, MyViewBar as h, Route$4 as i, Route$10 as l, Route$19 as m, Route$1 as n, Route$6 as o, Route$15 as p, Route$2 as r, Route$7 as s, router_exports as t, Route$11 as u, useCurrentUser as v, readPrefs as w, useOpenRecord as x, useCurrentUserState as y };
