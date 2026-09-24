import { o as __toESM, r as __exportAll } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { _ as Link, b as useRouter, d as useRouterState, g as createRootRoute, h as createFileRoute, l as Scripts, m as Outlet, p as createRouter, u as HeadContent, v as Navigate, y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { r as createServerFn } from "./ssr.mjs";
import { t as isWalkIn } from "./customer-key-BKZJDViL.mjs";
import { t as OWNERSHIP_VALUES, u as serialKey } from "./account-equip-DMHHRLhM.mjs";
import { _ as revokeInvite, a as denyAccount, b as setAccountRole, c as grantAllCanAddCustomers, d as listDeskInvites, f as lookupSignIn, g as resendInvite, i as createSsrRpc, m as registerAccount, n as claimInvite, o as deskMiddleware, p as peekInvite, r as createInvite, s as getMyAccess, t as checkUsername, u as listDeskAccounts, v as setAccountApproved, y as setAccountCanAddCustomers } from "./access-Bds4AN6g.mjs";
import { fn as literal, hn as object, ln as array, mn as number, sn as _enum, un as boolean, vn as string, yn as union } from "../_libs/@better-auth/core+[...].mjs";
import { t as normalizeName } from "./norm-_aMMQVT6.mjs";
import { a as formatRep, n as PRODUCERS, o as isNoRep, r as PRODUCER_INITIALS, s as sameRep, t as DEFAULT_REPS } from "./rep-match-BoifcrYC.mjs";
import { r as sameTech, t as DEFAULT_TECHS } from "./tech-match-BXt0nt9H.mjs";
import { C as money, O as todayChicago, T as monthBounds, _ as isInstalled, a as addMonths, b as isOpenPm, c as formatMonthLabel, d as formatShortDate, g as isClosedPm, h as isClosedCall, i as addDays, k as weekBounds, m as installedPatch, o as diffDays, r as WEEKDAYS, s as formatLongDate, u as formatPingTime, v as isOpenCall, w as moneyExact, y as isOpenInstall } from "./clock-CnyB9j5S.mjs";
import { a as matchModel, c as piecesForInstall, d as serializeMachines, f as shortEquipLabel, i as listedEquipment, n as dropEquipment, o as mergeMachineSpecs, r as findRecipeFor, s as parseMachinesJson, t as catalogModels } from "./machines-kdzfuS7z.mjs";
import { S as spacePassError, _ as itemSaveError, a as INSPECTION_ITEM_STATUSES, b as showCoreHoleQuestion, d as inspectionGlance, o as canMarkInstalled, r as CORE_HOLE_QUESTION, x as siteIsReady } from "./pre-inspection-C3xoeIXB.mjs";
import { c as saveInspectionCoreHole, i as getInstallInspection, l as saveInspectionItem, n as addInspectionPhoto, r as copyInspectionNa, s as removeInspectionPhoto, t as addInspectionEquipment, u as saveInspectionMeta } from "./inspection-api-hmdB78Mh.mjs";
import { c as bayFor, i as LEVELS, l as isBarn, m as slotId, n as BARN_EQUIP_CAPACITY, o as SITE_LABEL, r as FRONT_PALLETS, t as BACK_PALLETS } from "./warehouse-C-11YLmg.mjs";
import { i as listReps, s as setRepActive, t as addRep } from "./reps-0zusJ0Ep.mjs";
import { n as mentionFragment, r as parseMentions, t as applyMention } from "./mentions-Cvlq5S1G.mjs";
import { i as markNotificationRead, n as listNotifications, r as listTeammates, s as sendPing } from "./notify-BqzZpuR5.mjs";
import { i as signOut, r as signIn, t as authClient } from "./client-BBelINLf.mjs";
import { a as REBUILD_STATUSES, d as priorityLabel, i as REBUILD_PRIORITIES, n as HEALTH_LABEL, o as SHOP_ACCOUNT, s as WAITING_REASONS } from "./rebuild-model-DFutjdeg.mjs";
import { a as settingsFrom, i as previewSetting, n as SETTING_FIELDS, r as filledSettingNames, t as DEFAULT_SETTING_NAMES } from "./recipe-fields-DqZtnvK8.mjs";
import { c as techLabel, n as listRosterCandidates, o as setRosterAdmin, r as listTechs, s as setTechActive, t as addTech } from "./roster-CTtWzCoL.mjs";
import { a as listRebuilds, i as listRebuildOwners, n as createRebuild, r as listRebuildLinks, s as pullRebuildSerial, t as archiveRebuild, u as updateRebuild } from "./rebuilds-BpT4pkPF.mjs";
import { S as statusTone, a as findDuplicateContact, c as formatContact, d as locationKey, f as normalizeCity, i as findDuplicateAddress, l as formatLocation, n as US_STATE_OPTIONS, o as findDuplicateLocation, r as duplicateNote, s as formatAddress, t as PROVIDER_STATUSES, u as groupLocations, v as providerStates, x as splitZips, y as roleLabel } from "./network-feNzLxWy.mjs";
import { i as setShopTest, r as reviewRackUnit, t as addToRackSlot } from "./rack-stock-DQ7ctveU.mjs";
import { t as applySerialPull } from "./serial-pull-zqo05hDE.mjs";
import { n as auth, t as GROK_PROVIDERS } from "./server-DKh3CVaJ.mjs";
import { a as HOUSE_TRAINING, c as lastMoveLine, f as unitPlaceLabel, i as HOUSE_STAGING, l as placeDraftError, n as HOUSE_LOBBY, o as PLACE_CHOICES, r as HOUSE_OTHER, s as electricalFrom, t as CUSTOMER_SITES } from "./unit-place-rules-CwKl9-0X.mjs";
import { A as List, B as Clock, C as Package, D as Menu, E as MessageSquare, F as GripVertical, G as Check, H as ChevronsUpDown, I as Globe, J as BookOpen, K as CalendarRange, L as Download, M as Keyboard, N as Handshake, O as MapPin, P as Hammer, R as Contrast, S as Pencil, T as Monitor, U as ChevronRight, V as CircleCheck, W as ChevronLeft, X as BellRing, Y as Bell, _ as Search, a as Users, b as Plus, c as Truck, d as Table2, f as Sun, g as Settings2, h as SlidersHorizontal, i as Vibrate, j as LayoutGrid, k as Mail, l as TriangleAlert, m as Store, n as Wrench, o as Upload, p as StretchHorizontal, q as CalendarClock, r as Warehouse, s as Type, t as X, u as Trash2, v as Rows3, w as Moon, x as Phone, y as Printer, z as Coffee } from "../_libs/lucide-react.mjs";
import { t as QueryClient } from "../_libs/tanstack__query-core.mjs";
import { i as useQueryClient, n as useQuery, r as QueryClientProvider, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { a as Tooltip, i as ResponsiveContainer, n as Pie, r as Cell, t as PieChart } from "../_libs/recharts+[...].mjs";
import { n as toast, t as Toaster } from "../_libs/sonner.mjs";
import { a as DialogOverlay, b as Slot, i as DialogDescription$1, n as DialogClose, o as DialogPortal, r as DialogContent$1, s as DialogTitle$1, t as Dialog$1 } from "../_libs/@radix-ui/react-dialog+[...].mjs";
import { i as Trigger, n as Portal, r as Root2, t as Content2 } from "../_libs/@radix-ui/react-popover+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/router-GWEnk-w1.js
var router_GWEnk_w1_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
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
var PRODUCER_INITIAL_VALUES = new Set(Object.values(PRODUCER_INITIALS).map((s) => s.toLowerCase()));
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
	add(user.username);
	const parts = (user.displayName ?? "").trim().split(/\s+/).filter(Boolean);
	if (parts.length >= 2) {
		const initials = (parts[0][0] + parts[1][0]).toLowerCase();
		if (PRODUCER_INITIAL_VALUES.has(initials)) keys.add(initials);
	}
	for (const rep of DEFAULT_REPS) {
		const first = rep.first.toLowerCase();
		const full = rep.name.toLowerCase();
		const ini = rep.initials.toLowerCase();
		if (keys.has(first) || keys.has(full) || keys.has(ini) || keys.has(rep.name.split(" ")[1]?.toLowerCase() ?? "")) {
			keys.add(first);
			keys.add(full);
			keys.add(ini);
			for (const t of nameTokens(rep.name)) keys.add(t);
		}
	}
	return keys;
}
function namesMatchUser(user, ...names) {
	const keys = userMatchKeys(user);
	if (!keys.size) return false;
	for (const name of names) for (const t of nameTokens(name)) if (keys.has(t)) return true;
	return false;
}
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
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "mt-2 h-10 rounded-full bg-ink px-4 text-sm font-medium text-ink-foreground",
				onClick: () => window.location.reload(),
				children: "Reload"
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
/** Service My View: keep unassigned plus rows whose technician matches the signed-in person. */
function mineByTechnician(list, opts) {
	if (!opts.filterMine || opts.role !== "service") return list;
	return list.filter((row) => opts.matchMine(row.technician) || !row.technician);
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
function toggleChip(current, next, off) {
	return current === next ? off : next;
}
function FilterChip({ selected, className, children, type = "button", ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type,
		className: cn("h-9 rounded-full px-3 text-sm font-medium", selected ? "bg-ink text-ink-foreground" : "bg-secondary text-foreground", className),
		"aria-pressed": selected,
		...props,
		children
	});
}
/** Secondary page actions. Same button styles, one click behind the primary. */
function ActionMenu({ label = "More", children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
		className: "group relative",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", {
			className: "inline-flex h-10 cursor-pointer list-none items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-muted [&::-webkit-details-marker]:hidden",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "absolute right-0 z-30 mt-1 flex min-w-48 flex-col gap-1 rounded-md border border-border bg-card p-1.5 shadow-sm [&_button]:w-full [&_button]:justify-start",
			children
		})]
	});
}
function StatRow({ children, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("mt-5 flex w-full min-w-0 flex-wrap gap-2", className),
		"data-stat-row": "",
		children
	});
}
function StatCard({ label, value, hint, tone, breakdown, selected, onClick }) {
	const inner = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
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
	] });
	const cls = cn("@container desk-lift min-w-[10rem] flex-1 overflow-hidden rounded-xl border px-3 py-3 text-left sm:px-4", selected ? "border-primary bg-primary/10 ring-2 ring-primary/30" : "border-border bg-card", onClick && "cursor-pointer transition-colors hover:border-primary/50");
	if (onClick) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		className: cls,
		onClick,
		"aria-pressed": !!selected,
		children: inner
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cls,
		children: inner
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
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(FilterChip, {
			selected: on,
			onClick: () => setOn(!on),
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
var styles_default = "/assets/styles-B-xx9jXZ.css";
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
var KEY = "katz-desk-invite";
function rememberInviteToken(token) {
	if (typeof window === "undefined") return;
	const value = token?.trim();
	if (!value) return;
	try {
		window.sessionStorage.setItem(KEY, value);
	} catch {}
}
function readInviteToken() {
	if (typeof window === "undefined") return null;
	try {
		const fromUrl = new URLSearchParams(window.location.search).get("invite");
		if (fromUrl?.trim()) {
			window.sessionStorage.setItem(KEY, fromUrl.trim());
			return fromUrl.trim();
		}
		return window.sessionStorage.getItem(KEY);
	} catch {
		return null;
	}
}
function clearInviteToken() {
	if (typeof window === "undefined") return;
	try {
		window.sessionStorage.removeItem(KEY);
	} catch {}
}
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
var getDashboard = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(createSsrRpc("3b18cb7c79b3d2a3708e94af1b95e011080a0bb6c37961f6996b2819e381e376"));
var listJobs = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("dd497d0a20bc74fd3516a43287eaf1f59ba8ff78889d055ec0134cb3b8100557"));
var getJob = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("7c7f50c54b853be302ab8dadb93d606276a3163565accc501df10cc4604d24fe"));
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
var updateJob = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => jobPatch.parse(d)).handler(createSsrRpc("9c7c27f89aa4613cba7b0cc60709986234616c8f59c62126c823a868928946ec"));
var mergeServiceTickets = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("5185381881205a8fef6ae18a40613e887010ff017f2d63e1a073bbc7aeb44afb"));
var createJob = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("33d624b110f3c458dc2c4420e1a7861c9781d7f6cfc29f1e17303ebbdacf5185"));
var listPms = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(createSsrRpc("b77061ca68bf02683e5808aff14e21ac7f7f4324c20c77e18ff63950e0f4c940"));
var updatePm = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("1ae4b4e6892721617dfc78392d46516266eb655551d1a355b50347de340f48e6"));
var createPm = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("56e061229f5d68c835c12340d4d78410c3592f0cc65d60e8b992d2ee67e6bed5"));
var listModules = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(createSsrRpc("8dea21981ac1b7bcdcc5dba0c9279774b461bd56790f061f6b87e9fe846b8a1f"));
var updateModule = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("a78a25b878a8eeb0571581d491679ee6d326c39db15f3f0853db09968b6e53d2"));
var createModule = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("8a73f2c9525ecba2938f9d480d18743e0dd450638e5c52e2aef7b2e574bfafed"));
var listDeals = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(createSsrRpc("c8fc4fe3d98eafc8771376a0d2ebec3bda02ebe075aeae0672deab4f6afdc960"));
var updateDeal = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("5d3ec062dccd2364f8eadd0069f1e26d01565b58d8975d81fd41d7eb9fb5942a"));
var createDeal = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("39bf7186ae5c8496b5fd07dadc19af7625bf4a0d78ac5dc625fb334957dd2da2"));
var archiveDeal = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("e62d56561a7cdcb00f526b0789df917594449c611f745739262dca774fcffed5"));
var listInstalls = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(createSsrRpc("e864dd8c9b80dad5f2c776a83f842418fb498cb3e65c666915bc181d9ae09617"));
var updateInstall = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("39b0743581a7bf62de46488cabcf15c68c717461b0afaefa731f4fdda4a5b323"));
var createInstall = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("f3d500b4701c16e140b486b0f00720767b652e6dd3e1353b7c2367dbcc44d86a"));
var archiveInstall = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("385f3e726aaef9adefa16c47f3a60e82af199dfba07c3b4c42b00ed68805f8b3"));
var listComments = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("4635ba032aed43ecf7bcf6ce29de400b651517a7fee7111213c11ac3740d7c53"));
var listActivity = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("fba13400f8c6e321ea705395de93864c9cc6795aeb9df4a67cfe7be7204c7886"));
var addComment = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("6f738980065bf83aabf85ff9c0bb4c1676ebab4840efd9eab8bac748961d6812"));
var claimComment = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("f818c883ef291f66d478761b3eb1ba6b94f06c954b7e2b79a760dee774ec3b53"));
var resolveComment = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("bd649af093753888caad62829610101a98a97fcfd3ebda7f1134c10f6803a31f"));
var getHandoff = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(createSsrRpc("f4edefbbe0a28284e851744c3220811add825e959937d13bcb55136bdffafb5c"));
var searchAll = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("bc07a2afcfdda5f33354b75fd397103613496c0ae0a38a79614caec91ba569d1"));
var handoffDeal = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("66d5f7130499f8b38df7162a2bc0d7acafb0c172702bd2241f68b2c76bf81dd5"));
var listAssets = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(createSsrRpc("a76f381d2caeca51254a208b811ee3a7058d68c1c43e253969f96eca6ae00fb0"));
var createAsset = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("cea062fe70e665c1d6153b5ed394cf90f7ed3f3b8e5ba2a80f14ffc114231996"));
var updateAsset = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("2582de1bfe6e7c6be8f3d00276438723a358e32a85e78329b73b0d7d21e9d1d2"));
var assignAssetToInstall = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("526601698722a8a88c929ec2b2bd22f0d7d0eb21efd3f1ee9090ef220a7ef449"));
var unassignAssetFromInstall = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("f3719f92ebca0f7fba68c57e4e6f1cfb9114315855feb08a7202f3310b8897b8"));
var assignAssetToService = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("0f1616336d82cdb378bdbca41e5fcf8cd1928d9b9bea529fac33b217f9d4777b"));
var unassignAssetFromService = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("3d6bd5686c9e2c59523c130a203368a03778b0e5137ce97d8af4fe9986cf09c9"));
var returnAssetToWarehouse = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("8b50c2d8a8f85716a978d9f8629d110029ab352f813c0d0b69c28e2a1151b0f3"));
var markAssetSold = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("96afcaa3f0fed3b3115ee12547f530fd6e737399bfaeee48b5989e79d4732a7f"));
var listRecipes = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(createSsrRpc("1200b5be72004e85f0bfcee1ed7fc4b89f856bb6c2e04dedd35aa46ed4833b05"));
var listCustomers = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(createSsrRpc("06fd80b5feb6d5cb8bbb9344a113508ac20a8fed29dbd5fc5c5cdab3f4ce7890"));
var listCustomerRecords = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(createSsrRpc("76d7b51b3118ce3c755ac90dd0aa6c2d698a01daf5246936cb2098cdebafa7f2"));
var getCustomerHistory = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("be65e2e7f569d7642b6ee04880eb13cfb0d2dd5bb1a1d5bc7aa804dee30b2280"));
var listDirectory = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("0163adac47649a0570c9a81c5541f36005e39618df4a4497c23d2dc78ffaa868"));
var updateCustomerAccount = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("8a09d9d7b24a86f0c775dbbaf1147644bdfffcbc6057d140eb48ee8ba6dc8a35"));
var addDirectoryEntry = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("f92a32e6bcb066079e1169e5037175021271e828adda251fc4bd6c7eceab34f8"));
var archiveDirectoryEntry = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("bbf684dab4be294977c8a135852746b46c064b5fe849356229cfe61bb158aad2"));
var renameCustomer = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("eeedbe6b03930fae6ba3c3db70a2afb562a9769026dd2db72fcf16a5dcbf9dac"));
var renameEquipment = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("3a3478acf53044fe7eab5aad067abd8b33c0b8558aad929a0d2b4ee08b583d71"));
var upsertRecipe = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("918e6d7f4bace1f6c78033b9037d1c6c24ab3094b0be582a97b47c01d0246dc3"));
var copyRecipe = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("af2770ffc7230f6441c2c90211140e8767fbb7f8fbe129f5b054493e873c7436"));
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
			const review = newest?.body?.includes("Needs review");
			toast.message(review ? "Rack needs review" : `${newest?.fromName ?? "Teammate"} pinged you`, { description: [
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
									children: n.body.includes("Needs review") ? " · Needs review" : " pinged you"
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
function Skeleton({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("animate-pulse rounded-md bg-muted", className),
		...props
	});
}
var ALL_TYPES = [
	"installs",
	"pms",
	"tlcs",
	"services"
];
var TYPE_META = {
	installs: {
		label: "Installs",
		short: "Install",
		entity: "install",
		className: "bg-primary/15 text-primary"
	},
	pms: {
		label: "PMs",
		short: "PM",
		entity: "pm",
		className: "bg-secondary text-foreground"
	},
	tlcs: {
		label: "TLCs",
		short: "TLC",
		entity: "tlc",
		className: "bg-warning/15 text-warning"
	},
	services: {
		label: "Services",
		short: "Service",
		entity: "service",
		className: "bg-ink/10 text-ink"
	}
};
var dragItem = null;
function ticketNo(it) {
	return it.wo || it.callId || null;
}
function collectItems(input) {
	const items = [];
	const add = (row) => {
		items.push({
			...row,
			key: `${row.type}-${row.id}`
		});
	};
	for (const i of input.installs) {
		if (!i.installDate || isInstalled(i)) continue;
		add({
			type: "installs",
			entityType: "install",
			id: i.id,
			account: i.customer,
			wo: i.wo,
			callId: null,
			date: i.installDate,
			owner: i.technician || i.accountRep,
			extra: inspectionGlance(i.inspection)
		});
	}
	for (const p of input.pms) {
		if (!p.projected || isClosedPm(p)) continue;
		add({
			type: "pms",
			entityType: "pm",
			id: p.id,
			account: p.customer,
			wo: p.wo,
			callId: null,
			date: p.projected,
			owner: p.technician
		});
	}
	for (const j of input.tlcs) {
		if (!j.scheduled || isClosedCall(j)) continue;
		add({
			type: "tlcs",
			entityType: "tlc",
			id: j.id,
			account: j.customer || "Untitled",
			wo: j.wo,
			callId: j.callId,
			date: j.scheduled,
			owner: j.technician
		});
	}
	for (const j of input.services) {
		if (!j.scheduled || isClosedCall(j)) continue;
		add({
			type: "services",
			entityType: "service",
			id: j.id,
			account: j.customer || "Untitled",
			wo: j.wo,
			callId: j.callId,
			date: j.scheduled,
			owner: j.technician
		});
	}
	return items;
}
function usePlannerWork() {
	const { matchMine, filterMine, role } = useMyView();
	const installsQ = useQuery({
		queryKey: ["installs"],
		queryFn: () => listInstalls()
	});
	const pmsQ = useQuery({
		queryKey: ["pms"],
		queryFn: () => listPms()
	});
	const servicesQ = useQuery({
		queryKey: ["jobs", "service"],
		queryFn: () => listJobs({ data: { kind: "service" } })
	});
	const tlcsQ = useQuery({
		queryKey: ["jobs", "tlc"],
		queryFn: () => listJobs({ data: { kind: "tlc" } })
	});
	return {
		installs: (0, import_react.useMemo)(() => {
			let list = installsQ.data ?? [];
			if (filterMine) list = list.filter((i) => matchMine(i.accountRep, i.technician) || i.aviKatz);
			return list;
		}, [
			installsQ.data,
			filterMine,
			matchMine
		]),
		pms: (0, import_react.useMemo)(() => mineByTechnician(pmsQ.data ?? [], {
			filterMine,
			role,
			matchMine
		}), [
			pmsQ.data,
			filterMine,
			matchMine,
			role
		]),
		services: (0, import_react.useMemo)(() => mineByTechnician(servicesQ.data ?? [], {
			filterMine,
			role,
			matchMine
		}), [
			servicesQ.data,
			filterMine,
			matchMine,
			role
		]),
		tlcs: (0, import_react.useMemo)(() => mineByTechnician(tlcsQ.data ?? [], {
			filterMine,
			role,
			matchMine
		}), [
			tlcsQ.data,
			filterMine,
			matchMine,
			role
		]),
		loading: installsQ.isLoading || pmsQ.isLoading || servicesQ.isLoading || tlcsQ.isLoading
	};
}
function patchDate(rows, id, patch) {
	if (!rows) return rows;
	return rows.map((row) => row.id === id ? {
		...row,
		...patch
	} : row);
}
async function saveDate(item, date) {
	if (item.type === "installs") {
		await updateInstall({ data: {
			id: item.id,
			installDate: date
		} });
		return;
	}
	if (item.type === "pms") {
		await updatePm({ data: {
			id: item.id,
			projected: date
		} });
		return;
	}
	await updateJob({ data: {
		id: item.id,
		scheduled: date
	} });
}
function PlannerCalendar({ installs, pms, services, tlcs, variant = "page" }) {
	const today = todayChicago();
	const navigate = useNavigate();
	const qc = useQueryClient();
	const [anchor, setAnchor] = (0, import_react.useState)(() => monthBounds(today).start);
	const [types, setTypes] = (0, import_react.useState)(() => new Set(ALL_TYPES));
	const [over, setOver] = (0, import_react.useState)(null);
	const dragged = (0, import_react.useRef)(false);
	const month = monthBounds(anchor);
	const allOn = types.size === ALL_TYPES.length;
	const pop = variant === "pop";
	const items = (0, import_react.useMemo)(() => collectItems({
		installs,
		pms,
		services,
		tlcs
	}), [
		installs,
		pms,
		services,
		tlcs
	]);
	const visible = (0, import_react.useMemo)(() => {
		return items.filter((it) => types.has(it.type) && it.date >= month.start && it.date <= month.end);
	}, [
		items,
		types,
		month.start,
		month.end
	]);
	const byDay = (0, import_react.useMemo)(() => {
		const map = /* @__PURE__ */ new Map();
		for (const it of visible) {
			const list = map.get(it.date) ?? [];
			list.push(it);
			map.set(it.date, list);
		}
		for (const list of map.values()) list.sort((a, b) => a.account.localeCompare(b.account) || a.type.localeCompare(b.type));
		return map;
	}, [visible]);
	const gridStart = weekBounds(month.start).start;
	const cells = [];
	for (let i = 0; i < 42; i++) {
		const d = addDays(gridStart, i);
		cells.push(d);
		if (d >= month.end && (i + 1) % 7 === 0) break;
	}
	function toggle(t) {
		if (t === "all") {
			setTypes(new Set(ALL_TYPES));
			return;
		}
		if (types.size === ALL_TYPES.length) {
			setTypes(/* @__PURE__ */ new Set([t]));
			return;
		}
		const next = new Set(types);
		if (next.has(t)) {
			next.delete(t);
			setTypes(next.size === 0 ? new Set(ALL_TYPES) : next);
			return;
		}
		next.add(t);
		setTypes(next.size === ALL_TYPES.length ? new Set(ALL_TYPES) : next);
	}
	function paint(item, date) {
		if (item.type === "installs") qc.setQueryData(["installs"], (old) => patchDate(old, item.id, { installDate: date }));
		else if (item.type === "pms") qc.setQueryData(["pms"], (old) => patchDate(old, item.id, { projected: date }));
		else {
			const kind = item.type === "tlcs" ? "tlc" : "service";
			const apply = (old) => patchDate(old, item.id, { scheduled: date });
			qc.setQueryData(["jobs", kind], apply);
			qc.setQueryData(["jobs"], apply);
		}
	}
	async function reschedule(item, date) {
		if (item.date === date) return;
		if (Math.abs(diffDays(item.date, date)) > 14) {
			if (!window.confirm(`Move “${item.account}” from ${formatShortDate(item.date)} to ${formatShortDate(date)}? That’s more than 14 days.`)) return;
		}
		const from = item.date;
		paint(item, date);
		try {
			await saveDate(item, date);
			toast.success(`${item.account} is now ${formatShortDate(date)}`);
		} catch (err) {
			paint(item, from);
			toast.error(err instanceof Error ? err.message : "Could not reschedule");
		}
		qc.invalidateQueries({ queryKey: ["installs"] });
		qc.invalidateQueries({ queryKey: ["pms"] });
		qc.invalidateQueries({ queryKey: ["jobs"] });
		qc.invalidateQueries({ queryKey: ["dashboard"] });
		qc.invalidateQueries({ queryKey: ["customer-history"] });
	}
	function openItem(it) {
		const to = it.entityType === "install" ? "/installs" : it.entityType === "pm" ? "/pms" : it.entityType === "tlc" ? "/tlc" : "/service";
		navigate({
			to,
			search: { open: it.id }
		});
	}
	const monthAll = items.filter((it) => it.date >= month.start && it.date <= month.end);
	const typeCount = (t) => monthAll.filter((it) => it.type === t).length;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: cn("min-w-0 rounded-xl border border-border bg-card", pop ? "p-3" : "p-4"),
		"data-testid": pop ? "pending-calendar" : "planner-calendar",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-start justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-xl leading-tight",
					children: pop ? "Pending" : "Month"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[11px] text-muted-foreground",
					children: pop ? "Pending work only. Drag a job to another day — it stays on this window." : "Pending work only. Drag a job to another day to reschedule. Click to open."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							size: "sm",
							variant: "outline",
							onClick: () => setAnchor(addMonths(anchor, -1)),
							"aria-label": "Previous month",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "size-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							size: "sm",
							variant: "outline",
							onClick: () => setAnchor(monthBounds(today).start),
							children: "This month"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							size: "sm",
							variant: "outline",
							onClick: () => setAnchor(addMonths(anchor, 1)),
							"aria-label": "Next month",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4" })
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-2 text-sm text-muted-foreground",
				children: [
					formatMonthLabel(anchor),
					" · ",
					visible.length,
					" pending"
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex flex-wrap gap-2",
				role: "group",
				"aria-label": "Calendar types",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					"data-testid": pop ? "pop-type-all" : "cal-type-all",
					"aria-pressed": allOn,
					onClick: () => toggle("all"),
					className: cn("h-8 rounded-full px-3 text-sm font-medium", allOn ? "bg-ink text-ink-foreground" : "bg-secondary"),
					children: "All"
				}), ALL_TYPES.map((t) => {
					const on = types.has(t) && !allOn;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						"data-testid": pop ? `pop-type-${t}` : `cal-type-${t}`,
						"aria-pressed": on || allOn,
						onClick: () => toggle(t),
						className: cn("h-8 rounded-full px-3 text-sm font-medium", on ? "bg-ink text-ink-foreground" : "bg-secondary"),
						children: [TYPE_META[t].label, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ml-1 tabular text-xs opacity-70",
							children: typeCount(t)
						})]
					}, t);
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4 overflow-x-auto",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: pop ? "min-w-[22rem]" : "min-w-[44rem]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid grid-cols-7 gap-1 text-[10px] tracking-wide text-muted-foreground uppercase",
						children: WEEKDAYS.map((d) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "px-1",
							children: pop ? d.slice(0, 1) : d
						}, d))
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-1 grid grid-cols-7 gap-1",
						children: cells.map((d) => {
							const inMonth = d >= month.start && d <= month.end;
							const dayItems = inMonth ? byDay.get(d) ?? [] : [];
							const isToday = d === today;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								"data-testid": `${pop ? "pop" : "planner"}-day-${d}`,
								onDragOver: (e) => {
									if (!dragItem) return;
									e.preventDefault();
									e.dataTransfer.dropEffect = "move";
									if (over !== d) setOver(d);
								},
								onDragLeave: (e) => {
									if (e.currentTarget.contains(e.relatedTarget)) return;
									if (over === d) setOver(null);
								},
								onDrop: (e) => {
									e.preventDefault();
									const item = dragItem;
									setOver(null);
									if (!item) return;
									reschedule(item, d);
								},
								className: cn("rounded-md border border-transparent bg-secondary/40 p-1", pop ? "min-h-[4.5rem]" : "min-h-[6.5rem]", !inMonth && "opacity-40", isToday && "border-primary/40 bg-primary/5", over === d && "border-primary bg-primary/10"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: cn("px-1 text-[11px] tabular", isToday && "font-semibold text-foreground"),
									children: pop ? Number(d.slice(8)) : formatShortDate(d)
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
									className: "mt-0.5 space-y-0.5",
									children: dayItems.map((it) => {
										const meta = TYPE_META[it.type];
										const st = ticketNo(it);
										return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											role: "button",
											tabIndex: 0,
											draggable: true,
											"data-testid": `${pop ? "pop" : "planner"}-item-${it.key}`,
											title: `${it.account} · ${meta.short}${st ? ` · ${st}` : ""}${it.owner ? ` · ${it.owner}` : ""}`,
											onDragStart: (e) => {
												dragItem = it;
												dragged.current = true;
												e.dataTransfer.effectAllowed = "move";
												e.dataTransfer.setData("text/plain", it.key);
											},
											onDragEnd: () => {
												dragItem = null;
												setOver(null);
											},
											onClick: () => {
												if (dragged.current) {
													dragged.current = false;
													return;
												}
												if (pop) return;
												openItem(it);
											},
											onKeyDown: (e) => {
												if (pop) return;
												if (e.key === "Enter" || e.key === " ") {
													e.preventDefault();
													openItem(it);
												}
											},
											className: "desk-lift block min-w-0 cursor-grab rounded-sm px-1 py-0.5 text-left active:cursor-grabbing",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: cn("inline-block rounded px-1 text-[9px] font-medium tracking-wide uppercase", meta.className),
													children: meta.short
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "mt-0.5 block truncate text-[11px] font-medium leading-tight",
													children: it.account
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "block truncate text-[10px] text-muted-foreground",
													children: [st, it.owner].filter(Boolean).join(" · ") || meta.label
												})
											]
										}) }, it.key);
									})
								})]
							}, d);
						})
					})]
				})
			})
		]
	});
}
var DockCtx = (0, import_react.createContext)({
	open: false,
	setOpen: () => void 0
});
function useCalendarDock() {
	return (0, import_react.useContext)(DockCtx);
}
function frameKey(userId) {
	return `katz-desk-cal-frame:${userId}`;
}
function defaultFrame() {
	if (typeof window === "undefined") return {
		x: 24,
		y: 88,
		w: 460,
		h: 560
	};
	const w = 460;
	const h = Math.min(620, Math.max(420, window.innerHeight - 140));
	return {
		x: Math.max(12, window.innerWidth - w - 20),
		y: 84,
		w,
		h
	};
}
function readFrame(userId) {
	try {
		const raw = window.localStorage.getItem(frameKey(userId));
		if (!raw) return defaultFrame();
		const parsed = JSON.parse(raw);
		const base = defaultFrame();
		const w = clamp(Number(parsed.w) || base.w, 340, Math.max(360, window.innerWidth - 16));
		const h = clamp(Number(parsed.h) || base.h, 380, Math.max(400, window.innerHeight - 16));
		return {
			x: clamp(Number(parsed.x), 8 - w + 120, window.innerWidth - 80),
			y: clamp(Number(parsed.y), 8, window.innerHeight - 48),
			w,
			h
		};
	} catch {
		return defaultFrame();
	}
}
function clamp(n, min, max) {
	if (!Number.isFinite(n)) return min;
	return Math.min(max, Math.max(min, n));
}
function CalendarDock({ children }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DockCtx.Provider, {
		value: {
			open,
			setOpen
		},
		children
	});
}
function CalendarDockButton({ className }) {
	const { open, setOpen } = useCalendarDock();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
		type: "button",
		variant: open ? "default" : "outline",
		size: "sm",
		className,
		"aria-pressed": open,
		"aria-label": "Pending calendar",
		"data-testid": "pending-calendar-toggle",
		onClick: () => setOpen(!open),
		children: "Pending calendar"
	});
}
function PendingCalendarPop() {
	const { open, setOpen } = useCalendarDock();
	const { user } = useCurrentUserState();
	const userId = user?.id ?? "desk";
	const [frame, setFrame] = (0, import_react.useState)(() => typeof window === "undefined" ? {
		x: 24,
		y: 88,
		w: 460,
		h: 560
	} : readFrame(userId));
	const frameRef = (0, import_react.useRef)(frame);
	frameRef.current = frame;
	(0, import_react.useEffect)(() => {
		if (!open) return;
		setFrame(readFrame(userId));
	}, [open, userId]);
	function persist(next) {
		frameRef.current = next;
		setFrame(next);
		try {
			window.localStorage.setItem(frameKey(userId), JSON.stringify(next));
		} catch {}
	}
	function dragFrame(e, mode) {
		if (mode === "move" && e.target.closest("button")) return;
		e.preventDefault();
		const startX = e.clientX;
		const startY = e.clientY;
		const orig = frameRef.current;
		function move(ev) {
			const dx = ev.clientX - startX;
			const dy = ev.clientY - startY;
			if (mode === "move") {
				const next = {
					...orig,
					x: clamp(orig.x + dx, 8 - orig.w + 120, window.innerWidth - 80),
					y: clamp(orig.y + dy, 8, window.innerHeight - 48)
				};
				frameRef.current = next;
				setFrame(next);
			} else {
				const next = {
					...orig,
					w: clamp(orig.w + dx, 340, window.innerWidth - 16),
					h: clamp(orig.h + dy, 380, window.innerHeight - 16)
				};
				frameRef.current = next;
				setFrame(next);
			}
		}
		function up() {
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
			persist(frameRef.current);
		}
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", up);
	}
	if (!open) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed z-40 flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft",
		style: {
			left: frame.x,
			top: frame.y,
			width: frame.w,
			height: frame.h
		},
		"data-testid": "pending-calendar-window",
		role: "dialog",
		"aria-label": "Pending calendar",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex cursor-grab items-center gap-2 border-b border-border bg-card px-3 py-2 active:cursor-grabbing",
				onPointerDown: (e) => dragFrame(e, "move"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "min-w-0 flex-1 truncate text-sm font-medium",
					children: "Pending calendar"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
					"aria-label": "Close calendar",
					"data-testid": "pending-calendar-close",
					onClick: () => setOpen(false),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "min-h-0 flex-1 overflow-auto p-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PopBody, {})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				"aria-label": "Resize calendar",
				className: "absolute right-1 bottom-1 size-4 cursor-nwse-resize rounded-sm border border-border bg-muted",
				onPointerDown: (e) => dragFrame(e, "resize")
			})
		]
	});
}
function PopBody() {
	const work = usePlannerWork();
	if (work.loading) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-64 w-full" });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlannerCalendar, {
		variant: "pop",
		installs: work.installs,
		pms: work.pms,
		services: work.services,
		tlcs: work.tlcs
	});
}
var NAV = [
	{
		label: "Work",
		items: [
			{
				to: "/",
				label: "Coming due",
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
				label: "Tickets",
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
				to: "/handoff",
				label: "Handoff",
				icon: MessageSquare
			}
		]
	},
	{
		label: "Installs",
		items: [
			{
				to: "/installs",
				label: "Board",
				icon: Truck
			},
			{
				to: "/recipes",
				label: "Recipes",
				icon: BookOpen
			},
			{
				to: "/pipeline",
				label: "Pipeline",
				icon: Handshake
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
				to: "/rebuilds",
				label: "Rebuilds",
				icon: Hammer
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
			}
		]
	},
	{
		label: "Accounts",
		items: [{
			to: "/customers",
			label: "Customers",
			icon: Store
		}, {
			to: "/network",
			label: "Out of Network",
			icon: Globe
		}]
	},
	{
		label: "Admin",
		items: [{
			to: "/settings",
			label: "Settings",
			icon: SlidersHorizontal
		}]
	}
];
function itemActive(pathname, item) {
	if (item.exact) return pathname === item.to;
	return pathname === item.to || pathname.startsWith(`${item.to}/`);
}
function NavItemLink({ item, pathname, onNavigate }) {
	const active = itemActive(pathname, item);
	const Icon = item.icon;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
		to: item.to,
		onClick: onNavigate,
		className: cn("flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors", active ? "bg-cream/12 text-cream" : "text-cream/70 hover:bg-cream/8 hover:text-cream"),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-4" }), item.label]
	}) });
}
function NavGroup({ group, pathname, onNavigate }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "px-3 text-[11px] font-medium tracking-[0.16em] text-cream/50 uppercase",
		children: group.label
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "mt-2 space-y-0.5",
		children: group.items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavItemLink, {
			item,
			pathname,
			onNavigate
		}, item.to))
	})] });
}
var WAREHOUSE_OK = ["/warehouse", "/locations"];
function navForRole(role, isAdmin) {
	if (role !== "warehouse") return NAV;
	return [{
		label: "Shop",
		items: NAV.find((g) => g.label === "Shop").items.filter((item) => item.to === "/warehouse" || item.to === "/locations")
	}];
}
function NavLinks({ onNavigate, isAdmin, role }) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const groups = navForRole(role, isAdmin);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
		className: "flex flex-col gap-5",
		"data-testid": "side-nav",
		children: groups.map((group) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavGroup, {
			group: group.label === "Admin" && isAdmin && role !== "warehouse" ? {
				...group,
				items: [...group.items, {
					to: "/access",
					label: "Access",
					icon: Users
				}]
			} : group,
			pathname,
			onNavigate
		}, group.label))
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
function AppShell({ children, isAdmin, role = null }) {
	const { user, isPending } = useCurrentUserState();
	const [open, setOpen] = (0, import_react.useState)(false);
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		if (!user) return;
		if (sessionStorage.getItem("katz-desk-resumed")) return;
		sessionStorage.setItem(RESUMED_KEY, "1");
		if (!readPrefs().resumeLast) {
			if (role === "warehouse") {
				router.history.push("/warehouse");
				return;
			}
			if (role === "sales" && (pathname === "/" || pathname === "")) router.history.push("/customers");
			return;
		}
		const last = window.localStorage.getItem(LAST_PATH_KEY);
		if (last && last !== pathname && last !== "/login") router.history.push(last);
	}, [
		user,
		pathname,
		router,
		role
	]);
	(0, import_react.useEffect)(() => {
		if (!user || role !== "warehouse") return;
		if (!WAREHOUSE_OK.some((p) => pathname === p || pathname.startsWith(`${p}/`))) router.history.push("/warehouse");
	}, [
		user,
		role,
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
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CalendarDock, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
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
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavLinks, {
							isAdmin,
							role
						})
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
					className: "relative flex min-h-[4.75rem] flex-wrap items-center gap-2 overflow-hidden border-b border-border bg-cover bg-center px-3 py-3 md:px-6",
					style: { backgroundImage: "url(/desk-header.jpg)" },
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-background/55" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative z-10 flex w-full flex-wrap items-center gap-2",
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
								className: "ml-auto flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 md:ml-0",
								children: [
									role === "warehouse" ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MyViewBar, {}),
									role === "warehouse" ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlobalSearch, {}),
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
					})]
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
								isAdmin,
								role
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
	}), role === "warehouse" ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PendingCalendarPop, {})] });
}
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
var USERNAME_RE = /^[a-zA-Z0-9._-]{3,32}$/;
function UsernameSetup({ email, onDone }) {
	const [username, setUsername] = (0, import_react.useState)("");
	const [hint, setHint] = (0, import_react.useState)(null);
	const save = useMutation({
		mutationFn: (name) => registerAccount({ data: {
			username: name,
			email,
			token: readInviteToken()
		} }),
		onSuccess: (row) => {
			if (row.approved) clearInviteToken();
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
function withTimeout(work, ms, message) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(message)), ms);
		work.then((value) => {
			clearTimeout(timer);
			resolve(value);
		}, (err) => {
			clearTimeout(timer);
			reject(err);
		});
	});
}
function AccountProblem({ title, message, onRetry }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
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
					children: title
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-cream/70",
					children: message
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 flex flex-col gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						className: "w-full",
						onClick: onRetry,
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
}
function DeskLayout() {
	const { user, isPending } = useCurrentUserState();
	const [inviteToken, setInviteToken] = (0, import_react.useState)(null);
	const [inviteReady, setInviteReady] = (0, import_react.useState)(false);
	const [sessionSlow, setSessionSlow] = (0, import_react.useState)(false);
	const [gateSlow, setGateSlow] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		setInviteToken(readInviteToken());
		setInviteReady(true);
	}, []);
	(0, import_react.useEffect)(() => {
		if (user || !isPending) {
			setSessionSlow(false);
			return;
		}
		const retry = window.setTimeout(() => {
			authClient.getSession().catch(() => void 0);
		}, 3e3);
		const giveUp = window.setTimeout(() => setSessionSlow(true), 8e3);
		return () => {
			window.clearTimeout(retry);
			window.clearTimeout(giveUp);
		};
	}, [user, isPending]);
	const claim = useQuery({
		queryKey: [
			"access",
			"claim",
			inviteToken
		],
		queryFn: async () => {
			const row = await withTimeout(claimInvite({ data: { token: inviteToken } }), 12e3, "Claiming the invite took too long.");
			if (row.approved) clearInviteToken();
			return row;
		},
		enabled: !!user && inviteReady && !!inviteToken,
		retry: 1
	});
	const access = useQuery({
		queryKey: ["access", "me"],
		queryFn: () => withTimeout(getMyAccess(), 12e3, "Loading your account took too long."),
		enabled: !!user && inviteReady && (!inviteToken || claim.isFetched),
		refetchInterval: (q) => {
			const d = q.state.data;
			if (d && !d.approved && d.usernameChosen) return 3e3;
			if (d?.approved) return 12e3;
			return false;
		},
		retry: 1
	});
	const gateBlocked = !!user && inviteReady && (!inviteToken || claim.isFetched) && !access.data && !claim.data && !access.isError;
	(0, import_react.useEffect)(() => {
		if (!gateBlocked) {
			setGateSlow(false);
			return;
		}
		const giveUp = window.setTimeout(() => setGateSlow(true), 12e3);
		return () => window.clearTimeout(giveUp);
	}, [gateBlocked]);
	if (!user && !isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RedirectToSignIn, {});
	if (!user && sessionSlow) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccountProblem, {
		title: "Couldn’t load your account",
		message: "The sign-in check didn’t finish. Try again, or sign out and come back in.",
		onRetry: () => window.location.reload()
	});
	if (!user || !inviteReady) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoadingClock, {});
	if (inviteToken && !claim.isFetched && !claim.isError) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoadingClock, {});
	if (gateBlocked && !gateSlow) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoadingClock, {});
	const gate = claim.data?.approved ? {
		...access.data,
		...claim.data,
		approved: true,
		denied: false
	} : access.data;
	if (gateSlow || access.isError || inviteToken && claim.isError && !access.data) {
		const err = access.error ?? claim.error;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccountProblem, {
			title: "Couldn’t load your account",
			message: err instanceof Error ? err.message : "Loading your account took too long.",
			onRetry: () => {
				setGateSlow(false);
				access.refetch();
				if (inviteToken) claim.refetch();
			}
		});
	}
	if (gate?.needsUsername) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UsernameSetup, {
		email: gate.email ?? user.primaryEmail,
		onDone: () => void access.refetch()
	});
	if (gate?.denied) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
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
						gate.username,
						". An admin declined this account. Ask them to send a new invite link — opening that link signs you in."
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
	if (!gate?.approved) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
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
						gate?.username ?? "this account",
						". Open the invite link from your admin while signed in, or ask them to send a new one. Without that link, an admin still needs to approve this account."
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
		isAdmin: !!gate.isAdmin,
		role: gate.role,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {})
	});
}
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
		rememberInviteToken(new URLSearchParams(window.location.search).get("invite"));
		if (readInviteToken()) setMode("up");
		else if (readPending()) setMode("pending");
	}, []);
	(0, import_react.useEffect)(() => {
		if (isPending || !user || mode === "pending") return;
		(async () => {
			try {
				const token = readInviteToken();
				if (!token && mode === "up") return;
				const access = token ? await claimInvite({ data: { token } }) : await getMyAccess();
				if (access.approved) clearInviteToken();
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
					email: mail,
					token: readInviteToken()
				} });
				await router.invalidate();
				if (access.approved) clearInviteToken();
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
										const token = readInviteToken();
										if ((token ? await claimInvite({ data: { token } }) : await getMyAccess()).approved) {
											clearInviteToken();
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
						children: mode === "up" ? readInviteToken() ? "This invite lets you in. Create a password, or continue with Google or X." : "Use the email you were invited with (or Google / X). Invited people skip the wait." : "Username or the email on your account. Open the invite link if you have one."
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
							onClick: () => {
								const token = readInviteToken();
								const back = token ? `/login?invite=${encodeURIComponent(token)}` : "/login";
								signIn(p.providerId, {
									callbackURL: token ? `/?invite=${encodeURIComponent(token)}` : "/",
									errorCallbackURL: back
								}).catch((err) => setError(err instanceof Error ? err.message : "Sign-in failed"));
							},
							children: ["Continue with ", p.label]
						}, p.providerId))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-5 text-xs leading-relaxed text-cream/40",
						children: "Open the invite link from your admin, then create an account or use Google / X. That link approves you. Anyone without an invite still waits for approval."
					})
				] })
			})]
		})
	});
}
var badgeVariants = cva("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tracking-tight", {
	variants: {
		variant: {
			default: "bg-secondary text-secondary-foreground",
			primary: "bg-primary/12 text-primary",
			danger: "bg-destructive/12 text-destructive",
			warn: "bg-warning/12 text-warning",
			success: "bg-primary/12 text-primary",
			outline: "border border-border text-foreground",
			ink: "bg-ink text-ink-foreground"
		},
		size: {
			default: "",
			tight: "h-[1.125rem] shrink-0 whitespace-nowrap px-1.5 py-0 text-[11px] leading-none"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "default"
	}
});
function Badge({ className, variant, size, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn(badgeVariants({
			variant,
			size
		}), className),
		...props
	});
}
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
function StatusBadge({ status, tight = false, className }) {
	const size = tight ? "tight" : "default";
	if (!status) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		variant: "outline",
		size,
		className,
		children: "Unset"
	});
	const s = status.toLowerCase();
	let variant = "default";
	if (s.includes("complete") || s === "installed" || s === "ready" || s === "phone resolved") variant = "success";
	else if (s.includes("cancel") || s.includes("fell") || s.includes("overdue") || s.includes("not ready")) variant = "danger";
	else if (s.includes("needs bay") || s.includes("serial missing")) variant = "warn";
	else if (s.includes("progress") || s.includes("dispatch") || s.includes("await") || s.includes("follow")) variant = "warn";
	else if (s === "pending review") variant = "warn";
	else if (s === "needs test") variant = "outline";
	else if (s === "tested") variant = "primary";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		variant,
		size,
		className,
		children: status
	});
}
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
						className: "desk-lift grid gap-0.5 px-2.5 py-1.5 hover:bg-muted/60 sm:grid-cols-[minmax(0,1.4fr)_5.5rem_4.5rem_auto] sm:items-center sm:gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "min-w-0",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "flex min-w-0 items-center gap-1.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "truncate font-medium",
											children: row.customer
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AkBadge, { on: row.aviKatz })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "block truncate text-[11px] text-muted-foreground",
										children: row.wo || row.detail || row.equipment || "—"
									}),
									row.kind === "install" && row.inspectionStatus ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "block truncate text-[11px] text-muted-foreground",
										children: [
											"Pre-inspection ",
											row.inspectionStatus,
											row.failedItems ? ` · ${row.failedItems}` : ""
										]
									}) : null
								]
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
var Route$17 = createFileRoute("/_app/")({ component: ClockHome });
function ClockHome() {
	const dash = useQuery({
		queryKey: ["dashboard"],
		queryFn: () => getDashboard()
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
	const dueRows = filterMine ? d.comingDue.filter((r) => role === "sales" ? matchMine(r.accountRep) || r.aviKatz : matchMine(r.technician) || !r.technician) : d.comingDue;
	const weekEnd = weekBounds(d.today).end;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { children: [
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
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/service",
						className: "min-w-0",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniStat, {
							label: "Active calls",
							value: d.kpis.activeCalls,
							hint: "Open tickets"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniStat, {
						label: "Coming due",
						value: d.kpis.comingDue,
						hint: "Overdue, today, this week"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/installs",
						className: "min-w-0",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniStat, {
							label: "Install queue",
							value: d.kpis.installQueue,
							hint: `${d.kpis.installAtRisk} at risk`
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/pms",
						className: "min-w-0",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniStat, {
							label: "PMs active",
							value: d.kpis.pmsActive,
							hint: "Open the PM board"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/rebuilds",
						className: "min-w-0",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniStat, {
							label: "Rebuilds",
							value: (d.kpis.rebuildOverdue ?? 0) + (d.kpis.rebuildWaiting ?? 0),
							hint: `${d.kpis.rebuildOverdue ?? 0} overdue · ${d.kpis.rebuildWaiting ?? 0} waiting`
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ComingDuePanel, {
				rows: dueRows,
				counts: d.comingDueCounts,
				weekEnd,
				compact
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RebuildAlerts, { rows: d.rebuildAlerts ?? [] }),
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
			})
		]
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
var Route$16 = createFileRoute("/_app/access")({ component: Page$15 });
function inviteBody(inv, origin) {
	const who = [inv.username ? `username ${inv.username}` : null, inv.email ? `email ${inv.email}` : null].filter(Boolean).join(" or ") || "any username";
	return `You're invited to Katz Desk.

Open this link. It lets you in for 14 days — you do not need a second approval:
${inv.token ? `${origin}/login?invite=${encodeURIComponent(inv.token)}` : `${origin}/login`}

Create an account (${who}), or continue with Google or X on that same page.
After you are in, use ${origin.includes("grok.me") ? origin : "https://katzdesk.grok.me"} next time. You do not need this link again.`;
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
			const name = row.role === "sales" ? "Sales" : row.role === "service" ? "Service" : row.role === "warehouse" ? "Warehouse" : "";
			toast.success(name ? `${row.username} is ${name}` : `${row.username} has no role yet`);
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
	const resend = useMutation({
		mutationFn: (id) => resendInvite({ data: { id } }),
		onSuccess: (inv) => {
			toast.success(`New link for ${inv.displayName || inv.username || inv.email || "them"}. Copy invite and send it.`);
			qc.invalidateQueries({ queryKey: ["access"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not resend")
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
	const needsRole = active.filter((a) => !a.isAdmin && !a.role);
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
				children: ["Save an invite, then send them the link. Opening that link lets them in — Google, X, or a new password. They do not wait for a second approval.", canAssignRoles ? " Assign Sales, Service, or Warehouse to other people. Your admin login does not need a role. Only you can set Warehouse. New invites land on Service unless you pick another role." : ""]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 max-w-xl rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground",
				children: "If someone sees “katzdesk.grok.me is private”, Grok has not shared the published site with them yet. Desk invites cannot open that lock. In Grok, set this app to Public, or share it with their Grok account. That does not require a rebuild."
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
							placeholder: "optional, e.g. Pedro Jr",
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
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
					className: "text-xs tracking-wide text-muted-foreground uppercase",
					children: [
						"Invites (",
						pendingInvites.length,
						")"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted-foreground",
					children: "Invited means the link still works. Expired means resend. After they sign in they show as Active below and can use the main KatzDesk URL."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "mt-2 overflow-hidden rounded-xl border border-border bg-card",
					children: [pendingInvites.map((inv) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InviteRow, {
						inv,
						origin,
						onRevoke: () => revoke.mutate(inv.id),
						revoking: revoke.isPending,
						onResend: () => resend.mutate(inv.id),
						resending: resend.isPending
					}, inv.id)), pendingInvites.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "px-4 py-6 text-sm text-muted-foreground",
						children: "No pending invites."
					}) : null]
				})
			]
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
					children: "Existing logins stay unassigned until you pick Sales, Service, or Warehouse. Admins do not need a role."
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
									children: "admin · Active"
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ml-2 text-xs text-muted-foreground",
									children: "Active"
								}),
								canAssignRoles && a.role && !a.isAdmin ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ml-2 text-xs text-muted-foreground",
									children: a.role
								}) : canAssignRoles && !a.role && !a.isAdmin ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
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
						children: [canAssignRoles && !a.isAdmin ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RolePicker, {
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
		className: "h-9 w-40",
		value: value ?? "",
		disabled,
		onChange: (e) => {
			const v = e.target.value;
			onChange(v === "sales" || v === "service" || v === "warehouse" ? v : null);
		},
		allowEmpty: true,
		emptyLabel: "Needs role",
		"aria-label": "Role",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
				value: "sales",
				children: "Sales"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
				value: "service",
				children: "Service"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
				value: "warehouse",
				children: "Warehouse"
			})
		]
	});
}
function InviteRow({ inv, origin, onRevoke, revoking, onResend, resending }) {
	const body = inviteBody(inv, origin);
	const mailto = inv.email ? `mailto:${encodeURIComponent(inv.email)}?subject=${encodeURIComponent("You're invited to Katz Desk")}&body=${encodeURIComponent(body)}` : null;
	const label = inv.state === "expired" ? "Expired" : "Invited";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
		className: "flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "min-w-0",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "font-medium",
				children: [inv.displayName || inv.username || inv.email || "Invite", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: `ml-2 text-xs ${inv.state === "expired" ? "text-warning" : "text-muted-foreground"}`,
					children: label
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "truncate text-sm text-muted-foreground",
				children: [
					[inv.email, inv.username ? `@${inv.username}` : null].filter(Boolean).join(" · ") || "No email",
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
					disabled: resending,
					onClick: onResend,
					children: "Resend invite"
				}),
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
var fileInput$1 = object({
	filename: string(),
	base64: string().min(8)
});
var previewAccountEquipImport = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => fileInput$1.parse(d)).handler(createSsrRpc("1192b411cbac542b1a78b65c18f38dc71612d7e014585e7842015736911393dd"));
var applyRow$1 = object({
	key: string(),
	fileCustomer: string(),
	customer: string().nullable(),
	customerId: number().nullable().optional(),
	customerStatus: _enum([
		"matched",
		"walk-in",
		"unmatched",
		"ambiguous"
	]).optional(),
	equipmentName: string(),
	fileModel: string().optional(),
	catalogModel: string().nullable(),
	addCatalog: boolean().optional(),
	modelStatus: _enum([
		"matched",
		"unmatched",
		"ambiguous"
	]).optional(),
	modelCandidates: array(string()).optional(),
	serial: string().nullable(),
	installDate: string().nullable(),
	electrical: string().nullable().optional(),
	ownership: string().nullable(),
	ownershipRaw: string().optional(),
	action: _enum([
		"add",
		"update",
		"review",
		"skip"
	]),
	existingId: number().nullable().optional(),
	foreignAccount: string().nullable().optional(),
	reviewReasons: array(string()).optional()
});
var applyInput$1 = object({ rows: array(applyRow$1) });
var applyAccountEquipImport = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => applyInput$1.parse(d)).handler(createSsrRpc("a25b8ed80544e5f6ef47139dac789bdcbce30de91833be149a93e28a551ace8d"));
var listInput = object({ customer: string().optional() });
var listAccountEquipment = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => listInput.parse(d ?? {})).handler(createSsrRpc("280698ca3a37048a952a0a60c6de4360d08267057edc403a8ffe38aee977b028"));
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
var fieldClass = "flex min-h-11 w-full min-w-0 items-center gap-2 rounded-full border border-input bg-background px-3 text-left text-sm focus-within:ring-2 focus-within:ring-ring";
var searchClass = "flex min-h-11 w-full min-w-0 items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-sm focus-within:ring-2 focus-within:ring-ring";
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
function Menu$1({ children, notFound, notFoundText, inFlow }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		"data-combo-popover": "",
		className: cn("z-50 w-full overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-soft", inFlow ? "relative mt-1" : "absolute mt-1"),
		children: [notFound ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "px-2 py-1.5 text-xs text-muted-foreground",
			children: notFoundText
		}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "max-h-56 overflow-y-auto py-1",
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
function ComboField({ label, name, value, onChange, items, placeholder = "Search…", required, disabled, allowCreate = true, onCreate, onRemoveItem, onRenameItem, noun = "name", emptyHint = "No matches.", menuInFlow }) {
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
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0",
		children: [
			label ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: label }) : null,
			name ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				type: "hidden",
				name,
				value,
				required
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				ref: rootRef,
				className: cn("relative min-w-0", label ? "mt-1" : "mt-0"),
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
				}), open ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Menu$1, {
					inFlow: menuInFlow,
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
								className: "flex min-w-0 items-center",
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
		]
	});
}
function MultiComboField({ label, name, values, onChange, items, placeholder = "Add…", allowCreate = true, onCreate, onRemoveItem, onRenameItem, noun = "name", menuInFlow }) {
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
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0",
		children: [
			label ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: label }) : null,
			name ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				type: "hidden",
				name,
				value: values.join("\n")
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: cn("min-w-0 space-y-2", label ? "mt-1.5" : "mt-0"),
				children: [values.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "flex min-h-8 min-w-0 flex-wrap content-start gap-2",
					"data-equip-chips": "",
					children: values.map((v, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						title: v,
						className: "flex h-8 max-w-full shrink-0 items-center gap-1 overflow-hidden rounded-full bg-secondary pl-2.5 pr-0.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "min-w-0 truncate text-sm leading-none text-foreground",
							children: v
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground",
							"aria-label": `Remove ${v}`,
							onMouseDown: (e) => {
								e.preventDefault();
								e.stopPropagation();
								onChange(values.filter((_, j) => j !== i));
							},
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" })
						})]
					}, `${v}-${i}`))
				}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					ref: rootRef,
					className: "relative min-w-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: searchClass,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: open ? q : "",
							placeholder: values.length ? "Add another…" : placeholder,
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
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronsUpDown, { className: "size-4 shrink-0 text-muted-foreground" })]
					}), open ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Menu$1, {
						inFlow: menuInFlow,
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
									className: "flex min-w-0 items-center",
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
												className: "ml-auto shrink-0 pl-2 text-[11px] text-muted-foreground",
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
				})]
			})
		]
	});
}
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
function LockedCustomer({ name, label = "Customer", inputName = "customer" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0",
		"data-testid": "locked-customer",
		children: [
			label ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: label }) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 rounded-md border border-input bg-muted/50 px-3 py-2 text-sm",
				children: name || "—"
			}),
			inputName ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				type: "hidden",
				name: inputName,
				value: name
			}) : null
		]
	});
}
function CustomerCombo({ label = "Customer", name, value, onChange, required, placeholder = "Search customers…", allowCreate: allowCreateProp, menuInFlow }) {
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
		menuInFlow,
		emptyHint: allowCreate ? "No customer matches — use + to add one." : "No customer matches. Pick an account already on the list."
	}), renameUi.dialog] });
}
function EquipmentCombo({ label = "Equipment", name, value, onChange, required, placeholder = "Search equipment…", menuInFlow }) {
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
		menuInFlow,
		emptyHint: "No equipment matches — use + to add a model."
	}), renameUi.dialog] });
}
function EquipmentMultiCombo({ label = "Equipment", name = "equipment", values, onChange, placeholder = "Search equipment…", menuInFlow }) {
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
		noun: "equipment",
		menuInFlow
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
var listBarnAvailable = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(createSsrRpc("571fac36bc18acec68c60cff2be5821a9a1e35ff8e235b891419be6bf272213f"));
var placeIdsInput = object({
	ids: array(number().int().positive()).min(1),
	site: string(),
	otherLabel: string().nullable().optional()
});
var placeAssetsAtLocation = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => placeIdsInput.parse(d)).handler(createSsrRpc("536e7b9decc803b49351d2954119f89c08eef35743c6f3d4736a487c9fdc519b"));
var addInput = object({
	site: string(),
	model: string().min(1),
	serial: string().nullable().optional(),
	electrical: string().nullable().optional(),
	otherLabel: string().nullable().optional()
});
var addUnitToLocation = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => addInput.parse(d)).handler(createSsrRpc("48eb40870b815944061c950459cff57ae73cf005608d9f5407b0d6c358a44e06"));
var barnInput = object({
	id: number().int().positive(),
	pallet: string().min(1),
	level: number().int()
});
createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => barnInput.parse(d)).handler(createSsrRpc("0eb120547d7147cfacb70cc0bcc4463a916dcf139e3559e0108dacbfad17c4f9"));
var lookupInput = object({ serial: string() });
var lookupUnitPlace = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => lookupInput.parse(d)).handler(createSsrRpc("c854c5e5b43313a3bb44ed47820775f74bd7c3c6bd1b5628eec146f2f3de3007"));
var setInput = object({
	serial: string().min(1),
	model: string().nullable().optional(),
	site: string(),
	pallet: string().nullable().optional(),
	level: number().int().nullable().optional(),
	otherLabel: string().nullable().optional()
});
var setUnitPlace = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => setInput.parse(d)).handler(createSsrRpc("e22ae01e87029011ee5e5e0575fd8972f4c4e2713dcb711e0ae981b0d3748276"));
var assetPlaceInput = object({
	id: number().int().positive(),
	site: string(),
	pallet: string().nullable().optional(),
	level: number().int().nullable().optional(),
	otherLabel: string().nullable().optional()
});
var setAssetPlace = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => assetPlaceInput.parse(d)).handler(createSsrRpc("423a323a5f7059e99afbe6a138fa5d75c7b349d28d8eb9eb974b9dae76a221ee"));
var emptyPlaceDraft = () => ({
	site: "",
	pallet: "",
	level: "",
	otherLabel: ""
});
function PlacePicker({ value, onChange, testId = "unit-place" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		"data-testid": testId,
		className: "flex flex-wrap items-end gap-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
				"aria-label": "Location",
				className: "min-w-40",
				value: value.site,
				onChange: (e) => onChange({
					site: e.target.value,
					pallet: "",
					level: "",
					otherLabel: ""
				}),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: "",
					children: "Location"
				}), PLACE_CHOICES.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: c.value,
					children: c.label
				}, c.value))]
			}),
			value.site === "barn" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
				"aria-label": "Barn bay",
				"data-testid": "unit-place-bay",
				className: "w-24",
				value: value.pallet,
				onChange: (e) => onChange({
					...value,
					pallet: e.target.value
				}),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: "",
					children: "Bay"
				}), BACK_PALLETS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: p,
					children: p
				}, p))]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
				"aria-label": "Barn level",
				"data-testid": "unit-place-level",
				className: "w-28",
				value: value.level,
				onChange: (e) => onChange({
					...value,
					level: e.target.value
				}),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: "",
					children: "Level"
				}), LEVELS.map((level) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
					value: String(level),
					children: [
						"L",
						level,
						level === 4 ? " top" : level === 1 ? " floor" : ""
					]
				}, level))]
			})] }) : null,
			value.site === "other" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				"aria-label": "Other location",
				"data-testid": "unit-place-other",
				className: "max-w-48",
				value: value.otherLabel,
				placeholder: "showroom, parts cage…",
				onChange: (e) => onChange({
					...value,
					otherLabel: e.target.value
				})
			}) : null
		]
	});
}
function UnitPlaceField({ serial, model, assetId, draft, onDraft }) {
	const qc = useQueryClient();
	const key = serialKey(serial ?? "");
	const lookup = useQuery({
		queryKey: ["unit-place", key],
		queryFn: () => lookupUnitPlace({ data: { serial: serial ?? "" } }),
		enabled: !!key
	});
	const [local, setLocal] = (0, import_react.useState)(emptyPlaceDraft());
	const value = draft ?? local;
	function setValue(next) {
		if (onDraft) onDraft(next);
		else setLocal(next);
	}
	const save = useMutation({
		mutationFn: () => {
			const err = placeDraftError(value);
			if (err) throw new Error(err);
			if (assetId) return setAssetPlace({ data: {
				id: assetId,
				site: value.site,
				pallet: value.pallet || null,
				level: value.level ? Number(value.level) : null,
				otherLabel: value.otherLabel || null
			} });
			return setUnitPlace({ data: {
				serial: serial ?? "",
				model: model ?? null,
				site: value.site,
				pallet: value.site === "barn" ? value.pallet : null,
				level: value.site === "barn" && value.level ? Number(value.level) : null,
				otherLabel: value.site === "other" ? value.otherLabel : null
			} });
		},
		onSuccess: (place) => {
			toast.success(place.place ? `Place set · ${place.place}` : "Place set");
			setValue(emptyPlaceDraft());
			qc.invalidateQueries({ queryKey: ["unit-place"] });
			qc.invalidateQueries({ queryKey: ["assets"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not set location")
	});
	const bound = !!onDraft;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Location" }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 text-xs text-muted-foreground",
			"data-testid": "unit-place-current",
			children: assetId && !key ? "Set where this unit sits" : key ? lookup.data?.place ? `Now: ${lookup.data.place}` : lookup.isLoading ? "Checking…" : "Not in the barn or on a location yet" : "Enter a serial to set one location for this unit"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-2 flex flex-wrap items-end gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlacePicker, {
				value,
				onChange: setValue
			}), bound ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				type: "button",
				size: "sm",
				variant: "outline",
				disabled: !!placeDraftError(value) || !key && !assetId || save.isPending,
				onClick: () => save.mutate(),
				children: save.isPending ? "Saving…" : "Set location"
			})]
		})
	] });
}
function InspectionBadge({ overall, passed, total, className }) {
	const label = overall ?? "Not started";
	const count = total && total > 0 ? ` ${passed ?? 0}/${total}` : "";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
		variant: label === "Passed" ? "success" : label === "Failed" ? "danger" : label === "In progress" ? "warn" : "outline",
		size: "tight",
		className,
		"data-testid": "inspection-badge",
		children: [
			"Pre-inspection ",
			label,
			count
		]
	});
}
function fileToDataUrl(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(/* @__PURE__ */ new Error("Could not read that photo"));
		reader.onload = () => {
			const raw = String(reader.result ?? "");
			const img = new Image();
			img.onload = () => {
				const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
				const w = Math.max(1, Math.round(img.width * scale));
				const h = Math.max(1, Math.round(img.height * scale));
				const canvas = document.createElement("canvas");
				canvas.width = w;
				canvas.height = h;
				const ctx = canvas.getContext("2d");
				if (!ctx) {
					resolve(raw);
					return;
				}
				ctx.drawImage(img, 0, 0, w, h);
				resolve(canvas.toDataURL("image/jpeg", .72));
			};
			img.onerror = () => resolve(raw);
			img.src = raw;
		};
		reader.readAsDataURL(file);
	});
}
function PreInspectionPanel({ installId }) {
	const qc = useQueryClient();
	const q = useQuery({
		queryKey: ["inspection", installId],
		queryFn: () => getInstallInspection({ data: { installId } })
	});
	const [equipmentId, setEquipmentId] = (0, import_react.useState)(null);
	function refresh(view) {
		if (view) qc.setQueryData(["inspection", installId], view);
		qc.invalidateQueries({ queryKey: ["inspection", installId] });
		qc.invalidateQueries({ queryKey: ["installs"] });
		qc.invalidateQueries({ queryKey: ["dashboard"] });
		qc.invalidateQueries({ queryKey: ["customer-history"] });
		qc.invalidateQueries({ queryKey: ["account-equipment"] });
	}
	if (q.isLoading) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "px-4 py-4 text-sm text-muted-foreground",
		children: "Loading machines…"
	});
	if (q.isError || !q.data) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "px-4 py-4 text-sm text-destructive",
		children: q.error instanceof Error ? q.error.message : "Could not load pre-inspection."
	});
	const view = q.data;
	const machine = view.machines.find((m) => m.equipmentId === equipmentId) ?? null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		"data-testid": "pre-inspection",
		className: "relative",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "sticky top-0 z-10 border-b border-border bg-card px-4 py-3 text-base font-medium",
			"data-testid": "machine-progress",
			children: [view.machineCount ? `${view.passedCount}/${view.machineCount}` : "0/0", " machines passed"]
		}), machine ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MachineDetail, {
			view,
			machine,
			onBack: () => setEquipmentId(null),
			onNext: () => {
				const i = view.machines.findIndex((m) => m.equipmentId === machine.equipmentId);
				const next = view.machines[i + 1];
				setEquipmentId(next ? next.equipmentId : null);
			},
			onSaved: refresh
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MachineList, {
			view,
			onOpen: setEquipmentId,
			onSaved: refresh
		})]
	});
}
function MachineList({ view, onOpen, onSaved }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		"data-testid": "machine-list",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-2 px-4 pt-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-xs tracking-wide text-muted-foreground uppercase",
					children: "Which machine?"
				}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InspectionBadge, {
					overall: view.overall,
					passed: view.passedCount,
					total: view.machineCount
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-4 pt-1 text-xs text-muted-foreground",
				children: "Pick the unit you are standing in front of. The others stay untouched."
			}),
			view.machines.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 divide-y divide-border border-y border-border",
				children: view.machines.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					"data-testid": `inspect-machine-${m.equipmentId}`,
					onClick: () => onOpen(m.equipmentId),
					className: "flex min-h-[4.5rem] w-full items-center gap-3 px-4 py-4 text-left active:bg-muted",
					children: [
						m.thumb ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: m.thumb,
							alt: "",
							className: "size-12 shrink-0 rounded-md object-cover"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "flex size-12 shrink-0 items-center justify-center rounded-md bg-secondary text-[10px] text-muted-foreground",
							children: "No photo"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block truncate text-base font-medium",
								children: m.name
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block truncate text-xs text-muted-foreground",
								children: [m.serial ? `SN ${m.serial}` : "No serial", m.electrical || "Electrical missing"].join(" · ")
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InspectionBadge, { overall: m.overall })
					]
				}) }, m.equipmentId))
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-4 py-3 text-sm text-muted-foreground",
				children: "Add the unit at the site, then inspect only that one."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AddMachine, {
				installId: view.installId,
				onSaved
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MetaForm, {
				view,
				onSaved
			})
		]
	});
}
function AddMachine({ installId, onSaved }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	const [model, setModel] = (0, import_react.useState)("");
	const [serial, setSerial] = (0, import_react.useState)("");
	const [electrical, setElectrical] = (0, import_react.useState)("");
	const add = useMutation({
		mutationFn: () => addInspectionEquipment({ data: {
			installId,
			model,
			serial: serial || null,
			electrical: electrical || null
		} }),
		onSuccess: (view) => {
			toast.success("Equipment added");
			setModel("");
			setSerial("");
			setElectrical("");
			setOpen(false);
			onSaved(view);
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add equipment")
	});
	if (!open) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "px-4 py-3",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			type: "button",
			size: "sm",
			variant: "outline",
			"data-testid": "add-inspection-equipment",
			onClick: () => setOpen(true),
			children: "Add equipment"
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
		className: "grid gap-2 border-t border-border px-4 py-3",
		"data-testid": "add-equipment-form",
		onSubmit: (e) => {
			e.preventDefault();
			if (!model.trim()) {
				toast.error("Pick a model");
				return;
			}
			add.mutate();
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EquipmentCombo, {
				label: "Model",
				value: model,
				onChange: setModel,
				menuInFlow: true,
				required: true
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-2 sm:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					htmlFor: `sn-${installId}`,
					children: "Serial"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					id: `sn-${installId}`,
					className: "mt-1",
					value: serial,
					onChange: (e) => setSerial(e.target.value),
					"data-testid": "add-equipment-serial"
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					htmlFor: `el-${installId}`,
					children: "Electrical"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					id: `el-${installId}`,
					className: "mt-1",
					value: electrical,
					onChange: (e) => setElectrical(e.target.value),
					placeholder: "120V or 220V",
					"data-testid": "add-equipment-electrical"
				})] })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(UnitPlaceField, {
				serial,
				model
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "submit",
					size: "sm",
					disabled: add.isPending,
					"data-testid": "add-equipment-save",
					children: add.isPending ? "Adding…" : "Add to this visit"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					size: "sm",
					variant: "outline",
					onClick: () => setOpen(false),
					children: "Cancel"
				})]
			})
		]
	});
}
function MetaForm({ view, onSaved }) {
	const [inspector, setInspector] = (0, import_react.useState)(view.inspector ?? "");
	const [inspectedOn, setInspectedOn] = (0, import_react.useState)(view.inspectedOn ?? "");
	const [siteContact, setSiteContact] = (0, import_react.useState)(view.siteContact ?? "");
	const [notes, setNotes] = (0, import_react.useState)(view.notes ?? "");
	const [overrideReason, setOverrideReason] = (0, import_react.useState)(view.overrideReason ?? "");
	const save = useMutation({
		mutationFn: () => saveInspectionMeta({ data: {
			installId: view.installId,
			inspector,
			inspectedOn: inspectedOn || null,
			siteContact,
			notes,
			overrideReason
		} }),
		onSuccess: (next) => {
			toast.success("Site notes saved");
			onSaved(next);
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
		className: "grid gap-3 border-t border-border px-4 py-3 sm:grid-cols-2",
		onSubmit: (e) => {
			e.preventDefault();
			save.mutate();
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
				htmlFor: `insp-${view.installId}`,
				children: "Inspector"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				id: `insp-${view.installId}`,
				className: "mt-1",
				value: inspector,
				onChange: (e) => setInspector(e.target.value)
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
				htmlFor: `insp-date-${view.installId}`,
				children: "Inspection date"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				id: `insp-date-${view.installId}`,
				type: "date",
				className: "mt-1",
				value: inspectedOn,
				onChange: (e) => setInspectedOn(e.target.value)
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "sm:col-span-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					htmlFor: `insp-contact-${view.installId}`,
					children: "Site contact"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					id: `insp-contact-${view.installId}`,
					className: "mt-1",
					value: siteContact,
					onChange: (e) => setSiteContact(e.target.value)
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "sm:col-span-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					htmlFor: `insp-notes-${view.installId}`,
					children: "Overall notes / blockers"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
					id: `insp-notes-${view.installId}`,
					className: "mt-1",
					value: notes,
					onChange: (e) => setNotes(e.target.value)
				})]
			}),
			view.overall !== "Passed" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "sm:col-span-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					htmlFor: `insp-over-${view.installId}`,
					children: "Override reason"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					id: `insp-over-${view.installId}`,
					className: "mt-1",
					value: overrideReason,
					onChange: (e) => setOverrideReason(e.target.value),
					placeholder: "Required only to mark installed before every machine passes"
				})]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "sm:col-span-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "submit",
					size: "sm",
					variant: "outline",
					disabled: save.isPending,
					children: save.isPending ? "Saving…" : "Save site notes"
				})
			})
		]
	});
}
function MachineDetail({ view, machine, onBack, onNext, onSaved }) {
	const sources = view.machines.filter((m) => m.equipmentId !== machine.equipmentId && m.items.some((i) => i.status === "N/A"));
	const copy = useMutation({
		mutationFn: (fromEquipmentId) => copyInspectionNa({ data: {
			installId: view.installId,
			fromEquipmentId,
			toEquipmentId: machine.equipmentId
		} }),
		onSuccess: (next) => {
			toast.success("Copied N/A notes");
			onSaved(next);
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not copy")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		"data-testid": "machine-detail",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start gap-2 px-3 pt-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						type: "button",
						size: "sm",
						variant: "outline",
						onClick: onBack,
						"data-testid": "inspection-back",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "size-4" }), "Machines"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "truncate font-medium",
							children: machine.name
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "truncate text-xs text-muted-foreground",
							children: [machine.serial ? `SN ${machine.serial}` : "No serial", machine.electrical || "Electrical missing"].join(" · ")
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InspectionBadge, { overall: machine.overall })
				]
			}),
			sources.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-wrap gap-2 px-4 pt-3",
				children: sources.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					type: "button",
					size: "sm",
					variant: "outline",
					disabled: copy.isPending,
					onClick: () => copy.mutate(m.equipmentId),
					children: ["Same as ", m.name]
				}, m.equipmentId))
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-3 px-3 py-3 pb-24",
				children: machine.items.map((item) => item.category === "space" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SpaceSection, {
					view,
					machine,
					item,
					onSaved
				}, `${machine.equipmentId}-space`) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ItemRow, {
					installId: view.installId,
					equipmentId: machine.equipmentId,
					item,
					onSaved
				}, `${machine.equipmentId}-${item.category}`))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "sticky bottom-0 z-10 flex gap-2 border-t border-border bg-card px-3 py-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					className: "h-12 flex-1 text-base",
					onClick: () => toast.success("Saved"),
					children: "Save"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					className: "h-12 flex-1 text-base",
					variant: "outline",
					onClick: onNext,
					"data-testid": "inspection-next",
					children: "Next machine"
				})]
			})
		]
	});
}
function SpaceSection({ view, machine, item, onSaved }) {
	const [spaceStatus, setSpaceStatus] = (0, import_react.useState)(item.status);
	const show = showCoreHoleQuestion(spaceStatus, machine.coreNeeded);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3",
		"data-testid": "space-core-section",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ItemRow, {
				installId: view.installId,
				equipmentId: machine.equipmentId,
				item,
				coreNeeded: machine.coreNeeded,
				onStatusChange: setSpaceStatus,
				onSaved
			}),
			show ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CoreHoleQuestion, {
				installId: view.installId,
				equipmentId: machine.equipmentId,
				answer: machine.coreNeeded,
				onSaved
			}, `${machine.equipmentId}-${machine.coreNeeded ?? "unset"}`) : null,
			show && machine.coreNeeded === "yes" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ItemRow, {
				installId: view.installId,
				equipmentId: machine.equipmentId,
				item: machine.core,
				onSaved
			}, `${machine.equipmentId}-core`) : null
		]
	});
}
function CoreHoleQuestion({ installId, equipmentId, answer, onSaved }) {
	const [picked, setPicked] = (0, import_react.useState)(answer);
	const save = useMutation({
		mutationFn: (next) => saveInspectionCoreHole({ data: {
			installId,
			equipmentId,
			answer: next
		} }),
		onSuccess: (view) => onSaved(view),
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save")
	});
	(0, import_react.useEffect)(() => {
		setPicked(answer);
	}, [answer]);
	function choose(next) {
		setPicked(next);
		if (next !== answer) save.mutate(next);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg border border-border p-3",
		"data-testid": "core-hole-question",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "font-medium",
			children: CORE_HOLE_QUESTION
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-3 grid grid-cols-2 gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				type: "button",
				"data-testid": "core-hole-yes",
				variant: picked === "yes" ? "default" : "outline",
				className: "h-14 text-base",
				"aria-pressed": picked === "yes",
				disabled: save.isPending,
				onClick: () => choose("yes"),
				children: "Yes"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				type: "button",
				"data-testid": "core-hole-no",
				variant: picked === "no" ? "default" : "outline",
				className: "h-14 text-base",
				"aria-pressed": picked === "no",
				disabled: save.isPending,
				onClick: () => choose("no"),
				children: "No"
			})]
		})]
	});
}
function ItemRow({ installId, equipmentId, item, onSaved, coreNeeded, onStatusChange }) {
	const [status, setStatus] = (0, import_react.useState)(item.status);
	const [notes, setNotes] = (0, import_react.useState)(item.notes ?? "");
	const [error, setError] = (0, import_react.useState)(null);
	const [caption, setCaption] = (0, import_react.useState)("");
	const [uploading, setUploading] = (0, import_react.useState)(false);
	const coreRef = (0, import_react.useRef)(coreNeeded);
	const save = useMutation({
		mutationFn: (next) => saveInspectionItem({ data: {
			installId,
			equipmentId,
			category: item.category,
			status: next.status,
			notes: next.notes
		} }),
		onSuccess: (view) => onSaved(view),
		onError: (e) => {
			const message = e instanceof Error ? e.message : "Could not save";
			setError(message);
		}
	});
	function check(nextStatus, nextNotes, photoCount) {
		if (coreNeeded !== void 0) return spacePassError({
			status: nextStatus,
			notes: nextNotes,
			photoCount,
			coreNeeded
		});
		return itemSaveError({
			status: nextStatus,
			notes: nextNotes,
			photoCount
		});
	}
	function persist(nextStatus, nextNotes, photoCount = item.photos.length) {
		const err = check(nextStatus, nextNotes, photoCount);
		if (err) {
			setError(err);
			return;
		}
		setError(null);
		if (nextStatus === item.status && nextNotes.trim() === (item.notes ?? "").trim()) return;
		save.mutate({
			status: nextStatus,
			notes: nextNotes
		});
	}
	(0, import_react.useEffect)(() => {
		const prev = coreRef.current;
		coreRef.current = coreNeeded;
		if (prev === coreNeeded) return;
		if (coreNeeded !== "yes" && coreNeeded !== "no") return;
		if (status !== "Pass" || item.status === "Pass") return;
		persist(status, notes);
	}, [coreNeeded]);
	const remove = useMutation({
		mutationFn: (photoId) => removeInspectionPhoto({ data: {
			installId,
			photoId
		} }),
		onSuccess: (view) => onSaved(view),
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove photo")
	});
	async function upload(file) {
		if (!file) return;
		setUploading(true);
		try {
			const dataUrl = await fileToDataUrl(file);
			const view = await addInspectionPhoto({ data: {
				installId,
				equipmentId,
				category: item.category,
				dataUrl,
				caption: caption || null
			} });
			setCaption("");
			onSaved(view);
			const updated = view.machines.find((m) => m.equipmentId === equipmentId)?.items.find((row) => row.category === item.category);
			if (status === "Pass" || status === "Fail") persist(status, notes, updated?.photos.length ?? item.photos.length + 1);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Could not upload");
		} finally {
			setUploading(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg border border-border p-3",
		"data-testid": `inspect-${item.category}`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-baseline justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-medium",
					children: item.label
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-[11px] text-muted-foreground",
					children: [
						item.photos.length,
						" photo",
						item.photos.length === 1 ? "" : "s"
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-0.5 text-xs text-muted-foreground",
				children: item.hint
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 grid gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					role: "group",
					"aria-label": `${item.label} status`,
					"data-testid": `inspect-status-${item.category}`,
					className: "flex flex-wrap gap-1.5",
					children: INSPECTION_ITEM_STATUSES.map((s) => {
						const on = status === s;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							"aria-pressed": on,
							"data-testid": `inspect-choice-${item.category}-${s}`,
							className: cn("h-8 rounded-full px-2.5 text-xs font-medium", on ? "bg-ink text-ink-foreground" : "bg-secondary text-foreground"),
							onClick: () => {
								setStatus(s);
								onStatusChange?.(s);
								persist(s, notes);
							},
							children: s
						}, s);
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
					"aria-label": `${item.label} notes`,
					value: notes,
					onChange: (e) => setNotes(e.target.value),
					onBlur: () => persist(status, notes),
					placeholder: status === "N/A" ? "Why N/A — e.g. no drain on this grinder" : "Notes",
					className: "min-h-24 text-base"
				})]
			}),
			error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-destructive",
				children: error
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 grid gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "flex h-14 cursor-pointer items-center justify-center rounded-md bg-primary text-base font-medium text-primary-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "file",
						accept: "image/*",
						capture: "environment",
						className: "sr-only",
						"data-testid": `inspect-photo-${item.category}`,
						disabled: uploading,
						onChange: (e) => {
							upload(e.target.files?.[0]);
							e.target.value = "";
						}
					}), uploading ? "Uploading…" : "Add photo"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "flex h-12 cursor-pointer items-center justify-center rounded-md border border-border text-base font-medium",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "file",
						accept: "image/*",
						className: "sr-only",
						disabled: uploading,
						onChange: (e) => {
							upload(e.target.files?.[0]);
							e.target.value = "";
						}
					}), "Library"]
				})]
			}),
			item.photos.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3",
				children: item.photos.map((photo) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PhotoTile, {
					photo,
					pending: remove.isPending,
					onRemove: () => remove.mutate(photo.id)
				}, photo.id))
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-[11px] text-muted-foreground",
				children: "Pass or Fail needs a photo of this machine."
			})
		]
	});
}
function PhotoTile({ photo, onRemove, pending }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
		className: "overflow-hidden rounded-md border border-border",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
			src: photo.dataUrl,
			alt: photo.caption || photo.category,
			className: "h-24 w-full object-cover"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-start justify-between gap-1 px-2 py-1.5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "min-w-0 text-[11px] text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "block truncate text-foreground",
					children: photo.caption || "Photo"
				}), [photo.uploadedBy, formatPingTime(photo.uploadedAt)].filter(Boolean).join(" · ")]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "shrink-0 text-muted-foreground hover:text-foreground",
				"aria-label": "Remove photo",
				disabled: pending,
				onClick: onRemove,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" })
			})]
		})]
	});
}
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
var listNetwork = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(createSsrRpc("0e70cec8a743027415d0460951e6e2bb501309027c1759c4c98cfd78df7764d5"));
var getProvider = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("6e67d51c0c64562bbed03eea6fbb1e7c689b83ef33496797ea9f1a8a23c70aa9"));
var upsertProvider = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("f62afaeae21ab0e89d7d27769b2f5064cb3e75f64a9ea65009068831d0434921"));
var renameProvider = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("5272252cb350fffbd8b8d56c4ef404ee93249ca615f69b19500c65e08ca968d3"));
var addProviderLocation = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("7d30dfaa7a40d51c27cd0ce998e25cfeded40af2ff16826301ad1363906ce978"));
var removeProviderLocation = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("d542ae756f2e6694dce801180f201b4d169c51d7a4538e3133a8696e2e25728c"));
var addProviderContact = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("f2825516656623b695881938cec0b6cf9876e9c7c29a937a8cdcbfa5be64c879"));
var removeProviderContact = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("a534ea58c5fe888eb5efb486c3893ae8da4fdc6fa69c93aee3dab0efe6f088fa"));
var addProviderAddress = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("382dd0efa33ba73974579c8835f506ae0d04e33a2a6b5c2df3a7598f86087361"));
var removeProviderAddress = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("91a2ebe1261556f11fcc6a931cb07fb974490d2efb9a57f84f4b4edd6b44fd73"));
var archiveProvider = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("471944d55e1c65b4213049ee898d032a581f48ae35180995f970ee884a74ec4a"));
var getCustomerProviders = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("683ce4e118843b9882fa4d3ef4aae93e7c9911c090294ea307f851a3f443ba3b"));
var assignCustomerProvider = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("2808eee236ac8a01d9b5df827bec7737d82a7b482025f6f1765ce51c74d36ecf"));
var unassignCustomerProvider = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("459028e7e9941b4f9e5d3cb9f2219c189d90cc6b094ae31d8cfcbce57606b7ed"));
var setProviderRole = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("e1f6b5e1ee21f932bd78b1ddbf8e596c45e7296aac8591d390fcd0ce141b2d8c"));
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
function useRoster() {
	return useQuery({
		queryKey: ["roster"],
		queryFn: () => listTechs(),
		staleTime: 3e4
	});
}
function activeTechNames(techs) {
	if (techs?.length) return techs.filter((t) => t.active).map((t) => t.name);
	return [...DEFAULT_TECHS];
}
function TechName({ name }) {
	const roster = useRoster();
	if (!name) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: "—" });
	const match = activeTechNames(roster.data?.techs).find((n) => sameTech(n, name));
	if (match) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: match });
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
	const mapped = active.find((n) => sameTech(n, current)) ?? current;
	const extras = current && !active.some((n) => sameTech(n, current)) ? [current] : [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
		id,
		name,
		className: className ?? "mt-1",
		defaultValue: value == null ? mapped : void 0,
		value: value == null ? void 0 : mapped,
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
	const leftover = [];
	for (const raw of extraNames ?? []) {
		const n = (raw ?? "").trim();
		if (!n) continue;
		if (active.some((a) => sameTech(a, n)) || leftover.some((a) => sameTech(a, n))) continue;
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
function JobSheet({ id, onClose, lockCustomer = false }) {
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
				className: "mt-2 flex min-h-8 flex-wrap items-center gap-1.5",
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
						recordKey: j.id,
						locked: lockCustomer
					}),
					j.customer ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "sm:col-span-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProviderDispatchBlock, { customer: j.customer })
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "sm:col-span-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BoundEquipment$1, {
							defaultValue: j.equipment ?? "",
							recordKey: j.id
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SerialPullField, {
								label: "Serial number",
								value: pulledSerial,
								jobId: j.id,
								onValue: () => {}
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-muted-foreground",
								children: "Type a warehouse serial to pull that unit onto this ticket without opening Warehouse."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-3",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UnitPlaceField, {
									serial: pulledSerial,
									model: j.equipment
								})
							})
						]
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
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "sm:col-span-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase",
							children: "Assignment"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Technician" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TechSelect, {
						name: "technician",
						defaultValue: j.technician ?? ""
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Status" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "status",
						className: "mt-1",
						defaultValue: j.status,
						children: CALL_STATUSES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
						label: "Scheduled",
						name: "scheduled",
						type: "date",
						defaultValue: j.scheduled ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Type" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "callType",
						className: "mt-1",
						defaultValue: j.callType ?? "",
						allowEmpty: true,
						children: CALL_TYPES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
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
						label: "Contact",
						name: "contact",
						defaultValue: j.contact ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
						label: "Phone",
						name: "phone",
						defaultValue: j.phone ?? ""
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
function NewJobDialog({ kind, open, onOpenChange, onCreated, lockedCustomer }) {
	const qc = useQueryClient();
	const [customer, setCustomer] = (0, import_react.useState)(lockedCustomer ?? "");
	const [issue, setIssue] = (0, import_react.useState)("");
	const [equipment, setEquipment] = (0, import_react.useState)([]);
	const [urgency, setUrgency] = (0, import_react.useState)("Normal");
	const [technician, setTechnician] = (0, import_react.useState)("");
	const account = lockedCustomer || customer;
	(0, import_react.useEffect)(() => {
		if (open && lockedCustomer) setCustomer(lockedCustomer);
	}, [open, lockedCustomer]);
	const create = useMutation({
		mutationFn: () => createJob({ data: {
			kind,
			customer: account,
			issue,
			urgency,
			technician: technician || void 0,
			equipment: equipment.length ? equipment.join("\n") : void 0,
			received: void 0
		} }),
		onSuccess: (job) => {
			toast.success("Call opened");
			qc.invalidateQueries({ queryKey: ["jobs"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			onOpenChange(false);
			setCustomer(lockedCustomer ?? "");
			setIssue("");
			setEquipment([]);
			setUrgency("Normal");
			setTechnician("");
			if (job?.id) onCreated(job.id);
		},
		onError: (e) => toast.error(e.message)
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "max-h-[90vh] overflow-y-auto sm:max-w-xl",
			onOpenAutoFocus: (e) => e.preventDefault(),
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogTitle, { children: [
					"New ",
					kind === "tlc" ? "TLC + Factor" : "service",
					" call"
				] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, { children: "Opens on today’s clock. Fill the rest in the drawer." }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					className: "mt-4 space-y-4",
					"data-testid": "new-call-form",
					onSubmit: (e) => {
						e.preventDefault();
						if (account.trim()) create.mutate();
					},
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "new-cust",
								children: "Account / customer"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-1 min-w-0",
								children: lockedCustomer ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LockedCustomer, {
									name: lockedCustomer,
									label: "",
									inputName: ""
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerCombo, {
									label: "",
									name: "new-cust",
									value: customer,
									onChange: setCustomer,
									required: true,
									menuInFlow: true
								})
							})]
						}),
						account.trim() ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProviderDispatchBlock, { customer: account }) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EquipmentMultiCombo, {
								label: "Equipment",
								values: equipment,
								onChange: setEquipment,
								placeholder: "Search or add a machine…",
								menuInFlow: true
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-xs leading-relaxed text-muted-foreground",
								children: "Each machine is its own chip above the search."
							})]
						}),
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
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "new-tech",
							children: "Technician"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TechSelect, {
							id: "new-tech",
							value: technician,
							onChange: (e) => setTechnician(e.target.value)
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex justify-end",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "submit",
								disabled: create.isPending || !account.trim(),
								children: "Open call"
							})
						})
					]
				})
			]
		})
	});
}
function BoundCustomer$1({ recordKey, defaultValue, locked }) {
	const [value, setValue] = (0, import_react.useState)(defaultValue);
	(0, import_react.useEffect)(() => {
		setValue(defaultValue);
	}, [recordKey, defaultValue]);
	if (locked) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LockedCustomer, { name: defaultValue || "—" });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerCombo, {
		name: "customer",
		value,
		onChange: setValue,
		menuInFlow: true
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
		placeholder: "Add one or more machines…",
		menuInFlow: true
	});
}
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
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-3",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UnitPlaceField, {
						serial: spec.serial,
						model: spec.equipment
					})
				})
			]
		}, `${spec.equipment}-${index}`))
	});
}
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
function BoundCustomer({ recordKey, defaultValue, name = "customer", required, locked }) {
	const [value, setValue] = (0, import_react.useState)(defaultValue);
	(0, import_react.useEffect)(() => {
		setValue(defaultValue);
	}, [recordKey, defaultValue]);
	if (locked) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LockedCustomer, {
		name: defaultValue,
		inputName: name
	});
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
function PmSheet({ pm, onClose, lockCustomer = false }) {
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
					required: true,
					locked: lockCustomer
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
function InstallSheet({ row, onClose, onOpenRelated, lockCustomer = false }) {
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
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InspectionBadge, {
						overall: row.inspection?.overall,
						passed: row.inspection?.passedCount,
						total: row.inspection?.machineCount
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, {
						tight: true,
						status: row.equipStatus
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlagBadge, { flag: row.flag }),
					row.duplicateOf ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
						variant: "warn",
						children: "Possible duplicate"
					}) : null
				]
			})
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetBody, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreInspectionPanel, { installId: row.id }),
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
					lockCustomer ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LockedCustomer, { name: row.customer }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerCombo, {
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
							menuInFlow: true,
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
function DealSheet({ deal, onClose, lockCustomer = false }) {
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
					required: true,
					locked: lockCustomer
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
	const accountEquip = useQuery({
		queryKey: ["account-equipment", history.data?.name],
		queryFn: () => listAccountEquipment({ data: { customer: history.data.name } }),
		enabled: !!history.data?.name
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
	const [inspectId, setInspectId] = (0, import_react.useState)(null);
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
		setInspectId(null);
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
			return !!j && isOpenCall(j);
		}
		if (it.kind === "pm") {
			const p = data?.pms.find((row) => row.id === it.id);
			return !!p && isOpenPm(p);
		}
		if (it.kind === "install") {
			const i = data?.installs.find((row) => row.id === it.id);
			return !!i && isOpenInstall(i);
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
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccountEquipmentList, {
							rows: accountEquip.data ?? [],
							loading: accountEquip.isLoading
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreInspectionList, {
							installs: (data.installs ?? []).filter((i) => isOpenInstall(i)),
							openId: inspectId,
							onOpen: (id) => setInspectId((cur) => cur === id ? null : id)
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
			onClose: () => setReviewing(false),
			lockCustomer: true
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PmSheet, {
			pm: reviewing ? selectedPm : null,
			onClose: () => setReviewing(false),
			lockCustomer: true
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InstallSheet, {
			row: reviewing ? selectedInstall : null,
			onClose: () => setReviewing(false),
			lockCustomer: true
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DealSheet, {
			deal: reviewing ? selectedDeal : null,
			onClose: () => setReviewing(false),
			lockCustomer: true
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
function PreInspectionList({ installs, openId, onOpen }) {
	if (!installs.length) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "mt-4",
		"data-testid": "account-pre-inspection",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase",
			children: "Pre-inspection"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-2 space-y-2",
			children: installs.map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "overflow-hidden rounded-xl border border-border",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => onOpen(i.id),
					className: "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/60",
					"aria-expanded": openId === i.id,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "block truncate font-medium",
							children: i.wo || i.equipment || "Install"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "block truncate text-xs text-muted-foreground",
							children: [formatShortDate(i.installDate ?? i.received), i.inspection?.failedItems?.length ? ` · ${i.inspection.failedItems.join(", ")}` : ""]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InspectionBadge, {
						overall: i.inspection?.overall,
						passed: i.inspection?.passedCount,
						total: i.inspection?.machineCount
					})]
				}), openId === i.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreInspectionPanel, { installId: i.id }) : null]
			}, i.id))
		})]
	});
}
function AccountEquipmentList({ rows, loading }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "mt-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase",
			children: "Equipment on this account"
		}), loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 text-sm text-muted-foreground",
			children: "Loading equipment…"
		}) : rows.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border",
			children: rows.map((row, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "px-3 py-2.5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-medium",
						children: row.equipmentName || row.catalogModel
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted-foreground",
						children: [
							row.catalogModel && row.catalogModel !== row.equipmentName ? row.catalogModel : null,
							row.serial ? `SN ${row.serial}` : null,
							row.ownership,
							row.installDate ? `Installed ${formatShortDate(row.installDate)}` : null
						].filter(Boolean).join(" · ")
					}),
					row.serial ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UnitPlaceField, {
							serial: row.serial,
							model: row.equipmentName || row.catalogModel
						})
					}) : null
				]
			}, `${row.catalogModel}-${row.serial ?? "none"}-${i}`))
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 text-sm text-muted-foreground",
			children: "No imported equipment on this account yet."
		})]
	});
}
function HistoryRow({ item, onOpen }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick: onOpen,
		className: "desk-lift flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-muted/60",
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
	const [housePick, setHousePick] = (0, import_react.useState)("");
	const [customerPick, setCustomerPick] = (0, import_react.useState)("");
	const [shown, setShown] = (0, import_react.useState)(null);
	const templates = house.filter((r) => r.isTemplate || !r.customer);
	const others = house.filter((r) => r.customer && r.customer.toLowerCase() !== customer.toLowerCase());
	function ownLabel(r) {
		return recipes.filter((x) => x.equipmentModel === r.equipmentModel).length > 1 ? `${r.equipmentModel} · ${r.id}` : r.equipmentModel;
	}
	function otherLabel(r) {
		return `${r.customer} · ${r.equipmentModel}`;
	}
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
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 grid gap-3 sm:grid-cols-2",
				"data-testid": "account-recipe-pickers",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ComboField, {
					label: "House template",
					value: housePick,
					allowCreate: false,
					noun: "template",
					placeholder: "Search house templates…",
					emptyHint: "No house templates",
					menuInFlow: true,
					items: templates.map((r) => ({
						id: r.id,
						name: r.equipmentModel
					})),
					disabled: copy.isPending,
					onChange: (name) => {
						setHousePick(name);
						setCustomerPick("");
						setShown(null);
						const hit = templates.find((r) => r.equipmentModel === name);
						if (hit) copy.mutate(hit.id);
					}
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ComboField, {
					label: "Customer template",
					value: customerPick,
					allowCreate: false,
					noun: "template",
					placeholder: recipes.length ? "Search customer templates…" : "No customer templates",
					emptyHint: "No customer templates",
					menuInFlow: true,
					items: [...recipes.map((r) => ({
						id: r.id,
						name: ownLabel(r)
					})), ...others.map((r) => ({
						id: -r.id,
						name: otherLabel(r)
					}))],
					disabled: copy.isPending,
					onChange: (name) => {
						setCustomerPick(name);
						setHousePick("");
						const own = recipes.find((r) => ownLabel(r) === name);
						if (own) {
							setShown(own);
							return;
						}
						const hit = others.find((r) => otherLabel(r) === name);
						if (hit) {
							setShown(null);
							copy.mutate(hit.id);
						}
					}
				})]
			}),
			shown ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 rounded-xl border border-border bg-card p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-medium",
						children: shown.equipmentModel
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted-foreground",
						children: previewSetting(shown) || shown.notes || "No settings yet"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						size: "sm",
						variant: "outline",
						className: "mt-3",
						onClick: () => onOpen({
							recipe: shown,
							customer,
							equipmentModel: shown.equipmentModel,
							installId: shown.installId,
							copiedFrom: shown.copiedFrom,
							lockCustomer: true
						}),
						children: "Edit"
					})
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm text-muted-foreground",
				children: recipes.length ? "Pick a template. The settings stay on this account." : "No customer templates."
			})
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
function fileToBase64$1(file) {
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
function AccountEquipImportButton({ onImported }) {
	const qc = useQueryClient();
	const inputRef = (0, import_react.useRef)(null);
	const [open, setOpen] = (0, import_react.useState)(false);
	const [fileName, setFileName] = (0, import_react.useState)("");
	const [preview, setPreview] = (0, import_react.useState)(null);
	const load = useMutation({
		mutationFn: async (file) => {
			const base64 = await fileToBase64$1(file);
			return previewAccountEquipImport({ data: {
				filename: file.name,
				base64
			} });
		},
		onSuccess: (data, file) => {
			setFileName(file.name);
			setPreview(data);
			setOpen(true);
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not read the equipment list")
	});
	const apply = useMutation({
		mutationFn: (rows) => applyAccountEquipImport({ data: { rows } }),
		onSuccess: (res) => {
			toast.success(`Equipment list saved · ${res.added} added · ${res.updated} updated${res.catalogAdded ? ` · ${res.catalogAdded} new catalog model${res.catalogAdded === 1 ? "" : "s"}` : ""}`);
			setOpen(false);
			setPreview(null);
			const first = preview?.rows.find((r) => r.action !== "skip" && r.customer && !isWalkIn(r.customer));
			onImported?.(first?.customer ?? null);
			qc.invalidateQueries({ queryKey: ["account-equipment"] });
			qc.invalidateQueries({ queryKey: ["customers"] });
			qc.invalidateQueries({ queryKey: ["directory"] });
			qc.invalidateQueries({ queryKey: ["customer-history"] });
			qc.invalidateQueries({ queryKey: ["installs"] });
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
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-4" }), load.isPending ? "Reading…" : "Import equipment list"]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
			open,
			onOpenChange: (v) => v ? setOpen(true) : cancel(),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
				className: "max-h-[90vh] max-w-6xl overflow-y-auto",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Import equipment list" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogDescription, { children: [fileName ? `${fileName} · ` : "", "This writes machines onto existing accounts. It does not create accounts, tickets, or overwrite notes. Unchecked rows are skipped. Walk-In and unmatched rows stay off until you pick an account and a catalog model."] }),
					preview ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewBody$1, {
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
function draftFor$1(row) {
	return {
		selected: row.action === "add" || row.action === "update",
		customer: row.customer ?? "",
		catalogModel: row.catalogModel ?? "",
		addCatalog: false,
		ownership: row.ownership ?? ""
	};
}
function PreviewBody$1({ preview, pending, onCancel, onConfirm }) {
	const [drafts, setDrafts] = (0, import_react.useState)(() => {
		const next = {};
		for (const row of preview.rows) next[row.key] = draftFor$1(row);
		return next;
	});
	const [filter, setFilter] = (0, import_react.useState)("all");
	const [q, setQ] = (0, import_react.useState)("");
	const [page, setPage] = (0, import_react.useState)(0);
	const [editing, setEditing] = (0, import_react.useState)({});
	const selectAllRef = (0, import_react.useRef)(null);
	const customers = useDirectory("customer");
	const equipment = useDirectory("equipment");
	const customerItems = (0, import_react.useMemo)(() => customers.items.filter((i) => !isWalkIn(i.name)), [customers.items]);
	(0, import_react.useEffect)(() => {
		const next = {};
		for (const row of preview.rows) next[row.key] = draftFor$1(row);
		setDrafts(next);
	}, [preview]);
	function rowReady(row, d) {
		const customer = d.customer.trim();
		const model = d.catalogModel.trim();
		if (!customer || isWalkIn(customer)) return false;
		if (!model) return false;
		if (row.foreignAccount && customer.toLowerCase() !== row.foreignAccount.toLowerCase()) return false;
		return true;
	}
	const visible = (0, import_react.useMemo)(() => {
		const needle = q.trim().toLowerCase();
		return preview.rows.filter((row) => {
			const d = drafts[row.key] ?? draftFor$1(row);
			const ready = rowReady(row, d);
			if (filter === "ready" && !ready) return false;
			if (filter === "review" && ready) return false;
			if (!needle) return true;
			return [
				row.fileCustomer,
				d.customer,
				row.equipmentName,
				row.fileModel,
				d.catalogModel,
				row.serial,
				row.ownership,
				...row.reviewReasons
			].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle));
		});
	}, [
		preview.rows,
		drafts,
		filter,
		q
	]);
	(0, import_react.useEffect)(() => {
		setPage(0);
	}, [filter, q]);
	const pageSize = 80;
	const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
	const pageRows = visible.slice(page * pageSize, page * pageSize + pageSize);
	const selectedAdds = preview.rows.filter((r) => {
		const d = drafts[r.key];
		return d?.selected && rowReady(r, d) && r.action !== "update";
	}).length;
	const selectedUpdates = preview.rows.filter((r) => {
		const d = drafts[r.key];
		return d?.selected && rowReady(r, d) && r.action === "update";
	}).length;
	const selectedCount = selectedAdds + selectedUpdates;
	const blocked = preview.rows.filter((r) => {
		const d = drafts[r.key];
		return d?.selected && !rowReady(r, d);
	});
	const allSelected = preview.rows.length > 0 && preview.rows.every((r) => drafts[r.key]?.selected && rowReady(r, drafts[r.key]));
	const someSelected = selectedCount > 0 && !allSelected;
	(0, import_react.useEffect)(() => {
		if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
	}, [someSelected]);
	function patch(key, next) {
		setDrafts((cur) => {
			const prev = cur[key] ?? {
				selected: false,
				customer: "",
				catalogModel: "",
				addCatalog: false,
				ownership: ""
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
			for (const row of preview.rows) {
				const d = next[row.key] ?? draftFor$1(row);
				if (selected) next[row.key] = {
					...d,
					selected: rowReady(row, {
						...d,
						selected: true
					})
				};
				else next[row.key] = {
					...d,
					selected: false
				};
			}
			return next;
		});
	}
	function confirm() {
		if (blocked.length || selectedCount === 0) return;
		onConfirm(preview.rows.flatMap((row) => {
			const d = drafts[row.key] ?? draftFor$1(row);
			if (!d.selected || !rowReady(row, d)) return [];
			const catalogModel = d.catalogModel.trim();
			const known = equipment.items.some((i) => i.name.toLowerCase() === catalogModel.toLowerCase());
			return [{
				...row,
				customer: d.customer.trim(),
				catalogModel,
				addCatalog: d.addCatalog || !known,
				ownership: d.ownership.trim() || null,
				modelCandidates: [],
				reviewReasons: [],
				action: row.action === "update" ? "update" : "add"
			}];
		}));
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-4",
		"data-equip-import": "preview",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
				className: "grid gap-2 text-sm sm:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "rounded-lg border border-border bg-muted/40 px-3 py-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium",
							children: selectedAdds
						}), " selected to add"]
					}),
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
							children: preview.reviewCount
						}), " need review"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "rounded-lg border border-border bg-muted/40 px-3 py-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium",
							children: preview.rows.length - selectedCount
						}), " skipped"]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex flex-wrap items-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						size: "sm",
						variant: "outline",
						onClick: () => setAll(true),
						children: "Select ready"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						size: "sm",
						variant: "outline",
						onClick: () => setAll(false),
						children: "Deselect all"
					}),
					[
						"all",
						"ready",
						"review"
					].map((id) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setFilter(id),
						className: `rounded-full px-3 py-1 text-xs ${filter === id ? "bg-ink text-ink-foreground" : "bg-muted text-muted-foreground"}`,
						children: id === "all" ? "All" : id === "ready" ? "Ready" : "Needs review"
					}, id)),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: q,
						onChange: (e) => setQ(e.target.value),
						placeholder: "Search rows…",
						className: "h-9 min-w-[12rem] flex-1 rounded-md border border-input bg-background px-3 text-sm",
						"aria-label": "Search import rows"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 overflow-x-auto rounded-xl border border-border",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full min-w-[72rem] text-left text-sm",
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
									"aria-label": "Select all ready rows",
									onChange: (e) => setAll(e.target.checked)
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-3 py-2",
								children: "Account"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-3 py-2",
								children: "Catalog model"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-3 py-2",
								children: "Equipment Name"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-3 py-2",
								children: "Serial"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-3 py-2",
								children: "Install date"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-3 py-2",
								children: "Ownership"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-3 py-2",
								children: "Status"
							})
						] })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [pageRows.map((r) => {
						const d = drafts[r.key] ?? draftFor$1(r);
						const ready = rowReady(r, d);
						const needsReview = !ready;
						const showPickers = needsReview || !!editing[r.key];
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							"data-equip-status": needsReview ? "review" : r.action === "update" ? "update" : "matched",
							className: `border-t border-border ${needsReview ? "bg-warning/10" : ""}`,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-3 py-2 align-top",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "checkbox",
										className: "mt-1 size-4 accent-primary",
										checked: !!d.selected && ready,
										disabled: pending || !ready && !d.selected,
										"aria-label": `Import ${r.equipmentName || r.fileModel}`,
										onChange: (e) => {
											if (e.target.checked && !ready) return;
											patch(r.key, { selected: e.target.checked });
										}
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "min-w-[16rem] px-3 py-2 align-top",
									children: showPickers ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ComboField, {
										value: d.customer,
										onChange: (customer) => {
											const next = {
												...d,
												customer
											};
											patch(r.key, {
												customer,
												selected: d.selected || rowReady(r, next)
											});
										},
										items: customerItems,
										placeholder: "Pick an account…",
										allowCreate: false,
										disabled: pending,
										noun: "account",
										emptyHint: "No account matches. Do not create one from this file.",
										menuInFlow: true
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "mt-0.5 block text-[11px] text-muted-foreground",
										children: ["File: ", r.fileCustomer || "—"]
									})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "text-left font-medium hover:underline",
										onClick: () => setEditing((cur) => ({
											...cur,
											[r.key]: true
										})),
										children: d.customer || "—"
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "min-w-[16rem] px-3 py-2 align-top",
									children: showPickers ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ComboField, {
										value: d.catalogModel,
										onChange: (catalogModel) => {
											const known = equipment.items.some((i) => i.name.toLowerCase() === catalogModel.trim().toLowerCase());
											const next = {
												...d,
												catalogModel,
												addCatalog: !!catalogModel && !known
											};
											patch(r.key, {
												catalogModel,
												addCatalog: next.addCatalog,
												selected: d.selected || rowReady(r, next)
											});
										},
										items: equipment.items,
										placeholder: "Pick a catalog model…",
										allowCreate: true,
										disabled: pending,
										noun: "model",
										emptyHint: "No catalog model. Add this row’s name as a new model, or skip.",
										menuInFlow: true
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "mt-0.5 block text-[11px] text-muted-foreground",
										children: [
											"File model: ",
											r.fileModel || "—",
											d.addCatalog ? " · will add to catalog" : ""
										]
									})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "text-left hover:underline",
										onClick: () => setEditing((cur) => ({
											...cur,
											[r.key]: true
										})),
										children: d.catalogModel || "—"
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-3 py-2 align-top",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-medium",
										children: r.equipmentName || "—"
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-3 py-2 align-top whitespace-nowrap",
									children: r.serial || "—"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-3 py-2 align-top whitespace-nowrap",
									children: r.installDate || "—"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									className: "min-w-[12rem] px-3 py-2 align-top",
									children: [showPickers ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
										allowEmpty: true,
										emptyLabel: "—",
										value: d.ownership,
										disabled: pending,
										onChange: (e) => patch(r.key, { ownership: e.target.value }),
										children: OWNERSHIP_VALUES.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: o,
											children: o
										}, o))
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: d.ownership || "—" }), r.ownershipRaw && !r.ownership ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "mt-0.5 block text-[11px] text-muted-foreground",
										children: ["File: ", r.ownershipRaw]
									}) : null]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									className: "px-3 py-2 align-top",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "block text-[11px] font-medium tracking-wide uppercase",
											children: needsReview ? "Needs review" : r.action === "update" ? "Update existing" : "Matched"
										}),
										r.reviewReasons.map((reason) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "mt-0.5 block text-[11px] text-muted-foreground",
											children: reason
										}, reason)),
										r.foreignAccount ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "mt-0.5 block text-[11px] text-warning",
											children: ["On ", r.foreignAccount]
										}) : null
									]
								})
							]
						}, r.key);
					}), visible.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						colSpan: 8,
						className: "px-3 py-6 text-muted-foreground",
						children: "Nothing in this filter."
					}) }) : null] })]
				})
			}),
			visible.length > pageSize ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex flex-wrap items-center justify-between gap-2 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs text-muted-foreground",
					children: [
						"Showing ",
						page * pageSize + 1,
						"–",
						Math.min(visible.length, page * pageSize + pageSize),
						" of ",
						visible.length
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						size: "sm",
						variant: "outline",
						disabled: page <= 0,
						onClick: () => setPage((p) => p - 1),
						children: "Previous"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						size: "sm",
						variant: "outline",
						disabled: page >= pageCount - 1,
						onClick: () => setPage((p) => p + 1),
						children: "Next"
					})]
				})]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex flex-wrap items-center justify-end gap-2",
				children: [
					blocked.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mr-auto max-w-md text-xs text-warning",
						children: [
							blocked.length,
							" selected row",
							blocked.length === 1 ? "" : "s",
							" still need an account and catalog model."
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
						disabled: pending || selectedCount === 0 || blocked.length > 0,
						onClick: confirm,
						children: pending ? "Saving…" : "Confirm import"
					})
				]
			})
		]
	});
}
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
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-medium tracking-tight",
				children: "Customers"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 max-w-xl text-sm text-muted-foreground",
				children: ["Search the account list. Open a name to review every call, TLC, PM, install, and record on that account — then update the one you pick.", canAdd ? " Add a new name when the account isn’t on the list yet." : " Ask an admin if a name is missing."]
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccountEquipImportButton, { onImported: (name) => {
				if (!name) return;
				const row = (list.data ?? []).find((c) => c.name.toLowerCase() === name.toLowerCase());
				if (row) openCustomer(row.id);
			} })]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 flex flex-wrap items-center gap-2",
			"data-testid": "list-toolbar",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative w-56 shrink-0",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: q,
					onChange: (e) => setQ(e.target.value),
					placeholder: "Search customers…",
					className: "h-9 pl-9",
					"aria-label": "Search customers"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
				value: sort,
				onChange: setSort,
				options: [...SORT_ALPHA],
				className: "shrink-0"
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
						className: "desk-lift flex min-w-0 items-center gap-3 rounded-md px-2 py-2.5 text-left hover:bg-muted/60",
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
var previewExport = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => buildInput.parse(d)).handler(createSsrRpc("111aeb03d57088e20114c3b91137111583695de7837bf7cd602c0b77a80b8751"));
var downloadExport = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => buildInput.parse(d)).handler(createSsrRpc("c4a7418688fc4b7cb7af59b7f9d2eff9d3caace06de75ab3a03f4a37b3217a06"));
function OwnerSelect({ value, onChange, label = "Owner", id, name, allowEmpty = true, emptyLabel = "—", className, testId = "rebuild-owner" }) {
	const names = useQuery({
		queryKey: ["rebuild-owners"],
		queryFn: () => listRebuildOwners()
	}).data ?? [];
	const current = value.trim();
	const rosterHit = current ? names.find((n) => sameTech(n, current)) : void 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className,
		children: [label ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
			htmlFor: id,
			children: label
		}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
			id,
			name,
			"data-testid": testId,
			className: label ? "mt-1" : void 0,
			value: rosterHit ?? current,
			onChange: (e) => onChange(e.target.value),
			allowEmpty,
			emptyLabel,
			children: [(current && !rosterHit ? [current] : []).map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
				value: n,
				children: n
			}, `extra-${n}`)), names.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
				value: n,
				children: n
			}, n))]
		})]
	});
}
function OwnerFilter({ value, onChange, className, emptyLabel = "All techs" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OwnerSelect, {
		label: "",
		value,
		onChange,
		allowEmpty: true,
		emptyLabel,
		className,
		testId: "rebuild-owner-filter"
	});
}
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
								children: type === "rebuilds" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OwnerFilter, {
									value: tech,
									onChange: setTech,
									className: "w-full",
									emptyLabel: "Any owner"
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TechFilter, {
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
var Route$13 = createFileRoute("/_app/installs")({
	validateSearch: parseOpenSearch,
	component: Page$12
});
function Page$12() {
	const { open } = Route$13.useSearch();
	const qc = useQueryClient();
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
	const { filterMine, matchMine } = useMyView();
	const [repFilter, setRepFilter] = (0, import_react.useState)("");
	const [akOnly, setAkOnly] = (0, import_react.useState)(false);
	const [lane, setLane] = (0, import_react.useState)("prep");
	const [slice, setSlice] = (0, import_react.useState)("all");
	const [selected, setSelected] = useOpenRecord(open);
	const [create, setCreate] = (0, import_react.useState)(false);
	const [recipeDraft, setRecipeDraft] = (0, import_react.useState)(null);
	const [sort, setSort] = useDeskSort("installs", "date-asc");
	const [picked, setPicked] = (0, import_react.useState)([]);
	const [confirmIds, setConfirmIds] = (0, import_react.useState)(null);
	const [gate, setGate] = (0, import_react.useState)(null);
	const [overrideReason, setOverrideReason] = (0, import_react.useState)("");
	const [inspectId, setInspectId] = (0, import_react.useState)(null);
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
		if (lane === "installed") list = list.filter((i) => isInstalled(i));
		else if (slice === "ready") list = list.filter((i) => isOpenInstall(i) && siteIsReady(i.equipStatus, i.inspection?.overall));
		else if (slice === "not-ready") list = list.filter((i) => isOpenInstall(i) && !siteIsReady(i.equipStatus, i.inspection?.overall));
		else list = list.filter((i) => isOpenInstall(i));
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
		lane,
		slice,
		sort,
		filterMine,
		matchMine,
		repFilter,
		akOnly
	]);
	const selectedRow = (data.data ?? []).find((i) => i.id === selected) ?? null;
	const allInstalls = data.data ?? [];
	const atRisk = allInstalls.filter((i) => isOpenInstall(i) && i.flag).length;
	const recipes = recs.data ?? [];
	const readyN = allInstalls.filter((i) => isOpenInstall(i) && siteIsReady(i.equipStatus, i.inspection?.overall)).length;
	const notReadyN = allInstalls.filter((i) => isOpenInstall(i) && !siteIsReady(i.equipStatus, i.inspection?.overall)).length;
	const installedN = allInstalls.filter((i) => isInstalled(i)).length;
	const prepN = allInstalls.filter((i) => isOpenInstall(i)).length;
	const readyByEquip = tally(allInstalls.filter((i) => isOpenInstall(i) && siteIsReady(i.equipStatus, i.inspection?.overall)).flatMap((i) => {
		const listed = listedEquipment((i.machines ?? []).map((m) => m.equipment).join("\n") || i.equipment, catalog);
		return listed.length ? listed : [matchModel(i.equipment || "Unspecified", catalog)];
	}), (n) => n);
	function openRecipe(d) {
		setSelected(null);
		setRecipeDraft(d);
	}
	const openIds = (0, import_react.useMemo)(() => rows.filter((i) => isOpenInstall(i)).map((i) => i.id), [rows]);
	const pickedOpen = picked.filter((id) => openIds.includes(id));
	const markInstalled = useMutation({
		mutationFn: async (ids) => {
			const today = todayChicago();
			const source = data.data ?? [];
			await Promise.all(ids.map((id) => {
				const row = source.find((i) => i.id === id);
				return updateInstall({ data: {
					id,
					...installedPatch(row, today)
				} });
			}));
			return ids;
		},
		onMutate: async (ids) => {
			await qc.cancelQueries({ queryKey: ["installs"] });
			const prev = qc.getQueryData(["installs"]);
			const today = todayChicago();
			const idSet = new Set(ids);
			qc.setQueryData(["installs"], (old) => (old ?? []).map((r) => idSet.has(r.id) ? {
				...r,
				...installedPatch(r, today)
			} : r));
			return { prev };
		},
		onError: (e, _ids, ctx) => {
			if (ctx?.prev) qc.setQueryData(["installs"], ctx.prev);
			toast.error(e instanceof Error ? e.message : "Could not mark installed");
		},
		onSuccess: (ids) => {
			toast.success(ids.length === 1 ? "Marked installed" : `Marked ${ids.length} installs as installed`);
			setPicked([]);
			setConfirmIds(null);
		},
		onSettled: () => {
			qc.invalidateQueries({ queryKey: ["installs"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["customers"] });
		}
	});
	function togglePicked(id, on) {
		setPicked((cur) => {
			if (on) return cur.includes(id) ? cur : [...cur, id];
			return cur.filter((x) => x !== id);
		});
	}
	function requestMark(ids) {
		const unique = [...new Set(ids)].filter((id) => {
			const row = (data.data ?? []).find((i) => i.id === id);
			return !!row && isOpenInstall(row);
		});
		if (!unique.length) return;
		const blocked = unique.map((id) => (data.data ?? []).find((i) => i.id === id)).filter((row) => !!row && !canMarkInstalled(row.inspection));
		if (blocked.length) {
			setOverrideReason("");
			setGate({
				ids: unique,
				names: blocked.map((r) => r.customer)
			});
			return;
		}
		if (unique.length > 1) {
			setConfirmIds(unique);
			return;
		}
		markInstalled.mutate(unique);
	}
	async function confirmOverride() {
		const reason = overrideReason.trim();
		if (!reason || !gate) return;
		const blocked = gate.ids.filter((id) => {
			const row = (data.data ?? []).find((i) => i.id === id);
			return !!row && !canMarkInstalled(row.inspection);
		});
		try {
			await Promise.all(blocked.map((id) => saveInspectionMeta({ data: {
				installId: id,
				overrideReason: reason
			} })));
			setGate(null);
			markInstalled.mutate(gate.ids);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not save the override");
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-medium tracking-tight",
				children: "Install clock"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-xl text-sm text-muted-foreground",
				children: "Prep is what still needs to go out. Installed is the finished list."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionMenu, {
					label: "Export",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExportButton, {
						defaultType: "installs",
						label: "Export readiness"
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					onClick: () => setCreate(true),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "New install"]
				})]
			})]
		}),
		atRisk ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-3 text-sm text-muted-foreground",
			children: [atRisk, " at risk in prep."]
		}) : null,
		lane === "prep" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(StatRow, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
			label: "Ready",
			value: readyN,
			hint: "Equipment ready and pre-inspection passed",
			breakdown: readyByEquip,
			selected: slice === "ready",
			onClick: () => setSlice((v) => v === "ready" ? "all" : "ready")
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
			label: "Not ready",
			value: notReadyN,
			hint: "Prep, failed check, or not inspected",
			selected: slice === "not-ready",
			onClick: () => setSlice((v) => v === "not-ready" ? "all" : "not-ready")
		})] }) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 flex flex-wrap items-center gap-2",
			"data-testid": "prep-installed-toggle",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: q,
					onChange: (e) => setQ(e.target.value),
					placeholder: "Search installs…",
					className: "h-9 w-56 shrink-0",
					"aria-label": "Search installs"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(FilterChip, {
					selected: lane === "prep",
					onClick: () => setLane("prep"),
					children: [
						"Prep (",
						prepN,
						")"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(FilterChip, {
					selected: lane === "installed",
					onClick: () => setLane("installed"),
					children: [
						"Installed (",
						installedN,
						")"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RepFilter, {
					value: repFilter,
					onChange: setRepFilter,
					extraNames: (data.data ?? []).map((i) => i.accountRep),
					className: "h-9 w-44 shrink-0"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "flex h-9 shrink-0 items-center gap-2 rounded-full bg-secondary px-3 text-sm",
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
					options: SORT_LIST,
					className: "shrink-0"
				})
			]
		}),
		pickedOpen.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-medium",
						children: pickedOpen.length
					}), " selected"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					type: "button",
					size: "sm",
					"data-testid": "mark-installed-bulk",
					disabled: markInstalled.isPending,
					onClick: () => requestMark(pickedOpen),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-3.5" }), "Mark installed"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					size: "sm",
					variant: "outline",
					onClick: () => setPicked([]),
					children: "Clear"
				})
			]
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 overflow-hidden rounded-xl border border-border bg-card",
			children: [rows.map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InstallRow, {
				install: i,
				catalog,
				recipes,
				onOpen: () => setSelected(i.id),
				onRecipe: openRecipe,
				selected: picked.includes(i.id),
				onToggleSelect: (on) => togglePicked(i.id, on),
				onMarkInstalled: () => requestMark([i.id]),
				marking: markInstalled.isPending,
				inspecting: inspectId === i.id,
				onToggleInspect: () => setInspectId((cur) => cur === i.id ? null : i.id)
			}, i.id)), rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "px-4 py-8",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: lane === "installed" ? "No installs marked installed." : "No installs in prep."
				}), lane === "prep" && !q.trim() ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					type: "button",
					size: "sm",
					className: "mt-3",
					onClick: () => setCreate(true),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "New install"]
				}) : null]
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
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
			open: !!confirmIds?.length,
			onOpenChange: (v) => !v ? setConfirmIds(null) : null,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
				className: "max-w-md",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Mark installed" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 text-sm text-muted-foreground",
						children: [
							"Mark ",
							confirmIds?.length ?? 0,
							" install",
							(confirmIds?.length ?? 0) === 1 ? "" : "s",
							" as installed? They leave the prep queue and show on the Installed list. Serial, configuration, and dates stay on the account."
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 flex justify-end gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "outline",
							onClick: () => setConfirmIds(null),
							children: "Cancel"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							"data-testid": "mark-installed-confirm",
							disabled: markInstalled.isPending,
							onClick: () => confirmIds && markInstalled.mutate(confirmIds),
							children: markInstalled.isPending ? "Saving…" : "Mark installed"
						})]
					})
				]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
			open: !!gate,
			onOpenChange: (v) => !v ? setGate(null) : null,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
				className: "max-w-md",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Pre-inspection not passed" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 text-sm text-muted-foreground",
						children: [gate?.names.join(", "), " still need a passed site check. Add a reason to mark installed anyway."]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "install-override",
						className: "mt-3 block",
						children: "Override reason"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
						id: "install-override",
						className: "mt-1",
						value: overrideReason,
						onChange: (e) => setOverrideReason(e.target.value),
						placeholder: "Why this can go out before the site check passes"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 flex justify-end gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "outline",
							onClick: () => setGate(null),
							children: "Cancel"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							disabled: !overrideReason.trim() || markInstalled.isPending,
							onClick: () => void confirmOverride(),
							children: markInstalled.isPending ? "Saving…" : "Override and mark installed"
						})]
					})
				]
			})
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
							className: "grid min-w-0 gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerCombo, {
								value: customer,
								onChange: (v) => {
									try {
										setCustomer(v);
									} catch (err) {
										toast.error(err instanceof Error ? err.message : "Could not set customer");
									}
								},
								required: true,
								menuInFlow: true
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EquipmentMultiCombo, {
								values: equipment,
								onChange: (next) => {
									setEquipment(next);
									setSpecs(mergeMachineSpecs(next, specs));
								},
								placeholder: "Search the full equipment list…",
								menuInFlow: true
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
function OpenInstallSelect({ customer, selected, onToggle }) {
	if (!onToggle) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		type: "checkbox",
		className: "mt-1 size-4 shrink-0 accent-primary",
		checked: !!selected,
		"aria-label": `Select ${customer}`,
		onChange: (e) => {
			e.stopPropagation();
			onToggle(e.target.checked);
		}
	});
}
function MarkInstalledButton({ customer, onMark, marking }) {
	if (!onMark) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
		type: "button",
		size: "sm",
		variant: "outline",
		className: "shrink-0",
		"data-testid": "mark-installed",
		disabled: marking,
		"aria-label": `Mark ${customer} installed`,
		onClick: (e) => {
			e.stopPropagation();
			onMark();
		},
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "hidden sm:inline",
			children: "Mark installed"
		})]
	});
}
function InstallActions({ install, open, onMark, marking, inspecting, onToggleInspect }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex shrink-0 flex-col items-end gap-1",
		children: [
			open && onToggleInspect ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				type: "button",
				size: "sm",
				variant: inspecting ? "default" : "outline",
				"data-testid": "open-pre-inspection",
				"aria-expanded": !!inspecting,
				onClick: (e) => {
					e.stopPropagation();
					onToggleInspect();
				},
				children: "Pre-inspection"
			}) : null,
			open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MarkInstalledButton, {
				customer: install.customer,
				onMark,
				marking
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RemoveInstallButton, { install })
		]
	});
}
function InstallEquipChips({ install, catalog, recipes, onRecipe, empty, className }) {
	const pieces = piecesForInstall(install.equipment, install.customer, install.id, catalog, recipes);
	const remove = useRemoveEquip(install, catalog);
	if (!pieces.length) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: empty ?? null });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: className ?? "mt-2 flex flex-wrap gap-1.5",
		children: pieces.map((p, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecipeChip, {
			piece: p,
			customer: install.customer,
			installId: install.id,
			recipes,
			onOpen: onRecipe,
			onRemove: () => remove.mutate(p.label)
		}, `${p.model}-${p.label}-${idx}`))
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
function InstallRow({ install: i, catalog, recipes, onOpen, onRecipe, selected, onToggleSelect, onMarkInstalled, marking, inspecting, onToggleInspect }) {
	const open = isOpenInstall(i);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "border-b border-border px-3 py-3 last:border-b-0 md:px-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-start gap-2",
			children: [
				open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OpenInstallSelect, {
					customer: i.customer,
					selected,
					onToggle: onToggleSelect
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
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
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, {
											status: i.equipStatus,
											tight: true
										}),
										open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InspectionBadge, {
											overall: i.inspection?.overall,
											passed: i.inspection?.passedCount,
											total: i.inspection?.machineCount
										}) : null,
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
							className: "sm:pl-20",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InstallEquipChips, {
								install: i,
								catalog,
								recipes,
								onRecipe,
								empty: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "mt-2 block text-xs text-muted-foreground",
									children: i.equipment || "No equipment listed"
								})
							})
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InstallActions, {
					install: i,
					open,
					onMark: onMarkInstalled,
					marking,
					inspecting,
					onToggleInspect
				})
			]
		}), inspecting ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-3 overflow-hidden rounded-xl border border-border bg-background",
			"data-testid": "pre-inspection-inline",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreInspectionPanel, { installId: i.id })
		}) : null]
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
	const [retPallet, setRetPallet] = (0, import_react.useState)("A");
	const [retLevel, setRetLevel] = (0, import_react.useState)(1);
	const [installId, setInstallId] = (0, import_react.useState)("");
	const [serviceCustomer, setServiceCustomer] = (0, import_react.useState)("");
	const [place, setPlace] = (0, import_react.useState)(emptyPlaceDraft());
	const me = useQuery({
		queryKey: ["access", "me"],
		queryFn: () => getMyAccess()
	});
	const warehouseOnly = me.data?.role === "warehouse";
	const canStock = !!me.data?.isAdmin || warehouseOnly;
	const [testNote, setTestNote] = (0, import_react.useState)("");
	const [rejectNote, setRejectNote] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		setModel(asset?.model ?? "");
		setOwned(asset?.customerOwned ?? "");
		setSoldTo(asset?.soldTo ?? "");
		setInstallId("");
		setServiceCustomer("");
		setPlace(emptyPlaceDraft());
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
	const queue = (installs.data ?? []).filter((i) => isOpenInstall(i));
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
					asset.needsBay ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "Needs bay" }) : null,
					bay === "catering" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "Catering" }) : null,
					bay === "dispenser" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "Dispenser" }) : null,
					asset.reviewStatus === "pending" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "Pending review" }) : null,
					asset.shopTest === "tested" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "Tested" }) : null,
					asset.shopTest === "needs-test" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "Needs test" }) : null,
					asset.missingSerial ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "Serial missing" }) : null
				]
			})
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetBody, { children: [
			canStock ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-3 border-b border-border p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs tracking-wide text-muted-foreground uppercase",
						children: "Shop test"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm text-muted-foreground",
						children: ["Shop status only. Tested does not mean installed or left for a job.", asset.shopTest === "tested" && asset.shopTestBy ? ` Marked by ${asset.shopTestBy}${asset.shopTestAt ? ` · ${asset.shopTestAt.slice(0, 16).replace("T", " ")}` : ""}.` : ""]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: testNote,
						onChange: (e) => setTestNote(e.target.value),
						placeholder: "Optional note"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							size: "sm",
							variant: asset.shopTest === "needs-test" ? "default" : "outline",
							onClick: () => void setShopTest({ data: {
								id: asset.id,
								shopTest: "needs-test",
								note: testNote || null
							} }).then(() => {
								toast.success("Needs test");
								qc.invalidateQueries({ queryKey: ["assets"] });
							}).catch((e) => toast.error(e instanceof Error ? e.message : "Could not update")),
							children: "Needs test"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							size: "sm",
							variant: asset.shopTest === "tested" ? "default" : "outline",
							onClick: () => void setShopTest({ data: {
								id: asset.id,
								shopTest: "tested",
								note: testNote || null
							} }).then(() => {
								toast.success("Tested");
								qc.invalidateQueries({ queryKey: ["assets"] });
							}).catch((e) => toast.error(e instanceof Error ? e.message : "Could not update")),
							children: "Tested"
						})]
					}),
					asset.shopTestNote ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted-foreground",
						children: asset.shopTestNote
					}) : null
				]
			}) : null,
			me.data?.isAdmin && asset.reviewStatus === "pending" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-3 border-b border-border p-5",
				"data-testid": "rack-review",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs tracking-wide text-muted-foreground uppercase",
						children: "Needs review"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted-foreground",
						children: "Warehouse put this unit on the rack. Approve it, or reject with a note. Reject does not leave a second copy."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: rejectNote,
						onChange: (e) => setRejectNote(e.target.value),
						placeholder: "Note if you reject"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							size: "sm",
							onClick: () => void reviewRackUnit({ data: {
								id: asset.id,
								decision: "approve"
							} }).then(() => {
								toast.success("Approved");
								qc.invalidateQueries({ queryKey: ["assets"] });
							}).catch((e) => toast.error(e instanceof Error ? e.message : "Could not approve")),
							children: "Approve"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							size: "sm",
							variant: "outline",
							onClick: () => void reviewRackUnit({ data: {
								id: asset.id,
								decision: "reject",
								note: rejectNote
							} }).then(() => {
								toast.success("Rejected");
								setRejectNote("");
								onClose();
								qc.invalidateQueries({ queryKey: ["assets"] });
							}).catch((e) => toast.error(e instanceof Error ? e.message : "Could not reject")),
							children: "Reject"
						})]
					})
				]
			}) : asset.reviewStatus === "rejected" && asset.reviewNote ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "border-b border-border p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs tracking-wide text-muted-foreground uppercase",
					children: "Rejected"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm",
					children: asset.reviewNote
				})]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "grid gap-3 border-b border-border p-5 sm:grid-cols-2",
				onSubmit: (e) => {
					e.preventDefault();
					const fd = new FormData(e.currentTarget);
					const err = place.site ? placeDraftError(place) : null;
					if (err) {
						toast.error(err);
						return;
					}
					save.mutate({
						id: asset.id,
						model,
						serial: String(fd.get("serial") || "") || null,
						qty: Number(fd.get("qty") || 1),
						customerOwned: owned || null,
						purpose: String(fd.get("purpose") || "") || null,
						notes: String(fd.get("notes") || "") || null
					}, { onSuccess: async () => {
						if (!place.site) return;
						try {
							const next = await setAssetPlace({ data: {
								id: asset.id,
								site: place.site,
								pallet: place.pallet || null,
								level: place.level ? Number(place.level) : null,
								otherLabel: place.otherLabel || null
							} });
							toast.success(next.place ? `Now at ${next.place}` : "Location saved");
							setPlace(emptyPlaceDraft());
							qc.invalidateQueries({ queryKey: ["assets"] });
						} catch (err) {
							toast.error(err instanceof Error ? err.message : "Could not set location");
						}
					} });
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
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-xs text-muted-foreground",
								children: [
									"Now:",
									" ",
									unitPlaceLabel({
										site: asset.site,
										pallet: asset.pallet,
										level: asset.level,
										status: asset.status,
										soldTo: asset.soldTo,
										purpose: asset.purpose
									})
								]
							}),
							lastMoveLine(asset.notes) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-muted-foreground",
								children: lastMoveLine(asset.notes)
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-2",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UnitPlaceField, {
									assetId: asset.id,
									serial: asset.serial ?? "",
									model: asset.model,
									draft: place,
									onDraft: setPlace
								})
							})
						]
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
			asset.needsBay ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-3 border-b border-border p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs tracking-wide text-muted-foreground uppercase",
						children: "Needs a bay"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted-foreground",
						children: "This unit’s letter is Q or after P. Put it on A–P so it sits on the map. It stays in the warehouse list until you do."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-3 gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
								value: retSite,
								onChange: (e) => {
									const s = e.target.value;
									setRetSite(s);
									setRetPallet(s === "barn-front" ? FRONT_PALLETS[0] : "A");
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
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						size: "sm",
						disabled: save.isPending,
						onClick: () => save.mutate({
							id: asset.id,
							site: retSite,
							pallet: retPallet,
							level: retLevel
						}),
						children: ["Put on ", retPallet]
					})
				]
			}) : null,
			asset.status === "ready" && !warehouseOnly ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
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
									setRetPallet(s === "barn-front" ? FRONT_PALLETS[0] : "A");
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
	if (asset.site === "staging") return "Staging";
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
	const [panel, setPanel] = (0, import_react.useState)(null);
	const [movingId, setMovingId] = (0, import_react.useState)(null);
	const [moveDraft, setMoveDraft] = (0, import_react.useState)(emptyPlaceDraft());
	const [sort, setSort] = useDeskSort("locations", "alpha-asc");
	const all = data.data ?? [];
	const needle = q.trim().toLowerCase();
	const groups = (0, import_react.useMemo)(() => {
		const match = (a) => {
			if (!needle) return true;
			const place = unitPlaceLabel({
				site: a.site,
				pallet: a.pallet,
				level: a.level,
				status: a.status,
				soldTo: a.soldTo,
				purpose: a.purpose
			});
			return [
				a.model,
				a.serial,
				a.purpose,
				a.soldTo,
				place,
				SITE_LABEL[a.site]
			].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle));
		};
		const sortRows = (rows) => sortDesk(rows, sort, {
			name: (a) => a.model,
			equipment: (a) => a.qty ?? 1,
			status: (a) => a.status,
			date: (a) => a.soldAt ?? a.updatedAt
		});
		const deployed = all.filter((a) => a.status === "deployed");
		const otherLabels = [...new Set(deployed.filter((a) => a.site === HOUSE_OTHER).map((a) => (a.purpose ?? "").trim() || "Other"))].sort();
		const placed = [
			{
				key: "training",
				site: HOUSE_TRAINING,
				label: "Training",
				otherLabel: null
			},
			{
				key: "lobby",
				site: HOUSE_LOBBY,
				label: "Lobby",
				otherLabel: null
			},
			{
				key: "staging",
				site: HOUSE_STAGING,
				label: "Staging area",
				otherLabel: null
			},
			...otherLabels.map((label) => ({
				key: `other:${label}`,
				site: HOUSE_OTHER,
				label,
				otherLabel: label
			})),
			...CUSTOMER_SITES.map((site) => ({
				key: site,
				site,
				label: SITE_LABEL[site] ?? site,
				otherLabel: null
			}))
		].map((b) => ({
			...b,
			rows: sortRows(deployed.filter((a) => a.site === b.site && (b.otherLabel == null || ((a.purpose ?? "").trim() || "Other") === b.otherLabel) && match(a)))
		}));
		if (tab === "sold") return [{
			key: "sold",
			site: "sold",
			label: SITE_LABEL.sold ?? "Sold",
			otherLabel: null,
			rows: sortRows(all.filter((a) => a.status === "sold" && match(a)))
		}];
		if (tab === "field") return [{
			key: "field",
			site: "field",
			label: SITE_LABEL.field ?? "Pulled",
			otherLabel: null,
			rows: sortRows(all.filter((a) => a.status === "assigned" && match(a)))
		}];
		if (tab === "all") return [
			...placed,
			{
				key: "field",
				site: "field",
				label: SITE_LABEL.field ?? "Pulled",
				otherLabel: null,
				rows: sortRows(all.filter((a) => a.status === "assigned" && match(a)))
			},
			{
				key: "sold",
				site: "sold",
				label: SITE_LABEL.sold ?? "Sold",
				otherLabel: null,
				rows: sortRows(all.filter((a) => a.status === "sold" && match(a)))
			}
		];
		return placed;
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
	const bySite = [
		{
			name: "Training",
			count: all.filter((a) => a.status === "deployed" && a.site === "training").length
		},
		{
			name: "Lobby",
			count: all.filter((a) => a.status === "deployed" && a.site === "front-lobby").length
		},
		{
			name: "Staging area",
			count: all.filter((a) => a.status === "deployed" && a.site === "staging").length
		},
		...CUSTOMER_SITES.map((site) => ({
			name: SITE_LABEL[site] ?? site,
			count: all.filter((a) => a.status === "deployed" && a.site === site).length
		}))
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
			className: "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-medium tracking-tight",
				children: "Equipment by location"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-xl text-sm text-muted-foreground",
				children: "Units at a site, not on a barn bay. Add from the barn, or add a unit that is not in the barn. Moving back asks for a bay first."
			})] })
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(StatRow, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
				label: "On site",
				value: deployedCount,
				selected: tab === "deployed",
				onClick: () => setTab((t) => toggleChip(t, "deployed", "all"))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
				label: "On an install",
				value: fieldCount,
				selected: tab === "field",
				onClick: () => setTab((t) => toggleChip(t, "field", "all"))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
				label: "Sold",
				value: soldCount,
				selected: tab === "sold",
				onClick: () => setTab((t) => toggleChip(t, "sold", "all"))
			})
		] }),
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
			className: "mt-5 flex flex-wrap items-center gap-2",
			"data-testid": "list-toolbar",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: q,
					onChange: (e) => setQ(e.target.value),
					placeholder: "Filter…",
					className: "h-9 w-56 shrink-0",
					"aria-label": "Filter equipment"
				}),
				[
					["deployed", `On site (${deployedCount})`],
					["field", `Pulled (${fieldCount})`],
					["sold", `Sold (${soldCount})`]
				].map(([id, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterChip, {
					selected: tab === id,
					onClick: () => setTab(id),
					children: label
				}, id)),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
					value: sort,
					onChange: setSort,
					options: [
						...SORT_ALPHA,
						...SORT_DATE,
						...SORT_EQUIP,
						...SORT_STATUS
					],
					className: "shrink-0"
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-5 space-y-6",
			children: groups.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-2 flex flex-wrap items-baseline justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-xl",
						children: g.label
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-xs text-muted-foreground",
							children: [g.rows.reduce((n, a) => n + a.qty, 0), " units"]
						}), g.site !== "field" && g.site !== "sold" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							size: "sm",
							variant: panel?.site === g.key && panel.mode === "barn" ? "default" : "outline",
							"data-testid": g.key === "training" ? "add-from-barn-training" : g.key === "lobby" ? "add-from-barn-lobby" : g.key === "staging" ? "add-from-barn-staging" : void 0,
							onClick: () => setPanel((cur) => cur?.site === g.key && cur.mode === "barn" ? null : {
								site: g.key,
								mode: "barn"
							}),
							children: "Add from barn"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							size: "sm",
							variant: panel?.site === g.key && panel.mode === "list" ? "default" : "outline",
							onClick: () => setPanel((cur) => cur?.site === g.key && cur.mode === "list" ? null : {
								site: g.key,
								mode: "list"
							}),
							children: "Add to list"
						})] }) : null]
					})]
				}),
				panel?.site === g.key ? panel.mode === "barn" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BarnPick, {
					site: g.site,
					otherLabel: g.otherLabel,
					onDone: () => setPanel(null)
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ListAdd, {
					site: g.site,
					otherLabel: g.otherLabel,
					onDone: () => setPanel(null)
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "overflow-hidden rounded-xl border border-border bg-card",
					children: [g.rows.map((a) => {
						const electrical = electricalFrom(a.notes) || electricalFrom(a.purpose);
						const moved = lastMoveLine(a.notes);
						const onSite = a.status === "deployed" && !isBarn(a.site);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-2 border-b border-border px-4 py-3 last:border-b-0 md:grid-cols-[1.4fr_1fr_auto] md:items-center",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => setSelected(a.id),
									className: "text-left",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-medium",
											children: a.model
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "mt-0.5 block text-xs text-muted-foreground",
											children: [[
												a.serial ? `SN ${a.serial}` : "No serial",
												electrical,
												unitPlaceLabel({
													site: a.site,
													pallet: a.pallet,
													level: a.level,
													status: a.status,
													soldTo: a.soldTo,
													purpose: a.purpose
												})
											].filter(Boolean).join(" · "), a.qty > 1 ? ` · qty ${a.qty}` : ""]
										}),
										moved ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "mt-0.5 block text-xs text-muted-foreground",
											children: moved
										}) : null
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-sm text-muted-foreground",
									children: [a.purpose ?? a.soldTo ?? "—", a.soldAt ? ` · ${a.soldAt}` : ""]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "flex flex-wrap items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: a.site === "staging" ? "Staging" : a.status === "sold" ? "Sold" : a.status === "assigned" ? a.installId ? "On an install" : "On service" : "In use" }), onSite ? movingId === a.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "flex flex-wrap items-end gap-2",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlacePicker, {
												value: moveDraft,
												onChange: setMoveDraft,
												testId: "location-move"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												type: "button",
												size: "sm",
												disabled: !!placeDraftError(moveDraft),
												onClick: async () => {
													const err = placeDraftError(moveDraft);
													if (err) {
														toast.error(err);
														return;
													}
													try {
														const place = await setAssetPlace({ data: {
															id: a.id,
															site: moveDraft.site,
															pallet: moveDraft.pallet || null,
															level: moveDraft.level ? Number(moveDraft.level) : null,
															otherLabel: moveDraft.otherLabel || null
														} });
														toast.success(place.place ? `Now at ${place.place}` : "Moved");
														setMovingId(null);
														qc.invalidateQueries({ queryKey: ["assets"] });
													} catch (e) {
														toast.error(e instanceof Error ? e.message : "Could not move");
													}
												},
												children: "Confirm"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												type: "button",
												size: "sm",
												variant: "outline",
												onClick: () => setMovingId(null),
												children: "Cancel"
											})
										]
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										type: "button",
										size: "sm",
										variant: "outline",
										onClick: () => {
											setMoveDraft(emptyPlaceDraft());
											setMovingId(a.id);
										},
										children: "Move"
									}) : null]
								})
							]
						}, a.id);
					}), g.rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "px-4 py-6 text-sm text-muted-foreground",
						children: "Nothing logged here."
					}) : null]
				})
			] }, g.key))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AssetSheet, {
			asset: selectedRow,
			onClose: () => setSelected(null)
		})
	] });
}
function BarnPick({ site, otherLabel, onDone }) {
	const qc = useQueryClient();
	const data = useQuery({
		queryKey: ["barn-available"],
		queryFn: () => listBarnAvailable()
	});
	const [q, setQ] = (0, import_react.useState)("");
	const [picked, setPicked] = (0, import_react.useState)([]);
	const needle = q.trim().toLowerCase();
	const rows = (data.data ?? []).filter((a) => [
		a.model,
		a.serial,
		a.place
	].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle)));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mb-3 rounded-xl border border-border bg-card p-3",
		"data-testid": "barn-pick",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				value: q,
				onChange: (e) => setQ(e.target.value),
				placeholder: "Search model, serial, or name"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
				className: "mt-2 max-h-52 overflow-y-auto",
				children: [rows.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "flex items-center gap-2 px-1 py-1.5 text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "checkbox",
						checked: picked.includes(a.id),
						onChange: (e) => setPicked((cur) => e.target.checked ? [...cur, a.id] : cur.filter((id) => id !== a.id))
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "min-w-0 flex-1",
						children: [a.model, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-muted-foreground",
							children: [
								" ",
								"· ",
								[
									a.serial ? `SN ${a.serial}` : "No serial",
									a.place,
									a.electrical
								].filter(Boolean).join(" · ")
							]
						})]
					})]
				}) }, a.id)), !rows.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "px-1 py-2 text-sm text-muted-foreground",
					children: "Nothing available in the barn."
				}) : null]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 flex gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					size: "sm",
					disabled: !picked.length,
					onClick: async () => {
						try {
							const res = await placeAssetsAtLocation({ data: {
								ids: picked,
								site,
								otherLabel
							} });
							toast.success(res.moved === 1 ? "Added from the barn" : `Added ${res.moved} from the barn`);
							qc.invalidateQueries({ queryKey: ["assets"] });
							qc.invalidateQueries({ queryKey: ["barn-available"] });
							onDone();
						} catch (err) {
							toast.error(err instanceof Error ? err.message : "Could not add");
						}
					},
					children: "Add selected"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					size: "sm",
					variant: "outline",
					onClick: onDone,
					children: "Cancel"
				})]
			})
		]
	});
}
function ListAdd({ site, otherLabel, onDone }) {
	const qc = useQueryClient();
	const [model, setModel] = (0, import_react.useState)("");
	const [serial, setSerial] = (0, import_react.useState)("");
	const [electrical, setElectrical] = (0, import_react.useState)("");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
		className: "mb-3 grid gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-2",
		"data-testid": "location-add-form",
		onSubmit: async (e) => {
			e.preventDefault();
			if (!model.trim()) {
				toast.error("Pick a model");
				return;
			}
			try {
				const res = await addUnitToLocation({ data: {
					site,
					model,
					serial: serial || null,
					electrical: electrical || null,
					otherLabel
				} });
				toast.success(res.pulled ? "Pulled from the barn onto this location" : "Added to this location");
				qc.invalidateQueries({ queryKey: ["assets"] });
				qc.invalidateQueries({ queryKey: ["barn-available"] });
				onDone();
			} catch (err) {
				toast.error(err instanceof Error ? err.message : "Could not add");
			}
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EquipmentCombo, {
				label: "Model",
				value: model,
				onChange: setModel,
				menuInFlow: true,
				required: true
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
				htmlFor: `loc-sn-${site}`,
				children: "Serial"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				id: `loc-sn-${site}`,
				className: "mt-1",
				value: serial,
				onChange: (e) => setSerial(e.target.value)
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
				htmlFor: `loc-el-${site}`,
				children: "Electrical"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				id: `loc-el-${site}`,
				className: "mt-1",
				value: electrical,
				onChange: (e) => setElectrical(e.target.value),
				placeholder: "120V or 220V"
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-end gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "submit",
					size: "sm",
					children: "Add"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					size: "sm",
					variant: "outline",
					onClick: onDone,
					children: "Cancel"
				})]
			})
		]
	});
}
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
	const [bubble, setBubble] = (0, import_react.useState)("tracked");
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
		if (bubble === "ready") list = list.filter((m) => m.status === "Ready");
		if (bubble === "shop") list = list.filter((m) => m.status !== "Ready" && m.status !== "Installed at Account" && m.status !== "Retired / Scrapped");
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
		sort,
		bubble
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
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(StatRow, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
				label: "Tracked",
				value: all.length,
				hint: "Every module on the board",
				selected: bubble === "tracked",
				onClick: () => setBubble((v) => toggleChip(v, "tracked", null))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
				label: "Ready",
				value: readyRows.length,
				hint: readyByPlatform.map((p) => `${p.count} ${p.name}`).join(" · ") || "Nothing ready",
				breakdown: readyByType,
				selected: bubble === "ready",
				onClick: () => setBubble((v) => toggleChip(v, "ready", null))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
				label: "In shop",
				value: notReady.length,
				hint: "Not ready, not installed, not retired",
				selected: bubble === "shop",
				onClick: () => setBubble((v) => toggleChip(v, "shop", null))
			})
		] }),
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
			"data-testid": "list-toolbar",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				value: q,
				onChange: (e) => setQ(e.target.value),
				placeholder: "Filter modules…",
				className: "h-9 w-56 shrink-0",
				"aria-label": "Filter modules"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
				value: sort,
				onChange: setSort,
				options: [
					...SORT_STATUS,
					...SORT_ALPHA,
					...SORT_DATE,
					...SORT_EQUIP,
					...SORT_TECH
				],
				className: "shrink-0"
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-3 overflow-hidden rounded-xl border border-border bg-card",
			children: [rows.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => setSelected(m.id),
				className: "desk-lift grid w-full gap-1 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/60 md:grid-cols-[8rem_1fr_8rem_8rem] md:items-center",
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
			className: "flex flex-wrap items-center gap-2",
			"data-testid": "list-toolbar",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative w-56 shrink-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: q,
						onChange: (e) => setQ(e.target.value),
						placeholder: "Search providers…",
						className: "h-9 pl-9",
						"aria-label": "Search providers"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
					className: "h-9 w-44 shrink-0",
					value: status,
					onChange: (e) => setStatus(e.target.value),
					allowEmpty: true,
					emptyLabel: "Any status",
					"aria-label": "Filter by status",
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
					className: "h-9 w-28 shrink-0",
					value: state,
					onChange: (e) => setState(e.target.value),
					allowEmpty: true,
					emptyLabel: "State",
					"aria-label": "Filter by state",
					children: states.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
					value: sort,
					onChange: setSort,
					options: [...SORT_ALPHA],
					className: "shrink-0"
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
					className: "desk-lift grid min-w-0 gap-1 rounded-md px-2 py-2.5 text-left hover:bg-muted/60 md:grid-cols-[1fr_11rem_7rem] md:items-center",
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
			className: "flex flex-wrap items-center gap-2",
			"data-testid": "list-toolbar",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative w-56 shrink-0",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: q,
					onChange: (e) => setQ(e.target.value),
					placeholder: "Search accounts…",
					className: "h-9 pl-9",
					"aria-label": "Search accounts"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
				className: "h-9 w-28 shrink-0",
				value: state,
				onChange: (e) => setState(e.target.value),
				allowEmpty: true,
				emptyLabel: "State",
				"aria-label": "Filter by state",
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
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(StatRow, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
				label: "Active deals",
				value: active.length,
				selected: view === "open",
				onClick: () => setView((v) => toggleChip(v, "open", "all"))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
				label: "Active pipeline",
				value: money(sum(active)),
				selected: view === "open",
				onClick: () => setView((v) => toggleChip(v, "open", "all"))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
				label: "Completed",
				value: completed.length,
				hint: money(sum(completed)),
				selected: view === "complete",
				onClick: () => setView((v) => toggleChip(v, "complete", "all"))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
				label: "Total booked",
				value: money(sum(live)),
				selected: view === "all",
				onClick: () => setView("all")
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
				label: "Good to order",
				value: gtoN,
				hint: "Step 1 — waiting to be ordered",
				selected: view === "gto",
				onClick: () => setView((v) => toggleChip(v, "gto", "all"))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
				label: "Ordered",
				value: orderedN,
				hint: "Step 2 — confirmed ordered",
				selected: view === "ordered",
				onClick: () => setView((v) => toggleChip(v, "ordered", "all"))
			})
		] }),
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
			className: "mt-6 flex flex-wrap items-center gap-2",
			"data-testid": "list-toolbar",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: q,
					onChange: (e) => setQ(e.target.value),
					placeholder: "Filter…",
					className: "h-9 w-56 shrink-0",
					"aria-label": "Filter deals"
				}),
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
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RepFilter, {
					value: repFilter,
					onChange: setRepFilter,
					extraNames: all.map((d) => d.producer),
					className: "h-9 w-44 shrink-0"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
					value: sort,
					onChange: setSort,
					options: SORT_DEALS,
					className: "shrink-0"
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
	const days = WEEKDAYS.map((_, i) => addDays(week.start, i));
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
	const open = (0, import_react.useMemo)(() => installs.filter((i) => isOpenInstall(i)), [installs]);
	const rows = (0, import_react.useMemo)(() => {
		let list = open;
		if (rep === "__none__") list = list.filter((i) => i.noRep);
		else if (rep) list = list.filter((i) => sameRep(i.accountRep, rep));
		if (ready === "ready") list = list.filter((i) => siteIsReady(i.equipStatus, i.inspection?.overall));
		if (ready === "not") list = list.filter((i) => !siteIsReady(i.equipStatus, i.inspection?.overall));
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
								WEEKDAYS[i],
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
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, {
													tight: true,
													status: i.equipStatus === "Ready" ? "Ready" : "Not Ready"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InspectionBadge, {
													overall: i.inspection?.overall,
													passed: i.inspection?.passedCount,
													total: i.inspection?.machineCount
												}),
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
var Route$8 = createFileRoute("/_app/planner")({
	codeSplitGroupings: [],
	component: Page$7
});
function Page$7() {
	const { matchMine, filterMine, role } = useMyView();
	const work = usePlannerWork();
	const recs = useQuery({
		queryKey: ["recipes"],
		queryFn: () => listRecipes()
	});
	const installs = work.installs;
	const mineRep = filterMine && role === "sales" ? installs.find((i) => matchMine(i.accountRep))?.accountRep ?? null : null;
	const catalog = (0, import_react.useMemo)(() => catalogModels(installs.map((i) => i.equipment ?? "")), [installs]);
	const [tab, setTab] = (0, import_react.useState)("calendar");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-medium tracking-tight",
				children: "Planner"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-xl text-sm text-muted-foreground",
				children: "Month calendar of pending work. Drag a job to another day. Timeline is the second tab."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CalendarDockButton, {})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 flex flex-wrap gap-2",
			"data-testid": "planner-tabs",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterChip, {
				selected: tab === "calendar",
				onClick: () => setTab("calendar"),
				children: "Calendar"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterChip, {
				selected: tab === "timeline",
				onClick: () => setTab("timeline"),
				children: "Timeline"
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-4",
			children: work.loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-64 w-full" }) : tab === "calendar" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlannerCalendar, {
				installs: work.installs,
				pms: work.pms,
				services: work.services,
				tlcs: work.tlcs
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InstallPlanner, {
				installs,
				recipes: recs.data ?? [],
				catalog,
				myRep: mineRep
			})
		})
	] });
}
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
		if (view === "active") list = list.filter((p) => isOpenPm(p));
		if (view === "flagged") list = list.filter((p) => p.flag);
		if (view === "need-date") list = list.filter((p) => isOpenPm(p) && !p.projected);
		list = mineByTechnician(list, {
			filterMine,
			role,
			matchMine
		});
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
	const active = all.filter((p) => isOpenPm(p));
	const flagged = all.filter((p) => p.flag);
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
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionMenu, {
					label: "Export",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExportButton, { defaultType: "pms" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					onClick: () => setCreate(true),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "New PM"]
				})]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(StatRow, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
				label: "Active",
				value: active.length,
				hint: `${all.length} in history`,
				selected: view === "active",
				onClick: () => setView((v) => toggleChip(v, "active", "all"))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
				label: "Flagged",
				value: flagged.length,
				tone: flagged.length ? "warn" : void 0,
				hint: "Inside 14 days or slipped",
				selected: view === "flagged",
				onClick: () => setView((v) => toggleChip(v, "flagged", "all"))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
				label: "Need a date",
				value: needDate,
				tone: needDate ? "warn" : void 0,
				hint: "Active PMs with no projected date",
				selected: view === "need-date",
				onClick: () => setView((v) => toggleChip(v, "need-date", "all"))
			})
		] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 flex flex-wrap items-center gap-2",
			"data-testid": "list-toolbar",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				value: q,
				onChange: (e) => setQ(e.target.value),
				placeholder: "Search PMs…",
				className: "h-9 w-56 shrink-0",
				"aria-label": "Search PMs"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
				value: sort,
				onChange: setSort,
				options: SORT_LIST,
				className: "shrink-0"
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 overflow-hidden rounded-xl border border-border bg-card",
			children: [rows.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => setSelected(p.id),
				className: "desk-lift grid w-full gap-1 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/60 md:grid-cols-[1.3fr_1fr_8rem_8rem_7rem] md:items-center",
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
			}, p.id)), rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "px-4 py-8",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: q.trim() ? "Nothing matches this search." : "No PMs in this view."
				}), !q.trim() && view === "active" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					type: "button",
					size: "sm",
					className: "mt-3",
					onClick: () => setCreate(true),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "New PM"]
				}) : null]
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
function HealthBadge$1({ health }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		variant: health === "overdue" ? "danger" : health === "at-risk" || health === "no-date" ? "warn" : health === "done" ? "outline" : "success",
		children: HEALTH_LABEL[health]
	});
}
function RebuildBoard({ rows, canEdit, onOpen }) {
	const qc = useQueryClient();
	const [dragId, setDragId] = (0, import_react.useState)(null);
	const [overStatus, setOverStatus] = (0, import_react.useState)(null);
	const dragged = (0, import_react.useRef)(false);
	const save = useMutation({
		mutationFn: (d) => updateRebuild({ data: d }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["rebuilds"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not move")
	});
	const remove = useMutation({
		mutationFn: (id) => archiveRebuild({ data: { id } }),
		onSuccess: () => {
			toast.success("Rebuild removed from the board");
			qc.invalidateQueries({ queryKey: ["rebuilds"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["activity"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove")
	});
	function dropOn(status) {
		if (!canEdit || dragId == null) return;
		const row = rows.find((r) => r.id === dragId);
		setDragId(null);
		setOverStatus(null);
		if (!row || row.status === status) return;
		if (status === "Waiting" && !row.reasonCode) {
			toast.message("Waiting needs a reason delayed. Open the card to add one.");
			onOpen(row.id);
			return;
		}
		if (row.status === "Queued" && (!row.owner || !row.targetComplete)) {
			toast.message("Assign an owner and a target complete date before leaving Queued.");
			onOpen(row.id);
			return;
		}
		save.mutate({
			id: row.id,
			status
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [canEdit ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "mb-2 text-xs text-muted-foreground",
		children: "Drag a project into the next column as work moves. Remove takes it off the board without deleting history."
	}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-w-0 gap-3 overflow-x-auto pb-2",
		children: REBUILD_STATUSES.map((status) => {
			const cards = rows.filter((r) => r.status === status);
			const hot = overStatus === status && dragId != null;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				"data-testid": `rebuild-col-${status}`,
				className: cn("flex w-64 shrink-0 flex-col rounded-xl border border-border bg-muted/40 transition-colors", hot && "border-primary bg-primary/8 ring-2 ring-primary/40"),
				onDragOver: (e) => {
					if (!canEdit || dragId == null) return;
					e.preventDefault();
					e.dataTransfer.dropEffect = "move";
					if (overStatus !== status) setOverStatus(status);
				},
				onDragLeave: (e) => {
					if (e.currentTarget.contains(e.relatedTarget)) return;
					if (overStatus === status) setOverStatus(null);
				},
				onDrop: (e) => {
					e.preventDefault();
					dropOn(status);
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
					className: "flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2",
					children: cards.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: cn("rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground", hot && "border-primary/50 text-primary"),
						children: hot ? "Drop here" : "Empty"
					}) : cards.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
						draggable: canEdit,
						onDragStart: (e) => {
							if (!canEdit) return;
							dragged.current = true;
							e.dataTransfer.setData("text/plain", String(r.id));
							e.dataTransfer.effectAllowed = "move";
							setDragId(r.id);
						},
						onDragEnd: () => {
							setDragId(null);
							setOverStatus(null);
							window.setTimeout(() => {
								dragged.current = false;
							}, 80);
						},
						onClick: () => {
							if (dragged.current) return;
							onOpen(r.id);
						},
						"data-testid": `rebuild-card-${r.id}`,
						className: cn("desk-lift w-full select-none rounded-lg border border-border bg-card p-3 text-left shadow-sm hover:border-primary/40", canEdit && "cursor-grab active:cursor-grabbing", r.health === "overdue" && "border-destructive/40", r.health === "at-risk" && "border-warning/40", r.health === "no-date" && "border-warning/30", dragId === r.id && "opacity-40"),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-start gap-1.5",
								children: [
									canEdit ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "mt-0.5 text-muted-foreground",
										"aria-hidden": true,
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GripVertical, { className: "size-4" })
									}) : null,
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "min-w-0 flex-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "font-medium leading-snug",
											children: r.title
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "mt-0.5 truncate text-xs text-muted-foreground",
											children: [
												r.equipment || "No equipment",
												" · ",
												r.account
											]
										})]
									}),
									canEdit ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive",
										"aria-label": `Remove ${r.title}`,
										"data-testid": `rebuild-remove-${r.id}`,
										disabled: remove.isPending,
										onClick: (e) => {
											e.stopPropagation();
											if (!window.confirm(`Remove “${r.title}” from rebuilds? It leaves the board. Notes stay in history.`)) return;
											remove.mutate(r.id);
										},
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" })
									}) : null
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
	})] });
}
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
		if (owner) next = next.filter((r) => sameTech(r.owner, owner) || (r.owner ?? "").trim() === owner);
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
	const drop = useMutation({
		mutationFn: () => archiveRebuild({ data: { id: row.id } }),
		onSuccess: () => {
			toast.success("Rebuild removed from the board");
			qc.invalidateQueries({ queryKey: ["rebuilds"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["activity"] });
			onClose();
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove")
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
							children: [
								canEdit ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									type: "submit",
									disabled: save.isPending,
									children: save.isPending ? "Saving…" : "Save"
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-muted-foreground",
									children: "Sales can view this rebuild. Bench status is service-owned."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PingButton, {
									entityType: "rebuild",
									entityId: row.id,
									contextLabel: `${row.title} · ${row.account}`,
									defaultNote: `${row.title} at ${row.account}`
								}),
								canEdit ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									type: "button",
									variant: "outline",
									className: "ml-auto text-destructive hover:bg-destructive/10",
									disabled: drop.isPending,
									"data-testid": "rebuild-sheet-remove",
									onClick: () => {
										if (!window.confirm(`Remove “${row.title}” from rebuilds? It leaves the board. Notes stay in history.`)) return;
										drop.mutate();
									},
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), "Remove project"]
								}) : null
							]
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
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(StatRow, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
				label: "Overdue",
				value: overdue,
				tone: overdue ? "danger" : "ok",
				hint: "Past target, still open",
				selected: chip === "overdue",
				onClick: () => setChip((c) => toggleChip(c, "overdue", "all"))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
				label: "At risk",
				value: atRisk,
				tone: atRisk ? "warn" : "ok",
				hint: "Waiting, or target within 3 days",
				selected: chip === "at-risk",
				onClick: () => setChip((c) => toggleChip(c, "at-risk", "all"))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
				label: "Waiting",
				value: waiting,
				hint: "Needs a reason delayed",
				selected: chip === "waiting",
				onClick: () => setChip((c) => toggleChip(c, "waiting", "all"))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
				label: "No date",
				value: noDate,
				tone: noDate ? "warn" : "ok",
				hint: "In progress / waiting / testing with no target",
				selected: chip === "no-date",
				onClick: () => setChip((c) => toggleChip(c, "no-date", "all"))
			})
		] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 flex flex-wrap items-center gap-2",
			"data-testid": "list-toolbar",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					className: "h-9 w-64 shrink-0",
					value: q,
					onChange: (e) => setQ(e.target.value),
					placeholder: "Search project, account, serial…",
					"aria-label": "Search rebuilds"
				}),
				FILTERS.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setChip(f.id),
					className: cn("inline-flex h-9 shrink-0 items-center rounded-full border px-3 text-sm", chip === f.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"),
					children: f.label
				}, f.id)),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex shrink-0 gap-1",
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
	const [housePick, setHousePick] = (0, import_react.useState)("");
	const [customerPick, setCustomerPick] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		if (open != null) setSelected(open);
	}, [open]);
	const rows = recs.data ?? [];
	const current = typeof selected === "number" ? rows.find((r) => r.id === selected) ?? null : null;
	const house = (0, import_react.useMemo)(() => rows.filter((r) => !r.customer), [rows]);
	const customerRecipes = (0, import_react.useMemo)(() => rows.filter((r) => !!r.customer), [rows]);
	function houseLabel(r) {
		return house.filter((x) => x.equipmentModel === r.equipmentModel).length > 1 ? `${r.equipmentModel} · ${r.id}` : r.equipmentModel;
	}
	function customerLabel(r) {
		return `${r.customer} · ${r.equipmentModel}`;
	}
	(0, import_react.useEffect)(() => {
		if (!current) return;
		if (!current.customer) {
			setHousePick(houseLabel(current));
			setCustomerPick("");
		} else {
			setCustomerPick(customerLabel(current));
			setHousePick("");
		}
	}, [current?.id, rows.length]);
	const models = (0, import_react.useMemo)(() => catalogModels([...(directoryEquip.data ?? []).map((e) => e.name), ...rows.map((r) => r.equipmentModel)]), [directoryEquip.data, rows]);
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
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-medium tracking-tight",
				children: "Recipes"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-xl text-sm text-muted-foreground",
				children: "Settings live on a customer + machine. House templates can be edited and assigned to a customer. Fields start blank — nothing is filled in automatically."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				onClick: () => {
					setSelected("new");
					setHousePick("");
					setCustomerPick("");
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "New recipe"]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-6 grid gap-3 sm:grid-cols-2",
			"data-testid": "recipe-pickers",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ComboField, {
				label: "House template",
				value: housePick,
				allowCreate: false,
				noun: "template",
				placeholder: "Search house templates…",
				emptyHint: "No house templates",
				items: house.map((r) => ({
					id: r.id,
					name: houseLabel(r)
				})),
				onChange: (name) => {
					setHousePick(name);
					setCustomerPick("");
					const hit = house.find((r) => houseLabel(r) === name);
					setSelected(hit ? hit.id : null);
				}
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ComboField, {
				label: "Customer template",
				value: customerPick,
				allowCreate: false,
				noun: "template",
				placeholder: customerRecipes.length ? "Search customer templates…" : "No customer templates",
				emptyHint: "No customer templates",
				items: customerRecipes.map((r) => ({
					id: r.id,
					name: customerLabel(r)
				})),
				onChange: (name) => {
					setCustomerPick(name);
					setHousePick("");
					const hit = customerRecipes.find((r) => customerLabel(r) === name);
					setSelected(hit ? hit.id : null);
				}
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
			className: "mt-4 rounded-xl border border-border bg-card p-5",
			children: selected == null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: "Pick a house template or a customer template. The recipe opens here — no second page."
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
			}, current?.id ?? "new")
		})
	] });
}
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
				onPointerDownOutside: (e) => {
					if (document.querySelector("[data-testid=add-customer-form]")) e.preventDefault();
				},
				onInteractOutside: (e) => {
					if (document.querySelector("[data-testid=add-customer-form]")) e.preventDefault();
				},
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
	const qc = useQueryClient();
	const items = (0, import_react.useMemo)(() => dir.items.filter((i) => !isWalkIn(i.name)), [dir.items]);
	const [adding, setAdding] = (0, import_react.useState)(false);
	const [newName, setNewName] = (0, import_react.useState)("");
	const [rep, setRep] = (0, import_react.useState)("");
	const [ak, setAk] = (0, import_react.useState)(false);
	const [saving, setSaving] = (0, import_react.useState)(false);
	const known = items.some((i) => i.name.trim().toLowerCase() === value.trim().toLowerCase() && !isWalkIn(value));
	function openAdd() {
		const seed = keepWalkIn || isWalkIn(value) ? "" : value.trim();
		setNewName(seed);
		setRep("");
		setAk(false);
		setAdding(true);
	}
	async function confirmAdd(e) {
		e.preventDefault();
		e.stopPropagation();
		const name = newName.trim();
		if (!name) {
			toast.error("Enter a customer name.");
			return;
		}
		if (isWalkIn(name)) {
			toast.error("Pick a real account name — Walk-In is not a KatzDesk customer.");
			return;
		}
		setSaving(true);
		try {
			const row = await addDirectoryEntry({ data: {
				kind: "customer",
				name
			} });
			if (rep || ak) await updateCustomerAccount({ data: {
				id: row.id,
				accountRep: rep || null,
				aviKatz: ak
			} });
			qc.setQueryData(["directory", "customer"], (old) => {
				const list = old ?? [];
				if (list.some((i) => i.id === row.id || i.name.toLowerCase() === row.name.toLowerCase())) return list.map((i) => i.id === row.id ? row : i);
				return [...list, row].sort((a, b) => a.name.localeCompare(b.name));
			});
			qc.invalidateQueries({ queryKey: ["directory", "customer"] });
			qc.invalidateQueries({ queryKey: ["customers"] });
			onChange(row.name);
			setAdding(false);
			toast.success(`Added ${row.name}`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Could not add customer");
		} finally {
			setSaving(false);
		}
	}
	if (adding) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
		className: "min-w-[16rem] space-y-2 rounded-lg border border-border bg-muted/40 p-2",
		"data-testid": "add-customer-form",
		onSubmit: confirmAdd,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[11px] font-medium tracking-wide text-muted-foreground uppercase",
				children: "Add customer"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				required: true,
				value: newName,
				onChange: (e) => setNewName(e.target.value),
				placeholder: "Customer name",
				"aria-label": "New customer name",
				disabled: saving || disabled
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RepSelect, {
				label: "Rep",
				value: rep,
				onChange: setRep
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "flex items-center gap-2 text-xs",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "checkbox",
						className: "size-4 accent-primary",
						checked: ak,
						disabled: saving || disabled,
						onChange: (e) => setAk(e.target.checked)
					}),
					"Avi Katz account (AK)",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AkBadge, { on: ak })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "submit",
					size: "sm",
					disabled: saving || disabled || !newName.trim(),
					children: saving ? "Adding…" : "Add"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					size: "sm",
					variant: "outline",
					disabled: saving,
					onClick: () => setAdding(false),
					children: "Cancel"
				})]
			})
		]
	});
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
			emptyHint: "No customer matches. Add customer to create an account, or search the list."
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-1 flex flex-wrap items-center gap-2",
			children: [
				dir.canAdd ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "text-xs font-medium text-primary underline-offset-2 hover:underline",
					"data-testid": "add-customer",
					disabled,
					onClick: openAdd,
					children: "Add customer"
				}) : null,
				walkIn ? keepWalkIn ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "text-xs text-muted-foreground underline-offset-2 hover:underline",
					onClick: onClearKeep,
					children: "Choose a customer instead"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "text-xs text-muted-foreground underline-offset-2 hover:underline",
					onClick: onKeepWalkIn,
					children: "Keep as Walk-In"
				}) : null,
				existingCustomer && !isWalkIn(existingCustomer) ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "text-xs text-muted-foreground",
					children: ["Now: ", existingCustomer]
				}) : needsCustomer ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-xs text-warning",
					children: "Pick an account"
				}) : !known && value.trim() && !keepWalkIn && !isWalkIn(value) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-xs text-warning",
					children: "Not on the list — add this customer"
				}) : null
			]
		})]
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
		if (view === "active") list = list.filter((j) => !j.duplicateOf && isOpenCall(j));
		if (view === "flagged") list = list.filter((j) => j.flag || j.duplicateOf || (j.siblings?.length ?? 0) > 0);
		if (view === "unassigned") list = list.filter((j) => !j.duplicateOf && isOpenCall(j) && !j.technician);
		if (view === "complete") list = list.filter((j) => !j.duplicateOf && isClosedCall(j));
		if (tech) list = list.filter((j) => sameTech(j.technician, tech));
		list = mineByTechnician(list, {
			filterMine,
			role,
			matchMine
		});
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
	const activeCount = liveJobs.filter((j) => isOpenCall(j)).length;
	const flagCount = (jobs.data ?? []).filter((j) => j.flag || j.duplicateOf || (j.siblings?.length ?? 0) > 0).length;
	const allJobs = liveJobs;
	const unassignedCount = allJobs.filter((j) => isOpenCall(j)).filter((j) => !j.technician).length;
	const completeCount = liveJobs.filter((j) => isClosedCall(j)).length;
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
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ActionMenu, {
					label: "Import / Export",
					children: [kind === "service" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CorrigoImportButton, { onImported: setReview }) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExportButton, { defaultType: kind === "tlc" ? "tlc" : "pending" })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					onClick: () => setCreate(true),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "New call"]
				})]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(StatRow, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
				label: "Active",
				value: activeCount,
				hint: `${allJobs.length} in history`,
				selected: view === "active",
				onClick: () => setView((v) => toggleChip(v, "active", "all"))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
				label: "Flagged",
				value: flagCount,
				tone: flagCount ? "danger" : void 0,
				hint: kind === "service" ? "48-hour clock" : "2-week clock",
				selected: view === "flagged",
				onClick: () => setView((v) => toggleChip(v, "flagged", "all"))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
				label: "Unassigned",
				value: unassignedCount,
				hint: "Active calls with no tech",
				selected: view === "unassigned",
				onClick: () => setView((v) => toggleChip(v, "unassigned", "all"))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
				label: "Complete",
				value: completeCount,
				hint: "Closed tickets",
				selected: view === "complete",
				onClick: () => setView((v) => toggleChip(v, "complete", "all"))
			})
		] }),
		kind === "service" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CorrigoReviewList, {
			items: review,
			onDismiss: () => setReview([])
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 flex flex-wrap items-center gap-2",
			"data-testid": "list-toolbar",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: q,
					onChange: (e) => setQ(e.target.value),
					placeholder: "Search tickets…",
					className: "h-9 w-56 shrink-0",
					"aria-label": "Search tickets"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TechFilter, {
					value: tech,
					onChange: setTech,
					extraNames: (jobs.data ?? []).map((j) => j.technician),
					className: "h-9 w-40 shrink-0"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
					value: urgency,
					onChange: (e) => setUrgency(e.target.value),
					allowEmpty: true,
					emptyLabel: "All urgency",
					"aria-label": "Filter by urgency",
					className: "h-9 w-40 shrink-0",
					children: URGENCIES.map((u) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: u }, u))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
					value: sort,
					onChange: setSort,
					options: SORT_LIST,
					className: "shrink-0"
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
				}) : rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "px-4 py-8",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted-foreground",
						children: q.trim() || tech || urgency ? "Nothing matches this search." : view === "active" ? "No open tickets." : "Nothing in this view."
					}), !q.trim() && !tech && !urgency && view === "active" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						type: "button",
						size: "sm",
						className: "mt-3",
						onClick: () => setCreate(true),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "New call"]
					}) : null]
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
		className: "desk-lift grid w-full gap-1 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/60 md:grid-cols-[1.4fr_1fr_6rem_7rem_7rem_7rem_6rem] md:items-center md:gap-3",
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
	const me = useQuery({
		queryKey: ["access", "me"],
		queryFn: () => getMyAccess()
	});
	const canStock = !!me.data?.isAdmin || me.data?.role === "warehouse";
	const [rack, setRack] = (0, import_react.useState)("barn-back");
	const [q, setQ] = (0, import_react.useState)("");
	const [slot, setSlot] = (0, import_react.useState)(null);
	const [selected, setSelected] = useOpenRecord(open);
	const [movingId, setMovingId] = (0, import_react.useState)(null);
	const [moveDraft, setMoveDraft] = (0, import_react.useState)(emptyPlaceDraft());
	const [create, setCreate] = (0, import_react.useState)(false);
	const [sort, setSort] = useDeskSort("warehouse", "alpha-asc");
	const [bubble, setBubble] = (0, import_react.useState)(null);
	const [bayLetter, setBayLetter] = (0, import_react.useState)(null);
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
	const stranded = (0, import_react.useMemo)(() => barn.filter((a) => a.needsBay), [barn]);
	const list = (0, import_react.useMemo)(() => {
		let rows = slot ? slotUnits : onRack.filter((a) => a.kind === "equip" || a.kind === "dispenser");
		if (!slot) {
			const ids = new Set(rows.map((a) => a.id));
			for (const a of stranded) if (!ids.has(a.id)) rows = [...rows, a];
		}
		if (bubble === "dispensers") rows = rows.filter((a) => a.kind === "dispenser");
		if (bubble === "missing") rows = rows.filter((a) => a.missingSerial);
		if (bubble === "needs-bay") rows = stranded;
		if (bubble === "needs-test") rows = rows.filter((a) => a.shopTest === "needs-test");
		if (bubble === "tested") rows = rows.filter((a) => a.shopTest === "tested");
		if (bubble === "review") rows = rows.filter((a) => a.reviewStatus === "pending");
		if (bubble === "ready") rows = rows.filter((a) => a.kind === "equip" && a.status === "ready");
		if (bayLetter) rows = barn.filter((a) => (a.pallet ?? "").toUpperCase() === bayLetter);
		if (needle) rows = barn.filter((a) => [
			a.model,
			a.serial,
			a.slotLabel,
			a.customerOwned,
			a.pallet
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
		sort,
		bubble,
		bayLetter,
		stranded,
		rack
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
				children: "Ready-to-deploy units at HQ. Slot ID is pallet + level — A-L3 is pallet A, third shelf. Pull a unit for an install or a service account and it leaves this board. Bays run A through P."
			})] }), canStock ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				onClick: () => setCreate(true),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "Add to rack"]
			}) : null]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(StatRow, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
				label: "Ready",
				value: equipReady,
				hint: `${models} models · ${Math.max(0, BARN_EQUIP_CAPACITY - equipLines)} open slots`,
				breakdown: readyByModel,
				selected: bubble === "ready" && !bayLetter,
				onClick: () => {
					setBayLetter(null);
					setSlot(null);
					setBubble((v) => toggleChip(v, "ready", null));
				}
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
				label: "Fill",
				value: `${Math.round(equipLines / BARN_EQUIP_CAPACITY * 100)}%`,
				hint: `${equipLines} lines on the rack`,
				selected: bubble === "fill" && !bayLetter,
				onClick: () => {
					setBayLetter(null);
					setSlot(null);
					setBubble((v) => toggleChip(v, "fill", null));
				}
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
				label: "Dispensers",
				value: dispQty,
				hint: "Not counted in Ready",
				selected: bubble === "dispensers" && !bayLetter,
				onClick: () => {
					setBayLetter(null);
					setSlot(null);
					setBubble((v) => toggleChip(v, "dispensers", null));
				}
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
				label: "Missing serial",
				value: missing,
				tone: missing ? "warn" : void 0,
				hint: `${owned} customer-owned · ${catering} catering`,
				selected: bubble === "missing" && !bayLetter,
				onClick: () => {
					setBayLetter(null);
					setSlot(null);
					setBubble((v) => toggleChip(v, "missing", null));
				}
			}),
			stranded.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
				label: "Needs bay",
				value: stranded.length,
				tone: "warn",
				hint: "Letter Q or after P — assign A–P",
				selected: bubble === "needs-bay",
				onClick: () => {
					setBayLetter(null);
					setSlot(null);
					setBubble((v) => toggleChip(v, "needs-bay", null));
				}
			}) : null
		] }),
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
			className: "mt-5 flex flex-wrap items-center gap-2",
			"data-testid": "list-toolbar",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: q,
					onChange: (e) => setQ(e.target.value),
					placeholder: "Find model or serial…",
					className: "h-9 w-56 shrink-0",
					"aria-label": "Find model or serial"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterChip, {
					selected: rack === "barn-back",
					onClick: () => {
						setRack("barn-back");
						setSlot(null);
					},
					children: "Back rack"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterChip, {
					selected: rack === "barn-front",
					onClick: () => {
						setRack("barn-front");
						setSlot(null);
					},
					children: "Front rack"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterChip, {
					selected: bubble === "needs-test",
					onClick: () => setBubble((v) => toggleChip(v, "needs-test", null)),
					children: "Needs test"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterChip, {
					selected: bubble === "tested",
					onClick: () => setBubble((v) => toggleChip(v, "tested", null)),
					children: "Tested"
				}),
				canStock ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterChip, {
					selected: bubble === "review",
					onClick: () => setBubble((v) => toggleChip(v, "review", null)),
					children: "Pending review"
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
					value: sort,
					onChange: setSort,
					options: [
						...SORT_ALPHA,
						...SORT_DATE,
						...SORT_EQUIP,
						...SORT_STATUS
					],
					className: "shrink-0"
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mr-1 inline-block size-2 rounded-sm bg-catering" }), "Catering A–D"] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mr-1 inline-block size-2 rounded-sm bg-dispense" }), "Dispenser E–F"] }),
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
					const picked = bayLetter === p;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: cn("px-0.5 pb-2 text-[11px] font-medium", bay === "catering" && "text-catering", bay === "dispenser" && "text-dispense"),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: cn("inline-flex min-w-8 items-center justify-center rounded-full px-1.5 py-0.5", picked && "bg-primary text-primary-foreground"),
							onClick: () => setBayLetter((cur) => cur === p ? null : p),
							"aria-pressed": picked,
							children: p
						})
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
							"data-testid": n === 0 ? `slot-${p}-L${level}` : void 0,
							"aria-label": n === 0 && canStock ? `Add to ${p}-L${level}` : `${p}-L${level} ${n} of 12`,
							children: n === 0 ? canStock ? "Add" : "·" : n
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
			children: [
				list.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "border-b border-border last:border-b-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "px-4 py-3",
						"data-testid": a.serial ? `rack-row-${a.serial}` : void 0,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-start gap-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setSelected(a.id),
									className: "w-28 shrink-0 text-left font-mono text-xs",
									children: a.slotLabel
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => setSelected(a.id),
									className: "min-w-0 flex-1 text-left",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-medium",
										children: a.model
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "mt-0.5 block text-xs text-muted-foreground",
										children: [
											a.serial ?? "No serial",
											a.qty > 1 ? ` · qty ${a.qty}` : "",
											a.customerOwned ? ` · ${a.customerOwned}` : ""
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "flex w-full flex-col gap-1 sm:w-auto sm:min-w-36",
									"data-testid": "shop-col",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "flex flex-wrap gap-1",
										children: [
											a.needsBay ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "Needs bay" }) : null,
											a.reviewStatus === "pending" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "Pending review" }) : null,
											a.shopTest === "tested" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "Tested" }) : null,
											a.shopTest === "needs-test" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "Needs test" }) : null,
											a.missingSerial ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "Serial missing" }) : null,
											a.customerOwned ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "Customer-owned" }) : null,
											a.kind === "dispenser" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "Accessory" }) : null
										]
									}), a.shopTest === "tested" && (a.shopTestBy || a.shopTestNote) ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-[11px] text-muted-foreground",
										children: [
											a.shopTestBy ? `Tested by ${a.shopTestBy}` : "Tested",
											a.shopTestAt ? ` · ${a.shopTestAt.slice(0, 16).replace("T", " ")}` : "",
											a.shopTestNote ? ` · ${a.shopTestNote}` : ""
										]
									}) : a.shopTestNote ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[11px] text-muted-foreground",
										children: a.shopTestNote
									}) : null]
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "mt-2 flex flex-wrap items-center gap-2",
							children: [
								canStock ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									type: "button",
									size: "sm",
									variant: a.shopTest === "needs-test" ? "default" : "outline",
									"data-testid": a.serial ? `needs-test-${a.serial}` : void 0,
									onClick: () => void setShopTest({ data: {
										id: a.id,
										shopTest: "needs-test"
									} }).then(() => {
										toast.success("Needs test");
										qc.invalidateQueries({ queryKey: ["assets"] });
									}).catch((e) => toast.error(e instanceof Error ? e.message : "Could not update")),
									children: "Needs test"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									type: "button",
									size: "sm",
									variant: a.shopTest === "tested" ? "default" : "outline",
									"data-testid": a.serial ? `mark-tested-${a.serial}` : void 0,
									onClick: () => void setShopTest({ data: {
										id: a.id,
										shopTest: "tested"
									} }).then(() => {
										toast.success("Tested");
										qc.invalidateQueries({ queryKey: ["assets"] });
									}).catch((e) => toast.error(e instanceof Error ? e.message : "Could not update")),
									children: "Tested"
								})] }) : a.shopTest === "tested" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-xs text-muted-foreground",
									children: ["Tested", a.shopTestBy ? ` · ${a.shopTestBy}` : ""]
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-sm text-muted-foreground",
									children: a.pallet && a.level ? `Barn · ${slotId(a.pallet, a.level)}` : a.slotLabel
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									type: "button",
									size: "sm",
									variant: movingId === a.id ? "default" : "outline",
									"data-testid": a.serial ? `move-${a.serial}` : void 0,
									onClick: () => {
										setMoveDraft(emptyPlaceDraft());
										setMovingId((cur) => cur === a.id ? null : a.id);
									},
									children: "Move"
								})
							]
						})]
					}), movingId === a.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-end gap-2 px-4 pb-3",
						"data-testid": "warehouse-move",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlacePicker, {
								value: moveDraft,
								onChange: setMoveDraft
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "button",
								size: "sm",
								disabled: !!placeDraftError(moveDraft),
								onClick: async () => {
									const err = placeDraftError(moveDraft);
									if (err) {
										toast.error(err);
										return;
									}
									try {
										const place = await setAssetPlace({ data: {
											id: a.id,
											site: moveDraft.site,
											pallet: moveDraft.pallet || null,
											level: moveDraft.level ? Number(moveDraft.level) : null,
											otherLabel: moveDraft.otherLabel || null
										} });
										toast.success(place.place ? `Now at ${place.place}` : "Moved");
										setMovingId(null);
										qc.invalidateQueries({ queryKey: ["assets"] });
									} catch (e) {
										toast.error(e instanceof Error ? e.message : "Could not move");
									}
								},
								children: "Confirm"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "button",
								size: "sm",
								variant: "outline",
								onClick: () => setMovingId(null),
								children: "Cancel"
							})
						]
					}) : null]
				}, a.id)),
				canStock && slot ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SlotAdd, {
					slot,
					onPlaced: (id) => {
						qc.invalidateQueries({ queryKey: ["assets"] });
						qc.invalidateQueries({ queryKey: ["notifications"] });
						if (id) setSelected(id);
					}
				}) : null,
				slot && slotUnits.length === 0 && !needle && !canStock ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "px-4 py-8 text-sm text-muted-foreground",
					children: "This slot is empty."
				}) : list.length === 0 && !(canStock && slot) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "px-4 py-8 text-sm text-muted-foreground",
					children: "Nothing on this rack matches."
				}) : null
			]
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
				toast.success(row.reviewStatus === "pending" ? "On the rack · Needs review" : "On the rack");
				setSelected(row.id);
			}
		})
	] });
}
function SlotAdd({ slot, onPlaced }) {
	const [model, setModel] = (0, import_react.useState)("");
	const [serial, setSerial] = (0, import_react.useState)("");
	const [electrical, setElectrical] = (0, import_react.useState)("");
	const [pending, setPending] = (0, import_react.useState)(false);
	const [confirm, setConfirm] = (0, import_react.useState)(null);
	const label = slotId(slot.pallet, slot.level);
	async function save(force) {
		if (!model.trim()) {
			toast.error("Pick a model");
			return;
		}
		setPending(true);
		try {
			const res = await addToRackSlot({ data: {
				site: slot.rack,
				pallet: slot.pallet,
				level: slot.level,
				model: model.trim(),
				serial: serial.trim() || null,
				electrical: electrical.trim() || null,
				confirm: force
			} });
			if (res.needsConfirm) {
				setConfirm({
					id: res.id,
					place: res.currentPlace ?? "another place"
				});
				return;
			}
			toast.success(res.moved ? `Moved into ${label}${res.pendingReview ? " · Needs review" : ""}` : `Added to ${label}${res.pendingReview ? " · Needs review" : ""}`);
			setModel("");
			setSerial("");
			setElectrical("");
			setConfirm(null);
			onPlaced(res.id);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not add");
		} finally {
			setPending(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "border-b border-border px-4 py-4",
		"data-testid": "slot-add",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-sm font-medium",
				children: ["Add to ", label]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-muted-foreground",
				children: "Model and serial go in this slot. One serial stays one record. A serial already on the desk moves here after you confirm."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 grid gap-3 sm:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EquipmentCombo, {
						name: "slot-model",
						label: "Model",
						value: model,
						onChange: setModel,
						required: true
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "slot-serial",
						children: "Serial"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "slot-serial",
						className: "mt-1",
						value: serial,
						onChange: (e) => setSerial(e.target.value),
						"data-testid": "slot-serial"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "slot-electrical",
						children: "Electrical"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "slot-electrical",
						className: "mt-1",
						value: electrical,
						placeholder: "Optional, e.g. 120V",
						onChange: (e) => setElectrical(e.target.value)
					})] })
				]
			}),
			confirm ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-3 text-sm",
				children: [
					serial || "That serial",
					" is already at ",
					confirm.place,
					". Move it to ",
					label,
					"?"
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					size: "sm",
					disabled: pending,
					"data-testid": "slot-save",
					onClick: () => void save(!!confirm),
					children: confirm ? "Confirm move" : pending ? "Saving…" : "Add"
				}), confirm ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					size: "sm",
					variant: "outline",
					onClick: () => setConfirm(null),
					children: "Cancel"
				}) : null]
			})
		]
	});
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
function getRouter() {
	return createRouter({
		routeTree,
		defaultErrorComponent: AppErrorComponent
	});
}
//#endregion
export { getRouter, router_GWEnk_w1_exports as t };
