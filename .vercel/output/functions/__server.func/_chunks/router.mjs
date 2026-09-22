import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { _ as createRootRoute, b as useNavigate, d as useRouterState, g as createFileRoute, l as Scripts, m as Outlet, p as createRouter, u as HeadContent, v as Link, x as useRouter, y as Navigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { A as boolean, D as _enum, F as object, M as literal, P as number, R as string, k as array, z as union } from "../_libs/@better-auth/core+[...].mjs";
import { A as List, B as ChevronsUpDown, C as Package, D as Menu$1, E as MessageSquare, F as Globe, G as CalendarClock, H as ChevronLeft, I as Download, J as BellRing, K as BookOpen, L as Contrast, M as Keyboard, N as Handshake, O as MapPin, P as Hammer, R as Coffee, S as Pencil, T as Monitor, U as Check, V as ChevronRight, W as CalendarRange, _ as Search, a as Users, b as Plus, c as Truck, d as Table2, f as Sun, g as Settings2, h as SlidersHorizontal, i as Vibrate, j as LayoutGrid, k as Mail, l as TriangleAlert, m as Store, n as Wrench, o as Upload, p as StretchHorizontal, q as Bell, r as Warehouse, s as Type, t as X, u as Trash2, v as Rows3, w as Moon, x as Phone, y as Printer, z as Clock } from "../_libs/lucide-react.mjs";
import { t as QueryClient } from "../_libs/tanstack__query-core.mjs";
import { i as useQueryClient, n as useQuery, r as QueryClientProvider, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { n as toast, t as Toaster } from "../_libs/sonner.mjs";
import { a as DialogOverlay, b as Slot, i as DialogDescription$1, n as DialogClose, o as DialogPortal, r as DialogContent$1, s as DialogTitle$1, t as Dialog$1 } from "../_libs/@radix-ui/react-dialog+[...].mjs";
import { i as Trigger, n as Portal, r as Root2, t as Content2 } from "../_libs/@radix-ui/react-popover+[...].mjs";
import { a as Tooltip, i as ResponsiveContainer, n as Pie, r as Cell, t as PieChart } from "../_libs/recharts+[...].mjs";
import { n as utils, r as writeSync, t as readSync } from "../_libs/xlsx.mjs";
import { n as createServerFn } from "../_libs/@tanstack/start-client-core+[...].mjs";
import { i as signOut, r as signIn, t as authClient } from "./client.mjs";
import { i as GROK_PROVIDERS, r as getSql, t as auth } from "./popup.server.mjs";
import { _ as setAccountRole, a as getMyAccess, c as listDeskAccounts, d as peekInvite, f as registerAccount, g as setAccountCanAddCustomers, h as setAccountApproved, i as deskMiddleware, l as listDeskInvites, m as revokeInvite, n as createInvite, o as grantAllCanAddCustomers, p as requireAdmin, r as denyAccount, t as checkUsername, u as lookupSignIn } from "./access.mjs";
import { a as formatRep, i as canonicalRepName, n as PRODUCERS, o as isNoRep, r as PRODUCER_INITIALS, s as sameRep } from "./rep-match.mjs";
import { C as weekBounds, D as SHOP_ACCOUNT, E as REBUILD_STATUSES, O as WAITING_REASONS, S as todayChicago, T as REBUILD_PRIORITIES, _ as installFlag, a as loadRebuilds, b as pmFlag, c as sortRebuildsForExport, d as diffDays, f as formatLongDate, g as formatWeekLabel, h as formatShortDate, i as listRebuilds, k as priorityLabel, l as updateRebuild, m as formatPingTime, n as listRebuildLinks, o as pullRebuildSerial, p as formatNowChicago, r as listRebuildOwners, t as createRebuild, u as addDays, v as money, w as HEALTH_LABEL, x as serviceFlag, y as moneyExact } from "./rebuilds.mjs";
import { C as URGENCIES, S as TECHNICIANS, T as namesMatchUser, _ as PARTS_STATUSES, b as PM_STYLES, c as techLabel, d as CLOSED_CALL, f as CLOSED_PM, g as MODULE_TYPES, h as MODULE_STATUSES, i as loadTechs, l as CALL_STATUSES, m as MODULE_PLATFORMS, n as listRosterCandidates, o as setRosterAdmin, p as EQUIP_STATUSES, r as listTechs, s as setTechActive, t as addTech, u as CALL_TYPES, v as PAYMENT_TERMS, w as URGENCY_RANK, x as REQS_READY, y as PM_STATUSES } from "./roster.mjs";
import { a as catalogModels, c as listedEquipment, i as specsFromInstall, l as matchModel, n as parseMachinesJson, o as dropEquipment, p as shortEquipLabel, r as serializeMachines, s as findRecipeFor, t as mergeMachineSpecs, u as piecesForInstall } from "./machines.mjs";
import { a as BARN_EQUIP_CAPACITY, c as LOCATION_SITES, d as bayFor, f as isBarn, h as slotId, i as BACK_PALLETS, l as SITE_LABEL, m as siteLabel, o as FRONT_PALLETS, p as palletsFor, s as LEVELS, t as applySerialPull, u as SITE_PURPOSE } from "./serial-pull.mjs";
import { a as loadAccountMarks, c as setRepActive, i as listReps, l as upsertAccountMarks, n as customerKey, r as isAviKatz, t as addRep } from "./reps.mjs";
import { A as normalizeZip, C as formatContact, D as normalizeCity, E as locationKey, F as roleRank, I as splitZips, L as statusTone, N as providerStates, O as normalizeEmail, P as roleLabel, S as formatAddress, T as groupLocations, _ as US_STATE_OPTIONS, a as indexHits, b as findDuplicateContact, c as pickKeeper, d as woMatchKey, f as renameOrMergeCustomer, g as PROVIDER_STATUSES, i as deskHasWrapped, k as normalizeState, l as resolvePreviewRow, m as renameOrMergeProvider, n as reconcileServiceDuplicates, o as isWalkIn, p as renameOrMergeEquipment, r as tryMergeServiceDuplicate, s as parseCorrigoMatrix, t as mergeServiceJobs, u as shouldAttachToHit, v as duplicateNote, w as formatLocation, x as findDuplicateLocation, y as findDuplicateAddress } from "./wo-duplicates.mjs";
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
//#region src/lib/ops/prefs.ts
var PREFS_KEY$1 = "katz-desk-prefs";
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
		const raw = window.localStorage.getItem(PREFS_KEY$1);
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
	window.localStorage.setItem(PREFS_KEY$1, JSON.stringify(next));
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
//#region src/components/desk/prefs-provider.tsx
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
//#endregion
//#region src/lib/ops/my-view.ts
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
//#endregion
//#region src/lib/utils.ts
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
//#endregion
//#region src/components/desk/my-view-bar.tsx
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
//#endregion
//#region src/components/providers.tsx
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
//#endregion
//#region src/styles.css?url
var styles_default = "/assets/styles-EBnmQ8fa.css";
//#endregion
//#region src/routes/__root.tsx
var APP_NAME = "Katz Desk";
var fetchSessionUser = createServerFn({ method: "GET" }).handler(async () => {
	try {
		const { getSessionUser } = await import("./verify.server.mjs");
		const u = await getSessionUser();
		return u ? {
			id: u.id,
			email: u.email
		} : null;
	} catch (err) {
		console.error("[auth] session lookup failed", err);
		return null;
	}
});
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
	const node = target;
	const el = node instanceof Element ? node : node?.parentElement;
	if (!el || typeof el.closest !== "function") return false;
	return !!el.closest("[data-combo-popover]");
}
function preventIfCombo(event) {
	if (isInsideCombo(event.target)) event.preventDefault();
}
function PopoverContent({ className, align = "start", sideOffset = 4, ...props }) {
	const [container, setContainer] = import_react.useState(void 0);
	import_react.useLayoutEffect(() => {
		const sheet = document.querySelector(".sheet-panel");
		setContainer(sheet ?? void 0);
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Portal, {
		container,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Content2, {
			align,
			sideOffset,
			"data-combo-popover": "",
			className: cn("z-[80] w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-soft outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95", className),
			...props
		})
	});
}
//#endregion
//#region src/components/ui/sheet.tsx
var Sheet = Dialog$1;
function SheetContent({ className, children, side = "right", onPointerDownOutside, onFocusOutside, onInteractOutside, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay, { className: "fixed inset-0 z-50 bg-ink/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent$1, {
		className: cn("sheet-panel fixed inset-y-0 top-0 z-50 flex h-dvh max-h-dvh w-full flex-col overflow-hidden overscroll-none border-border bg-card shadow-soft focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out sm:max-w-xl", side === "right" ? "right-0 border-l data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right" : "left-0 border-r data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left", className),
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
			className: "absolute top-3 right-3 z-10 rounded-sm p-1 text-muted-foreground hover:bg-muted",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "sr-only",
				children: "Close"
			})]
		})]
	})] });
}
function SheetHeader({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("shrink-0 border-b border-border px-5 py-4 pr-12", className),
		...props
	});
}
function SheetBody({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("sheet-scroll min-h-0 flex-1 overflow-y-scroll overscroll-contain", className),
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
//#region src/lib/ops/mentions.ts
/** @username tokens in a ping or handoff note. */
function parseMentions(text) {
	const found = [];
	const seen = /* @__PURE__ */ new Set();
	const re = /@([a-zA-Z0-9._-]{2,32})\b/g;
	let m;
	while (m = re.exec(text)) {
		const name = m[1].toLowerCase();
		if (seen.has(name)) continue;
		seen.add(name);
		found.push(m[1]);
	}
	return found;
}
function mentionFragment(text) {
	const m = text.match(/(^|\s)@([a-zA-Z0-9._-]{0,32})$/);
	return m ? m[2] : null;
}
function applyMention(text, username) {
	if (/(^|\s)@([a-zA-Z0-9._-]{0,32})$/.test(text)) return text.replace(/(^|\s)@([a-zA-Z0-9._-]{0,32})$/, `$1@${username} `);
	return `${text}${text && !text.endsWith(" ") ? " " : ""}@${username} `;
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
      comment_id    int,
      read          boolean not null default false,
      created_at    timestamptz not null default now()
    )`);
	await sql.query("alter table desk_notifications add column if not exists comment_id int");
	await sql.query("alter table desk_notifications add column if not exists customer text");
	await sql.query("create index if not exists desk_notifications_inbox_idx on desk_notifications (user_id, read, created_at desc)");
	await sql.query(`
    create unique index if not exists desk_notifications_comment_once_idx
    on desk_notifications (user_id, comment_id)
    where comment_id is not null
  `).catch(() => void 0);
}
async function loadFromName(sql, userId) {
	const me = await sql.query(`select a.username, u.name
     from desk_accounts a
     left join "user" u on u.id = a.user_id
     where a.user_id = $1`, [userId]);
	return me[0]?.username || me[0]?.name || "Teammate";
}
async function resolveCustomer(sql, entityType, entityId) {
	if (!entityType || entityId == null) return null;
	const type = entityType;
	const id = entityId;
	try {
		if (type === "service" || type === "tlc") return (await sql.query("select customer from service_jobs where id = $1", [id]))[0]?.customer ?? null;
		if (type === "pm") return (await sql.query("select customer from pm_jobs where id = $1", [id]))[0]?.customer ?? null;
		if (type === "install") return (await sql.query("select customer from installs where id = $1", [id]))[0]?.customer ?? null;
		if (type === "deal") return (await sql.query("select customer from deals where id = $1", [id]))[0]?.customer ?? null;
		if (type === "rebuild") return (await sql.query("select account from rebuilds where id = $1", [id]))[0]?.account ?? "Katz shop / stock";
		if (type === "handoff") {
			const r = await sql.query("select entity_type, entity_id from comments where id = $1", [id]);
			if (r[0]) return resolveCustomer(sql, r[0].entity_type, r[0].entity_id);
		}
	} catch {
		return null;
	}
	return null;
}
function previewLine(body) {
	return (body.split(/\r?\n/).map((s) => s.trim()).find((s) => s && !/^follow up:/i.test(s)) || body.trim()).slice(0, 160);
}
async function deliverPings(sql, opts) {
	await ensureTable(sql);
	const body = opts.body.trim();
	if (!body) throw new Error("Write a short reminder.");
	const commentId = opts.commentId ?? null;
	if (commentId) {
		const prior = await sql.query("select pinged_at from comments where id = $1", [commentId]);
		if (prior[0]?.pinged_at) return {
			sent: [],
			already: true,
			pingedAt: String(prior[0].pinged_at)
		};
	}
	const destIds = new Set(opts.toUserIds ?? []);
	const names = [...opts.usernames ?? [], ...parseMentions(body)];
	if (names.length) {
		const lowered = [...new Set(names.map((n) => n.toLowerCase()))];
		const placeholders = lowered.map((_, i) => `$${i + 1}`).join(", ");
		const rows = await sql.query(`select user_id, username from desk_accounts
       where approved = true and lower(username) in (${placeholders})`, lowered);
		for (const r of rows) destIds.add(r.user_id);
	}
	destIds.delete(opts.fromUserId);
	if (!destIds.size) throw new Error("Tag a teammate with @username, or pick someone to ping.");
	if (commentId) {
		if ((await sql.query("select user_id from desk_notifications where comment_id = $1", [commentId])).length) {
			const when = await sql.query("select pinged_at from comments where id = $1", [commentId]);
			return {
				sent: [],
				already: true,
				pingedAt: when[0]?.pinged_at ? String(when[0].pinged_at) : null
			};
		}
	}
	const fromName = await loadFromName(sql, opts.fromUserId);
	const customer = await resolveCustomer(sql, opts.entityType, opts.entityId);
	const bodyPreview = previewLine(body);
	const sent = [];
	let pingedAt = null;
	for (const toUserId of destIds) {
		const dest = await sql.query("select username from desk_accounts where user_id = $1 and approved = true", [toUserId]);
		if (!dest[0]) continue;
		const ins = await sql.query(`insert into desk_notifications (user_id, from_user_id, from_name, body, customer, entity_type, entity_id, comment_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning created_at`, [
			toUserId,
			opts.fromUserId,
			fromName,
			bodyPreview.slice(0, 400),
			customer,
			opts.entityType ?? null,
			opts.entityId ?? null,
			commentId
		]);
		pingedAt = ins[0] ? String(ins[0].created_at) : pingedAt;
		sent.push(dest[0].username);
	}
	if (!sent.length) throw new Error("That teammate isn’t on the desk yet.");
	if (commentId) {
		const marked = await sql.query(`update comments
       set pinged_at = coalesce(pinged_at, now()), pinged_by = $2
       where id = $1
       returning pinged_at`, [commentId, fromName]);
		pingedAt = marked[0] ? String(marked[0].pinged_at) : pingedAt;
	}
	return {
		sent,
		already: false,
		pingedAt
	};
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
	return (await sql.query(`select id, from_name, body, customer, entity_type, entity_id, comment_id, read, created_at
       from desk_notifications
       where user_id = $1
       order by created_at desc
       limit 40`, [context.userId])).map((r) => ({
		id: r.id,
		fromName: r.from_name,
		body: r.body,
		customer: r.customer,
		entityType: r.entity_type,
		entityId: r.entity_id,
		commentId: r.comment_id,
		read: !!r.read,
		createdAt: String(r.created_at)
	}));
});
var sendPing = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ context, data }) => {
	return deliverPings(await getSql(), {
		fromUserId: context.userId,
		body: data.body,
		entityType: data.entityType,
		entityId: data.entityId,
		commentId: data.commentId,
		toUserIds: data.toUserId ? [data.toUserId] : [],
		usernames: data.usernames
	});
});
var markNotificationRead = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ context, data }) => {
	const sql = await getSql();
	await ensureTable(sql);
	if (data.all) await sql.query("update desk_notifications set read = true where user_id = $1 and read = false", [context.userId]);
	else if (data.id != null) await sql.query("update desk_notifications set read = true where id = $1 and user_id = $2", [data.id, context.userId]);
	return { ok: true };
});
//#endregion
//#region src/lib/ops/note-owner.ts
var INITIALS_TO_PRODUCER = Object.fromEntries(Object.entries(PRODUCER_INITIALS).map(([name, initials]) => [initials.toLowerCase(), name]));
function salesName(owners) {
	if (!owners) return null;
	const producer = owners.producer?.trim();
	if (producer) return producer;
	const rep = owners.accountRep?.trim();
	if (!rep) return null;
	const fromInitials = INITIALS_TO_PRODUCER[rep.toLowerCase()];
	return fromInitials ? `${fromInitials} (${rep})` : rep;
}
function noteOwner(c, owners) {
	if (c.authorId) return {
		label: c.authorName?.trim() || "Teammate",
		canClaim: false,
		kind: "user"
	};
	const sales = salesName(owners);
	if (c.entityType === "deal" && sales) return {
		label: sales,
		canClaim: true,
		kind: "sales"
	};
	if (c.entityType === "service" || c.entityType === "tlc" || c.entityType === "pm" || c.entityType === "install" || c.askTeam === "service") return {
		label: "Service",
		canClaim: true,
		kind: "service"
	};
	if (sales) return {
		label: sales,
		canClaim: true,
		kind: "sales"
	};
	return {
		label: "Unclaimed",
		canClaim: true,
		kind: "unclaimed"
	};
}
//#endregion
//#region src/lib/ops/api.ts
async function ready$2() {
	const { ensureSeeded } = await import("./seed.server.mjs");
	await ensureSeeded();
	return getSql();
}
async function deskUsername(sql, userId) {
	return (await sql.query("select username from desk_accounts where user_id = $1", [userId]))[0]?.username || "Teammate";
}
async function logActivity(sql, userId, entityType, entityId, action, detail) {
	await sql`
    insert into activity (entity_type, entity_id, actor_name, action, detail)
    values (${entityType}, ${entityId}, ${await deskUsername(sql, userId)}, ${action}, ${detail ?? null})`;
}
function changed(label, before, after) {
	const a = before == null || before === "" ? "" : String(before);
	const b = after == null || after === "" ? "" : String(after);
	if (a === b) return null;
	if (label === "technician" || label === "producer" || label === "account rep") return b ? `assigned ${b}` : `cleared ${label}`;
	if (label === "status") return `${a || "—"} → ${b || "—"}`;
	if (!b) return `cleared ${label}`;
	return `${label}: ${b.slice(0, 72)}`;
}
function summarize(parts) {
	const hits = parts.filter((x) => !!x);
	return hits.length ? hits.slice(0, 4).join(" · ") : null;
}
async function loadEquipCatalog(sql) {
	const dir = await sql`
    select name from directory_equipment where archived = false and coalesce(name, '') <> ''`;
	const assets = await sql`
    select distinct model from assets where kind = 'equip' and coalesce(model, '') <> ''`;
	return catalogModels([...dir.map((r) => r.name), ...assets.map((r) => r.model)]);
}
function num(v) {
	if (v === null || v === void 0 || v === "") return null;
	const n = typeof v === "number" ? v : Number(v);
	return Number.isFinite(n) ? n : null;
}
function isoDate$1(v) {
	if (v === null || v === void 0 || v === "") return null;
	if (typeof v === "string") return v.slice(0, 10);
	return String(v).slice(0, 10);
}
function jobSibling(r) {
	return {
		id: r.id,
		callId: r.callId,
		customer: r.customer,
		kind: r.kind,
		status: r.status,
		wo: r.wo
	};
}
function attachJobSiblings(jobs) {
	const groups = /* @__PURE__ */ new Map();
	for (const j of jobs) {
		if (j.duplicateOf) continue;
		const key = woMatchKey(j.wo ?? "");
		if (!key) continue;
		const list = groups.get(key) ?? [];
		list.push(j);
		groups.set(key, list);
	}
	return jobs.map((j) => {
		const key = woMatchKey(j.wo ?? "");
		const group = key ? groups.get(key) ?? [] : [];
		return {
			...j,
			siblings: group.filter((o) => o.id !== j.id).map(jobSibling)
		};
	});
}
function mapJob(r, today) {
	const received = isoDate$1(r.received);
	const scheduled = isoDate$1(r.scheduled);
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
		workDone: r.work_done ?? null,
		completedAt: isoDate$1(r.completed_at),
		done: !!r.done,
		updatedAt: String(r.updated_at),
		urgency: r.urgency || "Normal",
		duplicateOf: r.duplicate_of ?? null,
		siblings: [],
		serialNotice: r.serial_notice ?? null,
		aviKatz: false,
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
	const projected = isoDate$1(r.projected);
	return {
		id: r.id,
		customer: r.customer,
		received: isoDate$1(r.received),
		equipment: r.equipment,
		style: r.style,
		projected,
		partsStatus: r.parts_status,
		status: r.status,
		technician: r.technician,
		notes: r.notes,
		wo: r.wo ?? null,
		workDone: r.work_done ?? null,
		completedAt: isoDate$1(r.completed_at),
		done: !!r.done,
		updatedAt: String(r.updated_at),
		flag: pmFlag({
			status: r.status,
			done: !!r.done,
			projected
		}, today),
		aviKatz: false
	};
}
function mapInstall(r, today, week, catalog = []) {
	const installDate = isoDate$1(r.install_date);
	return {
		id: r.id,
		received: isoDate$1(r.received),
		customer: r.customer,
		equipment: r.equipment,
		equipStatus: r.equip_status,
		installDate,
		technician: r.technician,
		wo: r.wo,
		reqsReady: r.reqs_ready,
		notes: r.notes,
		workDone: r.work_done ?? null,
		completedAt: isoDate$1(r.completed_at),
		accountRep: r.account_rep,
		paymentStatus: r.payment_status,
		serial: r.serial ?? null,
		powerVoltage: r.power_voltage ?? null,
		machines: specsFromInstall(r.equipment, r.serial, r.power_voltage, r.machines, catalog),
		serialNotice: r.serial_notice ?? null,
		complete: !!r.complete,
		dealId: r.deal_id,
		duplicateOf: r.duplicate_of ?? null,
		updatedAt: String(r.updated_at),
		flag: installFlag({
			equipStatus: r.equip_status,
			installDate,
			reqsReady: r.reqs_ready,
			complete: !!r.complete
		}, today, week),
		daysOut: installDate ? diffDays(today, installDate) : null,
		aviKatz: false,
		noRep: isNoRep(r.account_rep)
	};
}
function mapDeal(r, marks) {
	const customer = String(r.customer);
	const producer = r.producer ?? null;
	return {
		id: r.id,
		customer,
		producer,
		accountType: r.account_type ?? null,
		dateOfDeal: isoDate$1(r.date_of_deal),
		equipment: r.equipment ?? null,
		amount: num(r.amount),
		goodToOrder: !!r.good_to_order,
		ordered: !!r.ordered,
		eta: r.eta ?? null,
		terms: r.terms ?? null,
		invoice: r.invoice ?? null,
		completion: r.completion ?? null,
		notes: r.notes ?? null,
		handedOff: !!r.handed_off,
		updatedAt: String(r.updated_at),
		aviKatz: marks ? isAviKatz(marks, customer) : false,
		noRep: isNoRep(producer)
	};
}
function applyMarks(rows, marks) {
	for (const r of rows) r.aviKatz = isAviKatz(marks, r.customer ?? null);
	return rows;
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
		dateIn: isoDate$1(r.date_in),
		dateReady: isoDate$1(r.date_ready),
		technician: r.technician ?? null,
		notes: r.notes ?? null,
		updatedAt: String(r.updated_at)
	};
}
function mapComment(r, owners) {
	const base = {
		id: r.id,
		entityType: String(r.entity_type),
		entityId: r.entity_id,
		authorId: r.author_id ?? null,
		authorName: r.author_id ? r.author_name ?? null : null,
		body: String(r.body),
		askTeam: r.ask_team ?? null,
		resolved: !!r.resolved,
		createdAt: String(r.created_at),
		pingedAt: r.pinged_at ? String(r.pinged_at) : null
	};
	const owner = noteOwner(base, owners);
	return {
		...base,
		ownerLabel: owner.label,
		canClaim: owner.canClaim
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
		soldAt: isoDate$1(r.sold_at),
		installId: r.install_id,
		jobId: r.job_id ?? null,
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
	const sql = await ready$2();
	const today = todayChicago();
	const week = weekBounds(today);
	const catalog = await loadEquipCatalog(sql);
	const marks = await loadAccountMarks(sql);
	const jobs = applyMarks(attachJobSiblings((await sql`select * from service_jobs`).map((r) => mapJob(r, today))).filter((j) => !j.duplicateOf), marks);
	const pms = applyMarks((await sql`select * from pm_jobs`).map((r) => mapPm(r, today)), marks);
	const installs = applyMarks((await sql`select * from installs where archived = false`).map((r) => mapInstall(r, today, week, catalog)), marks);
	const deals = (await sql`select * from deals where archived = false`).map((r) => mapDeal(r, marks));
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
	const laterHorizon = addDays(week.end, 21);
	const pushDue = (row) => {
		comingDue.push(row);
	};
	for (const j of jobs) {
		if (CLOSED_CALL.has(j.status) || j.done || !j.scheduled) continue;
		if (j.scheduled > laterHorizon) continue;
		const accountRep = marks.rep.get(customerKey(j.customer)) ?? null;
		pushDue({
			daysOut: diffDays(today, j.scheduled),
			source: j.kind === "tlc" ? "TLC + Factor" : "Service Tracker",
			kind: j.kind,
			customer: j.customer ?? "Untitled",
			equipment: j.equipment,
			status: j.status,
			scheduled: j.scheduled,
			technician: j.technician,
			accountRep,
			detail: j.wo ?? j.callId,
			wo: j.wo,
			entityType: j.kind,
			id: j.id,
			aviKatz: j.aviKatz,
			noRep: isNoRep(accountRep)
		});
	}
	for (const p of pms) {
		if (CLOSED_PM.has(p.status) || p.done || !p.projected) continue;
		if (p.projected > laterHorizon) continue;
		const accountRep = marks.rep.get(customerKey(p.customer)) ?? null;
		pushDue({
			daysOut: diffDays(today, p.projected),
			source: "PM Tracker",
			kind: "pm",
			customer: p.customer,
			equipment: p.equipment,
			status: p.status,
			scheduled: p.projected,
			technician: p.technician,
			accountRep,
			detail: p.style ?? p.wo,
			wo: p.wo,
			entityType: "pm",
			id: p.id,
			aviKatz: p.aviKatz,
			noRep: isNoRep(accountRep)
		});
	}
	for (const i of installs) {
		if (i.complete || i.equipStatus === "Installed" || !i.installDate) continue;
		if (i.installDate > laterHorizon) continue;
		pushDue({
			daysOut: diffDays(today, i.installDate),
			source: "Installs",
			kind: "install",
			customer: i.customer,
			equipment: i.equipment,
			status: i.equipStatus ?? "",
			scheduled: i.installDate,
			technician: i.technician,
			accountRep: i.accountRep,
			detail: i.wo ?? i.equipment,
			wo: i.wo,
			entityType: "install",
			id: i.id,
			aviKatz: i.aviKatz,
			noRep: i.noRep
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
	const { loadTechs } = await import("./roster.mjs").then((n) => n.a);
	const roster = await loadTechs(sql);
	const activeNames = roster.filter((t) => t.active).map((t) => t.name);
	const assigned = [...new Set(jobs.map((j) => j.technician).filter((n) => !!n))];
	const techNames = [...activeNames];
	for (const n of assigned) {
		if (techNames.some((x) => x.toLowerCase() === n.toLowerCase())) continue;
		if (jobs.some((j) => j.technician === n && !CLOSED_CALL.has(j.status) && !j.done)) techNames.push(n);
	}
	const techLoad = techNames.map((tech) => {
		const all = jobs.filter((j) => j.technician === tech);
		const row = roster.find((t) => t.name.toLowerCase() === tech.toLowerCase());
		return {
			tech: row && !row.active ? `${tech} (inactive)` : tech,
			active: all.filter((j) => !CLOSED_CALL.has(j.status) && !j.done).length,
			completed: all.filter((j) => j.status === "Completed" || j.done).length
		};
	});
	const comments = await sql`
      select * from comments order by created_at desc limit 12`;
	const recentHandoff = [];
	for (const c of comments) {
		const ctx = await entityContext(sql, String(c.entity_type), Number(c.entity_id));
		const mapped = mapComment(c, ctx);
		recentHandoff.push({
			...mapped,
			customer: ctx.customer
		});
	}
	const openAsks = await sql`
      select count(*)::int as c from comments where ask_team is not null and resolved = false`;
	const pendingHandoffs = uniquePendingHandoffs(deals);
	const installQueue = installs.filter((i) => !i.complete && i.equipStatus !== "Installed");
	const installAtRisk = installQueue.filter((i) => i.flag).length;
	const installReadyRows = installQueue.filter((i) => i.equipStatus === "Ready");
	const installReadyByEquip = (() => {
		const map = /* @__PURE__ */ new Map();
		for (const i of installReadyRows) {
			const names = (i.machines ?? []).map((m) => m.equipment).filter(Boolean);
			const keys = names.length ? names : listedEquipment(i.equipment, catalog);
			const used = keys.length ? keys : ["Unspecified"];
			for (const name of used) map.set(name, (map.get(name) ?? 0) + 1);
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
	const comingDueCounts = {
		overdue: comingDue.filter((r) => r.daysOut < 0).length,
		today: comingDue.filter((r) => r.daysOut === 0).length,
		thisWeek: comingDue.filter((r) => r.daysOut > 0 && r.scheduled <= week.end).length,
		later: comingDue.filter((r) => r.daysOut > 0 && r.scheduled > week.end).length
	};
	const { loadRebuilds } = await import("./rebuilds.mjs").then((n) => n.s);
	const rebuilds = await loadRebuilds(sql, today).catch(() => []);
	const rebuildAlerts = rebuilds.filter((r) => r.clockFlag).map((r) => ({
		id: r.id,
		entityType: "rebuild",
		customer: r.account,
		flag: {
			code: r.clockFlag === "overdue" ? "rebuild_overdue" : "rebuild_waiting",
			label: r.clockFlag === "overdue" ? "Rebuild overdue" : "Waiting 5+ days",
			level: r.clockFlag === "overdue" ? "danger" : "warn",
			rank: r.clockFlag === "overdue" ? 6 : 16
		},
		status: r.status,
		received: r.createdAt.slice(0, 10),
		scheduled: r.targetComplete,
		technician: r.owner,
		detail: r.title,
		kind: "rebuild"
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
			comingDue: comingDueCounts.overdue + comingDueCounts.today + comingDueCounts.thisWeek,
			installQueue: installQueue.length,
			installAtRisk,
			openAsks: openAsks[0]?.c ?? 0,
			barnReady: barnReady[0]?.c ?? 0,
			barnOpen: Math.max(0, BARN_EQUIP_CAPACITY - (barnLines[0]?.c ?? 0)),
			modulesReady,
			installReady: installReadyRows.length,
			rebuildOverdue: rebuilds.filter((r) => r.health === "overdue").length,
			rebuildWaiting: rebuilds.filter((r) => r.status === "Waiting").length
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
		comingDue,
		comingDueBuckets,
		comingDueCounts,
		rebuildAlerts,
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
			goodToOrder: openDeals.filter((d) => d.goodToOrder && !d.ordered).length,
			ordered: openDeals.filter((d) => d.ordered).length,
			completeCount: doneDeals.length,
			completeValue: doneDeals.reduce((n, d) => n + (d.amount ?? 0), 0)
		}
	};
});
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
	if (type === "rebuild") {
		const r = await sql`
      select account, owner from rebuilds where id = ${id}`;
		return {
			...empty,
			customer: r[0]?.account ?? null,
			technician: r[0]?.owner ?? null
		};
	}
	return empty;
}
var listJobs = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready$2();
	const today = todayChicago();
	const marks = await loadAccountMarks(sql);
	return applyMarks(attachJobSiblings((await sql`select * from service_jobs order by received desc nulls last, id desc`).map((r) => mapJob(r, today))), marks).filter((j) => j.kind === data.kind);
});
var getJob = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready$2();
	const today = todayChicago();
	const marks = await loadAccountMarks(sql);
	const rows = await sql`select * from service_jobs where id = ${data.id}`;
	if (!rows[0]) return null;
	const others = await sql`
      select * from service_jobs where coalesce(wo, '') <> ''`;
	return applyMarks(attachJobSiblings([rows[0], ...others.filter((r) => r.id !== rows[0].id)].map((r) => mapJob(r, today))), marks).find((j) => j.id === data.id) ?? null;
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
	workDone: string().nullable().optional(),
	completedAt: string().nullable().optional(),
	done: boolean().optional(),
	urgency: string().optional()
});
var updateJob = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => jobPatch.parse(d)).handler(async ({ data, context }) => {
	const sql = await ready$2();
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
		work_done: data.workDone === void 0 ? cur[0].work_done : data.workDone,
		completed_at: data.completedAt === void 0 ? cur[0].completed_at : data.completedAt,
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
        work_done = ${next.work_done},
        completed_at = ${next.completed_at},
        done = ${next.done},
        urgency = ${next.urgency},
        updated_at = now()
      where id = ${data.id}`;
	if (data.status && data.status !== cur[0].status) await logActivity(sql, context.userId, cur[0].kind, data.id, "status", `${cur[0].status} → ${data.status}`);
	const extra = summarize([
		changed("customer", cur[0].customer, next.customer),
		changed("technician", cur[0].technician, next.technician),
		changed("equipment", cur[0].equipment, next.equipment),
		changed("issue", cur[0].issue, next.issue),
		changed("urgency", cur[0].urgency, next.urgency),
		changed("scheduled", cur[0].scheduled, next.scheduled)
	]);
	if (extra) await logActivity(sql, context.userId, cur[0].kind, data.id, "updated", extra);
	return getJob({ data: { id: data.id } });
});
var mergeServiceTickets = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data, context }) => {
	const sql = await ready$2();
	if (data.keeperId === data.extraId) throw new Error("Pick a different ticket to merge into.");
	const actor = await deskUsername(sql, context.userId);
	const result = await mergeServiceJobs(sql, data.keeperId, data.extraId, actor);
	if (!result) throw new Error("Could not merge those tickets.");
	return getJob({ data: { id: result.keeperId } });
});
var createJob = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data, context }) => {
	const sql = await ready$2();
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
	const rows = await sql`
      insert into service_jobs (kind, call_id, customer, issue, equipment, contact, phone, received, call_type, technician, status, urgency)
      values (${data.kind}, ${callId}, ${data.customer}, ${data.issue ?? null}, ${data.equipment ?? null}, ${data.contact ?? null}, ${data.phone ?? null}, ${received}, ${data.callType ?? "Field Service"}, ${data.technician ?? null}, ${"Open"}, ${urgency})
      returning id`;
	await logActivity(sql, context.userId, data.kind, rows[0].id, "opened", [data.customer, data.issue].filter(Boolean).join(" · ") || null);
	return getJob({ data: { id: rows[0].id } });
});
var listPms = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async () => {
	const sql = await ready$2();
	const marks = await loadAccountMarks(sql);
	return applyMarks((await sql`select * from pm_jobs order by received desc nulls last, id desc`).map((r) => mapPm(r, todayChicago())), marks);
});
var updatePm = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data, context }) => {
	const sql = await ready$2();
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
        wo = ${data.wo === void 0 ? c.wo : data.wo},
        work_done = ${data.workDone === void 0 ? c.work_done : data.workDone},
        completed_at = ${data.completedAt === void 0 ? c.completed_at : data.completedAt},
        done = ${done},
        updated_at = now()
      where id = ${data.id}`;
	const extra = summarize([
		changed("status", c.status, status),
		changed("customer", c.customer, data.customer ?? c.customer),
		changed("technician", c.technician, data.technician === void 0 ? c.technician : data.technician),
		changed("equipment", c.equipment, data.equipment === void 0 ? c.equipment : data.equipment)
	]);
	if (extra) await logActivity(sql, context.userId, "pm", data.id, "updated", extra);
	return mapPm((await sql`select * from pm_jobs where id = ${data.id}`)[0], todayChicago());
});
var createPm = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data, context }) => {
	const sql = await ready$2();
	const rows = await sql`
      insert into pm_jobs (customer, equipment, style, received, status)
      values (${data.customer}, ${data.equipment ?? null}, ${data.style ?? "12 month PM"}, ${todayChicago()}, ${"Pending Scheduling"})
      returning id`;
	await logActivity(sql, context.userId, "pm", rows[0].id, "opened", data.customer);
	return mapPm((await sql`select * from pm_jobs where id = ${rows[0].id}`)[0], todayChicago());
});
var listModules = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async () => {
	return (await (await ready$2())`select * from modules order by module_id`).map(mapModule);
});
var updateModule = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data, context }) => {
	const sql = await ready$2();
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
	const extra = summarize([
		changed("status", c.status, data.status ?? c.status),
		changed("technician", c.technician, data.technician === void 0 ? c.technician : data.technician),
		changed("location", c.location, data.location === void 0 ? c.location : data.location)
	]);
	if (extra) await logActivity(sql, context.userId, "module", data.id, "updated", extra);
	return mapModule((await sql`select * from modules where id = ${data.id}`)[0]);
});
var createModule = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data, context }) => {
	const sql = await ready$2();
	const rows = await sql`
      insert into modules (module_id, platform, module_type, status, location)
      values (${data.moduleId}, ${data.platform ?? "Cameo"}, ${data.moduleType ?? "Brew Module"}, ${"Not Started"}, ${"SHELF"})
      returning *`;
	await logActivity(sql, context.userId, "module", rows[0].id, "opened", data.moduleId);
	return mapModule(rows[0]);
});
var listDeals = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async () => {
	const sql = await ready$2();
	const marks = await loadAccountMarks(sql);
	return (await sql`select * from deals where archived = false order by id`).map((r) => mapDeal(r, marks));
});
var updateDeal = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data, context }) => {
	const sql = await ready$2();
	const cur = await sql`select * from deals where id = ${data.id}`;
	if (!cur[0]) throw new Error("Deal not found");
	const c = cur[0];
	const producer = data.producer === void 0 ? c.producer : canonicalRepName(data.producer);
	const completion = data.completion === void 0 ? c.completion : data.completion;
	await sql`
      update deals set
        customer = ${data.customer ?? c.customer},
        producer = ${producer},
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
	const extra = summarize([
		changed("status", c.completion, completion),
		changed("customer", c.customer, data.customer ?? c.customer),
		changed("producer", c.producer, producer),
		changed("equipment", c.equipment, data.equipment === void 0 ? c.equipment : data.equipment)
	]);
	if (extra) await logActivity(sql, context.userId, "deal", data.id, "updated", extra);
	const customerName = String(data.customer ?? c.customer);
	if (data.aviKatz !== void 0 || data.producer !== void 0) await upsertAccountMarks(sql, customerName, {
		aviKatz: data.aviKatz,
		accountRep: data.producer === void 0 ? void 0 : producer
	});
	const marks = await loadAccountMarks(sql);
	return mapDeal((await sql`select * from deals where id = ${data.id}`)[0], marks);
});
var createDeal = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data, context }) => {
	const sql = await ready$2();
	const producer = canonicalRepName(data.producer);
	const rows = await sql`
      insert into deals (customer, producer, equipment, amount, date_of_deal)
      values (${data.customer}, ${producer}, ${data.equipment ?? null}, ${data.amount ?? null}, ${todayChicago()})
      returning *`;
	await logActivity(sql, context.userId, "deal", rows[0].id, "opened", data.customer);
	if (producer) await upsertAccountMarks(sql, data.customer, { accountRep: producer });
	const marks = await loadAccountMarks(sql);
	return mapDeal(rows[0], marks);
});
var archiveDeal = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data, context }) => {
	const sql = await ready$2();
	const cur = await sql`
      select id, customer from deals where id = ${data.id} and archived = false`;
	if (!cur[0]) throw new Error("Deal not found");
	await sql`update deals set archived = true, updated_at = now() where id = ${data.id}`;
	await logActivity(sql, context.userId, "deal", data.id, "removed", cur[0].customer);
	return { ok: true };
});
function uniquePendingHandoffs(deals) {
	const pending = deals.filter((d) => d.completion === "complete" && !d.handedOff);
	const byCustomer = /* @__PURE__ */ new Map();
	for (const d of pending) {
		const key = d.customer.trim().toLowerCase();
		const prev = byCustomer.get(key);
		if (!prev || d.id > prev.id) byCustomer.set(key, d);
	}
	return [...byCustomer.values()].map((d) => ({
		dealId: d.id,
		customer: d.customer,
		equipment: d.equipment,
		producer: d.producer
	}));
}
async function maybeHandoffInstall(sql, dealId) {
	const deal = (await sql`select * from deals where id = ${dealId}`)[0];
	if (!deal || deal.archived) return;
	await sql`update deals set handed_off = true, updated_at = now() where id = ${dealId}`;
	if ((await sql`
    select id from installs where deal_id = ${dealId} and archived = false limit 1`)[0]) return;
	const existing = await sql`
    select id, deal_id from installs
    where archived = false and lower(customer) = ${String(deal.customer).trim().toLowerCase()}
    order by id desc
    limit 1`;
	if (existing[0]) {
		if (existing[0].deal_id == null) await sql`update installs set deal_id = ${dealId}, updated_at = now() where id = ${existing[0].id}`;
		return;
	}
	const initials = canonicalRepName(String(deal.producer ?? "")) ?? null;
	await sql`
    insert into installs (received, customer, equipment, account_rep, payment_status, deal_id)
    values (
      ${todayChicago()},
      ${deal.customer},
      ${deal.equipment ?? null},
      ${initials},
      ${deal.terms ?? null},
      ${dealId}
    )`;
}
var listInstalls = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async () => {
	const sql = await ready$2();
	const today = todayChicago();
	const week = weekBounds(today);
	const catalog = await loadEquipCatalog(sql);
	const marks = await loadAccountMarks(sql);
	return applyMarks((await sql`select * from installs where archived = false order by id`).map((r) => mapInstall(r, today, week, catalog)), marks);
});
var updateInstall = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data, context }) => {
	const sql = await ready$2();
	const cur = await sql`select * from installs where id = ${data.id}`;
	if (!cur[0]) throw new Error("Install not found");
	const c = cur[0];
	const equipStatus = data.equipStatus === void 0 ? c.equip_status : data.equipStatus;
	const complete = data.complete === void 0 ? data.equipStatus === void 0 ? c.complete : equipStatus === "Installed" : data.complete;
	const catalog = await loadEquipCatalog(sql);
	const machinesJson = data.machines === void 0 ? c.machines : data.machines == null ? null : (() => {
		const raw = typeof data.machines === "string" ? data.machines : JSON.stringify(data.machines);
		const parsed = parseMachinesJson(raw);
		if (!parsed.length) return raw;
		return JSON.stringify(parsed.map((s) => ({
			...s,
			equipment: matchModel(s.equipment, catalog)
		})));
	})();
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
        work_done = ${data.workDone === void 0 ? c.work_done : data.workDone},
        completed_at = ${data.completedAt === void 0 ? c.completed_at : data.completedAt},
        account_rep = ${data.accountRep === void 0 ? c.account_rep : canonicalRepName(data.accountRep) ?? (data.accountRep || null)},
        payment_status = ${data.paymentStatus === void 0 ? c.payment_status : data.paymentStatus},
        serial = ${data.serial === void 0 ? c.serial : data.serial},
        power_voltage = ${data.powerVoltage === void 0 ? c.power_voltage : data.powerVoltage},
        machines = ${machinesJson},
        complete = ${complete},
        duplicate_of = ${data.duplicateOf === void 0 ? c.duplicate_of : data.duplicateOf},
        updated_at = now()
      where id = ${data.id}`;
	const extra = summarize([
		changed("status", c.equip_status, equipStatus),
		changed("customer", c.customer, data.customer ?? c.customer),
		changed("technician", c.technician, data.technician === void 0 ? c.technician : data.technician),
		changed("equipment", c.equipment, data.equipment === void 0 ? c.equipment : data.equipment),
		changed("account rep", c.account_rep, data.accountRep === void 0 ? c.account_rep : data.accountRep),
		data.duplicateOf === null && c.duplicate_of ? "cleared duplicate flag" : data.duplicateOf && data.duplicateOf !== c.duplicate_of ? `flagged duplicate of #${data.duplicateOf}` : null
	]);
	if (extra) await logActivity(sql, context.userId, "install", data.id, "updated", extra);
	const customerName = String(data.customer ?? c.customer);
	if (data.aviKatz !== void 0 || data.accountRep !== void 0) await upsertAccountMarks(sql, customerName, {
		aviKatz: data.aviKatz,
		accountRep: data.accountRep === void 0 ? void 0 : canonicalRepName(data.accountRep) ?? (data.accountRep || null)
	});
	const today = todayChicago();
	const week = weekBounds(today);
	const marks = await loadAccountMarks(sql);
	return applyMarks([mapInstall((await sql`select * from installs where id = ${data.id}`)[0], today, week, catalog)], marks)[0];
});
var createInstall = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data, context }) => {
	const sql = await ready$2();
	const catalog = await loadEquipCatalog(sql);
	const machinesJsonRaw = data.machines == null ? null : typeof data.machines === "string" ? data.machines : JSON.stringify(data.machines);
	const parsed = parseMachinesJson(machinesJsonRaw);
	const machinesJson = parsed.length ? JSON.stringify(parsed.map((s) => ({
		...s,
		equipment: matchModel(s.equipment, catalog)
	}))) : machinesJsonRaw;
	const name = data.customer.trim();
	const duplicateOf = (await sql`
      select id from installs
      where archived = false and lower(customer) = ${name.toLowerCase()}
      order by id desc`)[0]?.id ?? null;
	const rows = await sql`
      insert into installs (received, customer, equipment, technician, equip_status, serial, power_voltage, machines, duplicate_of)
      values (
        ${todayChicago()},
        ${name},
        ${data.equipment ?? null},
        ${data.technician ?? null},
        ${"Not Ready"},
        ${data.serial?.trim() || null},
        ${data.powerVoltage?.trim() || null},
        ${machinesJson},
        ${duplicateOf}
      )
      returning *`;
	await logActivity(sql, context.userId, "install", rows[0].id, "opened", duplicateOf ? `${name} · possible duplicate of #${duplicateOf}` : name);
	return mapInstall(rows[0], todayChicago(), weekBounds(todayChicago()), catalog);
});
var archiveInstall = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data, context }) => {
	const sql = await ready$2();
	const cur = await sql`
      select id, customer from installs where id = ${data.id} and archived = false`;
	if (!cur[0]) throw new Error("Install not found");
	await sql`update installs set archived = true, updated_at = now() where id = ${data.id}`;
	await logActivity(sql, context.userId, "install", data.id, "removed", cur[0].customer);
	return { ok: true };
});
var listComments = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready$2();
	const rows = await sql`
      select * from comments
      where entity_type = ${data.entityType} and entity_id = ${data.entityId}
      order by created_at asc`;
	const ctx = await entityContext(sql, data.entityType, data.entityId);
	return rows.map((r) => mapComment(r, ctx));
});
var listActivity = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	return (await (await ready$2())`
      select id, entity_type, entity_id, actor_name, action, detail, created_at
      from activity
      where entity_type = ${data.entityType} and entity_id = ${data.entityId}
      order by created_at desc
      limit 40`).map((r) => ({
		id: r.id,
		entityType: r.entity_type,
		entityId: r.entity_id,
		actorName: r.actor_name,
		action: r.action,
		detail: r.detail,
		createdAt: String(r.created_at)
	}));
});
var addComment = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data, context }) => {
	const sql = await ready$2();
	const body = data.body.trim();
	if (!body) throw new Error("Message is empty");
	const authorName = (await sql.query("select username from desk_accounts where user_id = $1", [context.userId]))[0]?.username || "Teammate";
	const rows = await sql`
      insert into comments (entity_type, entity_id, author_id, author_name, body, ask_team)
      values (${data.entityType}, ${data.entityId}, ${context.userId}, ${authorName}, ${body}, ${data.askTeam ?? null})
      returning *`;
	await logActivity(sql, context.userId, data.entityType, data.entityId, "note", body.slice(0, 80));
	const commentId = Number(rows[0].id);
	if (parseMentions(body).length) try {
		await deliverPings(sql, {
			fromUserId: context.userId,
			body,
			entityType: data.entityType,
			entityId: data.entityId,
			commentId,
			usernames: parseMentions(body)
		});
	} catch {}
	return mapComment((await sql`select * from comments where id = ${commentId}`)[0] ?? rows[0]);
});
var claimComment = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data, context }) => {
	const sql = await ready$2();
	const cur = await sql`
      select id, author_id, entity_type, entity_id from comments where id = ${data.id}`;
	if (!cur[0]) throw new Error("Note not found");
	if (cur[0].author_id) throw new Error("That note already has an owner");
	const name = await deskUsername(sql, context.userId);
	const row = (await sql`
      update comments
      set author_id = ${context.userId}, author_name = ${name}
      where id = ${data.id} and author_id is null
      returning *`)[0];
	if (!row) throw new Error("That note already has an owner");
	await logActivity(sql, context.userId, cur[0].entity_type, cur[0].entity_id, "note", `claimed this note`);
	return mapComment(row, await entityContext(sql, cur[0].entity_type, cur[0].entity_id));
});
var resolveComment = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	await (await ready$2())`update comments set resolved = ${data.resolved} where id = ${data.id}`;
	return { ok: true };
});
var getHandoff = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async () => {
	const sql = await ready$2();
	const askRows = await sql`
      select * from comments
      where ask_team is not null and resolved = false
      order by created_at desc`;
	const recentRows = await sql`
      select * from comments order by created_at desc limit 30`;
	const asks = [];
	for (const r of askRows) {
		const ctx = await entityContext(sql, String(r.entity_type), Number(r.entity_id));
		const c = mapComment(r, ctx);
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
		const ctx = await entityContext(sql, String(r.entity_type), Number(r.entity_id));
		const c = mapComment(r, ctx);
		recent.push({
			...c,
			customer: ctx.customer,
			technician: ctx.technician,
			producer: ctx.producer,
			accountRep: ctx.accountRep
		});
	}
	return {
		asks,
		recent,
		pendingHandoffs: uniquePendingHandoffs((await sql`select * from deals where archived = false`).map((r) => mapDeal(r)))
	};
});
var searchAll = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready$2();
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
      select id, customer, equip_status, wo from installs
      where archived = false and (customer ilike ${like} or coalesce(wo,'') ilike ${like})
      limit 5`;
	for (const i of ins) hits.push({
		entityType: "install",
		id: i.id,
		title: i.customer,
		subtitle: i.wo ?? "Install",
		status: i.equip_status
	});
	const deals = await sql`
      select id, customer, producer, completion from deals
      where archived = false and customer ilike ${like}
      limit 5`;
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
	const accounts = await sql`
      select id, name from directory_customers
      where archived = false and name ilike ${like}
      order by lower(name)
      limit 8`;
	for (const a of accounts) hits.push({
		entityType: "customer",
		id: a.id,
		title: a.name,
		subtitle: "Account history",
		status: null
	});
	return hits.slice(0, 28);
});
var handoffDeal = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	await maybeHandoffInstall(await ready$2(), data.dealId);
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
	return (await (await ready$2())`select * from assets order by id`).map(mapAsset);
});
var createAsset = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready$2();
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
	const sql = await ready$2();
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
	const sql = await ready$2();
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
        job_id = null,
        sold_to = ${inst.customer},
        origin_site = ${originSite},
        origin_pallet = ${originPallet},
        origin_level = ${originLevel},
        purpose = ${asset.customer_owned ? "Customer-owned / loaner" : "Install"},
        updated_at = now()
      where id = ${data.assetId}`;
	const detail = `Pulled ${asset.model}${asset.serial ? " · " + asset.serial : ""} from ${asset.pallet ? slotId(asset.pallet, asset.level ?? 0, asset.line_no) : siteLabel(asset.site)}.`;
	await logActivity(sql, context.userId, "install", inst.id, "assigned-asset", detail);
	return mapAsset((await sql`select * from assets where id = ${data.assetId}`)[0]);
});
var unassignAssetFromInstall = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data, context }) => {
	const sql = await ready$2();
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
        job_id = null,
        sold_to = null,
        sold_at = null,
        purpose = null,
        updated_at = now()
      where id = ${data.assetId}`;
	await logActivity(sql, context.userId, "install", data.installId, "unassigned-asset", asset.model);
	return mapAsset((await sql`select * from assets where id = ${data.assetId}`)[0]);
});
var assignAssetToService = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data, context }) => {
	const sql = await ready$2();
	const customer = data.customer.trim();
	if (!customer) throw new Error("Pick a customer");
	const asset = (await sql`select * from assets where id = ${data.assetId}`)[0];
	if (!asset) throw new Error("Asset not found");
	if (asset.status === "sold") throw new Error("Already sold");
	if (asset.status !== "ready") throw new Error("That unit is already off the rack");
	const acct = (await sql`
        select name from directory_customers
        where archived = false and lower(name) = lower(${customer})
        limit 1`)[0];
	if (!acct) throw new Error("Pick an account already on the customer list");
	const name = acct.name;
	const job = (await sql`
        select id, kind from service_jobs
        where lower(customer) = lower(${name})
          and done = false
          and status not in ('Complete', 'Completed', 'Closed', 'Cancelled')
        order by updated_at desc
        limit 1`)[0];
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
        install_id = null,
        job_id = ${job?.id ?? null},
        sold_to = ${name},
        origin_site = ${originSite},
        origin_pallet = ${originPallet},
        origin_level = ${originLevel},
        purpose = ${asset.customer_owned ? "Customer-owned / service loaner" : "Service"},
        updated_at = now()
      where id = ${data.assetId}`;
	const detail = `Pulled ${asset.model}${asset.serial ? " · " + asset.serial : ""} from ${asset.pallet ? slotId(asset.pallet, asset.level ?? 0, asset.line_no) : siteLabel(asset.site)} for ${name}.`;
	await logActivity(sql, context.userId, "asset", data.assetId, "assigned-service", detail);
	if (job) await logActivity(sql, context.userId, job.kind, job.id, "assigned-asset", detail);
	return mapAsset((await sql`select * from assets where id = ${data.assetId}`)[0]);
});
var unassignAssetFromService = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data, context }) => {
	const sql = await ready$2();
	const asset = (await sql`select * from assets where id = ${data.assetId}`)[0];
	if (!asset) throw new Error("Asset not found");
	if (asset.status !== "assigned" || asset.install_id) throw new Error("That unit is not pulled for service");
	const slot = await findOpenBarnSlot(sql, {
		site: asset.origin_site ?? null,
		pallet: asset.origin_pallet ?? null,
		level: num(asset.origin_level)
	});
	const jobId = asset.job_id;
	const jobKind = jobId ? (await sql`select kind from service_jobs where id = ${jobId}`)[0]?.kind : null;
	await sql`
      update assets set
        status = 'ready',
        site = ${slot.site},
        pallet = ${slot.pallet},
        level = ${slot.level},
        line_no = ${slot.line},
        install_id = null,
        job_id = null,
        sold_to = null,
        sold_at = null,
        purpose = null,
        updated_at = now()
      where id = ${data.assetId}`;
	await logActivity(sql, context.userId, "asset", data.assetId, "unassigned-service", asset.model);
	if (jobId && jobKind) await logActivity(sql, context.userId, jobKind, jobId, "unassigned-asset", asset.model);
	return mapAsset((await sql`select * from assets where id = ${data.assetId}`)[0]);
});
var returnAssetToWarehouse = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data, context }) => {
	const sql = await ready$2();
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
        job_id = null,
        sold_to = null,
        sold_at = null,
        purpose = null,
        updated_at = now()
      where id = ${data.id}`;
	await logActivity(sql, context.userId, "asset", data.id, "returned", `${data.pallet}-L${data.level}`);
	return mapAsset((await sql`select * from assets where id = ${data.id}`)[0]);
});
var markAssetSold = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data, context }) => {
	const sql = await ready$2();
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
	await logActivity(sql, context.userId, "asset", data.id, "sold", data.soldTo);
	return mapAsset((await sql`select * from assets where id = ${data.id}`)[0]);
});
var listRecipes = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async () => {
	return (await (await ready$2())`
      select * from recipes
      order by (customer is null) desc, customer, equipment_model`).map(mapRecipe);
});
var listCustomers = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async () => {
	return (await (await ready$2())`
      select name as customer from directory_customers
      where archived = false and coalesce(name, '') <> ''
      order by lower(name)`).map((r) => r.customer);
});
var listCustomerRecords = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async () => {
	const sql = await ready$2();
	const { ensureAccountMarks } = await import("./reps.mjs").then((n) => n.s);
	await ensureAccountMarks(sql);
	return (await sql.query(`select
         d.id,
         d.name,
         d.avi_katz,
         d.account_rep,
         coalesce(svc.n, 0)::int as calls,
         coalesce(svc.p, 0)::int as pending_calls,
         coalesce(tlc.n, 0)::int as tlcs,
         coalesce(tlc.p, 0)::int as pending_tlcs,
         coalesce(pm.n, 0)::int as pms,
         coalesce(pm.p, 0)::int as pending_pms,
         coalesce(inst.n, 0)::int as installs,
         coalesce(inst.p, 0)::int as pending_installs,
         coalesce(deal.n, 0)::int as deals,
         coalesce(rcp.n, 0)::int as recipes
       from directory_customers d
       left join (
         select lower(customer) as k,
                count(*)::int as n,
                count(*) filter (
                  where not done and status not in ('Completed', 'Cancelled', 'Phone Resolved')
                )::int as p
         from service_jobs
         where coalesce(kind, 'service') = 'service' and coalesce(customer, '') <> ''
         group by 1
       ) svc on svc.k = lower(d.name)
       left join (
         select lower(customer) as k,
                count(*)::int as n,
                count(*) filter (
                  where not done and status not in ('Completed', 'Cancelled', 'Phone Resolved')
                )::int as p
         from service_jobs
         where kind = 'tlc' and coalesce(customer, '') <> ''
         group by 1
       ) tlc on tlc.k = lower(d.name)
       left join (
         select lower(customer) as k,
                count(*)::int as n,
                count(*) filter (
                  where not done and status not in ('Completed', 'Cancelled')
                )::int as p
         from pm_jobs
         where coalesce(customer, '') <> ''
         group by 1
       ) pm on pm.k = lower(d.name)
       left join (
         select lower(customer) as k,
                count(*)::int as n,
                count(*) filter (
                  where not complete and coalesce(equip_status, '') <> 'Installed'
                )::int as p
         from installs
         where archived = false and coalesce(customer, '') <> ''
         group by 1
       ) inst on inst.k = lower(d.name)
       left join (
         select lower(customer) as k, count(*)::int as n
         from deals
         where archived = false and coalesce(customer, '') <> ''
         group by 1
       ) deal on deal.k = lower(d.name)
       left join (
         select lower(customer) as k, count(*)::int as n
         from recipes
         where coalesce(customer, '') <> ''
         group by 1
       ) rcp on rcp.k = lower(d.name)
       where d.archived = false
       order by lower(d.name)`)).map((r) => ({
		id: r.id,
		name: r.name,
		calls: r.calls,
		tlcs: r.tlcs,
		pms: r.pms,
		installs: r.installs,
		deals: r.deals,
		recipes: r.recipes,
		pendingCalls: r.pending_calls,
		pendingTlcs: r.pending_tlcs,
		pendingPms: r.pending_pms,
		pendingInstalls: r.pending_installs,
		aviKatz: !!r.avi_katz,
		accountRep: r.account_rep,
		noRep: isNoRep(r.account_rep)
	}));
});
var getCustomerHistory = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready$2();
	const marks = await loadAccountMarks(sql);
	const account = (await sql`
      select id, name, avi_katz, account_rep from directory_customers where id = ${data.id} and archived = false`)[0];
	if (!account) return null;
	const name = account.name;
	const today = todayChicago();
	const week = weekBounds(today);
	const catalog = await loadEquipCatalog(sql);
	const jobs = await sql`
      select * from service_jobs
      where lower(customer) = lower(${name})
      order by received desc nulls last, id desc`;
	const pms = await sql`
      select * from pm_jobs
      where lower(customer) = lower(${name})
      order by received desc nulls last, id desc`;
	const installs = await sql`
      select * from installs
      where archived = false and lower(customer) = lower(${name})
      order by install_date desc nulls last, id desc`;
	const deals = await sql`
      select * from deals
      where archived = false and lower(customer) = lower(${name})
      order by date_of_deal desc nulls last, id desc`;
	const recipes = await sql`
      select * from recipes
      where lower(customer) = lower(${name})
      order by equipment_model`;
	return {
		id: account.id,
		name,
		aviKatz: !!account.avi_katz,
		accountRep: account.account_rep ?? null,
		jobs: applyMarks(attachJobSiblings(jobs.map((r) => mapJob(r, today))).filter((j) => !j.duplicateOf), marks),
		pms: applyMarks(pms.map((r) => mapPm(r, today)), marks),
		installs: applyMarks(installs.map((r) => mapInstall(r, today, week, catalog)), marks),
		deals: deals.map((r) => mapDeal(r, marks)),
		recipes: recipes.map(mapRecipe)
	};
});
function directoryTable(kind) {
	if (kind === "customer") return "directory_customers";
	if (kind === "equipment") return "directory_equipment";
	throw new Error("Unknown directory");
}
var listDirectory = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready$2();
	const table = directoryTable(data.kind);
	return await sql.query(`select id, name from ${table} where archived = false order by lower(name)`);
});
var updateCustomerAccount = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready$2();
	const dir = await sql`
      select id, name from directory_customers where id = ${data.id} and archived = false`;
	if (!dir[0]) throw new Error("Account not found");
	await upsertAccountMarks(sql, dir[0].name, {
		aviKatz: data.aviKatz,
		accountRep: data.accountRep
	});
	const marks = await loadAccountMarks(sql);
	return {
		id: dir[0].id,
		name: dir[0].name,
		aviKatz: isAviKatz(marks, dir[0].name),
		accountRep: marks.rep.get(dir[0].name.trim().toLowerCase()) ?? null
	};
});
var addDirectoryEntry = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready$2();
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
var archiveDirectoryEntry = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data, context }) => {
	const sql = await ready$2();
	if (data.kind === "customer") await requireAdmin(sql, context.userId, "Only an admin can add or remove customers.");
	const table = directoryTable(data.kind);
	await sql.query(`update ${table} set archived = true, updated_at = now() where id = $1`, [data.id]);
	return { ok: true };
});
var renameCustomer = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data, context }) => {
	const sql = await ready$2();
	await requireAdmin(sql, context.userId, "Only an admin can rename or merge customers.");
	return renameOrMergeCustomer(sql, data.id, data.name);
});
var renameEquipment = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready$2();
	return renameOrMergeEquipment(sql, data.id, data.name);
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
	const sql = await ready$2();
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
	const sql = await ready$2();
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
	customer: "/customers",
	handoff: "/handoff",
	rebuild: "/rebuilds"
};
function isKind(v) {
	return v in ROUTES;
}
function OpenLink({ entityType, id, className, title, children }) {
	if (!isKind(entityType)) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
		to: "/",
		className,
		title,
		children
	});
	const to = ROUTES[entityType];
	if (!id || entityType === "handoff") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
		to,
		className,
		title,
		children
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
		to,
		search: { open: id },
		className,
		title,
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
//#endregion
//#region src/components/desk/theme-toggle.tsx
function ThemeToggle() {
	const { prefs, update } = usePrefs();
	const dark = resolvedDark(prefs.appearance);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
		type: "button",
		variant: "ghost",
		size: "icon",
		"aria-label": dark ? "Switch to light mode" : "Switch to dark mode",
		title: dark ? "Light mode" : "Dark mode",
		onClick: () => update({ appearance: dark ? "light" : "dark" }),
		children: dark ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sun, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Moon, { className: "size-4" })
	});
}
function AppearanceIcon({ value }) {
	if (value === "dark") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Moon, { className: "size-4" });
	if (value === "light") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sun, { className: "size-4" });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Monitor, { className: "size-4" });
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
//#region src/components/desk/shortcuts.tsx
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
//#endregion
//#region src/components/ui/separator.tsx
function Skeleton({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("animate-pulse rounded-md bg-muted", className),
		...props
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
var EMPTY_SETTINGS = {
	coffee1: null,
	coffee2: null,
	coffee3: null,
	powder1: null,
	powder2: null,
	powder3: null,
	americano1: null,
	americano2: null,
	americano3: null,
	tea1: null,
	tea2: null,
	milk: null
};
function settingsFrom(row) {
	const next = { ...EMPTY_SETTINGS };
	if (!row) return next;
	for (const f of SETTING_FIELDS) {
		const v = row[f.name];
		next[f.name] = typeof v === "string" && v.trim() ? v : null;
	}
	return next;
}
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
//#region src/lib/ops/export-reports.ts
var REPORT_TYPES = [
	"pending",
	"pms",
	"modules",
	"tlc",
	"installs",
	"rebuilds"
];
var REPORT_LABELS = {
	pending: "Pending services",
	pms: "PMs",
	modules: "Modules",
	tlc: "TLC & Factors",
	installs: "Install readiness",
	rebuilds: "Rebuilds"
};
var REPORT_SLUG = {
	pending: "Pending-services",
	pms: "PMs",
	modules: "Modules",
	tlc: "TLC-Factors",
	installs: "Install-readiness",
	rebuilds: "Rebuilds"
};
var filterInput = object({
	dateFrom: string().nullable().optional(),
	dateTo: string().nullable().optional(),
	tech: string().nullable().optional(),
	customer: string().nullable().optional(),
	status: string().nullable().optional(),
	ak: boolean().nullable().optional()
});
var buildInput = object({
	type: _enum(REPORT_TYPES),
	format: _enum(["xlsx", "csv"]),
	filters: filterInput.optional()
});
function readySql() {
	return (async () => {
		const { ensureSeeded } = await import("./seed.server.mjs");
		await ensureSeeded();
		return getSql();
	})();
}
function isoDay(v) {
	if (v == null || v === "") return "";
	if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
	const s = String(v).trim();
	const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
	if (iso) return iso[1];
	const t = Date.parse(s);
	if (Number.isFinite(t)) return new Date(t).toISOString().slice(0, 10);
	return "";
}
function str$1(v) {
	if (v == null) return "";
	return String(v).trim();
}
function inDateRange(value, from, to) {
	if (!from && !to) return true;
	const d = (value ?? "").slice(0, 10);
	if (!d) return false;
	if (from && d < from) return false;
	if (to && d > to) return false;
	return true;
}
function matchCustomer(name, needle) {
	const n = (needle ?? "").trim().toLowerCase();
	if (!n) return true;
	return (name ?? "").toLowerCase().includes(n);
}
function matchTech(name, needle) {
	const n = (needle ?? "").trim();
	if (!n) return true;
	return (name ?? "").trim().toLowerCase() === n.toLowerCase();
}
function matchStatus(status, needle) {
	const n = (needle ?? "").trim();
	if (!n) return true;
	return (status ?? "").trim().toLowerCase() === n.toLowerCase();
}
function akCell(marks, customer) {
	return isAviKatz(marks, customer) ? "AK" : "";
}
function matchAk(marks, customer, want) {
	if (!want) return true;
	return isAviKatz(marks, customer);
}
function pickInstallScheduled(opts) {
	return isoDay(opts.install) || isoDay(opts.scheduled) || isoDay(opts.due) || "";
}
function dateSortKey(d) {
	return isoDay(d) || "9999-12-31";
}
function sortAccountDateSt(rows, accountIdx, dateIdx, stIdx) {
	return [...rows].sort((a, b) => {
		const ac = (a[accountIdx] ?? "").localeCompare(b[accountIdx] ?? "", void 0, { sensitivity: "base" });
		if (ac) return ac;
		const dd = dateSortKey(a[dateIdx] ?? "").localeCompare(dateSortKey(b[dateIdx] ?? ""));
		if (dd) return dd;
		if (stIdx < 0) return 0;
		return (a[stIdx] ?? "").localeCompare(b[stIdx] ?? "", void 0, {
			numeric: true,
			sensitivity: "base"
		});
	});
}
function groupByAccount(rows, accountIdx = 0) {
	const out = [];
	let prev = null;
	for (const row of rows) {
		const acct = row[accountIdx] ?? "";
		if (prev != null && acct !== prev) out.push(row.map(() => ""));
		out.push(row);
		prev = acct;
	}
	return out;
}
function isBlankRow(row) {
	return row.every((c) => !c);
}
function techCell(name, inactive) {
	const n = str$1(name);
	if (!n) return "";
	if (inactive.has(n.toLowerCase())) return `${n} (inactive)`;
	return n;
}
async function inactiveNames(sql) {
	const techs = await loadTechs(sql);
	return new Set(techs.filter((t) => !t.active).map((t) => t.name.toLowerCase()));
}
function extractPo(...fields) {
	for (const f of fields) {
		const text = f ?? "";
		const re = /\bP\.?\s*O\.?\s*(?:#|No\.?|Number)?\s*[:#-]?\s*([A-Z0-9][-A-Z0-9/]{1,24})/gi;
		let m;
		while (m = re.exec(text)) {
			const v = (m[1] ?? "").replace(/[.,;]+$/, "");
			if (!v || /^(tlc|factor|and)$/i.test(v)) continue;
			return v;
		}
	}
	return "";
}
function dedupeBySt(rows, stIdx) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const row of rows) {
		const raw = row[stIdx] ?? "";
		const key = woMatchKey(raw);
		if (!key) {
			out.push(row);
			continue;
		}
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(row);
	}
	return out;
}
function filterSummary(filters, count) {
	const bits = [];
	if (filters?.dateFrom || filters?.dateTo) bits.push(`Dates ${filters.dateFrom || "…"} to ${filters.dateTo || "…"}`);
	if (filters?.tech) bits.push(`Tech ${filters.tech}`);
	if (filters?.customer) bits.push(`Account ${filters.customer}`);
	if (filters?.status) bits.push(`Status ${filters.status}`);
	if (filters?.ak) bits.push("AK accounts");
	bits.push(`${count} row${count === 1 ? "" : "s"}`);
	return bits.join(" · ");
}
function tlcBlob(issue, callType, notes, workDone) {
	const blob = `${issue ?? ""} ${callType ?? ""} ${notes ?? ""} ${workDone ?? ""}`;
	return /\b(tlc|factor)\b/i.test(blob);
}
function mapRecipeRow(r) {
	return {
		id: Number(r.id),
		equipmentModel: String(r.equipment_model ?? ""),
		customer: r.customer ?? null,
		installId: r.install_id == null ? null : Number(r.install_id),
		copiedFrom: r.copied_from == null ? null : Number(r.copied_from),
		isTemplate: !!r.is_template,
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
		updatedAt: String(r.updated_at ?? "")
	};
}
function configForMachine(customer, installId, model, serial, voltage, recipes) {
	const bits = [];
	if (model) bits.push(model);
	if (serial) bits.push(`SN ${serial}`);
	if (voltage) bits.push(voltage);
	const { linked, house } = findRecipeFor(recipes, {
		customer,
		model,
		installId
	});
	const rec = linked ?? house;
	if (rec) {
		const settings = settingsFrom(rec);
		for (const f of SETTING_FIELDS) {
			const v = (settings[f.name] ?? "").trim();
			if (v) bits.push(`${f.label}: ${v.split("\n")[0].slice(0, 48)}`);
		}
		if (rec.notes?.trim()) bits.push(rec.notes.trim().split("\n")[0].slice(0, 80));
	}
	const hardware = !!(model || serial || voltage);
	if (!bits.length) return {
		text: "missing",
		missing: true
	};
	if (!hardware) return {
		text: bits.join(" · "),
		missing: true
	};
	return {
		text: bits.join(" · "),
		missing: false
	};
}
function blockingFor(row) {
	const bits = [];
	if (row.equip_status && row.equip_status !== "Ready") bits.push(row.equip_status);
	if (row.reqs_ready && row.reqs_ready !== "Ready") bits.push(`Site: ${row.reqs_ready}`);
	if (row.payment_status) bits.push(row.payment_status);
	if (row.notes?.trim()) bits.push(row.notes.trim());
	return bits.join(" · ");
}
async function buildPending(sql, filters, inactive) {
	const marks = await loadAccountMarks(sql);
	const jobs = await sql.query(`select wo, customer, status, technician, completed_at, issue, work_done, received, scheduled, done
       from service_jobs
      where kind = 'service' and duplicate_of is null
      order by customer, wo`);
	let rows = [];
	for (const j of jobs) {
		if (CLOSED_CALL.has(j.status) || j.done) continue;
		if (j.status === "Cancelled" || j.status === "Completed") continue;
		if (!inDateRange(j.completed_at || j.scheduled || j.received, filters.dateFrom, filters.dateTo)) continue;
		if (!matchTech(j.technician, filters.tech)) continue;
		if (!matchCustomer(j.customer, filters.customer)) continue;
		if (!matchStatus(j.status, filters.status)) continue;
		if (!matchAk(marks, j.customer, filters.ak)) continue;
		rows.push([
			str$1(j.wo),
			str$1(j.customer),
			pickInstallScheduled({ scheduled: j.scheduled }),
			str$1(j.status),
			techCell(j.technician, inactive),
			str$1(j.completed_at),
			str$1(j.issue),
			str$1(j.work_done),
			akCell(marks, j.customer)
		]);
	}
	rows = sortAccountDateSt(dedupeBySt(rows, 0), 1, 2, 0);
	return {
		name: "Pending services",
		columns: [
			"ST#",
			"Account",
			"Install / scheduled date",
			"Status",
			"Tech",
			"Date completed",
			"Problem / request",
			"Description of work",
			"AK"
		],
		rows
	};
}
async function buildPms(sql, filters, inactive) {
	const marks = await loadAccountMarks(sql);
	const jobs = await sql.query(`select wo, customer, status, technician, completed_at, equipment, work_done, style, parts_status, projected, received, done
       from pm_jobs order by customer, wo`);
	let rows = [];
	for (const j of jobs) {
		if (!inDateRange(j.completed_at || j.projected || j.received, filters.dateFrom, filters.dateTo)) continue;
		if (!matchTech(j.technician, filters.tech)) continue;
		if (!matchCustomer(j.customer, filters.customer)) continue;
		if (!matchStatus(j.status, filters.status)) continue;
		if (!matchAk(marks, j.customer, filters.ak)) continue;
		rows.push([
			str$1(j.wo),
			str$1(j.customer),
			pickInstallScheduled({ due: j.projected }),
			str$1(j.status),
			techCell(j.technician, inactive),
			str$1(j.completed_at),
			str$1(j.equipment),
			str$1(j.work_done),
			str$1(j.style),
			str$1(j.parts_status),
			str$1(j.projected),
			akCell(marks, j.customer)
		]);
	}
	rows = sortAccountDateSt(dedupeBySt(rows, 0), 1, 2, 0);
	return {
		name: "PMs",
		columns: [
			"ST#",
			"Account",
			"Install / scheduled date",
			"Status",
			"Tech",
			"Date completed",
			"Equipment",
			"Description of work",
			"PM style",
			"Parts",
			"Projected",
			"AK"
		],
		rows
	};
}
async function buildModules(sql, filters, inactive) {
	const marks = await loadAccountMarks(sql);
	const jobs = await sql.query(`select wo, location, status, technician, date_ready, module_id, module_type, platform, date_in from modules order by location, wo`);
	let rows = [];
	for (const j of jobs) {
		if (!inDateRange(j.date_ready || j.date_in, filters.dateFrom, filters.dateTo)) continue;
		if (!matchTech(j.technician, filters.tech)) continue;
		if (!matchCustomer(j.location, filters.customer)) continue;
		if (!matchStatus(j.status, filters.status)) continue;
		if (!matchAk(marks, j.location, filters.ak)) continue;
		rows.push([
			str$1(j.wo),
			str$1(j.location),
			"",
			str$1(j.status),
			techCell(j.technician, inactive),
			str$1(j.date_ready),
			str$1(j.module_id),
			str$1(j.module_type),
			str$1(j.platform),
			akCell(marks, j.location)
		]);
	}
	rows = sortAccountDateSt(dedupeBySt(rows, 0), 1, 2, 0);
	return {
		name: "Modules",
		columns: [
			"ST#",
			"Account / location",
			"Install / scheduled date",
			"Status",
			"Tech",
			"Date ready",
			"Module",
			"Type",
			"Platform",
			"AK"
		],
		rows
	};
}
async function buildTlc(sql, filters, inactive) {
	const marks = await loadAccountMarks(sql);
	const jobs = await sql.query(`select wo, customer, status, technician, completed_at, issue, work_done, call_type, kind, received, scheduled, done, notes
       from service_jobs
      where duplicate_of is null
      order by customer, wo`);
	let rows = [];
	for (const j of jobs) {
		const po = extractPo(j.issue, j.notes, j.work_done, j.call_type);
		if (j.kind !== "tlc" && !tlcBlob(j.issue, j.call_type, j.notes, j.work_done) && !/\b(tlc|factor)\b/i.test(po)) continue;
		if (!inDateRange(j.completed_at || j.scheduled || j.received, filters.dateFrom, filters.dateTo)) continue;
		if (!matchTech(j.technician, filters.tech)) continue;
		if (!matchCustomer(j.customer, filters.customer)) continue;
		if (!matchStatus(j.status, filters.status)) continue;
		if (!matchAk(marks, j.customer, filters.ak)) continue;
		rows.push([
			str$1(j.wo),
			str$1(j.customer),
			pickInstallScheduled({ scheduled: j.scheduled }),
			str$1(j.status),
			techCell(j.technician, inactive),
			str$1(j.completed_at),
			str$1(j.issue),
			str$1(j.work_done),
			po,
			akCell(marks, j.customer)
		]);
	}
	rows = sortAccountDateSt(dedupeBySt(rows, 0), 1, 2, 0);
	return {
		name: "TLC & Factors",
		columns: [
			"ST#",
			"Account",
			"Install / scheduled date",
			"Status",
			"Tech",
			"Date completed",
			"Problem / request",
			"Description of work",
			"P.O. #",
			"AK"
		],
		rows
	};
}
async function buildInstalls(sql, filters, inactive) {
	const marks = await loadAccountMarks(sql);
	const installs = await sql.query(`select id, customer, equipment, equip_status, install_date, technician, notes, reqs_ready,
            payment_status, serial, power_voltage, machines, complete, account_rep, received, updated_at
       from installs
      where archived = false
      order by customer`);
	const recipes = (await sql.query(`select * from recipes`)).map(mapRecipeRow);
	const catalog = catalogModels([...installs.map((i) => i.equipment ?? ""), ...recipes.map((r) => r.equipmentModel)]);
	const readyRows = [];
	const notReadyRows = [];
	for (const i of installs) {
		if (i.complete || i.equip_status === "Installed") continue;
		if (!inDateRange(i.install_date || i.received || String(i.updated_at).slice(0, 10), filters.dateFrom, filters.dateTo)) continue;
		if (filters.tech && !matchTech(i.technician, filters.tech) && !matchTech(i.account_rep, filters.tech)) continue;
		if (!matchCustomer(i.customer, filters.customer)) continue;
		if (!matchAk(marks, i.customer, filters.ak)) continue;
		const isReady = i.equip_status === "Ready";
		if (filters.status) {
			const wantReady = filters.status.toLowerCase() === "ready";
			const wantNot = /not\s*ready/i.test(filters.status);
			if (wantReady && !isReady) continue;
			if (wantNot && isReady) continue;
			if (!wantReady && !wantNot && !matchStatus(i.equip_status, filters.status)) continue;
		}
		const machines = parseMachinesJson(i.machines);
		const names = listedEquipment(i.equipment, catalog);
		const pieces = machines.length > 0 ? machines : names.length ? names.map((equipment) => ({
			equipment,
			serial: names.length === 1 ? str$1(i.serial) : "",
			powerVoltage: names.length === 1 ? str$1(i.power_voltage) : ""
		})) : [{
			equipment: str$1(i.equipment),
			serial: str$1(i.serial),
			powerVoltage: str$1(i.power_voltage)
		}];
		const owner = techCell(str$1(i.technician) || str$1(i.account_rep), inactive);
		const updated = isoDay(i.updated_at);
		for (const piece of pieces) {
			const model = piece.equipment || str$1(i.equipment);
			const cfg = configForMachine(i.customer, i.id, model, piece.serial, piece.powerVoltage, recipes);
			if (isReady) readyRows.push([
				str$1(i.customer),
				pickInstallScheduled({ install: i.install_date }),
				model,
				cfg.missing ? "missing" : cfg.text,
				owner,
				akCell(marks, i.customer)
			]);
			else notReadyRows.push([
				str$1(i.customer),
				pickInstallScheduled({ install: i.install_date }),
				model,
				cfg.missing ? "missing" : cfg.text,
				blockingFor(i),
				owner,
				updated,
				akCell(marks, i.customer)
			]);
		}
	}
	const notReadySorted = sortAccountDateSt(notReadyRows, 0, 1, -1);
	const readySorted = sortAccountDateSt(readyRows, 0, 1, -1);
	return {
		notReady: {
			name: "Not ready",
			columns: [
				"Account",
				"Install / scheduled date",
				"Equipment",
				"Configuration",
				"Blocking / not ready",
				"Tech / owner",
				"Last updated",
				"AK"
			],
			rows: groupByAccount(notReadySorted, 0)
		},
		ready: {
			name: "Ready",
			columns: [
				"Account",
				"Install / scheduled date",
				"Equipment",
				"Configuration",
				"Tech / owner",
				"AK"
			],
			rows: groupByAccount(readySorted, 0)
		},
		counts: {
			notReady: notReadySorted.length,
			ready: readySorted.length
		}
	};
}
async function buildRebuilds(sql, filters) {
	const rows = sortRebuildsForExport(await loadRebuilds(sql));
	const body = [];
	for (const r of rows) {
		if (!matchCustomer(r.account, filters.customer)) continue;
		if (!matchTech(r.owner, filters.tech)) continue;
		if (!matchStatus(r.status, filters.status)) continue;
		if (!inDateRange(r.targetComplete, filters.dateFrom, filters.dateTo) && (filters.dateFrom || filters.dateTo)) {
			if (!inDateRange(r.updatedAt.slice(0, 10), filters.dateFrom, filters.dateTo)) continue;
		}
		body.push([
			r.title,
			r.account,
			r.equipment ?? "",
			r.serial ?? "",
			r.owner ?? "",
			r.status,
			r.status === "Waiting" ? r.reasonCode ?? "" : "",
			r.targetComplete ?? "",
			String(r.daysOpen),
			r.daysToTarget == null ? "" : String(r.daysToTarget),
			HEALTH_LABEL[r.health],
			isoDay(r.updatedAt)
		]);
	}
	return {
		name: "Rebuilds",
		columns: [
			"Project",
			"Account",
			"Equipment",
			"Serial",
			"Owner",
			"Status",
			"Reason delayed",
			"Target complete",
			"Days open",
			"Days to target",
			"Health",
			"Last update"
		],
		rows: body
	};
}
function fileNameFor(type, date, format) {
	return `KatzDesk-${REPORT_SLUG[type]}-${date}.${format}`;
}
async function buildReport(type, filters) {
	const sql = await readySql();
	const generated = formatNowChicago();
	const inactive = await inactiveNames(sql);
	let sheets = [];
	let counts;
	if (type === "pending") sheets = [await buildPending(sql, filters, inactive)];
	else if (type === "pms") sheets = [await buildPms(sql, filters, inactive)];
	else if (type === "modules") sheets = [await buildModules(sql, filters, inactive)];
	else if (type === "tlc") sheets = [await buildTlc(sql, filters, inactive)];
	else if (type === "rebuilds") sheets = [await buildRebuilds(sql, filters)];
	else {
		const inst = await buildInstalls(sql, filters, inactive);
		sheets = [inst.notReady, inst.ready];
		counts = inst.counts;
	}
	const rowCount = counts != null ? counts.notReady + counts.ready : sheets.reduce((n, s) => n + s.rows.filter((r) => !isBlankRow(r)).length, 0);
	return {
		type,
		label: REPORT_LABELS[type],
		generated: generated.stamp,
		filterSummary: filterSummary(filters, rowCount),
		filename: fileNameFor(type, generated.date, "xlsx"),
		sheets,
		counts
	};
}
function sheetWithHeader(report, sheet, extra) {
	const aoa = [
		[report.label],
		[`Generated ${report.generated}`],
		[report.filterSummary],
		extra ?? [],
		[],
		sheet.columns,
		...sheet.rows
	];
	return utils.aoa_to_sheet(aoa);
}
function toWorkbook(report) {
	const wb = utils.book_new();
	if (report.type === "installs" && report.counts) {
		const extra = [`${report.counts.notReady} not ready`, `${report.counts.ready} ready`];
		for (const sheet of report.sheets) utils.book_append_sheet(wb, sheetWithHeader(report, sheet, extra), sheet.name.slice(0, 31));
		return wb;
	}
	for (const sheet of report.sheets) utils.book_append_sheet(wb, sheetWithHeader(report, sheet), sheet.name.slice(0, 31));
	return wb;
}
function toCsv(report) {
	const lines = [];
	const esc = (v) => {
		if (/[",\n]/.test(v)) return `"${v.replace(/"/g, "\"\"")}"`;
		return v;
	};
	lines.push(esc(report.label));
	lines.push(esc(`Generated ${report.generated}`));
	lines.push(esc(report.filterSummary));
	if (report.counts) lines.push(esc(`${report.counts.notReady} not ready · ${report.counts.ready} ready`));
	lines.push("");
	if (report.type === "installs") {
		lines.push([
			"Ready",
			"Account",
			"Install / scheduled date",
			"Equipment",
			"Configuration",
			"Blocking / not ready",
			"Tech / owner",
			"Last updated"
		].map(esc).join(","));
		const notReady = report.sheets.find((s) => s.name === "Not ready");
		const ready = report.sheets.find((s) => s.name === "Ready");
		for (const r of notReady?.rows ?? []) {
			if (isBlankRow(r)) {
				lines.push("");
				continue;
			}
			lines.push([
				"No",
				r[0],
				r[1],
				r[2],
				r[3],
				r[4],
				r[5],
				r[6]
			].map((c) => esc(c ?? "")).join(","));
		}
		for (const r of ready?.rows ?? []) {
			if (isBlankRow(r)) {
				lines.push("");
				continue;
			}
			lines.push([
				"Yes",
				r[0],
				r[1],
				r[2],
				r[3],
				"",
				r[4],
				""
			].map((c) => esc(c ?? "")).join(","));
		}
		return lines.join("\n");
	}
	const sheet = report.sheets[0];
	if (!sheet) return lines.join("\n");
	lines.push(sheet.columns.map(esc).join(","));
	for (const r of sheet.rows) lines.push(r.map((c) => esc(c ?? "")).join(","));
	return lines.join("\n");
}
var previewExport = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => buildInput.parse(d)).handler(async ({ data }) => {
	return buildReport(data.type, data.filters ?? {});
});
var downloadExport = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => buildInput.parse(d)).handler(async ({ data }) => {
	const report = await buildReport(data.type, data.filters ?? {});
	const date = todayChicago();
	if (data.format === "csv") {
		const csv = toCsv(report);
		return {
			filename: fileNameFor(data.type, date, "csv"),
			mime: "text/csv",
			base64: Buffer.from(csv, "utf8").toString("base64"),
			report: {
				...report,
				filename: fileNameFor(data.type, date, "csv")
			}
		};
	}
	const wb = toWorkbook(report);
	const buf = writeSync(wb, {
		type: "base64",
		bookType: "xlsx"
	});
	return {
		filename: fileNameFor(data.type, date, "xlsx"),
		mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		base64: buf,
		report: {
			...report,
			filename: fileNameFor(data.type, date, "xlsx")
		}
	};
});
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
/** Grows with the typed text — used for issue / note bubbles. */
function AutoGrowTextarea({ className, onChange, value, defaultValue, ...props }) {
	const ref = import_react.useRef(null);
	const resize = import_react.useCallback(() => {
		const el = ref.current;
		if (!el) return;
		el.style.height = "auto";
		el.style.height = `${Math.max(el.scrollHeight, 44)}px`;
	}, []);
	import_react.useLayoutEffect(() => {
		resize();
	}, [
		resize,
		value,
		defaultValue
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
		...props,
		ref,
		rows: 1,
		value,
		defaultValue,
		onChange: (e) => {
			onChange?.(e);
			resize();
		},
		className: cn("flex min-h-11 w-full resize-none overflow-hidden rounded-md border border-input bg-card px-3 py-2 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50", className)
	});
}
function Label({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
		className: cn("text-xs font-medium text-muted-foreground", className),
		...props
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
//#region src/components/desk/tech-select.tsx
function useRoster() {
	return useQuery({
		queryKey: ["roster"],
		queryFn: () => listTechs(),
		staleTime: 3e4
	});
}
function activeTechNames(techs) {
	if (techs?.length) return techs.filter((t) => t.active).map((t) => t.name);
	return [...TECHNICIANS];
}
function TechName({ name }) {
	const roster = useRoster();
	if (!name) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: "—" });
	if (activeTechNames(roster.data?.techs).some((n) => n.toLowerCase() === name.toLowerCase())) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: name });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		name,
		" ",
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-xs text-muted-foreground",
			children: "(inactive)"
		})
	] });
}
function TechSelect({ name, defaultValue, value, onChange, allowEmpty = true, className, id }) {
	const active = activeTechNames(useRoster().data?.techs ?? []);
	const current = (value ?? defaultValue ?? "") || "";
	const extras = current && !active.some((n) => n.toLowerCase() === current.toLowerCase()) ? [current] : [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
		id,
		name,
		className: className ?? "mt-1",
		defaultValue: value == null ? current : void 0,
		value,
		onChange,
		allowEmpty,
		emptyLabel: "—",
		children: [extras.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
			value: n,
			children: techLabel(n, new Set(active))
		}, `inactive-${n}`)), active.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
			value: n,
			children: n
		}, n))]
	});
}
function TechFilter({ value, onChange, extraNames, className }) {
	const active = activeTechNames(useRoster().data?.techs ?? []);
	const seen = new Set(active.map((n) => n.toLowerCase()));
	const leftover = [];
	for (const raw of extraNames ?? []) {
		const n = (raw ?? "").trim();
		if (!n || seen.has(n.toLowerCase())) continue;
		seen.add(n.toLowerCase());
		leftover.push(n);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
		value,
		onChange: (e) => onChange(e.target.value),
		allowEmpty: true,
		emptyLabel: "All techs",
		className: className ?? "w-40 min-w-0",
		"aria-label": "Filter by technician",
		children: [active.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
			value: n,
			children: n
		}, n)), leftover.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
			value: n,
			children: [n, " (inactive)"]
		}, `in-${n}`))]
	});
}
//#endregion
//#region src/components/desk/export-dialog.tsx
var PREFS_KEY = "katz-desk-export";
function readSaved() {
	if (typeof window === "undefined") return {};
	try {
		return JSON.parse(window.localStorage.getItem(PREFS_KEY) || "{}");
	} catch {
		return {};
	}
}
function writeSaved(next) {
	window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
}
function statusesFor(type) {
	if (type === "pms") return [...PM_STATUSES];
	if (type === "modules") return [...MODULE_STATUSES];
	if (type === "installs") return [
		...EQUIP_STATUSES.filter((s) => s !== "Installed"),
		"Not Ready",
		"Ready"
	];
	if (type === "rebuilds") return [...REBUILD_STATUSES];
	return [...CALL_STATUSES];
}
function downloadBase64(filename, mime, base64) {
	const bin = atob(base64);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	const blob = new Blob([bytes], { type: mime });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}
function tsvFromReport(report) {
	const parts = [
		`${report.label}`,
		`Generated ${report.generated}`,
		report.filterSummary,
		""
	];
	for (const sheet of report.sheets) {
		if (report.sheets.length > 1) parts.push(sheet.name);
		parts.push(sheet.columns.join("	"));
		for (const row of sheet.rows) parts.push(row.join("	"));
		parts.push("");
	}
	return parts.join("\n");
}
function printReport(report) {
	const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
	if (!w) {
		toast.error("Allow pop-ups to print the report.");
		return;
	}
	const tables = report.sheets.map((sheet) => {
		const head = sheet.columns.map((c) => `<th>${esc$1(c)}</th>`).join("");
		const body = sheet.rows.map((r) => `<tr>${r.map((c) => `<td>${esc$1(c)}</td>`).join("")}</tr>`).join("");
		return `<h2>${esc$1(sheet.name)}</h2><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
	}).join("");
	w.document.write(`<!doctype html><html><head><title>${esc$1(report.label)}</title>
    <style>
      body { font: 13px/1.4 system-ui, sans-serif; padding: 24px; color: #1a1612; }
      h1 { font-size: 22px; margin: 0 0 4px; }
      p { color: #5c5348; margin: 0 0 16px; }
      h2 { font-size: 14px; margin: 20px 0 8px; text-transform: uppercase; letter-spacing: .08em; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #d7cfc4; padding: 6px 8px; text-align: left; vertical-align: top; }
      th { background: #f4efe8; }
    </style></head><body>
    <h1>${esc$1(report.label)}</h1>
    <p>${esc$1(report.generated)} · ${esc$1(report.filterSummary)}</p>
    ${tables}
    </body></html>`);
	w.document.close();
	w.focus();
	w.print();
}
function esc$1(s) {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function ExportButton({ defaultType, label }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
		type: "button",
		variant: "outline",
		onClick: () => setOpen(true),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-4" }), label ?? "Export"]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExportDialog, {
		open,
		onOpenChange: setOpen,
		defaultType
	})] });
}
function ExportDialog({ open, onOpenChange, defaultType }) {
	const saved = (0, import_react.useMemo)(() => readSaved(), [open]);
	const [type, setType] = (0, import_react.useState)(defaultType ?? saved.type ?? "pending");
	const [format, setFormat] = (0, import_react.useState)(saved.format ?? "xlsx");
	const [dateFrom, setDateFrom] = (0, import_react.useState)(saved.dateFrom ?? "");
	const [dateTo, setDateTo] = (0, import_react.useState)(saved.dateTo ?? "");
	const [tech, setTech] = (0, import_react.useState)(saved.tech ?? "");
	const [customer, setCustomer] = (0, import_react.useState)(saved.customer ?? "");
	const [status, setStatus] = (0, import_react.useState)(saved.status ?? "");
	const [ak, setAk] = (0, import_react.useState)(!!saved.ak);
	const [report, setReport] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (!open) return;
		const next = defaultType ?? readSaved().type ?? "pending";
		if (defaultType) setType(defaultType);
		else setType(next);
	}, [open, defaultType]);
	const filters = {
		dateFrom: dateFrom || null,
		dateTo: dateTo || null,
		tech: tech || null,
		customer: customer || null,
		status: status || null,
		ak: ak || null
	};
	function persist() {
		writeSaved({
			type,
			format,
			dateFrom,
			dateTo,
			tech,
			customer,
			status,
			ak
		});
	}
	const preview = useMutation({
		mutationFn: () => previewExport({ data: {
			type,
			format,
			filters
		} }),
		onSuccess: (data) => {
			setReport(data);
			persist();
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not build report")
	});
	const download = useMutation({
		mutationFn: () => downloadExport({ data: {
			type,
			format,
			filters
		} }),
		onSuccess: (data) => {
			setReport(data.report);
			persist();
			downloadBase64(data.filename, data.mime, data.base64);
			toast.success(`Saved ${data.filename}`);
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not export")
	});
	const statuses = [...new Set(statusesFor(type))];
	const last = report;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "max-h-[90vh] max-w-4xl overflow-y-auto",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Export" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, { children: "One file for the weekly update. KatzDesk labels only — nothing is sent to Corrigo, and customers are not created." }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 grid min-w-0 gap-3 sm:grid-cols-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "export-type",
							children: "Report type"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
							id: "export-type",
							className: "mt-1",
							value: type,
							onChange: (e) => {
								setType(e.target.value);
								setStatus("");
								setReport(null);
							},
							children: REPORT_TYPES.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: t,
								children: REPORT_LABELS[t]
							}, t))
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "export-format",
							children: "Format"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
							id: "export-format",
							className: "mt-1",
							value: format,
							onChange: (e) => setFormat(e.target.value),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "xlsx",
								children: "Excel (.xlsx)"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "csv",
								children: "CSV"
							})]
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "export-from",
							children: "From"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "export-from",
							type: "date",
							className: "mt-1",
							value: dateFrom,
							onChange: (e) => setDateFrom(e.target.value)
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "export-to",
							children: "To"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "export-to",
							type: "date",
							className: "mt-1",
							value: dateTo,
							onChange: (e) => setDateTo(e.target.value)
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 sm:col-span-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: type === "rebuilds" ? "Owner" : "Tech" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-1 max-w-xs",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TechFilter, {
									value: tech,
									onChange: setTech,
									className: "w-full"
								})
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 sm:col-span-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "export-customer",
								children: "Account"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "export-customer",
								className: "mt-1",
								value: customer,
								onChange: (e) => setCustomer(e.target.value),
								placeholder: "Search account name…"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "sm:col-span-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "export-status",
								children: "Status"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
								id: "export-status",
								className: "mt-1 max-w-xs",
								value: status,
								onChange: (e) => setStatus(e.target.value),
								allowEmpty: true,
								emptyLabel: "Any status",
								children: statuses.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: s,
									children: s
								}, s))
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "sm:col-span-2 flex items-center gap-2 text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "checkbox",
								className: "size-4 accent-primary",
								checked: ak,
								onChange: (e) => setAk(e.target.checked)
							}), "AK accounts only"]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 flex flex-wrap gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							type: "button",
							onClick: () => download.mutate(),
							disabled: download.isPending,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-4" }), download.isPending ? "Building…" : `Download ${format === "xlsx" ? "Excel" : "CSV"}`]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							type: "button",
							variant: "outline",
							onClick: () => preview.mutate(),
							disabled: preview.isPending,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Table2, { className: "size-4" }), preview.isPending ? "Loading…" : "Preview"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "outline",
							disabled: !last,
							onClick: async () => {
								if (!last) return;
								try {
									await navigator.clipboard.writeText(tsvFromReport(last));
									toast.success("Copied as a table");
								} catch {
									toast.error("Could not copy");
								}
							},
							children: "Copy as table"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							type: "button",
							variant: "outline",
							disabled: !last,
							onClick: () => last && printReport(last),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Printer, { className: "size-4" }), "Print"]
						})
					]
				}),
				last ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-medium",
								children: last.label
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-muted-foreground",
								children: [
									" · ",
									last.generated,
									" · ",
									last.filterSummary
								]
							})]
						}),
						last.counts ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-sm",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-medium",
									children: last.counts.notReady
								}),
								" not ready",
								" · ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-medium",
									children: last.counts.ready
								}),
								" ready"
							]
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-3 space-y-4",
							children: last.sheets.map((sheet) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "overflow-auto rounded-xl border border-border",
								children: [
									last.sheets.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "border-b border-border bg-muted/40 px-3 py-2 text-xs tracking-wide text-muted-foreground uppercase",
										children: [
											sheet.name,
											" · ",
											sheet.rows.length
										]
									}) : null,
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
										className: "w-full min-w-[40rem] text-left text-sm",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
											className: "bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: sheet.columns.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "px-3 py-2 font-medium",
												children: c
											}, c)) })
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [sheet.rows.slice(0, 40).map((row, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
											className: "border-t border-border",
											children: row.map((cell, j) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "px-3 py-1.5 align-top",
												children: cell || /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-muted-foreground",
													children: " "
												})
											}, j))
										}, i)), sheet.rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											colSpan: sheet.columns.length,
											className: "px-3 py-6 text-muted-foreground",
											children: "Nothing in this list."
										}) }) : null] })]
									}),
									sheet.rows.length > 40 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "border-t border-border px-3 py-2 text-xs text-muted-foreground",
										children: [
											"Showing 40 of ",
											sheet.rows.length,
											". Download the file for the full list."
										]
									}) : null
								]
							}, sheet.name))
						})
					]
				}) : null
			]
		})
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
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Menu$1, { className: "size-5" })
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
//#endregion
//#region src/components/desk/username-setup.tsx
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
//#endregion
//#region src/routes/_app.tsx
var Route$19 = createFileRoute("/_app")({ component: DeskLayout });
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
//#region src/routes/login.tsx
var Route$18 = createFileRoute("/login")({ component: Login });
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
				const access = await getMyAccess();
				if (access.needsUsername) {
					writePending(false);
					navigate({ to: "/" });
					return;
				}
				if (access.denied) {
					writePending(false);
					navigate({ to: "/" });
					return;
				}
				if (!access.approved) {
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
	async function onSubmit(e) {
		e.preventDefault();
		setBusy(true);
		setError(null);
		try {
			if (mode === "up") {
				const name = username.trim();
				if (!/^[a-zA-Z0-9._-]{3,32}$/.test(name)) throw new Error("Username must be 3–32 letters, numbers, dots, hyphens, or underscores.");
				if (!(await checkUsername({ data: { username: name } })).available) throw new Error("That username is already taken.");
				const mail = email.trim();
				const res = await authClient.signUp.email({
					email: mail,
					password,
					name
				});
				if (res.error) {
					const msg = res.error.message ?? "";
					if (/already|exist|registered/i.test(msg)) {
						if ((await authClient.signIn.email({
							email: mail,
							password
						})).error) throw new Error("That email already has an account. Sign in with the password you used before.");
					} else throw new Error(res.error.message);
				}
				await authClient.getSession();
				const access = await registerAccount({ data: {
					username: name,
					email: mail
				} });
				await router.invalidate();
				writePending(!access.approved);
				navigate({ to: "/" });
			} else {
				const identity = username.trim();
				const looked = await lookupSignIn({ data: { username: identity } });
				if (looked.invited) {
					const peek = await peekInvite({ data: { identity } });
					setMode("up");
					if (peek.username) setUsername(peek.username);
					if (peek.email) setEmail(peek.email);
					else if (identity.includes("@")) setEmail(identity);
					setError("You’re invited — create an account with this email to get in.");
					return;
				}
				if (!looked.email) throw new Error("Unknown username");
				const res = await authClient.signIn.email({
					email: looked.email,
					password
				});
				if (res.error) throw new Error(res.error.message);
				await authClient.getSession();
				await router.invalidate();
				writePending(!!looked.waiting);
				navigate({ to: "/" });
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Sign-in failed";
			if (/waiting for approval/i.test(msg)) {
				writePending(true);
				setMode("pending");
				return;
			}
			if (/denied access/i.test(msg)) {
				setError("This account was denied access. Ask an admin to invite you again.");
				return;
			}
			if (/unknown username/i.test(msg)) {
				const peek = await peekInvite({ data: { identity: username.trim() } }).catch(() => null);
				if (peek?.invited) {
					setMode("up");
					if (peek.username) setUsername(peek.username);
					if (peek.email) setEmail(peek.email);
					setError("You’re invited — create an account to get in.");
					return;
				}
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
						children: "Your account was created. A desk admin will review it before you can open Katz Desk. Stay signed in and tap check again after they approve you."
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
								authClient.signOut().catch(() => void 0);
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
						children: mode === "up" ? "Use the email you were invited with (or Google / X). Invited people skip the wait." : "Username or the email on your account. Invited people should create an account first."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						onSubmit,
						className: "mt-5 space-y-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "username",
								className: "text-cream/60",
								children: mode === "up" ? "Username" : "Username or email"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "username",
								required: true,
								autoComplete: "username",
								className: "mt-1 border-cream/15 bg-ink text-cream",
								value: username,
								onChange: (e) => setUsername(e.target.value),
								placeholder: mode === "up" ? "e.g. amanda.s" : "username or email"
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
								placeholder: "The email you were invited with"
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
						children: "Google and X still work. Use the same email you were invited with and you’ll be in as soon as you pick a username. Everyone else waits for approval."
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
function DuplicateBadge$1({ duplicateOf, siblingCount }) {
	if (duplicateOf) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		variant: "warn",
		children: "Merged duplicate"
	});
	if (siblingCount && siblingCount > 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		variant: "warn",
		children: "Possible duplicate"
	});
	return null;
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
var CHART_PALETTE = [
	primary,
	ink,
	warning,
	muted,
	cream
];
function useNarrow() {
	const [narrow, setNarrow] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		const mq = window.matchMedia("(max-width: 640px)");
		const sync = () => setNarrow(mq.matches);
		sync();
		mq.addEventListener("change", sync);
		return () => mq.removeEventListener("change", sync);
	}, []);
	return narrow;
}
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
function barWidth(n, max) {
	if (n <= 0 || max <= 0) return 0;
	return Math.min(100, Math.max(Math.round(n / max * 100), 6));
}
function BarTrack({ pct, color = primary, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("block h-2.5 min-w-0 overflow-hidden rounded-full bg-secondary", className),
		"aria-hidden": true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "block h-full max-w-full rounded-full",
			style: {
				width: `${Math.min(Math.max(pct, 0), 100)}%`,
				background: color
			}
		})
	});
}
function BarRow({ name, n, pct, color, label }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
		className: "min-w-0",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-baseline justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "min-w-0 truncate text-sm leading-snug",
					title: name,
					children: name
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "shrink-0 tabular text-sm font-medium",
					children: n
				})]
			}),
			label ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[11px] text-muted-foreground",
				children: label
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BarTrack, {
				pct,
				color,
				className: "mt-1"
			})
		]
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
	const max = Math.max(...data.flatMap((d) => [Number(d[aKey]) || 0, Number(d[bKey]) || 0]), 1);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartKey, { items: [{
			label: aLabel,
			color: primary
		}, {
			label: bLabel,
			color: ink
		}] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "space-y-4",
			children: data.map((row, i) => {
				const name = String(row[xKey] ?? "—");
				const a = Number(row[aKey]) || 0;
				const b = Number(row[bKey]) || 0;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "min-w-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-1.5 truncate text-sm font-medium",
						title: name,
						children: name
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GroupedTrack, {
							label: aLabel,
							n: a,
							pct: barWidth(a, max),
							color: primary
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GroupedTrack, {
							label: bLabel,
							n: b,
							pct: barWidth(b, max),
							color: ink
						})]
					})]
				}, `${name}-${i}`);
			})
		})]
	});
}
function GroupedTrack({ label, n, pct, color }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid min-w-0 grid-cols-[4.25rem_minmax(0,1fr)_1.75rem] items-center gap-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "truncate text-[11px] text-muted-foreground",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BarTrack, {
				pct,
				color,
				className: "h-2"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "tabular text-right text-xs font-medium",
				children: n
			})
		]
	});
}
function SimpleBars({ data, xKey, yKey, yLabel, color = primary, horizontal }) {
	const narrow = useNarrow();
	const max = Math.max(...data.map((d) => Number(d[yKey]) || 0), 1);
	const rows = /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "space-y-2.5",
		children: data.map((row, i) => {
			const name = String(row[xKey] ?? "—");
			const n = Number(row[yKey]) || 0;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BarRow, {
				name,
				n,
				pct: barWidth(n, max),
				color
			}, `${name}-${i}`);
		})
	});
	if (horizontal || narrow || data.length > 8) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0",
		children: [yLabel ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mb-2 text-right text-xs tracking-wide text-muted-foreground uppercase",
			children: yLabel
		}) : null, rows]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0",
		children: [yLabel ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mb-2 text-right text-xs tracking-wide text-muted-foreground uppercase",
			children: yLabel
		}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex h-48 min-w-0 items-end gap-1 sm:gap-2",
			children: data.map((row, i) => {
				const name = String(row[xKey] ?? "—");
				const n = Number(row[yKey]) || 0;
				const pct = barWidth(n, max);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex min-w-0 flex-1 flex-col items-center gap-1",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "tabular text-[11px] font-medium",
							children: n
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex h-36 w-full max-w-8 items-end justify-center",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block w-full max-w-5 overflow-hidden rounded-t-md",
								style: {
									height: `${pct}%`,
									background: color,
									minHeight: n ? "4px" : 0
								},
								title: `${name}: ${n}`
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "w-full truncate text-center text-[10px] leading-tight text-muted-foreground",
							title: name,
							children: name
						})
					]
				}, `${name}-${i}`);
			})
		})]
	});
}
function StackedMoneyBars({ data, xKey, openKey, doneKey }) {
	const max = Math.max(...data.map((d) => (Number(d[openKey]) || 0) + (Number(d[doneKey]) || 0)), 1);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartKey, { items: [{
			label: "Open $",
			color: primary
		}, {
			label: "Completed $",
			color: ink
		}] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "space-y-3",
			children: data.map((row, i) => {
				const name = String(row[xKey] ?? "—");
				const open = Number(row[openKey]) || 0;
				const done = Number(row[doneKey]) || 0;
				const total = open + done;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "min-w-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-baseline justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "min-w-0 truncate text-sm font-medium",
							title: name,
							children: name
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "shrink-0 tabular text-xs font-medium",
							children: usd(total)
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "mt-1 flex h-2.5 min-w-0 overflow-hidden rounded-full bg-secondary",
						"aria-hidden": true,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "h-full max-w-full shrink-0",
							style: {
								width: `${open / max * 100}%`,
								background: primary
							}
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "h-full max-w-full shrink-0",
							style: {
								width: `${done / max * 100}%`,
								background: ink
							}
						})]
					})]
				}, `${name}-${i}`);
			})
		})]
	});
}
function StatusDonut({ data, unit = "total" }) {
	const reduce = useMotion();
	const id = (0, import_react.useId)();
	const total = data.reduce((n, d) => n + d.count, 0);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-w-0 flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative size-36 shrink-0 sm:size-40",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
				width: "100%",
				height: "100%",
				minWidth: 0,
				minHeight: 0,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PieChart, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pie, {
					data,
					dataKey: "count",
					nameKey: "name",
					innerRadius: 40,
					outerRadius: 62,
					paddingAngle: 2,
					isAnimationActive: !reduce,
					label: false,
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
			className: "w-full min-w-0 space-y-1.5 sm:flex-1",
			children: data.map((row, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex min-w-0 items-center gap-2 text-sm",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "size-2 shrink-0 rounded-sm",
						style: { background: CHART_PALETTE[i % CHART_PALETTE.length] }
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "min-w-0 flex-1 truncate leading-snug",
						children: row.name
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "shrink-0 tabular text-xs text-muted-foreground",
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
		className: "mt-3 min-w-0 space-y-2",
		children: items.slice(0, 8).map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BarRow, {
			name: item.name,
			n: item.count,
			pct: barWidth(item.count, max)
		}, item.name))
	});
}
function StatCard({ label, value, hint, tone, breakdown }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "@container min-w-0 overflow-hidden rounded-xl border border-border bg-card px-3 py-3 sm:px-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "truncate text-xs tracking-wide text-muted-foreground uppercase",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: cn("mt-1 font-display text-3xl tabular leading-none", tone === "danger" && "text-destructive", tone === "warn" && "text-warning"),
				children: value
			}),
			hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 line-clamp-2 text-xs text-muted-foreground",
				children: hint
			}) : null,
			breakdown?.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-1 hidden min-w-0 overflow-hidden @[11rem]:block",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BreakdownList, { items: breakdown })
			}) : null
		]
	});
}
function ChartCard({ title, lede, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0 overflow-hidden rounded-xl border border-border bg-card p-4 sm:p-5",
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
				className: "mt-3 min-w-0 overflow-hidden",
				children
			})
		]
	});
}
function MiniStat({ label, value, hint }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0 overflow-hidden rounded-lg bg-muted/70 px-3 py-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "truncate text-[11px] tracking-wide text-muted-foreground uppercase",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-display text-xl tabular leading-tight",
				children: value
			}),
			hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "truncate text-[11px] text-muted-foreground",
				children: hint
			}) : null
		]
	});
}
//#endregion
//#region src/components/desk/sort-bar.tsx
function SortSelect({ value, onChange, options, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: cn("flex max-w-full min-w-0 items-center gap-2", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "shrink-0 text-xs font-medium tracking-wide text-muted-foreground uppercase",
			children: "Sort"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
			"aria-label": "Sort this list",
			value,
			onChange: (e) => onChange(e.target.value),
			className: "h-9 min-w-0 flex-1 rounded-full pr-8",
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
	return raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).length;
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
//#region src/components/desk/mention-field.tsx
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
//#endregion
//#region src/components/desk/ping-button.tsx
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
//#region src/components/desk/ak-badge.tsx
function AkBadge({ on, className }) {
	if (!on) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("inline-flex h-5 items-center rounded-sm bg-ink px-1.5 text-[10px] font-semibold tracking-wide text-cream", className),
		title: "Avi Katz account",
		children: "AK"
	});
}
function NoRepFlag({ show, className }) {
	if (!show) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("text-[11px] font-medium text-warning", className),
		children: "No rep assigned"
	});
}
//#endregion
//#region src/components/desk/coming-due.tsx
var BUCKETS = [
	{
		id: "overdue",
		label: "Overdue"
	},
	{
		id: "today",
		label: "Today"
	},
	{
		id: "week",
		label: "This week"
	},
	{
		id: "later",
		label: "Later"
	}
];
function bucketOf(row, weekEnd) {
	if (row.daysOut < 0) return "overdue";
	if (row.daysOut === 0) return "today";
	if (row.scheduled <= weekEnd) return "week";
	return "later";
}
function kindLabel(row) {
	if (row.kind === "tlc") return "TLC";
	if (row.kind === "pm") return "PM";
	if (row.kind === "install") return "Install";
	return "Service";
}
function ComingDuePanel({ rows, counts, weekEnd, compact }) {
	const grouped = (0, import_react.useMemo)(() => {
		const map = {
			overdue: [],
			today: [],
			week: [],
			later: []
		};
		for (const r of rows) map[bucketOf(r, weekEnd)].push(r);
		return map;
	}, [rows, weekEnd]);
	const [open, setOpen] = (0, import_react.useState)(null);
	const overdue = counts?.overdue ?? grouped.overdue.length;
	const today = counts?.today ?? grouped.today.length;
	const week = counts?.thisWeek ?? grouped.week.length;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0 rounded-xl border border-border bg-card p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-baseline justify-between gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-xl leading-tight",
				children: "Coming due"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[11px] text-muted-foreground",
				children: "Click a row to open the ticket or install."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
				className: "flex flex-wrap gap-1.5 text-[11px]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CountChip, {
						label: "Overdue",
						n: overdue,
						tone: "danger"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CountChip, {
						label: "Today",
						n: today,
						tone: "warn"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CountChip, {
						label: "This week",
						n: week
					})
				]
			})]
		}), rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-3 text-sm text-muted-foreground",
			children: "Nothing overdue or coming due."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: cn("mt-3 space-y-2", compact && "space-y-1.5"),
			children: BUCKETS.map((b) => {
				const list = grouped[b.id];
				if (!list.length) return null;
				const expanded = open === b.id || b.id !== "later" || list.length <= 6;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "flex w-full items-baseline justify-between gap-2 text-left",
					onClick: () => setOpen(open === b.id ? null : b.id),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[11px] font-medium tracking-wide text-muted-foreground uppercase",
						children: b.label
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "tabular text-[11px] text-muted-foreground",
						children: list.length
					})]
				}), expanded ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-1 divide-y divide-border rounded-md border border-border/70",
					children: list.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(OpenLink, {
						entityType: row.entityType,
						id: row.id,
						title: `${row.customer} · ${kindLabel(row)} · ${formatShortDate(row.scheduled)} · ${row.status}${row.wo ? ` · ${row.wo}` : ""}${row.technician || row.accountRep ? ` · ${row.technician || row.accountRep}` : ""}`,
						className: "grid gap-0.5 px-2.5 py-1.5 hover:bg-muted/60 sm:grid-cols-[minmax(0,1.4fr)_5.5rem_4.5rem_auto] sm:items-center sm:gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "flex min-w-0 items-center gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "truncate font-medium",
										children: row.customer
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AkBadge, { on: row.aviKatz })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "block truncate text-[11px] text-muted-foreground",
									children: row.wo || row.detail || row.equipment || "—"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-[11px] text-muted-foreground",
								children: [kindLabel(row), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "mt-0.5 block tabular",
									children: formatShortDate(row.scheduled)
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: row.status }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-[11px] text-muted-foreground",
								children: [row.technician || (row.accountRep ? row.accountRep.split(" ")[0] : "unassigned"), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NoRepFlag, {
									show: row.noRep,
									className: "ml-1"
								})]
							})
						]
					}) }, `${row.entityType}-${row.id}`))
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 text-[11px] text-muted-foreground",
					children: [
						"Tap to show ",
						list.length,
						" later jobs."
					]
				})] }, b.id);
			})
		})]
	});
}
function CountChip({ label, n, tone }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
		className: cn("rounded-full bg-secondary px-2 py-0.5 tabular", tone === "danger" && n > 0 && "bg-destructive/12 text-destructive", tone === "warn" && n > 0 && "bg-warning/12 text-warning"),
		children: [
			label,
			" ",
			n
		]
	});
}
//#endregion
//#region src/components/desk/rep-select.tsx
function useReps() {
	return useQuery({
		queryKey: ["reps"],
		queryFn: () => listReps()
	});
}
function activeReps(reps, current) {
	const list = reps ?? [];
	const active = list.filter((r) => r.active);
	const cur = (current ?? "").trim();
	if (cur && !active.some((r) => r.name === cur) && !list.some((r) => r.name === cur && r.active)) {
		const leftover = list.find((r) => r.name === cur);
		if (leftover) return [...active, leftover];
	}
	return active;
}
function RepSelect({ name = "producer", value, defaultValue, onChange, label = "Rep", id, className }) {
	const q = useReps();
	const current = value ?? defaultValue ?? "";
	const reps = activeReps(q.data?.reps, current);
	const unknown = !!current && isNoRep(current);
	const selected = unknown ? current : current;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className,
		children: [
			label ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
				htmlFor: id,
				children: label
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
				id,
				name,
				className: label ? "mt-1" : void 0,
				value,
				defaultValue: value == null ? defaultValue ?? "" : void 0,
				onChange: onChange ? (e) => onChange(e.target.value) : void 0,
				allowEmpty: true,
				emptyLabel: "—",
				children: [unknown ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
					value: current,
					children: [current, " (unknown)"]
				}) : null, reps.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
					value: r.name,
					children: [
						r.name,
						" (",
						r.initials,
						")"
					]
				}, r.id))]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NoRepFlag, {
				show: isNoRep(selected),
				className: "mt-1 block"
			})
		]
	});
}
function RepFilter({ value, onChange, extraNames, className, includeNone = true }) {
	const q = useReps();
	const names = /* @__PURE__ */ new Map();
	for (const r of q.data?.reps ?? []) if (r.active) names.set(r.name, `${r.name} (${r.initials})`);
	for (const n of extraNames ?? []) {
		const s = (n ?? "").trim();
		if (s && !names.has(s)) names.set(s, isNoRep(s) ? `${s} (unknown)` : formatRep(s));
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
		value,
		onChange: (e) => onChange(e.target.value),
		allowEmpty: true,
		emptyLabel: "All reps",
		className: cn("max-w-xs", className),
		"aria-label": "Filter by rep",
		children: [includeNone ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
			value: "__none__",
			children: "No rep assigned"
		}) : null, [...names.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
			value: name,
			children: label
		}, name))]
	});
}
function RepName({ name }) {
	if (!name?.trim()) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NoRepFlag, { show: true });
	if (isNoRep(name)) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
		name,
		" ",
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NoRepFlag, {
			show: true,
			className: "ml-1"
		})
	] });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: formatRep(name) });
}
//#endregion
//#region src/components/desk/install-planner.tsx
var DAYS = [
	"Mon",
	"Tue",
	"Wed",
	"Thu",
	"Fri",
	"Sat",
	"Sun"
];
function mondayOf(iso) {
	return weekBounds(iso).start;
}
function configPreview(i, recipes) {
	const model = listedEquipment(i.equipment, [])[0] || i.equipment || "";
	const { linked, house } = findRecipeFor(recipes, {
		customer: i.customer,
		model,
		installId: i.id
	});
	const rec = linked ?? house;
	if (!rec) return "";
	return previewSetting(settingsFrom(rec))?.slice(0, 48) ?? "";
}
function InstallPlanner({ installs, recipes = [], myRep, catalog = [] }) {
	const today = todayChicago();
	const [anchor, setAnchor] = (0, import_react.useState)(mondayOf(today));
	const week = weekBounds(anchor);
	const days = DAYS.map((_, i) => addDays(week.start, i));
	const [rep, setRep] = (0, import_react.useState)("");
	const [ready, setReady] = (0, import_react.useState)("all");
	const [akOnly, setAkOnly] = (0, import_react.useState)(false);
	const [from, setFrom] = (0, import_react.useState)("");
	const [to, setTo] = (0, import_react.useState)("");
	const qc = useQueryClient();
	const saveDate = useMutation({
		mutationFn: (d) => updateInstall({ data: d }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["installs"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not reschedule")
	});
	const open = (0, import_react.useMemo)(() => installs.filter((i) => !i.complete && i.equipStatus !== "Installed"), [installs]);
	const rows = (0, import_react.useMemo)(() => {
		let list = open;
		if (rep === "__none__") list = list.filter((i) => i.noRep);
		else if (rep) list = list.filter((i) => sameRep(i.accountRep, rep));
		if (ready === "ready") list = list.filter((i) => i.equipStatus === "Ready");
		if (ready === "not") list = list.filter((i) => i.equipStatus !== "Ready");
		if (akOnly) list = list.filter((i) => i.aviKatz);
		if (from) list = list.filter((i) => (i.installDate ?? "") >= from);
		if (to) list = list.filter((i) => (i.installDate ?? "") <= to);
		return [...list].sort((a, b) => (a.installDate ?? "9999").localeCompare(b.installDate ?? "9999") || a.customer.localeCompare(b.customer));
	}, [
		open,
		rep,
		ready,
		akOnly,
		from,
		to
	]);
	const weekRows = rows.filter((i) => i.installDate && i.installDate >= week.start && i.installDate <= week.end);
	const dayCounts = /* @__PURE__ */ new Map();
	for (const i of weekRows) if (i.installDate) dayCounts.set(i.installDate, (dayCounts.get(i.installDate) ?? 0) + 1);
	const techWeek = /* @__PURE__ */ new Map();
	for (const i of weekRows) {
		const t = (i.technician || i.accountRep || "unassigned").toLowerCase();
		techWeek.set(t, (techWeek.get(t) ?? 0) + 1);
	}
	function conflict(i) {
		if (!i.installDate) return null;
		if ((dayCounts.get(i.installDate) ?? 0) > 1) return "day";
		const t = (i.technician || i.accountRep || "unassigned").toLowerCase();
		if ((techWeek.get(t) ?? 0) > 1) return "week";
		return null;
	}
	function jump(delta) {
		setAnchor(addDays(week.start, delta * 7));
	}
	function printWeek() {
		const w = window.open("", "_blank", "noopener,noreferrer,width=980,height=720");
		if (!w) {
			toast.error("Allow pop-ups to print the planner.");
			return;
		}
		const body = rows.map((i) => {
			const hit = i.installDate && i.installDate >= week.start && i.installDate <= week.end ? "this week" : "";
			return `<tr><td>${esc(i.customer)}</td><td>${esc(i.equipment ?? "")}</td><td>${esc(i.equipStatus ?? "")}</td><td>${esc(i.installDate ?? "")}</td><td>${esc(i.accountRep ?? "")}</td><td>${esc(i.technician ?? "")}</td><td>${hit}</td></tr>`;
		}).join("");
		w.document.write(`<!doctype html><html><head><title>Install planner</title>
      <style>
        body { font: 13px/1.4 system-ui, sans-serif; padding: 24px; color: #1a1612; }
        h1 { font-size: 20px; margin: 0 0 8px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #d7cfc4; padding: 6px 8px; text-align: left; }
        th { background: #f4efe8; }
      </style></head><body>
      <h1>Install planner · ${week.start} – ${week.end}</h1>
      <table><thead><tr><th>Account</th><th>Equipment</th><th>Ready</th><th>Install date</th><th>Rep</th><th>Tech</th><th>This week</th></tr></thead>
      <tbody>${body}</tbody></table></body></html>`);
		w.document.close();
		w.focus();
		w.print();
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0 rounded-xl border border-border bg-card p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-start justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-xl leading-tight",
					children: "Install planner"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[11px] text-muted-foreground",
					children: "One bar per project. Overlaps in the same week light up. Changing a date here updates the install date used on exports."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							size: "sm",
							variant: "outline",
							onClick: () => jump(-1),
							"aria-label": "Previous week",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "size-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							size: "sm",
							variant: "outline",
							onClick: () => setAnchor(mondayOf(today)),
							children: "This week"
						}),
						myRep ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							size: "sm",
							variant: rep === myRep ? "ink" : "outline",
							onClick: () => setRep(rep === myRep ? "" : myRep),
							children: "My week"
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							size: "sm",
							variant: "outline",
							onClick: () => jump(1),
							"aria-label": "Next week",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							type: "button",
							size: "sm",
							variant: "outline",
							onClick: printWeek,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Printer, { className: "size-4" }), "Print"]
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-2 text-sm text-muted-foreground",
				children: [
					formatShortDate(week.start),
					" – ",
					formatShortDate(week.end),
					" · ",
					weekRows.length,
					" on the timeline this week"
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex flex-wrap items-end gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RepFilter, {
						value: rep,
						onChange: setRep,
						extraNames: open.map((i) => i.accountRep),
						className: "w-44"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
						className: "h-10 rounded-md border border-input bg-card px-3 text-sm",
						value: ready,
						onChange: (e) => setReady(e.target.value),
						"aria-label": "Ready filter",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "all",
								children: "Ready + not ready"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "ready",
								children: "Ready"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "not",
								children: "Not ready"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "flex h-10 items-center gap-2 rounded-md border border-input px-3 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "checkbox",
							className: "size-4 accent-primary",
							checked: akOnly,
							onChange: (e) => setAkOnly(e.target.checked)
						}), "AK"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						type: "date",
						value: from,
						onChange: (e) => setFrom(e.target.value),
						"aria-label": "From date",
						className: "w-36"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						type: "date",
						value: to,
						onChange: (e) => setTo(e.target.value),
						"aria-label": "To date",
						className: "w-36"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4 overflow-x-auto",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-[40rem]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-[minmax(10rem,1.4fr)_repeat(7,minmax(2.4rem,1fr))] gap-1 text-[10px] tracking-wide text-muted-foreground uppercase",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Project" }), days.map((d, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: cn("text-center", d === today && "font-semibold text-foreground"),
							children: [
								DAYS[i],
								" ",
								formatShortDate(d)
							]
						}, d))]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
						className: "mt-1 space-y-1",
						children: [rows.map((i) => {
							const col = i.installDate && i.installDate >= week.start && i.installDate <= week.end && i.installDate ? days.indexOf(i.installDate) : -1;
							const clash = conflict(i);
							const cfg = configPreview(i, recipes);
							const models = listedEquipment(i.equipment, catalog).join(" · ") || i.equipment || "—";
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: cn("grid grid-cols-[minmax(10rem,1.4fr)_repeat(7,minmax(2.4rem,1fr))] items-stretch gap-1 rounded-md border border-transparent px-0.5 py-0.5", clash === "day" && "border-destructive/40 bg-destructive/6", clash === "week" && "border-warning/40 bg-warning/8"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0 py-1 pr-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(OpenLink, {
											entityType: "install",
											id: i.id,
											className: "flex min-w-0 items-center gap-1.5 hover:underline",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "truncate font-medium",
												children: i.customer
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AkBadge, { on: i.aviKatz })]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "truncate text-[11px] text-muted-foreground",
											children: models
										}),
										cfg ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "truncate text-[11px] text-muted-foreground",
											children: cfg
										}) : null,
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "mt-0.5 flex flex-wrap items-center gap-1.5",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: i.equipStatus === "Ready" ? "Ready" : "Not Ready" }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RepName, { name: i.accountRep }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NoRepFlag, { show: i.noRep })
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: "mt-1 block text-[11px] text-muted-foreground",
											children: ["Date", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "date",
												className: "ml-1 rounded border border-input bg-card px-1 py-0.5 text-xs text-foreground",
												value: i.installDate ?? "",
												onChange: (e) => saveDate.mutate({
													id: i.id,
													installDate: e.target.value || null
												})
											})]
										})
									]
								}), days.map((d, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: cn("relative min-h-10 rounded-sm bg-secondary/50", d === today && "ring-1 ring-primary/40"),
									children: col === idx ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: cn("absolute inset-1 rounded-sm bg-primary/80", clash === "day" && "bg-destructive", clash === "week" && "bg-warning"),
										title: `${i.customer} · ${formatShortDate(d)}`
									}) : null
								}, d))]
							}, i.id);
						}), rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "px-1 py-6 text-sm text-muted-foreground",
							children: "No installs match these filters."
						}) : null]
					})]
				})
			})
		]
	});
}
function esc(s) {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
//#endregion
//#region src/components/desk/rebuild-alerts.tsx
function RebuildAlerts({ rows }) {
	if (!rows.length) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0 rounded-xl border border-destructive/30 bg-card p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-baseline justify-between gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-xl leading-tight",
				children: "Rebuild"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[11px] text-muted-foreground",
				children: "Overdue or waiting more than 5 days. Field Coming due is unchanged."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/rebuilds",
				className: "text-xs text-muted-foreground hover:text-foreground",
				children: "Open rebuilds"
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-3 divide-y divide-border",
			children: rows.slice(0, 8).map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "py-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-start justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OpenLink, {
						entityType: "rebuild",
						id: r.id,
						className: "min-w-0 font-medium hover:underline",
						children: r.detail || r.customer
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
						variant: r.flag.level === "danger" ? "danger" : "warn",
						children: r.flag.label
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-0.5 text-xs text-muted-foreground",
					children: [
						r.customer,
						" · ",
						r.technician || "No owner",
						r.scheduled ? ` · target ${formatShortDate(r.scheduled)}` : "",
						" · ",
						r.status
					]
				})]
			}, r.id))
		})]
	});
}
//#endregion
//#region src/routes/_app/index.tsx
var Route$17 = createFileRoute("/_app/")({ component: ClockHome });
function ClockHome() {
	const dash = useQuery({
		queryKey: ["dashboard"],
		queryFn: () => getDashboard()
	});
	const installs = useQuery({
		queryKey: ["installs"],
		queryFn: () => listInstalls()
	});
	const recs = useQuery({
		queryKey: ["recipes"],
		queryFn: () => listRecipes()
	});
	const { role, filterMine, matchMine, compact } = useMyView();
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
	const dueRows = filterMine ? d.comingDue.filter((r) => role === "sales" ? matchMine(r.accountRep) || r.aviKatz : matchMine(r.technician) || !r.technician) : d.comingDue;
	const salesPrimary = role === "sales";
	const weekEnd = weekBounds(d.today).end;
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
							d.nextWeekLabel,
							role ? ` · ${role === "sales" ? "Sales" : "Service"} view` : ""
						]
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MyViewBar, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/handoff",
						className: "text-sm font-medium text-primary underline-offset-4 hover:underline",
						children: "Open handoff feed"
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniStat, {
						label: "Active calls",
						value: d.kpis.activeCalls,
						hint: "Service + TLC still open"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniStat, {
						label: "Coming due",
						value: d.kpis.comingDue,
						hint: "Overdue + today + this week"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniStat, {
						label: "Install queue",
						value: d.kpis.installQueue,
						hint: `${d.kpis.installAtRisk} at risk`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniStat, {
						label: "PMs active",
						value: d.kpis.pmsActive
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniStat, {
						label: "Rebuilds",
						value: (d.kpis.rebuildOverdue ?? 0) + (d.kpis.rebuildWaiting ?? 0),
						hint: `${d.kpis.rebuildOverdue ?? 0} overdue · ${d.kpis.rebuildWaiting ?? 0} waiting`
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
				className: "grid min-w-0 gap-3 md:grid-cols-3",
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
				className: "grid min-w-0 gap-4 lg:grid-cols-2",
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
				}), salesPrimary ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
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
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ComingDuePanel, {
					rows: dueRows,
					counts: d.comingDueCounts,
					weekEnd,
					compact
				})]
			}),
			salesPrimary ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ComingDuePanel, {
				rows: dueRows,
				counts: d.comingDueCounts,
				weekEnd,
				compact
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InstallPlanner, {
				installs: installs.data ?? [],
				recipes: recs.data ?? [],
				myRep: null
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RebuildAlerts, { rows: d.rebuildAlerts ?? [] }),
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
				}), salesPrimary ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-xl border border-border bg-card p-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-baseline justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-xl",
							children: "Latest handoff"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/handoff",
							className: "text-xs text-muted-foreground hover:text-foreground",
							children: "All notes"
						})]
					}), d.recentHandoff.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-sm text-muted-foreground",
						children: "No notes yet."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-3 space-y-3",
						children: d.recentHandoff.slice(0, 5).map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-medium",
								children: c.ownerLabel
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-muted-foreground",
								children: [" on ", c.customer ?? c.entityType]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "line-clamp-2 text-sm text-muted-foreground",
							children: c.body
						})] }, c.id))
					})]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
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
				className: "grid min-w-0 gap-4 lg:grid-cols-3",
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
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
				className: "grid gap-4 lg:grid-cols-[1.4fr_1fr]",
				children: salesPrimary ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-xl border border-border bg-card p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-baseline justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "font-display text-xl",
								children: "Install readiness"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/installs",
								className: "text-xs text-muted-foreground hover:text-foreground",
								children: "Open installs"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-2 text-sm text-muted-foreground",
							children: [
								d.kpis.installReady,
								" ready · ",
								d.kpis.installQueue,
								" in queue · ",
								d.kpis.installAtRisk,
								" at risk"
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InstallPlanner, {
							installs: (installs.data ?? []).filter((i) => !filterMine || matchMine(i.accountRep) || i.aviKatz),
							recipes: recs.data ?? [],
							myRep: null
						})
					]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
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
									children: c.ownerLabel
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
				})
			})
		]
	});
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
		className: "min-w-0 rounded-xl border border-border bg-card p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "min-w-0 text-balance font-display text-xl leading-snug",
					children: title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: href,
					className: "mt-1 shrink-0 text-xs text-muted-foreground hover:text-foreground",
					children: "Open"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 min-w-0",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
					value: sort,
					onChange: setSort,
					options: [
						...SORT_FLAG,
						...SORT_DATE,
						...SORT_ALPHA,
						...SORT_STATUS
					],
					className: "w-full"
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
//#endregion
//#region src/routes/_app/access.tsx
var Route$16 = createFileRoute("/_app/access")({ component: Page$15 });
function inviteBody(inv, origin) {
	return `You're invited to Katz Desk.

Open this link and create an account:
${origin}/login

Use ${[inv.username ? `username ${inv.username}` : null, inv.email ? `email ${inv.email}` : null].filter(Boolean).join(" or ") || "the username you were given"}. Invited accounts skip the wait.

If you already use Google or X, sign in with that, pick a username, and you'll be in.`;
}
function copyText(text) {
	return navigator.clipboard.writeText(text).then(() => toast.success("Copied"), () => toast.error("Could not copy"));
}
function Page$15() {
	const qc = useQueryClient();
	const me = useQuery({
		queryKey: ["access", "me"],
		queryFn: () => getMyAccess()
	});
	const list = useQuery({
		queryKey: ["access", "list"],
		queryFn: () => listDeskAccounts(),
		enabled: !!me.data?.isAdmin,
		refetchInterval: 8e3
	});
	const invites = useQuery({
		queryKey: ["access", "invites"],
		queryFn: () => listDeskInvites(),
		enabled: !!me.data?.isAdmin,
		refetchInterval: 8e3
	});
	const [email, setEmail] = (0, import_react.useState)("");
	const [username, setUsername] = (0, import_react.useState)("");
	const [inviteCanAdd, setInviteCanAdd] = (0, import_react.useState)(true);
	const setApproved = useMutation({
		mutationFn: (d) => setAccountApproved({ data: d }),
		onSuccess: (row) => {
			toast.success(row.approved ? `Approved ${row.username}` : `Revoked ${row.username}`);
			qc.invalidateQueries({ queryKey: ["access"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Failed")
	});
	const setPerm = useMutation({
		mutationFn: (d) => setAccountCanAddCustomers({ data: d }),
		onSuccess: (row) => {
			toast.success(row.canAddCustomers ? `${row.username} can add customers` : `Removed add-customer permission from ${row.username}`);
			qc.invalidateQueries({ queryKey: ["access"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Failed")
	});
	const grantAll = useMutation({
		mutationFn: () => grantAllCanAddCustomers(),
		onSuccess: (res) => {
			toast.success(res.updated ? `Granted add-customer permission to ${res.updated} ${res.updated === 1 ? "person" : "people"}` : "Everyone approved can already add customers");
			qc.invalidateQueries({ queryKey: ["access"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Failed")
	});
	const setRole = useMutation({
		mutationFn: (d) => setAccountRole({ data: d }),
		onSuccess: (row) => {
			toast.success(row.role ? `${row.username} is ${row.role === "sales" ? "Sales" : "Service"}` : `${row.username} has no role yet`);
			qc.invalidateQueries({ queryKey: ["access"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not set role")
	});
	const deny = useMutation({
		mutationFn: (userId) => denyAccount({ data: { userId } }),
		onSuccess: (row) => {
			toast.success(`Denied ${row.username}`);
			qc.invalidateQueries({ queryKey: ["access"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Failed")
	});
	const invite = useMutation({
		mutationFn: (d) => createInvite({ data: d }),
		onSuccess: (res) => {
			if (res.autoApproved.length) toast.success(`Approved ${res.autoApproved.join(", ")}`);
			else if (res.invite.status === "pending") toast.success("Invite saved. Copy the message and send it to them.");
			setEmail("");
			setUsername("");
			qc.invalidateQueries({ queryKey: ["access"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not invite")
	});
	const revoke = useMutation({
		mutationFn: (id) => revokeInvite({ data: { id } }),
		onSuccess: () => {
			toast.success("Invite revoked");
			qc.invalidateQueries({ queryKey: ["access"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Failed")
	});
	const [sort, setSort] = useDeskSort("access", "date-desc");
	const signingUp = (list.data ?? []).filter((a) => !a.usernameChosen && !a.denied);
	const pending = (list.data ?? []).filter((a) => !a.approved && !a.denied && a.usernameChosen);
	const denied = (list.data ?? []).filter((a) => a.denied && !a.approved);
	const active = (0, import_react.useMemo)(() => sortDesk(list.data ?? [], sort, {
		date: (a) => a.createdAt,
		name: (a) => a.username
	}).filter((a) => a.approved && a.usernameChosen), [list.data, sort]);
	const canAssignRoles = !!me.data?.canAssignRoles;
	const needsRole = active.filter((a) => !a.role);
	const pendingInvites = invites.data ?? [];
	const origin = typeof window !== "undefined" ? window.location.origin : "";
	function onInvite(e) {
		e.preventDefault();
		invite.mutate({
			email: email.trim() || void 0,
			username: username.trim() || void 0,
			canAddCustomers: inviteCanAdd
		});
	}
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
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 max-w-xl text-sm text-muted-foreground",
				children: ["Save an invite, then send them the login link. They get in as soon as they create an account with that email or username — no extra approval click. Grant “add customers” so they can put new account names on the list.", canAssignRoles ? " Assign Sales or Service so My View lands on the right boards. Unassigned people stay flagged until you pick a role." : ""]
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
			className: "mt-6 rounded-xl border border-border bg-card p-4 sm:p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-xs tracking-wide text-muted-foreground uppercase",
					children: "Invite people"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted-foreground",
					children: "Email, username, or both. The desk does not send the email for you — copy the invite after saving and send it yourself. If they already signed up, inviting them approves them now."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					onSubmit: onInvite,
					className: "mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "invite-email",
							children: "Email"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "invite-email",
							type: "email",
							autoComplete: "off",
							className: "mt-1",
							placeholder: "name@katzcoffee.com",
							value: email,
							onChange: (e) => setEmail(e.target.value)
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "invite-username",
							children: "Username"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "invite-username",
							autoComplete: "off",
							className: "mt-1",
							placeholder: "optional, e.g. amanda.s",
							value: username,
							onChange: (e) => setUsername(e.target.value)
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							disabled: invite.isPending,
							className: "h-10",
							children: invite.isPending ? "Saving…" : "Save invite"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "mt-4 flex items-start gap-2 text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "checkbox",
						className: "mt-0.5 size-4 accent-primary",
						checked: inviteCanAdd,
						onChange: (e) => setInviteCanAdd(e.target.checked)
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Allow them to add new customer names", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mt-0.5 block text-xs text-muted-foreground",
						children: "They still cannot rename or remove accounts. Turn this off if they should only pick from the existing list."
					})] })]
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-8",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: [
					"Pending invites (",
					pendingInvites.length,
					")"
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
				className: "mt-2 overflow-hidden rounded-xl border border-border bg-card",
				children: [pendingInvites.map((inv) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InviteRow, {
					inv,
					origin,
					onRevoke: () => revoke.mutate(inv.id),
					revoking: revoke.isPending
				}, inv.id)), pendingInvites.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "px-4 py-6 text-sm text-muted-foreground",
					children: "No pending invites."
				}) : null]
			})]
		}),
		signingUp.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
					className: "text-xs tracking-wide text-muted-foreground uppercase",
					children: [
						"Signing up (",
						signingUp.length,
						")"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted-foreground",
					children: "They reached the desk but haven’t picked a username yet. They’ll show as approved or waiting once they finish."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-2 overflow-hidden rounded-xl border border-border bg-card",
					children: signingUp.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-medium",
								children: a.username
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "truncate text-sm text-muted-foreground",
								children: [a.email ?? "No email", a.approved ? " · invited, finishing setup" : " · finishing setup"]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap gap-2",
							children: [!a.approved ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								disabled: setApproved.isPending,
								onClick: () => setApproved.mutate({
									userId: a.userId,
									approved: true
								}),
								children: "Approve"
							}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								variant: "outline",
								disabled: deny.isPending,
								onClick: () => deny.mutate(a.userId),
								children: "Deny"
							})]
						})]
					}, a.userId))
				})
			]
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-8",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: [
					"Waiting for approval (",
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
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							disabled: setApproved.isPending,
							onClick: () => setApproved.mutate({
								userId: a.userId,
								approved: true
							}),
							children: "Approve"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "outline",
							disabled: deny.isPending,
							onClick: () => deny.mutate(a.userId),
							children: "Deny"
						})]
					})]
				}, a.userId)), pending.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "px-4 py-6 text-sm text-muted-foreground",
					children: "No one is waiting."
				}) : null]
			})]
		}),
		denied.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-8",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: [
					"Denied (",
					denied.length,
					")"
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-2 overflow-hidden rounded-xl border border-border bg-card",
				children: denied.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
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
				}, a.userId))
			})]
		}) : null,
		canAssignRoles && needsRole.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
					className: "text-xs tracking-wide text-warning uppercase",
					children: [
						"Needs a role (",
						needsRole.length,
						")"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted-foreground",
					children: "Existing logins stay unassigned until you pick Sales or Service. Role only changes My View defaults — it does not hide tickets."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-2 overflow-hidden rounded-xl border border-warning/40 bg-card",
					children: needsRole.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
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
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RolePicker, {
							value: a.role,
							disabled: setRole.isPending,
							onChange: (role) => setRole.mutate({
								userId: a.userId,
								role
							})
						})]
					}, `role-${a.userId}`))
				})
			]
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-8",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
					className: "text-xs tracking-wide text-muted-foreground uppercase",
					children: [
						"Approved (",
						active.length,
						")"
					]
				}), active.some((a) => !a.isAdmin && !a.canAddCustomers) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					variant: "outline",
					disabled: grantAll.isPending,
					onClick: () => grantAll.mutate(),
					children: "Allow all to add customers"
				}) : null]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-2 overflow-hidden rounded-xl border border-border bg-card",
				children: active.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "font-medium",
							children: [
								a.username,
								a.isAdmin ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ml-2 text-xs text-muted-foreground",
									children: "admin"
								}) : a.canAddCustomers ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ml-2 text-xs text-muted-foreground",
									children: "can add customers"
								}) : null,
								canAssignRoles && a.role ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ml-2 text-xs text-muted-foreground",
									children: a.role
								}) : canAssignRoles && !a.role ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ml-2 text-xs text-warning",
									children: "needs role"
								}) : null
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "truncate text-sm text-muted-foreground",
							children: a.email ?? "No email"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-2",
						children: [canAssignRoles ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RolePicker, {
							value: a.role,
							disabled: setRole.isPending,
							onChange: (role) => setRole.mutate({
								userId: a.userId,
								role
							})
						}) : null, !a.isAdmin ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: a.canAddCustomers ? "ink" : "outline",
							disabled: setPerm.isPending,
							onClick: () => setPerm.mutate({
								userId: a.userId,
								canAddCustomers: !a.canAddCustomers
							}),
							children: a.canAddCustomers ? "Can add customers" : "Allow add customers"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "outline",
							disabled: setApproved.isPending,
							onClick: () => setApproved.mutate({
								userId: a.userId,
								approved: false
							}),
							children: "Revoke"
						})] }) : null]
					})]
				}, a.userId))
			})]
		})
	] });
}
function RolePicker({ value, onChange, disabled }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
		className: "h-9 w-36",
		value: value ?? "",
		disabled,
		onChange: (e) => {
			const v = e.target.value;
			onChange(v === "sales" || v === "service" ? v : null);
		},
		allowEmpty: true,
		emptyLabel: "Needs role",
		"aria-label": "Role",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
			value: "sales",
			children: "Sales"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
			value: "service",
			children: "Service"
		})]
	});
}
function InviteRow({ inv, origin, onRevoke, revoking }) {
	const body = inviteBody(inv, origin);
	const mailto = inv.email ? `mailto:${encodeURIComponent(inv.email)}?subject=${encodeURIComponent("You're invited to Katz Desk")}&body=${encodeURIComponent(body)}` : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
		className: "flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "min-w-0",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-medium",
				children: inv.username || inv.email || "Invite"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "truncate text-sm text-muted-foreground",
				children: [
					[inv.email, inv.username && inv.email ? `@${inv.username}` : null].filter(Boolean).join(" · ") || "No email",
					` · from ${inv.invitedBy}`,
					inv.canAddCustomers ? " · can add customers" : ""
				]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					variant: "outline",
					onClick: () => void copyText(body),
					children: "Copy invite"
				}),
				mailto ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					variant: "outline",
					asChild: true,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: mailto,
						children: "Email them"
					})
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					variant: "outline",
					disabled: revoking,
					onClick: onRevoke,
					children: "Revoke"
				})
			]
		})]
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
//#region src/components/desk/activity-trail.tsx
function actionLine(action, detail) {
	if (action === "opened") return detail ? `opened this · ${detail}` : "opened this";
	if (action === "note") return detail ? `left a note · ${detail}` : "left a note";
	if (action === "status") return detail ?? "updated status";
	if (action === "reason") return detail ?? "updated reason delayed";
	if (action === "assigned-asset") return detail ?? "assigned equipment";
	if (action === "unassigned-asset") return detail ? `removed ${detail}` : "removed equipment";
	if (action === "returned") return detail ? `returned to ${detail}` : "returned to warehouse";
	if (action === "sold") return detail ? `sold to ${detail}` : "marked sold";
	if (action === "updated") return detail ?? "saved changes";
	return detail || action;
}
function when(iso) {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "";
	return d.toLocaleString("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit"
	});
}
function ActivityTrail({ entityType, entityId }) {
	const rows = useQuery({
		queryKey: [
			"activity",
			entityType,
			entityId
		],
		queryFn: () => listActivity({ data: {
			entityType,
			entityId
		} }),
		refetchInterval: 8e3
	}).data ?? [];
	if (!rows.length) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "border-t border-border px-5 py-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "font-display text-lg font-medium",
				children: "Who changed this"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted-foreground",
				children: "Every save and assignment is tagged to a username."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
				className: "mt-3 space-y-2",
				children: rows.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex flex-wrap items-baseline justify-between gap-2 text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "font-medium",
							children: ["@", a.actorName ?? "teammate"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-muted-foreground",
							children: [" ", actionLine(a.action, a.detail)]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("time", {
						className: "shrink-0 text-xs text-muted-foreground",
						children: when(a.createdAt)
					})]
				}, a.id))
			})
		]
	});
}
//#endregion
//#region src/components/desk/thread.tsx
function Thread({ entityType, entityId }) {
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
	const teammates = useQuery({
		queryKey: ["teammates"],
		queryFn: () => listTeammates()
	});
	const add = useMutation({
		mutationFn: () => addComment({ data: {
			entityType,
			entityId,
			body,
			askTeam: ask || null
		} }),
		onSuccess: () => {
			setBody("");
			setAsk("");
			qc.invalidateQueries({ queryKey: [
				"comments",
				entityType,
				entityId
			] });
			qc.invalidateQueries({ queryKey: [
				"activity",
				entityType,
				entityId
			] });
			qc.invalidateQueries({ queryKey: ["handoff"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["notifications"] });
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
	const claim = useMutation({
		mutationFn: (id) => claimComment({ data: { id } }),
		onSuccess: () => {
			toast.success("Note is under your name");
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
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActivityTrail, {
				entityType,
				entityId
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "px-5 pt-4 font-display text-lg font-medium",
				children: "Handoff notes"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-5 text-xs text-muted-foreground",
				children: "Tag a teammate with @username. Ping sends them a bell notification."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-3 px-5 py-4",
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
								children: c.ownerLabel
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
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MentionBody, { text: c.body }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-2 flex flex-wrap items-center gap-2",
							children: [
								c.askTeam && !c.resolved ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
									variant: "warn",
									children: ["Ask ", c.askTeam]
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PingButton, {
									size: "xs",
									entityType,
									entityId,
									commentId: c.id,
									pingedAt: c.pingedAt,
									contextLabel: `${entityType} #${entityId} · ${c.body.slice(0, 80)}`,
									defaultNote: c.body
								}),
								c.canClaim ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "h-8 rounded-full px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
									disabled: claim.isPending,
									onClick: () => claim.mutate(c.id),
									children: "Claim"
								}) : null,
								c.askTeam && !c.resolved ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "text-xs text-muted-foreground underline-offset-2 hover:underline",
									onClick: () => resolve.mutate(c.id),
									children: "Mark answered"
								}) : null
							]
						})
					]
				}, c.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "border-t border-border p-4",
				onSubmit: (e) => {
					e.preventDefault();
					if (body.trim()) add.mutate();
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MentionField, {
					multiline: true,
					value: body,
					onChange: setBody,
					teammates: teammates.data ?? [],
					placeholder: "Write a note… tag @username to ping them"
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
							contextLabel: `Follow up on this ${entityType}`,
							defaultNote: body
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
//#region src/components/ui/combo-field.tsx
function rank(q, name) {
	const n = String(name ?? "").toLowerCase();
	const s = q.toLowerCase().trim();
	if (!n) return -1;
	if (!s) return 1;
	if (n === s) return 100;
	if (n.startsWith(s)) return 80;
	const idx = n.indexOf(s);
	if (idx >= 0) return 60 - Math.min(idx, 40);
	const tokens = s.split(/[^a-z0-9]+/).filter(Boolean);
	if (tokens.length > 1 && tokens.every((t) => n.includes(t))) return 45;
	if (tokens.length === 1 && tokens[0].length >= 3 && n.includes(tokens[0])) return 30;
	return -1;
}
function createdName(result, fallback) {
	if (typeof result === "string" && result.trim()) return result.trim();
	if (result && typeof result === "object" && "name" in result) {
		const n = result.name;
		if (typeof n === "string" && n.trim()) return n.trim();
	}
	return fallback;
}
var fieldClass = "flex min-h-11 w-full items-center gap-2 rounded-full border border-input bg-background px-3 text-left text-sm focus-within:ring-2 focus-within:ring-ring";
function useDismiss(open, onClose) {
	const ref = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		if (!open) return;
		function onDoc(e) {
			if (!ref.current?.contains(e.target)) onClose();
		}
		document.addEventListener("mousedown", onDoc);
		return () => document.removeEventListener("mousedown", onDoc);
	}, [open, onClose]);
	return ref;
}
function Menu({ children, notFound, notFoundText }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		"data-combo-popover": "",
		className: "absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-soft",
		children: [notFound ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "px-2 py-1.5 text-xs text-muted-foreground",
			children: notFoundText
		}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "max-h-80 overflow-y-auto py-1",
			role: "listbox",
			children
		})]
	});
}
function ItemTools({ item, noun, onRenameItem, onRemoveItem }) {
	if (!onRenameItem && !onRemoveItem) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: "flex shrink-0 items-center",
		children: [onRenameItem ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: "flex size-9 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground",
			"aria-label": `Rename ${item.name}`,
			title: `Rename this ${noun}`,
			onMouseDown: (e) => {
				e.preventDefault();
				e.stopPropagation();
				onRenameItem(item);
			},
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "size-3.5" })
		}) : null, onRemoveItem ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: "flex size-9 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-destructive",
			"aria-label": `Remove ${item.name} from the list`,
			title: "Remove from the master list",
			onMouseDown: (e) => {
				e.preventDefault();
				e.stopPropagation();
				onRemoveItem(item);
			},
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" })
		}) : null]
	});
}
function ComboField({ label, name, value, onChange, items, placeholder = "Search…", required, disabled, allowCreate = true, onCreate, onRemoveItem, onRenameItem, noun = "name", emptyHint = "No matches." }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	const [q, setQ] = (0, import_react.useState)("");
	const inputRef = (0, import_react.useRef)(null);
	const rootRef = useDismiss(open, () => {
		setOpen(false);
		setQ("");
	});
	const query = open ? q : "";
	const matches = (0, import_react.useMemo)(() => {
		return items.map((item) => ({
			item,
			score: rank(query, item.name)
		})).filter((x) => x.score >= 0).sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name)).map((x) => x.item);
	}, [items, query]);
	const needle = query.trim();
	const exact = items.some((i) => String(i.name ?? "").toLowerCase() === needle.toLowerCase());
	const canCreate = allowCreate && needle.length >= 2 && !exact;
	const notFound = needle.length >= 2 && matches.length === 0;
	function pick(next) {
		onChange(next);
		setQ("");
		setOpen(false);
	}
	async function create() {
		const next = needle;
		if (!next) return;
		try {
			pick(createdName(await onCreate?.(next), next));
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Could not add that name");
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		label ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: label }) : null,
		name ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			type: "hidden",
			name,
			value,
			required
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			ref: rootRef,
			className: cn("relative", label ? "mt-1" : "mt-0"),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: cn(fieldClass, disabled && "opacity-50"),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						ref: inputRef,
						disabled,
						value: open ? q : value,
						placeholder,
						autoComplete: "off",
						"aria-label": label || `Search ${noun}`,
						"aria-expanded": open,
						"aria-autocomplete": "list",
						role: "combobox",
						className: "min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground",
						onChange: (e) => {
							setQ(e.target.value);
							if (!open) setOpen(true);
						},
						onFocus: () => {
							setOpen(true);
							setQ("");
						},
						onKeyDown: (e) => {
							if (e.key === "Escape") {
								setOpen(false);
								inputRef.current?.blur();
							}
							if (e.key === "Enter") {
								e.preventDefault();
								if (canCreate && !matches[0]) create();
								else if (matches[0]) pick(matches[0].name);
								else if (canCreate) create();
							}
						}
					}),
					value && !open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground",
						"aria-label": "Clear",
						onMouseDown: (e) => {
							e.preventDefault();
							onChange("");
							setQ("");
						},
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" })
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronsUpDown, { className: "size-4 shrink-0 text-muted-foreground" })
				]
			}), open ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Menu, {
				notFound,
				notFoundText: allowCreate ? `This ${noun} isn’t on the list. Use + to add it.` : emptyHint,
				children: [
					canCreate ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "flex min-h-10 w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm font-medium hover:bg-muted",
						onMouseDown: (e) => {
							e.preventDefault();
							create();
						},
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5 shrink-0" }), needle]
					}) }) : null,
					matches.map((item) => {
						const selected = item.name === value;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-center",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								role: "option",
								"aria-selected": selected,
								className: cn("flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted", selected && "bg-muted"),
								onMouseDown: (e) => {
									e.preventDefault();
									pick(item.name);
								},
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: cn("size-3.5 shrink-0", selected ? "opacity-100" : "opacity-0") }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "min-w-0 truncate",
									children: item.name
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ItemTools, {
								item,
								noun,
								onRenameItem,
								onRemoveItem
							})]
						}, `${item.id}-${item.name}`);
					}),
					!matches.length && !canCreate && !notFound ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "px-2 py-2 text-xs text-muted-foreground",
						children: emptyHint
					}) : null
				]
			}) : null]
		})
	] });
}
function MultiComboField({ label, name, values, onChange, items, placeholder = "Add…", allowCreate = true, onCreate, onRemoveItem, onRenameItem, noun = "name" }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	const [q, setQ] = (0, import_react.useState)("");
	const rootRef = useDismiss(open, () => {
		setOpen(false);
		setQ("");
	});
	const query = open ? q : "";
	const matches = (0, import_react.useMemo)(() => {
		return items.map((item) => ({
			item,
			score: rank(query, item.name)
		})).filter((x) => x.score >= 0).sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name)).map((x) => x.item);
	}, [items, query]);
	const needle = query.trim();
	const exact = items.some((i) => String(i.name ?? "").toLowerCase() === needle.toLowerCase());
	const canCreate = allowCreate && needle.length >= 2 && !exact;
	const notFound = needle.length >= 2 && matches.length === 0;
	function add(next) {
		const t = next.trim();
		if (!t) return;
		onChange([...values, t]);
		setQ("");
		setOpen(true);
	}
	async function create() {
		const next = needle;
		if (!next) return;
		const existing = matches[0];
		if (existing && rank(next, existing.name) >= 45) {
			add(existing.name);
			return;
		}
		try {
			add(createdName(await onCreate?.(next), next));
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Could not add that equipment");
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		label ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: label }) : null,
		name ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			type: "hidden",
			name,
			value: values.join("\n")
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			ref: rootRef,
			className: cn("relative", label ? "mt-1" : "mt-0"),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: cn(fieldClass, "flex-wrap py-1"),
				onClick: () => setOpen(true),
				children: [
					values.map((v, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "inline-flex max-w-full items-center gap-0.5 rounded-full bg-secondary pl-2.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "max-w-[28rem] py-0.5 text-sm leading-snug text-foreground",
							children: v
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground",
							"aria-label": `Remove ${v}`,
							onMouseDown: (e) => {
								e.preventDefault();
								e.stopPropagation();
								onChange(values.filter((_, j) => j !== i));
							},
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" })
						})]
					}, `${v}-${i}`)),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: open ? q : "",
						placeholder: values.length ? "Add another…" : placeholder,
						autoComplete: "off",
						"aria-label": label,
						"aria-expanded": open,
						"aria-autocomplete": "list",
						role: "combobox",
						className: "min-w-[7rem] flex-1 bg-transparent px-1 py-2 text-sm outline-none placeholder:text-muted-foreground",
						onChange: (e) => {
							setQ(e.target.value);
							if (!open) setOpen(true);
						},
						onFocus: () => setOpen(true),
						onKeyDown: (e) => {
							if (e.key === "Escape") setOpen(false);
							if (e.key === "Enter") {
								e.preventDefault();
								if (matches[0]) add(matches[0].name);
								else if (canCreate) create();
							}
							if (e.key === "Backspace" && !q && values.length) onChange(values.slice(0, -1));
						}
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronsUpDown, { className: "ml-auto size-4 shrink-0 text-muted-foreground" })
				]
			}), open ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Menu, {
				notFound,
				notFoundText: allowCreate ? `This ${noun} isn’t on the list. Use + to add it.` : "No matches.",
				children: [
					canCreate ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "flex min-h-10 w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm font-medium hover:bg-muted",
						onMouseDown: (e) => {
							e.preventDefault();
							create();
						},
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5 shrink-0" }), needle]
					}) }) : null,
					matches.map((item) => {
						const already = values.filter((v) => v.toLowerCase() === item.name.toLowerCase()).length;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-center",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								role: "option",
								"aria-selected": already > 0,
								className: cn("flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted", already > 0 && "bg-muted"),
								onMouseDown: (e) => {
									e.preventDefault();
									add(item.name);
								},
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
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ItemTools, {
								item,
								noun,
								onRenameItem,
								onRemoveItem
							})]
						}, `${item.id}-${item.name}`);
					}),
					!matches.length && !canCreate && !notFound ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "px-2 py-2 text-xs text-muted-foreground",
						children: "Type to search the full list."
					}) : null
				]
			}) : null]
		})
	] });
}
//#endregion
//#region src/components/desk/rename-dialog.tsx
function RenameDialog({ open, title, noun, current, pending, onClose, onSave }) {
	const [name, setName] = (0, import_react.useState)(current);
	(0, import_react.useEffect)(() => {
		if (open) setName(current);
	}, [open, current]);
	function submit(e) {
		e.preventDefault();
		const next = name.trim();
		if (!next || next === current) return;
		onSave(next);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange: (o) => !o && onClose(),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "max-w-md",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: title }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 text-sm text-muted-foreground",
					children: [
						"Every ticket, install, recipe, and record using this ",
						noun,
						" will move with the new name."
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					className: "mt-4 space-y-3",
					onSubmit: submit,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: name,
						onChange: (e) => setName(e.target.value),
						"aria-label": `New ${noun} name`,
						autoFocus: true
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex justify-end gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "ghost",
							onClick: onClose,
							children: "Cancel"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							disabled: pending || !name.trim() || name.trim() === current,
							children: "Save name"
						})]
					})]
				})
			]
		})
	});
}
//#endregion
//#region src/components/desk/directory-fields.tsx
function useDirectory(kind) {
	const qc = useQueryClient();
	const me = useQuery({
		queryKey: ["access", "me"],
		queryFn: () => getMyAccess()
	});
	const isAdmin = !!me.data?.isAdmin;
	const canAdd = kind === "equipment" || isAdmin || me.data?.canAddCustomers !== false;
	const canManage = kind === "equipment" || isAdmin;
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
	const rename = useMutation({
		mutationFn: (d) => kind === "customer" ? renameCustomer({ data: d }) : renameEquipment({ data: d }),
		onSuccess: (row) => {
			toast.success(row.merged ? `Merged into “${row.name}”` : `Renamed to “${row.name}”`);
			qc.invalidateQueries({ queryKey: ["directory"] });
			qc.invalidateQueries({ queryKey: ["customers"] });
			qc.invalidateQueries({ queryKey: ["jobs"] });
			qc.invalidateQueries({ queryKey: ["pms"] });
			qc.invalidateQueries({ queryKey: ["installs"] });
			qc.invalidateQueries({ queryKey: ["deals"] });
			qc.invalidateQueries({ queryKey: ["recipes"] });
			qc.invalidateQueries({ queryKey: ["assets"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["customer-history"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not rename")
	});
	function removeItem(item) {
		const noun = kind === "customer" ? "customer" : "equipment";
		archive.mutate(item.id, { onSuccess: () => toast.success(`Removed “${item.name}” from the ${noun} list. Existing records keep the name.`) });
	}
	return {
		items: list.data ?? [],
		add: (name) => add.mutateAsync(name).then((row) => row.name),
		removeItem,
		rename: (item, name) => rename.mutateAsync({
			id: item.id,
			name
		}),
		renamePending: rename.isPending,
		canEdit: canAdd,
		canAdd,
		canManage,
		isAdmin
	};
}
function CustomerCombo({ label = "Customer", name, value, onChange, required, placeholder = "Search customers…", allowCreate: allowCreateProp }) {
	const dir = useDirectory("customer");
	const allowCreate = allowCreateProp ?? dir.canAdd;
	const renameUi = useRename(dir, "customer", (from, to) => {
		if (value.toLowerCase() === from.toLowerCase()) onChange(to);
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ComboField, {
		label,
		name,
		value,
		onChange,
		items: dir.items,
		placeholder,
		required,
		allowCreate,
		onCreate: allowCreate ? dir.add : void 0,
		onRemoveItem: dir.canManage ? dir.removeItem : void 0,
		onRenameItem: dir.canManage ? renameUi.open : void 0,
		noun: "customer",
		emptyHint: allowCreate ? "No customer matches — use + to add one." : "No customer matches. Pick an account already on the list."
	}), renameUi.dialog] });
}
function EquipmentCombo({ label = "Equipment", name, value, onChange, required, placeholder = "Search equipment…" }) {
	const dir = useDirectory("equipment");
	const renameUi = useRename(dir, "equipment", (from, to) => {
		if (value.toLowerCase() === from.toLowerCase()) onChange(to);
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ComboField, {
		label,
		name,
		value,
		onChange: (v) => {
			onChange(v);
		},
		items: dir.items,
		placeholder,
		required,
		allowCreate: true,
		onCreate: dir.add,
		onRemoveItem: dir.removeItem,
		onRenameItem: renameUi.open,
		noun: "equipment",
		emptyHint: "No equipment matches — use + to add a model."
	}), renameUi.dialog] });
}
function EquipmentMultiCombo({ label = "Equipment", name = "equipment", values, onChange, placeholder = "Search equipment…" }) {
	const dir = useDirectory("equipment");
	const renameUi = useRename(dir, "equipment", (from, to) => {
		onChange(values.map((v) => v.toLowerCase() === from.toLowerCase() ? to : v));
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MultiComboField, {
		label,
		name,
		values,
		onChange: (next) => {
			onChange(next);
		},
		items: dir.items,
		placeholder,
		allowCreate: true,
		onCreate: dir.add,
		onRemoveItem: dir.removeItem,
		onRenameItem: renameUi.open,
		noun: "equipment"
	}), renameUi.dialog] });
}
function useRename(dir, noun, onMapped) {
	const [item, setItem] = (0, import_react.useState)(null);
	return {
		open: (next) => setItem(next),
		dialog: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RenameDialog, {
			open: !!item,
			title: `Rename ${noun}`,
			noun,
			current: item?.name ?? "",
			pending: dir.renamePending,
			onClose: () => setItem(null),
			onSave: (name) => {
				if (!item) return;
				const from = item.name;
				dir.rename(item, name).then((row) => {
					onMapped?.(from, row.name);
					setItem(null);
				});
			}
		})
	};
}
//#endregion
//#region src/lib/ops/network-api.ts
async function ready$1() {
	const { ensureSeeded } = await import("./seed.server.mjs");
	await ensureSeeded();
	return getSql();
}
function isoDate(v) {
	if (v == null || v === "") return null;
	const s = String(v);
	return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
}
function mapProvider(r, extra) {
	return {
		id: r.id,
		name: String(r.name),
		status: r.status ?? null,
		dispatchPhone: r.dispatch_phone ?? null,
		dispatchEmail: r.dispatch_email ?? null,
		secondaryPhone: r.secondary_phone ?? null,
		secondaryEmail: r.secondary_email ?? null,
		responseTime: r.response_time ?? null,
		standardRate: r.standard_rate ?? null,
		afterHoursRate: r.after_hours_rate ?? null,
		travelPolicy: r.travel_policy ?? null,
		equipmentServiced: r.equipment_serviced ?? null,
		coverage: r.coverage ?? null,
		contacts: r.contacts ?? null,
		pmPricing: r.pm_pricing ?? null,
		partsStocking: r.parts_stocking ?? null,
		notes: r.notes ?? null,
		lastUpdated: isoDate(r.last_updated),
		primaryFor: Number(extra?.primaryFor ?? r.primary_for ?? 0),
		secondaryFor: Number(extra?.secondaryFor ?? r.secondary_for ?? 0),
		states: extra?.states ?? [],
		locationCount: Number(extra?.locationCount ?? 0),
		updatedAt: String(r.updated_at ?? "")
	};
}
var PROVIDER_SELECT = `
  select p.*,
    (select count(*)::int from customer_providers c where c.provider_id = p.id and c.role = 'primary') as primary_for,
    (select count(*)::int from customer_providers c where c.provider_id = p.id and c.role = 'secondary') as secondary_for
  from network_providers p
`;
var listNetwork = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async () => {
	const sql = await ready$1();
	const providerRows = await sql.query(`${PROVIDER_SELECT} where p.archived = false order by lower(p.name)`);
	const locRows = await sql.query(`select distinct provider_id, state from provider_locations`).catch(() => []);
	const statesBy = /* @__PURE__ */ new Map();
	const countBy = /* @__PURE__ */ new Map();
	const locCountRows = await sql.query(`select provider_id, count(*)::int as c from provider_locations group by provider_id`).catch(() => []);
	for (const r of locRows) {
		const set = statesBy.get(r.provider_id) ?? /* @__PURE__ */ new Set();
		set.add(r.state);
		statesBy.set(r.provider_id, set);
	}
	for (const r of locCountRows) countBy.set(r.provider_id, r.c);
	const providers = providerRows.map((r) => {
		const id = r.id;
		return mapProvider(r, {
			states: [...statesBy.get(id) ?? []].sort(),
			locationCount: countBy.get(id) ?? 0
		});
	});
	const byId = new Map(providers.map((p) => [p.id, p]));
	const accountRows = await sql.query(`select * from network_accounts order by state nulls last, lower(customer)`);
	const links = await sql.query(`select id, customer, provider_id, role from customer_providers`);
	const linksByCustomer = /* @__PURE__ */ new Map();
	for (const l of links) {
		const provider = byId.get(l.provider_id);
		if (!provider) continue;
		const key = l.customer.toLowerCase();
		const list = linksByCustomer.get(key) ?? [];
		list.push({
			id: l.id,
			role: l.role,
			provider
		});
		linksByCustomer.set(key, list);
	}
	const accounts = accountRows.map((a) => {
		const assigned = (linksByCustomer.get(a.customer.toLowerCase()) ?? []).sort((x, y) => roleRank(x.role) - roleRank(y.role));
		return {
			...a,
			primary: assigned.find((x) => x.role === "primary")?.provider ?? null,
			secondary: assigned.find((x) => x.role === "secondary")?.provider ?? null,
			extras: assigned.filter((x) => x.role === "additional").map((x) => x.provider)
		};
	});
	const stateMap = /* @__PURE__ */ new Map();
	for (const a of accounts) {
		const state = (a.state || "—").toUpperCase();
		const cur = stateMap.get(state) ?? {
			total: 0,
			unassigned: 0
		};
		cur.total += 1;
		if (!a.primary) cur.unassigned += 1;
		stateMap.set(state, cur);
	}
	return {
		providers,
		accounts,
		byState: [...stateMap.entries()].map(([state, v]) => ({
			state,
			...v
		})).sort((a, b) => a.state.localeCompare(b.state)),
		unassigned: accounts.filter((a) => !a.primary)
	};
});
function mapLocation(r) {
	return {
		id: r.id,
		state: r.state,
		city: r.city,
		zip: r.zip
	};
}
async function loadLocations(sql, providerId) {
	return (await sql.query(`select id, state, city, zip from provider_locations
     where provider_id = $1
     order by state, coalesce(city, ''), coalesce(zip, '')`, [providerId])).map(mapLocation);
}
function mapContact(r) {
	return {
		id: r.id,
		name: r.name,
		role: r.role,
		phone: r.phone,
		email: r.email
	};
}
function mapAddress(r) {
	return {
		id: r.id,
		label: r.label,
		line1: r.line1,
		line2: r.line2,
		city: r.city,
		state: r.state,
		zip: r.zip
	};
}
async function loadPeople(sql, providerId) {
	return (await sql.query(`select id, name, role, phone, email from provider_contacts
     where provider_id = $1
     order by id`, [providerId])).map(mapContact);
}
async function loadAddresses(sql, providerId) {
	return (await sql.query(`select id, label, line1, line2, city, state, zip from provider_addresses
     where provider_id = $1
     order by id`, [providerId])).map(mapAddress);
}
var getProvider = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready$1();
	const rows = await sql.query(`${PROVIDER_SELECT} where p.id = $1`, [data.id]);
	if (!rows[0] || rows[0].archived) return null;
	const accounts = await sql.query(`select id as link_id, customer, role from customer_providers
       where provider_id = $1
       order by case role when 'primary' then 0 when 'secondary' then 1 else 2 end, lower(customer)`, [data.id]);
	const locations = await loadLocations(sql, data.id);
	const people = await loadPeople(sql, data.id);
	const addresses = await loadAddresses(sql, data.id);
	const states = [...new Set(locations.map((l) => l.state))].sort();
	return {
		...mapProvider(rows[0], {
			states,
			locationCount: locations.length
		}),
		accounts: accounts.map((a) => ({
			customer: a.customer,
			role: a.role,
			linkId: a.link_id
		})),
		locations,
		people,
		addresses
	};
});
var upsertProvider = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready$1();
	const name = data.name.trim();
	if (!name) throw new Error("Provider name is required");
	const today = todayChicago();
	const blank = (v) => {
		const s = v?.trim();
		return s ? s : null;
	};
	if (data.id) {
		if (!(await sql`
        update network_providers set
          name = ${name},
          status = ${blank(data.status)},
          dispatch_phone = ${blank(data.dispatchPhone)},
          dispatch_email = ${blank(data.dispatchEmail)},
          secondary_phone = ${blank(data.secondaryPhone)},
          secondary_email = ${blank(data.secondaryEmail)},
          response_time = ${blank(data.responseTime)},
          standard_rate = ${blank(data.standardRate)},
          after_hours_rate = ${blank(data.afterHoursRate)},
          travel_policy = ${blank(data.travelPolicy)},
          equipment_serviced = ${blank(data.equipmentServiced)},
          coverage = ${blank(data.coverage)},
          contacts = ${blank(data.contacts)},
          pm_pricing = ${blank(data.pmPricing)},
          parts_stocking = ${blank(data.partsStocking)},
          notes = ${blank(data.notes)},
          last_updated = ${today},
          updated_at = now()
        where id = ${data.id} and archived = false
        returning *`)[0]) throw new Error("Provider not found");
		if (data.locations?.length) await writeLocations(sql, data.id, data.locations);
		if (data.people?.length) await writePeople(sql, data.id, data.people);
		if (data.addresses?.length) await writeAddresses(sql, data.id, data.addresses);
		return withLocationSummary(sql, data.id);
	}
	if ((await sql`
      select id from network_providers where lower(name) = lower(${name}) and archived = false`)[0]) throw new Error("A provider with that name is already on the list");
	const id = (await sql`
      insert into network_providers (
        name, status, dispatch_phone, dispatch_email, secondary_phone, secondary_email,
        response_time, standard_rate, after_hours_rate, travel_policy, equipment_serviced,
        coverage, contacts, pm_pricing, parts_stocking, notes, last_updated
      ) values (
        ${name}, ${blank(data.status)}, ${blank(data.dispatchPhone)}, ${blank(data.dispatchEmail)},
        ${blank(data.secondaryPhone)}, ${blank(data.secondaryEmail)}, ${blank(data.responseTime)},
        ${blank(data.standardRate)}, ${blank(data.afterHoursRate)}, ${blank(data.travelPolicy)},
        ${blank(data.equipmentServiced)}, ${blank(data.coverage)}, ${blank(data.contacts)},
        ${blank(data.pmPricing)}, ${blank(data.partsStocking)}, ${blank(data.notes)}, ${today}
      ) returning *`)[0].id;
	if (data.locations?.length) await writeLocations(sql, id, data.locations);
	if (data.people?.length) await writePeople(sql, id, data.people);
	if (data.addresses?.length) await writeAddresses(sql, id, data.addresses);
	return withLocationSummary(sql, id);
});
var renameProvider = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready$1();
	return renameOrMergeProvider(sql, data.id, data.name);
});
async function writeLocations(sql, providerId, drafts) {
	const existing = await loadLocations(sql, providerId);
	for (const d of drafts) {
		const state = normalizeState(d.state);
		if (!state) continue;
		const city = normalizeCity(d.city);
		const zip = normalizeZip(d.zip);
		if (findDuplicateLocation(existing, {
			state,
			city,
			zip
		})) continue;
		const ins = await sql`
      insert into provider_locations (provider_id, state, city, zip)
      values (${providerId}, ${state}, ${city}, ${zip})
      returning id, state, city, zip`;
		if (ins[0]) existing.push(mapLocation(ins[0]));
	}
}
async function withLocationSummary(sql, id) {
	const full = await sql.query(`${PROVIDER_SELECT} where p.id = $1`, [id]);
	const locations = await loadLocations(sql, id);
	const states = [...new Set(locations.map((l) => l.state))].sort();
	return mapProvider(full[0], {
		states,
		locationCount: locations.length
	});
}
var addProviderLocation = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready$1();
	const state = normalizeState(data.state);
	if (!state) throw new Error("Pick a state");
	const city = normalizeCity(data.city);
	const zips = splitZips(data.zip ?? "");
	const targets = zips.length ? zips.map((zip) => ({
		state,
		city,
		zip
	})) : [{
		state,
		city,
		zip: null
	}];
	const existing = await loadLocations(sql, data.providerId);
	const added = [];
	const duplicates = [];
	for (const t of targets) {
		const dup = findDuplicateLocation(existing, t);
		if (dup) {
			duplicates.push({
				existing: dup,
				message: `Already listed — ${formatLocation(dup)}.`
			});
			continue;
		}
		const ins = await sql`
        insert into provider_locations (provider_id, state, city, zip)
        values (${data.providerId}, ${t.state}, ${t.city}, ${t.zip})
        returning id, state, city, zip`;
		if (ins[0]) {
			const loc = mapLocation(ins[0]);
			existing.push(loc);
			added.push(loc);
		}
	}
	if (added.length) await sql`update network_providers set last_updated = ${todayChicago()}, updated_at = now() where id = ${data.providerId}`;
	return {
		added,
		duplicates
	};
});
var removeProviderLocation = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	await (await ready$1())`delete from provider_locations where id = ${data.id}`;
	return { ok: true };
});
async function writePeople(sql, providerId, drafts) {
	const existing = await loadPeople(sql, providerId);
	for (const d of drafts) {
		const row = {
			name: d.name?.trim() || null,
			role: d.role?.trim() || null,
			phone: d.phone?.trim() || null,
			email: normalizeEmail(d.email)
		};
		if (!row.name && !row.phone && !row.email) continue;
		if (findDuplicateContact(existing, row)) continue;
		const ins = await sql`
      insert into provider_contacts (provider_id, name, role, phone, email)
      values (${providerId}, ${row.name}, ${row.role}, ${row.phone}, ${row.email})
      returning id, name, role, phone, email`;
		if (ins[0]) existing.push(mapContact(ins[0]));
	}
}
async function writeAddresses(sql, providerId, drafts) {
	const existing = await loadAddresses(sql, providerId);
	for (const d of drafts) {
		const row = {
			label: d.label?.trim() || null,
			line1: d.line1?.trim() || null,
			line2: d.line2?.trim() || null,
			city: normalizeCity(d.city),
			state: normalizeState(d.state),
			zip: normalizeZip(d.zip)
		};
		if (!row.line1 && !row.city) continue;
		if (findDuplicateAddress(existing, row)) continue;
		const ins = await sql`
      insert into provider_addresses (provider_id, label, line1, line2, city, state, zip)
      values (${providerId}, ${row.label}, ${row.line1}, ${row.line2}, ${row.city}, ${row.state}, ${row.zip})
      returning id, label, line1, line2, city, state, zip`;
		if (ins[0]) existing.push(mapAddress(ins[0]));
	}
}
var addProviderContact = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready$1();
	const row = {
		name: data.name?.trim() || null,
		role: data.role?.trim() || null,
		phone: data.phone?.trim() || null,
		email: normalizeEmail(data.email)
	};
	if (!row.name && !row.phone && !row.email) throw new Error("Add a name, phone, or email");
	const existing = await loadPeople(sql, data.providerId);
	const dup = findDuplicateContact(existing, row);
	if (dup) return {
		ok: false,
		duplicate: true,
		existing: dup,
		message: `Already listed — ${formatContact(dup)}.`
	};
	const ins = await sql`
      insert into provider_contacts (provider_id, name, role, phone, email)
      values (${data.providerId}, ${row.name}, ${row.role}, ${row.phone}, ${row.email})
      returning id, name, role, phone, email`;
	await sql`update network_providers set last_updated = ${todayChicago()}, updated_at = now() where id = ${data.providerId}`;
	return {
		ok: true,
		contact: mapContact(ins[0])
	};
});
var removeProviderContact = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	await (await ready$1())`delete from provider_contacts where id = ${data.id}`;
	return { ok: true };
});
var addProviderAddress = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready$1();
	const row = {
		label: data.label?.trim() || null,
		line1: data.line1?.trim() || null,
		line2: data.line2?.trim() || null,
		city: normalizeCity(data.city),
		state: normalizeState(data.state),
		zip: normalizeZip(data.zip)
	};
	if (!row.line1 && !row.city) throw new Error("Add a street or city");
	const existing = await loadAddresses(sql, data.providerId);
	const dup = findDuplicateAddress(existing, row);
	if (dup) return {
		ok: false,
		duplicate: true,
		existing: dup,
		message: `Already listed — ${formatAddress(dup)}.`
	};
	const ins = await sql`
      insert into provider_addresses (provider_id, label, line1, line2, city, state, zip)
      values (${data.providerId}, ${row.label}, ${row.line1}, ${row.line2}, ${row.city}, ${row.state}, ${row.zip})
      returning id, label, line1, line2, city, state, zip`;
	await sql`update network_providers set last_updated = ${todayChicago()}, updated_at = now() where id = ${data.providerId}`;
	return {
		ok: true,
		address: mapAddress(ins[0])
	};
});
var removeProviderAddress = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	await (await ready$1())`delete from provider_addresses where id = ${data.id}`;
	return { ok: true };
});
var archiveProvider = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready$1();
	await sql`delete from customer_providers where provider_id = ${data.id}`;
	await sql`update network_providers set archived = true, updated_at = now() where id = ${data.id}`;
	return { ok: true };
});
var getCustomerProviders = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const customer = data.customer.trim();
	if (!customer) return [];
	return (await (await ready$1()).query(`select p.*,
              (select count(*)::int from customer_providers x where x.provider_id = p.id and x.role = 'primary') as primary_for,
              (select count(*)::int from customer_providers x where x.provider_id = p.id and x.role = 'secondary') as secondary_for,
              c.id as link_id, c.customer, c.role
       from network_providers p
       join customer_providers c on c.provider_id = p.id
       where p.archived = false and lower(c.customer) = lower($1)
       order by case c.role when 'primary' then 0 when 'secondary' then 1 else 2 end, lower(p.name)`, [customer])).map((r) => ({
		linkId: r.link_id,
		customer: String(r.customer),
		role: r.role,
		provider: mapProvider(r)
	}));
});
var assignCustomerProvider = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready$1();
	const customer = data.customer.trim();
	if (!customer) throw new Error("Pick a customer");
	const role = data.role ?? "additional";
	const provider = await sql.query(`${PROVIDER_SELECT} where p.id = $1 and p.archived = false`, [data.providerId]);
	if (!provider[0]) throw new Error("Provider not found");
	await sql.query(`insert into directory_customers (name)
       select $1
       where not exists (select 1 from directory_customers where lower(name) = lower($1))`, [customer]);
	await sql.query(`insert into network_accounts (customer)
       select $1
       where not exists (select 1 from network_accounts where lower(customer) = lower($1))`, [customer]);
	if (role === "primary") await sql`
        update customer_providers set role = 'additional', updated_at = now()
        where lower(customer) = lower(${customer}) and role = 'primary'`;
	else if (role === "secondary") await sql`
        update customer_providers set role = 'additional', updated_at = now()
        where lower(customer) = lower(${customer}) and role = 'secondary'`;
	const existing = await sql`
      select id from customer_providers
      where provider_id = ${data.providerId} and lower(customer) = lower(${customer})`;
	let linkId;
	if (existing[0]) {
		await sql`update customer_providers set role = ${role}, updated_at = now() where id = ${existing[0].id}`;
		linkId = existing[0].id;
	} else linkId = (await sql`
        insert into customer_providers (customer, provider_id, role)
        values (${customer}, ${data.providerId}, ${role})
        returning id`)[0].id;
	return {
		linkId,
		customer,
		role,
		provider: mapProvider(provider[0])
	};
});
var unassignCustomerProvider = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	await (await ready$1())`delete from customer_providers where id = ${data.linkId}`;
	return { ok: true };
});
var setProviderRole = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await ready$1();
	const cur = await sql`
      select customer from customer_providers where id = ${data.linkId}`;
	if (!cur[0]) throw new Error("Assignment not found");
	if (data.role === "primary") await sql`
        update customer_providers set role = 'additional', updated_at = now()
        where lower(customer) = lower(${cur[0].customer}) and role = 'primary' and id <> ${data.linkId}`;
	else if (data.role === "secondary") await sql`
        update customer_providers set role = 'additional', updated_at = now()
        where lower(customer) = lower(${cur[0].customer}) and role = 'secondary' and id <> ${data.linkId}`;
	await sql`update customer_providers set role = ${data.role}, updated_at = now() where id = ${data.linkId}`;
	return { ok: true };
});
//#endregion
//#region src/components/desk/provider-dispatch.tsx
function ProviderDispatchBlock({ customer, assignable = false }) {
	const name = customer.trim();
	const qc = useQueryClient();
	const links = useQuery({
		queryKey: ["customer-providers", name],
		queryFn: () => getCustomerProviders({ data: { customer: name } }),
		enabled: name.length > 0
	});
	const drop = useMutation({
		mutationFn: (linkId) => unassignCustomerProvider({ data: { linkId } }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["customer-providers"] });
			qc.invalidateQueries({ queryKey: ["network"] });
		}
	});
	if (!name) return null;
	const rows = links.data ?? [];
	if (!rows.length && !assignable) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-xl border border-border bg-card p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex items-start justify-between gap-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase",
					children: "Out of Network dispatch"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-0.5 text-xs text-muted-foreground",
					children: rows.length ? "Call the primary first. Secondary is backup." : "No 3rd-party tech is assigned to this account yet."
				})] })
			}),
			rows.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 space-y-2",
				children: rows.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DispatchCard, {
					role: l.role,
					name: l.provider.name,
					phone: l.provider.dispatchPhone,
					email: l.provider.dispatchEmail,
					coverage: l.provider.states?.length ? l.provider.states.join(" · ") : l.provider.coverage,
					status: l.provider.status,
					onRemove: assignable ? () => drop.mutate(l.linkId) : void 0
				}) }, l.linkId))
			}) : null,
			assignable ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AssignProviderForm, { customer: name }) : null
		]
	});
}
function DispatchCard({ role, name, phone, email, coverage, status, onRemove }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg border border-border bg-background px-3 py-2.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-center gap-1.5",
			children: [
				role ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
					variant: role === "primary" ? "ink" : "outline",
					children: roleLabel(role)
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "min-w-0 flex-1 font-medium",
					children: name
				}),
				status ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
					variant: statusTone(status),
					children: status
				}) : null,
				onRemove ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "h-8 rounded-full px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground",
					onClick: (e) => {
						e.stopPropagation();
						onRemove();
					},
					children: "Remove"
				}) : null
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-1.5 flex flex-col gap-0.5 text-sm",
			children: [
				phone ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
					href: `tel:${phone.replace(/[^\d+]/g, "")}`,
					className: "inline-flex items-center gap-1.5 text-foreground hover:underline",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Phone, { className: "size-3.5 text-muted-foreground" }), phone]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground",
					children: "No dispatch phone on file"
				}),
				email ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
					href: `mailto:${email.split(/\s/)[0]}`,
					className: "inline-flex items-center gap-1.5 break-all hover:underline",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mail, { className: "size-3.5 shrink-0 text-muted-foreground" }), email]
				}) : null,
				coverage ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 line-clamp-2 text-xs text-muted-foreground",
					children: coverage
				}) : null
			]
		})]
	});
}
function AssignProviderForm({ customer }) {
	const qc = useQueryClient();
	const net = useQuery({
		queryKey: ["network"],
		queryFn: () => listNetwork()
	});
	const [providerId, setProviderId] = (0, import_react.useState)("");
	const [role, setRole] = (0, import_react.useState)("additional");
	const add = useMutation({
		mutationFn: () => assignCustomerProvider({ data: {
			customer,
			providerId: Number(providerId),
			role
		} }),
		onSuccess: (row) => {
			toast.success(`${row.provider.name} is on ${customer}`);
			setProviderId("");
			qc.invalidateQueries({ queryKey: ["customer-providers"] });
			qc.invalidateQueries({ queryKey: ["network"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not assign")
	});
	const providers = net.data?.providers ?? [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
		className: "mt-3 flex flex-col gap-2 sm:flex-row sm:items-end",
		onSubmit: (e) => {
			e.preventDefault();
			if (providerId) add.mutate();
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground",
					children: "Add a provider"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
					className: "mt-1",
					value: providerId,
					onChange: (e) => setProviderId(e.target.value),
					allowEmpty: true,
					children: providers.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: p.id,
						children: p.name
					}, p.id))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
				className: "sm:w-36",
				value: role,
				onChange: (e) => setRole(e.target.value),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "primary",
						children: "Primary"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "secondary",
						children: "Secondary"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "additional",
						children: "Additional"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				type: "submit",
				size: "sm",
				disabled: !providerId || add.isPending,
				children: "Add"
			})
		]
	});
}
function ProviderAccountList({ providerId, accounts }) {
	const qc = useQueryClient();
	const [customer, setCustomer] = (0, import_react.useState)("");
	const [role, setRole] = (0, import_react.useState)("primary");
	const add = useMutation({
		mutationFn: () => assignCustomerProvider({ data: {
			customer,
			providerId,
			role
		} }),
		onSuccess: () => {
			toast.success("Account assigned");
			setCustomer("");
			qc.invalidateQueries({ queryKey: ["network"] });
			qc.invalidateQueries({ queryKey: ["customer-providers"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not assign")
	});
	const drop = useMutation({
		mutationFn: (linkId) => unassignCustomerProvider({ data: { linkId } }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["network"] });
			qc.invalidateQueries({ queryKey: ["customer-providers"] });
		}
	});
	const roleMut = useMutation({
		mutationFn: (d) => setProviderRole({ data: d }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["network"] });
			qc.invalidateQueries({ queryKey: ["customer-providers"] });
		}
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
			className: "font-display text-lg",
			children: "Assigned accounts"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-xs text-muted-foreground",
			children: "Pick from the customer list. Primary is who we call first."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "mt-3 flex flex-col gap-2 sm:flex-row sm:items-end",
			onSubmit: (e) => {
				e.preventDefault();
				if (customer.trim()) add.mutate();
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "min-w-0 flex-1",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerCombo, {
						label: "Customer",
						value: customer,
						onChange: setCustomer,
						allowCreate: false
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
					className: "sm:w-36",
					value: role,
					onChange: (e) => setRole(e.target.value),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "primary",
							children: "Primary"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "secondary",
							children: "Secondary"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "additional",
							children: "Additional"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "submit",
					size: "sm",
					disabled: !customer.trim() || add.isPending,
					children: "Assign"
				})
			]
		}),
		accounts.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-3 text-sm text-muted-foreground",
			children: "No accounts yet."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-3 divide-y divide-border rounded-xl border border-border",
			children: accounts.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex flex-wrap items-center gap-2 px-3 py-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "min-w-0 flex-1 font-medium",
						children: a.customer
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
						className: "w-32",
						value: a.role,
						onChange: (e) => roleMut.mutate({
							linkId: a.linkId,
							role: e.target.value
						}),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "primary",
								children: "Primary"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "secondary",
								children: "Secondary"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "additional",
								children: "Additional"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "h-10 px-2 text-xs text-muted-foreground hover:text-foreground",
						onClick: () => drop.mutate(a.linkId),
						children: "Remove"
					})
				]
			}, a.linkId))
		})
	] });
}
//#endregion
//#region src/components/desk/serial-notice.tsx
function SerialNoticeBanner({ notice }) {
	if (!notice?.trim()) return null;
	const miss = /not found/i.test(notice);
	const warn = /already assigned/i.test(notice);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: `border-b px-5 py-3 text-sm ${miss ? "border-warning/30 bg-warning/10" : warn ? "border-warning/30 bg-warning/10" : "border-primary/20 bg-primary/5"}`,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "font-medium",
			children: notice
		})
	});
}
function SerialPullField({ label, value, onValue, installId, jobId, machineIndex, onPulled }) {
	const qc = useQueryClient();
	const [text, setText] = (0, import_react.useState)(value);
	const [pending, setPending] = (0, import_react.useState)(null);
	const looked = (0, import_react.useRef)("");
	(0, import_react.useEffect)(() => {
		setText(value);
	}, [value]);
	const pull = useMutation({
		mutationFn: (opts) => applySerialPull({ data: {
			serial: opts.serial,
			installId,
			jobId,
			machineIndex: machineIndex ?? null,
			confirmReuse: opts.confirmReuse
		} }),
		onSuccess: (result) => {
			if (result.needsConfirm) {
				setPending(result);
				return;
			}
			setPending(null);
			looked.current = result.serial.trim().replace(/[#\s]/g, "").toLowerCase();
			if (result.serial && result.serial !== text) setText(result.serial);
			onValue(result.serial);
			onPulled?.(result);
			if (result.pulled) toast.success(result.notice);
			else toast.message(result.notice);
			qc.invalidateQueries({ queryKey: ["assets"] });
			qc.invalidateQueries({ queryKey: ["installs"] });
			qc.invalidateQueries({ queryKey: ["jobs"] });
			qc.invalidateQueries({ queryKey: ["job"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not check warehouse")
	});
	function commit(raw, confirmReuse = false) {
		const next = raw.trim();
		onValue(next);
		if (!next) {
			looked.current = "";
			return;
		}
		if (!installId && !jobId) return;
		const key = next.replace(/[#\s]/g, "").toLowerCase();
		if (!confirmReuse && key === looked.current) return;
		pull.mutate({
			serial: next,
			confirmReuse
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: label }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
			className: "mt-1",
			value: text,
			autoComplete: "off",
			placeholder: "Type the serial",
			onChange: (e) => {
				setText(e.target.value);
				onValue(e.target.value);
			},
			onBlur: () => {
				if (text.trim()) commit(text);
			},
			onKeyDown: (e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					commit(text);
				}
			}
		}),
		pull.isPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 text-xs text-muted-foreground",
			children: "Checking warehouse…"
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
			open: !!pending?.needsConfirm,
			onOpenChange: (o) => !o && setPending(null),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Serial already assigned" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogDescription, { children: [
					pending?.notice,
					" Reuse it on this ",
					installId ? "install" : "ticket",
					", or cancel and leave it where it is."
				] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 flex flex-wrap justify-end gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						variant: "outline",
						onClick: () => setPending(null),
						children: "Cancel"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						onClick: () => {
							if (pending) commit(pending.serial, true);
						},
						children: "Reuse serial"
					})]
				})
			] })
		})
	] });
}
//#endregion
//#region src/components/desk/job-sheet.tsx
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
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DuplicateBadge$1, {
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
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BoundCustomer$1, {
						defaultValue: j.customer ?? "",
						recordKey: j.id
					}),
					j.customer ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "sm:col-span-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProviderDispatchBlock, { customer: j.customer })
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
						label: "Contact",
						name: "contact",
						defaultValue: j.contact ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
						label: "Phone",
						name: "phone",
						defaultValue: j.phone ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "sm:col-span-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BoundEquipment$1, {
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
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
						label: "WO #",
						name: "wo",
						defaultValue: j.wo ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
						label: "Received",
						name: "received",
						type: "date",
						defaultValue: j.received ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
						label: "Scheduled",
						name: "scheduled",
						type: "date",
						defaultValue: j.scheduled ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
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
function Field$1({ label, name, defaultValue, type = "text" }) {
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
function BoundCustomer$1({ recordKey, defaultValue }) {
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
function BoundEquipment$1({ recordKey, defaultValue }) {
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
			qc.invalidateQueries({ queryKey: ["customer-history"] });
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
			qc.invalidateQueries({ queryKey: ["customer-history"] });
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
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetBody, {
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
function MachineFields({ specs, onChange, installId, onPulled }) {
	if (!specs.length) return null;
	function patch(index, part) {
		return specs.map((s, i) => i === index ? {
			...s,
			...part
		} : s);
	}
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
					children: "Type a warehouse serial to pull the unit onto this account in one step."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-2 grid gap-3 sm:grid-cols-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SerialPullField, {
						label: `Serial number — ${spec.equipment}`,
						value: spec.serial,
						installId,
						machineIndex: index,
						onValue: (serial) => onChange(patch(index, { serial })),
						onPulled: (result) => {
							const next = patch(index, {
								serial: result.serial,
								powerVoltage: spec.powerVoltage || result.powerVoltage || ""
							});
							onChange(next);
							onPulled?.(next, result);
						}
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Label, {
						htmlFor: `pwr-${index}`,
						children: ["Power / voltage — ", spec.equipment]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: `pwr-${index}`,
						className: "mt-1",
						value: spec.powerVoltage,
						autoComplete: "off",
						placeholder: "e.g. 208V / 1-phase / 30A",
						onChange: (e) => onChange(patch(index, { powerVoltage: e.target.value }))
					})] })]
				})
			]
		}, `${spec.equipment}-${index}`))
	});
}
//#endregion
//#region src/components/desk/entity-sheets.tsx
function Field({ label, name, defaultValue, type = "text", placeholder }) {
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
function BoundCustomer({ recordKey, defaultValue, name = "customer", required }) {
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
function BoundEquipment({ recordKey, defaultValue, name = "equipment" }) {
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
	const formRef = (0, import_react.useRef)(null);
	const skipToast = (0, import_react.useRef)(false);
	const save = useMutation({
		mutationFn: (d) => updatePm({ data: d }),
		onSuccess: () => {
			if (!skipToast.current) toast.success("Saved");
			skipToast.current = false;
			qc.invalidateQueries({ queryKey: ["pms"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["customer-history"] });
			qc.invalidateQueries({ queryKey: ["customers"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
		open: !!pm,
		onOpenChange: (o) => {
			if (!o) {
				skipToast.current = true;
				formRef.current?.requestSubmit();
				onClose();
			}
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetContent, { children: pm ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: "Preventative maintenance"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, { children: pm.customer }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 flex flex-wrap gap-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: pm.status }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlagBadge, { flag: pm.flag })]
			})
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetBody, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			ref: formRef,
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
					notes: String(fd.get("notes") || "") || null,
					wo: String(fd.get("wo") || "") || null,
					workDone: String(fd.get("workDone") || "") || null,
					completedAt: String(fd.get("completedAt") || "") || null
				});
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BoundCustomer, {
					recordKey: pm.id,
					defaultValue: pm.customer,
					required: true
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BoundEquipment, {
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
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
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
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Tech" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TechSelect, {
					name: "technician",
					defaultValue: pm.technician ?? ""
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "WO #",
					name: "wo",
					defaultValue: pm.wo ?? ""
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Date completed",
					name: "completedAt",
					type: "date",
					defaultValue: pm.completedAt ?? ""
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "sm:col-span-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: `pm-work-${pm.id}`,
						children: "Description of work"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AutoGrowTextarea, {
						id: `pm-work-${pm.id}`,
						name: "workDone",
						className: "mt-1",
						defaultValue: pm.workDone ?? "",
						placeholder: "What was done on site…"
					})]
				}),
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
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Thread, {
			entityType: "pm",
			entityId: pm.id
		})] })] }) : null })
	});
}
function InstallSheet({ row, onClose, onOpenRelated }) {
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
	const formRef = (0, import_react.useRef)(null);
	const skipToast = (0, import_react.useRef)(false);
	const catalog = catalogModels([
		...(directoryEquip.data ?? []).map((e) => e.name),
		...(assets.data ?? []).filter((a) => a.kind === "equip").map((a) => a.model),
		...(recs.data ?? []).map((r) => r.equipmentModel)
	]);
	(0, import_react.useEffect)(() => {
		setRecipeDraft(null);
		setCustomer(row?.customer ?? "");
		const saved = row?.machines ?? [];
		const fromSaved = saved.map((s) => s.equipment).filter(Boolean);
		const names = catalog.length ? listedEquipment(fromSaved.join("\n") || row?.equipment, catalog) : fromSaved.length ? fromSaved : (row?.equipment ?? "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
		setEquipPieces(names);
		setSpecs(mergeMachineSpecs(names, saved, {
			serial: row?.serial,
			powerVoltage: row?.powerVoltage
		}));
		setHydratedId(row?.id ?? null);
	}, [row?.id, catalog.join("\n")]);
	const save = useMutation({
		mutationFn: (d) => updateInstall({ data: d }),
		onSuccess: (_row, vars) => {
			if (!Object.keys(vars).filter((k) => k !== "id").every((k) => [
				"equipment",
				"serial",
				"powerVoltage",
				"machines"
			].includes(k)) && !skipToast.current) toast.success("Saved");
			skipToast.current = false;
			qc.invalidateQueries({ queryKey: ["installs"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["customer-history"] });
			qc.invalidateQueries({ queryKey: ["customers"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save")
	});
	const dropInstall = useMutation({
		mutationFn: () => archiveInstall({ data: { id: row.id } }),
		onSuccess: () => {
			toast.success(`Removed ${row?.customer} from the list`);
			qc.invalidateQueries({ queryKey: ["installs"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["customers"] });
			onClose();
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove")
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
				skipToast.current = true;
				formRef.current?.requestSubmit();
				setRecipeDraft(null);
				onClose();
			}
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetContent, { children: row ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: "Install"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, { children: row.customer }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 flex flex-wrap gap-1.5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: row.equipStatus }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlagBadge, { flag: row.flag }),
					row.duplicateOf ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
						variant: "warn",
						children: "Possible duplicate"
					}) : null
				]
			})
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetBody, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SerialNoticeBanner, { notice: row.serialNotice }),
			row.duplicateOf ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "border-b border-warning/30 bg-warning/10 px-5 py-3 text-sm",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-medium",
						children: "This account already had an install request."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-muted-foreground",
						children: "Check the earlier one before treating this as a second job — or clear the flag if it’s a new request."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2 flex flex-wrap gap-2",
						children: [onOpenRelated ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							size: "sm",
							variant: "outline",
							onClick: () => onOpenRelated(row.duplicateOf),
							children: "Open earlier request"
						}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							size: "sm",
							variant: "ghost",
							onClick: () => save.mutate({
								id: row.id,
								duplicateOf: null
							}),
							children: "Not a duplicate"
						})]
					})
				]
			}) : null,
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
				ref: formRef,
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
						workDone: String(fd.get("workDone") || "") || null,
						completedAt: String(fd.get("completedAt") || "") || null,
						accountRep: String(fd.get("accountRep") || "") || null,
						aviKatz: fd.get("aviKatz") === "on",
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
						onChange: (v) => {
							try {
								setCustomer(v);
							} catch (err) {
								toast.error(err instanceof Error ? err.message : "Could not set customer");
							}
						},
						required: true
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EquipmentMultiCombo, {
							values: equipPieces,
							placeholder: "Search the full equipment list…",
							onChange: (next) => {
								try {
									persistMachines(mergeMachineSpecs(next, specs));
								} catch (err) {
									toast.error(err instanceof Error ? err.message : "Could not update equipment");
								}
							}
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-xs text-muted-foreground",
							children: "Scroll the full list, pick a model, or type a new one to add it."
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "sm:col-span-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MachineFields, {
							specs,
							installId: row.id,
							onChange: setSpecs,
							onPulled: (next) => persistMachines(next)
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Equipment status" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "equipStatus",
						className: "mt-1",
						defaultValue: row.equipStatus ?? "",
						allowEmpty: true,
						children: EQUIP_STATUSES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Install date",
						name: "installDate",
						type: "date",
						defaultValue: row.installDate ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Tech" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TechSelect, {
						name: "technician",
						defaultValue: row.technician ?? ""
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
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
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RepSelect, {
						name: "accountRep",
						label: "Account rep",
						defaultValue: row.accountRep ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "flex items-center gap-2 text-sm sm:mt-7",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "checkbox",
								name: "aviKatz",
								className: "size-4 accent-primary",
								defaultChecked: row.aviKatz
							}),
							"Avi Katz account (AK)",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AkBadge, { on: row.aviKatz })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Payment" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "paymentStatus",
						className: "mt-1",
						defaultValue: row.paymentStatus ?? "",
						allowEmpty: true,
						children: PAYMENT_TERMS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Date completed",
						name: "completedAt",
						type: "date",
						defaultValue: row.completedAt ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: `install-work-${row.id}`,
							children: "Description of work"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AutoGrowTextarea, {
							id: `install-work-${row.id}`,
							name: "workDone",
							className: "mt-1",
							defaultValue: row.workDone ?? "",
							placeholder: "What was done on site…"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Notes" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							name: "notes",
							className: "mt-1",
							defaultValue: row.notes ?? ""
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center justify-between gap-2 sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							type: "button",
							size: "sm",
							variant: "outline",
							disabled: dropInstall.isPending,
							onClick: () => {
								if (window.confirm(`Remove “${row.customer}” from the install list?`)) dropInstall.mutate();
							},
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), "Remove from list"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							size: "sm",
							disabled: save.isPending,
							children: "Save"
						})]
					})
				]
			}, row.id),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Thread, {
				entityType: "install",
				entityId: row.id
			})
		] })] }) : null })
	});
}
function DealSheet({ deal, onClose }) {
	const qc = useQueryClient();
	const formRef = (0, import_react.useRef)(null);
	const skipToast = (0, import_react.useRef)(false);
	const save = useMutation({
		mutationFn: (d) => updateDeal({ data: d }),
		onSuccess: () => {
			if (!skipToast.current) toast.success("Saved");
			skipToast.current = false;
			qc.invalidateQueries({ queryKey: ["deals"] });
			qc.invalidateQueries({ queryKey: ["installs"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["handoff"] });
			qc.invalidateQueries({ queryKey: ["customer-history"] });
			qc.invalidateQueries({ queryKey: ["customers"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save")
	});
	const dropDeal = useMutation({
		mutationFn: () => archiveDeal({ data: { id: deal.id } }),
		onSuccess: () => {
			toast.success(`Removed ${deal?.customer} from the list`);
			qc.invalidateQueries({ queryKey: ["deals"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["handoff"] });
			onClose();
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
		open: !!deal,
		onOpenChange: (o) => {
			if (!o) {
				skipToast.current = true;
				formRef.current?.requestSubmit();
				onClose();
			}
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetContent, { children: deal ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: ["Pipeline · ", moneyExact(deal.amount)]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, { children: deal.customer }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-2 flex flex-wrap gap-1.5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: deal.completion === "complete" ? "Complete" : deal.completion === "fell" ? "Fell through" : "Open" })
			})
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetBody, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			ref: formRef,
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
					aviKatz: fd.get("aviKatz") === "on",
					equipment: String(fd.get("equipment") || "") || null,
					amount: Number.isFinite(amountNum) ? amountNum : null,
					goodToOrder: fd.get("goodToOrder") === "on" || fd.get("ordered") === "on",
					ordered: fd.get("ordered") === "on",
					eta: String(fd.get("eta") || "") || null,
					terms: String(fd.get("terms") || "") || null,
					invoice: String(fd.get("invoice") || "") || null,
					completion: String(fd.get("completion") || "") || null,
					notes: String(fd.get("notes") || "") || null
				});
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BoundCustomer, {
					recordKey: deal.id,
					defaultValue: deal.customer,
					required: true
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RepSelect, {
					name: "producer",
					label: "Rep",
					defaultValue: deal.producer ?? ""
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "flex items-center gap-2 text-sm sm:col-span-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "checkbox",
							name: "aviKatz",
							className: "size-4 accent-primary",
							defaultChecked: deal.aviKatz
						}),
						"Avi Katz account (AK)",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AkBadge, { on: deal.aviKatz })
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "sm:col-span-2",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BoundEquipment, {
						recordKey: deal.id,
						defaultValue: deal.equipment ?? ""
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
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
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "ETA",
					name: "eta",
					defaultValue: deal.eta ?? ""
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
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
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "sm:col-span-2 rounded-lg border border-border bg-muted/40 p-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm font-medium",
							children: "Order steps"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-xs text-muted-foreground",
							children: "Reps mark Good to order. Confirm Ordered and it leaves the Good to order list."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 grid gap-2 sm:grid-cols-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "flex min-h-11 items-center gap-2 text-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "checkbox",
									name: "goodToOrder",
									defaultChecked: deal.goodToOrder || deal.ordered
								}), "1. Good to order"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "flex min-h-11 items-center gap-2 text-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "checkbox",
									name: "ordered",
									defaultChecked: deal.ordered
								}), "2. Ordered"]
							})]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "sm:col-span-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Notes" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
						name: "notes",
						className: "mt-1",
						defaultValue: deal.notes ?? ""
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center justify-between gap-2 sm:col-span-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						type: "button",
						size: "sm",
						variant: "outline",
						disabled: dropDeal.isPending,
						onClick: () => {
							if (window.confirm(`Remove “${deal.customer}” from the pipeline list?`)) dropDeal.mutate();
						},
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), "Remove from list"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						size: "sm",
						disabled: save.isPending,
						children: "Save"
					})]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Thread, {
			entityType: "deal",
			entityId: deal.id
		})] })] }) : null })
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
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetContent, { children: row ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: "Eversys module"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, { children: row.moduleId }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: row.status })
			})
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetBody, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
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
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Location / account",
					name: "location",
					defaultValue: row.location ?? ""
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "WO #",
					name: "wo",
					defaultValue: row.wo ?? ""
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Tech" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TechSelect, {
					name: "technician",
					defaultValue: row.technician ?? ""
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Date in",
					name: "dateIn",
					type: "date",
					defaultValue: row.dateIn ?? ""
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
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
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Thread, {
			entityType: "module",
			entityId: row.id
		})] })] }) : null })
	});
}
function InstallAssets({ installId }) {
	const qc = useQueryClient();
	const assets = useQuery({
		queryKey: ["assets"],
		queryFn: () => listAssets()
	});
	const [pick, setPick] = (0, import_react.useState)("");
	const assigned = (assets.data ?? []).filter((a) => a.installId === installId);
	const ready = (assets.data ?? []).filter((a) => a.status === "ready" && a.site.startsWith("barn"));
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
				children: "Type a warehouse serial on the machine below to pull it in one step — or assign from the rack here."
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
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-3 text-xs text-muted-foreground",
				children: [ready.length, " ready on the rack"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 flex flex-col gap-2 sm:flex-row sm:items-end",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "min-w-0 flex-1",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReadyUnitPicker, {
						units: ready,
						value: pick,
						onChange: setPick
					})
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
function unitLabel(a) {
	return `${a.model} · ${a.slotLabel}${a.serial ? ` · ${a.serial}` : ""}`;
}
function ReadyUnitPicker({ units, value, onChange }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	const [q, setQ] = (0, import_react.useState)("");
	const box = (0, import_react.useRef)(null);
	const query = open ? q : "";
	const matches = (0, import_react.useMemo)(() => filterReadyUnits(units, query), [units, query]);
	const selected = units.find((a) => String(a.id) === value) ?? null;
	const notFound = query.trim().length >= 2 && matches.length === 0;
	(0, import_react.useEffect)(() => {
		if (!open) return;
		function onDoc(e) {
			if (!box.current?.contains(e.target)) {
				setOpen(false);
				setQ("");
			}
		}
		document.addEventListener("mousedown", onDoc);
		return () => document.removeEventListener("mousedown", onDoc);
	}, [open]);
	function pick(id) {
		onChange(id);
		setQ("");
		setOpen(false);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		ref: box,
		className: "relative",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex min-h-11 w-full items-center gap-2 rounded-full border border-input bg-background px-3 text-sm focus-within:ring-2 focus-within:ring-ring",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					value: open ? q : selected ? unitLabel(selected) : "",
					placeholder: "Ready unit on the rack…",
					autoComplete: "off",
					"aria-label": "Ready unit on the rack",
					"aria-expanded": open,
					role: "combobox",
					className: "min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground",
					onChange: (e) => {
						setQ(e.target.value);
						if (!open) setOpen(true);
					},
					onFocus: () => {
						setOpen(true);
						setQ("");
					},
					onKeyDown: (e) => {
						if (e.key === "Escape") setOpen(false);
						if (e.key === "Enter") {
							e.preventDefault();
							if (matches[0]) pick(String(matches[0].id));
						}
					}
				}),
				selected && !open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted",
					"aria-label": "Clear",
					onMouseDown: (e) => {
						e.preventDefault();
						onChange("");
					},
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" })
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronsUpDown, { className: "size-4 shrink-0 text-muted-foreground" })
			]
		}), open ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			"data-combo-popover": "",
			className: "absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-soft",
			children: [notFound ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-2 py-1.5 text-xs text-muted-foreground",
				children: "No unit on the rack matches that search."
			}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
				className: "max-h-80 overflow-y-auto py-1",
				role: "listbox",
				children: [matches.map((a) => {
					const active = String(a.id) === value;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						role: "option",
						"aria-selected": active,
						className: active ? "flex min-h-10 w-full items-center px-2 py-1.5 text-left text-sm bg-muted" : "flex min-h-10 w-full items-center px-2 py-1.5 text-left text-sm hover:bg-muted",
						onMouseDown: (e) => {
							e.preventDefault();
							pick(String(a.id));
						},
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "min-w-0 truncate",
							children: unitLabel(a)
						})
					}) }, a.id);
				}), !matches.length && !notFound ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "px-2 py-2 text-xs text-muted-foreground",
					children: "Nothing ready on the rack."
				}) : null]
			})]
		}) : null]
	});
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
				if (f.kind === "rep") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RepSelect, {
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
//#region src/components/desk/customer-sheet.tsx
var KIND_LABEL = {
	service: "Service",
	tlc: "TLC",
	pm: "PM",
	install: "Install",
	deal: "Pipeline",
	recipe: "Recipe"
};
var FILTERS$1 = [
	{
		id: "all",
		label: "All"
	},
	{
		id: "service",
		label: "Service"
	},
	{
		id: "tlc",
		label: "TLC"
	},
	{
		id: "pm",
		label: "PMs"
	},
	{
		id: "install",
		label: "Installs"
	},
	{
		id: "deal",
		label: "Pipeline"
	}
];
function jobItem(j) {
	return {
		key: `${j.kind}-${j.id}`,
		kind: j.kind,
		id: j.id,
		title: j.callId,
		subtitle: [j.wo, j.issue].filter(Boolean).join(" · "),
		status: j.status,
		date: j.received ?? j.scheduled,
		technician: j.technician,
		equipment: j.equipment,
		flag: j.flag,
		urgency: j.urgency
	};
}
function pmItem(p) {
	return {
		key: `pm-${p.id}`,
		kind: "pm",
		id: p.id,
		title: p.style || "Preventative maintenance",
		subtitle: p.equipment ?? "",
		status: p.status,
		date: p.projected ?? p.received,
		technician: p.technician,
		equipment: p.equipment,
		flag: p.flag
	};
}
function installItem(i) {
	return {
		key: `install-${i.id}`,
		kind: "install",
		id: i.id,
		title: i.wo || "Install",
		subtitle: i.equipment ?? "",
		status: i.equipStatus,
		date: i.installDate ?? i.received,
		technician: i.technician,
		equipment: i.equipment,
		flag: i.flag
	};
}
function dealItem(d) {
	return {
		key: `deal-${d.id}`,
		kind: "deal",
		id: d.id,
		title: d.equipment || "Deal",
		subtitle: [d.producer, d.amount != null ? money(d.amount) : null].filter(Boolean).join(" · "),
		status: d.completion,
		date: d.dateOfDeal,
		technician: d.producer,
		equipment: d.equipment,
		flag: null
	};
}
function stamp(iso) {
	if (!iso) return 0;
	const t = Date.parse(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
	return Number.isFinite(t) ? t : 0;
}
function CustomerHistorySheet({ customerId, onClose }) {
	const navigate = useNavigate();
	const qc = useQueryClient();
	const history = useQuery({
		queryKey: ["customer-history", customerId],
		queryFn: () => getCustomerHistory({ data: { id: customerId } }),
		enabled: customerId != null
	});
	const directoryEquip = useQuery({
		queryKey: ["directory", "equipment"],
		queryFn: () => listDirectory({ data: { kind: "equipment" } }),
		enabled: customerId != null
	});
	const houseRecipes = useQuery({
		queryKey: ["recipes"],
		queryFn: () => listRecipes(),
		enabled: customerId != null
	});
	const [filter, setFilter] = (0, import_react.useState)("all");
	const [q, setQ] = (0, import_react.useState)("");
	const [selectedKey, setSelectedKey] = (0, import_react.useState)(null);
	const [reviewing, setReviewing] = (0, import_react.useState)(false);
	const [recipeDraft, setRecipeDraft] = (0, import_react.useState)(null);
	const [editing, setEditing] = (0, import_react.useState)(false);
	const me = useQuery({
		queryKey: ["access", "me"],
		queryFn: () => getMyAccess(),
		enabled: customerId != null
	});
	(0, import_react.useEffect)(() => {
		setSelectedKey(null);
		setReviewing(false);
		setRecipeDraft(null);
		setFilter("all");
		setQ("");
		setEditing(false);
	}, [customerId, history.data?.name]);
	const rename = useMutation({
		mutationFn: (n) => renameCustomer({ data: {
			id: customerId,
			name: n
		} }),
		onSuccess: (row) => {
			toast.success(row.merged ? `Merged into “${row.name}”` : `Renamed to “${row.name}”`);
			setEditing(false);
			qc.invalidateQueries({ queryKey: ["customers"] });
			qc.invalidateQueries({ queryKey: ["customer-history"] });
			qc.invalidateQueries({ queryKey: ["directory"] });
			qc.invalidateQueries({ queryKey: ["jobs"] });
			qc.invalidateQueries({ queryKey: ["pms"] });
			qc.invalidateQueries({ queryKey: ["installs"] });
			qc.invalidateQueries({ queryKey: ["deals"] });
			qc.invalidateQueries({ queryKey: ["recipes"] });
			qc.invalidateQueries({ queryKey: ["network"] });
			if (row.merged || row.id !== customerId) navigate({
				to: "/customers",
				search: { open: row.id },
				replace: true
			});
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save name")
	});
	const data = history.data;
	const items = (0, import_react.useMemo)(() => {
		if (!data) return [];
		const all = [
			...data.jobs.map(jobItem),
			...data.pms.map(pmItem),
			...data.installs.map(installItem),
			...data.deals.map(dealItem)
		];
		all.sort((a, b) => stamp(b.date) - stamp(a.date) || b.id - a.id);
		return all;
	}, [data]);
	const counts = (0, import_react.useMemo)(() => {
		const c = {
			all: items.length,
			service: 0,
			tlc: 0,
			pm: 0,
			install: 0,
			deal: 0
		};
		for (const it of items) {
			if (it.kind === "recipe") continue;
			c[it.kind] += 1;
		}
		return c;
	}, [items]);
	const visible = (0, import_react.useMemo)(() => {
		const needle = q.trim().toLowerCase();
		return items.filter((it) => {
			if (filter !== "all" && it.kind !== filter) return false;
			if (!needle) return true;
			return [
				it.title,
				it.subtitle,
				it.equipment,
				it.technician,
				it.status
			].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle));
		});
	}, [
		items,
		filter,
		q
	]);
	const selected = items.find((it) => it.key === selectedKey) ?? null;
	const selectedJob = selected?.kind === "service" || selected?.kind === "tlc" ? data?.jobs.find((j) => j.id === selected.id) ?? null : null;
	const selectedPm = selected?.kind === "pm" ? data?.pms.find((p) => p.id === selected.id) ?? null : null;
	const selectedInstall = selected?.kind === "install" ? data?.installs.find((i) => i.id === selected.id) ?? null : null;
	const selectedDeal = selected?.kind === "deal" ? data?.deals.find((d) => d.id === selected.id) ?? null : null;
	const canRename = !!me.data?.isAdmin;
	const pending = (0, import_react.useMemo)(() => items.filter((it) => {
		if (it.kind === "tlc" || it.kind === "service") {
			const j = data?.jobs.find((row) => row.id === it.id);
			return !!j && !j.done && !CLOSED_CALL.has(j.status);
		}
		if (it.kind === "pm") {
			const p = data?.pms.find((row) => row.id === it.id);
			return !!p && !p.done && !CLOSED_PM.has(p.status);
		}
		if (it.kind === "install") {
			const i = data?.installs.find((row) => row.id === it.id);
			return !!i && !i.complete && i.equipStatus !== "Installed";
		}
		return false;
	}), [items, data]);
	const pendingTlcs = pending.filter((it) => it.kind === "tlc");
	const pendingPms = pending.filter((it) => it.kind === "pm");
	const pendingFocus = [...pendingTlcs, ...pendingPms];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
			open: customerId != null,
			onOpenChange: (o) => !o && onClose(),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetContent, {
				className: "sm:max-w-lg",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs tracking-wide text-muted-foreground uppercase",
					children: "Customer"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-start justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetTitle, {
						className: "flex items-center gap-2",
						children: [data?.name ?? "Account", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AkBadge, { on: data?.aviKatz })]
					}), canRename && data ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						type: "button",
						size: "sm",
						variant: "outline",
						onClick: () => setEditing(true),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "size-3.5" }), "Edit"]
					}) : null]
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetBody, { children: history.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "p-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-8 w-2/3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "mt-3 h-24 w-full" })]
				}) : data ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted-foreground",
							children: canRename ? "Edit the name to move every call, install, PM, deal, recipe, and network link onto it." : "Ask an admin to rename this account — history follows the new name."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccountMarksForm, {
							id: data.id,
							aviKatz: data.aviKatz,
							accountRep: data.accountRep
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-4",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProviderDispatchBlock, {
								customer: data.name,
								assignable: true
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative mt-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								value: q,
								onChange: (e) => setQ(e.target.value),
								placeholder: "Search this account…",
								className: "pl-9",
								"aria-label": "Search history"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-3 flex flex-wrap gap-1.5",
							children: FILTERS$1.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => setFilter(f.id),
								className: cn("rounded-full px-3 py-1 text-xs", filter === f.id ? "bg-ink text-ink-foreground" : "bg-muted text-muted-foreground"),
								children: [f.label, counts[f.id] ? ` ${counts[f.id]}` : ""]
							}, f.id))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-4 text-xs text-muted-foreground",
							children: "Select a call or record to review."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: "mt-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase",
								children: "Pending TLC & PMs"
							}), pendingFocus.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border",
								children: pendingFocus.map((it) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HistoryRow, {
									item: it,
									onOpen: () => {
										setSelectedKey(it.key);
										setReviewing(true);
									}
								}, `pending-${it.key}`))
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-sm text-muted-foreground",
								children: "No open TLCs or PMs on this account."
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mt-5 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase",
							children: "Account history"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border",
							children: visible.map((it) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HistoryRow, {
								item: it,
								onOpen: () => {
									setSelectedKey(it.key);
									setReviewing(true);
								}
							}, it.key))
						}),
						!visible.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 text-sm text-muted-foreground",
							children: "Nothing on this account matches."
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerRecipes, {
							customer: data.name,
							recipes: data.recipes,
							house: houseRecipes.data ?? [],
							models: (directoryEquip.data ?? []).map((e) => e.name),
							onOpen: (d) => setRecipeDraft(d)
						})
					]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "p-5 text-sm text-muted-foreground",
					children: "Account not found."
				}) })]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(JobSheet, {
			id: reviewing && selectedJob ? selectedJob.id : null,
			onClose: () => setReviewing(false)
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PmSheet, {
			pm: reviewing ? selectedPm : null,
			onClose: () => setReviewing(false)
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InstallSheet, {
			row: reviewing ? selectedInstall : null,
			onClose: () => setReviewing(false)
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DealSheet, {
			deal: reviewing ? selectedDeal : null,
			onClose: () => setReviewing(false)
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecipeEditorSheet, {
			draft: recipeDraft,
			models: (directoryEquip.data ?? []).map((e) => e.name),
			customers: data ? [data.name] : [],
			onClose: () => setRecipeDraft(null)
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RenameDialog, {
			open: editing,
			title: "Rename customer",
			noun: "customer",
			current: data?.name ?? "",
			pending: rename.isPending,
			onClose: () => setEditing(false),
			onSave: (n) => rename.mutate(n)
		})
	] });
}
function HistoryRow({ item, onOpen }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick: onOpen,
		className: "flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-muted/60",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "mt-0.5 w-16 shrink-0 text-[11px] font-medium tracking-wide text-muted-foreground uppercase",
				children: KIND_LABEL[item.kind]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "min-w-0 flex-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "block font-medium",
					children: item.title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "block text-xs text-muted-foreground",
					children: [
						item.subtitle,
						formatShortDate(item.date),
						item.technician
					].filter(Boolean).join(" · ")
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "flex shrink-0 flex-col items-end gap-1",
				children: [
					item.urgency ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UrgencyBadge, { urgency: item.urgency }) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: item.status }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlagBadge, { flag: item.flag })
				]
			})
		]
	}) });
}
function CustomerRecipes({ customer, recipes, house, models, onOpen }) {
	const qc = useQueryClient();
	const copy = useMutation({
		mutationFn: (sourceId) => copyRecipe({ data: {
			sourceId,
			customer
		} }),
		onSuccess: () => {
			toast.success("Copied onto this account");
			qc.invalidateQueries({ queryKey: ["customer-history"] });
			qc.invalidateQueries({ queryKey: ["recipes"] });
			qc.invalidateQueries({ queryKey: ["customers"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not copy")
	});
	const templates = house.filter((r) => r.isTemplate || !r.customer);
	const others = house.filter((r) => r.customer && r.customer.toLowerCase() !== customer.toLowerCase());
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "mt-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase",
					children: "Recipes"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					type: "button",
					size: "sm",
					variant: "outline",
					onClick: () => onOpen({
						recipe: null,
						customer,
						equipmentModel: models[0] ?? "",
						installId: null,
						copiedFrom: null,
						lockCustomer: true
					}),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), "Add"]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border",
				children: recipes.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/60",
					onClick: () => onOpen({
						recipe: r,
						customer,
						equipmentModel: r.equipmentModel,
						installId: r.installId,
						copiedFrom: r.copiedFrom,
						lockCustomer: true
					}),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block font-medium",
						children: r.equipmentModel
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block text-xs text-muted-foreground",
						children: previewSetting(r) || r.notes || "No settings yet"
					})] })
				}) }, r.id))
			}),
			!recipes.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted-foreground",
				children: "No recipes on this account yet."
			}) : null,
			templates.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground",
					children: "Copy a house template"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-1 flex flex-wrap gap-1.5",
					children: templates.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "rounded-full border border-border px-2.5 py-1 text-xs hover:bg-muted",
						disabled: copy.isPending,
						onClick: () => copy.mutate(r.id),
						children: r.equipmentModel
					}) }, r.id))
				})]
			}) : null,
			others.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground",
					children: "Reuse from another account"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-1 flex flex-wrap gap-1.5",
					children: others.slice(0, 12).map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "rounded-full border border-border px-2.5 py-1 text-xs hover:bg-muted",
						disabled: copy.isPending,
						onClick: () => copy.mutate(r.id),
						children: [
							r.customer,
							" · ",
							r.equipmentModel
						]
					}) }, r.id))
				})]
			}) : null
		]
	});
}
function AccountMarksForm({ id, aviKatz, accountRep }) {
	const qc = useQueryClient();
	const save = useMutation({
		mutationFn: (d) => updateCustomerAccount({ data: {
			id,
			...d
		} }),
		onSuccess: () => {
			toast.success("Account updated");
			qc.invalidateQueries({ queryKey: ["customer-history"] });
			qc.invalidateQueries({ queryKey: ["customers"] });
			qc.invalidateQueries({ queryKey: ["installs"] });
			qc.invalidateQueries({ queryKey: ["deals"] });
			qc.invalidateQueries({ queryKey: ["jobs"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-4 grid gap-3 sm:grid-cols-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RepSelect, {
			label: "Rep",
			defaultValue: accountRep ?? "",
			onChange: (v) => save.mutate({ accountRep: v || null })
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
			className: "flex items-center gap-2 text-sm sm:mt-7",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "checkbox",
					className: "size-4 accent-primary",
					checked: aviKatz,
					onChange: (e) => save.mutate({ aviKatz: e.target.checked })
				}),
				"Avi Katz account (AK)",
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AkBadge, { on: aviKatz })
			]
		})]
	});
}
//#endregion
//#region src/routes/_app/customers.tsx
var Route$15 = createFileRoute("/_app/customers")({
	validateSearch: parseOpenSearch,
	component: Page$14
});
function Page$14() {
	const qc = useQueryClient();
	const navigate = useNavigate();
	const { open } = Route$15.useSearch();
	const [selected, setSelected] = useOpenRecord(open);
	const me = useQuery({
		queryKey: ["access", "me"],
		queryFn: () => getMyAccess()
	});
	const list = useQuery({
		queryKey: ["customers", "records"],
		queryFn: () => listCustomerRecords()
	});
	const [q, setQ] = (0, import_react.useState)("");
	const [name, setName] = (0, import_react.useState)("");
	const { filterMine, matchMine, role } = useMyView();
	const [sort, setSort] = useDeskSort("customers", "alpha-asc");
	const isAdmin = !!me.data?.isAdmin;
	const canAdd = isAdmin || me.data?.canAddCustomers !== false;
	const [renaming, setRenaming] = (0, import_react.useState)(null);
	const add = useMutation({
		mutationFn: (n) => addDirectoryEntry({ data: {
			kind: "customer",
			name: n
		} }),
		onSuccess: (row) => {
			toast.success(`Added ${row.name}`);
			setName("");
			qc.invalidateQueries({ queryKey: ["customers"] });
			qc.invalidateQueries({ queryKey: ["directory", "customer"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add")
	});
	const remove = useMutation({
		mutationFn: (d) => archiveDirectoryEntry({ data: {
			kind: "customer",
			id: d.id
		} }),
		onSuccess: (_ok, d) => {
			toast.success(`Removed “${d.name}”. Existing calls keep the name.`);
			qc.invalidateQueries({ queryKey: ["customers"] });
			qc.invalidateQueries({ queryKey: ["directory", "customer"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove")
	});
	const rename = useMutation({
		mutationFn: (d) => renameCustomer({ data: d }),
		onSuccess: (row) => {
			toast.success(row.merged ? `Merged into “${row.name}”` : `Renamed to “${row.name}”`);
			setRenaming(null);
			qc.invalidateQueries({ queryKey: ["customers"] });
			qc.invalidateQueries({ queryKey: ["directory"] });
			qc.invalidateQueries({ queryKey: ["jobs"] });
			qc.invalidateQueries({ queryKey: ["pms"] });
			qc.invalidateQueries({ queryKey: ["installs"] });
			qc.invalidateQueries({ queryKey: ["deals"] });
			qc.invalidateQueries({ queryKey: ["recipes"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["customer-history"] });
			qc.invalidateQueries({ queryKey: ["network"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not rename")
	});
	const needle = q.trim().toLowerCase();
	const rows = (0, import_react.useMemo)(() => {
		const raw = list.data ?? [];
		const filtered = needle ? raw.filter((c) => c.name.toLowerCase().includes(needle)) : raw;
		return sortDesk(filterMine && role === "sales" ? filtered.filter((c) => c.aviKatz || matchMine(c.accountRep)) : filtered, sort, {
			name: (c) => c.name,
			date: () => ""
		});
	}, [
		list.data,
		needle,
		sort,
		filterMine,
		matchMine,
		role
	]);
	function onAdd(e) {
		e.preventDefault();
		const n = name.trim();
		if (!n) return;
		add.mutate(n);
	}
	function openCustomer(id) {
		setSelected(id);
		navigate({
			to: "/customers",
			search: { open: id },
			replace: true
		});
	}
	function closeCustomer() {
		setSelected(null);
		navigate({
			to: "/customers",
			search: {},
			replace: true
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "font-display text-3xl font-medium tracking-tight",
			children: "Customers"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-1 max-w-xl text-sm text-muted-foreground",
			children: ["Search the account list. Open a name to review every call, TLC, PM, install, and record on that account — then update the one you pick.", canAdd ? " Add a new name when the account isn’t on the list yet." : " Ask an admin if a name is missing."]
		})] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 flex flex-col gap-3 sm:flex-row sm:items-end",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative min-w-0 flex-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: q,
					onChange: (e) => setQ(e.target.value),
					placeholder: "Search customers…",
					className: "pl-9",
					"aria-label": "Search customers"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
				value: sort,
				onChange: setSort,
				options: [...SORT_ALPHA]
			})]
		}),
		canAdd ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			onSubmit: onAdd,
			className: "mt-4 flex flex-col gap-2 sm:flex-row",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				value: name,
				onChange: (e) => setName(e.target.value),
				placeholder: "Add a customer name",
				className: "min-w-0 flex-1",
				"aria-label": "New customer name"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				type: "submit",
				disabled: add.isPending || name.trim().length < 2,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "Add customer"]
			})]
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-4 text-xs text-muted-foreground",
			children: list.isLoading ? "Loading accounts…" : list.isError ? "Could not load accounts." : `${rows.length} ${rows.length === 1 ? "account" : "accounts"}${needle ? ` matching “${q.trim()}”` : ""}`
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
			className: "mt-2 overflow-hidden rounded-xl border border-border bg-card",
			children: [rows.map((c) => {
				const pending = pendingLine(c);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border px-2 py-1 last:border-b-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => openCustomer(c.id),
						className: "flex min-w-0 items-center gap-3 rounded-md px-2 py-2.5 text-left hover:bg-muted/60",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "truncate font-medium",
									children: [
										c.name,
										" ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AkBadge, {
											on: c.aviKatz,
											className: "ml-1 align-middle"
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "truncate text-xs text-muted-foreground",
									children: [
										c.accountRep ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RepName, { name: c.accountRep }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NoRepFlag, { show: true }),
										" · ",
										countLabel(c.calls, "call", "calls"),
										" · ",
										countLabel(c.tlcs, "TLC", "TLCs"),
										" · ",
										countLabel(c.pms, "PM", "PMs"),
										" · ",
										countLabel(c.installs, "install", "installs"),
										c.deals ? ` · ${countLabel(c.deals, "deal", "deals")}` : "",
										c.recipes ? ` · ${countLabel(c.recipes, "recipe", "recipes")}` : ""
									]
								}),
								pending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "truncate text-xs text-amber-800 dark:text-amber-300",
									children: pending
								}) : null
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4 shrink-0 text-muted-foreground" })]
					}), isAdmin ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex shrink-0 items-center gap-1 pr-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							type: "button",
							size: "sm",
							variant: "outline",
							"aria-label": `Rename ${c.name}`,
							onClick: () => setRenaming({
								id: c.id,
								name: c.name
							}),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "size-3.5" }), "Edit"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							type: "button",
							size: "sm",
							variant: "outline",
							disabled: remove.isPending,
							onClick: () => {
								if (window.confirm(`Remove “${c.name}” from the customer list?`)) remove.mutate({
									id: c.id,
									name: c.name
								});
							},
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), "Remove"]
						})]
					}) : null]
				}, c.id);
			}), list.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
				className: "px-4 py-8 text-sm text-muted-foreground",
				children: "Loading accounts…"
			}) : rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
				className: "px-4 py-8 text-sm text-muted-foreground",
				children: needle ? "No customers match that search." : "No customers in the list yet."
			}) : null]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerHistorySheet, {
			customerId: selected,
			onClose: closeCustomer
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RenameDialog, {
			open: !!renaming,
			title: "Rename customer",
			noun: "customer",
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
function countLabel(n, one, many) {
	return `${n} ${n === 1 ? one : many}`;
}
function pendingLine(c) {
	const bits = [
		c.pendingCalls ? countLabel(c.pendingCalls, "call", "calls") : null,
		c.pendingTlcs ? countLabel(c.pendingTlcs, "TLC", "TLCs") : null,
		c.pendingPms ? countLabel(c.pendingPms, "PM", "PMs") : null,
		c.pendingInstalls ? countLabel(c.pendingInstalls, "install", "installs") : null
	].filter(Boolean);
	return bits.length ? `Pending: ${bits.join(" · ")}` : "";
}
//#endregion
//#region src/components/desk/handoff-reply.tsx
function HandoffReply({ entityType, entityId }) {
	const qc = useQueryClient();
	const [open, setOpen] = (0, import_react.useState)(false);
	const [body, setBody] = (0, import_react.useState)("");
	const [sent, setSent] = (0, import_react.useState)([]);
	const teammates = useQuery({
		queryKey: ["teammates"],
		queryFn: () => listTeammates(),
		enabled: open
	});
	const send = useMutation({
		mutationFn: () => addComment({ data: {
			entityType,
			entityId,
			body,
			askTeam: null
		} }),
		onSuccess: (saved) => {
			setBody("");
			setOpen(false);
			setSent((prev) => [...prev, saved]);
			qc.invalidateQueries({ queryKey: [
				"comments",
				entityType,
				entityId
			] });
			qc.invalidateQueries({ queryKey: [
				"activity",
				entityType,
				entityId
			] });
			qc.invalidateQueries({ queryKey: ["handoff"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["notifications"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not send")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0",
		children: [sent.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mb-2 space-y-2",
			children: sent.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "rounded-lg border border-border bg-background px-3 py-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs font-medium",
					children: [c.ownerLabel, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ml-1 font-normal text-muted-foreground",
						children: "replied"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-1 text-sm leading-relaxed",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MentionBody, { text: c.body })
				})]
			}, c.id))
		}) : null, open ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "space-y-2",
			onSubmit: (e) => {
				e.preventDefault();
				if (body.trim()) send.mutate();
			},
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MentionField, {
				multiline: true,
				value: body,
				onChange: setBody,
				teammates: teammates.data ?? [],
				placeholder: "Write a reply…"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap justify-end gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					size: "sm",
					variant: "ghost",
					onClick: () => {
						setOpen(false);
						setBody("");
					},
					children: "Cancel"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "submit",
					size: "sm",
					disabled: send.isPending || !body.trim(),
					children: send.isPending ? "Sending…" : "Send"
				})]
			})]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: "h-8 rounded-full px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
			onClick: () => setOpen(true),
			children: "Reply"
		})]
	});
}
//#endregion
//#region src/routes/_app/handoff.tsx
var Route$14 = createFileRoute("/_app/handoff")({ component: Page$13 });
function Page$13() {
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
	const claim = useMutation({
		mutationFn: (id) => claimComment({ data: { id } }),
		onSuccess: () => {
			toast.success("Note is under your name");
			qc.invalidateQueries({ queryKey: ["handoff"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["comments"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not claim")
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
		name: (c) => c.customer ?? c.ownerLabel
	}), [filtered.asks, sort]);
	const sortedRecent = (0, import_react.useMemo)(() => sortDesk(filtered.recent, sort, {
		date: (c) => c.createdAt,
		name: (c) => c.customer ?? c.ownerLabel
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
				children: "The conversation between sales and service. Mine shows asks, notes, and completed deals that belong to you. Notes without a poster show as Service until someone claims them."
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
						className: "py-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center justify-between gap-3",
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
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-2",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HandoffReply, {
								entityType: "deal",
								entityId: p.dealId
							})
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
										children: c.ownerLabel
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [
											c.canClaim ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												className: "h-8 rounded-full px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
												disabled: claim.isPending,
												onClick: () => claim.mutate(c.id),
												children: "Claim"
											}) : null,
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PingButton, {
												size: "xs",
												entityType: c.entityType,
												entityId: c.entityId,
												commentId: c.id,
												pingedAt: c.pingedAt,
												contextLabel: `${c.customer ?? c.entityType} · ${c.body.slice(0, 80)}`,
												defaultNote: c.body
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												className: "text-xs text-muted-foreground underline-offset-2 hover:underline",
												onClick: () => resolve.mutate(c.id),
												children: "Mark answered"
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-2",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HandoffReply, {
										entityType: c.entityType,
										entityId: c.entityId
									})
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
						children: sortedRecent.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-start justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-sm",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-medium",
										children: c.ownerLabel
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-muted-foreground",
										children: [" · ", c.customer ?? c.entityType]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-1",
									children: [c.canClaim ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "h-8 rounded-full px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
										disabled: claim.isPending,
										onClick: () => claim.mutate(c.id),
										children: "Claim"
									}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PingButton, {
										size: "xs",
										entityType: c.entityType,
										entityId: c.entityId,
										commentId: c.id,
										pingedAt: c.pingedAt,
										contextLabel: `${c.customer ?? c.entityType} · ${c.body.slice(0, 80)}`,
										defaultNote: c.body
									})]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-sm leading-relaxed text-muted-foreground",
								children: c.body
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-2",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HandoffReply, {
									entityType: c.entityType,
									entityId: c.entityId
								})
							})
						] }, c.id))
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
//#region src/routes/_app/installs.tsx
var Route$13 = createFileRoute("/_app/installs")({
	validateSearch: parseOpenSearch,
	component: Page$12
});
function Page$12() {
	const { open } = Route$13.useSearch();
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
	const { filterMine, matchMine, board } = useMyView();
	const [repFilter, setRepFilter] = (0, import_react.useState)("");
	const [akOnly, setAkOnly] = (0, import_react.useState)(false);
	const [view, setView] = (0, import_react.useState)(board ? "board" : "queue");
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
		if (filterMine) list = list.filter((i) => matchMine(i.accountRep, i.technician) || i.aviKatz);
		if (repFilter === "__none__") list = list.filter((i) => i.noRep);
		else if (repFilter) list = list.filter((i) => sameRep(i.accountRep, repFilter));
		if (akOnly) list = list.filter((i) => i.aviKatz);
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
		sort,
		filterMine,
		matchMine,
		repFilter,
		akOnly
	]);
	const selectedRow = (data.data ?? []).find((i) => i.id === selected) ?? null;
	const allInstalls = data.data ?? [];
	const atRisk = allInstalls.filter((i) => i.flag).length;
	const recipes = recs.data ?? [];
	const readyN = allInstalls.filter((i) => !i.complete && i.equipStatus === "Ready").length;
	const notReadyN = allInstalls.filter((i) => !i.complete && i.equipStatus !== "Ready" && i.equipStatus !== "Installed").length;
	const installedN = allInstalls.filter((i) => i.complete || i.equipStatus === "Installed").length;
	const week = weekBounds(todayChicago());
	const openInstalls = allInstalls.filter((i) => !i.complete && i.equipStatus !== "Installed");
	const readyOpen = openInstalls.filter((i) => i.equipStatus === "Ready");
	const notReadyOpen = openInstalls.filter((i) => i.equipStatus !== "Ready");
	const datedThisWeek = (list) => list.filter((i) => i.installDate && i.installDate >= week.start && i.installDate <= week.end).length;
	const noDate = (list) => list.filter((i) => !i.installDate).length;
	const readyByEquip = tally(allInstalls.filter((i) => !i.complete && i.equipStatus === "Ready").flatMap((i) => {
		const listed = listedEquipment((i.machines ?? []).map((m) => m.equipment).join("\n") || i.equipment, catalog);
		return listed.length ? listed : [matchModel(i.equipment || "Unspecified", catalog)];
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
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MyViewBar, {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExportButton, {
						defaultType: "installs",
						label: "Export readiness"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						onClick: () => setCreate(true),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "New install"]
					})
				]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-4 rounded-xl border border-border bg-card px-4 py-3",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "flex items-start gap-2 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "mt-0.5 size-4 shrink-0 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-medium",
					children: "New install requests — "
				}), "There is a 2-week lead-time to allow time to prep equipment, including in-between service calls and PMs."] })]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-3 text-sm text-muted-foreground",
			children: [atRisk, " at risk this week or next."]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-1 text-sm",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-medium",
					children: notReadyN
				}),
				" not ready",
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "text-muted-foreground",
					children: [
						" ",
						"(",
						datedThisWeek(notReadyOpen),
						" this week · ",
						noDate(notReadyOpen),
						" no date)"
					]
				}),
				" · ",
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-medium",
					children: readyN
				}),
				" ready",
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "text-muted-foreground",
					children: [
						" ",
						"(",
						datedThisWeek(readyOpen),
						" this week · ",
						noDate(readyOpen),
						" no date)"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-muted-foreground",
					children: " — weekly team update"
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 grid min-w-0 grid-cols-3 gap-2 sm:gap-3",
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
			className: "mt-4 grid min-w-0 gap-4 lg:grid-cols-2",
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
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RepFilter, {
					value: repFilter,
					onChange: setRepFilter,
					extraNames: (data.data ?? []).map((i) => i.accountRep)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "flex h-9 items-center gap-2 rounded-full bg-secondary px-3 text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "checkbox",
						className: "size-4 accent-primary",
						checked: akOnly,
						onChange: (e) => setAkOnly(e.target.checked)
					}), "AK"]
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
			onClose: () => setSelected(null),
			onOpenRelated: (id) => setSelected(id)
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecipeEditorSheet, {
			draft: recipeDraft,
			models: catalog,
			customers: customers.data ?? [],
			onClose: () => setRecipeDraft(null)
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NewInstallDialog, {
			open: create,
			existing: allInstalls,
			onOpenChange: setCreate,
			onCreated: (id) => setSelected(id),
			onOpenExisting: (id) => {
				setCreate(false);
				setSelected(id);
			}
		})
	] });
}
function sameAccount(name, rows, exceptId) {
	const n = name.trim().toLowerCase();
	if (!n) return [];
	return rows.filter((i) => i.customer.trim().toLowerCase() === n && i.id !== exceptId);
}
function NewInstallDialog({ open, existing, onOpenChange, onCreated, onOpenExisting }) {
	const qc = useQueryClient();
	const [customer, setCustomer] = (0, import_react.useState)("");
	const [equipment, setEquipment] = (0, import_react.useState)([]);
	const [specs, setSpecs] = (0, import_react.useState)([]);
	const [pending, setPending] = (0, import_react.useState)(false);
	const matches = sameAccount(customer, existing);
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
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "New install" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-3 rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "flex items-start gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "mt-0.5 size-4 shrink-0 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "There is a 2-week lead-time to allow time to prep equipment, including in-between service calls and PMs." })]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
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
							if (row.duplicateOf) toast.success("Install added — flagged as a possible duplicate so you can compare.");
							else toast.success("Install added");
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
								onChange: (v) => {
									try {
										setCustomer(v);
									} catch (err) {
										toast.error(err instanceof Error ? err.message : "Could not set customer");
									}
								},
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
						matches.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "font-medium text-warning",
									children: [
										"This account already has ",
										matches.length === 1 ? "an install request" : `${matches.length} install requests`,
										"."
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-xs text-muted-foreground",
									children: "Open the existing one if this is a duplicate, or create a new request — we’ll flag it so you can compare."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
									className: "mt-2 space-y-1",
									children: matches.slice(0, 4).map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										className: "text-left text-sm hover:underline",
										onClick: () => onOpenExisting(i.id),
										children: [
											i.equipStatus ?? "Open",
											" · ",
											formatShortDate(i.installDate ?? i.received),
											" · ",
											i.equipment || "No equipment",
											i.complete ? " (installed)" : ""
										]
									}) }, i.id))
								}),
								matches.length > 4 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-1 text-xs text-muted-foreground",
									children: [
										"+",
										matches.length - 4,
										" more"
									]
								}) : null
							]
						}) : null,
						customer && specs.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MachineFields, {
							specs,
							onChange: setSpecs
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex justify-end",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "submit",
								disabled: pending || !customer.trim(),
								children: matches.length ? "Create new request" : "Create"
							})
						})
					]
				})
			]
		})
	});
}
function useRemoveEquip(install, catalog) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (label) => {
			const nextEquip = dropEquipment(install.equipment, label, catalog);
			const names = listedEquipment(nextEquip, catalog);
			const packed = serializeMachines(mergeMachineSpecs(names, install.machines ?? []));
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
			const nextEquip = dropEquipment(install.equipment, label, catalog);
			const names = listedEquipment(nextEquip, catalog);
			const packed = serializeMachines(mergeMachineSpecs(names, install.machines ?? []));
			qc.setQueryData(["installs"], (old) => (old ?? []).map((r) => r.id === install.id ? {
				...r,
				equipment: packed.equipment,
				serial: packed.serial,
				powerVoltage: packed.powerVoltage,
				machines: packed.machines ? parseMachinesJson(packed.machines) : []
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
function useArchiveInstall(install) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => archiveInstall({ data: { id: install.id } }),
		onSuccess: () => {
			toast.success(`Removed ${install.customer} from the list`);
			qc.invalidateQueries({ queryKey: ["installs"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["customers"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove")
	});
}
function DuplicateBadge({ install }) {
	if (!install.duplicateOf) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		variant: "warn",
		children: "Possible duplicate"
	});
}
function RemoveInstallButton({ install }) {
	const remove = useArchiveInstall(install);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
		type: "button",
		size: "sm",
		variant: "outline",
		className: "shrink-0",
		"aria-label": `Remove ${install.customer} from the list`,
		"data-testid": "archive-row",
		disabled: remove.isPending,
		onClick: (e) => {
			e.stopPropagation();
			if (window.confirm(`Remove “${install.customer}” from the install list?`)) remove.mutate();
		},
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "hidden sm:inline",
			children: "Remove"
		})]
	});
}
function InstallRow({ install: i, catalog, recipes, onOpen, onRecipe }) {
	const pieces = piecesForInstall(i.equipment, i.customer, i.id, catalog, recipes);
	const remove = useRemoveEquip(i, catalog);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("article", {
		className: "border-b border-border px-3 py-3 last:border-b-0 md:px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-start gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-1 gap-1 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-center",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: onOpen,
								className: "text-left tabular text-sm font-medium hover:underline",
								children: i.daysOut == null ? "needs date" : i.daysOut < 0 ? `${i.daysOut}d` : i.daysOut === 0 ? "today" : `${i.daysOut}d`
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: onOpen,
								className: "min-w-0 truncate text-left font-medium hover:underline",
								children: [
									i.customer,
									" ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AkBadge, {
										on: i.aviKatz,
										className: "ml-1 align-middle"
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap gap-1",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlagBadge, { flag: i.flag }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: i.equipStatus }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DuplicateBadge, { install: i })
								]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: onOpen,
						className: "mt-0.5 text-left text-sm text-muted-foreground hover:text-foreground sm:pl-20",
						children: [
							formatShortDate(i.installDate),
							" · ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TechName, { name: i.technician }),
							" · ",
							i.accountRep ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RepName, { name: i.accountRep }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NoRepFlag, { show: true })
						]
					}),
					machineNotes(i),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-2 flex flex-wrap gap-1.5 sm:pl-20",
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
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RemoveInstallButton, { install: i })]
		})
	});
}
function InstallCard({ install: i, catalog, recipes, onOpen, onRecipe }) {
	const pieces = piecesForInstall(i.equipment, i.customer, i.id, catalog, recipes);
	const remove = useRemoveEquip(i, catalog);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg border border-border bg-background px-3 py-2.5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: onOpen,
					className: "min-w-0 flex-1 text-left hover:underline",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "font-medium",
						children: [
							i.customer,
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AkBadge, {
								on: i.aviKatz,
								className: "ml-1 align-middle"
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-0.5 text-xs text-muted-foreground",
						children: formatShortDate(i.installDate)
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RemoveInstallButton, { install: i })]
			}),
			machineNotes(i, false),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-1 flex flex-wrap gap-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlagBadge, { flag: i.flag }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DuplicateBadge, { install: i }),
					i.noRep ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NoRepFlag, { show: true }) : null
				]
			}),
			pieces.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-2 flex flex-wrap gap-1.5",
				children: pieces.map((p, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecipeChip, {
					piece: p,
					customer: i.customer,
					installId: i.id,
					recipes,
					onOpen: onRecipe,
					onRemove: () => remove.mutate(p.label)
				}, `${p.model}-${p.label}-${idx}`))
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
	const [serviceCustomer, setServiceCustomer] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		setModel(asset?.model ?? "");
		setOwned(asset?.customerOwned ?? "");
		setSoldTo(asset?.soldTo ?? "");
		setInstallId("");
		setServiceCustomer("");
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
			qc.invalidateQueries({ queryKey: ["jobs"] });
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
			setInstallId("");
			qc.invalidateQueries({ queryKey: ["assets"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["installs"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not assign")
	});
	const assignService = useMutation({
		mutationFn: () => assignAssetToService({ data: {
			assetId: asset.id,
			customer: serviceCustomer
		} }),
		onSuccess: () => {
			toast.success("Pulled for service — off the warehouse board");
			setServiceCustomer("");
			qc.invalidateQueries({ queryKey: ["assets"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["jobs"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not assign")
	});
	const queue = (installs.data ?? []).filter((i) => !i.complete && i.equipStatus !== "Installed");
	const pallets = retSite === "barn-front" ? FRONT_PALLETS : BACK_PALLETS;
	const bay = asset ? bayFor(asset.site, asset.pallet) : "general";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
		open: !!asset,
		onOpenChange: (o) => !o && onClose(),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetContent, { children: asset ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: [asset.slotLabel, asset.customerOwned ? ` · owned by ${asset.customerOwned}` : ""]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, { children: asset.model }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 flex flex-wrap gap-1.5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: statusLabel(asset) }),
					bay === "catering" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "Catering" }) : null,
					bay === "dispenser" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "Dispenser" }) : null,
					asset.missingSerial ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "Serial missing" }) : null
				]
			})
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetBody, { children: [
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
				className: "space-y-5 border-b border-border p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs tracking-wide text-muted-foreground uppercase",
							children: "Pull for install"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
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
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs tracking-wide text-muted-foreground uppercase",
								children: "Pull for service"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-muted-foreground",
								children: "Pick an account already on the customer list. The unit leaves the rack."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-2 sm:flex-row sm:items-end",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex-1",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerCombo, {
										label: "Customer",
										value: serviceCustomer,
										onChange: setServiceCustomer,
										allowCreate: false,
										placeholder: "Search accounts…"
									})
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									disabled: !serviceCustomer.trim() || assignService.isPending,
									onClick: () => assignService.mutate(),
									children: "Assign & remove from barn"
								})]
							})
						]
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
						children: asset.status === "assigned" ? asset.installId ? `Out on ${asset.soldTo ?? "an install"}. Put it back on a slot to free the account.` : `Out on service for ${asset.soldTo ?? "an account"}. Put it back on a slot when it returns.` : `Currently at ${SITE_LABEL[asset.site] ?? asset.site}.`
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
		] })] }) : null })
	});
}
function statusLabel(asset) {
	if (asset.status === "ready") return "Ready";
	if (asset.status === "deployed") return "In use";
	if (asset.status === "assigned") {
		if (asset.installId) return "On an install";
		if (asset.purpose?.toLowerCase().includes("service")) return "On service";
		return "Pulled";
	}
	if (asset.status === "sold") return "Sold";
	return asset.status;
}
//#endregion
//#region src/routes/_app/locations.tsx
var Route$12 = createFileRoute("/_app/locations")({
	validateSearch: parseOpenSearch,
	component: Page$11
});
function Page$11() {
	const { open } = Route$12.useSearch();
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
				children: "Units not on the barn racks — lobby, service room, training, SATX, and anything currently pulled for an install or a service call. Return a unit to free the slot for the next job."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				onClick: () => setCreate(true),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "Log at a location"]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 grid min-w-0 grid-cols-3 gap-2 sm:gap-3",
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
					["field", `Pulled (${fieldCount})`],
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
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: a.status === "sold" ? "Sold" : a.status === "assigned" ? a.installId ? "On an install" : "On service" : "In use" })
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
var Route$11 = createFileRoute("/_app/modules")({
	validateSearch: parseOpenSearch,
	component: Page$10
});
function Page$10() {
	const { open } = Route$11.useSearch();
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
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExportButton, { defaultType: "modules" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					onClick: () => setCreate(true),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "New module"]
				})]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 grid min-w-0 gap-3 md:grid-cols-3",
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
			className: "mt-5 grid min-w-0 gap-4 lg:grid-cols-2",
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
						className: "text-sm",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TechName, { name: m.technician })
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
//#region src/components/desk/provider-locations.tsx
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
//#endregion
//#region src/components/desk/provider-people.tsx
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
//#endregion
//#region src/components/desk/provider-sheet.tsx
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
//#endregion
//#region src/routes/_app/network.tsx
var Route$10 = createFileRoute("/_app/network")({
	validateSearch: parseOpenSearch,
	component: Page$9
});
function Page$9() {
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
//#region src/routes/_app/pipeline.tsx
var Route$9 = createFileRoute("/_app/pipeline")({
	validateSearch: parseOpenSearch,
	component: Page$8
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
function Chip({ active, onClick, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick,
		"aria-pressed": active,
		className: `h-9 shrink-0 rounded-full px-3 text-sm font-medium ${active ? "bg-ink text-ink-foreground" : "bg-secondary"}`,
		children
	});
}
function Page$8() {
	const { open } = Route$9.useSearch();
	const qc = useQueryClient();
	const data = useQuery({
		queryKey: ["deals"],
		queryFn: () => listDeals()
	});
	const [q, setQ] = (0, import_react.useState)("");
	const [view, setView] = (0, import_react.useState)("gto");
	const [selected, setSelected] = useOpenRecord(open);
	const [create, setCreate] = (0, import_react.useState)(false);
	const { filterMine, matchMine } = useMyView();
	const [repFilter, setRepFilter] = (0, import_react.useState)("");
	const [sort, setSort] = useDeskSort("pipeline", "date-desc");
	const all = data.data ?? [];
	const live = all.filter((d) => d.completion !== "fell");
	const active = live.filter((d) => d.completion !== "complete");
	const completed = live.filter((d) => d.completion === "complete");
	const unlisted = live.filter((d) => isNoRep(d.producer));
	const gtoN = active.filter((d) => d.goodToOrder && !d.ordered).length;
	const orderedN = active.filter((d) => d.ordered).length;
	const producerChart = PRODUCERS.map((p) => {
		const mine = live.filter((d) => sameRep(d.producer, p));
		return {
			producer: p,
			open: Math.round(sum(mine.filter((d) => d.completion !== "complete"))),
			done: Math.round(sum(mine.filter((d) => d.completion === "complete")))
		};
	}).filter((p) => p.open + p.done > 0);
	const funnel = [
		{
			stage: "Good to order",
			count: gtoN
		},
		{
			stage: "Ordered",
			count: orderedN
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
		if (view === "gto") list = list.filter((d) => d.completion !== "complete" && d.completion !== "fell" && d.goodToOrder && !d.ordered);
		if (view === "ordered") list = list.filter((d) => d.completion !== "complete" && d.completion !== "fell" && d.ordered);
		if (filterMine) list = list.filter((d) => matchMine(d.producer) || d.aviKatz);
		if (repFilter === "__none__") list = list.filter((d) => d.noRep);
		else if (repFilter) list = list.filter((d) => sameRep(d.producer, repFilter));
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
		sort,
		filterMine,
		matchMine,
		repFilter
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
				children: "One row per equipment deal. Step 1 is Good to order (rep). Step 2 is Ordered (you confirm it) — confirmed orders leave the Good to order list."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MyViewBar, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					onClick: () => setCreate(true),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "New deal"]
				})]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 grid min-w-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6",
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
					value: gtoN,
					hint: "Step 1 — waiting to be ordered"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Ordered",
					value: orderedN,
					hint: "Step 2 — confirmed ordered"
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-5 grid min-w-0 gap-4 lg:grid-cols-2 xl:grid-cols-3",
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
					lede: "Good to order first, then Ordered. Ordered deals drop off step 1.",
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
							const mine = live.filter((d) => sameRep(d.producer, p));
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
									children: "No rep assigned"
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
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Chip, {
					active: view === "gto",
					onClick: () => setView("gto"),
					children: [
						"Good to order (",
						gtoN,
						")"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Chip, {
					active: view === "ordered",
					onClick: () => setView("ordered"),
					children: [
						"Ordered (",
						orderedN,
						")"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Chip, {
					active: view === "open",
					onClick: () => setView("open"),
					children: [
						"Open (",
						active.length,
						")"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Chip, {
					active: view === "complete",
					onClick: () => setView("complete"),
					children: [
						"Complete (",
						completed.length,
						")"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
					active: view === "all",
					onClick: () => setView("all"),
					children: "All deals"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: q,
					onChange: (e) => setQ(e.target.value),
					placeholder: "Filter…",
					className: "w-full max-w-xs min-w-0"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RepFilter, {
					value: repFilter,
					onChange: setRepFilter,
					extraNames: all.map((d) => d.producer)
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
			children: [rows.map((d) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DealRow, {
				deal: d,
				onOpen: () => setSelected(d.id)
			}, d.id)), rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-4 py-8 text-sm text-muted-foreground",
				children: view === "gto" ? "No deals waiting on Good to order. Reps mark step 1; confirmed Ordered deals leave this list." : view === "ordered" ? "No open deals confirmed as Ordered." : "No deals in this view."
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
					label: "Rep",
					kind: "rep"
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
function DealRow({ deal: d, onOpen }) {
	const qc = useQueryClient();
	const remove = useMutation({
		mutationFn: () => archiveDeal({ data: { id: d.id } }),
		onSuccess: () => {
			toast.success(`Removed ${d.customer} from the list`);
			qc.invalidateQueries({ queryKey: ["deals"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["handoff"] });
		},
		onError: (e) => {
			console.error("archiveDeal failed", e);
			toast.error(e instanceof Error ? e.message : "Could not remove");
		}
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2 border-b border-border px-3 py-2 last:border-b-0 hover:bg-muted/60 md:px-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			onClick: onOpen,
			className: "grid min-w-0 flex-1 gap-1 py-1 text-left md:grid-cols-[1.4fr_7rem_7rem_8rem] md:items-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-medium",
						children: d.customer
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AkBadge, {
						on: d.aviKatz,
						className: "ml-1.5 align-middle"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "mt-0.5 block text-xs text-muted-foreground",
						children: [
							d.producer ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RepName, { name: d.producer }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NoRepFlag, { show: true }),
							" · ",
							d.equipment || "No equipment listed"
						]
					})
				] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "tabular text-sm font-medium",
					children: money(d.amount)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: completionLabel(d) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-xs text-muted-foreground",
					children: d.ordered ? "Step 2 · Ordered" : d.goodToOrder ? "Step 1 · Good to order" : "Needs good to order"
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
			type: "button",
			size: "sm",
			variant: "outline",
			className: "shrink-0",
			"aria-label": `Remove ${d.customer} from the list`,
			"data-testid": "archive-row",
			disabled: remove.isPending,
			onClick: () => {
				if (window.confirm(`Remove “${d.customer}” from the pipeline list?`)) remove.mutate();
			},
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "hidden sm:inline",
				children: "Remove"
			})]
		})]
	});
}
//#endregion
//#region src/routes/_app/planner.tsx
var Route$8 = createFileRoute("/_app/planner")({ component: Page$7 });
function Page$7() {
	const { matchMine, filterMine, role } = useMyView();
	const data = useQuery({
		queryKey: ["installs"],
		queryFn: () => listInstalls()
	});
	const recs = useQuery({
		queryKey: ["recipes"],
		queryFn: () => listRecipes()
	});
	const mineRep = filterMine && role === "sales" ? (data.data ?? []).find((i) => matchMine(i.accountRep))?.accountRep ?? null : null;
	const rows = data.data ?? [];
	const catalog = catalogModels(rows.map((i) => i.equipment ?? ""));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
		className: "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "font-display text-3xl font-medium tracking-tight",
			children: "Install planner"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 max-w-xl text-sm text-muted-foreground",
			children: "Timeline for every open install. Same records as the Install board — a date change here is the install date on the export."
		})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MyViewBar, {})]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mt-5",
		children: data.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-64 w-full" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InstallPlanner, {
			installs: rows,
			recipes: recs.data ?? [],
			catalog,
			myRep: mineRep
		})
	})] });
}
//#endregion
//#region src/routes/_app/pms.tsx
var Route$7 = createFileRoute("/_app/pms")({
	validateSearch: parseOpenSearch,
	component: Page$6
});
function Page$6() {
	const { open } = Route$7.useSearch();
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
	const { filterMine, matchMine, role } = useMyView();
	const rows = (0, import_react.useMemo)(() => {
		let list = pms.data ?? [];
		if (view === "active") list = list.filter((p) => !CLOSED_PM.has(p.status) && !p.done);
		if (filterMine && role === "service") list = list.filter((p) => matchMine(p.technician) || !p.technician);
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
		sort,
		filterMine,
		matchMine,
		role
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
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MyViewBar, {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExportButton, { defaultType: "pms" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						onClick: () => setCreate(true),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "New PM"]
					})
				]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 grid min-w-0 gap-3 md:grid-cols-3",
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
			className: "mt-5 grid min-w-0 gap-4 lg:grid-cols-2",
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
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium",
							children: p.customer
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AkBadge, {
							on: p.aviKatz,
							className: "ml-1 align-middle"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mt-0.5 block text-xs text-muted-foreground",
							children: p.equipment
						})
					] }),
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
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TechName, { name: p.technician })
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
//#region src/components/desk/rebuild-board.tsx
function HealthBadge$1({ health }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		variant: health === "overdue" ? "danger" : health === "at-risk" || health === "no-date" ? "warn" : health === "done" ? "outline" : "success",
		children: HEALTH_LABEL[health]
	});
}
function RebuildBoard({ rows, canEdit, onOpen }) {
	const qc = useQueryClient();
	const [dragId, setDragId] = (0, import_react.useState)(null);
	const save = useMutation({
		mutationFn: (d) => updateRebuild({ data: d }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["rebuilds"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not move")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-w-0 gap-3 overflow-x-auto pb-2",
		children: REBUILD_STATUSES.map((status) => {
			const cards = rows.filter((r) => r.status === status);
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: cn("flex w-64 shrink-0 flex-col rounded-xl border border-border bg-muted/40", dragId != null && "ring-1 ring-primary/20"),
				onDragOver: (e) => {
					if (!canEdit) return;
					e.preventDefault();
				},
				onDrop: (e) => {
					e.preventDefault();
					if (!canEdit || dragId == null) return;
					const row = rows.find((r) => r.id === dragId);
					if (!row || row.status === status) {
						setDragId(null);
						return;
					}
					if (status === "Waiting" && !row.reasonCode) {
						toast.message("Waiting needs a reason delayed. Open the card to add one.");
						onOpen(row.id);
						setDragId(null);
						return;
					}
					if (row.status === "Queued" && (!row.owner || !row.targetComplete)) {
						toast.message("Assign an owner and a target complete date before leaving Queued.");
						onOpen(row.id);
						setDragId(null);
						return;
					}
					save.mutate({
						id: dragId,
						status
					});
					setDragId(null);
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "flex items-baseline justify-between gap-2 px-3 py-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-sm font-medium",
						children: status
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "tabular text-xs text-muted-foreground",
						children: cards.length
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "flex flex-1 flex-col gap-2 px-2 pb-2",
					children: cards.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground",
						children: "Empty"
					}) : cards.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						draggable: canEdit,
						onDragStart: () => setDragId(r.id),
						onDragEnd: () => setDragId(null),
						onClick: () => onOpen(r.id),
						className: cn("w-full rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-colors hover:border-primary/40", r.health === "overdue" && "border-destructive/40", r.health === "at-risk" && "border-warning/40", r.health === "no-date" && "border-warning/30"),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-medium leading-snug",
								children: r.title
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-0.5 truncate text-xs text-muted-foreground",
								children: [
									r.equipment || "No equipment",
									" · ",
									r.account
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-2 flex flex-wrap items-center gap-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HealthBadge$1, { health: r.health }), r.status === "Waiting" && r.reasonCode ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
									variant: "warn",
									children: r.reasonCode
								}) : null]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-2 text-xs text-muted-foreground",
								children: [r.owner || "No owner", r.targetComplete ? ` · target ${formatShortDate(r.targetComplete)}` : " · no target"]
							})
						]
					}) }, r.id))
				})]
			}, status);
		})
	});
}
//#endregion
//#region src/components/desk/owner-select.tsx
function OwnerSelect({ value, onChange, label = "Owner", id, name, allowEmpty = true, className }) {
	const names = useQuery({
		queryKey: ["rebuild-owners"],
		queryFn: () => listRebuildOwners()
	}).data ?? [];
	const current = value.trim();
	const extra = current && !names.some((n) => n.toLowerCase() === current.toLowerCase()) ? [current] : [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className,
		children: [label ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
			htmlFor: id,
			children: label
		}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
			id,
			name,
			className: label ? "mt-1" : void 0,
			value,
			onChange: (e) => onChange(e.target.value),
			allowEmpty,
			emptyLabel: "—",
			children: [extra.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
				value: n,
				children: n
			}, `extra-${n}`)), names.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
				value: n,
				children: n
			}, n))]
		})]
	});
}
function OwnerFilter({ value, onChange, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OwnerSelect, {
		label: "",
		value,
		onChange,
		allowEmpty: true,
		className
	});
}
//#endregion
//#region src/components/desk/rebuild-planner.tsx
var WINDOW = 42;
function barRange(r) {
	const start = r.actualStart || r.plannedStart || r.createdAt.slice(0, 10);
	const end = r.actualComplete || r.targetComplete;
	if (!start && !end) return null;
	if (start && end) return {
		start,
		end: end < start ? start : end
	};
	if (start) return {
		start,
		end: addDays(start, 7)
	};
	return {
		start: end,
		end
	};
}
function RebuildPlanner({ rows, canEdit, onOpen }) {
	const today = todayChicago();
	const [anchor, setAnchor] = (0, import_react.useState)(addDays(today, -7));
	const windowEnd = addDays(anchor, 41);
	const [owner, setOwner] = (0, import_react.useState)("");
	const [health, setHealth] = (0, import_react.useState)("");
	const [account, setAccount] = (0, import_react.useState)("");
	const [equip, setEquip] = (0, import_react.useState)("");
	const qc = useQueryClient();
	const saveDate = useMutation({
		mutationFn: (d) => updateRebuild({ data: d }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["rebuilds"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update date")
	});
	const list = (0, import_react.useMemo)(() => {
		let next = rows.filter((r) => r.status !== "Cancelled");
		if (owner) next = next.filter((r) => (r.owner ?? "").toLowerCase() === owner.toLowerCase());
		if (health) next = next.filter((r) => r.health === health);
		if (account.trim()) {
			const n = account.trim().toLowerCase();
			next = next.filter((r) => r.account.toLowerCase().includes(n));
		}
		if (equip.trim()) {
			const n = equip.trim().toLowerCase();
			next = next.filter((r) => (r.equipment ?? "").toLowerCase().includes(n));
		}
		return next;
	}, [
		rows,
		owner,
		health,
		account,
		equip
	]);
	const ticks = [
		0,
		7,
		14,
		21,
		28,
		35
	].map((d) => addDays(anchor, d));
	function pos(iso) {
		const days = Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${anchor}T00:00:00Z`)) / 864e5);
		return Math.max(0, Math.min(WINDOW, days));
	}
	const weekHits = /* @__PURE__ */ new Map();
	for (const r of list) {
		const range = barRange(r);
		if (!range) continue;
		const s = pos(range.start);
		const e = pos(range.end);
		const startWeek = Math.floor(s / 7);
		const endWeek = Math.floor(Math.max(s, e - .01) / 7);
		for (let w = startWeek; w <= endWeek; w++) {
			const key = `${r.owner || "unassigned"}:${w}`;
			weekHits.set(key, (weekHits.get(key) ?? 0) + 1);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl border border-border bg-card p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-xl",
					children: "Rebuild timeline"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs text-muted-foreground",
					children: [
						formatShortDate(anchor),
						" – ",
						formatShortDate(windowEnd),
						". Overdue bars read as overdue. Same records as the board."
					]
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-1",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "outline",
							size: "sm",
							onClick: () => setAnchor(addDays(anchor, -7)),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "size-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "outline",
							size: "sm",
							onClick: () => setAnchor(addDays(today, -7)),
							children: "Today"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "outline",
							size: "sm",
							onClick: () => setAnchor(addDays(anchor, 7)),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4" })
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 grid gap-2 sm:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OwnerFilter, {
						value: owner,
						onChange: setOwner
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
						className: "h-10 rounded-md border border-input bg-card px-3 text-sm",
						value: health,
						onChange: (e) => setHealth(e.target.value),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "",
							children: "Any health"
						}), [
							"overdue",
							"at-risk",
							"no-date",
							"on-track",
							"done"
						].map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: h,
							children: HEALTH_LABEL[h]
						}, h))]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: account,
						onChange: (e) => setAccount(e.target.value),
						placeholder: "Account"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: equip,
						onChange: (e) => setEquip(e.target.value),
						placeholder: "Equipment"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4 overflow-x-auto",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-[640px]",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-1 grid grid-cols-[11rem_1fr] text-[11px] text-muted-foreground",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "relative h-5",
								children: ticks.map((d, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "absolute -translate-x-1/2",
									style: { left: `${i / 6 * 100}%` },
									children: formatShortDate(d)
								}, d))
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "space-y-1.5",
							children: list.map((r) => {
								const range = barRange(r);
								const start = range ? pos(range.start) : 0;
								const end = range ? pos(range.end) : 0;
								const left = start / WINDOW * 100;
								const width = Math.max(2, (Math.max(end, start + 1) - start) / WINDOW * 100);
								const todayLeft = pos(today) / WINDOW * 100;
								const overlap = range && (weekHits.get(`${r.owner || "unassigned"}:${Math.floor(start / 7)}`) ?? 0) > 1;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "grid grid-cols-[11rem_1fr] items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										className: "min-w-0 truncate text-left text-xs hover:underline",
										onClick: () => onOpen(r.id),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-medium",
											children: r.account
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "block truncate text-muted-foreground",
											children: r.equipment || r.title
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "relative h-8 rounded-md bg-muted/60",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "absolute inset-y-0 w-px bg-foreground/40",
											style: { left: `${todayLeft}%` }
										}), range ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => onOpen(r.id),
											title: `${r.title} · ${range.start} → ${range.end}`,
											className: cn("absolute top-1 h-6 rounded-md px-2 text-left text-[10px] leading-6 text-cream", r.health === "overdue" ? "bg-destructive" : r.health === "at-risk" || r.health === "no-date" ? "bg-warning" : "bg-primary", overlap && "ring-2 ring-warning"),
											style: {
												left: `${left}%`,
												width: `${width}%`
											},
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "block truncate",
												children: r.title
											})
										}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "absolute inset-y-0 left-2 flex items-center text-[10px] text-muted-foreground",
											children: "No dates"
										})]
									})]
								}, r.id);
							})
						}),
						canEdit ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-3 space-y-1",
							children: list.filter((r) => r.status !== "Completed").slice(0, 12).map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex flex-wrap items-center gap-2 text-xs",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "w-40 truncate",
										children: r.title
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
										variant: "outline",
										children: HEALTH_LABEL[r.health]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										type: "date",
										className: "h-8 w-40",
										value: r.targetComplete ?? "",
										onChange: (e) => saveDate.mutate({
											id: r.id,
											targetComplete: e.target.value || null
										})
									})
								]
							}, `date-${r.id}`))
						}) : null
					]
				})
			})
		]
	});
}
//#endregion
//#region src/components/desk/rebuild-sheet.tsx
function HealthBadge({ health }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		variant: health === "overdue" ? "danger" : health === "at-risk" || health === "no-date" ? "warn" : health === "done" ? "outline" : "success",
		children: HEALTH_LABEL[health]
	});
}
function RebuildSheet({ row, canEdit, onClose }) {
	const qc = useQueryClient();
	const [title, setTitle] = (0, import_react.useState)("");
	const [account, setAccount] = (0, import_react.useState)(SHOP_ACCOUNT);
	const [equipment, setEquipment] = (0, import_react.useState)("");
	const [serial, setSerial] = (0, import_react.useState)("");
	const [owner, setOwner] = (0, import_react.useState)("");
	const [status, setStatus] = (0, import_react.useState)("Queued");
	const [reasonCode, setReasonCode] = (0, import_react.useState)("");
	const [reasonDetail, setReasonDetail] = (0, import_react.useState)("");
	const [plannedStart, setPlannedStart] = (0, import_react.useState)("");
	const [targetComplete, setTargetComplete] = (0, import_react.useState)("");
	const [actualStart, setActualStart] = (0, import_react.useState)("");
	const [actualComplete, setActualComplete] = (0, import_react.useState)("");
	const [priority, setPriority] = (0, import_react.useState)("normal");
	const [notes, setNotes] = (0, import_react.useState)("");
	const [installId, setInstallId] = (0, import_react.useState)(null);
	const [jobId, setJobId] = (0, import_react.useState)(null);
	const [reuseNotice, setReuseNotice] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (!row) return;
		setTitle(row.title);
		setAccount(row.account);
		setEquipment(row.equipment ?? "");
		setSerial(row.serial ?? "");
		setOwner(row.owner ?? "");
		setStatus(row.status);
		setReasonCode(row.reasonCode ?? "");
		setReasonDetail(row.reasonDetail ?? "");
		setPlannedStart(row.plannedStart ?? "");
		setTargetComplete(row.targetComplete ?? "");
		setActualStart(row.actualStart ?? "");
		setActualComplete(row.actualComplete ?? "");
		setPriority(row.priority);
		setNotes(row.notes ?? "");
		setInstallId(row.installId);
		setJobId(row.jobId);
	}, [row]);
	const links = useQuery({
		queryKey: ["rebuild-links", account],
		queryFn: () => listRebuildLinks({ data: { account } }),
		enabled: !!row
	});
	const save = useMutation({
		mutationFn: () => updateRebuild({ data: {
			id: row.id,
			title,
			account,
			equipment,
			serial,
			owner,
			status,
			reasonCode,
			reasonDetail,
			plannedStart: plannedStart || null,
			targetComplete: targetComplete || null,
			actualStart: actualStart || null,
			actualComplete: actualComplete || null,
			priority,
			notes,
			installId,
			jobId
		} }),
		onSuccess: () => {
			toast.success("Rebuild saved");
			qc.invalidateQueries({ queryKey: ["rebuilds"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["activity"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save")
	});
	const pull = useMutation({
		mutationFn: (opts) => pullRebuildSerial({ data: {
			id: row.id,
			serial,
			confirmReuse: opts.confirmReuse
		} }),
		onSuccess: (next) => {
			setReuseNotice(null);
			setSerial(next.serial ?? "");
			setEquipment(next.equipment ?? equipment);
			toast.success(next.serialNotice || "Serial saved");
			qc.invalidateQueries({ queryKey: ["rebuilds"] });
			qc.invalidateQueries({ queryKey: ["assets"] });
		},
		onError: (e) => {
			const msg = e instanceof Error ? e.message : "Could not check warehouse";
			if (/already assigned/i.test(msg)) setReuseNotice(msg);
			else toast.error(msg);
		}
	});
	if (!row) return null;
	const waiting = status === "Waiting";
	const locked = !canEdit;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
		open: true,
		onOpenChange: (v) => !v && onClose(),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetContent, {
			className: "sm:max-w-xl",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, {
						className: "pr-8",
						children: row.title
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2 flex flex-wrap items-center gap-1.5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: row.status }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HealthBadge, { health: row.health }),
							row.priority !== "normal" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								variant: "warn",
								children: priorityLabel(row.priority)
							}) : null
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-xs text-muted-foreground",
						children: [
							row.daysOpen,
							" days open",
							row.daysToTarget != null ? ` · ${row.daysToTarget} days to target` : "",
							row.daysInStatus != null ? ` · ${row.daysInStatus} days in ${row.status}` : "",
							row.daysLateEarly != null ? ` · ${row.daysLateEarly === 0 ? "on time" : row.daysLateEarly > 0 ? `${row.daysLateEarly} days late` : `${-row.daysLateEarly} days early`}` : ""
						]
					})
				] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SerialNoticeBanner, { notice: row.serialNotice }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetBody, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					className: "space-y-4 px-5 py-4",
					onSubmit: (e) => {
						e.preventDefault();
						if (locked) return;
						save.mutate();
					},
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "rb-title",
							children: "Project name"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "rb-title",
							className: "mt-1",
							value: title,
							onChange: (e) => setTitle(e.target.value),
							disabled: locked,
							required: true
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerCombo, {
							label: "Account",
							value: account,
							onChange: setAccount
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "mt-1 text-xs text-primary underline-offset-2 hover:underline",
							onClick: () => setAccount(SHOP_ACCOUNT),
							disabled: locked,
							children: "Katz shop / stock"
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EquipmentCombo, {
							label: "Equipment",
							value: equipment,
							onChange: setEquipment
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "rb-serial",
								children: "Serial"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-1 flex gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "rb-serial",
									value: serial,
									onChange: (e) => setSerial(e.target.value),
									onBlur: () => {
										if (locked || !serial.trim()) return;
										pull.mutate({});
									},
									placeholder: "Type a warehouse serial",
									disabled: locked
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									type: "button",
									variant: "outline",
									disabled: locked || pull.isPending,
									onClick: () => pull.mutate({}),
									children: "Pull"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-muted-foreground",
								children: "Matching a warehouse serial attaches that unit. It does not create a second record."
							})
						] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OwnerSelect, {
							value: owner,
							onChange: setOwner
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-3 sm:grid-cols-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "rb-status",
								children: "Status"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
								id: "rb-status",
								className: "mt-1",
								value: status,
								onChange: (e) => setStatus(e.target.value),
								disabled: locked,
								children: REBUILD_STATUSES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: s,
									children: s
								}, s))
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "rb-priority",
								children: "Priority"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
								id: "rb-priority",
								className: "mt-1",
								value: priority,
								onChange: (e) => setPriority(e.target.value),
								disabled: locked,
								children: REBUILD_PRIORITIES.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: p,
									children: priorityLabel(p)
								}, p))
							})] })]
						}),
						waiting ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-xl border border-warning/40 bg-warning/8 p-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "rb-reason",
									children: "Reason delayed"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
									id: "rb-reason",
									className: "mt-1",
									value: reasonCode,
									onChange: (e) => setReasonCode(e.target.value),
									allowEmpty: true,
									emptyLabel: "Pick a reason",
									disabled: locked,
									children: WAITING_REASONS.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: r,
										children: r
									}, r))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "rb-reason-detail",
									className: "mt-3 block",
									children: "Detail"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "rb-reason-detail",
									className: "mt-1",
									value: reasonDetail,
									onChange: (e) => setReasonDetail(e.target.value),
									placeholder: "Optional, required if Other",
									disabled: locked
								})
							]
						}) : row.reasonCode ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-xs text-muted-foreground",
							children: ["Last waiting reason (history): ", row.reasonCode]
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-3 sm:grid-cols-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "rb-planned",
									children: "Planned start"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "rb-planned",
									type: "date",
									className: "mt-1",
									value: plannedStart,
									onChange: (e) => setPlannedStart(e.target.value),
									disabled: locked
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "rb-target",
									children: "Target complete"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "rb-target",
									type: "date",
									className: "mt-1",
									value: targetComplete,
									onChange: (e) => setTargetComplete(e.target.value),
									disabled: locked
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "rb-astart",
									children: "Actual start"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "rb-astart",
									type: "date",
									className: "mt-1",
									value: actualStart,
									onChange: (e) => setActualStart(e.target.value),
									disabled: locked
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "rb-adone",
									children: "Actual complete"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "rb-adone",
									type: "date",
									className: "mt-1",
									value: actualComplete,
									onChange: (e) => setActualComplete(e.target.value),
									disabled: locked
								})] })
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "rb-link",
								children: "Linked ticket / install"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
								id: "rb-link",
								className: "mt-1",
								value: installId ? `install:${installId}` : jobId ? `job:${jobId}` : "",
								onChange: (e) => {
									const v = e.target.value;
									if (v.startsWith("install:")) {
										setInstallId(Number(v.slice(8)));
										setJobId(null);
									} else if (v.startsWith("job:")) {
										setJobId(Number(v.slice(4)));
										setInstallId(null);
									} else {
										setInstallId(null);
										setJobId(null);
									}
								},
								allowEmpty: true,
								emptyLabel: "Not linked — this is its own project",
								disabled: locked,
								children: (links.data ?? []).map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: l.kind === "install" ? `install:${l.id}` : `job:${l.id}`,
									children: l.label
								}, `${l.kind}-${l.id}`))
							}),
							installId ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OpenLink, {
								entityType: "install",
								id: installId,
								className: "mt-1 inline-block text-xs text-primary hover:underline",
								children: "Open linked install"
							}) : null,
							jobId ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OpenLink, {
								entityType: "service",
								id: jobId,
								className: "mt-1 inline-block text-xs text-primary hover:underline",
								children: "Open linked ticket"
							}) : null
						] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "rb-notes",
								children: "Notes"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
								id: "rb-notes",
								className: "mt-1",
								value: notes,
								onChange: (e) => setNotes(e.target.value),
								disabled: locked
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-muted-foreground",
								children: "Rebuild notes stay on this project. They do not overwrite Description of work on a service ticket."
							})
						] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-2",
							children: [canEdit ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "submit",
								disabled: save.isPending,
								children: save.isPending ? "Saving…" : "Save"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-muted-foreground",
								children: "Sales can view this rebuild. Bench status is service-owned."
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PingButton, {
								entityType: "rebuild",
								entityId: row.id,
								contextLabel: `${row.title} · ${row.account}`,
								defaultNote: `${row.title} at ${row.account}`
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-xs text-muted-foreground",
							children: ["Updated ", formatShortDate(row.updatedAt.slice(0, 10))]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Thread, {
					entityType: "rebuild",
					entityId: row.id
				})] })
			]
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open: !!reuseNotice,
		onOpenChange: (v) => !v && setReuseNotice(null),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Serial already assigned" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, { children: reuseNotice }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					onClick: () => {
						pull.mutate({ confirmReuse: true });
					},
					children: "Reuse on this rebuild"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					variant: "outline",
					onClick: () => setReuseNotice(null),
					children: "Cancel"
				})]
			})
		] })
	})] });
}
//#endregion
//#region src/routes/_app/rebuilds.tsx
var Route$6 = createFileRoute("/_app/rebuilds")({
	validateSearch: parseOpenSearch,
	component: Page$5
});
var FILTERS = [
	{
		id: "all",
		label: "All"
	},
	{
		id: "overdue",
		label: "Overdue"
	},
	{
		id: "at-risk",
		label: "At risk"
	},
	{
		id: "waiting",
		label: "Waiting"
	},
	{
		id: "no-date",
		label: "No date"
	},
	{
		id: "mine",
		label: "My rebuilds"
	}
];
function Page$5() {
	const { open } = Route$6.useSearch();
	const qc = useQueryClient();
	const data = useQuery({
		queryKey: ["rebuilds"],
		queryFn: () => listRebuilds()
	});
	const { filterMine, matchMine, board, role } = useMyView();
	const [q, setQ] = (0, import_react.useState)("");
	const [chip, setChip] = (0, import_react.useState)("all");
	const [view, setView] = (0, import_react.useState)(board || role !== "sales" ? "board" : "timeline");
	const [selected, setSelected] = useOpenRecord(open);
	const [create, setCreate] = (0, import_react.useState)(false);
	const rows = data.data?.rows ?? [];
	const canEdit = !!data.data?.canEdit;
	const filtered = (0, import_react.useMemo)(() => {
		let list = rows;
		if (filterMine && role === "sales") list = list.filter((r) => matchMine(r.accountRep, r.owner) || r.aviKatz);
		if (chip === "overdue") list = list.filter((r) => r.health === "overdue");
		if (chip === "at-risk") list = list.filter((r) => r.health === "at-risk");
		if (chip === "waiting") list = list.filter((r) => r.status === "Waiting");
		if (chip === "no-date") list = list.filter((r) => r.health === "no-date");
		if (chip === "mine") list = list.filter((r) => matchMine(r.owner));
		const needle = q.trim().toLowerCase();
		if (needle) list = list.filter((r) => [
			r.title,
			r.account,
			r.equipment,
			r.serial,
			r.owner,
			r.status,
			r.reasonCode
		].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle)));
		return list;
	}, [
		rows,
		filterMine,
		role,
		matchMine,
		chip,
		q
	]);
	const selectedRow = rows.find((r) => r.id === selected) ?? null;
	const overdue = rows.filter((r) => r.health === "overdue").length;
	const atRisk = rows.filter((r) => r.health === "at-risk").length;
	const waiting = rows.filter((r) => r.status === "Waiting").length;
	const noDate = rows.filter((r) => r.health === "no-date").length;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-medium tracking-tight",
				children: "In-house rebuilds"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-xl text-sm text-muted-foreground",
				children: "Shop projects, not field tickets. One owner, planned vs actual, a current blocker, and aging you cannot ignore."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MyViewBar, {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExportButton, { defaultType: "rebuilds" }),
					canEdit ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						onClick: () => setCreate(true),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "New rebuild"]
					}) : null
				]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 grid min-w-0 gap-3 sm:grid-cols-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Overdue",
					value: overdue,
					tone: overdue ? "danger" : "ok",
					hint: "Past target, still open"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "At risk",
					value: atRisk,
					tone: atRisk ? "warn" : "ok",
					hint: "Waiting, or target within 3 days"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Waiting",
					value: waiting,
					hint: "Needs a reason delayed"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "No date",
					value: noDate,
					tone: noDate ? "warn" : "ok",
					hint: "In progress / waiting / testing with no target"
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 flex flex-wrap items-center gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					className: "max-w-xs",
					value: q,
					onChange: (e) => setQ(e.target.value),
					placeholder: "Search project, account, serial…"
				}),
				FILTERS.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setChip(f.id),
					className: cn("rounded-full border px-3 py-1 text-xs", chip === f.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"),
					children: f.label
				}, f.id)),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ml-auto flex gap-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						size: "sm",
						variant: view === "board" ? "default" : "outline",
						onClick: () => setView("board"),
						children: "Board"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						size: "sm",
						variant: view === "timeline" ? "default" : "outline",
						onClick: () => setView("timeline"),
						children: "Timeline"
					})]
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-5",
			children: data.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-64 w-full" }) : view === "board" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RebuildBoard, {
				rows: filtered,
				canEdit,
				onOpen: setSelected
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RebuildPlanner, {
				rows: filtered,
				canEdit,
				onOpen: setSelected
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RebuildSheet, {
			row: selectedRow,
			canEdit,
			onClose: () => setSelected(null)
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CreateRebuildDialog, {
			open: create,
			onOpenChange: setCreate,
			onCreated: (row) => {
				qc.invalidateQueries({ queryKey: ["rebuilds"] });
				qc.invalidateQueries({ queryKey: ["dashboard"] });
				setSelected(row.id);
				setCreate(false);
			}
		})
	] });
}
function CreateRebuildDialog({ open, onOpenChange, onCreated }) {
	const [title, setTitle] = (0, import_react.useState)("");
	const [account, setAccount] = (0, import_react.useState)(SHOP_ACCOUNT);
	const [equipment, setEquipment] = (0, import_react.useState)("");
	const [owner, setOwner] = (0, import_react.useState)("");
	const [status, setStatus] = (0, import_react.useState)("Queued");
	const [reasonCode, setReasonCode] = (0, import_react.useState)("");
	const [reasonDetail, setReasonDetail] = (0, import_react.useState)("");
	const [targetComplete, setTargetComplete] = (0, import_react.useState)("");
	const [plannedStart, setPlannedStart] = (0, import_react.useState)("");
	const [notes, setNotes] = (0, import_react.useState)("");
	const create = useMutation({
		mutationFn: () => createRebuild({ data: {
			title,
			account: account || "Katz shop / stock",
			equipment,
			owner,
			status,
			reasonCode,
			reasonDetail,
			targetComplete: targetComplete || null,
			plannedStart: plannedStart || null,
			notes
		} }),
		onSuccess: (row) => {
			toast.success("Rebuild opened");
			setTitle("");
			setEquipment("");
			setNotes("");
			setStatus("Queued");
			setReasonCode("");
			onCreated(row);
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "max-h-[90vh] overflow-y-auto sm:max-w-lg",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "New rebuild" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-4 space-y-3",
				onSubmit: (e) => {
					e.preventDefault();
					create.mutate();
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "new-rb-title",
						children: "Project name"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "new-rb-title",
						className: "mt-1",
						value: title,
						onChange: (e) => setTitle(e.target.value),
						required: true
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerCombo, {
						label: "Account",
						value: account,
						onChange: setAccount
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "mt-1 text-xs text-primary underline-offset-2 hover:underline",
						onClick: () => setAccount(SHOP_ACCOUNT),
						children: "Katz shop / stock"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EquipmentCombo, {
						label: "Equipment",
						value: equipment,
						onChange: setEquipment
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OwnerSelect, {
						value: owner,
						onChange: setOwner
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-3 sm:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "new-rb-status",
							children: "Status"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
							id: "new-rb-status",
							className: "mt-1",
							value: status,
							onChange: (e) => setStatus(e.target.value),
							children: REBUILD_STATUSES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: s,
								children: s
							}, s))
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "new-rb-target",
							children: "Target complete"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "new-rb-target",
							type: "date",
							className: "mt-1",
							value: targetComplete,
							onChange: (e) => setTargetComplete(e.target.value)
						})] })]
					}),
					status === "Waiting" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-xl border border-warning/40 bg-warning/8 p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Reason delayed" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
								className: "mt-1",
								value: reasonCode,
								onChange: (e) => setReasonCode(e.target.value),
								allowEmpty: true,
								emptyLabel: "Pick a reason",
								children: [
									"Parts on order",
									"Parts not available",
									"Waiting on decision",
									"Waiting on customer",
									"Tech / bench unavailable",
									"Scope changed",
									"Found additional failure",
									"Other"
								].map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: r,
									children: r
								}, r))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								className: "mt-2",
								value: reasonDetail,
								onChange: (e) => setReasonDetail(e.target.value),
								placeholder: "Detail (required if Other)"
							})
						]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "new-rb-planned",
						children: "Planned start"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "new-rb-planned",
						type: "date",
						className: "mt-1",
						value: plannedStart,
						onChange: (e) => setPlannedStart(e.target.value)
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "new-rb-notes",
						children: "Notes"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
						id: "new-rb-notes",
						className: "mt-1",
						value: notes,
						onChange: (e) => setNotes(e.target.value)
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						disabled: create.isPending,
						children: create.isPending ? "Opening…" : "Open rebuild"
					})
				]
			})]
		})
	});
}
//#endregion
//#region src/routes/_app/recipes.tsx
var Route$5 = createFileRoute("/_app/recipes")({
	validateSearch: parseOpenSearch,
	component: Page$4
});
function Page$4() {
	const { open } = Route$5.useSearch();
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
//#region src/lib/ops/corrigo-import.ts
var ready = async () => {
	const { ensureSeeded } = await import("./seed.server.mjs");
	await ensureSeeded();
	return getSql();
};
function stringifyCell(v) {
	if (v == null || v === "") return "";
	if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
	if (typeof v === "number" && Number.isFinite(v)) {
		if (Number.isInteger(v)) return String(v);
		const rounded = Math.round(v);
		if (Math.abs(v - rounded) < 1e-6) return String(rounded);
	}
	const s = String(v);
	if (/^\d+\.0+$/.test(s)) return s.replace(/\.0+$/, "");
	return s;
}
function fileToMatrix(base64) {
	const wb = readSync(base64, {
		type: "base64",
		cellDates: true,
		raw: false
	});
	const name = wb.SheetNames[0];
	if (!name) throw new Error("The file has no sheets.");
	const sheet = wb.Sheets[name];
	if (!sheet) throw new Error("The file has no sheets.");
	return utils.sheet_to_json(sheet, {
		header: 1,
		defval: "",
		blankrows: false
	}).map((row) => (row ?? []).map(stringifyCell));
}
function jobBoard(kind) {
	return kind === "tlc" ? "tlc" : "service";
}
async function loadHits(sql) {
	const jobs = await sql.query(`select id, wo, status, customer, kind, duplicate_of, done from service_jobs
      where coalesce(wo, '') <> ''
      order by id asc`);
	const pms = await sql.query(`select id, wo, status, customer, done from pm_jobs
      where coalesce(wo, '') <> ''
      order by id asc`);
	const installs = await sql.query(`select id, wo, equip_status as status, customer, complete from installs
      where archived = false and coalesce(wo, '') <> ''
      order by id asc`);
	return [
		...jobs.map((r) => ({
			board: jobBoard(r.kind),
			id: r.id,
			status: r.status,
			customer: r.customer,
			wo: r.wo,
			duplicateOf: r.duplicate_of ?? null,
			done: !!r.done
		})),
		...pms.map((r) => ({
			board: "pm",
			id: r.id,
			status: r.status,
			customer: r.customer,
			wo: r.wo,
			done: !!r.done
		})),
		...installs.map((r) => ({
			board: "install",
			id: r.id,
			status: r.status || "Not Ready",
			customer: r.customer,
			wo: r.wo,
			done: !!r.complete
		}))
	];
}
async function findExistingHit(sql, matchKey, preferredBoard, fileCustomer, wrapped) {
	if (!matchKey) return null;
	const hits = await loadHits(sql);
	const rolled = wrapped ?? deskHasWrapped(hits);
	const match = indexHits(hits).get(matchKey) ?? {
		unique: null,
		conflicts: []
	};
	const attachable = [...match.unique ? [match.unique] : [], ...match.conflicts].filter((h, i, all) => all.findIndex((x) => x.board === h.board && x.id === h.id) === i).filter((h) => shouldAttachToHit(h, fileCustomer, rolled));
	return pickKeeper(attachable, preferredBoard);
}
async function nextCallId(sql, received) {
	const prefix = `SC-${received.replace(/-/g, "").slice(0, 6)}-`;
	const last = await sql.query(`select call_id from service_jobs
      where call_id like $1
      order by call_id desc limit 1`, [prefix + "%"]);
	let seq = 1;
	if (last[0]) {
		const n = Number(last[0].call_id.slice(-3));
		if (Number.isFinite(n)) seq = n + 1;
	}
	return `${prefix}${String(seq).padStart(3, "0")}`;
}
async function ensureCustomer(sql, name) {
	const trimmed = name.trim();
	if (!trimmed || isWalkIn(trimmed)) return;
	const found = await sql.query(`select id from directory_customers where lower(name) = lower($1) limit 1`, [trimmed]);
	if (found[0]) {
		await sql.query(`update directory_customers set archived = false, updated_at = now() where id = $1`, [found[0].id]);
		return;
	}
	try {
		await sql.query(`insert into directory_customers (name) values ($1)`, [trimmed]);
	} catch {}
}
async function logCorrigo(sql, board, id, actor, detail) {
	await sql.query(`insert into activity (entity_type, entity_id, actor_name, action, detail)
     values ($1, $2, $3, 'corrigo', $4)`, [
		board === "tlc" ? "tlc" : board,
		id,
		actor,
		detail
	]);
}
function pmStatus(translated, current) {
	if (translated === "Completed" || translated === "Cancelled" || translated === "In Progress") return translated;
	if (translated === "Dispatched") return "Ready to Dispatch";
	if (translated === "Open") return current || "Pending Scheduling";
	if (translated === "Follow-up Needed") return current || "In Progress";
	return current || "Pending Scheduling";
}
function installStatus(translated, current) {
	if (translated === "Completed") return "Installed";
	return current || "Not Ready";
}
var fileInput = object({
	filename: string(),
	base64: string().min(8)
});
var previewCorrigoImport = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => fileInput.parse(d)).handler(async ({ data }) => {
	if (data.base64.length > 12e6) throw new Error("That file is too large.");
	const matrix = fileToMatrix(data.base64);
	const parsed = parseCorrigoMatrix(matrix);
	const hits = await loadHits(await ready());
	const wrapped = deskHasWrapped(hits);
	const index = indexHits(hits);
	const rows = parsed.records.map((rec) => resolvePreviewRow(rec, index.get(rec.matchKey) ?? {
		unique: null,
		conflicts: []
	}, { wrapped }));
	const unmapped = [...new Set(rows.map((r) => r.statusUnmapped).filter((s) => !!s))];
	return {
		updateCount: rows.filter((r) => r.action === "update").length,
		createCount: rows.filter((r) => r.action === "create").length,
		skipped: parsed.skipped + rows.filter((r) => r.action === "skip").length,
		conflictCount: rows.filter((r) => !!r.conflictIds?.length).length,
		wrapCount: rows.filter((r) => r.wrapRepeat).length,
		unmapped,
		rows
	};
});
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
var applyCorrigoImport = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => applyInput.parse(d)).handler(async ({ data, context }) => {
	const sql = await ready();
	const actor = (await sql.query("select username from desk_accounts where user_id = $1", [context.userId]))[0]?.username || "Teammate";
	let updated = 0;
	let created = 0;
	const review = [];
	const hitsForWrap = await loadHits(sql);
	const wrapped = deskHasWrapped(hitsForWrap);
	let wrapRepeat = false;
	function maybeReview(board, id, wo, customer, status, technician, closed) {
		const reason = wrapRepeat ? "wrap" : "open";
		if (reason === "open" && closed) return;
		if (review.some((r) => r.entityType === board && r.id === id)) {
			const cur = review.find((r) => r.entityType === board && r.id === id);
			if (cur && reason === "wrap") cur.reason = "wrap";
			return;
		}
		review.push({
			id,
			wo,
			customer,
			status,
			technician,
			entityType: board,
			reason
		});
	}
	for (const row of data.rows) {
		if (row.action === "skip") continue;
		const wo = row.canonicalWo || row.wo;
		let board = row.board ?? "service";
		const matchKey = row.matchKey || woMatchKey(wo);
		let action = row.action;
		let jobId = row.jobId;
		wrapRepeat = !!row.wrapRepeat;
		if (action === "create" || action === "update" && !jobId) {
			const hit = await findExistingHit(sql, matchKey, board, row.customer, wrapped);
			if (hit) {
				action = "update";
				jobId = hit.id;
				board = hit.board;
			}
		}
		const chosen = (row.customer ?? "").trim() || null;
		if (chosen) await ensureCustomer(sql, chosen);
		if (action === "update" && jobId) {
			if (board === "pm") {
				const cur = await sql.query(`select id, status, technician, work_done, completed_at, customer from pm_jobs where id = $1`, [jobId]);
				if (!cur[0]) continue;
				const status = pmStatus(row.statusUnmapped ? cur[0].status : row.newStatus, cur[0].status);
				const technician = row.technician || cur[0].technician;
				const workDone = row.workDone || cur[0].work_done;
				const completedAt = row.completedAt || cur[0].completed_at;
				const customer = chosen || cur[0].customer;
				const done = CLOSED_PM.has(status);
				await sql.query(`update pm_jobs set
                technician = $2, completed_at = $3, work_done = $4, status = $5,
                wo = $6, done = $7, customer = $8, updated_at = now()
              where id = $1`, [
					jobId,
					technician,
					completedAt,
					workDone,
					status,
					wo,
					done,
					customer
				]);
				await logCorrigo(sql, "pm", jobId, actor, `Corrigo import · ${wo}`);
				updated += 1;
				maybeReview("pm", jobId, wo, customer, status, technician, done);
				continue;
			}
			if (board === "install") {
				const cur = await sql.query(`select id, equip_status, technician, work_done, completed_at, customer
               from installs where id = $1 and archived = false`, [jobId]);
				if (!cur[0]) continue;
				const equipStatus = installStatus(row.statusUnmapped ? cur[0].equip_status || "Not Ready" : row.newStatus, cur[0].equip_status);
				const technician = row.technician || cur[0].technician;
				const workDone = row.workDone || cur[0].work_done;
				const completedAt = row.completedAt || cur[0].completed_at;
				const customer = chosen || cur[0].customer;
				const complete = equipStatus === "Installed";
				await sql.query(`update installs set
                technician = $2, completed_at = $3, work_done = $4, equip_status = $5,
                wo = $6, complete = $7, customer = $8, updated_at = now()
              where id = $1`, [
					jobId,
					technician,
					completedAt,
					workDone,
					equipStatus,
					wo,
					complete,
					customer
				]);
				await logCorrigo(sql, "install", jobId, actor, `Corrigo import · ${wo}`);
				updated += 1;
				maybeReview("install", jobId, wo, customer, equipStatus, technician, complete);
				continue;
			}
			const cur = await sql.query(`select id, kind, status, technician, work_done, completed_at, customer
             from service_jobs where id = $1`, [jobId]);
			if (!cur[0]) continue;
			const status = row.statusUnmapped ? cur[0].status : row.newStatus;
			const technician = row.technician || cur[0].technician;
			const workDone = row.workDone || cur[0].work_done;
			const completedAt = row.completedAt || cur[0].completed_at;
			const customer = chosen || cur[0].customer;
			const done = CLOSED_CALL.has(status);
			const jobBoardKind = jobBoard(cur[0].kind);
			await sql.query(`update service_jobs set
              technician = $2, completed_at = $3, work_done = $4, status = $5,
              wo = $6, done = $7, customer = $8, updated_at = now()
            where id = $1`, [
				jobId,
				technician,
				completedAt,
				workDone,
				status,
				wo,
				done,
				customer
			]);
			await logCorrigo(sql, jobBoardKind, jobId, actor, status !== cur[0].status ? `${cur[0].status} → ${status} · ${wo}` : `Corrigo import · ${wo}`);
			for (const extra of row.conflictIds ?? []) {
				if (wrapRepeat) break;
				if ((extra.board === "service" || extra.board === "tlc") && extra.id !== jobId) await tryMergeServiceDuplicate(sql, jobId, extra.id, actor);
			}
			updated += 1;
			maybeReview(jobBoardKind, jobId, wo, customer, status, technician, done);
		} else if (action === "create") {
			const received = row.completedAt || todayChicago();
			const translated = row.statusUnmapped ? "Open" : row.newStatus || "Open";
			const customer = chosen;
			if (board === "pm") {
				const status = pmStatus(translated, null);
				const done = CLOSED_PM.has(status);
				const id = (await sql.query(`insert into pm_jobs (customer, received, status, technician, wo, work_done, completed_at, style, done)
             values ($1, $2, $3, $4, $5, $6, $7, '12 month PM', $8)
             returning id`, [
					customer || "Unknown",
					received,
					status,
					row.technician,
					wo,
					row.workDone,
					row.completedAt,
					done
				]))[0]?.id;
				if (id) {
					await logCorrigo(sql, "pm", id, actor, `Opened from Corrigo · ${wo}`);
					created += 1;
					maybeReview("pm", id, wo, customer, status, row.technician, done);
				}
				continue;
			}
			if (board === "install") {
				const equipStatus = installStatus(translated, null);
				const complete = equipStatus === "Installed";
				const id = (await sql.query(`insert into installs (received, customer, technician, wo, work_done, completed_at, equip_status, complete)
             values ($1, $2, $3, $4, $5, $6, $7, $8)
             returning id`, [
					received,
					customer || "Unknown",
					row.technician,
					wo,
					row.workDone,
					row.completedAt,
					equipStatus,
					complete
				]))[0]?.id;
				if (id) {
					await logCorrigo(sql, "install", id, actor, `Opened from Corrigo · ${wo}`);
					created += 1;
					maybeReview("install", id, wo, customer, equipStatus, row.technician, complete);
				}
				continue;
			}
			const kind = board === "tlc" ? "tlc" : "service";
			const status = translated;
			const done = CLOSED_CALL.has(status);
			const callId = await nextCallId(sql, received);
			const id = (await sql.query(`insert into service_jobs
             (kind, call_id, customer, issue, technician, status, wo, work_done, completed_at, received, call_type, urgency, done)
           values
             ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Normal', $12)
           returning id`, [
				kind,
				callId,
				customer,
				row.issue,
				row.technician,
				status,
				wo,
				row.workDone,
				row.completedAt,
				received,
				board === "tlc" ? "Field Service" : "Field Service",
				done
			]))[0]?.id;
			if (id) {
				await logCorrigo(sql, board, id, actor, `Opened from Corrigo · ${wo}`);
				created += 1;
				maybeReview(board, id, wo, customer, status, row.technician, done);
			}
		}
	}
	await reconcileServiceDuplicates(sql, actor);
	return {
		updated,
		created,
		review
	};
});
//#endregion
//#region src/components/desk/corrigo-import.tsx
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
//#endregion
//#region src/components/desk/jobs-page.tsx
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
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DuplicateBadge$1, {
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
//#region src/routes/_app/service.tsx
var Route$4 = createFileRoute("/_app/service")({
	validateSearch: parseOpenSearch,
	component: Page$3
});
function Page$3() {
	const { open } = Route$4.useSearch();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(JobsPage, {
		kind: "service",
		title: "Service tracker",
		lede: "Field calls on a 48-hour clock. Active work stays on top; completed history is one toggle away.",
		initialOpen: open
	});
}
//#endregion
//#region src/components/desk/roster-editor.tsx
function RosterEditor() {
	const qc = useQueryClient();
	const roster = useQuery({
		queryKey: ["roster"],
		queryFn: () => listTechs()
	});
	const candidates = useQuery({
		queryKey: ["roster-candidates"],
		queryFn: () => listRosterCandidates(),
		enabled: !!roster.data?.canEdit && !roster.data?.ownerLocked
	});
	const [name, setName] = (0, import_react.useState)("");
	const add = useMutation({
		mutationFn: () => addTech({ data: { name } }),
		onSuccess: (next) => {
			setName("");
			qc.setQueryData(["roster"], next);
			toast.success(`${name.trim()} is on the roster`);
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add")
	});
	const toggle = useMutation({
		mutationFn: (p) => setTechActive({ data: {
			id: p.id,
			active: p.active
		} }),
		onSuccess: (next, p) => {
			qc.setQueryData(["roster"], next);
			toast.success(p.active ? `${p.name} is active` : `${p.name} removed from assign lists`);
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update")
	});
	const admin = useMutation({
		mutationFn: (userId) => setRosterAdmin({ data: { userId } }),
		onSuccess: (next) => {
			qc.setQueryData(["roster"], next);
			toast.success("Roster admin updated");
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not change admin")
	});
	if (!roster.data?.canEdit) return null;
	const techs = roster.data.techs;
	const active = techs.filter((t) => t.active);
	const inactive = techs.filter((t) => !t.active);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-xl border border-border bg-card p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-lg font-medium tracking-tight",
				children: "Service tech roster"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-0.5 text-xs text-muted-foreground",
				children: ["Only you can add or remove names. Tickets keep their current tech until you reassign them. Inactive names stay on history as “(inactive)” — they are not in assign lists.", roster.data.ownerLocked ? " This lock stays on the desk owner account." : roster.data.rosterAdminUsername ? ` Roster admin: ${roster.data.rosterAdminUsername}.` : ""]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-4 divide-y divide-border rounded-lg border border-border",
				children: active.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-center justify-between gap-3 px-3 py-2.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-sm font-medium",
						children: t.name
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						size: "sm",
						variant: "outline",
						disabled: toggle.isPending,
						onClick: () => toggle.mutate({
							id: t.id,
							active: false,
							name: t.name
						}),
						children: "Remove"
					})]
				}, t.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-3 flex flex-wrap gap-2",
				onSubmit: (e) => {
					e.preventDefault();
					if (!name.trim()) return;
					add.mutate();
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: name,
					onChange: (e) => setName(e.target.value),
					placeholder: "Add a technician…",
					className: "max-w-xs",
					"aria-label": "New technician name"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "submit",
					disabled: add.isPending || !name.trim(),
					children: "Add"
				})]
			}),
			inactive.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs tracking-wide text-muted-foreground uppercase",
						children: "Inactive"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-muted-foreground",
						children: "Still shows on tickets already assigned. Not in assign lists."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-2 divide-y divide-border rounded-lg border border-border",
						children: inactive.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-center justify-between gap-3 px-3 py-2.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-sm text-muted-foreground",
								children: [t.name, " (inactive)"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "button",
								size: "sm",
								variant: "ghost",
								disabled: toggle.isPending,
								onClick: () => toggle.mutate({
									id: t.id,
									active: true,
									name: t.name
								}),
								children: "Restore"
							})]
						}, t.id))
					})
				]
			}) : null,
			!roster.data.ownerLocked && (candidates.data?.length ?? 0) > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs tracking-wide text-muted-foreground uppercase",
						children: "Roster admin"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-muted-foreground",
						children: "Exactly one person can edit tech names. Other users cannot change this."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						className: "mt-2 max-w-xs",
						value: candidates.data?.find((c) => c.username === roster.data?.rosterAdminUsername)?.userId ?? "",
						onChange: (e) => {
							if (e.target.value) admin.mutate(e.target.value);
						},
						"aria-label": "Roster admin",
						children: (candidates.data ?? []).map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: c.userId,
							children: c.username
						}, c.userId))
					})
				]
			}) : null
		]
	});
}
//#endregion
//#region src/components/desk/reps-editor.tsx
function RepsEditor() {
	const qc = useQueryClient();
	const reps = useQuery({
		queryKey: ["reps"],
		queryFn: () => listReps()
	});
	const [name, setName] = (0, import_react.useState)("");
	const [initials, setInitials] = (0, import_react.useState)("");
	const add = useMutation({
		mutationFn: () => addRep({ data: {
			name,
			initials
		} }),
		onSuccess: (next) => {
			setName("");
			setInitials("");
			qc.setQueryData(["reps"], next);
			toast.success(`${name.trim()} is on the rep list`);
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add")
	});
	const toggle = useMutation({
		mutationFn: (p) => setRepActive({ data: {
			id: p.id,
			active: p.active
		} }),
		onSuccess: (next, p) => {
			qc.setQueryData(["reps"], next);
			toast.success(p.active ? `${p.name} is active` : `${p.name} hidden from the dropdown`);
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update")
	});
	if (!reps.data?.canEdit) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-xl border border-border bg-card p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-xl",
				children: "Sales reps"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-muted-foreground",
				children: "Dropdown-only list. Same lock as the service-tech roster — only you can add or remove names."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 divide-y divide-border",
				children: (reps.data.reps ?? []).map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-center justify-between gap-2 py-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: r.active ? "text-sm" : "text-sm text-muted-foreground",
						children: [
							r.name,
							" (",
							r.initials,
							")",
							!r.active ? " · hidden" : ""
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						size: "sm",
						variant: "outline",
						disabled: toggle.isPending,
						onClick: () => toggle.mutate({
							id: r.id,
							active: !r.active,
							name: r.name
						}),
						children: r.active ? "Remove" : "Restore"
					})]
				}, r.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-3 flex flex-wrap gap-2",
				onSubmit: (e) => {
					e.preventDefault();
					add.mutate();
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: name,
						onChange: (e) => setName(e.target.value),
						placeholder: "Full name",
						className: "w-48"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: initials,
						onChange: (e) => setInitials(e.target.value),
						placeholder: "IN",
						className: "w-20"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						size: "sm",
						disabled: add.isPending || name.trim().length < 2,
						children: "Add rep"
					})
				]
			})
		]
	});
}
//#endregion
//#region src/routes/_app/settings.tsx
var Route$3 = createFileRoute("/_app/settings")({ component: Page$2 });
function Page$2() {
	const { prefs, update } = usePrefs();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
		className: "font-display text-3xl font-medium tracking-tight",
		children: "Settings"
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "mt-1 max-w-xl text-sm text-muted-foreground",
		children: "Display and ease-of-use for this device. Each person on the team can set their own — it stays on this browser."
	})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-6 grid gap-4 lg:max-w-2xl",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RosterEditor, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RepsEditor, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
				title: "Appearance",
				hint: "Dark mode is easier in the barn and on night calls. Match device follows the phone or laptop.",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Segmented, {
					value: prefs.appearance,
					onChange: (appearance) => update({ appearance }),
					options: [
						{
							id: "light",
							label: "Light",
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppearanceIcon, { value: "light" })
						},
						{
							id: "dark",
							label: "Dark",
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppearanceIcon, { value: "dark" })
						},
						{
							id: "system",
							label: "Match device",
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppearanceIcon, { value: "system" })
						}
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Preview, { appearance: prefs.appearance })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Text size",
				hint: "Large type helps when you’re standing back from a tablet or reading serials.",
				icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Type, { className: "size-4" }),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Segmented, {
					value: prefs.text,
					onChange: (text) => update({ text }),
					options: [{
						id: "default",
						label: "Default"
					}, {
						id: "large",
						label: "Large"
					}]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Density",
				hint: "Comfortable keeps 44px taps for the floor. Compact shows more rows on a laptop.",
				icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StretchHorizontal, { className: "size-4" }),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Segmented, {
					value: prefs.density,
					onChange: (density) => update({ density }),
					options: [{
						id: "comfortable",
						label: "Comfortable"
					}, {
						id: "compact",
						label: "Compact"
					}]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Contrast",
				hint: "High contrast strengthens borders and labels under shop lighting.",
				icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Contrast, { className: "size-4" }),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Segmented, {
					value: prefs.contrast,
					onChange: (contrast) => update({ contrast }),
					options: [{
						id: "standard",
						label: "Standard"
					}, {
						id: "high",
						label: "High"
					}]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Motion",
				hint: "Reduced turns off animation if it feels busy or you’re sensitive to movement.",
				icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Vibrate, { className: "size-4" }),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Segmented, {
					value: prefs.motion,
					onChange: (motion) => update({ motion }),
					options: [{
						id: "full",
						label: "Full"
					}, {
						id: "reduced",
						label: "Reduced"
					}]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "When I sign in",
				hint: "Resume opens the last page you were on — useful if you bounce between service and installs.",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Segmented, {
					value: prefs.resumeLast ? "resume" : "clock",
					onChange: (v) => update({ resumeLast: v === "resume" }),
					options: [{
						id: "clock",
						label: "Always Clock"
					}, {
						id: "resume",
						label: "Resume last page"
					}]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Keyboard",
				hint: "Press ? anywhere on the desk (except while typing).",
				icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Keyboard, { className: "size-4" }),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "divide-y divide-border rounded-xl border border-border",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shortcut, {
							keys: "⌘K",
							action: "Search accounts, serials, WOs"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shortcut, {
							keys: "?",
							action: "Open keyboard shortcuts"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shortcut, {
							keys: "Esc",
							action: "Close a sheet or dialog"
						})
					]
				})
			})
		]
	})] });
}
function Section({ title, hint, icon, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-xl border border-border bg-card p-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-start gap-2",
			children: [icon ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "mt-0.5 text-muted-foreground",
				children: icon
			}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-lg font-medium tracking-tight",
				children: title
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-0.5 text-xs text-muted-foreground",
				children: hint
			})] })]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-4",
			children
		})]
	});
}
function Segmented({ value, onChange, options }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex flex-wrap gap-2",
		role: "radiogroup",
		children: options.map((o) => {
			const on = o.id === value;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				role: "radio",
				"aria-checked": on,
				onClick: () => onChange(o.id),
				className: cn("inline-flex min-h-11 items-center gap-2 rounded-full px-3.5 text-sm font-medium", on ? "bg-ink text-ink-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"),
				children: [on ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3.5 shrink-0" }) : o.icon, o.label]
			}, o.id);
		})
	});
}
function Shortcut({ keys, action }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
		className: "flex items-center justify-between gap-3 px-3 py-2.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-sm",
			children: action
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", {
			className: "rounded-md border border-border bg-muted px-2 py-1 font-mono text-xs",
			children: keys
		})]
	});
}
function Preview({ appearance }) {
	const { prefs } = usePrefs();
	const dark = appearance === "dark" || appearance === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("mt-4 overflow-hidden rounded-lg border border-border", dark ? "bg-ink text-ink-foreground" : "bg-paper text-foreground"),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: cn("flex items-center justify-between px-3 py-2 text-xs", dark ? "bg-black/20" : "bg-muted/80"),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-display text-sm",
				children: "Katz Desk"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: dark ? "text-cream/60" : "text-muted-foreground",
				children: [prefs.text === "large" ? "Large type" : "Default type", prefs.density === "compact" ? " · Compact" : ""]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "px-3 py-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm font-medium",
				children: "Open call · The Gathery"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: cn("mt-0.5 text-xs", dark ? "text-cream/55" : "text-muted-foreground"),
				children: [
					"Serials and flags stay readable in ",
					dark ? "dark" : "light",
					" mode."
				]
			})]
		})]
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
				children: "Ready-to-deploy units at HQ. Slot ID is pallet + level — B-L3 is pallet B, third shelf. Pull a unit for an install or a service account and it leaves this board."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				onClick: () => setCreate(true),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "Add to rack"]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-5 grid min-w-0 grid-cols-2 gap-3 md:grid-cols-4",
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
