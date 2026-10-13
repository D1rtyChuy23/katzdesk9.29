import { n as auth, t as SESSION_TOKEN_COOKIE } from "./server.mjs";
//#region src/lib/auth/popup.server.ts
/**
* Live-preview sign-in popup — server-only (NEVER import from the client).
*
* The sandbox preview runs the app in a partitioned iframe, so OAuth must happen
* in a top-level popup (first-party cookies). This handler is the ENTIRE popup
* document — no React shell:
*
*   Phase 1 (`?providerId=…`): start OAuth server-side and 302 straight to the
*     broker / upstream login page. The popup never paints the app.
*   Phase 2 (`?done=1`): after the broker round-trip, emit a tiny HTML page that
*     posts the session token to the opener and closes. No SPA hydrate, no
*     server-fn round-trip.
*
* Wired automatically by the Vite `authPopupPlugin` in `vite.config.ts` during
* `npm run dev` (live preview). Do NOT create `src/routes/auth/popup.tsx` — a
* React route here paints the full app shell in the popup. The opener lives in
* `client.ts` (`signIn` → `openSignInPopup`).
*/
/**
* Handle `GET /auth/popup`. Invoked by the Vite `authPopupPlugin` (dev / live
* preview). Do not re-export this from a React route file.
*/
async function handleAuthPopupRequest(request) {
	const url = new URL(request.url);
	if (url.searchParams.get("done") === "1") {
		const errored = url.searchParams.has("error");
		const message = {
			source: "grok-auth-popup",
			token: errored ? null : readCookie(request, SESSION_TOKEN_COOKIE),
			...errored ? { error: url.searchParams.get("error") ?? "sign_in_failed" } : {}
		};
		return new Response(completionHtml(message), {
			status: 200,
			headers: {
				"content-type": "text/html; charset=utf-8",
				"cache-control": "no-store"
			}
		});
	}
	const providerId = url.searchParams.get("providerId")?.trim();
	if (!providerId) return new Response("Missing providerId", {
		status: 400,
		headers: { "content-type": "text/plain; charset=utf-8" }
	});
	const back = `${url.origin}/auth/popup?done=1`;
	try {
		const apiRes = await auth.api.signInWithOAuth2({
			body: {
				providerId,
				callbackURL: back,
				errorCallbackURL: `${back}&error=1`
			},
			headers: request.headers,
			asResponse: true
		});
		if (!apiRes.ok) return completionResponse({
			source: "grok-auth-popup",
			token: null,
			error: await apiRes.text().catch(() => "") || `oauth_init_failed_${apiRes.status}`
		});
		const location = (await apiRes.json().catch(() => null))?.url;
		if (!location) return completionResponse({
			source: "grok-auth-popup",
			token: null,
			error: "oauth_init_missing_url"
		});
		const headers = new Headers({
			location,
			"cache-control": "no-store"
		});
		for (const cookie of apiRes.headers.getSetCookie()) headers.append("set-cookie", cookie);
		return new Response(null, {
			status: 302,
			headers
		});
	} catch (err) {
		return completionResponse({
			source: "grok-auth-popup",
			token: null,
			error: err instanceof Error ? err.message : "oauth_init_threw"
		});
	}
}
function completionResponse(message) {
	return new Response(completionHtml(message), {
		status: 200,
		headers: {
			"content-type": "text/html; charset=utf-8",
			"cache-control": "no-store"
		}
	});
}
/** Minimal HTML: postMessage the token to the opener and close. No React. */
function completionHtml(message) {
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Signing in…</title>
<style>
  html,body{margin:0;min-height:100%;background:#0b0b0c;color:#a1a1aa;
    font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  main{min-height:100vh;display:grid;place-items:center;padding:1.5rem;text-align:center}
</style>
</head>
<body>
<main><p>Signing you in…</p></main>
<script type="application/json" id="grok-auth-popup-msg">${JSON.stringify(message).replace(/</g, "\\u003c")}<\/script>
<script>
(function () {
  var el = document.getElementById("grok-auth-popup-msg");
  var msg = { source: "grok-auth-popup", token: null };
  try { if (el && el.textContent) msg = JSON.parse(el.textContent); } catch (e) {}
  try {
    if (window.opener) window.opener.postMessage(msg, window.location.origin);
  } catch (e) {}
  try { window.close(); } catch (e) {}
})();
<\/script>
</body>
</html>`;
}
/** Read a single cookie value from the request (handles `=` inside values). */
function readCookie(request, name) {
	const header = request.headers.get("cookie");
	if (!header) return null;
	for (const part of header.split(";")) {
		const trimmed = part.trim();
		if (!trimmed) continue;
		const eq = trimmed.indexOf("=");
		if (eq <= 0) continue;
		if (trimmed.slice(0, eq) !== name) continue;
		const raw = trimmed.slice(eq + 1);
		try {
			return decodeURIComponent(raw);
		} catch {
			return raw;
		}
	}
	return null;
}
//#endregion
export { handleAuthPopupRequest };
