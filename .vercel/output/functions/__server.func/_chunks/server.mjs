import { i as betterAuth, n as genericOAuth, r as bearer, t as tanstackStartCookies } from "../_libs/better-auth+[...].mjs";
import { a as PostgresIntrospector, i as PostgresAdapter, o as PostgresQueryCompiler, s as CompiledQuery } from "../_libs/@better-auth/kysely-adapter+[...].mjs";
import { t as Pool } from "../_libs/pg.mjs";
import { n as getPglite, t as ensureDbReady } from "./db.mjs";
import { randomBytes } from "node:crypto";
//#region src/lib/auth/providers.ts
var GROK_PROVIDERS = [{
	providerId: "grok-google",
	idp: "google",
	label: "Google"
}, {
	providerId: "grok-x",
	idp: "twitter",
	label: "X"
}];
//#endregion
//#region src/lib/auth/pglite-dialect.ts
/** Factory used by `auth/server.ts`: `pgliteDialect(() => getPglite())`. */
function pgliteDialect(getClient) {
	return {
		createAdapter: () => new PostgresAdapter(),
		createDriver: () => new LazyPGliteDriver(getClient),
		createQueryCompiler: () => new PostgresQueryCompiler(),
		createIntrospector: (db) => new PostgresIntrospector(db)
	};
}
var LazyPGliteDriver = class {
	getClient;
	client;
	connection;
	queue = [];
	constructor(getClient) {
		this.getClient = getClient;
	}
	async init() {
		this.client = await this.getClient();
	}
	async acquireConnection() {
		if (this.client === void 0) this.client = await this.getClient();
		if (this.connection !== void 0) return new Promise((resolve) => {
			this.queue.push(resolve);
		});
		this.connection = new PGliteConnection(this.client);
		return this.connection;
	}
	async releaseConnection(connection) {
		if (connection !== this.connection) throw new Error("Invalid connection");
		const next = this.queue.shift();
		if (next === void 0) {
			this.connection = void 0;
			return;
		}
		next(this.connection);
	}
	async beginTransaction(conn, settings) {
		const c = conn;
		if (settings.isolationLevel) await c.executeQuery(CompiledQuery.raw(`start transaction isolation level ${settings.isolationLevel}`));
		else await c.executeQuery(CompiledQuery.raw("begin"));
	}
	async commitTransaction(conn) {
		await conn.executeQuery(CompiledQuery.raw("commit"));
	}
	async rollbackTransaction(conn) {
		await conn.executeQuery(CompiledQuery.raw("rollback"));
	}
	async destroy() {
		this.client = void 0;
		this.connection = void 0;
		this.queue = [];
	}
};
var PGliteConnection = class {
	client;
	constructor(client) {
		this.client = client;
	}
	async executeQuery(compiledQuery) {
		const result = await this.client.query(compiledQuery.sql, [...compiledQuery.parameters]);
		if (result.affectedRows) return {
			numAffectedRows: BigInt(result.affectedRows),
			rows: result.rows
		};
		return { rows: result.rows };
	}
	async *streamQuery(compiledQuery, chunkSize) {
		if (!Number.isInteger(chunkSize) || chunkSize <= 0) throw new Error("chunkSize must be a positive integer");
		const result = await this.client.query(compiledQuery.sql, [...compiledQuery.parameters]);
		for (let i = 0; i < result.rows.length; i += chunkSize) yield { rows: result.rows.slice(i, i + chunkSize) };
	}
};
/**
* Host patterns whose callbacks the preview client accepts. Better Auth derives
* the live preview's real origin from the request host and validates it against
* this list (wildcard-matched), so the OAuth `redirect_uri` becomes the concrete
* `https://<preview-host>/api/auth/oauth2/callback/...` the broker allows.
*/
var PREVIEW_ALLOWED_HOSTS = ["*.grok-sandbox.com"];
//#endregion
//#region src/lib/auth/server.ts
/**
* Self-hosted Better Auth for THIS app (server-only).
*
* Pre-wired for live preview + deploy — do not rewrite this file. To enable
* local email/password, flip the flag in `./email-password` only (see auth skill).
*
* The app runs its own Better Auth at `/api/auth/*`, so the session cookie stays
* on this app's own origin. Sign-in federates to the shared **Grok auth broker**
* (`GROK_AUTH_ISSUER`) via the `genericOAuth` plugin — the broker brokers the
* upstream sign-in methods (Google, X, …) and holds their shared secrets; this
* app only holds its own client id/secret and names the upstream it wants via
* each provider's `idp` hint.
*
* Tri-mode:
*   - Deployed: the deployer injects a per-app `GROK_AUTH_*` + `BETTER_AUTH_URL`
*     + `DATABASE_URL`, so real federated auth is persisted in Postgres.
*   - Sandbox live preview: no injection -> falls back to the shared **preview
*     client** (`./preview`) and derives the preview's `https://*.grok-sandbox.com`
*     origin from the request, so real sign-in works (no demo users). Sessions
*     and identities persist in the embedded PGLite DB (same DB as app data);
*     the process restart wipes both. Live-preview iframe clients use a bearer
*     token (partitioned cookies) — see `client.ts`.
*   - Explicitly off (`VITE_AUTH_ENABLED=false`): no providers; per-user server
*     functions fall back to a dev user (see `verify.server.ts`).
*
* NEVER import this from client code — it pulls in `pg` + the preview secret +
* server-only Better Auth internals. The client uses `@/lib/auth/client`;
* components read the user via `@/lib/auth/use-current-user`; server functions get
* a verified id via `@/lib/auth/middleware`.
*/
ensureDbReady().catch((err) => {
	console.error("[auth] DB bootstrap failed:", err);
});
/**
* Preview secret must outlive module reloads: PGLite (and its session rows) is
* stored on `globalThis`, so an HMR re-eval of this file must NOT mint a new
* signing secret or every existing session becomes invalid mid-dev. Process
* restart clears both the secret and PGLite together.
*/
var globalAuthRef = globalThis;
function previewAuthSecret() {
	globalAuthRef.__grokAuthPreviewSecret__ ??= randomBytes(32).toString("hex");
	return globalAuthRef.__grokAuthPreviewSecret__;
}
/** Read an env var, treating empty/whitespace as unset. */
var env = (key) => {
	const value = process.env[key]?.trim();
	return value ? value : void 0;
};
var authDisabled = env("VITE_AUTH_ENABLED") === "false";
var grokIssuer = env("GROK_AUTH_ISSUER") ?? "https://auth.grok.me";
var grokClientId = env("GROK_AUTH_CLIENT_ID") ?? "grok_preview";
var grokClientSecret = env("GROK_AUTH_CLIENT_SECRET") ?? "8bcdb7fc5a33874ad933ca568918d5790388a0795e44c4d1dea691f801b17ec5";
/** True when federated sign-in is active (real auth is enforced). */
var authConfigured = !authDisabled && Boolean(grokClientId && grokClientSecret);
var explicitBaseURL = env("BETTER_AUTH_URL");
var previewAllowedHosts = [...PREVIEW_ALLOWED_HOSTS];
var LOCAL_DEV_ORIGINS = [
	"http://localhost:8080",
	"http://127.0.0.1:8080",
	"http://[::1]:8080"
];
var baseURL = explicitBaseURL ?? {
	allowedHosts: [
		...previewAllowedHosts,
		"localhost",
		"127.0.0.1",
		"[::1]"
	],
	protocol: "auto",
	fallback: "http://localhost:8080"
};
var trustedOrigins = explicitBaseURL ? [explicitBaseURL, ...LOCAL_DEV_ORIGINS] : [
	...previewAllowedHosts,
	...previewAllowedHosts.flatMap((host) => [`https://${host}`, `http://${host}`]),
	...LOCAL_DEV_ORIGINS
];
var databaseUrl = env("DATABASE_URL");
var issuerBase = grokIssuer.replace(/\/+$/, "");
var grokAuthorizationUrl = `${issuerBase}/api/auth/oauth2/authorize`;
var grokTokenUrl = `${issuerBase}/api/auth/oauth2/token`;
var grokUserInfoUrl = `${issuerBase}/api/auth/oauth2/userinfo`;
var database = databaseUrl ? new Pool({ connectionString: databaseUrl }) : {
	dialect: pgliteDialect(() => getPglite()),
	type: "postgres"
};
/** Session token cookie name — also read by the live-preview popup completion page. */
var SESSION_TOKEN_COOKIE = "__Host-grok-auth.session_token";
var grokOAuthPlugin = authConfigured ? genericOAuth({ config: GROK_PROVIDERS.map(({ providerId, idp }) => ({
	providerId,
	clientId: grokClientId,
	clientSecret: grokClientSecret,
	authorizationUrl: grokAuthorizationUrl,
	tokenUrl: grokTokenUrl,
	userInfoUrl: grokUserInfoUrl,
	scopes: [
		"openid",
		"profile",
		"email"
	],
	authorizationUrlParams: {
		idp,
		prompt: "login"
	}
})) }) : null;
var auth = betterAuth({
	baseURL,
	secret: env("BETTER_AUTH_SECRET") ?? previewAuthSecret(),
	database,
	trustedOrigins,
	account: {
		encryptOAuthTokens: true,
		accountLinking: {
			enabled: true,
			trustedProviders: GROK_PROVIDERS.map((p) => p.providerId),
			requireLocalEmailVerified: false
		}
	},
	session: { cookieCache: {
		enabled: true,
		maxAge: 300
	} },
	emailAndPassword: { enabled: true },
	advanced: {
		useSecureCookies: false,
		defaultCookieAttributes: {
			secure: true,
			sameSite: "lax",
			path: "/"
		},
		cookies: {
			session_token: { name: SESSION_TOKEN_COOKIE },
			session_data: { name: "__Host-grok-auth.session_data" },
			account_data: { name: "__Host-grok-auth.account_data" },
			dont_remember: { name: "__Host-grok-auth.dont_remember" }
		}
	},
	plugins: [
		...grokOAuthPlugin ? [grokOAuthPlugin] : [],
		bearer(),
		tanstackStartCookies()
	]
});
//#endregion
export { GROK_PROVIDERS as i, auth as n, authConfigured as r, SESSION_TOKEN_COOKIE as t };
