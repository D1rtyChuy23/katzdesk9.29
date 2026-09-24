import { r as __exportAll } from "../_runtime.mjs";
import { a as createAuthClient, o as genericOAuthClient } from "../_libs/better-auth+[...].mjs";
//#region src/lib/auth/client.ts
var client_exports = /* @__PURE__ */ __exportAll({
	authClient: () => authClient,
	authEnabled: () => true,
	getBearerToken: () => getBearerToken,
	signIn: () => signIn,
	signOut: () => signOut
});
/**
* Better Auth client for this React SPA (browser-side).
*
* Talks to this app's OWN Better Auth at same-origin `/api/auth/*`. In the live
* preview the app is an embedded iframe with PARTITIONED cookies, so after a
* popup sign-in it can't read the session cookie — it authenticates with a
* bearer token instead (captured from the popup, see `signIn`). The `onRequest`
* hook attaches that token when present; when deployed (cookie auth) no token
* is stored, so nothing changes.
*/
var authClient = createAuthClient({
	plugins: [genericOAuthClient()],
	sessionOptions: { refetchOnWindowFocus: false },
	fetchOptions: { onRequest(ctx) {
		const token = getBearerToken();
		if (token) ctx.headers.set("Authorization", `Bearer ${token}`);
		return ctx;
	} }
});
var BEARER_KEY = "grok-auth.bearer-token";
/** The stored preview bearer token, or null. */
function getBearerToken() {
	if (typeof window === "undefined") return null;
	try {
		return window.sessionStorage.getItem(BEARER_KEY);
	} catch {
		return null;
	}
}
function setBearerToken(token) {
	if (typeof window === "undefined") return;
	try {
		if (token) window.sessionStorage.setItem(BEARER_KEY, token);
		else window.sessionStorage.removeItem(BEARER_KEY);
	} catch {}
}
/**
* The sandbox live preview runs this app inside an iframe on a `*.grok-sandbox.com`
* host, where a full-page redirect to the broker can't work — so sign-in uses a
* popup there and a normal redirect everywhere else.
*/
function inLivePreview() {
	return typeof window !== "undefined" && window.location.hostname.endsWith(".grok-sandbox.com");
}
/**
* Start sign-in with one upstream provider (`providerId` from `GROK_PROVIDERS`),
* federating through the Grok auth broker.
*
* - **Live preview** (`*.grok-sandbox.com` iframe): opens a POPUP to
*   `/auth/popup`, served by the template Vite plugin (see `vite.config.ts` +
*   `popup.server.ts`) — 302s to the broker/upstream login (no app chrome) and,
*   on return, posts the session bearer token back. We store it and refresh the
*   session; no top-level navigation of the iframe to the broker.
* - **Deployed** (and local non-iframe): a normal full-page redirect into the broker.
*
* Either way it clears any existing local session FIRST so switching providers
* actually switches identity.
*/
async function signIn(providerId, opts = {}) {
	const callbackURL = opts.callbackURL ?? "/";
	const errorCallbackURL = opts.errorCallbackURL ?? "/";
	const popup = inLivePreview() ? openSignInPopup(providerId) : null;
	if (Boolean(getBearerToken()) || !inLivePreview()) try {
		await authClient.signOut();
	} catch {}
	setBearerToken(null);
	if (inLivePreview()) {
		if (!popup) throw new Error("Pop-up blocked — allow pop-ups for sign-in");
		const token = await waitForPopupToken(popup);
		if (!token) throw new Error("Sign-in was cancelled or failed");
		setBearerToken(token);
		try {
			await authClient.getSession();
		} catch {}
		if (typeof window !== "undefined") {
			const dest = new URL(callbackURL, window.location.origin);
			const here = window.location;
			if (dest.origin !== here.origin || dest.pathname !== here.pathname || dest.search !== here.search) window.location.href = callbackURL;
		}
		return;
	}
	const { data, error } = await authClient.signIn.oauth2({
		providerId,
		callbackURL,
		errorCallbackURL
	});
	if (error) throw new Error(error.message ?? "Sign-in failed");
	if (data?.url) window.location.href = data.url;
}
/**
* Open `/auth/popup` in a new window. Must run synchronously inside the click
* handler (no await before this). The path is served by the template Vite
* plugin (`authPopupPlugin` in vite.config.ts) — NOT by a React route.
*
* Opens the real URL directly (not about:blank → assign). From a cross-origin
* iframe the about:blank dance often fails on the first click and the window
* ends up showing the app shell.
*/
function openSignInPopup(providerId) {
	const url = `${window.location.origin}/auth/popup?providerId=${encodeURIComponent(providerId)}`;
	const name = `grok-signin-${Date.now()}`;
	return window.open(url, name, "popup,width=500,height=650");
}
/**
* Wait for the popup's completion page to postMessage the session bearer (or
* for the user to dismiss the popup).
*/
function waitForPopupToken(popup) {
	return new Promise((resolve) => {
		const origin = window.location.origin;
		let settled = false;
		let closeTimer;
		const settle = (token) => {
			if (settled) return;
			settled = true;
			cleanup();
			resolve(token);
		};
		const onMessage = (event) => {
			if (event.origin !== origin) return;
			const data = event.data;
			if (!data || data.source !== "grok-auth-popup") return;
			settle(data.token ?? null);
		};
		const pollTimer = window.setInterval(() => {
			if (!popup.closed) return;
			window.clearInterval(pollTimer);
			closeTimer = window.setTimeout(() => settle(null), 400);
		}, 300);
		function cleanup() {
			window.clearInterval(pollTimer);
			if (closeTimer !== void 0) window.clearTimeout(closeTimer);
			window.removeEventListener("message", onMessage);
		}
		window.addEventListener("message", onMessage);
	});
}
/** Sign out of THIS app's local session, clear the preview token, then redirect. */
async function signOut(redirectTo = "/") {
	try {
		await authClient.signOut();
	} finally {
		setBearerToken(null);
	}
	window.location.href = redirectTo;
}
//#endregion
export { signOut as i, client_exports as n, signIn as r, authClient as t };
